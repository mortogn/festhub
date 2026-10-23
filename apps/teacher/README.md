# FestHub Teacher

Run `pnpm dev:teacher` from the repository root. Development and production start use http://localhost:3001.

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` in this app's `.env.local` (or the deployment environment). The browser calls the API directly with credentials.

Run `pnpm --filter @festhub/teacher build` to build and `pnpm --filter @festhub/teacher start` to serve production.

All scheduling uses Bangladesh time (Asia/Dhaka). Localhost cookies are shared across ports; use separate browser profiles to test multiple roles simultaneously.
