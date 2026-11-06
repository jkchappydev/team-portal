package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Size;

// icon: 이모지, 업로드 이미지(att:{첨부 ID}), https 이미지 주소 중 하나 (null이거나 비어 있으면 아이콘 제거)
public record DocumentIconRequest(@Size(max = 512) String icon) {
}
