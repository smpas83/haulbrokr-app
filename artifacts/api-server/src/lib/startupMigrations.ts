import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent production schema sync for refund tables/columns.
 * Runs on API boot so Render deploys apply Neon changes without a manual `db push`.
 */
export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        ALTER TYPE job_payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE job_payment_status ADD VALUE IF NOT EXISTS 'refunded';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'payment_refunded';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE refund_status AS ENUM ('pending', 'succeeded', 'failed', 'canceled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS refunded_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS refund_attempts integer NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        id serial PRIMARY KEY,
        job_id integer NOT NULL REFERENCES jobs(id),
        stripe_refund_id text NOT NULL,
        stripe_payment_intent_id text NOT NULL,
        stripe_charge_id text NOT NULL,
        amount numeric(12, 2) NOT NULL,
        reason text,
        status refund_status NOT NULL DEFAULT 'pending',
        created_by_profile_id integer REFERENCES profiles(id),
        created_by_staff_username text,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_stripe_refund_id_idx
        ON payment_refunds (stripe_refund_id);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_idempotency_key_idx
        ON payment_refunds (idempotency_key);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id serial PRIMARY KEY,
        profile_id integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        expo_push_token text NOT NULL,
        platform text NOT NULL DEFAULT 'unknown',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_profile_token_idx
        ON device_tokens (profile_id, expo_push_token);
    `);

    await client.query("COMMIT");
    logger.info("Startup migrations applied (refund schema)");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Startup migrations failed");
    throw err;
  } finally {
    client.release();
  }
}
