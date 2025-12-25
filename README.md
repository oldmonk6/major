# RECLAIM Scaffold (FastAPI + Postgres + Redis + MinIO + ChatGPT)

Local stack with Docker Compose and a minimal FastAPI API wired to ChatGPT for plan generation, coaching flows, JIT interventions, auth, and client-side-encrypted journal upload.

## Prereqs
- Docker + Docker Compose
- OpenAI API key (set `OPENAI_API_KEY` in `backend/.env`)

## Run locally
```bash
cp backend/.env.example backend/.env   # set OPENAI_API_KEY and JWT_SECRET
docker compose up --build
```
- Backend API: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:3000
- Postgres: localhost:5432 (reclaim/reclaim)
- Redis: localhost:6379
- MinIO: API http://localhost:9000, console http://localhost:9001 (user `minio`, pass `minio123`)
- JWT secret: set in `backend/.env`

## FastAPI endpoints (current)
- `GET /health`
- `POST /auth/register`, `POST /auth/login` - returns JWT + user_id
- `POST /onboard` - generate a structured recovery plan via ChatGPT
- `POST /coach/session` - 3-5 minute guided coach flow
- `POST /jitai/choose` - selects a micro-intervention based on context
- `POST /jitai/feedback` - updates bandit with reward
- `GET /tasks/today`, `POST /tasks/{id}/complete`
- `POST /checkins`
- `POST /journal/upload`
- `GET /risk`
- `GET /progress/summary`
- `POST /sos/alert`

## Next steps
- Harden auth (refresh tokens, roles) and add rate limits.
- Enforce client-side encryption passphrases, size limits, signed URLs for uploads.
- Add pgvector for embeddings and search; implement real bandit + temporal risk models.
- Expand frontend: streak logic, dashboards, SOS routing, emotion tagging, voice uploads.
