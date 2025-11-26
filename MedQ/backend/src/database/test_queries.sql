-- 1. Current queue for a department (sorted by arrival time)
SELECT v.visit_id,
       p.anon_token,
       p.severity,
       v.checkin_time,
       v.predicted_wait_minutes
FROM visits v
JOIN patients p ON p.patient_id = v.patient_id
JOIN departments d ON d.dept_id = v.dept_id
WHERE d.name = 'Emergency'
  AND v.status = 'queued'
ORDER BY v.checkin_time ASC;


-- 2. Average and maximum wait time per department today
SELECT d.name AS department,
       AVG(v.actual_wait_minutes) AS avg_wait,
       MAX(v.actual_wait_minutes) AS max_wait,
       COUNT(*) AS completed_visits
FROM visits v
JOIN departments d ON d.dept_id = v.dept_id
WHERE v.status = 'completed'
  AND v.checkin_time::date = CURRENT_DATE
GROUP BY d.name
ORDER BY avg_wait DESC;


-- 3. Arrivals per hour for the current date
SELECT date_trunc('hour', checkin_time) AS hour_bucket,
       COUNT(*) AS arrivals
FROM visits
WHERE checkin_time::date = CURRENT_DATE
GROUP BY hour_bucket
ORDER BY hour_bucket;


-- 4. Staff load (how many patients each staff member is currently treating)
SELECT s.name,
       s.role,
       COUNT(*) AS in_service_count
FROM visits v
JOIN staff s ON s.staff_id = v.assigned_staff
WHERE v.status = 'in_service'
GROUP BY s.name, s.role
ORDER BY in_service_count DESC;


-- 5. Patients waiting longer than their predicted wait time
SELECT v.visit_id,
       p.anon_token,
       v.predicted_wait_minutes,
       EXTRACT(EPOCH FROM (now() - v.checkin_time)) / 60 AS minutes_waited
FROM visits v
JOIN patients p ON p.patient_id = v.patient_id
WHERE v.status = 'queued'
  AND now() - v.checkin_time > (v.predicted_wait_minutes || ' minutes')::interval;


-- 6. Verify hourly aggregate table matches raw data averages
SELECT h.bucket_start,
       d.name AS department,
       h.avg_wait_minutes AS aggregated_avg,
       AVG(v.actual_wait_minutes) AS raw_avg
FROM wait_time_agg_hourly h
JOIN departments d ON d.dept_id = h.dept_id
JOIN visits v
  ON v.dept_id = h.dept_id
 AND v.checkin_time >= h.bucket_start
 AND v.checkin_time <  h.bucket_start + interval '1 hour'
GROUP BY h.bucket_start, d.name, h.avg_wait_minutes
ORDER BY h.bucket_start;