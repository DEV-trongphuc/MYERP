import os
import io
from PIL import Image
from rembg import remove, new_session

def process_ideas_stickers():
    ideas_dir = os.path.join("public", "stickers", "ideas")
    print(f"Starting batch sticker processing in: {ideas_dir}")
    
    session = new_session("u2netp")
    
    for i in range(1, 25):
        jpg_path = os.path.join(ideas_dir, f"ideas_{i}.jpg")
        png_path = os.path.join(ideas_dir, f"ideas_{i}.png")
        webp_path = os.path.join(ideas_dir, f"ideas_{i}.webp")
        
        src_path = None
        if os.path.exists(jpg_path):
            src_path = jpg_path
        elif os.path.exists(png_path):
            src_path = png_path
            
        if not src_path:
            print(f"[{i}/24] Skipped (not found)")
            continue
            
        try:
            raw_img = Image.open(src_path).convert("RGB")
            # Resize input to 512x512 for fast & crisp edge detection
            resized_input = raw_img.resize((512, 512), Image.Resampling.LANCZOS)
            
            buf = io.BytesIO()
            resized_input.save(buf, format="PNG")
            
            out_bytes = remove(buf.getvalue(), session=session)
            rgba_img = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
            
            # Auto crop transparent borders to tightly center sticker
            bbox = rgba_img.getbbox()
            if bbox:
                rgba_img = rgba_img.crop(bbox)
                
            # Create a 256x256 square canvas with 6% margin
            max_d = max(rgba_img.width, rgba_img.height)
            pad = max(10, int(max_d * 0.06))
            canvas_dim = max_d + pad * 2
            canvas = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
            offset_x = (canvas_dim - rgba_img.width) // 2
            offset_y = (canvas_dim - rgba_img.height) // 2
            canvas.paste(rgba_img, (offset_x, offset_y), rgba_img)
            
            final_sticker = canvas.resize((256, 256), Image.Resampling.LANCZOS)
            final_sticker.save(webp_path, "WEBP", quality=85, method=6)
            
            size_kb = os.path.getsize(webp_path) / 1024
            print(f"[{i}/24] Done -> {webp_path} ({size_kb:.1f} KB)")
        except Exception as e:
            print(f"[{i}/24] Error on {src_path}: {e}")

    # Remove temporary test file if present
    test_path = os.path.join(ideas_dir, "test_1.webp")
    if os.path.exists(test_path):
        os.remove(test_path)

    print("Batch processing complete!")

if __name__ == "__main__":
    process_ideas_stickers()
