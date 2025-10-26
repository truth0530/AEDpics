# 마이그레이션 파일 정리 요약

**정리 일자**: 2025-10-03
**목적**: 중복/불필요한 마이그레이션 제거 및 통합

## 아카이브된 파일 (archived_migrations/)

### RPC 함수 관련 (23번으로 통합됨)
- `fix_aed_function.sql` - 초기 버전
- `fix_aed_function_v2.sql` - 개선 버전
- `fix_aed_function_final.sql` - 최종 버전 (23번에 반영)
- `21_add_gps_to_rpc.sql` - GPS 추가 (23번에 통합)
- `22_fix_device_serial_type.sql` - 타입 수정 (23번에 통합)
- `23_fix_query_with_gps_old.sql` - 구버전 (29번으로 개선)
- `24_fix_varchar_cast.sql` - 캐스팅 수정 (23번에 통합)

## 활성 마이그레이션 파일 목록

### 기본 스키마 (01-03)
- `01_initial_schema.sql` - 초기 데이터베이스 스키마
- `02_initial_data.sql` - 초기 데이터
- `03_rls_policies.sql` - 초기 RLS 정책

### AED 데이터 관련 (04, 10)
- `04_aed_tables.sql` - AED 테이블 생성
- `10_aed_data_rls_policy.sql` - AED 데이터 RLS 정책

### 팀 관리 (05)
- `05_team_management.sql` - 팀 관리 기능

### 점검 시스템 (06, 17, 20)
- `06_fix_inspection_schema.sql` - 점검 스키마 수정
- `17_duplicate_equipment_handling.sql` - 중복 장비 처리
- `20_create_inspection_sessions.sql` - 점검 세션 테이블

### 보건소 매핑 (07-08)
- `07_health_center_mapping.sql` - 보건소 매핑 테이블
- `08_health_center_initial_data.sql` - 보건소 초기 데이터

### AED 쿼리 함수 (23) ⭐ **최종 통합본**
- `23_aed_query_functions_complete.sql` - AED 데이터 조회 RPC 함수 (GPS, 카테고리, 상세필드 포함)
  - 이전: 09, 21, 22, 23(old), 24, 29 파일 내용 통합
  - 포함 내용:
    - `get_aed_data_filtered` - 시도/시군구 기준 조회
    - `get_aed_data_by_jurisdiction` - 관할보건소 기준 조회
    - GPS 좌표 (latitude, longitude)
    - 분류 필드 (category_1, category_2, category_3)
    - 상세 정보 (제조국가, 시리얼번호, 설치방법, 비고 등)

### 알림 시스템 (11-12, 18)
- `11_create_notifications.sql` - 알림 테이블 생성
- `12_fix_notification_policies.sql` - 알림 정책 수정
- `18_notification_system.sql` - 알림 시스템 확장

### 사용자 관리 (13-14)
- `13_add_last_login.sql` - 최종 로그인 시간 추가
- `14_login_tracking.sql` - 로그인 추적

### 조직 관리 (15)
- `15_organization_changes.sql` - 조직 관리 변경사항

### 일정 관리 (16)
- `16_inspection_schedule_entries.sql` - 점검 일정 항목

### GPS 이슈 (19)
- `19_gps_issues_table.sql` - GPS 이슈 추적 테이블

### 감사 로그 (20250927)
- `20250927_create_audit_logs.sql` - 감사 로그 초기 버전
- `20250927_safe_audit_logs_setup.sql` - 감사 로그 안전 설정

### 누락 테이블 (20250127)
- `20250127_create_missing_tables.sql` - 누락된 테이블 생성

### OTP 및 보안 (25)
- `25_otp_rate_limiting.sql` - OTP 속도 제한

### 지역 코드 (26)
- `26_region_code_migration.sql` - 지역 코드 마이그레이션
- `26_region_code_migration_rollback.sql` - 롤백 스크립트

### 영속성 매핑 (27-28)
- `27_persistent_mapping_table.sql` - 영속성 매핑 테이블 및 점검 수정 이력
- `28_add_field_changes_to_sessions.sql` - inspection_sessions에 field_changes 추가

