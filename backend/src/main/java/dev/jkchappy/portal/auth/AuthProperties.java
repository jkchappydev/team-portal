package dev.jkchappy.portal.auth;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth")
public record AuthProperties(List<String> allowedEmailDomains, List<String> allowedHostedDomains) {}
