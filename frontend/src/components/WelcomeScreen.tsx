import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare, faCode, faBook, faLightbulb,
  faFlask, faImage,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const SUGGESTIONS: { icon: IconDefinition; label: string; prompt: string }[] = [
  { icon: faPenToSquare, label: "Write",       prompt: "Help me write a professional email to my team." },
  { icon: faCode,        label: "Code",        prompt: "Explain how async/await works in JavaScript with examples." },
  { icon: faBook,        label: "Learn",       prompt: "What are the key differences between React and Vue?" },
  { icon: faLightbulb,   label: "Brainstorm",  prompt: "Give me 5 creative side project ideas using AI." },
  { icon: faFlask,       label: "Research",    prompt: "What are the latest developments in quantum computing?" },
  { icon: faImage,       label: "Create image", prompt: "A futuristic city at sunset with flying cars" },
];

interface Props {
  onPrompt: (p: string) => void;
  userName?: string;
}

export default function WelcomeScreen({ onPrompt, userName }: Props) {
  const first = userName ? userName.split(" ")[0] : null;

  return (
    <div className="flex flex-col items-center justify-start flex-1 w-full overflow-y-auto px-4 pt-10 pb-6 relative">

      {/* ── animated background logo ── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
        style={{ top: 0, zIndex: 0 }}
      >
        {/* glow blob behind the logo */}
        <div
          className="obyt-glow-blob absolute w-72 h-72 rounded-full"
          style={{
            background: "radial-gradient(circle, var(--brand-1) 0%, var(--brand-2) 60%, transparent 80%)",
            opacity: 0.12,
          }}
        />
        {/* the actual logo symbol */}
        <img
          src="/images/obytgemini-logo.png"
          alt=""
          className="obyt-logo-float"
          style={{
            width: 220,
            height: 220,
            objectFit: "contain",
            opacity: 0.08,
            filter: "saturate(1.5)",
          }}
        />
      </div>

      {/* ── foreground content ── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">

        {/* greeting */}
        <h1
          className="obyt-fade-in text-3xl md:text-4xl font-semibold text-center mt-4 mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {first ? `Hello, ${first}` : "Hello"}
        </h1>
        <p
          className="obyt-fade-in-delay-1 text-xl md:text-2xl font-normal text-center mb-10"
          style={{ color: "var(--text-secondary)" }}
        >
          How can I help you today?
        </p>

        {/* suggestion chips */}
        <div className="obyt-fade-in-delay-2 grid grid-cols-2 md:grid-cols-3 gap-3 w-full mb-8">
          {SUGGESTIONS.map(({ icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => onPrompt(prompt)}
              className="flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all group"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-1)";
                (e.currentTarget as HTMLElement).style.background = "var(--accent-bg)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: "var(--accent-bg)" }}
              >
                <FontAwesomeIcon icon={icon} className="w-4 h-4" style={{ color: "var(--brand-1)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
              <span className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
                {prompt}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
