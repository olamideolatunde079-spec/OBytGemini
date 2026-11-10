import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faPlus,
  faPlay,
  faPause,
  faTrash,
  faBolt,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchScheduledTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  runScheduledTask,
} from "../lib/api.js";
import type { ScheduledTask } from "../types/index.js";
import BackButton from "../components/BackButton.js";

export default function ScheduledPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [frequency, setFrequency] = useState<ScheduledTask["frequency"]>("daily");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<{ id: string; text: string } | null>(null);

  const loadTasks = () => {
    setLoading(true);
    fetchScheduledTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    try {
      const created = await createScheduledTask({
        title: title.trim(),
        prompt: prompt.trim(),
        frequency,
        timeOfDay,
      });
      setTasks((prev) => [created, ...prev]);
      setCreateModalOpen(false);
      setTitle("");
      setPrompt("");
    } catch {
      // ignore
    }
  };

  const handleToggleStatus = async (task: ScheduledTask) => {
    const nextStatus = task.status === "active" ? "paused" : "active";
    try {
      const updated = await updateScheduledTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      // ignore
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningTaskId(id);
    try {
      const res = await runScheduledTask(id);
      setLastOutput({ id, text: res.result });
      loadTasks();
    } catch {
      // ignore
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScheduledTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (lastOutput?.id === id) setLastOutput(null);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <BackButton fallback="/" label="Back" />
          <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Scheduled Tasks
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Automate routine AI prompts, briefings, and research summaries on your schedule.
          </p>
          </div>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          <span>Schedule Prompt</span>
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--bg-surface)] animate-pulse border border-white/5" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-dashed border-white/10 bg-[var(--bg-surface)]">
          <FontAwesomeIcon icon={faClock} className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-[var(--text-primary)]">No scheduled tasks</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            Schedule a recurring daily brief, market digest, or weekly check-in to run automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isRunning = runningTaskId === task.id;
            return (
              <div
                key={task.id}
                className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-white/10 hover:border-white/15 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        task.status === "active" ? "bg-emerald-400" : "bg-gray-500"
                      }`}
                    />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {task.title}
                    </h3>
                    <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full bg-white/5 text-[var(--accent-blue)] border border-white/5">
                      {task.frequency} at {task.timeOfDay}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunNow(task.id)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                      title="Run immediately"
                    >
                      {isRunning ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faBolt} className="w-3 h-3 text-amber-300" />
                      )}
                      <span>Run Now</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      title={task.status === "active" ? "Pause task" : "Resume task"}
                    >
                      <FontAwesomeIcon icon={task.status === "active" ? faPause : faPlay} className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                      title="Delete task"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 font-mono bg-[var(--bg-surface-secondary)] p-2.5 rounded-xl border border-white/5">
                  "{task.prompt}"
                </p>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
                  <span>
                    Last run: {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : "Never"}
                  </span>
                  <span>
                    Created: {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Last Output Accordion */}
                {lastOutput?.id === task.id && (
                  <div className="mt-3 pt-3 border-t border-white/5 text-xs text-[var(--text-primary)]">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-medium mb-1">
                      <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                      <span>Latest Execution Result (Saved to Library):</span>
                    </div>
                    <div className="bg-[var(--bg-surface-secondary)] p-3 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed text-xs">
                      {lastOutput.text}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4"
            style={{ background: "var(--bg-surface)" }}
          >
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Schedule AI Prompt
            </h3>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Title</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Daily Tech & AI Briefing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Prompt</label>
              <textarea
                placeholder="The prompt to execute on schedule..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="daily" className="bg-[#202124]">Daily</option>
                  <option value="weekly" className="bg-[#202124]">Weekly</option>
                  <option value="hourly" className="bg-[#202124]">Hourly</option>
                  <option value="once" className="bg-[#202124]">One-off</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Time of Day</label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-secondary)] border border-white/10 text-xs text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs text-[var(--text-secondary)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-full text-xs bg-white text-black font-medium hover:bg-white/90"
              >
                Create Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
