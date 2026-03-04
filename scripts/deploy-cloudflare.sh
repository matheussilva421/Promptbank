#!/usr/bin/env bash
set -euo pipefail

# Upload a new version (creates preview URLs)
npx wrangler versions upload

# Promote latest uploaded version to production traffic
npx wrangler versions deploy --latest

# Ensure workers.dev/custom-domain triggers are updated
npx wrangler triggers deploy
