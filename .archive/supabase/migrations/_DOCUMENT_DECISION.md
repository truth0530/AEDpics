# Migration 문서 정리 결정

## 📋 현재 상황

### 기존 문서 (4개)
1. **README.md** (224줄) - 함수 작성 가이드
2. **README_CLEANED.md** (174줄) - Migration 파일 목록
3. **MIGRATION_AUDIT_REPORT.md** (149줄) - 감사 보고서
4. **00_MIGRATION_WARNING.md** (187줄) - 경고 + 체크리스트

### 신규 통합 문서
5. **MIGRATION_GUIDE_COMPLETE.md** (829줄) - 종합 가이드

---

## 🎯 권장 결정: 옵션 B

### 유지할 문서 (2개)
1. ⭐ **00_MIGRATION_WARNING.md** - 빠른 경고 + 체크리스트
   - **이유**: 파일명 `00_` 접두사로 최상단 노출
   - **역할**: 긴급 상황 빠른 참조
   - **길이**: 187줄 (적당)

2. ⭐ **MIGRATION_GUIDE_COMPLETE.md** - 종합 상세 가이드
   - **이유**: 모든 내용 통합
   - **역할**: 상세 레퍼런스
   - **길이**: 829줄 (상세)

### 제거할 문서 (3개)
1. ❌ **README.md**
   - **이유**: MIGRATION_GUIDE_COMPLETE.md에 완전 포함
   - **조치**: `_archive_docs/README.md.backup`으로 이동

2. ❌ **README_CLEANED.md**
   - **이유**: MIGRATION_GUIDE_COMPLETE.md에 완전 포함
   - **조치**: `_archive_docs/README_CLEANED.md.backup`으로 이동

3. ❌ **MIGRATION_AUDIT_REPORT.md**
   - **이유**: MIGRATION_GUIDE_COMPLETE.md에 완전 포함
   - **조치**: `_archive_docs/MIGRATION_AUDIT_REPORT.md.backup`으로 이동

---

## 📁 최종 문서 구조

```
supabase/migrations/
├── 00_MIGRATION_WARNING.md          ⭐ 빠른 경고 (187줄)
├── MIGRATION_GUIDE_COMPLETE.md      ⭐ 종합 가이드 (829줄)
├── _archive_docs/
│   ├── README.md.backup
│   ├── README_CLEANED.md.backup
│   └── MIGRATION_AUDIT_REPORT.md.backup
└── [01~48번 migration 파일들...]
```

---

## 🔧 실행 명령어

```bash
cd /Users/kwangsunglee/Projects/AED_check2025/aed-check-system/supabase/migrations

# 백업 디렉토리 생성
mkdir -p _archive_docs

# 중복 문서 백업
mv README.md _archive_docs/README.md.backup
mv README_CLEANED.md _archive_docs/README_CLEANED.md.backup
mv MIGRATION_AUDIT_REPORT.md _archive_docs/MIGRATION_AUDIT_REPORT.md.backup

# 최종 확인
ls -lh *.md
# 결과:
# 00_MIGRATION_WARNING.md
# MIGRATION_GUIDE_COMPLETE.md
```

---

## ✅ 장점

### 1. 명확한 역할 분리
- **00_MIGRATION_WARNING.md**: 긴급 경고 + 빠른 체크리스트
- **MIGRATION_GUIDE_COMPLETE.md**: 상세 레퍼런스

### 2. 파일명 최적화
- `00_` 접두사로 경고 문서가 **알파벳순 최상단**
- 개발자가 migrations 폴더 열 때 **즉시 경고 확인**

### 3. 중복 제거
- 4개 문서 → 2개 문서
- 내용 중복 완전 제거
- 유지보수 부담 감소

### 4. 백업 유지
- 기존 문서 삭제하지 않고 `_archive_docs`에 백업
- 필요 시 언제든 복원 가능

---

## ⚠️ 대안: 옵션 A (하나만 유지)

만약 **MIGRATION_GUIDE_COMPLETE.md 하나만** 유지하고 싶다면:

```bash
# 00_MIGRATION_WARNING.md도 백업
mv 00_MIGRATION_WARNING.md _archive_docs/00_MIGRATION_WARNING.md.backup

# MIGRATION_GUIDE_COMPLETE.md를 00_ 접두사로 이름 변경
mv MIGRATION_GUIDE_COMPLETE.md 00_MIGRATION_GUIDE_COMPLETE.md
```

**단점**:
- 파일이 829줄로 너무 길어서 빠른 참조 어려움
- 긴급 상황 체크리스트만 보고 싶을 때 불편

---

## 🎯 최종 권장

**옵션 B 추천** (2개 유지):
- ⭐ 00_MIGRATION_WARNING.md (빠른 경고)
- ⭐ MIGRATION_GUIDE_COMPLETE.md (상세 가이드)

**이유**:
1. 역할 분리로 사용성 향상
2. 파일명 최적화 (`00_` 접두사)
3. 긴급 vs 상세 참조 구분 명확
4. 중복은 제거하되 활용도 유지

---

**작성일**: 2025-10-04
**결정자**: 사용자 확인 필요
