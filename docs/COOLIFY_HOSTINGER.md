# Deploying Factory Flow on Hostinger with Coolify

Deploy this repository as **two Coolify applications from the same GitHub repository**:

| Application | Repository base directory | Public domain | Internal port |
| --- | --- | --- | --- |
| Frontend | `/frontend` | `https://app.example.com` | `80` |
| Backend API | `/backend` | `https://api.example.com` | `3000` |

Replace the example domains with your real subdomains. Keeping the frontend and API on separate subdomains makes the Vite build, CORS policy, HTTPS certificates, and webhook URLs explicit.

## 1. Prepare Hostinger and DNS

1. Create a Hostinger VPS using its Coolify template, or use the Coolify panel link provided in hPanel. Do not install a second copy of Coolify on top of that template.
2. Point these DNS records at the VPS public IP:
   - `app.example.com` A record
   - `api.example.com` A record
   - optionally, `coolify.example.com` A record for the Coolify dashboard
3. Allow public TCP ports `80` and `443`; restrict SSH (`22`) to trusted IP addresses.
4. In Coolify, connect GitHub through the GitHub App and grant it access to `BirhanuB123/factory-flow`.

Coolify's GitHub connection should receive push webhooks directly. Do not expose either application with a host port; assign domains in Coolify and let its proxy terminate HTTPS.

## 2. Provision MongoDB first

Set up MongoDB before deploying the API. MongoDB Atlas is the simplest production choice because this application uses database transactions in POS, payment, shipment, and production flows. Those require a replica-set-capable MongoDB deployment.

1. Create a database and application user.
2. Permit the VPS public IP in the database network access rules.
3. Copy the application connection string for `MONGODB_URI`.
4. Enable and test automated backups.

If you host MongoDB through Coolify instead, configure it as a replica set rather than a standalone server, and do not make its database port public.

## 3. Create the backend application

In the Coolify project/environment, add an application from the GitHub repository and configure it as follows:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Base directory | `/backend` |
| Build pack | `Dockerfile` |
| Dockerfile location | `/Dockerfile` |
| Port | `3000` |
| Domain | `https://api.example.com` |
| Health check | `/api/health` on port `3000` |
| Watch paths | `/backend/**` |

Add these runtime environment variables in Coolify:

```dotenv
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=use-a-random-secret-at-least-32-characters-long
CORS_ORIGIN=https://app.example.com
TRUST_PROXY=true
LOG_LEVEL=info
APP_PUBLIC_URL=https://app.example.com
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://api.example.com
```

`BACKEND_URL` is required for Chapa POS callbacks. Configure the other optional billing, SMTP, audit, rate-limit, and super-admin variables from [`backend/env.example`](../backend/env.example) if those features are enabled.

Add a persistent storage mount to the backend application:

| Container path | Purpose |
| --- | --- |
| `/usr/src/app/uploads` | Uploaded avatars and other local upload files |

Deploy the backend, wait for the health check to become healthy, then visit `https://api.example.com/api/health`. It should return JSON with `"status": "OK"`.

For a new, empty database, run `npm run migrate:tenant` once from the Coolify terminal before provisioning the first platform super-admin. Then temporarily add these environment variables in Coolify and run `npm run bootstrap:super-admin` from the backend terminal:

```dotenv
BOOTSTRAP_CONFIRM=CREATE_INITIAL_SUPER_ADMIN
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=use-a-unique-12-plus-character-password
# Optional: BOOTSTRAP_ADMIN_NAME=Platform Super Admin
# Optional: BOOTSTRAP_ADMIN_EMPLOYEE_ID=PLATFORM-SUPER-ADMIN
```

The bootstrap command only works when no platform super-admin exists, hashes the supplied password, and forces a password change at first login. Delete the temporary `BOOTSTRAP_ADMIN_*` variables after it succeeds.

## 4. Create the frontend application

Create a second application using the same GitHub repository:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Base directory | `/frontend` |
| Build pack | `Nixpacks` |
| Application type | Static SPA |
| Publish directory | `/dist` |
| Port | `80` |
| Domain | `https://app.example.com` |
| Watch paths | `/frontend/**` |

Set these **build-time** variables, then deploy:

```dotenv
NIXPACKS_NODE_VERSION=22
VITE_API_BASE_URL=https://api.example.com/api
```

`VITE_API_BASE_URL` is compiled into the Vite bundle. It must be set before every frontend build and must include `/api`. A runtime-only variable will not change an already-built frontend.

Choose the SPA/static application option so unknown browser routes fall back to `index.html`; this app uses client-side routing.

## 5. Verify the complete deployment

After both applications are healthy:

1. Open `https://app.example.com` and log in.
2. In browser developer tools, confirm API requests go to `https://api.example.com/api/...`, not `localhost`.
3. Confirm that CORS allows `https://app.example.com` and rejects unexpected origins.
4. Test a harmless upload and redeploy the backend to confirm the persistent upload volume works.
5. Verify billing callback and return URLs if Chapa or Stripe is enabled.

## Automatic deploys and GitHub Actions

Coolify's GitHub App can deploy each application automatically on pushes to `main`. Use the watch paths above so a backend-only change does not rebuild the frontend, and vice versa.

This repository also has `.github/workflows/deploy.yml`, which posts to optional generic deployment hooks. It is not needed for Coolify's direct GitHub integration. When no hook secrets are configured, the workflow now succeeds without triggering a deployment. If you deliberately want GitHub Actions to trigger Coolify instead, set its backend and frontend hook secrets to the corresponding Coolify deploy webhooks. Do not use both mechanisms for the same push unless duplicate deployments are acceptable.

## Common deployment failures

| Symptom | Fix |
| --- | --- |
| Frontend calls `localhost:5000` | Set `VITE_API_BASE_URL` as a **build-time** variable and rebuild the frontend. |
| Browser reports a CORS error | Set `CORS_ORIGIN` to the exact frontend origin, including `https://`, then redeploy the API. |
| Backend starts but production flows fail with transaction errors | Use a MongoDB replica set, not a standalone MongoDB server. |
| Files disappear after a backend redeploy | Attach the `/usr/src/app/uploads` persistent storage mount. |
| Coolify cannot issue a certificate | Check that the subdomain A record resolves to the VPS and that ports 80/443 are reachable. |
