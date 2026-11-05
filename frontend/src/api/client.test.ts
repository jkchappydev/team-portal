import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";

describe("apiFetch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/"; });
  it("변경 요청에 CSRF 토큰을 보내고 사용자 ID는 보내지 않는다", async () => {
    document.cookie = "XSRF-TOKEN=abc; path=/";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: null })));
    await apiFetch("/api/x", { method: "POST" });
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("X-XSRF-TOKEN")).toBe("abc");
    expect(headers.has("X-User-Id")).toBe(false);
  });
  it("조회에는 CSRF 헤더를 보내지 않는다", async () => {
    document.cookie = "XSRF-TOKEN=abc; path=/";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: null })));
    await apiFetch("/api/x");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has("X-XSRF-TOKEN")).toBe(false);
  });
  it("승인 대기 오류를 알린다", async () => {
    const listener = vi.fn(); window.addEventListener("portal:auth-changed", listener);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "ACCOUNT_PENDING", message: "대기" } }), { status: 403 }));
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce(); window.removeEventListener("portal:auth-changed", listener);
  });
});
