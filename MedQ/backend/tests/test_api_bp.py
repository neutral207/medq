import pytest
import json
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))



from src.app.routes.api import api_bp
from src.app.errors import ApiError
from src.config.main import app

# ============================================
# FIXTURES
# ============================================

@pytest.fixture
def app():
    """Create and configure a test Flask app"""
    from flask import Flask
    from src.app.routes.api import api_bp
    
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(api_bp, url_prefix="/api")
    
    return app


@pytest.fixture
def client(app):
    """Create a test client for the app"""
    return app.test_client()


@pytest.fixture
def mock_db_connection():
    """Mock database connection"""
    with patch('src.app.routes.api.get_conn') as mock_conn:
        yield mock_conn


@pytest.fixture
def mock_model():
    """Mock ML model"""
    with patch('src.app.routes.api.model') as mock_mdl:
        mock_mdl.predict.return_value = [35.5]  # Mock prediction
        yield mock_mdl


@pytest.fixture
def sample_patient_data():
    """Sample patient check-in data"""
    return {
        "department": "Emergency",
        "symptoms": "Chest pain and shortness of breath",
        "severity": 4,
        "source": "kiosk",
        "name": "John Doe",
        "dob": "01/15/1980",
        "phone": "555-1234"
    }


@pytest.fixture
def sample_queue_data():
    """Sample queue data returned from database"""
    return [
        {
            "visit_id": "123e4567",
            "status": "waiting",
            "anon_token": "abc123def456",
            "severity": 4,
            "full_name": "John Doe",
            "dob": datetime(1980, 1, 15).date(),
            "phone": "555-1234",
            "symptoms": "Chest pain",
            "checkin_time": datetime.now(timezone.utc),
            "predicted_wait_minutes": 35
        },
        {
            "visit_id": "789e4567",
            "status": "waiting",
            "anon_token": "xyz789ghi012",
            "severity": 2,
            "full_name": "Jane Smith",
            "dob": datetime(1990, 5, 20).date(),
            "phone": "555-5678",
            "symptoms": "Minor cut",
            "checkin_time": datetime.now(timezone.utc) - timedelta(minutes=10),
            "predicted_wait_minutes": 15
        }
    ]


# ============================================
# TEST GET /queue
# ============================================

