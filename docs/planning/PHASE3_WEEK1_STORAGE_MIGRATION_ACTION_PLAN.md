# Phase 3 Week 1: Storage Migration Action Plan
## NCP Object Storage Setup & Data Migration

**Timeline**: 2025-11-24 ~ 12-05 (Week 1-2)
**Owner**: Infra/Backend Developer
**Status**: Ready to Start

---

## Current Implementation Status

### Already Completed
✅ NCP Storage SDK Integration (`lib/storage/ncp-storage.ts`)
- S3 Client configured with NCP Object Storage API
- Upload functions: `uploadPhotoToNCP()`, `uploadPhotosToNCP()`
- Delete function: `deletePhotoFromNCP()`
- URL generation: `getPublicUrl()`, `getPresignedUrl()`
- Environment configuration in `lib/env.ts`

✅ Upload API Layer (`app/api/storage/upload/route.ts`)
- 11-layer validation pipeline (auth, rate-limit, file size, MIME, session, authorization)
- NCP integration already in place
- Ready for production use

✅ Client Wrapper (`lib/utils/photo-upload.ts`)
- Upload utilities
- Batch upload support
- Delete support

### What Needs to Happen for Phase 3

**Phase 3A (Preparation)**: Bucket Verification & CDN Setup
**Phase 3B (Parallel Operation)**: Batch Migration (1 week parallel with Supabase)
**Phase 3C (Final Cutoff)**: Complete Migration & Validation

---

## Phase 3A: NCP Bucket Verification (Days 1-2)

### Task 1: Verify NCP Bucket Configuration

**Current Settings** (from .env.example):
```bash
NCP_OBJECT_STORAGE_REGION="kr-standard"        # ⚠️ CHECK: Should be kr-central-2?
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```

**Verification Checklist**:
- [ ] Region: kr-central-2 (check with NCP console)
- [ ] Bucket Name: `aedpics-inspections` (create if not exists)
- [ ] Access Level: Private (public access via CDN only)
- [ ] Versioning: Enabled (for safety/rollback)
- [ ] CORS Configuration: Enable cross-origin requests
- [ ] Object Lifecycle: No expiration (permanent storage)

**Action**:
```bash
# Check bucket existence via NCP CLI or console
ncp objectstorage describe-bucket aedpics-inspections

# If not exists, create:
ncp objectstorage create-bucket \
  --bucket-name aedpics-inspections \
  --region kr-central-2 \
  --private
```

**Owner**: NCP Team (Infra Developer)
**Timeline**: 1 day
**Blocker**: Cannot proceed without confirmed bucket

---

### Task 2: Configure NCP CDN (Content Delivery Network)

**Requirements**:
- Origin: `https://kr.object.ncloudstorage.com/aedpics-inspections`
- Cache TTL: 86400 seconds (24 hours)
- Compression: gzip enabled
- CORS: Enabled for cross-origin requests
- HTTPS: Enforced

**Configuration Steps**:
1. Create CDN instance in NCP console
2. Set origin to aedpics-inspections bucket
3. Enable cache (24h TTL)
4. Enable compression (gzip)
5. Configure CORS headers:
   ```
   Access-Control-Allow-Origin: https://aed.pics
   Access-Control-Allow-Methods: GET
   Access-Control-Allow-Headers: *
   ```
6. Test with sample image

**Expected Result**:
```
CDN URL: https://cdn-aedpics.ncloud.com/inspections/{sessionId}/{photoType}-*.jpg
Response Time: < 500ms
Cache Hit Ratio: > 80% (after 1 week)
```

**Owner**: NCP Team
**Timeline**: 1 day
**Success Criteria**: Image loads via CDN in < 500ms

---

### Task 3: Verify IAM Permissions

**Required Permissions** for application account:
```
- GetObject (read)
- PutObject (write)
- DeleteObject (delete)
- ListBucket (list)
```

**Verification**:
```bash
# Check current permissions
ncp iam get-user-access-control --bucket aedpics-inspections

# Should show:
# - Object Storage Read (GetObject)
# - Object Storage Write (PutObject, DeleteObject)
# - Object Storage List (ListBucket)
```

**Owner**: NCP Team
**Timeline**: 0.5 day

---

### Task 4: Update Environment Variables

**Current** `.env.local` (production server):
```bash
NCP_OBJECT_STORAGE_REGION="kr-standard"
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_ACCESS_KEY="ncp_iam_***"
NCP_OBJECT_STORAGE_SECRET_KEY="ncp_iam_***"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```

**After Verification**:
- Update region to `kr-central-2` if different
- Add CDN endpoint if using custom CDN: `NCP_OBJECT_STORAGE_CDN_ENDPOINT="https://cdn-aedpics.ncloud.com"`
- Verify credentials are correct and have all required permissions

