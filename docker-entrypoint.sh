#!/bin/sh
# docker-entrypoint.sh
# Executa as migrations do Prisma e em seguida inicia o servidor Next.js.
# Deve ser copiado para dentro da imagem com permissão de execução (chmod +x).

set -e

echo "▶ Rodando prisma db push..."
npx prisma db push --accept-data-loss

echo "✅ Banco de dados sincronizado. Iniciando o servidor..."
exec node server.js
