# 의무설치기관 매칭 기능 개선 계획 (V2)

**작성일**: 2025-11-11
**최종 업데이트**: 2025-11-11
**상태**: 분석 완료 - 구현 대기
**목표**: 수동 매칭 워크플로우 개선으로 사용자 경험 향상

---

## 중요: 기존 기능 발견

**발견 사항**: `/admin/compliance` 경로에 이미 유사한 기능이 구현되어 있음!

**기존 구현**:
- 파일: `components/admin/compliance/EnhancedComplianceUI.tsx` (922줄)
- 기능: 의무설치기관 자동 매칭 결과 검토 및 확인
- API: `/api/compliance/check-optimized`

**사용자 피드백 반영 (2025-11-11)**:

| 항목 | 현재 구현 | 최종 요구사항 |
|------|----------|--------------|
| 레이아웃 | 2단 (기관 + 매칭 결과) | **3단 (기관 + 관리번호 + 담기)** |
| 워크플로우 | 자동 매칭 → 키보드로 확인 | **선택 → 담기 → 매칭** |
| 선택 방식 | 키보드 1/2 | ❌ **삭제** (제대로 작동 안함) |
| 매칭 방법 | 전체 일괄 처리 | **담기 박스에 담긴 항목만 매칭** |
| 매칭 취소 | 없음 | ✅ **모두 가능** + 타인 매칭 취소 시 사유 필수 |
| 지역 필터 | 고정 | **기본 제한 + 필요시 확장 조회** |
| 미매칭 필터 | 없음 | **디폴트로 미매칭만 표시** (매칭 시 자동 제거) |
| 리스트 단위 | management_number 그룹 | ✅ 동일 |

---

## 1. 현재 구조 분석

### 1.1 데이터베이스 스키마

#### target_list_2024 (의무설치기관 목록)
```sql
- target_key (PK): 기관 고유 키
- institution_name: 기관명
- sido: 시도
- gugun: 구군
- division: 대분류
- sub_division: 소분류
- management_number: 관리번호
```

#### aed_data (AED 장비 목록)
```sql
- equipment_serial (고유키): 장비 시리얼
- institution_name: 설치기관명
- sido: 시도
- gugun: 구군
- address_detail: 상세주소
- location: 위치 설명
```

#### target_list_devices (매칭 결과 저장)
```sql
- target_institution_id: 의무기관 ID (target_key)
- equipment_serial: AED 시리얼
- matching_method: 매칭 방법 (manual/auto)
- matching_confidence: 신뢰도
- matched_by: 매칭한 사용자
- matched_at: 매칭 시간
```

#### management_number_group_mapping (자동 매칭 추천)
```sql
- management_number: 관리번호
- auto_suggested_2024: 자동 추천 기관
- auto_confidence_2024: 자동 신뢰도
- confirmed_2024: 확정 여부
```

### 1.2 현재 구현 상태

**파일 위치**:
- Page: `app/(authenticated)/admin/target-matching/page.tsx`
- Client: `app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`
- API: `app/api/target-matching/route.ts`

**현재 기능**:
1. `management_number_group_mapping` 기반 자동 매칭 결과 표시
2. 신뢰도 탭 (고/중/저/전체) 필터링
3. 검색 기능 (기관명, 관리번호)
4. 개별 확정 / 고신뢰도 일괄 확정
5. 매칭 상세 정보 모달

**현재 워크플로우**:
```
자동 매칭 실행 (외부)
  ↓
management_number_group_mapping 테이블에 결과 저장
  ↓
신뢰도별 필터링하여 검토
  ↓
개별/일괄 확정
```

---

## 2. 요구사항 분석

### 2.1 사용자 요구사항

**스크린샷 기반 분석**:
- 좌측: 의무설치기관 리스트 (10개 항목, "-Infinity%" 배지)
- 우측: "관리1", "관리2", "관리3" 큰 박스 (의미 불명)
- 빨간 화살표로 매칭 관계 표시

**사용자 설명**:
1. 좌측에 의무설치기관 리스트 표시 + 검색창
2. 좌측 기관 클릭 → 우측에 관련 AED 목록 표시 + 검색창
3. 우측에서 멀티체크 → 매칭 버튼 클릭
4. 매칭 완료 시 좌측 리스트에서 해당 기관 제거 (사라짐)

