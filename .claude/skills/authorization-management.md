# Authorization Management Skill

## Purpose
6가지 권한 레벨을 체계적으로 관리하고, 모든 메뉴와 업무 흐름에서 일관성 있게 권한을 검증합니다.

## 권한 체계 (6단계)

### Level 1: Master 계정 (최상위)
**역할**: master
**이메일**: truth0530@nmc.or.kr (이광성)
**코드명**: MASTER

**권한:**
- 시스템 전체 관리
- 사용자 승인/거부
- 데이터베이스 마이그레이션
- 조직 관리
- 전국 AED 조회 및 관리 (모든 지역)

**UI 모드**: admin-full (모든 기능)
**접근 레벨**: national (전국)

**예시:**
- truth0530@nmc.or.kr (시스템 관리자)

---

### Level 2: NMC.OR.KR 계정 (중앙 및 지역 응급의료센터)
**역할**: emergency_center_admin (중앙), regional_emergency_center_admin (지역)
**이메일**: @nmc.or.kr
**코드명**: EMERGENCY_CENTER, REGIONAL_EMERGENCY_CENTER

#### 2-1. 중앙응급의료센터 (emergency_center_admin)
**권한:**
- 전국 17개 시도 자유 선택 + "전체" 선택 가능
- 시군구 자유 선택
- 사용자 승인/거부
- 점검 데이터 수정/삭제
- 전국 통계 조회

**기본 설정:**
- 지역: 기본 선택값 없음 (사용자가 선택)
- UI 모드: admin-full

**접근 레벨**: national

**예시:**
- admin@nmc.or.kr (중앙응급의료센터)

#### 2-2. 시도응급의료지원센터 (regional_emergency_center_admin)
**권한:**
- 해당 시도만 고정 선택 가능 (변경 불가 아님, 표시만)
- 해당 시도 내 모든 시군구 자유 선택 또는 "전체"
- 해당 지역 사용자 승인/거부
- 해당 지역 점검 데이터 수정/삭제

**기본 설정:**
- 지역: 자동 설정 (해당 시도)
- UI 모드: admin-full

**접근 레벨**: regional

**예시:**
- seoul@nmc.or.kr (서울응급의료지원센터)
- busan@nmc.or.kr (부산응급의료지원센터)

---

### Level 3: korea.kr 보건복지부 (ministry_admin)
**역할**: ministry_admin
**이메일**: @korea.kr (보건복지부 고정 이메일)
**코드명**: MINISTRY_ADMIN

**권한:**
- 전국 17개 시도 자유 선택 + "전체" 선택 가능 (중앙 제외)
- 시군구 자유 선택
- 사용자 승인/거부 (고급 관리자만)
- 전국 통계 조회 (읽기 전용)
- 점검 데이터 조회만 가능 (수정/삭제 불가)

**기본 설정:**
- 지역: 기본 선택값 없음
- UI 모드: read-only

**접근 레벨**: national

**예시:**
- admin@korea.kr (보건복지부 관리자)

---

### Level 4: korea.kr 시도청 담당자 (regional_admin)
**역할**: regional_admin
**이메일**: @korea.kr (해당 시도청)
**코드명**: REGIONAL_ADMIN

**권한:**
- 소속 시도만 접근 가능 (고정)
- 해당 시도 내 모든 시군구 자유 선택 또는 "전체"
- 해당 지역 통계만 조회 가능
- 점검 데이터 조회만 가능 (수정/삭제 불가)
- 사용자 승인 불가 (상위 관리자에 의해 승인)

**기본 설정:**
- 지역: 자동 설정 (해당 시도) - 표시만 (변경 불가)
- 시군구: 선택 가능
- UI 모드: read-only

**접근 레벨**: regional

**예시:**
- seoul@korea.kr (서울시청)
- busan@korea.kr (부산시청)
- jeju@korea.kr (제주특별자치도청)

---

### Level 5: korea.kr 보건소 담당자 (local_admin)
**역할**: local_admin
**이메일**: @korea.kr (해당 보건소)
**코드명**: LOCAL_ADMIN

**권한:**
- 소속 시도 고정 표시 (변경 불가)
- 소속 시군구 고정 표시 (변경 불가)
- 두 가지 조회 기준 선택 가능:
  1. **주소 기준**: 해당 시군구에 물리적으로 설치된 AED
  2. **관할보건소 기준**: 해당 보건소가 관리하는 AED (타 지역 포함 가능)
