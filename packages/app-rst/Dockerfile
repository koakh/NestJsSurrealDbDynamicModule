# syntax=docker/dockerfile:1
# =============================================================================
# app-rst demo image — BUILD FROM THE REPO ROOT, the yarn workspace must resolve:
#   docker compose build                (from packages/app-rst, compose sets the context)
#   docker build -f packages/app-rst/Dockerfile .   (from the repo root)
# =============================================================================

# ---- builder: install workspace dependencies, build app-lib then app-rst ----
FROM node:22-alpine AS builder
WORKDIR /repo
# corepack provides yarn 4 (version pinned by the root packageManager field)
RUN corepack enable
# copy the workspace manifests + lockfile first for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/app-lib/package.json packages/app-lib/
COPY packages/app-rst/package.json packages/app-rst/
# --mode=skip-build prevents the app-lib `prepare` script from running here.
# yarn hoists everything to the root node_modules, ensure the per-package dirs
# exist so the runner stage can COPY them unconditionally
RUN yarn install --mode=skip-build \
 && mkdir -p packages/app-lib/node_modules packages/app-rst/node_modules
# copy sources and build (the lib first, the app resolves it as workspace:^)
COPY packages/app-lib packages/app-lib
COPY packages/app-rst packages/app-rst
RUN yarn --cwd packages/app-lib build \
 && yarn --cwd packages/app-rst build

# ---- runner: production image -----------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# hoisted workspace node_modules + the per-package links
COPY --from=builder --chown=node:node /repo/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/packages/app-rst/node_modules ./packages/app-rst/node_modules
COPY --from=builder --chown=node:node /repo/packages/app-lib/node_modules ./packages/app-lib/node_modules
# the workspace:^ resolution target is the app-lib package (main: dist/index.js)
COPY --from=builder --chown=node:node /repo/packages/app-lib/package.json ./packages/app-lib/package.json
COPY --from=builder --chown=node:node /repo/packages/app-lib/dist ./packages/app-lib/dist
COPY --from=builder --chown=node:node /repo/packages/app-rst/package.json ./packages/app-rst/package.json
COPY --from=builder --chown=node:node /repo/packages/app-rst/dist ./packages/app-rst/dist
USER node
# configure via env: SURREALDB_URL, SURREALDB_NAMESPACE/DATABASE/USERNAME/PASSWORD,
# HTTP_SERVER_PORT, ... (see .env.sample); no .env inside the image on purpose
CMD [ "node", "/repo/packages/app-rst/dist/main.js" ]