### 2.2 기능 요구사항

#### 필수 기능
1. **좌측 패널 (의무설치기관)**:
   - [ ] 미매칭 기관 목록 표시
   - [ ] 검색 기능 (기관명, 지역)
   - [ ] 페이지네이션 또는 무한 스크롤
   - [ ] 클릭 시 우측 패널 활성화

2. **우측 패널 (AED 목록)**:
   - [ ] 선택된 기관과 관련된 AED 목록 표시
   - [ ] 검색 기능 (장비번호, 설치기관명, 주소)
   - [ ] 멀티체크박스
   - [ ] 매칭 버튼

3. **매칭 처리**:
   - [ ] 선택된 AED들을 의무기관에 매칭
   - [ ] `target_list_devices` 테이블에 저장
   - [ ] 매칭 완료 시 좌측에서 기관 제거
   - [ ] 성공/실패 피드백

4. **진행률 표시**:
   - [ ] 전체 기관 수 / 매칭 완료 수
   - [ ] 퍼센트 진행률
   - [ ] 남은 기관 수

#### 선택 기능
- [ ] 자동 추천 AED 하이라이트 (신뢰도 기반)
- [ ] 매칭 히스토리 보기
- [ ] 매칭 취소 기능
- [ ] 벌크 매칭 (CSV 업로드)

---

## 2.3 개선 방향 요약

### 핵심 변경 사항 (사용자 피드백 반영)

1. **3단 레이아웃 구조로 전환**
   - 현재: 2단 (의무설치기관 + 매칭 결과)
   - 개선: **3단 (의무설치기관 + 관리번호 리스트 + 담기 박스)**

2. **담기 워크플로우 도입**
   - 현재: 자동 매칭 결과 → 키보드로 즉시 확인
   - 개선: **선택 → 담기 박스에 추가 → 최종 매칭**
   - 담기 박스에서 항목 추가/제거 가능

3. **키보드 단축키 완전 제거**
   - 현재: 키 1 (설치확인), 키 2 (미설치)
   - 문제: 제대로 작동하지 않음
   - 개선: ❌ **완전 삭제** (필요시 추후 재구축)

4. **매칭 취소 기능 + 사유 기록**
   - 누구나 매칭 취소 가능
   - **타인이 매칭한 것을 취소할 때는 반드시 사유 입력**
   - target_list_devices 테이블에서 레코드 삭제 + 로그 기록

5. **지역 필터링 개선**
   - 기본: 사용자의 시도/구군으로 제한
   - 추가: "전지역 조회" 체크박스로 확장 가능

6. **미매칭 필터 적용**
   - 1단 (의무설치기관): 디폴트로 미매칭만 표시
   - 2단 (관리번호 리스트): 미매칭만 조회
   - 검색 시: 매칭된 것도 비활성화 상태로 표시 가능

### 개선 전략

**최종 결정**: 기존 EnhancedComplianceUI 대폭 수정
- 2단 → 3단 구조로 완전 재설계
- 키보드 단축키 제거
- 담기 박스 새로 구현
- 매칭 취소 + 사유 기록 추가
- 지역 필터 확장 기능 추가

---

## 3. UI/UX 설계

