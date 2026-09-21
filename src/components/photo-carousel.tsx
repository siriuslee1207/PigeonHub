"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ImageEntry } from "@/data/images";
import { CarouselNavButton } from "@/components/carousel-nav-button";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { useSnapIndex } from "@/components/use-snap-index";

type Props = {
  photos: ImageEntry[];
  /** 用在 alt 與無障礙標籤，例如「KK 的照片」 */
  ownerName: string;
};

/**
 * 相簿輪播：一次顯示一張，兩側留白並露出前後張的邊緣，暗示可以左右滑。
 * 以原生橫向捲動 + scroll-snap 實作，手機直接滑、桌機可用半透明 ‹ › 按鈕或鍵盤（聚焦後按左右鍵）。
 * 照片比例不一時等比縮放置中，不裁切。點照片會開啟全螢幕放大檢視（PhotoLightbox）。
 */
export function PhotoCarousel({ photos, ownerName }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { index, scrollToIndex } = useSnapIndex(trackRef);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const count = photos.length;

  if (count === 0) return null;

  return (
    <div>
      {/* 按鈕以這層為基準垂直置中，計數文字放在外面才不會把中心往下拉。 */}
      <div className="relative">
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="輪播"
          aria-label={`${ownerName} 的照片`}
          tabIndex={0}
          className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto px-[8%] py-1 [scrollbar-width:none] motion-safe:scroll-smooth focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <figure
              key={photo.src}
              role="group"
              aria-label={`第 ${i + 1} 張，共 ${count} 張`}
              className="relative aspect-[4/3] w-[84%] shrink-0 snap-center overflow-hidden rounded-2xl bg-surface ring-1 ring-line"
            >
              <Image
                src={photo.src}
                alt={`${ownerName} 的照片 ${i + 1}`}
                fill
                sizes="(min-width: 768px) 660px, 84vw"
                className="object-contain"
                loading={i === 0 ? "eager" : "lazy"}
              />
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`放大第 ${i + 1} 張`}
                className="absolute inset-0 cursor-zoom-in rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
              />
            </figure>
          ))}
        </div>
        {count > 1 && (
          <>
            <CarouselNavButton direction="prev" onClick={() => scrollToIndex(index - 1)} hidden={index === 0} />
            <CarouselNavButton direction="next" onClick={() => scrollToIndex(index + 1)} hidden={index === count - 1} />
          </>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-muted" aria-live="polite">
        {count > 1 ? `${index + 1} / ${count}` : ""}
        {count > 1 ? "・" : ""}點照片可放大
      </p>

      <PhotoLightbox
        photos={photos}
        ownerName={ownerName}
        openIndex={lightboxIndex}
        onClose={(lastIndex) => {
          setLightboxIndex(null);
          scrollToIndex(lastIndex);
        }}
      />
    </div>
  );
}
