import type { Highlight } from "@/data/members";

type Props = {
  highlights: Highlight[];
  isPlaceholder?: boolean;
};

export function HighlightList({ highlights, isPlaceholder }: Props) {
  const sorted = [...highlights].sort((a, b) => b.year - a.year);

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight">事蹟</h2>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {isPlaceholder ? "事蹟資料整理中，敬請期待。" : "目前尚無事蹟紀錄。"}
        </p>
      ) : (
        <ol className="mt-6 border-l-2 border-line">
          {sorted.map((item, index) => (
            <li
              key={`${item.year}-${item.title}-${index}`}
              className="relative pb-8 pl-6 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[7px] h-3 w-3 rounded-full bg-accent ring-4 ring-background"
              />
              <time
                dateTime={String(item.year)}
                className="text-sm font-medium text-accent"
              >
                {item.year}
              </time>
              <h3 className="mt-1 font-bold">{item.title}</h3>
              {item.description && (
                <p className="mt-1 text-sm leading-7 text-muted">
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
