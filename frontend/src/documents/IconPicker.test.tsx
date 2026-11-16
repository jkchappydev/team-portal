import { Button, MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAttachment } from "../api/attachments";
import { IconPicker } from "./IconPicker";

vi.mock("../api/attachments", () => ({ uploadAttachment: vi.fn() }));
// 실제 데이터 대신 작은 이모지 목록 사용
vi.mock("./emojiData", () => ({
  resolveEmojiData: async () => ({
    locale: "ko",
    categories: [{ index: 0, label: "여행" }],
    emojis: [{ emoji: "🚀", category: 0, label: "로켓", version: 1, tags: ["로켓"] }],
    skinTones: { light: "🏻", "medium-light": "🏼", medium: "🏽", "medium-dark": "🏾", dark: "🏿" },
  }),
}));

function renderPicker(hasIcon: boolean, onSelect: (icon: string | null) => void, documentId?: number) {
  render(
    <MantineProvider>
      <IconPicker
        hasIcon={hasIcon}
        onSelect={onSelect}
        documentId={documentId}
        target={(toggle) => <Button onClick={toggle}>아이콘 추가</Button>}
      />
    </MantineProvider>,
  );
}

function paste(target: Element, data: { files?: File[]; text?: string }) {
  fireEvent.paste(target, { clipboardData: { files: data.files ?? [], getData: () => data.text ?? "" } });
}

describe("IconPicker", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    URL.createObjectURL ??= () => "blob:preview";
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
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it("이모지 탭은 본문 이모지 선택 창과 같은 검색 창과 목록을 보여준다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    expect(await screen.findByPlaceholderText("검색")).toBeTruthy();
    expect(document.querySelector(".icon-emoji-picker")).toBeTruthy();
  });

  it("아이콘이 있을 때만 제거 버튼이 보이고 누르면 null을 넘긴다", async () => {
    const onSelect = vi.fn();
    renderPicker(true, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByText("제거"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("아이콘이 없으면 제거 버튼이 없고 랜덤은 이모지 하나를 고른다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByText("랜덤"));
    expect(screen.queryByText("제거")).toBeNull();
    expect(onSelect).toHaveBeenCalledWith(expect.any(String));
  });

  it("페이지가 없으면 업로드 탭을 보여주지 않는다", async () => {
    renderPicker(false, vi.fn());
    fireEvent.click(screen.getByText("아이콘 추가"));
    await screen.findByText("이모지");
    expect(screen.queryByRole("tab", { name: "업로드", hidden: true })).toBeNull();
  });

  it("고른 이미지를 페이지에 올리고 att:{id} 아이콘으로 저장한다", async () => {
    vi.mocked(uploadAttachment).mockResolvedValue({ id: 42, originalName: "logo.png", contentType: "image/png", size: 10, uploadedByName: null, createdAt: "", url: "" });
    const onSelect = vi.fn();
    renderPicker(false, onSelect, 7);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByRole("tab", { name: "업로드", hidden: true }));
    const save = await screen.findByRole("button", { name: "저장", hidden: true });
    expect(save.hasAttribute("disabled")).toBe(true);
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("아이콘 이미지 파일"), { target: { files: [file] } });
    fireEvent.click(save);
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith(7, file, true));
    expect(onSelect).toHaveBeenCalledWith("att:42");
  });

  it("Ctrl+V로 붙여넣은 https 이미지 주소는 그대로 저장하고 다른 글자는 거부한다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect, 7);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByRole("tab", { name: "업로드", hidden: true }));
    const area = await screen.findByLabelText("아이콘 이미지 업로드");
    paste(area, { text: "javascript:alert(1)" });
    expect(await screen.findByText("https로 시작하는 이미지 주소만 붙여넣을 수 있습니다.")).toBeTruthy();
    paste(area, { text: " https://example.com/logo.png " });
    fireEvent.click(screen.getByRole("button", { name: "저장", hidden: true }));
    expect(onSelect).toHaveBeenCalledWith("https://example.com/logo.png");
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it("SVG나 5MB를 넘는 이미지는 올리지 않는다", async () => {
    renderPicker(false, vi.fn(), 7);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByRole("tab", { name: "업로드", hidden: true }));
    const input = await screen.findByLabelText("아이콘 이미지 파일");
    fireEvent.change(input, { target: { files: [new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })] } });
    expect(await screen.findByText("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.")).toBeTruthy();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("5MB 이하 이미지만 올릴 수 있습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "저장", hidden: true }).hasAttribute("disabled")).toBe(true);
  });

  it("탐색기에서 끌어다 놓은 이미지 파일을 올리고, 웹페이지에서 끌어 온 https 이미지 주소는 그대로 쓴다", async () => {
    vi.mocked(uploadAttachment).mockResolvedValue({ id: 43, originalName: "drop.png", contentType: "image/png", size: 10, uploadedByName: null, createdAt: "", url: "" });
    const onSelect = vi.fn();
    renderPicker(false, onSelect, 7);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByRole("tab", { name: "업로드", hidden: true }));
    const area = await screen.findByLabelText("아이콘 이미지 업로드");
    const file = new File(["x"], "drop.png", { type: "image/png" });
    const transfer = (data: { files?: File[]; uriList?: string }) => ({
      types: data.files ? ["Files"] : ["text/uri-list"],
      files: data.files ?? [],
      getData: (type: string) => (type === "text/uri-list" ? data.uriList ?? "" : ""),
      dropEffect: "none",
    });
    // 끌고 올라오면 놓을 자리 안내
    fireEvent.dragOver(area, { dataTransfer: transfer({ files: [file] }) });
    expect(await screen.findByText("여기에 놓으세요")).toBeTruthy();
    fireEvent.drop(area, { dataTransfer: transfer({ files: [file] }) });
    fireEvent.click(await screen.findByRole("button", { name: "저장", hidden: true }));
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith(7, file, true));
    expect(onSelect).toHaveBeenCalledWith("att:43");
  });

  it("끌어 온 주소는 https 이미지 주소만 받고, 이미지가 아닌 파일은 거부한다", async () => {
    const onSelect = vi.fn();
    renderPicker(false, onSelect, 7);
    fireEvent.click(screen.getByText("아이콘 추가"));
    fireEvent.click(await screen.findByRole("tab", { name: "업로드", hidden: true }));
    const area = await screen.findByLabelText("아이콘 이미지 업로드");
    fireEvent.drop(area, { dataTransfer: { types: ["Files"], files: [new File(["x"], "a.txt", { type: "text/plain" })], getData: () => "" } });
    expect(await screen.findByText("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.")).toBeTruthy();
    fireEvent.drop(area, { dataTransfer: { types: ["text/uri-list"], files: [], getData: (t: string) => (t === "text/uri-list" ? "# 주석\nhttps://example.com/logo.png" : "") } });
    fireEvent.click(await screen.findByRole("button", { name: "저장", hidden: true }));
    expect(onSelect).toHaveBeenCalledWith("https://example.com/logo.png");
  });
});
