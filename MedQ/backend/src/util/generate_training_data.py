import csv
import random
from datetime import datetime, timedelta

def synthetic_log():
    severity = random.randint(1, 5)
    hour = random.randint(0, 23)
    queue_length = random.randint(0, 20)
    staff_in_service = random.randint(1, 8)

    # base wait time
    wait = 5 + queue_length * 2

    # severity impact (high severity = faster triage)
    wait -= (severity - 1) * 1.5

    # hour impact (busy hours)
    if 8 <= hour <= 11 or 16 <= hour <= 19:
        wait += random.randint(5, 25)

    wait += random.randint(0, 10)

    return {
        "severity": severity,
        "hour_of_day": hour,
        "queue_length": queue_length,
        "staff_in_service": staff_in_service,
        "actual_wait_minutes": int(wait)
    }

rows = [synthetic_log() for _ in range(3000)]

with open("synthetic_training_data.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print("Generated synthetic_training_data.csv")