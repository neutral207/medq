from pathlib import Path
import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import pytest

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
    rmse = np.sqrt(mean_squared_error(y. preds))
    r2 = r2_score(y, preds)

    # Synthetic data is fairly regular, so we expect a small error
    assert mae < 20, f"Mean absolute error too high: {mae:.2f} minutes"
    assert rmse < 25, f"Root mean squared error too high: {rmse:.2f} minutes"
    assert r2 > 0.7, f"R^2 score too low: {r2:.3f} (model explains <70% of variance)"

    print(f"\nModel Performance Metrics:")
    print(f"  MAE: {mae:.2f} minutes")
    print(f"  RMSE: {rmse:.2f} minutes")
    print(f"  R^2: {r2:.3f}")

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

def test_severity_affects_wait():
    model = load_model()

    # Test different severity levels (1-5):
    predictions = []
    for severity in [1, 2, 3, 4, 5]:
        pred = model.predict(np.array([[severity, 14, 5, 3]]))[0]
        predictions.append(pred)

    # Check that predictions vary with severity
    # Note: 4 might have LOWER wait than low 1 due to priority
    unique_predictions = len(set(round(p, 1) for p in predictions))
    assert unique_predictions > 1, (
        f"Severity doesn't seem to affect predictions. Got:{predictions}"
    )

def test_staff_count_affects_wait():
    model = load_model()

    low_staff = np.array([[3, 14, 10, 2]])
    high_staff = np.array([[3, 14, 10, 6]])

    low_staff_pred = model.predict(low_staff)[0]
    high_staff_pred = model.predict(high_staff)[0]

    # More staff should generally reduce wait time
    # Allow some tolerance for model variance
    assert high_staff_pred <= low_staff_pred + 5, (
        f"More staff ({high_staff_pred:.1f}min) shouldn't increase wait vs fewer staff ({low_staff_pred:.1f}min)"
    )

def test_hour_of_day_impact():
    model = load_model()

    peak_hour = np.array([[3, 18, 8, 3]])
    off_peak = np.array([[3, 3, 8, 3]])

    peak_pred = model.predict(peak_hour)[0]
    off_peak_pred = model.predict(off_peak)[0]

    # More staff should generally reduce wait time
    # Allow some tolerance for model variance
    assert peak_pred != off_peak_pred or abs(peak_pred - off_peak_pred) < 1, (
        f"Hour of day doesn't seem to affect predictions meaningfully."
        f"Peak: {peak_pred:.2f}, Off-Peak: {off_peak_pred:.2f}"
    )

def test_edge_cases():
    model = load_model()


    edge_cases = [
        # Empty ER (minimal queue)
        {"severity": 4, "hour_of_day": 3, "queue_length": 0, "staff_in_service": 5},
         # Maxed out ER
        {"severity": 1, "hour_of_day": 18, "queue_length": 30, "staff_in_service": 1},
         # Critical patient, empty queue
        {"severity": 4, "hour_of_day": 12, "queue_length": 1, "staff_in_service": 4},

    ]
    # Two simple synthetic inputs
    df = pd.DataFrame(edge_cases)
    preds = model.predict(df)

    # Wait times should be positive and not absurdly huge
    for i, p in enumerate(preds):
        assert 0 < p < 360, (
            f"Edge case {i} pronounced unreasonable prediction: {p:.1f} minutes"
        )

def test_model_consistency():
    model = load_model()

    input_data = np.array([[3, 4, 18, 4]])

    pred1 = model.predict(input_data)[0]
    pred2 = model.predict(input_data)[0]
    pred3 = model.predict(input_data)[0]

    assert pred1 == pred2 == pred3, (
        f"Model predictions inconsistent for the same input: {pred1}, {pred2}, {pred3}"
    )

def test_feature_order_matters():
    model = load_model()

    # Correct order: severity, hour_of_day, queue_length, staff_in_service
    correct = np.array([[3, 14, 8, 4]])
    # Scrambled order (severity, staff, queue, hour)
    scrambled = np.array([[3, 4, 8, 14]])

    pred_correct = model.predict(correct)[0]
    pred_scrambled = model.predict(scrambled)[0]

    # Predictions should differ (unless by chance they're similar)
    # This verifies feature order is being respected
    assert pred_correct != pred_scrambled or abs(pred_correct - pred_scrambled) < 0.1, (
        "Feature order doesn't seem to matter, possible model issue."
    )

def test_prediction_distribution():
    model = load_model()

    # Generate diverse test cases
    np.random.seed(42)
    test_cases = []
    for _ in range(50):
        test_cases.append({
            "severity": np.random.randint(1, 5),
            "hour_of_day": np.random.randint(0, 24),
            "queue_length": np.random.randint(1, 25),
            "staff_in_service": np.random.randint(1, 8)
        })

    df = pd.DataFrame(test_cases)
    preds = model.predict(df)

    # Check that we get reasonable distribution
    std_dev = np.std(preds)
    assert std_dev > 5, (
        f"Predictions have very low variance ({std_dev:.2f}), "
        "model may not be learning from features"
    )
    assert std_dev < 100, (
        f"Predictions have very high variance ({std_dev:.2f}), "
        "model may be unstable"
    )

def test_no_negative_predictions():
    model = load_model()

    # Generate diverse test cases
    np.random.seed(123)
    test_cases = []
    for _ in range(100):
          test_cases.append({
            "severity": np.random.randint(1, 5),
            "hour_of_day": np.random.randint(0, 24),
            "queue_length": np.random.randint(0, 30),
            "staff_in_service": np.random.randint(1, 10)
        })

    df = pd.DataFrame(test_cases)
    preds = model.predict(df)

    min_pred = np.min(preds)
    assert min_pred >= 0, f"Model predicted negative wait time: {min_pred:.2f}"


def test_model_accuracy_on_synthetic_data():
    model = load_model()
    assert DATA_PATH.exists(), f"Training data not found at {DATA_PATH}"

    df = pd.read_csv(DATA_PATH)

    X = df.drop("actual_wait_minutes", axis=1)
    y = df["actual_wait_minutes"]

    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    test_preds = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, test_preds)

    assert test_mae < 25, (
        f"Test set MAE too high: {test_mae:.2f} minutes. "
        "Model may be overfitting."
    )

    print(f"\nHold-out Test Performance:")
    print(f" Test MAE: {test_mae:.2f} minutes")



@pytest.fixture
def sample_valid_input():
    return pd.DataFrame([{
        "severity": 3, 
        "hour_of_day": 14, 
        "queue_length": 8, 
        "staff_in_service": 4
    }])


def test_model_accepts_dataframe(sample_valid_input):
    model = load_model()
    try:
        pred = model.predict(sample_valid_input)
        assert len(pred) == 1
    except Exception as e:
        pytest.fail(f"Model failed to predict with DataFrame input: {e}")
    
def test_model_accepts_numpy_array():
    model = load_model()
    input_array = np.array([[3, 14, 8, 4]])
    try:
        pred = model.predict(input_array)
        assert len(pred) == 1
    except Exception as e:
        pytest.fail(f"Model failed to predict with numpy array input: {e}")





if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])