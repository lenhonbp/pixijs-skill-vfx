import type { Texture } from 'pixi.js';
import { mulberry32 } from './ease';
import { noise3 } from './noise';
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

function water(): Texture {
  return canvas(192,96,c => {
    const pixels=c.createImageData(192,96);
    for(let y=0;y<96;y++) for(let x=0;x<192;x++) {
      const u=x/192, v=y/96;
      const bend=Math.sin(u*7)*.05;
      const d=(v-.5-bend)/.4;
      const turbulence=noise3(u*8,v*5,7)*.15+noise3(u*24,v*12,9)*.035;
      const edge=Math.max(0,Math.min(1,(1-Math.abs(d)+turbulence)*6))*Math.pow(Math.sin(u*Math.PI),1.5);
      const round=Math.sqrt(Math.max(0,1-d*d));
      const caustic=Math.pow(Math.max(0,Math.sin(u*22+v*15+noise3(u*5,v*7,1)*4)),8);
      const light=45+round*125+caustic*65+Math.exp(-Math.pow((d+.48)*9,2))*70;
      const i=(y*192+x)*4;
      pixels.data.set([light,light,light,edge*215],i);
    }
    c.putImageData(pixels,0,0);
  });
}

function foam(crown = false): Texture {
  const rng=mulberry32(crown?93:67);
  return canvas(160,128,c => {
    if(crown) for(let i=0;i<13;i++) {
      const a=i/13*Math.PI*2, x=80+Math.cos(a)*randRadius(), y=73+Math.sin(a)*13;
      const top=10+rng()*29, tip=x+Math.cos(a)*(10+rng()*20);
      const g=c.createLinearGradient(0,top,0,98);
      g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.28,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(190,245,255,.15)');
      c.strokeStyle=g; c.lineWidth=2+rng()*3; c.lineCap='round';
      c.beginPath(); c.moveTo(80+Math.cos(a)*12,95); c.quadraticCurveTo(x,y,tip,top); c.stroke();
    }
    for(let i=0;i<(crown?340:440);i++) {
      const a=rng()*Math.PI*2, r=Math.sqrt(rng());
      const x=crown?80+Math.cos(a)*(25+r*45):80+Math.cos(a)*r*68;
      const y=crown?94+Math.sin(a)*12-r*r*(16+40*Math.abs(Math.cos(a*4))):64+Math.sin(a)*r*43;
      const size=(crown?1.2:1.5)+rng()*4;
      const g=c.createRadialGradient(x,y,0,x,y,size);
      g.addColorStop(0,`rgba(255,255,255,${.25+rng()*.6})`); g.addColorStop(.55,'rgba(240,255,255,.35)'); g.addColorStop(1,'rgba(220,250,255,0)');
      c.fillStyle=g; c.fillRect(x-size,y-size,size*2,size*2);
    }
  });
  function randRadius() { return 23+rng()*24; }
}

let cache: { crystals: Texture[]; frost: Texture; water: Texture; foam: Texture; crown: Texture } | undefined;
export function waterTextures() {
  return cache ??= { crystals: [crystal(5),crystal(19),crystal(31)], frost: frost(), water: water(), foam: foam(), crown: foam(true) };
}
