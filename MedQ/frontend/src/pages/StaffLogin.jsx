import medqLogo from "../assets/images/medq-logo.png";

export default function StaffLogin() {
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
      <main className='px-6 flex justify-center py-8 md:py-12'>
        <form className="w-[360px] space-y-4 text-[15px] font-medium">
          {/* Staff Name */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Staff Name
              <input
                type="text"
                placeholder="Last, First"
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
                required
              />
            </label>
          </div>

          {/* Staff ID */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Staff ID
              <input
                type="text"
                placeholder="Enter ID"
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
                required
              />
            </label>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Role Assignment
              <input
                type="text"
                placeholder="Ex: Triage Nurse"
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
                required
              />
            </label>
          </div>

          {/* Person In Charge */}
          <div className="space-y-1">
            <label className="text-sm text-gray-200">Person in Charge Today
              <input
                type="text"
                placeholder="Name"
                className="w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none"
              />
            </label>
          </div>

          {/* Button */}
          <button 
            type="submit" 
            className="w-full mt-4 bg-medqPink hover:bg-pink-400 py-2 rounded-md font-semibold transition-colors"
          >
            Confirm
          </button>
        </form>
      </main>
    </div>
  )
}