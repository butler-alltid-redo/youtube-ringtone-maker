# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

# Install system deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

# Install yt-dlp in a venv (Debian uses PEP 668: global pip installs may fail)
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV \
  && $VIRTUAL_ENV/bin/pip install --no-cache-dir -U pip yt-dlp
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

EXPOSE 9878

CMD ["npm", "run", "start"]
