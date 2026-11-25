# 우리집 보드게임 메뉴판

- 방문객 주소: https://banposuzuka.github.io/boardgame-menu/
- 기존 주소(같은 화면을 보여 줌): https://script.google.com/macros/s/AKfycbzgjfbQGRrwI9lLVhgDxM8bgfXbm4YePkPsE0A2JoMU3E9dbE2-tCOUIMs6zPQgxS9P/exec
- 관리 현황(표지 상태·빈 정보): https://banposuzuka.github.io/boardgame-menu/admin.html

## 어떻게 움직이나
- **데이터**: 구글 시트가 원본이에요. 구매 기록 시트에 게임을 넣으면 보유 게임으로, 판매가를 적으면 판매로 처리돼요. 게임 정보(난이도·인원·시간·유형·BGG)는 메뉴판 시트 '전체 게임' 탭에서 고쳐요.
- **데이터 창구** `apps-script/Code.js`: 두 시트를 읽어 가격을 뺀 공개용 칸만 JSON으로 넘겨요 (`…/exec?format=json`). 사이트는 15초마다 이걸 읽어요.
  시트 ID와 관리 비밀값은 `apps-script/Secret.js`에만 있고 공개 저장소에는 올리지 않아요.
- **화면** `index.html`: GitHub Pages로 서비스돼요.
- **표지** `covers/`: 실제 이미지 파일(webp)이에요. `scripts/collect_covers.py`가 GitHub Actions로 30분마다 돌면서 새 게임이나 표지 URL이 바뀐 게임만 받아요. 결과는 '표지 관리' 탭과 `covers/manifest.json`에 남겨요.
  - 표지를 바꾸려면 '표지 관리'의 '표지 원본 URL'을 고치면 돼요.
  - BGG 토큰을 저장소 비밀값 `BGG_TOKEN`으로 넣으면 BGG 표지와 BGG 정보(웨이트·추천/최적 인원)로 '전체 게임'의 빈 칸을 채워요. 이미 적힌 값은 덮어쓰지 않아요.

## 고친 뒤 올리기
- 데이터 창구: `cd apps-script; clasp push -f; clasp update-deployment AKfycbzgjfbQGRrwI9lLVhgDxM8bgfXbm4YePkPsE0A2JoMU3E9dbE2-tCOUIMs6zPQgxS9P`
- 화면·수집기: git push 하면 Pages에 몇 분 안에 반영돼요.
- 수집기 점검: `python scripts/test_collect.py`
