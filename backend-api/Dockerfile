FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY backend-api/package.json backend-api/
RUN pnpm install --frozen-lockfile
COPY packages/contracts packages/contracts
COPY backend-api backend-api
RUN pnpm --filter backend-api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
COPY --from=builder --chown=appuser:appgroup /app/backend-api/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/backend-api/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
