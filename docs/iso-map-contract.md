# Isometric map contract (Isobaker props + lenhon-vfx packs)

This page sets out what an Isobaker atlas and a lenhon-vfx pack share, so effects line up with props and tiles in one
PixiJS scene. `scripts/check-docs.mjs` checks the constants below against the runtime.

| Quantity | Value | Isobaker | lenhon-vfx |
| --- | --- | --- | --- |
| Camera | orthographic, pitch 35.26439° (`atan(1/√2)`), yaw 45° | `pitchDeg`, `compression` in `atlas.json` | baked camera of every Free pack |
| Ground squash (ground y / screen y) | `1/√3` = 0.5773502691896258 | diamond `h/w`, `tile.h = tile.w / √3` | `ISO_GROUND_SQUASH`, `manifest.groundSquash`, `ground_projection.squash` |
| Ground anchor | `feet_ground`, the ground-contact point | per-frame `feet_ground` (source px) | `anchors.points.*.feet_ground`; `ground_projection.anchor` |
| Screen axes | +x right, +y down, height subtracts from y | same | same |

## Placing an effect on a map

1. Project both actors to screen with the Isobaker frame's `basis` for the current map facing. Let `groundScreen` be
   the screen point of each actor's (or prop's) `feet_ground`.
2. Pass these points as `play(id, { from, to })`. Do not pre-squash or rotate them: the runtime picks the baked
   direction from the screen vector `(dx, dy / groundSquash)`, so the map facing (`se e ne n nw w sw s`) changes the
   direction only through the screen positions.
3. Leave `groundSquash` unset (or pass `ISO_GROUND_SQUASH`). A different value turns ground decals into sheared
   ellipses that no longer match the tiles.
4. Match sizes with the `parent` container's scale: `actorHeightOnMapPx / anchors.heights.caster`. Isobaker sizes are
   in tile units (96 px per tile at 1×), and pack px are the bake's unit heights. `from` and `to` are read in `parent`'s
   local space, so divide the screen points by that scale (or use `parent.toLocal`).
5. To emit from a prop socket (`socket_fx`, `socket_flame`, ...), use `groundScreen + socketOffsets[name]` for the
   current facing. A socket offset already includes the socket's height, so add no lift.

## Depth

Isobaker orders props and actors by ground position (`IsoDepthLayer`; `depthOffsetPx` is a painter-order bias).
`play()` draws a pack's floor decals (`default_z_layer: 'background'`) in a root at `zIndex - 1` under the pack. To keep
them under every prop and actor, pass a container below the Isobaker depth layer as `layers: { background }`. Give the
pack root a `zIndex` in the same sorted container as the actor it hits, so foreground walls and roofs still cover it.
