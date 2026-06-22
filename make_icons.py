"""Gera os ícones do PWA Arraiá do Tesouro: uma fogueira de festa junina
sobre o céu noturno roxo. Desenhado com polígonos (sem fontes/emoji)."""
from PIL import Image, ImageDraw
import math


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size

    # céu noturno em gradiente vertical (roxo-noite -> roxo-2)
    top = (36, 21, 68)
    bot = (58, 31, 99)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bot, y / S))

    # cantos arredondados (a não ser maskable, que precisa preencher tudo)
    if not maskable:
        r = int(S * 0.22)
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
        img.putalpha(mask)
        d = ImageDraw.Draw(img)

    cx = S / 2

    # estrelinhas
    for (sx, sy, sr) in [(0.18, 0.18, 0.012), (0.82, 0.22, 0.016),
                         (0.72, 0.12, 0.01), (0.26, 0.30, 0.009),
                         (0.86, 0.40, 0.011)]:
        rr = sr * S
        d.ellipse([sx * S - rr, sy * S - rr, sx * S + rr, sy * S + rr],
                  fill=(255, 233, 150, 230))

    # brilho da fogueira (halo)
    glow_r = S * 0.34
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(18, 0, -1):
        a = int(8 * (i / 18))
        rr = glow_r * (i / 18)
        gd.ellipse([cx - rr, S * 0.62 - rr, cx + rr, S * 0.62 + rr],
                   fill=(255, 150, 40, a))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)

    # lenha (dois troncos cruzados)
    log = (122, 71, 38)
    log_d = (92, 52, 26)
    ly = S * 0.80
    lw = S * 0.07
    d.line([(cx - S * 0.20, ly + S * 0.03), (cx + S * 0.20, ly - S * 0.02)],
           fill=log, width=int(lw))
    d.line([(cx - S * 0.20, ly - S * 0.02), (cx + S * 0.20, ly + S * 0.03)],
           fill=log_d, width=int(lw))

    # chamas (3 camadas de triângulos arredondados)
    def flame(scale, color, dy=0.0):
        baseY = S * 0.78 - dy * S
        topY = baseY - S * 0.42 * scale
        w = S * 0.16 * scale
        pts = [
            (cx, topY),
            (cx + w, baseY - S * 0.10 * scale),
            (cx + w * 0.5, baseY),
            (cx, baseY - S * 0.04 * scale),
            (cx - w * 0.5, baseY),
            (cx - w, baseY - S * 0.10 * scale),
        ]
        # curva suave: insere ponto de controle no topo
        d.polygon(pts, fill=color)
        d.ellipse([cx - w, baseY - S * 0.18 * scale, cx + w, baseY + S * 0.02 * scale],
                  fill=color)

    flame(1.25, (226, 74, 47))     # vermelho externo
    flame(0.95, (255, 122, 24))    # laranja
    flame(0.6, (255, 201, 60))     # miolo amarelo

    return img


for sz in (192, 512):
    draw_icon(sz, maskable=True).save(f"icons/icon-{sz}.png")
# ícone iOS (cantos arredondados desenhados pelo sistema, então quadrado cheio)
draw_icon(180, maskable=True).save("icons/apple-touch-icon.png")
draw_icon(512, maskable=False).save("icons/icon.png")
print("ícones gerados")
