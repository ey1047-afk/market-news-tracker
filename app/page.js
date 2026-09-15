"use client";

import { useState, useEffect } from "react";

const DEFAULT_KEYWORDS = "언더웨어, 속옷 브랜드, 이너웨어, 언더웨어 신상";
const MAX_KEYWORDS = 30;
const RANK_BADGES = ["🥇", "🥈", "🥉"];
const STORAGE_KEY = "market-news-tracker-keywords";
const PAGE_SIZE = 20;

// 개선 2: 잡음 단어(연도, 범용 단어)를 더 걸러낸 트렌드 키워드 추출
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
      if (/^\d+[%건회위개]?$/.test(clean)) return; // 순수 숫자/연도/단위 제외
      if (stopwords.has(clean)) return;
      if (domainFragments.has(clean.toLowerCase())) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
}

// 개선 1: 검색 키워드 자기 자신을 세는 대신, 제목 속 따옴표로 묶인
// 실제 브랜드/제품명 후보를 뽑아 "핫한 브랜드" 순위를 매깁니다.
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
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function escapeCsvField(field) {
  const str = String(field ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 개선 5: 현재 탭에 보이는 헤드라인을 CSV로 내보내기 (엑셀에서 바로 열림)
function downloadCsv(headlines, tabLabel) {
  const header = ["키워드", "제목", "언론사", "날짜", "링크"];
  const rows = headlines.map((h) => [h.keyword, h.title, h.source || "", h.pubDate || "", h.link]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `news-${tabLabel}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [keywordsText, setKeywordsText] = useState(DEFAULT_KEYWORDS);
  const [loading, setLoading] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setKeywordsText(saved);
  }, []);

  const saveKeywords = () => {
    window.localStorage.setItem(STORAGE_KEY, keywordsText);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  const pushLog = (lines) => setLogLines((prev) => [...prev, ...lines]);

  const runCrawl = async () => {
    setError("");
    setData(null);
    setDashboardVisible(false);
    setLogLines([]);
    setActiveTab("all");
    setVisibleCount(PAGE_SIZE);

    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);

    if (keywords.length === 0) {
      setError("키워드를 최소 1개 이상 입력해주세요.");
      return;
    }

    setLoading(true);

    const keywordCounts = {};
    let allItems = [];
    let successCount = 0;

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      try {
        const res = await fetch("/api/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        keywordCounts[kw] = json.items.length;
        allItems = allItems.concat(json.items);
        successCount++;

        const sampleLines = json.items.slice(0, 2).flatMap((item) => [
          { cls: "t-tag", text: `<title>${item.title}</title>` },
          { cls: "", text: `├ 제목 = "${item.title}"` },
          { cls: "t-muted", text: `└ 언론사 = "${item.source || "출처 미상"}" ('-' 위 분리)` },
        ]);
        pushLog([
          { cls: "t-accent", text: `[${i + 1}/${keywords.length}] "${kw}" 검색 · ${json.items.length}건 수집` },
          ...sampleLines,
        ]);
      } catch (e) {
        keywordCounts[kw] = 0;
        pushLog([{ cls: "t-tag", text: `[${i + 1}/${keywords.length}] "${kw}" 검색 실패` }]);
      }
    }

    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const trending = extractTrending(allItems);
    const hotBrands = extractHotBrands(allItems, keywords);

    pushLog([
      { cls: "t-muted", text: `... 총 ${allItems.length}건 정제 완료` },
      { cls: "t-accent", text: `→ [${keywords.length}/${keywords.length}] 키워드 빈도 분석 상위 15개 추출` },
      { cls: "t-muted", text: `⋮ 파싱된 데이터를 근거로 대시보드 생성 중입니다...` },
      { cls: "t-success", text: `✓ 검색이 완료되었습니다. ${new Date().toLocaleString("ko-KR")}` },
    ]);

    setLoading(false);

    if (successCount === 0) {
      setError("모든 키워드에서 크롤링에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setData({
      collectedAt: new Date().toISOString(),
      keywordCounts,
      trending,
      hotBrands,
      headlines: allItems,
      totalHeadlines: allItems.length,
      usedKeywords: keywords,
    });
  };

  const maxTrend = data && data.trending.length ? data.trending[0][1] : 1;
  const maxBrand = data && data.hotBrands.length ? data.hotBrands[0][1] : 1;

  const filteredHeadlines = data
    ? data.headlines.filter((h) => activeTab === "all" || h.keyword === activeTab)
    : [];
  const visibleHeadlines = filteredHeadlines.slice(0, visibleCount);
  const activeTabLabel = activeTab === "all" ? "전체" : activeTab;

  return (
    <main>
      <h1>뉴스 인사이트 대시보드</h1>
      <p className="sub">
        실시간 뉴스 기사를 수집하여 키워드별 언급량과 주요 이슈를 요약해 드립니다.
        모니터링할 키워드를 아래에 입력해 주세요.
      </p>

      <label htmlFor="keywords">검색 키워드 (쉼표로 구분, 최대 {MAX_KEYWORDS}개)</label>
      <textarea
        id="keywords"
        rows={3}
        value={keywordsText}
        onChange={(e) => setKeywordsText(e.target.value)}
      />
      <div className="hint">
        쉼표(,)로 구분해서 입력하세요. {MAX_KEYWORDS}개를 초과하면 앞의 {MAX_KEYWORDS}개만 사용됩니다.
        💡 서로 다른 업종·주제를 한 번에 섞기보다, 한 번에 하나의 업종/주제로 검색하시면 더 정확한 인사이트를 얻을 수 있어요.
      </div>

      <button className="run-btn" onClick={runCrawl} disabled={loading}>
        {loading ? "검색 중..." : "▶ 뉴스 검색"}
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

      {data && !loading && (
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

      {data && dashboardVisible && (
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 개선 6: 수집 현황 + 핫한 브랜드를 데스크톱에서 좌우로 배치 */}
          <div className="grid-2">
            <section className="card">
              <h2>🔍 수집 현황 · 검색어별</h2>
              <div className="stat-card-row">
                {Object.entries(data.keywordCounts).map(([k, v]) => (
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
              {data.hotBrands.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--ink-muted-48)" }}>
                  따옴표로 언급된 브랜드·제품명을 찾지 못했습니다.
                </p>
              )}
              {data.hotBrands.map(([name, count], idx) => (
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
            {data.trending.map(([word, count]) => (
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
              <h2 style={{ margin: 0 }}>🗞 수집된 헤드라인 ({data.totalHeadlines}건)</h2>
              <button className="save-btn" style={{ marginTop: 0, marginLeft: 0, padding: "8px 16px" }} onClick={() => downloadCsv(filteredHeadlines, activeTabLabel)}>
                ⬇ CSV 다운로드 ({activeTabLabel})
              </button>
            </div>
            <div className="tab-bar" style={{ marginTop: 14 }}>
              <button
                className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => selectTab("all")}
              >
                전체 ({data.totalHeadlines})
              </button>
              {data.usedKeywords.map((kw) => (
                <button
                  key={kw}
                  className={`tab-btn ${activeTab === kw ? "active" : ""}`}
                  onClick={() => selectTab(kw)}
                >
                  {kw} ({data.keywordCounts[kw] || 0})
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

            {/* 개선 4: 한 번에 다 보여주지 않고 "더 보기"로 나눠서 표시 */}
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
    </main>
  );
}
