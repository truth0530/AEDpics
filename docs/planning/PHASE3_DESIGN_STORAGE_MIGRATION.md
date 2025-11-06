# Phase 3: 사진 스토리지 마이그레이션 설계

**상태**: 설계 중 (상세 기술 검토 필요)
**시작일**: 2025-11-07
**완료 예상일**: 2025-11-09
**담당**: 개발팀 (Infra/Storage)

---

## 1. 목표

Supabase Storage에서 NCP Object Storage로 마이그레이션하여:
- 국정원 인증 요구사항 충족 (NCP 독점 사용)
- 스토리지 비용 최적화 (Supabase → NCP)
- 데이터 무결성 보장 (무손실 마이그레이션)
- 서비스 가용성 유지 (0 downtime 목표)

---

## 2. 현황 분석

### 2.1 Supabase Storage 현황

```
저장 위치: Supabase 서울 리전 (sg-east-1)
저장 대상: AED 점검 사진
예상 데이터량: 160MB (현재)
실제 파일 수: 약 81,464건 (AED 당 평균 2-3장)

계산 근거:
- 현재 점검 수: 약 32건 (확정)
- 점검당 사진: 평균 3장
- 점검 미실시: 약 81,432건 (미촬영)
- 총 점검 가능: 81,464건 × 3장 = 244,392장 (최대)

현재 예상:
- 저장된 사진: 약 100-150건 (점검 32건 기준)
- 저장 용량: 약 50-100MB (최대 160MB 추정)

비용 (Supabase):
- 저장소: 1GB 포함 (초과시 $0.25/GB)
- 다운로드: 무제한 (초과시 $0.05/GB)
- 월 예상: $0 (1GB 이내)
```

**데이터 구조**:
```typescript
// inspections 테이블
{
  id: UUID,
  aed_data_id: BIGINT,
  photos: String[]  // Supabase Storage URL 배열
  // 예: [
  //   "https://supabase.example.com/storage/v1/object/public/aed-photos/2025-11-07/photo1.webp",
  //   "https://supabase.example.com/storage/v1/object/public/aed-photos/2025-11-07/photo2.webp"
  // ]
}
```

### 2.2 NCP Object Storage 목표 구조

```
저장 위치: NCP Object Storage (kr-central-2, 한국 서울)
버킷명: aedpics-storage (또는 aedpics-photos)
접근 제어: Private (CloudFront CDN을 통한 공개)
예상 비용: 월 $5-15 (160MB 기준)

저장 경로 구조:
/aedpics-storage/
├── aed-photos/          # AED 점검 사진
│   ├── 2025-11-07/
│   │   ├── inspection-{inspection_id}-photo-1.webp
│   │   ├── inspection-{inspection_id}-photo-2.webp
│   │   └── inspection-{inspection_id}-photo-3.webp
│   └── [년월일]/
├── backups/             # 마이그레이션 백업
│   └── supabase-backup-2025-11-10.tar.gz
└── temp/                # 임시 파일 (마이그레이션용)
    └── [중간 결과]
```

---

## 3. 데이터 분석

### 3.1 사진 포맷 및 크기

```
현재 형식 (Supabase에서 생성):
- 포맷: WebP (Sharp 이미지 최적화)
- 해상도: 최대 1280x1280px
- 압축: quality 55 (aggressive)
- 크기: 약 70-150KB per image

예상 평균:
- 단일 사진: 100KB
- 점검당 사진 3장: 300KB
- 총 점검 (100건 기준): 30MB

최대 시나리오:
- 81,464건 × 3장 × 100KB = 24.4GB
- 현실적 예상: 5-10GB (5년 운영 기준)
```

### 3.2 메타데이터 추적

