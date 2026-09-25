import type { Member } from "@/data/members";
import { MemberAvatar } from "@/components/member-avatar";
import { getAvatarSrc } from "@/data/images";

export function MemberProfile({ member }: { member: Member }) {
  const bioParagraphs = member.bio?.split("\n").filter(Boolean) ?? [];
  const isPresident = member.role === "會長";

  return (
    <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
      <MemberAvatar
        src={getAvatarSrc(member)}
        alt={`${member.displayName} 的頭像`}
        size={192}
        priority
        className="h-32 w-32 shrink-0 sm:h-44 sm:w-44"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
              isPresident
                ? "bg-accent/10 text-accent"
                : "bg-primary/10 text-primary"
            }`}
          >
            {member.role}
          </span>
          {member.isPlaceholder && (
            <span className="inline-block rounded-full bg-muted/15 px-3 py-1 text-xs font-medium text-muted">
              資料待補
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {member.displayName}
        </h1>
        {member.realName && (
          <p className="mt-1 text-muted">{member.realName}</p>
        )}
        {member.location && (
          <p className="mt-1 text-sm text-muted">{member.location}</p>
        )}

        <ul className="mt-5 space-y-1 text-lg leading-8">
          {member.tagline.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>

        {bioParagraphs.length > 0 && (
          <div className="mt-4 space-y-3 leading-8 text-foreground/85">
            {bioParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
