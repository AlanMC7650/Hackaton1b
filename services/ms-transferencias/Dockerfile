FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=ms-transferencias --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=ms-transferencias

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=ms-transferencias
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ms-transferencias/dist ./services/ms-transferencias/dist
EXPOSE 3004
CMD ["node", "services/ms-transferencias/dist/server.js"]
