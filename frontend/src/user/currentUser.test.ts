import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";

describe("인증 오류", () => {
  it("서버의 인증 오류 코드를 보존한다", () => {
    expect(new ApiError("UNAUTHENTICATED", "로그인이 필요합니다", 401).code).toBe("UNAUTHENTICATED");
  });
});
