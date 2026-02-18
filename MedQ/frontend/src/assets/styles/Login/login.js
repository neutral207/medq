document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const employee_number = document.getElementById("employee_number").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_number, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);

        message.textContent = data.message;
        message.style.color = "green";

        // this redirect based on role of staff 
        if (data.role === "admin") {
          window.location.href = "admin_dashboard.html";
        } else if (data.role === "staff") {
          window.location.href = "staff_dashboard.html";
        }
      } else {
        message.textContent = data.message;
        message.style.color = "red";
      }
    } catch (error) {
      console.error("Error:", error);
      message.textContent = "Server connection error.";
      message.style.color = "red";
    }
  });
});