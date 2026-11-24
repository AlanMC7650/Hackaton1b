FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=gateway --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=gateway

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=gateway
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/gateway/dist ./gateway/dist
EXPOSE 8080
CMD ["node", "gateway/dist/server.js"]
