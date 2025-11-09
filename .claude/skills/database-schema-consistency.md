# Database Schema Consistency Skill

## 목적
Prisma 스키마와 실제 NCP PostgreSQL 데이터베이스 구조의 동기화 상태를 검증하고, 데이터 무결성 문제를 조기 발견합니다.

## 개요
이 Skill은 마이그레이션 적용 전후, 정기적인 DB 점검 시 다음을 자동으로 검증합니다:
- Prisma 스키마 vs 실제 테이블 구조
- Enum 타입 일치도
- Foreign Key 관계 정합성
- NULL 제약 조건 검증
- 인덱스 최적화 제안
- 타입 호환성

## 실행 방법

### 1단계: Prisma 스키마 검증
```bash
# Prisma 클라이언트 재생성
npx prisma generate

# 마이그레이션 상태 확인
npx prisma migrate status

# 스키마 누적 변경사항 확인
npx prisma diff --from-schema-datasource prisma/schema.prisma --to-schema-file prisma/schema.prisma
```

### 2단계: 실제 DB 구조 점검
```bash
# PostgreSQL에 직접 접속
PGPASSWORD="[PASSWORD]" psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production

# 스키마 내 테이블 목록 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'aedpics'
ORDER BY table_name;

# 테이블 구조 확인 (예: user_profiles)
\d aedpics.user_profiles
```

### 3단계: Enum 타입 검증
```bash
# 실제 Enum 값 확인
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

# 모든 Enum 타입 목록
SELECT DISTINCT t.typname
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'aedpics')
ORDER BY t.typname;
```

### 4단계: Foreign Key 검증
```bash
# 모든 Foreign Key 확인
SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'aedpics'
  AND referenced_table_name IS NOT NULL
ORDER BY table_name;

# 특정 테이블의 Foreign Key
\d aedpics.inspections
```

### 5단계: NULL 제약 조건 검증
```bash
# 모든 NOT NULL 제약 조건 확인
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'aedpics'
  AND is_nullable = 'NO'
ORDER BY table_name, ordinal_position;
```

### 6단계: 인덱스 최적화 확인
```bash
# 생성된 인덱스 목록
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'aedpics'
ORDER BY tablename, indexname;

# 사용되지 않는 인덱스 찾기
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'aedpics'
  AND idx_scan = 0
ORDER BY tablename;
```

## 검증 체크리스트

### 필수 검증 항목

#### A. Prisma 스키마 무결성 (Priority 1)
- [ ] `npx prisma generate` 성공 (0 에러)
- [ ] `npx prisma migrate status`에서 pending migration 없음
- [ ] 모든 model 정의가 유효한가?
- [ ] 모든 relation이 양쪽에서 정의되었는가?
- [ ] 모든 @unique 제약이 명시되었는가?

#### B. 테이블 구조 일치도 (Priority 1)
- [ ] Prisma model 개수 == 실제 테이블 개수 (23개)
- [ ] 각 테이블의 칼럼명이 일치하는가?
- [ ] 각 칼럼의 데이터 타입이 일치하는가?
- [ ] Serial/Auto-increment 설정이 일치하는가?
- [ ] Default 값 설정이 일치하는가?

#### C. Enum 타입 검증 (Priority 1)
- [ ] Prisma enum 타입이 DB에 존재하는가?
- [ ] enum의 모든 값이 DB 타입과 일치하는가?
- [ ] 각 enum을 사용하는 칼럼의 타입이 올바른가?
- [ ] 새로운 enum 값 추가 시 DB 반영되었는가?

**현재 프로젝트의 주요 Enum (25개)**:
```
user_role, account_status, approval_status, assignment_status,
inspection_status, schedule_type, session_status, device_status,
issue_severity, notification_type, activity_type, team_role,
permission_group, aed_status, inspection_result, storage_check_status,
battery_status, pad_status, operation_status, overall_status,
visual_status, response_status, task_status, audit_action,
email_template_type
```

#### D. Foreign Key 정합성 (Priority 2)
- [ ] Prisma @relation이 FK와 일치하는가?
- [ ] 모든 FK의 대상 테이블이 존재하는가?
- [ ] 모든 FK의 대상 칼럼(보통 id)이 존재하는가?
- [ ] ON DELETE 정책이 명시되었는가? (CASCADE/RESTRICT/SET NULL)
- [ ] 순환 FK가 없는가? (circular dependency)

#### E. NULL 제약 조건 (Priority 2)
- [ ] Prisma @db.Text vs TEXT? 형태 확인
- [ ] 필수 필드(user_id, role 등)가 NOT NULL인가?
- [ ] Optional 필드가 NULL 허용 설정인가?
- [ ] 기본값이 설정된 필드의 NOT NULL 설정이 맞는가?

#### F. 인덱스 최적화 (Priority 3)
- [ ] 자주 검색되는 필드(email, region_code)에 인덱스 있는가?
- [ ] FK 필드에 인덱스 있는가?
- [ ] 복합 인덱스가 효율적으로 설계되었는가?
- [ ] 사용되지 않는 인덱스가 없는가? (idx_scan = 0)

