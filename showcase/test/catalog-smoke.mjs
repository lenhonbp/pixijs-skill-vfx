// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — MIT
import assert from 'node:assert/strict';

const product = (page, id) => page.locator(`#list [data-product-id="${id}"]`);
const access = (page, tier) => page.locator(`#catalog-access [data-access="${tier}"]`);
const ready = page => page.waitForFunction(() => window.__showcase);
const playing = (page, id = null) => page.waitForFunction(expected =>
  document.getElementById('status').textContent.startsWith('Playing') &&
  (!expected || window.__showcase.current?.manifest.id === expected), id);

function observePublicRequests(page) {
  const result = { packs: [], unexpected: [], errors: [] };
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('request', request => {
    const address = new URL(request.url()), path = address.pathname;
    if (path.endsWith('.vfxb')) {
      result.packs.push(path);
      if (!path.startsWith('/collection/packs/free/')) result.unexpected.push(address.href);
    }
    if (path.includes('/previews/') || /\.(mp4|webm)$/.test(path) || /(?:^|\.)(?:itch\.io|gumroad\.com)$/.test(address.hostname)) {
      result.unexpected.push(address.href);
    }
  });
  return result;
}

async function expectFreeCatalog(page, collection) {
  assert.equal(collection.length, 25);
  assert.deepEqual(await page.locator('#list .skill').evaluateAll(nodes => nodes.map(node => node.dataset.productId).sort()), collection.map(pack => pack.id).sort());
  assert.equal(await page.locator('#list .product-entry, #premium-grid > *, #purchase-links a, video').count(), 0);
  assert.equal(await page.locator('a[href*="itch.io/"], a[href*="gumroad.com/"]').count(), 0);
  for (const selector of ['#catalog-access', '#collection-filter', 'label[for="collection-filter"]', '#premium-preview', '#premium-actions']) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} is unnecessary for the Free library`);
  }
  assert.equal(await page.locator('#catalog-count').textContent(), '25 effects · All free');
  assert.match(await page.locator('#product-badge').textContent(), /Free/i);
  assert.match(await page.locator('#product-status').textContent(), /Available/i);
  assert.match(await page.locator('#product-includes').textContent(), /\.vfxb/);
  assert.match(await page.locator('#product-compatibility').textContent(), /PixiJS/);
}

async function expectPreviewInViewport(page) {
  await page.waitForFunction(() => ['#selected-name', '#stage', '#aim', '.stage-toolbar', '#replay'].every(selector => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top >= -1 && box.bottom <= innerHeight + 1 && box.left >= -1 && box.right <= innerWidth + 1;
  }));
}

async function browseMobile(page) {
  // The library sits right under the pinned preview and flows with the page: one scroll, not two.
  await page.locator('#search').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const dock = document.querySelector('.dock').getBoundingClientRect(), search = document.getElementById('search').getBoundingClientRect(), list = document.getElementById('list').getBoundingClientRect();
    return dock.top >= -1 && search.top >= dock.bottom - 1 && search.bottom <= innerHeight && list.top < innerHeight;
  });
  assert.equal(await page.locator('#list').evaluate(node => node.scrollHeight <= node.clientHeight + 1), true, 'the library flows with the page on mobile instead of scrolling inside itself');
}

export async function catalogSmoke({ browser, url, collection }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const desktop = observePublicRequests(page);
  try {
    // Previously shared Premium URLs must fall back to an available Free effect.
    await page.goto(`${url}/collection/#product/kiem-hiep`); await ready(page);
    assert.equal(new URL(page.url()).hash, '#hoa-fireball');
    assert.equal(await page.evaluate(() => history.length), 2, 'an obsolete product route is replaced rather than adding a navigation entry');
    assert.deepEqual(desktop.packs, ['/collection/packs/free/hoa-fireball.vfxb']);
    await expectFreeCatalog(page, collection);

    const fire = collection.filter(pack => pack.element === 'hoa');
    await page.locator('#filters [data-element="hoa"]').click();
    assert.deepEqual(await page.locator('#list .skill').evaluateAll(nodes => nodes.map(node => node.dataset.productId).sort()), fire.map(pack => pack.id).sort());
    assert.equal(await page.locator('#catalog-count').textContent(), `${fire.length} of 25 effects`);
    assert.equal(await page.locator('#filters [data-element="hoa"]').getAttribute('aria-pressed'), 'true');
    for (const query of ['Fireball', 'Hỏa Cầu Thuật', 'hoa cau thuat']) {
      await page.locator('#search').fill(query);
      assert.equal(await page.locator('#list .skill').count(), 1);
      assert.equal(await product(page, 'hoa-fireball').count(), 1, 'English and Vietnamese names work with or without accents');
    }
    await page.locator('#search').fill('zz-no-such-vfx');
    assert.equal(await page.locator('#list [data-product-id]').count(), 0);
    assert.match(await page.locator('#list').textContent(), /No effects found/);
    assert.equal(await page.locator('#catalog-count').textContent(), '0 of 25 effects');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    assert.equal(await page.locator('#search').inputValue(), '');
    assert.equal(await page.locator('#filters [data-element="all"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#search').evaluate(node => node === document.activeElement), true);
    await expectFreeCatalog(page, collection);
    assert.equal(desktop.packs.length, 1, 'searching and filtering do not download other effects');

    await page.locator('#loop').check(); await playing(page, 'hoa-fireball');
    const directions = [
      ['up-left', -45], ['up', -90], ['up-right', -45], ['left', 0],
      ['right', 0], ['down-left', 45], ['down', 90], ['down-right', 45],
    ];
    for (const [name, direction] of directions) {
      const button = page.getByRole('button', { name: `Cast ${name}`, exact: true });
      await button.click(); await playing(page, 'hoa-fireball');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.__showcase.current.manifest.direction ?? 0), direction);
      for (const [device, suffix] of [['desktop', ''], ['mobile', '.m']]) {
        const filename = `hoa-fireball${direction ? '@' + direction : ''}${suffix}.vfxb`;
        assert.equal(await page.locator(`#download-${device}`).getAttribute('download'), filename);
        assert.ok((await page.locator(`#download-${device}`).getAttribute('href')).endsWith('/' + filename));
      }
    }
    await page.locator('.stage-toolbar [data-bg=light]').click();
    await product(page, 'thuy-frost-nova').click(); await playing(page, 'thuy-frost-nova');
    assert.equal(await page.evaluate(() => window.__showcase.vfx.stats().packs), 1, 'switching effects releases the previous pack');
    await page.goBack(); await playing(page, 'hoa-fireball');
    assert.equal(new URL(page.url()).hash, '#hoa-fireball');
    await page.goForward(); await playing(page, 'thuy-frost-nova');
    assert.equal(new URL(page.url()).hash, '#thuy-frost-nova');
    await product(page, 'hoa-fireball').click(); await playing(page, 'hoa-fireball');
    assert.equal(await product(page, 'hoa-fireball').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#stage').getAttribute('data-bg'), 'light');
    assert.equal(await page.getByRole('button', { name: 'Cast down-right', exact: true }).getAttribute('aria-pressed'), 'true');
    for (const selector of ['.stage-wrap', '.controls', '.actions', '#integration']) assert.equal(await page.locator(selector).isVisible(), true);
    assert.equal(await page.evaluate(() => window.__showcase.vfx.stats().active), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.locator('.stage-toolbar [data-bg=stage]').click();
    await page.getByRole('button', { name: 'Cast right', exact: true }).click(); await playing(page, 'hoa-fireball');
    if (process.env.VFX_CATALOG_SCREENSHOT) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: process.env.VFX_CATALOG_SCREENSHOT, fullPage: true });
      console.log(`Free library desktop screenshot: ${process.env.VFX_CATALOG_SCREENSHOT}`);
    }
    assert.deepEqual(desktop.unexpected, [], 'the public library never requests Premium media, checkout or paid containers');
    assert.deepEqual(desktop.errors, []);
  } finally { await page.close(); }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobileTraffic = observePublicRequests(mobile);
  try {
    await mobile.goto(`${url}/collection/#hoa-fireball`); await ready(mobile);
    await expectFreeCatalog(mobile, collection);
    assert.deepEqual(mobileTraffic.packs, ['/collection/packs/free/hoa-fireball.m.vfxb']);
    await mobile.locator('#loop').check(); await playing(mobile, 'hoa-fireball');
    await browseMobile(mobile);
    await mobile.locator('#search').fill('bang phong toa');
    assert.equal(await mobile.locator('#list .skill').count(), 1);
    await product(mobile, 'thuy-frost-nova').click(); await playing(mobile, 'thuy-frost-nova');
    await expectPreviewInViewport(mobile);
    assert.equal(await product(mobile, 'thuy-frost-nova').getAttribute('aria-pressed'), 'true');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.VFX_CATALOG_MOBILE_SCREENSHOT) {
      await mobile.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await mobile.screenshot({ path: process.env.VFX_CATALOG_MOBILE_SCREENSHOT, fullPage: true });
      console.log(`Free library mobile search screenshot: ${process.env.VFX_CATALOG_MOBILE_SCREENSHOT}`);
    }
    await mobile.locator('#search').fill('zz-no-such-vfx');
    await mobile.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expectFreeCatalog(mobile, collection);
    // The preview is pinned to the top: choosing an entry near the end of the list leaves the page where it is, and the chosen effect plays in view.
    await product(mobile, 'curse-weaken').scrollIntoViewIfNeeded();
    const scrolledTo = await mobile.evaluate(() => scrollY);
    await product(mobile, 'curse-weaken').click(); await playing(mobile, 'curse-weaken');
    await expectPreviewInViewport(mobile);
    assert.ok(Math.abs(await mobile.evaluate(() => scrollY) - scrolledTo) < 40, 'choosing an entry does not move the page');
    assert.equal(await mobile.evaluate(() => getComputedStyle(document.querySelector('.dock')).position), 'sticky');
    assert.equal(await mobile.locator('#selected-name').textContent(), collection.find(pack => pack.id === 'curse-weaken').name.en);

    // Two-column cards and the compact preview toolbar must also work on a narrow phone.
    await mobile.setViewportSize({ width: 360, height: 740 });
    await browseMobile(mobile);
    await product(mobile, 'hoa-fireball').click(); await playing(mobile, 'hoa-fireball');
    await expectPreviewInViewport(mobile);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // A short landscape viewport must keep a usable canvas and scrollable controls.
    await mobile.setViewportSize({ width: 844, height: 390 });
    const landscape = await mobile.evaluate(() => {
      const stage = document.getElementById('stage').getBoundingClientRect(), viewer = document.querySelector('.viewer').getBoundingClientRect();
      return { width: stage.width, height: stage.height, viewerWidth: viewer.width, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(landscape.width >= landscape.viewerWidth / 2 && landscape.height >= landscape.width / 2, `landscape preview retains a usable area: ${JSON.stringify(landscape)}`);
    assert.equal(landscape.overflow, false);
    await mobile.locator('#replay').click(); await playing(mobile, 'hoa-fireball');
    for (const selector of ['#replay', '#download-kit']) {
      await mobile.locator(selector).click({ trial: true });
      assert.equal(await mobile.locator(selector).evaluate(node => {
        const box = node.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      }), true, `${selector} remains reachable by normal scrolling in landscape`);
    }
    assert.ok(mobileTraffic.packs.every(path => path.endsWith('.m.vfxb')));
    assert.deepEqual(mobileTraffic.unexpected, []);
    assert.deepEqual(mobileTraffic.errors, []);
  } finally { await mobile.close(); }

  // A late download must not replace a newer selection; returning to that same pack must recover.
  for (const returnToPending of [false, true]) {
    const race = await browser.newPage();
    const raceErrors = []; race.on('pageerror', error => raceErrors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    try {
      await race.goto(`${url}/collection/#thuy-frost-nova`); await ready(race);
      await race.locator('#loop').check(); await playing(race, 'thuy-frost-nova');
      await race.route('**/hoa-fireball.vfxb', async route => { await gate; await route.continue(); });
      await race.evaluate(() => {
        const vfx = window.__showcase.vfx, load = vfx.load.bind(vfx);
        window.__catalogPendingLoads = [];
        vfx.load = (...args) => {
          const task = load(...args);
          if (String(args[0]).endsWith('/hoa-fireball.vfxb')) window.__catalogPendingLoads.push(task.then(() => undefined, () => undefined));
          return task;
        };
      });
      const requested = race.waitForRequest('**/hoa-fireball.vfxb');
      await product(race, 'hoa-fireball').click(); await requested;
      await product(race, 'thuy-frost-nova').click(); await playing(race, 'thuy-frost-nova');
      if (returnToPending) await product(race, 'hoa-fireball').click();
      release();
      const expected = returnToPending ? 'hoa-fireball' : 'thuy-frost-nova';
      await race.evaluate(async () => { await Promise.all(window.__catalogPendingLoads); });
      await playing(race, expected);
      assert.equal(new URL(race.url()).hash, `#${expected}`);
      assert.equal(await race.evaluate(() => window.__showcase.vfx.stats().packs), 1);
      assert.equal(await race.evaluate(() => window.__showcase.vfx.stats().active), 1);
      assert.deepEqual(raceErrors, []);
    } finally { release(); await race.close(); }
  }

  // Future Premium behavior uses synthetic fixtures, with no sellable production entries.
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
    assert.equal(await fixture.locator('#catalog-access').isVisible(), true);
    assert.equal(await fixture.locator('#collection-filter').isVisible(), true);
    await access(fixture, 'premium').click();
    await fixture.locator('#collection-filter').selectOption('fixture-upcoming-collection');
    assert.equal(await fixture.locator('#list .product-entry').count(), 2);
    await fixture.locator('#search').fill('confirmed upcoming test effect');
    assert.equal(await product(fixture, 'fixture-upcoming').count(), 1, 'future collection members are searchable');
    assert.equal(await fixture.locator('#list .product-entry').count(), 1);
    await fixture.locator('#search').fill('');
    await fixture.locator('#collection-filter').selectOption('all');
    assert.match(await fixture.locator('#product-status').textContent(), /Available/i);
    assert.match(await fixture.locator('#product-includes').textContent(), /Test collection contents/);
    assert.match(await fixture.locator('#product-compatibility').textContent(), /Test format compatibility/);
    for (const selector of ['.stage-wrap', '.controls', '.actions', '#integration']) assert.equal(await fixture.locator(selector).evaluate(node => node.hidden), true);
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
    await product(fixture, 'fixture-no-preview').click();
    assert.equal(await fixture.locator('#premium-preview video, #purchase-links a').count(), 0);
    assert.match(await fixture.locator('#premium-preview').textContent(), /Preview coming soon/);
    assert.equal(await fixture.locator('#coming-soon-note').textContent(), 'Pack contents, pricing and purchase links will be announced at launch.');
    await product(fixture, 'fixture-released').click();
    await fixture.locator('#premium-preview video').evaluate(video => { video.preload = 'auto'; video.load(); });
    await fixture.waitForFunction(() => document.querySelector('.preview-caption').textContent.includes('could not load'));
    assert.ok(external.every(request => new URL(request).hostname === 'media.test'), 'store links never trigger requests before purchase');
    assert.deepEqual(fixturePacks, []); assert.deepEqual(fixtureErrors, []);
  } finally { await fixture.close(); }
  console.log('Storefront catalog: PASS (25 Free effects, search/filters/reset, eight directions/downloads, history, cancelled loads, mobile browse/selection at 390 and 360, short landscape controls, no public Premium requests, synthetic purchase/video/error/cleanup gates)');
}
