import { createReactInlineContentSpec } from "@blocknote/react";

// 본문 @멘션: 팀원 한 명을 가리키는 글자 덩어리 (협업 서버가 memberId를 모아 담당 언급 알림으로 기록)
// name은 넣을 때의 이름을 그대로 보여줌 (이름이 바뀌어도 본문 글자는 그대로)
export const mentionInlineContentSpec = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      memberId: { default: 0 },
      name: { default: "" },
    },
    content: "none",
  } as const,
  {
    render: ({ inlineContent }) => (
      <span className="mention" data-member-id={inlineContent.props.memberId}>@{inlineContent.props.name}</span>
    ),
    // 내보내기·다른 프로그램 붙여넣기에서는 "@이름" 글자로
    toExternalHTML: ({ inlineContent }) => <span>@{inlineContent.props.name}</span>,
  },
);
