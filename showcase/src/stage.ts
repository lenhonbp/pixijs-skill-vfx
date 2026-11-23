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

function atmosphere() {
  return painted(1000, 580, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 580);
    sky.addColorStop(0, '#0b111d'); sky.addColorStop(0.5, '#25303b'); sky.addColorStop(1, '#10151e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 580);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['#19232e', '#131e29', '#101a25'][layer];
      ctx.beginPath(); ctx.moveTo(0, 300);
      for (let x = 0; x <= 1050; x += 35) ctx.lineTo(x, 190 + layer * 23 + Math.sin(x * 0.013 + layer) * 27 + Math.sin(x * 0.037) * 12);
      ctx.lineTo(1000, 360); ctx.lineTo(0, 360); ctx.fill();
    }
    ctx.fillStyle = '#16202b';
    for (const x of [85, 170, 850, 930]) {
      ctx.fillRect(x - 4, 130, 8, 155); ctx.fillRect(x - 11, 127, 22, 7);
      ctx.beginPath(); ctx.moveTo(x - 26, 128); ctx.quadraticCurveTo(x, 121, x, 109); ctx.quadraticCurveTo(x, 121, x + 26, 128); ctx.fill();
    }
    const mist = ctx.createLinearGradient(0, 210, 0, 330);
    mist.addColorStop(0, '#9faeaf00'); mist.addColorStop(0.55, '#abbcb61b'); mist.addColorStop(1, '#9faeaf00');
    ctx.fillStyle = mist; ctx.fillRect(0, 210, 1000, 120);
    const ground = ctx.createLinearGradient(0, 270, 0, 580);
    ground.addColorStop(0, '#252c32'); ground.addColorStop(1, '#111722');
    ctx.fillStyle = ground; ctx.fillRect(0, 285, 1000, 295);
    const rows = [285, 300, 321, 350, 390, 445, 521, 626];
    const project = (column: number, y: number) => 500 + column * 170 * (y - 230) / 350;
    for (let row = 0; row < rows.length - 1; row++) {
      const top = rows[row], bottom = rows[row + 1];
      for (let col = -20; col < 20; col++) {
        ctx.fillStyle = `rgba(165,173,175,${0.018 + ((row * 7 + col * 3 + 100) % 5) * 0.007})`;
        ctx.beginPath(); ctx.moveTo(project(col, top), top); ctx.lineTo(project(col + 1, top), top);
        ctx.lineTo(project(col + 1, bottom), bottom); ctx.lineTo(project(col, bottom), bottom); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#05091060'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = '#c4b18b10'; ctx.beginPath(); ctx.moveTo(project(col, top + 1), top + 1); ctx.lineTo(project(col + 1, top + 1), top + 1); ctx.stroke();
      }
    }
    const floorMist = ctx.createLinearGradient(0, 285, 0, 355);
    floorMist.addColorStop(0, '#252c32'); floorMist.addColorStop(0.35, '#29323bda'); floorMist.addColorStop(1, '#29323b00');
    ctx.fillStyle = floorMist; ctx.fillRect(0, 285, 1000, 70);
    ctx.save(); ctx.translate(500, 367); ctx.scale(1, 0.38);
    const light = ctx.createRadialGradient(0, 0, 30, 0, 0, 450);
    light.addColorStop(0, '#dcc99b20'); light.addColorStop(0.65, '#b9bdad0c'); light.addColorStop(1, '#c1b68a00');
    ctx.fillStyle = light; ctx.fillRect(-500, -500, 1000, 1000);
    for (const r of [324, 332]) { ctx.strokeStyle = '#d6b47720'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const vignette = ctx.createRadialGradient(500, 320, 130, 500, 320, 580);
    vignette.addColorStop(0, '#090d1600'); vignette.addColorStop(1, '#090d16e8'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1000, 580);
  });
}

export function createStage(world: Container, from: { x: number; y: number }, to: { x: number; y: number }, art: { head: Texture; torso: Texture; legs: Texture; staff: Texture; dummy: Texture }) {
  const backdrop = atmosphere(); world.addChild(backdrop);
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
    // Without an actor track, each side faces the other (caster right, dummy left at the default aim).
    const facing = home === from ? (to.x < from.x - 1 ? -1 : 1) : (from.x > to.x + 1 ? -1 : 1);
    node.position.set(x, y - lift); node.scale.x = p?.facing ?? facing;
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
  animate(0);
  /** Re-reads `from`/`to` after the aim changes; the nearer unit (larger ground y) draws in front. */
  function layout() {
    const back = from.y <= to.y ? caster : dummy, front = back === caster ? dummy : caster;
    world.setChildIndex(back, Math.min(world.getChildIndex(caster), world.getChildIndex(dummy)));
    world.setChildIndex(front, Math.max(world.getChildIndex(caster), world.getChildIndex(dummy)));
    reset();
  }
  return { animate, cue, reset, layout, setCaster, backdrop, prepare(value: string, timing?: { release: number; duration: number }) {
    category = value;
    clipRelease = timing?.release ?? 270;
    clipEnd = Math.min(timing?.duration ?? 680, clipRelease + 410);
  }, caster, dummy, casterShadow, dummyShadow, body, head, legs, frontArm, backArm, staff, orb, floorFlash, rig,
    get swordsman() { return swordsman; },
    get state() { return { clock, castAge, releaseAge, hitAge, category, casterLift, targetLift, clipFrame, clipRelease, clipEnd }; } };
}
