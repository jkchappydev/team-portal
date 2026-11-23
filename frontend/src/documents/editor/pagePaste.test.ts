import { afterEach, describe, expect, it, vi } from "vitest";
import { adoptPastedPages, clearPageCut, pageIdsIn, recordPageCut, takePageCut } from "./pagePaste";

const page = (id: string, documentId: number, children: unknown[] = []) => ({ id, type: "page", props: { documentId }, children });
const paragraph = (id: string, children: unknown[] = []) => ({ id, type: "paragraph", props: {}, children });

function actions() {
  return {
    movePage: vi.fn(() => Promise.resolve()),
    copyPage: vi.fn((pageId: number) => Promise.resolve(pageId + 100)),
    pointBlockTo: vi.fn(),
    onError: vi.fn(),
  };
}

describe("페이지 블록 붙여넣기", () => {
  afterEach(() => {
    clearPageCut();
    localStorage.clear();
  });

  it("하위 블록까지 페이지 블록이 가리키는 문서를 모은다", () => {
    expect(pageIdsIn([paragraph("a", [page("b", 31)]), page("c", 40)] as never)).toEqual([31, 40]);
  });

  it("복사해 붙여넣은 페이지는 붙여넣은 페이지 아래에 사본을 만들고 블록이 사본을 가리킨다", async () => {
    const act = actions();
    await adoptPastedPages([page("b1", 31)] as never, 2, act);
    expect(act.copyPage).toHaveBeenCalledWith(31, 2);
    expect(act.pointBlockTo).toHaveBeenCalledWith("b1", 131);
    expect(act.movePage).not.toHaveBeenCalled();
  });

  it("잘라내 다른 페이지에 붙여넣은 페이지는 그 페이지 아래로 옮기고, 다시 붙여넣으면 그때는 사본", async () => {
    recordPageCut(7, [31]);
    const act = actions();
    await adoptPastedPages([page("b1", 31)] as never, 2, act);
    expect(act.movePage).toHaveBeenCalledWith(31, 2);
    expect(act.copyPage).not.toHaveBeenCalled();

    await adoptPastedPages([page("b2", 31)] as never, 2, act);
    expect(act.copyPage).toHaveBeenCalledWith(31, 2);
  });

  it("같은 페이지 안에서 잘라 붙여넣은 것은 위치만 바뀐 것이라 옮기지도 복사하지도 않는다", async () => {
    recordPageCut(2, [31]);
    const act = actions();
    await adoptPastedPages([page("b1", 31)] as never, 2, act);
    expect(act.movePage).not.toHaveBeenCalled();
    expect(act.copyPage).not.toHaveBeenCalled();
  });

  it("잘라낸 뒤 복사하면 잘라내기 기록이 지워져 사본을 만든다", () => {
    recordPageCut(7, [31]);
    clearPageCut();
    expect(takePageCut(31)).toBeNull();
  });

  it("부모와 하위 블록이 변경 목록에 따로 들어와도 페이지는 한 번만 처리한다", async () => {
    const child = page("b2", 40);
    const act = actions();
    await adoptPastedPages([paragraph("a", [child]), child] as never, 2, act);
    expect(act.copyPage).toHaveBeenCalledTimes(1);
  });

  it("처리하지 못하면 오류를 안내하고 나머지 페이지는 계속 처리한다", async () => {
    const act = actions();
    act.copyPage.mockRejectedValueOnce(new Error("페이지만 복제할 수 있습니다."));
    await adoptPastedPages([page("b1", 31), page("b2", 40)] as never, 2, act);
    expect(act.onError).toHaveBeenCalledWith("페이지만 복제할 수 있습니다.");
    expect(act.pointBlockTo).toHaveBeenCalledWith("b2", 140);
  });
});
