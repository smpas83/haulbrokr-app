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

    // Onboarding center + document upload hardening (PR #124 follow-on)
    await client.query(`
      ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS last_admin_onboarding_view_at timestamptz;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS driver_documents_profile_doc_type_uidx
        ON driver_documents (profile_id, doc_type);
    `);

    // Website traffic (page views) for admin dashboard
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id serial PRIMARY KEY,
        path text NOT NULL,
        referrer text,
        session_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS page_views_created_at_idx
        ON page_views (created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS page_views_path_idx
        ON page_views (path);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS page_views_session_created_idx
        ON page_views (session_id, created_at);
    `);

    // ── Centralized marketplace pricing engine ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_settings (
        id serial PRIMARY KEY,
        key text NOT NULL,
        value numeric(12, 6) NOT NULL,
        description text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS pricing_settings_key_uidx
        ON pricing_settings (key);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_surcharge_weeks (
        id serial PRIMARY KEY,
        week_start_date date NOT NULL,
        national_diesel_price numeric(8, 3),
        surcharge_rate numeric(5, 4) NOT NULL,
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS fuel_surcharge_weeks_week_start_uidx
        ON fuel_surcharge_weeks (week_start_date);
    `);

    await client.query(`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS fuel_surcharge_rate numeric(5, 4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fuel_surcharge_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tolls_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS wait_time_hours numeric(8, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS wait_time_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS emergency_dispatch_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS holiday_surcharge_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_emergency_dispatch boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_holiday_haul boolean NOT NULL DEFAULT false;
    `);

    // Seed customer marketplace fee (default 15%, base-haul basis) and other defaults.
    await client.query(`
      INSERT INTO pricing_settings (key, value, description)
      VALUES
        ('marketplace_fee_rate', 0.15, 'Customer marketplace / service fee charged on the configured fee basis (decimal, e.g. 0.15). Never deducted from carrier payout.'),
        ('marketplace_fee_basis', 0, '0 = base haul only (default); 1 = base haul plus surcharges. Taxes are never in the fee basis.'),
        ('fuel_surcharge_rate', 0, 'Fallback fuel surcharge rate when no weekly diesel schedule row is active'),
        ('emergency_dispatch_rate', 0.10, 'Emergency dispatch surcharge as a decimal of base haul'),
        ('holiday_surcharge_rate', 0.15, 'Holiday haul surcharge as a decimal of base haul'),
        ('wait_time_rate_per_hour', 75, 'Wait-time charge in USD per billable hour (after grace period)'),
        ('wait_time_grace_period_minutes', 15, 'Minutes of wait time before billing begins'),
        ('tax_rate', 0, 'Default sales/use tax rate as a decimal (applied when tax_enabled = 1). Marketplace fee is not taxed.'),
        ('tax_enabled', 0, 'Whether taxes are applied by default (1 = yes, 0 = no)')
      ON CONFLICT (key) DO NOTHING;
    `);
    // Relabel legacy description if an older seed is already present.
    await client.query(`
      UPDATE pricing_settings
      SET description = 'Customer marketplace / service fee charged on the configured fee basis (decimal, e.g. 0.15). Never deducted from carrier payout.'
      WHERE key = 'marketplace_fee_rate'
        AND (description IS NULL OR description NOT LIKE 'Customer marketplace%');
    `);

    await client.query("COMMIT");
    logger.info("Startup migrations applied (refund + onboarding + page_views + pricing schema)");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Startup migrations failed");
    throw err;
  } finally {
    client.release();
  }
}
