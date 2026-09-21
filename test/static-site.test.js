import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const staticApi = read('static-api.js');

test('all first-party page assets use repository-relative URLs', () => {
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/);
  for (const asset of [
    'styles.css', 'powiis.png', 'static-api.js', 'map.js',
    'app.js', 'admin-filters.js', 'admin.js',
  ]) {
    assert.match(html, new RegExp(`(?:src|href)="\\./${asset.replace('.', '\\.')}(?:\\?[^"\\s]*)?"`));
    assert.equal(fs.existsSync(path.join(root, asset)), true);
  }
});

test('the page offers user, administrator and guest choices', () => {
  const roles = [...html.matchAll(/data-demo-account="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(roles, ['user', 'admin', 'guest']);
  assert.match(html, /data-google-auth hidden/);
});

test('the static data adapter runs before the application scripts', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)]
    .map((match) => match[1].split('?')[0]);
  assert.ok(scripts.indexOf('./static-api.js') >= 0);
  assert.ok(scripts.indexOf('./static-api.js') < scripts.indexOf('./app.js'));
  assert.match(staticApi, /window\.__STATIC_DEMO__ = true/);
  assert.match(staticApi, /localStorage/);
  assert.match(staticApi, /\.\/data\/roster\.csv/);
});

test('only synthetic CSV identities are published', () => {
  const csvFiles = ['data/roster.csv', 'data/demo-import.csv', 'data/roster.sample.csv'];
  for (const file of csvFiles) {
    const content = read(file);
    assert.match(content, /^email,name,class,week,day,period,start,end,subject,room,teacher/m);
    const emails = [...content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
      .map((match) => match[0].toLowerCase());
    assert.ok(emails.length > 0);
    assert.ok(emails.every((email) => email.endsWith('@example.com') || email.endsWith('@student.powiis.edu.my')));
  }
});

test('no credential-shaped values or non-demo email domains are present', () => {
  const files = fs.readdirSync(root, { recursive: true })
    .filter((entry) => typeof entry === 'string' && /\.(?:html|js|css|json|md|csv|yml)$/.test(entry));
  const combined = files.map((file) => read(file)).join('\n');
  const emails = [...combined.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0].toLowerCase());
  assert.ok(emails.every((email) => email.endsWith('@example.com') || email.endsWith('@student.powiis.edu.my')));
  assert.doesNotMatch(combined, /(?:client_secret|session_secret|api[_-]?key)\s*[:=]\s*["']?[a-z0-9_\-]{16,}/i);
});

test('GitHub Pages deployment workflow publishes only after tests pass', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /needs: test/);
});
