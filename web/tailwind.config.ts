import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      // 한국어 친화 스케일 — Naver/Daum 본문 17px, iOS HIG 17pt, Material CJK +1 규칙
      // 등 한국 표준 (16~17px) 에 맞춰 Tailwind 기본 사이즈를 +1px 씩 상향.
      // 한국어 14px 는 영문 ~13px 체감이라 그대로 두면 답답함. 차트 axis 등 의도된
      // 컴팩트 텍스트는 inline `text-[10px]` 식 fixed 사용 중이라 영향 없음.
      // line-height 도 한국어 가독성 위해 1.55~1.6 (기본 1.4 → 약간 여유).
      fontSize: {
        xs: ["13px", { lineHeight: "1.55" }],   // was 12px
        sm: ["15px", { lineHeight: "1.55" }],   // was 14px
        base: ["17px", { lineHeight: "1.6" }],  // was 16px (한국 표준)
        lg: ["19px", { lineHeight: "1.55" }],   // was 18px
        // xl, 2xl, 3xl, 4xl 은 heading 용 — Tailwind 기본 유지
      },
    },
  },
  plugins: [],
};
export default config;
