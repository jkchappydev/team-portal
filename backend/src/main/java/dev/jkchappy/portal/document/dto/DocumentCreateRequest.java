package dev.jkchappy.portal.document.dto;

import jakarta.validation.constraints.Size;

public record DocumentCreateRequest(@Size(max = 200) String title) {
}
