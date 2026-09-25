# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["pillow==12.3.0", "pillow-heif==1.7.0"]
# ///
"""
把 data/ 裡的原始照片轉成網站用的圖檔，並更新 src/data/images.json。一次處理兩種：

  頭像  data/avatars/<slug>.<ext>          → public/avatars/<slug>-<雜湊>.jpg      512×512，置中裁成正方形
  照片  data/photos/<slug>/<任意檔名>.<ext>  → public/photos/<slug>/<檔名>-<雜湊>.jpg  長邊最多 2400px，不裁切

用法：
  uv run scripts/images/make_images.py                 # 或 npm run images
  uv run scripts/images/make_images.py --avatar-size 768 --photo-max-edge 2000

規則：
  - <ext> 可為 jpg、jpeg、png、webp、heic、heif。<slug> 必須是 members.ts 裡的 slug，大小寫要一致。
  - data/avatars/ 與 data/photos/ 都不進 git，原圖只留在你自己的電腦。
  - 照片的顯示順序 = 檔名排序（數字會按大小排：1、2、10），想調順序就改檔名，例如 01-xxx.jpg、02-xxx.jpg。
  - 所有輸出：依 EXIF 方向轉正、色彩轉成 sRGB、輸出 JPEG、清掉所有 metadata（含 GPS 位置）。
  - 輸出檔名帶內容雜湊，照片一換網址就變，瀏覽器與 CDN 不會拿到舊圖；不再是目前輸出的舊檔會自動刪掉，
    來源被移除的 slug 也會一起清掉。只會刪符合本腳本命名格式的檔案，手放的檔案不動。
  - 網站透過 src/data/images.ts 讀 images.json 決定頭像與照片，members.ts 不用填路徑。
  - 把 public/avatars/、public/photos/ 與 src/data/images.json 一起 commit。`npm run build` 前會自動執行
    scripts/images/check_images.mjs，確認清單、檔案與 members.ts 一致，沒跑腳本會直接擋下。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageCms, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

REPO_ROOT = Path(__file__).resolve().parents[2]
AVATAR_SOURCE_DIR = REPO_ROOT / "data" / "avatars"
PHOTO_SOURCE_DIR = REPO_ROOT / "data" / "photos"
AVATAR_OUTPUT_DIR = REPO_ROOT / "public" / "avatars"
PHOTO_OUTPUT_DIR = REPO_ROOT / "public" / "photos"
MANIFEST = REPO_ROOT / "src" / "data" / "images.json"
MEMBERS_TS = REPO_ROOT / "src" / "data" / "members.ts"

SOURCE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
# 只吃 members.ts 裡 `slug: "xxx",` 這種字串字面值（與 scripts/qr/make_qr.py 相同）。
SLUG_RE = re.compile(r'^\s*slug:\s*"([a-z0-9-]+)"\s*,?\s*$', re.M)
# 本腳本的輸出檔名格式；刪舊檔時只碰符合格式的檔案。
OUTPUT_RE = re.compile(r"^(?P<stem>[a-z0-9-]+)-(?P<hash>[0-9a-f]{8})\.jpg$")

DEFAULT_AVATAR_SIZE = 512
DEFAULT_PHOTO_MAX_EDGE = 2400
AVATAR_QUALITY = 85
PHOTO_QUALITY = 82
HASH_LEN = 8
BACKGROUND = (255, 255, 255)  # 透明圖底下墊白


def rel(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def natural_key(path: Path) -> list:
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", path.name)]


def safe_stem(name: str) -> str:
    stem = re.sub(r"[^a-z0-9]+", "-", Path(name).stem.lower()).strip("-")
    return stem or "photo"


def read_slugs() -> list[str]:
    slugs = SLUG_RE.findall(MEMBERS_TS.read_text(encoding="utf-8"))
    if not slugs:
        raise SystemExit(f"{rel(MEMBERS_TS)} 讀不到任何 slug")
    return slugs


def is_source_file(path: Path) -> bool:
    return path.is_file() and not path.name.startswith(".")


# ---------------------------------------------------------------------------
# 影像處理


def to_srgb(image: Image.Image) -> Image.Image:
    """有內嵌色彩描述檔（例如 iPhone 的 Display P3）就轉成 sRGB，之後才能安全地把描述檔拿掉。"""
    icc = image.info.get("icc_profile")
    if not icc:
        return image
    try:
        source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        converted = ImageCms.profileToProfile(
            image, source_profile, ImageCms.createProfile("sRGB"), outputMode="RGB"
        )
        return converted if converted is not None else image
    except ImageCms.PyCMSError:
        return image


def load_rgb(source: Path) -> Image.Image:
    """開檔、轉正、去透明、轉 sRGB，回傳 RGB 影像。"""
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened) or opened
        if image.mode in ("RGBA", "LA", "P") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            backdrop = Image.new("RGBA", rgba.size, BACKGROUND + (255,))
            backdrop.alpha_composite(rgba)
            image = backdrop
        return to_srgb(image.convert("RGB"))


def encode_jpeg(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    # 不傳 exif / icc_profile，輸出就不含任何 metadata。
    image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True, icc_profile=None)
    return buffer.getvalue()


def render_avatar(source: Path, size: int) -> tuple[bytes, int, int]:
    image = ImageOps.fit(load_rgb(source), (size, size), Image.LANCZOS, centering=(0.5, 0.5))
    return encode_jpeg(image, AVATAR_QUALITY), image.width, image.height


def render_photo(source: Path, max_edge: int) -> tuple[bytes, int, int]:
    image = load_rgb(source)
    if max(image.size) > max_edge:
        image = ImageOps.contain(image, (max_edge, max_edge), Image.LANCZOS)
    return encode_jpeg(image, PHOTO_QUALITY), image.width, image.height


# ---------------------------------------------------------------------------
# 來源整理


def collect_avatar_sources(slugs: list[str], errors: list[str]) -> dict[str, Path]:
    sources: dict[str, Path] = {}
    if not AVATAR_SOURCE_DIR.is_dir():
        return sources
    for path in sorted(AVATAR_SOURCE_DIR.iterdir(), key=natural_key):
        if not is_source_file(path):
            continue
        if path.suffix.lower() not in SOURCE_EXTS:
            errors.append(f"{rel(path)}：不支援的格式，可用 {' '.join(sorted(SOURCE_EXTS))}")
        elif path.stem not in slugs:
            errors.append(f"{rel(path)}：檔名「{path.stem}」不是 members.ts 裡的 slug（大小寫要一致）")
        elif path.stem in sources:
            errors.append(f"{rel(path)} 與 {rel(sources[path.stem])}：同一個 slug 有兩張頭像，請只留一張")
        else:
            sources[path.stem] = path
    return sources


def collect_photo_sources(slugs: list[str], errors: list[str]) -> dict[str, list[Path]]:
    sources: dict[str, list[Path]] = {}
    if not PHOTO_SOURCE_DIR.is_dir():
        return sources
    for folder in sorted(PHOTO_SOURCE_DIR.iterdir(), key=natural_key):
        if folder.name.startswith("."):
            continue
        if not folder.is_dir():
            errors.append(f"{rel(folder)}：照片要放在 data/photos/<slug>/ 資料夾裡，不能直接放在 data/photos/")
            continue
        if folder.name not in slugs:
            errors.append(f"{rel(folder)}/：資料夾名「{folder.name}」不是 members.ts 裡的 slug（大小寫要一致）")
            continue
        files = [p for p in sorted(folder.iterdir(), key=natural_key) if is_source_file(p)]
        bad = [p for p in files if p.suffix.lower() not in SOURCE_EXTS]
        for p in bad:
            errors.append(f"{rel(p)}：不支援的格式，可用 {' '.join(sorted(SOURCE_EXTS))}")
        good = [p for p in files if p not in bad]
        if good:
            sources[folder.name] = good
    return sources


# ---------------------------------------------------------------------------
# 輸出與清理


def write_output(target: Path, data: bytes) -> str:
    if target.exists() and target.read_bytes() == data:
        return "已是最新"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return "寫入"


def remove_stale(folder: Path, keep: set[str], removed: list[str]) -> None:
    """刪掉 folder 裡符合輸出格式、但不在 keep 裡的檔案。"""
    if not folder.is_dir():
        return
    for path in sorted(folder.iterdir()):
        if path.is_file() and OUTPUT_RE.match(path.name) and path.name not in keep:
            path.unlink()
            removed.append(rel(path))


def remove_stale_photo_folders(active_slugs: set[str], removed: list[str]) -> None:
    if not PHOTO_OUTPUT_DIR.is_dir():
        return
    for folder in sorted(PHOTO_OUTPUT_DIR.iterdir()):
        if not folder.is_dir() or folder.name in active_slugs:
            continue
        remove_stale(folder, set(), removed)
        if not any(folder.iterdir()):
            shutil.rmtree(folder)
            removed.append(rel(folder) + "/")


# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="把 data/avatars 與 data/photos 的照片轉成網站用圖檔")
    parser.add_argument("--avatar-size", type=int, default=DEFAULT_AVATAR_SIZE, help=f"頭像邊長 px，預設 {DEFAULT_AVATAR_SIZE}")
    parser.add_argument("--photo-max-edge", type=int, default=DEFAULT_PHOTO_MAX_EDGE, help=f"照片長邊上限 px，預設 {DEFAULT_PHOTO_MAX_EDGE}")
    args = parser.parse_args()
    if args.avatar_size < 64 or args.photo_max_edge < 320:
        parser.error("--avatar-size 至少 64，--photo-max-edge 至少 320")

    slugs = read_slugs()
    errors: list[str] = []
    avatar_sources = collect_avatar_sources(slugs, errors)
    photo_sources = collect_photo_sources(slugs, errors)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        print(f"\n可用的 slug：{', '.join(slugs)}", file=sys.stderr)
        raise SystemExit(1)
    if not AVATAR_SOURCE_DIR.is_dir() and not PHOTO_SOURCE_DIR.is_dir():
        raise SystemExit(
            f"找不到 {rel(AVATAR_SOURCE_DIR)}/ 或 {rel(PHOTO_SOURCE_DIR)}/。"
            "頭像存成 data/avatars/<slug>.jpg，照片放到 data/photos/<slug>/ 底下，再執行一次。"
        )

    removed: list[str] = []

    # 頭像
    avatars: dict[str, dict] = {}
    keep_avatars: set[str] = set()
    for slug, source in avatar_sources.items():
        data, width, height = render_avatar(source, args.avatar_size)
        name = f"{slug}-{sha256_of(data)[:HASH_LEN]}.jpg"
        status = write_output(AVATAR_OUTPUT_DIR / name, data)
        keep_avatars.add(name)
        avatars[slug] = {
            "src": f"/avatars/{name}",
            "width": width,
            "height": height,
            "bytes": len(data),
            "source": source.name,
            "sourceSha256": sha256_of(source.read_bytes()),
        }
        print(f"頭像 {slug:<10} {source.name:<28} -> {name}  {len(data) / 1024:>4.0f} KB  {status}")
    remove_stale(AVATAR_OUTPUT_DIR, keep_avatars, removed)

    # 照片
    photos: dict[str, list[dict]] = {}
    for slug, files in photo_sources.items():
        entries: list[dict] = []
        keep: set[str] = set()
        for source in files:
            data, width, height = render_photo(source, args.photo_max_edge)
            name = f"{safe_stem(source.name)}-{sha256_of(data)[:HASH_LEN]}.jpg"
            status = write_output(PHOTO_OUTPUT_DIR / slug / name, data)
            keep.add(name)
            entries.append(
                {
                    "src": f"/photos/{slug}/{name}",
                    "width": width,
                    "height": height,
                    "bytes": len(data),
                    "source": source.name,
                    "sourceSha256": sha256_of(source.read_bytes()),
                }
            )
            print(f"照片 {slug:<10} {source.name:<28} -> {slug}/{name}  {width}x{height}  {len(data) / 1024:>4.0f} KB  {status}")
        photos[slug] = entries
        remove_stale(PHOTO_OUTPUT_DIR / slug, keep, removed)
    remove_stale_photo_folders(set(photos), removed)

    for path in removed:
        print(f"刪除舊檔 {path}")

    manifest = {
        "generatedBy": "scripts/images/make_images.py",
        "avatarSize": args.avatar_size,
        "photoMaxEdge": args.photo_max_edge,
        "avatars": dict(sorted(avatars.items())),
        "photos": dict(sorted(photos.items())),
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    photo_count = sum(len(v) for v in photos.values())
    print(f"\n完成：頭像 {len(avatars)} 張、照片 {photo_count} 張（{len(photos)} 人），清單 {rel(MANIFEST)}")
    print("請把 public/avatars/、public/photos/ 與 src/data/images.json 一起 commit。")


if __name__ == "__main__":
    main()
