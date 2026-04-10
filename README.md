# 🎲 BetBrinks

Apostas esportivas recreativas com pontos virtuais. Sem dinheiro real.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Redis 7 |
| Mobile | React Native 0.74 + TypeScript + Zustand + Socket.IO |
| Backoffice | Next.js 14 + Tailwind CSS + Recharts |
| Monorepo | pnpm workspaces |

## Setup Rapido

### Prerequisitos

- Node.js 20+
- pnpm 9+
- Docker Desktop

### Windows

```bat
git clone <repo-url> betbrinks
cd betbrinks
scripts\setup.bat
```

### Mac / Linux

```bash
git clone <repo-url> betbrinks
cd betbrinks
bash scripts/setup.sh
```

### Verificar setup

```bash
pnpm setup
```

## Comandos

| Comando | Descricao |
|---------|-----------|
| `pnpm dev` | Inicia API + backoffice |
| `pnpm dev:api` | Inicia apenas o backend (porta 3000) |
| `pnpm dev:mobile` | Inicia o app mobile (Expo) |
| `pnpm dev:backoffice` | Inicia o backoffice (porta 3001) |
| `pnpm build` | Build de producao (shared + api + backoffice) |
| `pnpm test` | Roda todos os testes |
| `pnpm test:e2e` | Roda testes E2E do backend |
| `pnpm db:migrate` | Roda migrations do Prisma |
| `pnpm db:seed` | Popula dados iniciais |
| `pnpm db:studio` | Abre Prisma Studio (GUI do banco) |
| `pnpm docker:up` | Sobe PostgreSQL + Redis |
| `pnpm docker:down` | Para containers Docker |
| `pnpm test:api-football` | Testa conexao com API-Football |

## Estrutura

```
betbrinks/
├── apps/
│   ├── api/                # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/    # Auth, User, Points, Odds, Bet, Diamond,
│   │   │   │               # Ranking, Notification, Gamification, Admin
│   │   │   ├── common/     # Guards, filters, interceptors, Redis
│   │   │   └── prisma/     # Schema, migrations, seed
│   │   └── test/           # Testes E2E
│   ├── mobile/             # React Native app
│   │   └── src/
│   │       ├── screens/    # 10 telas (auth, home, bets, store, ranking...)
│   │       ├── stores/     # Zustand stores
│   │       ├── services/   # API client + Socket.IO
│   │       └── theme/      # Cores, espacamento, tipografia
│   └── backoffice/         # Painel admin Next.js
│       └── src/
│           └── app/
│               └── dashboard/  # KPIs, CRM, Financeiro, Audit, Fixtures
├── packages/
│   └── shared/             # Types, enums, constantes compartilhadas
├── docker/                 # Docker Compose (dev + prod) + Dockerfiles
├── scripts/                # Setup, testes, utilitarios
└── .github/workflows/      # CI/CD
```

## Credenciais (dev)

| Servico | Acesso |
|---------|--------|
| Admin Backoffice | admin@betbrinks.com / BetBrinks@2026 |
| pgAdmin | http://localhost:5050 — admin@betbrinks.com / admin123 |
| Redis Commander | http://localhost:8081 |
| Prisma Studio | `pnpm db:studio` |

## API Endpoints

### Auth
- `POST /auth/register` — Cadastro
- `POST /auth/login` — Login
- `POST /auth/verify-phone` — Verificar OTP
- `POST /auth/refresh` — Refresh token

### Points
- `GET /points/balance` — Saldo
- `POST /points/daily-bonus` — Bonus diario
- `GET /points/transactions` — Historico
- `POST /points/convert-diamonds` — Converter diamantes

### Odds
- `GET /odds/fixtures` — Jogos do dia
- `GET /odds/fixtures/live` — Jogos ao vivo
- `GET /odds/fixtures/:id` — Detalhe do jogo
- `GET /odds/leagues` — Ligas disponiveis

### Bets
- `POST /bets` — Fazer aposta
- `GET /bets/active` — Apostas ativas
- `GET /bets/history` — Historico

### Diamonds
- `GET /diamonds/packages` — Pacotes disponiveis
- `POST /diamonds/purchase` — Comprar diamantes

### Ranking
- `GET /ranking/global` — Ranking geral
- `GET /ranking/weekly` — Ranking semanal
- `GET /ranking/monthly` — Ranking mensal

### Gamification
- `GET /gamification/achievements` — Conquistas
- `GET /gamification/level` — Level e XP

### Admin
- `POST /admin/login` — Login admin
- `GET /admin/dashboard` — KPIs
- `GET /admin/users` — CRM
- `GET /admin/financial` — Financeiro
- `GET /admin/configs` — Configuracoes
- `GET /admin/audit-logs` — Audit log

## WebSocket

Namespace: `/odds`

| Evento | Descricao |
|--------|-----------|
| `join-fixture` | Entrar na sala de um jogo |
| `leave-fixture` | Sair da sala |
| `fixture-update` | Atualizacao de odds em tempo real |
| `live-fixtures` | Broadcast de jogos ao vivo |

## Economia

| Item | Valor |
|------|-------|
| Pontos iniciais | 1.000 |
| Bonus diario | 50 pontos |
| Aposta minima | 10 pontos |
| Aposta maxima | 10.000 pontos |
| Limite diario | 50 apostas |
| Diamantes → Pontos | 1 diamante = 5 pontos |

### Pacotes de Diamantes

| Pacote | Diamantes | Preco |
|--------|-----------|-------|
| Starter | 100 | R$ 4,90 |
| Popular | 500 | R$ 19,90 |
| Pro | 1.200 | R$ 39,90 |
| VIP | 3.000 | R$ 79,90 |

## Deploy Producao

```bash
# Build e subir com Docker
pnpm docker:prod

# Ou build individual
pnpm build
```

## Licenca

Proprietario — BETREX GROUP LLC