```sql
-- 마이그레이션 추적용 테이블 (선택사항)
CREATE TABLE storage_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id BIGINT,
  photo_index INTEGER,

  -- Supabase 정보
  supabase_url VARCHAR(500),
  supabase_bucket VARCHAR(100),
  supabase_path VARCHAR(300),
  supabase_file_size BIGINT,

  -- NCP 정보
  ncp_bucket VARCHAR(100),
  ncp_object_key VARCHAR(300),
  ncp_object_url VARCHAR(500),

  -- 마이그레이션 상태
  status VARCHAR(20),  -- pending, migrated, verified, failed, rollback
  migrated_at TIMESTAMP,
  verified_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_migration_status ON storage_migration_log(status);
CREATE INDEX idx_migration_inspection ON storage_migration_log(inspection_id);
```

---

## 4. 마이그레이션 전략

### 4.1 Phase 1: 준비 단계 (2025-11-10 ~ 11-12)

#### 1.1 NCP 리소스 생성
```bash
# NCP 콘솔 또는 API로 실행
ncp-create-bucket:
  bucket_name: aedpics-storage
  region: kr-central-2
  acl: PRIVATE
  versioning: ENABLED  # 실수 복구용

ncp-configure-cors:
  allowed_origins: ['https://aed.pics', 'http://localhost:3001']
  allowed_methods: ['GET', 'PUT', 'DELETE']
  allowed_headers: ['*']
  max_age: 3600

ncp-setup-cdn:
  origin: aedpics-storage
  path: /aed-photos/*
  cache_ttl: 86400  # 24시간
```

**체크리스트**:
- [ ] NCP 콘솔에서 버킷 생성 확인
- [ ] CORS 설정 적용
- [ ] CDN 도메인 구성 (예: cdn.aedpics.ncp.com)
- [ ] SSL/TLS 인증서 설정
- [ ] 접근 권한 테스트 (PUT/GET/DELETE)

#### 1.2 마이그레이션 스크립트 개발
```typescript
// scripts/migrate-storage.ts
interface MigrationConfig {
  batchSize: number;      // 10
  retryAttempts: number;  // 3
  retryDelayMs: number;   // 1000
  verifyChecksum: boolean;  // true
  dryRun: boolean;        // true (기본값)
}

interface SupabaseSource {
  url: string;
  bucket: string;
  apiKey: string;
  serviceRoleKey: string;
}

interface NCPTarget {
  accessKey: string;
  accessSecret: string;
  bucket: string;
  region: string;
  endpoint: string;
}

export async function migrateStorage(
  source: SupabaseSource,
  target: NCPTarget,
  config: MigrationConfig
): Promise<MigrationResult>

// 기본 동작:
// 1. 소스(Supabase) 열거
// 2. 각 파일 다운로드 + 메타데이터 추출
// 3. NCP에 업로드
// 4. 체크섬 검증 (BLAKE3)
// 5. 로그 기록
// 6. (최종) DB URL 업데이트
```

**체크리스트**:
- [ ] 마이그레이션 스크립트 작성
- [ ] Dry-run 모드 테스트 (실제 이동 없음)
- [ ] 에러 처리 및 롤백 로직 구현
- [ ] 진행률 리포팅 (예: 100/1000 files completed)

#### 1.3 백업 전략
```bash
# Supabase 전체 내보내기 (타이머 시작 전)
gsutil -m cp -r gs://supabase-bucket/aed-photos \
  gs://backup-bucket/supabase-backup-2025-11-10/

# NCP 스냅샷 생성 (마이그레이션 완료 후)
ncp-create-snapshot:
  bucket: aedpics-storage
  name: backup-2025-11-10-post-migration
```

---

### 4.2 Phase 2: 병렬 운영 (2025-11-13 ~ 11-20) - 1주일

**목표**: 기존 데이터는 NCP에서, 신규 데이터는 NCP에서만 저장

