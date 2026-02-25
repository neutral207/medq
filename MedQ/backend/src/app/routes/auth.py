import os
import jwt
import bcrypt
from dotenv import load_dotenv 
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Blueprint, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

auth_bp = Blueprint("auth", __name__)

JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret_key_change_in_production")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 8              # Length of shift

DATABASE_URL = os.getenv("DATABASE_URL")

if JWT_SECRET == "dev_secret_key_change_in_production":
    import warnings
    warnings.warn(
        "Using default JWT secret! Set JWT_SECRET environment variable in production.",
        UserWarning
    )


def get_conn():
    return psycopg2.connect(DATABASE_URL)

#UPDATED MIDDLEWARE
def token_required(f):

    #  Decorator for protecting routes, requires valid JWT token
    # route usage: @token_required

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header:
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Token Format Invalid'}), 401

        if not token:
            return jsonify({'error': 'Authentication token missing'}), 401

        try: 
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

            request.current_user = {
                'staff_id': payload['staff_id'],
                'username': payload['username'],
                'role': payload.get('role', 'staff')
            }

        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid Token'}), 401

        return f(*args, **kwargs)
    return decorated


def role_required(*allowed_roles):
    #Decorator that checks whether the user has the correct role
    #Route usage: @role_required('admin', 'doctor')

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'error': 'Authentication required'}), 401  

            user_role = request.current_user.get('role', '')

            if user_role not in allowed_roles:
                return jsonify({'error': 'Insuffucient permissions'}), 403    

            return f(*args, **kwargs)
        return decorated
    return decorator     





#ROUTES

@auth_bp.post("/login")
def login():
    """
    Staff login endpoint
    POST /api/auth/login
    Body: { "username": "doctor1", "password": "password123" }
    Returns: { "token": "eyJ...", "user": {...} }
    """

    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415
    
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password: 
        return jsonify({'error': 'Username and password required'}), 400
    

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    sa.staff_id as auth_id,
                    sa.username,
                    sa.password_hash,
                    sa.role,
                    sa.full_name,
                    sa.dept_id,
                    s.staff_id,
                    d.name as dept_name
                FROM staff_auth sa
                LEFT JOIN staff s ON s.name = sa.full_name
                LEFT JOIN departments d ON d.dept_id = sa.dept_id
                WHERE sa.username = %s AND sa.is_active = true;
                """,
                (username,)
            )
            staff = cur.fetchone()

    if not staff:
        return jsonify({'error': 'Invalid Credentials'}), 401
    
    password_hash = staff['password_hash']


    if isinstance(password_hash, str):
        password_hash = password_hash.encode('utf-8')

    is_valid = bcrypt.checkpw(password.encode('utf-8'), password_hash)
    if not is_valid:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    #JWT Token
    # staff['staff_id'] comes from LEFT JOIN to staff table (may be None if names don't match)
    # Fall back to staff_auth.staff_id (auth_id) when the join doesn't resolve
    resolved_staff_id = staff['staff_id'] or staff['auth_id']
    payload = {
        'staff_id': resolved_staff_id,
        'username': staff['username'],
        'role': staff['role'],
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
        'iat': datetime.now(timezone.utc)
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    #Return token and user info without password
    return jsonify({
        'token': token,
        'user': {
            'staff_id': resolved_staff_id,
            'username': staff['username'],
            'full_name': staff['full_name'],
            'role': staff['role'],
            'dept_id': staff['dept_id'],
            'department': staff['dept_name']
        }
    }), 200

@auth_bp.post("/register")
@token_required
@role_required('admin')
def register_staff():
    """
    Register new staff member (admin only)
    POST /api/auth/register
    Body: {
        "username": "nurse1",
        "password": "password123",
        "full_name": "Jane Doe",
        "role": "nurse",
        "dept_id": 1
    }
    """
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415
    
    data = request.get_json(silent=True) or {}

    username = data.get('username', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    role = data.get('role', 'staff')
    dept_id = data.get('dept_id')

    if not username or not password or not full_name: 
        return jsonify({'error': 'full_name, Username and password required'}), 400
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # insert into database
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO staff_auth (username, password_hash, full_name, role, dept_id, is_active)
                    VALUES (%s, %s, %s, %s, %s, true)
                    RETURNING staff_id, username, full_name, role, dept_id
                    """,
                    (username, password_hash.decode('utf-8'), full_name, role, dept_id)
                )
                new_staff = cur.fetchone()
                conn.commit()

        return jsonify({
        'message': 'Staff member registered successfully',
        'staff': {
            'staff_id': new_staff['staff_id'],
            'username': new_staff['username'],
            'full_name': new_staff['full_name'],
            'role': new_staff['role'],
            'dept_id': new_staff['dept_id']
        }
    }), 201

    except psycopg2.errors.UniqueViolation:
        return jsonify({'error': 'Username already exists'}), 409
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500



@auth_bp.get("/me")
@token_required
def get_current_user():
    """
    Get current authenticated user info
    GET /api/auth/me
    Headers: Authorization: Bearer <token>
    """
    staff_id = request.current_user['staff_id']

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT staff_id, username, full_name, role, dept_id
                FROM staff_auth
                WHERE staff_id = %s;
                """,
                (staff_id,)
            )
            staff = cur.fetchone()

    if not staff:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': dict(staff)}), 200


@auth_bp.post("/logout")
@token_required
def logout():
    """
    Logout (client should delete token)
    POST /api/auth/logout
    """
    # In a stateless JWT system, logout is handled client-side
    # The client should delete the token

    return jsonify({'message': 'Logged out successfully.'}), 200

@auth_bp.post("/change-password")
@token_required
def change_password():
    """
    Change user password
    POST /api/auth/change-password
    Body: { "old_password": "...", "new_password": "..." }
    """
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415
    
    data = request.get_json(silent=True) or {}

    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return jsonify({'error': 'Old and new passwords required'}), 400
    
    if len(new_password) < 8:
         return jsonify({'error': 'New password must be longer than 8 characters'}), 400
    
    staff_id = request.current_user['staff_id']

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT password_hash FROM staff_auth WHERE staff_id = %s;",
                (staff_id,)
            )
            staff = cur.fetchone()

    if not staff:
        return jsonify({'error': 'User not found'}), 404
    
    # verify old password
    password_hash = staff['password_hash']
    if isinstance(password_hash, str):
        password_hash = password_hash.encode('utf-8')

    is_valid = bcrypt.checkpw(old_password.encode('utf-8'), password_hash)
    if not is_valid:
        return jsonify({'error': 'Old password incorrect'}), 401 

    # Hash new password
    new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())

    # update in database
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE staff_auth SET password_hash = %s WHERE staff_id = %s;",
                (new_password_hash.decode('utf-8'), staff_id)
            )
            conn.commit()

    return jsonify({'message': 'Password changed successfully.'}), 200
