import json
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(MedQ), '..')))
from src.config.main import create_app

def test_health():
    app = create_app()
    client = app.test_client()
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'ok'

def test_health():
    app = create_app()
    c = app.test_client()
    r = c.get("/health")
    assert r.status_code == 200

def client():
    app = create_app()
    return app.test_client()

def test_checkin_requires_json():
    c = client()
    r = c.post('/api/checkin', data="not json", headers={"Content-Type":"text/plain"})
    assert r.status_code in (400,415)

def test_checkin_happy_path():
    c = client()
    payload = {"department":"ER","severity":3,"source":"kiosk"}
    r = c.post('/api/checkin', data=json.dumps(payload), headers={"Content-Type":"application/json"})
    assert r.status_code == 201
    assert r.get_json()["data"]["department"] == "ER"

def test_checkin_invalid_severity():
    c = client()
    payload = {"department":"ER","severity":9}
    r = c.post('/api/checkin', data=json.dumps(payload), headers={"Content-Type":"application/json"})
    assert r.status_code == 422