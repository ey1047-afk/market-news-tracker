# 시장동향 실시간 크롤링·파싱 (Market News Tracker)

Google News RSS를 서버(API route)에서 실시간으로 호출·파싱해 키워드별 언급량과
헤드라인을 **대시보드 형태**로 정리해 보여주는 웹앱입니다. Apple 디자인 가이드를
기준으로 스타일링했습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 접속.

## 이미 GitHub + Vercel로 배포해두신 경우 (재배포 방법)

1. GitHub 저장소 페이지로 이동합니다.
2. 이번에 바뀐 파일들을 같은 경로에 다시 업로드합니다 (덮어쓰기):
   - `app/page.js`
   - `app/layout.js`
   - `app/globals.css` (새 파일)
   - `app/api/news/route.js`
   - `README.md`
   저장소 페이지에서 각 폴더에 들어가 "Add file → Upload files"로 같은 이름의
   파일을 올리면 자동으로 덮어써집니다. 또는 저장소 전체를 삭제 후 이 zip의
   내용을 통째로 다시 업로드해도 됩니다.
3. "Commit changes"로 저장하면, Vercel이 자동으로 변경을 감지해서
   **1~2분 안에 자동 재배포**합니다. 별도로 Vercel에서 뭔가 누를 필요 없습니다.
4. 배포가 끝나면 기존 사이트 주소를 새로고침해서 확인하면 됩니다.

## 이번에 추가된 것

- **대시보드**: 핵심 지표(수집 헤드라인 수 등), 키워드 언급 순위(막대그래프),
  헤드라인에서 자동 추출한 "시장동향 키워드" 태그 클라우드, 검색어별 수집 현황,
  헤드라인 목록, 원본 XML 검증 샘플을 카드 형태로 정리
- **진행 상황 표시**: 실행 버튼을 누르면 키워드별로 대기 중 → 수집 중 → 완료/실패
  상태가 실시간으로 표시됨
- **Apple 디자인 가이드 적용**: Action Blue(#0066cc) 단일 액센트, SF Pro 폰트,
  hairline 테두리의 화이트 카드, pill 버튼
- **최대 30개** 키워드 지원

## 구조

- `app/page.js` — 키워드 입력, 진행 상황, 대시보드 UI (클라이언트 컴포넌트)
- `app/globals.css` — Apple 디자인 토큰 기반 전역 스타일
- `app/api/news/route.js` — 키워드 1개를 받아 Google News RSS를 호출·파싱하는 서버 API
  (클라이언트가 키워드마다 순서대로 호출하면서 진행 상황을 표시)
