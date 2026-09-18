import type { Member } from "@/data/members";
import { MemberAvatar } from "@/components/member-avatar";

export function MemberProfile({ member }: { member: Member }) {
  const bioParagraphs = member.bio?.split("\n").filter(Boolean) ?? [];

  return (
    <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:gap-10 sm:text-left">
      <MemberAvatar
        src={member.avatar}
        alt={`${member.displayName} 的頭像`}
        size={192}
        priority
        className="h-32 w-32 shrink-0 sm:h-44 sm:w-44"
      />
      <div className="min-w-0 flex-1">
        {member.isPlaceholder && (
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            資料待補
          </span>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {member.displayName}
        </h1>
        {member.realName && (
          <p className="mt-1 text-muted">{member.realName}</p>
        )}

        <dl className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:justify-start">
          <div className="flex gap-2">
            <dt className="text-muted">鴿舍</dt>
            <dd className="font-medium">{member.loftName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">所在地</dt>
            <dd className="font-medium">{member.location}</dd>
          </div>
        </dl>

        <p className="mt-5 text-lg leading-8">{member.tagline}</p>

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
