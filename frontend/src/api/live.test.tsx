import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveRefresh } from "./live";

// 테스트용 EventSource: 마지막으로 만든 연결에 이벤트를 직접 발생시킴
class FakeEventSource extends EventTarget {
  static last: FakeEventSource | null = null;
  url: string;
  closed = false;
  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.last = this;
  }
  close() {
    this.closed = true;
  }
}

function Probe() {
  useLiveRefresh("work-status", [["workStatuses"], ["annualLeaves"]]);
  return null;
}

describe("useLiveRefresh", () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    client = new QueryClient();
    vi.spyOn(client, "invalidateQueries");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderProbe = () => render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);

  it("변경 알림을 받으면 지정한 데이터를 다시 불러온다", () => {
    renderProbe();
    expect(FakeEventSource.last!.url).toBe("/api/live");
    FakeEventSource.last!.dispatchEvent(new Event("work-status"));
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["workStatuses"] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["annualLeaves"] });
  });

  it("다른 종류의 알림은 무시한다", () => {
    renderProbe();
    FakeEventSource.last!.dispatchEvent(new Event("document"));
    expect(client.invalidateQueries).not.toHaveBeenCalled();
  });

  it("처음 연결은 그대로 두고, 다시 연결되면 놓친 변경을 위해 다시 불러온다", () => {
    renderProbe();
    FakeEventSource.last!.dispatchEvent(new Event("open"));
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    FakeEventSource.last!.dispatchEvent(new Event("open"));
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["workStatuses"] });
  });

  it("화면을 떠나면 연결을 닫는다", () => {
    const { unmount } = renderProbe();
    const source = FakeEventSource.last!;
    unmount();
    expect(source.closed).toBe(true);
  });
});
