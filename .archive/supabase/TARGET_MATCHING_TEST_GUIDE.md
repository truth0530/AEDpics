# 구비의무기관 매칭 시스템 테스트 가이드

## 🎯 시스템 개요

**완료 날짜**: 2025-10-04
**개발 항목**: 구비의무기관 매칭 관리 UI/UX 및 API

---

## ✅ 완료된 작업

### 1. 데이터베이스 (Migration 41-47)
- ✅ target_list_2024 테이블 (26,724건)
- ✅ management_number_group_mapping 테이블 (50,010건)
- ✅ 자동 매칭 알고리즘 (평균 신뢰도 69.81점)
- ✅ UI 지원 함수 `get_target_matching_list_2024()`

### 2. API 엔드포인트 (5개)
- ✅ `GET /api/target-matching/stats` - 통계
- ✅ `GET /api/target-matching` - 목록 조회
- ✅ `POST /api/target-matching/confirm` - 단일 확정
- ✅ `POST /api/target-matching/modify` - 수정
- ✅ `POST /api/target-matching/bulk-confirm` - 일괄 확정

### 3. UI 페이지
- ✅ `/admin/target-matching` - 관리 페이지
- ✅ 대시보드 통계
- ✅ 4개 탭 (고/중/저/전체)
- ✅ 필터링 (지역/검색/확정여부)
- ✅ 상세 모달
- ✅ 확정/일괄확정 버튼

---

## 🚀 개발 서버 실행

### 현재 상태
```
✅ 개발 서버 실행 중
📍 URL: http://localhost:3001
⚠️  포트 3000이 사용 중이어서 3001 사용
```

### 서버 시작 (필요시)
```bash
cd /Users/kwangsunglee/Projects/AED_check2025/aed-check-system
npm run dev
```

---

## 🧪 테스트 순서

### 1단계: 데이터베이스 함수 테스트 ✅ 완료

**Supabase SQL Editor**에서 실행:

```sql
-- 1. 함수 존재 확인
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_target_matching_list_2024';

-- 2. 고신뢰도 10건 조회
SELECT * FROM get_target_matching_list_2024('high', NULL, NULL, FALSE)
LIMIT 10;

-- 3. 서울 지역 조회
SELECT * FROM get_target_matching_list_2024('all', '서울', NULL, FALSE)
LIMIT 10;

-- 4. 검색 테스트
SELECT * FROM get_target_matching_list_2024('all', NULL, '보건소', FALSE)
LIMIT 10;

-- 5. 중신뢰도 조회
SELECT * FROM get_target_matching_list_2024('medium', NULL, NULL, FALSE)
LIMIT 10;
```

**결과**: ✅ 모두 정상 작동 확인됨

---

### 2단계: API 엔드포인트 테스트

#### 테스트 도구
- 브라우저 개발자 도구 (F12 → Network 탭)
- 또는 curl 명령어

#### A. 통계 API
```bash
curl http://localhost:3001/api/target-matching/stats
```

**예상 응답**:
```json
{
  "total_mappings": 50010,
  "total_aed_count": 80860,
  "confirmed_count": 0,
  "pending_count": 50010,
  "high_confidence_count": 10630,
  "medium_confidence_count": 8810,
  "low_confidence_count": 30570,
  "avg_confidence": 69.81
}
```

#### B. 목록 조회 API
```bash
# 고신뢰도
curl "http://localhost:3001/api/target-matching?confidence_level=high&limit=10"

# 서울 지역
curl "http://localhost:3001/api/target-matching?sido=서울특별시&limit=10"

# 검색
curl "http://localhost:3001/api/target-matching?search=보건소&limit=10"
```

#### C. 확정 API (로그인 필요)
```bash
curl -X POST http://localhost:3001/api/target-matching/confirm \
  -H "Content-Type: application/json" \
  -d '{"managementNumber": "20170912-12"}'
```

---

### 3단계: UI 페이지 테스트

#### 접속 방법

1. **브라우저 열기**
2. **URL 입력**: `http://localhost:3001/admin/target-matching`
3. **로그인** (필요 시)

#### 테스트 체크리스트

