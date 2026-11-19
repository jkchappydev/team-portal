package dev.jkchappy.portal.document.dto;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// 삭제된 프로젝트와 페이지(그리고 공유 보관함 파일)를 최근 삭제순으로 함께 담은 목록
public record TrashResponse(List<TrashItem> items) {

  // 다른 종류의 휴지통 항목을 합쳐 다시 최근 삭제순으로 정렬
  public TrashResponse with(List<TrashItem> others) {
    List<TrashItem> merged = new ArrayList<>(items);
    merged.addAll(others);
    merged.sort(Comparator.comparing(TrashItem::deletedAt).reversed());
    return new TrashResponse(merged);
  }
}