- 담당 지역 내 점검 작성/수정 가능
- 자신의 점검만 삭제 가능
- 점검 통계 조회 (자신의 지역만)

**기본 설정:**
- 시도: 자동 설정 (소속 시도) - 읽기 전용
- 시군구: 자동 설정 (소속 시군구) - 읽기 전용
- UI 모드: local-full

**접근 레벨**: local

**예시:**
- gangnam@korea.kr (강남구 보건소)
- songpa@korea.kr (송파구 보건소)

---

### Level 6: 임시 점검원 (temporary_inspector)
**역할**: temporary_inspector
**이메일**: 모든 이메일 가능 (비정규직/외부 계약자)
**코드명**: TEMPORARY_INSPECTOR

**권한:**
- AED 데이터 조회 불가 (할당된 기기만 보임)
- 할당된 기기에 대해서만 점검 가능
- 자신이 작성한 점검만 수정 가능
- 자신이 작성한 점검만 삭제 가능
- 대시보드 제한 (자신의 점검 목록만)
- 통계 조회 불가

**기본 설정:**
- 지역: 할당된 기기 위치에 따라 동적 결정
- UI 모드: assigned-only (할당된 기기만)

**접근 레벨**: local

**예시:**
- contractor@gmail.com (외부 계약 점검원)
- volunteer@naver.com (자원봉사 점검원)

---

## 메뉴 접근 권한 매트릭스

| 메뉴 | Master | 중앙응급센터 | 보건복지부 | 시도청 | 보건소 | 임시점검원 |
|------|--------|-----------|---------|--------|--------|-----------|
| 사용자 관리 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 조직 관리 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AED 관리 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 대시보드 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(제한) |
| 점검 관리 | ✅ | ✅ | ✅(읽기) | ✅(읽기) | ✅ | ✅(할당만) |
| 통계 | ✅ | ✅ | ✅ | ✅ | ✅(지역) | ❌ |
| 설정 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## AED 데이터 접근 범위

### 지역 선택 규칙

#### Master
```
- 17개 시도 자유 선택
- "전체" 선택 가능
- 시군구 자유 선택
- 모든 AED 접근 가능
```

#### 중앙응급의료센터
```
- 17개 시도 자유 선택
- "전체" 선택 가능
- 시군구 자유 선택
- 기본 선택값: 없음 (사용자가 선택)
- 모든 AED 접근 가능
```

#### 시도응급의료지원센터 (예: 서울)
```
- 해당 시도만 접근 가능 (서울만 가능)
- "전체" 선택 가능 (서울 전체)
- 시군구 자유 선택 (강남, 송파 등)
- 기본 선택값: 서울
- 서울의 모든 AED만 접근 가능
```

#### 보건복지부
```
- 17개 시도 자유 선택 (중앙 제외)
- "전체" 선택 가능
- 시군구 자유 선택
- 기본 선택값: 없음 (사용자가 선택)
- 조회만 가능 (수정/삭제 불가)
```

#### 시도청 담당자 (예: 서울시청)
```
- 해당 시도만 접근 가능 (서울만 가능)
- "전체" 선택 가능 (서울 전체)
- 시군구 자유 선택
- 기본 선택값: 서울 (고정)
- 서울의 모든 AED 조회 가능 (수정/삭제 불가)
```

#### 보건소 담당자 (예: 강남구 보건소)
```
- 소속 시도 고정 (서울)
- 소속 시군구 고정 (강남구)
- 두 가지 기준:
  1) 주소 기준: 강남구에 설치된 AED
  2) 관할보건소 기준: 강남구 보건소가 관리하는 AED (서울/타시도)
- 기본 선택값: 강남구
```

#### 임시 점검원
```
- 할당된 기기만 접근 가능
- 지역 선택 불가
- 대시보드: 할당된 기기 목록만 표시
```

---

## 점검 기능 권한

### 점검 작성
```
Master                      : ✅ 모든 지역
중앙응급의료센터            : ✅ 선택한 지역
시도응급의료지원센터         : ✅ 해당 시도만
보건복지부                  : ❌ 읽기 전용
시도청 담당자                : ❌ 읽기 전용
보건소 담당자                : ✅ 자신의 지역만
임시 점검원                 : ✅ 할당된 기기만
```

