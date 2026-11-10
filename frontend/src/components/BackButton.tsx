/**
 * BackButton — reusable global back-navigation component.
 *
 * Behaviour:
 * - Calls navigate(-1) to go to the immediately previous in-app page.
 * - If there is no previous history entry (user landed directly on this page),
 *   falls back to the `fallback` prop (default: "/").
 * - Works correctly with browser Back/Forward buttons — no duplicate history entries.
 * - Visible on desktop, tablet, and mobile.
 */
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

interface BackButtonProps {
  /** Where to go when there is no previous page. Defaults to "/" */
  fallback?: string;
  /** Extra Tailwind/CSS classes on the outer wrapper */
  className?: string;
  /** Label shown in aria-label and tooltip. Defaults to "Go back" */
  label?: string;
}

export default function BackButton({
  fallback = "/",
  className = "",
  label = "Go back",
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    // window.history.length <= 2 means: only the current page exists (no real "back")
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      title={label}
      className={`
        group
        inline-flex items-center justify-center
        w-9 h-9 rounded-full shrink-0
        transition-all duration-150
        text-[var(--text-secondary)]
        hover:text-[var(--text-primary)]
        hover:bg-[var(--bg-hover)]
        active:scale-95
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[var(--accent-blue)]
        focus-visible:ring-offset-2
        focus-visible:ring-offset-transparent
        ${className}
      `}
    >
      <FontAwesomeIcon
        icon={faArrowLeft}
        className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5"
      />
    </button>
  );
}
