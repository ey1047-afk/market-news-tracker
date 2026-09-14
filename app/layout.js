export const metadata = {
  title: "시장동향 실시간 크롤링·파싱",
  description: "키워드를 직접 수정해 뉴스를 실시간 크롤링·파싱하는 시장동향 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#0b0b0b", color: "#eaeaea" }}>
        {children}
      </body>
    </html>
  );
}
