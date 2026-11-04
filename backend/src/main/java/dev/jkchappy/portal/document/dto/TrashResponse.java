package dev.jkchappy.portal.document.dto;

import java.util.List;

public record TrashResponse(List<TrashItem> spaces, List<TrashItem> documents) {
}
