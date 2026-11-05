import { useEffect, useState } from "react";
import { Paper, Portal, Text, Transition } from "@mantine/core";
import { subscribeToast } from "./toastStore";

const VISIBLE_MS = 1800;

// 화면 중앙 상단에 연한 회색 상자로 잠깐 나타났다 사라지는 알림
export function Toaster() {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeToast((message) => {
    setToast({ message, key: Date.now() });
    setVisible(true);
  }), []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [visible, toast]);

  return (
    <Portal>
      <Transition mounted={visible} transition="slide-down" duration={200} timingFunction="ease">
        {(styles) => (
          <Paper
            role="status"
            px="md"
            py={8}
            radius="md"
            style={{
              ...styles,
              position: "fixed",
              top: 16,
              left: "50%",
              translate: "-50% 0",
              zIndex: 1000,
              background: "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))",
              border: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Text size="sm">{toast?.message}</Text>
          </Paper>
        )}
      </Transition>
    </Portal>
  );
}
