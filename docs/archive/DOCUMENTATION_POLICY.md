# 문서 관리 정책 (Documentation Policy)

**작성일**: 2025-10-04
**목적**: 프로젝트 문서의 신뢰성과 일관성 보장

---

## 📌 문서의 진실 공급원 (Single Source of Truth)

### 1순위: 실제 데이터베이스 스키마
- **위치**: `supabase/ACTUAL_SCHEMA_REFERENCE.md`
- **용도**: 모든 쿼리, RPC 함수 작성 시 필수 참조
- **업데이트**: 마이그레이션 실행 후 즉시 반영

### 2순위: 마이그레이션 파일
- **위치**: `supabase/migrations/` (번호순)
- **용도**: 데이터베이스 변경 이력 추적
- **원칙**: 절대 수정하지 않음 (새 마이그레이션 추가만 허용)

### 3순위: 현재 아키텍처 문서
- **위치**: `docs/current/`
- **용도**: 시스템 설계 및 구조 이해
- **업데이트**: 주요 기능 추가/변경 시

---

## 📂 문서 디렉토리 구조

```
docs/
├── current/               # 현재 유효한 문서만 보관
│   ├── inspection-architecture.md
│   └── api-reference.md
├── archive/              # 역사적 기록 (READ-ONLY)
│   └── 2025-10/
│       ├── ⚠️ ARCHIVED_계획서.md
│       └── README.md     # "이 문서들은 구현되지 않았거나 변경되었습니다"
└── DOCUMENTATION_POLICY.md  # 이 파일
```

---

## ⚠️ 아카이브 문서 처리 원칙

### ❌ 하지 말아야 할 것
- 아카이브 문서를 삭제하거나 수정
- 아카이브 문서를 최신 상태로 업데이트

### ✅ 해야 할 것
- 아카이브 폴더 최상위에 경고 README 작성
- 파일명 앞에 `⚠️ ARCHIVED_` 접두사 추가 (선택)
- 새로운 계획은 `docs/current/`에만 작성

---

## 📋 검증된 테이블 목록 (2025-10-04 기준)

### 핵심 테이블
- ✅ `aed_data` - AED 장비 마스터 데이터
- ✅ `aed_inspections` - 점검 기록 (v2 아님!)
- ✅ `inspection_sessions` - 점검 세션 관리
- ✅ `organizations` - 기관 정보
- ✅ `user_profiles` - 사용자 프로필

### 부가 기능 테이블
- ✅ `notifications` - 알림
- ✅ `user_statistics` - 사용자 통계
- ✅ `email_verification_codes` - 이메일 인증
- ✅ `aed_inspection_schedules` - 점검 일정
- ✅ `inspection_session_stats` - 점검 세션 통계

### ❌ 존재하지 않는 테이블
- ❌ `aed_inspections_v2` (허위 정보)
- ❌ `inspection_snapshots` (계획만 있었음, 미구현)

---

## 🔄 문서 업데이트 프로세스

### 마이그레이션 실행 시
1. 마이그레이션 파일 작성 및 실행
2. `ACTUAL_SCHEMA_REFERENCE.md` 즉시 업데이트
3. 필요시 `docs/current/` 아키텍처 문서 수정

### 주요 기능 개발 시
1. 기능 구현 완료 후 문서 작성
2. 계획 문서가 아닌 **구현 문서** 작성
3. `docs/current/`에 배치

### 오래된 계획 문서 처리
1. 구현되지 않은 계획서는 `docs/archive/yyyy-mm/`로 이동
2. 해당 폴더에 README 작성: "이 계획은 실행되지 않았습니다"

---

## 🚨 문서 신뢰성 검증 체크리스트

새로운 문서를 참조하기 전 다음을 확인:

- [ ] `supabase/migrations/`에 해당 변경사항이 있는가?
- [ ] `ACTUAL_SCHEMA_REFERENCE.md`에 테이블/컬럼이 명시되어 있는가?
- [ ] 문서가 `docs/current/`에 있는가? (archive 폴더는 신뢰 불가)
- [ ] 문서 작성일이 최근 3개월 이내인가?

---

## 📌 중요 원칙

> **"계획이 아니라 실제 구현된 것만 문서화한다"**

> **"아카이브는 삭제하지 않고 명확히 표시한다"**

> **"의심스러우면 마이그레이션 파일을 확인한다"**
