import manifest from "./images.json";
import { PLACEHOLDER_AVATAR, type Member } from "./members";

/** scripts/images/make_images.py 產生的一張圖。 */
export type ImageEntry = {
  /** 網站路徑，例如 /photos/kk/01-abc12345.jpg。檔名帶內容雜湊，照片更新網址就變，不會吃到舊快取。 */
  src: string;
  width: number;
  height: number;
  bytes: number;
  /** data/ 底下的來源檔名（該資料夾不進 git） */
  source: string;
  sourceSha256: string;
};

const avatars = manifest.avatars as Record<string, ImageEntry | undefined>;
const photos = manifest.photos as Record<string, ImageEntry[] | undefined>;

/**
 * 決定一位鴿友的頭像路徑。優先順序：
 * 1. members.ts 手動指定的 avatar（少數例外用，例如指定某張 SVG）
 * 2. 腳本從 data/avatars/<slug>.* 產生的照片
 * 3. 預設頭像
 */
export function getAvatarSrc(member: Pick<Member, "slug" | "avatar">): string {
  return member.avatar ?? avatars[member.slug]?.src ?? PLACEHOLDER_AVATAR;
}

/** 個人頁相簿的照片，順序同 data/photos/<slug>/ 的檔名排序；沒有照片回傳空陣列。 */
export function getPhotos(slug: string): ImageEntry[] {
  return photos[slug] ?? [];
}
