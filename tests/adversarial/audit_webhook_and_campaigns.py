import re

print("=== AUDITING WEBHOOK.PHP CONTRACTS ===")
with open("backend/automation/webhook.php", "r", encoding="utf-8", errors="ignore") as f:
    webhook_content = f.read()

# find types handled
types = re.findall(r"\$type\s*===?\s*['\"]([^'\"]+)['\"]", webhook_content)
print("Handled $type values in webhook.php:", sorted(list(set(types))))

# check for open, click, unsubscribe handlers
for expected in ['open', 'click', 'unsubscribe']:
    if expected in types:
        print(f"  [FOUND] $type === '{expected}' is handled")
    else:
        print(f"  [MISSING] $type === '{expected}' NOT handled!")

print("\n=== AUDITING CAMPAIGNS.PHP CONTRACTS ===")
with open("backend/automation/campaigns.php", "r", encoding="utf-8", errors="ignore") as f:
    camp_content = f.read()

routes = re.findall(r"\$route\s*===?\s*['\"]([^'\"]+)['\"]", camp_content)
print("Handled $route values in campaigns.php:", sorted(list(set(routes))))

actions = re.findall(r"\$action\s*===?\s*['\"]([^'\"]+)['\"]", camp_content)
print("Handled $action values in campaigns.php:", sorted(list(set(actions))))

print("\n=== AUDITING GO.PHP CONTRACTS ===")
with open("backend/automation/go.php", "r", encoding="utf-8", errors="ignore") as f:
    go_content = f.read()

print("Does go.php check status?", "$link['status']" in go_content)
print("Does go.php check deleted_at / is_deleted?", "deleted_at" in go_content and "is_deleted" in go_content)
print("Does go.php sanitize redirect url?", "sanitize_redirect_url" in go_content)
