"""Parse Cambridge B1 Preliminary (PET) 2025 vocabulary list PDF text.

Input : reference/raw.txt   (pypdf output with <<<PAGE n>>> markers)
Output: reference/pet_entries.json  [{'w','pos','type','posZh','ex':[...],'alias':[...]}]
        reference/pet_topics.json   [{'id','name','words':[...]}]
"""
import re, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
raw = open(os.path.join(HERE, 'raw.txt'), encoding='utf-8').read()

start = raw.find('a/an (det)')
end = [m.start() for m in re.finditer(r'Appendix 1', raw)][-1]
body = raw[start:end]

NOISE = re.compile(
    r'^(Page \d+ of 53'
    r'|B1 Preliminary and Preliminary'
    r'|for Schools Vocabulary'
    r'|List$'
    r'|© CUPA 2025'
    r'|<<<PAGE \d+>>>'
    r'|\S+@\S+$)'
)

POS_TOKENS = {
    'n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'exclam', 'number',
    'abbrev', 'abbr', 'phr v', 'prep phr', 'phr', 'infml', 'n pl', 'aux v',
    'modal v', 'def art', 'indef art', 'ordinal number', 'cardinal number',
    'av', 'mv', 'ad', 'prep phr', 'phrasal v',
}
POS_ALIASES = {'ad': 'adv', 'av': 'aux v', 'mv': 'modal v', 'abbr': 'abbrev',
               'phrasal v': 'phr v'}


def pos_ok(p):
    p = p.strip().lower()
    if p in POS_TOKENS:
        return True
    parts = [x.strip() for x in re.split(r'[,&/]', p) if x.strip()]
    if not parts or len(parts) > 5:
        return False
    return all(x in POS_TOKENS for x in parts)


POS_ZH = {
    'n': '名词', 'v': '动词', 'adj': '形容词', 'adv': '副词', 'prep': '介词',
    'conj': '连词', 'pron': '代词', 'det': '限定词', 'exclam': '感叹词',
    'number': '数词', 'abbrev': '缩写', 'phr v': '动词短语', 'prep phr': '介词短语',
    'phr': '短语', 'infml': '非正式', 'n pl': '名词复数', 'aux v': '助动词',
    'modal v': '情态动词', 'def art': '定冠词', 'indef art': '不定冠词',
    'ordinal number': '序数词', 'cardinal number': '基数词',
}

# ---------------------------------------------------------------- pre-normalise
lines = [l.strip() for l in body.split('\n')]

# column bleed: "direction" + "(n) directly (adv)" -> "direction (n) directly (adv)"
for k in range(len(lines) - 1):
    a, b = lines[k], lines[k + 1]
    if a and b and '(' not in a and b.startswith('(') and re.match(r"^[a-z][a-z'\- ]{0,30}$", a):
        lines[k] = a + ' ' + b
        lines[k + 1] = ''

# join lines with unbalanced parentheses (multi-line headword rows)
joined, buf = [], ''
for s in lines:
    if buf:
        buf += ' ' + s
        if buf.count('(') == buf.count(')'):
            joined.append(buf)
            buf = ''
        continue
    if s and s.count('(') > s.count(')') and not s.startswith('•'):
        buf = s
        continue
    joined.append(s)
if buf:
    joined.append(buf)

# Drop Br/Am English annotations, keeping the Am Eng variant as an alias.
ANN = re.compile(r'\((?:Br|Am) Eng[^()]*\)')


def clean_annotations(s):
    aliases = []
    m = re.search(r'\((?:Br|Am) Eng\)\s*\((?:Br|Am) Eng:\s*([^()]+)\)', s)
    if m:
        aliases += [a.strip() for a in m.group(1).split(',')]
    s2 = ANN.sub('', s)
    # remaining "(Am Eng: xxx)" / "(Br Eng: xxx)"
    for m2 in re.finditer(r'\((?:Br|Am) Eng:\s*([^()]*)\)', s2):
        aliases += [a.strip() for a in m2.group(1).split(',')]
    s2 = re.sub(r'\((?:Br|Am) Eng:[^()]*\)', '', s2)
    return re.sub(r'\s{2,}', ' ', s2).strip(), aliases


