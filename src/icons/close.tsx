interface CloseIconProps {
  className?: string;
}

export function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 2 L12 12 M12 2 L2 12" />
    </svg>
  );
}
