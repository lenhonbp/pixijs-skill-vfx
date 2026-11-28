"""Collect Isometric Props card media and specs from an Isobaker checkout.

Run `npm ci && npm run pages:build` in iso-prop-tile-baker first, then:
  python3 -I hub/scripts/props-media.py /path/to/iso-prop-tile-baker hub
Writes hub/public/media/props/<id>.webp (scene art), <id>-spin.webp (8-facing strip of the
pack's largest prop) and hub/src/data/props-specs.json.
"""
import json, os, shutil, sys
from PIL import Image

iso, hub = sys.argv[1], sys.argv[2]
dist = os.path.join(iso, 'pages-dist')
media = os.path.join(hub, 'public', 'media', 'props')
os.makedirs(media, exist_ok=True)
catalog = json.load(open(os.path.join(dist, 'packs', 'catalog.json')))['packs']
ORDER = ['se', 's', 'sw', 'w', 'nw', 'n', 'ne', 'e']  # clockwise turntable
FRAME = 200  # px per spin frame
# Largest prop by default; steps and tiles read poorly in a turntable, so these packs pick a landmark.
HERO = {'ben-song': 'river-skiff', 'son-mon': 'pass-travel-shrine'}

def atlas_dir(pid):
    return os.path.join(iso, 'demo', 'public', ('ruins' if pid == 'phe-tich' else pid) + '-atlas')

def vram(atlas, planes):
    return sum(p['width'] * p['height'] * 4 for p in atlas['pages'] if p['plane'] in planes)

def coverage(path):
    a = Image.open(path).getchannel('A')
    return sum(a.histogram()[33:])

out = []
for pack in catalog:
    pid = pack['id']
    views = os.path.join(dist, pid, 'media', 'views')
    keys = sorted(os.listdir(views))
    hero = HERO.get(pid) or max(keys, key=lambda k: coverage(os.path.join(views, k, 'se.webp')))
    frames = [Image.open(os.path.join(views, hero, f + '.webp')).convert('RGBA') for f in ORDER]
    box = None
    for f in frames:  # common crop so the ground point stays fixed while turning
        b = f.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    w, h = box[2] - box[0], box[3] - box[1]
    scale = min(FRAME * 0.86 / w, FRAME * 0.86 / h)
    strip = Image.new('RGBA', (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        c = f.crop(box).resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        strip.alpha_composite(c, (i * FRAME + (FRAME - c.width) // 2, (FRAME - c.height) // 2))
    strip.save(os.path.join(media, pid + '-spin.webp'), 'WEBP', quality=82, method=6)
    # Inspector turntable: the native 2x (192 px/tile) bake when the pack ships one, cropped to the union of all
    # eight facings so the ground anchor stays put; loaded only when the preview modal opens.
    detail = os.path.join(dist, pid, 'media', 'detail', hero)
    source, scale = (detail, 2) if os.path.isdir(detail) else (os.path.join(views, hero), 1)
    big = [Image.open(os.path.join(source, f + '.webp')).convert('RGBA') for f in ORDER]
    union = None
    for f in big:
        b2 = f.getbbox()
        union = b2 if union is None else (min(union[0], b2[0]), min(union[1], b2[1]), max(union[2], b2[2]), max(union[3], b2[3]))
    pad = 8
    union = (max(0, union[0] - pad), max(0, union[1] - pad), min(big[0].width, union[2] + pad), min(big[0].height, union[3] + pad))
    tw, th = union[2] - union[0], union[3] - union[1]
    table = Image.new('RGBA', (tw * len(big), th), (0, 0, 0, 0))
    for i, f in enumerate(big):
        table.alpha_composite(f.crop(union), (i * tw, 0))
    table.save(os.path.join(media, pid + '-turntable.webp'), 'WEBP', quality=86, method=6)
    shutil.copyfile(os.path.join(dist, pid, 'media', 'field-scene.webp'), os.path.join(media, pid + '.webp'))
    atlas = json.load(open(os.path.join(atlas_dir(pid), 'atlas.json')))
    names = {a['id']: a.get('name') for a in atlas['assets']} if atlas['assets'] and 'id' in atlas['assets'][0] else {}
    entry = next(a for a in atlas['assets'] if a['asset'] == hero)
    facing = {f['direction']: f['planes']['albedo']['sourceBounds'] for f in entry['frames']}
    compression = {round(a['compression'], 5) for a in atlas['assets']}
    assert compression == {0.57735}, f'{pid}: unexpected projection {compression}'
    out.append({k: pack[k] for k in ('id', 'title', 'en', 'version', 'zip', 'bytes', 'assets', 'directions', 'passes', 'pngSprites', 'atlasPages', 'sha256')}
               | {'turntable': {'w': tw, 'h': th, 'scale': scale}, 'hero': hero, 'heroDims': [[facing[d]['w'], facing[d]['h']] for d in ORDER], 'facings': ORDER, 'compression': 0.57735,
                  'tile': 96, 'vram': vram(atlas, {'albedo', 'shadow'}), 'vramAll': vram(atlas, {'albedo', 'shadow', 'depth', 'normal'})})

# Phố Cổ modular town kit: scene art + its three release receipts.
town = os.path.join(dist, 'pho-co')
shutil.copyfile(os.path.join(town, 'scene.webp'), os.path.join(media, 'pho-co.webp'))
receipts = [json.load(open(os.path.join(town, 'releases', f))) for f in sorted(os.listdir(os.path.join(town, 'releases')))]
starter = next(f for f in os.listdir(town) if f.startswith('co-tran-starter-map-') and f.endswith('.zip'))
# The playable map's runtime atlas (albedo, shadow and roof pages) is what a game keeps resident.
kit_pages = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(town, 'atlas')) for f in fs if f.endswith('.webp')]
kit_vram = sum(w * h * 4 for w, h in (Image.open(f).size for f in kit_pages))
out.append({'id': 'pho-co', 'kit': True, 'vram': kit_vram, 'vramAll': kit_vram, 'assets': sum(r['assets'] for r in receipts), 'directions': 8, 'passes': 4,
            'pngSprites': sum(r['pngSprites'] for r in receipts), 'atlasPages': sum(r['atlasPages'] for r in receipts),
            'zip': starter, 'bytes': os.path.getsize(os.path.join(town, starter)), 'tile': 96,
            'parts': [{'id': r['id'], 'version': r['version'], 'zip': r['zip'], 'bytes': r['bytes'], 'assets': r['assets']} for r in receipts]})
json.dump(out, open(os.path.join(hub, 'src', 'data', 'props-specs.json'), 'w'), indent=1, ensure_ascii=False)
for p in out: print(p['id'], p.get('hero'), p['assets'], p['bytes'], round(p.get('vram', 0) / 1e6, 1), round(p.get('vramAll', 0) / 1e6, 1))
