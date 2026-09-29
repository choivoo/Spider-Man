"""Measure proportions / palette from /reference images (used by docs/MODELING_GUIDE.md)."""
from PIL import Image
import numpy as np

# Civilian: subject vs grey studio backdrop
im = np.asarray(Image.open("reference/civilian-fullbody.png").convert("RGB")).astype(float)
H, W, _ = im.shape
dark = im.sum(axis=2) < 200          # black outfit / hair / shoes
rows = np.where(dark.sum(axis=1) > 3)[0]
top, bot = rows.min(), rows.max()
print("civilian size", W, H, "subject rows", top, bot, "height px", bot - top)
def width_at(frac):
    y = int(top + (bot - top) * frac)
    xs = np.where(dark[y])[0]
    return (xs.max() - xs.min()) if len(xs) else 0
for name, f in [("head-mid", .07), ("shoulders", .21), ("chest", .30), ("waist", .43), ("hips", .52), ("knee", .75), ("ankle", .95)]:
    print(f"{name:10s} y={f:.2f} width={width_at(f)}px  ratio_to_height={width_at(f)/(bot-top):.3f}")

# Suit palette from the turnaround
s = Image.open("reference/spider-suit-turnaround.png").convert("RGBA")
a = np.asarray(s).astype(float)
m = a[..., 3] > 200
px = a[m][:, :3]
def dom(cond, label):
    sel = px[cond(px)]
    print(label, "n=", len(sel), "median rgb", np.median(sel, axis=0).astype(int) if len(sel) else None)
dom(lambda p: (p[:, 0] > 140) & (p[:, 1] < 70) & (p[:, 2] < 70), "red ")
dom(lambda p: (p[:, 0] > 150) & (p[:, 1] > 120) & (p[:, 2] < 130) & (p[:, 0] - p[:, 2] > 40), "gold")
dom(lambda p: p.sum(axis=1) < 90, "black")
b = Image.open("reference/nanotech-iron-spider.png").convert("RGBA")
bp = np.asarray(b).astype(float); bm = bp[..., 3] > 200; bpx = bp[bm][:, :3]
cy = bpx[(bpx[:, 2] > 200) & (bpx[:, 1] > 180) & (bpx[:, 0] < 190)]
print("cyan glow n=", len(cy), "median", np.median(cy, axis=0).astype(int) if len(cy) else None)
ys = np.where(bm.any(axis=1))[0]; xs = np.where(bm.any(axis=0))[0]
print("iron spider bbox", xs.min(), xs.max(), ys.min(), ys.max(), "(arms span width", xs.max()-xs.min(), "vs height", ys.max()-ys.min(), ")")
