"use client";

import { useState } from "react";

const DEFAULT_KEYWORDS = "언더웨어, 속옷 브랜드, 이너웨어, 언더웨어 신상";
const MAX_KEYWORDS = 30;

// 헤드라인 제목들에서 자주 등장하는 단어를 뽑아 "시장동향 키워드"로 보여줍니다.
function extractTrending(headlines) {
  const stopwords = new Set([
    "속보", "단독", "포토", "영상", "오늘", "이슈", "기자", "뉴스", "보도",
    "오전", "오후", "종합", "특집", "인터뷰", "분석", "전망", "현장", "화제",
  ]);
  const freq = {};
  headlines.forEach((h) => {
    const tokens = h.title
      .replace(/[\[\]\(\)|"'“”‘’·,.!?~]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    tokens.forEach((t) => {
      const clean = t.trim();
      if (clean.length < 2 || stopwords.has(clean)) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16);
}

export default function Home() {
  const [keywordsText, setKeywordsText] = useState(DEFAULT_KEYWORDS);
  const [loading, setLoading] = useState(false);
  const [progressRows, setProgressRows] = useState([]);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const updateRow = (idx, patch) => {
    setProgressRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const runCrawl = async () => {
    setError("");
    setData(null);

    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);

    if (keywords.length === 0) {
      setError("키워드를 최소 1개 이상 입력해주세요.");
      return;
    }

    setProgressRows(keywords.map((kw) => ({ keyword: kw, status: "대기 중", cls: "" })));
    setLoading(true);

    const keywordCounts = {};
    let allItems = [];
    let rawSample = "";
    let successCount = 0;

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      updateRow(i, { status: "수집 중...", cls: "" });
      try {
        const res = await fetch("/api/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!rawSample) rawSample = json.rawSample;
        keywordCounts[kw] = json.items.length;
        allItems = allItems.concat(json.items);
        successCount++;
        updateRow(i, { status: `완료 · ${json.items.length}건`, cls: "ok" });
      } catch (e) {
        keywordCounts[kw] = 0;
        updateRow(i, { status: "실패", cls: "fail" });
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

    setLoading(false);

    if (successCount === 0) {
      setError(
        "모든 키워드에서 크롤링에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }

    setData({
      collectedAt: new Date().toISOString(),
      keywordCounts,
      mentionCounts,
      trending,
      headlines: allItems.slice(0, 50),
      rawSample,
      totalHeadlines: allItems.length,
      keywordCount: keywords.length,
      successCount,
    });
  };

  const sortedMentions = data
    ? Object.entries(data.mentionCounts).sort((a, b) => b[1] - a[1])
    : [];
  const maxMention = sortedMentions.length ? sortedMentions[0][1] || 1 : 1;
  const maxTrend = data && data.trending.length ? data.trending[0][1] : 1;

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
        쉼표(,)로 구분해서 입력하세요. {MAX_KEYWORDS}개를 초과하면 앞의 {MAX_KEYWORDS}
        개만 사용됩니다.
      </div>

      <button className="run-btn" onClick={runCrawl} disabled={loading}>
        {loading ? "크롤링 중..." : "▶ 시장동향 크롤링 실행"}
      </button>

      {error && <div className="error-box" style={{ marginTop: 16 }}>{error}</div>}

      {progressRows.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <h2>진행 상황</h2>
          {progressRows.map((row, i) => (
            <div className="progress-row" key={i}>
              <span>{row.keyword}</span>
              <span className={`progress-status ${row.cls}`}>{row.status}</span>
            </div>
          ))}
        </section>
      )}

      {data && (
        <div style={{ marginTop: 24 }}>
          <p className="timestamp" style={{ marginBottom: 20 }}>
            수집 시각: {new Date(data.collectedAt).toLocaleString("ko-KR")}
          </p>

          <div className="dashboard-grid">
            <section className="card full-span">
              <h2>핵심 지표</h2>
              <div className="stat-row">
                <div className="stat-item">
                  <div className="stat-value">{data.totalHeadlines}</div>
                  <div className="stat-label">수집된 헤드라인</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{data.keywordCount}</div>
                  <div className="stat-label">검색 키워드 수</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{data.successCount}</div>
                  <div className="stat-label">수집 성공 키워드</div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>지금 핫한 키워드 · 언급 순위</h2>
              {sortedMentions.map(([k, v]) => (
                <div className="bar-row" key={k}>
                  <div className="bar-label">
                    <span>{k}</span>
                    <span>{v}회</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(4, (v / maxMention) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="card">
              <h2>시장동향 키워드</h2>
              <div className="chip-cloud">
                {data.trending.map(([word, count]) => (
                  <span
                    key={word}
                    className="chip"
                    style={{
                      fontSize: `${12 + Math.round((count / maxTrend) * 6)}px`,
                    }}
                  >
                    {word} {count}
                  </span>
                ))}
              </div>
            </section>

            <section className="card full-span">
              <h2>수집 현황 · 검색어별</h2>
              <ul>
                {Object.entries(data.keywordCounts).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}건
                  </li>
                ))}
              </ul>
            </section>

            <section className="card full-span">
              <h2>수집된 헤드라인</h2>
              <ul>
                {data.headlines.map((h, i) => (
                  <li key={i}>
                    <a href={h.link} target="_blank" rel="noreferrer">
                      {h.title}
                    </a>{" "}
                    <small>
                      ({h.source || "출처 미상"} · {h.pubDate})
                    </small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card full-span">
              <h2>파싱 검증 · 원본 XML 샘플</h2>
              <pre>{data.rawSample}</pre>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
