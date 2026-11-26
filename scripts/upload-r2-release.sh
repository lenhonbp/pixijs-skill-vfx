#!/usr/bin/env bash
# Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
# SPDX-License-Identifier: MIT
#
# Builds a new immutable Free pack release on R2: copies the previous release server side, uploads the re-baked
# containers of a staged release over it, then uploads index.json last (a release never lists a file it lacks).
# The new release id is read from showcase/public/packs-release.json; index.json must equal the committed
# showcase/public/packs/free/index.json. Dry run unless --apply is given. See docs/pack-hosting.md.
#
# Usage: scripts/upload-r2-release.sh --stage DIR --previous RELEASE_ID [--apply]
# Environment: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (an R2 API token's S3 credentials), R2_ENDPOINT
# (https://<account-id>.r2.cloudflarestorage.com); optional R2_BUCKET (default lenhon-vfx-packs), R2_PREFIX (default free).
set -euo pipefail

usage() { sed -n '9,11p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
fail() { echo "error: $*" >&2; exit 1; }

stage='' previous='' apply=0
while [ $# -gt 0 ]; do
  case "$1" in
    --stage) stage="${2:-}"; shift 2 ;;
    --previous) previous="${2:-}"; shift 2 ;;
    --apply) apply=1; shift ;;
    -h|--help) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done
[ -n "$stage" ] && [ -n "$previous" ] || usage
[ -d "$stage" ] || fail "no stage directory: $stage"

root="$(cd "$(dirname "$0")/.." && pwd)"
pointer="$root/showcase/public/packs-release.json"
index="$root/showcase/public/packs/free/index.json"
bucket="${R2_BUCKET:-lenhon-vfx-packs}"
prefix="${R2_PREFIX:-free}"
id_re='^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'

command -v aws >/dev/null || fail 'the AWS CLI (aws) is required'
command -v node >/dev/null || fail 'node is required'
[ -n "${R2_ENDPOINT:-}" ] || fail 'set R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com'
if [ "$apply" = 1 ]; then
  [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ] || fail 'set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (R2 S3 credentials)'
fi
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

release="$(node -e 'const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(p.release))' "$pointer")"
[[ "$release" =~ $id_re ]] || fail "invalid release id in $pointer: $release"
[[ "$previous" =~ $id_re ]] || fail "invalid previous release id: $previous"
[ "$release" != "$previous" ] || fail 'the new and previous release ids are the same'
cmp -s "$stage/index.json" "$index" || fail "$stage/index.json differs from showcase/public/packs/free/index.json"

# Every staged container must be listed in the index with its exact size.
node -e '
const fs = require("fs"), path = require("path"), [stage, index] = process.argv.slice(1);
const sizes = new Map();
for (const p of JSON.parse(fs.readFileSync(index, "utf8"))) for (const v of [p, ...Object.values(p.directions ?? {})]) for (const f of v.files) sizes.set(f.name, f.bytes);
const names = fs.readdirSync(stage).filter(n => n !== "index.json" && n !== "SHA256SUMS");
if (!names.length) throw Error("the stage holds no containers");
for (const n of names) {
  if (!/^[a-z0-9-]+(?:@-?\d+)?(?:\.m)?\.vfxb$/.test(n)) throw Error("unexpected stage file: " + n);
  const bytes = fs.statSync(path.join(stage, n)).size;
  if (sizes.get(n) !== bytes) throw Error(`${n}: ${bytes} bytes, index says ${sizes.get(n)}`);
}
console.log(`${names.length} staged containers match the index`);' "$stage" "$index"
# Every file the previous release does not already hold at its indexed size must be staged, or index.json would list a
# stale container and the release (immutable once its index is up) could not be retried.
base="$(node -e 'const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(p.base.replace(/\/+$/, ""))' "$pointer")"
# The previous index comes from the bucket itself with --apply, else (dry run, no credentials) from the public base URL.
previous_index="$(mktemp)"; trap 'rm -f "$previous_index"' EXIT
if [ "$apply" = 1 ]; then
  aws s3 cp "s3://$bucket/$prefix/$previous/index.json" "$previous_index" --endpoint-url "$R2_ENDPOINT" --only-show-errors || fail "previous release $previous not found"
else
  curl -fsS "$base/$previous/index.json" -o "$previous_index" || fail "cannot read $base/$previous/index.json"
fi
node -e '
const fs = require("fs"), [stage, index, previousIndex] = process.argv.slice(1);
const flat = list => { const m = new Map(); for (const p of list) for (const v of [p, ...Object.values(p.directions ?? {})]) for (const f of v.files) m.set(f.name, f.bytes); return m; };
{
  const previous = flat(JSON.parse(fs.readFileSync(previousIndex, "utf8"))), staged = new Set(fs.readdirSync(stage));
  const missing = [...flat(JSON.parse(fs.readFileSync(index, "utf8")))].filter(([n, b]) => !staged.has(n) && previous.get(n) !== b).map(([n]) => n);
  if (missing.length) { console.error(`error: not staged and not in the previous release at the indexed size: ${missing.join(", ")}`); process.exit(1); }
  console.log("every other indexed file is in the previous release at its indexed size");
}' "$stage" "$index" "$previous_index"
if [ -f "$stage/SHA256SUMS" ]; then (cd "$stage" && sha256sum --quiet -c SHA256SUMS) || fail 'SHA256SUMS check failed'; fi

common=(--endpoint-url "$R2_ENDPOINT" --only-show-errors)
dest="s3://$bucket/$prefix/$release/"
run() { echo "+ aws $*"; if [ "$apply" = 1 ]; then aws "$@"; fi; }
put() {
  local file="$1" name type; name="$(basename "$file")"
  type=application/octet-stream; [ "$name" = index.json ] && type=application/json
  run s3 cp "$file" "$dest$name" "${common[@]}" --content-type "$type" \
    --cache-control 'public, max-age=31536000, immutable' --content-disposition "attachment; filename=\"$name\""
}

if [ "$apply" = 1 ]; then
  if aws s3api head-object --bucket "$bucket" --key "$prefix/$release/index.json" --endpoint-url "$R2_ENDPOINT" >/dev/null 2>&1; then
    fail "release $release already exists; releases are immutable"
  fi
  aws s3api head-object --bucket "$bucket" --key "$prefix/$previous/index.json" --endpoint-url "$R2_ENDPOINT" >/dev/null || fail "previous release $previous not found"
fi
run s3 sync "s3://$bucket/$prefix/$previous/" "$dest" "${common[@]}" --exclude index.json
for file in "$stage"/*.vfxb; do put "$file"; done
put "$stage/index.json"

if [ "$apply" = 1 ]; then echo "Uploaded $release. Verify:"; else echo "Dry run (add --apply to upload). After uploading, verify:"; fi
echo "  node scripts/verify-remote-packs.mjs $base/$release"
