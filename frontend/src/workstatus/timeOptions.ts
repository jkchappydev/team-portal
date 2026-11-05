export interface TimeOption {
  value: string;
  label: string;
}

// 신규 등록 시 기본 근무 시간
export const DEFAULT_START_TIME = "09:00";
export const DEFAULT_END_TIME = "18:00";

const MINUTE_STEP = 10;

// "HH:mm" → "오전 09:00" / "오후 06:00"
export function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 10분 단위 시간 목록. 기존 값이 10분 단위가 아니면 목록에 포함해 수정 시 값이 사라지지 않게 함
export function buildTimeOptions(extraValue?: string): TimeOption[] {
  const values: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += MINUTE_STEP) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    values.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  if (extraValue && !values.includes(extraValue)) {
    values.push(extraValue);
    values.sort();
  }
  return values.map((value) => ({ value, label: formatTimeLabel(value) }));
}
