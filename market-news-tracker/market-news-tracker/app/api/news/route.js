import { NextResponse } from "next/server";

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

// 키워드 1개를 받아 그 키워드에 대한 뉴스만 수집·파싱해서 반환합니다.
// 클라이언트가 키워드마다 이 API를 순서대로 호출하면서 진행 상황을 화면에 표시합니다.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
  }

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    keyword
  )}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketNewsTracker/1.0)" },
      cache: "no-store",
    });
    const xml = await res.text();
    const items = parseRssXml(xml, keyword).slice(0, 20);
    return NextResponse.json({
      keyword,
      items,
      rawSample: xml.slice(0, 1500),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "크롤링 중 오류가 발생했습니다." },
      { status: 502 }
    );
  }
}
