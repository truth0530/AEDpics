# 성능 최적화 긴급 수정 가이드

> **⚠️ 이 문서는 아카이브되었습니다**
>
> **아카이브 날짜**: 2025년 10월 17일
> **이유**: 내용 통합 및 Phase 0 완료
> **최신 문서**: [PERFORMANCE_OPTIMIZATION_MASTER.md](../PERFORMANCE_OPTIMIZATION_MASTER.md)

---

**작성일**: 2025-10-16
**예상 소요**: 30분
**우선순위**: 🔴 P0 - 즉시 적용
**목표**: 잘못된 캐싱 설정 수정으로 실시간성 복원

---

## 🎯 목표

현재 시스템의 캐싱 설정이 문서 권장사항과 **정반대**로 구현되어 있습니다.

**문제**:
- ❌ 실시간 동기화 차단 (`refetchOnWindowFocus: false`)
- ❌ 오래된 데이터 표시 (`refetchOnMount: false`)
- ❌ 과도한 캐시 시간 (5분)

**목표**:
- ✅ 실시간 동기화 활성화
- ✅ 최신 데이터 보장
- ✅ 적절한 캐시 시간 (1분)

---

## 📋 수정 파일 목록

1. ✅ `app/providers.tsx` - 전역 캐싱 설정
2. ✅ `app/aed-data/components/AEDDataProvider.tsx` - 중복 설정 제거

---

## 🔧 수정 1: 전역 캐싱 설정

### 파일: `app/providers.tsx`

#### Before (현재 - 잘못됨)

```typescript
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ❌ 실시간 동기화 차단
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false,
            
            // ❌ 과도한 캐시
            staleTime: 5 * 60 * 1000,  // 5분
            gcTime: 10 * 60 * 1000,     // 10분
            
            retry: 1,
            retryDelay: 1000,
          },
        },
      }),
  );

  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  );
}
```

#### After (수정 - 올바름)

```typescript
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ 실시간 동기화 활성화
            refetchOnWindowFocus: true,   // false → true
            refetchOnReconnect: true,     // OK (유지)
            refetchOnMount: true,          // false → true
            
            // ✅ 적절한 캐시 시간
            staleTime: 1 * 60 * 1000,     // 5분 → 1분
            gcTime: 5 * 60 * 1000,        // 10분 → 5분
            
            retry: 1,                      // OK (유지)
            retryDelay: 1000,             // OK (유지)
          },
        },
      }),
  );

  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  );
}
```

#### 변경 사항 요약

| 설정 | Before | After | 변경 이유 |
|------|--------|-------|----------|
| `refetchOnWindowFocus` | `false` | `true` | 탭 전환 시 최신 데이터 갱신 |
| `refetchOnMount` | `false` | `true` | 페이지 재진입 시 최신 데이터 보장 |
| `staleTime` | `5분` | `1분` | 실시간 데이터에 적합한 캐시 시간 |
| `gcTime` | `10분` | `5분` | 메모리 효율성 개선 |

---

## 🔧 수정 2: 중복 설정 제거

### 파일: `app/aed-data/components/AEDDataProvider.tsx`

#### Before (Line 218-228 - 중복 설정 있음)

```typescript
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => {
    const url = `/api/aed-data${queryString}`;
    console.log('[AEDDataProvider queryFn] About to fetch:', url);
    return fetcher(url);
  },
  placeholderData: keepPreviousData,
  staleTime: 1000 * 30,      // ❌ 개별 설정 (전역과 충돌)
  gcTime: 1000 * 60 * 5,     // ❌ 개별 설정 (전역과 충돌)
});
```

#### After (중복 설정 제거)

```typescript
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => {
    const url = `/api/aed-data${queryString}`;
    console.log('[AEDDataProvider queryFn] About to fetch:', url);
    return fetcher(url);
  },
  placeholderData: keepPreviousData,
  // ✅ 전역 설정 사용 (개별 설정 제거)
  // staleTime과 gcTime은 providers.tsx의 전역 설정 상속
});
```

#### 변경 사항 요약

- ❌ 제거: `staleTime: 1000 * 30` (30초 개별 설정)
- ❌ 제거: `gcTime: 1000 * 60 * 5` (5분 개별 설정)
- ✅ 유지: `placeholderData: keepPreviousData` (부드러운 UX)

**이유**: 전역 설정과 개별 설정이 충돌하면 예측 불가능한 동작 발생

---

## 🧪 테스트 방법

### 1. 로컬 테스트

```bash
# 개발 서버 재시작
npm run dev

# 브라우저에서 http://localhost:3000/aed-data 접속
```

### 2. 실시간 동기화 테스트

**시나리오 1: 탭 전환 시 자동 갱신**

