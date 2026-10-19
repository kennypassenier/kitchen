# Build a browser-only preview of the kitchen web app: the real screens,
# Usage: CHASSIS_STATIC=<chassis-rs checkout at the pinned tag>/crates/chassis/static python3 scripts/preview/build.py
# with the server's JSON routes answered in the browser (localStorage,
# seeded from src/seed.json) and a hash router, so it runs as a static page.
import os, re, shutil, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'web')
# kp-themes comes only through chassis-rs (Kenny, 19/10/2026): its files are
# read from the kit's static folder, as the server serves them at /static/kp/.
STATIC = os.environ['CHASSIS_STATIC']
def src(rel):
    return os.path.join(STATIC, rel[len('static/'):]) if rel.startswith('static/') else os.path.join(SRC, rel)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
shutil.rmtree(OUT, ignore_errors=True)
# Collect files reachable from index.html (imports, links, css urls).
need = set()
def add(rel):
    rel = os.path.normpath(rel)
    if rel in need or not os.path.exists(src(rel)): return
    need.add(rel)
    if rel.endswith('.js'):
        s = open(src(rel)).read()
        for m in re.finditer(r'''(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+\.js)["']''', s):
            ref(rel, m.group(1))
    if rel.endswith('.css'):
        s = open(src(rel)).read()
        for m in re.finditer(r'''url\(\s*['"]?([^'")]+)['"]?\s*\)''', s):
            u = m.group(1)
            if not u.startswith('data:') and not u.startswith('#'): ref(rel, u.split('?')[0].split('#')[0])
def ref(frm, u):
    if u.startswith('/'): add(u.lstrip('/'))
    elif u.startswith('.'): add(os.path.join(os.path.dirname(frm), u))
html = open(os.path.join(SRC, 'index.html')).read()
for m in re.finditer(r'''(?:href|src)="(/[^"]+)"''', html): ref('index.html', m.group(1))
for f in os.listdir(os.path.join(SRC, 'js/pages')): add('js/pages/' + f)
add('js/main.js')
def rel_from(frm, target):
    r = os.path.relpath(target, os.path.dirname(frm) or '.')
    return r if r.startswith('.') else './' + r
for rel in sorted(need):
    s_path = src(rel); d_path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(d_path), exist_ok=True)
    if rel.endswith(('.js', '.css')):
        s = open(s_path).read()
        s = re.sub(r'''(["'(])/((?:static/kp|js|css|img)/[^"')]+)''', lambda m: m.group(1) + rel_from(rel, m.group(2)), s)
        # fetch() resolves against the document, not the module.
        s = re.sub(r'fetch\("(?:\.\./)+(static/kp/[^"]+)"', r'fetch("./\1"', s)
        if rel == 'js/main.js':
            s = s.replace('history.pushState(null, "", href);', 'location.hash = href;')
            s = s.replace('location.pathname', 'pvPath()').replace('new URLSearchParams(location.search)', 'new URLSearchParams(pvSearch())')
            s = s.replace('addEventListener("popstate", () => void render());', 'addEventListener("hashchange", () => void render());')
            s += '\nfunction pvRoute() { return (location.hash.slice(1) || "/"); }\nfunction pvPath() { return new URL(pvRoute(), "http://x").pathname; }\nfunction pvSearch() { return new URL(pvRoute(), "http://x").search; }\n'
        open(d_path, 'w').write(s)
    else:
        shutil.copy(s_path, d_path)
html = html.replace('<script src="/static/theme-boot.js"></script>', '<script src="theme-boot.js"></script>\n    <script src="preview-server.js"></script>')
html = re.sub(r'''(href|src)="/((?:static/kp|js|css|img)/[^"]+)"''', r'\1="./\2"', html)
open(os.path.join(OUT, 'index.html'), 'w').write(html)
shutil.copy(os.path.join(STATIC, 'theme-boot.js'), os.path.join(OUT, 'theme-boot.js'))
seed = open(os.path.join(ROOT, 'src', 'seed.json')).read()
srv = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview-server.js')).read().replace('__SEED__', seed)
open(os.path.join(OUT, 'preview-server.js'), 'w').write(srv)
files = sum(len(fs) for _, _, fs in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
print(files, 'files', round(size / 1e6, 2), 'MB')
