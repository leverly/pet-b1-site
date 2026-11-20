"""Generate Edge TTS audio for every PET word/phrase.

Output:
  audio/<slug>.mp3    one file per entry, 3 repetitions joined with a pause
  src/data-audio.js   slug -> file map consumed by the site

Design notes:
- 3 repetitions are baked into a single mp3 at build time, so the page only
  plays one file per word. Calling the network 3x per question at runtime
  would be slow and fragile.
- Resumable: files already on disk are skipped, so an interrupted run
  continues where it stopped.
- Concurrency is capped to stay polite to the endpoint.
"""
import asyncio, json, os, re, sys, hashlib
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'audio')
VOICE = 'en-GB-SoniaNeural'     # 剑桥考试偏英音
GAP = '  '                      # 单词之间的停顿（SSML 里是空白，靠 rate 控制）
CONCURRENCY = 6


def slug(w):
    """Filesystem-safe, collision-resistant name."""
    base = re.sub(r'[^a-z0-9]+', '-', w.lower()).strip('-')[:40] or 'w'
    h = hashlib.md5(w.encode('utf-8')).hexdigest()[:6]
    return f'{base}-{h}'


def ssml_text(w, times=3):
    # edge-tts 直接吃纯文本；用逗号制造自然停顿
    return ', '.join([w] * times)


async def synth(w, path, sem):
    async with sem:
        if os.path.exists(path) and os.path.getsize(path) > 800:
            return 'skip'
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(ssml_text(w), VOICE, rate='-10%')
                buf = bytearray()
                async for ch in c.stream():
                    if ch['type'] == 'audio':
                        buf += ch['data']
                if len(buf) < 500:
                    raise RuntimeError('too small')
                with open(path, 'wb') as f:
                    f.write(buf)
                return 'ok'
            except Exception as e:
                if attempt == 2:
                    return 'fail:' + type(e).__name__
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    words = json.load(open(os.path.join(HERE, 'pet_words.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)

    targets = []
    for e in words:
        w = e['w']
        targets.append((w, os.path.join(OUT, slug(w) + '.mp3')))

    sem = asyncio.Semaphore(CONCURRENCY)
    t0 = asyncio.get_event_loop().time()
    results = await asyncio.gather(*[synth(w, p, sem) for w, p in targets])

    ok = sum(1 for r in results if r == 'ok')
    skip = sum(1 for r in results if r == 'skip')
    fail = [(t[0], r) for t, r in zip(targets, results) if r.startswith('fail')]
    print(f'新生成 {ok} | 已存在跳过 {skip} | 失败 {len(fail)} | 耗时 {asyncio.get_event_loop().time()-t0:.0f}s')
    for w, r in fail[:10]:
        print('  FAIL', w, r)

    # emit the map only for entries that actually have audio
    mp = {}
    for w, p in targets:
        if os.path.exists(p) and os.path.getsize(p) > 800:
            mp[w] = 'audio/' + os.path.basename(p)
    out = os.path.join(ROOT, 'src', 'data-audio.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* 自动生成 — reference/gen_audio.py；请勿手改 */\n')
        f.write('export const AUDIO = ' + json.dumps(mp, ensure_ascii=False, separators=(',', ':')) + ';\n')
    total = sum(os.path.getsize(p) for w, p in targets if os.path.exists(p))
    print(f'音频总计 {total/1024/1024:.1f}MB，词条 {len(mp)}/{len(targets)}')
    return 0 if not fail else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
