import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLastValue } from "./useLastValue";

describe("useLastValue", () => {
  // 창을 닫으려고 값을 null로 바꿔도 사라지는 동안에는 마지막 값을 그대로 보임
  it("값이 null이 되면 마지막 값을 유지하고, 새 값이 오면 바꾼다", () => {
    const { result, rerender } = renderHook(({ value }) => useLastValue(value), { initialProps: { value: null as string | null } });
    expect(result.current).toBeNull();
    rerender({ value: "내부 프로젝트" });
    expect(result.current).toBe("내부 프로젝트");
    rerender({ value: null });
    expect(result.current).toBe("내부 프로젝트");
    rerender({ value: "외부 프로젝트" });
    expect(result.current).toBe("외부 프로젝트");
  });
});
