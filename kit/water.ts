import { clamp01, envelope, lerp, outCubic, pick, rand } from './ease';
import { group } from './group';
import type { Palette } from './recipes';
import type { VfxTextures } from './textures';
import { flowRibbon } from './trail';
import type { Vec3, VfxWorld } from './vfx-world';
import { waterTextures } from './water-textures';

const TAU = Math.PI * 2;

function frostGround(w: VfxWorld, at: Vec3, radius: number, p: Palette, life: number) {
  w.spawn({ texture: waterTextures().frost, x: at.x, y: at.y, layer: 'ground', groundAligned: true,
    life, blend: 'normal', tint: p.main, scale: [radius / 230, radius / 110, outCubic], alpha: envelope(.12,.7,.85) });
}

function mist(w: VfxWorld, tex: VfxTextures, at: Vec3, p: Palette, count: number, radius: number) {
  w.burst(count, () => {
    const a=rand(0,TAU), r=rand(0,radius), speed=rand(12,35);
    return { texture: tex.puff, x: at.x+Math.cos(a)*r, y: at.y+Math.sin(a)*r*w.groundSquash, z: rand(2,12),
      vx: Math.cos(a)*speed, vy: Math.sin(a)*speed*w.groundSquash, vz: rand(5,16), drag: 1.4,
      life: rand(650,1150), blend: 'normal', tint: p.core, scaleX: [.18,.6], scaleY: [.09,.22], alpha: envelope(.12,.5,.2) };
  });
}

function chunks(w: VfxWorld, at: Vec3, p: Palette, count: number) {
  w.burst(count, () => {
    const a=rand(0,TAU), v=rand(35,145);
    return { texture: pick(waterTextures().crystals), ...at, z: (at.z??0)+rand(8,38), life: rand(480,850),
      vx: Math.cos(a)*v, vy: Math.sin(a)*v*w.groundSquash, vz: rand(65,150), gravity: 440,
      bounce: .24, blend: 'normal', tint: p.core, scaleX: rand(.07,.16), scaleY: rand(.04,.12),
      rotation: a, spin: rand(-7,7), alpha: envelope(.02,.65,.85) };
  });
}

function iceSpire(w: VfxWorld, at: Vec3, height: number, p: Palette, life: number, lean: number) {
  w.spawn({ texture: pick(waterTextures().crystals), ...at, anchorY: .96, life,
    blend: 'normal', tint: p.core, rotation: lean, scaleX: height / 240,
    scaleY: t => height / 182 * outCubic(clamp01(t*life/170)), alpha: envelope(.035,.78,.92) });
}

/** Faceted translucent shell, ground-borne crystal ring, then ballistic shards. */
export function frostNova(w: VfxWorld, tex: VfxTextures, o: {
  target: () => Vec3; height: number; palette: Palette; duration?: number; radius?: number; onShatter?: () => void;
}) {
  const at={...o.target()}, p=o.palette, dur=Math.max(300,o.duration??2200), radius=o.radius??75;
  frostGround(w,at,radius*1.5,p,dur+850);
  for(let i=0;i<12;i++) {
    const a=i/12*TAU;
    w.after(i*14,()=> iceSpire(w,{x:at.x+Math.cos(a)*radius,y:at.y+Math.sin(a)*radius*w.groundSquash},rand(37,72),p,rand(850,1400),Math.cos(a)*.38));
  }
  mist(w,tex,at,p,15,radius);
  const g=group(w,dur,()=> { chunks(w,o.target(),p,27); mist(w,tex,o.target(),p,12,42); o.onShatter?.(); },35);
  for(let i=0;i<5;i++) {
    const a=i/5*TAU;
    g.add(w.spawn({texture: waterTextures().crystals[i%3], x:Math.cos(a)*o.height*.23,y:Math.sin(a)*o.height*.13,
      follow:o.target, anchorY:.96, life:dur, blend:'normal', tint:p.core, zBias:Math.sin(a)*3,
      scaleX:rand(.4,.5), scaleY:t=>o.height/143*outCubic(clamp01(t*dur/290)), rotation:Math.cos(a)*.14,
      alpha:envelope(.12,.96,.78) }));
  }
  return g;
}

/** A fractured glacier ridge propagates on the ground, not along a screen-space line. */
export function glacierPath(w: VfxWorld, tex: VfxTextures, o: {
  from: Vec3; angle: number; palette: Palette; count?: number; spacing?: number; height?: number; onSpike?: (at: Vec3) => void;
}) {
  const count=Math.max(0,Math.min(14,Math.floor(o.count??9))), spacing=o.spacing??44, p=o.palette;
  const from={...o.from};
  const g=group(w,count*85+1900);
  for(let i=0;i<count;i++) g.addHandle(w.after(i*85,()=> {
    const at={x:from.x+Math.cos(o.angle)*(i+1)*spacing,y:from.y+Math.sin(o.angle)*(i+1)*spacing*w.groundSquash};
    frostGround(w,at,49,p,1900);
    for(let j=0;j<3;j++) iceSpire(w,{x:at.x+rand(-16,16),y:at.y+rand(-11,11)},(o.height??80)*rand(.52,1.35),p,rand(1100,1700),rand(-.3,.3));
    chunks(w,at,p,4); mist(w,tex,at,p,3,22); o.onSpike?.(at);
  }));
  return g;
}

