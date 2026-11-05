const DEFAULT_DAY_HEIGHT = 92;
const DAY_HEADER_HEIGHT = 28;
const WORK_STATUS_ITEM_HEIGHT = 20;

export function calculateWeekMinHeight(itemCounts: number[]): number {
  const maxItemCount = Math.max(0, ...itemCounts);
  return Math.max(DEFAULT_DAY_HEIGHT, DAY_HEADER_HEIGHT + maxItemCount * WORK_STATUS_ITEM_HEIGHT);
}