### 3.1 레이아웃 구조 (3단 구조 - 최종안)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 의무설치기관 매칭 (2024년)                        진행률: 324/860 (37.7%)      │
├─────────────────┬──────────────────────┬──────────────────────────────────┤
│ 1️⃣ 의무설치기관  │ 2️⃣ 관리번호 리스트    │ 3️⃣ 담기 박스 (매칭할 항목)        │
│ (미매칭만 표시)  │ (선택: 대구광역시군의회)│                                  │
├─────────────────┤                      │                                  │
│ 🔍 [검색]        │ 📌 [자동 추천] [검색] │ 선택된 항목: 2개                  │
│                 │ ☐ 전지역 조회         │                                  │
├─────────────────┤                      │ ✓ 119-DG-001 (95%)               │
│ ● 대구광역시군의회│ 【자동 추천】         │   대구중학교 (3대)                │
│   대구 중구      │                      │   [깨내기]                        │
│   0/3대 매칭     │ ☑ 119-DG-001 ⭐      │                                  │
│                 │    대구중학교 (3대)   │ ✓ 119-DG-005                     │
│ ☐ 1차대리면허시험장│    신뢰도 95%        │   군의회별관 (1대)                │
│   대구 남구      │    [담기]            │   [깨내기]                        │
│   0/1대 매칭     │                      │                                  │
│                 │ ☐ 119-DG-002 (88%)   │                                  │
│ ☐ 고대역약품랩   │    군의회청사 (2대)   │                                  │
│   대구 남구      │    [담기]            │                                  │
│   0/2대 매칭     │                      │                                  │
│                 │ ──────────────       │                                  │
│                 │ 【검색 결과】         │                                  │
│                 │ 🔍 [기관명/주소/관리번호]│                                │
│                 │                      │                                  │
│                 │ ☐ 119-DG-005         │                                  │
│                 │    군의회별관 (1대)   │                                  │
│                 │    [담기]            │                                  │
│                 │                      │                                  │
│  [1/54 페이지]   │ [선택한 3개 담기]     │ [담기 전체 매칭하기]              │
└─────────────────┴──────────────────────┴──────────────────────────────────┘

**3단 구조 워크플로우**:
1️⃣ 의무설치기관 클릭 → 2️⃣ 관련 관리번호 그룹 표시
2️⃣ 관리번호 체크 → [담기] 버튼 → 3️⃣ 담기 박스에 추가
3️⃣ 담기 박스에서 최종 확인 → [깨내기]로 제거 가능
3️⃣ [담기 전체 매칭하기] 버튼 → DB에 매칭 저장
매칭 완료 → 1️⃣에서 해당 기관 사라짐 (또는 "완료" 표시)

**핵심 기능**:
1. 의무설치기관: 디폴트로 미매칭만 표시 (필터로 전체 조회 가능)
2. 관리번호 리스트: 미매칭만 조회 (검색 시 매칭된 것도 비활성 표시 가능)
3. 담기 박스: 최종 매칭 전 검토 및 수정 가능
4. 지역 필터: 기본 시도/구군 제한 + "전지역 조회" 체크박스
```

### 3.2 주요 UI 요소

#### 좌측 패널 (의무설치기관 카드)
```tsx
<Card>
  <Checkbox />
  <div>
    <h3>{institution_name}</h3>
    <p>{sido} {gugun}</p>
    <Badge>보유: {aed_count}대</Badge>
  </div>
</Card>
```

#### 우측 패널 (AED 카드)
```tsx
<Card>
  <Checkbox />
  <div>
    <h4>{equipment_serial}</h4>
    <p>{institution_name}</p>
    <p>{address_detail}</p>
    {isAutoSuggested && <Badge variant="primary">자동 추천 {confidence}%</Badge>}
  </div>
