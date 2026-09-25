#!/usr/bin/env node
/**
 * 頭像與照片的一致性檢查。`npm run build` 前自動執行（package.json 的 prebuild），本機與 Vercel 都會跑，
 * 也可以手動 `npm run images:check`。不需要 Python 或任何套件，只讀檔比對：
 *
 *   1. members.ts 的 PLACEHOLDER_AVATAR 檔案存在。
 *   2. src/data/images.json 的每一筆（頭像與照片）：slug 存在於 members.ts、輸出檔存在、檔名雜湊與內容相符、
 *      大小與清單一致、不超過上限；頭像另須為正方形。
 *   3. members.ts 手動指定的 avatar 路徑：檔案存在且不超過上限。直接把幾 MB 原圖丟進 public 會在這裡被擋下。
 *   4. 本機有 data/avatars/ 或 data/photos/ 時：每張來源都有清單項且雜湊一致（沒重跑腳本會被抓到）、
 *      清單裡的來源都還在。Vercel 上沒有這些資料夾（不進 git），略過。
 *   5. public/avatars/、public/photos/ 有沒被引用的檔案 → 警告，不擋 build。
 *
 * 有錯誤即以非 0 結束並提示要執行的指令。
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = resolve(REPO_ROOT, "src/data/images.json");
const MEMBERS_TS = resolve(REPO_ROOT, "src/data/members.ts");
const PUBLIC_DIR = resolve(REPO_ROOT, "public");
const AVATAR_SOURCE_DIR = resolve(REPO_ROOT, "data/avatars");
const PHOTO_SOURCE_DIR = resolve(REPO_ROOT, "data/photos");
const AVATAR_OUTPUT_DIR = resolve(PUBLIC_DIR, "avatars");
const PHOTO_OUTPUT_DIR = resolve(PUBLIC_DIR, "photos");

/** 大小上限。腳本輸出的 512px 頭像通常 30–120 KB，長邊 2400px 內的照片通常 300 KB–1 MB。 */
const AVATAR_MAX_BYTES = 300 * 1024;
const PHOTO_MAX_BYTES = 1536 * 1024;
const RUN_HINT =
  "請執行 uv run scripts/images/make_images.py（或 npm run images），再把 public/avatars/、public/photos/ 與 src/data/images.json 一起 commit。";

const errors = [];
const warnings = [];
const referenced = new Set(); // public/ 相對路徑，例如 avatars/kk-xxxx.jpg

const membersTs = readFileSync(MEMBERS_TS, "utf8");
const slugs = [...membersTs.matchAll(/^\s*slug:\s*"([a-z0-9-]+)"\s*,?\s*$/gm)].map((m) => m[1]);
const overrides = [...membersTs.matchAll(/^\s*avatar:\s*"([^"]+)"\s*,?\s*$/gm)].map((m) => m[1]);
const placeholder = /PLACEHOLDER_AVATAR\s*=\s*"([^"]+)"/.exec(membersTs)?.[1];

// 1. 預設頭像
if (!placeholder) {
  errors.push("members.ts 讀不到 PLACEHOLDER_AVATAR 的字串值");
} else {
  referenced.add(toPublicRel(placeholder));
  if (!existsSync(publicPath(placeholder))) {
    errors.push(`PLACEHOLDER_AVATAR 指向 ${placeholder}，但 public/ 底下沒有這個檔案`);
  }
}

// 2. 清單 ↔ 輸出檔
let manifest = { avatars: {}, photos: {} };
if (existsSync(MANIFEST)) {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} else {
  errors.push(`找不到 ${rel(MANIFEST)}。${RUN_HINT}`);
}
const avatars = manifest.avatars ?? {};
const photos = manifest.photos ?? {};

for (const [slug, entry] of Object.entries(avatars)) {
  if (!slugs.includes(slug)) {
    warnings.push(`images.json 的頭像「${slug}」不是 members.ts 裡的 slug；刪掉 data/avatars/${entry.source} 後重跑腳本即可清掉`);
  }
  checkOutput(`頭像 ${slug}`, entry, AVATAR_MAX_BYTES, { square: true });
}
for (const [slug, list] of Object.entries(photos)) {
  if (!slugs.includes(slug)) {
    warnings.push(`images.json 的照片「${slug}」不是 members.ts 裡的 slug；刪掉 data/photos/${slug}/ 後重跑腳本即可清掉`);
  }
  list.forEach((entry, i) => checkOutput(`照片 ${slug} 第 ${i + 1} 張（${entry.source}）`, entry, PHOTO_MAX_BYTES, {}));
}

