import { useNavigate } from "react-router-dom";
import { useState } from "react";
import medqLogo from "../assets/images/medq-logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Call JWT login endpoint
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error response
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      // Success! Store token and user info in localStorage
      localStorage.setItem("medq_token", data.token);
      localStorage.setItem("medq_user", JSON.stringify(data.user));

      // Navigate to staff dashboard
      navigate("/staff-dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto">
      {/* Header */}
      <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 sm:mb-6">
        <img
          src={medqLogo}
          alt="Med-Q logo"
          className="block h-32 object-contain drop-shadow-lg"
        />
        <h1 className="text-2xl md:text-[42px] tracking-wide text-white leading-tight">Staff Login</h1>
      </header>

      {/* Form */}
      <div className='px-6 flex justify-center py-8 md:py-12'>
        <form className="w-[360px] space-y-4 text-[15px] font-medium" onSubmit={handleSubmit}>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </label>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </label>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {/* Button */}
          <button
            type="submit"
            className="w-full mt-4 bg-medqPink hover:bg-pink-400 py-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Confirm"}
          </button>
        </form>
      </div>
    </div>
  )
}