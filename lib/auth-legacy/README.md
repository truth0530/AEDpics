# Legacy Authentication Code (Supabase Auth)

**상태**: 더 이상 사용하지 않음 (참조용으로만 유지)

**이전 일자**: 2025-10-25

**이유**:
- Supabase Auth → NextAuth.js 전환
- 국정원 인증 요구사항 충족 (인증 시스템 한국 서버 필수)
- NCP 네이티브 인증 시스템 구축

---

## 포함된 파일

- `admin.ts` - Supabase 관리자 클라이언트
- `client.ts` - Supabase 브라우저 클라이언트
- `client.tsx` - Supabase React Context Provider
- `middleware.ts` - Supabase 인증 미들웨어
- `server.ts` - Supabase 서버 클라이언트

---

## 새로운 인증 시스템

**위치**: `lib/auth/next-auth.ts`

**사용법**:
```typescript
import { getCurrentUser, hasPermission } from '@/lib/auth/next-auth'

// 서버 컴포넌트에서
const user = await getCurrentUser()
const canExport = await hasPermission('canExportData')
```

---

## 주의사항

1. **이 디렉토리의 코드를 사용하지 마세요**
   - 새로운 코드는 `lib/auth/next-auth.ts`를 사용하세요

2. **삭제하지 마세요**
   - 다른 프로젝트에서 Supabase를 사용할 수 있습니다
   - 참조용으로 유지합니다

3. **패키지는 유지**
   - `@supabase/ssr` 패키지는 제거하지 않습니다
   - `@supabase/supabase-js` 패키지는 제거하지 않습니다

---

**마이그레이션 문서**: [docs/migration/NEXTAUTH_MIGRATION_PLAN.md](../../docs/migration/NEXTAUTH_MIGRATION_PLAN.md)
