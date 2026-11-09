import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faBrain, faImage, faGlobe, faComments } from "@fortawesome/free-solid-svg-icons";

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, var(--navy-glow) 0%, transparent 70%)",
          opacity: 0.6,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        {/* Logo with float animation */}
        <img
          src="/images/obytgemini-logo.png"
          alt="OBytGemini"
          className="w-24 h-24 object-contain mb-6"
          style={{ animation: "pulse 3s ease-in-out infinite" }}
        />

        {/* Brand name */}
        <h1
          className="text-4xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          OBytGemini
        </h1>

        {/* Headline */}
        <p
          className="text-xl md:text-2xl text-center mb-3 font-light"
          style={{ color: "var(--text-secondary)" }}
        >
          Your AI, your choice of models.
        </p>

        {/* Description */}
        <p
          className="text-sm md:text-base text-center mb-10 max-w-lg leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Chat with Google Gemini, OpenAI GPT, Groq, Anthropic Claude, and DeepSeek
          — all in one clean, fast interface. Upload images, generate visuals,
          research the web, and switch between models instantly.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            { icon: faComments, label: "Multi-model chat" },
            { icon: faImage, label: "Image generation" },
            { icon: faGlobe, label: "Web research" },
            { icon: faBrain, label: "Memory & personalization" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" style={{ color: "var(--accent-blue)" }} />
              {label}
            </div>
          ))}
        </div>

        {/* Get Started button */}
        <button
          onClick={() => navigate("/signin")}
          className="flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-semibold transition-all cursor-pointer"
          style={{
            background: "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-hover))",
            color: "var(--text-inverse)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          Get Started
          <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" />
        </button>

        {/* Subtle footer */}
        <p className="mt-8 text-xs" style={{ color: "var(--text-muted)" }}>
          Built by Samson Olatunde
        </p>
      </div>
    </div>
  );
}