### 점검 수정
```
Master                      : ✅ 모든 점검
중앙응급의료센터            : ✅ 모든 점검
시도응급의료지원센터         : ✅ 해당 시도 점검
보건복지부                  : ❌ 불가
시도청 담당자                : ❌ 불가
보건소 담당자                : ✅ 자신의 점검, 자신의 지역
임시 점검원                 : ✅ 자신의 점검만
```

### 점검 삭제
```
Master                      : ✅ 모든 점검
중앙응급의료센터            : ✅ 모든 점검
시도응급의료지원센터         : ✅ 해당 시도 점검
보건복지부                  : ❌ 불가
시도청 담당자                : ❌ 불가
보건소 담당자                : ✅ 자신의 점검만
임시 점검원                 : ✅ 자신의 점검만
```

---

## 사용자 승인 권한

```
Master                      : ✅ 모든 사용자 승인/거부
중앙응급의료센터            : ✅ 모든 사용자 승인/거부
시도응급의료지원센터         : ✅ 해당 시도 사용자 승인/거부
보건복지부                  : ✅ 모든 사용자 승인/거부
시도청 담당자                : ❌ 불가 (상위 관리자가 처리)
보건소 담당자                : ❌ 불가
임시 점검원                 : ❌ 불가
```

---

## 권한 검증 로직 (코드 레벨)

### 1단계: 역할 확인
```typescript
// lib/auth/permissions.ts에서 정의된 권한 검증
const hasPermission = checkPermission(userRole, 'CREATE_INSPECTION');

// 또는 직접 역할 확인
if (!hasAdminAccess(userRole)) {
  return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
}
```

### 2단계: 지역 범위 확인
```typescript
// 사용자가 선택한 지역이 그 사용자에게 접근 가능한가?
const userRegion = userProfile.region_code;  // 보건소: 'SEO', 시도청: 'SEO'
const requestedRegion = req.query.region;

if (userProfile.role === 'local_admin' && userRegion !== requestedRegion) {
  return NextResponse.json({ error: '접근 불가 지역입니다.' }, { status: 403 });
}
```

### 3단계: 데이터 소유권 확인
```typescript
// 점검 수정 시: 자신이 작성한 점검인가?
const inspection = await prisma.inspections.findUnique({ where: { id } });

if (inspection.inspector_id !== userId && !hasAdminAccess(userRole)) {
  return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
}
```

---

## 일관성 체크리스트

### 1. 역할 정의 일관성
- [ ] lib/auth/permissions.ts에 모든 6가지 역할 정의됨
- [ ] lib/utils/user-roles.ts에 ROLE_INFO 존재
- [ ] lib/auth/role-matrix.ts에 ROLE_ACCESS_MATRIX 존재
- [ ] 각 역할의 라벨/설명 일치

### 2. UI 모드 일관성
- [ ] admin-full: Master, 중앙응급센터, 시도응급센터 (모든 권한)
- [ ] local-full: 보건소 담당자 (지역 내 모든 권한)
- [ ] read-only: 보건복지부, 시도청 (조회만)
- [ ] assigned-only: 임시 점검원 (할당된 것만)

### 3. 지역 선택 일관성
- [ ] 권한 레벨별로 선택 가능한 지역 범위 다름
- [ ] 고정 지역은 변경 불가능하게 UI에서 비활성화
- [ ] "전체" 버튼은 접근 가능한 범위 내에서만 가능

### 4. 점검 기능 일관성
- [ ] 작성 권한과 수정 권한이 일치
- [ ] 삭제는 더 제한적 (자신의 것만 또는 관리자만)
- [ ] 승인 권한은 고급 관리자(승인 기능 있는 역할)만

### 5. 메뉴 접근 일관성
- [ ] 메뉴 가시성이 권한과 일치
- [ ] 권한 없는 메뉴는 숨김처리
- [ ] 페이지 직접 접근 시 권한 재검증

### 6. 권한 검증 로직 일관성
- [ ] API 엔드포인트마다 권한 검증 로직 있음
- [ ] 클라이언트/서버 양쪽에서 검증
- [ ] 에러 메시지가 일관됨

---

## 검증 절차

### Phase 1: 역할 정의 검증
```bash
# 1. lib/auth/permissions.ts 확인
grep "ROLES\|PERMISSION_GROUPS" lib/auth/permissions.ts

# 2. 모든 역할의 라벨 확인
grep "label:" lib/utils/user-roles.ts
```

