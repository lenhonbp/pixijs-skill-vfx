"""Turn captured showcase frames into VFX card media.

Frames come from hub/scripts/capture-vfx.mjs: one folder per effect with idle.jpg (the empty stage) and
000.jpg… (30 FPS), each the whole canvas with no caster, dummy or floor, so only the effect differs from idle.
  python3 -I hub/scripts/vfx-media.py /path/to/frames hub/public/media/vfx [id ... | reel]
Writes <id>.webp (800×500 poster at the busiest frame), <id>.mp4 (640×400 H.264 loop) and reel.mp4.

Framing is automatic and shared by the poster and the clip, so hovering never jumps. Each frame's difference
from idle is summed into an energy image over the effect's main body (the frames at least 25% as active as the
busiest one); the 16:10 window is centred on its centre of mass and sized to hold the 1st to 99th percentile of
that energy on both axes, with padding. A cast flash at the caster, a faint tail or a few far sparks therefore
do not drag the frame away from where the effect mostly lives. The window is never tighter than 40% of the
canvas width, so a small effect is not blown up past recognition.
"""
import glob, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
only = set(sys.argv[3:])
os.makedirs(out, exist_ok=True)
POSTER, VIDEO, MAX_FRAMES, SCALE = (800, 500), (640, 400), 150, 4
THRESHOLD, PAD, MIN_WIDTH, ASPECT, TAIL, BODY = 18, 1.2, 0.40, 1.6, 0.01, 0.25
# Poster frame per effect, chosen by eye from a contact sheet of each effect's whole run: the moment it is fully
# formed and reads best at thumbnail size (a bolt at full length, the dragon's whole S-curve, the cracked bell...).
# An effect missing here falls back to the busiest frame that sits near the middle of its window.
PEAK = {
    'curse-weaken': 46, 'hoa-dragon-breath': 37, 'hoa-fire-dragon-crossing': 29, 'hoa-fireball': 28,
    'hoa-heaven-fire': 32, 'kim-golden-bell': 44, 'kim-golden-edge': 14, 'kim-sword-rain': 53,
    'lightning-chain': 10, 'loi-heaven-strike': 19, 'loi-thunder-domain': 25, 'moc-combo-bind': 42,
    'moc-combo-rupture': 28, 'moc-combo-spores': 24, 'moc-spring-bloom': 25, 'moc-toxic-spores': 40,
    'moc-vine-bind': 53, 'phong-gale-blade': 12, 'phong-tailwind': 40, 'phong-tornado': 38,
    'phong-whirlwind': 34, 'seal-silence': 35, 'sunder-mark': 23, 'tho-fissure': 30,
    'tho-stone-skin': 32, 'thuy-frost-nova': 21, 'thuy-glacier-path': 41, 'war-cry': 17,
}
# Small effects whose travelling parts would make the automatic window far too wide are framed on their poster
# frame instead: (frame, window width as a fraction of the canvas), shared by poster and clip.
FOCUS = {'phong-gale-blade': (12, 0.50), 'sunder-mark': (23, 0.50), 'moc-vine-bind': (53, 0.34)}
# Hero reel: the busiest ~1.6 s of a few effects back to back, one per element family.
REEL = ['hoa-fire-dragon-crossing', 'loi-heaven-strike', 'thuy-glacier-path', 'phong-tornado', 'kim-sword-rain', 'moc-combo-rupture']

