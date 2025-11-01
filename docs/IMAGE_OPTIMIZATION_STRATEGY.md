# 이미지 최적화 전략

## 목표: Object Storage 비용 최소화

### 현황 분석

**점검 사진 용도** (이미 3장으로 최적화됨):
- AED 시리얼 번호 확인 (serial_number_photo)
- 배터리 제조일자 확인 (battery_mfg_date_photo)
- 본체 제조일자 확인 (device_mfg_date_photo)

**참고**: 패드 유효기간은 날짜 입력으로 처리 (사진 불필요)

**핵심 원칙**:
1. **압축률 극대화가 최우선** - 식별 가능한 범위 내에서 최대 압축
2. 해상도 제한은 부수적 수단
3. 실제 활용 계획이 희박하므로 품질보다 용량 절감

## 최적화 전략

### 핵심: 압축률 극대화

**압축 우선순위**:
1. **WebP 초압축** (quality 50-60) - 최우선
2. Aggressive compression options
3. 메타데이터 완전 제거
4. Chroma subsampling (4:2:0)
5. 해상도 제한 (1280px)

### 1. 초압축 WebP 전환 (핵심 전략)

**문제**: 스마트폰 카메라 해상도
- iPhone 14: 4032x3024 (12MP)
- Galaxy S23: 4000x3000 (12MP)
- 파일 크기: 2-5MB

**해결**: 긴 변 기준 최대 해상도 제한
```typescript
최대 해상도 권장:
- 원본 저장: 1280px (HD 해상도) - 약 100-200KB
- 썸네일: 320px (목록 표시용) - 약 10-20KB

비율: 16:9 또는 4:3 유지
```

**기대 효과**:
- 12MP (4000x3000) → 1.3MP (1280x960)
- 용량 감소: 약 **90% 감소** (3MB → 150KB)

### 2. 포맷 최적화

**현재**: JPEG (Base64)
```typescript
canvas.toDataURL('image/jpeg', 0.85)
```

**개선**: WebP 변환 (서버사이드)
```typescript
// Sharp를 사용한 WebP 변환
await sharp(buffer)
  .webp({ quality: 70 })  // JPEG보다 30% 작음
  .toBuffer()
```

**압축률 비교** (동일 1280px 이미지 기준):

| 포맷 | Quality | 파일 크기 | 압축률 | 식별 가능 여부 |
|------|---------|---------|--------|---------------|
| JPEG | 85% | 250KB | 기준 | 우수 |
| JPEG | 70% | 180KB | 28% 감소 | 양호 |
| JPEG | 50% | 120KB | 52% 감소 | 보통 |
| WebP | 70% | 110KB | 56% 감소 | 양호 |
| WebP | 60% | **70KB** | **72% 감소** | 양호 ✅ **권장** |
| WebP | 50% | **50KB** | **80% 감소** | 보통 (텍스트 식별 가능) |
| WebP | 40% | 35KB | 86% 감소 | 한계 (번호판 식별 어려움) |

**최종 권장**: WebP quality 55-60 (70-80% 압축, 텍스트 명확히 식별 가능)

### 3. 다단계 최적화 파이프라인

```
스마트폰 촬영 (12MP, 3-5MB)
    ↓
[클라이언트] 1차 리사이징 + JPEG 압축
    → 1280px, quality 80, ~200KB
    ↓
서버 업로드
    ↓
[서버] 2차 최적화 (Sharp)
    → WebP 변환, quality 70, ~100KB
    → 썸네일 생성, 320px, ~15KB
    ↓
Object Storage 저장
    → /photos/{sessionId}/original/{photoType}.webp (100KB)
    → /photos/{sessionId}/thumb/{photoType}.webp (15KB)
```

### 4. 구체적인 해상도 기준

**점검 사진별 권장 해상도** (실제 점검 항목 기준):

| 사진 타입 | 최소 요구 | 권장 해상도 | WebP Q55 예상 크기 |
|----------|----------|-----------|------------------|
| 시리얼 번호 | 텍스트 식별 | 1280px | 60KB |
| 배터리 제조일자 | 날짜 심볼 판독 | 1280px | 60KB |
| 본체 제조일자 | 날짜 심볼 판독 | 1280px | 60KB |
| 썸네일 (목록) | 미리보기 | 320px | 10KB/장 |

**총 저장 용량 (점검 1건당)**:
- 사진 3장: 180KB (WebP Q55, 60KB/장)
- 썸네일 3장: 30KB (WebP Q45, 10KB/장)
- **합계: 약 210KB** (최적화 전 9MB 대비 **97.7% 감소**)

### 5. 클라이언트 측 최적화 개선

**현재 구현** (PhotoCaptureInput.tsx):
```typescript
// 500KB 이하로 압축
const compressImage = async (base64: string): Promise<string> => {
  const targetSize = 500 * 1024; // 500KB
  // ... quality를 줄이면서 반복
}
```

