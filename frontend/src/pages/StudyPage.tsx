import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGraduationCap,
  faLightbulb,
  faLayerGroup,
  faCircleQuestion,
  faFileLines,
  faRotateRight,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import SparkleIcon from "../components/SparkleIcon.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateStudyContent } from "../lib/api.js";
import type { StudyFlashcard, StudyQuizQuestion } from "../types/index.js";

type StudyTab = "explain" | "flashcards" | "quiz" | "summary";

export default function StudyPage() {
  const [activeTab, setActiveTab] = useState<StudyTab>("explain");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [explanation, setExplanation] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<StudyFlashcard[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<StudyQuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await generateStudyContent({
        action: activeTab,
        topic: topic.trim(),
        difficulty,
      });

      if (activeTab === "explain") {
        setExplanation(res.data);
      } else if (activeTab === "flashcards") {
        setFlashcards(Array.isArray(res.data) ? res.data : []);
        setActiveCardIndex(0);
        setCardFlipped(false);
      } else if (activeTab === "quiz") {
        setQuizQuestions(Array.isArray(res.data) ? res.data : []);
        setUserAnswers({});
      } else if (activeTab === "summary") {
        setSummary(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate study materials.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (qIdx: number, optIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const score = quizQuestions.reduce((acc, q, idx) => {
    return userAnswers[idx] === q.correctIndex ? acc + 1 : acc;
  }, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Students & Study Workspace
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Master any subject with AI-powered tutoring, interactive flashcards, quizzes, and revision guides.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-white/10">
        {[
          { id: "explain", label: "Concept Explainer", icon: faLightbulb },
          { id: "flashcards", label: "Flashcards", icon: faLayerGroup },
          { id: "quiz", label: "Practice Quiz", icon: faCircleQuestion },
          { id: "summary", label: "Study Summary", icon: faFileLines },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as StudyTab);
              setError(null);
            }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap
              ${
                activeTab === tab.id
                  ? "bg-white text-black font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]"
              }
            `}
          >
            <FontAwesomeIcon icon={tab.icon} className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleGenerate}
        className="rounded-3xl p-5 mb-8 border border-white/10 shadow-lg"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
            {activeTab === "explain" && "What concept or topic would you like explained?"}
            {activeTab === "flashcards" && "What topic do you want flashcards for?"}
            {activeTab === "quiz" && "What topic would you like a practice quiz on?"}
            {activeTab === "summary" && "Paste notes or name the subject to summarize:"}
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              activeTab === "explain"
                ? "e.g., How does CRISPR-Cas9 gene editing work? or Fourier Transform intuitively"
                : activeTab === "flashcards"
                ? "e.g., Organic Chemistry functional groups or Spanish Subjunctive Conjugations"
                : activeTab === "quiz"
                ? "e.g., Macroeconomics Monetary Policy or Cellular Respiration"
                : "e.g., Chapter 4: Photosynthesis and Light Reactions..."
            }
            rows={3}
            disabled={loading}
            className="w-full bg-[var(--bg-surface-secondary)] p-3 rounded-2xl border border-white/10 text-sm text-[var(--text-primary)] placeholder-gray-500 outline-none resize-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Difficulty selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)]">Level:</span>
            <div className="flex items-center bg-[var(--bg-surface-secondary)] p-0.5 rounded-full border border-white/5">
              {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`px-3 py-1 rounded-full capitalize text-xs transition-colors ${
                    difficulty === lvl
                      ? "bg-white/10 text-white font-medium"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!topic.trim() || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-medium text-xs hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <SparkleIcon className="w-3.5 h-3.5" />
                <span>Generate Study Material</span>
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results Display */}

      {/* 1. Concept Explainer View */}
      {activeTab === "explain" && explanation && (
        <div
          className="rounded-3xl p-6 border border-white/10 shadow-lg prose max-w-none text-sm leading-relaxed"
          style={{ background: "var(--bg-surface)" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
        </div>
      )}

      {/* 2. Interactive Flashcards View */}
      {activeTab === "flashcards" && flashcards.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-between w-full max-w-md text-xs text-[var(--text-muted)] mb-3">
            <span>Card {activeCardIndex + 1} of {flashcards.length}</span>
            <span>Click card to flip</span>
          </div>

          {/* Flashcard container */}
          <div
            onClick={() => setCardFlipped((v) => !v)}
            className="w-full max-w-md h-64 rounded-3xl p-8 border border-white/10 shadow-2xl cursor-pointer flex flex-col items-center justify-center text-center transition-all transform hover:scale-[1.01] select-none"
            style={{
              background: cardFlipped
                ? "linear-gradient(135deg, #1e2638, #182030)"
                : "linear-gradient(135deg, #202124, #1a1b1e)",
              borderColor: cardFlipped ? "#8AB4F8" : "rgba(255,255,255,0.1)",
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8AB4F8] mb-3">
              {cardFlipped ? "Answer" : "Question"}
            </span>
            <p className="text-base sm:text-lg font-medium text-[var(--text-primary)] leading-relaxed">
              {cardFlipped
                ? flashcards[activeCardIndex]?.answer
                : flashcards[activeCardIndex]?.question}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={() => {
                setActiveCardIndex((i) => Math.max(0, i - 1));
                setCardFlipped(false);
              }}
              disabled={activeCardIndex === 0}
              className="px-4 py-2 rounded-full text-xs font-medium bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-white/5"
            >
              Previous
            </button>
            <button
              onClick={() => setCardFlipped((v) => !v)}
              className="px-4 py-2 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faRotateRight} className="w-3 h-3" />
              <span>Flip</span>
            </button>
            <button
              onClick={() => {
                setActiveCardIndex((i) => Math.min(flashcards.length - 1, i + 1));
                setCardFlipped(false);
              }}
              disabled={activeCardIndex === flashcards.length - 1}
              className="px-4 py-2 rounded-full text-xs font-medium bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-white/5"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 3. Practice Quiz View */}
      {activeTab === "quiz" && quizQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-surface)] border border-white/10">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Practice Assessment
            </span>
            <span className="text-xs font-medium text-[#8AB4F8]">
              Score: {score} / {quizQuestions.length} ({Math.round((score / quizQuestions.length) * 100)}%)
            </span>
          </div>

          {quizQuestions.map((q, qIdx) => {
            const hasAnswered = userAnswers[qIdx] !== undefined;
            const isCorrect = userAnswers[qIdx] === q.correctIndex;

            return (
              <div
                key={qIdx}
                className="p-5 rounded-3xl border border-white/10 bg-[var(--bg-surface)] shadow-md space-y-3"
              >
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  {qIdx + 1}. {q.question}
                </h4>

                <div className="space-y-2 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = userAnswers[qIdx] === optIdx;
                    const isTheCorrectOne = optIdx === q.correctIndex;

                    let optBg = "bg-[var(--bg-surface-secondary)] hover:bg-[var(--bg-hover)]";
                    let optBorder = "border-white/5";

                    if (hasAnswered) {
                      if (isTheCorrectOne) {
                        optBg = "bg-emerald-500/15 text-emerald-300";
                        optBorder = "border-emerald-500/30";
                      } else if (isSelected && !isCorrect) {
                        optBg = "bg-red-500/15 text-red-300";
                        optBorder = "border-red-500/30";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleAnswerSelect(qIdx, optIdx)}
                        className={`w-full p-3 rounded-xl text-left text-xs transition-colors border flex items-center justify-between ${optBg} ${optBorder}`}
                      >
                        <span>{opt}</span>
                        {hasAnswered && isTheCorrectOne && (
                          <FontAwesomeIcon icon={faCheck} className="text-emerald-400 w-3 h-3 shrink-0" />
                        )}
                        {hasAnswered && isSelected && !isCorrect && (
                          <FontAwesomeIcon icon={faXmark} className="text-red-400 w-3 h-3 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {hasAnswered && q.explanation && (
                  <p className="text-xs text-[var(--text-secondary)] bg-white/5 p-3 rounded-xl border border-white/5 mt-2">
                    💡 <strong className="text-white">Explanation:</strong> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Study Summary View */}
      {activeTab === "summary" && summary && (
        <div
          className="rounded-3xl p-6 border border-white/10 shadow-lg prose max-w-none text-sm leading-relaxed"
          style={{ background: "var(--bg-surface)" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
