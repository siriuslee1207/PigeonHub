#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = [
#   "qrcode==8.2",
#   "pillow==12.3.0",
#   "zxing-cpp==3.1.1",
# ]
# ///
"""名片 QR code 產生器。

把網址編成「靜態」QR code：QR 的內容就是網址本身，不經任何短網址或動態 QR 服務。
只要網域持續持有、slug 不改，印出去的 QR 就永久有效。

用法（在 repo 根目錄執行）：
    uv run scripts/qr/make_qr.py https://你的網域/members/minj --verify
    uv run scripts/qr/make_qr.py --members --base-url https://你的網域 --svg --verify
    uv run scripts/qr/make_qr.py https://你的網域/members/pistachio --sweep

輸出到 out/qr/（已被 .gitignore 忽略），並寫 out/qr/manifest.json 記錄每張 QR 編了什麼。

沒有 uv 時（需 Python 3.10–3.13）：
    pip install qrcode==8.2 pillow==12.3.0 zxing-cpp==3.1.1
    python scripts/qr/make_qr.py ...

設計重點：
- 有 logo 時容錯等級固定 H（可修復約 30% 碼字），logo 方框邊長預設為 QR 模組數的 0.22，實務上限約 0.30。
- logo 方框強制為奇數模組並對齊中心模組，邊緣不會切在半個模組上。
- --sweep 用 zxing-cpp 實際解碼，找出這顆 logo 能放多大；--verify 額外用縮小、模糊模擬手機拍攝。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.metadata
import io
import json
import math
import random
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

# Windows 主控台預設 cp950，中文輸出被重導時會炸掉，統一改 UTF-8。
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

try:
    import qrcode
    import qrcode.base
    import qrcode.constants
    import qrcode.exceptions
    import qrcode.util
    from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageOps, ImageStat
except ImportError as exc:  # pragma: no cover - 環境問題，給出可直接複製的解法
    sys.exit(
        f"缺少套件：{exc.name}\n"
        "請用 uv 執行（會自動建立隔離環境）：\n"
        "    uv run scripts/qr/make_qr.py ...\n"
        "或手動安裝（Python 3.10–3.13）：\n"
        "    pip install qrcode==8.2 pillow==12.3.0 zxing-cpp==3.1.1"
    )

REPO_ROOT = Path(__file__).resolve().parents[2]
MEMBERS_TS = REPO_ROOT / "src" / "data" / "members.ts"
LOGO_DIR = REPO_ROOT / "data" / "logo"
DEFAULT_OUT = REPO_ROOT / "out" / "qr"

BORDER = 4  # 標準留白（quiet zone）：四邊各 4 模組
DEFAULT_SWEEP = "0.15:0.40:0.05"
EC_MAP = {
    "L": qrcode.constants.ERROR_CORRECT_L,
    "M": qrcode.constants.ERROR_CORRECT_M,
    "Q": qrcode.constants.ERROR_CORRECT_Q,
    "H": qrcode.constants.ERROR_CORRECT_H,
}
EC_NAME = {v: k for k, v in EC_MAP.items()}

# 只吃 members.ts 裡 `slug: "xxx",` 這種字串字面值，不會吃到型別宣告 `slug: string;` 或函式參數。
SLUG_RE = re.compile(r'^\s*slug:\s*"([a-z0-9-]+)"\s*,?\s*$', re.M)

# logo alpha 清理參數：去背毛邊多在最外 1–2 px，斑點多小於 5 px。
ALPHA_THRESHOLD = 48
ALPHA_SPECK_PX = 5
ALPHA_ERODE_PX = 1
SUPERSAMPLE = 4  # 底牌與 logo 先在 4 倍畫布合成，最後只縮小一次
SVG_LOGO_MAX_SIDE = 400  # SVG 內嵌 logo 的長邊上限（px）；印在 5 mm 內已超過 2000 dpi

# --sweep 的破壞測試：在 logo 與功能圖案以外隨機翻轉 3×3 模組的髒污塊，每級加 1%，最多 40%，每級試 4 次
DAMAGE_STEP_PCT = 1.0
DAMAGE_MAX_PCT = 40.0
DAMAGE_TRIALS = 4
DAMAGE_BLOCK = 3
DAMAGE_TEST_SIDE = 300
# 實務上限：數位解碼比手機鏡頭加印刷寬鬆得多，建議值不超過這兩個 ratio
PRACTICAL_MAX_RATIO = 0.30
PRACTICAL_SAFE_RATIO = 0.25

# --verify 的模擬條件：(名稱, 縮到幾 px 邊長, 高斯模糊半徑)
VERIFY_CONDITIONS: tuple[tuple[str, int | None, float], ...] = (
    ("full", None, 0.0),
    ("down300", 300, 0.0),
    ("down200", 200, 0.0),
    ("down200_blur1", 200, 1.0),
)

EPILOG = """\
範例：
  uv run scripts/qr/make_qr.py https://pigeonhub.tw/members/minj --verify
  uv run scripts/qr/make_qr.py --members --base-url https://pigeonhub.tw --svg --verify
  uv run scripts/qr/make_qr.py https://pigeonhub.tw/members/pistachio --sweep

