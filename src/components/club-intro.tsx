export function ClubIntro() {
  return (
    <section id="about" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-10">
        <h2 className="text-2xl font-bold tracking-tight">關於鴿友會</h2>
        {/* TODO: 以下簡介為初稿，請鴿友會確認後修改。 */}
        <div className="space-y-4 text-base leading-8 text-foreground/90">
          <p>
            PigeonHub
            是一群熱愛賽鴿的朋友組成的鴿友會。我們來自不同縣市，各有各的鴿舍、血統與訓練方式，卻因為同一片天空聚在一起。
          </p>
          <p>
            這個網站是我們對外的名片：記錄每位鴿友的鴿舍與事蹟，也讓在賽場上、鴿會裡認識的朋友，掃一下名片就能找到我們。
          </p>
        </div>
      </div>
    </section>
  );
}
