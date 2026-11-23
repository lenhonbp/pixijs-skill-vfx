// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';

const product = (page, id) => page.locator(`#list [data-product-id="${id}"]`);
const access = (page, tier) => page.locator(`#catalog-access [data-access="${tier}"]`);
const ready = page => page.waitForFunction(() => window.__showcase);
const playing = page => page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Playing'));

async function expectUpcoming(page, name) {
  await page.waitForFunction(expected => document.getElementById('selected-name').textContent === expected, name);
  assert.equal(await page.locator('#selected-name').textContent(), name);
  assert.match(await page.locator('#product-badge').textContent(), /Premium/i);
  assert.match(await page.locator('#product-status').textContent(), /Coming soon/i);
  assert.equal(await page.locator('#premium-preview').isVisible(), true);
  assert.equal(await page.locator('#coming-soon').isVisible(), true);
  assert.equal(await page.locator('#purchase-links a').count(), 0);
  for (const selector of ['.stage-wrap', '.controls', '.actions', '#integration']) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} hidden for an upcoming collection`);
  }
  assert.equal(await page.evaluate(() => window.__showcase.vfx.stats().active), 0);
  assert.equal(await page.locator('a[href*="link-tbd"], a[href*="placeholder"]').count(), 0);
}

async function playKiemHiepPreview(page) {
  await page.bringToFront();
  for (const name of ['Thiên Kiếm Quy Tông', 'Tam Tuyệt Kim Quang', 'Bát Âm Kim Chung']) {
    assert.ok((await page.locator('#product-includes').textContent()).includes(name));
  }
  assert.match(await page.locator('#product-compatibility').textContent(), /\.vfxb.*Lenhon runtime/);
  assert.equal(await page.locator('#coming-soon-note').textContent(), 'Pricing, license and purchase links will be announced at launch.');
  assert.match(await page.locator('.preview-caption').textContent(), /Collection coming soon/);
  const video = page.locator('#premium-preview video');
  const media = await video.evaluate(node => ({
    controls: node.controls, autoplay: node.autoplay, preload: node.preload, inline: node.playsInline,
    src: new URL(node.src).pathname, poster: new URL(node.poster).pathname,
  }));
  assert.deepEqual(media, {
    controls: true, autoplay: false, preload: 'none', inline: true,
    src: '/collection/previews/kiem-hiep/preview.mp4', poster: '/collection/previews/kiem-hiep/poster.webp',
  });
  await video.evaluate(node => {
    window.__catalogProductVideo = node; window.__catalogVideoPlayError = null; node.muted = true;
    void node.play().catch(error => { window.__catalogVideoPlayError = String(error); });
  });
  await page.waitForFunction(() => {
    const video = window.__catalogProductVideo;
    return window.__catalogVideoPlayError !== null || video.error ||
      (!video.paused && video.currentTime > 0.1 && video.videoWidth > 0 && video.videoHeight > 0);
  }, null, { timeout: 15000, polling: 100 });
  const failure = await video.evaluate(node => ({
    play: window.__catalogVideoPlayError,
    media: node.error ? { code: node.error.code, message: node.error.message } : null,
  }));
  assert.deepEqual(failure, { play: null, media: null }, 'the real teaser must decode and play without errors');
}

async function expectVideoReleased(page) {
  assert.deepEqual(await page.evaluate(() => ({
    connected: window.__catalogProductVideo.isConnected,
    src: window.__catalogProductVideo.getAttribute('src'), paused: window.__catalogProductVideo.paused,
  })), { connected: false, src: null, paused: true });
}

async function expectPosterDecoded(page) {
  await page.waitForFunction(async () => {
    const image = new Image();
    image.src = document.querySelector('#premium-preview video').poster;
    try { await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0; }
    catch { return false; }
  }, null, { timeout: 15000 });
}

export async function catalogSmoke({ browser, url, collection }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], requests = [], videos = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().endsWith('.vfxb')) requests.push(request.url()); });
  page.on('request', request => { if (/\.(mp4|webm)$/.test(new URL(request.url()).pathname)) videos.push(request.url()); });
  try {
    await page.goto(`${url}/collection/#hoa-fireball`); await ready(page);
    assert.equal(await page.locator('#list .skill').count(), collection.length);
    assert.equal(await page.locator('#list .product-entry').count(), 3);
    assert.match(await page.locator('#product-badge').textContent(), /Free/i);
    assert.match(await page.locator('#product-status').textContent(), /Available/i);
    assert.match(await page.locator('#product-includes').textContent(), /\.vfxb/);
    assert.match(await page.locator('#product-compatibility').textContent(), /PixiJS/);

    await access(page, 'premium').click();
    assert.equal(await page.locator('#list .skill').count(), 0);
    assert.equal(await page.locator('#list .product-entry').count(), 3);
    await page.locator('#collection-filter').selectOption('kiem-hiep');
    assert.equal(await page.locator('#list .product-entry').count(), 1);
    await page.locator('#collection-filter').selectOption('all');
    for (const query of ['Ngũ Hành', 'Ngu Hanh']) {
      await page.locator('#search').fill(query);
      assert.equal(await page.locator('#list .product-entry').count(), 1);
      assert.equal(await product(page, 'ngu-hanh').count(), 1, 'Vietnamese names are searchable with or without accents');
    }
    for (const query of ['Thiên Kiếm Quy Tông', 'thien kiem quy tong']) {
      await page.locator('#search').fill(query);
      assert.equal(await page.locator('#list .product-entry').count(), 1);
      assert.equal(await product(page, 'kiem-hiep').count(), 1, 'confirmed Premium members are discoverable');
    }
    await page.locator('#search').fill('zz-no-such-vfx');
    assert.equal(await page.locator('#list [data-product-id]').count(), 0);
    assert.match(await page.locator('#list').textContent(), /no .*found|no .*match/i);
    await page.locator('#search').fill('');
    await access(page, 'free').click();
    assert.equal(await page.locator('#list .skill').count(), collection.length);
    assert.equal(await page.locator('#list .product-entry').count(), 0);
    await access(page, 'all').click();

    await page.locator('#loop').check(); await playing(page);
    const directions = [
      ['up-left', -45], ['up', -90], ['up-right', -45], ['left', 0],
      ['right', 0], ['down-left', 45], ['down', 90], ['down-right', 45],
    ];
    for (const [name, direction] of directions) {
      const button = page.getByRole('button', { name: `Cast ${name}`, exact: true });
      await button.click(); await playing(page);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.__showcase.current.manifest.direction ?? 0), direction);
      for (const [device, suffix] of [['desktop', ''], ['mobile', '.m']]) {
        const filename = `hoa-fireball${direction ? '@' + direction : ''}${suffix}.vfxb`;
        assert.equal(await page.locator(`#download-${device}`).getAttribute('download'), filename);
        assert.ok((await page.locator(`#download-${device}`).getAttribute('href')).endsWith('/' + filename));
      }
    }
    await page.locator('.stage-toolbar [data-bg=light]').click();
    const countBeforePremium = requests.length;
    const posterResponse = page.waitForResponse(response => response.url().endsWith('/previews/kiem-hiep/poster.webp'));
    await product(page, 'kiem-hiep').click();
    await expectUpcoming(page, 'Kiếm Hiệp');
    assert.ok((await posterResponse).ok(), 'actual Kiếm Hiệp poster loads');
    assert.deepEqual(videos, [], 'an upcoming teaser is not downloaded before interaction');
    assert.equal(new URL(page.url()).hash, '#product/kiem-hiep');
    assert.equal(requests.length, countBeforePremium, 'selecting Premium does not request a VFX pack');
    assert.equal(await page.evaluate(() => window.__showcase.vfx.stats().packs), 0, 'previous free pack is released');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__showcase.vfx.stats().active), 0, 'Space does not cast a hidden free effect');
    if (process.env.VFX_CATALOG_SCREENSHOT) {
      await expectPosterDecoded(page);
      await page.screenshot({ path: process.env.VFX_CATALOG_SCREENSHOT, fullPage: true });
    }
    await playKiemHiepPreview(page);
    assert.ok(videos.some(request => request.endsWith('/previews/kiem-hiep/preview.mp4')));
    assert.equal(requests.length, countBeforePremium, 'playing a Premium teaser never requests a paid container');

    await page.goBack(); await playing(page);
    await expectVideoReleased(page);
    assert.equal(new URL(page.url()).hash, '#hoa-fireball', 'entering Premium preserves the previous Free history entry');
    await page.goForward(); await expectUpcoming(page, 'Kiếm Hiệp');

    await product(page, 'hoa-fireball').click(); await playing(page);
    assert.equal(await page.locator('#stage').getAttribute('data-bg'), 'light');
    assert.equal(await page.getByRole('button', { name: 'Cast down-right', exact: true }).getAttribute('aria-pressed'), 'true');
    for (const selector of ['.stage-wrap', '.controls', '.actions', '#integration']) {
      assert.equal(await page.locator(selector).isVisible(), true, `${selector} restored for Free`);
    }
    assert.equal(await page.locator('#premium-preview').isVisible(), false);
    assert.match(await page.locator('#product-badge').textContent(), /Free/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goBack(); await expectUpcoming(page, 'Kiếm Hiệp');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobileRequests = [], mobileErrors = [], mobileVideos = [];
  mobile.on('request', request => { if (request.url().endsWith('.vfxb')) mobileRequests.push(request.url()); });
  mobile.on('request', request => { if (/\.(mp4|webm)$/.test(new URL(request.url()).pathname)) mobileVideos.push(request.url()); });
  mobile.on('pageerror', error => mobileErrors.push(error.message));
  try {
    await mobile.goto(`${url}/collection/#product/ngu-hanh`); await ready(mobile);
    await expectUpcoming(mobile, 'Ngũ Hành');
    assert.match(await mobile.locator('#coming-soon-note').textContent(), /^Pack contents,/);
    assert.deepEqual(mobileRequests, [], 'a Premium deep link never downloads a free or premium pack');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await product(mobile, 'kiem-hiep').click(); await expectUpcoming(mobile, 'Kiếm Hiệp');
    assert.deepEqual(mobileVideos, [], 'mobile teaser is not downloaded before interaction');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.VFX_CATALOG_MOBILE_SCREENSHOT) {
      await expectPosterDecoded(mobile);
      await mobile.screenshot({ path: process.env.VFX_CATALOG_MOBILE_SCREENSHOT, fullPage: true });
    }
    await playKiemHiepPreview(mobile);
    assert.deepEqual(mobileRequests, [], 'mobile Premium playback never downloads a VFX pack');
    await access(mobile, 'free').click();
    await mobile.locator('#search').fill('fireball');
    await product(mobile, 'hoa-fireball').click(); await playing(mobile);
    await expectVideoReleased(mobile);
    assert.equal(new URL(mobile.url()).hash, '#hoa-fireball');
    assert.ok(mobileRequests.every(request => request.endsWith('.m.vfxb')));
    assert.equal(await mobile.locator('#stage').isVisible(), true);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.goBack(); await expectUpcoming(mobile, 'Kiếm Hiệp');
    await mobile.locator('#search').fill(''); await access(mobile, 'all').click();
    await product(mobile, 'hoa-fireball').click(); await playing(mobile);
    await product(mobile, 'ultimate-boss').evaluate(node => node.scrollIntoView({ block: 'end', behavior: 'instant' }));
    assert.equal(await mobile.evaluate(() => document.getElementById('library').getBoundingClientRect().top < -innerHeight), true, 'browse the end of the list before selecting Premium');
    await product(mobile, 'ultimate-boss').click(); await expectUpcoming(mobile, 'Ultimate Boss');
    await mobile.waitForFunction(() => ['#selected-name', '#premium-preview'].every(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    }));
    assert.deepEqual(mobileErrors, []);
  } finally { await mobile.close(); }

  // A cancelled free download must stay stopped on Premium and recover on return to the same Free effect.
  for (const returnToFree of [false, true]) {
    const race = await browser.newPage();
    const raceErrors = []; race.on('pageerror', error => raceErrors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    try {
      await race.goto(`${url}/collection/#product/kiem-hiep`); await ready(race);
      await race.route('**/hoa-fireball.vfxb', async route => { await gate; await route.continue(); });
      await race.evaluate(() => {
        document.getElementById('loop').checked = true;
        const vfx = window.__showcase.vfx, load = vfx.load.bind(vfx);
        vfx.load = (...args) => {
          const task = load(...args);
          window.__catalogPendingLoad = task.then(() => undefined, () => undefined);
          return task;
        };
      });
      const requested = race.waitForRequest('**/hoa-fireball.vfxb');
      await product(race, 'hoa-fireball').click(); await requested;
      await product(race, 'ultimate-boss').click();
      if (returnToFree) await product(race, 'hoa-fireball').click();
      release();
      if (returnToFree) {
        await playing(race);
        assert.equal(new URL(race.url()).hash, '#hoa-fireball');
        assert.equal(await race.evaluate(() => window.__showcase.current.manifest.id), 'hoa-fireball');
        assert.equal(await race.evaluate(() => window.__showcase.vfx.stats().packs), 1);
        assert.equal(await race.evaluate(() => window.__showcase.vfx.stats().active), 1);
      } else {
        await race.evaluate(async () => { await window.__catalogPendingLoad; });
        await expectUpcoming(race, 'Ultimate Boss');
        assert.equal(await race.evaluate(() => window.__showcase.vfx.stats().packs), 0);
        assert.equal(new URL(race.url()).hash, '#product/ultimate-boss');
      }
      assert.deepEqual(raceErrors, []);
    } finally { release(); await race.close(); }
  }

  // Test released products without inventing sellable production catalog entries.
  const fixture = await browser.newPage();
  const external = [], fixtureErrors = [], fixturePacks = [];
  fixture.on('pageerror', error => fixtureErrors.push(error.message));
  fixture.on('request', request => { if (request.url().endsWith('.vfxb')) fixturePacks.push(request.url()); });
  try {
    await fixture.route('**/*', route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === new URL(url).origin) return route.continue();
      external.push(requestUrl.href);
      if (requestUrl.href === 'https://media.test/catalog-poster.png') {
        return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64') });
      }
      // All external traffic is intercepted. No store or media server is contacted.
      return route.fulfill({ status: 503, body: 'Unavailable test preview' });
    });
    await fixture.goto(`${url}/catalog-fixture.html`);
    await fixture.waitForFunction(() => window.__catalogFixture);
    assert.match(await fixture.locator('#product-status').textContent(), /Available/i);
    assert.match(await fixture.locator('#product-includes').textContent(), /Test collection contents/);
    assert.match(await fixture.locator('#product-compatibility').textContent(), /Test format compatibility/);
    assert.equal(await fixture.locator('#coming-soon').isVisible(), false);
    assert.equal(await fixture.locator('#purchase-note').isVisible(), true);
    assert.match(await fixture.locator('.preview-caption').textContent(), /Full pack delivered by the store/);
    const links = await fixture.locator('#purchase-links a').evaluateAll(nodes => nodes.map(node => ({
      href: node.href, target: node.target, rel: node.rel, text: node.textContent,
    })));
    assert.deepEqual(links.map(link => link.href), ['https://catalog-fixture.itch.io/view-test', 'https://catalog-fixture.gumroad.com/l/view-test']);
    assert.ok(links.every(link => link.target === '_blank' && /noopener/.test(link.rel) && /noreferrer/.test(link.rel)));
    assert.match(links[0].text, /Buy on itch\.io/); assert.match(links[1].text, /Buy on Gumroad/);
    for (const link of await fixture.locator('#purchase-links a').all()) assert.equal(await link.isVisible(), true);
    const media = await fixture.locator('#premium-preview video').evaluate(video => {
      window.__catalogPreviousVideo = video;
      return { controls: video.controls, autoplay: video.autoplay, preload: video.preload, inline: video.playsInline, src: video.src, poster: video.poster };
    });
    assert.deepEqual(media, { controls: true, autoplay: false, preload: 'none', inline: true, src: 'https://media.test/catalog-preview.webm', poster: 'https://media.test/catalog-poster.png' });
    assert.ok(!external.some(request => request.endsWith('.webm')), 'video is not downloaded before interaction');
    await product(fixture, 'fixture-upcoming').click();
    assert.equal(await fixture.locator('#coming-soon').isVisible(), true);
    assert.match(await fixture.locator('.preview-caption').textContent(), /Collection coming soon/);
    assert.equal(await fixture.locator('#coming-soon-note').textContent(), 'Pricing, license and purchase links will be announced at launch.');
    assert.equal(await fixture.locator('#purchase-links a').count(), 0, 'a prepared store URL stays hidden until release');
    assert.equal(await fixture.locator('a[href="https://catalog-fixture.itch.io/prepared-test"]').count(), 0);
    assert.deepEqual(await fixture.evaluate(() => ({ connected: window.__catalogPreviousVideo.isConnected, src: window.__catalogPreviousVideo.getAttribute('src'), paused: window.__catalogPreviousVideo.paused })), { connected: false, src: null, paused: true });
    await product(fixture, 'fixture-released').click();
    await fixture.locator('#premium-preview video').evaluate(video => { video.preload = 'auto'; video.load(); });
    await fixture.waitForFunction(() => document.querySelector('.preview-caption').textContent.includes('could not load'));
    assert.ok(external.every(request => new URL(request).hostname === 'media.test'), 'store links never trigger requests before purchase');
    assert.deepEqual(fixturePacks, []); assert.deepEqual(fixtureErrors, []);
  } finally { await fixture.close(); }
  console.log('Storefront catalog: PASS (filters/member search, eight directions/downloads, Premium deep links, playback cleanup/race, history, mobile, purchase gating, actual Kiếm Hiệp teaser playback, video controls/error/cleanup)');
}
