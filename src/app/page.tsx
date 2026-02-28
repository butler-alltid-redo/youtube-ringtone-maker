"use client";

import { useMemo, useState } from "react";

function parseStartTimeToSeconds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  // Allow plain seconds
  if (/^\d+$/.test(s)) {
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  // Allow mm:ss or hh:mm:ss
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;

  if (parts.length === 2) {
    const [mm, ss] = parts;
    if (ss < 0 || ss > 59) return null;
    return mm * 60 + ss;
  }

  const [hh, mm, ss] = parts;
  if (mm < 0 || mm > 59) return null;
  if (ss < 0 || ss > 59) return null;
  return hh * 3600 + mm * 60 + ss;
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [startTime, setStartTime] = useState("0:40");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSeconds = useMemo(() => parseStartTimeToSeconds(startTime), [startTime]);

  async function onGenerate() {
    setError(null);

    if (!youtubeUrl.trim()) {
      setError("Paste a YouTube URL.");
      return;
    }

    if (startSeconds === null) {
      setError("Start time must be seconds, mm:ss, or hh:mm:ss.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/ringtone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          startSeconds,
          durationSeconds,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as unknown;
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : null;
        throw new Error(msg || `Request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "ringtone.m4r";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ringtone");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">YouTube → iOS Ringtone</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Generates a .m4r ringtone by downloading audio with yt-dlp and trimming it with ffmpeg.
        </p>

        <div className="mt-10 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-2">
            <label className="text-sm font-medium">YouTube URL</label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-200"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <input
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-200"
                placeholder="mm:ss (e.g. 0:40)"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Seconds, mm:ss, or hh:mm:ss</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Duration</label>
                <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
                  {durationSeconds}s
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>1s</span>
                <span>30s</span>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            onClick={onGenerate}
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white"
          >
            {busy ? "Generating…" : "Generate ringtone (.m4r)"}
          </button>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Note: generation happens server-side. This will download the audio and run ffmpeg on the server.
          </p>
        </div>
      </main>
    </div>
  );
}
