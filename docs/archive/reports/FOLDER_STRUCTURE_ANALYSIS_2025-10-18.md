# 프로젝트 폴더 구조 분석 및 개선 제안

**작성일**: 2025-10-18 토요일 10:22 AM
**분석자**: Claude Code
**우선순위**: ⚠️ **High** (프로젝트 구조 정리 필요)
**원칙**: 🛡️ **안정성 최우선** (기존 시스템 보호)

---

## 📋 목차

1. [문제 발견](#문제-발견)
2. [현재 폴더 구조 분석](#현재-폴더-구조-분석)
3. [문제점 식별](#문제점-식별)
4. [안전한 개선 방안](#안전한-개선-방안)
5. [실행 계획](#실행-계획)

---

## 문제 발견

### 발견된 이슈

```
/Users/kwangsunglee/Projects/AED_check2025/
├── aed-check-system/        ← 실제 프로젝트 (Next.js 앱)
│   ├── app/                 ← 메인 Next.js 앱
│   ├── docs/                ← 주요 문서
│   ├── supabase/            ← Supabase 설정
│   └── package.json         ← Next.js 프로젝트
│
├── app/                     ← ⚠️ 중복: 오래된 app 폴더
├── components/              ← ⚠️ 중복: 오래된 components
├── docs/                    ← ⚠️ 중복: 오래된 docs
├── supabase/                ← ⚠️ 중복: 오래된 supabase 설정
└── package.json             ← ⚠️ MCP 서버용 (다른 용도)
```

**핵심 문제**:
- 루트 위치 혼란: 프로젝트 루트가 어디인지 불명확
- 중복 폴더: app, docs, supabase 등이 두 곳에 존재
- 의도 불명확: 왜 이런 구조가 되었는지 불명확

---

## 현재 폴더 구조 분석

### 루트 레벨 (`/Users/kwangsunglee/Projects/AED_check2025/`)

#### 활성 파일/폴더

| 항목 | 용도 | 상태 | 중요도 |
|------|------|------|--------|
| **aed-check-system/** | Next.js 메인 프로젝트 | ✅ 활성 | ⚠️ **Critical** |
| .git/ | Git 저장소 | ✅ 활성 | ⚠️ **Critical** |
| .claude/ | Claude 설정 | ✅ 활성 | Medium |
| package.json | MCP 서버 설정 | ✅ 활성 (별도 목적) | Low |
| supabase-mcp.js | MCP 서버 메인 파일 | ✅ 활성 | Low |

#### ⚠️ 의심스러운 중복 파일/폴더

| 항목 | 크기/개수 | 마지막 수정 | 추정 상태 | 조치 필요 |
|------|----------|----------|----------|----------|
| **app/** | 1개 폴더 (authenticated) | Sep 27 00:05 | ❓ 오래된 버전? | 검증 후 삭제 |
| **components/** | ? | Oct 16 20:45 | ❓ 오래된 버전? | 검증 후 삭제 |
| **docs/** | ? | Oct 16 12:54 | ❓ 오래된 버전? | 검증 후 삭제 |
| **supabase/** | ? | Oct 15 07:34 | ❓ 오래된 버전? | 검증 후 삭제 |
| node_modules/ | Sep 20 21:50 | Sep 20 21:50 | ❌ MCP 서버용 | 유지 (MCP 필요) |
| public/ | ? | ? | ❓ 오래된 버전? | 검증 후 삭제 |
| next-env.d.ts | Sep 20 09:11 | Sep 20 09:11 | ❌ 오래된 파일 | 삭제 권장 |
| tsconfig.json | Sep 20 09:11 | Sep 20 09:11 | ❌ 오래된 파일 | 삭제 권장 |
| tsconfig.tsbuildinfo | Oct 16 20:49 | Oct 16 20:49 | ❌ 빌드 캐시 | 삭제 권장 |

#### 데이터 파일 (유지 필요)

| 항목 | 크기 | 용도 | 조치 |
|------|------|------|------|
| management_number_group_mapping_rows.csv | 25MB | AED 매핑 데이터 | ✅ 유지 (data/ 이동 권장) |
| target_list_2024_rows.csv | 7MB | 2024 목표 리스트 | ✅ 유지 (data/ 이동 권장) |
| data/ | - | 데이터 폴더 | ✅ 유지 |
| sql-archive/ | - | SQL 아카이브 | ✅ 유지 |

#### 스크립트 및 유틸리티

| 항목 | 용도 | 조치 |
|------|------|------|
| scripts/ | 스크립트 모음 | ✅ 유지 |
| upload_target_list_2024.py | 데이터 업로드 | ✅ 유지 (scripts/ 이동 권장) |
| crontab_example.txt | Crontab 예시 | ✅ 유지 |

#### 문서 파일

| 항목 | 크기 | 조치 |
|------|------|------|
| DEPLOY_TRIGGER.md | 659B | ✅ 유지 (aed-check-system/docs/ 이동 권장) |
| SUPABASE_AUTH_ISSUE.md | 1.7KB | ✅ 유지 (aed-check-system/docs/ 이동 권장) |
| USER_PERMISSION_AUDIT_REPORT.md | 16KB | ✅ 유지 (aed-check-system/docs/ 이동 권장) |
| VERCEL_DEPLOYMENT_GUIDE.md | 1.6KB | ✅ 유지 (aed-check-system/docs/ 이동 권장) |

---

### aed-check-system/ 폴더 (실제 프로젝트)

**상태**: ✅ **활성 및 안정** (2024년 9월 ~ 2025년 10월 지속 개발)

#### 주요 구조

```
aed-check-system/
├── app/                     ✅ Next.js 15.5.2 앱 (Turbopack)
│   ├── (authenticated)/     메인 인증 앱
│   ├── api/                 API 라우트
│   ├── auth/                인증 페이지
│   ├── inspection/          점검 페이지
│   ├── aed-data/            AED 데이터 페이지
│   └── ...
├── docs/                    ✅ 주요 문서 (100+ 파일)
│   ├── analysis/            분석 보고서
│   ├── planning/            계획 문서
│   ├── reports/             리포트
│   ├── security/            보안 문서
│   └── ...
├── supabase/                ✅ Supabase 설정 및 마이그레이션
│   ├── migrations/          DB 마이그레이션
│   └── config.toml          Supabase 설정
├── components/              ✅ React 컴포넌트
├── lib/                     ✅ 유틸리티 라이브러리
├── public/                  ✅ 정적 파일
├── package.json             ✅ Next.js 프로젝트 설정
└── ...
```

**결론**: ✅ **이 폴더가 실제 프로젝트 루트**

---

## 문제점 식별

### 1. 🔴 Critical: 루트 위치 혼란

**문제**:
- Git 저장소: `/Users/kwangsunglee/Projects/AED_check2025/`
- 실제 프로젝트: `/Users/kwangsunglee/Projects/AED_check2025/aed-check-system/`
- 개발자 혼란: "어디가 루트인가?"

**영향**:
- 문서 작성 시 경로 혼란 (../docs vs docs)
- 신규 개발자 온보딩 어려움
- 자동화 스크립트 경로 문제

### 2. 🟡 High: 중복 폴더 존재

**중복 항목**:
```
/AED_check2025/app/           ← 오래됨 (Sep 27)
/AED_check2025/aed-check-system/app/  ← 활성 (Oct 18)

/AED_check2025/docs/          ← 오래됨 (Oct 16)
/AED_check2025/aed-check-system/docs/ ← 활성 (Oct 18)

/AED_check2025/supabase/      ← 오래됨 (Oct 15)
/AED_check2025/aed-check-system/supabase/ ← 활성 (Oct 18)
```

**위험**:
- 잘못된 폴더 수정 가능성
- 디스크 공간 낭비
- 백업/배포 혼란

### 3. 🟡 Medium: 파일 분산

**문제**:
- 문서 파일: 루트에 4개, aed-check-system/docs에 100+ 개
- 데이터 파일: 루트에 2개 CSV, data/ 폴더 별도 존재
- Python 스크립트: 루트에 1개, scripts/ 폴더 별도 존재

**영향**:
- 파일 찾기 어려움
- 일관성 부족

### 4. 🟢 Low: 불필요한 빌드 캐시

**문제**:
- `tsconfig.tsbuildinfo` (루트)
- `next-env.d.ts` (루트)
- 오래된 `node_modules` (Sep 20)

**영향**:
- 디스크 공간 낭비 (소량)
- 혼란

---

## 안전한 개선 방안

### 원칙

1. **🛡️ 안정성 최우선**: 기존 시스템 절대 손상 금지
2. **📸 백업 필수**: 모든 작업 전 백업
3. **🔍 검증 후 삭제**: 파일 삭제 전 내용 확인
4. **📝 문서화**: 모든 변경 사항 기록
5. **🔄 점진적 접근**: 한 번에 하나씩 천천히

---

### 방안 1: 현상 유지 + 명확한 문서화 (추천) ⭐

**개요**: 폴더 구조는 그대로 두고, 문서로 명확히 정의

**장점**:
- ✅ 가장 안전 (시스템 변경 없음)
- ✅ 즉시 적용 가능
- ✅ 위험 없음

**단점**:
- ❌ 중복 폴더 여전히 존재
- ❌ 혼란 완전히 해소 안 됨

**실행**:
1. README.md 생성 (루트 및 aed-check-system/)
2. 프로젝트 구조 문서화
3. 개발자 가이드 업데이트

**예상 소요 시간**: 30분

---

### 방안 2: .archive/ 폴더 이동 (안전) ⭐⭐

**개요**: 오래된 폴더를 `.archive/` 폴더로 이동 (삭제 아님)

**절차**:
```bash
# 1. 백업 생성
tar -czf AED_check2025_backup_$(date +%Y%m%d_%H%M%S).tar.gz AED_check2025/

# 2. .archive/ 폴더 생성 (이미 존재)
# /Users/kwangsunglee/Projects/AED_check2025/.archive/

# 3. 오래된 폴더 이동 (삭제 아님)
mv /Users/kwangsunglee/Projects/AED_check2025/app/ .archive/app_old_20251018/
mv /Users/kwangsunglee/Projects/AED_check2025/components/ .archive/components_old_20251018/
mv /Users/kwangsunglee/Projects/AED_check2025/docs/ .archive/docs_old_20251018/
mv /Users/kwangsunglee/Projects/AED_check2025/supabase/ .archive/supabase_old_20251018/
mv /Users/kwangsunglee/Projects/AED_check2025/public/ .archive/public_old_20251018/

# 4. 불필요한 파일 이동
mv /Users/kwangsunglee/Projects/AED_check2025/next-env.d.ts .archive/
mv /Users/kwangsunglee/Projects/AED_check2025/tsconfig.json .archive/
mv /Users/kwangsunglee/Projects/AED_check2025/tsconfig.tsbuildinfo .archive/

# 5. 테스트 (npm run dev 실행)
cd aed-check-system
npm run dev

# 6. 1주일 후 문제없으면 .archive/ 완전 삭제 검토
```

**장점**:
- ✅ 중복 제거
- ✅ 복구 가능 (.archive에 보관)
- ✅ 위험 낮음

**단점**:
- ⚠️ Git 히스토리 영향 가능성
- ⚠️ 일부 스크립트 경로 수정 필요할 수 있음

**예상 소요 시간**: 1시간 (백업 + 이동 + 테스트)

---

### 방안 3: Git Submodule 정리 (비추천) ❌

**개요**: Git submodule로 aed-check-system 분리

**장점**:
- ✅ 깔끔한 구조

**단점**:
- ❌ Git 히스토리 복잡해짐
- ❌ 기존 커밋 영향 가능
- ❌ 팀원 혼란 가능
- ❌ 위험도 높음

**결론**: **비추천**

---

## 실행 계획

### Phase 1: 현황 파악 및 문서화 (즉시 실행) ⏰

**목표**: 현재 상태 명확히 정의

- [ ] **Task 1.1**: README.md 생성 (루트)
  - 프로젝트 구조 설명
  - 실제 루트는 `aed-check-system/` 명시
  - 루트 레벨 폴더 용도 설명

- [ ] **Task 1.2**: README.md 업데이트 (aed-check-system/)
  - 이 폴더가 실제 프로젝트 루트임을 명시
  - 상위 폴더 파일 설명

- [ ] **Task 1.3**: 폴더 구조 문서 작성
  - 이 문서 (FOLDER_STRUCTURE_ANALYSIS_2025-10-18.md)
  - docs/ 폴더에 보관

**예상 소요 시간**: 30분
**위험도**: ✅ 없음 (문서만 작성)

---

### Phase 2: 안전한 정리 (1주일 후) ⏰

**전제 조건**:
1. Phase 1 완료
2. 팀 검토 완료
3. 전체 백업 완료

**절차**:

- [ ] **Task 2.1**: 전체 백업 생성
  ```bash
  cd /Users/kwangsunglee/Projects/
  tar -czf AED_check2025_backup_$(date +%Y%m%d_%H%M%S).tar.gz AED_check2025/
  ```

- [ ] **Task 2.2**: 오래된 폴더 검증
  - 루트 app/ vs aed-check-system/app/ 내용 비교
  - 루트 docs/ vs aed-check-system/docs/ 내용 비교
  - 중요 파일 누락 확인

- [ ] **Task 2.3**: .archive/ 이동 (복사 먼저)
  ```bash
  # 먼저 복사 (안전)
  cp -r app/ .archive/app_old_20251018/
  cp -r docs/ .archive/docs_old_20251018/
  # ... (나머지 폴더)

  # 테스트 후 원본 삭제
  ```

- [ ] **Task 2.4**: 개발 서버 테스트
  ```bash
  cd aed-check-system
  npm run dev
  # 모든 페이지 동작 확인
  ```

- [ ] **Task 2.5**: 빌드 테스트
  ```bash
  npm run build
  npm run start
  ```

**예상 소요 시간**: 2시간
**위험도**: ⚠️ **Medium** (백업 있으면 복구 가능)

---

### Phase 3: 파일 정리 (2주일 후) ⏰

**전제 조건**:
1. Phase 2 완료 후 1주일 문제 없음
2. 모든 기능 정상 작동 확인

**절차**:

- [ ] **Task 3.1**: 문서 파일 이동
  ```bash
  mv DEPLOY_TRIGGER.md aed-check-system/docs/setup/
  mv SUPABASE_AUTH_ISSUE.md aed-check-system/docs/troubleshooting/
  mv USER_PERMISSION_AUDIT_REPORT.md aed-check-system/docs/reports/
  mv VERCEL_DEPLOYMENT_GUIDE.md aed-check-system/docs/setup/
  ```

- [ ] **Task 3.2**: 데이터 파일 정리
  ```bash
  mv management_number_group_mapping_rows.csv data/
  mv target_list_2024_rows.csv data/
  ```

- [ ] **Task 3.3**: 스크립트 정리
  ```bash
  mv upload_target_list_2024.py scripts/
  ```

**예상 소요 시간**: 1시간
**위험도**: ✅ Low (파일 이동만)

---

### Phase 4: .archive/ 완전 삭제 검토 (1개월 후) ⏰

**전제 조건**:
1. Phase 1-3 모두 완료
2. 1개월간 문제 없음
3. 팀 전체 동의

**절차**:

- [ ] **Task 4.1**: .archive/ 내용 최종 검토
- [ ] **Task 4.2**: 필요한 파일 있는지 확인
- [ ] **Task 4.3**: 최종 백업 후 삭제

**예상 소요 시간**: 30분
**위험도**: ✅ Low (1개월 테스트 후)

---

## 권장 사항

### ⭐ 즉시 실행 (오늘)

**방안 1**: 현상 유지 + 명확한 문서화
- README.md 생성 (루트 및 aed-check-system/)
- 폴더 구조 문서화
- 개발자 가이드 업데이트

**위험도**: ✅ **없음**
**소요 시간**: 30분

---

### ⏰ 1주일 후 실행

**방안 2**: .archive/ 이동
- 백업 생성
- 오래된 폴더 .archive/로 이동 (삭제 아님)
- 테스트

**위험도**: ⚠️ **Low-Medium** (백업 있으면 복구 가능)
**소요 시간**: 2시간

---

### 📅 장기 계획 (1-2개월)

- 파일 정리 및 통합
- .archive/ 완전 삭제 검토
- 프로젝트 구조 최적화

---

## 결론

### 현재 상태 요약

✅ **안정성**: 현재 시스템은 안정적으로 작동 중
⚠️ **문제**: 폴더 구조 혼란 및 중복 존재
🎯 **목표**: 점진적 정리 (안전성 최우선)

### 최종 권장 사항

1. **즉시** (오늘): README.md 생성 및 문서화 ← **이것부터 시작**
2. **1주일 후**: .archive/ 이동 (검토 후)
3. **2주일 후**: 파일 정리 (테스트 후)
4. **1개월 후**: .archive/ 삭제 검토 (신중히)

### 중요 원칙

> 🛡️ **안정성이 최우선입니다.**
> 불확실하면 하지 마세요.
> 백업 없이 삭제하지 마세요.

---

**작성**: Claude Code
**검토 필요**: AED Smart Check 개발팀
**다음 단계**: Phase 1 실행 (README.md 생성)
