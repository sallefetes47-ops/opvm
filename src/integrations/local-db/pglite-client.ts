// PGlite-backed local database for the Electron desktop build.
// Loaded lazily so it is never bundled into the regular web app.
import { PGlite } from '@electric-sql/pglite';

let dbInstance: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

// Inlined SQL bootstrap. We keep this minimal & idempotent — the goal is to
// reproduce the public schema needed by the app, not to replay every cloud
// migration verbatim. Anything UI-only / RLS-only is omitted because the
// desktop build does not use Postgres roles.
const BOOTSTRAP_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'employee', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permit_type AS ENUM ('رخصة بناء', 'رخصة تجزئة', 'رخصة هدم', 'شهادة تقسيم');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE municipality AS ENUM ('غرداية', 'العطف', 'بنورة', 'متليلي', 'ضاية بن ضحوة');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Roles --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Local auth (replaces auth.users) -----------------------------------------
CREATE TABLE IF NOT EXISTS local_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Files (urban permits) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_number text,
  full_name text NOT NULL,
  national_id text,
  birth_date date,
  birth_place text,
  address text,
  phone text,
  municipality municipality,
  location text,
  area numeric,
  permit_type permit_type,
  contract_type text,
  year integer,
  study_date date,
  decision_date date,
  committee_opinion text,
  rejection_reason text,
  reservations text,
  floors_count integer,
  engineer_name text,
  total_area numeric,
  plots_count integer,
  demolition_reason text,
  work_duration text,
  shares_count integer,
  property_reference text,
  notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  study_date date,
  decision text,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  doc_type text,
  reference text,
  issue_date date,
  source text,
  summary text,
  extracted_text text,
  file_url text,
  file_name text,
  tags text[],
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meeting_date date,
  location text,
  attendees text,
  agenda text,
  decisions text,
  notes text,
  file_url text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  summons_date date,
  location text,
  members text,
  notes text,
  file_url text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default admin (email: admin@opvm.local / password: admin123) ---------
-- Hash is sha256('admin123') hex
INSERT INTO local_users (id, email, password_hash, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@opvm.local',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'المدير'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'المدير', 'admin@opvm.local')
ON CONFLICT (user_id) DO NOTHING;
`;

export async function getLocalDb(): Promise<PGlite> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // In Electron, persist under userData; in browser (dev), use idb://opvm
    let dataDir = 'idb://opvm-local';
    try {
      const w: any = window as any;
      if (w?.electronAPI?.getUserDataPath) {
        const userData = await w.electronAPI.getUserDataPath();
        dataDir = `${userData}/opvm-db`;
      }
    } catch {
      /* ignore — fall back to idb */
    }

    const db = new PGlite(dataDir);
    await db.exec(BOOTSTRAP_SQL);
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

// sha256 helper used by local auth
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
