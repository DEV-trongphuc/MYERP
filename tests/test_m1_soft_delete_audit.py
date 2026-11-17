import re

checks = [
    ('backend/automation/subscribers.php', r'UPDATE\s+subscribers\s+SET\s+deleted_at\s*=\s*NOW\(\)'),
    ('backend/automation/lists.php', r'UPDATE\s+subscribers\s+SET\s+deleted_at\s*=\s*NOW\(\)'),
    ('backend/automation/lists.php', r'UPDATE\s+lists\s+SET\s+deleted_at\s*=\s*NOW\(\)'),
    ('backend/automation/segments.php', r'UPDATE\s+segments\s+SET\s+deleted_at\s*=\s*NOW\(\)'),
    ('backend/automation/segment_helper.php', r'UPDATE\s+subscribers\s+s\s+INNER\s+JOIN\s+contacts\s+c.*?SET\s+s\.deleted_at\s*=\s*NOW\(\)')
]

print("=== SOFT DELETE UPDATE STATEMENTS VERIFICATION ===")
all_pass = True
for filepath, pattern in checks:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    matches = list(re.finditer(pattern, content, re.IGNORECASE | re.DOTALL))
    print(f"File: {filepath}")
    print(f"  Pattern: {pattern[:40]}...")
    print(f"  Matches: {len(matches)}")
    if not matches:
        all_pass = False
        print("  [FAIL] Expected soft delete update statement not found!")
    for m in matches:
        start = max(0, m.start() - 30)
        end = min(len(content), m.end() + 100)
        snippet = ' '.join(content[start:end].split())
        print(f"  -> Snippet: {snippet}")

print("\n=== VERIFICATION RESULT ===")
if all_pass:
    print("[PASS] All required soft-delete UPDATE statements are properly implemented.")
else:
    print("[FAIL] Missing soft-delete statements!")