##### 📊 대시보드 통계
- [ ] 전체 매칭: 50,010건 표시
- [ ] 총 AED: 80,860대 표시
- [ ] 확정 완료: 0건 (초기)
- [ ] 검토 대기: 50,010건
- [ ] 평균 신뢰도: 69.81점
- [ ] 고신뢰도: 10,630건 (21.3%)
- [ ] 중신뢰도: 8,810건 (17.6%)
- [ ] 저신뢰도: 30,570건 (61.1%)

##### 🗂️ 탭 기능
- [ ] 고신뢰도 탭 클릭 → 10,630건 표시
- [ ] 중신뢰도 탭 클릭 → 8,810건 표시
- [ ] 저신뢰도 탭 클릭 → 30,570건 표시
- [ ] 전체 탭 클릭 → 50,010건 표시

##### 🔍 필터링 기능
- [ ] 시도 선택 → 서울특별시 선택 시 서울 데이터만 표시
- [ ] 검색 → "보건소" 입력 시 보건소 포함 데이터만 표시
- [ ] 확정 여부 → 체크 시 확정된 것만 표시 (초기엔 0건)

##### 📋 데이터 테이블
- [ ] 관리번호 표시
- [ ] AED 설치기관 표시
- [ ] 구비의무기관 표시
- [ ] 지역 (시도 시군구) 표시
- [ ] AED 수량 표시
- [ ] 신뢰도 배지 (색상별)
  - 녹색: 고신뢰도 (90점 이상)
  - 노란색: 중신뢰도 (70-89점)
  - 주황색: 저신뢰도 (50-69점)
- [ ] 상태 표시 (검토 필요/수정됨/확정됨)

##### 🎬 액션 버튼
- [ ] **확정** 버튼 클릭 → 확정 처리
- [ ] **상세** 버튼 클릭 → 모달 팝업
- [ ] **고신뢰도 일괄 확정** 버튼 (고신뢰도 탭에서만)

##### 📱 상세 모달
- [ ] 관리번호 표시
- [ ] AED 수량 표시
- [ ] AED 설치기관명 표시
- [ ] 매칭된 구비의무기관명 표시
- [ ] 시도/시군구 표시
- [ ] 신뢰도 점수 배지 표시
- [ ] 매칭 이유 JSON 표시
  - sido_score, gugun_score, name_score
  - aed_institution, target_institution
- [ ] 닫기 버튼
- [ ] 확정 버튼 (미확정 상태일 때)

---

## 📸 예상 화면 구성

### 상단 통계 카드 (4개)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 전체 매칭   │ 확정 완료   │ 검토 대기   │ 평균 신뢰도 │
│ 50,010      │ 0          │ 50,010      │ 69.81점     │
│ 80,860대AED │ 0.0%       │ 100.0%      │ 고:10,630   │
│             │            │             │ 중:8,810    │
│             │            │             │ 저:30,570   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 필터 바
```
┌──────────────────────────────────────────────────────────┐
│ [시도 선택 ▼] [검색어 입력...] [☐ 확정된 것만 보기]      │
└──────────────────────────────────────────────────────────┘
```

### 탭 + 일괄 확정 버튼
```
┌────────────────────────────────────────────────────────┐
│ [고신뢰도 10,630] [중신뢰도 8,810] [저신뢰도 30,570]   │
│ [전체 50,010]                 [고신뢰도 일괄 확정 →]   │
└────────────────────────────────────────────────────────┘
```

### 데이터 테이블
```
┌──────────────┬─────────────┬─────────────┬──────┬─────┬────────┬────────┬────────┐
│ 관리번호     │ AED설치기관 │ 구비의무기관│ 지역 │AED수│신뢰도  │ 상태   │ 작업   │
├──────────────┼─────────────┼─────────────┼──────┼─────┼────────┼────────┼────────┤
│20170912-12   │한국철도공사 │한국철도공사 │대전  │389대│[100점] │검토필요│[확정][상세]│
│              │             │             │동구  │     │        │        │        │
├──────────────┼─────────────┼─────────────┼──────┼─────┼────────┼────────┼────────┤
│20230214-06   │신안군보건소 │신안군보건소 │전남  │43대 │[100점] │검토필요│[확정][상세]│
│              │             │             │신안군│     │        │        │        │
└──────────────┴─────────────┴─────────────┴──────┴─────┴────────┴────────┴────────┘
```

