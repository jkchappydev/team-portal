import { describe, expect, it } from "vitest";
import { formatRate, formatTick, niceRateMax, timeTicks, tooltipTop } from "./MetricChart";

describe("MetricChart 눈금과 표시", () => {
  it("초당 바이트를 알맞은 단위로 줄여 보여준다", () => {
    expect(formatRate(512)).toBe("512 B/s");
    expect(formatRate(2334.72)).toBe("2.28 KB/s");
    expect(formatRate(5 * 1024 ** 2)).toBe("5.00 MB/s");
  });

  it("세로축 최댓값은 가장 큰 값을 덮는 4등분하기 좋은 수", () => {
    expect(niceRateMax(0)).toBe(1024);
    expect(niceRateMax(3000)).toBe(4 * 1024);
    expect(niceRateMax(70 * 1024 ** 2)).toBe(100 * 1024 ** 2);
  });

  it("가로축 눈금은 개수 안에서 정각에 맞추고, 하루가 넘으면 날짜로 보여준다", () => {
    const to = new Date(2026, 10, 24, 10, 7).getTime();
    const ticks = timeTicks(to - 3_600_000, to, 6);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks.every((t) => new Date(t).getMinutes() % 10 === 0)).toBe(true);
    expect(formatTick(new Date(2026, 10, 24, 9, 5).getTime(), 3_600_000)).toBe("09:05");
    expect(formatTick(new Date(2026, 10, 24, 0, 0).getTime(), 7 * 86_400_000)).toBe("11/24");
  });

  it("값 상자는 점 위에 자리가 있으면 위, 값이 높아 자리가 없으면 점 아래에 둔다", () => {
    // 점이 아래쪽(낮은 값)이면 점보다 위
    expect(tooltipTop(150)).toBeLessThan(150 - 44);
    // 점이 맨 위(높은 값)면 점보다 아래
    expect(tooltipTop(20)).toBeGreaterThan(20);
  });
});
