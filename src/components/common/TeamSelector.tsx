import { useState, useRef, useEffect } from "react";

interface TeamSelectorProps {
  teams: string[];
  current: string;
  onChange: (team: string) => void;
}

export function TeamSelector({ teams, current, onChange }: TeamSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded
          bg-pixel-surface border border-pixel-panel/50 text-pixel-text
          text-[11px] font-mono hover:bg-pixel-panel transition-colors duration-150"
        style={{
          boxShadow: "inset -1px -1px 0 #0f3460, inset 1px 1px 0 #233a5e",
        }}
      >
        <span className="truncate max-w-[140px]">{current}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          className={`text-pixel-dim transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 left-0 min-w-full w-max
            bg-pixel-panel border border-pixel-dim/20 rounded overflow-hidden"
          style={{
            boxShadow: "inset -1px -1px 0 #0f3460, inset 1px 1px 0 #233a5e, 0 4px 12px #00000060",
          }}
        >
          {teams.map((team) => (
            <button
              key={team}
              onClick={() => {
                onChange(team);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-[11px] font-mono
                transition-colors duration-100
                ${
                  team === current
                    ? "bg-pixel-accent/20 text-pixel-bright"
                    : "text-pixel-text hover:bg-pixel-surface"
                }`}
            >
              {team === current && (
                <span className="text-pixel-accent mr-1.5">&#9656;</span>
              )}
              {team}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
