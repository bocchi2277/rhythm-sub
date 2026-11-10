"""Verify the compiled Tailwind CSS actually contains the utility classes the
built pages use.

This guards the Tailwind v4 failure mode where a missing/broken
postcss.config.mjs makes Next.js compile the theme layer but leave the
utilities layer as the literal at-rule "@tailwind utilities" — colours and
fonts keep working while every utility class silently stops applying.

Usage:  python scripts/check-css-coverage.py   (run after `npm run build`)
Exit code 0 = all used classes are present; 1 = coverage gaps or a dead
utilities layer.
"""
import glob
import html
import os
import re
import sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

css_files = sorted(glob.glob(os.path.join(SITE, '.next', 'static', 'css', '*.css')))
if not css_files:
    sys.exit('no compiled CSS found — run `npm run build` first')
# Check EVERY compiled stylesheet: Tailwind v4 can emit more than one file,
# and reading only the first one silently skipped the rest of the utilities.
compiled = '\n'.join(open(f, encoding='utf-8').read() for f in css_files)

# Decisive check: a live utilities layer never contains the raw at-rule.
if re.search(r'@tailwind\s+utilities', compiled):
    sys.exit(
        'compiled CSS still contains the raw "@tailwind utilities" at-rule — '
        'postcss.config.mjs is missing or not applied'
    )


def extract_css_classes(css):
    """Collect class names from CSS selectors, resolving backslash escapes."""
    classes = set()
    i, n = 0, len(css)
    # Characters that terminate a class selector.
    stops = set('{}.,>+~()[];:#%&*|/!@=<>')
    while i < n:
        if css[i] == '.':
            j = i + 1
            buf = []
            while j < n:
                c = css[j]
                if c == '\\':
                    if j + 1 < n:
                        buf.append(css[j + 1])
                        j += 2
                        continue
                    break
                if c.isspace() or c in stops:
                    break
                buf.append(c)
                j += 1
            if buf:
                classes.add(''.join(buf))
            i = j if j > i else i + 1
        else:
            i += 1
    return classes


css_classes = extract_css_classes(compiled)

# Classes emitted by the upstream WordPress markup that this design defines no
# styles for — inert, not a Tailwind coverage gap.
IGNORED_CLASSES = {'no-js', 'screen-reader-response', 'wpcf7', 'alignnone'}


def is_ignored(cls):
    return cls in IGNORED_CLASSES or cls.startswith('wp-image-')

# Representative utilities across the layers Tailwind v4 emits.
spot = ['md:block', 'bg-accent/10', 'aspect-[2/3]', 'gap-2.5', 'grid', 'rounded-2xl']
missing_spot = [s for s in spot if s not in css_classes]
for s in spot:
    print(f'{s!r} -> {"FOUND" if s in css_classes else "NOT FOUND"}')

pages = sorted(glob.glob(os.path.join(SITE, 'out', '**', 'index.html'), recursive=True))
if not pages:
    sys.exit('no built pages found — run `npm run build` first')

total_missing = 0
for page in pages:
    h = open(page, encoding='utf-8').read()
    used = set()
    for m in re.finditer(r'class="([^"]+)"', h):
        used.update(html.unescape(m.group(1)).split())
    missing = sorted(c for c in used if c not in css_classes and not is_ignored(c))
    total_missing += len(missing)
    if missing:
        rel = os.path.relpath(page, SITE)
        print(f'{rel}: used={len(used)} missing={len(missing)} {missing[:10]}')

print(f'\nchecked {len(pages)} pages | stylesheets: {len(css_files)} | spot-checks missing: {len(missing_spot)} | total missing classes: {total_missing}')
sys.exit(1 if (total_missing or missing_spot) else 0)