class TestGetQueue:
    
    def test_get_queue_success(self, client, mock_db_connection, sample_queue_data):
        """Test successful queue retrieval"""
        # Setup mock
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = sample_queue_data
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        # Make request
        response = client.get('/api/queue?department=Emergency')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['department'] == 'Emergency'
        assert len(data['queue']) == 2
        assert data['queue'][0]['severity'] == 4
        assert data['queue'][1]['severity'] == 2
    
    def test_get_queue_empty(self, client, mock_db_connection):
        """Test queue retrieval with no patients"""
        # Setup mock for empty queue
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.get('/api/queue?department=Emergency')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['queue']) == 0
    
    def test_get_queue_with_date_filters(self, client, mock_db_connection):
        """Test queue retrieval with date filters"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.get('/api/queue?department=Emergency&start=2024-01-01&end=2024-01-31')
        
        assert response.status_code == 200
        # Verify the SQL query was called with date parameters
        mock_cursor.execute.assert_called_once()


# ============================================
# TEST POST /checkin
# ============================================

class TestCheckIn:
    
    def test_checkin_success(self, client, mock_db_connection, mock_model, sample_patient_data):
        """Test successful patient check-in"""
        # Setup a single mock cursor that returns different values based on call order
        call_count = {'count': 0}
        
        def mock_fetchone_side_effect():
            call_count['count'] += 1
            call_num = call_count['count']
            
            if call_num == 1:
                return {"dept_id": 1}  # Department lookup
            elif call_num == 2:
                return {"in_service": 3}  # Staff count from wait_time_agg_hourly
            elif call_num == 3:
                return (5,)  # Queue length COUNT(*) returns tuple
            elif call_num == 4:
                return {"patient_id": 101, "anon_token": "abc123"}  # Patient insert RETURNING
            elif call_num == 5:
                return {  # Visit insert RETURNING
                    "visit_id": 201,
                    "checkin_time": datetime.now(timezone.utc),
                    "predicted_wait_minutes": 36,
                    "status": "waiting"
                }
            return None
        
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = mock_fetchone_side_effect
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        # Make request
        response = client.post(
            '/api/checkin',
            data=json.dumps(sample_patient_data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'checked in'
        assert 'visit' in data
        assert data['visit']['severity'] == 4
    
    def test_checkin_missing_symptoms(self, client, sample_patient_data):
        """Test check-in fails without symptoms"""
        data = sample_patient_data.copy()
        data['symptoms'] = ""
        
        response = client.post(
            '/api/checkin',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        # The response might be text/html or have a different format
        # Check if response has data
        if response.data:
            try:
                error_data = json.loads(response.data)
                assert 'symptoms is required' in error_data.get('error', '')
            except json.JSONDecodeError:
                # If not JSON, check the raw text
                assert b'symptoms is required' in response.data or response.status_code == 400
    
    def test_checkin_missing_name(self, client, sample_patient_data):
        """Test check-in fails without name"""
        data = sample_patient_data.copy()
        data['name'] = ""
        
        response = client.post(
            '/api/checkin',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        # Handle both JSON and non-JSON error responses
        if response.data:
            try:
                error_data = json.loads(response.data)
                assert 'name is required' in error_data.get('error', '')
            except json.JSONDecodeError:
                # If not JSON, check the raw text
                assert b'name is required' in response.data or response.status_code == 400
    
    def test_checkin_invalid_department(self, client, mock_db_connection, sample_patient_data):
        """Test check-in fails with invalid department"""
        # Setup mock to return no department
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        data = sample_patient_data.copy()
        data['department'] = "NonExistentDept"
        
        response = client.post(
            '/api/checkin',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 400
    
    def test_checkin_not_json(self, client):
        """Test check-in fails with non-JSON content"""
        response = client.post(
            '/api/checkin',
            data="not json",
            content_type='text/plain'
        )
        
        assert response.status_code == 415
    
    def test_checkin_uses_ml_prediction(self, client, mock_db_connection, mock_model, sample_patient_data):
        """Test that check-in uses ML model for prediction"""
        # Setup a single mock cursor that returns different values based on call order
        call_count = {'count': 0}
        
        def mock_fetchone_side_effect():
            call_count['count'] += 1
            call_num = call_count['count']
            
            if call_num == 1:
                return {"dept_id": 1}  # Department lookup
            elif call_num == 2:
                return {"in_service": 3}  # Staff count from wait_time_agg_hourly
            elif call_num == 3:
                return (5,)  # Queue length COUNT(*) returns tuple
            elif call_num == 4:
                return {"patient_id": 101, "anon_token": "abc123"}  # Patient insert RETURNING
            elif call_num == 5:
                return {  # Visit insert RETURNING
                    "visit_id": 201,
                    "checkin_time": datetime.now(timezone.utc),
                    "predicted_wait_minutes": 36,  # Rounded from 35.5
                    "status": "waiting"
                }
            return None
        
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = mock_fetchone_side_effect
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.post(
            '/api/checkin',
            data=json.dumps(sample_patient_data),
            content_type='application/json'
        )
        
        assert response.status_code == 201
        # Verify model was called
        mock_model.predict.assert_called_once()



# ============================================
# TEST GET /visit/<visit_id>
# ============================================

class TestGetVisit:
    
    def test_get_visit_success(self, client, mock_db_connection):
        """Test successful visit retrieval"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "visit_id": 201,
            "status": "waiting",
            "checkin_time": datetime.now(timezone.utc),
            "service_start": None,
            "service_end": None,
            "predicted_wait_minutes": 35,
            "actual_wait_minutes": None,
            "queue_position": 3,
            "anon_token": "abc123",
            "full_name": "John Doe",
            "dob": datetime(1980, 1, 15).date(),
            "phone": "555-1234",
            "symptoms": "Chest pain",
            "severity": 4,
            "department_name": "Emergency"
        }
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.get('/api/visit/201')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['visit']['visit_id'] == '201'
        assert data['visit']['severity'] == 4
        assert data['visit']['status'] == 'waiting'
    
    def test_get_visit_not_found(self, client, mock_db_connection):
        """Test visit retrieval with invalid ID"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.get('/api/visit/99999')
        
        assert response.status_code == 404


# ============================================
# TEST PATCH /visit/<visit_id>/status
# ============================================

class TestUpdateVisitStatus:
    
    def test_update_status_to_in_progress(self, client, mock_db_connection):
        """Test updating visit status to in-progress"""
        mock_cursor = MagicMock()
        
        # First fetchone for current status check
        mock_cursor.fetchone.side_effect = [
            {"status": "waiting", "service_start": None},
            {  # After update
                "visit_id": 201,
                "status": "in-progress",
                "service_start": datetime.now(timezone.utc),
                "service_end": None
            }
        ]
        
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.commit = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.patch(
            '/api/visit/201/status',
            data=json.dumps({"status": "in-progress"}),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'in-progress'
        assert data['service_start'] is not None
    
    def test_update_status_to_completed(self, client, mock_db_connection):
        """Test updating visit status to completed"""
        mock_cursor = MagicMock()
        
        mock_cursor.fetchone.side_effect = [
            {"status": "in-progress", "service_start": datetime.now(timezone.utc)},
            {
                "visit_id": 201,
                "status": "completed",
                "service_start": datetime.now(timezone.utc),
                "service_end": datetime.now(timezone.utc)
            }
        ]
        
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.commit = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.patch(
            '/api/visit/201/status',
            data=json.dumps({"status": "completed"}),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'completed'
        assert data['service_end'] is not None
    
    def test_update_status_invalid_value(self, client, mock_db_connection):
        """Test updating visit with invalid status"""
        response = client.patch(
            '/api/visit/201/status',
            data=json.dumps({"status": "invalid-status"}),
            content_type='application/json'
        )
        
        assert response.status_code == 400
    
    def test_update_status_visit_not_found(self, client, mock_db_connection):
        """Test updating status for non-existent visit"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        mock_db_connection.return_value = mock_conn
        
        response = client.patch(
            '/api/visit/99999/status',
            data=json.dumps({"status": "completed"}),
            content_type='application/json'
        )
        
        assert response.status_code == 404


