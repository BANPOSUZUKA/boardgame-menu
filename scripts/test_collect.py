# 수집기 계산 부분 자체 점검: python scripts/test_collect.py
import collect_covers as c
assert c.compact([1, 2, 3, 4, 6]) == '1~4, 6'
assert c.compact([3]) == '3'
assert c.compact([]) == ''
assert c.level_from_weight(1.2) == 1 and c.level_from_weight(2.5) == 4 and c.level_from_weight(4.6) == 7
print('ok')
