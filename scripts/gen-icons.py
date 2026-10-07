"""生成「海王」App 图标与启动图（Web PWA + Android 共用同一设计）。

用法：
    python scripts/gen-icons.py

依赖：Pillow
产物：
    public/icons/*.png                      —— PWA / 网页图标
    android/app/src/main/res/mipmap-*/     —— 安卓启动图标（自适应 + 圆形）
    android/app/src/main/res/drawable*/    —— 启动图

设计：品牌绿渐变圆角方块 + 居中白色「海」字。
所有小尺寸都从 1 张主图超采样缩小，避免边缘发毛。
"""

from __future__ import annotations

import glob
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
WEB_OUT = ROOT / "public" / "icons"

BRAND = (7, 193, 96)
BRAND_LIGHT = (36, 212, 128)
BRAND_DARK = (5, 158, 78)

GLYPH = "海"
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\Deng.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]

SS = 4  # 超采样倍数


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    raise SystemExit("找不到可用的中文字体，请把字体路径加进 FONT_CANDIDATES")


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    """竖直渐变底（先在 1px 宽上画，再横向拉伸，比逐像素快得多）"""
    strip = Image.new("RGB", (1, size))
    draw = ImageDraw.Draw(strip)
    for y in range(size):
        t = y / max(size - 1, 1)
        draw.point(
            (0, y),
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    return strip.resize((size, size), Image.BILINEAR)


def paste_glyph(base: Image.Image, ratio: float, color=(255, 255, 255)) -> None:
    """在 base 上居中绘制「海」，ratio = 字面高度占画布比例"""
    size = base.size[0]
    font = load_font(int(size * ratio * SS))
    layer = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # 用真实 bbox 居中，避免不同字体的行高差异造成视觉偏移
    bbox = draw.textbbox((0, 0), GLYPH, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size * SS - w) / 2 - bbox[0]
    y = (size * SS - h) / 2 - bbox[1]
    draw.text((x, y), GLYPH, font=font, fill=color)

    layer = layer.resize((size, size), Image.LANCZOS)
    base.alpha_composite(layer)


def build_icon(size: int, *, radius_ratio: float = 0.23, glyph_ratio: float = 0.62) -> Image.Image:
    """圆角方形图标"""
    big = size * SS
    canvas = vertical_gradient(big, BRAND_LIGHT, BRAND_DARK).convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255
    )
    canvas.putalpha(mask)

    paste_glyph(canvas, glyph_ratio)
    return canvas.resize((size, size), Image.LANCZOS)


def build_round_icon(size: int, glyph_ratio: float = 0.58) -> Image.Image:
    """圆形图标（安卓 ic_launcher_round）"""
    big = size * SS
    canvas = vertical_gradient(big, BRAND_LIGHT, BRAND_DARK).convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    canvas.putalpha(mask)

    paste_glyph(canvas, glyph_ratio)
    return canvas.resize((size, size), Image.LANCZOS)


def build_foreground(size: int, glyph_ratio: float = 0.44) -> Image.Image:
    """自适应图标前景：透明底 + 白色字。

    安卓自适应图标的安全区是中间 72/108，字面控制在 44% 保证任何裁切形状下都不被切到。
    """
    big = size * SS
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    paste_glyph(canvas, glyph_ratio)
    return canvas.resize((size, size), Image.LANCZOS)


def build_splash(width: int, height: int) -> Image.Image:
    """启动图：纯品牌色底 + 居中标识（底是纯色，拉伸也不会露破绽）"""
    canvas = Image.new("RGBA", (width, height), BRAND + (255,))
    # 渐变会让拉伸后的接缝更明显，启动图用纯色更稳
    glyph_h = int(min(width, height) * 0.24)
    font = load_font(int(glyph_h * SS))
    layer = Image.new("RGBA", (width * SS, height * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = draw.textbbox((0, 0), GLYPH, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (width * SS - w) / 2 - bbox[0]
    y = (height * SS - h) / 2 - bbox[1]
    draw.text((x, y), GLYPH, font=font, fill=(255, 255, 255, 255))
    layer = layer.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(layer)
    return canvas


def main() -> None:
    WEB_OUT.mkdir(parents=True, exist_ok=True)

    # ---------- Web / PWA ----------
    build_icon(192).save(WEB_OUT / "icon-192.png")
    build_icon(512).save(WEB_OUT / "icon-512.png")
    build_icon(180).save(WEB_OUT / "apple-touch-icon.png")
    build_icon(64).save(ROOT / "public" / "favicon.png")

    # maskable：满幅底色，留给系统裁切
    big = 512 * SS
    maskable = vertical_gradient(big, BRAND_LIGHT, BRAND_DARK).convert("RGBA")
    paste_glyph(maskable, 0.42)
    maskable.resize((512, 512), Image.LANCZOS).save(WEB_OUT / "maskable-512.png")

    print("Web 图标 →", WEB_OUT)

    # ---------- Android 启动图标 ----------
    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, size in densities.items():
        d = RES / f"mipmap-{name}"
        if not d.exists():
            continue
        build_icon(size).convert("RGB").save(d / "ic_launcher.png")
        build_round_icon(size).save(d / "ic_launcher_round.png")

        fg = d / "ic_launcher_foreground.png"
        fg_size = Image.open(fg).size[0] if fg.exists() else int(size * 108 / 48)
        build_foreground(fg_size).save(fg)
        print(f"  mipmap-{name}: launcher {size}px, foreground {fg_size}px")

    # 自适应图标背景色：原来是白色，配绿底会很难看
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#07C160</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    # ---------- Android 启动图 ----------
    for path in sorted(glob.glob(str(RES / "drawable*" / "splash.png"))):
        p = Path(path)
        w, h = Image.open(p).size
        build_splash(w, h).convert("RGB").save(p)
        print(f"  {p.relative_to(RES)}: {w}x{h}")

    print("Android 资源 →", RES)


if __name__ == "__main__":
    main()