// 3. members.ts 手動指定的頭像
for (const src of overrides) {
  if (!src.startsWith("/")) {
    warnings.push(`members.ts 的 avatar "${src}" 不是站內路徑，略過檢查`);
    continue;
  }
  referenced.add(toPublicRel(src));
  const file = publicPath(src);
  if (!existsSync(file)) {
    errors.push(`members.ts 指定的 avatar ${src} 在 public/ 底下不存在`);
    continue;
  }
  const bytes = statSync(file).size;
  if (bytes > AVATAR_MAX_BYTES) {
    errors.push(
      `members.ts 指定的 avatar ${src} 有 ${kb(bytes)}，超過上限 ${kb(AVATAR_MAX_BYTES)}。請把原圖放到 data/avatars/<slug>.<副檔名>、拿掉這行 avatar，改用腳本產生`,
    );
  }
}

// 4. 本機來源 ↔ 清單
if (existsSync(AVATAR_SOURCE_DIR)) {
  for (const name of listFiles(AVATAR_SOURCE_DIR)) {
    const slug = name.replace(/\.[^.]+$/, "");
    if (!slugs.includes(slug)) {
      errors.push(`data/avatars/${name}：檔名「${slug}」不是 members.ts 裡的 slug（大小寫要一致）`);
    } else if (!avatars[slug]) {
      errors.push(`data/avatars/${name} 還沒轉檔。${RUN_HINT}`);
    } else if (sha256(readFileSync(resolve(AVATAR_SOURCE_DIR, name))) !== avatars[slug].sourceSha256) {
      errors.push(`data/avatars/${name} 已更新，但 public/avatars 還是舊圖。${RUN_HINT}`);
    }
  }
  for (const [slug, entry] of Object.entries(avatars)) {
    if (!existsSync(resolve(AVATAR_SOURCE_DIR, entry.source))) {
      errors.push(`頭像 ${slug}：來源 data/avatars/${entry.source} 已不存在。重跑腳本會把這筆與輸出檔一起清掉`);
    }
  }
}
if (existsSync(PHOTO_SOURCE_DIR)) {
  for (const dirent of readdirSync(PHOTO_SOURCE_DIR, { withFileTypes: true })) {
    if (dirent.name.startsWith(".")) continue;
    if (!dirent.isDirectory()) {
      errors.push(`data/photos/${dirent.name}：照片要放在 data/photos/<slug>/ 資料夾裡`);
      continue;
    }
    const slug = dirent.name;
    if (!slugs.includes(slug)) {
      errors.push(`data/photos/${slug}/：資料夾名不是 members.ts 裡的 slug（大小寫要一致）`);
      continue;
    }
    const entries = photos[slug] ?? [];
    const bySource = new Map(entries.map((e) => [e.source, e]));
    const sourceNames = listFiles(resolve(PHOTO_SOURCE_DIR, slug));
    for (const name of sourceNames) {
      const entry = bySource.get(name);
      if (!entry) {
        errors.push(`data/photos/${slug}/${name} 還沒轉檔。${RUN_HINT}`);
      } else if (sha256(readFileSync(resolve(PHOTO_SOURCE_DIR, slug, name))) !== entry.sourceSha256) {
        errors.push(`data/photos/${slug}/${name} 已更新，但 public/photos 還是舊圖。${RUN_HINT}`);
      }
    }
    for (const entry of entries) {
      if (!sourceNames.includes(entry.source)) {
        errors.push(`照片 ${slug}：來源 data/photos/${slug}/${entry.source} 已不存在。重跑腳本會把這筆與輸出檔一起清掉`);
      }
    }
  }
  for (const slug of Object.keys(photos)) {
    if (!existsSync(resolve(PHOTO_SOURCE_DIR, slug))) {
      errors.push(`照片 ${slug}：來源資料夾 data/photos/${slug}/ 已不存在。重跑腳本會把輸出一起清掉`);
    }
  }
}

