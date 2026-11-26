# 수집기 계산 부분 자체 점검: python scripts/test_collect.py
import collect_covers as c
assert c.compact([1, 2, 3, 4, 6]) == '1~4, 6'
assert c.compact([3]) == '3'
assert c.compact([]) == ''
assert c.level_from_weight(1.2) == 1 and c.level_from_weight(2.5) == 4 and c.level_from_weight(4.6) == 7
print('ok')

# BGG 응답 해석 점검 (네트워크 없이 가짜 응답으로)
import xml.etree.ElementTree as ET
THING = '''<items><item type="boardgame" id="1"><name type="primary" value="Test Game"/><image> https://x/img.jpg </image>
<minplayers value="1"/><maxplayers value="4"/><minplaytime value="30"/><maxplaytime value="60"/>
<poll name="suggested_numplayers" totalvotes="10">
<results numplayers="1"><result value="Best" numvotes="0"/><result value="Recommended" numvotes="1"/><result value="Not Recommended" numvotes="9"/></results>
<results numplayers="2"><result value="Best" numvotes="6"/><result value="Recommended" numvotes="4"/><result value="Not Recommended" numvotes="0"/></results>
<results numplayers="3"><result value="Best" numvotes="2"/><result value="Recommended" numvotes="7"/><result value="Not Recommended" numvotes="1"/></results>
<results numplayers="4+"><result value="Best" numvotes="9"/></results></poll>
<statistics><ratings><averageweight value="2.456"/></ratings></statistics></item></items>'''
calls = []
c.bgg = lambda path, **p: (calls.append((path, p)), ET.fromstring(THING if path == 'thing' else '<items><item id="77"/></items>'))[1]
i = c.bgg_info(1)
assert (i['rec'], i['best'], i['weight'], i['votes'], i['image']) == ('2~3', '2', 2.46, 10, 'https://x/img.jpg'), i
assert c.bgg_search('공룡섬 (확.포)') == '77' and calls[-1][1]['query'] == '공룡섬' and calls[-1][1]['exact'] == 1
print('ok bgg')
