"use client";

import { useState, useEffect } from "react";

const DEFAULT_KEYWORDS = "언더웨어, 속옷 브랜드, 이너웨어, 언더웨어 신상";
const MAX_KEYWORDS = 30;
const RANK_BADGES = ["🥇", "🥈", "🥉"];
const STORAGE_KEY = "market-news-tracker-keywords";

function extractTrending(headlines) {
  const stopwords = new Set([
    "속보", "단독", "포토", "영상", "오늘", "이슈", "기자", "뉴스", "보도",
    "오전", "오후", "종합", "특집", "인터뷰", "분석", "전망", "현장", "화제",
  ]);
  // 도메인 형태로 제목 끝에 붙는 흔한 조각들(예: yna.co.kr, news.daum.net)이
  // 키워드로 잘못 집계되지 않도록 걸러냅니다.
  const domainFragments = new Set([
    "kr", "co", "com", "net", "org", "io", "www", "daum", "yna", "news", "naver",
  ]);
  const freq = {};
  headlines.forEach((h) => {
    // Google News 제목은 보통 "실제 제목 - 언론사"(또는 도메인) 형식이라,
    // 마지막 " - " 뒤에 붙는 출처 표기는 제목 분석에서 제외합니다.
    const lastDash = h.title.lastIndexOf(" - ");
    const cleanTitle = lastDash > 0 ? h.title.slice(0, lastDash) : h.title;

    const tokens = cleanTitle
      .replace(/[\[\]\(\)|"'“”‘’·,.!?~]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    tokens.forEach((t) => {
      const clean = t.trim();
      if (clean.length < 2) return;
      if (stopwords.has(clean)) return;
      if (domainFragments.has(clean.toLowerCase())) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
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

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setKeywordsText(saved);
  }, []);

  const saveKeywords = () => {
    window.localStorage.setItem(STORAGE_KEY, keywordsText);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  };

  const pushLog = (lines) => setLogLines((prev) => [...prev, ...lines]);

  const runCrawl = async () => {
    setError("");
    setData(null);
    setDashboardVisible(false);
    setLogLines([]);
    setActiveTab("all");

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

    const mentionCounts = {};
    keywords.forEach((kw) => {
      mentionCounts[kw] = allItems.filter((item) =>
        item.title.toLowerCase().includes(kw.toLowerCase())
      ).length;
    });

    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const trending = extractTrending(allItems);

    pushLog([
      { cls: "t-muted", text: `... 총 ${allItems.length}건 정제 완료` },
      { cls: "t-accent", text: `→ [${keywords.length}/${keywords.length}] 키워드 빈도 분석 상위 15개 추출` },
      { cls: "t-muted", text: `⋮ 파싱된 데이터를 근거로 대시보드 생성 중입니다...` },
      { cls: "t-success", text: `✓ 파싱이 완료되었습니다. ${new Date().toLocaleString("ko-KR")}` },
    ]);

    setLoading(false);

    if (successCount === 0) {
      setError("모든 키워드에서 크롤링에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setData({
      collectedAt: new Date().toISOString(),
      keywordCounts,
      mentionCounts,
      trending,
      headlines: allItems,
      totalHeadlines: allItems.length,
      usedKeywords: keywords,
    });
  };

  const sortedMentions = data
    ? Object.entries(data.mentionCounts)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : [];
  const maxMention = sortedMentions.length ? sortedMentions[0][1] : 1;
  const maxTrend = data && data.trending.length ? data.trending[0][1] : 1;
  const verifyItems = data ? data.headlines.slice(0, 3) : [];

  return (
    <main>
      <h1>시장동향 실시간 크롤링·파싱</h1>
      <p className="sub">
        Google News RSS를 실시간으로 검색해 키워드별 언급량과 헤드라인을 대시보드로
        정리해 보여줍니다. 검색 키워드는 아래에서 직접 수정할 수 있습니다.
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
      </div>

      <button className="run-btn" onClick={runCrawl} disabled={loading}>
        {loading ? "크롤링 중..." : "▶ 시장동향 크롤링 실행"}
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
          <p className="crawl-done-label">✓ 파싱이 완료되었습니다</p>
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
            <h2>🔥 지금 핫한 브랜드 · 뉴스 언급 순위</h2>
            <p style={{ fontSize: 13, color: "var(--ink-muted-48)", marginTop: -6, marginBottom: 14 }}>
              수집된 헤드라인에서 검색어 언급 횟수를 집계했습니다.
            </p>
            {sortedMentions.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-muted-48)" }}>
                헤드라인 제목에서 검색어가 그대로 언급된 사례가 없습니다.
              </p>
            )}
            {sortedMentions.map(([k, v], idx) => (
              <div className="rank-row" key={k}>
                <span className="rank-badge">{RANK_BADGES[idx] || idx + 1}</span>
                <span className="rank-name">{k}</span>
                <div className="rank-bar-track">
                  <div className="rank-bar-fill" style={{ width: `${Math.max(6, (v / maxMention) * 100)}%` }} />
                </div>
                <span className="rank-count">{v}회</span>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>🧾 파싱 검증 · 원본 → 추출</h2>
            <p style={{ fontSize: 13, color: "var(--ink-muted-48)", marginTop: -6, marginBottom: 14 }}>
              서버가 받은 실제 원본과, 거기서 뽑아낸 값을 나란히 보여줍니다.
            </p>
            {verifyItems.map((item, i) => (
              <div className="verify-pair" key={i}>
                <div className="verify-raw">
                  <span className="label">RAW · 원본 XML</span>
                  <span className="tag">&lt;title&gt;</span>
                  {item.title} - {item.source}
                  <span className="tag">&lt;/title&gt;</span>
                </div>
                <div className="verify-parsed">
                  <span className="label">PARSED · 추출 결과</span>
                  제목 {item.title}
                  <br />
                  언론사 {item.source || "출처 미상"}
                </div>
              </div>
            ))}
          </section>

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
            <h2>🗞 수집된 헤드라인 ({data.totalHeadlines}건)</h2>
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                전체 ({data.totalHeadlines})
              </button>
              {data.usedKeywords.map((kw) => (
                <button
                  key={kw}
                  className={`tab-btn ${activeTab === kw ? "active" : ""}`}
                  onClick={() => setActiveTab(kw)}
                >
                  {kw} ({data.keywordCounts[kw] || 0})
                </button>
              ))}
            </div>

            {data.headlines
              .filter((h) => activeTab === "all" || h.keyword === activeTab)
              .map((h, i) => (
                <div className="headline-item-wide" key={i}>
                  <span className="headline-tag">{h.keyword}</span>
                  <a className="headline-title" href={h.link} target="_blank" rel="noreferrer">
                    {h.title}
                  </a>
                  <div className="headline-meta">{h.source || "출처 미상"} · {h.pubDate}</div>
                  <a className="headline-url" href={h.link} target="_blank" rel="noreferrer">
                    {h.link}
                  </a>
                </div>
              ))}
          </section>
        </div>
      )}
    </main>
  );
}
