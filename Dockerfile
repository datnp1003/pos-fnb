# =============================================================================
# Stage 1 — deps
# Instala APENAS as dependências de produção para cache de camada eficiente.
# =============================================================================
FROM node:22-alpine AS deps

# Dependências nativas necessárias para alguns pacotes (sharp, bcryptjs, etc.)
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia apenas os manifestos de dependência para cache de camada
COPY package.json package-lock.json ./

# Instala TODAS as dependências (dev + prod) — precisamos das dev para o build
RUN npm install -g npm@11 && npm ci

# =============================================================================
# Stage 2 — builder
# Gera o Prisma Client e faz o build da aplicação Next.js.
# Segredos NÃO são embutidos na imagem — apenas ARGs de build opcionais.
# =============================================================================
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copia node_modules do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copia todo o código-fonte
COPY . .

# Gera o Prisma Client (necessário antes do build do Next.js)
# DATABASE_URL só é necessária em runtime; o generate apenas lê o schema.
RUN npx prisma generate

# Build do Next.js — a variável NEXT_TELEMETRY_DISABLED evita pings externos
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# =============================================================================
# Stage 3 — seeder (usado para rodar prisma/seed.ts com todas as dependências)
# =============================================================================
FROM node:22-alpine AS seeder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json  ./package.json

CMD ["npx", "tsx", "prisma/seed.ts"]

# =============================================================================
# Stage 4 — runner (imagem final)
# Copia apenas o output standalone, tornando a imagem mínima (~200 MB).
# =============================================================================
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

# Cria um usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copia apenas o output standalone gerado pelo Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Copia schema e migrations do Prisma para que prisma migrate deploy
# possa ser executado dentro do container (via entrypoint ou job externo)
COPY --from=builder --chown=nextjs:nodejs /app/prisma          ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copia o entrypoint que roda migrate antes de iniciar o servidor
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# O entrypoint garante que as migrations rodem antes do servidor iniciar
ENTRYPOINT ["./docker-entrypoint.sh"]
