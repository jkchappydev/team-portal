import { useState } from "react";

// 창이 닫히는 애니메이션 동안에도 마지막 내용을 그대로 보이도록 null이 아닌 마지막 값을 유지
// (닫을 때 값을 먼저 null로 바꾸면 사라지는 동안 제목·문구가 빈 값으로 잠깐 바뀌어 보임)
export function useLastValue<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) setLast(value);
  return value ?? last;
}
