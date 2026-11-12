import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SpaceNavItem } from "./SpaceNavItem";
import { SpaceList } from "./SpaceList";
import { subscribeToast } from "../toast/toastStore";
import { deleteSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
import { createDocument, deleteDocument, moveDocument, uploadFileNode } from "../api/documents";

vi.mock("../api/spaces", () => ({ deleteSpace: vi.fn(() => Promise.resolve()) }));

vi.mock("../api/documents", () => ({
  listDocuments: vi.fn(() => Promise.resolve([
    { id: 11, spaceId: 1, spaceName: "스쿨북스", title: "배포 절차", icon: "🚀", updatedByName: null, updatedAt: "2026-11-04T00:00:00Z", parentId: null },
    { id: 13, spaceId: 1, spaceName: "스쿨북스", title: "API 명세", icon: null, updatedByName: null, updatedAt: "2026-11-04T00:00:00Z", parentId: 11 },
    { id: 14, spaceId: 1, spaceName: "스쿨북스", title: "회의록", icon: "📝", updatedByName: null, updatedAt: "2026-11-04T00:00:00Z", parentId: null },
    { id: 15, spaceId: 1, spaceName: "스쿨북스", title: "품의서 양식.xlsx", icon: "📊", updatedByName: null, updatedAt: "2026-11-04T00:00:00Z", parentId: null, kind: "FILE", fileUrl: "/api/attachments/30/download" },
  ])),
  uploadFileNode: vi.fn(() => Promise.resolve({})),
  moveDocument: vi.fn(() => Promise.resolve({})),
  deleteDocument: vi.fn(() => Promise.resolve()),
  createDocument: vi.fn(() => Promise.resolve(
    { id: 12, spaceId: 1, spaceName: "스쿨북스", title: "제목 없음", updatedByName: null, updatedAt: "2026-11-04T00:00:00Z" },
  )),
}));

const space: SpaceDto = { id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, icon: "🏫" };

function renderItem(target: SpaceDto = space) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<SpaceNavItem space={target} />} />
            <Route path="/documents/:id" element={<div>새 페이지 화면</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe("SpaceNavItem", () => {
  beforeAll(() => {
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
    // jsdom에는 없는 크기 감시 기능 (내보내기 창의 형식 선택이 사용)
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it("▸를 누르면 하위 페이지가 트리로 펼쳐진다", async () => {
    renderItem();
    expect(screen.queryByText("배포 절차")).toBeNull();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    expect(await screen.findByText("배포 절차")).toBeTruthy();
  });

  it("마우스를 올리면 나오는 + 로 페이지를 만들고 바로 연다", async () => {
    renderItem();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    fireEvent.click(screen.getByLabelText("스쿨북스에 페이지 추가"));
    await waitFor(() => expect(screen.getByText("새 페이지 화면")).toBeTruthy());
    expect(createDocument).toHaveBeenCalledWith(1, null);
  });

  it("하위 페이지 안의 하위 페이지도 펼쳐지고, 페이지에서 + 로 하위 페이지를 만든다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    expect(await screen.findByText("API 명세")).toBeTruthy();
    fireEvent.mouseEnter(screen.getByText("배포 절차"));
    fireEvent.click(screen.getByLabelText("배포 절차에 하위 페이지 추가"));
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith(1, 11));
  });

  it("페이지 줄은 평소 아이콘을 보이고, 마우스를 올리면 그 자리에 펼치기 화살표가 나온다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    expect(await screen.findByText("🚀")).toBeTruthy();
    const chevron = screen.getByLabelText("배포 절차 펼치기");
    expect(chevron.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseEnter(screen.getByText("배포 절차"));
    expect(chevron.hasAttribute("data-visible")).toBe(true);
    expect(screen.getByText("🚀").closest(".tree-slot-icon")!.hasAttribute("data-hidden")).toBe(true);
  });

  it("아이콘이 없는 페이지는 기본 아이콘을 보인다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    expect(screen.getByText("📄")).toBeTruthy();
  });

  it("제목은 한 줄로 말줄임하고, 잘린 제목만 마우스를 올리면 전체 제목을 띄운다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    const title = await screen.findByText("배포 절차");
    expect(title.closest("[data-no-wrap]")).not.toBeNull();

    // 칸보다 넓지 않은 제목은 툴팁 없음
    fireEvent.mouseEnter(title);
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseLeave(title);

    // 칸을 넘어 잘린 제목은 전체 제목 툴팁
    const body = title.closest(".mantine-NavLink-body")!;
    Object.defineProperty(body, "scrollWidth", { configurable: true, value: 300 });
    Object.defineProperty(body, "clientWidth", { configurable: true, value: 150 });
    fireEvent.mouseEnter(title);
    fireEvent.mouseMove(title);
    expect((await screen.findByRole("tooltip")).textContent).toBe("배포 절차");
  });

  it("⋯ 메뉴에서 확인 후 페이지를 삭제한다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("배포 절차");
    fireEvent.mouseEnter(screen.getByText("배포 절차"));
    fireEvent.click(screen.getByLabelText("배포 절차 메뉴"));
    fireEvent.click(await screen.findByText("페이지 삭제"));
    // 바로 지우지 않고 페이지 화면과 같은 확인 창을 띄움
    expect(await screen.findByText(/"배포 절차" 페이지를 삭제할까요/)).toBeTruthy();
    expect(deleteDocument).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith(11));
  });

  it("최상위 페이지 줄도 본문 아이콘을 보이고, 마우스를 올리면 화살표로 바뀐다", () => {
    renderItem();
    const icon = screen.getByText("🏫").closest(".tree-slot-icon")!;
    expect(icon.hasAttribute("data-hidden")).toBe(false);
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    expect(icon.hasAttribute("data-hidden")).toBe(true);
    expect(screen.getByLabelText("스쿨북스 펼치기").hasAttribute("data-visible")).toBe(true);
  });

  it("아이콘이 없는 최상위 페이지는 기본 아이콘을 보이고, 마우스를 올리면 화살표로 바뀐다", () => {
    renderItem({ ...space, icon: null });
    const icon = screen.getByText("📄").closest(".tree-slot-icon")!;
    expect(icon.hasAttribute("data-hidden")).toBe(false);
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    expect(icon.hasAttribute("data-hidden")).toBe(true);
  });

  it("최상위 페이지 줄의 ⋯ 메뉴에서 확인 후 삭제한다", async () => {
    renderItem();
    fireEvent.mouseEnter(screen.getByText("스쿨북스"));
    fireEvent.click(screen.getByLabelText("스쿨북스 메뉴"));
    fireEvent.click(await screen.findByText("페이지 삭제"));
    expect(await screen.findByText(/"스쿨북스" 페이지를 삭제할까요/)).toBeTruthy();
    expect(deleteSpace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteSpace).toHaveBeenCalledWith(1));
  });

  it("줄을 선택한 채 Delete 키를 누르면 확인 창이 뜨고, 삭제 버튼에 포커스가 있어 Enter로 지운다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    const pageRow = (await screen.findByText("배포 절차")).closest("a")!;
    pageRow.focus();
    fireEvent.keyDown(pageRow, { key: "Delete" });
    expect(await screen.findByText(/"배포 절차" 페이지를 삭제할까요/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "삭제" });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
    expect(deleteDocument).not.toHaveBeenCalledWith(11);
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith(11));
  });

  it("최상위 페이지 줄도 Delete 키로 삭제 확인 창을 연다", async () => {
    renderItem();
    fireEvent.keyDown(screen.getByText("스쿨북스").closest("a")!, { key: "Delete" });
    expect(await screen.findByText(/"스쿨북스" 페이지를 삭제할까요/)).toBeTruthy();
  });

  // 끌기·놓기 이벤트용 가짜 dataTransfer
  const dataTransfer = () => ({ setData: vi.fn(), clearData: vi.fn(), effectAllowed: "", dropEffect: "" });
  // 사이드바 줄(링크) 요소
  const row = (title: string) => screen.getByText(title).closest("a")!;

  it("페이지를 다른 페이지 위에 끌어다 놓으면 그 페이지 아래로 옮긴다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("회의록");
    fireEvent.dragStart(row("회의록"), { dataTransfer: dataTransfer() });
    fireEvent.dragOver(row("배포 절차"), { dataTransfer: dataTransfer() });
    expect(row("배포 절차").hasAttribute("data-drop-target")).toBe(true);
    fireEvent.drop(row("배포 절차"), { dataTransfer: dataTransfer() });
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(14, 11, undefined));
  });

  it("하위 페이지를 최상위 페이지 줄에 놓으면 최상위로 옮긴다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    fireEvent.dragStart(row("API 명세"), { dataTransfer: dataTransfer() });
    fireEvent.dragOver(row("스쿨북스"), { dataTransfer: dataTransfer() });
    fireEvent.drop(row("스쿨북스"), { dataTransfer: dataTransfer() });
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(13, null, undefined));
  });

  it("자기 하위 페이지 안으로는 놓을 수 없다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    fireEvent.dragStart(row("배포 절차"), { dataTransfer: dataTransfer() });
    fireEvent.dragOver(row("API 명세"), { dataTransfer: dataTransfer() });
    expect(row("API 명세").hasAttribute("data-drop-target")).toBe(false);
    fireEvent.drop(row("API 명세"), { dataTransfer: dataTransfer() });
    fireEvent.dragEnd(row("배포 절차"));
    expect(moveDocument).not.toHaveBeenCalled();
  });

  // jsdom의 끌기 이벤트는 clientY를 받지 않아 직접 넣어서 발생
  const dragAt = (type: "dragOver" | "drop", el: Element, clientY: number) => {
    const event = createEvent[type](el, { dataTransfer: dataTransfer() });
    Object.defineProperty(event, "clientY", { value: clientY });
    fireEvent(el, event);
  };

  // 줄 높이 30px에서 위·아래 가장자리를 짚도록 위치를 고정
  const withRect = (el: Element) => {
    el.getBoundingClientRect = () => ({ top: 0, height: 30, bottom: 30, left: 0, right: 200, width: 200 }) as DOMRect;
    return el;
  };

  it("줄 위쪽 가장자리에 놓으면 가로선을 보이고 그 줄 앞으로 옮긴다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("회의록");
    fireEvent.dragStart(row("회의록"), { dataTransfer: dataTransfer() });
    const target = withRect(row("배포 절차"));
    dragAt("dragOver", target, 2);
    expect(target.getAttribute("data-drop-position")).toBe("before");
    expect(target.hasAttribute("data-drop-target")).toBe(false);
    dragAt("drop", target, 2);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(14, null, 0));
  });

  it("하위 페이지를 상위 단계 줄 아래쪽 가장자리에 놓으면 그 줄 뒤로 꺼낸다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    fireEvent.dragStart(row("API 명세"), { dataTransfer: dataTransfer() });
    const target = withRect(row("회의록"));
    dragAt("dragOver", target, 28);
    expect(target.getAttribute("data-drop-position")).toBe("after");
    dragAt("drop", target, 28);
    // 최상위 [배포 절차, 회의록] 중 회의록 뒤 = 2번째 위치
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(13, null, 2));
  });

  it("펼친 줄의 아래쪽 가장자리에 놓으면 그 페이지의 첫 하위로 넣는다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    fireEvent.dragStart(row("회의록"), { dataTransfer: dataTransfer() });
    const target = withRect(row("배포 절차"));
    dragAt("dragOver", target, 28);
    dragAt("drop", target, 28);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(14, 11, 0));
  });

  it("파일 항목은 누르면 미리보기 화면으로 가고 펼치기·하위 추가가 없다", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    const link = row(await screen.findByText("품의서 양식.xlsx").then((el) => el.textContent!));
    expect(link.getAttribute("href")).toBe("/files/15");
    expect(link.hasAttribute("download")).toBe(false);
    fireEvent.mouseEnter(link);
    expect(screen.queryByLabelText("품의서 양식.xlsx 펼치기")).toBeNull();
    expect(screen.queryByLabelText("품의서 양식.xlsx에 하위 페이지 추가")).toBeNull();
  });

  // 컴퓨터에서 끌어온 파일용 dataTransfer
  const fileTransfer = (...names: string[]) => ({
    types: ["Files"],
    files: names.map((name) => new File(["x"], name)),
    dropEffect: "",
  });

  it("컴퓨터에서 파일을 페이지 줄 가운데에 놓으면 그 페이지 안에 차례로 올린다", async () => {
    vi.mocked(uploadFileNode).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("배포 절차");
    const target = row("배포 절차");
    fireEvent.dragOver(target, { dataTransfer: fileTransfer("a.xlsx") });
    expect(target.hasAttribute("data-drop-target")).toBe(true);
    fireEvent.drop(target, { dataTransfer: fileTransfer("a.xlsx", "b.docx") });
    await waitFor(() => expect(uploadFileNode).toHaveBeenCalledTimes(2));
    expect(vi.mocked(uploadFileNode).mock.calls.map((c) => [c[1].name, c[2], c[3]]))
      .toEqual([["a.xlsx", 11, undefined], ["b.docx", 11, undefined]]);
  });

  it("컴퓨터에서 파일을 줄 위쪽 가장자리에 놓으면 그 줄 앞에 순서대로 끼워 올린다", async () => {
    vi.mocked(uploadFileNode).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("회의록");
    const target = withRect(row("회의록"));
    const event = createEvent.drop(target, { dataTransfer: fileTransfer("a.xlsx", "b.docx") });
    Object.defineProperty(event, "clientY", { value: 2 });
    fireEvent(target, event);
    // 최상위 [배포 절차, 회의록, 품의서 양식] 중 회의록 앞 = 1번째, 다음 파일은 그 뒤
    await waitFor(() => expect(uploadFileNode).toHaveBeenCalledTimes(2));
    expect(vi.mocked(uploadFileNode).mock.calls.map((c) => [c[1].name, c[2], c[3]]))
      .toEqual([["a.xlsx", null, 1], ["b.docx", null, 2]]);
  });

  it("컴퓨터에서 파일을 최상위 페이지 줄에 놓으면 그 안의 맨 아래에 올린다", async () => {
    vi.mocked(uploadFileNode).mockClear();
    renderItem();
    fireEvent.drop(row("스쿨북스"), { dataTransfer: fileTransfer("a.pdf") });
    await waitFor(() => expect(uploadFileNode).toHaveBeenCalledWith(1, expect.any(File), null, undefined));
  });

  it("끌기를 시작하면 브라우저가 실은 링크 주소를 지운다 (분할 화면 안내 방지)", async () => {
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("회의록");
    const transfer = dataTransfer();
    fireEvent.dragStart(row("회의록"), { dataTransfer: transfer });
    expect(transfer.clearData).toHaveBeenCalled();
    fireEvent.dragEnd(row("회의록"));
  });

  // 최상위 목록: 줄마다 높이 30px로 위에서부터 쌓인 위치 (0~30, 30~60, ...)
  const renderSpaceList = (onMove: (id: number, index: number) => void) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SpaceList
              spaces={[{ ...space, id: 1, name: "양식" }, { ...space, id: 2, name: "더북리스트" }, { ...space, id: 3, name: "회계" }]}
              onMove={onMove}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    document.querySelectorAll("[data-space-row]").forEach((el, i) => {
      el.getBoundingClientRect = () => ({ top: i * 30, height: 30, bottom: i * 30 + 30, left: 0, right: 200, width: 200 }) as DOMRect;
    });
  };

  it("최상위 페이지 줄을 다른 줄 아래쪽 절반에 놓으면 그 뒤로 순서를 바꾼다", () => {
    const onMove = vi.fn();
    renderSpaceList(onMove);
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", row("더북리스트"), 50);
    expect(row("회계").getAttribute("data-drop-position")).toBe("before");
    dragAt("drop", row("더북리스트"), 50);
    // 양식을 뺀 [더북리스트, 회계] 중 더북리스트 뒤 = 1번째
    expect(onMove).toHaveBeenCalledWith(1, 1);
    fireEvent.dragEnd(row("양식"));
  });

  it("최상위 목록 아래 빈 곳에 놓으면 맨 뒤로, 첫 줄 위쪽에 놓으면 맨 앞으로 옮긴다", () => {
    const onMove = vi.fn();
    renderSpaceList(onMove);
    fireEvent.dragStart(row("양식"), { dataTransfer: dataTransfer() });
    dragAt("dragOver", screen.getByTestId("space-list"), 300);
    expect(row("회계").getAttribute("data-drop-position")).toBe("after");
    dragAt("drop", screen.getByTestId("space-list"), 300);
    expect(onMove).toHaveBeenCalledWith(1, 2);
    fireEvent.dragEnd(row("양식"));

    fireEvent.dragStart(row("회계"), { dataTransfer: dataTransfer() });
    dragAt("drop", row("양식"), 3);
    expect(onMove).toHaveBeenCalledWith(3, 0);
    fireEvent.dragEnd(row("회계"));
  });

  it("펼친 최상위 페이지 줄의 아래쪽 절반에 놓으면 그 안의 맨 위로 넣는다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("회의록");
    fireEvent.dragStart(row("회의록"), { dataTransfer: dataTransfer() });
    const target = withRect(row("스쿨북스"));
    dragAt("dragOver", target, 25);
    expect(target.getAttribute("data-drop-position")).toBe("after");
    dragAt("drop", target, 25);
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(14, null, 0));
  });

  it("펼친 페이지 목록 맨 끝 띠에 놓으면 최상위 맨 아래로 옮긴다", async () => {
    vi.mocked(moveDocument).mockClear();
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    fireEvent.click(await screen.findByLabelText("배포 절차 펼치기"));
    await screen.findByText("API 명세");
    fireEvent.dragStart(row("API 명세"), { dataTransfer: dataTransfer() });
    const zone = screen.getByTestId("tree-end-drop");
    fireEvent.dragOver(zone, { dataTransfer: dataTransfer() });
    expect(zone.getAttribute("data-drop-position")).toBe("before");
    fireEvent.drop(zone, { dataTransfer: dataTransfer() });
    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith(13, null, undefined));
  });

  it("페이지 ⋯ 메뉴의 내보내기는 새 창 없이 내보내기 형식을 고르는 창을 연다", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("배포 절차");
    fireEvent.mouseEnter(screen.getByText("배포 절차"));
    fireEvent.click(screen.getByLabelText("배포 절차 메뉴"));
    fireEvent.click(await screen.findByText("내보내기"));
    expect(await screen.findByText("내보내기 형식")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("페이지 ⋯ 메뉴의 링크 복사는 내보내기 위에 있고 페이지 주소를 클립보드에 복사한다", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const toasts: string[] = [];
    const unsubscribe = subscribeToast((message) => toasts.push(message));
    renderItem();
    fireEvent.click(screen.getByLabelText("스쿨북스 펼치기"));
    await screen.findByText("배포 절차");
    fireEvent.mouseEnter(screen.getByText("배포 절차"));
    fireEvent.click(screen.getByLabelText("배포 절차 메뉴"));
    const items = (await screen.findAllByRole("menuitem")).map((el) => el.textContent);
    expect(items.indexOf("링크 복사")).toBe(items.indexOf("내보내기") - 1);
    fireEvent.click(screen.getByText("링크 복사"));
    await waitFor(() => expect(toasts).toEqual(["링크를 복사했습니다"]));
    unsubscribe();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/documents/11`);
  });
});
