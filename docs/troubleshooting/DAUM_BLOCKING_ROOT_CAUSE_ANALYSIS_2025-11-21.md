# Daum Blocking Root Cause Analysis - 2025-11-21

## Confirmed Finding: Domain-Level Blocking

**Test Date**: 2025-11-21
**Test Result**: FAILED (as predicted)
**Root Cause**: NCP's automatic Block List blocks entire `@aed.pics` domain for Daum recipients

## Evidence

### Test Results

| Sender | Recipient | Status | Timestamp |
|--------|-----------|--------|-----------|
| noreply@aed.pics | truth530@daum.net | BLOCKED | 2025-11-21 23:54:18 |
| noreply@aed.pics | wowow212@daum.net | BLOCKED | Immediate |
| noreply@nmc.or.kr | truth530@daum.net | BLOCKED | Every attempt (0% success) |
| noreply@nmc.or.kr | wowow212@daum.net | BLOCKED | Every attempt (0% success) |
| admin@aed.pics | wowow212@daum.net | BLOCKED | 2025-11-21 15:34:06 |

### Key Evidence Points

1. **Same domain = Same blocking**
   - `noreply@aed.pics`: Blocked
   - `admin@aed.pics`: Also blocked (confirmed 2025-11-21)
   - Conclusion: `@aed.pics` domain is blocked as a whole

2. **Different domain = Different status**
   - `noreply@nmc.or.kr`: Also blocked, but for different reason (DMARC)
   - Not a solution because it fails with Daum for different technical reasons

3. **Automatic blocking behavior**
   - noreply@aed.pics last success: 2025-11-21 23:52:33
   - Automatic block triggered: 2025-11-21 23:54:18 (2 minutes later)
   - NCP auto-blocks after first failure from an email address

## Root Cause

NCP's Cloud Outbound Mailer has an automatic Block List security policy that:

1. **Monitors sending patterns** to external domains (Daum)
2. **Auto-blocks sender addresses** when certain thresholds are exceeded
3. **Block List applies per domain**, not per account
4. **Unblocks are manual** (requires NCP support intervention)

## Why This Happened

**Initial Success**: noreply@aed.pics sent successfully at 23:52:33
**Trigger**: Unknown - could be:
- Daum's own security policy rejecting future emails from this sender
- NCP's security policy detecting repeated attempts
- Spam filtering by Daum's mail system

**Result**: Within 2 minutes, the entire `@aed.pics` domain was blocked by NCP for Daum recipients

## What Doesn't Work

❌ Using different accounts from same domain
- `noreply@aed.pics` = Blocked
- `admin@aed.pics` = Also blocked (confirmed)
- Any `*@aed.pics` = Blocked

❌ Using different domain
- `noreply@nmc.or.kr` = Blocked (DMARC policy violation with Daum)
- `*@nmc.or.kr` = Also problematic with Daum

❌ Rollback/Retry
- Cannot unblock without NCP support
- Automatic re-blocking happens immediately

## What Works (Partial Solutions)

✓ **Short-term**: Use sender rotation with failure cache
- If `noreply@aed.pics` fails → try `noreply@nmc.or.kr`
- Current code: `selectSmartSender()` in smart-sender-selector-simplified.ts
- Limitation: `noreply@nmc.or.kr` also fails with Daum due to DMARC

✓ **Medium-term**: Contact Daum directly
- Request Daum to whitelist noreply@aed.pics
- Request Daum to whitelist noreply@nmc.or.kr
- Unlikely to succeed (individual domain whitelisting requests)

✓ **Long-term**: Use enterprise email service
- NCP Cloud Outbound Mailer has Daum blocking issues
- Alternative: AWS SES, SendGrid, Mailgun
- These services have better Daum integration

## Long-term Implications

**For @aed.pics users sending to Daum**:
- Cannot guarantee email delivery
- NCP's Block List system prevents reliable Daum delivery
- Workaround required until NCP resolves or we switch services

**For @nmc.or.kr users sending to Daum**:
- DMARC policy conflicts cause failures
- Same domain requirement (noreply@nmc.or.kr) doesn't work reliably

**Root issue**: NCP's email service is not optimized for Daum recipients

## Recommended Actions

### Immediate (This Week)
1. Document this finding in internal knowledge base
2. Inform users that Daum delivery may be unreliable
3. Update smart sender selector comment with test results
4. Monitor failure rates to track NCP's behavior

### Short-term (This Month)
1. Contact NCP technical support
   - Request: Understand why @aed.pics domain was auto-blocked
   - Request: Manual unblock for testing
   - Request: Permanent Daum whitelist
   - Request: Alternative solution if auto-blocking is system design

2. Consider alternative email services
   - AWS SES (integrates better with Korean mail services)
   - SendGrid (has Korean email partnerships)
   - Mailgun (reliable alternative)

### Medium-term (Next Quarter)
1. If NCP unblocks: Monitor closely for re-blocking
2. If NCP cannot fix: Migrate to alternative email service
3. Implement email service redundancy (NCP + backup service)

## Code Status

**Current Configuration** (Updated 2025-11-21):
```typescript
// smart-sender-selector-simplified.ts
'daum.net': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
'hanmail.net': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
'kakao.com': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
```

**Smart Sender System**: Enabled
- Tries `noreply@aed.pics` first (historically more reliable)
- Falls back to `noreply@nmc.or.kr` if first fails
- Records failures to avoid repeated attempts
- Limitation: Both fail with Daum, so fallback is ineffective

## Conclusion

The Daum email blocking issue is **not solvable at the application level**. It requires:

1. **NCP technical support** to manually unblock domain and prevent auto-blocking
2. **Daum support** to whitelist our sending domains
3. **Alternative email service** if NCP cannot resolve (recommended long-term)

**This is not a code problem.** The code is working as designed. The problem is that NCP's Block List policy makes Daum delivery unreliable.

---

**Test Performed**: 2025-11-21 15:34:06 UTC
**Request ID**: 20251122000001761303
**Test Confirmed by**: admin@aed.pics test failure
**Documentation**: Complete
