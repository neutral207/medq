from alembic import op
from pathlib import Path

# revision identifiers
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Load and execute schema.sql
    base = Path(__file__).resolve().parents[2]   # points to backend/src/database
    schema_path = base / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    op.execute(sql)

def downgrade():
    # Minimal reversible teardown (drop in safe order)
    op.execute("""
      DROP TABLE IF EXISTS user_roles;
      DROP TABLE IF EXISTS roles;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS visit_events;
      DROP TABLE IF EXISTS wait_time_agg_hourly;
      DROP TABLE IF EXISTS visits;
      DROP TABLE IF EXISTS patients;
      DROP TABLE IF EXISTS staff;
      DROP TABLE IF EXISTS events_log;
      DROP TABLE IF EXISTS departments;
    """)