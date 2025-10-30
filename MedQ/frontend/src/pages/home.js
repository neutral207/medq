import { Dashboard } from '../components/dashboard/Dashboard.js';
import { Login } from '../components/login/Login.js';

const root = document.getElementById('root');

// Simple router-like toggle
const params = new URLSearchParams(location.search);
const page = params.get('page') || 'dashboard';

if (page === 'login') {
  root.appendChild(Login());
} else {
  root.appendChild(Dashboard());
}
