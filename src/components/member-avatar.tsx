import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  /** 圖片原始尺寸（px），實際顯示大小由 className 控制 */
  size: number;
  className?: string;
  priority?: boolean;
};

export function MemberAvatar({
  src,
  alt,
  size,
  className = "",
  priority,
}: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      className={`aspect-square rounded-full bg-surface object-cover ring-1 ring-line ${className}`}
    />
  );
}
