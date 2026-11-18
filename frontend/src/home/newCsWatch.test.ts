import { describe, expect, it } from "vitest";
import type { NewCsDto } from "../api/cs";
import { pickNewRequests } from "./newCsWatch";

const cs = (id: number, status = "REQS"): NewCsDto => ({
  id, title: `문의 ${id}`, groupName: null, requesterName: "홍길동", managerName: null, status, statusName: null,
  createdAt: null, detailUrl: `https://cs.example.com/detail?boardKey=${id}`,
});

describe("pickNewRequests", () => {
  it("첫 조회는 기준만 만들고 알림을 띄우지 않는다", () => {
    const { seen, fresh } = pickNewRequests(null, [cs(1), cs(2, "COMP")]);
    expect(fresh).toEqual([]);
    expect([...seen]).toEqual([1, 2]);
  });

  it("이후 조회에서 처음 보는 요청 상태 CS만 고른다", () => {
    const { seen, fresh } = pickNewRequests(new Set([1, 2]), [cs(4), cs(3, "PROG"), cs(1), cs(2, "COMP")]);
    expect(fresh.map((item) => item.id)).toEqual([4]);
    expect(seen.has(3)).toBe(true);
  });

  it("이미 본 CS는 상태가 바뀌어도 다시 고르지 않는다", () => {
    expect(pickNewRequests(new Set([1]), [cs(1)]).fresh).toEqual([]);
  });
});