**개선 방안**:
```typescript
// 1. 해상도 제한 추가
const resizeAndCompress = async (base64: string): Promise<string> => {
  const img = new Image();
  img.src = base64;

  await new Promise(resolve => img.onload = resolve);

  // 긴 변을 1280px로 제한
  const maxDimension = 1280;
  let width = img.width;
  let height = img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round(height * (maxDimension / width));
      width = maxDimension;
    } else {
      width = Math.round(width * (maxDimension / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // JPEG quality 80으로 압축 (200KB 이하 목표)
  return canvas.toDataURL('image/jpeg', 0.8);
};
```

### 6. 서버사이드 최적화 (Sharp)

**위치**: `/app/api/storage/upload/route.ts`

```typescript
import sharp from 'sharp';

export async function POST(request: Request) {
  const { base64, sessionId, photoType } = await request.json();

  // Base64 디코드
  const buffer = Buffer.from(base64.split(',')[1], 'base64');

  // 1. 원본 최적화 (WebP 초압축)
  const optimized = await sharp(buffer)
    // EXIF 방향 자동 적용 후 메타데이터 제거
    .rotate()
    // 해상도 제한
    .resize(1280, 1280, {
      fit: 'inside',        // 비율 유지
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3  // 고품질 리샘플링
    })
    // WebP 초압축 설정
    .webp({
      quality: 55,          // 55-60% 품질 (식별 가능 + 최대 압축)
      effort: 6,            // 최대 압축 노력 (느리지만 용량 최소)
      lossless: false,      // lossy 압축 (파일 크기 우선)
      nearLossless: false,  // 완전 lossy
      smartSubsample: true, // 스마트 chroma subsampling
      alphaQuality: 0,      // alpha 채널 최소 품질 (불필요)
    })
    // 메타데이터 완전 제거
    .withMetadata({
      density: 72,          // DPI 최소화
      chromaSubsampling: '4:2:0'  // 색상 정보 압축
    })
    .toBuffer();

  // 2. 썸네일 생성 (극한 압축)
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(320, 320, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos2  // 썸네일용 빠른 커널
    })
    .webp({
      quality: 45,          // 썸네일은 더 낮은 품질
      effort: 4,            // 적당한 압축 시간
      smartSubsample: true
    })
    .toBuffer();

  // 3. Object Storage 업로드
  const originalKey = `photos/${sessionId}/original/${photoType}.webp`;
  const thumbKey = `photos/${sessionId}/thumb/${photoType}.webp`;

  await Promise.all([
    uploadToStorage(originalKey, optimized),
    uploadToStorage(thumbKey, thumbnail)
  ]);

  return NextResponse.json({
    url: getPublicUrl(originalKey),
    thumbnail: getPublicUrl(thumbKey)
  });
}
```

### 7. 메타데이터 제거

**불필요한 데이터 제거**:
```typescript
await sharp(buffer)
  .rotate()  // EXIF orientation 적용 후 제거
  .withMetadata({  // 메타데이터 최소화
    orientation: undefined,
    density: 72  // DPI 낮춤
  })
  .webp({ quality: 70 })
  .toBuffer();
```

**효과**: 약 20-50KB 추가 절감

## 예상 절감 효과

### 점검 1건 기준 (사진 3장)

**최적화 전**:
```
원본: 12MP JPEG × 3 = 9MB (3MB/장)
서버 압축 없음
총 용량: 9MB
```

**최적화 후 (압축률 극대화)**:
```
원본: 1280px WebP Q55 × 3 = 180KB (60KB/장)
썸네일: 320px WebP Q45 × 3 = 30KB (10KB/장)
총 용량: 210KB
```

**절감률**: **97.7% 감소** (9MB → 210KB)

**추가 극한 모드 (quality 50)**:
```
원본: 1280px WebP Q50 × 3 = 150KB (50KB/장)
썸네일: 320px WebP Q40 × 3 = 24KB (8KB/장)
총 용량: 174KB
압축률: 98.1% 감소
```

### 연간 예상 (실제 AED 81,464대 × 연 1회 점검)

**연간 총 점검 건수**: 81,464대 × 1회 = **81,464건**

**최적화 전**:
```
81,464건 × 9MB = 약 733GB/년
```

**최적화 후 (압축률 극대화)**:
```
81,464건 × 210KB = 약 17.1GB/년
```

**연간 절감**: **716GB** (**97.7% 감소**)

**극한 모드 적용 시**:
```
81,464건 × 174KB = 약 14.2GB/년
```

**연간 절감**: **719GB** (**98.1% 감소**)

## NCP Object Storage 요금 분석

### 스크린샷 기준 요금 (2025-11-01)

**저장 용량 요금**:
- 880GB = 24,640원/월
- **GB당 약 28원**

### 예상 월간 비용 (최적화 후 17.1GB 기준)

#### 1. 저장 용량
```
17.1GB × 28원 = 479원/월
연간: 479원 × 12 = 5,748원/년
```

#### 2. 네트워크 전송량
**업로드 (인바운드)**: **무료**
- 연간 업로드: 17.1GB

**다운로드 (아웃바운드)**:
- NCP 내부 통신: **무료**
- 외부 인터넷: 10TB까지 무료 (이후 80원/GB)
- 예상 다운로드: 점검 이력 조회 시 썸네일 (30KB/건)
  - 월 10,000건 조회: 300MB
  - 연간: 3.6GB (무료 범위)

