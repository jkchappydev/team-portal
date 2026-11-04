import { afterEach, describe, expect, it, vi } from "vitest";
import { clearStoredUserId, getStoredUserId, setStoredUserId } from "./currentUser";

describe("currentUser storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("저장한 ID를 읽고 삭제할 수 있다", () => {
    setStoredUserId(5);
    expect(getStoredUserId()).toBe(5);
    clearStoredUserId();
    expect(getStoredUserId()).toBeNull();
  });

  it("localStorage 접근이 throw해도 null을 반환한다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getStoredUserId()).toBeNull();
  });
});
