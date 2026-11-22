// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  stdin: { contents: "export * from './kit'; export { lightningBolt } from './kit/lightning-bolt'; export { fireTextures } from './kit/fire-textures'; export { waterTextures } from './kit/water-textures'; export { Container, Sprite } from 'pixi.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'kit', platform: 'browser',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  console.log(await page.evaluate(() => {
    const { VfxWorld, Container, Sprite, createVfxTextures, empoweredWorld, empoweredAura, empoweredHit, PALETTES } = kit;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const w = new VfxWorld(VfxWorld.createLayers(new Container())), tex = createVfxTextures();
    const step = ms => { for (let t = 0; t < ms; t += 16) w.update(Math.min(16, ms - t)); };
    const palette = PALETTES.fire ?? PALETTES.arcane;
    const one = empoweredWorld(w, { tier: 1, palette, textures: tex });
    const two = empoweredWorld(w, { tier: 2, palette, textures: tex });
    const three = empoweredWorld(w, { tier: 3, palette, textures: tex });
    check(one === w && w.density === 1, 'tier 1 identity and shared density unchanged');
    const options = { texture: tex.glow, x: 100, y: 100, life: 200, scale: 0.5, alpha: 0.5, tint: 0x804020 };
    const a = one.spawn(options), b = two.spawn(options), c = three.spawn(options);
    check(a.sprite.scale.x === 0.5 && Math.abs(b.sprite.scale.x - 0.6) < 1e-6 && Math.abs(c.sprite.scale.x - 0.725) < 1e-6, 'overlapping casts keep independent scales');
    check(c.sprite.alpha > b.sprite.alpha && b.sprite.alpha > a.sprite.alpha && c.sprite.tint === a.sprite.tint, 'brighter energy preserves authored tint');
    check(two.density === w.density && three.density === w.density, 'density unchanged');
    check(w.energyScale === 1 && two.energyScale === 1.2 && three.energyScale === 1.45, 'cast-local anchored energy width factors');
    for (const texture of [tex.rock, tex.puff, tex.bell, tex.guardian, tex.chevron, tex.crackedShield]) {
      for (const blend of ['normal', 'add']) {
        const q = three.spawn({ ...options, texture, blend });
        check(q.sprite.scale.x === 0.5 && q.sprite.alpha === 0.5 && q.sprite.tint === options.tint, 'authored non-energy art unchanged');
      }
    }
    const fire = kit.fireTextures(), water = kit.waterTextures(), wood = kit.woodTextures();
    for (const texture of [...fire.flames, water.foam, water.crown, wood.halo, wood.shaft, tex.shard, tex.drop]) {
      const plain = one.spawn({ ...options, texture });
      const warm = two.spawn({ ...options, texture });
      const hot = three.spawn({ ...options, texture });
      const material = three.spawn({ ...options, texture, blend: 'normal' });
      check(Math.abs(hot.sprite.scale.x / plain.sprite.scale.x - 1.45) < 1e-6 &&
        Math.abs(warm.sprite.scale.x / plain.sprite.scale.x - 1.2) < 1e-6 &&
        hot.sprite.alpha > warm.sprite.alpha && warm.sprite.alpha > plain.sprite.alpha, 'private elemental energy grows and brightens at both tiers');
      check(material.sprite.scale.x === 0.5 && material.sprite.alpha === 0.5, 'normal-blended private textures remain authored');
    }
    for (const texture of [...fire.smoke, fire.meteor, fire.scorch, ...water.crystals, wood.seed, ...wood.clouds]) {
      const q = three.spawn({ ...options, texture });
      check(q.sprite.scale.x === 0.5 && q.sprite.alpha === 0.5, 'private materials never misclassified as energy');
    }
    const normal = three.spawn({ ...options, blend: 'normal', stretch: 0.002 });
    check(normal.sprite.scale.x === 0.5 && normal.o.stretch === 0.002, 'normal energy texture and trail proportions unchanged');
    const unclassified = empoweredWorld(w, { tier: 3, palette }).spawn(options);
    check(unclassified.sprite.scale.x === 0.5, 'unclassified textures are conservatively unchanged');
    check(options.scale === 0.5 && options.alpha === 0.5, 'caller options untouched');
    let delayed, streamed;
    three.after(32, () => { delayed = three.burst(10, () => options); });
    three.stream({ rate: 100, duration: 60, make: () => { streamed = true; return options; } });
    step(64);
    check(delayed.length === 10 && streamed && delayed.every(p => Math.abs(p.sprite.scale.x - 0.725) < 1e-6), 'delayed bursts and streams retain full density and energy styling');
    const root = new Sprite(tex.glow); root.position.set(350, 200);
    root.blendMode = kit.blend('add');
    root.anchor.set(0.2, 0.8); root.rotation = 0.4;
    three.layers.body.addChild(root);
    const unown = three.own(() => root.destroy());
    three.addUpdater(() => { root.scale.set(1); root.position.set(350, 200); return true; });
    step(64); check(Math.abs(root.scale.x - 1.45) < 1e-6 && root.x === 350 && root.y === 200 && root.anchor.x === 0.2, 'raw sprite scales about its own anchor without moving');
    const ribbonOptions = { life: 1000, width: 20, tint: 0x80ccff, alpha: () => 0.5,
      point: (u, age, out) => { out.x = 100 + u * 200; out.y = 300; out.z = 40 + u * 20; } };
    const baselineRibbon = kit.flowRibbon(one, ribbonOptions), baselineRope = w.layers.body.children.at(-1);
    const ribbon = kit.flowRibbon(three, ribbonOptions), rope = w.layers.body.children.at(-1), ribbonTexture = rope.texture;
    step(16); rope.onRender.call(rope);
    check(Math.abs(rope.geometry.width / baselineRope.texture.height - 1.45) < 1e-6 && rope.alpha > baselineRope.alpha, 'additive ribbons widen and brighten, without stretching the path');
    check(rope.scale.x === 1 && rope.scale.y === 1 && rope.x === 0 && rope.y === 0 &&
      JSON.stringify(rope.geometry.points) === JSON.stringify(baselineRope.geometry.points), 'ribbon endpoints and centerline stay exact');
    ribbon.stop(); check(ribbonTexture.destroyed && !baselineRope.texture.destroyed, 'cast-local ribbon texture cleans up without touching the baseline'); baselineRibbon.stop();
    const smoothRibbon = kit.flowRibbon(one, { ...ribbonOptions, segments: 48 });
    check(w.layers.body.children.at(-1).geometry.points.length === 49, 'curved ribbons support finer sampling without changing the default');
    smoothRibbon.stop();
    const start = { x: 450, y: 400, z: 270 }, end = { x: 700, y: 420, z: 45 };
    kit.setRng(kit.mulberry32(42));
    const plainBolt = kit.lightningBolt(one, tex, start, end, palette, { width: 3, haloWidth: 52 });
    const plainBounds = { ...w.layers.body.children.at(-1).children[1].getLocalBounds() };
    kit.setRng(kit.mulberry32(42));
    const wideBolt = kit.lightningBolt(three, tex, start, end, palette, { width: 3, haloWidth: 52 });
    const wideBounds = w.layers.body.children.at(-1).children[1].getLocalBounds();
    check(wideBounds.maxX - wideBounds.minX > plainBounds.maxX - plainBounds.minX ||
      wideBounds.maxY - wideBounds.minY > plainBounds.maxY - plainBounds.minY, 'anchored lightning channels visibly widen, not only supporting particles');
    plainBolt.stop(); wideBolt.stop();
    kit.lightningBolt(three, tex, start, end, palette, { life: 220 });
    const bolt = w.layers.body.children.at(-1);
    step(16);
    check(bolt.alpha === 1, 'anchored ribbon opacity is preserved');
    const column = new Container(); column.alpha = 0.4;
    three.layers.ground.addChild(column);
    step(16);
    check(column.alpha === 0.4, 'translucent column opacity is not amplified');
    column.destroy();
    for (const point of [start, end]) {
      const projected = bolt.toGlobal({ x: point.x, y: point.y - point.z });
      check(projected.x === point.x && projected.y === point.y - point.z, 'empowered bolt retains both screen-space endpoints');
    }
    kit.lightningChain(three, tex, { points: [start, end, { x: 800, y: 400, z: 45 }], palette });
    step(100);
    check(w.layers.body.children.filter(child => child instanceof Container && !(child instanceof Sprite))
      .every(child => child.scale.x === 1 && child.scale.y === 1 && child.x === 0 && child.y === 0), 'chain graphics retain endpoint coordinate system');
    let error;
    const bad = three.addUpdater(() => { throw new Error('scope error'); });
    try { step(16); } catch (e) { error = e.message; }
    check(error === 'scope error', 'scoped callback errors propagate'); bad.stop();
    w.clear(); unown(); check(root.destroyed && !w.count && !w.stats.updaters, 'clear disposes raw sprites, particles and scope callbacks');
    check(one.spawn(options).sprite.scale.x === 0.5, 'scope does not leak into later baseline casts'); w.clear();
    const spark = { x: 200, y: 300, palette, refresh: true };
    kit.hitSpark(w, tex, spark); step(64);
    const sparks = [...w.particles];
    kit.hitSpark(w, tex, spark);
    check(w.count === 10 && sparks.every(p => p.age === 0), 'rapid hits re-trigger every native spark, without stacking');
    step(16);
    check(w.particles.filter(p => p.o.texture === tex.streak).length === 8 && w.particles.some(p => p.o.texture === tex.star), 'full native hit signature retained');
    w.clear(); kit.hitSpark(w, tex, spark);
    check(w.count === 10, 'native spark refresh survives clear and pooled records');
    step(300); check(!w.count, 'refreshed native sparks clean up');
    kit.hitSpark(w, tex, { ...spark, refresh: false }); kit.hitSpark(w, tex, { ...spark, refresh: false });
    check(w.count === 20, 'default native feedback unchanged'); w.clear();
    kit.hitSpark(w, tex, { ...spark, coreAlpha: 0 });
    check(w.count === 9 && !w.particles.some(p => p.o.texture === tex.glow) &&
      w.particles.filter(p => p.o.texture === tex.streak).length === 8, 'readable impact keeps native glint and eight sparks without core glow');
    w.clear();
    kit.damageNumber(w, tex, { x: 0, y: 0, value: '', compact: true });
    check(!w.count && !w.stats.updaters, 'empty compact number');
    kit.damageNumber(w, tex, { x: 0, y: 0, value: 100, crit: true, compact: true });
    const numberTexture = w.particles[0].o.texture;
    check(w.count === 1 && w.particles[0].o.life === 1100, 'compact crit keeps all glyphs and critical lifetime in one particle');
    step(1168); check(!w.count && !w.stats.updaters && numberTexture.destroyed, 'compact number and texture cleanup');
    kit.damageNumber(w, tex, { x: 0, y: 0, value: 100, compact: true });
    const clearedTexture = w.particles[0].o.texture;
    w.clear(); check(clearedTexture.destroyed, 'interrupted number texture cleanup');
    check(!empoweredAura(w, tex, { at: () => ({ x: 0, y: 0 }), height: 96, palette, tier: 3, duration: 0 }), 'empty aura');
    empoweredHit(w, tex, { at: { x: 0, y: 0 }, palette, tier: 1 }); check(!w.count, 'tier 1 hit unchanged');
    empoweredHit(w, tex, { at: { x: 200, y: 300, z: 50 }, palette, tier: 3, element: 'loi' });
    check(w.particles.every(p => p.o.layer === 'ground'), 'lightning empowerment stays behind the struck target');
    w.clear();
    const variants = { kim: tex.streak, moc: tex.vineSegment, hoa: tex.streak, phong: tex.crescent, tho: tex.rock, thuy: tex.shard, loi: tex.fissure };
    for (const [element, texture] of Object.entries(variants)) {
      const at = { x: 200, y: 300, z: 50 };
      empoweredHit(w, tex, { at, palette, tier: 3, element });
      const expected = element === 'moc' || element === 'thuy' ? 7 : element === 'kim' ? 3 : element === 'tho' || element === 'loi' ? 1 : 2;
      check(w.count === expected && w.particles.some(p => p.o.texture === texture), 'element-specific hit signature');
      check(element === 'kim' || element === 'thuy' || w.particles.every(p => p.o.texture !== tex.ring), 'ice ring belongs to a shard burst, not a generic ellipse');
      if (element === 'loi') check(w.layers.ground.children.filter(c => !(c instanceof Sprite)).length === 2, 'branching arcs accompany violet scorch');
      check(w.particles.every(p => p.o.layer === 'ground' && p.o.texture !== tex.glow && p.o.texture !== tex.puff), 'no target-covering glow or puff');
      check(w.particles.every(p => Array.from({ length: 21 }, (_, i) => {
        const alpha = p.o.alpha, t = i / 20;
        return typeof alpha === 'function' ? alpha(t) : typeof alpha === 'number' ? alpha :
          alpha[0] + (alpha[1] - alpha[0]) * (alpha[2]?.(t) ?? t);
      }).every(alpha => alpha >= 0 && alpha <= 0.55)), 'all hit variants cap peak alpha');
      const count = w.count;
      empoweredHit(w, tex, { at: { ...at }, palette, tier: 3, element });
      check(w.count === count, 'overlapping hits at the same target are throttled');
      empoweredHit(w, tex, { at: { x: 400, y: 300 }, palette, tier: 3, element });
      check(w.count === count * 2, 'different targets retain independent accents');
      step(640); check(!w.count && !w.stats.updaters, 'hit signature and branching arcs clean up');
      empoweredHit(w, tex, { at, palette, tier: 3, element });
      check(w.count === expected, 'accent resumes after throttle window'); w.clear();
    }
    for (const element of ['neutral', undefined, 'custom']) {
      empoweredHit(w, tex, { at: { x: 200, y: 300 }, palette, tier: 3, element });
      check(w.count === 1 && w.particles[0].sprite.tint === palette.main, 'utility ring uses supplied palette only'); w.clear();
    }
    empoweredHit(w, tex, { at: { x: 200, y: 300 }, palette, tier: 3, element: 'loi', tick: true });
    check(w.count === 1 && w.particles[0].o.layer === 'ground', 'lightweight behind-target DoT feedback'); w.clear();
    kit.skillActivation(w, tex, { at: () => ({ x: 200, y: 300 }), height: 100, palette, tier: 3 });
    step(480);
    check(w.particles.filter(p => p.o.texture === tex.glow && p.age >= 0).every(p => p.o.layer === 'ground'), 'activation release glow stays behind caster');
    check(w.particles.filter(p => p.o.texture === tex.glow && p.o.scaleY).every(p => p.sprite.alpha <= 0.16 && p.o.tint === palette.main), 'pillar mid-colour and alpha cap'); w.clear();
    const motifs = { kim: tex.blade, moc: tex.vineSegment, thuy: tex.shard, hoa: tex.puff, tho: tex.rock, phong: tex.crescent, loi: undefined, neutral: tex.ring };
    for (const tier of [2, 3]) for (const [element, texture] of Object.entries(motifs)) {
      const at = { x: 100, y: 200, z: 50 };
      const caster = { at: () => at, height: 96, palette, tier, element };
      const aura = empoweredAura(w, tex, { ...caster, duration: Infinity, idle: true });
      step(2000); check(aura.alive && w.count <= 7, 'cheap persistent idle aura');
      const hasMotif = () => element === 'loi' ? w.layers.ground.children.some(child => child instanceof Container && !(child instanceof Sprite)) : w.particles.some(p => p.o.texture === texture);
      check(hasMotif(), 'each element has its own motif');
      check(element !== 'loi' || w.layers.ground.children.length === tier + 1, 'lightning has two/three short ribbons and a violet floor ring');
      check(w.particles.every(p => p.o.texture !== tex.rune && p.o.texture !== tex.glow && p.o.layer === 'ground'), 'no shared rune or bright body overlay');
      check(element !== 'tho' || w.particles.every(p => p.o.texture !== tex.fissure), 'no sustained earth cracks');
      if (element === 'tho') for (const p of w.particles.filter(p => p.o.texture === tex.rock)) {
        check(p.pz >= 2 && p.pz <= 8 && Math.abs(p.py) <= 12 &&
          Math.abs(Math.hypot(p.px, p.py / 0.18) - 64) < 1e-6, 'earth rocks orbit wide at shin height, not across torso');
      }
      if (element === 'moc') {
        check(w.particles.filter(p => p.o.texture === tex.leaf).length === (tier === 3 ? 4 : 3) &&
          w.particles.filter(p => p.o.texture === tex.vineSegment && p.o.groundAligned).length === 2 &&
          w.particles.some(p => p.o.texture === tex.ring && p.o.groundAligned), 'wood has a leaf spiral and two vines framing its ground ring');
      }
      if (element === 'neutral') check(w.particles.every(p => p.o.groundAligned && p.sprite.alpha <= 0.5 && p.sprite.alpha >= 0.3), 'utility halo is visible and grounded');
      if (element === 'loi') {
        const arcs = w.layers.ground.children.filter(c => !(c instanceof Sprite));
        step(128);
        check(arcs.every(arc => arc.destroyed) && w.layers.ground.children.length === tier + 1, 'lightning flashes more frequently without accumulating ribbons');
      }
      check(w.particles.filter(p => p.o.groundAligned).every(p => p.z === 0), 'idle aura floor stays grounded');
      aura.stop(); step(200); check(!w.count && !w.stats.updaters && !w.layers.ground.children.length, 'idle aura stops cleanly');
      empoweredAura(w, tex, { ...caster, duration: 400 });
      step(700); check(!w.count && !w.stats.updaters, 'finite cast aura cleanup');
      kit.skillActivation(w, tex, caster);
      step(100);
      check(hasMotif(), 'activation uses the same element motif');
      check(element !== 'tho' || w.particles.some(p => p.o.texture === tex.fissure), 'earth activation has cracks');
      w.clear();
      kit.skillEvolution(w, tex, { ...caster, fromTier: 1, toTier: tier });
      step(1100);
      check(hasMotif(), 'evolution stamp uses destination motif');
      w.clear();
      check(!w.layers.ground.children.length, 'clear disposes motif graphics');
    }
    const signatures = new Set();
    for (const element of Object.keys(motifs)) {
      w.clear(); kit.setRng(kit.mulberry32(12345));
      kit.skillEvolution(w, tex, { at: () => ({ x: 200, y: 300 }), height: 96, palette, element, fromTier: 1, toTier: 3 });
      step(450);
      check(w.particles.every(p => p.o.layer === 'ground' && p.o.texture !== tex.rune && p.o.texture !== tex.glow), 'element evolution has no shared rune or bright body overlay');
      signatures.add(JSON.stringify([w.particles.map(p => [Object.keys(tex).find(k => tex[k] === p.o.texture), p.px, p.pz]), w.layers.ground.children.length]));
      step(1900); check(!w.count && !w.stats.updaters && !w.layers.ground.children.length, 'all evolution beats finish cleanly');
    }
    check(signatures.size === 8, 'eight distinct evolution gathers/transforms');
    return 'Empowerment: tier-1 identity, full density, private energy/anchored width scaling, authored art, frost/vine/branching lightning hits and throttle, eight distinct evolutions, grounded motifs and cleanup PASS';
  }));
} finally { await browser.close(); }
