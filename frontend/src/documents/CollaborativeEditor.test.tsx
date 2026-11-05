import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CollaborativeEditor from "./CollaborativeEditor";

type Handler = (payload: unknown) => void;

// 모킹된 provider·doc 인스턴스 기록용 저장소
const registry = vi.hoisted(() => ({
  providers: [] as Array<{
    configuration: { name: string; token: string; document: unknown; url: string };
    destroyed: boolean;
    hasUnsyncedChanges: boolean;
    emit: (event: string, payload?: unknown) => void;
    listenerCount: () => number;
  }>,
  docs: [] as Array<{ destroyed: boolean }>,
  rendered: null as { isEditable: boolean } | null,
}));

vi.mock("@hocuspocus/provider", () => {
  class HocuspocusProvider {
    configuration: { name: string; token: string; document: unknown; url: string };
    destroyed = false;
    hasUnsyncedChanges = false;
    awareness = {};
    private handlers = new Map<string, Set<Handler>>();

    constructor(configuration: { name: string; token: string; document: unknown; url: string }) {
      this.configuration = configuration;
      registry.providers.push(this);
    }

    on(event: string, fn: Handler) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)!.add(fn);
    }

    off(event: string, fn: Handler) {
      this.handlers.get(event)?.delete(fn);
    }

    emit(event: string, payload?: unknown) {
      this.handlers.get(event)?.forEach((fn) => fn(payload));
    }

    listenerCount() {
      let count = 0;
      this.handlers.forEach((set) => (count += set.size));
      return count;
    }

    destroy() {
      this.destroyed = true;
    }
  }
  return { HocuspocusProvider };
});

vi.mock("yjs", () => {
  class Doc {
    destroyed = false;
    constructor() {
      registry.docs.push(this);
    }
    getXmlFragment() {
      return {};
    }
    // 문서 변경 구독 (커서 이름표 표시용)
    on() {}
    off() {}
    destroy() {
      this.destroyed = true;
    }
  }
  return { Doc };
});

vi.mock("@blocknote/core/yjs", () => ({ withCollaboration: (options: unknown) => options }));
vi.mock("@blocknote/core/locales", () => ({ ko: {} }));
vi.mock("@blocknote/react", async () => {
  const { useState } = await import("react");
  return {
    // 마운트 동안 같은 편집기 인스턴스 유지
    useCreateBlockNote: () => useState(() => ({ isEditable: true }))[0],
    // 노션식 블록 메뉴 연결부는 화면에 그리지 않음
    SideMenuController: () => null,
    SideMenu: () => null,
    TableHandlesController: () => null,
  };
});
vi.mock("./editor/NotionDragHandleMenu", () => ({ NotionDragHandleMenu: () => null }));
vi.mock("@blocknote/mantine", () => ({
  // StrictMode에서 버려진 인스턴스와 구분하려고 실제 렌더된 편집기를 기록
  BlockNoteView: ({ editor }: { editor: { isEditable: boolean } }) => {
    registry.rendered = editor;
    return <div data-testid="editor" />;
  },
}));

const user = { id: 3, name: "홍길동", active: true };

function renderEditor() {
  return render(
    <StrictMode>
      <MantineProvider>
        <CollaborativeEditor documentId={42} user={user} />
      </MantineProvider>
    </StrictMode>,
  );
}

function aliveProvider() {
  const alive = registry.providers.filter((p) => !p.destroyed);
  expect(alive).toHaveLength(1);
  return alive[0];
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("CollaborativeEditor 연결 수명주기", () => {
  beforeAll(() => {
    // Mantine이 사용하는 matchMedia를 jsdom에 제공
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  beforeEach(() => {
    registry.providers.length = 0;
    registry.docs.length = 0;
    registry.rendered = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("StrictMode 이중 마운트 후 살아 있는 provider는 하나이고 synced 전에는 편집기를 만들지 않는다", () => {
    renderEditor();

    const provider = aliveProvider();
    expect(registry.providers.length).toBeGreaterThanOrEqual(1);
    expect(registry.docs.filter((d) => !d.destroyed)).toHaveLength(1);
    expect(provider.configuration.name).toBe("document-42");
    expect(provider.configuration.token).toBeTypeOf("function");
    expect(provider.configuration.url).toMatch(/^ws:\/\/.+\/collab$/);
    expect(screen.queryByTestId("editor")).toBeNull();

    act(() => provider.emit("status", { status: "connected" }));
    expect(screen.queryByTestId("editor")).toBeNull();

    act(() => provider.emit("synced", { state: true }));
    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("연결이 끊기면 읽기 전용, 다시 연결되면 편집 가능", () => {
    renderEditor();
    const provider = aliveProvider();
    act(() => {
      provider.emit("status", { status: "connected" });
      provider.emit("synced", { state: true });
    });
    expect(registry.rendered!.isEditable).toBe(true);
    expect(screen.queryByText("연결됨")).toBeNull();
    expect(screen.queryByText("재연결 중")).toBeNull();

    act(() => provider.emit("status", { status: "disconnected" }));
    expect(registry.rendered!.isEditable).toBe(false);
    expect(screen.getByText("재연결 중")).toBeTruthy();
    expect(screen.getByText(/다시 연결되면 편집할 수 있습니다/)).toBeTruthy();

    act(() => provider.emit("status", { status: "connected" }));
    expect(registry.rendered!.isEditable).toBe(true);
  });

  it("저장되지 않은 변경이 있으면 페이지 이탈 경고를 띄우고, 동기화되면 해제한다", () => {
    const { unmount } = renderEditor();
    const provider = aliveProvider();
    expect(beforeUnloadPrevented()).toBe(false);

    act(() => {
      provider.hasUnsyncedChanges = true;
      provider.emit("unsyncedChanges", { number: 1 });
    });
    expect(beforeUnloadPrevented()).toBe(true);

    act(() => {
      provider.hasUnsyncedChanges = false;
      provider.emit("unsyncedChanges", { number: 0 });
    });
    expect(beforeUnloadPrevented()).toBe(false);

    act(() => {
      provider.hasUnsyncedChanges = true;
      provider.emit("unsyncedChanges", { number: 1 });
    });
    unmount();
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("접속이 거부되면 로딩 대신 새로고침 안내를 보여준다", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    renderEditor();
    const provider = aliveProvider();
    expect(screen.getByText("문서를 불러오는 중...")).toBeTruthy();

    act(() => provider.emit("authenticationFailed", { reason: "permission-denied" }));

    expect(screen.queryByText("문서를 불러오는 중...")).toBeNull();
    expect(screen.getByText("접속 거부됨")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "새로고침" }).click());
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("언마운트하면 provider와 doc을 해제하고 이벤트 구독을 정리한다", () => {
    const { unmount } = renderEditor();
    const provider = aliveProvider();
    act(() => provider.emit("synced", { state: true }));

    unmount();

    expect(registry.providers.every((p) => p.destroyed)).toBe(true);
    expect(registry.docs.every((d) => d.destroyed)).toBe(true);
    expect(provider.listenerCount()).toBe(0);
  });
});
