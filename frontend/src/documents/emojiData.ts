import type { EmojiData, EmojiDataResolver } from "frimousse";

// 본문 이모지 선택 창(BlockNote)과 같은 방식으로 이모지 목록 준비
// BlockNote에 들어 있는 이모지 데이터를 쓰고, 이 기기에서 그려지지 않는 새 버전 이모지와 국기는 숨김
const EMOJI_FONT = "'Apple Color Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', 'Android Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', EmojiSymbols, sans-serif";

// 글자색을 바꿔 그려도 픽셀이 같으면 컬러 이모지로 그려진 것
function canRender(context: CanvasRenderingContext2D | null, emoji: string | undefined): boolean {
  if (!context || !emoji) return false;
  context.canvas.width = 2;
  context.canvas.height = 2;
  context.font = `2px ${EMOJI_FONT}`;
  context.textBaseline = "middle";
  if (context.measureText(emoji).width >= 4) return false;
  context.fillStyle = "#00f";
  context.fillText(emoji, 0, 0);
  const blue = context.getImageData(0, 0, 2, 2).data;
  context.clearRect(0, 0, 2, 2);
  context.fillStyle = "#f00";
  context.fillText(emoji, 0, 0);
  const red = context.getImageData(0, 0, 2, 2).data;
  for (let i = 0; i < 16; i += 4) {
    if (blue[i] !== red[i] || blue[i + 1] !== red[i + 1] || blue[i + 2] !== red[i + 2]) return false;
  }
  return true;
}

function supportedRange(data: EmojiData) {
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  } catch {
    // 캔버스를 못 쓰면 전체 목록 사용
  }
  const sampleByVersion = new Map<number, string>();
  for (const emoji of data.emojis) if (!sampleByVersion.has(emoji.version)) sampleByVersion.set(emoji.version, emoji.emoji);
  const versions = [...sampleByVersion.keys()].sort((a, b) => b - a);
  const countryFlags = canRender(context, "🇪🇺");
  for (const version of versions) {
    if (canRender(context, sampleByVersion.get(version))) return { emojiVersion: version, countryFlags };
  }
  return { emojiVersion: versions[0] ?? 0, countryFlags };
}

export const resolveEmojiData: EmojiDataResolver = async (locale, options) => {
  const { loadFrimousseData } = await import("@blocknote/core/emoji-data");
  options?.signal?.throwIfAborted();
  const data = (await loadFrimousseData(locale)) as EmojiData;
  options?.signal?.throwIfAborted();
  const range = supportedRange(data);
  const maxVersion = options?.emojiVersion ?? range.emojiVersion;
  return { ...data, emojis: data.emojis.filter((e) => e.version <= maxVersion && (!e.countryFlag || range.countryFlags)) };
};
