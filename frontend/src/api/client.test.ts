import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";
import { getStoredUserId, setStoredUserId } from "../user/currentUser";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장된 사용자 ID를 X-User-Id 헤더로 보낸다", async () => {
    setStoredUserId(7);
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { ok: 1 }, error: null }));

    const data = await apiFetch<{ ok: number }>("/api/x");

    expect(data).toEqual({ ok: 1 });
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("X-User-Id")).toBe("7");
  });

  it("success=false면 code와 status를 가진 ApiError를 던진다", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, data: null, error: { code: "NOT_FOUND", message: "없음" } }, 404),
    );

    const error = (await apiFetch("/api/x").catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("없음");
  });

  it("apiClient_onUserNotSelected_clearsStoredUser", async () => {
    setStoredUserId(3);
    const listener = vi.fn();
    window.addEventListener("portal:user-cleared", listener);
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, data: null, error: { code: "USER_NOT_SELECTED", message: "x" } }, 401),
    );

    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);

    expect(getStoredUserId()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("portal:user-cleared", listener);
  });

  it("JSON 본문이면 Content-Type을 application/json으로 설정한다", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: null, error: null }));

    await apiFetch("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("FormData 본문이면 Content-Type을 설정하지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: null, error: null }));

    await apiFetch("/api/x", { method: "POST", body: new FormData() });

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("204 응답은 undefined로 처리한다", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
