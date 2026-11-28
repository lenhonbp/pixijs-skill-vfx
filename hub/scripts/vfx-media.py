"""Turn captured showcase frames into VFX card media.

Frames come from scripts/capture-vfx.mjs (one folder per effect: idle.jpg + 000.jpg…, 30 FPS).
  python3 -I hub/scripts/vfx-media.py /path/to/frames hub/public/media/vfx [id ...]
Writes <id>.webp (800×500 poster at the most active frame) and <id>.mp4 (640×400 H.264 loop).
"""
import glob, os, subprocess, sys, tempfile
from PIL import Image, ImageChops, ImageStat

src, out = sys.argv[1], sys.argv[2]
only = set(sys.argv[3:])
os.makedirs(out, exist_ok=True)
POSTER, VIDEO, MAX_FRAMES = (800, 500), (640, 400), 150
# Hand-picked poster frames where the most active frame is not the most readable one
# (dashes and smoke outscore small, crisp details).
PEAK = {'moc-vine-bind': 55, 'kim-golden-edge': 10, 'phong-gale-blade': 10, 'sunder-mark': 10}

def small(path):
    return Image.open(path).convert('RGB').resize((160, 100), Image.BILINEAR)

def activity(frame, idle):
    """Mean change from the idle stage, weighted toward saturated (coloured) light."""
    diff = ImageStat.Stat(ImageChops.difference(frame, idle).convert('L')).mean[0]
    sat = ImageStat.Stat(frame.convert('HSV').getchannel('S')).mean[0]
    return diff * (1 + sat / 255)

for effect in sorted(os.listdir(src)):
    if only and effect not in only:
        continue
    folder = os.path.join(src, effect)
    frames = sorted(glob.glob(os.path.join(folder, '[0-9][0-9][0-9].jpg')))
    if not frames:
        continue
    idle = small(os.path.join(folder, 'idle.jpg'))
    scores = [activity(small(f), idle) for f in frames]
    peak = max(range(len(frames)), key=scores.__getitem__)
    poster = PEAK.get(effect, peak)
    Image.open(frames[poster]).convert('RGB').resize(POSTER, Image.LANCZOS).save(os.path.join(out, effect + '.webp'), 'WEBP', quality=80, method=6)
    # Trim the idle lead-in: start a few frames before the effect first reaches 12% of its peak.
    start = next(i for i, s in enumerate(scores) if s >= 0.12 * scores[peak])
    clip = frames[max(0, start - 6):][:MAX_FRAMES]
    with tempfile.TemporaryDirectory() as tmp:
        for i, f in enumerate(clip):
            os.symlink(os.path.abspath(f), os.path.join(tmp, f'{i:03d}.jpg'))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', os.path.join(tmp, '%03d.jpg'),
                        '-vf', f'scale={VIDEO[0]}:{VIDEO[1]}:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', os.path.join(out, effect + '.mp4')], check=True)
    sizes = [os.path.getsize(os.path.join(out, effect + e)) // 1024 for e in ('.webp', '.mp4')]
    print(f'{effect:26} poster {poster:3} peak {peak:3}/{len(frames)} clip {len(clip):3} fr  poster {sizes[0]} KiB  video {sizes[1]} KiB')

# Hero reel: the busiest 1.6 s of a few effects back to back, one per element family.
REEL = ['hoa-fire-dragon-crossing', 'loi-heaven-strike', 'thuy-glacier-path', 'phong-tornado', 'kim-sword-rain', 'moc-combo-rupture']
if not only or 'reel' in only:
    with tempfile.TemporaryDirectory() as tmp:
        n = 0
        for effect in REEL:
            folder = os.path.join(src, effect)
            frames = sorted(glob.glob(os.path.join(folder, '[0-9][0-9][0-9].jpg')))
            idle = small(os.path.join(folder, 'idle.jpg'))
            scores = [activity(small(f), idle) for f in frames]
            peak = max(range(len(frames)), key=scores.__getitem__)
            first = min(max(0, peak - 22), max(0, len(frames) - 48))
            for f in frames[first:first + 48]:
                os.symlink(os.path.abspath(f), os.path.join(tmp, f'{n:04d}.jpg')); n += 1
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', os.path.join(tmp, '%04d.jpg'),
                        '-vf', f'scale={VIDEO[0]}:{VIDEO[1]}:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', os.path.join(out, 'reel.mp4')], check=True)
    print(f'reel {n} frames {os.path.getsize(os.path.join(out, "reel.mp4")) // 1024} KiB')
