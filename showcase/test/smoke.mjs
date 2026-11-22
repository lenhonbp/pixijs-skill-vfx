// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';

export async function showcaseSmoke({ page, browser, url, collection }) {
  await page.evaluate(() => { document.getElementById('loop').checked = false; });
  for (const id of ['kim-golden-edge', 'phong-tailwind.evolved']) {
    await page.evaluate(id => { const s = window.__showcase; s.select(id); void s.cast(); }, id);
    await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    const motion = await page.evaluate(async () => {
      const s = window.__showcase, h = s.current;
      let displacement = 0, lift = 0, shadowWidth = 90;
      for (let i = 0; i < 150; i++) {
        s.app.ticker.update(s.app.ticker.lastTime + 1000 / 60);
        const p = h.pose('caster');
        if (!p) continue;
        if (Math.abs(s.scene.caster.x - s.from.x - p.x) > 0.01 || Math.abs(s.scene.caster.y - s.from.y - p.y + p.lift) > 1.2) throw Error('Ticker did not apply caster pose');
        if (Math.abs(s.scene.casterShadow.y - s.from.y - p.y - 3) > 0.01) throw Error('Shadow left ground');
        displacement = Math.max(displacement, Math.abs(p.x));
        if (p.lift > lift) { lift = p.lift; shadowWidth = s.scene.casterShadow.width; }
      }
      h.stop(); await h.finished;
      if (Math.abs(s.scene.caster.x - s.from.x) > 0.01 || Math.abs(s.scene.caster.y - s.from.y) > 1.2) throw Error('Stop did not reset actor home');
      return { displacement, lift, shadowWidth, packs: s.vfx.stats().packs };
    });
    assert.equal(motion.packs, 1);
    if (id === 'kim-golden-edge') assert.ok(motion.displacement > 200);
    else { assert.ok(motion.lift > 20); assert.ok(motion.shadowWidth < 60); }
  }
  await page.evaluate(() => {
    const { scene, from, to } = window.__showcase;
    scene.reset();
    const p = { x: 35, y: 7, lift: 30, visible: false, facing: -1 };
    scene.cue({ type: 'hit' }, 0xff9966); scene.animate(50, p, p); scene.animate(50, p, p);
    if (scene.caster.alpha !== 0 || scene.dummy.alpha !== 0 || scene.caster.scale.x !== -1 || scene.dummy.scale.x >= 0) throw Error('Visibility/facing ignored');
    if (Math.abs(scene.dummy.y - (to.y + 7 - 30)) > 0.01 || scene.dummy.scale.y >= 1 || scene.floorFlash.alpha <= 0) throw Error('Target pose lost hit reaction');
    scene.reset();
    if (scene.caster.alpha !== 1 || scene.dummy.alpha !== 1 || scene.dummy.x !== to.x || scene.caster.x !== from.x) throw Error('Empty pose did not restore home');
    if (scene.staff.parent !== scene.frontArm.hand || scene.frontArm.forearm.parent !== scene.frontArm.upper || scene.backArm.hand.parent !== scene.backArm.forearm) throw Error('Arm hierarchy broken');
    const angles = [];
    for (const category of ['projectile', 'aoe', 'buff', 'debuff', 'movement']) {
      scene.reset(); scene.prepare(category); scene.cue({ type: 'sound', id: 'windup' }, 0xff9966);
      for (let i = 0; i < 16; i++) scene.animate(16);
      const windup = scene.frontArm.upper.rotation;
      angles.push(windup.toFixed(2) + ':' + scene.backArm.upper.rotation.toFixed(2));
      scene.cue({ type: 'sound', id: 'release' }, 0xff9966);
      for (let i = 0; i < 12; i++) scene.animate(16);
      if (!Number.isFinite(scene.frontArm.upper.rotation) || (category === 'projectile' && Math.abs(scene.frontArm.upper.rotation - windup) < 0.1)) throw Error('Release did not thrust');
    }
    if (new Set(angles).size !== 5) throw Error('Category windups are identical');
    scene.reset(); scene.prepare('aoe'); scene.cue({ type: 'sound', id: 'windup' }, 0xff9966);
    for (let i = 0; i < 40; i++) scene.animate(16);
    const grip = scene.staff.toLocal(scene.backArm.hand.getGlobalPosition());
    if (Math.abs(grip.x) > 1 || Math.abs(grip.y - 9) > 1) throw Error('Overhead free hand does not grip staff');
    scene.reset();
  });
  console.log('Showcase actors + rig: PASS (ticker-driven dash/flight, grounded shadows, flags, target hit overlay, home reset, articulated category windups/release)');

  const tierPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const requests = [], errors = [];
  tierPage.on('request', r => { if (r.url().endsWith('.vfxb')) requests.push(new URL(r.url()).pathname); });
  tierPage.on('pageerror', e => errors.push(e.message));
  try {
    await tierPage.goto(url + '/collection/#phong-tailwind/evolved');
    await tierPage.waitForFunction(() => window.__showcase);
    assert.deepEqual(requests, ['/collection/packs/free/phong-tailwind.evolved.m.vfxb']);
    assert.match(await tierPage.locator('#snippet').textContent(), /phong-tailwind\.evolved/);
    assert.match(await tierPage.locator('#selected-vi').textContent(), /.+/);
    assert.notEqual(await tierPage.locator('#selected-vi').textContent(), collection.find(p => p.id === 'phong-tailwind').name.vi);
    const evolvedDescription = await tierPage.locator('#description').textContent();
    await tierPage.getByRole('button', { name: 'Normal', exact: true }).click();
    await tierPage.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    assert.notEqual(await tierPage.locator('#description').textContent(), evolvedDescription);
    await tierPage.evaluate(() => {
      for (const tier of ['evolved', 'normal', 'evolved']) document.querySelector('[data-tier="' + tier + '"]').click();
    });
    await tierPage.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(new URL(tierPage.url()).hash, '#phong-tailwind/evolved');
    assert.equal(await tierPage.evaluate(() => window.__showcase.vfx.stats().packs), 1);
    assert.match(await tierPage.locator('#snippet').textContent(), /phong-tailwind\.evolved/);
    await tierPage.goBack();
    await tierPage.waitForFunction(() => location.hash === '#phong-tailwind' && document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(await tierPage.evaluate(() => window.__showcase.vfx.stats().packs), 1);
    assert.equal(await tierPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await tierPage.locator('.skill').filter({ hasText: 'Golden Edge' }).click();
    await tierPage.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    await tierPage.waitForFunction(() => {
      const top = document.getElementById('library').getBoundingClientRect().top;
      return top >= 0 && top <= 40;
    });
    assert.deepEqual(errors, []);
  } finally { await tierPage.close(); }

  const fallback = await browser.newPage();
  try {
    const withoutEvolved = structuredClone(collection);
    delete withoutEvolved.find(p => p.id === 'hoa-fireball').evolved;
    await fallback.route('**/packs/free/index.json', route => route.fulfill({ json: withoutEvolved }));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await fallback.route('**/hoa-fireball.vfxb', async route => { await gate; await route.fulfill({ status: 503, body: 'Unavailable' }); });
    const navigation = fallback.goto(url + '/collection/#hoa-fireball/evolved');
    await fallback.waitForFunction(() => document.getElementById('status')?.classList.contains('is-loading'));
    assert.match(await fallback.locator('#status').textContent(), /Loading · [\d.]+ (KB|MB)/);
    release(); await navigation; await fallback.waitForFunction(() => window.__showcase);
    assert.equal(await fallback.locator('#tiers').isVisible(), false);
    assert.equal(new URL(fallback.url()).hash, '#hoa-fireball');
    assert.match(await fallback.locator('#status').textContent(), /failed/);
    assert.equal(await fallback.locator('#status').evaluate(el => el.classList.contains('is-loading')), false);
    await fallback.unroute('**/hoa-fireball.vfxb');
    await fallback.locator('#replay').click();
    await fallback.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(await fallback.evaluate(() => window.__showcase.vfx.stats().packs), 1);
  } finally { await fallback.close(); }
  console.log('Showcase tiers: PASS (selected-only mobile load, metadata/snippet/hash/history, rapid switches, one resident tier, absent evolved, size indicator, load failure/retry)');
}
