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
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'review_required';
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

    // ── RC3: account deletion ───────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE account_deletion_status AS ENUM (
          'requested', 'blocked_owner', 'processing', 'completed', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id serial PRIMARY KEY,
        profile_id integer NOT NULL REFERENCES profiles(id),
        clerk_id_hash text NOT NULL,
        status account_deletion_status NOT NULL DEFAULT 'requested',
        confirmation_phrase text,
        block_reason text,
        error_message text,
        steps_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
        requested_at timestamptz NOT NULL DEFAULT now(),
        confirmed_at timestamptz,
        completed_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_audit (
        id serial PRIMARY KEY,
        profile_id integer,
        clerk_id_hash text NOT NULL,
        organization_id integer,
        outcome text NOT NULL,
        retention_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // ── RC3: data exports ───────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE data_export_status AS ENUM (
          'requested', 'processing', 'ready', 'failed', 'expired'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_export_requests (
        id serial PRIMARY KEY,
        profile_id integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status data_export_status NOT NULL DEFAULT 'requested',
        object_path text,
        download_token_hash text,
        error_message text,
        byte_size integer,
        expires_at timestamptz,
        notified_at timestamptz,
        requested_at timestamptz NOT NULL DEFAULT now(),
        ready_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // ── RC3: recurring schedules ────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly', 'monthly', 'custom');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurring_schedule_status AS ENUM (
          'active', 'paused', 'cancelled', 'expired', 'error'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurring_holiday_behavior AS ENUM (
          'include', 'skip', 'next_business_day'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE recurring_generation_status AS ENUM (
          'created', 'skipped', 'review_required', 'failed', 'duplicate'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_schedules (
        id serial PRIMARY KEY,
        customer_id integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        organization_id integer,
        project_id integer REFERENCES projects(id),
        name text NOT NULL,
        status recurring_schedule_status NOT NULL DEFAULT 'active',
        recurrence_type recurrence_type NOT NULL,
        timezone text NOT NULL DEFAULT 'America/Chicago',
        days_of_week jsonb NOT NULL DEFAULT '[]'::jsonb,
        day_of_month integer,
        interval_days integer,
        start_date timestamptz NOT NULL,
        end_date timestamptz,
        skip_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
        holiday_behavior recurring_holiday_behavior NOT NULL DEFAULT 'skip',
        material_type material_type NOT NULL,
        truck_type truck_type NOT NULL,
        quantity_tons numeric(10, 2) NOT NULL,
        pickup_address text NOT NULL,
        delivery_address text NOT NULL,
        start_time text NOT NULL DEFAULT '08:00',
        estimated_hours numeric(8, 2) NOT NULL DEFAULT 8,
        trucks_needed integer NOT NULL DEFAULT 1,
        budget_per_hour numeric(10, 2),
        notes text,
        generate_horizon_days integer NOT NULL DEFAULT 14,
        last_generated_for_date text,
        last_run_at timestamptz,
        last_error text,
        consecutive_failures integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_generation_runs (
        id serial PRIMARY KEY,
        schedule_id integer NOT NULL REFERENCES recurring_schedules(id) ON DELETE CASCADE,
        occurrence_date text NOT NULL,
        status recurring_generation_status NOT NULL,
        request_id integer,
        error_message text,
        idempotency_key text NOT NULL,
        attempt integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS recurring_generation_idempotency_idx
        ON recurring_generation_runs (idempotency_key);
    `);

    await client.query(`
      ALTER TABLE requests
        ADD COLUMN IF NOT EXISTS recurring_schedule_id integer;
    `);

    await client.query(`
      ALTER TABLE dot_cdl_compliance
        ADD COLUMN IF NOT EXISTS fmcsa_source text,
        ADD COLUMN IF NOT EXISTS fmcsa_lookup_fields text,
        ADD COLUMN IF NOT EXISTS fmcsa_lookup_error text;
    `);

    await client.query("COMMIT");
    logger.info("Startup migrations applied (RC3 account/export/recurring/fmcsa schema)");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Startup migrations failed");
    throw err;
  } finally {
    client.release();
  }
}