輸出：out/qr/<name>.png（加 --svg 則多一個 .svg）、out/qr/manifest.json、out/qr/sweep/（--sweep 時）
列印：每模組 >= 0.5 mm。v5（37 模組）含留白 >= 22.5 mm；v6（41 模組）>= 24.5 mm。
"""


# ---------------------------------------------------------------------------
# 資料結構
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Target:
    name: str  # 輸出檔名（不含副檔名）
    payload: str  # QR 內容，就是網址本身


@dataclass(frozen=True)
class Geometry:
    version: int
    modules: int  # N：不含留白的模組數
    box: int  # 每模組像素
    side_px: int  # PNG 邊長 = (N + 8) * box
    badge_modules: int  # logo 方框邊長（模組），0 = 沒有 logo
    badge_px: int
    badge_xy: tuple[int, int]  # 方框左上角像素座標
    inner_modules: int  # logo 圖案可用的邊長（模組）
    coverage_pct: float  # 方框佔 QR 面積百分比
    est_codewords_hit: int  # 估計被蓋到的碼字數
    total_codewords: int
    correctable_codewords: int

    @property
    def ec_budget_pct(self) -> float:
        if not self.correctable_codewords:
            return 0.0
        return 100.0 * self.est_codewords_hit / self.correctable_codewords

    @property
    def effective_ratio(self) -> float:
        return self.badge_modules / self.modules


@dataclass
class Decoder:
    name: str
    decode: Callable[[Image.Image], list[tuple[str, str]]]  # 回傳 [(文字, 容錯等級)]


# ---------------------------------------------------------------------------
# 參數與目標
# ---------------------------------------------------------------------------


def norm_color(value: str) -> str:
    """把使用者給的顏色正規化成 #rrggbb，順便驗證。"""
    try:
        r, g, b = ImageColor.getrgb(value)[:3]
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"看不懂的顏色：{value}") from exc
    return f"#{r:02x}{g:02x}{b:02x}"


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="make_qr.py",
        description="把網址編成靜態 QR code（PNG，選配 SVG），可在中央放 logo。",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("urls", nargs="*", metavar="URL", help="要編碼的網址，可多個；與 --members 互斥")
    p.add_argument("--members", action="store_true", help="讀 src/data/members.ts，產生首頁、名錄與所有鴿友個人頁")
    p.add_argument("--base-url", metavar="URL", help="--members 用的網站根網址，例如 https://pigeonhub.tw")

    logo = p.add_mutually_exclusive_group()
    logo.add_argument("--logo", type=Path, metavar="PNG", help="中央 logo（PNG）。預設：data/logo/ 下唯一的 PNG")
    logo.add_argument("--no-logo", action="store_true", help="不放 logo")
    p.add_argument("--logo-ratio", type=float, default=0.22, metavar="R",
                   help="logo 方框邊長 ÷ QR 模組數（不含留白）。預設 0.22，實務上限約 0.30")
    p.add_argument("--badge", choices=["none", "rounded", "square", "circle"], default="none",
                   help="logo 底牌形狀。none = 透明直貼（預設）；掃描不穩時改 rounded")
    p.add_argument("--badge-margin", type=int, default=1, metavar="M", help="有底牌時 logo 四周留幾模組，預設 1")

    p.add_argument("--out", type=Path, default=DEFAULT_OUT, metavar="DIR", help="輸出目錄，預設 out/qr")
    p.add_argument("--name", metavar="STEM", help="輸出檔名（不含副檔名），只能搭配單一網址")
    p.add_argument("--size", type=int, default=1024, metavar="PX", help="PNG 目標邊長，實際值會調成模組整數倍。預設 1024")
    p.add_argument("--svg", action="store_true", help="同時輸出 SVG（向量，給印刷）")
    p.add_argument("--module-mm", type=float, default=0.5, metavar="MM",
                   help="列印時每模組幾 mm，決定 PNG DPI 與 SVG 實際尺寸。預設 0.5")
    p.add_argument("--fg", type=norm_color, default="#000000", help="深色模組顏色，預設純黑")
    p.add_argument("--bg", type=norm_color, default="#ffffff", help="底色，預設白")
    p.add_argument("--fg-texture", type=Path, metavar="IMG",
                   help="用材質圖填滿模組（取代 --fg 的顏色），例如 data/material/gold.png")
    p.add_argument("--texture-range", type=parse_range, metavar="LO:HI",
                   help="材質亮度重新對應到 0–1 的區間。預設：模組比底色亮時 0.4:1，比底色暗時 0:0.45")
    p.add_argument("--ec", choices=list(EC_MAP), default="H", help="容錯等級，預設 H；有 logo 時只能是 H")
    p.add_argument("--version", type=int, choices=range(1, 41), metavar="N",
                   help="固定 QR 版本 1–40（批次時預設自動取最大需求，讓所有 QR 同尺寸）")

    p.add_argument("--allow-http", action="store_true", help="放行 http://（預設只接受 https://）")
    p.add_argument("--allow-localhost", action="store_true", help="放行 localhost / 127.0.0.1（測試用）")
    p.add_argument("--verify", action="store_true", help="用 zxing-cpp 實際解碼，含縮小與模糊模擬")
    p.add_argument("--sweep", nargs="?", const=DEFAULT_SWEEP, metavar="START:STOP:STEP",
                   help=f"掃描不同 logo 大小並實測解碼，寫報告到 out/qr/sweep/。預設 {DEFAULT_SWEEP}")
    p.add_argument("--debug-badge", action="store_true", help="輸出清理後的 logo 與底牌預覽，方便肉眼檢查")

    args = p.parse_args(argv)

    if args.members == bool(args.urls):
        p.error("請給網址，或改用 --members --base-url（兩者擇一）")
    if args.members and not args.base_url:
        p.error("--members 需要 --base-url")
    if args.name and (args.members or len(args.urls) != 1):
        p.error("--name 只能搭配單一網址")
    if args.sweep and (args.members or len(args.urls) != 1):
        p.error("--sweep 只接受單一網址")
    if not args.no_logo and args.ec != "H":
        p.error("有 logo 時容錯等級只能是 H；要用其他等級請加 --no-logo")
    if not 0.05 <= args.logo_ratio <= 0.5:
        p.error("--logo-ratio 請在 0.05–0.5 之間")
    if args.badge_margin < 0:
        p.error("--badge-margin 不能是負數")
    if args.module_mm <= 0:
        p.error("--module-mm 必須大於 0")
    if args.size < 100:
        p.error("--size 太小")
    if args.fg_texture and not args.fg_texture.exists():
        p.error(f"找不到材質圖：{args.fg_texture}")
    if args.texture_range and not args.fg_texture:
        p.error("--texture-range 需搭配 --fg-texture")
    return args


def parse_range(spec: str) -> tuple[float, float]:
    try:
        lo, hi = (float(x) for x in spec.split(":"))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("格式應為 LO:HI，例如 0.55:1") from exc
    if not 0 <= lo < hi <= 1:
        raise argparse.ArgumentTypeError("LO:HI 需在 0–1 之間且 LO < HI")
    return lo, hi


