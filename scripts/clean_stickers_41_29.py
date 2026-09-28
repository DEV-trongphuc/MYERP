import os
import io
import numpy as np
from PIL import Image
from rembg import remove, new_session

def process_sticker(name, session):
    ideas_dir = os.path.join("public", "stickers", "ideas")
    jpg_path = os.path.join(ideas_dir, f"{name}.jpg")
    webp_path = os.path.join(ideas_dir, f"{name}.webp")
    png_path = os.path.join(ideas_dir, f"{name}.png")
    
    print(f"Processing {name} from {jpg_path}...")
    raw_img = Image.open(jpg_path).convert("RGB")
    raw_arr = np.array(raw_img)
    
    # 1. High-resolution rembg with post_process_mask
    buf = io.BytesIO()
    raw_img.save(buf, format="PNG")
    out_bytes = remove(buf.getvalue(), session=session, post_process_mask=True)
    rem_img = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
    rem_arr = np.array(rem_img)
    
    # 2. Precise artifact removal based on original pure-white background
    # Background in original jpg is [252..255]
    is_pure_white = (raw_arr[:, :, 0] >= 248) & (raw_arr[:, :, 1] >= 248) & (raw_arr[:, :, 2] >= 248)
    
    cleaned_alpha = rem_arr[:, :, 3].copy()
    
    # The character only starts at Y >= 64
    cleaned_alpha[:64, :] = 0
    
    # In upper half (Y < 500), any pixel that was pure white in source is 100% background
    cleaned_alpha[:500, :][is_pure_white[:500, :]] = 0
    
    # Any residual faint smoke (alpha < 85) in top 220 rows is cleared
    cleaned_alpha[:220, :][cleaned_alpha[:220, :] < 85] = 0
    
    rem_arr[:, :, 3] = cleaned_alpha
    cleaned_img = Image.fromarray(rem_arr, mode="RGBA")
    
    # 3. Crop transparent borders
    bbox = cleaned_img.getbbox()
    if not bbox:
        raise ValueError(f"Empty bounding box for {name}")
        
    cropped = cleaned_img.crop(bbox)
    
    # 4. Center in square canvas with 6% padding
    max_d = max(cropped.width, cropped.height)
    pad = max(10, int(max_d * 0.06))
    canvas_dim = max_d + pad * 2
    canvas = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
    offset_x = (canvas_dim - cropped.width) // 2
    offset_y = (canvas_dim - cropped.height) // 2
    canvas.paste(cropped, (offset_x, offset_y), cropped)
    
    # 5. Resize to standard 256x256 sticker dimension with Lanczos
    final_sticker = canvas.resize((256, 256), Image.Resampling.LANCZOS)
    
    # 6. Save as WEBP and PNG
    final_sticker.save(webp_path, "WEBP", quality=90, method=6)
    final_sticker.save(png_path, "PNG")
    
    size_kb = os.path.getsize(webp_path) / 1024
    print(f"Successfully saved {webp_path} ({size_kb:.1f} KB) and {png_path}")

def main():
    session = new_session("u2net")
    for name in ["ideas_41", "ideas_29"]:
        process_sticker(name, session)

if __name__ == "__main__":
    main()
