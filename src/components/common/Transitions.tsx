import { useEffect, useState, useRef, ReactNode } from "react";

// --- FadeTransition ---

interface FadeTransitionProps {
  show: boolean;
  duration?: number;
  children: ReactNode;
  className?: string;
}

export function FadeTransition({
  show,
  duration = 200,
  children,
  className = "",
}: FadeTransitionProps) {
  const [shouldRender, setShouldRender] = useState(show);
  const [opacity, setOpacity] = useState(show ? 1 : 0);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Delay opacity change to next frame so the element is mounted first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpacity(1));
      });
    } else {
      setOpacity(0);
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={className}
      style={{
        opacity,
        transition: `opacity ${duration}ms ease-in-out`,
        visibility: opacity === 0 ? "hidden" : "visible",
      }}
    >
      {children}
    </div>
  );
}

// --- SlideTransition ---

interface SlideTransitionProps {
  show: boolean;
  direction?: "left" | "right";
  duration?: number;
  children: ReactNode;
  className?: string;
}

export function SlideTransition({
  show,
  direction = "right",
  duration = 300,
  children,
  className = "",
}: SlideTransitionProps) {
  const [shouldRender, setShouldRender] = useState(show);
  const [active, setActive] = useState(show);
  const offsetX = direction === "right" ? "30px" : "-30px";

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
    } else {
      setActive(false);
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={className}
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateX(0)" : `translateX(${offsetX})`,
        transition: `opacity ${duration}ms ease-in-out, transform ${duration}ms ease-in-out`,
      }}
    >
      {children}
    </div>
  );
}