```
1. 브라우저 탭 1에서 /aed-data 페이지 열기
2. 브라우저 탭 2에서 장비 추가 또는 일정추가
3. 탭 1으로 전환
4. ✅ 확인: 자동으로 새로운 데이터 로딩됨 (refetchOnWindowFocus: true)
```

**Before**: 5분간 변경 사항 반영 안됨 ❌  
**After**: 즉시 자동 갱신 ✅

---

**시나리오 2: 페이지 재진입 시 최신 데이터**

```
1. /aed-data 페이지 방문 (데이터 캐시됨)
2. 다른 페이지로 이동 (예: /profile)
3. 30초 이내 /aed-data 재방문
4. ✅ 확인: 최신 데이터 조회 (refetchOnMount: true)
```

**Before**: 오래된 캐시 데이터 표시 ❌  
**After**: 항상 최신 데이터 ✅

---

### 3. 캐시 동작 확인

```bash
# Chrome DevTools 열기 (F12)
# Network 탭 선택

# 테스트:
1. /aed-data 페이지 진입
   → API 호출 1회 (최초 로딩)

2. 30초 대기

3. 필터 변경 (예: 시도 선택)
   → API 호출 1회 (1분 이내 캐시 무효화)

4. 30초 이내 다시 필터 변경
   → API 호출 없음 (캐시 사용)

5. 1분 대기 후 필터 변경
   → API 호출 1회 (staleTime 만료)
```

**예상 결과**: 
- ✅ 1분 이내: 캐시 사용 (빠름)
- ✅ 1분 경과: API 호출 (최신 데이터)

---

## 📊 예상 효과

### 사용자 경험 개선

| 시나리오 | Before | After | 개선 |
|---------|--------|-------|------|
| **탭 전환 시** | 5분간 갱신 안됨 | 즉시 자동 갱신 | ✅ 실시간성 복원 |
| **페이지 재방문** | 오래된 데이터 | 최신 데이터 | ✅ 데이터 정확성 |
| **캐시 효율** | 5분 (과도함) | 1분 (적절함) | ✅ 균형 개선 |

### 기술적 개선

```
실시간 동기화:
Before: 5분 지연 → 사용자 혼란
After: 즉시 갱신 → 일관된 경험

캐시 효율:
Before: 5분 캐시 → 오래된 데이터 위험
After: 1분 캐시 → 신선도 + 성능 균형

설정 일관성:
Before: 전역 vs 개별 충돌
After: 전역 설정 통일 → 예측 가능
```

---

## ⚠️ 주의사항

### 1. API 호출 증가?

**우려**: `refetchOnWindowFocus: true`로 인한 API 호출 증가?

**답변**: ❌ 문제 없음

```typescript
staleTime: 1 * 60 * 1000  // 1분

// 동작:
// 1. 탭 전환 시도
// 2. 마지막 조회 후 1분 이내? → API 호출 안함 (캐시 사용)
// 3. 마지막 조회 후 1분 경과? → API 호출 (갱신 필요)

// 결과: 불필요한 API 호출 없음
```

### 2. 성능 저하?

**우려**: 자주 갱신하면 느려지지 않나?

**답변**: ❌ 오히려 개선

```
Before:
- 5분간 갱신 안함 → 한 번에 많은 변경 사항 로드 → 느림

After:
- 1분마다 점진적 갱신 → 적은 변경 사항 로드 → 빠름
```

### 3. 롤백 계획

문제 발생 시:

```bash
# 1. Git으로 이전 상태 복구
git diff HEAD app/providers.tsx

# 2. 문제 있으면 롤백
git checkout HEAD -- app/providers.tsx
git checkout HEAD -- app/aed-data/components/AEDDataProvider.tsx

# 3. 개발 서버 재시작
npm run dev
```

---

## 🚀 배포 절차

### 1. 로컬 검증 완료 후

```bash
# 빌드 테스트
npm run build

# 빌드 성공 확인
# ✓ Compiled successfully
```

### 2. Git 커밋

```bash
git add app/providers.tsx
git add app/aed-data/components/AEDDataProvider.tsx

git commit -m "fix: 캐싱 전략 수정 - 실시간 동기화 복원

- refetchOnWindowFocus: false → true (탭 전환 시 자동 갱신)
- refetchOnMount: false → true (페이지 재방문 시 최신 데이터)
- staleTime: 5분 → 1분 (적절한 캐시 시간)
- gcTime: 10분 → 5분 (메모리 효율성)
- AEDDataProvider 중복 설정 제거 (전역 설정 상속)

문제:
- 사용자가 탭 전환 후에도 오래된 데이터 표시됨
- 5분간 변경사항 반영 안됨

해결:
- 실시간 동기화 활성화
- 1분 캐시로 신선도와 성능 균형

참고: docs/SPEEDUP_IMPLEMENTATION_GUIDE.md Phase 1

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

### 3. 푸시 및 배포

```bash
# GitHub 푸시
git push origin main

