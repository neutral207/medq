import TabSwitcher from "../components/TabSwitcher";

export default function StaffAnalytics() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <main className="w-full max-w-3xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-bold">Analytics</h1>
          <p className="text-slate-300 text-sm mt-1">View analytics and reports</p>
        </header>

        <TabSwitcher
          classname="mb-4"
          tabs={[
            { label: "Board", to: "/staff-dashboard" },
            { label: "Analytics", to: "/staff-analytics" },
          ]}
        />

        {/* Analytics content goes here */}
      </main>
    </div>
  );
}