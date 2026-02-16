INSERT INTO visits (
    visit_id,
    patient_id,
    dept_id,
    assigned_staff,
    status,
    checkin_time,
    service_start,
    service_end,
    predicted_wait_minutes,
    actual_wait_minutes
)
SELECT
    gen_random_uuid(),
    p.patient_id,
    d.dept_id,
    NULL,
    'completed',
    now() - (random() * interval '48 hours'),
    now() - (random() * interval '47 hours'),
    now() - (random() * interval '47 hours') + (random() * interval '30 minutes'),
    -- predicted wait correlates with severity and queue size
    (10 + (5 * (6 - p.severity)) + (random() * 15))::int,
    (10 + (5 * (6 - p.severity)) + (random() * 10))::int
FROM patients p
CROSS JOIN departments d
ORDER BY random()
LIMIT 500;