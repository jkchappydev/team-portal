import { describe, expect, it } from "vitest";
import { buildTimeOptions, formatTimeLabel } from "./timeOptions";

describe("timeOptions", () => {
  it("00:00부터 23:50까지 10분 단위 144개를 만든다", () => {
    const options = buildTimeOptions();
    expect(options).toHaveLength(144);
    expect(options[0].value).toBe("00:00");
    expect(options[1].value).toBe("00:10");
    expect(options[143].value).toBe("23:50");
  });

  it("오전/오후 12시간제 라벨을 만든다", () => {
    expect(formatTimeLabel("00:00")).toBe("오전 12:00");
    expect(formatTimeLabel("09:00")).toBe("오전 09:00");
    expect(formatTimeLabel("12:30")).toBe("오후 12:30");
    expect(formatTimeLabel("18:00")).toBe("오후 06:00");
  });

  it("10분 단위가 아닌 기존 값은 목록에 순서대로 끼워 넣는다", () => {
    const options = buildTimeOptions("15:35");
    expect(options).toHaveLength(145);
    const index = options.findIndex((o) => o.value === "15:35");
    expect(options[index - 1].value).toBe("15:30");
    expect(options[index + 1].value).toBe("15:40");
  });
});
