"""Encode the app screenshots recorded by record-demo.cjs as a looping README GIF."""
from pathlib import Path
from PIL import Image
frames = [Image.open(p).convert('RGB').resize((800,560), Image.Resampling.LANCZOS) for p in sorted(Path('test-results-demo').glob('[0-9][0-9][0-9].png'))]
if not frames:
    raise SystemExit('Run node scripts/record-demo.cjs first')
# A shared palette avoids flickering between differently colored scan stages.
samples = Image.new('RGB', (200,140*len(frames)))
for i, frame in enumerate(frames):
    samples.paste(frame.resize((200,140)),(0,140*i))
palette=samples.quantize(colors=256)
encoded=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
encoded[0].save('assets/demo.gif',save_all=True,append_images=encoded[1:],duration=240,loop=0,optimize=True,disposal=2)
with Image.open('assets/demo.gif') as gif:
    print(f'{gif.n_frames} frames, {gif.size}, {Path("assets/demo.gif").stat().st_size/1024/1024:.2f} MiB')
