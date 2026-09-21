import Image from "next/image";
import logo from "@/assets/logo.png";

type Props = {
  /** 顯示高度（px）。寬度依 logo 原始比例自動計算，讓 next/image 只產生剛好夠用的尺寸。 */
  height: number;
  className?: string;
  /** 首屏就看得到的位置（例如 header）設為 true，避免延遲載入。 */
  priority?: boolean;
};

/**
 * 網站 logo。圖檔 src/assets/logo.png 由 scripts/logo/make_logo_assets.py 從 data/logo/logo.png 產生。
 * 純裝飾用途（旁邊一律有文字），所以 alt 留空。
 */
export function SiteLogo({ height, className, priority }: Props) {
  const width = Math.round((logo.width / logo.height) * height);
  return (
    <Image
      src={logo}
      alt=""
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
