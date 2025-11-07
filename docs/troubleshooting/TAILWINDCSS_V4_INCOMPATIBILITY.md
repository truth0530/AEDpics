# TailwindCSS v4 Incompatibility Analysis (2025-11-08)

## 문제 발견
TailwindCSS v4로 업그레이드 시도 시 빌드 실패 발생

## 에러 메시지
```
Syntax error: tailwindcss: /app/globals.css Cannot apply unknown utility class `border-border`
```

## 근본 원인

### 1. CSS 변수 처리 방식 변경
TailwindCSS v4는 CSS 변수 기반 유틸리티 클래스 생성 방식이 완전히 변경되었습니다.

**v3 방식 (현재 프로젝트)**:
```css
/* globals.css */
:root {
  --border: 217 33% 20%;
}

@layer base {
  * {
    @apply border-border;  /* v3에서는 작동 */
  }
}
```

**v4 문제점**:
- `border-border` 같은 CSS 변수 기반 유틸리티 클래스를 자동으로 생성하지 않음
- 더 엄격한 유틸리티 클래스 검증
- CSS 변수와 유틸리티 클래스 매핑 방식 변경

### 2. PostCSS 플러그인 구조 변경
```javascript
// v3 (작동)
plugins: {
  tailwindcss: {},
  autoprefixer: {},
}

// v4 (별도 패키지 필요)
plugins: {
  '@tailwindcss/postcss': {},  // 별도 설치 필요
  autoprefixer: {},
}
```

## 영향 범위
- `app/globals.css`: 39번, 81번 라인의 `@apply border-border`
- 프로젝트 전체의 CSS 변수 기반 유틸리티 클래스
- shadcn/ui 컴포넌트들의 테마 시스템

## 업그레이드 시 필요한 작업

### 1. CSS 리팩토링
```css
/* v4 호환 방식으로 변경 필요 */
@layer base {
  * {
    /* @apply 대신 직접 CSS 변수 사용 */
    border-color: hsl(var(--border));
  }
}
```

### 2. 커스텀 유틸리티 재정의
tailwind.config.ts에서 명시적으로 유틸리티 클래스 정의 필요

### 3. shadcn/ui 테마 시스템 재구성
모든 컴포넌트의 CSS 변수 사용 방식 재검토 필요

## 권장 사항

### 단기 (현재 선택)
**TailwindCSS v3.4.x 유지**
- 안정성 보장
- 기존 코드 변경 불필요
- shadcn/ui 완벽 호환

### 장기 (향후 고려)
v4 업그레이드를 원한다면:
1. 별도 브랜치에서 전체 CSS 리팩토링
2. shadcn/ui v4 호환 버전 대기
3. 충분한 테스트 기간 확보

## 버전 정보
- **시도한 버전**: tailwindcss@4.1.17 + @tailwindcss/postcss@4.1.17
- **안정 버전**: tailwindcss@3.4.18 (현재 사용)

## 관련 파일
- [FIRST_SUCCESSFUL_DEPLOYMENT_SOLUTION.md](./FIRST_SUCCESSFUL_DEPLOYMENT_SOLUTION.md) - 초기 v3 다운그레이드 문서
- [TAILWINDCSS_V4_UPGRADE_SUCCESS.md](./TAILWINDCSS_V4_UPGRADE_SUCCESS.md) - v4 업그레이드 시도 (실패)

## 결론
TailwindCSS v4는 대규모 CSS 리팩토링이 필요하므로, 현재 프로덕션 환경에서는 안정적인 v3를 유지하는 것이 최선입니다.

---
**문서 작성일**: 2025-11-08
**작성자**: System Administrator
**상태**: v3 유지 결정