---

## 🎨 UI 색상 테마

### 다크 모드 (녹색 테마)
- **배경**: `bg-gray-950` (거의 검정)
- **카드**: `bg-gray-900` (어두운 회색)
- **테두리**: `border-gray-800`
- **강조색**: `green-600` / `green-700`
- **텍스트**:
  - 주요: `text-white`
  - 보조: `text-gray-400`
  - 비활성: `text-gray-500`

### 배지 색상
- **고신뢰도**: `bg-green-900 text-green-300`
- **중신뢰도**: `bg-yellow-900 text-yellow-300`
- **저신뢰도**: `bg-orange-900 text-orange-300`
- **확정됨**: `text-green-400 ✓`
- **수정됨**: `text-blue-400`
- **검토 필요**: `text-yellow-400`

---

## 🐛 알려진 이슈 및 해결

### 이슈 1: `modified_2024` 컬럼 에러 ✅ 해결됨
**문제**: `column m.modified_2024 does not exist`
**원인**: DB에는 `modified_by_2024`와 `modified_at_2024`만 존재
**해결**: Migration 47 수정 완료

### 이슈 2: 타입 캐스팅 에러
**예방**: 모든 VARCHAR 컬럼에 `::VARCHAR` 명시적 캐스팅 적용

---

## 📊 데이터 현황

### 전체 통계
- **총 management_number**: 50,010개
- **총 AED 장비**: 80,860대
- **매칭 커버리지**: 100%

### 신뢰도 분포
| 신뢰도 등급 | 범위 | 건수 | 비율 |
|------------|------|------|------|
| 고신뢰도 | 90-100점 | 10,630 | 21.3% |
| 중신뢰도 | 70-89점 | 8,810 | 17.6% |
| 저신뢰도 | 50-69점 | 30,570 | 61.1% |
| **합계** | | **50,010** | **100%** |

### 상위 AED 보유 기관 (예시)
1. 한국철도공사 (20170912-12): 389대 - 100점
2. 신안군보건소 (20230214-06): 43대 - 100점
3. 당진소방서 (20170803-13): 31대 - 100점

---

## 🔐 권한 요구사항

### 페이지 접근 권한
- **최소 권한**: `authenticated` (로그인 사용자)
- **추천 권한**: `master`, `emergency_center_admin`, `ministry_admin`

### API 호출 권한
- **함수 실행**: `authenticated` 사용자
- **데이터 수정**: 로그인 + 적절한 역할

---

## 📝 다음 작업 계획

### 단기 (이번 주)
- [ ] UI 페이지 실제 접속 테스트
- [ ] 확정 기능 동작 확인
- [ ] 일괄 확정 기능 테스트
- [ ] 필터링 정확도 확인

### 중기 (다음 주)
- [ ] 2025년 데이터 준비 시 target_list_2025 테이블 생성
- [ ] 연도별 비교 기능 추가
- [ ] 매칭 이력 관리 기능
- [ ] 수정 사유 입력 기능

### 장기
- [ ] 자동 매칭 알고리즘 개선
- [ ] 기계 학습 기반 매칭 신뢰도 향상
- [ ] 일괄 작업 스케줄러
- [ ] 매칭 품질 보고서 생성

---

## 📞 문제 발생 시

### 체크리스트
1. [ ] 개발 서버가 실행 중인가? (`npm run dev`)
2. [ ] Migration 47이 실행되었는가?
3. [ ] Supabase 함수 테스트는 성공했는가?
4. [ ] 브라우저 콘솔에 에러가 있는가? (F12)
5. [ ] Network 탭에서 API 응답을 확인했는가?

### 디버깅 쿼리
```sql
-- management_number_group_mapping 데이터 확인
SELECT COUNT(*) FROM management_number_group_mapping;
-- 결과: 50010

-- target_list_2024 데이터 확인
SELECT COUNT(*) FROM target_list_2024;
-- 결과: 26724

-- 함수 존재 확인
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_target_matching_list_2024';
-- 결과: get_target_matching_list_2024
```

---

## 작성자: Claude
## 작성일: 2025-10-04
## 버전: 1.0 (Migration 41-47 완료)
