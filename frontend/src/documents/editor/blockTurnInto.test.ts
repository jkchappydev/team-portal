import { describe, expect, it } from "vitest";
import { canTurnInto, currentTurnIntoKey, plainText, TURN_INTO_OPTIONS, turnIntoChange } from "./blockTurnInto";
import type { TurnIntoBlock } from "./blockTurnInto";

const block = (over: Partial<TurnIntoBlock> = {}): TurnIntoBlock => ({
  id: "a", type: "paragraph", props: {}, content: [{ type: "text", text: "안녕", styles: { bold: true } }], children: [], ...over,
});

describe("blockTurnInto", () => {
  it("전환 목록은 슬래시 메뉴와 같은 이름을 쓴다", () => {
    expect(TURN_INTO_OPTIONS.map((o) => o.label)).toEqual([
      "본문", "제목1", "제목2", "제목3", "글머리 기호 목록", "번호 매기기 목록", "체크리스트", "접을 수 있는 목록", "코드 블록", "인용", "콜아웃",
    ]);
  });

  it("글이 있는 블록만 전환할 수 있다 (페이지·표·이미지·콜아웃은 제외)", () => {
    expect(canTurnInto({ type: "paragraph" })).toBe(true);
    expect(canTurnInto({ type: "codeBlock" })).toBe(true);
    for (const type of ["page", "table", "image", "callout", "schedule", "columnList"]) expect(canTurnInto({ type })).toBe(false);
  });

  it("지금 종류를 알려 주고, 접을 수 있는 제목·제목4는 목록에 없어 표시하지 않는다", () => {
    expect(currentTurnIntoKey({ type: "heading", props: { level: 2, isToggleable: false } })).toBe("heading2");
    expect(currentTurnIntoKey({ type: "heading", props: { level: 2, isToggleable: true } })).toBeNull();
    expect(currentTurnIntoKey({ type: "heading", props: { level: 4 } })).toBeNull();
    expect(currentTurnIntoKey({ type: "quote", props: {} })).toBe("quote");
  });

  it("글 종류만 바꾸고 글은 그대로 둔다 (제목은 단계 지정)", () => {
    expect(turnIntoChange(block(), "heading3")).toEqual({ kind: "update", update: { type: "heading", props: { level: 3, isToggleable: false } } });
    expect(turnIntoChange(block(), "checkListItem")).toEqual({ kind: "update", update: { type: "checkListItem" } });
  });

  it("코드 블록으로 바꾸면 서식·멘션을 뺀 글만 남기고, 코드 블록에서 나올 때도 글 그대로", () => {
    const content = [
      { type: "text", text: "담당 ", styles: { bold: true } },
      { type: "mention", props: { memberId: 1, name: "홍길동" } },
      { type: "link", href: "https://example.com", content: [{ type: "text", text: " 링크", styles: {} }] },
    ];
    expect(plainText(content)).toBe("담당 @홍길동 링크");
    expect(turnIntoChange(block({ content }), "codeBlock")).toEqual({ kind: "update", update: { type: "codeBlock", content: "담당 @홍길동 링크" } });
    expect(turnIntoChange(block({ type: "codeBlock", content: [{ type: "text", text: "x = 1", styles: {} }] }), "paragraph"))
      .toEqual({ kind: "update", update: { type: "paragraph", content: "x = 1" } });
  });

  it("콜아웃으로 바꾸면 글과 원래 하위 블록을 상자 안에 담는다", () => {
    const child = { id: "c", type: "paragraph", props: {}, content: [], children: [] };
    const change = turnIntoChange(block({ children: [child] }), "callout");
    expect(change).toEqual({
      kind: "replace",
      blocks: [{ type: "callout", children: [{ type: "paragraph", content: block().content }, child] }],
    });
  });
});