/** Braided pressure jet with a sculpted dragon crest and a continuously breaking impact. */
export function tidalBeam(w: VfxWorld, tex: VfxTextures, o: {
  from: () => Vec3; to: () => Vec3; palette: Palette; duration?: number;
}) {
  const dur=Math.max(1,o.duration??1500), p=o.palette;
  const g=group(w,dur,undefined,80);
  let age=0;
  g.addHandle(w.addUpdater(dt=> { age+=dt; }));
  const env=()=>clamp01(age/160)*clamp01((dur-age)/220);
  const point=(u: number, phase: number, radius: number, out: Vec3) => {
    const a=o.from(), b=o.to(), t=u*Math.min(1,age/200);
    const wave=Math.sin(t*9-age*.01+phase)*radius*Math.sin(Math.PI*t);
    out.x=lerp(a.x,b.x,t); out.y=lerp(a.y,b.y,t)+Math.cos(t*9-age*.01+phase)*radius*w.groundSquash;
    out.z=lerp(a.z??40,b.z??40,t)+wave;
  };
  for(let i=0;i<6;i++) g.addHandle(flowRibbon(w,{ life:dur,width:i<2?34:rand(3,7),
    tint:i===0?p.dark:i<4?p.main:p.core, blend:'normal',alpha:()=>env()*(i<2?.64:.72),
    point:(u,_,out)=>point(u,i*.6,i<2?19:24,out) }));
  g.addHandle(w.stream({rate:36,duration:dur,make:()=> {
    const phase=rand(-.3,.3), life=430, at={x:0,y:0,z:0};
    return {texture:waterTextures().water,x:0,y:0,life,blend:'normal',tint:p.main,
      scaleX:rand(.48,.69),scaleY:rand(.29,.43),alpha:()=>env()*.65,
      onUpdate:(q,t)=> {
        point(t,phase,21,at);
        q.px=at.x; q.py=at.y; q.pz=at.z??0;
        const a=o.from(),b=o.to(); q.rotation=Math.atan2(b.y-(b.z??40)-a.y+(a.z??40),b.x-a.x)+Math.cos(t*9-age*.01)*.12;
      }};
  }}));
  const head={x:0,y:0,z:0};
  g.add(w.spawn({ texture:waterTextures().dragon,x:0,y:0,life:dur,blend:'normal',tint:p.core,
    anchorX:.85,scaleX:.73,scaleY:()=>o.to().x<o.from().x?-.73:.73,alpha:()=>env()*.9,
    onUpdate:q=> {
      point(1,0,0,head); q.px=head.x; q.py=head.y; q.pz=head.z;
      const a=o.from(),b=o.to(); q.rotation=Math.atan2(b.y-(b.z??40)-a.y+(a.z??40),b.x-a.x);
    } }));
  g.addHandle(w.stream({rate:48,duration:dur,make:()=> {
    const at=o.to(), a=rand(0,TAU), v=rand(35,150);
    return {texture:tex.drop,...at,life:rand(260,620),blend:'normal',tint:p.core,scale:rand(.12,.29),
      vx:Math.cos(a)*v,vy:Math.sin(a)*v*w.groundSquash,vz:rand(25,130),gravity:380,
      faceVelocity:true,alpha:envelope(.03,.5,.85)};
  }}));
  g.addHandle(w.stream({rate:18,duration:dur,make:()=> {
    const at=o.to();
    return {texture:tex.puff,...at,life:rand(240,440),blend:'normal',tint:p.core,
      scale:[.06,.27],alpha:envelope(.04,.35,.36),vx:rand(-45,85),vy:rand(-25,25)*w.groundSquash,
      vz:rand(-15,35),gravity:100};
  }}));
  g.addHandle(w.stream({rate:25,duration:dur,make:()=> {
    const at={x:0,y:0,z:0}; point(rand(.1,1),rand(0,TAU),16,at);
    return {texture:tex.streak,...at,life:rand(130,270),blend:'normal',tint:p.core,scaleX:rand(.08,.17),scaleY:.045,
      vx:(o.to().x-o.from().x)*1.1,vz:rand(-20,30),alpha:envelope(.05,.4,.8)};
  }}));
  const at=o.to();
  w.spawn({texture:tex.disc,x:at.x,y:at.y,layer:'ground',groundAligned:true,life:dur+900,
    blend:'normal',tint:p.dark,scale:[.12,.48,outCubic],alpha:envelope(.1,.65,.32)});
  g.addHandle(w.stream({rate:5,duration:dur,make:()=> {
    const at=o.to();
    return {texture:tex.ring,x:at.x+rand(-14,14),y:at.y+rand(-7,7),layer:'ground',groundAligned:true,
      life:600,blend:'normal',tint:p.core,scale:[.02,.42],alpha:envelope(.05,.25,.4)};
  }}));
  return g;
}
