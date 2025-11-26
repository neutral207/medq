import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

# Load data
data_path = os.path.join(os.path.dirname(__file__), "..", "util", "synthetic_training_data.csv")
df = pd.read_csv(data_path)

# Inputs (features) and output (target)
X = df.drop("actual_wait_minutes", axis=1)
y = df["actual_wait_minutes"]

# Split training and test sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = RandomForestRegressor(
    n_estimators=300,
    max_depth=None,
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
preds = model.predict(X_test)

mae = mean_absolute_error(y_test, preds)
r2 = r2_score(y_test, preds)

print("Model training complete!")
print(f"Mean Absolute Error: {mae:.2f} minutes")
print(f"R² Score: {r2:.3f}")

# Save model
output_path = os.path.join(os.path.dirname(__file__), "wait_time_model.pkl")
joblib.dump(model, output_path)

print(f"Model saved to {output_path}")