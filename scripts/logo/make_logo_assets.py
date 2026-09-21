# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["pillow==12.3.0"]
# ///
"""
把 data/logo/logo.png（原始大圖，同時也是名片 QR code 的 logo 來源）轉成網站要用的圖檔：

  src/assets/logo.png      網頁 logo：裁掉透明邊、縮到高 1024px。header、首頁 Hero、404 頁、分享預覽圖都用這一張。
  src/app/icon.png         favicon 512×512：深藍圓角底（與網站 --primary 同色）＋置中 logo。
  src/app/apple-icon.png   iOS 加到主畫面的圖示 180×180：同上但不做圓角，iOS 會自己裁。

用法：
  uv run scripts/logo/make_logo_assets.py

換 logo 時把新圖存成 data/logo/logo.png（透明背景 PNG）再跑一次，三個檔案會一起更新。
輸出是確定性的：同一張原圖跑幾次都得到相同檔案，方便看 git diff。
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPO_ROOT / "data" / "logo" / "logo.png"
WEB_LOGO = REPO_ROOT / "src" / "assets" / "logo.png"
ICON = REPO_ROOT / "src" / "app" / "icon.png"
APPLE_ICON = REPO_ROOT / "src" / "app" / "apple-icon.png"

WEB_LOGO_HEIGHT = 1024
# 低於這個 alpha 的像素視為去背殘留的雜訊，裁邊時忽略；不會改動圖本身。
TRIM_ALPHA_THRESHOLD = 8

PRIMARY = (0x3B, 0x4A, 0x6B, 255)  # globals.css 的 --primary（亮色模式）
ICON_SIZE = 512
ICON_CORNER_RATIO = 14 / 64  # 與原本 icon.svg 的圓角比例相同
ICON_PADDING_RATIO = 0.10  # logo 與圖示邊緣的留白，占邊長比例
APPLE_ICON_SIZE = 180


def load_trimmed_logo() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    visible = image.getchannel("A").point(
        lambda a: 255 if a > TRIM_ALPHA_THRESHOLD else 0
    )
    bbox = visible.getbbox()
    if bbox is None:
        raise SystemExit(f"{SOURCE} 整張都是透明的，沒有可用內容")
    return image.crop(bbox)


def scale_to_fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    scale = min(max_width / image.width, max_height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.LANCZOS)


def rounded_square(size: int, radius: int, color: tuple[int, int, int, int]) -> Image.Image:
    """先以 4 倍尺寸畫再縮小，讓圓角邊緣平滑。"""
    factor = 4
    big = Image.new("RGBA", (size * factor, size * factor), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, size * factor - 1, size * factor - 1),
        radius=radius * factor,
        fill=color,
    )
    return big.resize((size, size), Image.LANCZOS)


def make_icon(logo: Image.Image, size: int, corner_radius: int) -> Image.Image:
    canvas = rounded_square(size, corner_radius, PRIMARY)
    padding = round(size * ICON_PADDING_RATIO)
    mark = scale_to_fit(logo, size - 2 * padding, size - 2 * padding)
    offset = ((size - mark.width) // 2, (size - mark.height) // 2)
    canvas.alpha_composite(mark, offset)
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    print(f"{str(path.relative_to(REPO_ROOT)):<26} {image.width}×{image.height}  {path.stat().st_size / 1024:,.0f} KB")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"找不到原始 logo：{SOURCE}")
    logo = load_trimmed_logo()
    print(f"原圖 {SOURCE.relative_to(REPO_ROOT)}，裁邊後 {logo.width}×{logo.height}")

    save(scale_to_fit(logo, 10 * WEB_LOGO_HEIGHT, WEB_LOGO_HEIGHT), WEB_LOGO)
    save(make_icon(logo, ICON_SIZE, round(ICON_SIZE * ICON_CORNER_RATIO)), ICON)
    save(make_icon(logo, APPLE_ICON_SIZE, 0), APPLE_ICON)


if __name__ == "__main__":
    main()
