import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";

const OPEN_EVENT = "image-lightbox:open";

interface LightboxImage {
  url: string;
  name: string;
}

// 이미지 펼쳐보기 창 열기 (편집기 도구 막대는 선택이 바뀌면 사라지므로 창은 앱 레이아웃의 ImageLightbox가 띄움)
export function openImageLightbox(image: LightboxImage): void {
  window.dispatchEvent(new CustomEvent<LightboxImage>(OPEN_EVENT, { detail: image }));
}

// 노션 "펼치기"처럼 이미지를 화면 가운데에 크게 (바깥 클릭·Esc·닫기 버튼으로 닫음)
export function ImageLightbox() {
  const [image, setImage] = useState<LightboxImage | null>(null);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const open = (event: Event) => {
      setImage((event as CustomEvent<LightboxImage>).detail);
      setOpened(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  return (
    <Modal opened={opened} onClose={() => setOpened(false)} size="auto" centered padding={0} radius="md"
      withCloseButton={false} overlayProps={{ backgroundOpacity: 0.7 }} aria-label="이미지 펼쳐보기"
      styles={{ content: { background: "transparent", boxShadow: "none" } }}>
      {/* 화면 안에 다 들어오게 원래 비율로 줄여 보임, 이미지를 눌러도 닫힘 */}
      {image && (
        <img src={image.url} alt={image.name} onClick={() => setOpened(false)} draggable={false}
          style={{ display: "block", maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", cursor: "zoom-out", borderRadius: 6 }} />
      )}
    </Modal>
  );
}
