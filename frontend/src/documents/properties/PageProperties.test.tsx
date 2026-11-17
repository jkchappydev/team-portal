import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropertyDto } from "../../api/properties";
import { PageProperties } from "./PageProperties";
import { dropIndex } from "./propertyTypes";

let store: PropertyDto[] = [];
let nextId = 10;

vi.mock("../../api/properties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/properties")>()),
  listProperties: vi.fn(async () => store.map((p) => ({ ...p }))),
  createProperty: vi.fn(async (_doc: number, name: string, type: PropertyDto["type"]) => {
    const created = { id: nextId++, name, type, value: null };
    store = [...store, created];
    return created;
  }),
  renameProperty: vi.fn(async (_doc: number, id: number, name: string) => ({ ...store.find((p) => p.id === id)!, name })),
  changePropertyValue: vi.fn(async (_doc: number, id: number, value: string | null) => ({ ...store.find((p) => p.id === id)!, value })),
  moveProperty: vi.fn(async (_doc: number, id: number, index: number) => {
    const moving = store.find((p) => p.id === id)!;
    store = store.filter((p) => p.id !== id);
    store.splice(index, 0, moving);
    return store.map((p) => ({ ...p }));
  }),
  deleteProperty: vi.fn(async () => undefined),
}));
vi.mock("../../api/members", () => ({
  listMembers: vi.fn(async () => [
    { id: 1, name: "홍길동", active: true },
    { id: 2, name: "김영희", active: true },
    { id: 3, name: "퇴사자", active: false },
  ]),
}));

const api = await import("../../api/properties");

function renderProperties() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider>
        <PageProperties documentId={5} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe("dropIndex", () => {
  it("끌던 줄을 뺀 목록 기준 위치로 바꾼다", () => {
    expect(dropIndex(2, 0, false)).toBe(0);
    expect(dropIndex(0, 2, true)).toBe(2);
    expect(dropIndex(0, 1, false)).toBe(0);
  });
});

describe("PageProperties", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    store = [{ id: 1, name: "담당자", type: "PERSON", value: null }];
    nextId = 10;
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(cleanup);

  it("기본 담당자 속성을 비어 있음으로 보여 주고, 아래 토글로 접고 펼친다", async () => {
    renderProperties();
    expect(await screen.findByText("담당자")).toBeTruthy();
    expect(screen.getByPlaceholderText("비어 있음")).toBeTruthy();

    fireEvent.click(screen.getByText("속성 1개 숨기기"));
    expect(screen.queryByText("담당자")).toBeNull();
    expect(screen.queryByText("+ 속성 추가")).toBeNull();
    // 접은 상태는 이 페이지에 기억
    expect(localStorage.getItem("page-properties-collapsed-5")).toBe("true");

    fireEvent.click(screen.getByText("속성 1개 보기"));
    expect(screen.getByText("담당자")).toBeTruthy();
  });

  it("+ 속성 추가에서 종류를 고르면 맨 아래에 만들고 바로 이름을 바꿀 수 있다", async () => {
    renderProperties();
    fireEvent.click(await screen.findByText("+ 속성 추가"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "날짜" }));

    await waitFor(() => expect(api.createProperty).toHaveBeenCalledWith(5, "날짜", "DATE"));
    const nameInput = await screen.findByLabelText("속성 이름");
    fireEvent.change(nameInput, { target: { value: "마감일" } });
    fireEvent.blur(nameInput);

    await waitFor(() => expect(api.renameProperty).toHaveBeenCalledWith(5, 10, "마감일"));
    expect(await screen.findByText("마감일")).toBeTruthy();
  });

  it("텍스트 값은 포커스를 벗어날 때 저장하고, 비우면 null로 보낸다", async () => {
    store = [{ id: 1, name: "상태", type: "TEXT", value: "진행" }];
    renderProperties();
    const input = await screen.findByLabelText("상태");

    fireEvent.change(input, { target: { value: "완료" } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.changePropertyValue).toHaveBeenCalledWith(5, 1, "완료"));

    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.changePropertyValue).toHaveBeenLastCalledWith(5, 1, null));
  });

  it("담당자에서 팀원을 고르면 id를 쉼표로 저장하고, 퇴사자는 고를 수 없다", async () => {
    renderProperties();
    // MultiSelect는 입력란과 감싼 상자 둘 다 이름이 붙어 있어 입력란을 고름
    const picker = (await screen.findAllByLabelText("담당자")).find((el) => el.tagName === "INPUT")!;
    fireEvent.click(picker);
    expect(screen.queryByText("퇴사자")).toBeNull();
    fireEvent.click(await screen.findByText("김영희"));

    await waitFor(() => expect(api.changePropertyValue).toHaveBeenCalledWith(5, 1, "2"));
  });

  it("손잡이로 끌어 다른 줄 위쪽에 놓으면 그 앞으로 옮긴다", async () => {
    store = [
      { id: 1, name: "담당자", type: "PERSON", value: null },
      { id: 2, name: "마감", type: "DATE", value: null },
      { id: 3, name: "상태", type: "TEXT", value: null },
    ];
    renderProperties();
    await screen.findByText("상태");
    const rows = document.querySelectorAll<HTMLElement>(".page-property-row");
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    rows[0].getBoundingClientRect = () => ({ top: 0, height: 30, bottom: 30, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.dragStart(screen.getByLabelText("상태 순서 바꾸기"), { dataTransfer });
    fireEvent.dragOver(rows[0], { clientY: 5, dataTransfer });
    expect(rows[0].getAttribute("data-drop")).toBe("before");
    fireEvent.drop(rows[0], { dataTransfer });

    await waitFor(() => expect(api.moveProperty).toHaveBeenCalledWith(5, 3, 0));
    await waitFor(() => expect([...document.querySelectorAll(".page-property-row")].map((r) => r.textContent?.includes("상태"))[0]).toBe(true));
  });

  it("속성 메뉴에서 삭제하면 목록에서 뺀다", async () => {
    store = [{ id: 1, name: "담당자", type: "PERSON", value: null }, { id: 2, name: "상태", type: "TEXT", value: null }];
    renderProperties();
    fireEvent.click(await screen.findByLabelText("상태 속성 메뉴"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "속성 삭제" }));

    await waitFor(() => expect(api.deleteProperty).toHaveBeenCalledWith(5, 2));
    await waitFor(() => expect(screen.queryByLabelText("상태 속성 메뉴")).toBeNull());
  });
});
