// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export async function checkFireDragon(browser) {
  const { outputFiles: [bundle] } = await build({
    stdin: {
      contents: "export { SKILLS } from './examples/skills'; export { VfxWorld, createVfxTextures } from './kit'; export { Container, Sprite } from 'pixi.js';",
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    bundle: true, write: false, format: 'iife', globalName: 'dragonTest', platform: 'browser',
  });
  const page = await browser.newPage();
  try {
    await page.addScriptTag({ content: bundle.text });
    const casts = await page.evaluate(() => {
      const { SKILLS, VfxWorld, createVfxTextures, Container, Sprite } = dragonTest;
      const unit = (x, y) => ({ feet: { x, y, z: 0 }, height: 96, facing: 1, sprite: new Sprite() });
      const tex = createVfxTextures();
      const skill = SKILLS.find((s) => s.id === 'hoa-fire-dragon-crossing');
      return [16, 50].map((step) => {
        const w = new VfxWorld({ ...VfxWorld.createLayers(new Container()), groundSquash: 0.5, seed: 12345 });
        const caster = unit(330, 410);
        const targets = [unit(790, 405), unit(900, 330), unit(905, 490)];
        const hits = [[], [], []];
        skill.cast({
          w, tex, caster, target: targets[0], targets,
          hurt: (u, amount) => hits[targets.indexOf(u)].push({ amount, time: w.now }),
          setVisible() {}, returnHome() {},
        });
        for (let t = 0; t < 5300; t += step) w.update(step);
        return { step, hits };
      });
    });
    for (const { step, hits } of casts) {
      const [middle, upper, lower] = hits;
      assert.deepEqual(hits.map((target) => target.map(({ amount }) => amount)),
        [[156, 13, 13, 13], [], [108, 13, 13, 13]], `dragon damage at ${step} ms steps`);
      assert(middle[0].time < lower[0].time, 'the visible dragon reaches the middle target first');
      assert(lower[0].time < 1400, 'the lower target should already be burning as the dragon exits');
      console.log(`Dragon contacts (${step} ms steps): middle ${middle[0].time} ms, lower ${lower[0].time} ms, upper untouched; three burn ticks each`);
    }
  } finally {
    await page.close();
  }
}