### 🚀 2025-10-04 최신 (48-49)
- **`48_fix_rpc_schema_mismatch.sql`** - 관할보건소 기준 조회 + 헤더 필터 통합
  - `get_aed_data_filtered()`: sido/gugun 파라미터 추가
  - `get_aed_data_by_jurisdiction()`: 신규 생성
- **`49_fix_region_short_names.sql`** ✅ - 지역 이름 매핑 수정
  - **문제**: 'SEO' → '서울특별시' 변환했으나 DB에는 '서울' 저장
  - **해결**: 'SEO' → '서울', 'BUS' → '부산' 등 짧은 이름으로 매핑
  - **결과**: 지역 필터 검색 정상 작동 ✅

### 기타
- `RUN_THIS_FOR_AED_MAP.sql` - AED 맵 설정 스크립트

## 실행 권장 순서

### 즉시 실행 필요 (프로덕션 미적용)
```sql
-- 27번: 영속성 매핑 (aed_data 교체 시 외부키 보존)
\i 27_persistent_mapping_table.sql

-- 28번: 점검 세션 필드 변경 추적
\i 28_add_field_changes_to_sessions.sql

-- 23번: AED 쿼리 함수 최종본 (분류1 칼럼, 상세정보 포함)
\i 23_aed_query_functions_complete.sql
```

### 실행 시 주의사항
1. **23번 파일**은 기존 `get_aed_data_filtered`, `get_aed_data_by_jurisdiction` 함수를 DROP하고 재생성합니다.
2. **27번 파일**은 여러 테이블과 뷰를 생성하므로 실행 전 백업 권장
3. **프로덕션 환경**에서는 트랜잭션 내에서 실행하고 테스트 후 커밋

## 마이그레이션 효과

### 23번 실행 후
- ✅ 분류1 칼럼 데이터 정상 표시
- ✅ 상세정보 모달에서 '미등록' 해결
- ✅ GPS 좌표 정상 반환
- ✅ 제조국가, 시리얼번호, 설치방법 등 모든 상세 정보 표시

### 27-28번 실행 후
- ✅ AED 데이터 교체 시 외부 시스템 매핑 보존
- ✅ 점검 시 필드 변경 이력 추적 가능
- ✅ 점검 보고서 생성 기능 지원

---

## 향후 일정 관리 시스템 개선 계획 (미구현)

**작성일**: 2025-10-03
**상태**: 계획 단계 - 충분한 테스트 후 구현 예정

### 1. 일정 추가 필터링 시스템

#### 1.1 우선순위(aed-data) 페이지
- **현재**: 모든 장비 표시
- **개선**: 일정에 추가된 장비는 검색 결과에서 제외
- **목적**: 중복 일정 방지, 미처리 장비에 집중
- **구현 방향**:
  ```sql
  -- schedules 테이블과 LEFT JOIN하여 schedule_id가 NULL인 장비만 조회
  WHERE schedule_id IS NULL OR schedule_status = 'completed'
  ```

#### 1.2 현장점검(inspection) 페이지
- **현재**: 모든 장비 표시
- **개선**: 일정에 추가된 장비만 표시
- **목적**: 점검자가 자신의 일정만 확인
- **구현 방향**:
  ```sql
  -- schedules 테이블과 INNER JOIN하여 일정이 있는 장비만 조회
  WHERE schedule_id IS NOT NULL AND schedule_status IN ('pending', 'in_progress')
  ```

### 2. 보건소 관리자 자동 배치 기능

#### 2.1 자동 일정 생성 (Auto-Scheduling)
- **대상 사용자**: 보건소 관리자 (health_center role)
- **기능**:
  - 관할 구역 내 미점검 장비 자동 감지
  - 우선순위 알고리즘 적용 (만료임박, 미점검기간 등)
  - 가용한 날짜에 자동 배치
  - 배치 결과 알림 전송

#### 2.2 우선순위 알고리즘
```
우선순위 점수 계산:
- 배터리/패드 만료일 임박: +10점 (30일 이내), +5점 (60일 이내)
- 미점검 기간: +1점/30일 단위
- GPS 이슈 있음: +3점
- 이전 점검 이상 발견: +5점
- 긴급 신고 접수: +15점
```

### 3. 인력 일정 관리 시스템

