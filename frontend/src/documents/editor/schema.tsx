import { BlockNoteSchema, defaultBlockSpecs, defaultProps, defaultStyleSpecs } from "@blocknote/core";
import { CalloutBlockView } from "./CalloutBlockView";
import { codeStyleSpec } from "./codeStyle";
import { backgroundColorSpec, textColorSpec } from "./colorStyles";
import { codeBlockSpec } from "./codeBlock";
import { toggleListItemSpec } from "./toggleListItem";
import { createColumnBlock, createColumnListBlock } from "./columns";
import { createReactBlockSpec } from "@blocknote/react";
import { ScheduleBlockView } from "./ScheduleBlockView";
import { PageBlockView } from "./PageBlockView";

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

// 본문 페이지 블록("/페이지"): 이 페이지 아래 페이지(또는 파일)로 가는 한 줄, 지워도 페이지는 남음
export const createPageBlock = createReactBlockSpec(
  {
    type: "page",
    propSchema: { documentId: { default: 0 } },
    content: "none",
  },
  {
    render: ({ block }) => <PageBlockView documentId={block.props.documentId} />,
    // 내보내기(HTML·Markdown)에서는 링크 대신 안내 한 줄만 남김 (내보내기에는 화면 조회 데이터가 없음)
    toExternalHTML: () => <p>📄 하위 페이지</p>,
  },
);

// 본문 콜아웃 블록: 이모지 + 배경색 상자 안의 하위 블록들 (배경색은 블록 메뉴의 색 기능으로 바꿈, 기본 회색)
export const createCalloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      textColor: defaultProps.textColor,
      backgroundColor: { default: "gray" as const },
      icon: { default: "💡" },
    },
    // 노션처럼 글은 콜아웃 안의 하위 블록으로 담음 (안에서도 슬래시 메뉴·Enter·Tab이 본문과 똑같이 동작)
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <CalloutBlockView
        icon={block.props.icon}
        color={block.props.backgroundColor}
        editable={editor.isEditable}
        onChangeIcon={(icon) => editor.updateBlock(block, { props: { icon } })}
        onDocumentChange={(callback) => editor.onChange(callback)}
      />
    ),
    // 내보내기(HTML·Markdown)에서는 이모지만 인용문으로 남기고 안의 글은 하위 블록으로 이어짐
    toExternalHTML: ({ block }) => <blockquote>{block.props.icon}</blockquote>,
  },
);

// 편집기와 내보내기가 함께 쓰는 본문 스키마 (기본 블록 + 일정·페이지·콜아웃 블록)
export const editorSchema = BlockNoteSchema.create({
  // 코드 블록은 문법 색칠 언어 목록 + 노션식 언어·복사 도구 막대 (색칠 자체는 편집기의 syntaxHighlighter 확장이 담당)
  blockSpecs: {
    ...defaultBlockSpecs, codeBlock: codeBlockSpec, toggleListItem: toggleListItemSpec, schedule: createScheduleBlock(), page: createPageBlock(),
    callout: createCalloutBlock(), columnList: createColumnListBlock(), column: createColumnBlock(),
  },
  // 다른 서식과 함께 쓸 수 있는 코드 서식, 붙여넣은 색을 노션 색 이름으로 바꾸는 글자색·배경색 서식
  styleSpecs: { ...defaultStyleSpecs, code: codeStyleSpec, textColor: textColorSpec, backgroundColor: backgroundColorSpec },
});
