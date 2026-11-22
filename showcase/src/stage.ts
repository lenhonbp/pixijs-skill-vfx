// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { CueEvent } from '../../runtime/src/index';

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

export function createStage(world: Container, from: { x: number; y: number }, to: { x: number; y: number }, art: { body: Texture; staff: Texture; dummy: Texture }) {
  world.addChild(atmosphere());
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
  const caster = new Container(), staff = new Container(), dummy = new Container();
  caster.position.set(from.x, from.y); dummy.position.set(to.x, to.y);
  const figure = (texture: Texture, parent: Container) => {
    const s = new Sprite(texture); s.anchor.set(0.5, 1); s.width = 80; s.height = 120; parent.addChild(s); return s;
  };
  const hair = new Graphics().moveTo(-9, -89).quadraticCurveTo(-23, -64, -18, -36).quadraticCurveTo(-9, -46, -6, -81).fill(0x30394e);
  hair.pivot.set(-7, -88); hair.position.set(-7, -88); caster.addChild(hair);
  const robe = new Graphics().moveTo(-10, -59).quadraticCurveTo(-20, -34, -24, -9).lineTo(-11, -11).quadraticCurveTo(-1, -36, -4, -59).fill(0x476a87).stroke({color:0xc4ac7c,width:0.7});
  robe.pivot.set(-5, -58); robe.position.set(-5, -58); caster.addChild(robe);
  figure(art.body, caster); figure(art.staff, staff); caster.addChild(staff);
  const orb = new Sprite(glow.texture); orb.anchor.set(0.5); orb.position.set(27, -104); orb.width = orb.height = 24; orb.blendMode = 'add'; staff.addChild(orb);
  figure(art.dummy, dummy);
  const dummyFlash = figure(art.dummy, dummy); dummyFlash.blendMode = 'add'; dummyFlash.alpha = 0;
  world.addChild(caster, dummy);
  const motes = Array.from({ length: 16 }, (_, i) => {
    const s = new Sprite(glow.texture); s.anchor.set(0.5); s.width = s.height = 3 + i % 3; s.tint = 0xd6b477; s.alpha = 0.2; world.addChild(s); return s;
  });
  let clock = 0, castAge = Infinity, releaseAge = Infinity, hitAge = Infinity, color = 0x91c9da;
  function animate(ms: number) {
    const dt = Math.min(ms, 50); clock += dt; castAge += dt; releaseAge += dt; hitAge += dt;
    const t = clock / 1000, windup = castAge < 1500 && releaseAge === Infinity ? Math.min(1, castAge / 200) : 0;
    const recoil = Math.exp(-releaseAge / 160), hit = Math.exp(-hitAge / 210), spring = Number.isFinite(hitAge) ? Math.sin(hitAge / 67) * hit : 0;
    caster.y = from.y - Math.sin(t * 2.1) * 1.4;
    caster.scale.y = 1 + Math.sin(t * 2.1) * 0.008;
    caster.rotation = -0.025 * windup + 0.035 * recoil;
    robe.rotation = Math.sin(t * 1.8) * 0.023; hair.rotation = Math.sin(t * 1.5 + 1) * 0.035;
    staff.y = -13 * windup + 5 * recoil; staff.rotation = -0.09 * windup + 0.045 * recoil;
    orb.tint = color; orb.alpha = 0.35 + Math.sin(t * 3) * 0.12 + windup * 0.5 + recoil * 0.6;
    orb.scale.set((24 + windup * 20 + recoil * 16 + Math.sin(t * 3) * 3) / glow.texture.width);
    dummy.x = to.x + 10 * spring; dummy.rotation = Math.sin(t * 1.4) * 0.009 + spring * 0.14;
    dummy.scale.set(1 + hit * 0.075, 1 - hit * 0.07);
    dummyFlash.tint = hitAge < 65 ? 0xffffff : color; dummyFlash.alpha = Math.exp(-hitAge / 85) * 0.85;
    floorFlash.tint = color; floorFlash.alpha = Math.exp(-hitAge / 160) * 0.5;
    casterShadow.x = caster.x; casterShadow.alpha = 0.85 - Math.sin(t * 2.1) * 0.04;
    casterShadow.scale.x = (90 + Math.sin(t * 2.1) * 2) / shadowTexture.width;
    dummyShadow.x = to.x + spring * 4; dummyShadow.scale.x = (90 + hit * 5) / shadowTexture.width;
    motes.forEach((s, i) => { s.x = 90 + (i * 59 + Math.sin(t * 0.2 + i) * 15) % 830; s.y = 180 + (i * 31 - t * (3 + i % 4) + 10000) % 210; s.alpha = 0.08 + (Math.sin(t + i) + 1) * 0.09; });
  }
  function cue(event: CueEvent, tint: number) {
    color = tint;
    if (event.type === 'sound' && event.id === 'windup') { castAge = 0; releaseAge = Infinity; }
    if (event.type === 'sound' && ['release', 'buff', 'debuff'].includes(event.id ?? '')) releaseAge = 0;
    if (event.type === 'hit') hitAge = 0;
  }
  animate(0);
  return { animate, cue, caster, dummy, orb, floorFlash, get state() { return { clock, castAge, releaseAge, hitAge }; } };
}
