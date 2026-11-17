import { createStyleSpec } from "@blocknote/core";

// 편집기 색 메뉴의 색 이름 (화면 색은 index.css의 --bn-colors-highlights-* 노션 색표)
export const COLOR_NAMES = ["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
type ColorKind = "text" | "background";

// 이름별 대표 색: 노션 라이트·다크(앱 화면 색) + BlockNote 기본 라이트·다크(다른 편집기로 복사된 BlockNote 글)
// "default"는 기본 글자색·배경(검정·흰색 등)으로, 가장 가까우면 색을 넣지 않음
const PALETTE: Record<ColorKind, Record<string, string[]>> = {
  text: {
    default: ["#37352f", "#3f3f3f", "#000000", "#ffffff", "#cfcfcf", "#d4d4d4", "#191919"],
    gray: ["#787774", "#9b9b9b", "#9b9a97", "#bebdb8"],
    brown: ["#9f6b53", "#ba856f", "#64473a", "#8e6552"],
    red: ["#d44c47", "#df5452", "#e03e3e", "#ec4040"],
    orange: ["#d9730d", "#c77d48", "#e3790d"],
    yellow: ["#cb912f", "#ca9849", "#dfab01"],
    green: ["#448361", "#529e72", "#4d6461", "#6b8b87"],
    blue: ["#337ea9", "#5e87c9", "#0b6e99", "#0e87bc"],
    purple: ["#9065b0", "#9d68d3", "#6940a5", "#8552d7"],
    pink: ["#c14c8a", "#d15796", "#ad1a72", "#da208f"],
  },
  background: {
    default: ["#ffffff", "#191919", "#1f1f1f"],
    gray: ["#f1f1ef", "#2f2f2f", "#ebeced", "#9b9a97"],
    brown: ["#f4eeee", "#4a3228", "#e9e5e3", "#64473a"],
    red: ["#fdebec", "#522e2a", "#fbe4e4", "#be3434"],
    orange: ["#fbecdd", "#5c3b23", "#f6e9d9", "#b7600a"],
    yellow: ["#fbf3db", "#564328", "#b58b00"],
    green: ["#edf3ec", "#243d30", "#ddedea", "#4d6461"],
    blue: ["#e7f3f8", "#143a4e", "#ddebf1", "#0b6e99"],
    purple: ["#f6f3f9", "#3c2d49", "#eae4f2", "#6940a5"],
    pink: ["#fbf2f5", "#4e2c3c", "#f4dfeb", "#ad1a72"],
  },
};

type Rgba = [number, number, number, number];

// CSS 색 문자열(#hex, rgb(), rgba(), 색 이름)을 RGBA 값으로
export function parseCssColor(css: string): Rgba | undefined {
  const value = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(value);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
  }
  // 색 이름(red 등)은 브라우저가 rgb()로 바꿔 주는 값을 다시 읽음
  if (/^[a-z]+$/.test(value) && typeof document !== "undefined") {
    const probe = document.createElement("span");
    probe.style.color = value;
    if (probe.style.color && probe.style.color !== value) return parseCssColor(probe.style.color);
  }
  return undefined;
}

// 외부 색을 가장 가까운 색 이름으로, 기본 글자색·배경에 가깝거나 투명하면 undefined (색 없음)
export function nearestColorName(css: string, kind: ColorKind): string | undefined {
  const rgba = parseCssColor(css);
  if (!rgba || rgba[3] === 0) return undefined;
  let best = "default";
  let bestDistance = Infinity;
  for (const [name, colors] of Object.entries(PALETTE[kind])) {
    for (const color of colors) {
      const [r, g, b] = parseCssColor(color)!;
      const distance = (rgba[0] - r) ** 2 + (rgba[1] - g) ** 2 + (rgba[2] - b) ** 2;
      if (distance < bestDistance) {
        best = name;
        bestDistance = distance;
      }
    }
  }
  return best === "default" ? undefined : best;
}

const isColorName = (value: string) => (COLOR_NAMES as readonly string[]).includes(value);

// 글자색에만 있는 이름 (붙여넣은 검정 글자는 기본색으로 두므로 붙여넣기 판단 색표에는 넣지 않음)
export const TEXT_ONLY_COLORS: Record<string, string> = { black: "#000000" };

