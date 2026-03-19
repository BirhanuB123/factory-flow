# Deployment (HTTPS, env, hardening)

## Environment

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Production cluster connection string |
| `JWT_SECRET` | **Required**, ≥32 random characters |
| `TRUST_PROXY` | `true` if behind nginx/ALB (rate limit + logs) |
| `CORS_ORIGIN` | Frontend origin, e.g. `https://erp.example.com` |
| `AUDIT_LOG_ENABLED` | `true` to log product/BOM changes and manual stock moves |

Frontend build: set `VITE_API_BASE_URL=https://api.example.com/api` before `npm run build`.

## HTTPS (reverse proxy)

Terminate TLS at **nginx** or a load balancer; Node listens on HTTP locally.

Example nginx snippet:

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;
  ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location /api {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Set `TRUST_PROXY=true` so `express-rate-limit` uses the real client IP.

## What’s already in the API

- **Helmet** security headers (CSP relaxed in non-production).
- **Rate limiting**: login (30/15min), global API (600/min) — tunable via env.
- **JSON body limit** (default 200kb).
- **Structured request logs** (pino) — pipe to your log stack in production.
