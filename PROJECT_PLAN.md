# YouTube → iOS Ringtone (Next.js) — Project Plan

## Goal
A small web app that lets a user:
- Paste a YouTube link
- Choose a start time
- Choose a duration (1–30s, slider)
- Generate and download an **.m4r** iOS ringtone

Server-side (Next.js) runs `yt-dlp` + `ffmpeg` safely (no shell injection).

## Scope
### UI (React + Tailwind)
- Inputs:
  - **YouTube URL** (string)
  - **Start time** (mm:ss or seconds)
  - **Duration** (slider 1–30 seconds)
- Button: **Generate ringtone**
- Output:
  - Download of resulting file (`ringtone.m4r`) in browser
  - Inline error messages

### Backend (Next.js Route Handler)
- `POST /api/ringtone`
  - Validates inputs
  - Extracts canonical YouTube video id
  - Downloads best audio as `.m4a` via `yt-dlp`
  - Trims/transcodes to `.m4r` via `ffmpeg`
  - Applies fade in/out based on duration (e.g. 2s, capped)
  - Streams file back as `audio/mp4` with `Content-Disposition: attachment`

## Security model
- **No user-controlled strings** are passed to a shell.
  - Use `child_process.spawn()` with `shell: false` and explicit arg arrays.
- Strict input validation:
  - YouTube URL must parse via `new URL()`
  - Allowlist hosts: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`
  - Extract `v` param or pathname id and validate `^[A-Za-z0-9_-]{11}$`
  - Start time and duration must be numbers in range:
    - startSeconds: `>= 0` and `<= 6 hours` (reasonable cap)
    - durationSeconds: `1..30`
- Resource limits:
  - Per-request temp directory
  - Size/time caps where possible
  - Cleanup temp files in `finally`

## Audio pipeline
1. `yt-dlp` download audio:
   - Format: `ba[ext=m4a]/ba`
   - Output template into temp dir: `input.%(ext)s`
2. `ffmpeg` generate ringtone:
   - Seek/trim: `-ss <start> -t <duration>`
   - Output: `.m4r` (MP4 container with AAC)
   - Filter:
     - `fadeIn = min(2, duration/3)`
     - `fadeOutStart = max(0, duration - fadeIn)`
     - `afade=in:st=0:d=fadeIn,afade=out:st=fadeOutStart:d=fadeIn`

## Docker
- Base: `node:20-bookworm-slim` (or similar)
- Install: `ffmpeg` + `yt-dlp`
- Build Next.js
- Run on port **9878** (`next start -p 9878`)

## Repo deliverables
- Next.js + Tailwind app
- `Dockerfile`
- `README.md` with:
  - Local dev steps
  - Docker build/run steps
  - Security notes

## Execution order
1. Create repo skeleton + write this plan file
2. Commit and push to GitHub
3. Scaffold Next.js + Tailwind
4. Implement API + validation + download response
5. Implement UI
6. Add Dockerfile
7. Final tests (local + docker)
