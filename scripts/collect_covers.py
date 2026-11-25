"""표지·BGG 정보 자동 수집기 (GitHub Actions에서 30분마다, 로컬에서도 실행 가능).

1. 데이터 창구(Apps Script)에서 보유 게임 목록을 받는다.
2. 표지 파일이 없거나 시트의 '표지 원본 URL'이 바뀐 게임만 이미지를 받아 webp로 줄여 covers/에 저장한다.
   BGG_TOKEN이 있으면 BGG 표지를 먼저 쓰고, 없으면 시트의 표지 원본 URL을 쓴다.
3. 결과(저장 상태·실패 원인)를 covers/manifest.json과 시트 '표지 관리'에 남긴다.
4. BGG_TOKEN이 있으면 '전체 게임'의 빈 칸만 BGG 정보로 채운다(적힌 값은 덮어쓰지 않음).

환경 변수: API_URL(필수), ADMIN_SECRET(시트 기록용), BGG_TOKEN(선택)
"""
import hashlib, io, json, os, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COVERS = os.path.join(ROOT, 'covers')
MANIFEST = os.path.join(COVERS, 'manifest.json')
API_URL = os.environ.get('API_URL', '')
SECRET = os.environ.get('ADMIN_SECRET', '')
BGG_TOKEN = os.environ.get('BGG_TOKEN', '')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
KST = timezone(timedelta(hours=9))
MAX_BYTES = 20 * 1024 * 1024


