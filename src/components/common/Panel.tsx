import { ReactNode } from "react";

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className = "" }: PanelProps) {
  return (
    <div
      className={`bg-pixel-surface rounded-lg p-3 border-2 border-pixel-panel/50 ${className}`}
      style={{
        boxShadow: "inset -2px -2px 0 #0f3460, inset 2px 2px 0 #233a5e",
      }}
    >
      {title && (
        <h3 className="text-[10px] font-pixel text-pixel-dim mb-2 uppercase tracking-widest">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
