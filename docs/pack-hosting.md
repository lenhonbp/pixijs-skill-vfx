# Hosting the Free packs outside git

The Free packs are ~354 MB of binary files. Git is a poor home for them: every re-bake adds
the full size to history. The showcase can load them from any public HTTPS host (for example a
Cloudflare R2 bucket) instead. `index.json` stays in git, so the catalog tests and docs checks
keep working without the binaries.

## How the showcase picks the location

`showcase/src/main.ts` builds every pack URL from `packsBase`:

- Default (no variable): same-origin `packs/free/`, exactly as before.
- `VITE_PACKS_URL=https://packs.example.com/free` at build time: all pack URLs, downloads and
  copied asset URLs use that host. In CI, set the repository variable `PACKS_URL`
  (Settings → Secrets and variables → Actions → Variables); `pages.yml` passes it through.

## Checklist (R2 example)

1. Create a bucket and expose it on a public domain (custom domain or the r2.dev URL).
2. Add a CORS rule allowing `GET` and `HEAD` from the showcase origin
   (`https://lenhonbp.github.io`) and exposing `Content-Length`.
3. Upload `showcase/public/packs/free/*` to the bucket root (any S3-compatible client works).
4. Verify the copy **before** changing anything else:
   `node scripts/verify-remote-packs.mjs https://packs.example.com/free`
   It checks every file in `index.json` for existence, exact byte size and CORS.
5. Set the `PACKS_URL` variable and redeploy Pages. Open the showcase and play a cast.
6. Only after steps 4-5 pass: remove `showcase/public/packs/free/*.vfxb` from the tree, keeping
   `index.json`.

## Known limits

- The browser ignores the `download` attribute on cross-origin links. The per-pack download
  buttons will open the file instead of saving it unless the host answers with
  `Content-Disposition: attachment` (R2 can set this per object or via a Transform Rule).
- The smoke tests currently read packs from `showcase/public/packs/free/`. They need local
  packs, or a fetch step from the hosted copy, once the binaries leave the tree.
- `fetch-packs.mjs` defaults to the Pages URL; update its default `--source` when the packs
  move, and keep the old URL working until clients have updated.
