import { describe, expect, it } from "vitest";
import type { SpaceDto } from "../api/spaces";
import { moveToSection, sectionOf } from "./spaceKind";

const space = (id: number, section: SpaceDto["section"]): SpaceDto => ({
  id, name: `항목 ${id}`, description: null, documentCount: 0, homeDocumentId: null, kind: "PROJECT", section, icon: null, cover: null,
});
const view = (spaces: SpaceDto[]) => spaces.map((s) => `${s.id}${s.section === "EXTERNAL" ? "외" : "내"}`);

describe("moveToSection", () => {
  const spaces = [space(1, "INTERNAL"), space(2, "INTERNAL"), space(3, "EXTERNAL"), space(4, "EXTERNAL")];

  it("다른 칸으로 옮기면 구분을 바꾸고 그 칸의 index 위치에 넣는다", () => {
    expect(view(moveToSection(spaces, 1, 1, "EXTERNAL"))).toEqual(["2내", "3외", "1외", "4외"]);
  });

  it("같은 칸 안에서는 순서만 바꾼다", () => {
    expect(view(moveToSection(spaces, 4, 0, "EXTERNAL"))).toEqual(["1내", "2내", "4외", "3외"]);
  });

  it("범위를 넘는 index는 칸 맨 뒤, 모르는 항목은 그대로 둔다", () => {
    expect(view(moveToSection(spaces, 3, 99, "INTERNAL"))).toEqual(["1내", "2내", "3내", "4외"]);
    expect(moveToSection(spaces, 9, 0, "INTERNAL")).toBe(spaces);
  });
});

describe("sectionOf", () => {
  it("구분 값이 없는 예전 응답은 내부 프로젝트로 본다", () => {
    expect(sectionOf({} as SpaceDto)).toBe("INTERNAL");
  });
});
