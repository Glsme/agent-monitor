import { useState, useRef, useEffect } from "react";
import { CUSTOM_COLOR_PALETTE } from "@/types/agent";

interface ColorPickerPopoverProps {
  currentColor: string;
  hasCustomColor: boolean;
  onApply: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
}

function MiniCharacterPreview({ color }: { color: string }) {
  return (
    <svg width="40" height="50" viewBox="-10 -8 20 36" style={{ imageRendering: "pixelated" }}>
      {/* Legs */}
      <rect x="-3" y="14" width="3" height="5" fill={color} opacity="0.9" />
      <rect x="0" y="14" width="3" height="5" fill={color} opacity="0.9" />
      {/* Body */}
      <rect x="-5" y="4" width="10" height="10" rx="1" fill={color} />
      {/* Head */}
      <rect x="-6" y="-6" width="12" height="10" rx="1" fill={color} />
      {/* Eyes */}
      <rect x="-4" y="-3" width="2" height="2" fill="#1a1a2e" />
      <rect x="2" y="-3" width="2" height="2" fill="#1a1a2e" />
      {/* Arms */}
      <rect x="-8" y="5" width="3" height="7" rx="1" fill={color} opacity="0.85" />
      <rect x="5" y="5" width="3" height="7" rx="1" fill={color} opacity="0.85" />
    </svg>
  );
}

export function ColorPickerPopover({
  currentColor,
  hasCustomColor,
  onApply,
  onReset,
  onClose,
}: ColorPickerPopoverProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const previewColor = selectedColor || currentColor;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-48 bg-pixel-surface border border-pixel-panel rounded-lg p-3 shadow-lg shadow-black/50"
    >
      {/* Title */}
      <p className="text-[8px] font-pixel text-pixel-dim tracking-wider uppercase mb-2">
        CHANGE COLOR
      </p>

      {/* Mini character preview */}
      <div className="flex justify-center mb-2">
        <MiniCharacterPreview color={previewColor} />
      </div>

      {/* Color palette grid (4x3) */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {CUSTOM_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className="w-7 h-7 rounded-sm border-2 transition-all duration-100 hover:scale-105 relative"
            style={{
              backgroundColor: color,
              borderColor:
                selectedColor === color
                  ? "rgba(255,255,255,0.9)"
                  : "transparent",
              boxShadow:
                selectedColor === color ? `0 0 8px ${color}` : "none",
            }}
            title={color}
          >
            {/* Checkmark for currently applied color */}
            {color === currentColor && hasCustomColor && (
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-white rounded-full text-[6px] leading-none flex items-center justify-center text-black font-bold">
                &check;
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-pixel-panel/30">
        <button
          onClick={() => {
            if (selectedColor) {
              onApply(selectedColor);
            }
          }}
          disabled={!selectedColor}
          className={`text-[8px] font-pixel px-3 py-1.5 rounded-sm tracking-wider ${
            selectedColor
              ? "bg-pixel-panel hover:bg-pixel-blue/30 text-pixel-bright cursor-pointer"
              : "bg-pixel-panel/50 text-pixel-dim opacity-50 cursor-not-allowed"
          }`}
        >
          APPLY
        </button>
        {hasCustomColor && (
          <button
            onClick={onReset}
            className="text-[8px] font-pixel text-pixel-dim hover:text-pixel-bright px-3 py-1.5 tracking-wider cursor-pointer"
          >
            RESET
          </button>
        )}
      </div>
    </div>
  );
}