// 5. 沒人引用的檔案
for (const name of listFiles(AVATAR_OUTPUT_DIR)) {
  warnIfOrphan(`avatars/${name}`);
}
if (existsSync(PHOTO_OUTPUT_DIR)) {
  for (const dirent of readdirSync(PHOTO_OUTPUT_DIR, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      for (const name of listFiles(resolve(PHOTO_OUTPUT_DIR, dirent.name))) warnIfOrphan(`photos/${dirent.name}/${name}`);
    } else {
      warnIfOrphan(`photos/${dirent.name}`);
    }
  }
}

for (const w of warnings) console.warn(`[警告] ${w}`);
for (const e of errors) console.error(`[錯誤] ${e}`);
if (errors.length > 0) {
  console.error(`\n圖片檢查失敗：${errors.length} 個錯誤。`);
  process.exit(1);
}
const photoCount = Object.values(photos).reduce((n, list) => n + list.length, 0);
console.log(
  `圖片檢查通過：頭像 ${Object.keys(avatars).length} 張（另 ${overrides.length} 個手動指定）、照片 ${photoCount} 張` +
    (warnings.length ? `、${warnings.length} 個警告` : "") +
    "。",
);

// ---------------------------------------------------------------------------

/** 檢查一筆清單項的輸出檔：存在、大小一致、檔名雜湊等於內容雜湊、不超過上限、（頭像）正方形。 */
function checkOutput(label, entry, maxBytes, { square }) {
  referenced.add(toPublicRel(entry.src));
  const file = publicPath(entry.src);
  if (!existsSync(file)) {
    errors.push(`${label}：清單指向 ${entry.src}，但檔案不存在。${RUN_HINT}`);
    return;
  }
  const bytes = statSync(file).size;
  if (bytes !== entry.bytes) {
    errors.push(`${label}：${entry.src} 大小 ${bytes} B 與清單 ${entry.bytes} B 不符，檔案可能被改過。${RUN_HINT}`);
  }
  const hashInName = /-([0-9a-f]{8})\.jpg$/.exec(entry.src)?.[1];
  const actualHash = sha256(readFileSync(file)).slice(0, 8);
  if (hashInName !== actualHash) {
    errors.push(`${label}：${entry.src} 檔名雜湊 ${hashInName} 與內容 ${actualHash} 不符。${RUN_HINT}`);
  }
  if (square && entry.width !== entry.height) {
    errors.push(`${label}：${entry.src} 不是正方形（${entry.width}×${entry.height}）。${RUN_HINT}`);
  }
  if (!(entry.width > 0 && entry.height > 0)) {
    errors.push(`${label}：清單缺少尺寸。${RUN_HINT}`);
  }
  if (bytes > maxBytes) {
    errors.push(`${label}：${entry.src} ${kb(bytes)} 超過上限 ${kb(maxBytes)}。請用較小的尺寸參數重跑腳本`);
  }
}

function warnIfOrphan(publicRel) {
  if (referenced.has(publicRel)) return;
  const bytes = statSync(resolve(PUBLIC_DIR, publicRel)).size;
  const limit = publicRel.startsWith("photos/") ? PHOTO_MAX_BYTES : AVATAR_MAX_BYTES;
  if (bytes > limit) {
    // 幾 MB 的檔案通常是原始照片被直接丟進 public/。這種檔案不會顯示在網站上，也不該進 git。
    const target = publicRel.startsWith("photos/") ? "data/photos/<slug>/" : "data/avatars/<slug>.<副檔名>";
    errors.push(
      `public/${publicRel}（${kb(bytes)}）沒有被引用且超過上限，看起來是原始照片放錯位置。原圖請放到 ${target}，再執行 npm run images 由腳本產生 public/ 底下的檔案`,
    );
    return;
  }
  warnings.push(`public/${publicRel}（${kb(bytes)}）沒有被清單或 members.ts 引用，可以刪掉`);
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith("."))
    .map((d) => d.name);
}

function rel(path) {
  return path.slice(REPO_ROOT.length + 1).replaceAll("\\", "/");
}

function toPublicRel(src) {
  return src.replace(/^\/+/, "");
}

function publicPath(src) {
  return resolve(PUBLIC_DIR, toPublicRel(src));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function kb(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
