# Phase 4 Export 엔드포인트 회고 (2025-10-26 ~ 2025-11-06)

**작성일**: 2025-11-06
**진행 기간**: 12일
**참여자**: Tech Lead, QA Team, DevOps
**최종 상태**: 배포 완료 및 모니터링 구축

---

## 1. Phase 4 주요 성과

### A. 코드 구현
- **13-step 파이프라인** 완성 (Step 1: 인증 ~ Step 13: 응답)
- **3-layer 권한 검증** 구현 (flag → role → limit)
- **입력 검증 강화** (배열 요소 타입 체크, limit 범위)
- **필터 파싱 호환성** (POST body + Query string)
- **City code 매핑** (실패 감지 + null 반환)
- **데이터 마스킹** (역할별 민감정보 보호)

### B. 문서화
4개 완벽한 운영 문서 작성:
1. [QA_TEST_EXECUTION.md](QA_TEST_EXECUTION.md) - 8개 시나리오 상세
2. [PHASE4_QA_EXECUTION_PLAN.md](PHASE4_QA_EXECUTION_PLAN.md) - 실행 계획
3. [PHASE4_MONITORING_SETUP.md](PHASE4_MONITORING_SETUP.md) - 모니터링 가이드
4. [PHASE4_DEPLOYMENT_CHECKLIST.md](PHASE4_DEPLOYMENT_CHECKLIST.md) - 배포 체크리스트

### C. QA 검증
- **입력 검증**: 7/7 통과 (보안, 필터 호환성)
- **권한 검증**: 6/6 통과 (모든 역할별 권한)
- **데이터 검증**: 완료 (마스킹, 제한값)
- **모니터링**: 구축 완료 (로그 필터, 자동화)

### D. 배포
- **GitHub Actions**: 자동 배포 성공 (7분 18초)
- **PM2 상태**: 2 instances online, 메모리 정상
- **Smoke Test**: 모두 통과
- **무중단 배포**: PM2 reload 성공

---

## 2. 주요 버그 수정 이력

### 버그 1: POST Body JSON 파싱 미지원
- **문제**: `request.nextUrl.searchParams`만 사용, body 무시
- **해결**: try/catch + SyntaxError fallback (lines 108-194)
- **결과**: POST body + Query string 모두 지원

### 버그 2: mapCityCodeToGugun 실패 감지 불가
- **문제**: 매핑 실패 시 원본값 반환 → 경고 불가
- **해결**: null 반환으로 변경 (lib/constants/regions.ts)
- **결과**: 실패 감지 및 로그 기록 가능

### 버그 3: Query 파라미터 호환성 부족
- **문제**: cityCodes만 읽음, city (레거시) 무시
- **해결**: Set 기반 중복 제거로 양쪽 지원 (lines 64-88)
- **결과**: 하위 호환성 확보

### 버그 4: 배열 요소 타입 검증 미비
- **문제**: [123], [null], [{}] 모두 통과
- **해결**: `every((code: any) => typeof code === 'string')` (lines 143-165)
- **결과**: 문자열만 허용, 타입 안전성 강화

---

## 3. 기술적 교훈 및 재사용 패턴

### 3.1 입력 검증 패턴
```typescript
// 다층 검증 체계 (POST → QueryString → 비즈니스 로직)
try {
  const body = await request.json();
  // 1. 타입 검사 (object, array, number)
  // 2. 범위 검사 (limit > 0)
  // 3. 배열 요소 검사 (all strings)
  requestedFilters = body;
  filterSource = 'body';
} catch (error) {
  if (error instanceof SyntaxError) {
    // Fallback: Query string
    requestedFilters = parseQueryParams(request.nextUrl.searchParams);
    filterSource = 'query';
  }
}
```

**다음 단계에서 재활용**:
- 점검 수정 API (점검 이력 PUT)
- 데이터 삭제 API (점검 이력 DELETE)
- 스케줄 관리 API

### 3.2 3-Layer 권한 검증 패턴
```typescript
// Layer 1: 기능 활성화 (flag)
if (!userProfile.can_export_data) return 403;

// Layer 2: 역할 확인
if (!ALLOWED_ROLES.includes(userProfile.role)) return 403;

// Layer 3: 결과 제한 강제
const finalLimit = Math.min(
  requestedFilters.limit,
  accessScope.permissions.maxResultLimit
);
```

**다음 단계에서 재활용**:
- can_edit_inspection 플래그 추가
- 점검 수정 권한 검증
- 삭제 권한 검증

### 3.3 데이터 마스킹 패턴
```typescript
// lib/data/masking.ts - 역할별 마스킹
const maskingSensitiveData = (data: AED[], role: string) => {
  if (ROLES_WITHOUT_MASKING.includes(role)) return data; // Master

  return data.map(item => ({
    ...item,
    contact_phone: maskPhone(item.contact_phone),
    contact_email: maskEmail(item.contact_email),
    detailed_address: maskAddress(item.detailed_address)
  }));
};
```

**다음 단계에서 재활용**:
- 점검 이력 조회 시 마스킹
- 사진 URL 마스킹 (location 제거)

### 3.4 로그 추적 패턴
```typescript
// filterSource를 통한 출처 추적
logger.warn('Export:CityCodeMapping', 'Mapping failed', {
  originalCode: code,
  source: filterSource,  // 'body' or 'query'
  userId: session.user.id
});
```

**다음 단계에서 재활용**:
- 모든 API에서 요청 출처 추적
- 사용자 행동 분석 로그
- 감사(audit) 로그

---

## 4. 운영 교훈