#### 3.1 인력 가용성 입력
- **기능**:
  - 점검자별 근무 가능 일정 입력 (캘린더 UI)
  - 휴가, 출장, 교육 등 불가능 일정 표시
  - 1일 최대 점검 가능 건수 설정
  - 지역별 이동 시간 고려

#### 3.2 자동 인력 배정
- **부하 분산 알고리즘**:
  ```
  1. 가용한 인력 목록 조회 (해당 날짜 근무 가능)
  2. 각 인력의 현재 배정 건수 확인
  3. 지역적 근접성 계산 (이동 시간 최소화)
  4. 부하가 가장 적은 인력에게 우선 배정
  5. 최대 건수 초과 시 다음 인력에게 배정
  ```

- **제약 조건**:
  - 1인당 1일 최대 점검 건수: 설정값 (기본 5건)
  - 지역 이동 시간: 같은 시군구 우선 배정
  - 전문성: 특정 모델 경험 있는 인력 우선

#### 3.3 인력 배정 테이블 설계 (예상)
```sql
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  work_date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  max_inspections_per_day INT DEFAULT 5,
  unavailable_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspection_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES schedules(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  auto_assigned BOOLEAN DEFAULT false,
  estimated_duration_minutes INT DEFAULT 30,
  travel_time_minutes INT
);
```

### 4. 역할별 장비 필터링

#### 4.1 일반 사용자 (점검자)
- **기본 뷰**: 본인에게 배정된 장비만 표시
- **필터 옵션**: "전체 보기" 토글 시 관할 구역 전체 장비 표시
- **권한**: 본인 일정만 수정 가능

#### 4.2 보건소 관리자
- **기본 뷰**: 관할 구역 전체 장비
- **필터 옵션**:
  - 배정된 점검자별 필터
  - 일정 상태별 필터 (미배정/배정완료/점검완료)
- **권한**: 관할 구역 내 모든 일정 수정 가능

#### 4.3 시도 관리자
- **기본 뷰**: 관할 시도 전체 장비
- **대시보드**:
  - 시군구별 점검 진행률
  - 보건소별 배정 현황
  - 지연 건수 알림
- **권한**: 관할 시도 내 모든 일정 수정 및 재배정 가능

#### 4.4 중앙 관리자
- **기본 뷰**: 전국 장비
- **분석 기능**:
  - 지역별 점검률 비교
  - 인력 효율성 분석
  - 우선순위 조정 권한
- **권한**: 모든 일정 수정 및 관리

### 5. 구현 순서 (예상)

#### Phase 1: 기본 필터링
1. schedules 테이블 상태 관리 강화
2. 우선순위 페이지에서 일정 추가된 장비 제외
3. 현장점검 페이지에서 일정 장비만 표시

#### Phase 2: 인력 관리
1. staff_schedules 테이블 생성
2. 가용성 입력 UI 구현
3. 수동 인력 배정 기능

#### Phase 3: 자동화
1. 우선순위 알고리즘 구현
2. 자동 일정 생성 기능
3. 자동 인력 배정 알고리즘

#### Phase 4: 고도화
1. 역할별 필터링 세분화
2. 대시보드 및 분석 기능
3. 최적화 및 성능 개선

### 6. 예상 기술 스택

- **프론트엔드**:
  - 캘린더 UI: `react-big-calendar` 또는 `fullcalendar`
  - 드래그 앤 드롭: `react-beautiful-dnd`
  - 지도 시각화: Kakao Maps API (이동 거리 계산)

- **백엔드**:
  - 스케줄링 로직: PostgreSQL Stored Procedures
  - 실시간 업데이트: Supabase Realtime
  - 부하 분산: Custom algorithm in RPC function

- **알림**:
  - 배정 알림: notifications 테이블 활용
  - 긴급 알림: 카카오톡 알림톡 (선택사항)

### 7. 주의사항

- 자동 배정 로직은 **반드시 관리자 승인** 후 확정
- 인력 과부하 방지를 위한 **최대 건수 제한** 필수
- 긴급 상황 시 **수동 재배정** 기능 보장
- 개인정보(근무일정) 접근 권한 **RLS 정책** 강화 필요
