type Props = {
  direction: "prev" | "next";
  onClick: () => void;
  /** 在第一張或最後一張時隱藏，並移出 tab 順序 */
  hidden: boolean;
  /** md 用在輪播，lg 用在全螢幕放大檢視 */
  size?: "md" | "lg";
};

/** 半透明圓形的 ‹ › 按鈕，絕對定位在父層左右、垂直置中。父層需要 position: relative。 */
export function CarouselNavButton({ direction, onClick, hidden, size = "md" }: Props) {
  const isPrev = direction === "prev";
  const sizeClass = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const sideClass = size === "lg" ? (isPrev ? "left-3 sm:left-6" : "right-3 sm:right-6") : isPrev ? "left-2" : "right-2";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "上一張" : "下一張"}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${sizeClass} ${sideClass} ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={size === "lg" ? "h-6 w-6" : "h-5 w-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isPrev ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
