# Run inside Blender (Scripting tab -> Run Script) on the scene you render sprites from.
# Prints the numbers to pass to rigFromBlender() / VfxWorld so code-drawn VFX match the
# renders: ground squash, height scale and the baked sun shadow direction.
# Optional: set SPRITE_SCALE to the scale your game draws the rendered frames at.
import bpy
import math
import json
from mathutils import Vector

SPRITE_SCALE = 1.0

scene = bpy.context.scene
cam = scene.camera
if cam is None:
    raise SystemExit("Scene has no active camera")
r = scene.render
size_px = max(r.resolution_x, r.resolution_y) * r.resolution_percentage / 100 * SPRITE_SCALE

rot_x = math.degrees(cam.matrix_world.to_euler("XYZ").x)
ortho = cam.data.ortho_scale if cam.data.type == "ORTHO" else None

out = {
    "camera": {"rotationXDeg": round(rot_x, 3), "orthoScale": ortho, "renderSizePx": size_px},
}
if cam.data.type != "ORTHO":
    out["warning"] = "Perspective camera: orthoScale is estimated at the camera target distance."
    dist = cam.location.length
    out["camera"]["orthoScale"] = round(2 * dist * math.tan(cam.data.angle / 2), 4)

sun = next((o for o in scene.objects if o.type == "LIGHT" and o.data.type == "SUN" and o.visible_get()), None)
if sun:
    d = sun.matrix_world.to_3x3() @ Vector((0, 0, -1))  # direction the light travels
    elev = math.degrees(math.asin(max(-1.0, min(1.0, -d.z))))
    ground = Vector((d.x, d.y, 0))
    if ground.length > 1e-6:
        ground.normalize()
        m = cam.matrix_world.to_3x3()
        right = Vector((m.col[0].x, m.col[0].y, 0)).normalized()
        toward_cam = Vector((m.col[2].x, m.col[2].y, 0)).normalized()  # camera +Z flattened = screen down
        ang = math.degrees(math.atan2(ground.dot(toward_cam), ground.dot(right))) % 360
    else:
        ang = 90.0
    out["sun"] = {"shadowScreenAngleDeg": round(ang, 2), "elevationDeg": round(elev, 2)}
else:
    out["warning_sun"] = "No visible Sun light; shadows of effects will fall straight down."

print(json.dumps(out, indent=2))
