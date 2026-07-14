import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent production schema sync.
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
    for (const value of [
      "invoice_paid",
      "payout_paid",
      "payout_failed",
      "recurring_created",
      "job_reminder",
    ]) {
      await client.query(`
        DO $$ BEGIN
          ALTER TYPE activity_type ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    for (const value of ["fleet_manager", "dispatcher"]) {
      await client.query(`
        DO $$ BEGIN
          ALTER TYPE org_role ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE refund_status AS ENUM ('pending', 'succeeded', 'failed', 'canceled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurring_haul_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id serial PRIMARY KEY,
        stripe_event_id text NOT NULL UNIQUE,
        event_type text NOT NULL,
        handled boolean NOT NULL DEFAULT false,
        action text,
        reason text,
        processed_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id serial PRIMARY KEY,
        profile_id integer NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
        push_enabled boolean NOT NULL DEFAULT true,
        email_enabled boolean NOT NULL DEFAULT true,
        sms_enabled boolean NOT NULL DEFAULT false,
        job_updates boolean NOT NULL DEFAULT true,
        payment_updates boolean NOT NULL DEFAULT true,
        bid_updates boolean NOT NULL DEFAULT true,
        compliance_updates boolean NOT NULL DEFAULT true,
        reminders boolean NOT NULL DEFAULT true,
        marketing boolean NOT NULL DEFAULT false,
        sms_phone text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS billing_email text,
        ADD COLUMN IF NOT EXISTS phone text,
        ADD COLUMN IF NOT EXISTS address text,
        ADD COLUMN IF NOT EXISTS city text,
        ADD COLUMN IF NOT EXISTS state text,
        ADD COLUMN IF NOT EXISTS zip text;
    `);

    await client.query(`
      ALTER TABLE payout_accounts
        ADD COLUMN IF NOT EXISTS last_payout_id text,
        ADD COLUMN IF NOT EXISTS last_payout_status text,
        ADD COLUMN IF NOT EXISTS last_payout_amount text,
        ADD COLUMN IF NOT EXISTS last_payout_at timestamptz,
        ADD COLUMN IF NOT EXISTS last_payout_failure_code text,
        ADD COLUMN IF NOT EXISTS last_payout_failure_message text;
    `);

    await client.query(`
      ALTER TABLE dot_cdl_compliance
        ADD COLUMN IF NOT EXISTS fmcsa_legal_name text,
        ADD COLUMN IF NOT EXISTS fmcsa_dba_name text,
        ADD COLUMN IF NOT EXISTS fmcsa_allowed_to_operate text,
        ADD COLUMN IF NOT EXISTS fmcsa_out_of_service text,
        ADD COLUMN IF NOT EXISTS fmcsa_raw_payload text,
        ADD COLUMN IF NOT EXISTS fmcsa_last_error text,
        ADD COLUMN IF NOT EXISTS fmcsa_lookup_attempts integer NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_hauls (
        id serial PRIMARY KEY,
        customer_id integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        organization_id integer,
        project_id integer REFERENCES projects(id),
        material_type material_type NOT NULL,
        truck_type truck_type NOT NULL,
        quantity_tons numeric(10, 2) NOT NULL,
        pickup_address text NOT NULL,
        delivery_address text NOT NULL,
        start_time text NOT NULL DEFAULT '08:00',
        estimated_hours numeric(8, 2) NOT NULL,
        trucks_needed integer NOT NULL DEFAULT 1,
        budget_per_hour numeric(10, 2),
        notes text,
        frequency recurring_frequency NOT NULL,
        days_of_week text,
        day_of_month integer,
        start_date timestamptz NOT NULL,
        end_date timestamptz,
        next_run_at timestamptz NOT NULL,
        reminder_hours_before integer DEFAULT 24,
        status recurring_haul_status NOT NULL DEFAULT 'active',
        occurrence_count integer NOT NULL DEFAULT 0,
        max_occurrences integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_haul_occurrences (
        id serial PRIMARY KEY,
        recurring_haul_id integer NOT NULL REFERENCES recurring_hauls(id) ON DELETE CASCADE,
        request_id integer REFERENCES requests(id),
        scheduled_date timestamptz NOT NULL,
        reminder_sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS recurring_hauls_next_run_idx
        ON recurring_hauls (status, next_run_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS recurring_occurrences_series_idx
        ON recurring_haul_occurrences (recurring_haul_id, scheduled_date);
    `);

    await client.query("COMMIT");
    logger.info("Startup migrations applied");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Startup migrations failed");
    throw err;
  } finally {
    client.release();
  }
}
