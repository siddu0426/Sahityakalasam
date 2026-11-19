/**
 * Verification of Upstash Redis REST pipeline rate limiting & production fail-closed behavior
 * 
 * Verifies:
 * 1. 10 simultaneous parallel requests against Upstash Redis REST protocol
 * 2. Atomic counter increments and limits to exactly 5 accepted, 5 rejected
 * 3. Fail-closed safety in production when Upstash is unconfigured
 */

import http from 'http';
import { checkRateLimit } from '../src/lib/rate-limiter.ts';

// 1. Lightweight mock server implementing Upstash Redis REST /pipeline endpoint
let redisStore = {};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/pipeline') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const commands = JSON.parse(body);
      const results = [];

      for (const cmd of commands) {
        const [op, key, ...args] = cmd;
        if (op === 'INCR') {
          redisStore[key] = (redisStore[key] || 0) + 1;
          results.push({ result: redisStore[key] });
        } else if (op === 'EXPIRE') {
          results.push({ result: 1 });
        } else if (op === 'TTL') {
          results.push({ result: 60 });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function runRedisRateLimiterTest() {
  await new Promise((resolve) => server.listen(8099, '127.0.0.1', resolve));

  console.log('========================================================================');
  console.log('⚡ UPSTASH REDIS REST SHARED RATE LIMITER VERIFICATION');
  console.log('========================================================================\n');

  // Configure environment for Upstash Redis
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:8099';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-upstash-token-xyz';
  process.env.NODE_ENV = 'development';

  console.log('1. Testing 10 simultaneous parallel requests against Redis store (Limit = 5)...');
  const testKey = `test_redis_parallel_${Date.now()}`;

  const promises10 = Array.from({ length: 10 }).map((_, idx) =>
    checkRateLimit(testKey, 5, 60000)
  );

  const results10 = await Promise.all(promises10);

  const accepted = results10.filter((r) => r.allowed);
  const rejected = results10.filter((r) => !r.allowed);

  console.log(`   Parallel requests processed: ${results10.length}`);
  console.log(`   Accepted (allowed: true):  ${accepted.length}`);
  console.log(`   Rejected (allowed: false): ${rejected.length}`);
  console.log(`   Rejected sample:`, rejected[0]);

  if (accepted.length !== 5 || rejected.length !== 5) {
    server.close();
    throw new Error(`Expected exactly 5 accepted and 5 rejected, got ${accepted.length} accepted, ${rejected.length} rejected`);
  }

  console.log('   ✅ Redis atomic pipeline enforced exactly 5 accepted, 5 rejected under parallel concurrency!\n');

  // 2. Test Production Fail-Closed
  console.log('2. Testing Production Fail-Closed Behavior (NODE_ENV=production without Upstash)...');
  process.env.NODE_ENV = 'production';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.KV_REST_API_URL;

  const prodResult = await checkRateLimit('prod_key_test', 5, 60000);
  console.log('   Production check without Upstash returned:', prodResult);

  if (prodResult.allowed !== false) {
    server.close();
    throw new Error('Expected fail-closed (allowed: false) in production when Upstash is missing!');
  }

  console.log('   ✅ Production strictly fails closed (blocks requests) when shared KV store is missing!\n');

  server.close();
  console.log('========================================================================');
  console.log('🎉 ALL UPSTASH REDIS CONCURRENCY & FAIL-CLOSED CHECKS PASSED!');
  console.log('========================================================================\n');
}

runRedisRateLimiterTest().catch((err) => {
  server.close();
  console.error('Fatal error in Redis test:', err);
  process.exit(1);
});

