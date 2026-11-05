import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import type { Block } from "@blocknote/core";
import { ko } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useComputedColorScheme } from "@mantine/core";
import { TABLE_OPTIONS } from "../collabSession";

// 수정 이력 한 시점의 본문을 편집기와 같은 모양의 읽기 전용으로 표시 (상위에서 버전마다 key로 다시 마운트)
export default function VersionPreview({ blocks }: { blocks: Block[] }) {
  const colorScheme = useComputedColorScheme("light");
  const editor = useCreateBlockNote({
    dictionary: ko,
    tables: TABLE_OPTIONS,
    initialContent: blocks.length > 0 ? (blocks as never) : undefined,
  });
  return <BlockNoteView editor={editor} theme={colorScheme} editable={false} sideMenu={false} />;
}
