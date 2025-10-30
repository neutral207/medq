INSERT INTO departments (name) VALUES
  ('Emergency'), ('Radiology'), ('Pediatrics')
ON CONFLICT DO NOTHING;

INSERT INTO staff (name, role, dept_id) VALUES
  ('Avery Chen','nurse',1),
  ('Jordan Lee','physician',1),
  ('Sam Patel','tech',2)
ON CONFLICT DO NOTHING;