</Card>
```

#### 진행률 표시
```tsx
<ProgressBar value={matched} max={total} />
<span>{matched} / {total} ({percentage}%)</span>
```

---

## 4. API 설계 (3단 구조 기반)

### 4.1 새로운/수정 API 엔드포인트

#### GET /api/compliance/institutions (수정)
기존 API 개선 - 미매칭 필터 추가
의무설치기관 목록 조회 (미매칭만)

**Query Parameters**:
- `year`: 연도 (2024/2025)
- `search`: 검색어 (기관명, 지역)
- `sido`: 시도 필터
- `limit`: 페이지당 개수
- `offset`: 페이지 오프셋

**Response**:
```json
{
  "institutions": [
    {
      "target_key": "KEY-001",
      "institution_name": "대구광역시군의회",
      "sido": "대구광역시",
      "gugun": "중구",
      "division": "공공기관",
      "sub_division": "의회",
      "aed_count": 3,
      "matched_count": 0
    }
  ],
  "total": 860,
  "matched": 324,
  "remaining": 536
}
```

#### GET /api/compliance/management-number-candidates (신규)
특정 기관의 관리번호 그룹 후보 조회

**Query Parameters**:
- `target_key`: 의무기관 키
- `year`: 연도
- `search`: 검색어 (기관명, 주소, 관리번호)
- `include_all_region`: 전지역 조회 (true/false)
- `include_matched`: 매칭된 것도 표시 (비활성 상태)

**Response**:
```json
{
  "auto_suggestions": [
    {
      "management_number": "119-DG-001",
      "institution_name": "대구중학교",
      "address": "대구광역시 중구 동성로 12",
      "equipment_count": 3,
      "confidence": 95.5,
      "is_matched": false,
      "matched_to": null
    }
  ],
  "search_results": [
    {
      "management_number": "119-DG-005",
      "institution_name": "군의회별관",
      "address": "...",
      "equipment_count": 1,
      "confidence": null,
      "is_matched": false,
      "matched_to": null
    }
  ]
}
```

#### POST /api/compliance/match-basket (신규)
담기 박스의 항목들을 일괄 매칭

**Request Body**:
```json
{
  "year": 2024,
  "target_key": "KEY-001",
  "management_numbers": ["119-DG-001", "119-DG-005"],
  "note": "수동 매칭"
}
```

**Response**:
```json
{
  "success": true,
  "matched_count": 2,
  "total_equipment_count": 4,
  "institution": {
    "target_key": "KEY-001",
    "institution_name": "대구광역시군의회"
  }
}
```

#### DELETE /api/compliance/unmatch (신규)
매칭 취소 + 사유 기록

**Request Body**:
```json
{
  "year": 2024,
  "target_key": "KEY-001",
  "management_numbers": ["119-DG-001"],
  "reason": "잘못 매칭됨" // 타인이 매칭한 경우 필수
}
```

**Response**:
```json
{
  "success": true,
  "unmatched_count": 1,
  "log_id": "uuid-xxx"
}
```

#### GET /api/compliance/match-log (신규)
매칭/취소 히스토리 조회

**Query Parameters**:
- `target_key`: 의무기관 키 (선택)
- `management_number`: 관리번호 (선택)
- `limit`: 페이지당 개수

**Response**:
```json
{
  "logs": [
    {
      "id": "uuid-xxx",
      "action": "match" | "unmatch",
      "target_key": "KEY-001",
      "management_numbers": ["119-DG-001"],
      "user_id": "user-xxx",
      "user_name": "홍길동",
      "reason": "잘못 매칭됨",
      "created_at": "2024-11-11T10:00:00Z"
    }
  ]
}
```

### 4.2 데이터베이스 쿼리

#### 미매칭 기관 목록 조회
```sql
SELECT
  t.target_key,
  t.institution_name,
  t.sido,
  t.gugun,
  t.division,
  t.sub_division,
  COUNT(DISTINCT tld.equipment_serial) as matched_count
FROM target_list_2024 t
LEFT JOIN target_list_devices tld
  ON t.target_key = tld.target_institution_id
  AND tld.target_list_year = 2024
GROUP BY t.target_key, ...
HAVING COUNT(DISTINCT tld.equipment_serial) = 0
ORDER BY t.sido, t.gugun, t.institution_name
LIMIT ? OFFSET ?
```

#### AED 후보 조회 (지역 기반)
```sql
SELECT
  ad.equipment_serial,
  ad.institution_name,
  ad.sido,
  ad.gugun,
  ad.address_detail,
  ad.location,
  mngm.auto_confidence_2024 as confidence,
  mngm.auto_matching_reason_2024 as matching_reason
FROM aed_data ad
LEFT JOIN management_number_group_mapping mngm
  ON ad.management_number = mngm.management_number
WHERE ad.sido = ?
  AND ad.gugun = ?
  AND NOT EXISTS (
    SELECT 1 FROM target_list_devices tld
    WHERE tld.equipment_serial = ad.equipment_serial
    AND tld.target_list_year = 2024
  )
ORDER BY mngm.auto_confidence_2024 DESC NULLS LAST
LIMIT 100
```

#### 매칭 저장
```sql
INSERT INTO target_list_devices (
  target_list_year,
  target_institution_id,
  equipment_serial,
  matching_method,
  matched_by,
  matched_at
) VALUES (?, ?, ?, 'manual', ?, NOW())
ON CONFLICT (target_list_year, equipment_serial)
DO NOTHING
```

---

## 5. 컴포넌트 구조

### 5.1 파일 구조
```
app/(authenticated)/admin/obligation-matching/
├── page.tsx                          # 페이지 래퍼
├── ObligationMatchingClient.tsx      # 메인 클라이언트 컴포넌트
└── components/
    ├── InstitutionList.tsx           # 좌측 기관 목록
    ├── InstitutionCard.tsx           # 기관 카드
    ├── AEDCandidateList.tsx          # 우측 AED 목록
    ├── AEDCandidateCard.tsx          # AED 카드
    ├── MatchingProgress.tsx          # 진행률 표시
    └── MatchingConfirmDialog.tsx     # 매칭 확인 다이얼로그

