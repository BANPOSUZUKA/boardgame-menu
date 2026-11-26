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

## 새 게임 정보·표지 찾는 순서
1. 수집기가 한국어 이름으로 BGG를 검색해요(자동).
2. 못 찾으면 크롬으로 **구글**에서 게임 이름을 검색해요. Claude의 웹 검색 도구는 미국 기준이라 한국 사이트를 놓쳐요.
3. 이름만으로 안 나오면 항상 뒤에 **"보드게임"**을 붙여 다시 검색해요(예: "디그디그딥 보드게임" → 텀블벅).
4. 그래도 없으면 출판사·보드라이프·보드엠·쿠팡·텀블벅을 붙이거나 띄어쓰기를 바꿔요.
5. 국내 페이지에 BGG 링크나 영어 이름이 있으면 '전체 게임'에 BGG ID를 적어요. 나머지는 수집기가 채워요.
6. BGG에 없는 국내 게임은 국내 판매·출판사 페이지로 표지·인원·시간·유형을 직접 채워요.
7. 웹 어디에도 없을 때만 검색한 내용을 적어 보고해요.

보유 게임은 대부분 **신판**(최신판·기념판)이에요. 표지와 BGG ID는 최신판 기준으로 고르고, 구판 일러스트는 쓰지 않아요(예: 버건디의 성 = 20주년판, 젝스님트 = 30주년판). 표지는 한국판을 먼저 찾아요(제작사 → 국내 유통사·판매처 → 해외 판매처). 매주 금요일 17시 예약 작업(boardgame-menu-weekly, Sonnet 5.5)이 이 순서대로 남은 게임을 정리해요.

## 고친 뒤 올리기
- 데이터 창구: `cd apps-script; clasp push -f; clasp update-deployment AKfycbzgjfbQGRrwI9lLVhgDxM8bgfXbm4YePkPsE0A2JoMU3E9dbE2-tCOUIMs6zPQgxS9P`
- 화면·수집기: git push 하면 Pages에 몇 분 안에 반영돼요.
- 수집기 점검: `python scripts/test_collect.py`