def http(url, headers=None, data=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError('파일이 20MB보다 큼')
        return body


def bgg(path, **params):
    url = 'https://boardgamegeek.com/xmlapi2/' + path + '?' + urllib.parse.urlencode(params)
    for _ in range(4):
        try:
            return ET.fromstring(http(url, {'Authorization': 'Bearer ' + BGG_TOKEN}))
        except urllib.error.HTTPError as e:
            if e.code in (202, 429, 503):  # BGG가 아직 준비 중이거나 요청이 많을 때
                time.sleep(5)
                continue
            raise
    raise RuntimeError('BGG 응답 지연')


def bgg_info(bgg_id):
    item = bgg('thing', id=bgg_id, stats=1).find('item')
    if item is None:
        return None
    val = lambda tag: (item.find(tag).get('value') if item.find(tag) is not None else '')
    rec, best = [], []
    for res in item.findall("poll[@name='suggested_numplayers']/results"):
        n = res.get('numplayers', '')
        if not n.isdigit():
            continue
        votes = {r.get('value'): int(r.get('numvotes', 0)) for r in res.findall('result')}
        b, r, nr = votes.get('Best', 0), votes.get('Recommended', 0), votes.get('Not Recommended', 0)
        if b + r + nr == 0:
            continue
        if b + r > nr:
            rec.append(int(n))
        if b >= r and b >= nr and b > 0:
            best.append(int(n))
    weight = item.find('statistics/ratings/averageweight')
    return {
        'name': next((n.get('value') for n in item.findall('name') if n.get('type') == 'primary'), ''),
        'image': (item.findtext('image') or '').strip(),
        'minp': val('minplayers'), 'maxp': val('maxplayers'),
        'mint': val('minplaytime'), 'maxt': val('maxplaytime'),
        'weight': round(float(weight.get('value')), 2) if weight is not None and float(weight.get('value') or 0) > 0 else '',
        'rec': compact(rec), 'best': compact(best),
    }


def compact(nums):
    """[1,2,3,4,6] -> '1~4, 6'"""
    out, nums = [], sorted(set(nums))
    for n in nums:
        if out and n == out[-1][1] + 1:
            out[-1][1] = n
        else:
            out.append([n, n])
    return ', '.join(f'{a}' if a == b else f'{a}~{b}' for a, b in out)


def level_from_weight(w):
    # 새 게임 임시 분류. 사용자가 룰 부담·전략 깊이를 보고 시트에서 고친다.
    for i, top in enumerate([1.5, 2.0, 2.5, 3.0, 3.5, 4.0], start=1):
        if w < top:
            return i
    return 7


def save_cover(key, url):
    raw = http(url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    if img.width < 120 or img.height < 120:
        raise ValueError(f'이미지가 너무 작음 ({img.width}x{img.height})')
    img = img.convert('RGBA') if img.mode in ('P', 'LA') else img
    if img.mode == 'RGBA':
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    img = img.convert('RGB')
    img.thumbnail((480, 480), Image.LANCZOS)
    name = hashlib.sha1(key.encode()).hexdigest()[:12] + '.webp'
    img.save(os.path.join(COVERS, name), 'WEBP', quality=80, method=6)
    Image.open(os.path.join(COVERS, name)).verify()  # 저장된 파일이 다시 열리는지 확인
    return name, img.size


def post(ops):
    if not SECRET or not ops:
        return
    body = json.dumps({'secret': SECRET, 'ops': ops}).encode()
    res = json.loads(http(API_URL.split('?')[0], {'Content-Type': 'application/json'}, body, timeout=120))
    if not res.get('ok'):
        print('시트 기록 실패:', res, file=sys.stderr)


def main():
    os.makedirs(COVERS, exist_ok=True)
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    games = json.loads(http(API_URL))['games']
    now = datetime.now(KST).strftime('%Y-%m-%d %H:%M')
    ops = []
    for g in games:
        key, name, src = g['key'], g['name'], g.get('coverSrc', '').strip()
        info = None
        if BGG_TOKEN and g.get('bggId'):
            try:
                info = bgg_info(g['bggId'])
            except Exception as e:
                print(name, 'BGG 조회 실패:', e, file=sys.stderr)
        if info:
            fields = {'BGG ID': g['bggId'], '영어 원제': info['name'], 'BGG 웨이트 (조회분)': info['weight'],
                      'BGG 추천 인원': info['rec'], 'BGG 최적 인원': info['best'],
                      'BGG 인원 투표 출처': f"https://boardgamegeek.com/boardgame/{g['bggId']}",
                      '최소 인원': info['minp'], '최대 인원': info['maxp'], '최대 예상 시간(분)': info['maxt']}
            if not g.get('inMenu') or not g.get('players'):
                fields['인원'] = info['minp'] if info['minp'] == info['maxp'] else f"{info['minp']}~{info['maxp']}"
            if not g.get('inMenu') or not g.get('time'):
                fields['플레이 시간 (예상)'] = f"{info['mint']}분" if info['mint'] == info['maxt'] else f"{info['mint']}~{info['maxt']}분"
            if info['weight'] and not g.get('level'):
                lv = level_from_weight(info['weight'])
                fields['난이도'] = f"{lv} · {['', '초경량', '경량', '전략 입문', '중급', '중상급', '상급', '헤비'][lv]}"
            ops.append({'sheet': '전체 게임', 'name': name, 'fields': fields})
        elif not g.get('inMenu'):
            ops.append({'sheet': '전체 게임', 'name': name, 'fields': {}})  # 새 게임 행만 추가

        entry = manifest.get(key, {})
        if entry.get('file') and os.path.exists(os.path.join(COVERS, entry['file'])) and (not src or entry.get('source') == src):
            continue  # 이미 받은 표지는 다시 받지 않는다. 시트의 표지 URL을 바꾸면 그때만 새로 받는다.
        # 시트에 적힌 URL(사용자가 고른 판본)이 먼저, 없으면 BGG 표지. 새 게임은 시트 칸이 비어 있어 BGG가 쓰인다.
        candidates = [('sheet', src)] if src else []
        if info and info['image']:
            candidates.append(('bgg', info['image']))
        errors = []
        for origin, url in candidates:
            try:
                file, size = save_cover(key, url)
                manifest[key] = {'name': name, 'file': file, 'source': url, 'origin': origin, 'size': list(size), 'saved': now}
                ops.append({'sheet': '표지 관리', 'name': name, 'overwrite': ['저장 상태', '저장 일시', '저장 이미지 파일'],
                            'fields': {'저장 상태': '저장 완료', '저장 일시': now, '저장 이미지 파일': 'covers/' + file,
                                       '표지 원본 URL': url}})
                print('저장', name, size)
                break
            except Exception as e:
                errors.append(f'{origin}: {e}'[:200])
        else:
            reason = ' / '.join(errors) or ('표지 원본 URL 없음' + ('' if BGG_TOKEN else ' · BGG 토큰 없음'))
            if entry.get('reason') != reason:
                manifest[key] = {**entry, 'name': name, 'status': '실패', 'reason': reason, 'checked': now}
                ops.append({'sheet': '표지 관리', 'name': name, 'overwrite': ['저장 상태', '저장 일시'],
                            'fields': {'저장 상태': '수집 실패: ' + reason, '저장 일시': now}})
            print('실패', name, reason, file=sys.stderr)
    json.dump(dict(sorted(manifest.items())), open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for i in range(0, len(ops), 25):
        post(ops[i:i + 25])


if __name__ == '__main__':
    main()
