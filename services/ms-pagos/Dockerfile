FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=ms-pagos --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=ms-pagos

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=ms-pagos
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ms-pagos/dist ./services/ms-pagos/dist
EXPOSE 3003
CMD ["node", "services/ms-pagos/dist/server.js"]
