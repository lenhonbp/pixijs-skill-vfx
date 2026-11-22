import type { Texture } from 'pixi.js';
import { textureFromCanvas } from './pixi-compat';

function draw(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d')!);
  return textureFromCanvas(canvas);
}

function leaf(bend: number): Texture {
  return draw(64, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#d7e5a8'); g.addColorStop(0.45, '#90ae65'); g.addColorStop(1, '#30492c');
    c.fillStyle = g; c.beginPath(); c.moveTo(3, 17);
    c.bezierCurveTo(20, -7 + bend, 44, 0, 62, 13); c.bezierCurveTo(42, 33, 18, 32 + bend, 3, 17); c.fill();
    c.strokeStyle = '#c5d69a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 18); c.quadraticCurveTo(29, 13, 60, 13); c.stroke();
    c.globalAlpha = 0.4; c.lineWidth = 0.7;
    for (let x = 15; x < 52; x += 9) {
      c.beginPath(); c.moveTo(x, 16); c.lineTo(x + 5, 5); c.moveTo(x, 16); c.lineTo(x + 7, 25); c.stroke();
    }
  });
}

function petal(color: string): Texture {
  return draw(36, 56, (c) => {
    const g = c.createLinearGradient(0, 3, 0, 53);
    g.addColorStop(0, '#fff9ed'); g.addColorStop(0.45, color); g.addColorStop(1, '#866343');
    c.fillStyle = g; c.beginPath(); c.moveTo(18, 54);
    c.bezierCurveTo(-9, 29, 4, -4, 18, 5); c.bezierCurveTo(38, -5, 40, 26, 18, 54); c.fill();
    c.strokeStyle = '#ffffff55'; c.beginPath(); c.moveTo(18, 49); c.quadraticCurveTo(14, 25, 18, 11); c.stroke();
  });
}

function mushroom(color: string): Texture {
  return draw(80, 88, (c) => {
    const stem = c.createLinearGradient(30, 0, 49, 0);
    stem.addColorStop(0, '#524339'); stem.addColorStop(0.5, '#c7b78a'); stem.addColorStop(1, '#70634e');
    c.fillStyle = stem; c.beginPath(); c.moveTo(35, 35); c.quadraticCurveTo(44, 65, 29, 84);
    c.quadraticCurveTo(40, 88, 52, 81); c.quadraticCurveTo(44, 61, 48, 34); c.fill();
    c.fillStyle = '#4c3546'; c.beginPath(); c.ellipse(40, 39, 36, 11, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a48b69'; c.lineWidth = 1;
    for (let i = 0; i < 13; i++) {
      const a = i / 12 * Math.PI; c.beginPath(); c.moveTo(40, 37); c.lineTo(40 + Math.cos(a) * 33, 39 + Math.sin(a) * 9); c.stroke();
    }
    const cap = c.createLinearGradient(0, 3, 0, 41);
    cap.addColorStop(0, '#c3b377'); cap.addColorStop(0.45, color); cap.addColorStop(1, '#423137');
    c.fillStyle = cap; c.beginPath(); c.moveTo(4, 38); c.bezierCurveTo(10, -8, 64, -10, 76, 38);
    c.quadraticCurveTo(40, 48, 4, 38); c.fill();
    c.fillStyle = '#dfd5aa';
    for (const [x, y, r] of [[22, 22, 3], [36, 10, 2], [52, 20, 4], [62, 31, 2], [34, 29, 2]]) {
      c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); c.fill();
    }
  });
}

