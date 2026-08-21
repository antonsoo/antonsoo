# The daily profile job: clone the repo, rotate the quote card, refresh the
# ledger, redraw the contribution snake, push. See scripts/cron/run.mjs for why
# the work is here rather than in .github/workflows.
#
# This runs as a LONG-LIVED service, not a Railway cron job, and owns its own
# clock. scripts/cron/daemon.mjs explains why: Railway's scheduler skipped three
# consecutive ticks here with no container and no error.

FROM node:24-slim

# git to clone and push; ca-certificates for HTTPS to github.com.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installed at build time purely to warm the npm cache. The job runs `npm ci`
# again inside the fresh clone, so what actually executes is always the
# committed lockfile, not this image's copy of it.
#
# --include=dev is required, not cosmetic: opentype.js, harfbuzzjs and
# generate-snake-animation are all declared as devDependencies, because for this
# repo the generated assets ARE the product and nothing is shipped as a library.
# A plain `npm ci` under NODE_ENV=production skips all three and gen:all dies
# with ERR_MODULE_NOT_FOUND on opentype.js.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY scripts/cron ./scripts/cron

# Sensible defaults; Railway supplies GH_TOKEN as a service variable.
# NODE_ENV is deliberately NOT set to production: see the npm ci note above.
ENV PROFILE_USER=antonsoo \
    PROFILE_REPO=antonsoo/antonsoo \
    PROFILE_RUN_AT=06:17

CMD ["node", "scripts/cron/daemon.mjs"]
