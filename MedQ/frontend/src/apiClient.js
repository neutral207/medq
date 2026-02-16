const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export async function apiRequest(path, options = {}) {
  // Get JWT token from localStorage
  const token = localStorage.getItem("medq_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (res.status === 401) {
    // Clear stored auth data
    localStorage.removeItem("medq_token");
    localStorage.removeItem("medq_user");

    // Redirect to login
    window.location.href = "/staff-login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let text;
    try {
      text = await res.text();
    } catch {
      text = "";
    }

    let errorBody = null;
    try {
      errorBody = text ? JSON.parse(text) : null;
    } catch {
      // not JSON, ignore
    }

    console.error("API error response:", errorBody || text);

    const message =
      errorBody?.error?.message || // <-- your backend's format
      errorBody?.message ||
      errorBody?.error || // <-- backend returns {error: "message"}
      `API error: ${res.status}`;

    throw new Error(message);
  }

  return res.json();
}