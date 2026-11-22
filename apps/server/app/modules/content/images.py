"""Bounded PNG/JPEG structure validation using only the standard library.

PNG validates checksums, ordering and the complete decompressed scanline stream.
JPEG validates frame/scan/table structure and entropy marker framing. This is not
a general-purpose image decoder; unsupported JPEG encodings are rejected.
"""
import struct
import zlib
from app.core.exceptions import DomainError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000


def validate_image(data: bytes) -> str:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise DomainError('INVALID_IMAGE', 'Images must be at most 5 MiB.', 422)
    try:
        if data.startswith(b'\x89PNG\r\n\x1a\n'):
            _png(data)
            return 'image/png'
        if data.startswith(b'\xff\xd8'):
            _jpeg(data)
            return 'image/jpeg'
    except (ValueError, struct.error, zlib.error, IndexError):
        pass
    raise DomainError('INVALID_IMAGE', 'A structurally valid JPG or PNG image is required.', 422)


def _png(data: bytes) -> None:
    pos, compressed, seen = 8, bytearray(), []
    width = height = depth = color = interlace = 0
    while pos < len(data):
        length = struct.unpack_from('!I', data, pos)[0]
        kind = data[pos + 4:pos + 8]
        end = pos + 12 + length
        if end > len(data) or len(kind) != 4 or not kind.isalpha():
            raise ValueError()
        body = data[pos + 8:pos + 8 + length]
        if zlib.crc32(kind + body) != struct.unpack_from('!I', data, end - 4)[0]:
            raise ValueError()
        if not seen and kind != b'IHDR':
            raise ValueError()
        if kind == b'IHDR':
            if seen or length != 13:
                raise ValueError()
            width, height, depth, color, compression, filtering, interlace = struct.unpack('!IIBBBBB', body)
            allowed = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
            if (not width or not height or width * height > MAX_PIXELS or
                depth not in allowed.get(color, ()) or compression or filtering or interlace not in (0, 1)):
                raise ValueError()
        elif kind == b'PLTE':
            if b'PLTE' in seen or b'IDAT' in seen or not length or length % 3 or length > 768 or color in (0, 4):
                raise ValueError()
        elif kind == b'IDAT':
            if (b'IDAT' in seen and seen[-1] != b'IDAT') or (color == 3 and b'PLTE' not in seen):
                raise ValueError()
            compressed.extend(body)
        elif kind == b'IEND':
            if length or end != len(data) or not compressed:
                raise ValueError()
        elif not (kind[0] & 32):
            raise ValueError()  # unknown critical chunk
        seen.append(kind)
        pos = end
    if not seen or seen[-1] != b'IEND':
        raise ValueError()
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    passes = [(0, 0, 1, 1)] if not interlace else [
        (0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4),
        (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]
    rows = []
    for x, y, dx, dy in passes:
        w, h = max(0, (width - x + dx - 1) // dx), max(0, (height - y + dy - 1) // dy)
        if w and h:
            rows.append((h, 1 + (w * channels * depth + 7) // 8))
    expected = sum(h * size for h, size in rows)
    if expected > 128 * 1024 * 1024:
        raise ValueError()
    decoder = zlib.decompressobj()
    raw = decoder.decompress(bytes(compressed), expected + 1)
    if len(raw) != expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError()
    pos = 0
    for h, size in rows:
        for _ in range(h):
            if raw[pos] > 4:
                raise ValueError()
            pos += size


def _jpeg(data: bytes) -> None:
    pos, frame, scans, tables = 2, None, 0, set()
    while pos < len(data):
        if data[pos] != 255:
            raise ValueError()
        while pos < len(data) and data[pos] == 255:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker == 0xD9:
            if pos != len(data) or not frame or not scans or not {0xDB, 0xC4}.issubset(tables):
                raise ValueError()
            return
        if marker in (0, 0xD8) or 0xD0 <= marker <= 0xD7:
            raise ValueError()
        length = struct.unpack_from('!H', data, pos)[0]
        if length < 2 or pos + length > len(data):
            raise ValueError()
        body = data[pos + 2:pos + length]
        pos += length
        if marker in (0xC0, 0xC2):
            if frame or len(body) < 6:
                raise ValueError()
            precision, h, w, n = struct.unpack_from('!BHHB', body)
            if precision != 8 or not w or not h or w * h > MAX_PIXELS or n not in (1, 3, 4) or len(body) != 6 + 3 * n:
                raise ValueError()
            frame = {body[6 + 3 * i] for i in range(n)}
            if len(frame) != n:
                raise ValueError()
            for i in range(n):
                sampling = body[7 + 3 * i]
                if not 1 <= sampling >> 4 <= 4 or not 1 <= sampling & 15 <= 4 or body[8 + 3 * i] > 3:
                    raise ValueError()
        elif marker == 0xDB:
            cursor = 0
            while cursor < len(body):
                spec = body[cursor]
                if spec >> 4 > 1 or spec & 15 > 3:
                    raise ValueError()
                cursor += 1 + 64 * (1 + (spec >> 4))
            if not body or cursor != len(body):
                raise ValueError()
            tables.add(marker)
        elif marker == 0xC4:
            cursor = 0
            while cursor < len(body):
                if cursor + 17 > len(body) or body[cursor] >> 4 > 1 or body[cursor] & 15 > 3:
                    raise ValueError()
                counts = body[cursor + 1:cursor + 17]
                slots = 1
                for count in counts:
                    slots = slots * 2 - count
                    if slots < 0:
                        raise ValueError()
                count = sum(counts)
                if not count or count > 256:
                    raise ValueError()
                cursor += 17 + count
            if not body or cursor != len(body):
                raise ValueError()
            tables.add(marker)
        elif marker == 0xDA:
            if not frame or not body:
                raise ValueError()
            n = body[0]
            if not 1 <= n <= len(frame) or len(body) != 4 + 2 * n:
                raise ValueError()
            if any(body[1 + 2 * i] not in frame for i in range(n)):
                raise ValueError()
            start = pos
            while pos < len(data):
                if data[pos] != 255:
                    pos += 1
                    continue
                nxt = pos + 1
                while nxt < len(data) and data[nxt] == 255:
                    nxt += 1
                if nxt >= len(data):
                    raise ValueError()
                if data[nxt] == 0 or 0xD0 <= data[nxt] <= 0xD7:
                    pos = nxt + 1
                    continue
                break
            if pos == start:
                raise ValueError()
            scans += 1
        elif marker == 0xDD:
            if len(body) != 2:
                raise ValueError()
        elif not (0xE0 <= marker <= 0xEF or marker == 0xFE):
            raise ValueError()
    raise ValueError()
