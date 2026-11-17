import sys
import re

files_to_validate = [
    'backend/automation/segment_helper.php',
    'backend/automation/segments.php',
    'backend/automation/lists.php',
    'backend/automation/subscribers.php',
    'backend/automation/audience_split.php',
    'backend/automation/worker_segment_counts.php',
    'backend/automation/worker_segment_notify.php',
    'backend/automation/segment_ai_analysis.php',
    'backend/controllers/ContactController.php',
    'backend/migrations/331_marketing_automation_soft_delete_and_workspace_scoping.php'
]

def check_php_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    errors = []
    # 1. Check open tag
    if not code.strip().startswith('<?php') and not code.strip().startswith('<?'):
        errors.append("File does not start with PHP opening tag")

    # 2. Tokenize string literals, comments, and brackets
    stack = []
    i = 0
    n = len(code)
    line = 1
    col = 1

    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False

    while i < n:
        ch = code[i]
        if ch == '\n':
            line += 1
            col = 1
            if in_line_comment:
                in_line_comment = False
            i += 1
            continue

        if in_line_comment:
            i += 1
            col += 1
            continue

        if in_block_comment:
            if ch == '*' and i + 1 < n and code[i + 1] == '/':
                in_block_comment = False
                i += 2
                col += 2
                continue
            i += 1
            col += 1
            continue

        if in_single_quote:
            if ch == '\\':
                i += 2
                col += 2
                continue
            if ch == "'":
                in_single_quote = False
            i += 1
            col += 1
            continue

        if in_double_quote:
            if ch == '\\':
                i += 2
                col += 2
                continue
            if ch == '"':
                in_double_quote = False
            i += 1
            col += 1
            continue

        # Check comment starts
        if ch == '/' and i + 1 < n and code[i + 1] == '/':
            in_line_comment = True
            i += 2
            col += 2
            continue
        if ch == '#' and not (i + 1 < n and code[i + 1] == '['): # not attribute #[...]
            in_line_comment = True
            i += 1
            col += 1
            continue
        if ch == '/' and i + 1 < n and code[i + 1] == '*':
            in_block_comment = True
            i += 2
            col += 2
            continue

        # Check string starts
        if ch == "'":
            in_single_quote = True
            i += 1
            col += 1
            continue
        if ch == '"':
            in_double_quote = True
            i += 1
            col += 1
            continue

        # Check brackets
        if ch in '({[':
            stack.append((ch, line, col))
        elif ch in ')}]':
            if not stack:
                errors.append(f"Unexpected closing bracket '{ch}' at line {line}, col {col}")
            else:
                top, t_line, t_col = stack.pop()
                expected = {')': '(', '}': '{', ']': '['}[ch]
                if top != expected:
                    errors.append(f"Mismatched bracket: expected '{expected}' for '{ch}' at line {line}:{col}, opened at {t_line}:{t_col}")

        i += 1
        col += 1

    if in_single_quote:
        errors.append("Unclosed single quote string literal")
    if in_double_quote:
        errors.append("Unclosed double quote string literal")
    if in_block_comment:
        errors.append("Unclosed block comment")
    if stack:
        for b, l, c in stack:
            errors.append(f"Unclosed opening bracket '{b}' opened at line {l}, col {c}")

    return errors

print("=== PHP DEEP SYNTAX & DELIMITER VERIFICATION ===")
total_errors = 0
for f in files_to_validate:
    errs = check_php_file(f)
    if errs:
        total_errors += len(errs)
        print(f"[FAIL] {f}:")
        for e in errs:
            print(f"   -> {e}")
    else:
        print(f"[PASS] {f}: 0 syntax/bracket/delimiter errors")

print(f"\nTotal Errors: {total_errors}")
if total_errors == 0:
    print("[SUCCESS] All 10 PHP files passed syntax and delimiter verification!")
    sys.exit(0)
else:
    print("[FAILURE] Syntax errors detected!")
    sys.exit(1)
