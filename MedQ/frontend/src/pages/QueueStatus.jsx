import medqLogo from "../assets/images/medq-logo.png";

export default function QueueStatus() {
  // Temporary data
  const department = "Urgent Care";
  const urgency = "Moderate";
  const position = "3";
  const estWaitMinutes = 20;
  const checkinTime = "12:00 PM";
  const lastUpdated = "12:0 PM";

  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto">
      {/* Header */}
      <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 md:mb-6">
        <img
          src={medqLogo}
          alt="Med-Q logo"
          className="block h-32 object-contain drop-shadow-lg"
        />
        <h1 className="text-2xl md:text-[42px] tracking-wide text-white leading-tight">
          Queue Status
        </h1>
      </header>

      <main className="px-6 flex justify-center py-8 md:py-12">
        <section className="w-[360px] text-center space-y-6 text-[15px] font-medium">
          {/* Top Message */}
          <div className="space-y-2">
            <p className="leading-snug">
              Thank you. Your department will be
            </p>
            <p className="text-lg font-semibold">{department}</p>
            <p className="leading-snug">
              and your urgency level is 
            </p>
            <p className="text-lg font-semibold">{urgency}</p>
          </div>

          {/* Queue Info */}
          <div className="space-y-3">
            <p className="text-lg font-semibold">Your place in queue:</p>
            <p className="text-5xl font-bold tracking-tight">#{position}</p>

            <div className="mt-2 space-y-1">
              <p className="text-lg font-semibold">Estimated Wait Time:</p>
              <p className="text-2xl font-semibold">
                {estWaitMinutes} minutes
              </p>
              <p className="text-xs font-normal text-white/70">
                (Dynamic timer will update automatically)
              </p>
            </div>
          </div>

          <div className="text-xs font-normal text-white/80 space-y-1 leading-relaxed">
            <p>
              You completed your check-in at:{" "}
              <span className="font-semibold">{checkinTime}</span>
            </p>
            <p>
              Last updated:{" "}
              <span className="font-semibold">{lastUpdated}</span>
            </p>
            <p className="mt-2">
              Please stay up to date with any announcements from the hospital about your care.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}