# Integra ERP

A modern inventory and manufacturing ERP prototype with a React/Vite frontend and an Express/MongoDB backend.

## Repository structure

- `backend/` — Node.js + Express API server
- `frontend/` — Vite React frontend application
- `docs/` — deployment, backup, CI/CD, and workflow documentation

## Current status

- Backend supports inventory movements, BOM-based production, material reservations, purchase orders, invoice creation, AR aging, permissions, and optional audit logging.
- Frontend is built with Vite, React, TypeScript, Tailwind CSS, React Query, and shadcn-ui primitives.
- Environment configuration is separate for backend and frontend.
- Backend tests use Jest; frontend tests use Vitest and Playwright.

## Backend

### Setup

1. Copy `backend/env.example` to `backend/.env`
2. Set `MONGODB_URI` to your MongoDB connection string
3. Set `JWT_SECRET` to a secure value in production (minimum 32 characters)

### Useful scripts

```bash
cd backend
npm install
npm run dev
npm test
npm run test:watch
npm run test:integration
```

### Key dependencies

- `express`
- `mongoose`
- `jsonwebtoken`
- `express-rate-limit`
- `helmet`
- `express-validator`
- `pino`

### Important backend notes

- Default backend port is `5000`.
- `backend/.env.example` includes optional rate-limit and billing webhook config.
- Enable audit logging with `AUDIT_LOG_ENABLED=true`.
- Production requires a strong `JWT_SECRET`.

## Frontend

### Setup

1. Copy `frontend/.env.example` to `frontend/.env` if needed
2. Set `VITE_API_BASE_URL` to your backend API URL

### Useful scripts

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run e2e
```

### Important frontend notes

- Default API URL is `http://localhost:5000/api`
- Production frontend config is in `frontend/.env.production`

## Running locally

Open two terminals:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Then open the Vite development URL shown in the frontend terminal.

## Testing

- Backend: `cd backend && npm test`
- Frontend unit tests: `cd frontend && npm run test`
- Frontend E2E tests: `cd frontend && npm run e2e`
- Lint: `cd frontend && npm run lint`

## Documentation

- `docs/DEPLOYMENT.md` — deployment and HTTPS/proxy guidance
- `docs/BACKUPS_AND_RESTORE.md` — backup and restore instructions
- `docs/CI_CD.md` — CI/CD workflows and deployment secrets
- `docs/ERP_WORKFLOW_GUIDE.md` — ERP workflow guidance

## Technology stack

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Pino
- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn-ui, React Query

## Notes

- There is no repository-level `package.json`; install dependencies in `backend/` and `frontend/` separately.
- Backend dev server uses `nodemon` via `npm run dev`.
- Frontend dev server uses Vite.

---

This README describes the current repository structure, platform status, and available setup commands.
