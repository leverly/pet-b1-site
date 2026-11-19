"""Emit src/data-words.js from the parsed JSON."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
words = json.load(open(os.path.join(HERE, 'pet_words.json'), encoding='utf-8'))
topics = json.load(open(os.path.join(HERE, 'pet_topics.json'), encoding='utf-8'))

TOPIC_ZH = {
    'clothes-and-accessories': ('衣物与配饰', '衣'),
    'colours': ('颜色', '色'),
    'communications-and-technology': ('通讯与技术', '技'),
    'education': ('教育与学习', '学'),
    'entertainment-and-media': ('娱乐与媒体', '娱'),
    'environment': ('环境', '境'),
    'food-and-drink': ('食物与饮品', '食'),
    'health-medicine-and-exercise': ('健康与运动', '健'),
    'hobbies-and-leisure': ('爱好与休闲', '闲'),
    'house-and-home': ('房屋与家居', '家'),
    'language': ('语言', '语'),
    'personal-feelings-opinions-and-experiences-adjectives': ('情感与观点', '情'),
    'places-buildings': ('场所·建筑', '楼'),
    'places-countryside': ('场所·乡村', '乡'),
    'places-town-and-city': ('场所·城镇', '城'),
    'services': ('服务', '服'),
    'shopping': ('购物', '购'),
    'sport': ('运动', '运'),
    'the-natural-world': ('自然世界', '然'),
    'time': ('时间', '时'),
    'travel-and-transport': ('旅行与交通', '行'),
    'weather': ('天气', '天'),
    'work-and-jobs': ('工作与职业', '职'),
}

# count per topic
tcount = {t['id']: len(t['words']) for t in topics}

out_topics = []
for t in topics:
    zh, icon = TOPIC_ZH.get(t['id'], (t['name'], '·'))
    out_topics.append({
        'id': t['id'],
        'name': zh,
        'official': t['name'],
        'icon': icon,
        'count': len(t['words']),
    })

# trim word records to what the site needs
records = []
for w in words:
    records.append({
        'w': w['w'], 'pos': w['pos'], 'posZh': w['posZh'], 't': w['type'],
        'zh': w['zh'], 'tag': w['tag'], 'ph': w['ph'],
        'ex': w['ex'], 'tp': w['topics'], 'al': w['alias'], 'frq': w.get('frq', 0),
    })

b1 = [r for r in records if r['tag'] == 'b1']
b2 = [r for r in records if r['tag'] == 'b2']
b3 = [r for r in records if r['tag'] == 'b3']
phrases = [r for r in records if r['t'] == 'phrase']


def js(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))


lines = []
lines.append('/* 自动生成 — 来源 reference/parse_pet.py + build_words.py，请勿手改 */')
lines.append('export const WORDS = [')
for r in records:
    lines.append(js(r) + ',')
lines.append('];')
lines.append('')
lines.append('export const TOPICS = ' + js(out_topics) + ';')
lines.append('')
lines.append('export const STATS = ' + js({
    'words': len([r for r in records if r['t'] == 'word']),
    'phrases': len(phrases),
    'total': len(records),
    'b1': len(b1),
    'b2': len(b2),
    'b3': len(b3),
    'topics': len(out_topics),
    'withExample': len([r for r in records if r['ex']]),
}) + ';')
lines.append('')

open(os.path.join(ROOT, 'src', 'data-words.js'), 'w', encoding='utf-8').write('\n'.join(lines))
print('words', len(records), 'topics', len(out_topics))
print('bytes', os.path.getsize(os.path.join(ROOT, 'src', 'data-words.js')))
