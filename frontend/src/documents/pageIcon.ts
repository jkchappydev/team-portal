// 아이콘이 없는 페이지에 쓰는 기본 아이콘
export const DEFAULT_PAGE_ICON = "📄";

// 랜덤 아이콘 후보 (페이지에 어울리는 이모지 묶음)
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

// 후보 이모지 중 하나를 무작위로 고름
export function randomIcon(random: () => number = Math.random): string {
  return ALL_ICONS[Math.floor(random() * ALL_ICONS.length)];
}

// 업로드 이미지(att:{첨부 ID})나 https 이미지 주소면 이미지 주소, 이모지면 null
export function iconImageSrc(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const uploaded = /^att:(\d+)$/.exec(icon);
  if (uploaded) return `/api/attachments/${uploaded[1]}/download`;
  return icon.startsWith("https://") ? icon : null;
}

// 아이콘이 없는 프로젝트(사이드바 최상위)에 쓰는 기본 아이콘
export const DEFAULT_PROJECT_ICON = "📁";

// 아이콘이 없으면 기본 아이콘 (프로젝트는 폴더, 그 외는 페이지)
export function pageIcon(icon: string | null | undefined, project = false): string {
  return icon || (project ? DEFAULT_PROJECT_ICON : DEFAULT_PAGE_ICON);
}
