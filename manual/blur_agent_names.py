"""Offusca (pixelate) nome/email dell'agente reale negli screenshot del manuale."""
from PIL import Image

def pixelate(img, box, factor=18):
    region = img.crop(box)
    w, h = region.size
    small = region.resize((max(1, w // factor), max(1, h // factor)), Image.BILINEAR)
    region = small.resize((w, h), Image.NEAREST)
    img.paste(region, box)

# ai24-dashboard-dark: avatar "GI" + nome "Gabriele De Intinis" nell'header
img = Image.open('/app/manual/img/ai24-dashboard-dark.png')
print('ai24 size:', img.size)
sx = img.size[0] / 724.0
def S(box):
    return tuple(int(v * sx) for v in box)
pixelate(img, S((34, 56, 132, 156)))    # avatar GI
pixelate(img, S((144, 92, 545, 158)))   # nome
img.save('/app/manual/img/ai24-dashboard-dark.png')

# ai27-profilo-aspetto: avatar "G", nome ed email nella card profilo
img = Image.open('/app/manual/img/ai27-profilo-aspetto.png')
print('ai27 size:', img.size)
sx = img.size[0] / 724.0
pixelate(img, S((284, 192, 440, 345)))  # avatar G
pixelate(img, S((172, 368, 552, 420)))  # nome
pixelate(img, S((222, 426, 502, 462)))  # email
img.save('/app/manual/img/ai27-profilo-aspetto.png')
print('FATTO')