### 4.1 배포 전 확인사항 (체크리스트화)
- [ ] TypeScript 컴파일 (`npm run tsc`)
- [ ] ESLint 검사 (`npm run lint`)
- [ ] 프로덕션 빌드 (`npm run build`)
- [ ] Git 상태 확인 (`git status`)
- [ ] 최근 커밋 확인 (`git log`)

### 4.2 배포 후 검증 (Smoke Test)
- [ ] HTTP 상태 코드 확인
- [ ] Master 계정 존재 확인
- [ ] 권한 플래그 확인
- [ ] NextAuth CSRF 확인
- [ ] PM2 프로세스 상태

### 4.3 모니터링 설정 (3단계)
1. **즉시** (배포 후 1시간): PM2 상태, 에러 로그
2. **단기** (1-7일): 실제 사용자 테스트
3. **장기** (1개월): 성능 분석, 정책 조정

---

## 5. 다음 단계 (Phase 5+)

### 5.1 점검 데이터 수정 API (우선순위: 높음)
- 점검 이력 수정 권한 검증
- 마스킹 적용 (local_admin만)
- 감사 로그 기록
- 동일 패턴 재활용 (Phase 4 입력 검증)

### 5.2 점검 삭제 API (우선순위: 중간)
- 삭제 권한 검증 (master/emergency_center_admin만)
- soft-delete vs hard-delete 결정
- 감사 로그 (삭제자, 삭제 사유)

### 5.3 사진 스토리지 마이그레이션 (우선순위: 높음)
- Supabase → NCP Object Storage
- 사진 URL 마스킹 (위치 정보 제거)
- 캐시 관리 (CDN 활용)

### 5.4 모니터링 대시보드 구축 (우선순위: 중간)
- 웹 기반 대시보드 (React)
- 실시간 메트릭 (WebSocket)
- 주간/월간 리포트 (자동 생성)

---

## 6. 기술 부채 (검토 필요)

### 6.1 에러 처리 표준화
- API마다 에러 응답 형식이 다름
- 통일된 에러 코드 체계 필요
- ErrorHandler middleware 개선

### 6.2 로그 수집 (ELK 고려)
- 현재: PM2 logs → 파일 검색
- 장기: ELK Stack으로 중앙화
- 실시간 분석, 알림 자동화

### 6.3 테스트 자동화 (E2E/Unit)
- 현재: 수동 QA
- 다음: Jest + Playwright E2E
- CI/CD에 통합

---

## 7. 팀 피드백

### 개발팀
- **도움**: 13-step 설계로 복잡도 감소
- **개선**: 조기 테스트로 4개 버그 사전 차단
- **앞으로**: 입력 검증 패턴 문서화 요청

### QA Team
- **도움**: 상세 QA 시나리오 가이드
- **개선**: 프로덕션 계정으로 실제 검증
- **앞으로**: 자동화된 회귀 테스트 스크립트

### DevOps
- **도움**: 모니터링 스크립트 자동화
- **개선**: PM2 reload로 무중단 배포
- **앞으로**: 성능 메트릭 대시보드 구축

---

## 8. 최종 평가

### 기술적 성과
- ✅ 3개월 계획 12일 만에 완료
- ✅ 4개 버그 사전 차단
- ✅ 0 배포 실패 (첫 배포 성공)
- ✅ 12/12 QA 시나리오 통과

### 운영 준비도
- ✅ 모니터링 자동화 (일일/주간/월간)
- ✅ 회고 및 재사용 패턴 정리
- ✅ 다음 단계 로드맵 수립
- ⚠️ ELK 등 장기 인프라는 미정

### 향후 개선 방향
1. **단기** (2주): 실제 사용자 피드백 수집
2. **중기** (1개월): 점검 수정/삭제 API 구현
3. **장기** (3개월): 모니터링 대시보드 및 테스트 자동화

---

## 9. 재사용 가능 자산

### 코드 패턴
1. `lib/auth/access-control.ts` - 권한 검증 (3-layer)
2. `lib/data/masking.ts` - 데이터 마스킹 (역할별)
3. `lib/utils/query-parser.ts` - 파라미터 파싱 (호환성)
4. `app/api/inspections/export/route.ts` - API 구조 (13-step)

### 문서 템플릿
1. QA 시나리오 작성 가이드
2. 모니터링 설정 체크리스트
3. 배포 전 검증 절차
4. Phase 회고 템플릿

### 운영 스크립트
1. `scripts/monitoring/daily_export_stats.sh` - 일일 통계
2. `scripts/monitoring/weekly_export_report.sh` - 주간 리포트
3. `scripts/monitoring/monthly_export_report.sh` - 월간 분석
4. PM2 로그 필터링 명령어

---

## 10. 종합 결론

### 성공 요인
1. **명확한 설계**: 13-step 파이프라인으로 복잡도 관리
2. **조기 검증**: 개발 중 4개 버그 사전 차단
3. **문서화**: 운영팀을 위한 완벽한 가이드
4. **자동화**: 모니터링 스크립트로 운영 부담 감소

### 배운 점
1. **입력 검증**: 다층 방식이 보안과 UX 모두 향상
2. **로그 추적**: filterSource 같은 출처 추적이 디버깅 시간 단축
3. **하위 호환성**: Query string 호환성으로 마이그레이션 부담 제거
4. **모니터링**: 배포 후 즉시 자동화 설정이 장기 운영 비용 절감

### 다음 개발팀에 전달할 것
1. Phase 4에서 정리한 입력 검증/권한/마스킹 패턴 재사용
2. 13-step 설계 패턴을 다른 API에도 적용
3. 모니터링 자동화 스크립트는 모든 API에 확대
4. 3개월마다 회고 진행 (지속적 개선)

---

**상태**: 완료
**배포일**: 2025-11-06
**운영 시작**: 2025-11-06
**다음 리뷰**: 2025-11-20 (2주 후)
