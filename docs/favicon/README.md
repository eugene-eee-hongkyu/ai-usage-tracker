# ai-usage-tracker favicon 적용 가이드

## 파일 목록
- `favicon.ico` — 멀티 사이즈 (16/32/48). 브라우저 탭 표시용
- `favicon.svg` — 마스터 SVG. 모던 브라우저용 (스케일링 무손실)
- `favicon-16.svg` — 16x16 전용 (stroke 강화)
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `favicon-64x64.png` — PNG 백업
- `apple-touch-icon.png` (180x180) — iOS 홈 화면
- `apple-touch-icon.svg` — 마스터 SVG (iOS용)
- `android-chrome-192x192.png`, `android-chrome-512x512.png` — Android PWA

## Next.js 14 App Router 적용

### 방법 1: app 디렉토리에 직접 배치 (추천)
다음 파일들을 `web/app/` 디렉토리에 그대로 복사:
- `favicon.ico` → `web/app/favicon.ico`
- `apple-touch-icon.png` → `web/app/apple-icon.png` (이름 주의)
- `android-chrome-192x192.png` → `web/app/icon.png` (Next.js 자동 인식)

Next.js가 자동으로 `<link>` 태그 생성. 별도 설정 불필요.

### 방법 2: public/ 디렉토리 + metadata
1. 모든 파일을 `web/public/` 디렉토리에 복사
2. `web/app/layout.tsx`의 metadata에 추가:

```typescript
export const metadata: Metadata = {
  title: 'Primus Usage Tracker',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}
```

### manifest.json (PWA용, 선택)
`web/public/manifest.json` 생성:
```json
{
  "name": "Primus Usage Tracker",
  "short_name": "Usage",
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#10b981",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

## 색상 정보
- **메인 색**: `#10b981` (Tailwind emerald-500)
- 의미: 효율 / 좋음 / 진행 — 본인 도구의 가이드 컨셉

## 검증
1. 빌드 후 브라우저 탭에 16x16 아이콘 표시 확인
2. iOS Safari로 접속 후 "홈 화면에 추가" → 180x180 아이콘 확인
3. Chrome DevTools > Application > Manifest에서 PWA 아이콘 확인
