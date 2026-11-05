interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// ApiResponse를 풀어 data 반환
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) {
    const token = document.cookie.split("; ").find((part) => part.startsWith("XSRF-TOKEN="))?.slice(11);
    if (token) headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
  }
  // FormData는 브라우저가 multipart 경계를 포함해 Content-Type을 설정
  if (init.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let body: ApiEnvelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;
  } catch {
    body = null;
  }

  if (!response.ok || !body || !body.success) {
    const code = body?.error?.code ?? "UNKNOWN_ERROR";
    const message = body?.error?.message ?? `요청에 실패했습니다 (${response.status})`;
    // 사용자 미선택 응답이면 저장된 사용자를 지우고 선택 창을 다시 띄우도록 알림
    if (path !== "/api/auth/me" && ["UNAUTHENTICATED", "ACCOUNT_PENDING", "ACCOUNT_REJECTED", "MEMBER_INACTIVE"].includes(code)) {
      window.dispatchEvent(new CustomEvent("portal:auth-changed", { detail: code }));
    }
    throw new ApiError(code, message, response.status);
  }
  return body.data as T;
}
