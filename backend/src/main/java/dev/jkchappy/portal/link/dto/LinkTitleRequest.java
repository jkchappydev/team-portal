package dev.jkchappy.portal.link.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LinkTitleRequest(@NotBlank @Size(max = 100) String title) {
}
