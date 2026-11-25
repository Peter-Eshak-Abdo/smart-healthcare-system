FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY web-admin/package.json web-admin/

RUN pnpm install --frozen-lockfile --filter @smarthealth/contracts --filter web-admin...

COPY packages/contracts packages/contracts
COPY web-admin web-admin

RUN pnpm --filter @smarthealth/contracts build && pnpm --filter web-admin build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/web-admin/.next ./web-admin/.next
COPY --from=builder /app/web-admin/package.json ./web-admin/package.json
COPY --from=builder /app/web-admin/next.config.ts ./web-admin/next.config.ts
COPY --from=builder /app/web-admin/i18n ./web-admin/i18n

USER node
EXPOSE 3000
CMD ["node", "node_modules/.bin/next", "start", "web-admin", "-p", "3000"]
