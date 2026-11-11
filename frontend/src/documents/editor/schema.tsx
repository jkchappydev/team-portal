import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { codeBlockSpec } from "./codeBlock";
import { createReactBlockSpec } from "@blocknote/react";
import { ScheduleBlockView } from "./ScheduleBlockView";

// 본문 안의 일정(WBS) 블록: 같은 페이지 아래 WBS 항목을 표·간트 차트로 그대로 보여주고 편집
// 내용이 없는 블록이라 편집기가 블록 안의 키 입력·끌기 이벤트를 가로채지 않음
export const createScheduleBlock = createReactBlockSpec(
  {
    type: "schedule",
    propSchema: { documentId: { default: 0 } },
    content: "none",
  },
  {
    render: ({ block }) => <ScheduleBlockView documentId={block.props.documentId} />,
    // 내보내기(HTML·Markdown)에서는 표 대신 안내 문구만 남김
    toExternalHTML: () => <p>📊 일정(WBS) 표는 팀 포털에서 확인하세요.</p>,
  },
);

// 편집기와 내보내기가 함께 쓰는 본문 스키마 (기본 블록 + 일정 블록)
export const editorSchema = BlockNoteSchema.create({
  // 코드 블록은 문법 색칠 언어 목록 + 노션식 언어·복사 도구 막대 (색칠 자체는 편집기의 syntaxHighlighter 확장이 담당)
  blockSpecs: { ...defaultBlockSpecs, codeBlock: codeBlockSpec, schedule: createScheduleBlock() },
});