#### 3. API 호출 비용
**PUT/POST (업로드)**:
- 연간 업로드: 81,464건 × 6개 파일 = 488,784 요청
- NCP 기준: **대부분 무료** 또는 10,000건당 5원
- 예상 비용: 488,784 / 10,000 × 5 = **244원/년**

**GET (다운로드)**:
- 월 예상 조회: 10,000건 × 3장 = 30,000 요청
- 연간: 360,000 요청
- NCP 기준: **대부분 무료** 또는 10,000건당 1원
- 예상 비용: 360,000 / 10,000 × 1 = **36원/년**

### 총 예상 비용

#### 최적화 후 (17.1GB/년)
```
저장 용량: 5,748원/년 (월 479원)
네트워크: 0원 (무료 범위)
API 호출: 280원/년 (PUT + GET)
──────────────────────
총 비용: 약 6,000원/년 (월 500원)
```

#### 최적화 전 (733GB/년) - 참고
```
저장 용량: 733GB × 28원 × 12 = 246,288원/년
네트워크: 0원 (무료 범위)
API 호출: 280원/년
──────────────────────
총 비용: 약 247,000원/년 (월 20,600원)
```

**연간 비용 절감**: **약 241,000원**

### 합리적인 요금 설정 방법

#### 1. 썸네일 우선 로딩
```typescript
// 목록에서는 썸네일만 표시
<img src={inspection.thumbnail_url} />

// 클릭 시에만 원본 로드
onClick={() => setShowOriginal(inspection.photo_url)}
```
**효과**: GET 요청 70% 감소

#### 2. CDN 캐싱 활용
```typescript
// NCP CDN 사용으로 반복 조회 비용 절감
Cache-Control: public, max-age=31536000
```
**효과**: API 호출 50% 감소

#### 3. 지연 로딩 (Lazy Loading)
```typescript
// 화면에 보이는 이미지만 로드
<img loading="lazy" src={photo_url} />
```
**효과**: 초기 로딩 시 네트워크 사용량 60% 감소

#### 4. 오래된 데이터 아카이빙
```
1년 이상 된 점검 기록 → Archive Storage (저렴)
GB당 28원 → GB당 4원 (85% 저렴)
```

### 최종 권장 사항

**연 1회 점검 기준 (81,464대)**:
- ✅ 17.1GB 예상 사용량 = **월 500원 (연 6,000원)**
- ✅ **매우 저렴한 비용으로 운영 가능**
- ✅ 네트워크 및 API 비용은 **거의 무료**
- ✅ 스크린샷의 880GB 용량으로 **50년 이상 사용 가능**

**최적화 방안 결론**:
- ✅ 현재 계획 (WebP Q55, 1280px)으로 충분
- ✅ 극한 모드 불필요 - 품질 우선
- ✅ 현재 방안으로 월 500원 수준 유지
- ✅ **추가 최적화 없이 진행 권장**

**비용 대비 효과**:
- 최적화 없이도 월 20,600원 (연 247,000원)
- 최적화 적용 시 월 500원 (연 6,000원)
- **차액: 연 241,000원 절감** - 충분히 의미 있음

## 구현 우선순위

### Phase 1: 클라이언트 측 개선 (즉시 적용 가능)
- [ ] PhotoCaptureInput.tsx 해상도 제한 추가
- [ ] 1280px 리사이징 로직 구현
- [ ] JPEG quality 조정 (85% → 80%)

### Phase 2: 서버사이드 최적화 (1-2일)
- [ ] Sharp 이미지 처리 API 구현
- [ ] WebP 변환 로직
- [ ] 썸네일 자동 생성
- [ ] 메타데이터 제거

### Phase 3: UI 개선 (선택사항)
- [ ] 썸네일로 목록 표시 (빠른 로딩)
- [ ] 클릭 시 원본 표시 (모달)
- [ ] 이미지 lazy loading

## 주의사항

### 1. 브라우저 호환성
```typescript
// WebP 지원 확인
function supportsWebP(): boolean {
  const elem = document.createElement('canvas');
  return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// 미지원 시 JPEG로 폴백
```

### 2. 품질 검증
```typescript
// 최저 품질 기준 설정
const MIN_WIDTH = 800;  // 최소 800px 보장
const MIN_QUALITY = 60; // 최소 60% 품질
```

### 3. 점진적 적용
- 신규 점검부터 적용
- 기존 데이터는 유지 (마이그레이션 선택)

## 모니터링

### 추적 메트릭
```typescript
// 업로드 시 로그 기록
{
  originalSize: '3.2MB',
  optimizedSize: '120KB',
  reductionRate: '96.3%',
  dimensions: '1280x960',
  format: 'webp',
  quality: 70,
  processingTime: '180ms'
}
```

## 참고 자료

- [Sharp 문서](https://sharp.pixelplumbing.com/)
- [WebP vs JPEG 비교](https://developers.google.com/speed/webp)
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)

---

**작성일**: 2025-11-01
**버전**: 1.0.0
