import { describe, expect, it } from "vitest";
import { dropSlotAt, moveIndexOf } from "./dropSlot";

const rows = [{ top: 0, height: 30 }, { top: 30, height: 30 }, { top: 60, height: 30 }];

describe("dropSlotAt", () => {
  it("줄 가운데를 기준으로 가장 가까운 줄 사이를 고른다", () => {
    expect(dropSlotAt(10, rows)).toBe(0);
    expect(dropSlotAt(20, rows)).toBe(1);
    expect(dropSlotAt(50, rows)).toBe(2);
  });

  it("목록 위·아래 바깥은 맨 앞·맨 뒤로 잡는다", () => {
    expect(dropSlotAt(-100, rows)).toBe(0);
    expect(dropSlotAt(80, rows)).toBe(3);
    expect(dropSlotAt(500, rows)).toBe(3);
  });
});

describe("moveIndexOf", () => {
  it("끌던 줄을 뺀 목록 기준 순서로 바꾸고 제자리는 null", () => {
    expect(moveIndexOf(0, 2)).toBe(0);
    expect(moveIndexOf(3, 0)).toBe(2);
    expect(moveIndexOf(0, 0)).toBeNull();
    expect(moveIndexOf(1, 0)).toBeNull();
  });
});
