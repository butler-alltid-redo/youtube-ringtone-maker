import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const MAX_START_SECONDS = 6 * 60 * 60; // 6h cap

function extractYouTubeVideoId(inputUrl: string): string {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  const hostname = url.hostname.toLowerCase();
  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
  ]);
  if (!allowedHosts.has(hostname)) {
    throw new Error("Only YouTube links are allowed");
  }

  let id = "";
  if (hostname === "youtu.be") {
    // /<id>
    id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
  } else {
    id = url.searchParams.get("v") ?? "";
    // Support /shorts/<id>
    if (!id) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1]) id = parts[1];
    }
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw new Error("Invalid YouTube video id");
  }

  return id;
}

async function run(cmd: string, args: string[], opts: { cwd: string }) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
    });
  });
}

const RequestSchema = z.object({
  youtubeUrl: z.string().min(1).max(2048),
  startSeconds: z.number().int().min(0).max(MAX_START_SECONDS),
  durationSeconds: z.number().int().min(1).max(30),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { youtubeUrl, startSeconds, durationSeconds } = parsed.data;

  let videoId: string;
  try {
    videoId = extractYouTubeVideoId(youtubeUrl);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid YouTube URL" },
      { status: 400 },
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `ringtone-${randomUUID()}-`));
  const inputPath = path.join(workDir, "input.m4a");
  const outputPath = path.join(workDir, "ringtone.m4r");

  try {
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Download best available audio (prefer m4a). Output name is fixed.
    await run(
      "yt-dlp",
      [
        "--no-playlist",
        "--max-filesize",
        "200M",
        "-f",
        "ba[ext=m4a]/ba",
        "-x",
        "--audio-format",
        "m4a",
        "-o",
        "input.%(ext)s",
        canonicalUrl,
      ],
      { cwd: workDir },
    );

    // yt-dlp will produce input.m4a (because of -o + audio-format)
    // but depending on version it might produce input.m4a already; verify.
    try {
      await fs.access(inputPath);
    } catch {
      // fallback: pick first .m4a in directory
      const files = await fs.readdir(workDir);
      const m4a = files.find((f) => f.toLowerCase().endsWith(".m4a"));
      if (!m4a) throw new Error("Download succeeded but no .m4a file was found");
      await fs.rename(path.join(workDir, m4a), inputPath);
    }

    // Fade settings (seconds)
    const fade = Math.min(2, Math.max(0.25, durationSeconds / 3));
    const fadeOutStart = Math.max(0, durationSeconds - fade);
    const af = `afade=t=in:st=0:d=${fade},afade=t=out:st=${fadeOutStart}:d=${fade}`;

    // Generate ringtone segment. We seek/trim so the filter timeline starts at 0.
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(startSeconds),
        "-t",
        String(durationSeconds),
        "-i",
        inputPath,
        "-f",
        "mp4",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-af",
        af,
        "-y",
        outputPath,
      ],
      { cwd: workDir },
    );

    const buf = await fs.readFile(outputPath);
    return new Response(buf, {
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Disposition": 'attachment; filename="ringtone.m4r"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to generate ringtone" },
      { status: 500 },
    );
  } finally {
    // best-effort cleanup
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