#### 2.1 애플리케이션 수정
```typescript
// lib/utils/photo-upload.ts (현재 상태)
// ❌ Supabase만 사용 (비활성화됨)

// 목표 상태: 듀얼 모드
export async function uploadPhotoToStorage(
  file: File,
  inspectionId: string
): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `inspection-${inspectionId}-photo-${Date.now()}.webp`;

  // 신규 업로드 → NCP Object Storage만 사용
  const ncpUrl = await uploadToNCP(file, `aed-photos/${timestamp}/${filename}`);

  // 병렬 운영 기간: Supabase 업로드 동시 실행 (차후 비활성화)
  // await uploadToSupabase(file, filename);  // 선택사항

  return ncpUrl;  // NCP URL 반환
}

// 조회 로직: 듀얼 소스 지원
export async function getPhotoUrl(
  inspectionId: string,
  photoIndex: number
): Promise<string> {
  // 1. NCP에서 먼저 확인
  const ncpUrl = await getPhotoFromNCP(inspectionId, photoIndex);
  if (ncpUrl) return ncpUrl;

  // 2. NCP에 없으면 Supabase 폴백
  const supabaseUrl = await getPhotoFromSupabase(inspectionId, photoIndex);
  if (supabaseUrl) {
    // 백그라운드: NCP로 마이그레이션
    await migratePhotoToNCP(supabaseUrl, inspectionId, photoIndex);
    return supabaseUrl;  // 즉시 반환
  }

  return null;
}

// 삭제 로직: 양쪽 모두 삭제
export async function deletePhotoFromStorage(
  inspectionId: string,
  photoIndex: number
): Promise<void> {
  const ncpUrl = await getPhotoFromNCP(inspectionId, photoIndex);
  const supabaseUrl = await getPhotoFromSupabase(inspectionId, photoIndex);

  if (ncpUrl) await deleteFromNCP(inspectionId, photoIndex);
  if (supabaseUrl) await deleteFromSupabase(inspectionId, photoIndex);
}
```

**체크리스트**:
- [ ] 듀얼 소스 코드 작성
- [ ] NCP 접근 함수 구현 (uploadToNCP, getPhotoFromNCP 등)
- [ ] 폴백 로직 테스트
- [ ] 백그라운드 마이그레이션 트리거 구현

#### 2.2 마이그레이션 실행
```bash
# 1차 배치 마이그레이션 (이미 저장된 모든 사진)
npm run migrate:storage -- \
  --source supabase \
  --target ncp \
  --batch-size 10 \
  --dry-run false \
  --verify true

# 출력 예:
# ✅ Migrated 50/150 files (33%)
# ✅ Average time: 2.3s per file
# ✅ All checksums verified
```

**체크리스트**:
- [ ] 배치 마이그레이션 실행
- [ ] 진행률 모니터링 (콘솔 + 로그)
- [ ] 실패 파일 재처리 (재시도 로직)
- [ ] 최종 검증 (Supabase vs NCP 파일 수 비교)

#### 2.3 검증 절차
```typescript
// scripts/verify-storage-migration.ts
async function verifyMigration() {
  // 1. 파일 수 비교
  const supabaseCount = await countFilesInSupabase();
  const ncpCount = await countFilesInNCP();
  console.log(`Supabase: ${supabaseCount}, NCP: ${ncpCount}`);

  if (ncpCount < supabaseCount * 0.95) {
    throw new Error('Migration incomplete: 95% threshold not met');
  }

  // 2. 샘플 검증 (처음 10개, 마지막 10개, 랜덤 10개)
  const samples = [
    ...getFirstFiles(10),
    ...getLastFiles(10),
    ...getRandomFiles(10)
  ];

  for (const file of samples) {
    const checksum1 = await checksumFile(supabaseUrl);
    const checksum2 = await checksumFile(ncpUrl);

    if (checksum1 !== checksum2) {
      throw new Error(`Checksum mismatch for ${file}`);
    }
  }

  // 3. 접근 성능 테스트
  const startTime = Date.now();
  await fetch(ncpUrl);
  const latency = Date.now() - startTime;

  if (latency > 1000) {
    console.warn(`⚠️  High latency: ${latency}ms`);
  }

  console.log('✅ Migration verification passed');
  return true;
}
```

