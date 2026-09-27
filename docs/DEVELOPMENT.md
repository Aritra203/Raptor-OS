# RaptorOS Development Workflow Guide

This document outlines the standard development conventions, toolchains, and quality verification workflows for contributing to RaptorOS.

---

## 1. Prerequisites

- **Node.js**: `22.x` (LTS, specified in `.nvmrc` and `.node-version`)
- **npm**: `v10.x` or `v11.x`
- **Docker**: Docker Engine 24+ and Docker Compose v2+
- **Git**

---

## 2. Setting Up Your Local Workspace

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` matches your local database credentials.

### Step 3: Start Local PostgreSQL (via Docker)
If running bare-metal development:
```bash
docker compose up -d postgres
```

### Step 4: Run Migrations and Seed
```bash
npm run prisma:migrate
npm run prisma:seed
```

### Step 5: Start Next.js Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 3. Standard Developer Verification Pipeline

Before submitting any commit or pull request, run the CI-equivalent verification sequence locally:

```bash
# 1. Lint code for style and best practices
npm run lint

# 2. Verify strict TypeScript compliance
npm run typecheck

# 3. Run all unit and integration tests
npm run test

# 4. Verify production bundle compiles cleanly
npm run build
```

Every command must exit with code 0.

---

## 4. Testing Guidelines

### Unit Tests (`tests/unit/`)
- Place isolated logic tests in `tests/unit/`.
- Must execute quickly without network or external database dependencies.
- Command: `npm run test:unit`

### Integration Tests (`tests/integration/`)
- Place service, API route, and repository interaction tests in `tests/integration/`.
- Mock external network boundaries or use test containers.
- Command: `npm run test:integration`

### End-to-End Tests (`e2e/`)
- Place user journey and DOM interaction tests in `e2e/`.
- Command: `npm run test:e2e`

---

## 5. Dockerized Testing & Validation

To test the entire containerized deployment:
```bash
# Build the production image
docker compose build

# Boot all services with health checks
docker compose up -d

# Verify logs and migration execution
docker compose logs -f web

# Probe health endpoint
curl -s http://localhost:3000/api/health

# Clean shutdown
docker compose down
```

---

## 6. Code Style & Hygiene Rules

1. **TypeScript Strict Mode**: Never use `any`. Always provide explicit types for function arguments, return types, and complex objects.
2. **Server/Client Isolation**: Never import `prisma`, `server/`, or `DATABASE_URL` in client components (`"use client"`).
3. **Secret Redaction**: Never log passwords, tokens, authorization headers, or database connection strings. Use `logger.info()` or `logger.error()`.
4. **No External CDNs**: Do not load fonts, scripts, or stylesheets from remote URLs (Google Fonts, unpkg, cdnjs). Keep everything bundled locally.
