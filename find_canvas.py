text = open('script.js', 'r', encoding='utf-8').read()
lines = text.split('\n')
for i, line in enumerate(lines):
    if 'Hero Canvas Particle Animation' in line:
        print(f'START BLOCK: {i+1}')
        break
