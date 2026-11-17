import { Button, MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { uploadAttachment } from "../api/attachments";
import { CoverPicker } from "./CoverPicker";

vi.mock("../api/attachments", () => ({ uploadAttachment: vi.fn() }));

function renderPicker(hasCover: boolean, onSelect: (cover: string | null) => void) {
  render(
    <MantineProvider>
      <CoverPicker hasCover={hasCover} documentId={7} onSelect={onSelect}
        target={(toggle) => <Button onClick={toggle}>커버 추가</Button>} />
    </MantineProvider>,
  );
}

describe("CoverPicker", () => {
  beforeAll(() => {
    URL.createObjectURL ??= () => "blob:preview";
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("고른 이미지를 프로젝트 본문에 올리고 att:{id} 커버로 저장한다", async () => {
    vi.mocked(uploadAttachment).mockResolvedValue({ id: 9, originalName: "cover.png", contentType: "image/png", size: 10, uploadedByName: null, createdAt: "", url: "" });
    const onSelect = vi.fn();
    renderPicker(false, onSelect);
    fireEvent.click(screen.getByText("커버 추가"));
    const file = new File(["x"], "cover.png", { type: "image/png" });
    fireEvent.change(await screen.findByLabelText("아이콘 이미지 파일"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "저장", hidden: true }));
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith(7, file, true));
    expect(onSelect).toHaveBeenCalledWith("att:9");
  });

  it("커버가 있을 때만 제거 버튼이 보이고 누르면 커버를 지운다", async () => {
    const onSelect = vi.fn();
    renderPicker(true, onSelect);
    fireEvent.click(screen.getByText("커버 추가"));
    fireEvent.click(await screen.findByRole("button", { name: "제거", hidden: true }));
    expect(onSelect).toHaveBeenCalledWith(null);

    cleanup();
    renderPicker(false, vi.fn());
    fireEvent.click(screen.getByText("커버 추가"));
    await screen.findByRole("button", { name: "저장", hidden: true });
    expect(screen.queryByRole("button", { name: "제거", hidden: true })).toBeNull();
  });
});
