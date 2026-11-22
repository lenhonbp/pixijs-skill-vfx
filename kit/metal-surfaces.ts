import type { Texture } from 'pixi.js';
import { mulberry32 } from './ease';
import { textureFromCanvas } from './pixi-compat';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

type Point = readonly [number, number];
function path(ctx: CanvasRenderingContext2D, points: readonly Point[], close = false) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

export function makeSteelBlade() {
  const [c, ctx] = canvas(64, 160);
  const steel = ctx.createLinearGradient(16, 0, 48, 0);
  steel.addColorStop(0, '#ffffe8'); steel.addColorStop(0.11, '#e4edf2');
  steel.addColorStop(0.22, '#8596ab'); steel.addColorStop(0.47, '#b7c8d8');
  steel.addColorStop(0.51, '#f2f4f5'); steel.addColorStop(0.56, '#303a50');
  steel.addColorStop(0.85, '#667a91'); steel.addColorStop(1, '#e1e7dd');
  path(ctx, [[16, 44], [48, 44], [43, 128], [32, 160], [21, 128]], true);
  ctx.fillStyle = steel; ctx.fill();
  ctx.save(); ctx.clip();
  const reflection = ctx.createLinearGradient(20, 44, 46, 140);
  reflection.addColorStop(0, 'rgba(19,25,42,0.55)');
  reflection.addColorStop(0.37, 'rgba(238,250,255,0.34)');
  reflection.addColorStop(0.44, 'rgba(255,255,242,0.72)');
  reflection.addColorStop(0.51, 'rgba(255,255,242,0.05)');
  reflection.addColorStop(1, 'rgba(2,17,33,0.42)');
  ctx.fillStyle = reflection; ctx.fillRect(16, 44, 32, 116); ctx.restore();
  ctx.strokeStyle = '#f4f5e2'; ctx.lineWidth = 1.5;
  path(ctx, [[16.7, 47], [21.6, 128], [32, 158]]); ctx.stroke();
  const brass = ctx.createLinearGradient(0, 33, 0, 52);
  brass.addColorStop(0, '#72502c'); brass.addColorStop(0.32, '#ffe9a9');
  brass.addColorStop(0.58, '#c58e42'); brass.addColorStop(1, '#593410');
  ctx.fillStyle = brass;
  path(ctx, [[3, 34], [23, 38], [32, 33], [41, 38], [61, 34], [55, 46], [32, 51], [9, 46]], true); ctx.fill();
  ctx.fillStyle = '#382d2e'; ctx.fillRect(26, 11, 12, 24);
  ctx.strokeStyle = '#b69260'; ctx.lineWidth = 2;
  for (const y of [15, 22, 29]) { path(ctx, [[26, y], [38, y + 4]]); ctx.stroke(); }
  ctx.fillStyle = '#e1bd75';
  path(ctx, [[23, 9], [32, 1], [41, 9], [32, 16]], true); ctx.fill();
  return textureFromCanvas(c);
}

interface BellFragment {
  texture: Texture;
  x: number;
  y: number;
}

const fragments = new WeakMap<Texture, BellFragment[]>();
export const bellFragments = (bell: Texture) => fragments.get(bell);

function bronze(ctx: CanvasRenderingContext2D, left: number, right: number) {
  const g = ctx.createLinearGradient(left, 0, right, 0);
  g.addColorStop(0, '#492b1c'); g.addColorStop(0.12, '#8c552d');
  g.addColorStop(0.26, '#ce9453'); g.addColorStop(0.35, '#ffe1a2');
  g.addColorStop(0.40, '#bc8246'); g.addColorStop(0.58, '#87603a');
  g.addColorStop(0.76, '#5d3b2a'); g.addColorStop(0.92, '#935a34');
  g.addColorStop(1, '#4a2c1f');
  return g;
}

function brokenEdge(a: Point, b: Point): Point[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if ((dx === 0 && (a[0] === 0 || a[0] === 256)) || (dy === 0 && (a[1] === 0 || a[1] === 320))) return [a, b];
  return [a, [a[0] + dx * 0.3 - dy * 0.08, a[1] + dy * 0.3 + dx * 0.08],
    [a[0] + dx * 0.64 + dy * 0.08, a[1] + dy * 0.64 - dx * 0.08], b];
}

