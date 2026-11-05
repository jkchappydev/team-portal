import { Menu } from "@mantine/core";
import { showToast } from "../toast/toastStore";
import { copyText } from "./clipboard";

// ⋯ 메뉴의 링크 복사 항목: 복사 결과는 화면 중앙 상단 알림으로 표시
export function CopyLinkMenuItem({ path }: { path: string }) {
  const copy = () => {
    copyText(`${window.location.origin}${path}`)
      .then(() => showToast("링크를 복사했습니다"))
      .catch(() => showToast("링크를 복사하지 못했습니다"));
  };

  return <Menu.Item onClick={copy}>링크 복사</Menu.Item>;
}
