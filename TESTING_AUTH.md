# JWT Authentication Testing Guide

## 📋 Test User Credentials

All test users have the same password: **`password123`**

| Username | Role | Department | Access Level |
|----------|------|------------|--------------|
| `admin` | admin | Emergency | 🔴 Full system access |
| `jordan` | doctor | Emergency | 🟠 Clinical + Analytics |
| `sam` | physician | Pediatrics | 🟠 Clinical + Analytics |
| `avery` | nurse | Emergency | 🟡 Clinical operations |
| `priya` | nurse | Pediatrics | 🟡 Clinical operations |
| `miguel` | doctor | Cardiology | 🟠 Clinical + Analytics |
| `taylor` | doctor | Radiology | 🟠 Clinical + Analytics |

---

## 🔄 Database Reset Instructions

### Step 1: Drop and Recreate Database
```bash
# Navigate to backend directory
cd MedQ/backend

# Drop existing database and recreate
psql -U postgres -c "DROP DATABASE IF EXISTS medq;"
psql -U postgres -c "CREATE DATABASE medq;"

# Run schema and seed
psql -U postgres -d medq -f src/database/schema.sql
psql -U postgres -d medq -f src/database/seed.sql
```

### Step 2: Verify Test Users Were Created
```bash
psql -U postgres -d medq -c "SELECT username, full_name, role, dept_id FROM staff_auth;"
```

**Expected Output:**
```
 username |  full_name   |   role    | dept_id
----------+--------------+-----------+---------
 admin    | Admin User   | admin     |       1
 jordan   | Jordan Lee   | doctor    |       1
 sam      | Sam Patel    | physician |       3
 avery    | Avery Chen   | nurse     |       1
 priya    | Priya Desai  | nurse     |       3
 miguel   | Miguel Santos| doctor    |       4
 taylor   | Taylor Brooks| doctor    |       2
```

---

## 🧪 Backend API Testing (Using curl)

### Test 1: Login and Get Token

```bash
# Test Admin Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "staff_id": 1,
    "username": "admin",
    "full_name": "Admin User",
    "role": "admin",
    "dept_id": 1
  }
}
```

**Save the token for subsequent requests:**
```bash
# On Windows PowerShell
$TOKEN = "paste_token_here"

# On Mac/Linux
export TOKEN="paste_token_here"
```

---

### Test 2: Access Protected Endpoints

#### ✅ Test Public Endpoint (No Auth Required)
```bash
# Patient check-in (public)
curl -X POST http://localhost:5000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Patient",
    "symptoms": "Fever",
    "severity": 3,
    "department": "Emergency",
    "dob": "1990-01-01",
    "phone": "555-0123"
  }'
```
**Expected:** ✅ Success (201 Created)

---

#### ✅ Test Authenticated Endpoint (Any Staff)
```bash
# View queue (requires any authenticated staff)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/queue
```
**Expected:** ✅ Success (200 OK) - Returns queue data

---

#### ✅ Test Role-Restricted Endpoint (Clinical Staff Only)
```bash
# Update visit status (requires nurse, doctor, physician, or admin)
curl -X PATCH http://localhost:5000/api/visit/<visit_id>/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```
**Expected:**
- ✅ Success for admin, jordan, sam, avery, priya, miguel, taylor
- ❌ 403 Forbidden for "staff" role (if you create one)

---

#### ✅ Test Admin-Only Endpoint
```bash
# View all staff (admin only)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/staff
```
**Expected:**
- ✅ Success for `admin`
- ❌ 403 Forbidden for all other users

---

### Test 3: Invalid Token Tests

#### ❌ No Token
```bash
curl http://localhost:5000/api/queue
```
**Expected:** ❌ 401 Unauthorized - `{"error": "Authentication token missing"}`

---

#### ❌ Invalid Token
```bash
curl -H "Authorization: Bearer invalid_token_here" \
  http://localhost:5000/api/queue
```
**Expected:** ❌ 401 Unauthorized - `{"error": "Invalid Token"}`

---

#### ❌ Expired Token
*Token expires after 8 hours. Wait 8+ hours or manually test by temporarily changing `TOKEN_EXPIRY_HOURS` in auth.py to 0.001*

**Expected:** ❌ 401 Unauthorized - `{"error": "Token has expired"}`

---

## 🌐 Frontend Testing

### Step 1: Start the Application

```bash
# Terminal 1 - Backend
cd MedQ/backend
python src/main.py

# Terminal 2 - Frontend
cd MedQ/frontend
npm run dev
```

---

### Test 4: Login Flow Tests

#### ✅ Test Successful Login (Admin)
1. Navigate to: `http://localhost:5173/staff-login`
2. Enter:
   - **Username:** `admin`
   - **Password:** `password123`
3. Click "Confirm"

**Expected:**
- ✅ Redirects to `/staff-dashboard`
- ✅ `localStorage` contains `medq_token` and `medq_user`
- ✅ Dashboard loads successfully

**Verify in Browser Console:**
```javascript
localStorage.getItem('medq_token')  // Should return JWT token
JSON.parse(localStorage.getItem('medq_user'))  // Should return user object
```

---

#### ❌ Test Failed Login (Wrong Password)
1. Navigate to: `http://localhost:5173/staff-login`
2. Enter:
   - **Username:** `admin`
   - **Password:** `wrongpassword`
