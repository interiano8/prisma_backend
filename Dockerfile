# ========================================================
# Build stage
# ========================================================
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts

RUN pnpm run build

# ========================================================
# Runtime stage
# ========================================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=development

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
COPY prisma.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Assets estáticos requeridos por el servicio
COPY Imagenes ./Imagenes

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 5012

ENTRYPOINT ["./docker-entrypoint.sh"]
