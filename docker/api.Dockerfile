# API image. Build context is the repository root:
#   docker build -f docker/api.Dockerfile -t meal-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# Prisma needs OpenSSL; argon2 ships a prebuilt glibc binary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# apps/web is a workspace member too; pnpm only needs its manifest to honour the lockfile.
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@meal/api..."
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @meal/shared build && pnpm --filter @meal/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo /repo
COPY --chown=node:node docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh
USER node
WORKDIR /repo/apps/api
EXPOSE 3001
ENTRYPOINT ["api-entrypoint.sh"]
