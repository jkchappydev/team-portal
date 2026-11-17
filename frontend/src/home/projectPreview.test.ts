import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_COVER, projectPreview } from "./projectPreview";

describe("projectPreview", () => {
  it("이모지 아이콘은 이모지, 업로드·주소 아이콘은 그림으로", () => {
    expect(projectPreview({ icon: "🏫" })).toEqual({ kind: "emoji", emoji: "🏫" });
    expect(projectPreview({ icon: "att:3" })).toEqual({ kind: "image", src: "/api/attachments/3/download" });
    expect(projectPreview({ icon: "https://x.com/i.png" })).toEqual({ kind: "image", src: "https://x.com/i.png" });
  });

  it("아이콘이 없으면 폴더 그림", () => {
    expect(DEFAULT_PROJECT_COVER).toBe("/folder.png");
    expect(projectPreview({ icon: null })).toEqual({ kind: "folder", src: "/folder.png" });
    expect(projectPreview({ icon: "" })).toEqual({ kind: "folder", src: "/folder.png" });
  });
});
