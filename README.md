# 시장동향 실시간 크롤링·파싱 (Market News Tracker)

Google News RSS(공개 피드)를 서버에서 실시간으로 호출·파싱해 키워드별 언급량과
헤드라인을 보여주는 대시보드입니다. 원본 데모(aichamp-portfolio.vercel.app/live)와
동일한 구조이며, **검색 키워드를 화면에서 직접 수정**할 수 있습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 배포 (Vercel)

1. GitHub 저장소에 이 폴더를 push
2. https://vercel.com 에서 New Project → 해당 저장소 선택 → Deploy
   (설정 변경 없이 기본값으로 바로 배포됩니다)

## 구조

- `app/page.js` — 키워드 입력창 + 실행 버튼 + 결과 대시보드 (클라이언트 컴포넌트)
- `app/api/news/route.js` — 서버에서 Google News RSS를 호출·XML 파싱·집계하는 API
  (브라우저에서 직접 news.google.com을 호출하면 CORS로 막히기 때문에,
  반드시 서버(API route)를 거쳐야 합니다)

## 동작 방식

1. 사용자가 키워드(쉼표로 구분, 최대 10개)를 입력하고 실행 버튼 클릭
2. `/api/news`가 키워드별로 `https://news.google.com/rss/search?q=...` 를 호출
3. 받은 XML에서 `<item>` 블록(제목/링크/날짜/출처)을 정규식으로 추출
4. 각 헤드라인 제목에 키워드가 등장한 횟수를 집계 → "언급 순위"
5. 결과(집계, 헤드라인, 원본 XML 샘플)를 JSON으로 반환 → 화면에 표시

## 커스터마이징 아이디어

- 키워드 대신 **브랜드명 리스트**를 별도로 관리해서 "언급 브랜드 순위"만 따로 집계
- 특정 업종(예: 언더웨어, 화장품 등)에 맞춘 기본 키워드 프리셋 버튼 추가
- 크론(Vercel Cron)으로 매일 자동 실행 후 결과를 DB에 저장해 추이 그래프로 표시
