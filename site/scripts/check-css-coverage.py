import re, glob

compiled = open(glob.glob('D:/rhythm/site/.next/static/css/*.css')[0], encoding='utf-8').read()

# Extract class selectors, unescaping CSS escapes (\: \/ \[ \. etc.)
css_classes = set()
for m in re.finditer(r'\.((?:[a-zA-Z0-9_\-]|\\.)+)', compiled):
    css_classes.add(m.group(1).replace(chr(92), ''))

BS = chr(92)
spot = ['md' + BS + ':block', 'bg-accent' + BS + '/10', 'aspect-' + BS + '[2' + BS + '/3' + BS + ']', 'gap-2' + BS + '.5']
for sel in spot:
    print(repr(sel), '->', 'FOUND' if sel in compiled else 'NOT FOUND')

pages = ['out/index.html', 'out/anime/youjo-senki-ii/index.html', 'out/list/index.html', 'out/advanced-search/index.html']
for page in pages:
    h = open('D:/rhythm/site/' + page, encoding='utf-8').read()
    classes = set()
    for m in re.finditer(r'class="([^"]+)"', h):
        classes.update(m.group(1).split())
    missing = sorted(c for c in classes if c not in css_classes)
    status = 'ALL COVERED' if not missing else str(missing[:10])
    print(page, ': used=', len(classes), ' missing=', len(missing), ' ', status)
