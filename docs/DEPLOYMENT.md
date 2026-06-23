# Deployment Guide

This guide covers a practical production deployment for Factory Flow ERP.

## Architecture

- Frontend: Vite/React static build from `frontend/dist`.
- Backend: Node.js/Express API from `backend/server.js`.
- Database: MongoDB.
- Public URLs:
  - Frontend: `https://app.yourdomain.com`
  - Backend API: `https://api.yourdomain.com/api`
  - Health check: `https://api.yourdomain.com/api/health`

## Production Checklist

Before production traffic:

1. Run CI on the target commit.
2. Configure production backend environment variables.
3. Configure production frontend `VITE_API_BASE_URL`.
4. Enable HTTPS for both frontend and backend.
5. Set `CORS_ORIGIN` to the exact frontend origin.
6. Set a strong `JWT_SECRET` with at least 32 characters.
7. Confirm MongoDB backups are scheduled and restore has been tested.
8. Confirm `/api/health` is reachable after deploy.
9. Create the first platform super-admin and tenant admin accounts.
10. Verify login, tenant switching, order flow, inventory posting, and finance exports.

## Backend

Install and run:

```bash
cd backend
npm ci --omit=dev
NODE_ENV=production npm start
```

Required production variables:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://...
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
CORS_ORIGIN=https://app.yourdomain.com
TRUST_PROXY=true
LOG_LEVEL=info
```

Use `backend/env.example` for billing, webhook, SMTP, audit, rate-limit, and platform guardrail options.

Recommended security variables:

```bash
SUPER_ADMIN_STEP_UP_REQUIRED=true
SUPER_ADMIN_IP_ALLOWLIST=203.0.113.10
AUDIT_LOG_ENABLED=true
JSON_BODY_LIMIT=200kb
```

## Frontend

Create `frontend/.env.production` in the hosting environment or set the variable directly in the provider:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

Build:

```bash
cd frontend
npm ci
npm run build
```

Deploy the generated `frontend/dist` directory to the static hosting provider.

## Reverse Proxy Example

Example nginx backend proxy:

```nginx
server {
  listen 443 ssl http2;
  server_name api.yourdomain.com;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

When using a reverse proxy, set `TRUST_PROXY=true` so rate limits and IP guardrails use the forwarded client IP.

## GitHub Actions Deployment

The repository includes:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

The deploy workflow triggers provider deploy hooks after CI succeeds on `main`.

Create a GitHub environment named `production` and set:

```text
BACKEND_DEPLOY_HOOK_URL
FRONTEND_DEPLOY_HOOK_URL
PROD_HEALTHCHECK_URL=https://api.yourdomain.com/api/health
```

Add required reviewers to the `production` environment if releases need manual approval.

## Smoke Test

After every production deploy:

```bash
curl --fail https://api.yourdomain.com/api/health
```

Then verify in the UI:

1. Login works.
2. Dashboard loads without API errors.
3. Tenant module flags hide and block disabled modules.
4. Create and read a harmless test record in a non-production tenant.

## Rollback

Keep the previous backend release and frontend static bundle available.

Rollback order:

1. Stop new deploys.
2. Restore the previous frontend bundle.
3. Restore the previous backend version.
4. Restart backend process.
5. Run `/api/health`.
6. Only restore MongoDB if a migration or data write corrupted production data.

Database restore steps are covered in `docs/BACKUPS_AND_RESTORE.md`.
