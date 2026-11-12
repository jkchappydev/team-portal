import { createStyleSpecFromTipTapMark, defaultStyleSpecs } from "@blocknote/core";

// 코드 서식이 함께 쓸 수 없는 서식 (자기 자신만, 노션처럼 굵게·기울임·밑줄·취소선·색·링크는 함께 사용)
export const CODE_EXCLUDES = "code";

// BlockNote 기본 코드 서식은 다른 모든 서식을 배제해 코드 글자에 굵게·색 등을 줄 수 없음
// 배제 대상을 자기 자신만으로 줄인 코드 서식
const baseCodeMark = defaultStyleSpecs.code.implementation.mark!;

export const codeStyleSpec = createStyleSpecFromTipTapMark(
  baseCodeMark.extend({
    excludes: () => CODE_EXCLUDES,
  }),
  "boolean",
);
