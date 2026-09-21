import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import logo from "@/assets/logo.png";
import { loadNotoSansTC } from "@/lib/og-font";
import { siteName, siteNameAscii, siteTagline } from "@/lib/site";

/**
 * 全站共用的分享預覽圖（LINE / Facebook 貼上網址時顯示）。
 * 位於 app 根目錄，所有沒有自己 OG 圖的頁面（包含每位鴿友的頁面）都會用這一張。
 * 建置時靜態產生一次。
 */

export const alt = siteName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PADDING = 72;
/** logo 佔滿右側整個內容高度，寬度依原圖比例算出。 */
const LOGO_HEIGHT = size.height - PADDING * 2;
const LOGO_WIDTH = Math.round((logo.width / logo.height) * LOGO_HEIGHT);

export default async function OpenGraphImage() {
  // 字型子集只包含實際要畫的字；取不到時退回純英文，避免 Satori 缺字。
  const font = await loadNotoSansTC(`${siteName}${siteTagline}`, 700);
  const title = font ? siteName : siteNameAscii;
  const subtitle = font ? siteTagline : "Pigeon Fanciers Club";

  // Satori 不會讀本機檔案路徑，所以把 logo 讀進來轉成 data URI。
  const logoPng = await readFile(join(process.cwd(), "src/assets/logo.png"));
  const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          padding: PADDING,
          background:
            "linear-gradient(135deg, #2b3752 0%, #3b4a6b 60%, #4d5f85 100%)",
          color: "#f6f5f1",
          fontFamily: font ? '"Noto Sans TC"' : "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ fontSize: 40, marginTop: 20, color: "#e8b79c" }}>
            {subtitle}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori 只認原生 img */}
        <img
          src={logoSrc}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          alt=""
          style={{ marginLeft: 40 }}
        />
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans TC", data: font, weight: 700, style: "normal" }]
        : undefined,
    },
  );
}
