"""בונה קובץ HTML יחיד שכולל הכול (עיצוב, ספריות, קוד ונתונים), לתצוגה מקדימה.
הרצה: python3 build-preview.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


html = read('index.html')

html = html.replace('<link rel="stylesheet" href="css/screen.css">',
                    '<style>\n' + read('css/screen.css') + '\n</style>')

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
# הנתונים צריכים להיטען לפני app.js
html = html.replace('<script>\n(function () {\n  var C = CONFIG;', data_script + '\n<script>\n(function () {\n  var C = CONFIG;', 1)

with open(os.path.join(ROOT, 'preview.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('preview.html', len(html), 'bytes')
