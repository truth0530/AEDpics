# 📚 Supabase 데이터베이스 통합 관리

## 🗂️ 폴더 구조

```
supabase/
├── README.md                    # 현재 문서 (통합 가이드)
├── migrations/                  # SQL 마이그레이션 파일 (순서대로 실행)
│   ├── 01_initial_schema.sql   # 기본 테이블 생성
│   ├── 02_initial_data.sql     # 초기 데이터 입력
│   ├── 03_rls_policies.sql     # RLS 보안 정책
│   └── 04_aed_tables.sql       # AED 업무 테이블
└── seed/                        # 테스트 데이터 (선택사항)
    └── sample_data.sql          # 샘플 AED 데이터
```

## 🚀 빠른 시작 가이드

### 1단계: Supabase Dashboard 접속
```
https://supabase.com/dashboard/project/aieltmidsagiobpuebvv
```

### 2단계: SQL Editor에서 순서대로 실행
1. `01_initial_schema.sql` - 기본 구조
2. `02_initial_data.sql` - 조직 데이터
3. `03_rls_policies.sql` - 보안 설정
4. `04_aed_tables.sql` - 업무 테이블
5. `05_team_management.sql` - 팀 관리 시스템 (NEW)
6. `create_gps_issues_table.sql` - GPS 이상 탐지 테이블 (NEW)

> 함수 정의를 최신 상태로 맞춰야 할 때는 `supabase/fix_rpc_type_mismatch.sql`을 실행하거나, 필요한 경우 커서 기반 함수 스크립트(`supabase/create_cursor_based_aed_functions.sql`)를 추가로 적용하세요. (CLI 사용 시 `SUPABASE_DB_URL` 환경변수가 필요합니다.)

### 3단계: Master 계정 권한 확인
```sql
-- truth0530@nmc.or.kr 권한 확인
SELECT * FROM user_profiles WHERE email = 'truth0530@nmc.or.kr';
```

## 📊 데이터베이스 구조

### 핵심 테이블 (11개)
| 테이블명 | 용도 | 레코드 수 | 상태 |
|---------|------|-----------|------|
| **기본 테이블** |
| organizations | 조직 계층 구조 | 19개 | ✅ 구현 |
| user_profiles | 사용자 프로필 | 가변 | ✅ 구현 |
| aed_data | AED 장치 정보 | 81,331개 | ✅ 구현 |
|  | - region_code/city_code: 물리적 위치 | | |
|  | - jurisdiction_health_center: 관할보건소 | | |
| inspections | 점검 기록 | 0개 | ✅ 구현 |
| **팀 관리 테이블 (NEW)** |
| team_members | 팀 구성원 관리 | 가변 | 🆕 신규 |
| team_permissions | 팀원 세부 권한 | 가변 | 🆕 신규 |
| task_assignments | 업무 할당 | 가변 | 🆕 신규 |
| inspection_schedules | 점검 일정 계획 | 가변 | 🆕 신규 |
| schedule_instances | 실제 생성 일정 | 가변 | 🆕 신규 |
| team_activity_logs | 팀 활동 기록 | 가변 | 🆕 신규 |
| **GPS 분석 테이블 (NEW)** |
| gps_issues | GPS 이상 데이터 | 가변 | 🆕 신규 |
| gps_analysis_logs | GPS 분석 실행 로그 | 가변 | 🆕 신규 |

### 실제 데이터 규모 (전국 AED 현황)
- **총 AED 대수**: Supabase aed_data 테이블 실제 레코드 수
- **지역별 분포**: 
  - 경기도: 15,177대 (18.7%)
  - 서울특별시: 14,102대 (17.3%)
  - 부산광역시: 6,089대 (7.5%)
  - 경상남도: 5,655대 (7.0%)
  - 인천광역시: 4,953대 (6.1%)
  - 대구광역시: 4,619대 (5.7%)
  - 경상북도: 4,424대 (5.4%)
  - 대전광역시: 3,644대 (4.5%)
  - 전라남도: 3,614대 (4.4%)
  - 충청남도: 3,566대 (4.4%)
  - 강원도: 3,473대 (4.3%)
  - 전라북도: 3,318대 (4.1%)
  - 충청북도: 2,867대 (3.5%)
  - 광주광역시: 2,512대 (3.1%)
  - 울산광역시: 1,822대 (2.2%)
  - 제주특별자치도: 1,344대 (1.7%)
  - 세종특별자치시: 852대 (1.0%)
- **카테고리별 분포**:
  - 다중이용시설: 38,910대
  - 의료기관: 28,468대  
  - 교육기관: 7,948대
  - 보건의료기관: 5,123대
  - 기타: 882대

