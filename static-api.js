/*
 * Browser-only data layer for the GitHub Pages demo.
 *
 * GitHub Pages cannot run Node, Redis, sessions, or private API routes. This
 * file provides a deliberately synthetic replacement in the visitor's own
 * browser. It never contacts an authentication service and never grants real
 * access. Administrator edits are stored only in this browser's localStorage.
 */
(function initialiseStaticDemo() {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const roleKey = 'powiis-pages-demo-role';
  const rosterKey = 'powiis-pages-demo-roster-v1';
  const requiredHeaders = [
    'email', 'name', 'class', 'week', 'day', 'period',
    'start', 'end', 'subject', 'room', 'teacher',
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const periods = ['F', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'ECA'];
  const accounts = {
    user: {
      email: 'demo.user@example.com',
      name: 'Demo Student',
      picture: '',
      isAdmin: false,
    },
    admin: {
      email: 'demo.admin@example.com',
      name: 'Demo Administrator',
      picture: '',
      isAdmin: true,
    },
    guest: {
      email: '',
      name: 'Guest',
      picture: '',
      isAdmin: false,
      isGuest: true,
    },
  };

  window.__STATIC_DEMO__ = true;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode may block storage */ }
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch { /* private mode may block storage */ }
  }

  function selectedAccount() {
    return accounts[readStorage(roleKey)] ?? null;
  }

  const bootstrapElement = document.getElementById('bootstrap');
  const account = selectedAccount();
  if (bootstrapElement) {
    bootstrapElement.textContent = JSON.stringify({
      authenticated: Boolean(account),
      user: account,
      timetable: null,
      error: account?.isAdmin ? 'no_timetable_on_file' : null,
    });
  }
  document.documentElement.classList.toggle('authed', Boolean(account));
  document.documentElement.classList.toggle('guest-mode', Boolean(account?.isGuest));

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[action="./"][data-demo-account]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const role = form.dataset.demoAccount;
        if (!accounts[role]) return;
        writeStorage(roleKey, role);
        location.reload();
      });
    });

    document.getElementById('demo-signout')?.addEventListener('submit', (event) => {
      event.preventDefault();
      removeStorage(roleKey);
      location.reload();
    });

    document.getElementById('reset-demo-data')?.addEventListener('click', () => {
      removeStorage(rosterKey);
      const status = document.getElementById('reset-demo-status');
      if (status) status.textContent = 'Bundled synthetic data restored.';
    });
  });

  window.fetch = async function staticDemoFetch(input, init = {}) {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    return handleApi(url.pathname, init);
  };

  async function handleApi(pathname, init) {
    const method = String(init.method ?? 'GET').toUpperCase();
    const activeAccount = selectedAccount();
    if (!activeAccount) return json({ error: 'unauthenticated' }, 401);
    // Guest browsing never needs to load or change the demo roster.
    if (activeAccount.isGuest) return json({ error: 'forbidden' }, 403);

    const rows = await loadRows();
    const index = buildIndex(rows);

    if (pathname === '/api/me/timetable' && method === 'GET') {
      const record = index.get(activeAccount.email);
      return record
        ? json(timetableResponse(record))
        : json({ error: 'no_timetable_on_file' }, 404);
    }

    if (!activeAccount.isAdmin || !pathname.startsWith('/api/admin/')) {
      return json({ error: 'forbidden' }, 403);
    }

    if (pathname === '/api/admin/roster' && method === 'GET') {
      return json({ stats: rosterStats(index, rows), students: rosterSummary(index) });
    }

    const detailMatch = pathname.match(/^\/api\/admin\/roster\/student\/([a-f0-9]{20})$/);
    if (detailMatch && method === 'GET') {
      const found = findByStudentKey(index, detailMatch[1]);
      return found
        ? json({ student: studentDetail(found[0], found[1]) })
        : json({ error: 'student_not_found' }, 404);
    }

    if (pathname === '/api/admin/roster/preview' && method === 'POST') {
      const body = parseBody(init);
      const result = previewImport(rows, body.csv, body.mode);
      return result.error ? json({ error: result.error }, 400) : json({ preview: result.preview });
    }

    if (pathname === '/api/admin/roster/import' && method === 'POST') {
      const body = parseBody(init);
      const result = previewImport(rows, body.csv, body.mode);
      if (result.error) return json({ error: result.error }, 400);
      if (!body.confirm || body.previewDigest !== result.preview.previewDigest) {
        return json({ error: 'import_preview_mismatch' }, 409);
      }
      if (!result.preview.canImport) return json({ error: 'csv_contains_invalid_rows' }, 400);
      const csv = serializeRows(result.rows);
      writeStorage(rosterKey, csv);
      return json({
        ok: true,
        result: {
          resultingStudents: buildIndex(result.rows).size,
          resultingRows: result.rows.length,
        },
      });
    }

    if (detailMatch && method === 'DELETE') {
      const body = parseBody(init);
      if (!body.confirm) return json({ error: 'invalid_request' }, 400);
      if (body.digest !== rosterStats(index, rows).digest) {
        return json({ error: 'roster_changed_refresh' }, 409);
      }
      const found = findByStudentKey(index, detailMatch[1]);
      if (!found) return json({ error: 'student_not_found' }, 404);
      if (index.size <= 1) return json({ error: 'cannot_delete_last_student' }, 409);
      const kept = rows.filter((row) => row.email !== found[0]);
      writeStorage(rosterKey, serializeRows(kept));
      return json({ ok: true, stats: rosterStats(buildIndex(kept), kept) });
    }

    if (pathname === '/api/admin/roster/export' && method === 'POST') {
      const body = parseBody(init);
      const keys = Array.isArray(body.studentKeys) ? body.studentKeys : [];
      const selectedEmails = new Set(
        keys.map((key) => findByStudentKey(index, key)?.[0]).filter(Boolean),
      );
      const exportRows = selectedEmails.size
        ? rows.filter((row) => selectedEmails.has(row.email))
        : rows;
      return new Response(serializeRows(exportRows), {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }

    return json({ error: 'not_found' }, 404);
  }

  async function loadRows() {
    const local = readStorage(rosterKey);
    if (local) return parseAndNormalise(local).rows;
    const response = await nativeFetch('./data/roster.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the bundled demo timetable.');
    return parseAndNormalise(await response.text()).rows;
  }

  function parseBody(init) {
    try { return JSON.parse(String(init.body ?? '{}')); } catch { return {}; }
  }

  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  function parseAndNormalise(csvText) {
    const table = parseCsv(csvText);
    if (!table.length) return { rows: [], errors: [{ line: 1, code: 'csv_empty' }] };
    const headers = table[0].map((value) => value.replace(/^\uFEFF/, '').trim().toLowerCase());
    if (
      headers.length !== new Set(headers).size
      || requiredHeaders.some((header) => !headers.includes(header))
    ) {
      return { rows: [], errors: [{ line: 1, code: 'csv_headers_invalid' }] };
    }

    const rows = [];
    const errors = [];
    const slots = new Map();
    const studentFacts = new Map();
    const exactRows = new Set();

    table.slice(1).forEach((values, index) => {
      const line = index + 2;
      if (values.every((value) => !value.trim())) return;
      if (values.length !== headers.length) {
        errors.push({ line, code: 'csv_parse_failed' });
        return;
      }
      const raw = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
      const row = {
        email: raw.email.toLowerCase(),
        name: neutraliseFormula(raw.name),
        class: neutraliseFormula(raw.class),
        week: raw.week.toUpperCase(),
        day: raw.day,
        period: raw.period.toUpperCase(),
        start: raw.start,
        end: raw.end,
        subject: neutraliseFormula(raw.subject),
        room: raw.room,
        teacher: neutraliseFormula(raw.teacher),
      };
      const invalidCode = validateRow(row);
      if (invalidCode) {
        errors.push({ line, code: invalidCode });
        return;
      }
      const fact = studentFacts.get(row.email);
      if (fact && fact.name !== row.name) {
        errors.push({ line, code: 'inconsistent_student_name' });
        return;
      }
      if (fact && fact.className !== row.class) {
        errors.push({ line, code: 'inconsistent_year_group' });
        return;
      }
      studentFacts.set(row.email, { name: row.name, className: row.class });

      const exact = requiredHeaders.map((header) => row[header]).join('\u0000');
      if (exactRows.has(exact)) return;
      exactRows.add(exact);

      const slot = [row.email, row.week, row.day, row.period].join('\u0000');
      if (slots.has(slot)) {
        errors.push({ line, code: 'duplicate_timetable_slot' });
        return;
      }
      slots.set(slot, line);
      rows.push(row);
    });

    return { rows, errors };
  }

  function validateRow(row) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'invalid_email';
    if (!row.name || row.name.length > 80) return 'invalid_name';
    if (row.class.length > 60) return 'invalid_class';
    if (!['A', 'B'].includes(row.week)) return 'invalid_week';
    if (!days.includes(row.day)) return 'invalid_day';
    if (!periods.includes(row.period)) return 'invalid_period';
    if (row.start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)) return 'invalid_start';
    if (row.end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)) return 'invalid_end';
    if (!row.subject || row.subject.length > 60) return 'invalid_subject';
    if (!/^[A-Za-z0-9_]{1,16}$/.test(row.room)) return 'invalid_room';
    if (row.teacher.length > 60) return 'invalid_teacher';
    return null;
  }

  function neutraliseFormula(value) {
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field === '') {
        quoted = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function buildIndex(rows) {
    const index = new Map();
    for (const row of rows) {
      if (!index.has(row.email)) {
        index.set(row.email, {
          email: row.email,
          name: row.name,
          class: row.class,
          rows: [],
          weekA: emptyWeek(),
          weekB: emptyWeek(),
        });
      }
      const record = index.get(row.email);
      record.rows.push({ ...row });
      const week = row.week === 'B' ? record.weekB : record.weekA;
      week[row.day][row.period] = {
        start: row.start,
        end: row.end,
        subject: row.subject,
        room: row.room,
        teacher: row.teacher,
      };
    }
    return index;
  }

  function emptyWeek() {
    return Object.fromEntries(days.map((day) => [day, {}]));
  }

  function timetableResponse(record) {
    return {
      student: { name: record.name, class: record.class },
      weekA: record.weekA,
      weekB: record.weekB,
    };
  }

  function rosterStats(index, rows) {
    return {
      students: index.size,
      entries: rows.length,
      loadedAt: Date.now(),
      digest: hashHex(serializeRows(rows), 12),
    };
  }

  function rosterSummary(index) {
    return [...index.entries()].map(([email, record]) => ({
      id: studentKey(email),
      email,
      name: record.name,
      class: record.class,
      year: displayYear(record.class),
      entries: record.rows.length,
      status: record.rows.length ? 'Timetable ready' : 'No timetable',
    })).sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }));
  }

  function studentDetail(email, record) {
    return {
      id: studentKey(email),
      email,
      name: record.name,
      class: record.class,
      year: displayYear(record.class),
      entries: record.rows.length,
      rows: [...record.rows].sort(compareRows),
    };
  }

  function findByStudentKey(index, key) {
    return [...index.entries()].find(([email]) => studentKey(email) === key) ?? null;
  }

  function studentKey(email) {
    return hashHex(`pages-demo:${email}`, 20);
  }

  function displayYear(className) {
    const match = String(className).match(/(?:\byear\s*|\by\s*)(1[0-3]|[7-9])\b/i)
      ?? String(className).match(/^\s*(1[0-3]|[7-9])\s*$/);
    return match ? `Year ${Number(match[1])}` : (className || 'Not specified');
  }

  function compareRows(left, right) {
    return left.week.localeCompare(right.week)
      || days.indexOf(left.day) - days.indexOf(right.day)
      || periods.indexOf(left.period) - periods.indexOf(right.period);
  }

  function previewImport(currentRows, csvText, mode) {
    if (typeof csvText !== 'string' || !['merge', 'replace'].includes(mode)) {
      return { error: 'invalid_request' };
    }
    const parsed = parseAndNormalise(csvText);
    if (parsed.errors[0]?.code === 'csv_headers_invalid') return { error: 'csv_headers_invalid' };
    if (!parsed.rows.length && !parsed.errors.length) return { error: 'csv_empty' };

    const current = buildIndex(currentRows);
    const incoming = buildIndex(parsed.rows);
    let resultingRows = mode === 'replace'
      ? [...parsed.rows]
      : currentRows.filter((row) => !incoming.has(row.email)).concat(parsed.rows);
    resultingRows = [...resultingRows].sort(compareRowsWithEmail);

    const incomingEmails = new Set(incoming.keys());
    const removedStudents = mode === 'replace'
      ? [...current.keys()].filter((email) => !incomingEmails.has(email)).length
      : 0;
    const previewDigest = hashHex(`${mode}\u0000${csvText}\u0000${serializeRows(currentRows)}`, 64);
    return {
      rows: resultingRows,
      preview: {
        canImport: parsed.errors.length === 0 && parsed.rows.length > 0,
        studentsDetected: incoming.size,
        timetableRows: parsed.rows.length,
        newStudents: [...incoming.keys()].filter((email) => !current.has(email)).length,
        updatedStudents: [...incoming.keys()].filter((email) => current.has(email)).length,
        removedStudents,
        invalidRows: parsed.errors.length,
        duplicateRows: 0,
        resultingStudents: buildIndex(resultingRows).size,
        resultingRows: resultingRows.length,
        errors: parsed.errors.slice(0, 100),
        previewDigest,
      },
    };
  }

  function compareRowsWithEmail(left, right) {
    return left.email.localeCompare(right.email) || compareRows(left, right);
  }

  function serializeRows(rows) {
    const lines = [requiredHeaders.join(',')];
    for (const row of [...rows].sort(compareRowsWithEmail)) {
      lines.push(requiredHeaders.map((header) => csvCell(row[header] ?? '')).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function hashHex(value, length) {
    let state = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      state ^= value.charCodeAt(index);
      state = Math.imul(state, 16777619) >>> 0;
    }
    let output = '';
    while (output.length < length) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      output += (state >>> 0).toString(16).padStart(8, '0');
    }
    return output.slice(0, length);
  }
}());
