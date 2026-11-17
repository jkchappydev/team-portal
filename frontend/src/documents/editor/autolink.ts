import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { AddMarkStep } from "@tiptap/pm/transform";

// 자동 링크로 남길 글자: 프로토콜이 붙은 주소(https:// 등), www.로 시작하는 주소, 이메일
export function shouldKeepAutolink(text: string): boolean {
  const value = text.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || /^www\./i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// 편집기가 입력·붙여넣기 뒤에 자동으로 덧붙인(appendTransaction) 링크 표시를 모음
function autolinkedRanges(transactions: readonly Transaction[], state: EditorState) {
  const linkType = state.schema.marks.link;
  const ranges: { from: number; to: number }[] = [];
  if (!linkType) return ranges;
  transactions.forEach((tr, index) => {
    if (!tr.getMeta("appendedTransaction")) return;
    tr.steps.forEach((step, stepIndex) => {
      if (!(step instanceof AddMarkStep) || step.mark.type !== linkType) return;
      // 이후 변경을 거쳐 최종 문서 위치로 옮김
      let { from, to } = step;
      for (let i = stepIndex + 1; i < tr.steps.length; i++) {
        from = tr.steps[i].getMap().map(from, 1);
        to = tr.steps[i].getMap().map(to, -1);
      }
      for (const later of transactions.slice(index + 1)) {
        from = later.mapping.map(from, 1);
        to = later.mapping.map(to, -1);
      }
      if (from < to) ranges.push({ from, to });
    });
  });
  return ranges;
}

// 노션처럼 setenv.sh 같은 파일 이름은 링크로 바꾸지 않고, 인라인 코드 안 글자는 어떤 주소도 자동 링크로 두지 않음
// BlockNote 기본은 점만 있으면 주소로 보고(https://setenv.sh) 붙여넣을 때는 코드 글자도 링크로 바꿈
// 사용자가 직접 건 링크와 붙여넣은 HTML에 원래 있던 링크는 자동 변환이 아니어서 그대로 둠
export const autolinkFilterExtension = createExtension({
  key: "autolinkFilter",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("autolinkFilter"),
      appendTransaction(transactions, _oldState, newState) {
        const linkType = newState.schema.marks.link;
        const codeType = newState.schema.marks.code;
        const ranges = autolinkedRanges(transactions, newState);
        if (!linkType || ranges.length === 0) return null;
        const tr = newState.tr;
        for (const { from, to } of ranges) {
          const text = newState.doc.textBetween(from, to, " ", " ");
          const inCode = !!codeType && newState.doc.rangeHasMark(from, to, codeType);
          if (inCode || !shouldKeepAutolink(text)) tr.removeMark(from, to, linkType);
        }
        return tr.steps.length > 0 ? tr.setMeta("preventAutolink", true) : null;
      },
    }),
  ],
});