ENTRY = re.compile(r'^(?P<w>.*?)\s*\((?P<pos>[^()]{1,64})\)\s*$')
BARE = re.compile(r"^(?P<w>[A-Za-z][A-Za-z'\-]*(?: [A-Za-z'\-\.]+){0,2})$")
# second column of the PDF sometimes lands on the same line:
#   "dinner (n) dinosaur"  /  "direction (n) directly (adv)"
SQUASHED = re.compile(
    r'^(?P<w1>[A-Za-z][A-Za-z\'\-\. ]{0,40}?)\s*\((?P<pos1>[^()]{1,20})\)\s*'
    r'(?P<rest>[A-Za-z][A-Za-z\'\-\. ]{0,40}(?:\s*\([^()]{1,20}\))?)\s*$'
)


def split_squashed(s):
    """'dinner (n) dinosaur (n)' -> ['dinner (n)', 'dinosaur (n)'] ; else None"""
    m = SQUASHED.match(s)
    if not m:
        return None
    w1, pos1, rest = m.group('w1').strip(), m.group('pos1').strip(), m.group('rest').strip()
    if not pos_ok(pos1):
        return None
    if rest.count('(') != rest.count(')'):
        return None
    return [f'{w1} ({pos1})', rest]


entries, seen = [], set()
rejected = []
example_mode = False


def add_entry(w, pos_raw, aliases=()):
    pos_raw = re.sub(r'\s+', ' ', pos_raw.strip().lower())
    if not pos_ok(pos_raw):
        return False
    pos = ', '.join(POS_ALIASES.get(p.strip(), p.strip())
                    for p in re.split(r'[,&]', pos_raw) if p.strip())
    mw = re.match(r'^(?P<base>.*?)\s*(?P<hints>(?:\([^()]*\)\s*)+)$', w.strip())
    if mw and mw.group('base').strip():
        # "depend (on/upon)" -> depend  |  "ad (advertisement)" -> ad + alias
        hints = re.findall(r'\(([^()]*)\)', mw.group('hints'))
        w = mw.group('base').strip()
        aliases = tuple(aliases) + tuple(h for h in hints if len(h) >= 3 and ' ' not in h)
    w = w.strip()
    # "a/an" / "café/cafe" / "lots / a lot" -> main + alias
    if '/' in w:
        parts = [x.strip() for x in w.split('/')]
        if all(p2 and len(p2) >= 1 for p2 in parts) and len(parts) <= 3:
            aliases = tuple(aliases) + tuple(parts[1:])
            w = parts[0]
    variants = [w.strip()] + [a.strip() for a in aliases]
    variants = [v for v in variants if v and len(v) <= 55]
    if not variants:
        return False
    main = variants[0]
    key = main.lower()
    if key in seen:
        return True
    seen.add(key)
    entries.append({
        'w': main,
        'pos': pos,
        'posZh': POS_ZH.get(pos.split(',')[0].strip(), '其他'),
        'type': 'phrase' if ' ' in main else 'word',
        'alias': [v for v in variants[1:] if v.lower() != key],
        'ex': [],
    })
    return True


for raw_line in joined:
    s = raw_line
    if not s or NOISE.match(s):
        continue
    if s.startswith('•'):
        if entries:
            ex = s.lstrip('•').strip()
            # example may swallow the following headword when two columns bleed
            mbl = re.search(
                r'(?P<ex>.+[.!?\'”"])\s+(?P<hw>[a-z][a-z\-\']{1,20}(?: [a-z][a-z\-\']{1,20})?)'
                r'\s+\((?P<pos>[^()]{1,20})\)\s*$', ex)
            if mbl and pos_ok(mbl.group('pos')):
                add_entry(mbl.group('hw').strip(), mbl.group('pos'))
                ex = mbl.group('ex').strip()
            entries[-1]['ex'].append(re.sub(r'\s*\((?:adv|adj|n|v|prep|conj|pron|det|exclam|phr v|phr)\)\s*$', '', ex))
        example_mode = not re.search(r'[.!?\'"”’]$', s)
        continue
    if len(s) == 1 and s.isupper():
        example_mode = False
        continue

    cleaned, aliases = clean_annotations(s)

    # PDF two-column bleed: try to split before anything else
    sq = split_squashed(cleaned)
    if sq:
        ok = False
        for part in sq:
            m2 = ENTRY.match(part)
            if m2:
                ok = add_entry(m2.group('w').strip().strip('.,;:'), m2.group('pos')) or ok
            else:
                c2, a2 = clean_annotations(part)
                m3 = ENTRY.match(c2)
                if m3:
                    ok = add_entry(m3.group('w').strip().strip('.,;:'), m3.group('pos'), a2) or ok
        if ok:
            example_mode = False
            continue

    m = ENTRY.match(cleaned)
    if not m and not re.search(r'[.!?,;:’\'"]$', cleaned):
        mb = BARE.match(cleaned)
        if mb and cleaned[:1].islower() and example_mode is False:
            add_entry(cleaned, 'n')  # bare headword, PDF dropped the pos
            continue
    if not m:
        # example sentence continuation, or noise
        if example_mode and entries and not s[:1].isupper():
            entries[-1]['ex'][-1] += ' ' + s
            example_mode = not re.search(r'[.!?\'"”’]$', s)
        else:
            rejected.append(s)
        example_mode = False
        continue

    w = m.group('w').strip().strip('.,;:')
    # headwords of the form "ad (advertisement)" -> alias from the inner parentheses
    inner = re.findall(r'\(([^()]{2,30})\)', w)
    clean_w = re.sub(r'\([^()]*\)', '', w).strip()
    add_entry(clean_w, m.group('pos'), inner + aliases)
    example_mode = False

