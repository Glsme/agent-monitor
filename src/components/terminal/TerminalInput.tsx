import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";

interface TerminalInputProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  agentNames: string[];
}

const COMMANDS = [
  { cmd: "/help", desc: "Show available commands" },
  { cmd: "/msg", desc: "Send message to agent" },
  { cmd: "/broadcast", desc: "Send message to all agents" },
  { cmd: "/status", desc: "Show team or agent status" },
  { cmd: "/tasks", desc: "List tasks" },
  { cmd: "/inbox", desc: "Show agent inbox" },
  { cmd: "/agents", desc: "List team agents" },
  { cmd: "/assign", desc: "Assign task to agent" },
  { cmd: "/clear", desc: "Clear terminal output" },
  { cmd: "/history", desc: "Show command history" },
];

export function TerminalInput({ onSubmit, disabled, agentNames }: TerminalInputProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Compute suggestions based on current input
  const updateSuggestions = useCallback(
    (text: string) => {
      if (!text) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const parts = text.split(/\s+/);
      const isTypingCommand = parts.length === 1 && text.startsWith("/");
      const agentCommands = ["/msg", "/assign", "/inbox", "/status"];
      const isTypingAgent =
        parts.length === 2 && agentCommands.includes(parts[0]);

      let matches: string[] = [];

      if (isTypingCommand) {
        matches = COMMANDS
          .filter((c) => c.cmd.startsWith(text))
          .map((c) => c.cmd);
      } else if (isTypingAgent) {
        const prefix = parts[1].toLowerCase();
        matches = agentNames
          .filter((n) => n.toLowerCase().startsWith(prefix))
          .map((n) => `${parts[0]} ${n} `);
      }

      setSuggestions(matches);
      setSelectedSuggestion(0);
      setShowSuggestions(matches.length > 0);
    },
    [agentNames]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setValue(text);
    setHistoryIndex(-1);
    updateSuggestions(text);
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSubmit(trimmed);
    setHistory((prev) => [trimmed, ...prev.slice(0, 99)]);
    setValue("");
    setHistoryIndex(-1);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Tab: accept suggestion
    if (e.key === "Tab") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        const selected = suggestions[selectedSuggestion];
        setValue(selected.endsWith(" ") ? selected : selected + " ");
        setSuggestions([]);
        setShowSuggestions(false);
      }
      return;
    }

    // Enter: submit
    if (e.key === "Enter") {
      if (showSuggestions && suggestions.length > 0) {
        const selected = suggestions[selectedSuggestion];
        setValue(selected.endsWith(" ") ? selected : selected + " ");
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        handleSubmit();
      }
      return;
    }

    // Escape: close suggestions
    if (e.key === "Escape") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Arrow up/down for suggestions or history
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (history.length > 0) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < history.length) {
          setHistoryIndex(nextIndex);
          setValue(history[nextIndex]);
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setValue(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setValue("");
      }
      return;
    }
  };

  return (
    <div className="relative flex-shrink-0 border-t border-pixel-panel">
      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute bottom-full left-0 right-0 bg-pixel-surface border border-pixel-panel rounded-t overflow-hidden"
          style={{
            boxShadow: "0 -4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {suggestions.map((suggestion, i) => {
            const cmd = COMMANDS.find((c) => c.cmd === suggestion);
            return (
              <button
                key={suggestion}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-3 transition-colors ${
                  i === selectedSuggestion
                    ? "bg-pixel-panel text-pixel-bright"
                    : "text-pixel-text hover:bg-pixel-panel/50"
                }`}
                onClick={() => {
                  setValue(suggestion.endsWith(" ") ? suggestion : suggestion + " ");
                  setSuggestions([]);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
              >
                <span className="text-pixel-green">{suggestion}</span>
                {cmd && (
                  <span className="text-pixel-dim text-[9px]">{cmd.desc}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-pixel-bg/50">
        {/* Prompt symbol */}
        <span className="text-pixel-green text-sm font-mono font-bold flex-shrink-0 select-none">
          {">"}
        </span>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a command... (/help for list)"
          className="flex-1 bg-transparent text-pixel-text text-[12px] font-mono outline-none placeholder:text-pixel-dim/50 disabled:opacity-40"
          spellCheck={false}
          autoComplete="off"
        />

        {/* Blinking cursor indicator when empty */}
        {!value && !disabled && (
          <span className="w-1.5 h-4 bg-pixel-green animate-blink flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
