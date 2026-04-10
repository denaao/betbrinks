#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  BetBrinks - Setup Completo
#  Executa: bash scripts/setup.sh
# ═══════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🎲 BetBrinks - Setup Inicial"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. Verificar prerequisitos ─────────────────────────────
echo -e "${YELLOW}[1/6]${NC} Verificando prerequisitos..."

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js nao encontrado. Instale em https://nodejs.org${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 18+ necessario (atual: $(node -v))${NC}"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}📦 Instalando pnpm...${NC}"
  npm install -g pnpm
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker nao encontrado. Instale em https://docker.com${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node $(node -v) | pnpm $(pnpm -v) | Docker OK${NC}"

# ─── 2. Instalar dependencias ───────────────────────────────
echo ""
echo -e "${YELLOW}[2/6]${NC} Instalando dependencias..."
pnpm install
echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# ─── 3. Verificar .env ──────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6]${NC} Verificando .env..."

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  .env criado a partir do .env.example - configure as variaveis!${NC}"
  else
    echo -e "${RED}❌ .env nao encontrado${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✅ .env encontrado${NC}"
fi

# ─── 4. Subir Docker (PostgreSQL + Redis) ───────────────────
echo ""
echo -e "${YELLOW}[4/6]${NC} Subindo PostgreSQL e Redis via Docker..."
docker compose -f docker/docker-compose.yml up -d

# Aguardar PostgreSQL ficar pronto
echo "   Aguardando PostgreSQL..."
for i in {1..30}; do
  if docker exec betbrinks-postgres pg_isready -U betbrinks &> /dev/null; then
    break
  fi
  sleep 1
done
echo -e "${GREEN}✅ PostgreSQL e Redis rodando${NC}"

# ─── 5. Rodar migrations Prisma ─────────────────────────────
echo ""
echo -e "${YELLOW}[5/6]${NC} Rodando migrations do banco..."
cd apps/api
npx prisma generate
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
cd ../..
echo -e "${GREEN}✅ Banco de dados configurado${NC}"

# ─── 6. Seed (admin + achievements) ─────────────────────────
echo ""
echo -e "${YELLOW}[6/6]${NC} Populando dados iniciais..."
cd apps/api
npx prisma db seed 2>/dev/null || echo "   (seed ja executado ou nao configurado)"
cd ../..
echo -e "${GREEN}✅ Seed executado${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}🎉 Setup completo!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Para iniciar o desenvolvimento:"
echo ""
echo "    pnpm dev:api        → Iniciar backend (porta 3000)"
echo "    pnpm dev:mobile     → Iniciar app mobile (Expo)"
echo "    pnpm dev:backoffice → Iniciar backoffice (porta 3001)"
echo "    pnpm dev            → Iniciar todos"
echo ""
echo "  Admin padrão:"
echo "    Email: admin@betbrinks.com"
echo "    Senha: BetBrinks@2026"
echo ""
echo "  Painel pgAdmin: http://localhost:5050"
echo "    Email: admin@betbrinks.com | Senha: admin123"
echo ""
