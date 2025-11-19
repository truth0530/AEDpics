#!/usr/bin/env node

/**
 * TNMS 매칭 실행 (API 호출 방식)
 */

const API_URL = 'http://localhost:3001/api/admin/tnms-matching/execute';
const BATCH_SIZE = 500; // 배치 크기

async function runMatching() {
  console.log('=== TNMS 매칭 시작 ===');
  console.log('시작 시간:', new Date().toISOString());

  try {
    // 먼저 통계 확인
    const statsResponse = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Cookie': 'authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZ0d0Zjk3M05TWFV4ZU5aSHJFSUxKVzc3VFdULWYtT25wNGJGaWFCNnctN0s5c0o0VV9hWFhCOXhFZXltUmJ2UHh2VzZIX0xyMWZOQS1vZTRaZHYyayJ9..VcH13o5gLWzHgHt-k40k4w.pMhhjnQ_1YpfhAbciKfb7VrvLRRMJtHnZMqwi-RM-1nLOzuvRK-eMdgksS1FS5sxD1AqZX3Xkdmfr1qqaOWL1dGvGKQP7wfNv_j8gfCJXJEXJQb5KvXo36b8-HBJlqSP5VCMCg6Zw_xTBe25Ai0LvQo1GrwEXcdJJJPV6y3TN-yt7ZZGxGCf3V9DuqfRaJnN4K1V7OvEJ2FGUBNr5QLIiGE4pSNOjOduwdBGbJd1ojCQVFdDNs2A88fRh5HQsyENrnXJ-pJJcIJHUu6VkP7aHnq_LCYp-vJTiJ4dLqhfz-xQf1A2F1ZcU8DqC8qKkRXL92Fx5dMYMJCRR6rqNTHjxdBb3kMwQsrUIi7fEkKvyKBzm0SHo-uE3j7T5OTZYBnONcTQN-sOc3XrMJRIxXZ0PxMu5RoWJU5Fxv3Lf7bN4f_xXFMfXGwDyKqUIjrGW3PEHZH5kOzX9YayT-jkC96JJaWx_9F9DHRrKJRPnG84VLH3iLrjkJbGGcCEV1F_8dXQJwqWQOzbiP-zRqUJjfLy5WzOX0-z-a4i0p0jhqLe1H7F0GyOgJvvtOoAXQ-0DRZsGGFdRtJvXJhU84B3kCO_h_yyaJJXMKaKrsj_lPnA-N-eEKQ-DGKy_nEKsxr6.aGOPSJJJE-jA8PUIajJrbGTHNdBYCZPuLAK4yOOvFJ8; authjs.callback-url=http%3A%2F%2Flocalhost%3A3001'
      }
    });

    if (!statsResponse.ok) {
      console.error('통계 조회 실패:', statsResponse.statusText);
      return;
    }

    const stats = await statsResponse.json();
    console.log('\n현재 상태:');
    console.log(`  - 타겟 총 개수: ${stats.targetCount}`);
    console.log(`  - AED 총 개수: ${stats.aedCount}`);
    console.log(`  - 현재 매칭 완료: ${stats.matchedCount}`);

    // 배치 처리
    let offset = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
      console.log(`\n배치 처리: offset=${offset}, batchSize=${BATCH_SIZE}`);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZ0d0Zjk3M05TWFV4ZU5aSHJFSUxKVzc3VFdULWYtT25wNGJGaWFCNnctN0s5c0o0VV9hWFhCOXhFZXltUmJ2UHh2VzZIX0xyMWZOQS1vZTRaZHYyayJ9..VcH13o5gLWzHgHt-k40k4w.pMhhjnQ_1YpfhAbciKfb7VrvLRRMJtHnZMqwi-RM-1nLOzuvRK-eMdgksS1FS5sxD1AqZX3Xkdmfr1qqaOWL1dGvGKQP7wfNv_j8gfCJXJEXJQb5KvXo36b8-HBJlqSP5VCMCg6Zw_xTBe25Ai0LvQo1GrwEXcdJJJPV6y3TN-yt7ZZGxGCf3V9DuqfRaJnN4K1V7OvEJ2FGUBNr5QLIiGE4pSNOjOduwdBGbJd1ojCQVFdDNs2A88fRh5HQsyENrnXJ-pJJcIJHUu6VkP7aHnq_LCYp-vJTiJ4dLqhfz-xQf1A2F1ZcU8DqC8qKkRXL92Fx5dMYMJCRR6rqNTHjxdBb3kMwQsrUIi7fEkKvyKBzm0SHo-uE3j7T5OTZYBnONcTQN-sOc3XrMJRIxXZ0PxMu5RoWJU5Fxv3Lf7bN4f_xXFMfXGwDyKqUIjrGW3PEHZH5kOzX9YayT-jkC96JJaWx_9F9DHRrKJRPnG84VLH3iLrjkJbGGcCEV1F_8dXQJwqWQOzbiP-zRqUJjfLy5WzOX0-z-a4i0p0jhqLe1H7F0GyOgJvvtOoAXQ-0DRZsGGFdRtJvXJhU84B3kCO_h_yyaJJXMKaKrsj_lPnA-N-eEKQ-DGKy_nEKsxr6.aGOPSJJJE-jA8PUIajJrbGTHNdBYCZPuLAK4yOOvFJ8; authjs.callback-url=http%3A%2F%2Flocalhost%3A3001'
        },
        body: JSON.stringify({
          batchSize: BATCH_SIZE,
          startOffset: offset
        })
      });

      if (!response.ok) {
        console.error('매칭 실행 실패:', response.statusText);
        break;
      }

      const result = await response.json();

      if (result.error) {
        console.error('에러:', result.error);
        break;
      }

      console.log(`  처리 완료: ${result.processed}건`);
      console.log(`  매칭: ${result.matched}건 (높음: ${result.highConfidence}, 중간: ${result.mediumConfidence}, 낮음: ${result.lowConfidence})`);
      console.log(`  전체 진행률: ${result.totalProcessed}/${result.totalTargets} (${Math.round((result.totalProcessed / result.totalTargets) * 100)}%)`);

      totalProcessed += result.processed;
      offset = result.nextOffset;
      hasMore = result.hasMore;

      // 잠시 대기 (서버 부하 방지)
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 최종 통계
    const finalStatsResponse = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Cookie': 'authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiZ0d0Zjk3M05TWFV4ZU5aSHJFSUxKVzc3VFdULWYtT25wNGJGaWFCNnctN0s5c0o0VV9hWFhCOXhFZXltUmJ2UHh2VzZIX0xyMWZOQS1vZTRaZHYyayJ9..VcH13o5gLWzHgHt-k40k4w.pMhhjnQ_1YpfhAbciKfb7VrvLRRMJtHnZMqwi-RM-1nLOzuvRK-eMdgksS1FS5sxD1AqZX3Xkdmfr1qqaOWL1dGvGKQP7wfNv_j8gfCJXJEXJQb5KvXo36b8-HBJlqSP5VCMCg6Zw_xTBe25Ai0LvQo1GrwEXcdJJJPV6y3TN-yt7ZZGxGCf3V9DuqfRaJnN4K1V7OvEJ2FGUBNr5QLIiGE4pSNOjOduwdBGbJd1ojCQVFdDNs2A88fRh5HQsyENrnXJ-pJJcIJHUu6VkP7aHnq_LCYp-vJTiJ4dLqhfz-xQf1A2F1ZcU8DqC8qKkRXL92Fx5dMYMJCRR6rqNTHjxdBb3kMwQsrUIi7fEkKvyKBzm0SHo-uE3j7T5OTZYBnONcTQN-sOc3XrMJRIxXZ0PxMu5RoWJU5Fxv3Lf7bN4f_xXFMfXGwDyKqUIjrGW3PEHZH5kOzX9YayT-jkC96JJaWx_9F9DHRrKJRPnG84VLH3iLrjkJbGGcCEV1F_8dXQJwqWQOzbiP-zRqUJjfLy5WzOX0-z-a4i0p0jhqLe1H7F0GyOgJvvtOoAXQ-0DRZsGGFdRtJvXJhU84B3kCO_h_yyaJJXMKaKrsj_lPnA-N-eEKQ-DGKy_nEKsxr6.aGOPSJJJE-jA8PUIajJrbGTHNdBYCZPuLAK4yOOvFJ8; authjs.callback-url=http%3A%2F%2Flocalhost%3A3001'
      }
    });

    const finalStats = await finalStatsResponse.json();

    console.log('\n=== 매칭 완료 ===');
    console.log(`총 처리: ${totalProcessed}건`);
    console.log(`매칭 완료: ${finalStats.matchedCount}건`);
    console.log(`매칭률: ${finalStats.matchRate}%`);
    console.log('\n상세 통계:', finalStats.stats);
    console.log('\n종료 시간:', new Date().toISOString());

  } catch (error) {
    console.error('실행 오류:', error);
    process.exit(1);
  }
}

// 실행
runMatching();