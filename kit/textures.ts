// Procedural VFX textures. Everything is drawn white on transparent so `tint`
// colors it, and baked ONCE at startup (never per frame).
import type { Texture } from 'pixi.js';
import { textureFromCanvas } from './pixi-compat';
import { makeBellSurfaces, makeSteelBlade } from './metal-surfaces';

export interface VfxTextures {
  /** Shaded storm canopy, baked once with the texture set. 512x192. */
  stormCloud: Texture;
  /** Soft radial glow, quadratic falloff. Size 128. The workhorse. */
  glow: Texture;
  /** Hard-ish dot with a short soft edge. Size 64. Embers, motes. */
  dot: Texture;
  /** Thin soft ring. Size 256, ring radius ~= 120px. Shockwaves, telegraphs. */
  ring: Texture;
  /** Soft-edged filled disc. Size 256. AoE fills, decals. */
  disc: Texture;
  /** Horizontal streak, bright head on the right. 128x16. Sparks, speed lines. */
  streak: Texture;
  /** Uniform horizontal bar with soft top/bottom edges. 64x16. Beams, lightning (anchor 0,0.5). */
  beam: Texture;
  /** 4-point star. Size 128. Glints, crits, holy. */
  star: Texture;
  /** Lumpy smoke/fire puff. Size 128. */
  puff: Texture;
  /** Crescent arc centred on the canvas, opening toward -x, bulging toward +x. Size 256, radius ~= 108px. Slashes. */
  crescent: Texture;
  /** Elongated diamond pointing +x. 64x24. Shards, ice, debris. */
  shard: Texture;
  /** Full sword pointing down (+y), beveled blade, fuller, guard and grip. 64x160, anchor (0.5, 1) = tip. */
  blade: Texture;
  /** Short branching ground fracture. 64x32. */
  swordCrack: Texture;
  /** Rock/ice spike pointing up, lit from the left. 64x128, anchor (0.5, 1) = base. Earth spikes, ice nova. */
  spike: Texture;
  /** Faceted rock chunk, lit from the upper left. Size 48. Debris (normal blend). */
  rock: Texture;
  /** Solid beveled armor slab with cracks. 64x80. Normal blend. */
  rockPlate: Texture;
  /** Jagged faceted rock spire with strata and grain, lit from the left. 64x128, anchor (0.5, 1) = base. */
  rockSpike: Texture;
  /** Long open ground fissure along +x: black gap with broken lit lips. 256x48. Ground decal (normal blend). */
  fissure: Texture;
  /** Spectral armored halberd guardian, feet at (88, 244). 192x256. */
  guardian: Texture;
  /** Guardian without weapon; same canvas and feet anchor as guardian. */
  guardianBody: Texture;
  /** Guardian halberd, grip at (154, 128) on a 192x256 canvas. */
  guardianHalberd: Texture;
  /** Craggy mountain with lit ridges and dark ravines. 320x256, base anchor (0.5,1). */
  mountain: Texture;
  /** Leaf with a mid vein pointing +x. 48x24. Wood/nature. */
  leaf: Texture;
  /** Water droplet, round end at the bottom. 24x36. Water, bleed. */
  drop: Texture;
  /** Upward chevron. 64x48. Buff (up) / debuff (rotate PI, down). */
  chevron: Texture;
  /** Rune circle with glyph ticks, ring radius ~= 236px. Size 512. Summons, wards. */
  rune: Texture;
  /** Rim-lit bubble: bright edge, clear center, highlight upper left. Size 256, radius ~= 124px. Shields. */
  bubble: Texture;
  /** Curling vine growing up from the bottom center. 64x128, anchor (0.5, 1). Roots. */
  tendril: Texture;
  /** Thorned vine stroke with dark border and lit upper edge. 96x48. */
  vineSegment: Texture;
  /** Plus/cross. Size 48. Heals. */
  plus: Texture;
  /** Split shield outline with a jagged crack. 64x80. Armor break. */
  crackedShield: Texture;
  /** Cast-bronze temple bell with hanging loop, bands and engravings. 256x320. */
  bell: Texture;
  /** Fractures aligned to bell, with the same size and anchor. */
  bellCracks: Texture;
  /** Glyphs '0'-'9', '+', '-', '!' : white fill with black outline (tint colors the fill only). Height 64. */
  digits: Record<string, Texture>;
}

