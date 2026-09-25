/**
 * 鴿友資料。這是全站唯一的內容來源，新增或修改成員只要改這個檔案。
 *
 * 填寫方式：
 * 1. 每位鴿友一個物件，順序就是名錄的顯示順序。
 * 2. slug 是網址的一部分（/members/<slug>），會印在名片 QR code 上，定案後請勿更動。
 * 3. 資料填好後，把 isPlaceholder: true 那一行刪掉，頁面上的「資料待補」提示就會消失。
 * 4. 頭像與照片：頭像存成 data/avatars/<slug>.jpg，個人頁相簿的照片放進 data/photos/<slug>/，
 *    執行 npm run images 即可，這裡不用填路徑。詳見 README「頭像與照片」。
 */

export type Highlight = {
  /** 年份（選填），例如 2025。頁面會依年份由舊到新排序，沒有年份的排在最後。 */
  year?: number;
  /** 事蹟標題，例如「跨年夜被放鴿子」 */
  title: string;
  /** 補充說明（選填），例如「會長說在路上了，然後就沒有然後了。」 */
  description?: string;
};

/** 會長只有一位（放鴿子的人），其他都是會員（被放鴿子的人）。 */
export type MemberRole = "會長" | "會員";

export type Member = {
  /** 網址段：只能用小寫英數與連字號，且不可重複。 */
  slug: string;
  /** 顯示名稱（暱稱） */
  displayName: string;
  /** 本名（選填） */
  realName?: string;
  /** 身分：會長或會員 */
  role: MemberRole;
  /** 所在地（選填） */
  location?: string;
  /** 一句話簡介 */
  tagline: string;
  /** 自介段落（選填），用 \n 分段 */
  bio?: string;
  /**
   * 手動指定頭像路徑（選填），例如 "/avatars/TempPP.svg"，會優先於腳本產生的照片。
   * 一般不用填：照片放到 data/avatars/<slug>.jpg 跑 npm run images，網站會自動對應；
   * 沒照片也沒指定就顯示 PLACEHOLDER_AVATAR。
   */
  avatar?: string;
  /** 事蹟列表：被會長放鴿子的紀錄（會長本人則是放鴿子的紀錄） */
  highlights: Highlight[];
  /** true 表示內容尚未填寫，頁面會顯示「資料待補」提示 */
  isPlaceholder?: boolean;
};

export const PLACEHOLDER_AVATAR = "/avatars/TempPP.svg";

const PENDING_TAGLINE = "個人簡介待補";

export const members: readonly Member[] = [
  {
    slug: "minj",
    displayName: "MinJ",
    role: "會長",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "kk",
    displayName: "KK",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "pistachio",
    displayName: "Pistachio",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "peggy",
    displayName: "Peggy",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "eugene",
    displayName: "Eugene",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [
      { year: 2023, title: "曾參選 112 年度會長選舉" },
      { title: "差點在會長登記結婚當天被會長放鴿子" },
    ],
    isPlaceholder: true,
  },
  {
    slug: "caber",
    displayName: "Caber",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "kage",
    displayName: "Kage",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "hikari",
    displayName: "Hikari",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "ganyaya",
    displayName: "Ganyaya",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "ekai",
    displayName: "EKai",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "us",
    displayName: "US",
    role: "會員",
    tagline: PENDING_TAGLINE,
    highlights: [],
    isPlaceholder: true,
  },
  {
    slug: "fengsao",
    displayName: "FengSao",
    role: "會員",
    tagline: PENDING_TAGLINE,
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
