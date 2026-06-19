interface CloseIconProps {
  className?: string;
}

// The × glyph from the Hazbot coach-mark design (a filled polygon, not a stroke).
// Drawn with `fill: currentColor` so a theme can recolor it via `color` — e.g.
// the hazbot theme flips it blue → white between the default and hover/select
// states.
export function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        fillRule="nonzero"
        points="16.5407377 5.22702923 11.7684741 9.99929289 16.5407377 14.7729708 14.7729708 16.5407377 10 11.767767 5.22702923 16.5407377 3.45926227 14.7729708 8.23223305 10 3.45926227 5.22702923 5.22702923 3.45926227 10 8.23223305 14.7729708 3.45926227"
      />
    </svg>
  );
}
