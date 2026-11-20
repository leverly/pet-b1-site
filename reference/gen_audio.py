"""Generate Edge TTS audio for every PET word/phrase.

Output:
  audio/<slug>.mp3    one short file per entry, containing a SINGLE reading
  src/data-audio.js   word -> file path map consumed by the site

Why a single reading instead of three baked in:
  baking 3 repetitions tripled both generation time and repo size (~142MB).
  The player repeats the same file 3x instead, which sounds identical to the
  learner and keeps the repo around 30MB.

Compression: mono + 32kbps is plenty for a single spoken word and cuts the
file to ~9KB each.
"""
import asyncio, json, os, re, sys, hashlib, subprocess
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'audio')
VOICE = 'en-GB-SoniaNeural'     # 剑桥考试偏英音
CONCURRENCY = 6


def slug(w):
    base = re.sub(r'[^a-z0-9]+', '-', w.lower()).strip('-')[:40] or 'w'
    h = hashlib.md5(w.encode('utf-8')).hexdigest()[:6]
    return f'{base}-{h}'


def compress(path):
    """Re-encode to mono 32kbps; ignore failures (keep original)."""
    tmp = path + '.tmp.mp3'
    try:
        subprocess.run(
            ['ffmpeg', '-v', 'quiet', '-y', '-i', path, '-ac', '1', '-b:a', '32k', tmp],
            check=True, timeout=30,
        )
        if os.path.getsize(tmp) > 500:
            os.replace(tmp, path)
        elif os.path.exists(tmp):
            os.remove(tmp)
    except Exception:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


async def synth(w, path, sem):
    async with sem:
        if os.path.exists(path) and os.path.getsize(path) > 500:
            return 'skip'
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(w, VOICE, rate='-10%')
                buf = bytearray()
                async for ch in c.stream():
                    if ch['type'] == 'audio':
                        buf += ch['data']
                if len(buf) < 500:
                    raise RuntimeError('too small')
                with open(path, 'wb') as f:
                    f.write(buf)
                compress(path)
                return 'ok'
            except Exception as e:
                if attempt == 2:
                    return 'fail:' + type(e).__name__
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    words = json.load(open(os.path.join(HERE, 'pet_words.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)

    targets = [(e['w'], os.path.join(OUT, slug(e['w']) + '.mp3')) for e in words]

    sem = asyncio.Semaphore(CONCURRENCY)
    t0 = asyncio.get_event_loop().time()
    results = await asyncio.gather(*[synth(w, p, sem) for w, p in targets])

    ok = sum(1 for r in results if r == 'ok')
    skip = sum(1 for r in results if r == 'skip')
    fail = [(t[0], r) for t, r in zip(targets, results) if r.startswith('fail')]
    print(f'新生成 {ok} | 跳过 {skip} | 失败 {len(fail)} | 耗时 {asyncio.get_event_loop().time()-t0:.0f}s')
    for w, r in fail[:10]:
        print('  FAIL', w, r)

    mp = {}
    for w, p in targets:
        if os.path.exists(p) and os.path.getsize(p) > 500:
            mp[w] = 'audio/' + os.path.basename(p)
    with open(os.path.join(ROOT, 'src', 'data-audio.js'), 'w', encoding='utf-8') as f:
        f.write('/* 自动生成 — reference/gen_audio.py；请勿手改 */\n')
        f.write('export const AUDIO = ' + json.dumps(mp, ensure_ascii=False, separators=(',', ':')) + ';\n')
    total = sum(os.path.getsize(p) for w, p in targets if os.path.exists(p))
    print(f'音频总计 {total/1024/1024:.1f}MB，词条 {len(mp)}/{len(targets)}')
    return 0 if not fail else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
