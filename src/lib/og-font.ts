/**
 * 供 OG 分享圖（next/og ImageResponse）使用的中文字型載入器。
 * Satori 沒有內建中文字形，這裡在建置時向 Google Fonts 只索取「實際會畫出來的字」的子集，
 * 檔案很小、也不用把字型檔放進 repo。
 *
 * 注意：text 必須包含所有要渲染的字元，否則缺字會觸發 Satori 的網路 fallback，可能讓建置失敗。
 * 取不到字型時回傳 null，呼叫端應改用純英文內容。
 */
export async function loadNotoSansTC(
  text: string,
  weight: 400 | 700 = 700,
): Promise<ArrayBuffer | null> {
  try {
    const uniqueChars = Array.from(new Set(text)).join("");
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${weight}` +
      `&text=${encodeURIComponent(uniqueChars)}`;

    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();

    const match = css.match(
      /src: url\((.+?)\) format\('(opentype|truetype)'\)/,
    );
    if (!match) return null;

    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
