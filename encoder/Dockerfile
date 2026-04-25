FROM node:22-bookworm-slim

WORKDIR /app

# Install ffmpeg via apt — more robust than ffmpeg-static which depends on
# pnpm postinstall scripts that get filtered by default in pnpm 9+.
# The Debian package is well-maintained and gives us a known-good binary
# at a stable path (/usr/bin/ffmpeg). CA certs needed for HTTPS to R2.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# pnpm needs the workspace YAML at install time to resolve --filter ./encoder.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY encoder/package.json ./encoder/

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter ./encoder

COPY encoder ./encoder

WORKDIR /app/encoder
CMD ["pnpm", "start"]
