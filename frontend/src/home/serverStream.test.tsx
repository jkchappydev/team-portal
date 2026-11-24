import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STREAM_RETRY_MS, useServerStream } from "./ServerMonitor";

// 테스트용 EventSource: 만든 연결을 모두 기억하고 이벤트를 직접 발생시킴
class FakeEventSource extends EventTarget {
  static all: FakeEventSource[] = [];
  url: string;
  readyState = 0;
  closed = false;
  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.all.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  static get last(): FakeEventSource {
    return FakeEventSource.all[FakeEventSource.all.length - 1];
  }
}

function Probe() {
  return <span data-testid="live">{String(useServerStream())}</span>;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useServerStream", () => {
  let client: QueryClient;
  beforeEach(() => {
    FakeEventSource.all = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    client = new QueryClient();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderProbe = () => render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);

  it("받은 서버 목록을 조회 결과 캐시에 그대로 넣는다", () => {
    renderProbe();
    expect(FakeEventSource.last.url).toBe("/api/monitor/servers/stream");
    const servers = [{ serverName: "포털 서버", available: true }];
    act(() => {
      FakeEventSource.last.dispatchEvent(new MessageEvent("servers", { data: JSON.stringify(servers) }));
    });
    expect(client.getQueryData(["monitor", "servers"])).toEqual(servers);
    expect(screen.getByTestId("live").textContent).toBe("true");
  });

  it("탭이 가려지면 연결을 닫고 다시 보이면 새로 연결한다", () => {
    renderProbe();
    const first = FakeEventSource.last;
    setVisibility("hidden");
    expect(first.closed).toBe(true);
    setVisibility("visible");
    expect(FakeEventSource.all).toHaveLength(2);
    expect(FakeEventSource.last.closed).toBe(false);
  });

  it("오류 응답으로 연결이 끝나면 조회로 바꿨다가 잠시 뒤 다시 연결한다", () => {
    vi.useFakeTimers();
    renderProbe();
    const first = FakeEventSource.last;
    first.readyState = 2;
    act(() => {
      first.dispatchEvent(new Event("error"));
    });
    expect(screen.getByTestId("live").textContent).toBe("false");
    expect(first.closed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(STREAM_RETRY_MS);
    });
    expect(screen.getByTestId("live").textContent).toBe("true");
    expect(FakeEventSource.all).toHaveLength(2);
  });

  it("잠깐 끊겨 브라우저가 다시 연결하는 중이면 연결을 그대로 둔다", () => {
    renderProbe();
    act(() => {
      FakeEventSource.last.dispatchEvent(new Event("error"));
    });
    expect(screen.getByTestId("live").textContent).toBe("true");
    expect(FakeEventSource.last.closed).toBe(false);
  });

  it("화면을 떠나면 연결을 닫는다", () => {
    const { unmount } = renderProbe();
    unmount();
    expect(FakeEventSource.last.closed).toBe(true);
  });
});