function cloud(phase: number): Texture {
  return draw(128, 112, (c) => {
    for (let i = 0; i < 9; i++) {
      const x = 64 + Math.sin(i * 2.4 + phase) * 28, y = 56 + Math.cos(i * 1.7 + phase) * 21;
      const g = c.createRadialGradient(x, y, 1, x, y, 33);
      g.addColorStop(0, 'rgba(218,218,179,0.4)'); g.addColorStop(0.5, 'rgba(159,155,135,0.25)'); g.addColorStop(1, 'rgba(79,59,82,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 112);
    }
  });
}

interface WoodTextures {
  leaves: Texture[]; petals: Texture[]; mushrooms: Texture[]; clouds: Texture[];
  seed: Texture; stem: Texture; thorn: Texture; grass: Texture; center: Texture; spore: Texture; soil: Texture; moss: Texture; shaft: Texture; halo: Texture;
}

let cache: WoodTextures | undefined;

export const isWoodEnergyTexture = (texture: Texture) => texture === cache?.halo || texture === cache?.shaft;

export function woodTextures(): WoodTextures {
  return cache ??= {
    leaves: [leaf(0), leaf(7), leaf(-4)],
    petals: [petal('#e8a5b6'), petal('#fff3d7'), petal('#efc453')],
    mushrooms: [mushroom('#837644'), mushroom('#886775')],
    clouds: [cloud(0), cloud(2), cloud(4)],
    halo: draw(96, 96, (c) => {
      const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, '#dceabbaa'); g.addColorStop(0.25, '#91b55c66'); g.addColorStop(1, '#658b4400');
      c.fillStyle = g; c.fillRect(0, 0, 96, 96);
    }),
    seed: draw(64, 40, (c) => {
      const g = c.createLinearGradient(10, 8, 27, 35);
      g.addColorStop(0, '#c6ad6c'); g.addColorStop(0.4, '#7e663c'); g.addColorStop(1, '#33271f');
      c.fillStyle = g; c.beginPath(); c.moveTo(48, 21); c.bezierCurveTo(5, -13, -4, 47, 48, 21); c.fill();
      c.strokeStyle = '#bca275'; c.beginPath(); c.moveTo(12, 15); c.quadraticCurveTo(23, 22, 44, 21); c.stroke();
      c.strokeStyle = '#6e8540'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(40, 21); c.quadraticCurveTo(48, 18, 49, 9); c.stroke();
      c.fillStyle = '#9db966'; c.beginPath(); c.ellipse(53, 10, 7, 3, -0.6, 0, Math.PI * 2); c.fill();
    }),
    stem: draw(96, 20, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 20);
      g.addColorStop(0, '#b3ba83'); g.addColorStop(0.25, '#9a9e68'); g.addColorStop(0.6, '#62643e'); g.addColorStop(1, '#302e23');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 1); c.lineTo(96, 3); c.lineTo(96, 17); c.lineTo(0, 19); c.fill();
      c.strokeStyle = '#343a2866'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0, 4 + i * 3); c.bezierCurveTo(30, i * 3, 60, 8 + i * 2, 96, 4 + i * 3); c.stroke(); }
    }),
    thorn: draw(24, 24, (c) => {
      c.fillStyle = '#b2ab79'; c.beginPath(); c.moveTo(2, 22); c.quadraticCurveTo(15, 11, 20, 1); c.lineTo(21, 23); c.fill();
    }),
    grass: draw(96, 96, (c) => {
      for (let i = 0; i < 11; i++) {
        const x = 12 + i * 7, tip = 10 + (i * 23 % 48);
        c.fillStyle = ['#435934', '#7b9650', '#a0ad60'][i % 3]; c.beginPath(); c.moveTo(46, 95);
        c.quadraticCurveTo(x, 50, x - 8, tip); c.quadraticCurveTo(x + 12, 58, 53, 95); c.fill();
      }
    }),
    center: draw(32, 32, (c) => {
      c.fillStyle = '#947136'; c.beginPath(); c.arc(16, 16, 13, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 36; i++) {
        const a = i * 2.4, r = Math.sqrt(i / 36) * 11;
        c.fillStyle = i % 3 ? '#e2bd61' : '#fff0a2'; c.beginPath(); c.arc(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, 1.7, 0, Math.PI * 2); c.fill();
      }
    }),
    spore: draw(16, 16, (c) => {
      const g = c.createRadialGradient(6, 5, 0, 8, 8, 7);
      g.addColorStop(0, '#eee3a4'); g.addColorStop(0.35, '#c1b368'); g.addColorStop(0.7, '#716449'); g.addColorStop(1, '#71644900');
      c.fillStyle = g; c.fillRect(0, 0, 16, 16);
    }),
    soil: draw(128, 80, (c) => {
      c.strokeStyle = '#342a22'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4; c.beginPath(); c.moveTo(64, 40); c.lineTo(64 + Math.cos(a) * 27, 40 + Math.sin(a) * 16);
        c.lineTo(64 + Math.cos(a + 0.2) * 59, 40 + Math.sin(a + 0.2) * 34); c.stroke();
      }
    }),
    moss: draw(256, 256, (c) => {
      for (let i = 0; i < 160; i++) {
        const a = i * 2.4, r = 98 + Math.sin(i * 4.1) * 13;
        c.fillStyle = ['#61704499', '#8c874988', '#58485677'][i % 3];
        c.beginPath(); c.ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3 + i % 5, 2 + i % 4, a, 0, Math.PI * 2); c.fill();
      }
    }),
    shaft: draw(64, 192, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, '#d4dd9b00'); g.addColorStop(0.5, '#e4e8b0'); g.addColorStop(1, '#d4dd9b00');
      c.fillStyle = g; c.beginPath(); c.moveTo(9, 192); c.lineTo(0, 0); c.lineTo(64, 0); c.lineTo(49, 192); c.fill();
      c.globalCompositeOperation = 'destination-in';
      const fade = c.createLinearGradient(0, 0, 0, 192); fade.addColorStop(0, '#fff0'); fade.addColorStop(0.6, '#fff9'); fade.addColorStop(1, '#fff0');
      c.fillStyle = fade; c.fillRect(0, 0, 64, 192);
    }),
  };
}