**체크리스트**:
- [ ] 파일 수 검증 (95% 이상)
- [ ] 샘플 체크섬 검증 (처음/끝/랜덤 각 10개)
- [ ] 접근 성능 테스트 (<1s)
- [ ] CDN 캐싱 확인

#### 2.4 병렬 운영 모니터링
```yaml
# 시스템 메트릭 (매 6시간 확인)
- [ ] NCP 스토리지 사용량 증가 (기대값: 150MB)
- [ ] CDN 히트율 (목표: >90%)
- [ ] 애플리케이션 에러 로그 (Supabase/NCP 모두)
- [ ] 사용자 보고 (느린 로딩 등)

# 일일 체크리스트 (1주)
Mon 11-13: 듀얼 모드 배포 + 모니터링 시작
Tue-Thu: 6시간마다 메트릭 확인
Fri 11-15: 이상 없음 확인, 최종 준비
```

---

### 4.3 Phase 3: 최종 단절 (2025-11-20)

#### 3.1 Supabase 비활성화
```typescript
// lib/utils/photo-upload.ts (최종 상태)
export async function uploadPhotoToStorage(
  file: File,
  inspectionId: string
): Promise<string> {
  // Supabase 완전 제거
  return await uploadToNCP(file, `aed-photos/${timestamp}/${filename}`);
}

export async function getPhotoUrl(
  inspectionId: string,
  photoIndex: number
): Promise<string> {
  // NCP만 사용 (Supabase 폴백 제거)
  return await getPhotoFromNCP(inspectionId, photoIndex);
}
```

**체크리스트**:
- [ ] Supabase 참조 코드 모두 제거
- [ ] NCP 단일 스토리지로 변경
- [ ] 배포 및 smoke test 실행
- [ ] Supabase 계정 비활성화 (또는 기타 용도 검토)

#### 3.2 아카이빙
```bash
# Supabase 최종 백업
gsutil -m cp -r gs://supabase-bucket/aed-photos \
  gs://archive-bucket/supabase-photos-archive-2025-11-20/

# NCP 스냅샷 생성
ncp-create-snapshot:
  bucket: aedpics-storage
  name: post-migration-snapshot-2025-11-20
  retention: 90days
```

---

## 5. 오류 처리 및 롤백 전략

### 5.1 마이그레이션 중 오류 처리

```typescript
enum MigrationError {
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  TARGET_WRITE_FAILED = 'TARGET_WRITE_FAILED',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

async function handleMigrationError(
  file: string,
  error: MigrationError,
  context: MigrationContext
) {
  switch (error) {
    case MigrationError.SOURCE_NOT_FOUND:
      // 로그: 원본 파일 누락 (이미 삭제됨)
      // 대응: 다음 파일로 진행
      logger.warn(`Source not found: ${file}`);
      context.skippedFiles++;
      break;

    case MigrationError.TARGET_WRITE_FAILED:
      // NCP 쓰기 실패
      // 대응: 재시도 (지수 백오프)
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          await uploadToNCP(file);
          return;
        } catch (e) {
          await delay(Math.pow(2, i) * 1000);
        }
      }
      // 모든 재시도 실패 → 오류 기록
      context.failedFiles.push(file);
      break;

    case MigrationError.CHECKSUM_MISMATCH:
      // 무결성 검증 실패
      // 대응: 긴급 중단 (데이터 손상 위험)
      throw new Error(`Data integrity failed for ${file}`);

    case MigrationError.TIMEOUT:
      // 네트워크 타임아웃
      // 대응: 재시도 (최대 3회)
      context.retriedFiles++;
      await migrateFile(file, context);
      break;

    case MigrationError.QUOTA_EXCEEDED:
      // NCP 스토리지 용량 초과
      // 대응: 긴급 중단 (용량 추가 필요)
      throw new Error('NCP quota exceeded');
  }
}
```

### 5.2 롤백 전략

