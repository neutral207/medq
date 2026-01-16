/**
 * Authenticated API request utility
 * Automatically includes JWT token in requests and handles auth errors
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., "/api/queue")
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<object>} - Response data
 */
export async function authFetch(endpoint, options = {}) {
  const token = localStorage.getItem("medq_token");

  if (!token) {
    throw new Error("No authentication token found");
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    // Clear stored auth data
    localStorage.removeItem("medq_token");
    localStorage.removeItem("medq_user");

    // Redirect to login
    window.location.href = "/staff-login";
    throw new Error("Session expired. Please log in again.");
  }

  // Handle 403 Forbidden - insufficient permissions
  if (response.status === 403) {
    throw new Error("You don't have permission to access this resource");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/**
 * Get current user info from localStorage
 * @returns {object|null} - User object or null if not logged in
 */
export function getCurrentUser() {
  const userStr = localStorage.getItem("medq_user");
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!localStorage.getItem("medq_token");
}

/**
 * Log out the current user
 */
export async function logout() {
  const token = localStorage.getItem("medq_token");

  if (token) {
    try {
      // Call logout endpoint
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error("Logout API call failed:", err);
    }
  }

  // Clear local storage
  localStorage.removeItem("medq_token");
  localStorage.removeItem("medq_user");

  // Redirect to login
  window.location.href = "/staff-login";
}

/**
 * Check if user has a specific role
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function hasRole(role) {
  const user = getCurrentUser();
  return user && user.role === role;
}

/**
 * Check if user has any of the specified roles
 * @param {...string} roles - Roles to check
 * @returns {boolean}
 */
export function hasAnyRole(...roles) {
  const user = getCurrentUser();
  return user && roles.includes(user.role);
}
