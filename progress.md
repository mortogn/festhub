# FestHub frontend implementation progress

## Approved scope

- Complete teacher/admin dashboards and remaining student workflows using the existing API.
- Preserve the student home/event design and shared shadcn UI.
- Student port 3000, teacher 3001, admin 3002; direct credentialed API requests.
- Only API change authorized: add those three localhost origins to CORS.
- Day.js, Asia/Dhaka scheduling, DD/MM/YYYY date displays.

## Milestones

- [x] Shared frontend foundation, app ports, CORS, and date handling
- [x] Staff authentication and responsive dashboard layouts
- [x] Event configuration, registration/team reviews, volunteers, and organizers
- [x] Venues, student/teacher directories, and admin teacher invitations
- [x] Student team details/invitations/submission and volunteering workflows
- [x] Home filters, responsive refinements, and verification

## API findings and limits

- Source code takes precedence over the older api.md: /users/self is mounted; event lists include descriptions and venue summaries.
- Teacher signup needs an invitation. Admin teacher invitation records permission only; no email is sent and invitations cannot be listed.
- Students can retrieve their teams but not sent team invitations. No team deletion/member removal/cancellation or rejected-team resubmission.
- No profile/password editing, uploads, attendance mutations, organizer removal, or venue unassignment.
- Student volunteering summaries omit attendance and combine invitation/request status. Volunteer schedules require event details, which hide inactive events from students.
- Teacher directory omits names; use email/institutional ID, and UUIDs for detail lookup.
- Existing backend capacity/concurrency issues and event-date updates bypassing booking conflicts cannot be fixed in the frontend. Availability checks are advisory.
- Optional configured numeric/date fields cannot be cleared through the current API; omitted fields retain their values.
- Localhost cookies are shared across ports; use separate browser profiles for simultaneous accounts of different roles.

## Verification

- All three apps passed TypeScript and app ESLint; shared frontend/UI typechecks passed.
- All three apps compiled and generated their production routes successfully. Installed Next tooling displays an existing-version security advisory and may require a repeat invocation to exit successfully. No framework upgrade was included.
- Fifty temporary mocked rendering/handler checks passed for authentication races/retries, Dhaka dates, configuration, conflicts, directories, volunteers, and student workflows.
- Fourteen real browser checks passed across the three apps with intercepted API requests, including teacher sign-in, admin invitations, registration review, venue creation, team submission, invitation responses, sidebar collapse, and mobile navigation. No page errors occurred.
- Desktop/mobile screenshots were inspected; student dashboard fits the mobile viewport and staff mobile navigation closes correctly.
- CORS checks passed for all three configured origins, credentialed JSON preflight, and rejection of an unrelated origin. Dev/start script ports match the allowlist.
- Browser checks used mocked API responses; no live database registrations, invitations, or approvals were created. Live database-backed end-to-end verification remains separate.
- Test scripts and screenshots are outside the repository under /private/tmp. No test files or test dependencies are included in the project.
- git diff confirms apps/api/src/server.ts changes only the CORS origin list. api.md was not edited.

## Implementation notes

- Shared staff screens live in @festhub/frontend and are used by both apps; API calls remain typed Hono requests with credentials.
- Each app has an .env.example. Fixed ports apply to both dev and start scripts.
- Auth refresh retries once; concurrent refreshes share a promise. Late account responses cannot undo sign-out, and resources hide stale data on route changes.
- Teacher/admin/student production compilation and route generation passed; final production verification is recorded above.
- Fifty temporary mocked rendering/handler checks passed for auth, dates, event configuration, venue conflicts, directories, volunteers, and student workflows. These are not live database tests.
- Per the latest request, all test files were moved out of the project into /private/tmp; no test tooling or test dependencies are being added.

## Entry points

| App     | Local URL             | Authentication                          | Main routes                                                                                                       |
| ------- | --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Student | http://localhost:3000 | Existing sign-in/signup                 | /, /events/:id, /teams/create, /profile, /profile/teams/:teamId, /profile/team-invites, /profile/volunteering     |
| Teacher | http://localhost:3001 | /sign-in; invited teachers use /sign-up | /dashboard, /dashboard/events, /dashboard/volunteers, /dashboard/venues, /dashboard/students, /dashboard/teachers |
| Admin   | http://localhost:3002 | /sign-in only                           | Same staff routes; teacher invitations appear only for admins                                                     |

- Each staff event has configuration, registrations, volunteers, and organizers tabs.
- Student event pages retain the original visual design, show existing registration/volunteer state, and link to an existing team when present.
- Student homepage search/category filters work locally over public upcoming/ongoing events.
- Team creation keeps query-parameter preselection and redirects to the new team detail page.
- Team submission requires confirmation and closes invitations; only leaders can invite/submit eligible drafts.
- Volunteer invitation status remains visible even when public applications were never enabled.
- Times use Asia/Dhaka consistently, with numeric dates displayed DD/MM/YYYY.

## Local setup

Use pnpm dev:student, pnpm dev:teacher, and pnpm dev:admin from the root. Each app has .env.example; teacher/admin local environment files were initialized with the public localhost API URL without changing existing environment files. The API continues to run on its existing configured port (default 8080).

Temporary production servers used for verification are stopped after checks; the user's existing student/API development processes are left running.
