# Distributed Website Monitor

A portfolio-ready distributed website monitoring platform built with **Node.js, TypeScript, PostgreSQL, Redis, BullMQ and Docker**.

The system accepts websites through a small dashboard, queues monitoring jobs in Redis, distributes them across one or more worker processes, performs real HTTP checks, and stores results in PostgreSQL.

## Architecture

```text
Browser / Dashboard
        |
        v
   Node.js API
        |
        +------> PostgreSQL
        |
        v
 Redis / BullMQ
        |
   +----+----+
   |         |
Worker 1  Worker 2  ...
   |         |
   +----+----+
        |
        v
 Target Websites
```

## Features

- Add and remove websites from a dashboard
- Queue a single check or all websites
- Multiple workers can process jobs concurrently
- HTTP status and response-time monitoring
- Timeout handling
- Automatic retry with exponential backoff
- Latest status dashboard
- Per-check history stored in PostgreSQL
- Redis-backed BullMQ job queue
- Horizontally scalable workers
- Docker Compose local environment
- Health endpoint for deployment environments

## Stack

- Node.js 22
- TypeScript
- Express 5
- PostgreSQL 16
- Redis 7
- BullMQ
- Docker / Docker Compose (or Podman + podman-compose)
- Vanilla HTML/CSS/JavaScript dashboard

## Run locally

Requirements: Docker Desktop, or Podman (see [Run with Podman](#run-with-podman) below).

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

To run more workers:

```bash
docker compose up --build --scale worker=4
```

Now four independent worker containers consume jobs from the same Redis queue.

## Run with Podman

The compose file is standard, so it also works with Podman on macOS or Linux.

Install Podman and `podman-compose` (macOS example):

```bash
brew install podman podman-compose
podman machine init   # first time only
podman machine start
```

Build and start the stack:

```bash
podman-compose up --build -d
```

Open `http://localhost:3000`, then follow the logs or scale the workers:

```bash
podman-compose logs -f worker
podman-compose up -d --scale worker=4
```

Stop everything:

```bash
podman-compose down          # keeps the PostgreSQL volume
podman-compose down -v       # also deletes the data
podman machine stop          # optional: shut down the Podman VM
```

### Port conflicts

If a local PostgreSQL or another app already uses ports `5432` or `3000` on your machine,
put the host ports you want in a `docker-compose.override.yml` next to the compose file.
Both Docker Compose and podman-compose pick it up automatically:

```yaml
services:
  postgres:
    ports: !override
      - "5433:5432"
  api:
    ports: !override
      - "3001:3000"
```

Only the host side changes. Containers still talk to each other on the internal ports.

## Try it

1. Add a few URLs in the dashboard.
2. Click **Check all websites**.
3. Watch the worker logs in the terminal.
4. The dashboard updates automatically every five seconds.
5. Scale the worker service and queue the checks again.

## API

```text
GET    /health
GET    /api/websites
POST   /api/websites
DELETE /api/websites/:id
POST   /api/check/:id
POST   /api/check-all
GET    /api/stats
GET    /api/websites/:id/history
```

Example:

```bash
curl -X POST http://localhost:3000/api/websites \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'

curl -X POST http://localhost:3000/api/check-all
```

## Why multiple workers?

The API does not perform website checks directly. It publishes jobs to Redis through BullMQ. Any available worker can claim a job, perform the network request, and persist the result.

This separates request handling from background processing and makes the system easy to scale:

```text
1 worker  -> small workload
5 workers -> more concurrent checks
20 workers -> same architecture, higher throughput
```

Workers can also run on different machines while sharing the same Redis and PostgreSQL services.

## Project structure

```text
src/
  api/       Express API
  db/        PostgreSQL connection
  queue/     BullMQ queue
  worker/    Monitoring worker
public/      Dashboard
scripts/     Database schema and seed script
```

## Next improvements

- Scheduled checks
- SSL certificate expiry monitoring
- Keyword/content assertions
- Screenshot jobs using Playwright
- Email/Slack alerts
- Authentication
- Grafana/Prometheus metrics
- AWS ECS deployment
- Worker heartbeat and node dashboard

## Author

**allimist**

Senior Backend / Full-Stack Software Engineer focused on Node.js, cloud infrastructure, distributed systems, automation, AI, and AdTech.
