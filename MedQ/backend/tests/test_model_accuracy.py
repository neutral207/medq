from pathlib import Path
import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error
import numpy as np

# Base paths
BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BACKEND_DIR / "src" / "ml" / "wait_time_model.pkl"
DATA_PATH = BACKEND_DIR / "src" / "util" / "synthetic_training_data.csv"


def test_model_file_exists():
    assert MODEL_PATH.exists(), f"Model file not found at {MODEL_PATH}"


def load_model():
    return joblib.load(MODEL_PATH)


def test_model_predicts_reasonable_range():
    model = load_model()

    # Two simple synthetic inputs
    df = pd.DataFrame([
        {"severity": 3, "hour_of_day": 10, "queue_length": 2, "staff_in_service": 4},
        {"severity": 2, "hour_of_day": 18, "queue_length": 15, "staff_in_service": 2},
    ])

    preds = model.predict(df)

    # Wait times should be positive and not absurdly huge
    for p in preds:
        assert p > 0, f"Predicted wait should be positive, got {p}"
        assert p < 240, f"Predicted wait seems too large, got {p}"


def test_model_accuracy_on_synthetic_data():
    model = load_model()
    assert DATA_PATH.exists(), f"Training data not found at {DATA_PATH}"

    df = pd.read_csv(DATA_PATH)

    X = df.drop("actual_wait_minutes", axis=1)
    y = df["actual_wait_minutes"]

    preds = model.predict(X)

    mae = mean_absolute_error(y, preds)

    # Synthetic data is fairly regular, so we expect a small error
    assert mae < 20, f"Mean absolute error too high: {mae}"


def test_queue_length_increases_wait():
    model = load_model()

    # Order of features must match training: severity, hour_of_day, queue_length, staff_in_service
    low_queue = np.array([[3, 14, 2, 4]])   # shorter queue
    high_queue = np.array([[3, 14, 15, 4]]) # longer queue

    low_pred = model.predict(low_queue)[0]
    high_pred = model.predict(high_queue)[0]

    # High queue should not give much smaller wait than low queue
    assert high_pred >= low_pred - 5, (
        f"High queue predicted wait {high_pred} is unexpectedly less than low queue {low_pred}"
    )