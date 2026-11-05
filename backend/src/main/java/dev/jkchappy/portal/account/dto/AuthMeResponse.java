package dev.jkchappy.portal.account.dto;

import dev.jkchappy.portal.account.AccountStatus;

public record AuthMeResponse(String email, AccountStatus status, Long memberId, String memberName, boolean admin) {}