app/api/obligation-matching/
├── institutions/route.ts             # 기관 목록 API
├── aed-candidates/route.ts           # AED 후보 API
└── match/route.ts                    # 매칭 처리 API
```

### 5.2 주요 컴포넌트 인터페이스

#### ObligationMatchingClient.tsx
```tsx
interface ObligationMatchingClientProps {
  year: 2024 | 2025;
}

interface State {
  selectedInstitution: Institution | null;
  selectedAEDs: string[];  // equipment_serials
  searchLeft: string;
  searchRight: string;
}
```

#### InstitutionList.tsx
```tsx
interface InstitutionListProps {
  year: number;
  onSelect: (institution: Institution) => void;
  onSearch: (query: string) => void;
}
```

#### AEDCandidateList.tsx
```tsx
interface AEDCandidateListProps {
  targetKey: string | null;
  selectedSerials: string[];
  onToggle: (serial: string) => void;
  onSelectAll: (serials: string[]) => void;
  onMatch: () => void;
}
```

---

## 6. 구현 단계 (3단 구조 기반 - 최종안)

### Phase 1: 설계 및 승인
- [x] 기존 컴포넌트 구조 분석 (EnhancedComplianceUI.tsx)
- [x] 사용자 요구사항 수집
- [x] 3단 구조 UI 설계
- [x] API 엔드포인트 설계
- [x] 상세 개선 계획 수립
- [ ] 사용자 최종 확인 및 승인

### Phase 2: 데이터베이스 및 API 구현
- [ ] **매칭 로그 테이블 추가** (target_list_match_logs)
  - action: match/unmatch
  - user_id, target_key, management_numbers
  - reason (타인 매칭 취소 시)
  - timestamp
- [ ] **GET /api/compliance/institutions** (수정)
  - 미매칭 필터 추가 (디폴트)
  - 전체 조회 옵션
- [ ] **GET /api/compliance/management-number-candidates** (신규)
  - 자동 추천 + 검색 결과 통합
  - 매칭 상태 표시
  - 지역 필터 (확장 가능)
- [ ] **POST /api/compliance/match-basket** (신규)
  - 담기 박스 항목 일괄 매칭
  - 로그 기록
- [ ] **DELETE /api/compliance/unmatch** (신규)
  - 매칭 취소
  - 타인 매칭 시 사유 필수 검증
  - 로그 기록
- [ ] **GET /api/compliance/match-log** (신규)
  - 히스토리 조회
- [ ] API 단위 테스트

### Phase 3: UI 컴포넌트 구현
- [ ] **3단 레이아웃 구조 생성**
  - 1단: InstitutionList (기존 수정)
  - 2단: ManagementNumberList (신규)
  - 3단: BasketPanel (신규)
- [ ] **1단 - 의무설치기관 패널**
  - 미매칭 필터 (디폴트)
  - 검색 기능
  - 클릭 시 2단 활성화
- [ ] **2단 - 관리번호 리스트 패널**
  - [자동 추천] [검색] 탭
  - 체크박스 선택
  - [담기] 버튼
  - [전지역 조회] 체크박스
  - 매칭된 항목 비활성 표시 (검색 시)
- [ ] **3단 - 담기 박스 패널**
  - 담긴 항목 리스트
  - [깨내기] 버튼
  - [담기 전체 매칭하기] 버튼
  - 선택 카운터
- [ ] **키보드 단축키 완전 제거**
  - 기존 키보드 이벤트 핸들러 삭제
  - useEffect cleanup

### Phase 4: 매칭 취소 및 사유 기록
- [ ] 매칭된 항목 조회 UI
- [ ] 매칭 취소 다이얼로그
  - 자신의 매칭: 바로 취소
  - 타인의 매칭: 사유 입력 필수
- [ ] 매칭 히스토리 보기 모달
- [ ] 로그 기록 및 조회 기능

### Phase 5: 통합 테스트
- [ ] 전체 워크플로우 테스트
  - 1단 클릭 → 2단 표시
  - 2단 선택 → 담기 → 3단 추가
  - 3단 확인 → 매칭 → 1단 제거
- [ ] 매칭 취소 플로우 테스트
- [ ] 지역 필터 확장 테스트
- [ ] 미매칭 필터 테스트
- [ ] 에러 핸들링
  - 중복 매칭 방지
  - 동시성 충돌
  - 권한 검증
- [ ] 로딩 상태 처리

### Phase 6: 배포 및 모니터링
- [ ] 스테이징 환경 테스트
- [ ] 사용자 UAT
- [ ] 프로덕션 배포
- [ ] 사용자 가이드 작성
- [ ] 피드백 수집 및 버그 수정

---

## 7. 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Library**: shadcn/ui (Card, Checkbox, Button, Input, Badge)
- **State Management**: React Query (tanstack/react-query)
- **Backend**: Next.js API Routes
- **Database**: NCP PostgreSQL, Prisma ORM

---

## 8. 예상 이슈 및 해결책

### 이슈 1: "-Infinity%" 배지 문제
**원인**: 자동 매칭 신뢰도 계산 오류 또는 데이터 누락
**해결책**:
- 신뢰도가 NULL이거나 비정상 값일 때 "데이터 없음" 표시
- 자동 매칭 알고리즘 검증 필요

### 이슈 2: 대용량 AED 목록 성능
**원인**: 한 기관당 수백 개의 AED 후보가 있을 수 있음
**해결책**:
- 페이지네이션 또는 무한 스크롤
- 가상 스크롤 (react-window)
- 지역 기반 필터링 최적화

### 이슈 3: 동시 매칭 충돌
**원인**: 여러 사용자가 동시에 같은 AED를 매칭할 수 있음
**해결책**:
- `target_list_devices` 테이블에 UNIQUE 제약 (`target_list_year + equipment_serial`)
- ON CONFLICT DO NOTHING 처리
- 프론트엔드에서 에러 메시지 표시

### 이슈 4: 매칭 취소 로직
**원인**: 실수로 잘못 매칭한 경우 되돌리기 필요
**해결책**:
- DELETE API 구현
- 매칭 히스토리 기록 (audit log)
- 관리자 권한 필요 검증

---

## 9. 데이터 마이그레이션

### 기존 자동 매칭 데이터 처리
현재 `management_number_group_mapping`에 저장된 자동 매칭 데이터는 유지하되,
새로운 수동 매칭 UI에서는 참고용으로만 사용합니다.

**통합 전략**:
1. 자동 추천 AED에 별도 배지 표시
2. 자동 매칭 확정 기능은 유지 (별도 메뉴)
3. 수동 매칭 UI에서 자동 추천 데이터 활용

---

## 10. 테스트 계획

### 단위 테스트
- [ ] API 엔드포인트 테스트
- [ ] 컴포넌트 렌더링 테스트
- [ ] 매칭 로직 유닛 테스트

### 통합 테스트
- [ ] 전체 매칭 플로우 E2E 테스트
- [ ] 검색 기능 테스트
- [ ] 동시성 테스트 (충돌 시나리오)

### 사용자 테스트
- [ ] 실제 사용자 피드백 수집
- [ ] A/B 테스트 (자동 vs 수동)

---

## 11. 타임라인 (수정안)

| 단계 | 예상 소요 시간 | 담당 | 설명 |
|------|----------------|------|------|
| Phase 1: 분석 및 설계 | 1일 | Product + Dev | 사용자 확인 및 상세 설계 |
| Phase 2: API 개선 | 2일 | Backend Dev | 검색/매칭/취소 API |
| Phase 3: UI 개선 | 3일 | Frontend Dev | 탭/체크박스/버튼 |
| Phase 4: 매칭 취소 | 1일 | Full Stack | 취소 기능 구현 |
| Phase 5: 통합 테스트 | 2일 | QA + Dev | 전체 플로우 테스트 |
| Phase 6: 배포 | 1일 | DevOps | UAT + 프로덕션 배포 |
| **총계** | **10일** | | |

---

## 12. 핵심 결정 사항 (최종 확정)

### 1. 레이아웃 구조
- **결정**: 3단 구조 (의무설치기관 + 관리번호 리스트 + 담기 박스)
- **이유**:
  - 선택 → 담기 → 매칭 워크플로우로 실수 방지
  - 최종 확인 단계 제공 (담기 박스)
  - 사용자 피드백 직접 반영

### 2. 키보드 단축키
- **결정**: 완전 삭제
- **이유**:
  - 현재 제대로 작동하지 않음
  - 전체 확인/거부 개념이 의미 없음 (담기 워크플로우와 충돌)
  - 필요시 추후 재구축

### 3. 담기 워크플로우
- **결정**: 2단에서 선택 → [담기] → 3단에 추가 → [매칭하기]
- **이유**:
  - 명확한 선택 과정
  - 실수 방지 (담기 박스에서 최종 확인)
  - 추가/제거 유연성

### 4. 매칭 취소 권한
- **결정**: 모두 가능 + 타인 매칭 취소 시 사유 필수
- **이유**:
  - 유연한 오류 복구
  - 타인 매칭 취소 시 책임성 확보
  - 로그로 추적 가능

### 5. 필터링 정책
- **결정**:
  - 의무설치기관: 디폴트 미매칭만 (옵션으로 전체)
  - 관리번호 리스트: 미매칭만 (검색 시 매칭된 것 비활성 표시)
  - 지역: 기본 제한 + 전지역 조회 옵션
- **이유**:
  - 작업 효율성 (완료된 것 제외)
  - 필요시 확장 가능
  - 실수 방지 (매칭된 것 재매칭 방지)

---

## 13. 다음 단계

### 즉시 필요 사항
1. ✅ **사용자 피드백 반영 완료**
   - 3단 구조 확정
   - 키보드 단축키 삭제 확정
   - 담기 워크플로우 확정
   - 매칭 취소 + 사유 기록 확정
   - 필터링 정책 확정

2. **사용자 최종 승인 대기**
   - 이 문서 검토
   - 3단 구조 UI 디자인 확인
   - API 설계 확인
   - 구현 단계 확인

3. **개발 시작 조건**
   - 사용자 승인 후 Phase 2 (DB + API) 착수
   - 예상 소요: 10일

---

## 14. 최종 요약

**현재 상태**:
- `/admin/compliance` 경로에 EnhancedComplianceUI 구현됨 (922줄)
- 2단 구조 (의무설치기관 + 자동 매칭 결과)
- 키보드 단축키 (작동 불량)
- 매칭 취소 기능 없음

**개선 목표 (사용자 피드백 반영)**:
1. **3단 구조로 전환**
   - 1단: 의무설치기관 (미매칭만)
   - 2단: 관리번호 리스트 (자동 추천 + 검색)
   - 3단: 담기 박스 (최종 확인)

2. **담기 워크플로우 도입**
   - 선택 → 담기 → 확인 → 매칭
   - 실수 방지 및 유연성 확보

3. **키보드 단축키 완전 삭제**
   - 현재 작동 불량
   - 담기 워크플로우와 충돌

4. **매칭 취소 + 사유 기록**
   - 모두 취소 가능
   - 타인 매칭 취소 시 사유 필수
   - 로그로 추적 가능

5. **필터링 정책**
   - 디폴트: 미매칭만 표시
   - 옵션: 전체 조회, 전지역 조회
   - 검색: 매칭된 것 비활성 표시

**예상 효과**:
- 명확한 워크플로우로 실수 방지
- 담기 박스로 최종 확인 단계 제공
- 유연한 매칭 취소 및 오류 복구
- 효율적인 필터링으로 작업 속도 향상

**예상 일정**: 10일 (Phase 1~6)

**핵심 변경점**:
```
Before: [기관 선택] → [키보드 1/2] → [즉시 확정]
After:  [기관 선택] → [관리번호 체크] → [담기] → [확인] → [매칭]
```

---

**문서 작성자**: Claude Code AI
**최종 업데이트**: 2025-11-11 (V3 - 사용자 피드백 반영)
**상태**: 사용자 최종 승인 대기
**다음**: Phase 2 - 데이터베이스 및 API 구현
