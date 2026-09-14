import { NextResponse } from "next/server";

// --- 아주 가벼운 RSS(XML) 파서: 외부 라이브러리 없이 정규식으로 <item> 블록만 추출 ---
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCdata(str) {
  return str.replace("<![CDATA[", "").replace("]]>", "");
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  return m ? decodeEntities(stripCdata(m[1])).trim() : "";
}

function parseRssXml(xml, keyword) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      source: extractTag(block, "source"),
      keyword,
    });
  }
  return items;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const keywords = Array.isArray(body.keywords)
    ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];

  if (keywords.length === 0) {
    return NextResponse.json({ error: "keywords 배열이 필요합니다." }, { status: 400 });
  }

  const limitedKeywords = keywords.slice(0, 10); // 남용 방지: 최대 10개
  const resultsByKeyword = {};
  let rawSample = "";

  for (const kw of limitedKeywords) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      kw
    )}&hl=ko&gl=KR&ceid=KR:ko`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketNewsTracker/1.0)" },
        cache: "no-store",
      });
      const xml = await res.text();
      if (!rawSample) rawSample = xml.slice(0, 1500);
      resultsByKeyword[kw] = parseRssXml(xml, kw).slice(0, 20);
    } catch (e) {
      resultsByKeyword[kw] = [];
    }
  }

  const allItems = Object.values(resultsByKeyword).flat();

  // 헤드라인 텍스트 안에 각 키워드가 등장한 횟수를 집계 (= "언급 순위")
  const mentionCounts = {};
  for (const kw of limitedKeywords) {
    mentionCounts[kw] = allItems.filter((item) =>
      item.title.toLowerCase().includes(kw.toLowerCase())
    ).length;
  }

  const keywordCounts = {};
  for (const kw of limitedKeywords) {
    keywordCounts[kw] = (resultsByKeyword[kw] || []).length;
  }

  const headlines = allItems
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 50);

  return NextResponse.json({
    collectedAt: new Date().toISOString(),
    keywordCounts,
    mentionCounts,
    headlines,
    rawSample,
  });
}