**Owner**: Infra Developer
**Timeline**: 0.5 day

---

## Phase 3B: Batch Migration (Days 3-7)

### Task 5: Implement Batch Migration Script

**Goal**: Migrate 160MB of existing Supabase Storage images to NCP (81,464 AED records × ~2KB average)

**Requirements**:
1. Read all photos from Supabase Storage
2. Calculate BLAKE3 checksum for validation
3. Upload to NCP with same path structure
4. Verify checksums match
5. Track progress (success/failure count)

**Script Structure** (`scripts/migrate-storage-to-ncp.ts`):

```typescript
interface MigrationTask {
  sessionId: string;
  photoType: string;
  supabasePath: string;
  ncp_path: string;
  checksum: string;
  status: 'pending' | 'success' | 'failed' | 'verified';
  error?: string;
  retries: number;
}

interface MigrationResult {
  totalTasks: number;
  successful: number;
  failed: number;
  verified: number;
  duration: string;
  failedTasks: MigrationTask[];
}
```

**Algorithm**:

1. **Phase 1: Inventory** (read all photos from Supabase)
   - Query DB for all inspection_sessions with photos
   - Get list of all files in Supabase Storage
   - Create migration tasks (sessionId, photoType, paths)
   - Time estimate: 5 minutes

2. **Phase 2: Batch Upload** (concurrent uploads with checksum)
   - Concurrency: 10 uploads at a time (NCP rate limit: 1000 req/min)
   - For each photo:
     - Download from Supabase
     - Calculate BLAKE3 checksum
     - Upload to NCP
     - Log result (success/failure)
   - Time estimate: 30 minutes (160MB ÷ 10 parallel = 16 batches × 2 min)

3. **Phase 3: Verification** (validate checksums)
   - For each uploaded file:
     - Download from NCP
     - Calculate BLAKE3 checksum again
     - Compare with original
     - Mark as 'verified' or 'corrupted'
   - Time estimate: 20 minutes

4. **Phase 4: Reporting** (generate migration report)
   - Total: X tasks
   - Success: Y files (100%)
   - Failed: Z files
   - Corrupted: W files (should be 0)
   - Duration: HH:MM
   - Output to `logs/migration-report-2025-11-24.json`

**Expected Output**:
```json
{
  "timestamp": "2025-11-24T10:00:00Z",
  "migration": {
    "totalTasks": 15432,
    "successful": 15432,
    "failed": 0,
    "verified": 15432,
    "duration": "01:15:32"
  },
  "failedTasks": []
}
```

**Owner**: Backend Developer
**Timeline**: 1.5 days
**Testing**: Run on staging (non-production) bucket first

---

### Task 6: Implement Dual-Source Fallback

**Goal**: Support reads from both NCP (new) and Supabase (existing) during parallel operation

**Implementation** (`lib/utils/photo-upload.ts` modification):

```typescript
export async function getPhotoUrl(
  sessionId: string,
  photoType: string,
  filePath: string
): Promise<string | null> {
  // Try NCP first (new uploads, post-migration)
  const ncpUrl = getPublicUrl(filePath);
  const ncpReachable = await isUrlReachable(ncpUrl);

  if (ncpReachable) {
    return ncpUrl;
  }

  // Fallback to Supabase (existing data, during parallel operation)
  const supabaseUrl = getSupabasePublicUrl(sessionId, photoType, filePath);
  return supabaseUrl;
}

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 2000 });
    return response.ok;
  } catch {
    return false;
  }
}
```

**Testing Strategy**:
1. Upload new photo → stored in NCP
2. Retrieve URL → should use NCP endpoint
3. Verify image loads correctly
4. Check old photos still work (Supabase fallback)
5. Verify no image loading errors in console

**Owner**: Backend Developer
**Timeline**: 1 day
**Success**: All images (old + new) load correctly

---

### Task 7: Monitor Parallel Operation

**During Week 2** (2025-12-01 ~ 12-05):
- Both upload destinations active
- New photos → NCP
- Old photos → Supabase (fallback)
- Monitor for any errors:
  - NCP upload failures
  - CDN cache issues
  - Fallback activation frequency
  - Performance metrics

**Monitoring Points**:
- Upload success rate (target: > 99%)
- Average upload time (target: < 2 sec)
- CDN cache hit ratio (target: > 80%)
- Fallback activation rate (target: < 1%)

**Owner**: Infra Developer
**Timeline**: 1 week

---

## Phase 3C: Final Cutoff (Days 8-14)

### Task 8: Validate Migration Completeness

**Before Cutoff**:
1. Verify all pre-2025-11-24 photos migrated to NCP
2. Verify all post-2025-11-24 photos uploaded to NCP only
3. Run final checksum audit
4. Check data integrity (no corrupt files)

