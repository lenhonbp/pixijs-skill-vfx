// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { ActorPose, CueEvent } from '../../runtime/src/index';

function painted(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, density = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width * density; canvas.height = height * density;
  const ctx = canvas.getContext('2d')!; ctx.scale(density, density); draw(ctx);
  const sprite = new Sprite(Texture.from(canvas)); sprite.width = width; sprite.height = height;
  return sprite;
}

/** The room and the round arena the units stand on, painted in the same ground projection as the actors and the compass. */
function atmosphere(ground: Ground) {
  const { centre, range, squash } = ground, radius = range / 2 + 62;
  return painted(1000, 580, ctx => {
    const ellipse = (r: number, dy = 0) => ctx.ellipse(centre.x, centre.y + dy, r, r * squash, 0, 0, Math.PI * 2);
    const sky = ctx.createLinearGradient(0, 0, 0, 580);
    sky.addColorStop(0, '#070c15'); sky.addColorStop(0.45, '#18212c'); sky.addColorStop(1, '#0a0f17');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 580);
    // Distant ridges, kept low in contrast: they only give the room some depth.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['#141d28', '#101923', '#0d151e'][layer];
      ctx.beginPath(); ctx.moveTo(0, 320);
      for (let x = 0; x <= 1050; x += 35) ctx.lineTo(x, 205 + layer * 22 + Math.sin(x * 0.013 + layer) * 24 + Math.sin(x * 0.037) * 10);
      ctx.lineTo(1000, 340); ctx.lineTo(0, 340); ctx.fill();
    }
    const haze = ctx.createLinearGradient(0, 235, 0, 345);
    haze.addColorStop(0, '#9fb0b800'); haze.addColorStop(0.6, '#9fb0b81f'); haze.addColorStop(1, '#9fb0b800');
    ctx.fillStyle = haze; ctx.fillRect(0, 235, 1000, 110);
    const floor = ctx.createLinearGradient(0, 292, 0, 580);
    floor.addColorStop(0, '#1b222a'); floor.addColorStop(1, '#0b1017');
    ctx.fillStyle = floor; ctx.fillRect(0, 292, 1000, 288);
    // A pool of light on the floor, then the contact shadow of the arena.
    ctx.save(); ctx.translate(centre.x, centre.y); ctx.scale(1, squash);
    const pool = ctx.createRadialGradient(0, 0, 30, 0, 0, 430);
    pool.addColorStop(0, '#e0cf9f2a'); pool.addColorStop(0.55, '#b9bdad0e'); pool.addColorStop(1, '#c1b68a00');
    ctx.fillStyle = pool; ctx.fillRect(-500, -500, 1000, 1000);
    const contact = ctx.createRadialGradient(0, 24 / squash, radius * 0.9, 0, 24 / squash, radius * 1.18);
    contact.addColorStop(0, '#000000b8'); contact.addColorStop(1, '#00000000');
    ctx.fillStyle = contact; ctx.fillRect(-500, -500, 1000, 1000);
    ctx.restore();
    // The arena: a slab with a visible edge.
    const thickness = 13;
    ctx.beginPath(); ellipse(radius, thickness); ctx.rect(centre.x - radius, centre.y, radius * 2, thickness);
    const side = ctx.createLinearGradient(0, centre.y, 0, centre.y + radius * squash + thickness);
    side.addColorStop(0, '#2a323a'); side.addColorStop(1, '#0c1116');
    ctx.fillStyle = side; ctx.fill();
    ctx.save(); ctx.translate(centre.x, centre.y); ctx.scale(1, squash);
    const top = ctx.createRadialGradient(0, -radius * 0.12, 10, 0, 0, radius);
    top.addColorStop(0, '#323a43'); top.addColorStop(0.7, '#262d35'); top.addColorStop(1, '#1b2128');
    ctx.fillStyle = top; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.clip();
    let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { // fine stone grain, deterministic
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * radius;
      ctx.fillStyle = random() > 0.5 ? '#ffffff08' : '#00000012'; ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6);
    }
    const sheen = ctx.createLinearGradient(-radius, -radius, radius * 0.6, radius * 0.6);
    sheen.addColorStop(0, '#ffffff12'); sheen.addColorStop(0.5, '#ffffff00');
    ctx.fillStyle = sheen; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
    // Eight spokes and rim marks, one per cast direction, plus two faint inner rings.
    ctx.save(); ctx.translate(centre.x, centre.y); ctx.scale(1, squash);
    ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = '#d6b4770f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c * 34, s * 34); ctx.lineTo(c * (radius - 16), s * (radius - 16)); ctx.stroke();
      ctx.strokeStyle = '#d6b47766'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c * (radius - 14), s * (radius - 14)); ctx.lineTo(c * (radius - 3), s * (radius - 3)); ctx.stroke();
    }
    for (const r of [range * 0.25, range / 2 + 26]) { ctx.strokeStyle = '#d6b47714'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#d6b4774d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d6b47714'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, radius - 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const vignette = ctx.createRadialGradient(500, 320, 150, 500, 320, 600);
    vignette.addColorStop(0, '#070b1200'); vignette.addColorStop(1, '#070b12e0'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1000, 580);
  });
}
/** The ground the actors stand on: both always stand on opposite stations of a ring of diameter `range`, squashed by `squash`. */
export interface Ground { centre: { x: number; y: number }; range: number; squash: number }
export function createStage(world: Container, from: { x: number; y: number }, to: { x: number; y: number }, art: { head: Texture; torso: Texture; legs: Texture; staff: Texture; dummy: Texture }, ground: Ground) {
  const backdrop = atmosphere(ground); world.addChild(backdrop);
  // Eight-way compass painted on the floor in the same projection as the actors and the baked effects.
  const compass = new Graphics(); world.addChild(compass);
  let sideFacing = 1; // pure up/down casts keep the last side the units faced (the art has no front or back view)
  function updateFacing() { const dx = to.x - from.x; if (Math.abs(dx) > 1) sideFacing = dx > 0 ? 1 : -1; }
  function drawCompass() {
    const { centre, range, squash } = ground, radius = range / 2;
    const station = (k: number) => ({ x: centre.x + Math.cos(k * Math.PI / 4) * radius, y: centre.y + Math.sin(k * Math.PI / 4) * radius * squash });
    const aimStep = Math.round(Math.atan2((to.y - from.y) / squash, to.x - from.x) * 180 / Math.PI / 45);
    const target = aimStep === -4 ? 4 : aimStep, source = target > 0 ? target - 4 : target + 4;
    compass.clear();
    compass.ellipse(centre.x, centre.y, radius, radius * squash).stroke({ color: 0xd6b477, width: 1.3, alpha: 0.34 });
    for (let k = -3; k <= 4; k++) {
      const { x, y } = station(k), on = k === target, from_ = k === source;
      compass.ellipse(x, y, on ? 18 : 13, (on ? 18 : 13) * squash).fill({ color: 0xd6b477, alpha: on ? 0.24 : 0.09 }).stroke({ color: 0xd6b477, width: on ? 1.8 : 1.1, alpha: on ? 0.95 : from_ ? 0.6 : 0.34 });
      if (on) compass.ellipse(x, y, 27, 27 * squash).stroke({ color: 0xd6b477, width: 1, alpha: 0.3 });
    }
    const a = station(source), b = station(target), length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let at = 14; at < length - 14; at += 14) { // dashed aim line from the caster to the target
      const t0 = at / length, t1 = Math.min(length - 14, at + 7) / length;
      compass.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0).lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
    }
    compass.stroke({ color: 0xd6b477, width: 1.2, alpha: 0.28 });
  }
  updateFacing();
  const glow = painted(180, 180, ctx => {
    const g = ctx.createRadialGradient(90, 90, 0, 90, 90, 90);
    g.addColorStop(0, '#ffffffff'); g.addColorStop(0.15, '#ffffff90'); g.addColorStop(0.5, '#ffffff20'); g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 180);
  });
  const shadowTexture = painted(100, 40, ctx => {
    ctx.scale(1, 0.4); const g = ctx.createRadialGradient(50, 50, 4, 50, 50, 50);
    g.addColorStop(0, '#000000a8'); g.addColorStop(1, '#00000000'); ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
  }).texture;
  const shadow = (point: { x: number; y: number }) => {
    const s = new Sprite(shadowTexture); s.anchor.set(0.5); s.position.set(point.x, point.y + 3); s.width = 90; s.height = 32; world.addChild(s); return s;
  };
  const casterShadow = shadow(from), dummyShadow = shadow(to);
  const floorFlash = new Sprite(glow.texture); floorFlash.anchor.set(0.5); floorFlash.position.set(to.x, to.y); floorFlash.width = 300; floorFlash.height = 95; floorFlash.blendMode = 'add'; floorFlash.alpha = 0; world.addChild(floorFlash);
  const caster = new Container(), body = new Container(), head = new Container(), legs = new Container(), dummy = new Container();
  caster.position.set(from.x, from.y); dummy.position.set(to.x, to.y);
  const figure = (texture: Texture, parent: Container) => {
    const s = new Sprite(texture); s.anchor.set(0.5, 1); s.width = 80; s.height = 120; parent.addChild(s); return s;
  };
  const hair = new Graphics().moveTo(-9, -89).quadraticCurveTo(-23, -64, -18, -36).quadraticCurveTo(-9, -46, -6, -81).fill(0x30394e);
  hair.pivot.set(-7, -88); hair.position.set(-7, -88); head.addChild(hair);
  const robe = new Graphics().moveTo(-10, -59).quadraticCurveTo(-20, -34, -24, -9).lineTo(-11, -11).quadraticCurveTo(-1, -36, -4, -59).fill(0x476a87).stroke({ color: 0xc4ac7c, width: 0.7 });
  robe.pivot.set(-5, -58); robe.position.set(-5, -58); legs.addChild(robe);
  figure(art.legs, legs); figure(art.torso, body); figure(art.head, head);
  head.pivot.set(0, -87); head.position.set(0, -87);
  body.pivot.set(0, -55); body.position.set(0, -55);
  const rig = new Container(); caster.addChild(rig);
  rig.addChild(legs, body); body.addChild(head);
  function arm(x: number, back: boolean) {
    const upper = new Container(), forearm = new Container(), hand = new Container();
    upper.position.set(x, -72); forearm.position.y = 21; hand.position.y = 20;
    upper.addChild(new Graphics().moveTo(-5, -2).quadraticCurveTo(-8, 12, -5, 23).lineTo(5, 23).quadraticCurveTo(8, 12, 5, -2).closePath().fill(back ? 0x395472 : 0x608ba3).stroke({ color: 0xb8c5bb, width: 0.7 }));
    forearm.addChild(new Graphics().roundRect(-4.5, -2, 9, 21, 3).fill(back ? 0x50718b : 0x789dad).stroke({ color: 0xd6b477, width: 0.8 }));
    forearm.addChild(new Graphics().roundRect(-5, 14, 10, 4, 1).fill(0xc9a66e));
    hand.addChild(new Graphics().roundRect(-3, -2, 6, 7, 2).fill(0xe3b494).stroke({ color: 0x9e715d, width: 0.6 }));
    upper.addChild(forearm); forearm.addChild(hand); body.addChild(upper);
    return { upper, forearm, hand };
  }
  const backArm = arm(-10, true), frontArm = arm(10, false);
  const staff = new Container(); frontArm.hand.addChild(staff);
  const staffArt = figure(art.staff, staff); staffArt.position.set(-27, 64);
  const orb = new Sprite(glow.texture); orb.anchor.set(0.5); orb.position.set(0, -40); orb.width = orb.height = 24; orb.blendMode = 'add'; staff.addChild(orb);
  figure(art.dummy, dummy);
  const dummyFlash = figure(art.dummy, dummy); dummyFlash.blendMode = 'add'; dummyFlash.alpha = 0;
  world.addChild(caster, dummy);
  const motes = Array.from({ length: 16 }, (_, i) => {
    const s = new Sprite(glow.texture); s.anchor.set(0.5); s.width = s.height = 3 + i % 3; s.tint = 0xd6b477; s.alpha = 0.2; world.addChild(s); return s;
  });
  const idle = { rx: 27, ry: -59, lx: -24, ly: -43, lean: 0, crouch: 0, staff: 0.02 };
  const windups: Record<string, typeof idle> = {
    projectile: { rx: -14, ry: -72, lx: 5, ly: -65, lean: -0.06, crouch: 1, staff: -0.4 },
    aoe: { rx: 8, ry: -110, lx: 9, ly: -101, lean: -0.035, crouch: 0, staff: -0.12 },
    buff: { rx: 27, ry: -59, lx: 0, ly: -66, lean: -0.015, crouch: 0, staff: 0 },
    debuff: { rx: 23, ry: -63, lx: 28, ly: -70, lean: 0.025, crouch: 0, staff: 0.1 },
    movement: { rx: 17, ry: -60, lx: -22, ly: -58, lean: 0.15, crouch: 8, staff: -0.3 },
  };
  const releases: Record<string, typeof idle> = {
    projectile: { rx: 45, ry: -65, lx: 15, ly: -62, lean: 0.095, crouch: 0, staff: 0.7 },
    aoe: { rx: 20, ry: -96, lx: 18, ly: -89, lean: 0.04, crouch: 0, staff: 0.28 },
    buff: { rx: 27, ry: -59, lx: -38, ly: -65, lean: 0, crouch: 0, staff: 0 },
    debuff: { rx: 27, ry: -59, lx: 30, ly: -72, lean: 0.05, crouch: 0, staff: 0.06 },
    movement: { rx: 14, ry: -58, lx: -28, ly: -60, lean: 0.2, crouch: 4, staff: -0.5 },
  };
  const pose = { ...idle }, velocity = { ...idle };
  (Object.keys(velocity) as (keyof typeof idle)[]).forEach(k => { velocity[k] = 0; });
  let clock = 0, castAge = Infinity, releaseAge = Infinity, hitAge = Infinity, color = 0x91c9da, category = 'projectile';
  let casterLift = 0, targetLift = 0;
  let swordsman: Sprite | undefined, textures: Texture[] = [], clipFrame = 0;
  let clipRelease = 270, clipEnd = 680;
  function setCaster(frames: Texture[]) {
    const anchor = frames[0]?.defaultAnchor;
    if (frames.length !== 24 || !anchor) throw Error('Invalid swordsman clip');
    textures = frames;
    textures[0].source.scaleMode = 'linear';
    swordsman = new Sprite(textures[0]);
    swordsman.anchor.copyFrom(anchor);
    swordsman.scale.set(120 / textures[0].orig.height);
    caster.addChild(swordsman); rig.visible = false;
  }
  function sampleCast(elapsed: number) {
    const local = elapsed <= clipRelease && clipRelease > 0
      ? elapsed / clipRelease * 270
      : 270 + (elapsed - clipRelease) / Math.max(1, clipEnd - clipRelease) * 410;
    clipFrame = !Number.isFinite(elapsed) || elapsed > clipEnd ? 0 : Math.round(Math.min(1, Math.max(0, local / 680)) * 23);
    if (swordsman) swordsman.texture = textures[clipFrame];
  }
  function pointArm(a: ReturnType<typeof arm>, x: number, y: number) {
    const dx = x - a.upper.x, dy = y - a.upper.y, d = Math.max(1, Math.min(40.9, Math.hypot(dx, dy)));
    const shoulder = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1, (21 * 21 + d * d - 20 * 20) / (42 * d))));
    a.upper.rotation = shoulder - Math.PI / 2;
    a.forearm.rotation = Math.acos(Math.max(-1, Math.min(1, (d * d - 21 * 21 - 20 * 20) / (2 * 21 * 20))));
    a.hand.rotation = -a.upper.rotation - a.forearm.rotation;
  }
  function actor(node: Container, shadow: Sprite, home: { x: number; y: number }, p: ActorPose | null | undefined, dt: number) {
    const x = home.x + (p?.x ?? 0), y = home.y + (p?.y ?? 0), lift = Math.max(0, p?.lift ?? 0);
    // Without an actor track both units face the same side, towards the target's side of the stage.
    node.position.set(x, y - lift); node.scale.x = p?.facing ?? sideFacing;
    const alpha = p?.visible === false ? 0 : 1;
    node.alpha += Math.sign(alpha - node.alpha) * Math.min(Math.abs(alpha - node.alpha), dt / 80);
    shadow.position.set(x, y + 3); shadow.scale.set(90 / shadowTexture.width / (1 + lift / 32), 32 / shadowTexture.height / (1 + lift / 32));
    shadow.alpha = node.alpha * 0.85 / (1 + lift / 100);
    return lift;
  }
  function animate(ms: number, casterPose?: ActorPose | null, targetPose?: ActorPose | null, elapsedMs?: number) {
    const dt = Math.min(ms, 50); clock += dt; castAge += dt; releaseAge += dt; hitAge += dt;
    const t = clock / 1000, windup = releaseAge === Infinity && Number.isFinite(castAge) ? 1 - Math.pow(1 - Math.min(1, castAge / 220), 3) : 0;
    const recoil = Math.exp(-releaseAge / 330), hit = Math.exp(-hitAge / 210), spring = Number.isFinite(hitAge) ? Math.sin(hitAge / 67) * hit : 0;
    const wind = windups[category] ?? windups.aoe, release = releases[category] ?? releases.aoe;
    for (let remaining = dt; remaining > 0;) {
      const step = Math.min(remaining, 1000 / 120) / 1000; remaining -= step * 1000;
      for (const key of Object.keys(pose) as (keyof typeof idle)[]) {
        const goal = idle[key] + (wind[key] - idle[key]) * windup + (release[key] - idle[key]) * recoil;
        velocity[key] += ((goal - pose[key]) * 260 - velocity[key] * 23) * step;
        pose[key] += velocity[key] * step;
      }
    }
    casterLift = actor(caster, casterShadow, from, casterPose, dt);
    targetLift = actor(dummy, dummyShadow, to, targetPose, dt);
    if (!swordsman) caster.y -= Math.sin(t * 2.1) * 1.1;
    sampleCast(elapsedMs ?? castAge);
    legs.scale.y = 1 - pose.crouch / 140; body.y = -55 + pose.crouch; body.rotation = pose.lean;
    head.rotation = -pose.lean * 0.35 + Math.sin(t * 1.4) * 0.008;
    robe.rotation = Math.sin(t * 1.8) * 0.023; hair.rotation = Math.sin(t * 1.5 + 1) * 0.035;
    const staffAngle = pose.staff + (Number.isFinite(releaseAge) ? Math.sin(Math.min(1, releaseAge / 65) * Math.PI) * 0.16 : 0);
    const reach = Math.min(1, castAge / 180);
    const grip = wind === windups.aoe && Number.isFinite(castAge) ? releaseAge === Infinity ? reach * reach * (3 - 2 * reach) : Math.exp(-releaseAge / 180) : 0;
    pointArm(backArm, pose.lx + (pose.rx - Math.sin(staffAngle) * 9 - pose.lx) * grip, pose.ly + (pose.ry + Math.cos(staffAngle) * 9 - pose.ly) * grip);
    pointArm(frontArm, pose.rx, pose.ry); staff.rotation = staffAngle;
    orb.tint = color; orb.alpha = 0.28 + Math.sin(t * 3) * 0.08 + windup * 0.35 + recoil * 0.4;
    orb.scale.set((24 + windup * 9 + recoil * 8) / glow.texture.width);
    dummy.x += 10 * spring; dummy.rotation = Math.sin(t * 1.4) * 0.009 + spring * 0.14;
    dummy.scale.x *= 1 + hit * 0.075; dummy.scale.y = 1 - hit * 0.07;
    dummyFlash.tint = hitAge < 65 ? 0xffffff : color; dummyFlash.alpha = Math.exp(-hitAge / 85) * 0.85;
    floorFlash.position.set(to.x + (targetPose?.x ?? 0), to.y + (targetPose?.y ?? 0));
    floorFlash.tint = color; floorFlash.alpha = Math.exp(-hitAge / 160) * 0.5;
    motes.forEach((s, i) => { s.x = 90 + (i * 59 + Math.sin(t * 0.2 + i) * 15) % 830; s.y = 180 + (i * 31 - t * (3 + i % 4) + 10000) % 210; s.alpha = 0.06 + (Math.sin(t + i) + 1) * 0.06; });
  }
  function cue(event: CueEvent, tint: number) {
    color = tint;
    if (event.type === 'sound' && event.id === 'windup') { castAge = 0; releaseAge = Infinity; }
    if (event.type === 'sound' && ['release', 'buff', 'debuff'].includes(event.id ?? '')) releaseAge = 0;
    if (event.type === 'hit') hitAge = 0;
  }
  function reset() {
    castAge = releaseAge = hitAge = Infinity;
    caster.alpha = dummy.alpha = 1; animate(0);
  }
  drawCompass();
  animate(0);
  /** Re-reads `from`/`to` after the aim changes; the nearer unit (larger ground y) draws in front. */
  function layout() {
    updateFacing(); drawCompass();
    const back = from.y <= to.y ? caster : dummy, front = back === caster ? dummy : caster;
    world.setChildIndex(back, Math.min(world.getChildIndex(caster), world.getChildIndex(dummy)));
    world.setChildIndex(front, Math.max(world.getChildIndex(caster), world.getChildIndex(dummy)));
    reset();
  }
  return { animate, cue, reset, layout, setCaster, backdrop, compass, prepare(value: string, timing?: { release: number; duration: number }) {
    category = value;
    clipRelease = timing?.release ?? 270;
    clipEnd = Math.min(timing?.duration ?? 680, clipRelease + 410);
  }, caster, dummy, casterShadow, dummyShadow, body, head, legs, frontArm, backArm, staff, orb, floorFlash, rig,
    get swordsman() { return swordsman; },
    get state() { return { clock, castAge, releaseAge, hitAge, category, casterLift, targetLift, clipFrame, clipRelease, clipEnd }; } };
}
