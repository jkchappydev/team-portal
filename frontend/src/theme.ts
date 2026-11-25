import { createTheme, localStorageColorSchemeManager } from "@mantine/core";

// 화면 테마 선택값 저장 키 (index.html 초기 스크립트와 같은 값 사용)
export const COLOR_SCHEME_STORAGE_KEY = "portal.colorScheme";

export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY });

// 앱 테마: 라이트 모드 기본 글자색을 순검정 대신 시안의 짙은 회색(#212529)으로 (다크 모드는 기본 그대로)
export const appTheme = createTheme({ black: "#212529" });
