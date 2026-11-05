type Listener = (message: string) => void;

const listeners = new Set<Listener>();

// 화면 중앙 상단 알림 표시 요청 (Toaster가 구독)
export function showToast(message: string): void {
  listeners.forEach((listener) => listener(message));
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
