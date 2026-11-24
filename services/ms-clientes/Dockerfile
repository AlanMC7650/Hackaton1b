FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=ms-clientes --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=ms-clientes

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=ms-clientes
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ms-clientes/dist ./services/ms-clientes/dist
EXPOSE 3001
CMD ["node", "services/ms-clientes/dist/server.js"]
