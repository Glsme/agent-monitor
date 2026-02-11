import { useEffect, useState } from "react";

interface NotificationToastProps {
  message: string;
  type?: "info" | "success" | "warning";
  onDismiss: () => void;
}

const TOAST_COLORS: Record<string, { border: string; text: string; icon: string }> = {
  info: {
    border: "#4fc3f7",
    text: "#4fc3f7",
    icon: "i",
  },
  success: {
    border: "#00d98b",
    text: "#00d98b",
    icon: "\u2713",
  },
  warning: {
    border: "#ffd93d",
    text: "#ffd93d",
    icon: "!",
  },
};

export function NotificationToast({
  message,
  type = "info",
  onDismiss,
}: NotificationToastProps) {
  const [visible, setVisible] = useState(false);
  const colors = TOAST_COLORS[type] || TOAST_COLORS.info;

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  // Auto dismiss after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClick = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      onClick={handleClick}
      role="alert"
      aria-live="polite"
      className="cursor-pointer select-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 200ms ease-in-out, transform 200ms ease-in-out",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-2 rounded bg-pixel-surface"
        style={{
          border: `2px solid ${colors.border}`,
          boxShadow: `0 0 12px ${colors.border}20, inset 0 0 8px ${colors.border}08`,
        }}
      >
        {/* Pixel art icon */}
        <span
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-mono font-bold rounded-sm"
          style={{
            color: "#1a1a2e",
            backgroundColor: colors.border,
            imageRendering: "pixelated",
          }}
        >
          {colors.icon}
        </span>

        <span
          className="text-[11px] font-mono leading-tight"
          style={{ color: colors.text }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