### Phase 2: UI 모드 검증
```bash
# 1. role-matrix.ts에서 각 역할의 UI 모드 확인
grep "inspectionUIMode\|dashboardUIMode" lib/auth/role-matrix.ts
```

### Phase 3: 지역 선택 검증
```bash
# 1. 권한별 지역 범위 정의 확인
grep -r "region_code\|getAvailableRegions" lib/

# 2. 지역 선택 UI가 올바른가?
grep -r "disabled.*region\|readOnly.*region" components/
```

### Phase 4: 점검 기능 검증
```bash
# 1. 점검 관련 API 엔드포인트 권한 검증
grep "hasAdminAccess\|hasActiveUserAccess" app/api/inspections/*/route.ts

# 2. 점검 수정/삭제 권한 확인
grep -A5 "inspector_id\|userRole" app/api/inspections/*/route.ts
```

### Phase 5: 메뉴 접근 검증
```bash
# 1. 메뉴 렌더링 조건 확인
grep -r "role === \|hasAdminAccess" components/layout/

# 2. 페이지 레이아웃 권한 검증
grep -r "canAccessInspection\|canAccessDashboard" app/
```

---

## 문제 해결

### 문제 1: 권한 불일치
**증상**: 사용자가 접근할 수 없어야 하는 페이지에 접근 가능

**진단:**
```bash
# 1. 사용자 역할 확인
SELECT id, email, role FROM user_profiles WHERE email = 'user@example.com';

# 2. 역할의 권한 확인
# lib/utils/user-roles.ts에서 해당 역할의 accessLevel 확인

# 3. 페이지 접근 권한 확인
# 해당 페이지에서 useAuth로 권한 검증하는지 확인
```

**해결:**
1. 페이지 상단에 권한 검증 추가
2. 미들웨어에서 권한 사전 검증
3. 메뉴에서 권한 없는 항목 숨김

### 문제 2: 지역 접근 오류
**증상**: 보건소 담당자가 다른 지역의 AED 수정 가능

**진단:**
```typescript
// API 엔드포인트에서 지역 범위 검증 누락
const inspection = await prisma.inspections.findUnique({ where: { id } });
// 지역 검증 없음 ❌
await prisma.inspections.update({ where: { id }, data: {...} });
```

**해결:**
```typescript
// 지역 범위 검증 추가
const inspection = await prisma.inspections.findUnique({ where: { id } });

if (userRole === 'local_admin' && inspection.region_code !== userRegion) {
  return NextResponse.json({ error: '접근 불가 지역' }, { status: 403 });
}

await prisma.inspections.update({ where: { id }, data: {...} });
```

### 문제 3: UI와 API 권한 불일치
**증상**: UI에서 버튼이 활성화되었는데 API 호출 시 403 에러

**진단:**
```bash
# 1. UI 권한 검증 확인 (components/inspection/...)
grep -n "canStartInspection\|getUIPermissions" components/inspection/*.tsx

# 2. API 권한 검증 확인 (app/api/inspections/*/route.ts)
grep -n "hasAdminAccess\|checkPermission" app/api/inspections/*/route.ts

# 3. 다른 부분이 있으면 수정 필요
```

**해결:**
API와 UI의 권한 검증 로직을 동일하게 유지

---

## 권한 적용 체크리스트

새로운 기능 추가 시:

- [ ] 기능이 어느 역할에 필요한가? (6가지 레벨별)
- [ ] 각 역할별로 접근 범위가 다른가? (예: 지역 제한)
- [ ] API 엔드포인트에 권한 검증 추가했나?
- [ ] UI 컴포넌트에서 권한 검증했나?
- [ ] 권한 없는 사용자가 직접 URL 접근 시 처리했나?
- [ ] 에러 메시지가 명확한가?

---

## 참고 문서
- [CLAUDE.md - 핵심 권한 체계](CLAUDE.md#3-핵심-권한-체계-절대-불변)
- [lib/auth/permissions.ts](lib/auth/permissions.ts) - 권한 검증 함수
- [lib/utils/user-roles.ts](lib/utils/user-roles.ts) - 역할 정보
- [lib/auth/role-matrix.ts](lib/auth/role-matrix.ts) - 역할별 접근 제어
- [lib/auth/access-control.ts](lib/auth/access-control.ts) - 추가 접근 제어
- [prisma/schema.prisma](prisma/schema.prisma) - user_role enum 정의
