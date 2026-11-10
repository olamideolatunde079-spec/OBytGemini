/**
 * MobileHeader — global mobile top-bar shown on EVERY page.
 *
 * Rendered by AppShell above the <Outlet /> so every page automatically
 * gets the hamburger menu without any per-page wiring.
 *
 * Desktop (md+): hidden — the sidebar handles its own toggle.
 * Mobile (<md):  always visible — shows hamburger ☰, logo/title, and
 *                the new-chat pencil icon.
 *
 * The hamburger always opens the sidebar drawer regardless of which
 * page the user is currently on (ChatPage, LibraryPage, etc.).
 */
import { useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPenToSquare } from "@fortawesome/free-solid-svg-icons";

/** Map route paths → human-readable titles shown in the mobile header. */
const PAGE_TITLES: Record<string, string> = {
  "/":          "OBytGemini",
  "/library":   "Library",
  "/images":    "Images",
  "/scheduled": "Scheduled",
  "/study":     "Study",
  "/customise": "Settings",
  "/research":  "Research",
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/chat/"))     return "Chat";
  if (pathname.startsWith("/notebook/")) return "Notebook";
  return PAGE_TITLES[pathname] ?? "OBytGemini";
}

interface MobileHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

export default function MobileHeader({ onToggleSidebar, onNewChat }: MobileHeaderProps) {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    /* Only visible on mobile — md+ screens use the sidebar directly */
    <header
      className="
        flex md:hidden
        items-center justify-between
        px-3 py-2
        shrink-0
        z-10
      "
      style={{
        background: "var(--bg-sidebar)",
        borderBottom: "1px solid var(--border-light)",
        /* Ensure it stays above page content but below the drawer (z-30) */
      }}
    >
      {/* Left — Hamburger */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Open navigation menu"
        title="Menu"
        className="
          w-10 h-10 rounded-full
          flex items-center justify-center
          text-[var(--text-secondary)]
          hover:text-[var(--text-primary)]
          hover:bg-[var(--bg-hover)]
          active:scale-95
          transition-all
          shrink-0
        "
      >
        <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
      </button>

      {/* Centre — Logo + Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-2">
        <img
          src="/images/obytgemini-logo.png"
          alt=""
          className="w-5 h-5 object-contain shrink-0"
          aria-hidden="true"
        />
        <span
          className="text-sm font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
      </div>

      {/* Right — New Chat shortcut */}
      <button
        type="button"
        onClick={onNewChat}
        aria-label="New chat"
        title="New chat"
        className="
          w-10 h-10 rounded-full
          flex items-center justify-center
          text-[var(--text-secondary)]
          hover:text-[var(--text-primary)]
          hover:bg-[var(--bg-hover)]
          active:scale-95
          transition-all
          shrink-0
        "
      >
        <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />
      </button>
    </header>
  );
}
