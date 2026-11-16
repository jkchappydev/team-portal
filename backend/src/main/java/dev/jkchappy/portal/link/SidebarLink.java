package dev.jkchappy.portal.link;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 사이드바에 걸어 두는 외부 주소
@Entity
@Table(name = "sidebar_link")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SidebarLink {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String title;

  @Column(nullable = false, length = 2000)
  private String url;

  // 이모지 아이콘 (없으면 화면에서 기본 🔗)
  @Column(length = 32)
  private String icon;

  // 계정 정보 (선택, 링크를 누르면 뜨는 팝업에 표시)
  @Column(name = "account_info", columnDefinition = "TEXT")
  private String accountInfo;

  // 사이드바 표시 순서 (작을수록 위)
  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static SidebarLink create(String title, String url, String icon, String accountInfo, int sortOrder,
    Long createdBy) {
    SidebarLink link = new SidebarLink();
    link.title = title;
    link.url = url;
    link.icon = icon;
    link.accountInfo = accountInfo;
    link.sortOrder = sortOrder;
    link.createdBy = createdBy;
    link.createdAt = Instant.now();
    link.updatedAt = link.createdAt;
    return link;
  }

  public void change(String title, String url, String icon, String accountInfo) {
    this.title = title;
    this.url = url;
    this.icon = icon;
    this.accountInfo = accountInfo;
    this.updatedAt = Instant.now();
  }

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }
}
