import "./globals.css";

export const metadata = {
  title: "뉴스 인사이트 대시보드",
  description: "카테고리별 키워드를 모니터링하는 실시간 뉴스 인사이트 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
