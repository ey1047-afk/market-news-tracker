"use client";

import { useState } from "react";

const DEFAULT_KEYWORDS = "언더웨어, 속옷 브랜드, 이너웨어, 언더웨어 신상";

export default function Home() {
  const [keywordsText, setKeywordsText] = useState(DEFAULT_KEYWORDS);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const runCrawl = async () => {
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length === 0) {
      setError("키워드를 최소 1개 이상 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message || "크롤링 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const sortedMentions = data
    ? Object.entries(data.mentionCounts).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "2.5rem 1.5rem",
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>
        시장동향 실시간 크롤링·파싱
      </h1>
      <p style={{ color: "#999", marginBottom: "2rem" }}>
        Google News RSS(공개 피드)를 실시간으로 검색해 키워드별 언급량과 헤드라인을
        보여줍니다. 검색 키워드는 아래에서 직접 수정할 수 있습니다.
      </p>

      <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
        검색 키워드 (쉼표로 구분, 최대 10개)
      </label>
      <textarea
        value={keywordsText}
        onChange={(e) => setKeywordsText(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "0.7rem",
          background: "#161616",
          color: "#eaeaea",
          border: "1px solid #333",
          borderRadius: 6,
          fontSize: "0.95rem",
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={runCrawl}
        disabled={loading}
        style={{
          marginTop: "1rem",
          padding: "0.7rem 1.4rem",
          background: loading ? "#444" : "#2f6fed",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "default" : "pointer",
          fontSize: "0.95rem",
        }}
      >
        {loading ? "크롤링 중..." : "▶ 시장동향 크롤링 실행"}
      </button>

      {error && <p style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</p>}

      {data && (
        <div style={{ marginTop: "2.5rem" }}>
          <p style={{ color: "#777", fontSize: "0.85rem" }}>
            수집 시각: {new Date(data.collectedAt).toLocaleString("ko-KR")}
          </p>

          <h2 style={{ fontSize: "1.2rem", marginTop: "2rem" }}>
            수집 현황 · 검색어별
          </h2>
          <ul>
            {Object.entries(data.keywordCounts).map(([k, v]) => (
              <li key={k}>
                {k}: {v}건
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: "1.2rem", marginTop: "2rem" }}>
            지금 핫한 키워드 · 언급 순위
          </h2>
          <ol>
            {sortedMentions.map(([k, v]) => (
              <li key={k}>
                {k} — {v}회 언급
              </li>
            ))}
          </ol>

          <h2 style={{ fontSize: "1.2rem", marginTop: "2rem" }}>
            수집된 헤드라인
          </h2>
          <ul style={{ paddingLeft: "1.2rem" }}>
            {data.headlines.map((h, i) => (
              <li key={i} style={{ marginBottom: "0.4rem" }}>
                <a
                  href={h.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#8ab4ff" }}
                >
                  {h.title}
                </a>{" "}
                <small style={{ color: "#888" }}>
                  ({h.source || "출처 미상"} · {h.pubDate})
                </small>
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: "1.2rem", marginTop: "2rem" }}>
            파싱 검증 · 원본 XML 샘플
          </h2>
          <pre
            style={{
              background: "#111",
              padding: "1rem",
              overflowX: "auto",
              maxHeight: 300,
              fontSize: "0.75rem",
              border: "1px solid #333",
              borderRadius: 6,
            }}
          >
            {data.rawSample}
          </pre>
        </div>
      )}
    </main>
  );
}
