import { createExtension } from "@blocknote/core";
import { prefersReducedMotion } from "../../layout/reorderAnimation";

const CHECK_MS = 260;

// 방금 체크·해제한 체크리스트 줄: 상자가 살짝 튀고, 체크하면 취소선과 회색 글자가 서서히 나타남
// 체크할 때마다 BlockNote가 블록 요소를 새로 만들어 CSS 전환 효과가 동작하지 않으므로, 새로 그려진 요소에 직접 효과를 줌
export function animateCheckToggle(editorDom: HTMLElement, blockId: string, checked: boolean): void {
  if (prefersReducedMotion()) return;
  const content = editorDom.querySelector<HTMLElement>(
    `.bn-block-outer[data-id="${CSS.escape(blockId)}"] > .bn-block > .bn-block-content[data-content-type="checkListItem"]`,
  );
  if (!content || typeof content.animate !== "function") return;
  const box = content.querySelector<HTMLElement>("input[type=checkbox]");
  box?.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }],
    { duration: 220, easing: "ease-out" },
  );
  if (!checked) return;
  const text = content.querySelector<HTMLElement>(".bn-inline-content");
  const uncheckedColor = getComputedStyle(content).color;
  text?.animate(
    [{ textDecorationColor: "transparent", color: uncheckedColor }, {}],
    { duration: CHECK_MS, easing: "ease-out" },
  );
}

export const checkListAnimationExtension = createExtension({
  key: "checkListAnimation",
  mount: ({ dom, signal }) => {
    dom.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
      // 상자가 아직 블록 안에 있을 때(캡처 단계) 블록 ID를 읽음
      const blockId = input.closest<HTMLElement>(".bn-block-outer")?.dataset.id;
      if (!blockId) return;
      // BlockNote가 체크 처리로 블록을 다시 그린 뒤 새 요소를 찾아 효과 적용
      setTimeout(() => animateCheckToggle(dom, blockId, input.checked));
    }, { capture: true, signal });
  },
});
