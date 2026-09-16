"use client";

import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "fashion", label: "패션 · 속옷", defaultKeywords: "언더웨어, 속옷 브랜드, 이너웨어, 언더웨어 신상" },
  { id: "publishing", label: "출판", defaultKeywords: "출판, 도서, 신간, 베스트셀러" },
  { id: "snack", label: "과자", defaultKeywords: "과자, 스낵, 쿠키, 신제품 과자" },
  { id: "shipping", label: "해운", defaultKeywords: "해운, 컨테이너선, 해운업계, 운임" },
  { id: "logistics", label: "물류", defaultKeywords: "물류, 포워딩, 물류센터, 택배" },
];

const MAX_KEYWORDS_PER_CATEGORY = 15;
const STORAGE_KEY = "market-news-tracker-category-keywords";
const PAGE_SIZE = 20;
const RANK_BADGES = ["🥇", "🥈", "🥉"];

function extractTrending(headlines) {
  const stopwords = new Set([
    "속보", "단독", "포토", "영상", "오늘", "이슈", "기자", "뉴스", "보도",
    "오전", "오후", "종합", "특집", "인터뷰", "분석", "전망", "현장", "화제",
    "한국", "글로벌", "확대", "위해", "관련", "이번", "최근", "진행", "계획",
    "예정", "가능", "전체", "지금", "내년", "올해", "우리", "이후", "당시",
  ]);
  const domainFragments = new Set([
    "kr", "co", "com", "net", "org", "io", "www", "daum", "yna", "news", "naver",
  ]);
  const freq = {};
  headlines.forEach((h) => {
    const lastDash = h.title.lastIndexOf(" - ");
    const cleanTitle = lastDash > 0 ? h.title.slice(0, lastDash) : h.title;
    const tokens = cleanTitle
      .replace(/[\[\]\(\)|"'“”‘’·,.!?~]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    tokens.forEach((t) => {
      const clean = t.trim();
      if (clean.length < 2) return;
      if (/^\d+[%건회위개]?$/.test(clean)) return;
      if (stopwords.has(clean)) return;
      if (domainFragments.has(clean.toLowerCase())) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
}

function extractHotBrands(headlines, excludeKeywords) {
  const excludeLower = new Set(excludeKeywords.map((k) => k.toLowerCase()));
  const quoteRegex = /['‘’"“”]([^'‘’"“”]{2,20})['‘’"“”]/g;
  const freq = {};
  headlines.forEach((h) => {
    quoteRegex.lastIndex = 0;
    let m;
    while ((m = quoteRegex.exec(h.title)) !== null) {
      const phrase = m[1].trim();
      if (phrase.length < 2) continue;
      if (excludeLower.has(phrase.toLowerCase())) continue;
      if (/^\d+$/.test(phrase)) continue;
      freq[phrase] = (freq[phrase] || 0) + 1;
    }
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function escapeCsvField(field) {
  const str = String(field ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(headlines, label) {
  const header = ["카테고리", "키워드", "제목", "언론사", "날짜", "링크"];
  const rows = headlines.map((h) => [h.category, h.keyword, h.title, h.source || "", h.pubDate || "", h.link]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `news-${label}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function defaultCategoryTexts() {
  const obj = {};
  CATEGORIES.forEach((c) => { obj[c.id] = c.defaultKeywords; });
  return obj;
}

export default function Home() {
  const [categoryTexts, setCategoryTexts] = useState(defaultCategoryTexts());
  const [activeInputCat, setActiveInputCat] = useState(CATEGORIES[0].id);
  const [loading, setLoading] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null); // { [catId]: {...} }
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [activeResultCat, setActiveResultCat] = useState(CATEGORIES[0].id);
  const [activeKeywordTab, setActiveKeywordTab] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCategoryTexts((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const saveKeywords = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categoryTexts));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  };

  const selectResultCat = (catId) => {
    setActiveResultCat(catId);
    setActiveKeywordTab("all");
    setVisibleCount(PAGE_SIZE);
  };

  const selectKeywordTab = (tab) => {
    setActiveKeywordTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  const pushLog = (lines) => setLogLines((prev) => [...prev, ...lines]);

  const runCrawl = async () => {
    setError("");
    setResults(null);
    setDashboardVisible(false);
    setLogLines([]);
    setActiveKeywordTab("all");
    setVisibleCount(PAGE_SIZE);

    const catKeywordLists = CATEGORIES.map((cat) => ({
      cat,
      keywords: (categoryTexts[cat.id] || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, MAX_KEYWORDS_PER_CATEGORY),
    })).filter((c) => c.keywords.length > 0);

    if (catKeywordLists.length === 0) {
      setError("최소 한 카테고리에는 키워드를 입력해주세요.");
      return;
    }

    setLoading(true);
    const newResults = {};
    let anySuccess = false;
    let totalIdx = 0;
    const totalCount = catKeywordLists.reduce((sum, c) => sum + c.keywords.length, 0);

    for (const { cat, keywords } of catKeywordLists) {
      const keywordCounts = {};
      let catItems = [];
      let catSuccess = 0;

      for (const kw of keywords) {
        totalIdx++;
        try {
          const res = await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword: kw }),
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);

          const taggedItems = json.items.map((it) => ({ ...it, category: cat.label }));
          keywordCounts[kw] = taggedItems.length;
          catItems = catItems.concat(taggedItems);
          catSuccess++;
          anySuccess = true;

          const sampleLines = json.items.slice(0, 1).flatMap((item) => [
            { cls: "t-tag", text: `<title>${item.title}</title>` },
            { cls: "t-muted", text: `└ 언론사 = "${item.source || "출처 미상"}"` },
          ]);
          pushLog([
            { cls: "t-accent", text: `[${totalIdx}/${totalCount}] [${cat.label}] "${kw}" 검색 · ${taggedItems.length}건 수집` },
            ...sampleLines,
          ]);
        } catch (e) {
          keywordCounts[kw] = 0;
          pushLog([{ cls: "t-tag", text: `[${totalIdx}/${totalCount}] [${cat.label}] "${kw}" 검색 실패` }]);
        }
      }

      catItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      newResults[cat.id] = {
        label: cat.label,
        keywordCounts,
        usedKeywords: keywords,
        headlines: catItems,
        totalHeadlines: catItems.length,
        trending: extractTrending(catItems),
        hotBrands: extractHotBrands(catItems, keywords),
        successCount: catSuccess,
      };
    }

    pushLog([
      { cls: "t-muted", text: `... 총 ${totalCount}개 키워드, ${catKeywordLists.length}개 카테고리 처리 완료` },
      { cls: "t-muted", text: `⋮ 파싱된 데이터를 근거로 대시보드 생성 중입니다...` },
      { cls: "t-success", text: `✓ 검색이 완료되었습니다. ${new Date().toLocaleString("ko-KR")}` },
    ]);

    setLoading(false);

    if (!anySuccess) {
      setError("모든 카테고리에서 검색에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // 결과가 있는 첫 카테고리를 기본 선택
    const firstWithData = catKeywordLists.find((c) => newResults[c.cat.id].totalHeadlines > 0);
    setActiveResultCat(firstWithData ? firstWithData.cat.id : catKeywordLists[0].cat.id);
    setResults(newResults);
  };

  const activeCatResult = results ? results[activeResultCat] : null;
  const maxTrend = activeCatResult && activeCatResult.trending.length ? activeCatResult.trending[0][1] : 1;
  const maxBrand = activeCatResult && activeCatResult.hotBrands.length ? activeCatResult.hotBrands[0][1] : 1;

  const filteredHeadlines = activeCatResult
    ? activeCatResult.headlines.filter((h) => activeKeywordTab === "all" || h.keyword === activeKeywordTab)
    : [];
  const visibleHeadlines = filteredHeadlines.slice(0, visibleCount);
  const activeTabLabel = activeCatResult ? `${activeCatResult.label}-${activeKeywordTab === "all" ? "전체" : activeKeywordTab}` : "";

  return (
    <main>
      <h1>뉴스 인사이트 대시보드</h1>
      <p className="sub">
        실시간 뉴스 기사를 수집하여 키워드별 언급량과 주요 이슈를 요약해 드립니다.
        카테고리를 선택해서 모니터링할 키워드를 각각 입력해 주세요.
      </p>

      <div className="cat-tab-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`cat-tab-btn ${activeInputCat === cat.id ? "active" : ""}`}
            onClick={() => setActiveInputCat(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.id} style={{ display: activeInputCat === cat.id ? "block" : "none" }}>
          <label htmlFor={`kw-${cat.id}`}>{cat.label} 키워드 (쉼표로 구분, 최대 {MAX_KEYWORDS_PER_CATEGORY}개)</label>
          <textarea
            id={`kw-${cat.id}`}
            rows={3}
            value={categoryTexts[cat.id] || ""}
            onChange={(e) => setCategoryTexts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
          />
        </div>
      ))}
      <div className="hint">
        쉼표(,)로 구분해서 입력하세요. 카테고리별로 최대 {MAX_KEYWORDS_PER_CATEGORY}개까지 사용됩니다.
        키워드를 비워두면 그 카테고리는 검색에서 제외됩니다.
      </div>

      <button className="run-btn" onClick={runCrawl} disabled={loading}>
        {loading ? "검색 중..." : "▶ 뉴스 검색 (전체 카테고리 실행)"}
      </button>
      <button className="save-btn" onClick={saveKeywords}>
        💾 키워드 저장
      </button>
      {savedMsg && <span className="saved-msg">저장됐습니다 · 다음에 다시 열어도 유지됩니다</span>}

      {error && <div className="error-box" style={{ marginTop: 16 }}>{error}</div>}

      {logLines.length > 0 && (
        <div className="terminal">
          <div className="terminal-header">
            <span className="terminal-dot red" />
            <span className="terminal-dot yellow" />
            <span className="terminal-dot green" />
            <span className="terminal-title">crawl-pipeline — /api/news</span>
          </div>
          <div className="terminal-body">
            {logLines.map((line, i) => (
              <div key={i} className={line.cls}>{line.text}</div>
            ))}
          </div>
        </div>
      )}

      {results && !loading && (
        <>
          <p className="crawl-done-label">✓ 검색이 완료되었습니다</p>
          <button className="dashboard-btn" onClick={() => setDashboardVisible(true)}>
            🖥 대시보드 보러가기
          </button>
          <p className="crawl-note">
            ※ 실제 서버에서 매 실행마다 새로 크롤링합니다. 결과는 실행 시점의 뉴스에 따라 매번 달라집니다.
          </p>
        </>
      )}

      {results && dashboardVisible && (
        <div style={{ marginTop: 32 }}>
          <div className="result-tab-bar">
            {CATEGORIES.filter((c) => results[c.id]).map((cat) => (
              <button
                key={cat.id}
                className={`result-tab-btn ${activeResultCat === cat.id ? "active" : ""}`}
                onClick={() => selectResultCat(cat.id)}
              >
                {cat.label} ({results[cat.id].totalHeadlines})
              </button>
            ))}
          </div>

          {activeCatResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="grid-2">
                <section className="card">
                  <h2>🔍 수집 현황 · 검색어별</h2>
                  <div className="stat-card-row">
                    {Object.entries(activeCatResult.keywordCounts).map(([k, v]) => (
                      <div className="stat-card" key={k}>
                        <div className="num">{v}</div>
                        <div className="lbl">🔍 {k}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card">
                  <h2>🔥 지금 핫한 브랜드</h2>
                  <p style={{ fontSize: 13, color: "var(--ink-muted-48)", marginTop: -6, marginBottom: 14 }}>
                    헤드라인에서 따옴표로 언급된 실제 브랜드·제품명을 집계했습니다.
                  </p>
                  {activeCatResult.hotBrands.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--ink-muted-48)" }}>
                      따옴표로 언급된 브랜드·제품명을 찾지 못했습니다.
                    </p>
                  )}
                  {activeCatResult.hotBrands.map(([name, count], idx) => (
                    <div className="rank-row" key={name}>
                      <span className="rank-badge">{RANK_BADGES[idx] || idx + 1}</span>
                      <span className="rank-name">{name}</span>
                      <div className="rank-bar-track">
                        <div className="rank-bar-fill" style={{ width: `${Math.max(6, (count / maxBrand) * 100)}%` }} />
                      </div>
                      <span className="rank-count">{count}회</span>
                    </div>
                  ))}
                </section>
              </div>

              <section className="card">
                <h2>📈 시장동향 키워드</h2>
                {activeCatResult.trending.map(([word, count]) => (
                  <div className="trend-row" key={word}>
                    <span className="trend-label">{word}</span>
                    <div className="trend-track">
                      <div className="trend-fill" style={{ width: `${Math.max(8, (count / maxTrend) * 100)}%` }}>
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ margin: 0 }}>🗞 수집된 헤드라인 ({activeCatResult.totalHeadlines}건)</h2>
                  <button
                    className="save-btn"
                    style={{ marginTop: 0, marginLeft: 0, padding: "8px 16px" }}
                    onClick={() => downloadCsv(filteredHeadlines, activeTabLabel)}
                  >
                    ⬇ CSV 다운로드
                  </button>
                </div>
                <div className="tab-bar" style={{ marginTop: 14 }}>
                  <button
                    className={`tab-btn ${activeKeywordTab === "all" ? "active" : ""}`}
                    onClick={() => selectKeywordTab("all")}
                  >
                    전체 ({activeCatResult.totalHeadlines})
                  </button>
                  {activeCatResult.usedKeywords.map((kw) => (
                    <button
                      key={kw}
                      className={`tab-btn ${activeKeywordTab === kw ? "active" : ""}`}
                      onClick={() => selectKeywordTab(kw)}
                    >
                      {kw} ({activeCatResult.keywordCounts[kw] || 0})
                    </button>
                  ))}
                </div>

                {visibleHeadlines.map((h, i) => (
                  <div className="headline-item-wide" key={i}>
                    <span className="headline-tag">{h.keyword}</span>
                    <a className="headline-title" href={h.link} target="_blank" rel="noreferrer">
                      {h.title}
                    </a>
                    <div className="headline-meta">{h.source || "출처 미상"} · {h.pubDate}</div>
                    <a className="headline-link-btn" href={h.link} target="_blank" rel="noreferrer">
                      기사 링크 →
                    </a>
                  </div>
                ))}

                {visibleCount < filteredHeadlines.length && (
                  <button
                    className="save-btn"
                    style={{ display: "block", margin: "18px auto 0" }}
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  >
                    더 보기 ({filteredHeadlines.length - visibleCount}건 남음)
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