```typescript
interface RollbackPoint {
  timestamp: Date;
  totalMigrated: number;
  lastSuccessfulFile: string;
  snapshotId: string;
}

async function createRollbackPoint(): Promise<RollbackPoint> {
  // 1. 현재 상태 저장
  const snapshot = await ncp.createSnapshot('aedpics-storage');

  // 2. 메타데이터 저장
  const rollbackData = {
    timestamp: new Date(),
    totalMigrated: await countMigratedFiles(),
    lastSuccessfulFile: getLastProcessedFile(),
    snapshotId: snapshot.id
  };

  // 3. 데이터베이스에 기록
  await saveRollbackPoint(rollbackData);

  return rollbackData;
}

async function rollbackToPoint(point: RollbackPoint) {
  // 1. NCP 스냅샷 복구
  await ncp.restoreSnapshot(point.snapshotId);

  // 2. 애플리케이션 상태 복구
  //    (듀얼 모드 유지, 부분 마이그레이션 재개)

  // 3. 검증
  const fileCount = await countFilesInNCP();
  if (fileCount !== point.totalMigrated) {
    throw new Error('Rollback verification failed');
  }

  logger.info(`Rollback successful to ${point.timestamp}`);
}
```

---

## 6. 성능 고려사항

### 6.1 마이그레이션 속도 최적화

```
배치 크기: 10 (동시 업로드)
타임아웃: 30초 (per file)
재시도: 3회 (지수 백오프)

처리량 계산:
- 단일 파일: ~1-2초 (평균)
- 배치 10개: ~10초 (병렬 처리)
- 150개 파일: ~150초 (2.5분)
- 1,000개 파일: ~1,000초 (16분)

최적화:
- 멀티스레드: Node.js cluster 활용
- 네트워크: 서버에서 NCP로 직접 전송 (로컬 다운로드 제거)
- 압축: 이미 WebP 압축됨 (추가 압축 불필요)
```

### 6.2 프로덕션 영향 최소화

```
마이그레이션 실행 시점: 새벽 2-4시 (사용량 최소)
병렬 운영: 사용자 동시 업로드 영향 없음
네트워크: 데이터센터 내 전송 (NCP로 이전 후)
```

---

## 7. 비용 분석

### 7.1 현재 비용 (Supabase)

```
저장소: 1GB 무료 (초과시 $0.25/GB)
대역폭: 무료 (초과시 $0.05/GB)
현재 월 비용: $0
```

### 7.2 목표 비용 (NCP)

```
저장소 (160MB): $0.02/월 (약 300원)
대역폭 (10GB/월): $0.50 (약 7,500원)
CDN (10GB/월): $0.30 (약 4,500원)
총 월 비용: ~$0.82 (약 12,000원)

예상:
- 저장 비용: $0.02~0.05
- 대역폭 비용: $0.50~1.00 (사용량 증가 시)
- 총: $0.70~1.50/월 (약 10,000~20,000원)
```

### 7.3 비용 비교

| 항목 | Supabase | NCP | 절감 |
|------|----------|-----|------|
| 월 비용 | $0 (1GB 이내) | $0.70-1.50 | -$0.70~1.50 |
| 데이터 잠금 | 높음 (API 종속) | 낮음 (표준 S3) | + |
| 국정원 인증 | 불가능 | 가능 | + |
| CDN 포함 | 아니오 | 선택사항 | + |

**결론**: 비용 증가는 미미하지만 국정원 인증 충족 및 데이터 독립성 확보

---

## 8. 구현 계획

### 8.1 개발 일정 (1주)

```
Mon 11-10: 마이그레이션 스크립트 개발 + 테스트
Tue 11-11: NCP 버킷 생성 + 듀얼 모드 코드 작성
Wed 11-12: 배치 마이그레이션 실행 + 검증
Thu 11-13: 병렬 운영 시작 + 모니터링
Fri 11-14: 최종 검증 및 Supabase 비활성화 준비
```

### 8.2 필요한 리소스

