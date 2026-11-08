# Online Chess Platform ♟️

> **Academic Capstone Project in Software Engineering & Computer Science**  
> *Real-Time Client-Server Architecture, Authoritative Chess Rules, Google OAuth 2.0, and Custom Minimax AI Engine with Alpha-Beta Pruning.*

[![Build & Tests](https://img.shields.io/badge/tests-72%2F72%20passing-brightgreen)](#7-automated-testing-status)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

---

## 1. Project Overview

**Online Chess** is a production-ready, full-stack, real-time multiplayer chess web application featuring:
- **Server-Authoritative Game Logic**: Moves, clocks, validation, and game terminations (checkmate, stalemate, draw by repetition, 50-move rule, resignation) are authoritatively computed on the server.
- **Precision Clock Synchronization**: High-frequency server ticks paired with smooth client-side interpolation, eliminating timer jitter and desynchronization.
- **Custom Chess AI Search Engine**: Built entirely from scratch using Minimax search, Alpha-Beta pruning, dynamic move ordering (MVV-LVA), and centipawn piece-square tables (no third-party engine dependency).
- **Comprehensive Authentication**: Standard JWT-based local authentication, email verification flows, and **Google OAuth 2.0 Single Sign-On (SSO)**.
- **Social & Competitive System**: Matchmaking lobby, private room codes, FIDE-standard Elo ratings, global leaderboard, in-game chat, and move replay.
- **Administrative Portal**: Real-time system telemetry (CPU, memory, uptime, active connections), user management, and account suspension tools.

The user interface follows a modern dark tournament aesthetic localized in **Vietnamese**, while codebase identifiers, API contracts, and academic documentation are maintained in **English**.

---

## 2. Technology Stack

### Frontend (`apps/web`)
- **React 18** with **TypeScript** and **Vite** (hot module replacement and fast builds).
- **Tailwind CSS** with a custom tournament color palette (`slate-900`, `board-dark`, `board-light`, `clock-amber`).
- **Zustand** for lightweight authentication and UI state management.
- **Socket.IO Client** for low-latency bidirectional game networking.
- **TanStack Query (React Query)** for server-state caching and synchronization.
- **react-chessboard** with custom piece rendering and viewport touch locks (`touch-none`).
- **@react-oauth/google** for Google Identity Services integration.
- **React Hook Form & Zod** for schema validation.
- **Lucide React** for consistent iconography.
- **Nginx (Alpine)** as the production reverse proxy container handling SPA routing, WebSocket upgrades, and API proxying.

### Backend (`apps/server`)
- **Node.js (v20+ / v22+)** with **TypeScript** and **Express.js**.
- **Socket.IO** with custom room gateways, heartbeat mechanisms, and authoritative clock intervals.
- **PostgreSQL 16** for relational persistence.
- **Prisma ORM** for schema migrations, relational integrity, and connection pooling.
- **Google Auth Library** for server-side ID token verification.
- **Nodemailer** for email delivery (verification tokens and account notifications).
- **bcryptjs & jsonwebtoken** for salted password hashing and JWT access/refresh token management.
- **Pino & pino-pretty** for structured JSON logging.
- **Vitest & Supertest** for automated unit, integration, and E2E test suites.

### Custom Chess AI Engine (`apps/server/src/modules/ai`)
- **Minimax Search** with **Alpha-Beta Pruning**.
- **Dynamic Move Ordering**: MVV-LVA (Most Valuable Victim - Least Valuable Attacker), promotion priority, and check extensions.
- **Centipawn Evaluation**: Material balance, Piece-Square Tables (PST) for opening/endgame, king safety metrics, and pawn structure penalties.
- **Configurable Difficulties**:
  - `EASY`: Depth 1 with 35% controlled stochastic variance.
  - `MEDIUM`: Depth 3 with move ordering.
  - `HARD`: Depth 4 with tactical depth extension and full position evaluation.

---

## 3. Monorepo Structure

```
online-chess/
├── apps/
│   ├── web/                     # React 18 + Vite frontend
│   │   ├── nginx.conf           # Production Nginx reverse proxy configuration
│   │   ├── Dockerfile           # Multi-stage production build (Node -> Nginx)
│   │   ├── src/
│   │   │   ├── app/             # App shell, Navbar, Routes
│   │   │   ├── features/        # Feature modules: auth, lobby, game, ai, leaderboard, profile, replay, admin
│   │   │   ├── services/        # Axios API client & Socket.IO singleton
│   │   │   └── stores/          # Zustand authentication store
│   │   └── package.json
│   └── server/                  # Node.js + Express + Socket.IO backend
│       ├── Dockerfile           # Multi-stage production Node.js container
│       ├── prisma/              # Prisma PostgreSQL schema, migrations, seed data
│       ├── src/
│       │   ├── config/          # Dynamic CORS, environment variables, Pino logger
│       │   ├── database/        # Prisma client & connection resilience
│       │   ├── middleware/      # JWT auth, role guard, error handler, Zod validator
│       │   ├── modules/         # auth, users, rooms, matchmaking, games, chess, ai, ratings, admin, mail
│       │   └── sockets/         # Socket.IO game gateway, room manager & clock loops
│       ├── tests/               # Vitest test suites (65 passing tests)
│       └── package.json
├── packages/
│   └── shared/                  # Shared TypeScript types, Zod schemas, constants, socket contracts
│       ├── src/
│       │   ├── constants/       # Chess FEN, time controls, ELO configs, AI settings
│       │   ├── schemas/         # Zod schemas for auth, rooms, moves, chat
│       │   └── types/           # User, Game, Move, Room, Socket payloads
│       └── package.json
├── docs/                        # Complete academic capstone documentation
│   ├── requirements.md          # Functional & non-functional requirements (SRS)
│   ├── architecture.md          # System architecture, class & sequence diagrams
│   ├── database-design.md       # PostgreSQL schema, ERD, tables & indexes
│   ├── api-specification.md     # Versioned REST API documentation (/api/v1)
│   ├── socket-events.md         # WebSocket event contracts & payloads
│   ├── chess-engine.md          # Minimax & Alpha-Beta algorithm specification
│   ├── testing.md               # Automated testing report & verification cases
│   ├── deployment.md            # AWS EC2, Let's Encrypt SSL, Docker & Nginx deployment guide
│   ├── project-analysis.md      # Comprehensive architecture & security analysis
│   └── use-cases.md             # Use case diagram & formal specifications
├── docker-compose.yml           # PostgreSQL 16 + Server + Web Docker setup
├── .env.example                 # Template for environment configuration
├── package.json                 # Monorepo npm workspaces configuration
└── README.md
```

---

## 4. Quick Start Guide

### Prerequisites
- **Node.js** $\ge$ 20.x (LTS recommended)
- **npm** $\ge$ 10.x
- **PostgreSQL** $\ge$ 16 (or run via Docker)

### 1. Installation
Clone the repository and install all workspace dependencies:
```bash
git clone https://github.com/myne4713-debug/ChessProject.git
cd ChessProject
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Ensure database connection parameters and JWT secrets are populated.

### 3. Generate Database Client & Run Migrations
```bash
# Generate Prisma Client
npm run db:generate

# Apply database migrations
npm run db:migrate

# (Optional) Seed initial data (includes admin account)
npm run db:seed
```

### 4. Build Monorepo Packages
```bash
npm run build
```

### 5. Run Automated Tests
Execute the entire test suite across all packages (72 tests):
```bash
npm test
```

### 6. Start Development Servers
```bash
# Terminal 1: Backend Server (runs on http://localhost:4000)
npm run dev:server

# Terminal 2: Web Client (runs on http://localhost:5173)
npm run dev:web
```
Open **`http://localhost:5173`** in your browser.

---

## 5. Docker Production Deployment

Deploy the entire fullstack platform (Database + Backend + Web Reverse Proxy) with a single command:

```bash
# 1. Build and start containers in detached mode
docker compose up -d --build

# 2. Apply database migrations inside the server container
docker compose exec server npx prisma migrate deploy

# 3. Seed default administrator account
docker compose exec server npx prisma db seed
```

### Container Endpoints:
- **Web Application**: `http://localhost:80` (or `https://<your-domain>`)
- **Backend API & Healthcheck**: `http://localhost:4000/api/v1/health`
- **PostgreSQL Database**: `127.0.0.1:5432`

For advanced production deployment with **AWS EC2**, **DuckDNS**, **Let's Encrypt SSL (Certbot)**, and **Google Cloud OAuth Console**, refer to the detailed [Deployment & Operations Guide](docs/deployment.md).

---

## 6. Live Demonstration Walkthrough

### Scenario A: Real-Time Human-vs-Human Multiplayer
1. Open two separate browser tabs or private windows:
   - Window 1: Register player `grandmaster_1` (starts at 1200 Elo).
   - Window 2: Register player `grandmaster_2` (starts at 1200 Elo).
2. In Window 1, navigate to **Sảnh chờ (Lobby)** and click **Tạo Phòng Mới** (select 5m Blitz or 10m Rapid).
3. In Window 2, join using the 6-character room code or click the public room listing.
4. The server assigns colors, starts the clock loops, and redirects both players to `/game/:id`.
5. Play moves (`1. e4 e5`, etc.):
   - State updates bidirectionally via WebSockets.
   - Authoritative clocks count down smoothly on both sides.
   - Illegal moves are rejected by the server.
   - Real-time in-game chat delivers messages instantly.
6. Upon checkmate, timeout, or resignation:
   - Celebration animations fire.
   - Elo rating adjustments are calculated using FIDE Elo formulas and saved to the database.

### Scenario B: Challenging the Custom Chess AI
1. Navigate to **Đấu với AI** (`/ai`).
2. Select difficulty level (`Dễ`, `Trung bình`, `Khó`) and side (`Trắng` / `Đen`).
3. Click **Bắt Đầu Ván Mới**.
4. Play against the AI:
   - Real-time diagnostics display search depth, visited nodes, pruned branches, execution time (ms), and centipawn position evaluation.

### Scenario C: Match Replay & History
1. Navigate to **Lịch sử đấu** (`/history`).
2. Select any finished match to open the Replay Viewer (`/replay/:id`).
3. Use the stepper controls (`|<<`, `<`, `>`, `>>`) to analyze moves, review SAN notation, and reconstruct previous board states.

### Scenario D: Platform Administration
1. Log in with administrator credentials (`admin` / `AdminSecurePass123!`).
2. Navigate to **Quản trị viên** (`/admin`).
3. View platform metrics, total users, active games, server memory/CPU usage, and moderate user accounts (`ACTIVE` / `SUSPENDED`).

---

## 7. Automated Testing Status

The project includes an end-to-end automated testing pipeline powered by **Vitest** and **Supertest** with **100% passing results (72/72 tests)**:

### Backend Test Suites (`apps/server`) — 65 Tests:
- **`tests/auth.test.ts`** (20 tests): User registration, password hashing, JWT validation, Google OAuth verification, email confirmation, profile updates.
- **`tests/game.test.ts`** (15 tests): Room creation, matchmaking, authoritative move execution, resignations, draw offers, FIDE Elo calculations.
- **`tests/chessRules.test.ts`** (8 tests): Turn enforcement, check/checkmate detection, castling legality, en passant, promotion validation.
- **`tests/phase2.test.ts`** (8 tests): Advanced authorization rules, rate limiting, token refresh cycles, account status enforcement.
- **`tests/ai.test.ts`** (6 tests): Minimax search depth, alpha-beta cutoffs, MVV-LVA move ordering, tactical evaluation benchmarks.
- **`tests/health.test.ts`** (4 tests): Healthcheck endpoints, database ping, system uptime, route fallback.
- **`tests/admin.test.ts`** (4 tests): Administrative access controls, telemetry aggregation, account moderation.

### Frontend Test Suites (`apps/web`) — 7 Tests:
- **`tests/authStore.test.ts`** (4 tests): Zustand authentication state, token storage, login/logout synchronization.
- **`tests/chessState.test.ts`** (3 tests): Client-side board state sync, move parsing, legal drag-and-drop validation.

**Total**: `72 passed (72)` across 9 test suites in ~14 seconds.

---

## 8. Academic Capstone Documentation Index

Comprehensive documentation is provided in the `docs/` directory:
- [Requirements Specification (SRS)](docs/requirements.md)
- [System Architecture & Diagrams](docs/architecture.md)
- [Database Design & ERD](docs/database-design.md)
- [REST API Specification](docs/api-specification.md)
- [Socket.IO Event Contracts](docs/socket-events.md)
- [Chess AI Engine Specification](docs/chess-engine.md)
- [Automated Testing Report](docs/testing.md)
- [Deployment & Operations Guide (EC2, SSL, Docker)](docs/deployment.md)
- [Comprehensive Project & Security Analysis](docs/project-analysis.md)
- [Use Case Specifications](docs/use-cases.md)

---

## 9. License & Academic Attribution

Developed as an academic capstone project demonstrating Software Engineering, Distributed Systems, Real-Time Networking, and Artificial Intelligence concepts.

All rights reserved © 2026.
