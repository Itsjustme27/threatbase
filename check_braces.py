text = open('script.js', 'r', encoding='utf-8').read()
open_braces = text.count('{')
close_braces = text.count('}')
print(f'Open braces: {open_braces}, Close braces: {close_braces}')
