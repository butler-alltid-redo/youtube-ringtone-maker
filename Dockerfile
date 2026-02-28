# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

# Install system deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg yt-dlp ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

EXPOSE 9878

CMD ["npm", "run", "start"]
