/** 全站共用的名稱、文案與網址設定。 */

import type { Metadata } from "next";

export const siteShortName = "PigeonHub";
export const siteName = "PigeonHub 鴿友會";
export const siteTagline = "以鴿會友，共享天空";
export const siteDescription =
  "PigeonHub 鴿友會官方網站。認識我們的鴿友、鴿舍，以及每個人的養鴿故事與事蹟。";

/**
 * 網站正式網址，用於 metadataBase、sitemap、robots。
 * 優先順序：NEXT_PUBLIC_SITE_URL（自訂網域）→ Vercel 正式網址 → 本機。
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/**
 * 全站共用的分享預覽圖，對應 src/app/opengraph-image.tsx 產生的路由。
 * 子頁面一旦自行定義 openGraph，Next.js 會整個覆蓋根層級的 openGraph（包含檔案慣例注入的 images），
 * 所以每個頁面都透過 buildOpenGraph() 明確帶上這張圖。
 */
export const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: siteName,
};

export function buildOpenGraph(input: {
  title: string;
  description: string;
  url: string;
  /** 個人頁設為 true，og:type 會是 profile */
  profile?: boolean;
}): OpenGraph {
  const base = {
    locale: "zh_TW",
    siteName,
    title: input.title,
    description: input.description,
    url: input.url,
    images: [ogImage],
  };
  return input.profile
    ? { ...base, type: "profile" }
    : { ...base, type: "website" };
}
