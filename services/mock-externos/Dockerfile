FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=mock-externos --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=mock-externos

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=mock-externos
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/mock-externos/dist ./services/mock-externos/dist
EXPOSE 3010
CMD ["node", "services/mock-externos/dist/server.js"]
