# admin@aed.pics Sender Test Report

**Date**: 2025-11-21 (UTC: 15:34:06)
**Test Purpose**: Verify if `admin@aed.pics` sender can bypass Daum blocking that affects `noreply@aed.pics` and `noreply@nmc.or.kr`

## Test Details

| Field | Value |
|-------|-------|
| Sender Address | admin@aed.pics |
| Recipient | wowow212@daum.net |
| Request ID | 20251122000001761303 |
| Timestamp | 1763739246411 (2025-11-21T15:34:06.559Z) |
| HTTP Status | 201 (Accepted by NCP API) |
| Email Subject | Test Email - admin@aed.pics Sender |

## Test Status

**API Response**: ✓ ACCEPTED
HTTP 201 response with valid requestId indicates the NCP API accepted the email request.

## Next Steps - Manual Verification in NCP Console

1. **Open NCP Console**:
   - URL: https://console.ntruss.com/
   - Product: Cloud Outbound Mailer

2. **Check Email Statistics**:
   - Navigate to: Statistics tab
   - Filter by Request ID: `20251122000001761303`
   - **Look for**:
     - Status: "발송완료" (Sent) = SUCCESS
     - Status: "발송실패" (Failed) = BLOCKED

3. **Check Block List**:
   - Navigate to: Statistics > Block List
   - **Look for**:
     - Sender: admin@aed.pics (should NOT be blocked yet if test succeeds)
     - Sender: noreply@aed.pics (already blocked as of 2025-11-21 23:54:18)
     - Sender: noreply@nmc.or.kr (already blocked - 0% success rate)
     - Recipient: wowow212@daum.net (likely to show blocking)

## Expected Outcomes

### Scenario 1: admin@aed.pics Works (Unlikely but Possible)
- **Result**: wowow212@daum.net receives the email
- **Implication**: Daum blocking is account-specific (not domain-wide)
- **Next Action**: Use admin@aed.pics as primary sender for Daum addresses

### Scenario 2: admin@aed.pics Also Blocked (Most Likely)
- **Result**: Email shows "발송실패" (Failed) or gets blocked soon after
- **Implication**: Daum blocking is domain-level due to DMARC policy
- **Evidence**: Both noreply@aed.pics and admin@aed.pics fail = domain issue
- **Root Cause**: NCP's automatic Block List policy treats all @aed.pics addresses as same domain
- **Next Action**: Contact NCP technical support to request Daum domain whitelist

### Scenario 3: Immediate Block (Also Likely)
- **Result**: Email gets blocked within 1-2 minutes of sending
- **Pattern**: Same as noreply@aed.pics blocking pattern (2025-11-21 23:54:18)
- **Implication**: NCP's security policy auto-blocks domain after first failure
- **Evidence**: Confirms domain-level blocking, not account-specific

## Key Evidence from Previous Tests

Previous test results (from SMART_SENDER_FAILURE_ANALYSIS_2025-11-22.md):

| Sender | Recipient | Last Success | Status |
|--------|-----------|--------------|--------|
| noreply@aed.pics | truth530@daum.net | 2025-11-21 23:52:33 | 0% current, was working |
| noreply@aed.pics | wowow212@daum.net | N/A | Immediate failure |
| noreply@nmc.or.kr | truth530@daum.net | N/A | 0% success rate |
| noreply@nmc.or.kr | wowow212@daum.net | N/A | 0% success rate |

## Analysis

### Hypothesis Testing
1. **Hypothesis**: Daum blocks specific sender accounts
   - **Test**: Try different account (admin@aed.pics) from same domain
   - **Result**: TBD (awaiting NCP console verification)

2. **Hypothesis**: Daum blocks entire @aed.pics domain
   - **Evidence**: Both noreply@aed.pics and noreply@nmc.or.kr fail simultaneously
   - **But**: noreply@nmc.or.kr uses different domain (@nmc.or.kr)
   - **Contradiction**: So blocking might be recipient-specific, not domain-specific

3. **Hypothesis**: Daum blocks specific Daum recipient addresses
   - **Evidence**: wowow212@daum.net might have restrictive inbox rules
   - **Possible**: Compare with different Daum address (truth530@daum.net)

## Action Items

- [ ] Check NCP Console Statistics for Request ID: 20251122000001761303
- [ ] Check Block List to see if admin@aed.pics gets blocked
- [ ] If blocked: Contact NCP technical support
- [ ] If successful: Update smart-sender-selector to use admin@aed.pics for Daum
- [ ] Test with truth530@daum.net (previously successful with noreply@aed.pics)

## Conclusion

This test determines whether the Daum blocking is:
1. **Account-level** (try different account) ← Current test
2. **Domain-level** (need NCP whitelisting)
3. **Recipient-level** (need to try different Daum addresses)

Once verified, we'll know the correct remediation strategy.
