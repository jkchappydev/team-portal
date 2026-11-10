import { describe, expect, it } from "vitest";
import { sameViewers, shortName, viewersOf } from "./presence";

describe("viewersOf", () => {
  it("나는 맨 앞에, 나머지는 같은 사람은 한 번만 이름순으로 보여 준다", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { name: "나", color: "#000", memberId: 7 } }],
      [2, { user: { name: "이영희", color: "#f80", memberId: 3 } }],
      [3, { user: { name: "김민수", color: "#08f", memberId: 5 } }],
      [4, { user: { name: "이영희", color: "#f80", memberId: 3 } }],
      // 편집기가 아직 준비되지 않은 접속은 사용자 정보가 없음
      [5, {}],
    ]);

    expect(viewersOf(states, 7)).toEqual([
      { memberId: 7, name: "나", color: "#000", imageUrl: null },
      { memberId: 5, name: "김민수", color: "#08f", imageUrl: null },
      { memberId: 3, name: "이영희", color: "#f80", imageUrl: null },
    ]);
  });

  it("본인이 고른 색과 프로필 이미지가 있으면 그것을 쓴다", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { name: "이영희", color: "#f80", memberId: 3, profileColor: "#1971c2", imageUrl: "/img/3" } }],
    ]);

    expect(viewersOf(states, 7)).toEqual([{ memberId: 3, name: "이영희", color: "#1971c2", imageUrl: "/img/3" }]);
  });
});

describe("shortName", () => {
  it("세 글자 이상이면 뒤 두 글자, 아니면 그대로", () => {
    expect(shortName("이영희")).toBe("영희");
    expect(shortName("남궁민수")).toBe("민수");
    expect(shortName("이산")).toBe("이산");
  });
});

describe("sameViewers", () => {
  it("순서와 내용이 같을 때만 같다고 본다", () => {
    const a = [{ memberId: 1, name: "가", color: "#000", imageUrl: null }];
    expect(sameViewers(a, [{ ...a[0] }])).toBe(true);
    expect(sameViewers(a, [])).toBe(false);
    expect(sameViewers(a, [{ ...a[0], name: "나" }])).toBe(false);
    expect(sameViewers(a, [{ ...a[0], imageUrl: "/img/1" }])).toBe(false);
  });
});
