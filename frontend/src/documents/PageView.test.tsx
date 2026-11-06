import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DocumentDetailDto } from "../api/documents";
import { PageView } from "./PageView";

vi.mock("./CollaborativeEditor", () => ({ default: () => <div>편집기</div> }));

const doc: DocumentDetailDto = {
  id: 7, spaceId: 1, spaceName: "개발", title: "제목 없음", icon: null, createdByName: null,
  updatedByName: null, updatedAt: "2026-11-06T00:00:00Z", home: false, parentId: null, path: [],
  kind: "PAGE", fileUrl: null,
};

function renderPage(state: unknown) {
  render(
    <MantineProvider>
      <MemoryRouter initialEntries={[{ pathname: "/documents/7", state }]}>
        <PageView doc={doc} user={{ id: 1, name: "홍길동", active: true }} menuItems={null} onRename={vi.fn()} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("PageView", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("방금 만든 페이지는 제목 칸에 포커스를 주고 제목을 선택해 둔다", async () => {
    renderPage({ focusTitle: 7 });
    const title = screen.getByLabelText("페이지 제목") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe("제목 없음".length);
  });

  it("그냥 연 페이지는 제목 칸에 포커스를 주지 않는다", async () => {
    renderPage(null);
    expect(await screen.findByText("편집기")).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText("페이지 제목"));
  });
});
