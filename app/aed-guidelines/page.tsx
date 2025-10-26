const PDF_URL = '/api/guidelines/pdf';

export default function AEDGuidelinesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-semibold text-white">
            자동심장충격기 설치 및 관리 지침 (제7판)
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            아래 문서는 원본 PDF와 완전히 동일한 내용을 그대로 제공합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-700"
            >
              새 창에서 열기
            </a>
            <a
              href={PDF_URL}
              download
              className="rounded-md border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              PDF 다운로드
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-10 pt-6 lg:px-6">
          <div className="flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-black/30 shadow-2xl">
            <object
              data={`${PDF_URL}#view=FitH`}
              type="application/pdf"
              aria-label="자동심장충격기 설치 및 관리 지침 (제7판)"
              className="h-full min-h-[70vh] w-full"
            >
              <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-sm text-slate-200">
                <p>브라우저에서 PDF 미리보기를 지원하지 않습니다.</p>
                <a
                  href={PDF_URL}
                  download
                  className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:border-slate-500 hover:bg-slate-700"
                >
                  PDF 다운로드
                </a>
              </div>
            </object>
          </div>
        </div>
      </main>
    </div>
  );
}