#### G. 타입 호환성 (Priority 2)
- [ ] JSON 필드가 JSONB로 저장되었는가? (성능)
- [ ] String 필드의 최대 길이 설정이 충분한가?
- [ ] DateTime 필드가 timestamptz인가? (timezone 지원)
- [ ] Decimal 필드의 정밀도가 설정되었는가?
- [ ] Boolean 필드가 boolean 타입인가?

#### H. Migration 상태 (Priority 1)
- [ ] 모든 pending migration이 적용되었는가?
- [ ] 마이그레이션 히스토리가 일관된가? (순서대로)
- [ ] 롤백이 필요한 마이그레이션은 없는가?
- [ ] 마이그레이션 파일이 git에 추적되었는가?

## 예상 결과 해석

### 성공 상태 (Green)
```
SUCCESS: All validations passed
- 23 tables matched ✓
- 25 enums validated ✓
- 47 foreign keys checked ✓
- All nullable constraints correct ✓
- No pending migrations ✓
- Schema synchronized ✓
```

### 경고 상태 (Yellow)
```
WARNING: Minor inconsistencies found
- 1 unused index detected (idx_old_field)
- 2 pending migrations (apply with: npx prisma migrate deploy)
- 3 enum values not in use (can be removed)

Action: Apply pending migrations and remove unused indexes
```

### 실패 상태 (Red)
```
ERROR: Critical schema inconsistencies
- Table 'inspections' missing from DB
- Enum 'user_role' has mismatched values
- Foreign key constraint violated
- 5 enum values exist in Prisma but not in DB

Action: Run 'npx prisma migrate deploy' or check database connection
```

## 자동화 스크립트

### 전체 검증 자동 실행
```typescript
// scripts/validate-db-schema.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

async function validateDatabaseSchema() {
  console.log('[DB Schema Consistency Check] Starting...\n');

  try {
    // Step 1: Prisma migration status
    console.log('Step 1: Checking migrations...');
    const { stdout: migStatus } = await execAsync('npx prisma migrate status');
    if (migStatus.includes('Pending')) {
      console.warn('WARNING: Pending migrations detected');
    }

    // Step 2: 실제 테이블 수 확인
    console.log('Step 2: Counting actual tables...');
    const tableQuery = `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'aedpics'`;
    // psql 실행...

    // Step 3: Enum 검증
    console.log('Step 3: Validating enums...');
    // 모든 enum 타입 확인...

    console.log('\n[DB Schema Consistency Check] Complete!');
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}
```

## 주의사항

### 데이터 손실 위험
- 마이그레이션 적용 전 반드시 백업 수행
- `npx prisma migrate deploy`는 프로덕션에서 신중하게 실행
- 데이터 삭제/변경하는 마이그레이션은 테스트 환경에서 먼저 검증

### 성능 영향
- 대용량 테이블의 마이그레이션은 높은 사용률 시간 회피
- 인덱스 생성은 시간이 소요될 수 있음 (오프피크 타임 권장)
- FK 추가는 기존 데이터 검증으로 인한 성능 저하 주의

### 운영 중 고려사항
- 스키마 변경은 애플리케이션 재시작 전에 완료
- Prisma 클라이언트 재생성 후 배포
- 외부 도구(DBeaver 등)에서 DB 수정하지 말 것 (Prisma와 불일치)

## 관련 파일

- Prisma 스키마: [prisma/schema.prisma](/prisma/schema.prisma)
- 마이그레이션 문서: [docs/migration/MIGRATION_STATUS.md](/docs/migration/MIGRATION_STATUS.md)
- 마이그레이션 설정: [docs/migration/PRISMA_MIGRATION_SETUP.md](/docs/migration/PRISMA_MIGRATION_SETUP.md)

## 추가 도움말

### PostgreSQL 상호작용 팁
```bash
# DB 접속 (일회용 명령)
PGPASSWORD="[PASSWORD]" psql -h [HOST] -U aedpics_admin -d aedpics_production -c "[SQL]"

# 인터랙티브 셸
PGPASSWORD="[PASSWORD]" psql -h [HOST] -U aedpics_admin -d aedpics_production

# 스키마에 접속
\c aedpics_production aedpics_admin
SET search_path = aedpics;

# 테이블 나열
\dt

# 테이블 구조
\d [table_name]

# Enum 타입 확인
\dT
```

### 자주 하는 실수
1. `npx prisma generate` 후 배포 안 함 → 클라이언트 코드 불일치
2. 마이그레이션 순서 변경 → 무결성 위반
3. 직접 SQL로 스키마 변경 → Prisma와 불일치
4. FK를 optional(`@relation?`)로 설정 후 데이터 로드 문제 발생

---

**마지막 업데이트**: 2025년 11월 9일
**버전**: 1.0
**관련 Skill**: region-data-validation, authorization-management
