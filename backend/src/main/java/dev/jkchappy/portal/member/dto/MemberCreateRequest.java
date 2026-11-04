package dev.jkchappy.portal.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MemberCreateRequest(@NotBlank @Size(max = 50) String name) {
}
