CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments
INSERT INTO departments (name, triage_rules) VALUES
  ('Emergency', '{}'::jsonb),
  ('Radiology', '{}'::jsonb),
  ('Pediatrics', '{}'::jsonb),
  ('Cardiology', '{}'::jsonb),
  ('Urgent Care', '{}'::jsonb),
  ('General Medicine', '{}'::jsonb),
  ('Orthopedics', '{}'::jsonb),
  ('Neurology', '{}'::jsonb),
  ('Oncology', '{}'::jsonb),
  ('OBGYN', '{}'::jsonb),
  ('Surgery', '{}'::jsonb),
  ('ICU', '{}'::jsonb),
  ('Laboratory', '{}'::jsonb),
  ('Pharmacy', '{}'::jsonb),
  ('Behavioral Health', '{}'::jsonb),
  ('Dermatology', '{}'::jsonb),
  ('ENT', '{}'::jsonb),
  ('Ophthalmology', '{}'::jsonb),
  ('Gastroenterology', '{}'::jsonb),
  ('Pulmonology', '{}'::jsonb),
  ('Nephrology', '{}'::jsonb),
  ('Urology', '{}'::jsonb),
  ('Endocrinology', '{}'::jsonb),
  ('Infectious Disease', '{}'::jsonb),
  ('Rehabilitation', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Staff (look up dept ids by name)
INSERT INTO staff (name, role, dept_id, active)
SELECT v.name, v.role, d.dept_id, true
FROM (VALUES
  ('Admin User','admin', NULL),               
  ('Avery Chen','nurse','Emergency'),
  ('Jordan Lee','doctor','Emergency'),
  ('Sam Patel','physician','Pediatrics'),
  ('Priya Desai','nurse','Pediatrics'),
  ('Miguel Santos','doctor','Cardiology'),
  ('Taylor Brooks','doctor','Radiology')
) AS v(name, role, dept_name)
LEFT JOIN departments d ON d.name = v.dept_name
ON CONFLICT DO NOTHING;

-- Helper: generate short anon tokens
-- call: substr(encode(digest(gen_random_uuid()::text, 'sha1'),'hex'),1,12)
-- (requires pgcrypto; digest available with it)

-- Patients (minimal PHI, use anon_token for public ETA)
INSERT INTO patients (anon_token, severity, symptoms, source)
VALUES
  (substr(encode(digest(gen_random_uuid()::text,'sha1'),'hex'),1,12), 3, 'Headache and nausea', 'kiosk'),
  (substr(encode(digest(gen_random_uuid()::text,'sha1'),'hex'),1,12), 2, 'Sprained wrist', 'desk'),
  (substr(encode(digest(gen_random_uuid()::text,'sha1'),'hex'),1,12), 4, 'Chest pain', 'kiosk'),
  (substr(encode(digest(gen_random_uuid()::text,'sha1'),'hex'),1,12), 1, 'Pediatric routine check', 'mobile'),
  (substr(encode(digest(gen_random_uuid()::text,'sha1'),'hex'),1,12), 5, 'Shortness of breath', 'kiosk')
ON CONFLICT DO NOTHING;

-- Create some visits with predicted and actual waits
-- Map patients to departments and optionally assign staff
WITH p AS (
  SELECT patient_id, row_number() OVER () rn FROM patients ORDER BY created_at
),
depts AS (
  SELECT name, dept_id FROM departments
),
st AS (
  SELECT s.staff_id, d.name dept_name
  FROM staff s JOIN departments d ON d.dept_id = s.dept_id
)
INSERT INTO visits (
  patient_id, dept_id, assigned_staff, status,
  checkin_time, service_start, service_end,
  predicted_wait_minutes, actual_wait_minutes
)
SELECT
  p1.patient_id,
  (SELECT dept_id FROM depts WHERE name='Emergency'),
  (SELECT staff_id FROM st WHERE dept_name='Emergency' AND staff_id = (SELECT MIN(staff_id) FROM st WHERE dept_name='Emergency')),
  'completed',
  now() - interval '90 minutes',         -- checked in 90 min ago
  now() - interval '60 minutes',         -- service started 60 min ago
  now() - interval '30 minutes',         -- finished 30 min ago
  35,
  30
FROM p p1 WHERE p1.rn = 1
UNION ALL
SELECT
  p2.patient_id,
  (SELECT dept_id FROM depts WHERE name='Radiology'),
  NULL,
  'in-progress',
  now() - interval '50 minutes',
  now() - interval '10 minutes',
  NULL,
  40,
  NULL
FROM p p2 WHERE p2.rn = 2
UNION ALL
SELECT
  p3.patient_id,
  (SELECT dept_id FROM depts WHERE name='Emergency'),
  (SELECT staff_id FROM st WHERE dept_name='Emergency' AND staff_id = (SELECT MAX(staff_id) FROM st WHERE dept_name='Emergency')),
  'waiting',
  now() - interval '20 minutes',
  NULL,
  NULL,
  25,
  NULL
FROM p p3 WHERE p3.rn = 3
UNION ALL
SELECT
  p4.patient_id,
  (SELECT dept_id FROM depts WHERE name='Pediatrics'),
  NULL,
  'waiting',
  now() - interval '10 minutes',
  NULL,
  NULL,
  15,
  NULL
FROM p p4 WHERE p4.rn = 4
UNION ALL
SELECT
  p5.patient_id,
  (SELECT dept_id FROM depts WHERE name='Cardiology'),
  NULL,
  'waiting',
  now() - interval '5 minutes',
  NULL,
  NULL,
  40,
  NULL
FROM p p5 WHERE p5.rn = 5
ON CONFLICT DO NOTHING;

-- Visit events audit trail for the first three visits
WITH v AS (
  SELECT visit_id, status, checkin_time, service_start, service_end,
         row_number() OVER (ORDER BY checkin_time) rn
  FROM visits
)
INSERT INTO visit_events (visit_id, occurred_at, event_type, payload)
SELECT visit_id, checkin_time, 'checkin', jsonb_build_object('source','seed')
FROM v WHERE rn <= 3
UNION ALL
SELECT visit_id, service_start, 'start', jsonb_build_object('assigned','seed')
FROM v WHERE rn = 1
UNION ALL
SELECT visit_id, service_end, 'complete', jsonb_build_object('notes','seed completion')
FROM v WHERE rn = 1
ON CONFLICT DO NOTHING;

-- Hourly aggregates example rows
INSERT INTO wait_time_agg_hourly (bucket_start, dept_id, avg_wait_minutes, p90_wait_minutes, arrivals, in_service)
SELECT date_trunc('hour', now()) - interval '1 hour',
       d.dept_id, 28, 55, 18, 6
FROM departments d WHERE d.name='Emergency'
ON CONFLICT DO NOTHING;

INSERT INTO wait_time_agg_hourly (bucket_start, dept_id, avg_wait_minutes, p90_wait_minutes, arrivals, in_service)
SELECT date_trunc('hour', now()),
       d.dept_id, 22, 45, 21, 7
FROM departments d WHERE d.name='Emergency'
ON CONFLICT DO NOTHING;

-- Optional auth seed (only if using internal auth)
INSERT INTO roles (name) VALUES
  ('admin'), ('staff'), ('patient'), ('it')
ON CONFLICT (name) DO NOTHING;

-- create a demo admin user
WITH u AS (
  INSERT INTO users (email, password_hash)
  VALUES ('admin@medq.local', '$2b$12$changemechangemechangemechngm')  -- placeholder bcrypt
  ON CONFLICT (email) DO NOTHING
  RETURNING user_id
),
r AS (
  SELECT role_id FROM roles WHERE name='admin'
)
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id FROM u CROSS JOIN r
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STAFF AUTH ACCOUNTS (Login credentials for staff members)
-- ============================================================================
-- Password for ALL test users: "password123"
-- Bcrypt hash: $2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO
--
-- Username pattern: firstname (lowercase) OR role-based
-- Role mapping from staff table -> staff_auth table:
--   staff.role='admin' -> staff_auth.role='admin'
--   staff.role='doctor' -> staff_auth.role='doctor'
--   staff.role='physician' -> staff_auth.role='physician'
--   staff.role='nurse' -> staff_auth.role='nurse'
-- ============================================================================

-- 1. Admin User (System Administrator)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'admin', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'admin', s.dept_id, s.active
FROM staff s WHERE s.name = 'Admin User'
ON CONFLICT (username) DO NOTHING;

-- 2. Avery Chen (Nurse - Emergency)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'avery', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'nurse', s.dept_id, s.active
FROM staff s WHERE s.name = 'Avery Chen'
ON CONFLICT (username) DO NOTHING;

-- 3. Jordan Lee (Doctor - Emergency)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'jordan', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'doctor', s.dept_id, s.active
FROM staff s WHERE s.name = 'Jordan Lee'
ON CONFLICT (username) DO NOTHING;

-- 4. Sam Patel (Physician - Pediatrics)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'sam', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'physician', s.dept_id, s.active
FROM staff s WHERE s.name = 'Sam Patel'
ON CONFLICT (username) DO NOTHING;

-- 5. Priya Desai (Nurse - Pediatrics)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'priya', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'nurse', s.dept_id, s.active
FROM staff s WHERE s.name = 'Priya Desai'
ON CONFLICT (username) DO NOTHING;

-- 6. Miguel Santos (Doctor - Cardiology)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'miguel', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'doctor', s.dept_id, s.active
FROM staff s WHERE s.name = 'Miguel Santos'
ON CONFLICT (username) DO NOTHING;

-- 7. Taylor Brooks (Doctor - Radiology)
INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
SELECT 'taylor', '$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO',
       s.name, 'doctor', s.dept_id, s.active
FROM staff s WHERE s.name = 'Taylor Brooks'
ON CONFLICT (username) DO NOTHING;

INSERT INTO wait_time_agg_hourly (bucket_start, dept_id, avg_wait_minutes, visits, active_staff, in_service)
SELECT
  date_trunc('hour', v.checkin_time) AS bucket_start,
  v.dept_id,
  AVG(COALESCE(v.actual_wait_minutes, v.predicted_wait_minutes, 0))::numeric(10,2) AS avg_wait_minutes,
  COUNT(*) AS visits,
  0 AS active_staff,
  0 AS in_service
FROM visits v
WHERE v.checkin_time >= now() - interval '14 days'
GROUP BY 1,2
ON CONFLICT (bucket_start, dept_id)
DO UPDATE SET
  avg_wait_minutes = EXCLUDED.avg_wait_minutes,
  visits = EXCLUDED.visits;