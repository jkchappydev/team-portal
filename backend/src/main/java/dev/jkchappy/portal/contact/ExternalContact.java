package dev.jkchappy.portal.contact;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 회사 밖 업체 담당자 연락처 (팀원 모두가 같은 목록을 보고 추가·수정)
@Entity
@Table(name = "external_contact")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExternalContact {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 50)
  private String name;

  @Column(length = 100)
  private String company;

  @Column(length = 255)
  private String email;

  @Column(length = 20)
  private String phone;

  // 두 번째 전화번호 (예: 사무실·휴대폰)
  @Column(length = 20)
  private String phone2;

  @Column(length = 1000)
  private String memo;

  // 연관 프로젝트 이름 (입력한 순서대로)
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "external_contact_project", joinColumns = @JoinColumn(name = "contact_id"))
  @OrderColumn(name = "position")
  @Column(name = "name", nullable = false, length = 100)
  private List<String> projects = new ArrayList<>();

  // 목록 표시 순서 (작을수록 위)
  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(name = "created_by", nullable = false, updatable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public static ExternalContact create(ContactValues values, int sortOrder, Long createdBy) {
    ExternalContact contact = new ExternalContact();
    contact.sortOrder = sortOrder;
    contact.createdBy = createdBy;
    contact.createdAt = Instant.now();
    contact.updatedAt = contact.createdAt;
    contact.apply(values);
    return contact;
  }

  public void change(ContactValues values) {
    apply(values);
    this.updatedAt = Instant.now();
  }

  public void changeSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  private void apply(ContactValues values) {
    this.name = values.name();
    this.company = values.company();
    this.email = values.email();
    this.phone = values.phone();
    this.phone2 = values.phone2();
    this.memo = values.memo();
    this.projects.clear();
    this.projects.addAll(values.projects());
  }

  // 정리를 마친 입력값
  public record ContactValues(String name, String company, String email, String phone, String phone2,
    List<String> projects, String memo) {
  }
}
