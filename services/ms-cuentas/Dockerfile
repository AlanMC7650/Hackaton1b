FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=ms-cuentas --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=ms-cuentas

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=ms-cuentas
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ms-cuentas/dist ./services/ms-cuentas/dist
EXPOSE 3002
CMD ["node", "services/ms-cuentas/dist/server.js"]
