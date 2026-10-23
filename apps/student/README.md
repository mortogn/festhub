# FestHub Student

Run `pnpm dev:student` from the repository root. Development and production start use http://localhost:3000.

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` in this app's `.env.local` (or the deployment environment). The browser calls the API directly with credentials.

Run `pnpm --filter @festhub/student build` to build and `pnpm --filter @festhub/student start` to serve production.

All scheduling uses Bangladesh time (Asia/Dhaka). Localhost cookies are shared across ports; use separate browser profiles to test multiple roles simultaneously.