def check_url(raw: str, *, allow_http: bool, allow_localhost: bool) -> tuple[str, list[str]]:
    """驗證並正規化網址。回傳 (網址, 警告列表)；不合格直接 raise ValueError。

    這是「永久支援」的守門員：只接受可以長期持有的 https 網址，拒絕本機與明顯的暫時網址。
    """
    url = raw.strip()
    if not url:
        raise ValueError("網址是空的")
    if any(ch.isspace() or ord(ch) < 32 for ch in url):
        raise ValueError(f"網址含空白或控制字元：{raw!r}")
    if not url.isascii():
        raise ValueError(f"網址含非 ASCII 字元，請改用 punycode / 百分比編碼：{raw}")

    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise ValueError(f"只接受 http(s) 網址：{raw}")
    if scheme == "http" and not allow_http:
        raise ValueError(f"只接受 https://（要用 http 請加 --allow-http）：{raw}")
    if parts.username or parts.password:
        raise ValueError(f"網址不可含帳號密碼：{raw}")

    host = (parts.hostname or "").lower()
    if not host:
        raise ValueError(f"網址沒有主機名：{raw}")
    is_local = host in {"localhost", "127.0.0.1", "::1"} or host.endswith((".local", ".localhost"))
    if is_local and not allow_localhost:
        raise ValueError(f"本機網址印在名片上會失效（測試請加 --allow-localhost）：{raw}")
    if not is_local and "." not in host:
        raise ValueError(f"主機名不像正式網域：{raw}")

    netloc = f"[{host}]" if ":" in host else host
    if parts.port:
        netloc += f":{parts.port}"

    path = re.sub(r"/{2,}", "/", parts.path) or "/"
    if len(path) > 1:
        path = path.rstrip("/")

    warnings: list[str] = []
    if scheme == "http":
        warnings.append("使用 http://，瀏覽器會顯示不安全，且日後改 https 需要轉址")
    if parts.query:
        warnings.append("含 ?query 參數，追蹤參數日後可能失效")
    if parts.fragment:
        warnings.append("含 #fragment")
    if host.endswith(".vercel.app"):
        warnings.append("*.vercel.app 是 Vercel 預設網址，可能會變。README：網域確定後再產生名片 QR code")

    return urlunsplit((scheme, netloc, path, parts.query, parts.fragment)), warnings


def read_member_slugs(path: Path = MEMBERS_TS) -> list[str]:
    if not path.exists():
        raise SystemExit(f"找不到 {path}")
    slugs = SLUG_RE.findall(path.read_text(encoding="utf-8"))
    if not slugs:
        raise SystemExit(f"{path} 裡讀不到任何 slug")
    dupes = sorted({s for s in slugs if slugs.count(s) > 1})
    if dupes:
        raise SystemExit(f"members.ts 有重複的 slug：{', '.join(dupes)}")
    return slugs


def name_from_url(url: str) -> str:
    parts = urlsplit(url)
    stem = re.sub(r"[^a-z0-9]+", "-", f"{parts.netloc}{parts.path}".lower()).strip("-")
    return stem or "qr"


def collect_targets(args: argparse.Namespace) -> list[Target]:
    targets: list[Target] = []
    try:
        if args.members:
            base, warns = check_url(args.base_url, allow_http=args.allow_http, allow_localhost=args.allow_localhost)
            print_warnings(base, warns)
            base = base.rstrip("/")
            targets.append(Target("home", f"{base}/"))
            targets.append(Target("members", f"{base}/members"))
            for slug in read_member_slugs():
                targets.append(Target(f"member-{slug}", f"{base}/members/{slug}"))
        else:
            for raw in args.urls:
                url, warns = check_url(raw, allow_http=args.allow_http, allow_localhost=args.allow_localhost)
                print_warnings(url, warns)
                targets.append(Target(args.name or name_from_url(url), url))
    except ValueError as exc:
        raise SystemExit(f"網址不合格：{exc}") from exc

    names = [t.name for t in targets]
    if len(set(names)) != len(names):
        raise SystemExit("輸出檔名重複，請用 --name 或分開產生")
    return targets


def print_warnings(url: str, warnings: list[str]) -> None:
    for w in warnings:
        print(f"[警告] {url}\n       {w}")


# ---------------------------------------------------------------------------
# QR 結構與幾何
# ---------------------------------------------------------------------------


def best_version(payload: str, ec: int) -> int:
    qr = qrcode.QRCode(error_correction=ec)
    qr.add_data(payload)
    try:
        return qr.best_fit()
    except qrcode.exceptions.DataOverflowError as exc:
        raise SystemExit(f"網址太長，QR 放不下：{payload}") from exc


def byte_capacity(version: int, ec: int) -> int:
    """該版本在 byte 模式下最多能放幾個位元組（扣掉模式指示與長度欄位）。"""
    bits = qrcode.util.BIT_LIMIT_TABLE[ec][version]
    count_bits = 8 if version <= 9 else 16
    return (bits - 4 - count_bits) // 8


