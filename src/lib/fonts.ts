import { Noto_Sans_TC } from "next/font/google";

/**
 * Noto Sans TC 不是 variable font，weight 必填。
 * subsets 只列 latin：CJK 字形會依 unicode-range 自動載入，但不會產生上百個 preload 標籤。
 */
export const notoSansTC = Noto_Sans_TC({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-tc",
});
