document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const employee_number = document.getElementById("employee_number").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const response = await fetch("http://127.0.0.1:5000/api/login", {
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