# CI/CD Setup

The repository includes two GitHub Actions workflows:

- `.github/workflows/ci.yml`: validates every pull request and every push to `main`.
- `.github/workflows/deploy.yml`: triggers production deploy hooks after `main` passes CI.

## CI checks

The CI workflow runs:

1. Frontend dependency install with `npm ci`.
2. Frontend lint, Vitest tests, and production build.
3. Backend dependency install with `npm ci`.
4. Backend Jest suite with `mongodb-memory-server`.

No shared CI database is required.

Frontend lint currently runs as an advisory check because the existing codebase
has a lint backlog. After `cd frontend && npm run lint` passes locally, remove
`continue-on-error: true` from the lint step in `.github/workflows/ci.yml` so new
lint errors block merges.

## GitHub configuration

In GitHub, open **Settings > Branches > Add branch protection rule** for `main`.

Require pull requests and these status checks:

- `Frontend lint, test, and build`
- `Backend tests`

Also block merges while a required check is pending.

## Deployment hooks

The deployment workflow is provider-neutral. Create a GitHub environment named
`production`, then add environment secrets under **Settings > Environments >
production**:

| Secret | Required | Purpose |
| --- | --- | --- |
| `BACKEND_DEPLOY_HOOK_URL` | At least one hook is required | Backend deploy hook from the hosting provider |
| `FRONTEND_DEPLOY_HOOK_URL` | At least one hook is required | Frontend deploy hook from the hosting provider |
| `PROD_HEALTHCHECK_URL` | Optional | Public health endpoint checked after deployment |

Set `PROD_HEALTHCHECK_URL` to the deployed backend `/api/health` URL when the
backend is publicly reachable.

Render, Railway, Netlify, Vercel, and similar providers expose deploy hooks or can
deploy directly from `main`. If the provider already deploys directly from GitHub,
keep CI enabled and remove the redundant hook from the production secrets.

For controlled releases, add required reviewers to the `production` environment.
GitHub will wait for approval before calling the deploy hooks.

## Hosting environment variables

Configure runtime secrets in the hosting provider, not in GitHub Actions:

- Backend: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`
- Frontend: `VITE_API_BASE_URL`

Add the billing, SMTP, and webhook secrets from `backend/env.example` when those
features are enabled.
