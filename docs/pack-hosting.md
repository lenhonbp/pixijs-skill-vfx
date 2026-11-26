# Hosting the Free packs outside git

The Free packs are ~354 MB of binary files. Git is a poor home for them: every re-bake adds
the full size to history. The showcase loads them from a public HTTPS host (for example a
Cloudflare R2 bucket) instead. `index.json` stays in git, so the catalog tests and docs checks
keep working without the binaries.

## Releases and the pointer

Each publication builds a **new, complete, immutable release directory** on the host:

```
https://packs.example.com/free/<release-id>/index.json
https://packs.example.com/free/<release-id>/hoa-fireball.vfxb  ...
```

A release is never modified after it is built. Unchanged files are copied server-side from the
previous release; new or re-baked files are uploaded. Which release is live is decided by one small
file in git, `showcase/public/packs-release.json`:

```json
{ "version": 1, "base": "https://packs.example.com/free", "release": "2026-11-24-45321324181" }
```

- **Switching** releases = merging the PR that changes this file (the factory's release workflow opens it).
- **Rolling back** = reverting that PR. The previous release directory is still there.
- The showcase reads the pointer at build time (`showcase/vite.config.ts`); `fetch-packs.mjs` reads the
  deployed copy at `<site>/packs-release.json`, falling back to the old `packs/free/` URL when it is absent.
- With no pointer file, packs stay same-origin `packs/free/` (the legacy layout).
  `showcase/public/packs-release.json` is checked in so clean builds point at the
  last applied release; each release rewrites it.
- `VITE_PACKS_URL` overrides the pointer (local tests or an emergency repoint). Precedence:
  `VITE_PACKS_URL`, then the pointer, then same-origin.

Storage grows by about one collection (~350 MB) per release. Delete release directories that are
no longer the live one or a rollback target.

## Checklist (R2 example)

1. Create a bucket and expose it on a public domain (custom domain or the r2.dev URL).
2. Add a CORS rule allowing `GET` and `HEAD` from any origin (`*`) — the packs are
   public and games load them cross-origin — exposing `Content-Length`.
3. Run the factory's *Release Free effects* workflow. The first release seeds the directory from
   the containers still in this repo; later releases copy from the previous one.
4. The workflow runs `node scripts/verify-remote-packs.mjs <base>/<release>` before opening the
   PR. It checks every file in `index.json` for existence, exact byte size and CORS, and that the
   release's own `index.json` equals the one in the PR. Run it yourself the same way.
5. Merge the PR, let Pages deploy, open the showcase and play a cast.
6. Only after a release has been live and checked: remove `showcase/public/packs/free/*.vfxb` from
   the tree, keeping `index.json`.

## Uploading a staged release yourself

When a release is staged outside the factory's hosted workflow (its id already in `showcase/public/packs-release.json`
and its `index.json` already committed), push it with [`scripts/upload-r2-release.sh`](../scripts/upload-r2-release.sh).
It needs the AWS CLI, Node and an R2 API token's S3 credentials in the environment; no secret is stored in the repo.

```sh
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
scripts/upload-r2-release.sh --stage /path/to/stage --previous <live release id>           # dry run
scripts/upload-r2-release.sh --stage /path/to/stage --previous <live release id> --apply   # upload
node scripts/verify-remote-packs.mjs <base>/<new release id>
```

The stage directory holds the re-baked `.vfxb` files, the release's `index.json` and an optional `SHA256SUMS`. The script
checks them against the committed index, refuses an existing release id, copies the previous release server side into
`lenhon-vfx-packs/free/<release-id>/` (`R2_BUCKET` / `R2_PREFIX` override), uploads the staged containers and uploads
`index.json` last. Merge the pointer PR only after the verifier passes.

## Known limits

- Per-pack download buttons use `Content-Disposition: attachment`, which the factory sets on every object.
  Verify one download on the live host.
- The smoke tests read packs from `showcase/public/packs/free/`. Restore them locally or in CI with
  `node skills/lenhon-vfx/scripts/fetch-packs.mjs --all --out showcase/public/packs/free`.
- `fetch-packs.mjs` resolves the pointer from the deployed site. Until the pointer is deployed, or if it
  cannot be fetched, it uses the old `packs/free/` URL, which stops working once binaries leave the tree.
