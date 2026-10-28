[View the Project Demo](https://youtu.be/P4g5_flhhwQ)

![Main page](/student_main.png)

## Team: LostOnceNowTwice (C5 - PUB Festhub)

### Members

| Name                      | Student ID     | Role                      |
| ------------------------- | -------------- | ------------------------- |
| Amorto Goon               | 03225205101008 | Developer                 |
| Nasir Hossain Lamim       | 03225205101013 | Tester                    |
| Afia Zahin Early          | 03225105101035 | Tester                    |
| Monisha Farzana           | 03225105101022 | Team Coordinator & Tester |
| Mst Sidratul Montaha Hiya | 03225205101044 | Tester                    |

![system overview](/PUB_FESTHUB.png)

### Solution

To make it easier for university and organizers to manage and create new events and for students to find events they are interested in, we built a website where everything comes together to create a pleasant and easy experience for all parties involved.

### Tech Stack

#### Frontend

    - Nextjs
    - Tailwindcss
    - Typescript

#### Backend

    - Postgres (DB)
    - Redis
    - Hono (RESTful API)
    - BullMQ (Job Queue)

#### Competitive Programming

    - Judge0

### Deployed Links

- Student: https://student.festhub.morto.dev
- Teacher: https://teacher.festhub.morto.dev
- CP: https://contests.festhub.morto.dev
- API: https://api.festhub.morto.dev
- Judge0: https://judge0.festhub.morto.dev

### Credential for Admin

Email: admin@admin.com
Password: admin@admin.com

## Known limitations

These are the limitations that we know of, which we couldn't complete in time or we chose not to focus on because it's a hackathon and our main problem statement had other places where we needed to focus on.

- NO Email verification.
- Issue tracking for events.

## Run this project locally

As this is complex because of judge0, workers and job queue, we suggest to please use the deployed link to check and grade our project.
However if running the project is necessary please follow these instructions,

### Prerequisites

- Latest NodeJS LTS version must be installed
- Postgres Database (Docker or Direct)
- PNPM package manager

### Before we start

Running CP part locally would be complicated because of judge0 so we are skipping the steps of it.

1. Create a .env file in the root of the project and copy over all the content from .env.example

```
DATABASE_URL=postgresql://user:password@localhost:5432/festhub
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=

CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003

AWS_ENDPOINT_URL=
AWS_S3_BUCKET_NAME=
AWS_DEFAULT_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=


NEXT_PUBLIC_API_URL="http://localhost:8080"

JUDGE0_URL=
JUDGE0_AUTH_TOKEN=

# API and worker must share this Redis service. Never expose it to the browser.
REDIS_URL=redis://localhost:6379
```

2. After that, Each frontend require a separate .env file which are located in the correct sub folders. `/apps/student`, `/apps/admin`, `/app/teacher`, `/app/contest`.

3. After creating and adding proper variales in .env files,

```bash
pnpm dev:api # for API
pnpm dev:student # for student
pnpm dev:teacher # for teacher
pnpm dev:admin # for admin
```
