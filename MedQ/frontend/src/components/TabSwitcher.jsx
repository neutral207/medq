import { useLocation, useNavigate } from "react-router-dom";

export default function TabSwitcher({ tabs , classname = ""}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (to) => {
    if (location.pathname === to) {
      window.location.reload();
    } else {
      navigate(to);
    }
  };

  return (
    <div className={`flex gap-3 mb-4 ${classname}`}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.to;

        return (
          <button
            key={tab.to}
            onClick={() => handleClick(tab.to)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold shadow-md transition-colors
              ${
                isActive ? "bg-medqPink hover:bg-medqPink/55" : "bg-medqAltPink hover:bg-medqAltPink/50"
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>    
  );
}