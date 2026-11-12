// 메뉴 아이콘 (글자색을 따라가는 얇은 선, 모양은 menuIcons.ts)
export function MenuIcon({ d, strokeWidth = 1.3 }: { d: string; strokeWidth?: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
