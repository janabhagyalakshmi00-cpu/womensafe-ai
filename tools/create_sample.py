from pathlib import Path
from urllib.request import urlopen

import cv2
import numpy as np

root = Path('/home/ubuntu/womensafe-ai')
out_dir = root / 'backend' / 'data'
out_dir.mkdir(parents=True, exist_ok=True)
image_path = out_dir / 'zidane_reference.jpg'
video_path = out_dir / 'sample_cctv.mp4'

if not image_path.exists():
    with urlopen('https://ultralytics.com/images/zidane.jpg', timeout=30) as response:
        image_path.write_bytes(response.read())

image = cv2.imread(str(image_path))
if image is None:
    raise RuntimeError('Could not read downloaded reference image')
height, width = image.shape[:2]
# A short, gently panning clip lets the real YOLO detector process a video file
# while keeping the repository fixture small enough for a hackathon demo.
output_width, output_height = 640, 360
writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*'mp4v'), 12.0, (output_width, output_height))
if not writer.isOpened():
    raise RuntimeError('Could not open sample video writer')
for index in range(72):
    scale = 1.0 + 0.035 * np.sin(index / 12.0)
    crop_w = int(width / scale)
    crop_h = int(height / scale)
    x = max(0, min(width - crop_w, int((width - crop_w) * (0.5 + 0.4 * np.sin(index / 18.0)))))
    y = max(0, min(height - crop_h, int((height - crop_h) * 0.5)))
    crop = image[y:y + crop_h, x:x + crop_w]
    frame = cv2.resize(crop, (output_width, output_height), interpolation=cv2.INTER_AREA)
    cv2.putText(frame, 'CAMERA 1  |  DEMO CLIP', (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (220, 240, 235), 2, cv2.LINE_AA)
    writer.write(frame)
writer.release()
print(video_path)
