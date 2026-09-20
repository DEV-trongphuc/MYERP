import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

for root, dirs, files in os.walk('backend'):
    for f in files:
        if f.endswith(('.php', '.sql')):
            p = os.path.join(root, f)
            with open(p, encoding='utf-8', errors='ignore') as fp:
                for idx, line in enumerate(fp, 1):
                    if "100073" in line or "tramlth" in line or "100076" in line or "nganph" in line:
                        print(f"{p}:{idx}: {line.strip()}")
