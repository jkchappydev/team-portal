// 붙여넣기 해석 방식: 서식(HTML)이 함께 오면 항상 HTML을 쓰고, 일반 텍스트만 올 때만 마크다운 여부를 판단
// BlockNote 기본은 HTML이 있어도 일반 텍스트가 마크다운처럼 보이면 마크다운을 우선해,
// 노션 표처럼 글자 안에 "index_analyzer search_analyzer"(밑줄 두 개 = 기울임 표시로 오인)가 있으면 표가 글 한 덩어리로 들어감
export function pasteOptions(types: readonly string[]): { prioritizeMarkdownOverHTML: boolean } {
  return { prioritizeMarkdownOverHTML: !types.includes("text/html") };
}