export function makeBellSurfaces() {
  const [c, ctx] = canvas(256, 320);
  const body = bronze(ctx, 18, 238);
  ctx.beginPath(); ctx.ellipse(128, 28, 17, 20, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#382319'; ctx.lineWidth = 15; ctx.stroke();
  ctx.strokeStyle = body; ctx.lineWidth = 11; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(128, 27, 16, 19, 0, Math.PI * 0.83, Math.PI * 1.64);
  ctx.strokeStyle = '#ffeac1'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(105, 44); ctx.bezierCurveTo(72, 48, 58, 73, 56, 112);
  ctx.bezierCurveTo(51, 165, 54, 232, 34, 262);
  ctx.quadraticCurveTo(26, 275, 17, 279); ctx.lineTo(14, 294);
  ctx.quadraticCurveTo(128, 320, 242, 294); ctx.lineTo(239, 279);
  ctx.quadraticCurveTo(230, 275, 222, 262);
  ctx.bezierCurveTo(202, 232, 205, 165, 200, 112);
  ctx.bezierCurveTo(198, 73, 184, 48, 151, 44); ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.strokeStyle = '#39271f'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.clip();
  const shade = ctx.createLinearGradient(0, 44, 0, 292);
  shade.addColorStop(0, 'rgba(255,227,162,0.28)');
  shade.addColorStop(0.19, 'rgba(54,30,18,0.18)');
  shade.addColorStop(0.44, 'rgba(33,20,33,0.24)');
  shade.addColorStop(0.73, 'rgba(94,40,20,0.08)');
  shade.addColorStop(1, 'rgba(33,19,21,0.55)');
  ctx.fillStyle = shade; ctx.fillRect(0, 44, 256, 253);
  const rnd = mulberry32(192);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = rnd() < 0.49 ? 'rgba(255,229,183,0.12)' : 'rgba(32,20,25,0.2)';
    ctx.fillRect(rnd() * 232 + 12, rnd() * 257 + 43, 0.7 + rnd() * 2.2, 0.6 + rnd() * 1.8);
  }
  for (const [y, x, width] of [[74, 65, 5], [105, 52, 10], [221, 45, 6], [246, 40, 9], [279, 15, 9], [290, 12, 6]]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(128, y + 23, 256 - x, y);
    ctx.strokeStyle = '#4a2b1e'; ctx.lineWidth = width + 4; ctx.stroke();
    ctx.strokeStyle = bronze(ctx, x - 5, 261 - x); ctx.lineWidth = width; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - width * 0.36); ctx.quadraticCurveTo(128, y + 23 - width * 0.36, 256 - x, y - width * 0.36);
    ctx.strokeStyle = 'rgba(255,224,158,0.60)'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  for (const x of [64, 85, 107, 128, 149, 171, 192]) {
    const y = 128 + Math.sin((x - 64) * Math.PI / 128) * 8;
    const stud = ctx.createRadialGradient(x - 1.5, y - 2, 0, x, y, 6.5);
    stud.addColorStop(0, '#ffe9b5'); stud.addColorStop(0.45, '#c68d49'); stud.addColorStop(1, '#553220');
    ctx.fillStyle = stud; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  for (const x of [82, 128, 174]) {
    const y = x === 128 ? 19 : 13;
    ctx.strokeStyle = 'rgba(54,32,23,0.66)'; ctx.lineWidth = 2.6;
    path(ctx, [[x - 19, 143 + y], [x + 19, 143 + y], [x + 18, 191 + y],
      [x, 202 + y], [x - 18, 191 + y]], true); ctx.stroke();
    for (const dx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, 193 + y); ctx.quadraticCurveTo(x + 17 * dx, 190 + y, x + 11 * dx, 172 + y);
      ctx.quadraticCurveTo(x + 2 * dx, 175 + y, x, 159 + y);
      ctx.strokeStyle = 'rgba(248,205,142,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }
  ctx.restore();
  const mouth = ctx.createLinearGradient(0, 293, 0, 313);
  mouth.addColorStop(0, '#271a1a'); mouth.addColorStop(0.64, '#473020'); mouth.addColorStop(1, '#a26935');
  ctx.beginPath(); ctx.ellipse(128, 298, 111, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = mouth; ctx.fill(); ctx.strokeStyle = '#3f261b'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(128, 298, 110, 13, 0, 0, Math.PI);
  ctx.strokeStyle = bronze(ctx, 13, 243); ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(128, 298, 110, 13, 0, 0.54, 2.9);
  ctx.strokeStyle = 'rgba(252,222,167,0.60)'; ctx.lineWidth = 1.5; ctx.stroke();

  const [cracks, crackCtx] = canvas(c.width, c.height);
  const corners: Point[][] = [
    [[0, 0], [88, 0], [151, 0], [256, 0]],
    [[0, 114], [79, 95], [150, 133], [256, 98]],
    [[0, 197], [114, 188], [172, 224], [256, 203]],
    [[0, 320], [60, 320], [157, 320], [256, 320]],
  ];
  const pieces: BellFragment[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const [a, b, d, e] = [corners[row][col], corners[row][col + 1], corners[row + 1][col + 1], corners[row + 1][col]];
      const top = brokenEdge(a, b), right = brokenEdge(b, d), bottom = brokenEdge(e, d), left = brokenEdge(a, e);
      const edge = [...top, ...right.slice(1), ...[...bottom].reverse().slice(1), ...[...left].reverse().slice(1)];
      const xs = edge.map(([x]) => x), ys = edge.map(([, y]) => y);
      const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
      const width = Math.ceil(Math.max(...xs)) - x, height = Math.ceil(Math.max(...ys)) - y;
      const [piece, partCtx] = canvas(width, height);
      partCtx.translate(-x, -y);
      path(partCtx, edge, true); partCtx.clip(); partCtx.drawImage(c, 0, 0);
      partCtx.globalCompositeOperation = 'source-atop';
      partCtx.strokeStyle = 'rgba(255,226,177,0.7)'; partCtx.lineWidth = 3; partCtx.stroke();
      pieces.push({ texture: textureFromCanvas(piece), x: x + width / 2, y: y + height / 2 });
      crackCtx.strokeStyle = '#fff1cc'; crackCtx.lineWidth = 4;
      if (row > 0) { path(crackCtx, top); crackCtx.stroke(); }
      if (col > 0) { path(crackCtx, left); crackCtx.stroke(); }
    }
  }
  crackCtx.globalCompositeOperation = 'destination-in'; crackCtx.drawImage(c, 0, 0);
  const bell = textureFromCanvas(c);
  fragments.set(bell, pieces);
  return { bell, bellCracks: textureFromCanvas(cracks) };
}
