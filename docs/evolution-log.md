# Evolution Log

## 2026-07-31 — Docker layer optimization (0.3.4)

- Multi-stage build (prepare → runtime)
- Metadata layer separated from source
- Source copied by area for better cache hits
- Removed unnecessary npm install
- Non-root `node` user in runtime image
- Tighter `.dockerignore` (docs/git excluded from image)

## 0.3.3

- Initial Dockerfile + CI Docker build job

## 0.3.2

- GitHub Actions workflow + `npm run ci`
