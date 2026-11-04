package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DocumentTitleRequest(@NotBlank @Size(max = 200) String title) {
}