def ec_budget(version: int, ec: int) -> tuple[int, int]:
    """回傳 (總碼字數, 可修復碼字數)。每個 RS block 可修復 (total - data) // 2 個碼字。"""
    blocks = qrcode.base.rs_blocks(version, ec)
    total = sum(b.total_count for b in blocks)
    correctable = sum((b.total_count - b.data_count) // 2 for b in blocks)
    return total, correctable


def has_center_alignment_pattern(version: int) -> bool:
    """版本 7–13、21–27、35–40 的正中央有對位圖案：每軸對位座標數為奇數時中間那個就在中心。"""
    if version < 2:
        return False
    return (version // 7 + 2) % 2 == 1


def nearest_odd(x: float) -> int:
    r = round(x)
    if r % 2 == 1:
        return r
    lo, hi = r - 1, r + 1
    return lo if (x - lo) <= (hi - x) else hi


def badge_modules_for(ratio: float, modules: int) -> int:
    """ratio → 方框模組數：強制奇數（對齊中心模組），並避開定時圖案（第 6 列/行與倒數第 7 列/行）。"""
    m = nearest_odd(ratio * modules)
    return max(3, min(m, modules - 16))


def compute_geometry(version: int, *, size_px: int, badge_modules: int, badge_shape: str,
                     badge_margin: int, ec: int) -> Geometry:
    n = 4 * version + 17
    box = max(4, round(size_px / (n + 2 * BORDER)))
    side = (n + 2 * BORDER) * box
    total, correctable = ec_budget(version, ec)

    m = badge_modules
    if m <= 0:
        return Geometry(version, n, box, side, 0, 0, (0, 0), 0, 0.0, 0, total, correctable)

    badge_px = m * box
    offset = (BORDER + (n - 1) // 2 - (m - 1) // 2) * box
    inner = m if badge_shape == "none" else max(1, m - 2 * badge_margin)
    coverage = 100.0 * m * m / (n * n)
    # 資料區的碼字大致是 2 寬 × 4 高的方塊，方框對不齊碼字邊界時會多蓋到一圈。
    est_hit = math.ceil((m + 1) / 2) * math.ceil((m + 3) / 4)
    return Geometry(version, n, box, side, m, badge_px, (offset, offset), inner, coverage, est_hit, total, correctable)


def build_qr(payload: str, *, version: int, ec: int, box: int) -> qrcode.QRCode:
    qr = qrcode.QRCode(version=version, error_correction=ec, box_size=box, border=BORDER)
    qr.add_data(payload)
    try:
        qr.make(fit=False)
    except qrcode.exceptions.DataOverflowError as exc:
        need = best_version(payload, ec)
        raise SystemExit(f"--version {version} 太小，{payload} 至少需要 v{need}") from exc
    return qr


def render_png(qr: qrcode.QRCode, *, fg: str, bg: str, texture: Image.Image | None = None) -> Image.Image:
    if texture is None:
        return qr.make_image(fill_color=fg, back_color=bg).get_image().convert("RGB")
    # 模組遮罩：模組處白、其餘黑，再讓材質透過遮罩蓋在底色上
    mask = qr.make_image(fill_color="white", back_color="black").get_image().convert("L")
    if texture.size != mask.size:
        texture = ImageOps.fit(texture, mask.size, Image.Resampling.LANCZOS)
    return Image.composite(texture, Image.new("RGB", mask.size, bg), mask)


def rel_luminance(color: str) -> float:
    r, g, b = ImageColor.getrgb(color)[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_texture(path: Path, side_px: int, lo: float, hi: float) -> Image.Image:
    """材質裁成正方形鋪滿整張 QR，再把每個色版線性壓進 [lo, hi]。

    往上提亮等於往白色混，暗部會變淡而不是變成飽和的橘紅（HSV 只拉 V 會有那個問題）；
    往下壓暗則等於往黑色混。紋理與色相都保留。
    """
    img = Image.open(path)
    img = (ImageOps.exif_transpose(img) or img).convert("RGB")
    img = ImageOps.fit(img, (side_px, side_px), Image.Resampling.LANCZOS)
    return img.point(lambda x: round(lo * 255 + x * (hi - lo)))


def texture_report(texture: Image.Image, *, bg: str) -> str:
    """回報材質與底色的對比；最弱的 5% 像素才是掃描器會誤判的地方。"""
    gray = texture.convert("L")
    hist = gray.histogram()
    total = sum(hist)
    cumulative = 0
    p5 = p95 = 0
    for i, count in enumerate(hist):
        cumulative += count
        if not p5 and cumulative >= total * 0.05:
            p5 = i
        if cumulative >= total * 0.95:
            p95 = i
            break
    mean = ImageStat.Stat(gray).mean[0]
    bg_l = rel_luminance(bg)
    weakest = (p5 - bg_l) if mean >= bg_l else (bg_l - p95)
    line = f"材質亮度：平均 {mean:.0f}，底色 {bg_l:.0f}，最弱 5% 像素與底色差 {weakest:.0f}（0–255）"
    if weakest < 90:
        line += "\n[警告] 材質最暗（或最亮）處與底色對比不足，掃描器可能誤判模組；請調高 --texture-range 的下限或改底色"
    return line


# ---------------------------------------------------------------------------
# logo 處理
# ---------------------------------------------------------------------------


def find_default_logo() -> Path | None:
    if not LOGO_DIR.is_dir():
        return None
    pngs = sorted(p for p in LOGO_DIR.iterdir() if p.suffix.lower() == ".png")
    if len(pngs) == 1:
        return pngs[0]
    if not pngs:
        return None
    listing = "\n  ".join(p.name for p in pngs)
    raise SystemExit(f"data/logo/ 有多個 PNG，請用 --logo 指定：\n  {listing}")


def load_logo(path: Path) -> Image.Image:
    if not path.exists():
        raise SystemExit(f"找不到 logo：{path}")
    if path.suffix.lower() == ".svg":
        raise SystemExit("logo 請提供 PNG（SVG 需先轉成點陣圖，例如用瀏覽器或 Figma 匯出 1024px PNG）")
    img = Image.open(path)
    img = ImageOps.exif_transpose(img) or img
    return img.convert("RGBA")


def clean_alpha(img: Image.Image) -> tuple[Image.Image, dict[str, object]]:
    """清掉去背留下的彩色毛邊與斑點：低 alpha 歸零 → 開運算去小斑點 → 侵蝕 1 px 去暈邊。"""
    alpha = img.getchannel("A")
    bbox_before = alpha.getbbox()
    alpha = alpha.point(lambda v: 0 if v < ALPHA_THRESHOLD else v)
    if ALPHA_SPECK_PX > 1:
        alpha = alpha.filter(ImageFilter.MinFilter(ALPHA_SPECK_PX)).filter(ImageFilter.MaxFilter(ALPHA_SPECK_PX))
    if ALPHA_ERODE_PX > 0:
        alpha = alpha.filter(ImageFilter.MinFilter(2 * ALPHA_ERODE_PX + 1))
    out = img.copy()
    out.putalpha(alpha)
    return out, {"bbox_before": bbox_before, "bbox_after": alpha.getbbox()}


def trim_to_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox(alpha_only=True)
    if bbox is None:
        raise SystemExit("logo 清理後完全透明，請檢查檔案")
    return img.crop(bbox)


def fit_size(inner: float, aspect_h_over_w: float, circle: bool) -> tuple[float, float]:
    """在 inner×inner 的方框（或內切圓）內，等比放得下的最大寬高。"""
    if circle:
        w = inner / math.sqrt(1 + aspect_h_over_w**2)
        return w, w * aspect_h_over_w
    if aspect_h_over_w >= 1:
        return inner / aspect_h_over_w, inner
    return inner, inner * aspect_h_over_w


def prepare_badge(art: Image.Image, geom: Geometry, *, shape: str, bg: str) -> Image.Image:
    """把 logo 縮進方框並（可選）放在底牌上，回傳 badge_px × badge_px 的 RGBA。"""
    s = SUPERSAMPLE
    size = geom.badge_px * s
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if shape != "none":
        draw = ImageDraw.Draw(canvas)
        box = [0, 0, size - 1, size - 1]
        if shape == "circle":
            draw.ellipse(box, fill=bg)
        elif shape == "square":
            draw.rectangle(box, fill=bg)
        else:
            draw.rounded_rectangle(box, radius=round(0.75 * geom.box * s), fill=bg)

    inner = geom.inner_modules * geom.box * s
    w, h = fit_size(inner, art.height / art.width, circle=(shape == "circle"))
    fitted = ImageOps.contain(art, (max(1, int(w)), max(1, int(h))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, dest=((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas.resize((geom.badge_px, geom.badge_px), Image.Resampling.LANCZOS)


def paste_badge(qr_img: Image.Image, badge: Image.Image, geom: Geometry) -> Image.Image:
    base = qr_img.convert("RGBA")
    base.alpha_composite(badge, dest=geom.badge_xy)
    return base.convert("RGB")


# ---------------------------------------------------------------------------
# SVG
# ---------------------------------------------------------------------------


def logo_png_base64(art: Image.Image) -> str:
    small = ImageOps.contain(art, (SVG_LOGO_MAX_SIDE, SVG_LOGO_MAX_SIDE), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def texture_data_uri(texture: Image.Image, max_side: int = 1024) -> str:
    small = ImageOps.contain(texture, (max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, format="JPEG", quality=90, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def render_svg(matrix: list[list[bool]], geom: Geometry, *, fg: str, bg: str, module_mm: float,
               shape: str, art: Image.Image | None, texture: Image.Image | None = None) -> str:
    """直接從模組矩陣輸出 SVG，座標單位 = 模組，實際尺寸用 mm 標在 width/height。"""
    w = len(matrix)  # N + 2 * BORDER
    size_mm = f"{w * module_mm:g}mm"
    runs: list[str] = []
    for y, row in enumerate(matrix):
        x = 0
        while x < w:
            if not row[x]:
                x += 1
                continue
            run = 1
            while x + run < w and row[x + run]:
                run += 1
            runs.append(f"M{x} {y}h{run}v1h-{run}z")
            x += run

    module_fill = fg
    defs = ""
    if texture is not None:
        # 材質鋪滿整張 QR 的座標系，再拿來填模組路徑，與 PNG 的對位一致
        defs = (f'<defs><pattern id="fgtex" patternUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{w}">'
                f'<image href="{texture_data_uri(texture)}" width="{w}" height="{w}" preserveAspectRatio="none"/>'
                f"</pattern></defs>")
        module_fill = "url(#fgtex)"
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{size_mm}" height="{size_mm}" viewBox="0 0 {w} {w}" shape-rendering="crispEdges">',
        defs,
        f'<rect width="{w}" height="{w}" fill="{bg}"/>',
        f'<path fill="{module_fill}" d="{"".join(runs)}"/>',
    ]
    if geom.badge_modules and art is not None:
        m = geom.badge_modules
        x0 = BORDER + (geom.modules - 1) // 2 - (m - 1) // 2
        if shape == "circle":
            out.append(f'<circle cx="{x0 + m / 2:g}" cy="{x0 + m / 2:g}" r="{m / 2:g}" fill="{bg}"/>')
        elif shape in ("rounded", "square"):
            rx = 0.75 if shape == "rounded" else 0
            out.append(f'<rect x="{x0}" y="{x0}" width="{m}" height="{m}" rx="{rx:g}" fill="{bg}"/>')
        iw, ih = fit_size(geom.inner_modules, art.height / art.width, circle=(shape == "circle"))
        ix = x0 + (m - iw) / 2
        iy = x0 + (m - ih) / 2
        href = f"data:image/png;base64,{logo_png_base64(art)}"
        out.append(
            f'<image x="{ix:.4g}" y="{iy:.4g}" width="{iw:.4g}" height="{ih:.4g}" '
            f'preserveAspectRatio="xMidYMid meet" href="{href}" xlink:href="{href}"/>'
        )
    out.append("</svg>")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# 解碼驗證
# ---------------------------------------------------------------------------


def load_decoder() -> Decoder | None:
    try:
        import zxingcpp  # type: ignore[import-not-found]
    except ImportError:
        zxingcpp = None

    if zxingcpp is not None:
        def decode_zxing(img: Image.Image) -> list[tuple[str, str]]:
            gray = img.convert("L")
            try:
                results = zxingcpp.read_barcodes(gray, formats=zxingcpp.BarcodeFormat.QRCode)
            except TypeError:
                results = [r for r in zxingcpp.read_barcodes(gray) if "QR" in str(r.format)]
            return [(r.text, str(getattr(r, "ec_level", ""))) for r in results if getattr(r, "valid", True)]

        return Decoder(f"zxing-cpp {dist_version('zxing-cpp') or ''}".strip(), decode_zxing)

    try:
        import cv2  # type: ignore[import-not-found]
        import numpy as np  # type: ignore[import-not-found]
    except ImportError:
        return None

    detector = cv2.QRCodeDetector()

    def decode_cv2(img: Image.Image) -> list[tuple[str, str]]:
        text, _points, _straight = detector.detectAndDecode(np.asarray(img.convert("L")))
        return [(text, "")] if text else []

    return Decoder(f"opencv {cv2.__version__}", decode_cv2)


def verify_image(img: Image.Image, payload: str, decoder: Decoder) -> tuple[dict[str, bool], str]:
    """在每個模擬條件下解碼；通過 = 至少解出一個且全部等於 payload。回傳 (結果, 解碼器回報的容錯等級)。"""
    results: dict[str, bool] = {}
    ec_seen = ""
    for name, side, blur in VERIFY_CONDITIONS:
        test = img
        if side:
            test = test.resize((side, side), Image.Resampling.BOX)  # BOX 模擬感光元件平均，不會像 LANCZOS 產生振鈴
        if blur:
            test = test.filter(ImageFilter.GaussianBlur(blur))
        decoded = decoder.decode(test)
        texts = [t for t, _ in decoded]
        results[name] = bool(texts) and all(t == payload for t in texts)
        if not ec_seen:
            ec_seen = next((ec for _, ec in decoded if ec), "")
    return results, ec_seen


def format_verify(results: dict[str, bool]) -> str:
    return "  ".join(f"{k}:{'PASS' if v else 'FAIL'}" for k, v in results.items())


def function_module_mask(version: int) -> set[tuple[int, int]]:
    """功能圖案（定位、分隔、格式/版本資訊、定時、對位）所在的 (row, col)。破壞測試避開它們，只量資料區的容錯。"""
    n = 4 * version + 17
    cells: set[tuple[int, int]] = set()
    for r in range(9):  # 三個定位圖案含分隔線與格式資訊，各 9×9
        for c in range(9):
            cells.update({(r, c), (r, n - 1 - c), (n - 1 - r, c)})
    for i in range(n):  # 定時圖案
        cells.update({(6, i), (i, 6)})
    positions = qrcode.util.pattern_position(version)
    for a in positions:  # 對位圖案 5×5，與定位圖案重疊的三個位置不存在
        for b in positions:
            if (a, b) in ((6, 6), (6, n - 7), (n - 7, 6)):
                continue
            cells.update((a + dr, b + dc) for dr in range(-2, 3) for dc in range(-2, 3))
    if version >= 7:  # 版本資訊
        for i in range(6):
            for j in range(3):
                cells.update({(i, n - 11 + j), (n - 11 + j, i)})
    return cells


def damage_margin(qr_img: Image.Image, matrix: list[list[bool]], geom: Geometry, payload: str,
                  decoder: Decoder, *, fg: str, bg: str) -> float:
    """在 logo 方框與功能圖案以外隨機翻轉 p% 的資料模組（以 3×3 髒污塊為單位）、縮到 300px 解碼，回傳仍能全部解碼的最大 p。

    模擬印刷髒污、磨損、反光。數字是相對指標：拿有 logo 的列跟沒 logo 的對照組比，就知道 logo 吃掉多少容錯。
    """
    n, box, m = geom.modules, geom.box, geom.badge_modules
    lo = (n - 1) // 2 - (m - 1) // 2
    hi = lo + m
    protected = function_module_mask(geom.version)
    candidates = [(r, c) for r in range(n) for c in range(n)
                  if (r, c) not in protected and not (m and lo <= r < hi and lo <= c < hi)]
    candidate_set = set(candidates)
    half = DAMAGE_BLOCK // 2
    fg_rgb, bg_rgb = ImageColor.getrgb(fg)[:3], ImageColor.getrgb(bg)[:3]
    rng = random.Random(1)  # 固定種子，重跑結果一致
    best = 0.0
    pct = DAMAGE_STEP_PCT
    while pct <= DAMAGE_MAX_PCT + 1e-9:
        k = round(len(candidates) * pct / 100)
        for _ in range(DAMAGE_TRIALS):
            damaged: set[tuple[int, int]] = set()
            while len(damaged) < k:
                r0, c0 = rng.choice(candidates)
                damaged.update(cell for dr in range(-half, half + 1) for dc in range(-half, half + 1)
                               if (cell := (r0 + dr, c0 + dc)) in candidate_set)
            img = qr_img.copy()
            draw = ImageDraw.Draw(img)
            for r, c in damaged:
                x, y = (BORDER + c) * box, (BORDER + r) * box
                dark = matrix[BORDER + r][BORDER + c]
                draw.rectangle([x, y, x + box - 1, y + box - 1], fill=bg_rgb if dark else fg_rgb)
            test = img.resize((DAMAGE_TEST_SIDE, DAMAGE_TEST_SIDE), Image.Resampling.BOX)
            texts = [t for t, _ in decoder.decode(test)]
            if not (texts and all(t == payload for t in texts)):
                return best
        best = pct
        pct += DAMAGE_STEP_PCT
    return best


# ---------------------------------------------------------------------------
# 輸出
# ---------------------------------------------------------------------------


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dist_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def tool_info(argv: list[str]) -> dict[str, object]:
    return {
        "script": Path(__file__).name,
        "script_sha256": sha256_of(Path(__file__)),
        "python": sys.version.split()[0],
        "qrcode": dist_version("qrcode"),
        "pillow": Image.__version__,
        "zxing_cpp": dist_version("zxing-cpp"),
        "argv": argv,
        "run_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def write_manifest(out_dir: Path, items: list[dict[str, object]], tool: dict[str, object]) -> Path:
    """以 PNG 檔名為 key 合併進既有 manifest，讓一份檔案就能稽核所有產出。"""
    path = out_dir / "manifest.json"
    existing: dict[str, object] = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8")).get("items", {})
        except (json.JSONDecodeError, AttributeError):
            print(f"[警告] 既有 {path.name} 格式不對，將整個重寫")
    for item in items:
        existing[str(item["file_png"])] = item
    path.write_text(json.dumps({"tool": tool, "items": existing}, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    return path


def print_geometry(geom: Geometry, targets: list[Target], *, ec: int, module_mm: float, badge_shape: str,
                   has_logo: bool) -> None:
    n = geom.modules
    total_modules = n + 2 * BORDER
    longest = max(len(t.payload.encode("utf-8")) for t in targets)
    print(f"QR 版本 v{geom.version}（{n}×{n} 模組），容錯 {EC_NAME[ec]}，最長網址 {longest}/{byte_capacity(geom.version, ec)} bytes")
    print(f"PNG {geom.side_px}px（每模組 {geom.box}px）。列印每模組 {module_mm:g} mm → 邊長 {total_modules * module_mm:.1f} mm"
          f"（含 4 模組留白）；每模組 0.4 mm 是下限 → 最小 {total_modules * 0.4:.1f} mm")
    if not has_logo:
        return
    print(f"logo 方框 {geom.badge_modules} 模組（有效 ratio {geom.effective_ratio:.3f}），覆蓋 {geom.coverage_pct:.1f}% 面積，"
          f"估計蓋到 {geom.est_codewords_hit} 個碼字 / 可修復 {geom.correctable_codewords}（EC 預算用掉 {geom.ec_budget_pct:.0f}%）")
    if geom.ec_budget_pct > 50:
        print("[警告] EC 預算超過 50%，印刷髒污或反光就可能掃不到，建議降低 --logo-ratio 或加 --verify 實測")
    if has_center_alignment_pattern(geom.version):
        print(f"[警告] v{geom.version} 正中央有對位圖案，會被 logo 蓋掉；建議縮短網域讓版本降到 v6 以下")
    if badge_shape == "none":
        print("[提醒] 透明直貼沒有白色底牌，被筆畫半蓋的模組會變模糊；掃描不穩時改 --badge rounded")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def parse_sweep(spec: str) -> list[float]:
    try:
        start, stop, step = (float(x) for x in spec.split(":"))
    except ValueError as exc:
        raise SystemExit(f"--sweep 格式應為 START:STOP:STEP，例如 {DEFAULT_SWEEP}") from exc
    if step <= 0 or start <= 0 or stop < start:
        raise SystemExit("--sweep 範圍不合理")
    values: list[float] = []
    r = start
    while r <= stop + 1e-9:
        values.append(round(r, 4))
        r += step
    return values


def run_sweep(target: Target, args: argparse.Namespace, *, art: Image.Image, decoder: Decoder, ec: int,
              version: int) -> int:
    """對同一網址掃過多種 logo 大小，實際解碼，寫出報告。這是「logo 能放多大」的實測答案。"""
    n = 4 * version + 17
    ms = sorted({badge_modules_for(r, n) for r in parse_sweep(args.sweep)})
    ms = [0] + ms  # 0 = 沒有 logo 的對照組
    sweep_dir = args.out / "sweep"
    sweep_dir.mkdir(parents=True, exist_ok=True)

    texture: Image.Image | None = None
    if args.fg_texture:
        side_px = compute_geometry(version, size_px=args.size, badge_modules=0, badge_shape=args.badge,
                                   badge_margin=args.badge_margin, ec=ec).side_px
        texture = load_texture(args.fg_texture, side_px, *args.texture_range)
        print(texture_report(texture, bg=args.bg))

    rows: list[dict[str, object]] = []
    for m in ms:
        geom = compute_geometry(version, size_px=args.size, badge_modules=m, badge_shape=args.badge,
                                badge_margin=args.badge_margin, ec=ec)
        qr = build_qr(target.payload, version=version, ec=ec, box=geom.box)
        img = render_png(qr, fg=args.fg, bg=args.bg, texture=texture)
        if m:
            img = paste_badge(img, prepare_badge(art, geom, shape=args.badge, bg=args.bg), geom)
        results, _ = verify_image(img, target.payload, decoder)
        margin = damage_margin(img, qr.get_matrix(), geom, target.payload, decoder, fg=args.fg, bg=args.bg)
        stem = f"{target.name}_m{m:02d}_r{m / n:.3f}"
        path = sweep_dir / f"{stem}.png"
        img.save(path)
        rows.append({
            "badge_modules": m,
            "effective_ratio": round(m / n, 4),
            "coverage_pct": round(geom.coverage_pct, 2),
            "est_codewords_hit": geom.est_codewords_hit,
            "correctable_codewords": geom.correctable_codewords,
            "ec_budget_pct": round(geom.ec_budget_pct, 1),
            "verify": results,
            "all_pass": all(results.values()),
            "damage_margin_pct": margin,
            "file": path.name,
        })
        print(f"m={m:2d}  ratio={m / n:.3f}  覆蓋 {geom.coverage_pct:4.1f}%  EC 估計 {geom.ec_budget_pct:3.0f}%  "
              f"剩餘容錯 {margin:4.1f}%  {format_verify(results)}")

    baseline = next((float(r["damage_margin_pct"]) for r in rows if r["badge_modules"] == 0), 0.0)

    def pick(min_fraction: float, max_ratio: float) -> int:
        return max((int(r["badge_modules"]) for r in rows
                    if r["all_pass"] and r["badge_modules"] and r["badge_modules"] / n <= max_ratio + 1e-9
                    and float(r["damage_margin_pct"]) >= baseline * min_fraction),
                   default=0)

    digital_max = max((int(r["badge_modules"]) for r in rows if r["all_pass"] and r["badge_modules"]), default=0)
    largest = pick(0.5, PRACTICAL_MAX_RATIO)
    safe = pick(2 / 3, PRACTICAL_SAFE_RATIO)
    if baseline and largest:
        rec = (f"沒有 logo 時可再承受 {baseline:.0f}% 髒污；數位解碼最大可到 {digital_max} 模組（ratio {digital_max / n:.3f}）。"
               f"建議上限（剩餘容錯 ≥ 一半且 ratio ≤ {PRACTICAL_MAX_RATIO}）：{largest} 模組（ratio {largest / n:.3f}）；"
               f"保守選擇（≥ 三分之二且 ratio ≤ {PRACTICAL_SAFE_RATIO}）：{safe} 模組（ratio {safe / n:.3f}，--logo-ratio {safe / n:.2f}）")
    elif digital_max:
        rec = f"全部條件通過的最大 logo：{digital_max} 模組（ratio {digital_max / n:.3f}），但剩餘容錯不足，建議加 --badge rounded 或縮小"
    else:
        rec = "沒有任何 logo 大小通過；請改 --badge rounded 或縮小 --logo-ratio"
    print(rec)

    lines = [
        f"# logo 大小實測：{target.payload}",
        "",
        f"- QR 版本 v{version}（{n}×{n} 模組），容錯 {EC_NAME[ec]}，底牌 {args.badge}，解碼器 {decoder.name}",
        f"- logo：{args.logo_path}",
        f"- {rec}",
        "",
        "| 方框模組 | 有效 ratio | 覆蓋面積 | 估計碼字/可修復 | EC 估計 | 剩餘容錯 | "
        + " | ".join(k for k, _, _ in VERIFY_CONDITIONS) + " | 檔案 |",
        "|---|---|---|---|---|---|" + "---|" * len(VERIFY_CONDITIONS) + "---|",
    ]
    for r in rows:
        checks = " | ".join("PASS" if v else "FAIL" for v in r["verify"].values())  # type: ignore[union-attr]
        lines.append(f"| {r['badge_modules']} | {int(r['badge_modules']) / n:.3f} | {r['coverage_pct']:.1f}% | "
                     f"{r['est_codewords_hit']}/{r['correctable_codewords']} | {r['ec_budget_pct']:.0f}% | "
                     f"{r['damage_margin_pct']:.1f}% | {checks} | {r['file']} |")
    lines += [
        "",
        "- ratio 是相對於不含留白的模組數 N。",
        "- 驗證條件：full 原尺寸；down300/down200 縮到該邊長模擬遠拍；blur1 再加高斯模糊 1 px 模擬失焦。",
        "- EC 估計：把 logo 方框當成全部蓋掉時估計用掉的容錯比例（上限值）。透明直貼只蓋到有筆畫的模組，實際會低很多。",
        f"- 剩餘容錯：在 logo 與功能圖案以外隨機翻轉 {DAMAGE_BLOCK}×{DAMAGE_BLOCK} 模組的髒污塊（每級加 {DAMAGE_STEP_PCT:g}%，"
        f"每級試 {DAMAGE_TRIALS} 次，縮到 {DAMAGE_TEST_SIDE}px 解碼）仍能解碼的最大資料模組比例。模擬髒污、磨損、反光；與 m=0 那列相比就是 logo 的代價。",
        f"- 建議值另外受實務上限約束（ratio ≤ {PRACTICAL_MAX_RATIO}，保守 ≤ {PRACTICAL_SAFE_RATIO}）：手機鏡頭的失焦、反光與印刷網點都不在數位模擬範圍內。",
    ]
    (sweep_dir / "sweep_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (sweep_dir / "sweep_report.json").write_text(
        json.dumps({"payload": target.payload, "version": version, "modules": n, "ec": EC_NAME[ec],
                    "badge": args.badge, "decoder": decoder.name, "rows": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    print(f"報告：{sweep_dir / 'sweep_report.md'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    args = parse_args(argv)
    if args.fg_texture and args.texture_range is None:
        # 模組比底色亮（黑底白格）就把材質往亮拉；反之往暗壓
        args.texture_range = (0.4, 1.0) if rel_luminance(args.fg) >= rel_luminance(args.bg) else (0.0, 0.45)
    targets = collect_targets(args)

    # logo
    art: Image.Image | None = None
    args.logo_path = None
    if not args.no_logo:
        logo_path = args.logo or find_default_logo()
        if logo_path is None:
            print("[提醒] data/logo/ 沒有 PNG，這次不放 logo（或用 --logo 指定）")
        else:
            args.logo_path = logo_path
            raw = load_logo(logo_path)
            cleaned, info = clean_alpha(raw)
            art = trim_to_alpha(cleaned)
            print(f"logo：{logo_path.name}（{raw.width}×{raw.height}，清理後有效範圍 {art.width}×{art.height}，"
                  f"bbox {info['bbox_before']} → {info['bbox_after']}）")
    has_logo = art is not None
    ec = EC_MAP["H"] if has_logo else EC_MAP[args.ec]

    decoder: Decoder | None = None
    if args.verify or args.sweep:
        decoder = load_decoder()
        if decoder is None:
            print("找不到解碼器。--verify / --sweep 需要 zxing-cpp：\n"
                  "    uv run scripts/qr/make_qr.py ...   （自動安裝）\n"
                  "    pip install zxing-cpp==3.1.1        （Python 3.10–3.13）")
            return 3
        print(f"解碼器：{decoder.name}")

    args.out.mkdir(parents=True, exist_ok=True)

    # 統一版本：批次時取最大需求，讓所有 QR 同尺寸
    needed = {t.payload: best_version(t.payload, ec) for t in targets}
    version = args.version or max(needed.values())
    if args.version and args.version < max(needed.values()):
        too_long = "\n  ".join(f"{p}（需要 v{v}）" for p, v in needed.items() if v > args.version)
        raise SystemExit(f"--version {args.version} 放不下這些網址：\n  {too_long}")

    if args.sweep:
        if not has_logo or decoder is None:
            raise SystemExit("--sweep 需要 logo 與解碼器")
        return run_sweep(targets[0], args, art=art, decoder=decoder, ec=ec, version=version)

    badge_modules = badge_modules_for(args.logo_ratio, 4 * version + 17) if has_logo else 0
    geom = compute_geometry(version, size_px=args.size, badge_modules=badge_modules, badge_shape=args.badge,
                            badge_margin=args.badge_margin, ec=ec)
    print_geometry(geom, targets, ec=ec, module_mm=args.module_mm, badge_shape=args.badge, has_logo=has_logo)

    texture: Image.Image | None = None
    if args.fg_texture:
        texture = load_texture(args.fg_texture, geom.side_px, *args.texture_range)
        print(texture_report(texture, bg=args.bg))

    badge: Image.Image | None = None
    if has_logo:
        badge = prepare_badge(art, geom, shape=args.badge, bg=args.bg)
        if args.debug_badge:
            art.save(args.out / "_logo_clean.png")
            badge.save(args.out / "_badge_preview.png")
            print(f"除錯輸出：{args.out / '_logo_clean.png'}、{args.out / '_badge_preview.png'}")

    dpi = 25.4 * geom.box / args.module_mm
    logo_sha = sha256_of(args.logo_path) if args.logo_path else None
    items: list[dict[str, object]] = []
    any_failed = False
    print()
    for target in targets:
        qr = build_qr(target.payload, version=version, ec=ec, box=geom.box)
        img = render_png(qr, fg=args.fg, bg=args.bg, texture=texture)
        if badge is not None:
            img = paste_badge(img, badge, geom)
        png_path = args.out / f"{target.name}.png"
        img.save(png_path, dpi=(dpi, dpi))

        svg_path = None
        if args.svg:
            svg_path = args.out / f"{target.name}.svg"
            svg_path.write_text(render_svg(qr.get_matrix(), geom, fg=args.fg, bg=args.bg, module_mm=args.module_mm,
                                           shape=args.badge, art=art, texture=texture), encoding="utf-8")

        verify: dict[str, bool] | None = None
        ec_seen = ""
        status = ""
        if decoder is not None:
            verify, ec_seen = verify_image(img, target.payload, decoder)
            ok = all(verify.values())
            any_failed |= not ok
            status = f"  {format_verify(verify)}" + (f"  (解碼器回報 EC {ec_seen})" if ec_seen else "")
        print(f"{png_path.name:<28} {target.payload}{status}")

        items.append({
            "payload": target.payload,
            "payload_bytes": len(target.payload.encode("utf-8")),
            "file_png": png_path.name,
            "file_svg": svg_path.name if svg_path else None,
            "version": version,
            "modules": geom.modules,
            "ec": EC_NAME[ec],
            "fg": args.fg,
            "bg": args.bg,
            "fg_texture": str(args.fg_texture) if args.fg_texture else None,
            "fg_texture_sha256": sha256_of(args.fg_texture) if args.fg_texture else None,
            "texture_range": list(args.texture_range) if args.fg_texture else None,
            "box_px": geom.box,
            "side_px": geom.side_px,
            "dpi": round(dpi, 1),
            "module_mm": args.module_mm,
            "print_side_mm": round((geom.modules + 2 * BORDER) * args.module_mm, 2),
            "min_print_side_mm_at_0.4": round((geom.modules + 2 * BORDER) * 0.4, 2),
            "logo": str(args.logo_path) if args.logo_path else None,
            "logo_sha256": logo_sha,
            "logo_ratio_requested": args.logo_ratio if has_logo else None,
            "badge_modules": geom.badge_modules,
            "badge_shape": args.badge if has_logo else None,
            "coverage_pct": round(geom.coverage_pct, 2),
            "ec_budget_pct": round(geom.ec_budget_pct, 1),
            "verify": verify,
            "decoder_ec_level": ec_seen or None,
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        })

    manifest = write_manifest(args.out, items, tool_info(argv))
    print(f"\n完成 {len(items)} 張 → {args.out}（清單：{manifest.name}）")
    if any_failed:
        print("[失敗] 有 QR 沒通過解碼驗證。可嘗試：縮小 --logo-ratio、改 --badge rounded、調高 --texture-range 下限、放大 --size，或回到深格淺底")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
