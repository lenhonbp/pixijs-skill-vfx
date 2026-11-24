// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Where the Free packs are served from. Precedence: VITE_PACKS_URL, then the release pointer written by
// the factory's release workflow (public/packs-release.json), else same-origin packs/free/ (the default).
function packsUrl(): string | undefined {
  const override = process.env.VITE_PACKS_URL?.trim();
  if (override) return override;
  const file = fileURLToPath(new URL('./public/packs-release.json', import.meta.url));
  if (!existsSync(file)) return undefined;
  const pointer = JSON.parse(readFileSync(file, 'utf8'));
  if (pointer?.version !== 1 || typeof pointer.base !== 'string' || !/^https:\/\/[^\s?#]+$/.test(pointer.base) || typeof pointer.release !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(pointer.release))
    throw new Error('Invalid showcase/public/packs-release.json');
  return `${pointer.base.replace(/\/+$/, '')}/${pointer.release}`;
}
const packs = packsUrl();
export default defineConfig({
  root: 'showcase', base: './', build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  ...(packs ? { define: { 'import.meta.env.VITE_PACKS_URL': JSON.stringify(packs) } } : {}),
});
