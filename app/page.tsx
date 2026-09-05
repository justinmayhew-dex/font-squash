'use client'

import FontCompress, { FontItem } from "./FontCompress";
import { ChangeEvent, useRef, useState } from "react";

export default function Home() {
  const [fonts, setFonts] = useState<FontItem[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const openFileSelect = () => {
    input.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) return;

    setFonts(prev => [
      ...prev,
      ...files.map(file => ({
        file,
        state: "pending" as const,
      })),
    ]);

    // Allow selecting the same file again.
    e.target.value = "";
  };

  const updateFont = (
    index: number,
    update: Partial<FontItem>
  ) => {
    setFonts(prev =>
      prev.map((font, i) =>
        i === index
          ? { ...font, ...update }
          : font
      )
    );
  };

  const downloadFont = (font: FontItem) => {
    if (!font.woff2) return;

    const blob = new Blob([font.woff2], {
      type: "font/woff2",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const filename = font.file.name.replace(
      /\.(ttf|otf)$/i,
      ""
    );

    a.href = url;
    a.download = `${filename}-optimized.woff2`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getSavings = (font: FontItem) => {
    if (!font.woff2) return null;

    const original = font.file.size;
    const optimized = font.woff2.byteLength;

    const percentage = Math.round(
      (1 - optimized / original) * 100
    );

    return {
      percentage,
      original,
      optimized,
    };
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 flex-col items-center px-6 py-16 sm:px-8 sm:py-24">
        <div className="flex w-full max-w-2xl flex-1 flex-col items-center">

          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-black/[.08] bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:border-white/[.12] dark:bg-zinc-950 dark:text-zinc-400">
              Font Optimizer
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
              Make your fonts smaller.
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Subset and compress your font files into lightweight,
              browser-ready WOFF2 fonts.
            </p>
          </div>

          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={openFileSelect}
              className="flex h-14 w-full items-center justify-center rounded-full bg-black px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Load Font
            </button>

            <p className="mt-3 text-center text-sm text-zinc-500">
              TTF and OTF files supported
            </p>

            <input
              ref={input}
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {fonts.length > 0 && (
            <div className="mt-10 w-full space-y-3">
              {fonts.map((font, index) => {
                const savings = getSavings(font);

                return (
                  <div
                    key={`${font.file.name}-${index}`}
                    className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {font.file.name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {formatSize(font.file.size)}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {font.state === "pending" && (
                          <span className="text-sm text-zinc-500">
                            Waiting
                          </span>
                        )}

                        {font.state === "processing" && (
                          <span className="text-sm text-zinc-500">
                            Optimizing...
                          </span>
                        )}

                        {font.state === "error" && (
                          <span className="text-sm text-red-600 dark:text-red-400">
                            Error
                          </span>
                        )}

                        {font.state === "done" && savings && (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            {savings.percentage}% smaller
                          </span>
                        )}
                      </div>
                    </div>

                    {font.state === "done" && savings && (
                      <div className="mt-4 flex items-center justify-between border-t border-black/[.06] pt-4 dark:border-white/[.08]">
                        <div className="text-sm text-zinc-500">
                          {formatSize(savings.original)}
                          {" → "}
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {formatSize(savings.optimized)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadFont(font)}
                          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        >
                          Download
                        </button>
                      </div>
                    )}

                    {font.state === "error" && font.error && (
                      <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                        {font.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {fonts.length === 0 && (
            <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Subset
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Keep only the characters you need.
                </p>
              </div>

              <div className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Compress
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Generate an optimized WOFF2 file.
                </p>
              </div>

              <div className="rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Private
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Fonts are processed directly in your browser.
                </p>
              </div>
            </div>
          )}

          {fonts.map((font, index) => (
            <FontCompress
              key={`${font.file.name}-${index}`}
              font={font}
              onUpdate={(update) => updateFont(index, update)}
            />
          ))}

        </div>

        <footer className="mt-12 text-center text-xs text-zinc-400">
          Font optimization happens locally in your browser.
        </footer>
      </main>
    </div>
  );
}
