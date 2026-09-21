"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * 追蹤一條橫向 scroll-snap 軌道目前置中的是第幾個子元素，並提供捲到指定索引的方法。
 * 輪播與放大檢視共用。軌道元素需要 position: relative，子元素的 offsetLeft 才會以軌道為基準。
 */
export function useSnapIndex(trackRef: RefObject<HTMLElement | null>) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setIndex(nearestIndex(track));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [trackRef]);

  /**
   * 把第 i 個子元素捲到正中央。behavior 預設 "auto"，交給軌道 CSS 的 motion-safe:scroll-smooth 決定，
   * 會尊重「減少動態效果」；開啟放大檢視時用 "instant" 直接定位。
   */
  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = "auto") => {
      const track = trackRef.current;
      const slide = track?.children[i] as HTMLElement | undefined;
      if (!track || !slide) return;
      track.scrollTo({
        left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
        behavior,
      });
    },
    [trackRef],
  );

  return { index, scrollToIndex };
}

function nearestIndex(track: HTMLElement): number {
  const center = track.scrollLeft + track.clientWidth / 2;
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  Array.from(track.children).forEach((child, i) => {
    const slide = child as HTMLElement;
    const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
    if (distance < best) {
      best = distance;
      nearest = i;
    }
  });
  return nearest;
}
