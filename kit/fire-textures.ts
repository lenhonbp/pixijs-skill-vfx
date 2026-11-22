import type { Texture } from 'pixi.js';
import { clamp01, lerp, mulberry32 } from './ease';
import { noise3 } from './noise';
import { textureFromCanvas } from './pixi-compat';

type Pixel = readonly [number, number, number, number];

function bake(width: number, height: number, sample: (x: number, y: number) => Pixel): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.data.set(sample((x + 0.5) / width, (y + 0.5) / height), (y * width + x) * 4);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return textureFromCanvas(canvas);
}

function flame(seed: number): Texture {
  return bake(144, 88, (x, y) => {
    const bend = 0.13 * Math.sin(x * 7 + seed) + 0.11 * noise3(x * 4, seed);
    const v = y - 0.5 - bend * x;
    const taper = Math.sin(Math.PI * Math.pow(x, 0.55)) * (0.33 - x * 0.13);
    const tongue = Math.sin(7 * x + seed) * 0.25 * x;
    const noise = noise3(7 * x, 5 * y, seed) * 0.16 + noise3(19 * x, 14 * y, seed) * 0.06;
    const body = taper - Math.min(Math.abs(v), Math.abs(v - tongue) + 0.075) + noise * (0.45 + x);
    const hot = clamp01((body - 0.04) * 5.8) * (1 - 0.68 * x);
    const yellow = clamp01(2 * hot);
    const white = clamp01((hot - 0.4) * 2);
    const edge = clamp01(x * 32) * clamp01((1 - x) * 16) * clamp01(Math.min(y, 1 - y) * 13);
    return [255, lerp(47, 230, yellow), lerp(7, 190, white), 255 * clamp01(body * 14) * edge * (1 - 0.65 * x)];
  });
}

function smoke(seed: number): Texture {
  return bake(96, 96, (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5) * 2;
    const turbulence = 0.23 * noise3(x * 5, y * 5, seed) + 0.12 * noise3(x * 11, y * 11, seed);
    const density = clamp01(1 - r * r + turbulence) * clamp01((1 - r) * 3.8);
    const light = 225 + 24 * noise3(x * 8, y * 8, seed);
    return [light, light, light, 245 * density * density];
  });
}

function scorch(): Texture {
  return bake(128, 128, (x, y) => {
    const r = Math.hypot((x - 0.5) * 2, (y - 0.5) * 2);
    const coarse = noise3(x * 9, y * 9, 6);
    const grit = noise3(x * 50, y * 50, 2);
    const ash = clamp01(1 - r * 1.25 + coarse * 0.33 + grit * 0.16) * clamp01((0.96 - r) * 7);
    const gray = 17 + 12 * grit;
    return [gray + 10, gray, gray - 3, ash * 250];
  });
}

function meteor(): Texture {
  const rng = mulberry32(341);
  const plates = Array.from({ length: 25 }, (_, i) => ({
    x: (i % 5 + 0.2 + rng() * 0.6) / 5,
    y: (Math.floor(i / 5) + 0.2 + rng() * 0.6) / 5,
    shade: rng() * 24,
  }));
  return bake(144, 120, (x, y) => {
    const u = (x - 0.51) * 2, v = (y - 0.5) * 2;
    const coarse = noise3(x * 7, y * 7, 12);
    const grain = noise3(x * 34, y * 34, 6);
    const profile = Math.hypot(u * 1.14, v * 1.23) + 0.12 * coarse + 0.04 * grain;
    const alpha = 255 * clamp01((1 - profile) * 40);
    if (!alpha) return [0, 0, 0, 0];

    let first = 1, second = 1, shade = 0;
    const px = x + 0.027 * coarse, py = y + 0.03 * noise3(x * 12, y * 12, 5);
    for (const plate of plates) {
      const d = (px - plate.x) ** 2 + (py - plate.y) ** 2;
      if (d < first) {
        second = first;
        first = d;
        shade = plate.shade;
      } else if (d < second) second = d;
    }
    const fissure = clamp01(1 - (second - first) * 185);
    const heated = fissure * (0.27 + 0.73 * clamp01((u + 0.8) * 0.58 + 0.25 * coarse));
    const flank = clamp01(1 - profile * profile) * (0.65 - v * 0.28);
    const rock = 19 + flank * (33 + shade) + 14 * coarse + 11 * grain;
    return [rock + 217 * heated, rock * 0.7 + 103 * heated ** 2, rock * 0.61 + 28 * heated ** 3, alpha];
  });
}

interface FireTextures {
  flames: Texture[];
  smoke: Texture[];
  scorch: Texture;
  meteor: Texture;
}

let textures: FireTextures | undefined;

export const isFireEnergyTexture = (texture: Texture) => textures?.flames.includes(texture) ?? false;

export function fireTextures(): FireTextures {
  return textures ??= {
    flames: Array.from({ length: 5 }, (_, i) => flame(i * 7 + 1)),
    smoke: [smoke(4), smoke(19), smoke(29)],
    scorch: scorch(),
    meteor: meteor(),
  };
}
