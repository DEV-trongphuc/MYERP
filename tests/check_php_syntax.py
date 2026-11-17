import sys

def check_brackets(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    in_string = False
    str_char = ''
    in_comment_single = False
    in_comment_multi = False
    
    i = 0
    line = 1
    col = 1
    errors = []
    while i < len(content):
        c = content[i]
        if c == '\n':
            line += 1
            col = 1
            in_comment_single = False
            i += 1
            continue
        
        # Check comments
        if not in_string:
            if not in_comment_multi and c == '/' and i + 1 < len(content) and content[i+1] == '/':
                in_comment_single = True
                i += 2
                continue
            if not in_comment_multi and c == '#' and not (i > 0 and content[i-1] == '['):
                in_comment_single = True
                i += 1
                continue
            if not in_comment_single and c == '/' and i + 1 < len(content) and content[i+1] == '*':
                in_comment_multi = True
                i += 2
                continue
            if in_comment_multi and c == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_comment_multi = False
                i += 2
                continue
        
        if in_comment_single or in_comment_multi:
            i += 1
            col += 1
            continue
            
        # Strings
        if not in_string:
            if c in ('"', "'"):
                in_string = True
                str_char = c
                i += 1
                col += 1
                continue
        else:
            if c == '\\':
                i += 2
                col += 2
                continue
            if c == str_char:
                in_string = False
                i += 1
                col += 1
                continue
            i += 1
            col += 1
            continue
            
        # Brackets
        if c in ('(', '{', '['):
            stack.append((c, line, col))
        elif c in (')', '}', ']'):
            if not stack:
                errors.append(f'Unmatched closing {c} at {line}:{col}')
            else:
                last, l_line, l_col = stack.pop()
                if pairs[c] != last:
                    errors.append(f'Mismatched {last} at {l_line}:{l_col} with {c} at {line}:{col}')
        i += 1
        col += 1
        
    while stack:
        last, l_line, l_col = stack.pop()
        errors.append(f'Unclosed {last} from {l_line}:{l_col}')
        
    print(f'{filepath}: {len(errors)} syntax/bracket errors')
    for e in errors[:5]:
        print('  ', e)
    return len(errors) == 0

files = ['backend/automation/flow_helpers.php', 'backend/automation/FlowExecutor.php', 'backend/automation/flows.php']
all_ok = all(check_brackets(f) for f in files)
sys.exit(0 if all_ok else 1)
