import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor,  GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from datetime import datetime
import joblib
import os


class WaitTimePrediction:
    def __init__(self, data_path='synthetic_training_data.csv'):
        self.csv_path = data_path
        self.model = RandomForestRegressor(n_estimators=100, max_depth=None, random_state=42)
        self.is_trained = False
        self.feature_names = [
            'severity',
            'hour_of_day',
            'queue_length',
            'staff_in_service',
            'queue_position'
        ]
        self.training_metrics = {}

    def load_and_prep_data(self):
        try:
            df = pd.read_csv(self.csv_path)
            print(f"Loaded {len(df)} training samples from CSV file")

            if 'queue_position' not in df.columns:
                df['queue_position'] = 0

            X = df[self.feature_names].values
            y = df['actual_wait_minutes'].values

            return X, y, df
        except FileNotFoundError:
            print(f"Training data file not found: {self.csv_path}")
            return None, None, None
        except Exception as e:
            print(f"Error loading training data: {e}")
            return None, None, None
        
    def train_from_csv(self):
        X, y, df = self.load_and_prep_data()
        
        if X is None or y is None:
            print(f"Cannot train: No Data available")
            return False
        
        X_train, X_test, y_train, y_test = train_test_split(
             X, y, test_size=0.2, random_state=42
        )

        print(f"Now training model...")
        self.model.fit(X_train, y_train)

        train_predictions = self.model.predict(X_train)
        test_predictions = self.model.predict(X_test)

        train_mae = mean_absolute_error(y_train, train_predictions)
        test_mae = mean_absolute_error(y_test, test_predictions)
        train_r2 = r2_score(y_train, train_predictions)
        test_r2 = r2_score(y_test, test_predictions)

        self.training_metrics = {
            'train_mae': round(train_mae, 2),
            'test_mae': round(test_mae, 2),
            'train_r2': round(train_r2, 3),
            'test_r2': round(test_r2, 3),
            'training_samples': len(X_train),
            'testing_samples': len(X_test)
        }

        print(f"Training complete.")
        print(f"    Train MAE: {train_mae:.2f} minutes")
        print(f"    Test MAE: {test_mae:.2f} minutes")
        print(f"    Test R^2: {test_r2:.3f}")

        self.is_trained = True
        return True
    
    def extract_features(self, patient, queue_state, staff_count=5):
        
        patient_position = next((i for i, p in enumerate(queue_state)
                                 if p['id'] == patient['id']), 0)
        if 'arrival_time' in patient:
            hour = datetime.fromisoformat(patient['arrival_time']).hour
        else:
            hour = datetime.now().hour
        features = [
            patient['severity'],
            hour,
            len(queue_state),
            staff_count,
            patient_position
        ]

        return np.array(features).reshape(1,-1)
    def predict_wait_time(self, patient, queue_state, staff_count=5):

        if not self.is_trained:
            print(f"Model not yet trained. Using fallback...")
            return self._rule_based_prediction(patient, queue_state)
        
        features = self.extract_features(patient, queue_state, staff_count)
        predicted_minutes = self.model.predict(features)[0]

        predicted_minutes = max(0, min(predicted_minutes, 480))

        return int(predicted_minutes)
        
    def _rule_based_prediction(self, patient, queue_state):

        base_wait_times = {
            '5': 5,
            '4': 10,
            '3': 20,
            '2': 30,
            '1': 45
        }

        patient_position = next((i for i, p in enumerate(queue_state)
                                 if p['id'] == patient['id']), 0)
        
        cumulative = 0
        for i in range(patient_position):
            cumulative += base_wait_times[queue_state[i]['severity']]

        return cumulative

    def get_feature_importance(self):
        
        if not self.is_trained:
            return None
        importance = self.model.feature_importances_
        feature_importance = dict(zip(self.feature_names, importance))

        sorted_features = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )

        return sorted_features

    def save_model(self, filepath='wait_time_model.pkl'):
        if self.is_trained:
            joblib.dump({
                'model': self.model,
                'feature_names': self.feature_names,
                'training_metrics': self.training_metrics
            }, filepath)
            print(f"Model saved to {filepath}")
            return True
        return False

    def load_model(self, filepath='wait_time_model.pkl'):
        try:
            data = joblib.load(filepath)
            self.model = data['model']
            self.feature_names = data['feature_names']
            self.training_metrics = data['training_metrics']
            self.is_trained = True
            print(f"Model loaded from {filepath}")
            return True
        except Exception as e:
            print(f"Model could not be loaded from {filepath}: {e}")
            return False
        
    def update_with_new_data(self, new_X, new_Y):
        if not self.is_trained:
            print(f"Model must be trained first.")
            return False
        
        self.model.fit(new_X, new_Y)
        print(f"Model updated with {len(new_X)} new samples")
        return True
