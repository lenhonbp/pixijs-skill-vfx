// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';

export async function showcaseSmoke({ page, browser, url, collection }) {
  assert.equal(await page.title(), 'VFX Store • Game-Ready PixiJS Skill Effects');
  const meta = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property], meta[name]')].map(m => [m.getAttribute('property') ?? m.name, m.content])));
  for (const key of ['description', 'og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(meta[key], key);
  assert.equal(meta['twitter:card'], 'summary_large_image');
  const assets = await page.evaluate(() => ['link[rel=icon]', 'link[rel=apple-touch-icon]'].map(s => document.querySelector(s).href));
  for (const asset of [...assets, new URL('og-preview.jpg', page.url()).href]) {
    const res = await page.request.get(asset);
    assert.equal(res.status(), 200, asset); assert.match(res.headers()['content-type'], /^image\//, asset);
  }
  assert.equal((await page.content()).includes('lenhonbp@gmail.com'), false);
  assert.ok(await page.locator('footer a[href="mailto:lenhon.vfx@gmail.com"]').count());
  assert.ok(await page.locator('footer a[href$="/issues"]').count());

  await page.setViewportSize({ width: 1440, height: 900 });
  const split = await page.evaluate(async () => {
    scrollTo({ top: document.getElementById('library').getBoundingClientRect().top + scrollY, behavior: 'instant' });
    await new Promise(requestAnimationFrame);
    const list = document.querySelector('aside').getBoundingClientRect(), actions = document.querySelector('.actions').getBoundingClientRect();
    scrollTo({ top: 0, behavior: 'instant' });
    return { listTop: list.top, listBottom: list.bottom, actionsTop: actions.top, actionsBottom: actions.bottom, vh: innerHeight };
  });
  assert.ok(split.listTop >= -1 && split.listBottom <= split.vh + 1 && split.actionsTop >= 0 && split.actionsBottom <= split.vh + 1, `skill list and preview actions fit a 1440×900 screen: ${JSON.stringify(split)}`);
  assert.deepEqual(await page.locator('.group').evaluateAll(g => g.slice(0, 5).map(e => e.textContent.split(' · ')[0])), ['Metal', 'Wood', 'Water', 'Fire', 'Earth']);

  for (const mode of ['checker', 'light', 'dark', 'stage']) {
    await page.click(`.stage-toolbar [data-bg=${mode}]`);
    assert.equal(await page.locator('#stage').getAttribute('data-bg'), mode);
    assert.equal(await page.evaluate(() => window.__showcase.scene.backdrop.visible), mode === 'stage');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('lenhon-vfx-bg')), 'stage');

  // Eight-way aiming: the toolbar, a click on the floor and the keyboard each pick one of the eight ground directions.
  const pressed = () => page.locator('#aim button[aria-pressed=true]').getAttribute('aria-label');
  assert.equal(await page.locator('#aim button').count(), 8);
  await page.click('#aim button[aria-label="Cast up-left"]');
  assert.equal(await pressed(), 'Cast up-left');
  const arena = await page.locator('#stage').boundingBox();
  // Ground distances are squashed by 0.6 on screen, so the screen offsets below are 200 ground units from the centre.
  for (const [dx, dy, name] of [[200, 0, 'right'], [0, 120, 'down'], [-141, 85, 'down-left'], [-200, 0, 'left'], [0, -120, 'up'], [141, -85, 'up-right'], [-141, -85, 'up-left'], [141, 85, 'down-right']]) {
    await page.mouse.click(arena.x + arena.width * (480 + dx) / 1000, arena.y + arena.height * (350 + dy) / 580);
    assert.equal(await pressed(), `Cast ${name}`, `a click on the floor aims ${name}`);
  }
  await page.evaluate(() => document.activeElement.blur());
  const hover = async () => { const now = await page.locator('#stage').boundingBox(); await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2); }; // the page may have scrolled since the clicks
  await hover();
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight');
  assert.equal(await pressed(), 'Cast up-right', 'two held arrows make a diagonal');
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Numpad1');
  assert.equal(await pressed(), 'Cast down-left', 'the numpad aims too');
  await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('ArrowLeft');
  assert.equal(await pressed(), 'Cast down-left', 'arrow keys do nothing away from the stage, so the page still scrolls');
  await hover();
  await page.keyboard.press('Numpad6');
  assert.equal(await pressed(), 'Cast right');
  await page.mouse.move(5, 5);

  // Cycling every aim of a heavy directional skill keeps one direction resident: texture memory stays at a flat ceiling.
  const aims = ['right', 'up-right', 'up', 'up-left', 'left', 'down-left', 'down', 'down-right'];
  for (const skill of ['loi-thunder-domain', 'phong-whirlwind']) {
    await page.evaluate(skill => window.__showcase.select(skill), skill);
    const firstBytes = new Map(); let ceiling = 0;
    for (let lap = 0; lap < 2; lap++) for (const name of aims) {
      await page.click(`#aim button[aria-label="Cast ${name}"]`);
      await page.waitForFunction(skill => { const v = window.__showcase.vfx; return v.directions(skill).length === 1 && v.stats().active >= 1; }, skill);
      const { direction, packs, textureBytes } = await page.evaluate(skill => ({ direction: window.__showcase.vfx.directions(skill)[0], ...window.__showcase.vfx.stats() }), skill);
      assert.equal(packs, 1, `${skill} ${name}: ${packs} packs resident`);
      if (!lap && !firstBytes.has(direction)) { firstBytes.set(direction, textureBytes); ceiling = Math.max(ceiling, textureBytes); }
      assert.equal(textureBytes, firstBytes.get(direction), `${skill} ${name}: texture memory drifted to ${textureBytes} B`);
      assert.ok(textureBytes <= ceiling, `${skill} ${name}: ${textureBytes} B over the ${ceiling} B ceiling`);
    }
    assert.equal(firstBytes.size, 5, `${skill} aims reached ${[...firstBytes.keys()]}`);
  }
  // A quick re-aim while the first direction is still loading ends on the newer aim, still playing.
  await page.evaluate(() => { document.querySelector('#aim button[aria-label="Cast up"]').click(); document.querySelector('#aim button[aria-label="Cast up-right"]').click(); });
  await page.waitForFunction(() => { const v = window.__showcase.vfx; return v.stats().active >= 1 && v.stats().packs === 1; });
  await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(() => [window.__showcase.vfx.directions('phong-whirlwind'), window.__showcase.vfx.stats().active, window.__showcase.vfx.stats().packs]), [[-45], 1, 1]);
  await page.click('#aim button[aria-label="Cast right"]');
  console.log('Showcase direction residency: PASS (thunder-domain and whirlwind cycle all 8 aims twice with one resident direction and a flat texture ceiling)');

  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied.push(t); } } }); });
  await page.click('#copy-url'); await page.click('#copy');
  const copied = await page.evaluate(() => window.__copied), id = await page.evaluate(() => location.hash.slice(1));
  assert.equal(copied[0], new URL(`packs/free/${id}.vfxb`, page.url()).href);
  assert.equal((await page.request.get(copied[0])).status(), 200);
  assert.match(copied[1], new RegExp(`vfx\\.play\\('${id}'`));

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download-kit')]);
  assert.equal(download.suggestedFilename(), `vfx-store-${id}.zip`);
  const zip = await (await import('node:fs/promises')).readFile(await download.path());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const names = zip.toString('latin1');
  for (const name of [`${id}/${id}.vfxb`, `${id}/${id}.m.vfxb`, `${id}/README.md`]) assert.ok(names.includes(name), name);
  const entry = collection.find(p => p.id === id);
  assert.ok(zip.length > (entry.desktopBytes ?? entry.bytes) + entry.mobileBytes);

  await page.evaluate(() => { document.getElementById('loop').checked = false; });
  for (const id of ['kim-golden-edge', 'phong-tailwind']) {
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
    assert.ok(motion.displacement > 200);
    if (id === 'phong-tailwind') { assert.ok(motion.lift > 5); assert.ok(motion.shadowWidth < 90); }
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
    const sprite = scene.swordsman;
    if (!sprite || scene.rig.visible || sprite.anchor.x !== sprite.texture.defaultAnchor.x || sprite.anchor.y !== sprite.texture.defaultAnchor.y) throw Error('Sheet caster or feet anchor missing');
    if (sprite.texture.source.scaleMode !== 'linear' || Math.abs(sprite.height - 120) > 0.01) throw Error('Wrong sheet filtering/scale');
    for (const timing of [{ release: 433, duration: 4000 }, { release: 100, duration: 300 }, { release: 0, duration: 500 }]) {
      scene.prepare('projectile', timing);
      const end = Math.min(timing.duration, timing.release + 410);
      for (const age of [0, timing.release, timing.release + 30, end, end + 1]) {
        scene.animate(0, null, null, age);
        const local = age <= timing.release && timing.release > 0 ? age / timing.release * 270 : 270 + (age - timing.release) / Math.max(1, end - timing.release) * 410;
        const expected = age > end ? 0 : Math.round(Math.min(1, Math.max(0, local / 680)) * 23);
        if (scene.state.clipFrame !== expected) throw Error('Clip sampling/segment warp failed');
        if (scene.caster.x !== from.x || scene.caster.y !== from.y) throw Error('Clip moved feet off anchor');
      }
    }
    scene.reset();
    if (scene.state.clipFrame !== 0) throw Error('Idle is not frame zero');
  });
  await page.evaluate(() => {
    const s = window.__showcase; s.app.stop(); s.select('hoa-fireball'); document.getElementById('loop').checked = true; void s.cast();
  });
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
  await page.evaluate(() => {
    const s = window.__showcase, manifest = s.vfx.getManifest('hoa-fireball'), h = s.current;
    const release = manifest.cues.find(c => c.type === 'sound' && c.id === 'release').t;
    if (s.scene.state.clipRelease !== release) throw Error('Release did not use selected pack cue');
    let releases = 0;
    const listen = c => { if (c.handle === h && c.type === 'sound' && c.id === 'release') releases++; };
    s.vfx.on('cue', listen);
    for (let i = 0; i < 400; i++) {
      s.app.ticker.update(s.app.ticker.lastTime + 1000 / 60);
      const age = h.elapsedMs, end = Math.min(manifest.durationMs, release + 410);
      const local = age <= release ? age / release * 270 : 270 + (age - release) / (end - release) * 410;
      const expected = age > end ? 0 : Math.round(Math.min(1, Math.max(0, local / 680)) * 23);
      if (s.scene.state.clipFrame !== expected) throw Error('Playback clock, hitstop or loop desynchronized clip');
    }
    if (releases < 2 || releases > 4) throw Error('Loop release did not fire once per cast');
    s.vfx.off('cue', listen); h.stop(); document.getElementById('loop').checked = false;
  });
  await page.evaluate(async () => { await window.__showcase.current.finished; });
  await page.evaluate(() => {
    const s = window.__showcase;
    if (s.scene.state.clipFrame !== 0) throw Error('Stop did not restore idle clip');
    const original = s.vfx.getManifest.bind(s.vfx);
    s.vfx.getManifest = id => {
      const manifest = original(id);
      manifest.cues = manifest.cues.filter(c => c.type !== 'sound' || !['release', 'buff', 'debuff'].includes(c.id));
      return manifest;
    };
    s.restoreManifest = () => { s.vfx.getManifest = original; };
    void s.cast();
  });
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
  await page.evaluate(async () => {
    const s = window.__showcase;
    if (s.scene.state.clipRelease !== 220 || s.scene.state.clipFrame !== 0) throw Error('Missing release fallback or replay reset failed');
    s.current.stop(); await s.current.finished; s.restoreManifest(); delete s.restoreManifest; s.app.start();
  });
  console.log('Showcase swordsman: PASS (sheet, feet anchor, filtering/scale, idle, segment warp, release cue, playback clock/hitstop/loop/stop, dash/flight/shadows/flags/hit overlay)');

  const linkPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const requests = [], errors = [];
  linkPage.on('request', r => { if (r.url().endsWith('.vfxb')) requests.push(new URL(r.url()).pathname); });
  linkPage.on('pageerror', e => errors.push(e.message));
  try {
    await linkPage.goto(url + '/collection/#phong-tailwind/evolved');
    await linkPage.waitForFunction(() => window.__showcase);
    assert.deepEqual(requests, ['/collection/packs/free/phong-tailwind.m.vfxb']);
    assert.equal(new URL(linkPage.url()).hash, '#phong-tailwind');
    assert.equal(await linkPage.evaluate(() => history.length), 2); // about:blank + this page: the legacy hash is replaced, not pushed
    assert.match(await linkPage.locator('#snippet').textContent(), /'phong-tailwind'/);
    assert.equal(await linkPage.locator('#selected-vi').textContent(), collection.find(p => p.id === 'phong-tailwind').name.vi);
    assert.match(await linkPage.locator('#description').textContent(), /.+/);
    assert.equal(await linkPage.locator('[data-tier]').count(), 0);
    assert.equal(await linkPage.locator('.skill').count(), 28);
    await linkPage.locator('.skill').filter({ hasText: 'Golden Edge' }).click();
    await linkPage.waitForFunction(() => location.hash === '#kim-golden-edge' && document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(await linkPage.evaluate(() => window.__showcase.vfx.stats().packs), 1);
    const downloads = await linkPage.evaluate(() => ['desktop', 'mobile'].map(tier => {
      const link = document.getElementById('download-' + tier);
      return { path: new URL(link.href).pathname, file: link.download, label: link.textContent };
    }));
    assert.deepEqual(downloads.map(d => [d.path, d.file]), [
      ['/collection/packs/free/kim-golden-edge.vfxb', 'kim-golden-edge.vfxb'],
      ['/collection/packs/free/kim-golden-edge.m.vfxb', 'kim-golden-edge.m.vfxb'],
    ]);
    assert.ok(downloads.every(d => /· [\d.]+ (KB|MB)$/.test(d.label)));
    for (const d of downloads) assert.equal((await linkPage.request.get(url + d.path)).status(), 200);
    await linkPage.goBack();
    await linkPage.waitForFunction(() => location.hash === '#phong-tailwind' && document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(await linkPage.evaluate(() => window.__showcase.vfx.stats().packs), 1);
    assert.equal(await linkPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(requests.every(r => r.endsWith('.m.vfxb') && !r.includes('.evolved')));
    assert.deepEqual(errors, []);
  } finally { await linkPage.close(); }

  const fallback = await browser.newPage();
  try {
    await fallback.route('**/actors/ngu-hanh-sword/*.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await fallback.route('**/hoa-fireball.vfxb', async route => { await gate; await route.fulfill({ status: 503, body: 'Unavailable' }); });
    const navigation = fallback.goto(url + '/collection/#hoa-fireball/evolved');
    await fallback.waitForFunction(() => document.getElementById('status')?.classList.contains('is-loading'));
    assert.match(await fallback.locator('#status').textContent(), /Loading · [\d.]+ (KB|MB)/);
    release(); await navigation; await fallback.waitForFunction(() => window.__showcase);
    assert.equal(await fallback.evaluate(() => !window.__showcase.scene.swordsman && window.__showcase.scene.rig.visible), true);
    assert.equal(new URL(fallback.url()).hash, '#hoa-fireball');
    assert.match(await fallback.locator('#status').textContent(), /failed/);
    assert.equal(await fallback.locator('#status').evaluate(el => el.classList.contains('is-loading')), false);
    await fallback.unroute('**/hoa-fireball.vfxb');
    await fallback.locator('#replay').click();
    await fallback.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));
    assert.equal(await fallback.evaluate(() => window.__showcase.vfx.stats().packs), 1);
  } finally { await fallback.close(); }
  console.log('Showcase links: PASS (selected-only mobile load, metadata/snippet/downloads/hash/history, legacy tier links, one resident pack, size indicator, load failure/retry, character sheet failure fallback)');
}
