import type { CSSProperties } from "react";

export default function SparkleIcon({
  className = "w-4 h-4",
  style,
  animated = false,
}: {
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} ${animated ? "animate-pulse" : ""}`}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z" />
    </svg>
  );
}
