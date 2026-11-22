# PixiJS v7 vs v8 for VFX code

The kit runs on both (tested on 7.4.3 and 8.23.0). When you write code outside the kit, check
the game's version and use the right column.

| Topic | v7 | v8 |
|---|---|---|
| App setup | `new Application({ width, height, backgroundColor })`, canvas is `app.view` | `const app = new Application(); await app.init({ width, height, background })`, canvas is `app.canvas` |
| Blend modes | `sprite.blendMode = BLEND_MODES.ADD` (number) | `sprite.blendMode = 'add'` (string). Modes other than normal/add/multiply/screen need `import 'pixi.js/advanced-blend-modes'` |
| Graphics | `g.beginFill(c, a).drawCircle(x, y, r).endFill()`, `g.lineStyle(w, c)` | `g.circle(x, y, r).fill({ color, alpha })`, `g.stroke({ width, color })` |
| Graphics to texture | `renderer.generateTexture(g)` | `renderer.generateTexture(g)` (or `{ target: g }`) |
| Ticker callback arg | `delta` (frames, ~1 at 60 fps) | the `Ticker`; use `ticker.deltaMS` |
| Both | `app.ticker.deltaMS` is ms in both. Use it. | |
| Ropes / trails | `SimpleRope` | `MeshRope` |
| Particles | `ParticleContainer` holds Sprites | `ParticleContainer` holds `Particle` objects (not Sprites), different API |
| Filters | `new BlurFilter(8)` | `new BlurFilter({ strength: 8 })` |
| Texture from canvas | `Texture.from(canvas)` | `Texture.from(canvas)` |
| Tint / alpha / skew / anchor / zIndex / sortableChildren | same | same |

Common breakages when copying VFX snippets from the internet:

- Old snippets use `PIXI.Loader`, `beginFill`, `BLEND_MODES` (v6/v7) or `Assets`, `.fill()` (v8):
  translate to the game's version instead of adding a second Pixi.
- Redrawing a `Graphics` every frame (`clear()` + draw) is slow on v7 and v8; bake to a texture
  or use sprites.
- Tinting to white does not brighten a sprite (tint multiplies). For a white hit flash use an
  additive copy (`hitFlash`) or a `ColorMatrixFilter` on the unit (not per particle).

For reactions on the actual character texture, use [hitSkin and rockBack](extending.md#element-hit-skins-and-rock-back).
They preserve material detail and restore the original tint/pivot; `hitFlash` remains
a separate additive-overlay option.