// 색 종류별 메뉴 색 이름인지 (화면 CSS가 칠하는 이름)
const isNamedColor = (value: string, kind: ColorKind) =>
  isColorName(value) || (kind === "text" && value in TEXT_ONLY_COLORS);

// 노션 내보내기 형광펜: class="highlight-red"(글자색), "highlight-red_background"(배경색)
function notionHighlight(element: HTMLElement, kind: ColorKind): string | undefined {
  for (const cls of Array.from(element.classList)) {
    const match = /^highlight-([a-z]+?)(_background)?$/.exec(cls);
    if (match && isColorName(match[1]) && (match[2] !== undefined) === (kind === "background")) return match[1];
  }
  return undefined;
}

// 인라인 색을 읽는 요소 (문단 등 블록 요소의 색은 블록 색으로 따로 처리됨)
const INLINE_TAGS = ["SPAN", "FONT", "MARK", "CODE", "B", "STRONG", "I", "EM", "U", "S"];

// 붙여넣은 글자의 글자색: 편집기 자체 표시(data-style-type)는 기본 규칙이 처리하므로 제외
export function parseTextColor(element: HTMLElement): string | undefined {
  if (element.hasAttribute("data-style-type") || !INLINE_TAGS.includes(element.tagName)) return undefined;
  const highlight = notionHighlight(element, "text");
  if (highlight) return highlight;
  const css = element.style.color || (element.tagName === "FONT" ? element.getAttribute("color") ?? "" : "");
  return css ? nearestColorName(css, "text") : undefined;
}

// 붙여넣은 글자의 배경색 (<mark>는 색 지정이 없으면 노란 형광펜)
export function parseBackgroundColor(element: HTMLElement): string | undefined {
  if (element.hasAttribute("data-style-type") || !INLINE_TAGS.includes(element.tagName)) return undefined;
  const highlight = notionHighlight(element, "background");
  if (highlight) return highlight;
  const css = element.style.backgroundColor;
  if (css) return nearestColorName(css, "background");
  if (element.tagName === "MARK" && !notionHighlight(element, "text")) return "yellow";
  return undefined;
}

// 화면 표시: 색 이름은 CSS(data-value)가 칠하고, 예전에 원본 값(rgb 등)으로 저장된 색은 그 값을 직접 칠함
function colorSpan(value: string, property: "color" | "backgroundColor") {
  const dom = document.createElement("span");
  const kind: ColorKind = property === "color" ? "text" : "background";
  if (value && value !== "default" && !isNamedColor(value, kind)) dom.style[property] = value;
  return { dom, contentDOM: dom };
}

// 다른 프로그램으로 복사·내보내기: 색 이름은 화면과 같은 노션 라이트 색, 원본 값은 그대로
function exportSpan(value: string, kind: ColorKind) {
  const dom = document.createElement("span");
  const named = kind === "text" ? TEXT_ONLY_COLORS[value] : undefined;
  const css = named ?? (isColorName(value) ? PALETTE[kind][value][0] : value !== "default" ? value : "");
  if (css) dom.style[kind === "text" ? "color" : "backgroundColor"] = css;
  return { dom, contentDOM: dom };
}

// BlockNote 기본 글자색·배경색 서식은 외부 색을 원본 값(rgb 등)으로 저장해 화면 CSS가 칠하지 못함 (붙여넣은 색이 안 보임)
// 붙여넣을 때 노션 색 이름으로 바꾸고, 이미 원본 값으로 저장된 색도 보이게 한 서식
export const textColorSpec = createStyleSpec(
  { type: "textColor", propSchema: "string" },
  {
    render: (value) => colorSpan(value, "color"),
    toExternalHTML: (value) => exportSpan(value, "text"),
    parse: parseTextColor,
  },
);

export const backgroundColorSpec = createStyleSpec(
  { type: "backgroundColor", propSchema: "string" },
  {
    render: (value) => colorSpan(value, "backgroundColor"),
    toExternalHTML: (value) => exportSpan(value, "background"),
    parse: parseBackgroundColor,
  },
);
