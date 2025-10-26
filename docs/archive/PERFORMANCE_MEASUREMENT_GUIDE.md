# 📊 Phase 0: 성능 측정 가이드 (Before 데이터 수집)

**소요 시간**: 1-2시간  
**목적**: 개선 전후 비교 데이터 확보

---

## ✅ 체크리스트

### 1. Chrome DevTools 성능 측정

#### 📝 측정 순서
```
1. 브라우저 개발자 도구 열기 (F12 또는 Cmd+Option+I)
2. Performance 탭 선택
3. 캐시 비우기 및 새로고침 (Ctrl+Shift+R / Cmd+Shift+R)
4. 녹화 시작 (●) → 페이지 로딩 완료 후 5초 대기 → 정지 (■)
5. Screenshots 활성화하여 시각적 로딩 과정 확인
6. 스크린샷 저장 (폴더: docs/performance-before/)
```

#### 📊 측정할 핵심 지표

| 지표 | 설명 | 목표 기준 | 측정 위치 |
|------|------|----------|----------|
| **FCP** | First Contentful Paint | < 1.8초 | Performance 탭 → Timings |
| **LCP** | Largest Contentful Paint | < 2.5초 | Performance 탭 → Timings |
| **TTI** | Time to Interactive | < 3.8초 | Performance 탭 → Timings |
| **TBT** | Total Blocking Time | < 300ms | Performance 탭 → Summary |

---

### 2. 재현 시나리오 측정

#### 시나리오 1: aed-data 페이지 진입
```
1. 로그인 완료 상태에서 시작
2. Network 탭 열기 → "Preserve log" 체크
3. 사이드바에서 "AED 데이터" 메뉴 클릭
4. 페이지 로딩 완료까지 대기
5. Network 탭에서 각 요청 시간 확인:
   - /api/aed-data: ______초
   - /api/user-profiles: ______초
   - 기타 API 호출: ______초
6. 총 소요 시간: ______초
```

#### 시나리오 2: 추가 버튼 클릭
```
1. aed-data 페이지에서 장비 1개 선택
2. "추가" 버튼 클릭
3. 스톱워치 시작
4. "처리중" 메시지 → "완료" 메시지까지 시간 측정: ______초
5. Network 탭에서 /api/inspections/assignments 응답 시간: ______초
```

#### 시나리오 3: 대량 추가 50개
```
1. aed-data 페이지에서 장비 50개 선택
2. "추가" 버튼 클릭
3. 완료까지 시간 측정: ______초
4. Network 탭에서 요청 횟수 확인: ______개
```

#### 시나리오 4: inspection 페이지 진입
```
1. 사이드바에서 "점검" 메뉴 클릭
2. 페이지 로딩 완료까지 시간 측정: ______초
3. Network 탭에서 /api/inspections/assignments 응답 시간: ______초
```

#### 시나리오 5: 점검 세션 시작
```
1. inspection 페이지에서 "점검 시작" 버튼 클릭
2. 세션 화면 표시까지 시간 측정: ______초
3. Network 탭에서 /api/inspections/sessions 응답 시간: ______초
```

---

### 3. Before 데이터 정리

#### 📋 측정 결과 표

| 시나리오 | 측정 항목 | Before (현재) | After (목표) | 개선율 |
|---------|---------|--------------|-------------|--------|
| aed-data 진입 | 페이지 로드 완료 | ______초 | 1-2초 | ____% |
| 추가 버튼 | 클릭 → 완료 메시지 | ______초 | 0.1초 (UI) + 2초 (백그라운드) | ____% |
| 추가완료 탭 | 탭 전환 → 데이터 표시 | 새로고침 필요 | 즉시 (0ms) | 100% |
| inspection 진입 | 페이지 로드 완료 | ______초 | 1-2초 | ____% |
| 점검 세션 시작 | 버튼 클릭 → 세션 화면 | ______초 | 2초 | ____% |
| 대량 추가 50개 | 완료까지 시간 | ______초 | 3초 | ____% |

---

### 4. 스크린샷 저장

다음 파일명으로 저장:
```
docs/performance-before/
  ├── 01-aed-data-performance.png
  ├── 02-aed-data-network.png
  ├── 03-add-button-network.png
  ├── 04-inspection-performance.png
  ├── 05-inspection-session-network.png
  └── measurement-summary.txt
```

---

## 🚀 다음 단계

Phase 0 측정 완료 후 → Phase 1 코드 수정 시작

Phase 1 작업 예상:
1. ✅ AEDDataProvider staleTime 조정 (30분)
2. ✅ 추가 버튼 낙관적 업데이트 (1-2시간)
3. ✅ 대량 추가 배치 최적화 (1-2시간)
4. ✅ 일정 추가 API 병렬 쿼리 (2-3시간)
5. ✅ 핵심 DB 인덱스 추가 (30분-1시간)

**총 예상 소요**: 반나절 ~ 1일
