package dev.jkchappy.portal.document.property.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PropertyNameRequest(@NotBlank @Size(max = 50) String name) {
}
