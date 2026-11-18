import { describe, expect, it } from "vitest";
import type { SpaceDto } from "../api/spaces";
import { pathAfterSpaceDeleted } from "./spaceNavigation";

const space = (id: number): SpaceDto => ({ id, name: `p${id}`, description: null, documentCount: 0, homeDocumentId: null, kind: "PROJECT", section: "INTERNAL", icon: null, cover: null });

describe("pathAfterSpaceDeleted", () => {
  const spaces = [space(1), space(2), space(3)];

  it("지운 페이지의 바로 아래 페이지로 간다", () => {
    expect(pathAfterSpaceDeleted(spaces, 1)).toBe("/spaces/2");
    expect(pathAfterSpaceDeleted(spaces, 2)).toBe("/spaces/3");
  });

  it("맨 아래 페이지를 지우면 바로 위 페이지로 간다", () => {
    expect(pathAfterSpaceDeleted(spaces, 3)).toBe("/spaces/2");
  });

  it("남은 페이지가 없으면 근무 상황표로 간다", () => {
    expect(pathAfterSpaceDeleted([space(1)], 1)).toBe("/work-status");
    expect(pathAfterSpaceDeleted(undefined, 1)).toBe("/work-status");
  });
});
