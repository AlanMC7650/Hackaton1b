FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspace=@chuno/shared --workspace=ms-prestamos --include-workspace-root
RUN npm run build --workspace=@chuno/shared --workspace=ms-prestamos

FROM node:22-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY . .
RUN npm pkg delete scripts.prepare --workspace=@chuno/shared && npm ci --omit=dev --workspace=@chuno/shared --workspace=ms-prestamos
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ms-prestamos/dist ./services/ms-prestamos/dist
EXPOSE 3005
CMD ["node", "services/ms-prestamos/dist/server.js"]