### 보안 정책 (RLS)
- ✅ 조직 정보: 공개 조회, 관리자만 수정
- ✅ 사용자 프로필: 본인/관리자 접근
- ✅ AED 장치: 공개 조회, 담당자 수정
- ✅ 점검 기록: 작성자/관리자 접근
- 🆕 팀원 관리: 조직 관리자만 접근
- 🆕 업무 할당: 담당자/관리자 접근
- 🆕 일정 관리: 조직 구성원 조회, 관리자 수정

## 📋 TODO 리스트 (우선순위)

### 🔴 즉시 필요 (오늘)
- [ ] Supabase Dashboard에서 migration 파일 실행
- [ ] Master 계정 (truth0530@nmc.or.kr) 권한 확인
- [ ] 다른 2개 Master 계정 가입 후 권한 부여

### 🟡 이번 주 완료
- [ ] AED 샘플 데이터 입력 (최소 10개)
- [ ] 점검 기능 테스트
- [ ] 보건소 조직 데이터 추가 (서울 25개구)

### 🟢 다음 주 계획
- [ ] 점검 일정 테이블 추가
- [ ] 알림 시스템 구현
- [ ] 통계 뷰 생성

## 🔧 유용한 SQL 명령어

### 테이블 확인
```sql
-- 모든 테이블 목록
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles';
```

### 권한 관리
```sql
-- Master 권한 부여
UPDATE user_profiles
SET role = 'master', can_approve_users = true
WHERE email IN ('inhak@nmc.or.kr', 'woo@nmc.or.kr');

-- 사용자 승인
UPDATE user_profiles
SET role = 'local_admin', is_active = true
WHERE email = 'user@korea.kr';
```

### 팀 관리 (NEW)
```sql
-- 팀원 추가
INSERT INTO team_members (organization_id, name, email, member_type, added_by)
VALUES (
    (SELECT id FROM organizations WHERE name = '강남구보건소'),
    '홍길동',
    'hong@example.com',
    'temporary',
    auth.uid()
);

-- 업무 할당
INSERT INTO task_assignments (
    organization_id, task_type, title, 
    assigned_to, assigned_by, scheduled_date
)
VALUES (
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid()),
    'inspection',
    '3층 AED 월간 점검',
    (SELECT id FROM team_members WHERE email = 'hong@example.com'),
    auth.uid(),
    CURRENT_DATE + INTERVAL '7 days'
);

-- 팀원별 할당된 업무 조회
SELECT 
    tm.name as inspector_name,
    ta.title as task_title,
    ta.scheduled_date,
    ta.status
FROM task_assignments ta
JOIN team_members tm ON ta.assigned_to = tm.id
WHERE ta.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
AND ta.status != 'completed'
ORDER BY ta.scheduled_date;
```

### 데이터 조회
```sql
-- 조직별 사용자 수
SELECT o.name, COUNT(up.id) as user_count
FROM organizations o
LEFT JOIN user_profiles up ON o.id = up.organization_id
GROUP BY o.id, o.name;

-- 만료 임박 AED
SELECT * FROM aed_data
WHERE battery_expiry_date < CURRENT_DATE + INTERVAL '30 days'
OR pad_adult_expiry_date < CURRENT_DATE + INTERVAL '30 days';
```

## 📈 프로젝트 진행 상황

### Phase 1: 기반 구축 ✅ (90% 완료)
- [x] 프로젝트 초기화
- [x] Supabase 연동
- [x] 인증 시스템
- [x] 기본 테이블 설계
- [ ] Master 계정 3개 활성화 (1/3)

### Phase 2: 핵심 기능 🔄 (30% 진행)
- [x] 데이터베이스 스키마
- [x] RLS 정책
- [ ] AED 관리 UI
- [ ] 점검 기능 구현
- [ ] 보고서 생성

### Phase 3: 고도화 📅 (예정)
- [ ] PWA 모바일 앱
- [ ] 오프라인 동기화
- [ ] e-gen 연동
- [ ] AI 분석 기능

## 🐛 트러블슈팅

### 문제: RLS 정책으로 데이터 안 보임
```sql
-- RLS 임시 비활성화 (개발용)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- 테스트 후 다시 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

### 문제: Migration 실행 오류
- 순서대로 실행했는지 확인
- 이미 존재하는 테이블은 DROP 후 재실행
- auth.users 테이블 확인 (Supabase Auth 활성화 필요)

### 문제: Master 권한 안됨
```sql
-- 강제 권한 부여
UPDATE user_profiles
SET role = 'master', 
    can_approve_users = true,
    can_export_data = true,
    is_active = true
WHERE email = 'truth0530@nmc.or.kr';
```

## 📞 지원 연락처

- **기술 문의**: Supabase Dashboard > Support
- **프로젝트 ID**: aieltmidsagiobpuebvv
- **프로젝트명**: aed.pics
- **Region**: Seoul (ap-northeast-2)

---

최종 업데이트: 2025-10-14 KST
