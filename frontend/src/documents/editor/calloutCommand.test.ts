import { describe, expect, it } from "vitest";
import { withCalloutItem } from "./calloutCommand";

describe("withCalloutItem", () => {
  const callout = { title: "콜아웃" };

  it("콜아웃 항목을 인용 바로 아래에 넣는다", () => {
    const items = [{ title: "제목1" }, { title: "인용" }, { title: "표" }];
    expect(withCalloutItem(items, callout, "인용").map((i) => i.title)).toEqual(["제목1", "인용", "콜아웃", "표"]);
  });

  it("인용이 없으면 맨 끝에 넣는다", () => {
    expect(withCalloutItem([{ title: "표" }], callout, "인용").map((i) => i.title)).toEqual(["표", "콜아웃"]);
  });
});
