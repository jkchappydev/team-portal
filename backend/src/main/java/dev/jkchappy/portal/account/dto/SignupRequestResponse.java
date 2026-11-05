package dev.jkchappy.portal.account.dto;

import dev.jkchappy.portal.account.AccountStatus;
import java.time.Instant;

public record SignupRequestResponse(Long id, String email, String googleName, AccountStatus status, Instant requestedAt) {}
