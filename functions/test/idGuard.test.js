// Checks the "/"-in-id guard in app.js runs before auth on every route.
process.env.FIREBASE_CONFIG ||= JSON.stringify({ projectId: 'demo-waradly', storageBucket: 'demo-waradly.appspot.com' });

const test = require('node:test');
const assert = require('node:assert');
const app = require('../app');

test('rejects ids containing a slash, lets normal requests through', async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.strictEqual((await fetch(`${base}/health`)).status, 200);
    assert.strictEqual((await fetch(`${base}/orders/abc%2Fstatus_history%2Fx`)).status, 404);
    assert.strictEqual((await post('/admin/disputes', { order_id: 'abc/status_history/x' })).status, 404);
    assert.strictEqual((await post('/admin/disputes', { order_id: 'abc' })).status, 401); // reaches auth
  } finally {
    server.close();
  }
});
