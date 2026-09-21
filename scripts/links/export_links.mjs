#!/usr/bin/env node
/**
 * 匯出全站連結清單，供日後驗證測試（掃名片 QR、curl、瀏覽器逐頁點擊）使用。
 *
 * 用法（建議用 npm script，會順便關掉 Node 的模組型別警告）：
 *   npm run links                              # 寫入 docs/links.txt 與 docs/links.json
 *   npm run links -- --base-url https://x.tw   # 改用其他網域（接上自訂網域後）
 *   npm run links:check                        # 匯出後逐一請求線上網址，比對 HTTP 狀態碼
 *
 * 連結來源：
 *   - 首頁、名錄、每位鴿友個人頁：直接匯入 src/data/members.ts（順序同名錄，slug 檢查也會一起跑）
 *   - sitemap.xml、robots.txt、opengraph-image、icon.png、apple-icon.png：Next.js metadata 檔案慣例產生的路由
 *   - 預設頭像：public/ 下的靜態檔
 *   - 一個不存在的 slug，應回 404（members/[slug] 設了 dynamicParams = false）
 *
 * 網域優先順序：--base-url → 環境變數 NEXT_PUBLIC_SITE_URL → DEFAULT_BASE_URL。
 *
 * 輸出：
 *   docs/links.txt   一行一個網址，只含應回 200 的連結，可直接餵給 xargs curl 或 QR 工具
 *   docs/links.json  含名稱、標籤、路徑、預期狀態碼的完整清單，name 與 scripts/qr/make_qr.py 的輸出檔名一致
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { members, PLACEHOLDER_AVATAR } from "../../src/data/members.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = resolve(REPO_ROOT, "docs");

/** 目前的 Vercel 部署網址。接上自訂網域後請改這裡，或以 --base-url / NEXT_PUBLIC_SITE_URL 覆蓋。 */
const DEFAULT_BASE_URL = "https://pigeon-hub-one.vercel.app";

const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string" },
    check: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help) {
  console.log(
    [
      "用法：node scripts/links/export_links.mjs [--base-url URL] [--check]",
      "  --base-url URL  網站根網址（預設：NEXT_PUBLIC_SITE_URL 或 " + DEFAULT_BASE_URL + "）",
      "  --check         匯出後逐一請求，比對 HTTP 狀態碼；有不符即以非 0 結束",
    ].join("\n"),
  );
  process.exit(0);
}

const baseUrl = normalizeBaseUrl(
  args["base-url"] ?? process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_BASE_URL,
);

const links = buildLinks(baseUrl);
const written = writeOutputs(baseUrl, links);

console.log(`網域：${baseUrl}`);
console.log(`連結：${links.length} 條（含 1 條 404 探測）`);
for (const file of written) console.log(`寫入 ${relative(REPO_ROOT, file)}`);

if (args.check) {
  const failed = await checkLinks(links);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------

function normalizeBaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`網站根網址格式不對：${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`網站根網址必須是 http(s)：${raw}`);
  }
  if (url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error(`網站根網址只能是網域本身，不可帶路徑或參數：${raw}`);
  }
  return url.origin;
}

/**
 * @returns {Array<{name: string, label: string, path: string, url: string, kind: string, expect: number}>}
 */
function buildLinks(base) {
  const link = (name, label, path, kind, expect = 200) => ({
    name,
    label,
    path,
    url: `${base}${path}`,
    kind,
    expect,
  });

  return [
    link("home", "首頁", "/", "page"),
    link("members", "鴿友名錄", "/members", "page"),
    ...members.map((m) =>
      link(`member-${m.slug}`, `${m.displayName}（${m.role}）`, `/members/${m.slug}`, "member"),
    ),
    link("sitemap", "sitemap.xml", "/sitemap.xml", "meta"),
    link("robots", "robots.txt", "/robots.txt", "meta"),
    link("og-image", "分享預覽圖", "/opengraph-image", "meta"),
    link("icon", "網站圖示", "/icon.png", "meta"),
    link("apple-icon", "iOS 主畫面圖示", "/apple-icon.png", "meta"),
    link("avatar-placeholder", "預設頭像", PLACEHOLDER_AVATAR, "asset"),
    link("not-found", "不存在的個人頁，應回 404", "/members/not-a-member", "probe", 404),
  ];
}

function writeOutputs(base, list) {
  mkdirSync(OUT_DIR, { recursive: true });

  const txtPath = resolve(OUT_DIR, "links.txt");
  const txt = list.filter((l) => l.expect === 200).map((l) => l.url).join("\n") + "\n";
  writeFileSync(txtPath, txt, "utf8");

  const jsonPath = resolve(OUT_DIR, "links.json");
  const json = {
    baseUrl: base,
    source: "scripts/links/export_links.mjs（讀 src/data/members.ts）",
    count: list.length,
    links: list,
  };
  writeFileSync(jsonPath, JSON.stringify(json, null, 2) + "\n", "utf8");

  return [txtPath, jsonPath];
}

async function checkLinks(list) {
  console.log("\n逐一請求中（不跟隨轉址，轉址會視為不符）…");
  let failed = 0;
  for (const l of list) {
    let status;
    try {
      const res = await fetch(l.url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      status = res.status;
      // 讀掉 body 以釋放連線
      await res.arrayBuffer().catch(() => {});
    } catch (err) {
      status = `ERR ${err?.cause?.code ?? err?.name ?? err}`;
    }
    const ok = status === l.expect;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(status).padEnd(4)} 預期 ${l.expect}  ${l.url}  ${l.label}`);
  }
  console.log(failed === 0 ? `\n全部 ${list.length} 條符合預期。` : `\n${failed} 條不符預期。`);
  return failed;
}
