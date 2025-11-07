# Phase 3: Actual Implementation Status & Revised Action Plan

**Date**: 2025-11-07
**Status**: Storage Layer Already Complete - Focus on Verification & Cleanup

---

## Critical Discovery: Storage Migration Already Complete

### What the Code Shows

**Photo Upload Path** (Production-Ready):
```
Frontend (uploadPhotoToStorage)
  ↓
/api/storage/upload (validation layer)
  ↓
lib/storage/ncp-storage.ts (S3-compatible API)
  ↓
NCP Object Storage (kr.object.ncloudstorage.com)
```

**Dependencies**:
- ✅ @aws-sdk/client-s3
- ✅ @aws-sdk/s3-request-presigner
- ❌ NO @supabase/supabase-js in package.json

**Implementation Status**:
- ✅ All 3 upload endpoints use NCP SDK
  - /api/storage/upload (single)
  - /api/storage/upload-batch (batch)
  - /api/storage/delete (deletion)
- ✅ Client wrapper fully integrated (lib/utils/photo-upload.ts)
- ✅ Environment configuration complete (lib/env.ts)
- ✅ NCP SDK initialization with forcePathStyle=true (NCP requirement)
- ✅ Public URL generation working

### Supabase Remnants (Legacy Only)

**Not Actually Used**:
- Comments in useAuth.tsx, useNotifications.tsx (commented-out blocks)
- types/supabase-stub.d.ts (type stub for build, not runtime)
- Documentation references (README, CLAUDE.md historical notes)

**No Runtime Dependency**:
- NOT in package.json
- NOT imported in runtime code
- NOT called by API routes

---

## Revised Phase 3 Timeline

| Timeline | Component | Status | Notes |
|----------|-----------|--------|-------|
| NOW (11/7) | Environment Verification | **ACTION NEEDED** | Check NCP keys on prod |
| NOW (11/7) | Legacy Code Cleanup | **ACTION NEEDED** | Remove/mark Supabase comments |
| 11/10-11 | Team Coordination Meetings | Scheduled | Finalize design docs |
| 12/1-14 | Dashboard Development | **MAIN WORK** | recharts, permissions, export |
| 12/15-19 | Testing & Deployment | Final phase | 250 health centers |

---

## Week 1 (2025-11-24 ~ 12-05): Revised Scope

### Task 1: Environment Variable Verification (1 day)

**Goal**: Ensure NCP credentials are correctly set on all servers

**Servers to Check**:
```bash
# Production
ssh aed.pics@223.130.150.133
cat /etc/aedpics/.env.local | grep NCP_OBJECT_STORAGE

# Staging (if exists)
cat .env.local | grep NCP_OBJECT_STORAGE
```

**Required Variables**:
```bash
NCP_OBJECT_STORAGE_REGION="kr-central-2"  # Check if should be this instead of kr-standard
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_ACCESS_KEY="ncp_iam_***"
NCP_OBJECT_STORAGE_SECRET_KEY="ncp_iam_***"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```

**Verification Steps**:
1. Check all 5 variables are present
2. Verify credentials have correct IAM permissions (GetObject, PutObject, DeleteObject, ListBucket)
3. Test upload with small test image
4. Verify image is accessible via public URL

**Owner**: Infra Developer
**Timeline**: 1 day

---

### Task 2: Legacy Supabase Cleanup (1 day)

**Goal**: Remove Supabase references from codebase (documentation + comments)

**Files to Clean**:

1. **lib/hooks/useAuth.tsx**
   - Current: Commented-out Supabase client initialization
   - Action: Keep NextAuth only, remove old Supabase blocks with comment
   ```typescript
   // DEPRECATED: Old Supabase client code removed (2025-11-24)
   // Was: const supabase = createClient(...)
   // Now: Using NextAuth only (lib/auth-client.ts)
   ```

2. **lib/hooks/useNotifications.tsx**
   - Current: Commented Supabase realtime listener
   - Action: Replace with note about future implementation
   ```typescript
   // TODO: Implement realtime notifications via WebSocket
   // Old Supabase realtime code removed (2025-11-24)
   ```

3. **types/supabase-stub.d.ts**
   - Current: Type stub for build-time safety
   - Action: Remove file (no longer needed)
   ```bash
   rm types/supabase-stub.d.ts
   git add types/
   ```

4. **README.md**
   - Current: Mentions Supabase in legacy section
   - Action: Move to "Archive" section at bottom
   - Update tech stack section: Remove Supabase mention

5. **CLAUDE.md**
   - Current: Supabase section in notes
   - Action: Update to clarify "DEPRECATED - Completed migration 2025-10-28"

