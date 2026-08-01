# Snyk container scanning

## Local

```bash
# Build first (optional)
npm run docker:build

# App + container scan + OPA on JSON reports
IMAGE_REF=living-intermediate-control-plane:0.5.6 npm run security-scan
```

Requires:

- `snyk` CLI (`npm i -g snyk` or https://docs.snyk.io/snyk-cli)
- `snyk auth` or `SNYK_TOKEN`
- `IMAGE_REF` set to a local or remote image

Outputs:

- `data/snyk-test.json` — open-source / project test  
- `data/snyk-container.json` — **container** test  

OPA policy: `policy/snyk-results.rego` applied to both JSON reports.

### Flags

| Env | Effect |
|-----|--------|
| `IMAGE_REF` | Enable Trivy image + Snyk container |
| `SKIP_SNYK=1` | Skip all Snyk |
| `SKIP_SNYK_CONTAINER=1` | Skip container only |
| `ALLOW_SKIP=1` | Skip if CLI missing |

## CI

In `.github/workflows/plane-ci.yml` **docker-build** job, after the image is built and loaded:

1. Trivy image scan  
2. OPA on Trivy JSON  
3. **Snyk container scan** (`snyk/actions/docker`) when `secrets.SNYK_TOKEN` is set  

Set repository secret **`SNYK_TOKEN`** to enable the CI container step.

## Manual CLI

```bash
snyk container test living-intermediate-control-plane:0.5.6 --severity-threshold=high
snyk container test living-intermediate-control-plane:0.5.6 --json-file-output=data/snyk-container.json
```