| 리소스 | 담당 | 예상 시간 |
|--------|------|---------|
| NCP 버킷 설정 | Infra | 1시간 |
| 마이그레이션 스크립트 | Backend | 4시간 |
| 듀얼 모드 코드 수정 | Backend | 2시간 |
| 검증 테스트 | QA | 2시간 |
| 모니터링 | Ops | 진행 중 |
| 롤백 준비 | DevOps | 1시간 |

**총 예상**: 약 11시간 개발 + 1주 병렬 운영

---

## 9. 위험 분석

| # | 위험 | 확률 | 영향 | 완화 방안 |
|---|------|------|------|---------|
| 1 | NCP 버킷 생성 지연 | 낮음 | 높음 | 조기 신청 (이번주) |
| 2 | 마이그레이션 중 데이터 손실 | 매우낮음 | 매우높음 | 체크섬 검증 + 백업 |
| 3 | Supabase 다운 (마이그레이션 중) | 낮음 | 높음 | 배치 재시도 로직 |
| 4 | NCP 쓰기 한계 (대량 동시 업로드) | 낮음 | 중간 | 배치 크기 조정 (10→5) |
| 5 | CDN 캐싱 문제 (구 URL 제공) | 중간 | 낮음 | URL 변경 사전 공지 |
| 6 | 사용자 컴플레인 (로딩 느림) | 낮음 | 낮음 | CDN 성능 모니터링 |
| 7 | Supabase 환경변수 제거 실수 | 낮음 | 높음 | 코드 리뷰 + 테스트 |
| 8 | 데이터베이스 URL 업데이트 누락 | 낮음 | 높음 | 배포 체크리스트 |
| 9 | 롤백 스냅샷 손상 | 매우낮음 | 매우높음 | 이중 백업 (2개 이상) |

**우선순위**:
1. 데이터 손실 방지 (위험 2, 9)
2. 마이그레이션 안정성 (위험 3, 4, 7)
3. 성능 모니터링 (위험 6)

---

## 10. 마이그레이션 후 검토

### 10.1 성공 기준

- [ ] 모든 파일 마이그레이션 완료 (100%)
- [ ] 체크섬 검증 통과 (100%)
- [ ] CDN 캐싱 효과 확인 (>90% 히트율)
- [ ] 사용자 보고 0건 (1주)
- [ ] 애플리케이션 에러 0건 (저장소 관련)

### 10.2 최적화 기회

```
향후 개선 계획:
- [ ] 이미지 자동 썸네일 생성 (CDN)
- [ ] 배치 다운로드 API (여러 사진 한 번에)
- [ ] 사진 메타데이터 추출 (촬영 시간, 위치 등)
- [ ] 자동 백업 정책 (일주일 단위)
- [ ] 접근 분석 (가장 인기 있는 지역/시간)
```

---

## 11. 진행 상황 추적

### 11.1 현재 상태 (2025-11-07)

```
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 5% - 설계 중
```

### 11.2 다음 단계

- [ ] NCP 팀과 협의 (Wed-Thu 11-10 또는 11-11)
  - 버킷 생성 가능 여부
  - CDN 설정 옵션
  - 가격 확정
- [ ] 마이그레이션 스크립트 개발 (Mon-Tue 11-10~11)
- [ ] 배치 테스트 (Wed 11-12, 50개 파일)
- [ ] 병렬 운영 시작 (Thu 11-13)

---

## 12. TBD (협의 필요)

```
[ ] NCP Object Storage 최종 가격 확인
[ ] CDN 도메인 설정 (dns.aedpics.ncp.com)
[ ] CORS 정책 (어떤 도메인 허용?)
[ ] 접근 제어 (public vs private)
[ ] 버저닝 정책 (파일 덮어쓰기 방지?)
[ ] 보관 정책 (삭제된 사진 보관 기간?)
```

---

**문서 버전**: 1.0.0
**상태**: Draft (NCP 협의 대기)
**다음 검토**: 2025-11-09 (NCP 협의 후)
**담당자**: 개발팀 (Infra)

