text = open('script.js', 'r', encoding='utf-8').read()

lines = text.split('\n')
stack = []
for i, line in enumerate(lines):
    # Very naive parsing, ignoring strings/comments
    # To be safer, let's strip single line comments
    line = line.split('//')[0]
    for j, char in enumerate(line):
        if char == '{':
            stack.append((i+1, j+1))
        elif char == '}':
            if stack:
                stack.pop()
            else:
                print(f'UNMATCHED CLOSING BRACE AT LINE {i+1}, COL {j+1}')

if stack:
    print('UNMATCHED OPENING BRACES:')
    for item in stack:
        print(f'LINE {item[0]}, COL {item[1]}')
