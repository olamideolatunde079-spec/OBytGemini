import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faBolt,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { ModelInfo } from "../types/index.js";

interface Props {
  models: ModelInfo[];
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ models, provider, model, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = models.find((m) => m.provider === provider && m.model === model);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Group by provider
  const grouped = models.reduce<Record<string, ModelInfo[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  const providerLabels: Record<string, string> = {
    groq: "Groq",
    openai: "OpenAI",
    google: "Google",
    anthropic: "Anthropic",
    deepseek: "DeepSeek",
    xai: "xAI",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faBolt} className="text-indigo-500 w-3 h-3" />
        <span className="max-w-40 truncate">{current?.displayName ?? `${provider}/${model}`}</span>
        <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 w-3 h-3" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="max-h-80 overflow-y-auto p-1">
            {Object.entries(grouped).map(([prov, provModels]) => (
              <div key={prov}>
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {providerLabels[prov] ?? prov}
                </p>
                {provModels.map((m) => (
                  <button
                    key={`${m.provider}/${m.model}`}
                    onClick={() => {
                      if (m.available) {
                        onChange(m.provider, m.model);
                        setOpen(false);
                      }
                    }}
                    disabled={!m.available}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      m.provider === provider && m.model === model
                        ? "bg-indigo-50 text-indigo-800 font-medium"
                        : m.available
                        ? "text-gray-700 hover:bg-gray-100"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                    role="option"
                    aria-selected={m.provider === provider && m.model === model}
                  >
                    <span className="flex-1">{m.displayName}</span>
                    {!m.available && (
                      <FontAwesomeIcon
                        icon={faCircleExclamation}
                        className="text-gray-400 w-3 h-3"
                        aria-label="API key not configured"
                      />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
