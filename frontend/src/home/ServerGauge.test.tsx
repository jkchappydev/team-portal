import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { gaugeLevel, ServerGauge } from "./ServerGauge";

describe("ServerGauge", () => {
  afterEach(cleanup);

  it("이름·퍼센트 한 줄과 사용률만큼 찬 막대, 아래 설명을 보여준다", () => {
    render(<ServerGauge label="MEMORY" percent={61.4} detail="8.0GB / 16.0GB" />);
    expect(screen.getByText("MEMORY")).toBeTruthy();
    expect(screen.getByText("61%")).toBeTruthy();
    expect(screen.getByText("8.0GB / 16.0GB")).toBeTruthy();
    const meter = screen.getByRole("meter", { name: "MEMORY 사용률" });
    expect(meter.getAttribute("aria-valuenow")).toBe("61");
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("61.4%");
  });

  it("측정 전이면 막대를 비우고 숫자는 -로 보여준다", () => {
    render(<ServerGauge label="CPU" percent={null} />);
    expect(screen.getByText("-")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBeNull();
  });

  it("80% 이상은 주의(주황), 90% 이상은 위험(빨강) 막대", () => {
    expect(gaugeLevel(null)).toBe("normal");
    expect(gaugeLevel(79.9)).toBe("normal");
    expect(gaugeLevel(80)).toBe("warn");
    expect(gaugeLevel(90)).toBe("danger");
  });
});
