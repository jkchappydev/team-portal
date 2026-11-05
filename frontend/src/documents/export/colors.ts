// 내보내기(PDF)용 노션 라이트 팔레트 (편집기 화면의 index.css 값과 같음)
const TEXT_COLORS: Record<string, string> = {
  gray: "#787774",
  brown: "#9f6b53",
  orange: "#d9730d",
  yellow: "#cb912f",
  green: "#448361",
  blue: "#337ea9",
  purple: "#9065b0",
  pink: "#c14c8a",
  red: "#d44c47",
};

const BACKGROUND_COLORS: Record<string, string> = {
  gray: "#f1f1ef",
  brown: "#f4eeee",
  orange: "#fbecdd",
  yellow: "#fbf3db",
  green: "#edf3ec",
  blue: "#e7f3f8",
  purple: "#f6f3f9",
  pink: "#fbf2f5",
  red: "#fdebec",
};

// 색 이름을 실제 색으로 ("default"나 모르는 이름은 색 없음)
export function textColorOf(name: unknown): string | undefined {
  return typeof name === "string" ? TEXT_COLORS[name] : undefined;
}

export function backgroundColorOf(name: unknown): string | undefined {
  return typeof name === "string" ? BACKGROUND_COLORS[name] : undefined;
}