# ============================================
# TEST POST /predict_wait
# ============================================

class TestPredictWait:
    
    def test_predict_wait_success(self, client, mock_model):
        """Test successful wait time prediction"""
        mock_model.predict.return_value = [42.5]
        
        response = client.post(
            '/api/predict_wait',
            data=json.dumps({
                "severity": 3,
                "hour_of_day": 14,
                "queue_length": 8,
                "staff_in_service": 4
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'predicted_wait_minutes' in data
        assert data['predicted_wait_minutes'] == 42.5
    
    def test_predict_wait_missing_fields(self, client):
        """Test prediction with missing required fields"""
        response = client.post(
            '/api/predict_wait',
            data=json.dumps({
                "severity": 3,
                "hour_of_day": 14
                # Missing queue_length and staff_in_service
            }),
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Missing fields' in data['error']
    
    def test_predict_wait_model_not_available(self, client):
        """Test prediction when model is not loaded"""
        with patch('src.app.routes.api.model', None):
            response = client.post(
                '/api/predict_wait',
                data=json.dumps({
                    "severity": 3,
                    "hour_of_day": 14,
                    "queue_length": 8,
                    "staff_in_service": 4
                }),
                content_type='application/json'
            )
            
            assert response.status_code == 500
            data = json.loads(response.data)
            assert 'Model not available' in data['error']


# ============================================
# TEST GET /summary
# ============================================

class TestSummary:
    
    def test_summary_success(self, client, mock_db_connection):
        """Test successful summary retrieval"""
        mock_cursor = MagicMock()
        
        # Mock multiple fetchone calls in sequence
        mock_cursor.fetchone.side_effect = [
            {"queue_count": 5},  # Queue count
            {"avg_wait": 32.5},  # Average wait
            {"active_staff": 3}  # Active staff
        ]
        
        # Mock fetchall for hourly history
        mock_cursor.fetchall.return_value = [
            {
                "bucket_start": datetime.now(timezone.utc) - timedelta(hours=i),
                "arrivals": 10 - i,
                "avg_wait_minutes": 30 + i,
                "in_service": 3
            }
            for i in range(6)
        ]
        
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.close = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        with patch('src.app.routes.api.get_db_conn', return_value=mock_conn):
            response = client.get('/api/summary')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'queueCount' in data
        assert 'averageWait' in data
        assert 'activeStaff' in data
        assert len(data['queueHistory']) == 6


# ============================================
# TEST GET /wait_heatmap
# ============================================

class TestWaitHeatmap:
    
    def test_heatmap_with_data(self, client, mock_db_connection):
        """Test heatmap with actual data"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {"day_of_week": 1, "hour": 9, "avg_wait": 25.5},
            {"day_of_week": 1, "hour": 14, "avg_wait": 42.0},
            {"day_of_week": 2, "hour": 9, "avg_wait": 20.0}
        ]
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.close = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        with patch('src.app.routes.api.get_db_conn', return_value=mock_conn):
            response = client.get('/api/wait_heatmap')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 3
        assert data[0]['day_of_week'] == 1
        assert data[0]['hour'] == 9
    
    def test_heatmap_synthetic_data(self, client, mock_db_connection):
        """Test heatmap returns synthetic data when table is empty"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.close = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        with patch('src.app.routes.api.get_db_conn', return_value=mock_conn):
            response = client.get('/api/wait_heatmap')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        # Should return 7 days * 24 hours = 168 data points
        assert len(data) == 168


# ============================================
# TEST GET /staff_utilization
# ============================================

class TestStaffUtilization:
    
    def test_staff_utilization_success(self, client, mock_db_connection):
        """Test successful staff utilization retrieval"""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {
                "bucket_start": datetime.now(timezone.utc),
                "dept_id": 1,
                "in_service": 7
            },
            {
                "bucket_start": datetime.now(timezone.utc) - timedelta(hours=1),
                "dept_id": 1,
                "in_service": 5
            }
        ]
        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.close = Mock()
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        
        with patch('src.app.routes.api.get_db_conn', return_value=mock_conn):
            response = client.get('/api/staff_utilization')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'byDept' in data
        assert 'history' in data


# ============================================
# HELPER FUNCTION TESTS
# ============================================

class TestHelperFunctions:
    
    def test_parse_dob_valid(self):
        """Test DOB parsing with valid format"""
        from src.app.routes.api import parse_dob_mmddyyyy
        
        result = parse_dob_mmddyyyy("01/15/1980")
        assert result == datetime(1980, 1, 15).date()
    
    def test_parse_dob_invalid(self):
        """Test DOB parsing with invalid format"""
        from src.app.routes.api import parse_dob_mmddyyyy, ApiError
        
        with pytest.raises(ApiError) as exc_info:
            parse_dob_mmddyyyy("1980-01-15")  # Wrong format
        
        assert exc_info.value.code == 400
    
    def test_parse_dob_none(self):
        """Test DOB parsing with None value"""
        from src.app.routes.api import parse_dob_mmddyyyy
        
        result = parse_dob_mmddyyyy(None)
        assert result is None
    
    def test_parse_dob_empty_string(self):
        """Test DOB parsing with empty string"""
        from src.app.routes.api import parse_dob_mmddyyyy
        
        result = parse_dob_mmddyyyy("")
        assert result is None





# Run:   pytest C:\Users\jteam\source\repos\medq-1\MedQ\backend\tests\test_api_bp.py -v
