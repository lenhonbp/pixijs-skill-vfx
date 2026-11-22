import { clamp01, envelope, lerp, outCubic, pick, rand } from './ease';
import { group } from './group';
import type { Palette } from './recipes';
import type { VfxTextures } from './textures';
import { flowRibbon } from './trail';
import type { Particle, Vec3, VfxWorld } from './vfx-world';
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
  const g=group(w,dur,()=> { chunks(w,o.target(),p,27); mist(w,tex,o.target(),p,12,42); o.onShatter?.(); },35);
  for(let i=0;i<12;i++) {
    const a=i/12*TAU;
    g.addHandle(w.after(i*14,()=> iceSpire(w,{x:at.x+Math.cos(a)*radius,y:at.y+Math.sin(a)*radius*w.groundSquash},rand(37,72),p,rand(850,1400),Math.cos(a)*.38)));
  }
  mist(w,tex,at,p,15,radius);
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

/** A rolling pressure column with aerated foam and a continuously breaking impact crown. */
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
    out.x=lerp(a.x,b.x,t); out.y=lerp(a.y,b.y,t)+Math.cos(t*9-age*.01+phase)*radius*w.groundSquash*Math.sin(Math.PI*t);
    out.z=lerp(a.z??40,b.z??40,t)+wave;
  };
  const angle=()=> {
    const a=o.from(),b=o.to();
    return Math.atan2(b.y-(b.z??40)-a.y+(a.z??40),b.x-a.x);
  };
  for(let i=0;i<18;i++) {
    const u=(i+.5)/18, at={x:0,y:0,z:0};
    const endWidth=()=> {
      const a=o.from(),b=o.to();
      return Math.hypot(b.x-a.x,b.y-(b.z??40)-a.y+(a.z??40))*Math.min(u,1-u);
    };
    const place=(q: Particle)=> {
        point(u,0,14,at);
        q.px=at.x; q.py=at.y; q.pz=at.z??0;
        q.rotation=angle()+Math.cos(u*9-age*.01)*.15;
    };
    g.add(w.spawn({texture:waterTextures().water,x:0,y:0,life:dur,blend:'normal',tint:p.main,zBias:12,
      scaleX:()=>Math.min(.78,endWidth()/96),scaleY:()=>.67+Math.sin(u*10-age*.013)*.05,
      alpha:()=>env()*.85,onUpdate:place}));
    g.add(w.spawn({texture:tex.glow,x:0,y:0,life:dur,blend:'add',tint:p.main,zBias:11,
      scaleX:()=>Math.min(1.05,endWidth()/64),scaleY:.58,alpha:()=>env()*.13,onUpdate:place}));
    g.add(w.spawn({texture:waterTextures().water,x:0,y:0,life:dur,blend:'add',tint:p.core,zBias:13,
      scaleX:()=>Math.min(.67,endWidth()/96),scaleY:.10,alpha:()=>env()*.63,
      onUpdate:q=> {place(q);q.pz+=13;} }));
  }
  for(let i=0;i<2;i++) g.addHandle(flowRibbon(w,{
    life:dur,width:10,tint:p.core,blend:'add',alpha:()=>env()*.46,
    point:(u,_,out)=> {
      point(u,0,14,out);
      const a=u*TAU*2.6-age*.009+i*Math.PI, taper=Math.sin(Math.PI*u);
      out.y+=Math.cos(a)*17*w.groundSquash*taper;
      out.z=(out.z??0)+Math.sin(a)*21*taper;
    },
  }));
  g.add(w.spawn({texture:tex.glow,x:0,y:0,follow:o.from,life:dur,zBias:18,
    scale:.46,tint:p.main,alpha:()=>env()*.68}));
  g.add(w.spawn({texture:waterTextures().foam,x:0,y:0,follow:o.from,life:dur,zBias:19,
    blend:'add',tint:p.core,scaleX:.24,scaleY:.24,spin:5,alpha:()=>env()*.9}));
  g.addHandle(w.stream({rate:28,duration:dur,make:()=> {
    const phase=rand(-.4,.4), at={x:0,y:0,z:0};
    return {texture:waterTextures().foam,x:0,y:0,life:440,blend:'add',tint:p.core,zBias:14,
      scaleX:rand(.35,.65),scaleY:rand(.07,.13),alpha:envelope(.12,.7,.8),
      onUpdate:(q,t)=> {
        point(t,phase,24,at); q.px=at.x; q.py=at.y; q.pz=(at.z??0)+8;
        q.rotation=angle()+Math.cos(t*9-age*.01)*.18; q.alphaMul=env();
      }};
  }}));
  const head={x:0,y:0,z:0};
  g.add(w.spawn({ texture:waterTextures().foam,x:0,y:0,life:dur,blend:'normal',tint:p.core,zBias:14,
    scaleX:()=>.49+Math.sin(age*.027)*.05,scaleY:()=>.42+Math.cos(age*.022)*.04,alpha:()=>env()*.9,
    onUpdate:q=> {
      point(1,0,0,head); q.px=head.x; q.py=head.y; q.pz=head.z;
      q.rotation=angle()+age*.001;
    } }));
  g.addHandle(w.stream({rate:46,duration:dur,make:()=> {
    const at=o.to(), a=rand(0,TAU), v=rand(65,205);
    return {texture:tex.drop,...at,life:rand(420,780),blend:'normal',tint:p.core,zBias:14,scale:rand(.15,.33),killOnGround:true,
      vx:Math.cos(a)*v,vy:Math.sin(a)*v*w.groundSquash,vz:rand(45,170),gravity:460,
      faceVelocity:true,alpha:envelope(.03,.5,.85)};
  }}));
  g.addHandle(w.stream({rate:9,duration:dur,make:()=> {
    const at=o.to();
    return {texture:waterTextures().crown,...at,life:400,blend:'normal',tint:p.core,zBias:15,anchorY:.72,
      scaleX:[.2,.95,outCubic],scaleY:[.25,.85,outCubic],alpha:envelope(.08,.35,.86),
      vz:-25,gravity:120};
  }}));
  g.addHandle(w.stream({rate:12,duration:dur,make:()=> {
    const at=o.to();
    return {texture:tex.puff,...at,life:rand(240,440),blend:'normal',tint:p.core,
      scale:[.12,.43],alpha:envelope(.04,.35,.26),vx:rand(-45,85),vy:rand(-25,25)*w.groundSquash,
      vz:rand(-15,35),gravity:100};
  }}));
  g.addHandle(w.stream({rate:25,duration:dur,make:()=> {
    const at={x:0,y:0,z:0}; point(rand(.1,1),rand(0,TAU),16,at);
    return {texture:tex.drop,...at,life:rand(180,360),blend:'normal',tint:p.core,scale:rand(.1,.21),
      vx:(o.to().x-o.from().x)*.7,vy:rand(-25,25)*w.groundSquash,vz:rand(-25,65),gravity:240,faceVelocity:true,alpha:envelope(.05,.4,.8)};
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