/** Pixel sizes of the features above, so recipes can convert "radius in px" to scale. */
export const TEX_METRICS = {
  glowRadius: 64,
  ringRadius: 120,
  discRadius: 128,
  crescentRadius: 108,
  streakLength: 128,
  beamLength: 64,
  beamThickness: 16,
  runeRadius: 236,
  bubbleRadius: 124,
  bladeLength: 128,
  spikeHeight: 128,
  tendrilHeight: 128,
  digitWidth: 44,
  digitHeight: 64,
} as const;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, number][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function falloff(power: number, steps = 10): [number, number][] {
  const s: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    s.push([t, Math.pow(1 - t, power)]);
  }
  return s;
}

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Speckle and pit the already drawn pixels (stone grain). */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, count: number, size = 1.6) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < count; i++) {
    const v = rnd();
    ctx.fillStyle = v < 0.55 ? `rgba(0,0,0,${0.08 + rnd() * 0.22})` : `rgba(255,255,255,${0.06 + rnd() * 0.18})`;
    const r = 0.4 + rnd() * size;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: number[][], fill: string | CanvasGradient) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

export function createVfxTextures(): VfxTextures {
  const stormCloud = (() => {
    const rnd = seeded(71);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    const octaves = [8, 16, 32, 64].map((n) => ({ n, grid: Array.from({ length: (n + 1) ** 2 }, () => rnd()) }));
    const noise = (x: number, y: number) => octaves.reduce((sum, { n, grid }, octave) => {
      const u = x / 512 * n, v = y / 192 * n, ix = Math.floor(u), iy = Math.floor(v);
      const fx = u - ix, fy = v - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = grid[iy * (n + 1) + ix], b = grid[iy * (n + 1) + ix + 1];
      const c = grid[(iy + 1) * (n + 1) + ix], d = grid[(iy + 1) * (n + 1) + ix + 1];
      return sum + ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy) / 2 ** (octave + 1);
    }, 0);
    const image = ctx.createImageData(512, 192);
    for (let y = 0; y < 192; y++) for (let x = 0; x < 512; x++) {
      const n = noise(x, y), edge = 1 - ((x - 256) / 245) ** 2 - ((y - 98) / 72) ** 2;
      const density = Math.max(0, Math.min(1, (edge + (n - 0.46) * 1.35) * 2.4));
      const light = 24 + n * 64 + Math.max(0, (110 - y) / 95) * 35 + (1 - x / 512) * 9;
      const i = (y * 512 + x) * 4;
      image.data[i] = light * 0.72; image.data[i + 1] = light * 0.84; image.data[i + 2] = light * 1.08;
      image.data[i + 3] = density * 245;
    }
    ctx.putImageData(image, 0, 0);
    return textureFromCanvas(canvas);
  })();

  const glow = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    radial(ctx, 64, 64, 64, falloff(2.2));
    return textureFromCanvas(c);
  })();

  const dot = (() => {
    const [c, ctx] = makeCanvas(64, 64);
    radial(ctx, 32, 32, 32, [[0, 1], [0.35, 1], [0.6, 0.35], [1, 0]]);
    return textureFromCanvas(c);
  })();

  const ring = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    radial(ctx, 128, 128, 128, [[0, 0], [0.78, 0], [0.88, 0.55], [0.94, 1], [0.97, 0.5], [1, 0]]);
    return textureFromCanvas(c);
  })();

  const disc = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    radial(ctx, 128, 128, 128, [[0, 1], [0.86, 1], [1, 0]]);
    return textureFromCanvas(c);
  })();

  const streak = (() => {
    const [c, ctx] = makeCanvas(128, 16);
    const gx = ctx.createLinearGradient(0, 0, 128, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)');
    gx.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    gx.addColorStop(0.92, 'rgba(255,255,255,1)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, 128, 16);
    ctx.globalCompositeOperation = 'destination-in';
    const gy = ctx.createLinearGradient(0, 0, 0, 16);
    gy.addColorStop(0, 'rgba(255,255,255,0)');
    gy.addColorStop(0.5, 'rgba(255,255,255,1)');
    gy.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, 128, 16);
    return textureFromCanvas(c);
  })();

  const beam = (() => {
    const [c, ctx] = makeCanvas(64, 16);
    const gy = ctx.createLinearGradient(0, 0, 0, 16);
    gy.addColorStop(0, 'rgba(255,255,255,0)');
    gy.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gy.addColorStop(0.5, 'rgba(255,255,255,1)');
    gy.addColorStop(0.7, 'rgba(255,255,255,0.6)');
    gy.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, 64, 16);
    return textureFromCanvas(c);
  })();

  const star = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    radial(ctx, 64, 64, 22, falloff(2));
    for (const rot of [0, Math.PI / 2]) {
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-64, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-64, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(64, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return textureFromCanvas(c);
  })();

  const puff = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    const rnd = seeded(7);
    radial(ctx, 64, 64, 52, falloff(1.6));
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 26;
      radial(ctx, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 14 + rnd() * 18, falloff(1.5).map(([t, v]) => [t, v * 0.35]) as [number, number][]);
    }
    return textureFromCanvas(c);
  })();

  const crescent = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    const R = TEX_METRICS.crescentRadius;
    const half = 1.45;
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = -half + t * 2 * half;
      const w = Math.pow(Math.sin(Math.PI * t), 0.9) * 13 + 0.5;
      const r = R - w * 0.4;
      radial(ctx, 128 + Math.cos(ang) * r, 128 + Math.sin(ang) * r, w, [[0, 0.5], [0.5, 0.35], [1, 0]]);
    }
    return textureFromCanvas(c);
  })();

  const shard = (() => {
    const [c, ctx] = makeCanvas(64, 24);
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, 12);
    ctx.lineTo(40, 2);
    ctx.lineTo(62, 12);
    ctx.lineTo(40, 22);
    ctx.closePath();
    ctx.fill();
    return textureFromCanvas(c);
  })();

  const blade = makeSteelBlade();
  const swordCrack = (() => {
    const [c, ctx] = makeCanvas(64, 32);
    ctx.lineJoin = 'bevel';
    ctx.beginPath(); ctx.moveTo(3, 23); ctx.lineTo(16, 17); ctx.lineTo(31, 16);
    ctx.lineTo(38, 9); ctx.lineTo(60, 6); ctx.moveTo(31, 16); ctx.lineTo(41, 26); ctx.lineTo(54, 28);
    ctx.moveTo(31, 16); ctx.lineTo(27, 10); ctx.lineTo(17, 6);
    ctx.lineWidth = 4; ctx.strokeStyle = '#867264'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#18141b'; ctx.stroke();
    ctx.fillStyle = '#17131a';
    ctx.beginPath(); ctx.ellipse(31, 16, 9, 4, -0.17, 0, Math.PI * 2); ctx.fill();
    return textureFromCanvas(c);
  })();

  const spike = (() => {
    const [c, ctx] = makeCanvas(64, 128);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath(); ctx.moveTo(4, 127); ctx.lineTo(30, 2); ctx.lineTo(32, 127); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(140,140,140,1)';
    ctx.beginPath(); ctx.moveTo(32, 127); ctx.lineTo(30, 2); ctx.lineTo(60, 127); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
    return textureFromCanvas(c);
  })();

  const rock = (() => {
    const [c, ctx] = makeCanvas(48, 48);
    const rnd = seeded(23);
    const out: number[][] = [[7, 22], [14, 9], [27, 5], [39, 11], [45, 25], [40, 38], [27, 44], [12, 39]];
    const mid = [24, 24];
    poly(ctx, out, '#8c8c8c');
    poly(ctx, [out[0], out[1], out[2], out[3], [30, 20], mid], '#f2f2f2');
    poly(ctx, [out[0], mid, [20, 33], out[7]], '#c4c4c4');
    poly(ctx, [out[3], out[4], [33, 30], [30, 20]], '#a8a8a8');
    poly(ctx, [out[4], out[5], out[6], [20, 33], mid, [30, 20], [33, 30]], '#6a6a6a');
    grain(ctx, 48, 48, rnd, 40, 1.2);
    ctx.beginPath(); out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.strokeStyle = 'rgba(40,40,40,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    return textureFromCanvas(c);
  })();

  const rockSpike = (() => {
    const [c, ctx] = makeCanvas(64, 128);
    const rnd = seeded(31);
    const left = [[3, 127], [7, 104], [5, 92], [12, 70], [11, 58], [19, 36], [22, 24], [27, 12], [31, 2]];
    const right = [[31, 2], [35, 14], [37, 22], [44, 42], [43, 55], [51, 76], [50, 90], [57, 108], [61, 127]];
    const ridge = [[31, 2], [30, 24], [33, 46], [29, 70], [33, 96], [30, 127]];
    poly(ctx, [...left, ...[...ridge].reverse()], '#e9e6e0');
    poly(ctx, [...ridge, ...right.slice(1).reverse()].reverse(), '#7e7a74');
    // secondary facets: chipped planes catching light and pits in shadow
    poly(ctx, [[12, 70], [11, 58], [19, 36], [26, 52], [20, 76]], '#c9c5bd');
    poly(ctx, [[5, 92], [12, 70], [20, 76], [17, 102]], '#d7d3cb');
    poly(ctx, [[33, 46], [44, 42], [43, 55], [36, 66]], '#a29d95');
    poly(ctx, [[33, 96], [50, 90], [57, 108], [40, 114]], '#625e58');
    poly(ctx, [[31, 2], [35, 14], [30, 24]], '#fbfaf7');
    // strata and fractures
    ctx.lineCap = 'round';
    for (const [y, d] of [[34, 3], [57, 4], [83, 5], [108, 5]]) {
      ctx.beginPath(); ctx.moveTo(4 + y * 0.12, y); ctx.lineTo(32, y + d); ctx.lineTo(60 - y * 0.12, y + d - 2);
      ctx.strokeStyle = 'rgba(40,36,32,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6 + y * 0.12, y + 2); ctx.lineTo(30, y + d + 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(25, 40); ctx.lineTo(21, 52); ctx.lineTo(25, 61); ctx.moveTo(41, 70); ctx.lineTo(46, 84); ctx.lineTo(42, 95);
    ctx.strokeStyle = 'rgba(30,26,22,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    grain(ctx, 64, 128, rnd, 160, 1.4);
    // buried base: soil darkening
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 80, 0, 128);
    g.addColorStop(0, 'rgba(30,22,14,0)'); g.addColorStop(1, 'rgba(30,22,14,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128); ctx.restore();
    ctx.beginPath(); [...left, ...right.slice(1)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(36,32,28,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
    return textureFromCanvas(c);
  })();

  const fissure = (() => {
    const [c, ctx] = makeCanvas(256, 48);
    const rnd = seeded(41);
    const top: number[][] = [], bottom: number[][] = [];
    let y = 24;
    for (let x = 2; x <= 254; x += 9) {
      const u = (x - 2) / 252, wid = Math.sin(Math.PI * u) ** 0.7 * 7 + 0.6;
      y = Math.max(14, Math.min(34, y + (rnd() - 0.5) * 7));
      top.push([x, y - wid * (0.6 + rnd() * 0.5)]);
      bottom.push([x, y + wid * (0.6 + rnd() * 0.5)]);
    }
    // lit broken lip on the far (upper) edge, shadowed lip on the near edge
    ctx.beginPath(); top.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy - 2.5) : ctx.moveTo(x, yy - 2.5)));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineJoin = 'bevel'; ctx.stroke();
    ctx.beginPath(); bottom.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy + 2) : ctx.moveTo(x, yy + 2)));
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.stroke();
    poly(ctx, [...top, ...[...bottom].reverse()], 'rgba(0,0,0,0.95)');
    // hairline branches
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 2; i < top.length - 2; i += 3) {
      const [x, yy] = rnd() < 0.5 ? top[i] : bottom[i], dir = yy < 24 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 6 + rnd() * 8, yy + dir * (4 + rnd() * 6)); ctx.lineTo(x + 12 + rnd() * 10, yy + dir * (7 + rnd() * 8)); ctx.stroke();
    }
    return textureFromCanvas(c);
  })();

  const leaf = (() => {
    const [c, ctx] = makeCanvas(48, 24);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath(); ctx.moveTo(2, 12); ctx.quadraticCurveTo(22, -4, 46, 12); ctx.quadraticCurveTo(22, 28, 2, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(44, 12); ctx.stroke();
    return textureFromCanvas(c);
  })();

  const drop = (() => {
    const [c, ctx] = makeCanvas(24, 36);
    const g = ctx.createRadialGradient(9, 24, 1, 12, 24, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(12, 1); ctx.quadraticCurveTo(22, 18, 22, 24); ctx.arc(12, 24, 10, 0, Math.PI); ctx.quadraticCurveTo(2, 18, 12, 1); ctx.fill();
    return textureFromCanvas(c);
  })();

  const chevron = (() => {
    const [c, ctx] = makeCanvas(64, 48);
    ctx.shadowColor = 'rgba(255,255,255,1)'; ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath(); ctx.moveTo(6, 40); ctx.lineTo(32, 10); ctx.lineTo(58, 40); ctx.lineTo(46, 40); ctx.lineTo(32, 24); ctx.lineTo(18, 40); ctx.closePath(); ctx.fill();
    return textureFromCanvas(c);
  })();

  const rune = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    const rnd = seeded(11);
    ctx.translate(256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 8;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 236, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.stroke();
    // glyph band between 200 and 236
    for (let i = 0; i < 24; i++) {
      ctx.save(); ctx.rotate((i / 24) * Math.PI * 2); ctx.translate(0, -218);
      ctx.lineWidth = 2.5; ctx.beginPath();
      const k = (rnd() * 4) | 0;
      if (k === 0) { ctx.moveTo(-7, -9); ctx.lineTo(7, 9); ctx.moveTo(7, -9); ctx.lineTo(-7, 9); }
      else if (k === 1) { ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.moveTo(-7, -3); ctx.lineTo(7, -3); }
      else if (k === 2) { ctx.arc(0, 0, 7, 0, Math.PI * 1.5); }
      else { ctx.moveTo(-7, 9); ctx.lineTo(0, -10); ctx.lineTo(7, 9); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); }
      ctx.stroke(); ctx.restore();
    }
    // hexagram
    ctx.lineWidth = 2.5;
    for (const off of [0, Math.PI / 3]) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) { const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2; i ? ctx.lineTo(Math.cos(a) * 200, Math.sin(a) * 200) : ctx.moveTo(Math.cos(a) * 200, Math.sin(a) * 200); }
      ctx.stroke();
    }
    return textureFromCanvas(c);
  })();

  const bubble = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    radial(ctx, 128, 128, 126, [[0, 0.06], [0.6, 0.1], [0.85, 0.35], [0.95, 0.9], [0.985, 0.6], [1, 0]]);
    radial(ctx, 84, 78, 34, falloff(2).map(([t, v]) => [t, v * 0.7]) as [number, number][]);
    return textureFromCanvas(c);
  })();

  const tendril = (() => {
    const [c, ctx] = makeCanvas(64, 128);
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 32 + Math.sin(t * 5.2) * 12 * t;
      const y = 126 - t * 118;
      const w = (1 - t) * 6 + 1;
      ctx.fillStyle = `rgba(${Math.round(255 - 90 * (x > 32 ? 1 : 0))},${Math.round(255 - 90 * (x > 32 ? 1 : 0))},${Math.round(255 - 90 * (x > 32 ? 1 : 0))},1)`;
      ctx.beginPath(); ctx.arc(x, y, w, 0, Math.PI * 2); ctx.fill();
    }
    // two small leaves
    for (const [lx, ly, a] of [[40, 70, -0.6], [24, 40, 3.6]] as const) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(a);
      ctx.fillStyle = 'rgba(230,230,230,1)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -7, 16, 0); ctx.quadraticCurveTo(8, 7, 0, 0); ctx.fill();
      ctx.restore();
    }
    return textureFromCanvas(c);
  })();

  const plus = (() => {
    const [c, ctx] = makeCanvas(48, 48);
    ctx.shadowColor = 'rgba(255,255,255,1)'; ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(18, 6, 12, 36); ctx.fillRect(6, 18, 36, 12);
    return textureFromCanvas(c);
  })();

  const crackedShield = (() => {
    const [c, ctx] = makeCanvas(64, 80);
    ctx.strokeStyle = 'white'; ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 5; ctx.lineJoin = 'round';
    for (const points of [
      [[8, 10], [29, 10], [23, 29], [32, 37], [22, 49], [28, 69], [10, 47]],
      [[37, 10], [56, 10], [54, 47], [36, 69], [30, 52], [40, 35], [31, 27]],
    ]) {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    return textureFromCanvas(c);
  })();

  const vineSegment = (() => {
    const [c, ctx] = makeCanvas(96, 48);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(3, 25); ctx.quadraticCurveTo(48, 20, 93, 25);
    ctx.strokeStyle = '#24301c'; ctx.lineWidth = 16; ctx.stroke();
    ctx.strokeStyle = '#adc681'; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 21); ctx.quadraticCurveTo(48, 17, 91, 21);
    ctx.strokeStyle = '#ecf5be'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(35, 23); ctx.lineTo(49, 4); ctx.lineTo(53, 23);
    ctx.fillStyle = '#a5bb79'; ctx.fill(); ctx.strokeStyle = '#24301c'; ctx.lineWidth = 2; ctx.stroke();
    return textureFromCanvas(c);
  })();
  const mountain = (() => {
    const [c, ctx] = makeCanvas(320, 256);
    const rnd = seeded(53);
    const face = (points: number[][], color: string) => {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    face([[4,248],[31,190],[49,181],[67,115],[87,127],[114,74],[129,80],[159,5],[186,65],
      [202,58],[221,111],[241,94],[267,158],[286,173],[316,248]], '#77736c');
    face([[4,248],[67,115],[87,127],[114,74],[129,80],[159,5],[144,108],[104,156],[83,222]], '#e4e0d8');
    face([[159,5],[186,65],[202,58],[221,111],[211,187],[181,245],[143,244],[158,145],[144,108]], '#9b968d');
    face([[241,94],[267,158],[286,173],[316,248],[220,247],[225,174]], '#b3aea5');
    face([[159,5],[144,108],[125,136],[143,129],[122,185],[160,148],[173,97]], '#55514b');
    face([[67,115],[83,162],[56,205],[87,188],[71,233],[112,245],[32,248]], '#a49f96');
    face([[202,58],[210,124],[195,147],[214,137],[198,215],[235,174],[221,111]], '#4b4742');
    face([[241,94],[225,174],[244,162],[236,205],[267,230],[253,162]], '#dcd8d0');
    ctx.strokeStyle = '#f6f4ef'; ctx.lineWidth = 3; ctx.lineJoin = 'bevel';
    for (const line of [[[16,232],[52,190],[67,115]],[[92,140],[114,74],[129,80],[159,5]],[[144,108],[158,145],[145,209]],[[267,158],[286,173],[304,222]]]) {
      ctx.beginPath(); line.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.stroke();
    }
    ctx.strokeStyle = '#3e3a35'; ctx.lineWidth = 3;
    for (const line of [[[104,156],[100,177],[119,185],[105,217]],[[174,175],[181,189],[169,211],[178,233]],[[269,200],[280,217],[273,239]]]) {
      ctx.beginPath(); line.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = 30 + rnd() * 260, y = 40 + rnd() * 200;
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + rnd() * 14, y + (rnd() - 0.3) * 6);
      ctx.strokeStyle = rnd() < 0.6 ? 'rgba(30,28,25,0.35)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    }
    grain(ctx, 320, 256, rnd, 900, 2);
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const soil = ctx.createLinearGradient(0, 190, 0, 256);
    soil.addColorStop(0, 'rgba(40,30,20,0)'); soil.addColorStop(1, 'rgba(40,30,20,0.7)');
    ctx.fillStyle = soil; ctx.fillRect(0, 0, 320, 256); ctx.restore();
    return textureFromCanvas(c);
  })();
  const drawHalberd = (ctx: CanvasRenderingContext2D) => {
    const metal = ctx.createLinearGradient(40, 0, 130, 0);
    metal.addColorStop(0, '#f9edc6'); metal.addColorStop(0.3, '#b5a47c');
    metal.addColorStop(0.65, '#655d49'); metal.addColorStop(1, '#d6c8a1');
    ctx.fillStyle = '#b9aa84'; ctx.fillRect(151, 33, 5, 196);
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#f5e7ba';
    for (const points of [[[154,8],[178,39],[165,66],[154,52],[157,35]], [[152,47],[136,64],[147,71],[153,61]]]) {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath(); ctx.fillStyle = metal; ctx.fill(); ctx.stroke();
    }
  };
  const drawGuardian = (armed: boolean) => {
    const [c, ctx] = makeCanvas(192, 256);
    ctx.lineJoin = 'round';
    const metal = ctx.createLinearGradient(40, 0, 130, 0);
    metal.addColorStop(0, '#f9edc6'); metal.addColorStop(0.3, '#b5a47c');
    metal.addColorStop(0.65, '#655d49'); metal.addColorStop(1, '#d6c8a1');
    const shape = (points: number[][], fill: string | CanvasGradient, edge = '#f5e7ba', width = 2.5) => {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke();
    };
    const cape = ctx.createLinearGradient(0, 80, 0, 250);
    cape.addColorStop(0, 'rgba(158,145,110,0.65)'); cape.addColorStop(0.65, 'rgba(130,119,91,0.45)');
    cape.addColorStop(1, 'rgba(235,220,173,0)');
    shape([[47,79],[124,79],[138,185],[128,224],[115,209],[109,247],[92,219],[73,248],[64,216],[43,237],[32,191]], cape, 'rgba(231,214,169,0.35)');
    if (armed) drawHalberd(ctx);
    shape([[61,39],[65,22],[84,15],[105,24],[111,42],[100,56],[70,56]], metal);
    shape([[80,19],[86,4],[92,20],[89,40],[83,40]], '#e5d9b3');
    shape([[69,43],[103,43],[99,67],[86,76],[73,65]], '#514d41');
    ctx.strokeStyle = '#fff2cc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(74,50); ctx.lineTo(82,52); ctx.moveTo(91,52); ctx.lineTo(99,50); ctx.stroke();
    shape([[82,44],[89,44],[92,68],[85,73],[80,65]], metal);
    shape([[57,77],[85,70],[113,77],[112,117],[86,139],[59,119]], metal);
    shape([[60,83],[85,96],[111,83],[104,108],[86,122],[66,108]], '#8d8266');
    shape([[54,71],[34,75],[24,97],[52,105],[67,88]], metal);
    shape([[116,71],[136,76],[145,98],[118,105],[104,88]], metal);
    shape([[30,102],[48,108],[48,141],[34,147],[26,132]], metal);
    shape([[125,105],[138,103],[148,122],[159,120],[162,134],[141,142],[124,126]], metal);
    shape([[58,124],[111,124],[114,138],[56,138]], '#ded0a6');
    shape([[57,142],[83,143],[79,181],[49,174]], metal);
    shape([[89,143],[113,142],[123,174],[94,182]], metal);
    const mist = ctx.createLinearGradient(0, 171, 0, 244);
    mist.addColorStop(0, 'rgba(216,202,159,0.8)'); mist.addColorStop(1, 'rgba(216,202,159,0)');
    shape([[62,176],[81,183],[78,225],[66,244],[57,219]], mist, 'rgba(244,229,185,0.3)');
    shape([[94,182],[111,177],[118,218],[106,242],[98,225]], mist, 'rgba(244,229,185,0.3)');
    return textureFromCanvas(c);
  };
  const guardian = drawGuardian(true), guardianBody = drawGuardian(false);
  const guardianHalberd = (() => {
    const [c, ctx] = makeCanvas(192, 256);
    drawHalberd(ctx);
    return textureFromCanvas(c);
  })();
  const rockPlate = (() => {
    const [c, ctx] = makeCanvas(64, 80);
    const rnd = seeded(61);
    const out = [[13, 6], [33, 3], [50, 10], [60, 30], [55, 52], [49, 71], [27, 77], [8, 62], [4, 38], [7, 20]];
    const fill = ctx.createLinearGradient(8, 6, 56, 76);
    fill.addColorStop(0, '#f0ede6'); fill.addColorStop(0.45, '#aaa59c'); fill.addColorStop(1, '#5d5952');
    poly(ctx, out, fill);
    poly(ctx, [[7, 20], [13, 6], [33, 3], [50, 10], [42, 19], [22, 17]], '#fbf9f4');
    poly(ctx, [[60, 30], [55, 52], [49, 71], [43, 60], [50, 33]], '#6f6a62');
    poly(ctx, [[8, 62], [27, 77], [49, 71], [40, 66], [22, 68]], '#56524b');
    ctx.beginPath(); ctx.moveTo(35, 21); ctx.lineTo(29, 34); ctx.lineTo(35, 45); ctx.lineTo(26, 63);
    ctx.moveTo(29, 34); ctx.lineTo(16, 38); ctx.moveTo(35, 45); ctx.lineTo(47, 42);
    ctx.strokeStyle = 'rgba(40,36,30,0.85)'; ctx.lineWidth = 2; ctx.lineJoin = 'bevel'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36, 22); ctx.lineTo(30, 34); ctx.moveTo(36, 46); ctx.lineTo(48, 43);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    grain(ctx, 64, 80, rnd, 160, 1.5);
    ctx.beginPath(); out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.strokeStyle = '#3b3731'; ctx.lineWidth = 2.5; ctx.stroke();
    return textureFromCanvas(c);
  })();
  const { bell, bellCracks } = makeBellSurfaces();

  const digits: Record<string, Texture> = {};
  for (const ch of '0123456789+-!') {
    const [c, ctx] = makeCanvas(TEX_METRICS.digitWidth, TEX_METRICS.digitHeight);
    ctx.font = '900 52px "Arial Black", Impact, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(ch, 22, 34);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillText(ch, 22, 34);
    digits[ch] = textureFromCanvas(c);
  }

  return { stormCloud, glow, dot, ring, disc, streak, beam, star, puff, crescent, shard, blade, swordCrack, spike, rock, rockPlate, rockSpike, fissure, guardian, guardianBody, guardianHalberd, mountain, leaf, drop, chevron, rune, bubble, tendril, vineSegment, plus, crackedShield, bell, bellCracks, digits };
}
