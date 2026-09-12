import os
import urllib.request
import time

STICKER_GROUPS = [
    {
        "name": "meep",
        "pattern": "https://amisplatform.misacdn.net/apps/newsfeed2/assets/sticker/img/meep/meep_{i}.png",
        "ext": "png",
        "range": (1, 16)
    },
    {
        "name": "foxlove",
        "pattern": "https://amisplatform.misacdn.net/apps/newsfeed2/assets/sticker/img/foxlove/foxlove_{i}.png",
        "ext": "png",
        "range": (1, 16)
    },
    {
        "name": "buffalo",
        "pattern": "https://amisplatform.misacdn.net/chat/libs/misa-expressive/assets/img/sticker/buffalo/buffalo_{i}.gif",
        "ext": "gif",
        "range": (1, 11)
    },
    {
        "name": "minion",
        "pattern": "https://amisplatform.misacdn.net/chat/libs/misa-expressive/assets/img/sticker/minion/minion_{i}.png",
        "ext": "png",
        "range": (1, 20)
    }
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

total_success = 0
total_failed = 0

for group in STICKER_GROUPS:
    folder = os.path.join("public", "stickers", group["name"])
    os.makedirs(folder, exist_ok=True)
    start, end = group["range"]
    print(f"Downloading group: {group['name']} ({start} - {end})...")
    
    for i in range(start, end + 1):
        filename = f"{group['name']}_{i}.{group['ext']}"
        filepath = os.path.join(folder, filename)
        url = group["pattern"].format(i=i)
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read()
                if len(content) > 0:
                    with open(filepath, "wb") as f:
                        f.write(content)
                    print(f"  [OK] {filename} ({len(content)} bytes)")
                    total_success += 1
                else:
                    print(f"  [EMPTY] {filename}")
                    total_failed += 1
        except Exception as e:
            print(f"  [FAIL] {filename}: {e}")
            total_failed += 1
        time.sleep(0.05)

print(f"\nDone! Success: {total_success}, Failed: {total_failed}")