# Vercel 자동 배포 (2-3분)
```

### 4. 프로덕션 검증

```
배포 완료 후:
1. www.aed.pics/aed-data 접속
2. 탭 전환 시 자동 갱신 확인
3. 필터 변경 시 정상 작동 확인
4. 일정추가 기능 정상 작동 확인
```

---

## 📈 효과 측정

### Before 측정 (수정 전)

```markdown
## 현재 동작 (수정 전)

### 탭 전환 테스트
- 탭 1에서 장비 추가
- 탭 2로 전환
- 결과: 5분간 반영 안됨 ❌

### 캐시 동작
- 페이지 방문 후 4분 후 재방문
- 결과: 오래된 데이터 표시 ❌
```

### After 측정 (수정 후)

```markdown
## 개선된 동작 (수정 후)

### 탭 전환 테스트
- 탭 1에서 장비 추가
- 탭 2로 전환
- 결과: 즉시 자동 갱신 ✅

### 캐시 동작
- 페이지 방문 후 30초 이내 재방문
- 결과: 캐시 사용 (빠름) ✅
- 1분 경과 후 재방문
- 결과: 최신 데이터 조회 ✅
```

---

## ✅ 체크리스트

### 수정 전

- [ ] 현재 동작 스크린샷 저장
- [ ] Git branch 생성 (선택)
- [ ] 이 문서 읽기 완료

### 수정

- [ ] `app/providers.tsx` 수정
  - [ ] `refetchOnWindowFocus: false → true`
  - [ ] `refetchOnMount: false → true`
  - [ ] `staleTime: 5분 → 1분`
  - [ ] `gcTime: 10분 → 5분`

- [ ] `app/aed-data/components/AEDDataProvider.tsx` 수정
  - [ ] `staleTime: 1000 * 30` 제거
  - [ ] `gcTime: 1000 * 60 * 5` 제거

### 테스트

- [ ] 로컬 개발 서버 재시작
- [ ] 탭 전환 시 자동 갱신 확인
- [ ] 페이지 재방문 시 최신 데이터 확인
- [ ] 필터 변경 정상 작동 확인
- [ ] 일정추가 기능 정상 작동 확인

### 배포

- [ ] `npm run build` 성공 확인
- [ ] Git 커밋
- [ ] Git 푸시
- [ ] Vercel 배포 완료 대기
- [ ] 프로덕션 검증

### 문서화

- [ ] Before/After 스크린샷
- [ ] 측정 결과 기록
- [ ] 팀원 공유

---

## 🎯 완료 기준

**성공**:
- ✅ 탭 전환 시 즉시 자동 갱신
- ✅ 페이지 재방문 시 최신 데이터
- ✅ 캐시 효율적 사용 (1분)
- ✅ 기존 기능 모두 정상 작동

**실패 (롤백 필요)**:
- ❌ 무한 로딩
- ❌ API 에러 증가
- ❌ 일정추가 기능 오작동

---

## 📞 문제 발생 시

### 증상 1: 무한 로딩

```
원인: API 에러 또는 쿼리 키 문제
해결: 
1. Console 에러 확인
2. Network 탭에서 API 응답 확인
3. 필요 시 롤백
```

### 증상 2: 너무 많은 API 호출

```
원인: staleTime 설정 오류
해결:
1. staleTime이 1분인지 확인
2. queryKey가 불필요하게 변경되지 않는지 확인
```

### 증상 3: 여전히 오래된 데이터

```
원인: 브라우저 캐시
해결:
1. 하드 리프레시 (Cmd+Shift+R)
2. 개발자 도구 → Application → Clear storage
3. 재확인
```

---

## 📚 참고 문서

- 📄 [SPEEDUP_IMPLEMENTATION_GUIDE.md](../SPEEDUP_IMPLEMENTATION_GUIDE.md) - 전체 최적화 계획
- 📄 [SPEEDUP_IMPLEMENTATION_AUDIT.md](./SPEEDUP_IMPLEMENTATION_AUDIT.md) - 구현 감사 보고서
- 📄 [React Query Docs](https://tanstack.com/query/latest/docs/react/guides/window-focus-refetching) - 공식 문서

---

**예상 소요**: 30분  
**난이도**: ⭐ (쉬움)  
**영향도**: 🔴 높음 (사용자 경험 직접 개선)  
**롤백 가능**: ✅ 언제든지

**시작하세요!** 🚀
