# 카카오맵 API 완전 가이드

> **최종 업데이트**: 2025-10-03
> **작성자**: AED 점검 시스템 팀

---

## 📋 목차

1. [API 키 정보](#api-키-정보)
2. [초기 설정](#초기-설정)
3. [도메인 등록](#도메인-등록)
4. [프로젝트 설정](#프로젝트-설정)
5. [사용 예시](#사용-예시)
6. [문제 해결](#문제-해결)

---

## API 키 정보

### 현재 앱 구성

#### 1. 원본 앱 (프로덕션용)
- **앱 ID**: 1315129
- **앱 이름**: AED픽스
- **JavaScript 키**: `6e3339a5cbd61f1f3b08e3a06071795b`
- **등록된 도메인**:
  - `https://aed.pics`
  - `http://localhost:3000` (추가 완료)
  - `https://aed-check-system.vercel.app`

#### 2. 테스트 앱 (개발용)
- **앱 ID**: 1315131
- **앱 이름**: AED픽스-TEST
- **JavaScript 키**: `07b7e8744888b0624ec81996bb5edd70`
- **등록된 도메인**:
  - `http://localhost:3000`
  - `https://aed-check-system.vercel.app`
  - `https://*.vercel.app`

### API 키 목록

#### 1. JavaScript 키 (웹 애플리케이션용)
```
6e3339a5cbd61f1f3b08e3a06071795b
```
- **환경변수명**: `NEXT_PUBLIC_KAKAO_MAP_KEY`
- **용도**: 웹 브라우저에서 카카오 지도 API 사용
- **사용처**: `/app/map`, `/app/test-map` 등

#### 2. REST API 키
```
0088cb06bf9ce78d8876390e087669dd
```
- **환경변수명**: `KAKAO_REST_API_KEY`
- **용도**: 서버사이드에서 카카오 API 호출
- **사용처**: 주소 검색, 좌표 변환 등

#### 3. 네이티브 앱 키
```
f4c374734b4c2f0bccb145565c2872a8
```
- **환경변수명**: `KAKAO_NATIVE_APP_KEY`
- **용도**: 향후 모바일 앱 개발 시 사용
- **사용처**: React Native 또는 PWA 앱

#### 4. 어드민 키
```
977de9bd361c7022b3f91bfc787d0733
```
- **환경변수명**: `KAKAO_ADMIN_KEY`
- **용도**: 카카오 API 관리 및 통계 확인
- **사용처**: 관리자 대시보드

---

## 초기 설정

### 1. API 키 발급 (신규 프로젝트)

#### 기존 API 키가 있는 경우
1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. 내 애플리케이션 선택
3. 앱 키 → JavaScript 키 복사

#### 새로 발급하는 경우
1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. 애플리케이션 추가하기
3. 앱 이름: "AED 스마트 점검 시스템"
4. 사업자명: 입력
5. 생성 후 JavaScript 키 확인

### 2. 카카오맵 API 활성화
1. 제품 설정 → 카카오맵 → 활성화 설정
2. 저장

---

## 도메인 등록

### 필수 도메인 설정

1. **카카오 개발자 콘솔 접속**
   - https://developers.kakao.com

2. **원본 앱(1315129) 선택**
   - AED픽스 앱 클릭

3. **Web 플랫폼 등록**
   - 앱 설정 > 플랫폼 > Web > 사이트 도메인

4. **도메인 추가**
   ```
   http://localhost:3000
   https://aed-check-system.vercel.app
   https://*.vercel.app
   https://aed.pics
   ```

5. **저장 버튼 클릭**

### 도메인 체크리스트

#### 원본 앱 (1315129) - 필수 도메인
- [x] `https://aed.pics` (등록됨)
- [x] `http://localhost:3000` (등록됨)
- [x] `https://aed-check-system.vercel.app` (등록됨)

#### 테스트 앱 (1315131) - 백업용
- [x] `http://localhost:3000`
- [x] `https://aed-check-system.vercel.app`
- [x] `https://*.vercel.app`

---

## 프로젝트 설정

### 환경별 설정

#### 로컬 개발 (.env.local)
```bash
# Map Configuration
NEXT_PUBLIC_KAKAO_MAP_KEY=6e3339a5cbd61f1f3b08e3a06071795b
KAKAO_REST_API_KEY=0088cb06bf9ce78d8876390e087669dd
```

#### Vercel 배포 (환경변수)
```bash
# Vercel Dashboard > Settings > Environment Variables
NEXT_PUBLIC_KAKAO_MAP_KEY=6e3339a5cbd61f1f3b08e3a06071795b
KAKAO_REST_API_KEY=0088cb06bf9ce78d8876390e087669dd
```

### 테스트

```bash
# 서버 재시작
npm run dev

# 브라우저에서 확인
# http://localhost:3000/test-map
# http://localhost:3000/map/debug
```

---

## 사용 예시

### 1. 웹페이지에서 카카오 지도 사용

```html
<script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=6e3339a5cbd61f1f3b08e3a06071795b&libraries=services,clusterer"></script>
```

### 2. Next.js 컴포넌트에서 사용

```typescript
const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

useEffect(() => {
  const script = document.createElement('script');
  script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&libraries=services&autoload=false`;
  document.head.appendChild(script);
}, []);
```

### 3. 점검 화면에 적용

```tsx
import KakaoMap from '@/components/map/KakaoMap';

<KakaoMap
  latitude={aed.latitude}
  longitude={aed.longitude}
  editable={true}
  onLocationChange={(lat, lng) => {
    // 위치 업데이트 로직
  }}
/>
```

### 4. 대시보드에 적용

```tsx
<KakaoMap
  latitude={37.5662952}
  longitude={126.9779451}
  markers={aedLocations}
/>
```

---

## 문제 해결

### 1. "domain mismatched" 오류

**증상**: 지도가 표시되지 않고 콘솔에 도메인 불일치 오류

**해결 방법**:
1. 카카오 개발자 콘솔에서 도메인 등록 확인
2. 프로토콜(http/https)과 포트 번호가 정확히 일치하는지 확인
3. 저장 버튼 클릭 확인
4. 브라우저 캐시 삭제 후 재시도

### 2. "OPEN_MAP_AND_LOCAL service disabled" 오류

**증상**: 서비스 비활성화 메시지

**해결 방법**:
1. 카카오 개발자 콘솔 > 제품 설정 > 카카오맵 활성화
2. 테스트 앱에서는 자동 활성화됨

### 3. 지도가 표시되지 않는 경우

**체크리스트**:
1. API 키가 올바른지 확인
2. 도메인이 등록되었는지 확인
3. 브라우저 콘솔에서 에러 확인
4. 네트워크 탭에서 API 호출 확인

### 4. CORS 에러

**원인**: 도메인이 등록되지 않은 경우

**해결 방법**:
- 카카오 개발자 콘솔에서 현재 도메인 추가

### 5. 모바일에서 표시 안됨

**원인**: HTTPS 필수 (localhost 제외)

**해결 방법**:
- 프로덕션 환경에서는 반드시 HTTPS 사용
- 위치 권한 허용 필요

### 6. 캐시 문제

**해결 방법**:
- 브라우저 강제 새로고침: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- 시크릿/프라이빗 창에서 테스트

---

## API 키 검증 방법

### curl 테스트

```bash
# 원본 앱 키 테스트
curl -s -H "Referer: http://localhost:3000/" \
     -H "Origin: http://localhost:3000" \
     "https://dapi.kakao.com/v2/maps/sdk.js?appkey=6e3339a5cbd61f1f3b08e3a06071795b"
```

**성공 시**: JavaScript 코드 반환
**실패 시**: `{"errorType":"AccessDeniedError","message":"domain mismatched..."}`

---

## 사용량 및 제한

### 무료 사용량
- **일일**: 300,000건
- **월간**: 9,000,000건

### AED 프로젝트 예상 사용량
- 250개 보건소 × 일일 평균 10회 조회 = 2,500건/일
- **충분한 여유 있음** ✅

---

## 구현된 기능

### 현재 지원
- [x] 지도 표시
- [x] 마커 표시
- [x] 위치 수정 (드래그)
- [x] 줌 컨트롤
- [x] 인포윈도우

### 추가 가능 기능
- [ ] 클러스터링 (다중 마커)
- [ ] 길찾기 연동
- [ ] 주소 검색
- [ ] 현재 위치 표시

---

## 보안 주의사항

1. **JavaScript 키**는 클라이언트에 노출되므로 도메인 제한 설정 필수
2. **REST API 키**와 **Admin 키**는 서버사이드에서만 사용
3. `.env.local` 파일은 반드시 `.gitignore`에 포함
4. 프로덕션 환경에서는 Vercel 환경변수로 관리

---

## 참고 자료

- [카카오맵 API 문서](https://apis.map.kakao.com/web/documentation/)
- [샘플 코드](https://apis.map.kakao.com/web/sample/)
- [요금 정책](https://developers.kakao.com/terms/pricing#maps)
- [카카오 지도 API 가이드](https://apis.map.kakao.com/web/guide/)

---

**최종 목표**: 원본 앱 하나로 모든 환경에서 작동
- 로컬 개발: http://localhost:3000
- Vercel 배포: https://aed-check-system.vercel.app
- 실제 도메인: https://aed.pics
