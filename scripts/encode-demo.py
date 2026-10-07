"""Encode the actual app capture at 15 fps with a stable shared palette."""
from pathlib import Path
from PIL import Image, ImageChops
files=sorted(Path('test-results-demo').glob('[0-9][0-9][0-9].png'))
# Lead with the completed survey; the orbit continues seamlessly across the loop.
files=files[-18:]+files[:-18]
frames=[Image.open(p).convert('RGB').resize((800,500),Image.Resampling.LANCZOS) for p in files]
if not frames: raise SystemExit('Run node scripts/record-demo.cjs first')
samples=Image.new('RGB',(160,100*len(frames)))
for i,f in enumerate(frames):samples.paste(f.resize((160,100)),(0,i*100))
palette=samples.quantize(colors=250)
# Keep the small brand and station indicators vivid despite the neutral background.
palette.putpalette(palette.getpalette()[:750]+[255,90,82,53,196,181,242,181,68,255,255,255,25,27,32,222,220,217])
encoded=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
encoded[0].save('assets/demo.gif',save_all=True,append_images=encoded[1:],duration=[70 if i%3 else 60 for i in range(len(frames))],loop=0,optimize=True,disposal=1)
with Image.open('assets/demo.gif') as gif:
    print(f'{gif.n_frames} frames, {gif.size}, {Path("assets/demo.gif").stat().st_size/1024/1024:.2f} MiB')
    gif.seek(gif.n_frames-1)
    assert ImageChops.difference(gif.convert('RGB'),encoded[-1].convert('RGB')).getbbox() is None, 'GIF disposal left stale pixels'
    gif.seek(0)
    gif.convert('RGB').save('test-results-demo/gif-preview.png')
