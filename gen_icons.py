import struct, zlib, os

def make_png(size, bg=(255, 59, 48)):
    img = [[(0, 0, 0, 0)] * size for _ in range(size)]
    cx = cy = size // 2
    r = int(size * 0.45)
    for y in range(size):
        for x in range(size):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                img[y][x] = (*bg, 255)

    bw = max(1, size // 12)
    top = int(size * 0.28)
    bot = int(size * 0.72)
    lx = int(size * 0.25)
    mx = int(size * 0.50)
    rx = int(size * 0.75)
    pk = int(size * 0.45)
    white = (255, 255, 255, 255)

    for y in range(top, bot + 1):
        for b in range(bw):
            if 0 <= lx + b < size:
                img[y][lx + b] = white
            if 0 <= rx + b < size:
                img[y][rx + b] = white

    def line(x0, y0, x1, y1):
        s = max(abs(x1 - x0), abs(y1 - y0))
        if s == 0:
            return
        for i in range(s + 1):
            xi = int(x0 + (x1 - x0) * i / s)
            yi = int(y0 + (y1 - y0) * i / s)
            for b in range(bw):
                if 0 <= xi + b < size and 0 <= yi < size:
                    img[yi][xi + b] = white

    line(lx, top, mx, pk)
    line(mx, pk, rx, top)

    raw = b"".join(
        b"\x00" + bytes([v for px in row for v in px]) for row in img
    )
    cmp = zlib.compress(raw, 9)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr_data = struct.pack(">II", size, size) + bytes([8, 6, 0, 0, 0])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr_data)
    png += chunk(b"IDAT", cmp)
    png += chunk(b"IEND", b"")
    return png


base = os.path.join(os.path.dirname(__file__), "extension", "icons")
os.makedirs(base, exist_ok=True)
for size in [16, 48, 128]:
    path = os.path.join(base, f"icon{size}.png")
    with open(path, "wb") as f:
        f.write(make_png(size))
    print(f"Created {path}")
