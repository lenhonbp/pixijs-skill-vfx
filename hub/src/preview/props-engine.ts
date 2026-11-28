// Inspector for isometric props: the pack's landmark prop turned through its eight baked facings on a 2D canvas.
// The strip is Isobaker's native 2x bake, cropped to the union of all facings, so the ground anchor stays fixed.
import type { PropsPreview } from '../data/catalog.ts';
import { BACKGROUNDS, type Background, type Engine, type Loaded, pad3 } from './engine.ts';

const W = 960, H = 600, STEP_MS = 220;
const YAW: Record<string, number> = { se: -45, s: 0, sw: 45, w: 90, nw: 135, n: 180, ne: -135, e: -90 };
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function createPropsEngine(host: HTMLElement, preview: PropsPreview): Engine {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.className = 'block size-full';
  host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const image = new Image();
  const t = preview.turntable;
  const frames = t ? preview.facings.length : 1;
  let playing = true, speed = 1, raf = 0, last = 0, clock = 0, frame = 0, shown = -1, dirty = true, bg: Background = 'studio';
  // Draw rect, fixed for the life of the engine.
  let dw = 0, dh = 0, dx = 0, dy = 0;

  function backdrop() {
    const c = BACKGROUNDS[bg];
    ctx.fillStyle = c.css; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = dy + dh * 0.78;
    if (bg === 'grid') {
      // True isometric tiles: height / width = 1/√3 (0.57735), the projection every Isobaker atlas is baked in.
      // One tile is 96 px wide at 1x; the turntable is drawn at dw / (native 1x width) of that.
      const r = preview.compression, step = t ? 96 * (dw / (t.w / t.scale)) : 48;
      ctx.beginPath();
      for (let k = -30; k <= 30; k++) {
        const ox = k * step;
        ctx.moveTo(cx + ox - 1400, cy - 1400 * r); ctx.lineTo(cx + ox + 1400, cy + 1400 * r);
        ctx.moveTo(cx + ox - 1400, cy + 1400 * r); ctx.lineTo(cx + ox + 1400, cy - 1400 * r);
      }
      ctx.strokeStyle = css(c.line); ctx.lineWidth = 1; ctx.stroke();
    } else if (bg === 'scorch') {
      ctx.fillStyle = 'rgba(18,13,8,0.14)';
      for (let k = 5; k >= 1; k--) { ctx.beginPath(); ctx.ellipse(cx, cy, 46 * k, 46 * k * preview.compression, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function draw() {
    backdrop();
    if (!image.complete || !image.naturalWidth) return;
    if (t) ctx.drawImage(image, frame * t.w, 0, t.w, t.h, dx, dy, dw, dh);
    else ctx.drawImage(image, dx, dy, dw, dh);
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (playing && frames > 1) {
      clock += dt * speed;
      if (clock >= STEP_MS) { clock %= STEP_MS; frame = (frame + 1) % frames; dirty = true; }
    }
    if (!dirty) return;
    dirty = false;
    draw();
    if (frame !== shown) { shown = frame; engine.onFrame(frame); }
  };

  const engine: Engine = {
    onFrame: () => {},
    async load(): Promise<Loaded> {
      image.src = t ? t.src : preview.poster;
      await image.decode();
      // Native 2x pixels at most; the logical canvas is drawn at device resolution, so the bake stays crisp.
      const sw = t ? t.w : image.naturalWidth, sh = t ? t.h : image.naturalHeight;
      const k = Math.min(1, (H * 0.8) / sh, (W * 0.8) / sw);
      dw = sw * k; dh = sh * k; dx = (W - dw) / 2; dy = (H - dh) / 2;
      const names = t ? preview.facings : ['scene'];
      dirty = true; shown = -1;
      return {
        frames,
        frameLabels: names.map((f, i) => `${f.toUpperCase()} · ${pad3(i + 1)} / ${frames}`),
        timeLabels: names.map(f => (f in YAW ? `yaw ${YAW[f] > 0 ? '+' : YAW[f] < 0 ? '−' : ''}${Math.abs(YAW[f])}°` : 'static scene')),
        dimLabels: t ? preview.dims.map(([w, h]) => `${w}×${h} px @ 96 px/tile`) : [`${image.naturalWidth}×${image.naturalHeight} px scene`],
        runtime: t ? `Isobaker atlas · ${t.scale}x bake turntable` : 'Isobaker map kit · scene render',
        source: t ? `${preview.hero} · ${frames} facings` : `${preview.id} starter map`,
        vramBytes: preview.vram,
        sheets: `Y ${preview.compression} · ${preview.tile} px/tile`,
      };
    },
    setPlaying(on) { playing = on; last = 0; },
    setSpeed(x) { speed = x; },
    seek(i) { frame = Math.max(0, Math.min(frames - 1, i)); clock = 0; dirty = true; },
    setBackground(next) { bg = next; dirty = true; },
    start() { if (!raf) { last = 0; dirty = true; raf = requestAnimationFrame(tick); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    release() { image.removeAttribute('src'); },
  };
  return engine;
}
