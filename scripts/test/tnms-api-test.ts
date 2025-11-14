/**
 * TNMS API Automated Test Suite
 * Tests authentication and permission controls
 * Usage: npx ts-node scripts/test/tnms-api-test.ts
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TEST_RESULTS_FILE = '/tmp/tnms-api-test-results.json';

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  timestamp: string;
}

const results: TestResult[] = [];

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode || 500, body: data });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testUnauthenticated(
  testName: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<boolean> {
  try {
    console.log(`\nTesting: ${testName}`);
    console.log(`  ${method} ${endpoint}`);

    const response = await makeRequest(method, endpoint, body);
    const expectedStatus = 401;
    const passed = response.status === expectedStatus;

    const result: TestResult = {
      name: testName,
      endpoint,
      method,
      expectedStatus,
      actualStatus: response.status,
      passed,
      timestamp: new Date().toISOString(),
    };

    results.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  Status: ${response.status} (expected ${expectedStatus}) ${status}`);

    if (!passed) {
      try {
        const json = JSON.parse(response.body);
        console.log(`  Response: ${JSON.stringify(json, null, 2)}`);
      } catch {
        console.log(`  Response: ${response.body}`);
      }
    }

    return passed;
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      name: testName,
      endpoint,
      method,
      expectedStatus: 401,
      actualStatus: 0,
      passed: false,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('TNMS API Automated Test Suite');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  let passCount = 0;
  let failCount = 0;

  // Test 1: POST /api/tnms/recommend (401)
  if (await testUnauthenticated(
    'POST /api/tnms/recommend - Unauthenticated',
    'POST',
    '/api/tnms/recommend',
    { institution_name: 'test보건소' }
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: GET /api/tnms/recommend (401)
  if (await testUnauthenticated(
    'GET /api/tnms/recommend - Unauthenticated',
    'GET',
    '/api/tnms/recommend?institution_name=test'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 3: GET /api/tnms/validate (401)
  if (await testUnauthenticated(
    'GET /api/tnms/validate - Unauthenticated',
    'GET',
    '/api/tnms/validate?validation_run_id=test'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 4: POST /api/tnms/validate (401)
  if (await testUnauthenticated(
    'POST /api/tnms/validate - Unauthenticated',
    'POST',
    '/api/tnms/validate',
    { log_id: '1', manual_review_status: 'approved' }
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 5: GET /api/tnms/metrics (401)
  if (await testUnauthenticated(
    'GET /api/tnms/metrics - Unauthenticated',
    'GET',
    '/api/tnms/metrics'
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 6: POST /api/tnms/metrics (401)
  if (await testUnauthenticated(
    'POST /api/tnms/metrics - Unauthenticated',
    'POST',
    '/api/tnms/metrics',
    { metric_date: '2025-11-14' }
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passCount} ✅`);
  console.log(`Failed: ${failCount} ❌`);
  console.log(`Success Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Save results to file
  fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${TEST_RESULTS_FILE}`);

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests if API is available, otherwise show helpful message
setTimeout(() => {
  makeRequest('GET', '/api/health').then(
    () => {
      runTests();
    },
    () => {
      console.error('\n❌ ERROR: Cannot connect to API at ' + API_BASE);
      console.error('Please ensure:');
      console.error('  1. Development server is running: npm run dev');
      console.error('  2. API_BASE environment variable is set correctly');
      console.error('\nExample:');
      console.error('  API_BASE=http://localhost:3000 npx ts-node scripts/test/tnms-api-test.ts');
      process.exit(1);
    }
  );
}, 100);
