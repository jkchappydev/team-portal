package dev.jkchappy.portal.link;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.link.dto.LinkRequest;
import dev.jkchappy.portal.link.dto.LinkResponse;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SidebarLinkService {

  private final SidebarLinkRepository linkRepository;

  @Transactional(readOnly = true)
  public List<LinkResponse> findAll() {
    return linkRepository.findAllByOrderBySortOrderAscIdAsc().stream().map(LinkResponse::from).toList();
  }

  // 새 링크는 목록 맨 아래
  @Transactional
  public LinkResponse create(LinkRequest request, Long userId) {
    URI uri = normalize(request.url());
    String title = request.title().trim();
    String icon = normalizeIcon(request.icon());
    int sortOrder = linkRepository.findAllByOrderBySortOrderAscIdAsc().stream()
      .mapToInt(SidebarLink::getSortOrder).max().orElse(-1) + 1;
    return LinkResponse.from(linkRepository.save(SidebarLink.create(title, uri.toString(), icon, sortOrder, userId)));
  }

  // 아이콘은 선택값, 짧은 이모지 글자만 허용 (주소·업로드 이미지 형식은 거부)
  static String normalizeIcon(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String icon = raw.trim();
    if (icon.length() > 32 || icon.contains(":") || icon.contains("/")) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이모지만 아이콘으로 쓸 수 있습니다.");
    }
    return icon;
  }

  // 제목·주소·아이콘을 한 번에 수정 (주소·아이콘 검사는 추가할 때와 같음)
  @Transactional
  public LinkResponse update(Long id, LinkRequest request) {
    SidebarLink link = getLink(id);
    URI uri = normalize(request.url());
    link.change(request.title().trim(), uri.toString(), normalizeIcon(request.icon()));
    return LinkResponse.from(link);
  }

  // 끌어 옮긴 링크를 index 위치에 끼워 넣고 0부터 다시 번호를 매김
  @Transactional
  public void move(Long id, int index) {
    SidebarLink target = getLink(id);
    List<SidebarLink> links = new ArrayList<>(linkRepository.findAllByOrderBySortOrderAscIdAsc()
      .stream().filter(l -> !l.getId().equals(id)).toList());
    links.add(Math.clamp(index, 0, links.size()), target);
    for (int i = 0; i < links.size(); i++) {
      links.get(i).changeSortOrder(i);
    }
  }

  @Transactional
  public void delete(Long id) {
    linkRepository.delete(getLink(id));
  }

  // http·https 주소만 허용 (앞에 http가 빠져 있으면 https로)
  static URI normalize(String raw) {
    String value = raw.trim();
    if (!value.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) {
      value = "https://" + value;
    }
    URI uri;
    try {
      uri = new URI(value);
    } catch (URISyntaxException e) {
      throw new BusinessException(ErrorCode.INVALID_INPUT);
    }
    String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
    boolean web = scheme.equals("http") || scheme.equals("https");
    if (!web || uri.getHost() == null || uri.getHost().isBlank()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT);
    }
    return uri;
  }

  private SidebarLink getLink(Long id) {
    return linkRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
