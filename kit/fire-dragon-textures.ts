import type { Texture } from 'pixi.js';
import { textureFromCanvas } from './pixi-compat';

type Ink = string | CanvasGradient;

function draw(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  paint(c.getContext('2d')!);
  return textureFromCanvas(c);
}

function fill(ctx: CanvasRenderingContext2D, path: string, ink: Ink, outline?: string) {
  const p = new Path2D(path);
  ctx.fillStyle = ink;
  ctx.fill(p);
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  }
}

function heat(ctx: CanvasRenderingContext2D, y1: number, y2: number, stops: readonly string[]) {
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  return g;
}

function headTexture() {
  return draw(192, 134, (ctx) => {
    const fire = heat(ctx, 20, 128, ['#fff2aa', '#ffb831', '#f84a12', '#8b1e10']);
    const scales = heat(ctx, 46, 111, ['#ffb349', '#c7471c', '#792315', '#3a1114']);
    const crown = heat(ctx, 12, 79, ['#fff5bf', '#ffd35f', '#fc7b15', '#a22512']);
    const jaw = heat(ctx, 84, 116, ['#ffbc55', '#e25720', '#73201a']);

    fill(ctx, 'M99 40 Q55 40 31 21 Q32 43 50 47 Q27 49 8 39 Q23 62 50 66 Q28 72 6 66 Q29 92 58 86 Q45 103 16 108 Q48 114 77 103 Q68 119 56 126 Q84 127 111 101 Q128 79 99 40Z', fire, '#a02c17');
    fill(ctx, 'M95 61 Q78 49 69 36 Q67 21 49 12 Q72 17 83 34 L91 40 Q89 24 84 19 Q102 24 109 46 L113 55Z', crown, '#81311a');
    fill(ctx, 'M120 55 Q114 42 111 31 Q110 19 100 10 Q119 12 126 28 L131 36 Q136 25 134 17 Q150 31 139 54Z', crown, '#81311a');
    fill(ctx, 'M69 76 Q66 59 86 45 Q96 41 109 51 L121 49 L134 58 Q149 64 158 62 L174 64 L184 72 L179 83 L159 89 L132 85 L123 96 L102 102 L76 97 L61 87Z', scales, '#612218');
    fill(ctx, 'M106 88 L130 78 Q143 80 154 82 L175 78 L169 88 Q151 97 133 99 L117 102 L99 98Z', '#361016');
    fill(ctx, 'M104 93 Q124 99 144 94 L166 91 L174 87 L169 99 L151 107 L124 108 L111 114 L93 111 L78 101Z', jaw, '#69261a');
    fill(ctx, 'M138 83 L148 85 L140 94Z M161 85 L169 82 L163 91Z M152 95 L150 101 L144 101Z M127 98 L125 103 L119 103Z', '#fff0bc');
    fill(ctx, 'M92 59 Q106 48 122 56 L137 68 L121 65 L111 75 L99 75 L101 66Z', crown, '#75321a');
    fill(ctx, 'M104 69 L120 65 L115 74 Q108 78 104 69Z', '#581019');
    fill(ctx, 'M106 69 L117 67 L112 73 L107 73Z', '#fffbd6');
    fill(ctx, 'M114 68 L113 72 L111 72 L111 69Z', '#c23f14');
    fill(ctx, 'M84 75 Q91 65 101 66 L96 82 L112 79 L102 89 L83 92 L65 87Z', fire, '#9e2b17');
    fill(ctx, 'M144 67 Q155 70 168 67 L178 73 L168 77 L158 75 L146 75 L136 69Z', '#ef8b35');
    fill(ctx, 'M167 70 Q173 68 176 72 Q174 76 169 74Z', '#5b1b17');
    fill(ctx, 'M149 76 Q115 76 96 93 Q70 116 36 110 Q65 123 95 103 Q116 83 154 81Z', '#ffbc51', '#ad421b');
    fill(ctx, 'M144 78 Q132 98 110 109 Q91 119 77 116 Q95 126 119 114 Q146 102 153 81Z', '#ffe19b');
  });
}

function coilTexture() {
  return draw(76, 58, (ctx) => {
    const plume = heat(ctx, 0, 52, ['#ffeaa1', '#ffad31', '#e74b14', '#6a1518']);
    const belly = heat(ctx, 23, 49, ['#ffd871', '#ed6e23', '#74221a']);
    fill(ctx, 'M3 30 Q16 25 15 17 Q22 23 29 22 Q25 12 12 6 Q33 5 43 21 Q48 17 43 9 Q56 11 59 24 Q70 29 74 37 Q70 45 58 47 Q43 42 30 47 Q16 48 4 42Z', plume, '#9f2717');
    fill(ctx, 'M4 38 Q14 31 32 31 Q52 24 72 35 L74 40 Q65 49 51 47 Q34 43 24 47 Q11 49 4 42Z', belly, '#8c2618');
    fill(ctx, 'M17 39 Q30 33 43 33 Q48 35 49 41 Q34 39 19 43Z M48 32 Q59 32 65 36 L65 41 L54 39Z', '#ffb84e');
  });
}

let textures: { head: Texture; coil: Texture } | undefined;

export function fireDragonTextures() {
  return textures ??= { head: headTexture(), coil: coilTexture() };
}
