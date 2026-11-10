import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faImage,
  faDownload,
  faExpand,
  faBookmark,
  faCheck,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";
import SparkleIcon from "../components/SparkleIcon.js";
import { generateImage, createLibraryItem } from "../lib/api.js";
import BackButton from "../components/BackButton.js";

interface GeneratedImageItem {
  id: string;
  prompt: string;
  dataUrl: string;
  provider: string;
  model: string;
  aspectRatio: string;
  createdAt: string;
}

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"google" | "openai">("google");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [stylePreset, setStylePreset] = useState("None");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageItem | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const stylePresets = [
    { label: "None", value: "" },
    { label: "Cinematic", value: ", cinematic lighting, 8k resolution, photorealistic, dramatic atmospheric depth" },
    { label: "Minimalist 3D", value: ", clean 3D isometric render, soft pastel studio lighting, minimalist composition" },
    { label: "Anime / Concept Art", value: ", Japanese anime concept art, vibrant digital painting, sharp detailed line art" },
    { label: "Watercolor", value: ", expressive watercolor painting, textured paper bleeding, delicate color washes" },
  ];

  const aspectRatios = [
    { label: "1:1 Square", value: "1:1" },
    { label: "16:9 Landscape", value: "16:9" },
    { label: "9:16 Vertical", value: "9:16" },
    { label: "4:3 Classic", value: "4:3" },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError(null);
    setLoading(true);

    const fullPrompt = `${prompt.trim()}${stylePresets.find((s) => s.label === stylePreset)?.value || ""}`;

    try {
      const res = await generateImage({
        provider,
        prompt: fullPrompt,
      });

      const newItem: GeneratedImageItem = {
        id: `img-${Date.now()}`,
        prompt: prompt.trim(),
        dataUrl: `data:${res.mimeType};base64,${res.data}`,
        provider: res.provider,
        model: res.model,
        aspectRatio,
        createdAt: new Date().toISOString(),
      };

      setHistory((prev) => [newItem, ...prev]);
      setPrompt("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Image generation failed. Ensure your provider API key is set in .env."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = async (item: GeneratedImageItem) => {
    try {
      await createLibraryItem({
        title: item.prompt.slice(0, 50),
        type: "image",
        content: item.prompt,
        previewUrl: item.dataUrl,
        tags: ["image-generation", item.provider],
      });
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2500);
    } catch {
      // ignore
    }
  };

  const handleDownload = (item: GeneratedImageItem) => {
    const a = document.createElement("a");
    a.href = item.dataUrl;
    a.download = `obytgemini-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BackButton fallback="/" label="Back" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Images
          </h1>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1 pl-12">
          Generate, edit, and explore high-fidelity visuals using Google Gemini and OpenAI image models.
        </p>
      </div>

      {/* Generator Prompt Box */}
      <form
        onSubmit={handleGenerate}
        className="rounded-3xl p-5 mb-8 border border-white/10 shadow-lg"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <SparkleIcon className="w-4 h-4 text-[#8AB4F8] mt-2.5 shrink-0" />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to see (e.g., 'A modern glass architecture house in the Norwegian mountains at twilight')..."
            rows={3}
            disabled={loading}
            className="flex-1 bg-transparent outline-none resize-none text-sm text-[var(--text-primary)] placeholder-gray-500 leading-relaxed"
          />
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Provider */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-secondary)] px-3 py-1.5 rounded-full border border-white/5">
              <span className="text-[var(--text-muted)]">Model:</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="bg-transparent outline-none text-[var(--text-primary)] cursor-pointer"
              >
                <option value="google" className="bg-[#202124]">Google Gemini Image</option>
                <option value="openai" className="bg-[#202124]">OpenAI DALL-E</option>
              </select>
            </div>

            {/* Aspect Ratio */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-secondary)] px-3 py-1.5 rounded-full border border-white/5">
              <span className="text-[var(--text-muted)]">Ratio:</span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-transparent outline-none text-[var(--text-primary)] cursor-pointer"
              >
                {aspectRatios.map((r) => (
                  <option key={r.value} value={r.value} className="bg-[#202124]">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Style Preset */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-secondary)] px-3 py-1.5 rounded-full border border-white/5">
              <FontAwesomeIcon icon={faSliders} className="w-2.5 h-2.5 text-[var(--text-muted)]" />
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="bg-transparent outline-none text-[var(--text-primary)] cursor-pointer"
              >
                {stylePresets.map((s) => (
                  <option key={s.label} value={s.label} className="bg-[#202124]">
                    Style: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <SparkleIcon className="w-3.5 h-3.5" />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Notice */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Generated Images Showcase */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">
          Recent Generations ({history.length})
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-white/10 bg-[var(--bg-surface)]">
            <FontAwesomeIcon icon={faImage} className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No images generated yet
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Type a prompt above to create your first visual asset.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {history.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[var(--bg-surface)] shadow-md flex flex-col justify-between"
              >
                <div
                  className="relative cursor-pointer overflow-hidden aspect-square bg-black/40 flex items-center justify-center"
                  onClick={() => setSelectedImage(item)}
                >
                  <img
                    src={item.dataUrl}
                    alt={item.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <FontAwesomeIcon icon={faExpand} className="w-6 h-6 text-white drop-shadow" />
                  </div>
                </div>

                <div className="p-3.5">
                  <p className="text-xs text-[var(--text-primary)] line-clamp-2 mb-3">
                    {item.prompt}
                  </p>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-[10px] text-[var(--text-muted)] capitalize">
                      {item.provider}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveToLibrary(item)}
                        className="text-gray-400 hover:text-[#8AB4F8] transition-colors p-1"
                        title="Save to Library"
                      >
                        <FontAwesomeIcon
                          icon={savedId === item.id ? faCheck : faBookmark}
                          className={savedId === item.id ? "text-green-400" : ""}
                        />
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Download PNG"
                      >
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.dataUrl}
              alt={selectedImage.prompt}
              className="max-h-[75vh] w-auto rounded-2xl shadow-2xl object-contain mb-4"
            />
            <div className="flex items-center justify-between w-full max-w-xl text-xs text-white">
              <span className="truncate pr-4">{selectedImage.prompt}</span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleSaveToLibrary(selectedImage)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
                >
                  Save to Library
                </button>
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="px-3 py-1.5 rounded-full bg-white text-black font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