6. **scripts/** (if any Supabase utilities)
   - Search for: `supabase` references
   - Action: Mark as DEPRECATED or remove

**Commands**:
```bash
# Find Supabase references
grep -r "supabase" --include="*.ts" --include="*.tsx" lib/ app/ scripts/
grep -r "SUPABASE" --include=".env*" .

# Check for any CI scripts
ls -la .github/workflows/ | grep -i supabase
```

**Owner**: Backend Developer
**Timeline**: 1 day

---

### Task 3: Batch Migration Script Planning (0.5 day)

**Goal**: Prepare batch migration script for any remaining Supabase photos (if any)

**Question to Answer First**:
- Are there any photos currently still stored in Supabase?
- Check inspection_sessions.photos array - does it point to Supabase or NCP?

**If No Supabase Photos Remain**:
- Script (scripts/migrate-storage-to-ncp.ts) is a template for future use
- No action needed for Phase 3
- Archive script as "reference implementation"

**If Supabase Photos Exist**:
- Use provided migrate-storage-to-ncp.ts template
- Test with --dry-run flag first
- Execute batch migration
- Verify checksums
- Update photo URLs in DB

**Owner**: Backend Developer
**Timeline**: 0.5 day (assessment only)

---

### Task 4: Documentation Updates (0.5 day)

**Files to Update**:
1. docs/deployment/DEPLOYMENT.md
   - Add NCP environment variable checklist
   - Add verification steps for storage connectivity

2. docs/planning/PHASE3_WEEK1_STORAGE_MIGRATION_ACTION_PLAN.md
   - Update to reflect "already complete" status
   - Rename to "Phase 3 Week 1 Verification Plan"

3. docs/CLAUDE.md
   - Update NCP credentials section with verification checklist

**Owner**: Backend Developer
**Timeline**: 0.5 day

---

## Actual Week 1 Deliverables (Revised)

| Deliverable | Owner | Timeline | Status |
|------------|-------|----------|--------|
| Environment verification complete | Infra | Day 1 | Ready |
| Legacy Supabase cleanup done | Backend | Day 1 | Ready |
| All unit tests pass | Backend | Day 1 | Ready |
| Documentation updated | Backend | Day 1 | Ready |
| **Total Week 1**: 3 days of actual development | - | 3 days | Feasible |

---

## Freed-Up Time: Accelerated Dashboard Development

**Impact**: With storage already production-ready, we can accelerate Week 3 (Dashboard) to Week 2

**Recommended Timeline**:
- **Week 1** (11/24-12/05): Verification + Cleanup (3 days)
- **Week 2** (12/08-12-19): Dashboard Development (can start early!)
- **Week 3** (12/22-12/28): Testing + Final Deployment

**Dashboard Work** (Ready to Start Week 2):
- [ ] recharts integration for visualization
- [ ] Statistics data aggregation API
- [ ] 3-tier permission model (Master/Regional/Local)
- [ ] Redis caching (1-hour TTL)
- [ ] CSV/PDF export functionality
- [ ] Mobile responsiveness
- [ ] Performance testing

---

## Outstanding Questions for Next Steps

1. **Photo URL Storage**:
   - Current inspection_sessions.photos array: does it contain Supabase or NCP URLs?
   - If mixed: need migration script to rewrite URLs

2. **CDN Configuration**:
   - Is NCP CDN already configured?
   - Cache settings (TTL, compression)?
   - CORS headers?

3. **Batch Upload Endpoint**:
   - /api/storage/upload-batch - is it being used?
   - Test case needed?

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Missing NCP credentials on prod | Medium | Critical | Task 1: Full verification |
| Photo URLs point to old Supabase | Low | High | Check inspection_sessions data |
| Legacy code causes confusion | Low | Medium | Task 2: Clear cleanup |
| Dashboard underestimated effort | Medium | High | Start early, parallel with testing |

---

## Summary: What Changed

**Original Plan** (Assumed Supabase Still in Use):
- Week 1: Storage setup + migration
- Week 2: Parallel operation
- Week 3: Dashboard + final cutoff
- **Total: 3 weeks of storage work**

**Actual Status** (NCP Already in Use):
- Week 1: Verification + cleanup (3 days)
- Week 2-3: Dashboard development
- **Total: ~1 week for storage + 2 weeks for dashboard**

**Net Benefit**: ~1 week acceleration, can focus on dashboard quality

---

## Action Items (Immediate - Next 3 Days)

**Infra Developer** (1 day):
- [ ] SSH to production, verify NCP environment variables
- [ ] Test NCP upload with small image
- [ ] Verify public URL accessibility
- [ ] Document any issues/corrections needed

**Backend Developer** (2 days):
- [ ] Clean up Supabase comments from codebase (1 day)
- [ ] Update documentation (0.5 day)
- [ ] Check if batch migration script needed (0.5 day)
- [ ] Run full test suite, verify no regressions

**Timeline**: Complete by 2025-11-10

---

## Files to Modify

```
docs/
  ├── planning/
  │   ├── PHASE3_WEEK1_STORAGE_MIGRATION_ACTION_PLAN.md  (Update)
  │   └── PHASE3_ACTUAL_STATUS_AND_REVISED_PLAN.md       (NEW - this file)
  ├── deployment/
  │   └── DEPLOYMENT.md                                   (Add NCP verification)
  └── CLAUDE.md                                           (Update NCP section)

lib/
  ├── hooks/
  │   ├── useAuth.tsx                                    (Clean Supabase comments)
  │   └── useNotifications.tsx                           (Clean Supabase comments)
  └── (other files: inspect for Supabase references)

scripts/
  ├── migrate-storage-to-ncp.ts                          (Keep as template)
  └── (any Supabase-specific scripts to remove)

types/
  └── supabase-stub.d.ts                                 (REMOVE)

.github/
  └── workflows/
      └── (check for Supabase CI tasks)
```

---

## Key Insight

**Before Today's Discovery**:
- "Phase 3 Week 1 = Full storage migration project"

**After Code Review**:
- "Phase 3 Week 1 = Verification + cleanup of already-completed work"
- "Real Phase 3 work = Dashboard (starting Week 2, not Week 3)"

This is a **positive finding** - infrastructure is already solid, can focus on features.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-07
**Next Review**: After Week 1 completion (2025-12-05)
**Prepared by**: Code Review of lib/storage/ncp-storage.ts + package.json analysis
