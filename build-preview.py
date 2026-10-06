"""בונה קובץ HTML יחיד שכולל הכול (עיצוב, ספריות, קוד ונתונים), לתצוגה מקדימה.
הרצה: python3 build-preview.py
"""
import base64
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


brand_css = read('fonts/brand.css')
for name in ('Regular', 'Medium', 'Bold'):
    filename = 'FbHachaluzim-' + name + '.otf'
    encoded = base64.b64encode(open(os.path.join(ROOT, 'fonts', filename), 'rb').read()).decode()
    brand_css = brand_css.replace("url('" + filename + "')", "url('data:font/otf;base64," + encoded + "')")
screen_css = read('css/screen.css').replace("@import url('../fonts/brand.css');", brand_css)
html = read('index.html')

html = re.sub(r'\?v=[\d.]+"', '"', html)
html = html.replace('<link rel="stylesheet" href="css/screen.css">',
                    '<style>\n' + screen_css + '\n</style>')

inline = {
    'announcements': json.loads(read('data/announcements.json')),
    'daily': json.loads(read('data/daily.json')),
}
data_script = '<script>window.INLINE_DATA = ' + json.dumps(inline, ensure_ascii=False) + ';</script>'


def inline_script(match):
    src = match.group(1)
    code = read(src).replace('</script', '<\\/script')
    return '<script>\n' + code + '\n</script>'


html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)

import base64
with open(os.path.join(ROOT, 'img/logo-window.png'), 'rb') as f:
    html = html.replace('src="img/logo-window.png"', 'src="data:image/png;base64,' + base64.b64encode(f.read()).decode() + '"')
with open(os.path.join(ROOT, 'img/jaffa.jpg'), 'rb') as f:
    html = html.replace("url('../img/jaffa.jpg')", "url('data:image/jpeg;base64," + base64.b64encode(f.read()).decode() + "')")
# הנתונים צריכים להיטען לפני app.js
html = html.replace('<script>\n(function () {\n  var C = CONFIG;', data_script + '\n<script>\n(function () {\n  var C = CONFIG;', 1)

with open(os.path.join(ROOT, 'preview.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('preview.html', len(html), 'bytes')
