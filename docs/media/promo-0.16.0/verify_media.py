"""Inspect ISO BMFF metadata without installing a media package."""
import hashlib
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parent
movie = root / 'Screen-and-File-QA-0.16.0-45s.mp4'
data = movie.read_bytes()

def u32(p):
    return struct.unpack_from('>I', data, p)[0]

def boxes(start, end):
    p = start
    while p + 8 <= end:
        size, kind = u32(p), data[p+4:p+8].decode('ascii', errors='replace')
        header = 8
        if size == 1:
            size = struct.unpack_from('>Q', data, p+8)[0]
            header = 16
        elif size == 0:
            size = end - p
        if size < header or p + size > end:
            raise ValueError(f'Invalid {kind} box at {p}')
        yield kind, p + header, p + size
        p += size

def descend(start, end):
    for kind, a, b in boxes(start, end):
        yield kind, a, b
        if kind in {'moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf'}:
            yield from descend(a, b)

all_boxes = list(descend(0, len(data)))
info = {'file': movie.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'container': 'MP4', 'audio_tracks': 0}
defaults = {}
timescale = None
duration = 0
samples = 0
for kind, a, b in all_boxes:
    if kind == 'ftyp':
        info['major_brand'] = data[a:a+4].decode('ascii')
    if kind == 'hdlr' and data[a+8:a+12] == b'soun':
        info['audio_tracks'] += 1
    if kind == 'tkhd':
        info['width'] = u32(b-8) / 65536
        info['height'] = u32(b-4) / 65536
    if kind == 'mdhd':
        offset = 20 if data[a] == 1 else 12
        timescale = u32(a+offset)
    if kind == 'stsd':
        info['codec'] = data[a+12:a+16].decode('ascii')
    if kind == 'trex':
        defaults[u32(a+4)] = u32(a+12)

for kind, a, b in all_boxes:
    if kind != 'traf':
        continue
    default_duration = 0
    children = list(boxes(a, b))
    for child, x, y in children:
        if child == 'tfhd':
            flags = u32(x) & 0xffffff
            track_id = u32(x+4)
            cursor = x + 8 + (8 if flags & 1 else 0) + (4 if flags & 2 else 0)
            default_duration = u32(cursor) if flags & 8 else defaults.get(track_id, 0)
    for child, x, y in children:
        if child != 'trun':
            continue
        flags = u32(x) & 0xffffff
        count = u32(x+4)
        samples += count
        cursor = x + 8 + (4 if flags & 1 else 0) + (4 if flags & 4 else 0)
        for _ in range(count):
            duration += u32(cursor) if flags & 0x100 else default_duration
            cursor += 4 * sum(bool(flags & flag) for flag in (0x100, 0x200, 0x400, 0x800))

if not duration:
    for kind, a, b in all_boxes:
        if kind == 'stts':
            for i in range(u32(a+4)):
                count, delta = u32(a+8+i*8), u32(a+12+i*8)
                samples += count
                duration += count * delta
if not timescale or not duration or not samples:
    raise ValueError('Missing video timing metadata')
info['duration_seconds'] = round(duration / timescale, 6)
info['video_frames'] = samples
info['average_fps'] = round(samples / (duration / timescale), 4)
info['timebase'] = timescale
assert info['width'] == 1920 and info['height'] == 1080
assert 44 <= info['duration_seconds'] <= 46
assert info['codec'] == 'avc1' and info['audio_tracks'] == 0
assert info['video_frames'] == 1350 and info['average_fps'] == 30
record = {'title': 'AI 回答，回到你的笔记', 'plugin_version': '0.16.0', 'date': '2026-09-29', 'video': info, 'visuals': 'Locally rendered feature illustrations based on the 0.16.0 source behavior, with simulated content; not native Obsidian recordings.', 'sound': 'No voice-over or background music.', 'publication': {'github': 'prepared', 'bilibili': 'not_submitted', 'xiaohongshu': 'not_submitted'}}
(root / 'production.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, ensure_ascii=False, indent=2))
