package dev.jkchappy.portal.favorite.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// index: 즐겨찾기 목록 안에서 들어갈 위치 (0이 맨 위)
public record FavoriteOrderRequest(@NotNull @Min(0) Integer index) {
}
