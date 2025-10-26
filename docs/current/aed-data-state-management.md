# AED 데이터 화면 상태 관리 & 페칭 구조 개편

## 개요

이번 개편으로 AED 데이터 화면의 필터 상태와 데이터 페칭 방식이 전면 재구성되었습니다. 필터 상태는 `zustand` 기반 전역 스토어에서 관리하며, 데이터 요청은 `@tanstack/react-query`를 사용해 일관된 캐시 정책과 페칭 흐름을 제공합니다. 본 문서는 새 구조의 설계 의도와 확장 시 주의사항을 정리합니다.

## 핵심 변경 사항

1. **필터 상태 중앙 관리 (`lib/state/aed-filters-store.ts`)**
   - 모든 필터는 `ParsedFilters` 형태로 스토어에 저장되며, `sanitizeFilters`를 통해 빈 값/중복 값을 제거합니다.
   - `withPaginationReset` 헬퍼를 통해 필터 변경 시 페이지/커서가 자동으로 초기화됩니다.
   - 스토어는 추후 다른 화면(예: 점검 결과 페이지)에서 재사용 가능하도록 UI와 독립된 위치에 배치했습니다.

2. **React Query 도입 (`app/providers.tsx`, `AEDDataProvider`)**
   - 앱 루트에 `QueryClientProvider`를 추가해 모든 클라이언트 컴포넌트에서 React Query를 사용할 수 있습니다.
   - `AEDDataProvider`는 `useQuery`로 `/api/aed-data`를 호출하며, `keepPreviousData` 옵션으로 페이지 전환 중 화면 깜빡임을 최소화합니다.
   - SWR 의존성을 제거하여 캐시 정책을 단일 스택(React Query)로 통일했습니다.

3. **접근 범위 및 기본 필터 로직 보존**
   - 사용자 역할/권한에 따라 필터를 강제하는 기존 로직은 React Query/스토어 기반 구조에 맞게 재구성되었습니다.
   - 기본 지역/조회 기준 적용, 접근 범위에 따른 필터 제한 등은 `AEDDataProvider` 내 `useEffect`에서 일괄 처리됩니다.

4. **안정성 개선**
   - `FilterBadges`는 `safeFilters`를 통해 null/undefined 입력에도 안전하게 동작합니다.
   - `AdminDashboardStats`는 Supabase 404/권한 오류를 감지하여 UI 중단 없이 경고만 남깁니다.
   - `/manifest.json` 등 정적 JSON은 미들웨어를 우회하도록 예외 처리가 추가되었습니다.

## 앞으로의 확장 가이드

- **점검 결과 테이블 연동**: 신규 점검 결과 테이블을 추가할 때 필터 스토어를 그대로 활용하고, React Query의 `queryKey`에 점검 결과 관련 키를 결합해 캐시를 분리하십시오.
- **서버 사이드 집계**: 대용량 데이터 집계는 `/api/aed-data`에서 수행하고, 클라이언트에서는 React Query 캐시만 유지하도록 설계하는 것이 좋습니다.
- **추가 화면 모듈화**: 필터/데이터 조합이 달라지는 화면(예: 점검 전용 뷰)은 `viewMode`와 별도의 React Query 키로 분리해 독립적인 캐시와 상태를 유지하십시오.
- **테스트/정적 분석**: `npm run lint`, `npm run type-check` 실행 시 스토어/훅 인터페이스가 깨지지 않는지 반드시 확인하고, 필요 시 테스트 케이스를 추가하십시오.

## 확인 체크리스트

- [ ] `npm install` 후 `@tanstack/react-query`, `zustand`가 의존성에 포함되었는가?
- [ ] `npm run build`로 새 구조가 정상 빌드되는가?
- [ ] `npm run type-check`에서 스토어/훅 타입이 문제 없이 통과하는가?
- [ ] 권한별 기본 필터가 예상대로 적용되는가? (마스터, 지역 관리자 등)
- [ ] 페이지네이션 & 무한 스크롤 동작 시 중복/누락 없이 accumulate 되는가?

위 내용을 따라가면 향후 점검 데이터 통합과 화면 확장 시에도 일관된 상태·데이터 흐름을 유지할 수 있습니다.
