import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { claimPageBlockBackfill } from "../api/documents";
import CollaborativeEditor from "./CollaborativeEditor";

type Handler = (payload: unknown) => void;

interface FakeAwareness {
  states: Map<number, Record<string, unknown>>;
  emitChange: () => void;
  listenerCount: () => number;
}

// 모킹된 provider·doc 인스턴스 기록용 저장소
const registry = vi.hoisted(() => ({
  providers: [] as Array<{
    configuration: { name: string; token: string; document: unknown; url: string };
    destroyed: boolean;
    hasUnsyncedChanges: boolean;
    awareness: FakeAwareness;
    emit: (event: string, payload?: unknown) => void;
    listenerCount: () => number;
  }>,
  docs: [] as Array<{ destroyed: boolean }>,
  rendered: null as { isEditable: boolean } | null,
  // 편집기에 넣은 블록 기록 (기존 하위 페이지 자동 삽입 확인용)
  inserted: [] as unknown[][],
}));

vi.mock("../api/documents", () => ({ createDocument: vi.fn(), claimPageBlockBackfill: vi.fn() }));

vi.mock("@hocuspocus/provider", () => {
  class HocuspocusProvider {
    configuration: { name: string; token: string; document: unknown; url: string };
    destroyed = false;
    hasUnsyncedChanges = false;
    // 보는 사람 표시용 접속 상태(awareness)
    awareness = (() => {
      const listeners = new Set<() => void>();
      const states = new Map<number, Record<string, unknown>>();
      return {
        states,
        getStates: () => states,
        on: (_event: string, fn: () => void) => listeners.add(fn),
        off: (_event: string, fn: () => void) => listeners.delete(fn),
        setLocalStateField: () => {},
        emitChange: () => listeners.forEach((fn) => fn()),
        listenerCount: () => listeners.size,
      };
    })();
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
vi.mock("@blocknote/core/locales", () => ({ ko: { formatting_toolbar: { code: {} }, slash_menu: { quote: { title: "인용", group: "기본 블록" } } } }));
vi.mock("@blocknote/react", async () => {
  const { useState } = await import("react");
  return {
    // 마운트 동안 같은 편집기 인스턴스 유지
    // 되돌리기 기록 복구가 읽는 편집기 상태·화면 연결 알림은 빈 값으로 둠
    useCreateBlockNote: () => useState(() => ({
      isEditable: true, prosemirrorState: {}, onMount: () => () => {}, onChange: () => () => {},
      document: [{ id: "last" }],
      insertBlocks: (blocks: unknown[]) => registry.inserted.push(blocks),
    }))[0],
    // 노션식 블록 메뉴 연결부는 화면에 그리지 않음
    SideMenuController: () => null,
    SideMenu: () => null,
    TableHandlesController: () => null,
    // "/일정"을 더한 슬래시 메뉴 연결부도 그리지 않음
    SuggestionMenuController: () => null,
    getDefaultReactSlashMenuItems: () => [],
    // 코드·서식 지우기를 더한 서식 도구 막대 연결부도 그리지 않음
    FormattingToolbarController: () => null,
  };
});
// 일정 블록 스키마는 실제 편집기 없이 확인하므로 빈 값
vi.mock("./editor/schema", () => ({ editorSchema: {} }));
vi.mock("./editor/NotionDragHandleMenu", () => ({ NotionDragHandleMenu: () => null }));
vi.mock("./editor/formattingToolbar", () => ({ NotionFormattingToolbar: () => null }));
vi.mock("./editor/formatShortcuts", () => ({ FORMAT_SHORTCUTS: { code: "Mod+E" }, formatShortcutsExtension: {} }));
vi.mock("./editor/activeTableCell", () => ({ activeTableCellExtension: {} }));
vi.mock("./editor/tableHandleDrag", () => ({ tableHandleDragExtension: {} }));
vi.mock("./editor/checkListAnimation", () => ({ checkListAnimationExtension: {} }));
vi.mock("./editor/CellSelectionMenu", () => ({ CellSelectionMenu: () => null }));
vi.mock("@blocknote/mantine", () => ({
  // StrictMode에서 버려진 인스턴스와 구분하려고 실제 렌더된 편집기를 기록
  BlockNoteView: ({ editor }: { editor: { isEditable: boolean } }) => {
    registry.rendered = editor;
    return <div data-testid="editor" />;
  },
}));

const user = { id: 3, name: "홍길동", active: true };

function renderEditor(onViewersChange?: (viewers: unknown[]) => void, spaceId?: number) {
  return render(
    <StrictMode>
      <MantineProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <CollaborativeEditor documentId={42} user={user} spaceId={spaceId} onViewersChange={onViewersChange} />
          </MemoryRouter>
        </QueryClientProvider>
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
    registry.inserted.length = 0;
    vi.mocked(claimPageBlockBackfill).mockReset();
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
    expect(provider.awareness.listenerCount()).toBe(0);
  });

  it("접속 상태가 바뀌면 나를 포함한 보는 사람 목록을 알리고, 나가면 비운다", () => {
    const onViewersChange = vi.fn();
    const { unmount } = renderEditor(onViewersChange);
    const provider = aliveProvider();

    act(() => {
      provider.awareness.states.set(1, { user: { name: "홍길동", color: "#000", memberId: 3 } });
      provider.awareness.states.set(2, { user: { name: "이영희", color: "#f80", memberId: 9 } });
      provider.awareness.emitChange();
    });
    expect(onViewersChange).toHaveBeenLastCalledWith([
      { memberId: 3, name: "홍길동", color: "#000", imageUrl: null },
      { memberId: 9, name: "이영희", color: "#f80", imageUrl: null },
    ]);

    // 목록이 그대로면 다시 알리지 않음
    const calls = onViewersChange.mock.calls.length;
    act(() => provider.awareness.emitChange());
    expect(onViewersChange.mock.calls.length).toBe(calls);

    unmount();
    expect(onViewersChange).toHaveBeenLastCalledWith([]);
  });

  it("편집할 수 있게 열리면 기존 하위 항목 목록을 한 번만 가져가 본문 맨 끝에 페이지 블록으로 붙인다", async () => {
    vi.mocked(claimPageBlockBackfill).mockResolvedValue([11, 12]);
    renderEditor(undefined, 7);
    const provider = aliveProvider();
    act(() => {
      provider.emit("status", { status: "connected" });
      provider.emit("synced", { state: true });
    });

    await vi.waitFor(() => expect(registry.inserted).toHaveLength(1));
    expect(claimPageBlockBackfill).toHaveBeenCalledTimes(1);
    expect(claimPageBlockBackfill).toHaveBeenCalledWith(42);
    expect(registry.inserted[0]).toEqual([
      { type: "page", props: { documentId: 11 } },
      { type: "page", props: { documentId: 12 } },
    ]);
  });

  it("읽기 전용(연결 끊김)으로 열리면 목록을 가져가지 않는다", () => {
    renderEditor(undefined, 7);
    const provider = aliveProvider();
    act(() => provider.emit("synced", { state: true }));

    expect(registry.rendered!.isEditable).toBe(false);
    expect(claimPageBlockBackfill).not.toHaveBeenCalled();
  });
});
