# Shared frontend

Image uploads use `POST /upload/presign`, a direct multipart POST to storage,
then `PUT /upload/:id/confirm`. Image saves are independent of resource editors.
Avatars are displayed through authenticated browser image requests; event and
venue images use the same redirect endpoint without requiring authentication.

Run the upload transport tests from the repository root using the existing API
workspace's TypeScript runner:

```sh
pnpm --filter @festhub/shared build
pnpm --filter @festhub/api exec tsx --test ../../packages/frontend/tests/uploads.test.ts
```

The API and database must already have the upload schema deployed. The actual
bucket CORS rules must allow each frontend origin, including
`http://localhost:3002` for local admin uploads. Editing `s3-cors.json` alone does
not apply the configuration to the bucket.

Backend follow-ups remain outside this frontend implementation: confirmation
only accepts pending uploads (it is not idempotent), does not enforce
`expiresAt`, and temporary/replaced object cleanup has no implemented scheduled
job. After an uncertain confirmation response, the frontend reads the resource
to check whether the attempted upload became its saved image before reporting
success. Retries start with a fresh presign; they do not repeat confirmation.
