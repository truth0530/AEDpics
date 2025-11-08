# Pre-Deployment Validation Skill

## Purpose
배포 전에 필수 검사를 모두 통과했는지 자동으로 검증합니다. 다운타임 방지와 프로덕션 안정성을 보장합니다.

## 필수 검사 항목

### 1단계: TypeScript 타입 검사
```bash
npm run tsc
```

**검사 목표:**
- TypeScript 컴파일 오류 없음
- 모든 타입이 올바르게 정의됨
- any 타입 사용 없음
- 없는 모듈/변수 참조 없음

**실패 시 조치:**
```
❌ FAILED: npm run tsc
에러: TS2305 - Module has no exported member 'getAvailableRegions'

해결 방법:
1. 컴파일 에러 메시지 확인
2. 해당 파일 수정
3. 재실행 (npm run tsc)
```

### 2단계: ESLint 검사
```bash
npm run lint
```

**검사 목표:**
- 코드 스타일 준수
- 미사용 변수/import 제거
- React hooks 의존성 검증
- 프로젝트 규칙 준수

**실패 시 조치:**
```bash
# 자동 수정 가능한 오류 처리
npm run lint -- --fix

# 수동으로 수정해야 할 오류는 콘솔에 표시
```

### 3단계: 프로덕션 빌드
```bash
npm run build
```

**검사 목표:**
- Next.js 프로덕션 빌드 성공
- 모든 페이지 정적 생성/렌더링 성공
- .next 디렉토리 정상 생성 (100-300MB)
- 빌드 경고 없음

**실패 시 조치:**
```
❌ FAILED: npm run build
에러: Error: Cannot find module './web/sandbox'

빌드 실패 진단:
1. 최근 import 추가 확인
2. 파일 경로 재검증
3. node_modules 재설치 시도:
   rm -rf node_modules package-lock.json
   npm ci
4. 캐시 정리 후 재빌드:
   rm -rf .next
   npm run build
```

## 검사 체크리스트

### 코드 변경 후
- [ ] 불필요한 console.log 제거됨
- [ ] 주석 처리된 코드 없음
- [ ] 사용하지 않는 import 제거됨
- [ ] 임시 테스트 코드 정리됨

### 빌드 전
- [ ] git status에 의도하지 않은 파일 없음
- [ ] 환경변수가 올바르게 설정됨
- [ ] 데이터베이스 연결 확인

### 빌드 후
- [ ] .next/server/ 디렉토리 존재
- [ ] .next/cache/ 캐시 정상
- [ ] 빌드 산출물 크기 합리적 (총 < 500MB)
- [ ] 소스맵 생성됨 (디버깅용)

## 실행 절차

### 프로덕션 배포 전

```bash
# 1단계: 타입 검사
echo "Step 1: TypeScript 검사..."
npm run tsc
if [ $? -ne 0 ]; then
  echo "❌ TypeScript 컴파일 실패"
  exit 1
fi

# 2단계: ESLint 검사
echo "Step 2: ESLint 검사..."
npm run lint
# 자동 수정 시도
npm run lint -- --fix

# 3단계: 프로덕션 빌드
echo "Step 3: 프로덕션 빌드..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 빌드 실패"
  exit 1
fi

# 모든 검사 통과
echo "✅ 모든 검사 통과! 배포 준비 완료"
```

## 결과 형식

### 모든 검사 통과
```
PRE-DEPLOYMENT VALIDATION REPORT
Generated: 2025-11-09 10:30:00

✅ Step 1: TypeScript Type Checking
   Status: PASSED (0 errors)
   Time: 12.3s

✅ Step 2: ESLint Code Quality
   Status: PASSED (0 errors)
   Warnings: 2 (auto-fixed)
   Time: 8.5s

✅ Step 3: Production Build
   Status: PASSED
   Pages generated: 118
   Build size: 245MB
   Time: 45.2s

FINAL RESULT: DEPLOYMENT APPROVED
All checks passed. Ready for production deployment.
```

### 검사 실패
```
PRE-DEPLOYMENT VALIDATION REPORT
Generated: 2025-11-09 10:30:00

❌ Step 1: TypeScript Type Checking
   Status: FAILED

   Error Details:
   - app/api/health-centers/route.ts:2:5
     TS2305: Module 'health-centers-master' has no exported member 'getAvailableCenters'

   Fix Required:
   1. Check lib/data/health-centers-master.ts exports
   2. Verify function is properly exported
   3. Run npm run tsc to validate

DEPLOYMENT BLOCKED
Fix the errors above and retry validation.
```

## 주요 오류 유형과 해결법

### TS2305: Module has no exported member
원인: import한 함수/타입이 파일에 없음

해결:
```bash
# 1. 파일에서 실제 export 확인
grep "export" lib/data/health-centers-master.ts

# 2. export 추가 또는 import 수정
# lib/data/health-centers-master.ts에 다음 추가
export function getAvailableCenters(region: string): string[] { ... }
```

### TS7005: Variable ... implicitly has an 'any' type
원인: 변수 타입이 명시되지 않음

해결:
```typescript
// 잘못된 예
const data = getRegionData();  // ❌ any 타입

// 올바른 예
const data: RegionData = getRegionData();  // ✅ 타입 명시
```

### ESLint react-hooks/exhaustive-deps
원인: useEffect 의존성 배열이 불완전함

해결:
```typescript
// 잘못된 예
useEffect(() => {
  console.log(region);  // region은 있는데 의존성 배열에 없음
}, []);  // ❌

// 올바른 예
useEffect(() => {
  console.log(region);
}, [region]);  // ✅ region 추가
```

### Build error: ENOSPC: no space left on device
원인: 서버 디스크 용량 부족

해결:
```bash
# 로컬에서는 이 문제가 발생하지 않음
# 프로덕션 배포 시 발생하면:
# 1. GitHub Actions에서 aggressive-cleanup.yml 실행
# 2. 또는 수동으로:
rm -rf .next/cache
rm -rf node_modules
npm ci
npm run build
```

## 배포 체크리스트

배포 전 최종 확인:
- [ ] npm run tsc 통과
- [ ] npm run lint 통과 (경고 0개)
- [ ] npm run build 통과 (118개 페이지 생성)
- [ ] 빌드 크기 합리적 (< 300MB)
- [ ] 로컬에서 pm2 start로 서비스 시작 가능
- [ ] localhost:3001에서 기본 페이지 로드 가능
- [ ] 환경변수 프로덕션 서버에 설정됨
- [ ] 데이터베이스 연결 정상

## 참고 문서
- [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) - 배포 가이드
- [CLAUDE.md](CLAUDE.md) - "GitHub 푸시 전 검사 절차" 섹션