def small(path):
    im = Image.open(path).convert('RGB')
    return np.asarray(im.resize((im.width // SCALE, im.height // SCALE), Image.BILINEAR), dtype=np.int16)

def analyse(effect):
    folder = os.path.join(src, effect)
    frames = sorted(glob.glob(os.path.join(folder, '[0-9][0-9][0-9].jpg')))
    if not frames:
        return None
    idle_path = os.path.join(folder, 'idle.jpg')
    idle = small(idle_path)
    diffs = [np.abs(small(f) - idle).mean(axis=2) for f in frames]
    overall = [float(d.mean()) for d in diffs]
    energy = np.zeros(idle.shape[:2], dtype=np.float64)
    for d, v in zip(diffs, overall):
        if v >= BODY * max(overall):
            energy += np.clip(d - THRESHOLD, 0, None)
    W, H = Image.open(idle_path).size
    total = energy.sum()
    if total <= 0:
        cx_, cy_, hx, hy = W / 2, H / 2, W / 2, H / 2
    else:
        def axis(marginal):
            """Centre of mass and the half-extent that holds the central 1 - 2 * TAIL of the energy."""
            cdf = np.cumsum(marginal) / marginal.sum()
            centre = float((np.arange(len(marginal)) + 0.5) @ marginal / marginal.sum())
            lo, hi = int(np.searchsorted(cdf, TAIL)), int(np.searchsorted(cdf, 1 - TAIL)) + 1
            return centre * SCALE, max(centre - lo, hi - centre) * SCALE
        cx_, hx = axis(energy.sum(axis=0))
        cy_, hy = axis(energy.sum(axis=1))
    cw = min(max(2 * hx * PAD, 2 * hy * PAD * ASPECT, MIN_WIDTH * W), min(W, H * ASPECT))
    ch = cw / ASPECT
    cx = min(max(cx_ - cw / 2, 0), W - cw)
    cy = min(max(cy_ - ch / 2, 0), H - ch)
    if effect in FOCUS:
        index, fraction = FOCUS[effect]
        e = np.clip(diffs[index] - THRESHOLD, 0, None)
        fx = float((np.arange(e.shape[1]) + 0.5) @ e.sum(axis=0) / e.sum()) * SCALE
        fy = float((np.arange(e.shape[0]) + 0.5) @ e.sum(axis=1) / e.sum()) * SCALE
        cw = fraction * W
        ch = cw / ASPECT
        cx, cy = min(max(fx - cw / 2, 0), W - cw), min(max(fy - ch / 2, 0), H - ch)
    crop = (round(cx), round(cy), round(cx + cw), round(cy + ch))
    box = crop
    # Activity inside the crop, from the same difference images.
    x0, y0, x1, y1 = (v // SCALE for v in crop)
    activity = [float(d[y0:y1, x0:x1].mean()) for d in diffs]
    # How far each frame's own centre of mass sits from the window centre (0 = centred, 1 = at the edge).
    off = []
    for d in diffs:
        e = np.clip(d - THRESHOLD, 0, None)
        t = e.sum()
        if t <= 0:
            off.append(1.0)
            continue
        fx = float((np.arange(e.shape[1]) + 0.5) @ e.sum(axis=0) / t) * SCALE
        fy = float((np.arange(e.shape[0]) + 0.5) @ e.sum(axis=1) / t) * SCALE
        off.append(min(1.0, float(np.hypot((fx - (crop[0] + crop[2]) / 2) / ((crop[2] - crop[0]) / 2), (fy - (crop[1] + crop[3]) / 2) / ((crop[3] - crop[1]) / 2)))))
    return {'frames': frames, 'crop': crop, 'activity': activity, 'off': off, 'box': box, 'size': (W, H)}

def encode(frames_dir, target):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', os.path.join(frames_dir, '%04d.jpg'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', target], check=True)

def framed(path, crop):
    return Image.open(path).convert('RGB').crop(crop).resize(VIDEO, Image.LANCZOS)

for effect in sorted(os.listdir(src)):
    if (only and effect not in only) or effect == 'reel':
        continue
    a = analyse(effect)
    if not a:
        continue
    act = a['activity']
    peak = max(range(len(act)), key=act.__getitem__)
    # Poster: busy and centred (activity, discounted by up to half when the effect sits at the window edge).
    centred = max(range(len(act)), key=lambda i: act[i] * (1 - 0.5 * a['off'][i]))
    poster = PEAK.get(effect, centred)
    Image.open(a['frames'][poster]).convert('RGB').crop(a['crop']).resize(POSTER, Image.LANCZOS).save(os.path.join(out, effect + '.webp'), 'WEBP', quality=80, method=6)
    # Trim the empty lead-in and tail: from just before the effect reaches 12% of its peak to just after it falls below 4%.
    start = next(i for i, v in enumerate(act) if v >= 0.12 * act[peak])
    end = max(i for i, v in enumerate(act) if v >= 0.04 * act[peak])
    lo, hi = max(0, start - 6), min(len(act), end + 7)
    clip = a['frames'][lo:hi][:MAX_FRAMES]
    with tempfile.TemporaryDirectory() as tmp:
        for i, f in enumerate(clip):
            framed(f, a['crop']).save(os.path.join(tmp, f'{i:04d}.jpg'), quality=90)
        encode(tmp, os.path.join(out, effect + '.mp4'))
    sizes = [os.path.getsize(os.path.join(out, effect + e)) // 1024 for e in ('.webp', '.mp4')]
    w = a['crop'][2] - a['crop'][0]
    print(f'{effect:26} poster {poster:3}/{len(act)} clip {lo}-{hi} ({len(clip)} fr) window {w // 2}px  poster {sizes[0]} KiB  video {sizes[1]} KiB')

if not only or 'reel' in only:
    with tempfile.TemporaryDirectory() as tmp:
        n = 0
        for effect in REEL:
            a = analyse(effect)
            peak = max(range(len(a['activity'])), key=a['activity'].__getitem__)
            first = min(max(0, peak - 22), max(0, len(a['frames']) - 48))
            for f in a['frames'][first:first + 48]:
                framed(f, a['crop']).save(os.path.join(tmp, f'{n:04d}.jpg'), quality=90)
                n += 1
        encode(tmp, os.path.join(out, 'reel.mp4'))
    print(f'reel {n} frames {os.path.getsize(os.path.join(out, "reel.mp4")) // 1024} KiB')
