#!/usr/bin/env bash
#
# Deterministic web search for the Exa Researcher villager.
#
# No API key lives in this file or this folder. On Vercel, the sandbox firewall
# injects the `x-api-key` header for api.exa.ai (credential brokering, see
# agent/sandbox/sandbox.ts). For local runs, set EXA_API_KEY in the environment
# and it is sent directly as a fallback.
#
# Usage:  search.sh "<query>" [num_results]
# Env:    SEARCH_OUT_DIR  where results/cache land   (default: ../output)
#         SEARCH_REFRESH  set to 1 to bypass the cache and force a live fetch
#         EXA_HOST        override the API host       (default: api.exa.ai)
#         EXA_API_KEY     local fallback key          (brokered on Vercel)
#
# Output: a cited source list on stdout; the full JSON at $SEARCH_OUT_DIR/results.json.
# Exit:   0 on success, 1 on a failed search.
set -euo pipefail

QUERY="${1:?usage: search.sh \"<query>\" [num_results]}"
NUM="${2:-5}"

OUT_DIR="${SEARCH_OUT_DIR:-$(cd "$(dirname "$0")/.." && pwd)/output}"
mkdir -p "$OUT_DIR/cache"

# Cache key = query + count. A hit makes reruns instant, offline, and
# deterministic — used by the fixture and to survive a flaky live call on
# demo day. node's crypto is portable across macOS and the Linux sandbox.
KEY="$(node -e 'const c=require("crypto");process.stdout.write(c.createHash("sha256").update(process.argv[1]+"|"+process.argv[2]).digest("hex").slice(0,16))' "$QUERY" "$NUM")"
CACHE="$OUT_DIR/cache/$KEY.json"

if [[ "${SEARCH_REFRESH:-0}" != "1" && -s "$CACHE" ]]; then
  echo "search: cache hit ($KEY)" >&2
else
  BODY="$(node -e 'const [q,n]=process.argv.slice(1);process.stdout.write(JSON.stringify({query:q,numResults:Number(n),contents:{text:{maxCharacters:600}}}))' "$QUERY" "$NUM")"
  HDR=()
  [[ -n "${EXA_API_KEY:-}" ]] && HDR=(-H "x-api-key: ${EXA_API_KEY}")
  CODE="$(curl -sS -o "$CACHE.tmp" -w '%{http_code}' \
    -X POST "https://${EXA_HOST:-api.exa.ai}/search" \
    -H 'content-type: application/json' "${HDR[@]}" \
    --data-binary "$BODY")"
  if [[ "$CODE" != "200" ]]; then
    echo "search: Exa failed (HTTP $CODE)" >&2
    cat "$CACHE.tmp" >&2 || true
    rm -f "$CACHE.tmp"
    exit 1
  fi
  mv "$CACHE.tmp" "$CACHE"
  echo "search: live fetch ($KEY)" >&2
fi

cp "$CACHE" "$OUT_DIR/results.json"

# Emit a compact, cited source list for the villager to synthesize into a brief.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const rows = (d.results || []).map((r) => {
  const date = r.publishedDate ? ` (${String(r.publishedDate).slice(0, 10)})` : "";
  return `- ${r.title || "untitled"} — ${r.url}${date}`;
});
process.stdout.write(rows.join("\n") + "\n");
if (d.costDollars) process.stderr.write(`search: exa cost ${JSON.stringify(d.costDollars)}\n`);
' "$OUT_DIR/results.json"
