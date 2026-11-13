import { describe, expect, it } from "vitest";
import { calloutOfTitle } from "./AlignedSideMenuController";

describe("calloutOfTitle", () => {
  const callout = { id: "c", type: "callout", children: [{ id: "title" }, { id: "second" }] };

  it("콜아웃 첫 줄(제목)은 손잡이 대상을 콜아웃 전체로 바꾼다", () => {
    expect(calloutOfTitle({ id: "title" }, callout)).toBe(callout);
  });

  it("콜아웃 둘째 줄부터와 다른 블록 안의 줄은 그대로 둔다", () => {
    expect(calloutOfTitle({ id: "second" }, callout)).toBeNull();
    expect(calloutOfTitle({ id: "x" }, { id: "t", type: "toggleListItem", children: [{ id: "x" }] })).toBeNull();
    expect(calloutOfTitle({ id: "top" }, undefined)).toBeNull();
  });
});
