-- Enable UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  dept_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  triage_rules JSONB DEFAULT '{}'::jsonb
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  staff_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('nurse','physician','admin','tech')),
  dept_id INT REFERENCES departments(dept_id) ON UPDATE CASCADE,
  active BOOLEAN DEFAULT TRUE
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anon_token TEXT NOT NULL UNIQUE,          -- used for public ETA view
  severity INT CHECK (severity BETWEEN 1 AND 5),
  symptoms TEXT,
  source TEXT NOT NULL CHECK (source IN ('kiosk','mobile','desk')) DEFAULT 'kiosk',
  full_name TEXT,
  dob DATE, 
  phone TEXT
);

-- Visits (one per check-in)
CREATE TABLE IF NOT EXISTS visits (
  visit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
  dept_id INT NOT NULL REFERENCES departments(dept_id) ON UPDATE CASCADE,
  assigned_staff INT REFERENCES staff(staff_id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','in_service','completed','left')) DEFAULT 'queued',
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_start TIMESTAMPTZ,
  service_end TIMESTAMPTZ,
  predicted_wait_minutes INT,
  actual_wait_minutes INT
);

CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_checkin ON visits(checkin_time);
CREATE INDEX IF NOT EXISTS idx_visits_dept_status_time ON visits(dept_id, status, checkin_time);

-- Visit event audit trail
CREATE TABLE IF NOT EXISTS visit_events (
  event_id BIGSERIAL PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,                 -- checkin | start | complete | leave | reassigned | alert
  payload JSONB
);

-- Hourly aggregates for analytics
CREATE TABLE IF NOT EXISTS wait_time_agg_hourly (
  bucket_start TIMESTAMPTZ NOT NULL,
  dept_id INT NOT NULL REFERENCES departments(dept_id),
  avg_wait_minutes NUMERIC,
  p90_wait_minutes NUMERIC,
  arrivals INT,
  in_service INT,
  PRIMARY KEY (bucket_start, dept_id)
);

-- System log (append only)
CREATE TABLE IF NOT EXISTS events_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  payload JSONB
);

-- Optional: app auth (if not using external IdP)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL CHECK (name IN ('admin','staff','patient','it'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Indexes for performance optimization

-- Fast lookups of queued visits by department and time
CREATE INDEX IF NOT EXISTS idx_visits_dept_status_time
  ON visits (dept_id, status, checkin_time);

-- Common filters on status alone
CREATE INDEX IF NOT EXISTS idx_visits_status
  ON visits (status);

-- Sort and filter by checkin time
CREATE INDEX IF NOT EXISTS idx_visits_checkin_time
  ON visits (checkin_time);

-- Staff load: who is in_service and how many per staff
CREATE INDEX IF NOT EXISTS idx_visits_assigned_staff_status
  ON visits (assigned_staff, status);

-- Quick lookup of visits by patient
CREATE INDEX IF NOT EXISTS idx_visits_patient
  ON visits (patient_id);

-- Public ETA lookup by anon token
CREATE INDEX IF NOT EXISTS idx_patients_anon_token
  ON patients (anon_token);

-- Sometimes you might group or filter by severity
CREATE INDEX IF NOT EXISTS idx_patients_severity
  ON patients (severity);

-- Staff by department and active flag
CREATE INDEX IF NOT EXISTS idx_staff_dept_active
  ON staff (dept_id, active);

-- Hourly aggregates are already primary keyed by (bucket_start, dept_id)
-- but this helps when you filter by department first
CREATE INDEX IF NOT EXISTS idx_wait_agg_dept_bucket
  ON wait_time_agg_hourly (dept_id, bucket_start);