3. Click "Confirm"

**Expected:**
- ❌ Error message: "Invalid credentials"
- ❌ Stays on login page
- ❌ No token stored

---

#### ❌ Test Failed Login (Wrong Username)
1. Navigate to: `http://localhost:5173/staff-login`
2. Enter:
   - **Username:** `nonexistent`
   - **Password:** `password123`
3. Click "Confirm"

**Expected:**
- ❌ Error message: "Invalid Credentials"
- ❌ Stays on login page

---

### Test 5: Role-Based Access Tests

#### Test 5a: Admin User Access
1. Login as `admin` / `password123`
2. Navigate to all dashboard pages

**Expected Access:**
- ✅ Queue Status
- ✅ Staff Management
- ✅ Analytics/Dashboard
- ✅ All endpoints work

---

#### Test 5b: Doctor User Access
1. Login as `jordan` / `password123`
2. Try to access various features

**Expected Access:**
- ✅ View queue
- ✅ Update visit status
- ✅ Assign staff to visits
- ✅ View analytics
- ❌ Cannot access "All Staff" management (admin only)

**To test, open browser console and try:**
```javascript
// This should fail with 403
fetch('http://localhost:5000/api/staff', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('medq_token')}`
  }
})
.then(r => r.json())
.then(console.log)
```

---

#### Test 5c: Nurse User Access
1. Login as `avery` / `password123`
2. Try to access various features

**Expected Access:**
- ✅ View queue
- ✅ Update visit status
- ✅ Assign staff
- ✅ Clock in/out
- ❌ Cannot view analytics endpoints

**To test analytics restriction:**
```javascript
// This should fail with 403
fetch('http://localhost:5000/api/summary', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('medq_token')}`
  }
})
.then(r => r.json())
.then(console.log)
```

---

### Test 6: Token Expiration

#### Manual Token Expiration Test
1. Login as any user
2. Open browser console
3. Manually expire the token:
```javascript
// Set token to an expired one (or delete it)
localStorage.removeItem('medq_token');
```
4. Try to access a protected page or make an API call

**Expected:**
- ❌ Automatic redirect to `/staff-login`
- ❌ Error message about session expiration

---

### Test 7: Logout Test

**Option 1: Using authApi utility**
```javascript
// In browser console
import { logout } from '/src/utils/authApi.js';
logout();
```

**Option 2: Manual logout**
```javascript
// Clear localStorage and redirect
localStorage.removeItem('medq_token');
localStorage.removeItem('medq_user');
window.location.href = '/staff-login';
```

**Expected:**
- ✅ Token removed from localStorage
- ✅ User redirected to login page
- ✅ Cannot access protected pages

---

## 📊 Complete Test Matrix

| User | Password | View Queue | Update Status | Assign Staff | Analytics | All Staff | Register Users |
|------|----------|------------|---------------|--------------|-----------|-----------|----------------|
| admin | password123 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| jordan (doctor) | password123 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| sam (physician) | password123 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| avery (nurse) | password123 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| priya (nurse) | password123 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| miguel (doctor) | password123 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| taylor (doctor) | password123 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 🐛 Troubleshooting

### Issue: "Authentication token missing"
**Solution:** Make sure you're including the `Authorization: Bearer <token>` header

### Issue: "Invalid Token"
**Solution:**
1. Check if token is correct
2. Verify `JWT_SECRET` in .env matches between requests
3. Token might be malformed

### Issue: "Token has expired"
**Solution:** Log in again to get a fresh token (tokens expire after 8 hours)

### Issue: 403 Forbidden
**Solution:** User doesn't have the required role for this endpoint. Check the access control matrix above.

### Issue: Frontend shows "Unable to connect to server"
**Solution:**
1. Make sure backend is running on port 5000
2. Check CORS settings
3. Verify `VITE_API_URL` environment variable

---

## ✅ Quick Validation Checklist

- [ ] Database schema includes `staff_auth` table
- [ ] Test users created in seed.sql
- [ ] All test users can log in
- [ ] JWT tokens are generated correctly
- [ ] Protected endpoints require authentication
- [ ] Role restrictions work correctly
- [ ] Token expiration works
- [ ] Frontend login page works
- [ ] Frontend stores token in localStorage
- [ ] API requests include Authorization header
- [ ] Logout clears token and redirects

---

## 📝 Notes

- **Password:** All test users use `password123` (bcrypt hash: `$2b$12$URwNoUyUIZigkv/VkJXflOJAPXWV/KcEb5CBHRsoZOJvxPW.e1BoO`)
- **Token Lifetime:** 8 hours (configurable in `auth.py`)
- **Security:** In production, use a strong `JWT_SECRET` in `.env` file
- **CORS:** Configured to accept all origins (`*`) - restrict in production

---

## 🎯 Next Steps

1. ✅ Reset database using instructions above
2. ✅ Test backend endpoints with curl
3. ✅ Test frontend login flow
4. ✅ Test role-based access control
5. ✅ Integrate JWT into existing API calls (add `authFetch` utility)
6. ⚠️ Add logout button to dashboard
7. ⚠️ Add role display in UI
8. ⚠️ Handle token expiration gracefully in all pages
