import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComments,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import SparkleIcon from "./SparkleIcon.js";
import PromptComposer from "./PromptComposer.js";
import type { ModelInfo } from "../types/index.js";

interface WelcomeScreenProps {
  onPrompt: (promptText: string) => void;
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  models: ModelInfo[];
  provider: string;
  model: string;
  onModelChange: (p: string, m: string) => void;
  attachment: any;
  onAttachmentChange: (a: any) => void;
}

export default function WelcomeScreen({
  onPrompt,
  input,
  setInput,
  onSubmit,
  loading,
  models,
  provider,
  model,
  onModelChange,
  attachment,
  onAttachmentChange,
}: WelcomeScreenProps) {
  const suggestions = [
    {
      isSparkle: true,
      iconColor: "#8AB4F8",
      label: "Design a phone wallpaper for me",
      prompt: "Design a phone wallpaper for me. Create an aesthetic, modern vertical wallpaper concept with minimalist geometric composition and soothing gradients.",
    },
    {
      icon: faComments,
      iconColor: "#AEB4BE",
      label: "Walk me through a hard conversation",
      prompt: "Walk me through a hard conversation. How do I give constructive, sensitive feedback to a colleague while keeping our working relationship positive?",
    },
    {
      icon: faWrench,
      iconColor: "#AEB4BE",
      label: "Help me free up phone storage",
      prompt: "Help me free up phone storage. Give me step-by-step practical tips for clearing cache, duplicate photos, offloading apps, and cleaning up space safely.",
    },
  ];

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full px-4 min-h-[500px]">
      {/* Background Ambient Glow */}
      <div
        className="absolute inset-0 pointer-events-none gemini-ambient-glow z-0"
        aria-hidden="true"
      />

      {/* Main Centered Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl text-center">
        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-[42px] font-normal tracking-tight text-[var(--text-primary)] mb-8 select-none">
          Where should we start?
        </h1>

        {/* Embedded Composer in Center */}
        <div className="w-full mb-7">
          <PromptComposer
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            loading={loading}
            models={models}
            provider={provider}
            model={model}
            onModelChange={onModelChange}
            attachment={attachment}
            onAttachmentChange={onAttachmentChange}
            placeholder="Ask OBytGemini"
          />
        </div>

        {/* Three Contextual Suggestions */}
        <div className="flex flex-col items-start gap-2.5 w-full max-w-xl mx-auto px-4">
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => onPrompt(item.prompt)}
              className="flex items-center gap-3 w-full py-2 px-3 rounded-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer group"
            >
              {"isSparkle" in item && item.isSparkle ? (
                <SparkleIcon
                  className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110"
                  style={{ color: item.iconColor }}
                />
              ) : (
                <FontAwesomeIcon
                  icon={item.icon!}
                  className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110"
                  style={{ color: item.iconColor }}
                />
              )}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
