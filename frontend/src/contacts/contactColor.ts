import type { ContactDto } from "../api/contacts";
import { PROFILE_COLORS } from "../documents/userColor";

// 연락처 카드 동그라미에 고를 수 있는 색 (내 설정 프로필 색과 같은 12색, 흰 글씨가 잘 보이는 진한 색)
export const CONTACT_COLORS = PROFILE_COLORS;

// 색을 고르지 않은 연락처는 12색 중 하나를 연락처 번호로 정해 새로고침해도 늘 같은 색
export function contactColor(contact: Pick<ContactDto, "id" | "color">): string {
  if (contact.color) return contact.color;
  // 7칸씩 건너뛰어 고름 (12와 서로소라 연속한 12명은 모두 다른 색, 이웃끼리 비슷한 색이 이어지지 않음)
  const index = (((contact.id * 7) % CONTACT_COLORS.length) + CONTACT_COLORS.length) % CONTACT_COLORS.length;
  return CONTACT_COLORS[index];
}
