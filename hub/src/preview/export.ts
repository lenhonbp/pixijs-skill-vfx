// "JSON + WebP": fetch the released .vfxb from the R2 CDN, unpack it in the browser with the runtime's own
// container reader, and save the plain encoding (manifest + WebP sheets) the runtime also loads directly.
import { readContainer } from '../../../runtime/src/format.ts';
import { zip } from '../../../showcase/src/zip.ts';

export async function exportJsonWebp(url: string, id: string, onStep: (label: string) => void): Promise<void> {
  onStep('Fetching…');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CDN responded ${response.status}`);
  const buffer = await response.arrayBuffer();
  onStep('Unpacking…');
  const { manifest, sheets } = readContainer(buffer);
  const text = new TextEncoder();
  const files = [
    { name: `${id}/${id}.vfx.json`, data: text.encode(JSON.stringify(manifest, null, 2)) },
    ...[...sheets].map(([name, bytes]) => ({ name: `${id}/${name}`, data: bytes.slice() })),
    { name: `${id}/README.txt`, data: text.encode(
      `${manifest.name.en} (${manifest.name.vi}) — lenhon.dev Free VFX, MIT license.\n\n` +
      `Plain encoding of ${url.split('/').pop()}: the manifest plus its WebP sheets.\n` +
      `Serve the folder and load the manifest; sheets resolve next to it:\n\n` +
      `  const vfx = await VfxPlayer.create(app, { packs: ['${id}/${id}.vfx.json'] });\n` +
      `  vfx.play('${id}', { from: caster, to: target });\n\n` +
      `npm i @lenhonbp/pixijs-vfx-runtime\n`) },
  ];
  onStep('Saving…');
  const href = URL.createObjectURL(zip(files));
  const link = document.createElement('a');
  link.href = href; link.download = `${id}-json-webp.zip`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
