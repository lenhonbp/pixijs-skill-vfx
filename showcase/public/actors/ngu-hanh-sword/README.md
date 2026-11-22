# Son Ha Kiem Khi: showcase caster

One male Thai Nhac Kiem Tong swordsman from Ngu Hanh Giang Ho, facing
southeast and performing the game's first sword skill (`art-wudang-0`).
This is a flattened export of the game's native 3D-rendered character, not
a rig or a VFX pack. The cast contains no baked projectile, glow or shadow.

Load `son-ha-kiem-khi-se.json` as a Pixi spritesheet; its sibling lossless
WebP supplies the image. Use `sheet.animations['son-ha-kiem-khi-se']` for
the 24 textures. Keep the sprite at the same world position throughout the
cast, and set its anchor to the first texture's `defaultAnchor`.

Sample frame `Math.round(Math.min(1, Math.max(0, elapsedMs / 680)) * 23)`.
Fire the release cue **once when elapsed time crosses 270 ms**, not whenever
frame 9 is visible. The atlas JSON's `clip.socketsPx[frame]` contains `handR`
and `swordTip` in pixels from the frame's top left (+x right, +y down).
To launch from the blade, subtract `clip.pivotPx` from `swordTip` before
transforming that point from sprite-local coordinates to the effect layer.
Stop at frame 23; frame 0 can be held when waiting for the next cast.

Character artwork (c) 2026 lenhonbp. Published for display in this showcase;
the repository's MIT code licence does not apply to this character artwork.