**Checklist**:
- [ ] Pre-migration photos: 100% verified
- [ ] Post-migration photos: 100% in NCP
- [ ] No failed uploads in logs
- [ ] No 404 errors in last 48 hours
- [ ] CDN performance stable (< 500ms)

**Owner**: Backend Developer
**Timeline**: 1 day

---

### Task 9: Complete Cutoff (Remove Supabase Fallback)

**Action**:
1. Remove Supabase fallback logic from `photo-upload.ts`
2. Update upload routes to NCP-only
3. Update any remaining Supabase references
4. Deploy to production

**Changes**:
```typescript
// BEFORE (dual-source)
export async function getPhotoUrl(...) {
  const ncpUrl = getPublicUrl(filePath);
  if (await isUrlReachable(ncpUrl)) return ncpUrl;
  return getSupabasePublicUrl(...);  // Fallback
}

// AFTER (NCP-only)
export async function getPhotoUrl(...) {
  return getPublicUrl(filePath);  // NCP only
}
```

**Owner**: Backend Developer
**Timeline**: 0.5 day

---

### Task 10: Archive Supabase Storage (Optional)

**Action**:
1. Keep Supabase bucket for 30 days as safety backup
2. Export bucket contents to NCP for archival
3. Document archival process
4. After 30 days: delete Supabase bucket

**Timeline**: 1 day (30-day retention)

**Owner**: Infra Developer

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| NCP API rate limiting | Medium | High | Limit concurrent uploads to 10, add exponential backoff |
| Checksum mismatch | Low | High | Use BLAKE3, verify all uploads, re-upload on fail |
| CDN propagation delay | Medium | Medium | Pre-warm CDN cache, test from multiple regions |
| Network interruption | Low | Medium | Implement retry logic with exponential backoff |
| Old images break during cutoff | Low | Critical | Keep Supabase for 30 days, test fallback thoroughly |

---

## Success Criteria

**Phase 3A** (Days 1-2):
- [ ] Bucket configured in kr-central-2 with versioning
- [ ] CDN setup complete with CORS and 24h TTL
- [ ] IAM permissions verified (GetObject, PutObject, DeleteObject, ListBucket)
- [ ] All environment variables updated

**Phase 3B** (Days 3-7):
- [ ] Batch migration script implemented and tested
- [ ] 160MB of existing photos migrated (100% success)
- [ ] All checksums verified
- [ ] Dual-source fallback working
- [ ] Monitoring active

**Phase 3C** (Days 8-14):
- [ ] All pre/post-migration photos verified
- [ ] Migration audit complete (0 failures)
- [ ] Supabase fallback removed
- [ ] Production cutoff complete
- [ ] No user-visible impact

---

## Resource Requirements

### NCP Infrastructure
- Object Storage Bucket: 200GB (current 160MB + growth buffer)
- CDN Instance: Standard tier
- Cost: ~$0.82/month (storage + CDN + bandwidth)

### Development Time
- Infra Developer: 4 days (bucket setup, CDN, monitoring)
- Backend Developer: 5 days (migration script, dual-source, testing)
- Total: 9 person-days

### Testing Environment
- Staging bucket: `aedpics-inspections-staging` (for script testing)
- Pre-production deployment: Full test before production cutoff

---

## Dependency Chain

```
Day 1-2: Task 1-4 (Bucket + CDN + IAM) ─────────┐
                                               │
Day 3-7: Task 5-7 (Migration + Fallback) ◄────┘
         │
         ├─ Task 5: Batch migration script
         ├─ Task 6: Dual-source fallback
         └─ Task 7: Monitoring (Week 2)
                    │
Day 8-14: Task 8-10 (Cutoff + Archive) ◄────────┘
          │
          ├─ Task 8: Validation
          ├─ Task 9: Cutoff (remove fallback)
          └─ Task 10: Archive Supabase
```

---

## Known Limitations & Notes

1. **Region Selection**: Current .env.example uses `kr-standard`, needs verification if `kr-central-2` is intended
2. **CDN Endpoint**: Custom CDN endpoint may need to be added to environment variables
3. **Checksum Algorithm**: Using BLAKE3 for fast verification; ensure library is available
4. **Concurrent Upload Limit**: Set to 10 to avoid NCP rate limiting (1000 req/min available)
5. **Fallback Duration**: Keeping Supabase for 30 days adds cost but ensures safety

---

## Next Steps (After Week 1)

1. **Week 2** (2025-12-08 ~ 12-12): Dashboard Development
   - Statistics data aggregation
   - recharts integration
   - 3-tier permission model
   - Redis caching (1-hour TTL)

2. **Week 3** (2025-12-15 ~ 12-19): Final Testing & Deployment
   - Full system test with 250 health centers
   - Performance testing
   - Security audit
   - Production deployment

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-07
**Next Review**: After Task 1-4 completion (2025-11-26)
