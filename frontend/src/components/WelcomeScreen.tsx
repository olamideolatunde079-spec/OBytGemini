import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faCode,
  faBook,
  faLightbulb,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

interface Suggestion {
  icon: IconDefinition;
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: faPenToSquare, label: "Write",      prompt: "Help me write a professional email to my team." },
  { icon: faCode,        label: "Code",       prompt: "Explain how async/await works in JavaScript." },
  { icon: faBook,        label: "Learn",      prompt: "What are the key differences between React and Vue?" },
  { icon: faLightbulb,   label: "Brainstorm", prompt: "Give me 5 side project ideas using AI." },
];

interface Props {
  onPrompt: (p: string) => void;
  userName?: string;
}

export default function WelcomeScreen({ onPrompt, userName }: Props) {
  const greeting = userName ? `Hello, ${userName.split(" ")[0]}` : "Hello";

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 pb-8 h-full">
      {/* Brand mark */}
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5 shadow-md">
        <span className="text-white text-xl font-bold">O</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-1">{greeting}</h1>
      <p className="text-lg text-gray-500 mb-8">How can OBytGemini help you today?</p>

      {/* Suggestion cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
        {SUGGESTIONS.map(({ icon, label, prompt }) => (
          <button
            key={label}
            onClick={() => onPrompt(prompt)}
            className="flex flex-col items-start gap-2 p-4 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
              <FontAwesomeIcon icon={icon} className="text-indigo-600 w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <span className="text-xs text-gray-400 line-clamp-2">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
