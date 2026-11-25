import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { ApiError } from "../../api/client";
import { createDocument } from "../../api/documents";
import { PageLineIcon } from "../DefaultIcons";
import { placePageBlock } from "./pageCommand";
import type { PageBlockNode, PageEditor } from "./pageCommand";

interface Options {
  editor: PageEditor & { getTextCursorPosition: () => { block: PageBlockNode } };
  // 새 페이지가 들어갈 프로젝트와 상위 문서 (프로젝트 본문이면 프로젝트 최상위에 만들어짐)
  spaceId: number;
  documentId: number;
  // 페이지 블록을 넣은 뒤 (사이드바·목록 조회 갱신, 만든 페이지로 이동)
  onCreated: (documentId: number) => void;
  onError: (message: string) => void;
}

// 슬래시 메뉴 "/페이지": 지금 문서 아래에 새 페이지를 만들고 슬래시를 친 자리에 그 페이지 블록을 넣은 뒤 알림 (노션처럼 바로 이동은 호출한 쪽)
export function pageSlashItem({ editor, spaceId, documentId, onCreated, onError }: Options): DefaultReactSuggestionItem {
  return {
    title: "페이지",
    subtext: "이 안에 새 페이지 만들기",
    aliases: ["페이지", "page", "문서", "하위"],
    group: "기타",
    icon: <PageLineIcon size={18} />,
    onItemClick: () => {
      const block = editor.getTextCursorPosition().block;
      createDocument(spaceId, documentId)
        .then((created) => {
          placePageBlock(editor, block, created.id);
          onCreated(created.id);
        })
        .catch((error: unknown) => onError(error instanceof ApiError && error.message ? error.message : "페이지를 만들지 못했습니다."));
    },
  };
}
