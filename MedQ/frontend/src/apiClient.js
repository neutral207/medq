const API_BASE = 
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

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
      `API error: ${res.status}`;

    throw new Error(message);
  }

  return res.json();
}