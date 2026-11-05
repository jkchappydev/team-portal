import { localStorageColorSchemeManager } from "@mantine/core";

// 화면 테마 선택값 저장 키 (index.html 초기 스크립트와 같은 값 사용)
export const COLOR_SCHEME_STORAGE_KEY = "portal.colorScheme";

export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY });
