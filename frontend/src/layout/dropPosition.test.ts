import { describe, expect, it } from "vitest";
import { dropPositionAt } from "./dropPosition";

describe("dropPositionAt", () => {
  it("줄의 위 30%는 앞, 아래 30%는 뒤, 가운데는 안쪽이다", () => {
    expect(dropPositionAt(2, 30, true)).toBe("before");
    expect(dropPositionAt(15, 30, true)).toBe("inside");
    expect(dropPositionAt(28, 30, true)).toBe("after");
  });

  it("형제 끼워 넣기를 막은 줄(최상위 페이지)은 어디에 놓아도 안쪽이다", () => {
    expect(dropPositionAt(2, 30, false)).toBe("inside");
    expect(dropPositionAt(28, 30, false)).toBe("inside");
  });

  it("안쪽을 막은 줄(파일)은 위 절반이면 앞, 아래 절반이면 뒤다", () => {
    expect(dropPositionAt(10, 30, true, false)).toBe("before");
    expect(dropPositionAt(16, 30, true, false)).toBe("after");
  });
});
