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
  /** 個人簡介，每一項在頁面上獨立一行 */
  tagline: string[];
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

export const members: readonly Member[] = [
  {
    slug: "minj",
    displayName: "MinJ",
    role: "會長",
    tagline: ["鴿友會中心", "永遠在掉封包", "城市尋寶醬油仔"],
    highlights: [
      { year: 2015, title: "約吃早餐，到樓下叫人還裝睡不下來" },
      { year: 2016, title: "開始時常忘記鵝絲的存在" },
      { year: 2016, title: "創立《Min姊の研究生日常》粉絲專頁" },
      { year: 2022, title: "建立鴿友會總部" },
      { year: 2023, title: "企圖在自己的結婚登記日放見證人鴿子" },
      { year: 2023, title: "鴿友會會長選舉第一次出現競爭對手" },
    ],
  },
  {
    slug: "kk",
    displayName: "KK",
    role: "會員",
    tagline: ["Intel 第一把交椅"],
    highlights: [
      { year: 2020, title: "擄獲會長的心" },
      { year: 2021, title: "被迫加入鴿友會" },
      { year: 2023, title: "與會長結為連理" },
    ],
  },
  {
    slug: "pistachio",
    displayName: "開心果",
    role: "會員",
    tagline: ["把媽媽當跳板"],
    highlights: [{ year: 2025, title: "正式成為鴿友會本部吉祥物" }],
  },
  {
    slug: "peggy",
    displayName: "Peggy",
    role: "會員",
    tagline: [
      "傘蜥蜴始祖",
      "會長好麻吉",
      "帝寶一姐",
      "會長健身好夥伴",
      "待在台灣比待在國外的時間還少",
    ],
    highlights: [{ year: 2024, title: "把巨城當魁地奇場地" }],
  },
  {
    slug: "eugene",
    displayName: "Eugene",
    role: "會員",
    tagline: ["少女心", "即將深根澳洲"],
    highlights: [
      { year: 2022, title: "差點在會長登記結婚當天被會長放鴿子" },
      { year: 2022, title: "建立鴿友會中和分會" },
      { year: 2023, title: "參選 112 年度鴿友會會長" },
      { year: 2024, title: "鴿友會澎湖分會場勘" },
    ],
  },
  {
    slug: "caber",
    displayName: "Caber",
    role: "會員",
    tagline: ["基因定序專家", "即將深根澳洲"],
    highlights: [{ year: 2024, title: "被迫加入鴿友會" }],
  },
  {
    slug: "kage",
    displayName: "Kage",
    role: "會員",
    tagline: ["貓善被貓欺", "領巾永遠少一半"],
    highlights: [{ year: 2024, title: "獲聘為鴿友會中和分會吉祥物" }],
  },
  {
    slug: "hikari",
    displayName: "Hikari",
    role: "會員",
    tagline: ["打架不會輸"],
    highlights: [{ year: 2025, title: "晉升為鴿友會中和分會吉祥物" }],
  },
  {
    slug: "ganyaya",
    displayName: "乾爺爺",
    role: "會員",
    tagline: [
      "假日加班組",
      "永遠40歲",
      "總是神秘嘉賓，會不會來純憑運氣",
      "身價跟股價一樣一直翻倍的男人",
    ],
    highlights: [
      { year: 2021, title: "建立竹北分會" },
      { year: 2024, title: "把巨城當魁地奇場地" },
      { year: 2025, title: "解散竹北分會" },
    ],
  },
  {
    slug: "ekai",
    displayName: "EKai",
    role: "會員",
    tagline: ["假日加班組", "這是什麼顏色", "拉窗簾需要騎腳踏車"],
    highlights: [
      { year: 2017, title: "從此跟銀絲捲脫離不了關係" },
      { year: 2024, title: "參訪鴿友會苗栗分會" },
    ],
  },
  {
    slug: "us",
    displayName: "鵝絲",
    role: "會員",
    tagline: ["綠手指", "每個月都是壽星", "準備開中醫館", "鵝絲你在喔"],
    highlights: [
      { year: 2016, title: "開始被會長忘記" },
      { year: 2023, title: "登上計程車車身廣告" },
    ],
  },
  {
    slug: "fengsao",
    displayName: "峰嫂",
    role: "會員",
    tagline: ["多肉栽培家"],
    highlights: [{ year: 2016, title: "剪輯鵝絲影片，照片放錯人" }],
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
