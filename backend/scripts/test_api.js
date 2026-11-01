const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const User = require('../models/User');
const connectDB = require('../config/db');

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const testPassword = 'Cakes1!';
let uniqueEmail;

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: Number(process.env.API_TEST_PORT || process.env.PORT || 5000),
        path,
        method,
        headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: responseBody });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
};

async function runTests() {
  console.log('=== STARTING API SMOKE CHECKS ===\n');

  // Test 1: Product catalogue responds publicly with usable photo URLs.
  console.log('1. Testing public cake catalogue...');
  const catalogRes = await request('GET', '/api/catalog');
  if (catalogRes.status !== 200 || !Array.isArray(catalogRes.body.products) || !catalogRes.body.products.length || catalogRes.body.products.some((product) => !product.image)) {
    throw new Error('Catalogue check failed: expected products with photo URLs.');
  }
  console.log(`✔ Catalogue returned ${catalogRes.body.products.length} cakes with photos.\n`);

  // Test 2: Reject a password that violates the published policy.
  console.log('2. Testing password policy...');
  const invalidPasswordRes = await request('POST', '/api/auth/register', { name: 'API Check', email: `invalid_${Date.now()}@example.com`, password: 'password123' });
  if (invalidPasswordRes.status !== 400 || !/6–12/.test(invalidPasswordRes.body.message || '')) throw new Error('Password policy check failed.');
  console.log('✔ Registration rejects passwords that do not meet the 6–12 character complexity rules.\n');

  // Test 3: User Registration
  console.log('3. Testing User Registration (POST /api/auth/register)...');
  uniqueEmail = `api_check_${Date.now()}@example.com`;
  const regRes = await request('POST', '/api/auth/register', {
    name: 'API Check',
    email: uniqueEmail,
    password: testPassword,
    role: 'admin', // Attempt privilege escalation, should be ignored!
  });
  console.log(`Status: ${regRes.status}`);
  if (regRes.status !== 201 || regRes.body.user?.role !== 'user') {
    throw new Error('Registration test failed: role was not set to user or status not 201');
  }
  const userToken = regRes.body.token;
  console.log('✔ Registration successful. Role correctly forced to "user". Token received.\n');

  // Test 2: User Login
  console.log('4. Testing User Login (POST /api/auth/login)...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: testPassword,
  });
  console.log(`Status: ${loginRes.status}`);
  console.log('User Role in login response:', loginRes.body.user?.role);
  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error('User login test failed');
  }
  console.log('✔ User Login passed.\n');

  // Test 3: Protected User Profile
  console.log('5. Testing User Profile (GET /api/auth/profile) with User JWT...');
  const profRes = await request('GET', '/api/auth/profile', null, userToken);
  console.log(`Status: ${profRes.status}`);
  if (profRes.status !== 200 || profRes.body.email !== uniqueEmail) {
    throw new Error('User profile test failed');
  }
  console.log('✔ User profile retrieval passed.\n');

  // Test 4: Normal User Access to Admin Route (Expect 403 Forbidden)
  console.log('6. Testing User Access to Admin Test with User JWT (Expect 403)...');
  const forbiddenRes = await request('GET', '/api/admin/test', null, userToken);
  console.log(`Status: ${forbiddenRes.status}`);
  console.log('Response:', forbiddenRes.body);
  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for normal user, but got ${forbiddenRes.status}`);
  }
  console.log('✔ Role-based protection passed! User received 403 Forbidden on admin endpoint.\n');

  let passed = 6;
  if (adminEmail && adminPassword) {
    console.log('5. Testing admin sign-in and role access...');
    const adminLoginRes = await request('POST', '/api/auth/login', { email: adminEmail, password: adminPassword });
    if (adminLoginRes.status !== 200 || adminLoginRes.body.user?.role !== 'admin' || !adminLoginRes.body.token) {
      const reason = typeof adminLoginRes.body?.message === 'string' ? `: ${adminLoginRes.body.message}` : '';
      throw new Error(`Admin login test failed (HTTP ${adminLoginRes.status})${reason}`);
    }
    const adminTestRes = await request('GET', '/api/admin/test', null, adminLoginRes.body.token);
    if (adminTestRes.status !== 200 || !adminTestRes.body.message?.includes('Admin access granted')) {
      const reason = typeof adminTestRes.body?.message === 'string' ? `: ${adminTestRes.body.message}` : '';
      throw new Error(`Admin authorization test failed (HTTP ${adminTestRes.status})${reason}`);
    }
    console.log('✔ Admin login and authorization passed.\n');
    passed += 2;
  } else {
    console.log('Admin login checks skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not configured.\n');
  }

  // Test 7: Unauthenticated Request to Protected Route (Expect 401 Unauthorized)
  console.log('Testing Access without Token (Expect 401)...');
  const noTokenRes = await request('GET', '/api/admin/test', null, null);
  console.log(`Status: ${noTokenRes.status}`);
  console.log('Response:', noTokenRes.body);
  if (noTokenRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for missing token, but got ${noTokenRes.status}`);
  }
  console.log('✔ Unauthenticated check passed: 401 received.\n');

  // Test 8: Invalid Credentials Login (Expect 401)
  console.log('Testing Login with Wrong Password (Expect 401)...');
  const badLoginRes = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'WrongPassword!',
  });
  console.log(`Status: ${badLoginRes.status}`);
  console.log('Response:', badLoginRes.body);
  if (badLoginRes.status !== 401) {
    throw new Error(`Expected 401 for wrong password, but got ${badLoginRes.status}`);
  }
  console.log('✔ Wrong password check passed: 401 received.\n');

  console.log('==============================================');
  console.log(`✔ All ${passed + 2} configured API checks passed.`);
  console.log('==============================================');
}

async function cleanup() {
  if (!uniqueEmail || !process.env.MONGODB_URI) return;
  const alreadyConnected = mongoose.connection.readyState === 1;
  try {
    if (!alreadyConnected) await connectDB();
    await User.deleteOne({ email: uniqueEmail });
  } finally {
    if (!alreadyConnected && mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
}

runTests()
  .then(cleanup)
  .catch(async (error) => {
    console.error('API checks failed:', error.message);
    try { await cleanup(); } catch (cleanupError) { console.error('Temporary test account cleanup failed:', cleanupError.message); }
    process.exitCode = 1;
  });
