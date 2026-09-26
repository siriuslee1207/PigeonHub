import type { Member } from "@/data/members";

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function InstagramIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { field: "instagram", label: "Instagram", Icon: InstagramIcon },
  { field: "facebook", label: "Facebook 粉絲專頁", Icon: FacebookIcon },
] as const;

/** 個人頁的社群圖示列：只顯示 members.ts 有填網址的項目，全都沒填就不渲染。 */
export function SocialLinks({ member }: { member: Member }) {
  const links = SOCIAL_LINKS.filter(({ field }) => member[field]);
  if (links.length === 0) return null;

  return (
    <ul className="mt-4 flex justify-center gap-3 sm:justify-start">
      {links.map(({ field, label, Icon }) => (
        <li key={field}>
          <a
            href={member[field]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.displayName} 的 ${label}`}
            title={label}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
