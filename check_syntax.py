
def check_brackets(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    
    for i, char in enumerate(content):
        if char in '([{':
            stack.append((char, i + 1))
        elif char in ')]}':
            if not stack:
                print(f"Error: Unmatched closing bracket '{char}' at line {content[:i].count('\\n') + 1}")
                return
            
            last_char, line_num = stack.pop()
            if mapping[char] != last_char:
                print(f"Error: Mismatched bracket '{char}' at line {content[:i].count('\\n') + 1}, expected closing for '{last_char}' from line {line_num}")
                return
    
    if stack:
        last_char, line_num = stack[-1]
        print(f"Error: Unclosed bracket '{last_char}' from line {line_num}")
    else:
        print("No bracket errors found.")

check_brackets('/static/client-main.js')
