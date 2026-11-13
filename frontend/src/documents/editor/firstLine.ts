// 블록(또는 블록 묶음) 안 첫 글줄의 세로 가운데까지 거리 (base 요소 안쪽 위 기준, 글줄이 없으면 null)
// 콜아웃 아이콘과 블록 손잡이를 첫 줄 가운데에 맞출 때 같이 씀
export function firstLineCenter(scope: Element, base: Element, includePadding = false): number | null {
  const line = scope.querySelector<HTMLElement>(".bn-inline-content");
  if (!line) return null;
  const style = getComputedStyle(line);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
  const padding = includePadding ? 0 : Number.parseFloat(getComputedStyle(base).paddingTop || "0");
  return line.getBoundingClientRect().top - base.getBoundingClientRect().top - padding + lineHeight / 2;
}