words = [e for e in entries if e['type'] == 'word']
phrases = [e for e in entries if e['type'] == 'phrase']
print(f'单词 {len(words)} | 短语 {len(phrases)} | 合计 {len(entries)}')
print('未识别行', len(rejected))
for r in rejected[:20]:
    print('   !', r)

# final tidy
_tidy = []
for e in entries:
    e['w'] = re.sub(r'\s+', ' ', e['w'].strip())
    if e['w'].lower() in JUNK_PHRASE:
        continue
    if e['w'].lower() in ('while, whilst', 'step over/in/on/out of'):
        continue
    _tidy.append(e)
entries = _tidy

json.dump(entries, open(os.path.join(HERE, 'pet_entries.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0)

# ------------------------------------------------------------- Appendix 2 topics
tstart = [m.start() for m in re.finditer(r'Appendix 2', raw)][-1]
tbody = raw[tstart:]
topic_text = tbody[tbody.find('Topic Lists') + len('Topic Lists'):]

TOPIC_HEADERS = [
    'Clothes and Accessories',
    'Colours',
    'Communications and Technology',
    'Education',
    'Entertainment and Media',
    'Environment',
    'Food and Drink',
    'Health, Medicine and Exercise',
    'Hobbies and Leisure',
    'House and Home',
    'Language',
    'Personal Feelings, Opinions and Experiences (Adjectives)',
    'Places: Buildings',
    'Places: Countryside',
    'Places: Town and City',
    'Services',
    'Shopping',
    'Sport',
    'The Natural World',
    'Time',
    'Travel and Transport',
    'Weather',
    'Work and Jobs',
]
TOPIC_NAMES = {
    'Personal Feelings, Opinions and Experiences (Adjectives)': 'Personal Feelings & Opinions',
}
headers = sorted(TOPIC_HEADERS, key=len, reverse=True)

tlines = [l.strip() for l in topic_text.split('\n')]
cur, topics = None, []
skip_cont = False
for s in tlines:
    if not s or NOISE.match(s):
        continue
    if s in headers:
        cur = {'id': re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-'),
               'name': TOPIC_NAMES.get(s, s), 'official': s, 'words': []}
        topics.append(cur)
        skip_cont = False
        continue
    if cur is None:
        continue
    if s.startswith('•') or (len(s) == 1 and s.isupper()):
        continue
    cur['words'].append(s)

# words in the topic lists carry "(v)" / "(adj)" hints — strip them and dedupe
JUNK_PHRASE = {'of the school', 'of the class', 'while, whilst'}
for t in topics:
    seen_t, out = set(), []
    for w in t['words']:
        w2 = re.sub(r'\s*\([^()]*\)', '', w).strip().rstrip(',').strip()
        w2 = re.sub(r'\s+', ' ', w2)
        if not w2:
            continue
        k = w2.lower()
        if k in seen_t:
            continue
        seen_t.add(k)
        out.append(w2)
    t['words'] = out

for t in topics:
    t['count'] = len(t['words'])

print('\n话题', len(topics))
for t in topics:
    print(f"  {t['name']:36s} {t['count']:4d}")

json.dump(topics, open(os.path.join(HERE, 'pet_topics.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
