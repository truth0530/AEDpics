# 의무기관매칭 통계 탭 데이터 미표시 문제

## 문제 상황 (2025-11-17)

**증상:**
- 의무기관매칭 메뉴의 "통계" 탭에서 모든 통계가 0으로 표시됨
- "전체 기관", "매칭 완료", "미매칭", "매칭률" 모두 0%로 표시
- "기관별 매칭 현황" 테이블이 빈 상태로 표시됨

**스크린샷 확인 결과:**
- 화면에 "전체 기관: 0", "매칭 완료: 0", "미매칭: 0", "매칭률: 0%" 표시
- "선택한 지역에 매칭된 기관이 없습니다" 메시지 표시

**데이터베이스 상태:**
- target_list_2025: 28,862개 기관 존재
- target_list_devices (2025): 2개 매칭 레코드 존재
  - 대구광역시 군위군 용대보건진료소
  - 대구광역시 군위군 부계면보건지소

**예상되는 정상 동작:**
- 전체 기관: 28,862
- 매칭 완료: 2
- 미매칭: 28,860
- 매칭률: 0.01%

## 수정 시도 내역

### 시도 1: unmatched_institutions 계산 로직 수정
**파일:** `/app/api/compliance/matching-status/route.ts`

**변경 내용:**
```typescript
// BEFORE: SQL 쿼리에서 계산 (잘못된 로직)
COUNT(DISTINCT CASE WHEN d.equipment_serial IS NULL THEN t.target_key END) as unmatched_institutions

// AFTER: 간단한 계산으로 수정
const unmatchedInstitutionsCount = totalInstitutions - matchedInstitutions;
```

**결과:** 여전히 해결 안 됨

### 시도 2: 빈 데이터 메시지 추가
**파일:** `/components/admin/compliance/ComplianceDashboard.tsx`

**변경 내용:**
- matchingData.institutions.length === 0일 때 안내 메시지 표시
- 지역 필터 상태에 따라 다른 메시지 표시

**결과:** UI 개선은 되었으나 근본 문제 미해결

## 원인 분석 (미완료)

### 가능성 1: API 데이터 로딩 문제
- ComplianceDashboard가 API를 호출하지만 응답이 비어있을 가능성
- selectedSido/selectedGugun 필터가 잘못 전달될 가능성

### 가능성 2: 지역명 매칭 문제
- API에서 "대구광역시"로 검색하는데 실제 DB에는 다른 형식으로 저장
- regions.ts의 지역명 변환 로직 확인 필요

### 가능성 3: 페이지네이션 문제
- 기본 pageSize가 50인데 실제 데이터가 반환되지 않을 가능성
- API 응답 구조 확인 필요

## 다음 단계 (데이터베이스 교체 후)

1. **브라우저 개발자 도구로 실제 API 호출 확인**
   - Network 탭에서 `/api/compliance/matching-status` 요청/응답 확인
   - 실제 전달되는 파라미터 확인
   - 응답 데이터 구조 확인

2. **API 로그 추가**
   ```typescript
   console.log('[ComplianceAPI] Request params:', { sido, gugun, page, pageSize });
   console.log('[ComplianceAPI] Summary result:', summary);
   console.log('[ComplianceAPI] Total institutions:', totalInstitutions);
   ```

3. **지역명 변환 확인**
   - selectedSido가 "대구광역시"인지 "대구"인지 확인
   - normalizeGugunForDB, normalizeSidoForDB 호출 여부 확인

4. **직접 SQL 쿼리 테스트**
   ```sql
   -- target_list_2025와 target_list_devices JOIN 테스트
   SELECT
     COUNT(DISTINCT t.target_key) as total,
     COUNT(DISTINCT CASE WHEN d.equipment_serial IS NOT NULL THEN t.target_key END) as matched
   FROM target_list_2025 t
   LEFT JOIN target_list_devices d
     ON d.target_institution_id = t.target_key
     AND d.target_list_year = 2025;
   ```

## 관련 파일

- `/components/admin/compliance/ComplianceDashboard.tsx` - 통계 UI 컴포넌트
- `/app/api/compliance/matching-status/route.ts` - 매칭 현황 API
- `/app/api/compliance/inspection-status/route.ts` - 점검 현황 API
- `/app/api/compliance/compliance-rate/route.ts` - 의무이행률 API

## 참고 문서

- [COMPLIANCE_EMPTY_DATA_RESOLUTION.md](./COMPLIANCE_EMPTY_DATA_RESOLUTION.md) - 매칭결과 탭 빈 데이터 해결 사례

## 상태

- **미해결** - 데이터베이스 교체 후 재시도 필요
- 최종 업데이트: 2025-11-17
