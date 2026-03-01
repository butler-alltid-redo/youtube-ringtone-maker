# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

# Install system deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip (apt is often outdated)
RUN pip3 install --no-cache-dir -U yt-dlp

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

EXPOSE 9878

CMD ["npm", "run", "start"]
