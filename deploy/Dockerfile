# The daily profile job. Railway runs this container on a cron schedule; it
# clones the repo, rotates the quote card, refreshes the ledger, redraws the
# contribution snake, pushes, and exits. See scripts/cron/run.mjs for why the
# work is here rather than in .github/workflows.
#
# Railway requires the process to exit: a container still running when the next
# tick is due causes that tick to be skipped.

FROM node:24-slim

# git to clone and push; ca-certificates for HTTPS to github.com.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installed at build time purely to warm the npm cache. The job runs `npm ci`
# again inside the fresh clone, so what actually executes is always the
# committed lockfile, not this image's copy of it.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY scripts/cron ./scripts/cron

# Sensible defaults; Railway supplies GH_TOKEN as a service variable.
ENV PROFILE_USER=antonsoo \
    PROFILE_REPO=antonsoo/antonsoo \
    NODE_ENV=production

CMD ["node", "scripts/cron/run.mjs"]
