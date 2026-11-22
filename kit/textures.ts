// Procedural VFX textures. Everything is drawn white on transparent so `tint`
// colors it, and baked ONCE at startup (never per frame).
import type { Texture } from 'pixi.js';
import { textureFromCanvas } from './pixi-compat';

export interface VfxTextures {
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
  /** Sword blade pointing down (+y), lit from the left. 24x128, anchor (0.5, 1) = tip. Sword rain. */
  blade: Texture;
  /** Rock/ice spike pointing up, lit from the left. 64x128, anchor (0.5, 1) = base. Earth spikes, ice nova. */
  spike: Texture;
  /** Faceted rock chunk, lit from the upper left. Size 48. Debris (normal blend). */
  rock: Texture;
  /** Solid beveled armor slab with cracks. 64x80. Normal blend. */
  rockPlate: Texture;
  /** Spectral armored halberd guardian, feet at (88, 244). 192x256. */
  guardian: Texture;
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
  /** Plus/cross. Size 48. Heals. */
  plus: Texture;
  /** Split shield outline with a jagged crack. 64x80. Armor break. */
  crackedShield: Texture;
  /** Temple bell with hanging loop, bands, studs and translucent engraved body. 256x320. */
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

export function createVfxTextures(): VfxTextures {
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

  const blade = (() => {
    const [c, ctx] = makeCanvas(24, 128);
    const g = ctx.createLinearGradient(4, 0, 20, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(235,235,235,1)');
    g.addColorStop(0.52, 'rgba(150,150,150,1)');
    g.addColorStop(1, 'rgba(110,110,110,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 30); ctx.lineTo(16, 30); ctx.lineTo(15, 112); ctx.lineTo(12, 127); ctx.lineTo(9, 112);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,200,200,1)';
    ctx.fillRect(1, 24, 22, 6); // guard
    ctx.fillStyle = 'rgba(120,120,120,1)';
    ctx.fillRect(9, 2, 6, 22); // grip
    radial(ctx, 12, 4, 5, [[0, 1], [1, 0.8]]);
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
    const pts: [number, number][] = [[8, 20], [20, 6], [36, 10], [44, 26], [34, 42], [14, 40]];
    ctx.fillStyle = 'rgba(120,120,120,1)';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(20, 6); ctx.lineTo(36, 10); ctx.lineTo(26, 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190,190,190,1)';
    ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(26, 24); ctx.lineTo(14, 40); ctx.closePath(); ctx.fill();
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

  const guardian = (() => {
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
    ctx.fillStyle = '#b9aa84'; ctx.fillRect(151, 33, 5, 196);
    shape([[154,8],[178,39],[165,66],[154,52],[157,35]], metal);
    shape([[152,47],[136,64],[147,71],[153,61]], metal);
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
  })();
  const rockPlate = (() => {
    const [c, ctx] = makeCanvas(64, 80);
    ctx.beginPath(); ctx.moveTo(14, 5); ctx.lineTo(48, 9); ctx.lineTo(60, 29);
    ctx.lineTo(51, 70); ctx.lineTo(25, 76); ctx.lineTo(5, 55); ctx.lineTo(6, 22); ctx.closePath();
    const fill = ctx.createLinearGradient(10, 8, 55, 74);
    fill.addColorStop(0, '#fff0ce'); fill.addColorStop(0.35, '#c8b18b'); fill.addColorStop(1, '#64523d');
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#49392b'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, 24); ctx.lineTo(16, 9); ctx.lineTo(47, 13); ctx.lineTo(53, 25);
    ctx.lineTo(26, 20); ctx.closePath(); ctx.fillStyle = '#ffe6b6'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(36, 22); ctx.lineTo(28, 36); ctx.lineTo(35, 46); ctx.lineTo(24, 65);
    ctx.moveTo(28, 36); ctx.lineTo(14, 39); ctx.moveTo(35, 46); ctx.lineTo(49, 43);
    ctx.strokeStyle = '#56432f'; ctx.lineWidth = 3; ctx.stroke();
    return textureFromCanvas(c);
  })();
  const bell = (() => {
    const [c, ctx] = makeCanvas(256, 320);
    ctx.beginPath();
    ctx.moveTo(100, 48);
    ctx.bezierCurveTo(72, 54, 58, 72, 55, 106);
    ctx.lineTo(44, 244);
    ctx.quadraticCurveTo(42, 262, 22, 279);
    ctx.lineTo(18, 296);
    ctx.quadraticCurveTo(128, 320, 238, 296);
    ctx.lineTo(234, 279);
    ctx.quadraticCurveTo(214, 262, 212, 244);
    ctx.lineTo(201, 106);
    ctx.bezierCurveTo(198, 72, 184, 54, 156, 48);
    ctx.closePath();
    const fill = ctx.createLinearGradient(18, 0, 238, 0);
    fill.addColorStop(0, 'rgba(86,70,48,0.72)');
    fill.addColorStop(0.18, 'rgba(211,195,159,0.58)');
    fill.addColorStop(0.3, 'rgba(255,249,222,0.62)');
    fill.addColorStop(0.4, 'rgba(220,206,169,0.56)');
    fill.addColorStop(0.7, 'rgba(157,137,100,0.58)');
    fill.addColorStop(1, 'rgba(76,59,38,0.76)');
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = 'rgba(134,112,72,0.88)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(128, 27, 14, 20, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(224,208,161,0.95)'; ctx.lineWidth = 12; ctx.stroke();
    ctx.fillStyle = 'rgba(180,155,102,0.95)'; ctx.fillRect(108, 43, 40, 12);
    for (const [y, x] of [[104, 55], [220, 46], [278, 24]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(128, y + 14, 256 - x, y);
      ctx.strokeStyle = 'rgba(100,78,44,0.8)'; ctx.lineWidth = 13; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.quadraticCurveTo(128, y + 21, 256 - x, y + 7);
      ctx.strokeStyle = 'rgba(242,226,182,0.85)'; ctx.lineWidth = 7; ctx.stroke();
    }
    for (const x of [70, 99, 128, 157, 186]) {
      ctx.beginPath(); ctx.arc(x, 130 + Math.sin((x - 55) / 146 * Math.PI) * 4, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(95,74,40,0.32)'; ctx.lineWidth = 2;
    for (const x of [65, 108, 151]) {
      ctx.strokeRect(x, 151, 36, 53);
      ctx.beginPath(); ctx.moveTo(x + 9, 168); ctx.lineTo(x + 27, 168);
      ctx.lineTo(x + 18, 189); ctx.closePath(); ctx.stroke();
      ctx.strokeRect(x - 3, 238, 39, 24);
    }
    const lip = ctx.createLinearGradient(0, 282, 0, 309);
    lip.addColorStop(0, 'rgba(240,222,172,0.92)');
    lip.addColorStop(0.45, 'rgba(165,137,84,0.9)');
    lip.addColorStop(1, 'rgba(73,53,28,0.94)');
    ctx.fillStyle = lip;
    ctx.beginPath(); ctx.ellipse(128, 295, 110, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(235,216,164,0.85)'; ctx.lineWidth = 4; ctx.stroke();
    return textureFromCanvas(c);
  })();
  const bellCracks = (() => {
    const [c, ctx] = makeCanvas(256, 320);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.lineJoin = 'bevel';
    for (const points of [
      [[115, 51], [133, 91], [117, 124], [147, 165], [129, 207], [153, 250], [139, 305]],
      [[117, 124], [87, 149], [97, 177], [50, 200]],
      [[129, 207], [179, 229], [171, 258], [222, 284]],
    ]) {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    return textureFromCanvas(c);
  })();

  const digits: Record<string, Texture> = {};
  for (const ch of '0123456789+-!') {
    const [c, ctx] = makeCanvas(44, 64);
    ctx.font = '900 52px "Arial Black", Impact, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(ch, 22, 34);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillText(ch, 22, 34);
    digits[ch] = textureFromCanvas(c);
  }

  return { glow, dot, ring, disc, streak, beam, star, puff, crescent, shard, blade, spike, rock, rockPlate, guardian, leaf, drop, chevron, rune, bubble, tendril, plus, crackedShield, bell, bellCracks, digits };
}
