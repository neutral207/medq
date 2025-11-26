# Utility helpers for MedQ backend
def minutes_from(now, then):
    return int((now-then).total_seconds()//60)
