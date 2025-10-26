# Tutorial2 기능 우선순위 매트릭스

## 🎯 **Spec-Kit 방식: What/Why/How 우선순위**

### High Priority (즉시 개선) - Phase 1

#### 1. 코드 품질 개선 ⭐⭐⭐⭐⭐
```typescript
/specify "4000+ 라인 코드를 유지보수 가능한 구조로 리팩토링"
```
- **What**: 커스텀 훅 분리, 컴포넌트 모듈화
- **Why**: 향후 기능 추가 시 개발 속도 3배 향상
- **Impact**: 개발 효율성 극대화
- **Effort**: Medium (2-3주)

#### 2. 실제 데이터 통합 ⭐⭐⭐⭐⭐  
```typescript
/specify "261개 보건소와 실제 AED 데이터를 튜토리얼에 반영"
```
- **What**: 실제 기관명, AED 모델, 지역 데이터
- **Why**: 사용자들이 실제 업무와 동일한 경험
- **Impact**: 사용자 몰입도 및 교육 효과 극대화
- **Effort**: Low (1주)

#### 3. 성능 최적화 ⭐⭐⭐⭐
```typescript
/specify "2초 이내 로딩, 250명 동시 접속 지원 수준 달성"
```
- **What**: React.memo, useMemo, 이미지 최적화
- **Why**: 실제 서비스 수준의 성능 검증
- **Impact**: 사용자 경험 개선
- **Effort**: Medium (1-2주)

### Medium Priority (Phase 2) 

#### 4. 오프라인 기능 고도화 ⭐⭐⭐⭐
```typescript
/specify "완벽한 오프라인 모드로 실제 현장 상황 시뮬레이션"
```
- **What**: IndexedDB, 완전한 동기화 시뮬레이션
- **Why**: 현장에서 네트워크 불안정 시 대응 능력 검증
- **Impact**: 실제 사용 시나리오 완성도
- **Effort**: High (2-3주)

#### 5. 다양한 시나리오 추가 ⭐⭐⭐
```typescript
/specify "계절별, 지역별, 상황별 다양한 점검 시나리오 제공"
```
- **What**: 겨울철 배터리 이슈, 해안가 염분 문제 등
- **Why**: 실제 현장의 모든 상황 사전 체험
- **Impact**: 실무 준비도 향상
- **Effort**: Medium (2주)

#### 6. 에러 처리 시나리오 ⭐⭐⭐
```typescript
/specify "실제 발생 가능한 모든 오류 상황 튜토리얼에서 체험"
```
- **What**: 네트워크 오류, 데이터 손실, 동기화 충돌
- **Why**: 오류 상황 대응 능력 사전 훈련
- **Impact**: 시스템 안정성 검증
- **Effort**: Medium (1-2주)

### Low Priority (Phase 3)

#### 7. 고급 분석 기능 ⭐⭐
```typescript
/specify "사용자 행동 패턴 분석 및 개선점 도출"
```
- **What**: 사용 시간, 클릭 패턴, 오류 빈도 분석
- **Why**: 데이터 기반 UX 개선
- **Impact**: 장기적 최적화
- **Effort**: High (3-4주)

#### 8. 접근성 개선 ⭐⭐
```typescript
/specify "모든 사용자가 접근 가능한 inclusive design"
```
- **What**: 스크린 리더, 키보드 내비게이션 지원
- **Why**: 포용적 사용자 경험
- **Impact**: 사용자 범위 확대
- **Effort**: Medium (2주)

## 📊 **우선순위 결정 기준**

### Impact vs Effort Matrix
```
High Impact, Low Effort (Quick Wins):
✅ 실제 데이터 통합
✅ 기본 성능 최적화

High Impact, High Effort (Major Projects):
🔄 코드 품질 개선
🔄 오프라인 기능 고도화

Low Impact, Low Effort (Fill-ins):
📝 UI 미세 조정
📝 텍스트 개선

Low Impact, High Effort (Avoid):
❌ 과도한 애니메이션
❌ 불필요한 기능 추가
```

## 🚀 **Next 2 Weeks Action Plan**

### Week 1: Quick Wins
1. **실제 데이터 통합** (2-3일)
   - 261개 보건소 실제 명단
   - 주요 AED 제조사/모델 정보
   - 지역별 특성 데이터

2. **기본 성능 최적화** (2-3일)
   - 불필요한 리렌더링 제거
   - 이미지 최적화
   - 코드 스플리팅 적용

### Week 2: Foundation Building  
1. **코드 모듈화 시작** (5일)
   - 가장 큰 함수들 분리
   - 커스텀 훅 3개 생성
   - 컴포넌트 5개 추출

2. **테스트 환경 구축** (2일)
   - 자동 테스트 스크립트
   - 성능 측정 도구

## 💡 **Success Metrics by Priority**

### High Priority Metrics
- 코드 복잡도: 50% 감소
- 로딩 시간: 2초 이내
- 사용자 만족도: 4.5/5.0

### Medium Priority Metrics  
- 오프라인 완성도: 95%
- 시나리오 커버리지: 80%
- 오류 처리 완성도: 90%

### Low Priority Metrics
- 접근성 점수: WCAG 2.1 AA
- 분석 데이터 정확도: 95%

---

**핵심 철학**: "Perfect the essentials first, enhance the experience second"

*우선순위는 실제 사용자 가치와 개발 효율성을 기준으로 지속적으로 조정*