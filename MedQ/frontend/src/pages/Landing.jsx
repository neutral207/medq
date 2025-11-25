import { Link, useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--grad-top)] to-[var(--grad-bottom)] text-[var(--text)] flex flex-col">
      {/* content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2">
          <img
            src={medqLogo}
            alt="Med-Q logo"
            className="h-32 object-contain drop-shadow"
          />
          <h1 className="text-2xl tracking-wide leading-tight">
            Med-Q
          </h1>
        </div>

        <button
          onClick={() => navigate("/patient-checkin")}
          className="mt-6 rounded-full px-8 py-3 text-base sm:text-lg font-semibold
                     bg-[var(--primary)] hover:bg-[var(--primary-alt)] transition-colors focus:outline-none"
        >
          Patient Check-in
        </button>
      </div>

      <footer className="px-6 py-4 text-center text-sm text-white/80">
        Admins and Staff may login{" "}
        <Link
          to="/staff-login"
          className="font-semibold text-[var(--primary)] hover:text-[var(--primary-alt)] underline underline-offset-2"
        >
          here
        </Link>.
      </footer>
    </div>
  );
}