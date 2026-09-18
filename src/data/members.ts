/**
 * 鴿友資料。這是全站唯一的內容來源，新增或修改成員只要改這個檔案。
 *
 * 填寫方式：
 * 1. 每位鴿友一個物件，順序就是名錄的顯示順序。
 * 2. slug 是網址的一部分（/members/<slug>），會印在名片 QR code 上，定案後請勿更動。
 * 3. 資料填好後，把 isPlaceholder: true 那一行刪掉，頁面上的「資料待補」提示就會消失。
 * 4. 頭像放到 public/avatars/，再把 avatar 改成 "/avatars/<檔名>"。
 */

export type Highlight = {
  /** 年份，例如 2024。頁面會依年份由新到舊排序。 */
  year: number;
  /** 事蹟標題，例如「南海春季綜合冠軍」 */
  title: string;
  /** 補充說明（選填） */
  description?: string;
};

export type Member = {
  /** 網址段：只能用小寫英數與連字號，且不可重複。 */
  slug: string;
  /** 顯示名稱（暱稱） */
  displayName: string;
  /** 本名（選填） */
  realName?: string;
  /** 鴿舍名 */
  loftName: string;
  /** 所在縣市 */
  location: string;
  /** 一句話簡介 */
  tagline: string;
  /** 自介段落（選填），用 \n 分段 */
  bio?: string;
  /** 頭像路徑，放在 public/ 底下，例如 "/avatars/minj.jpg" */
  avatar: string;
  /** 事蹟列表 */
  highlights: Highlight[];
  /** true 表示內容尚未填寫，頁面會顯示「資料待補」提示 */
  isPlaceholder?: boolean;
};

export const PLACEHOLDER_AVATAR = "/avatars/_placeholder.svg";

const PENDING_LOFT = "鴿舍名待補";
const PENDING_LOCATION = "縣市待補";
const PENDING_TAGLINE = "個人簡介待補";

export const members: readonly Member[] = [
  {
    slug: "minj",
    displayName: "MinJ",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "kk",
    displayName: "KK",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "pistachio",
    displayName: "Pistachio",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "ek",
    displayName: "EK",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "peggy",
    displayName: "Peggy",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "eugene",
    displayName: "Eugene",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "caber",
    displayName: "Caber",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "hikari",
    displayName: "Hikari",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "kage",
    displayName: "Kage",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "ganyaya",
    displayName: "Ganyaya",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "us",
    displayName: "US",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "fengsao",
    displayName: "FengSao",
    loftName: PENDING_LOFT,
    location: PENDING_LOCATION,
    tagline: PENDING_TAGLINE,
    avatar: PLACEHOLDER_AVATAR,
    highlights: [],
    isPlaceholder: true,
  },
];

// 建置時檢查：slug 必須是小寫英數與連字號，且不可重複（否則名片網址會壞）。
{
  const SLUG_RE = /^[a-z0-9-]+$/;
  const seen = new Set<string>();
  for (const member of members) {
    if (!SLUG_RE.test(member.slug)) {
      throw new Error(
        `members.ts：slug「${member.slug}」只能使用小寫英數與連字號。`,
      );
    }
    if (seen.has(member.slug)) {
      throw new Error(`members.ts：slug「${member.slug}」重複。`);
    }
    seen.add(member.slug);
  }
}

export function getAllMembers(): Member[] {
  return [...members];
}

export function getMemberBySlug(slug: string): Member | undefined {
  return members.find((member) => member.slug === slug);
}

export function getAllSlugs(): string[] {
  return members.map((member) => member.slug);
}
