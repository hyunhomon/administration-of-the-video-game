# GCP deployment — Cloud Run

## Target
Single container serving the production web app and WebSocket endpoint on `0.0.0.0:$PORT` (default 8080). A **single instance** supports the initial in-memory session demo; avoid multi-instance scale until rooms move to persistent shared state. Cloud Run instances are ephemeral; connection drops, cold starts, and per-request timeouts must be handled. WebSocket clients must reconnect.

## Agent's work
1. Scaffold Dockerfile + `.dockerignore`; use a runtime base compatible with verified engine and chosen package manager.
2. Add `GET /healthz`. Serve built static client from same origin, or configure correct public origin/CORS.
3. Implement SIGTERM handling, readiness and explicit production run script.
4. Never bake `GEMINI_API_KEY` into image. Prefer Secret Manager binding for production (or documented `--set-secrets`).
5. Validate local container boot, HTTP page, WebSocket upgrade, and two clients.
6. If GCP project and auth are present, deploy and read back URL, smoke-test it. Otherwise do not guess IDs or pretend live deploy.

## Reference command (adapt actual service/image/build configuration)
```bash
gcloud run deploy administration-of-the-video-game \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Requires selected GCP project, enabled APIs, Artifact Registry/Cloud Build permissions and a Secret Manager secret named `gemini-api-key`. `--allow-unauthenticated` is for a public demo only. Review quotas/costs and set budgets. Do not set secret via `--set-env-vars`.
