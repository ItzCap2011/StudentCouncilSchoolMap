import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('guest bootstrap and API calls do not load or modify the roster', async () => {
  const bootstrap = { textContent: '' };
  const classes = new Map();
  let rosterReads = 0;
  let storageWrites = 0;
  let networkCalls = 0;
  const browser = {
    fetch: async () => { networkCalls++; throw new Error('Unexpected network request'); },
  };
  const context = vm.createContext({
    window: browser, URL, Response,
    location: { href: 'https://example.com/demo/' },
    localStorage: {
      getItem(key) {
        if (key === 'powiis-pages-demo-role') return 'guest';
        rosterReads++;
        return null;
      },
      setItem() { storageWrites++; },
      removeItem() { storageWrites++; },
    },
    document: {
      getElementById: () => bootstrap,
      documentElement: { classList: { toggle: (key, value) => classes.set(key, value) } },
      addEventListener() {},
    },
  });
  vm.runInContext(fs.readFileSync(new URL('../static-api.js', import.meta.url), 'utf8'), context);
  const boot = JSON.parse(bootstrap.textContent);
  assert.equal(boot.user.isGuest, true);
  assert.equal(boot.user.isAdmin, false);
  assert.equal(boot.timetable, null);
  assert.equal(boot.error, null);
  assert.equal(classes.get('guest-mode'), true);
  for (const [path, method] of [
    ['/api/me/timetable', 'GET'],
    ['/api/admin/roster', 'GET'],
    ['/api/admin/roster/import', 'POST'],
    ['/api/admin/roster/export', 'POST'],
    ['/api/admin/roster/student/01234567890123456789', 'DELETE'],
  ]) {
    const response = await browser.fetch(path, { method });
    assert.equal(response.status, 403);
  }
  assert.equal(rosterReads, 0);
  assert.equal(storageWrites, 0);
  assert.equal(networkCalls, 0);
});

test('guest app initialization shows map guidance without requesting a timetable', () => {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: '', classList: { add() {}, remove() {} },
      setAttribute() {}, toggleAttribute() {}, remove() {}, addEventListener() {},
    });
    return nodes.get(id);
  };
  node('bootstrap').textContent = JSON.stringify({
    authenticated: true, user: { name: 'Guest', isGuest: true, isAdmin: false },
  });
  let timetableRequests = 0;
  const context = vm.createContext({
    window: { __STATIC_DEMO__: true, addEventListener() {} },
    document: {
      getElementById: node,
      querySelector: node,
      querySelectorAll: () => [],
      body: { classList: { add() {} } },
      addEventListener() {},
    },
    fetch() { timetableRequests++; throw new Error('Unexpected timetable request'); },
    setTimeout() {}, console,
  });
  vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), context);
  vm.runInContext('init()', context);
  assert.equal(timetableRequests, 0);
  assert.equal(context.window.__TIMETABLE__, null);
  assert.equal(node('uc-name').textContent, 'Guest');
  assert.equal(node('signout').textContent, 'Exit guest mode');
  assert.equal(node('lcr').textContent, 'Campus map');
  assert.equal(node('.lcl').textContent, 'Selected location');
});
