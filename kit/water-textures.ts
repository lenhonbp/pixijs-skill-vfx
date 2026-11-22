import type { Texture } from 'pixi.js';
import { mulberry32 } from './ease';
import { textureFromCanvas } from './pixi-compat';

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  draw(el.getContext('2d')!);
  return textureFromCanvas(el);
}

function crystal(seed: number): Texture {
  const rng = mulberry32(seed);
  return canvas(112, 192, c => {
    const tip = 39 + rng() * 30, shoulder = 36 + rng() * 26;
    const points = [[tip, 5], [86, shoulder], [99, 151], [69, 187], [21, 174], [13, 65]];
    const facet = (ps: number[][], color: string) => {
      c.beginPath(); ps.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
      c.fillStyle = color; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.46)'; c.lineWidth = .8; c.stroke();
    };
    facet(points, 'rgba(160,190,205,.23)');
    facet([points[0], points[1], [61,130], [45,155]], 'rgba(245,255,255,.69)');
    facet([points[0], [45,155], points[4], points[5]], 'rgba(185,220,239,.36)');
    facet([points[1], points[2], points[3], [61,130]], 'rgba(92,138,168,.48)');
    facet([[45,155], [61,130], points[3], points[4]], 'rgba(220,249,255,.58)');
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(tip,9); c.lineTo(43,148); c.lineTo(23,170); c.stroke();
    c.lineWidth = .65;
    for(let i=0;i<16;i++) {
      const x=25+rng()*53, y=65+rng()*94;
      c.beginPath(); c.moveTo(x,y); c.lineTo(x+4+rng()*10,y-8-rng()*17); c.stroke();
    }
  });
}

function frost(): Texture {
  const rng = mulberry32(73);
  return canvas(256,256,c => {
    const g=c.createRadialGradient(128,128,5,128,128,125);
    g.addColorStop(0,'rgba(225,245,255,.23)'); g.addColorStop(.7,'rgba(220,245,255,.13)'); g.addColorStop(1,'rgba(220,245,255,0)');
    c.fillStyle=g; c.fillRect(0,0,256,256);
    for(let i=0;i<19;i++) {
      const a=i*Math.PI*2/19+rng()*.2;
      let x=128, y=128;
      c.beginPath(); c.moveTo(x,y);
      for(let j=0;j<5;j++) {
        const nx=128+Math.cos(a)*j*24+(rng()-.5)*17, ny=128+Math.sin(a)*j*24+(rng()-.5)*17;
        c.lineTo(nx,ny);
        if(j>1) { c.moveTo(nx,ny); c.lineTo(nx+Math.cos(a+.8)*17,ny+Math.sin(a+.8)*17); c.moveTo(nx,ny); }
        x=nx; y=ny;
      }
      c.strokeStyle='rgba(240,252,255,.55)'; c.lineWidth=.6+rng(); c.stroke();
    }
    for(let i=0;i<900;i++) {
      const a=rng()*Math.PI*2, r=Math.sqrt(rng())*119;
      c.fillStyle=`rgba(255,255,255,${rng()*.4})`; c.fillRect(128+Math.cos(a)*r,128+Math.sin(a)*r,.7,1.5);
    }
  });
}

function dragon(): Texture {
  return canvas(192,128,c => {
    const g=c.createLinearGradient(0,90,0,20);
    g.addColorStop(0,'rgba(90,130,155,.2)'); g.addColorStop(.55,'rgba(190,230,245,.7)'); g.addColorStop(1,'rgba(255,255,255,.92)');
    c.fillStyle=g; c.strokeStyle='rgba(250,255,255,.85)'; c.lineWidth=2;
    c.beginPath(); c.moveTo(9,96); c.bezierCurveTo(34,71,55,66,69,46);
    c.lineTo(48,10); c.lineTo(92,38); c.lineTo(110,20); c.lineTo(116,49);
    c.bezierCurveTo(142,43,144,68,179,68); c.lineTo(187,81); c.lineTo(147,90);
    c.lineTo(171,97); c.bezierCurveTo(130,116,105,80,82,96); c.lineTo(9,114); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(128,68); c.lineTo(140,71); c.stroke();
    c.beginPath(); c.moveTo(145,87); c.bezierCurveTo(153,114,183,112,186,97); c.stroke();
    c.lineWidth=.8;
    for(let i=0;i<7;i++) { c.beginPath(); c.ellipse(50+i*11,85-i*3,14,7,-.4,0,Math.PI); c.stroke(); }
  });
}

function water(): Texture {
  return canvas(192,64,c => {
    const g=c.createLinearGradient(0,0,0,64);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.18,'rgba(250,255,255,.8)');
    g.addColorStop(.35,'rgba(148,190,210,.55)'); g.addColorStop(.65,'rgba(80,120,150,.6)');
    g.addColorStop(.85,'rgba(230,250,255,.65)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.beginPath(); c.moveTo(0,32); c.bezierCurveTo(50,-9,125,6,192,32); c.bezierCurveTo(140,69,50,65,0,32); c.fillStyle=g; c.fill();
    c.lineWidth=.9;
    for(let i=0;i<13;i++) {
      c.strokeStyle=`rgba(255,255,255,${.15+i%3*.12})`;
      c.beginPath(); c.moveTo(12+i*4,30); c.bezierCurveTo(65,5+i*3,110,58-i*2,180-i*3,31); c.stroke();
    }
  });
}

let cache: { crystals: Texture[]; frost: Texture; dragon: Texture; water: Texture } | undefined;
export function waterTextures() {
  return cache ??= { crystals: [crystal(5),crystal(19),crystal(31)], frost: frost(), dragon: dragon(), water: water() };
}
