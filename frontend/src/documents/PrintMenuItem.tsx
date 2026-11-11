import { Menu } from "@mantine/core";

// ⋯ 메뉴의 인쇄 항목: 지금 보는 페이지를 브라우저 인쇄 창으로 출력 (사이드바·메뉴는 인쇄용 스타일로 숨김)
// 메뉴가 닫히고 편집 중 선택 표시가 사라진 뒤 인쇄 창을 열어 출력물에 남지 않게 함
export function PrintMenuItem() {
  const print = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(() => window.print(), 0);
  };

  return <Menu.Item onClick={print}>인쇄</Menu.Item>;
}
