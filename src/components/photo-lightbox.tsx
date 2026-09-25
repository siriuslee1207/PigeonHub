"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { ImageEntry } from "@/data/images";
import { CarouselNavButton } from "@/components/carousel-nav-button";
import { useSnapIndex } from "@/components/use-snap-index";

type Props = {
  photos: ImageEntry[];
  ownerName: string;
  /** 要放大的照片索引；null 表示關閉 */
  openIndex: number | null;
  /** 關閉時回傳最後看到的索引，讓輪播同步捲到那張 */
  onClose: (index: number) => void;
};

/**
 * 全螢幕放大檢視。用原生 <dialog> 的 showModal()：Esc 關閉、焦點鎖在對話框內、關閉後焦點回到原本的按鈕，
 * 都由瀏覽器處理。裡面同樣是一條 scroll-snap 軌道，手機左右滑、桌機用 ‹ › 或鍵盤方向鍵。
 * 照片依原始比例等比縮放到貼齊可用區域（不足也放大）並置中；點照片以外的暗處或右上角 ✕ 關閉。
 */
export function PhotoLightbox({ photos, ownerName, openIndex, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { index, scrollToIndex } = useSnapIndex(trackRef);
  const count = photos.length;

  // 依 openIndex 開關：開啟時先瞬間定位到該張，並鎖住背景頁面的捲動。
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex === null) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    scrollToIndex(openIndex, "instant");
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [openIndex, scrollToIndex]);

  const close = () => dialogRef.current?.close();

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(index + 1);
    }
  };

  // 只在點到元素本身（照片以外的暗處）時關閉；點到照片、按鈕等子元素不動作。
  const closeIfBackdrop = (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onClose(index)}
      onKeyDown={onKeyDown}
      onClick={closeIfBackdrop}
      aria-label={`${ownerName} 的照片放大檢視`}
      className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 bg-black/95 p-0 text-white outline-none backdrop:bg-black/95"
    >
      <button
        type="button"
        onClick={close}
        aria-label="關閉"
        className="absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div
        ref={trackRef}
        role="region"
        aria-roledescription="輪播"
        aria-label={`${ownerName} 的照片`}
        className="relative flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <figure
            key={photo.src}
            role="group"
            aria-label={`第 ${i + 1} 張，共 ${count} 張`}
            onClick={closeIfBackdrop}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center p-3 pb-12 [container-type:size] sm:p-10 sm:pb-14"
          >
            <Image
              src={photo.src}
              alt={`${ownerName} 的照片 ${i + 1}`}
              width={photo.width}
              height={photo.height}
              sizes="100vw"
              // 寬度取「可用寬」與「可用高 × 長寬比」較小者，高度跟著比例走：小圖也會放大到貼齊可用區域。
              // 不用 fill + object-contain，是為了讓 <img> 的框等於照片本身，圓角、陰影和「點暗處關閉」才會對齊照片邊緣。
              style={{ width: `min(100cqw, 100cqh * ${photo.width / photo.height})` }}
              className="h-auto rounded-md object-contain shadow-2xl"
              loading={i === openIndex ? "eager" : "lazy"}
            />
          </figure>
        ))}
      </div>

      {count > 1 && (
        <>
          <CarouselNavButton direction="prev" size="lg" onClick={() => scrollToIndex(index - 1)} hidden={index === 0} />
          <CarouselNavButton direction="next" size="lg" onClick={() => scrollToIndex(index + 1)} hidden={index === count - 1} />
          <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-sm text-white/80" aria-live="polite">
            {index + 1} / {count}
          </p>
        </>
      )}
    </dialog>
  );
}
