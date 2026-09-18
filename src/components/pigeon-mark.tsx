type Props = {
  className?: string;
};

/** 鴿子剪影標誌，顏色跟隨 currentColor。 */
export function PigeonMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="currentColor"
    >
      <path d="M8 46 L20 37 L23 45 Z M17 40 a15 10 0 1 0 30 0 a15 10 0 1 0 -30 0 Z M38.5 30 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0 Z M51 29 L57 31 L51 33 Z M24 37 C27 22 41 19 47 22 C40 25 35 31 33 38 Z" />
    </svg>
  );
}
