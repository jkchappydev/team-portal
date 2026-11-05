// 아이콘이 없는 페이지에 쓰는 기본 아이콘
export const DEFAULT_PAGE_ICON = "📄";

// 아이콘 선택 창에 보여줄 이모지 묶음
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: "자주 쓰는 아이콘",
    icons: ["📄", "📝", "📌", "📎", "📁", "📂", "📚", "📖", "📒", "📋", "🗂️", "🗒️", "📊", "📈", "📉", "🗓️"],
  },
  {
    label: "업무",
    icons: ["💼", "🏢", "🧾", "✅", "☑️", "⏰", "⏳", "🔔", "📣", "💡", "🎯", "🚀", "🛠️", "🔧", "⚙️", "🧪"],
  },
  {
    label: "개발",
    icons: ["💻", "🖥️", "⌨️", "🖱️", "🐛", "🔍", "🔒", "🔑", "🌐", "☁️", "🗄️", "📦", "🧩", "🔗", "🧭", "🤖"],
  },
  {
    label: "표정과 사람",
    icons: ["😀", "😎", "🤔", "😅", "🥳", "😴", "🙌", "👍", "👀", "🙏", "💪", "👋", "🧑‍💻", "👥", "🏃", "🏠"],
  },
  {
    label: "기호와 사물",
    icons: ["⭐", "🔥", "❤️", "✨", "🎉", "🍀", "🌱", "🌈", "☕", "🍔", "🎵", "🎨", "📷", "✈️", "🚗", "❓"],
  },
];

const ALL_ICONS = ICON_GROUPS.flatMap((group) => group.icons);

// 선택 창의 이모지 중 하나를 무작위로 고름
export function randomIcon(random: () => number = Math.random): string {
  return ALL_ICONS[Math.floor(random() * ALL_ICONS.length)];
}

// 아이콘이 없으면 기본 아이콘
export function pageIcon(icon: string | null | undefined): string {
  return icon || DEFAULT_PAGE_ICON;
}
