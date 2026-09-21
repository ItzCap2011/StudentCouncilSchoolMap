/**
 * Frontend client.
 *
 * GITHUB PAGES DEMO
 * -----------------
 * This edition contains no OAuth client, server session, or private API. The
 * synthetic account choice and API-like calls are handled by static-api.js in
 * the visitor's browser. Roster text is inserted with textContent rather than
 * innerHTML.
 */


/* ============================================================
   VISIBLE ERROR REPORTING
   A silent failure is what made this so hard to diagnose. Now
   any uncaught error, rejected promise, or blocked resource is
   shown on screen AND logged, so the cause is never a mystery.
   ============================================================ */
function showError(title, detail) {
  const el = document.getElementById('err-banner');
  if (!el) return;
  el.textContent = '';
  const x = document.createElement('span');
  x.className = 'x'; x.textContent = '\u00d7';
  x.addEventListener('click', () => el.classList.remove('show'));
  const b = document.createElement('b');
  b.textContent = title;
  const p = document.createElement('span');
  p.textContent = 'Reload the page and try again. Details: ';
  const c = document.createElement('code');
  c.textContent = String(detail).slice(0, 300);
  el.append(x, b, p, c);
  el.classList.add('show');
  console.error('[campus-navigator]', title, detail);
}

window.addEventListener('error', (e) => {
  showError('A script error stopped the page loading.', e.message || 'unknown');
});
window.addEventListener('unhandledrejection', (e) => {
  showError('A request failed.', e.reason?.message ?? e.reason ?? 'unknown');
});
// Fires when the browser blocks something because of CSP.
document.addEventListener('securitypolicyviolation', (e) => {
  showError(
    'Blocked by Content-Security-Policy.',
    `${e.violatedDirective} blocked ${e.blockedURI || 'inline content'}`,
  );
});

const api = {
  async get(path) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    return handle(res);
  },
  async post(path, body, contentType = 'application/json') {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': contentType, Accept: 'application/json' },
      body: contentType === 'application/json' ? JSON.stringify(body) : body,
    });
    return handle(res);
  },
  async delete(path, body) {
    const res = await fetch(path, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return handle(res);
  },
};

async function handle(res) {
  // Only a genuine 401 means the session is gone.
  if (res.status === 401) { throw new Error('unauthenticated'); }
  if (res.status === 429) {
    const d = await res.json().catch(() => ({}));
    throw new Error(`Too many requests. Try again in ${d.retryAfterSeconds ?? 60}s.`);
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    // Show only the server's stable code + request id. Never guess internals.
    throw new Error(friendly(d.error) + (d.requestId ? ` (ref ${d.requestId.slice(0, 8)})` : ''));
  }
  return res.json();
}

/** Map server error codes to human text. Unknown codes get a generic message. */
function friendly(code) {
  return ({
    no_timetable_on_file: 'No timetable has been uploaded for your account yet.',
    domain_not_allowed: 'Please sign in with your school Google account.',
    email_not_verified: 'Your Google email is not verified.',
    forbidden: 'You do not have access to that.',
    mfa_required: 'Admin access requires 2-step verification on your Google account.',
    rate_limited: 'Too many requests.',
    payload_too_large: 'That file is too large.',
    csv_too_large: 'That CSV is too large.',
    csv_too_many_rows: 'That CSV has too many rows.',
    csv_no_valid_rows: 'No valid rows found — check the column headers.',
    csv_empty: 'That CSV contains no timetable rows.',
    csv_parse_failed: 'The CSV could not be parsed. Check its quoting and column count.',
    csv_headers_invalid: 'The CSV headers do not match the required roster format.',
    csv_contains_invalid_rows: 'Correct the invalid rows shown in the preview before importing.',
    invalid_import_mode: 'Choose a valid import behaviour.',
    import_preview_mismatch: 'The file changed after preview. Preview it again.',
    import_preview_required: 'Preview the CSV before importing it.',
    roster_changed_refresh: 'The roster changed. Refresh the student list and try again.',
    roster_write_failed: 'The roster could not be saved safely.',
    cannot_delete_last_student: 'The final student dataset cannot be deleted.',
    student_not_found: 'That student dataset no longer exists.',
    invalid_request: 'That request was not valid.',
  })[code] ?? 'Something went wrong. Please try again.';
}

/* --------------------------- bootstrap ----------------------------- */

/**
 * static-api.js has already decided which synthetic screen is showing (via
 * class="authed" on <html>) and populated #bootstrap from localStorage.
 *
 * Timetable data is read from the bundled synthetic CSV through the
 * browser-only data adapter.
 */
function init() {
  let boot = { authenticated: false };
  try {
    const el = document.getElementById('bootstrap');
    if (el) boot = JSON.parse(el.textContent);
  } catch (e) {
    showError('Could not read the page data.', e.message);
  }

  if (!boot.authenticated || !boot.user) {
    markLoaded();     // nothing is loading on the login screen
    showLogin();
    return;
  }

  showApp(boot.user);

  if (boot.user.isGuest) {
    window.__TIMETABLE__ = null;
    markLoaded();
    setAppText('lcr', 'Campus map');
    setAppText('lct', 'Select a room to see its location.');
    setAppText('floor-tag', '');
    document.querySelector('.lcl').textContent = 'Selected location';
    document.querySelector('.mobile-header').setAttribute('aria-label', 'Campus overview');
    document.querySelector('.mobile-sheet').setAttribute('aria-label', 'Selected location');
    return;
  }

  // FAST PATH — the server already embedded the timetable, so it renders
  // with no network call at all.
  if (boot.timetable) {
    renderTimetable(boot.timetable);
    return;
  }

  // FALLBACK — bootstrap had no timetable. That is expected for an admin,
  // but if a student sees it we re-ask the API before giving up, so a
  // single failure in the embedded path can never lose the timetable.
  if (boot.user.isAdmin) {
    showNoTimetable(boot.user, friendly(boot.error));
    return;
  }

  fetchTimetable()
    .then((tt) => renderTimetable(tt))
    .catch((err) => {
      console.warn('[timetable] fallback fetch failed:', err.message);
      showNoTimetable(boot.user, friendly(boot.error) || err.message);
    });
}

/**
 * Reliable fallback loader. Validates the status AND the content type —
 * a redirect to an HTML login page would otherwise be parsed as JSON and
 * throw a confusing error.
 */
async function fetchTimetable() {
  const res = await fetch('/api/me/timetable', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  const ctype = res.headers.get('content-type') ?? '';
  if (!ctype.includes('application/json')) {
    throw new Error(`Expected JSON, got ${ctype || 'no content-type'} (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  if (!data.weekA && !data.weekB) throw new Error('Response contained no timetable');
  return data;
}

/**
 * Signed in, but this account has no lessons in the roster.
 * Normal for an admin, and for any student not yet added to the CSV.
 */
function showNoTimetable(me, reason) {
  markLoaded();
  setAppText('sn', me.name || me.email);
  setAppText('sc', me.isAdmin ? 'Administrator' : 'No timetable on file');
  setAppText('lcr', me.isAdmin ? 'Admin account' : 'No timetable found');
  setAppText('lct', me.isAdmin
    ? 'Open student management to review or import timetable data.'
    : 'Your email is not in the roster yet.');
  setAppText('floor-tag', '');

  const list = document.getElementById('p-list');
  if (list) {
    list.textContent = '';
    const box = document.createElement('div');
    box.className = 'brk-div nt-box';
    const l1 = document.createElement('div');
    l1.className = 'nt-title';
    l1.textContent = me.isAdmin ? 'Signed in as administrator' : 'No lessons found';
    const l2 = document.createElement('div');
    l2.textContent = reason || '';
    const l3 = document.createElement('div');
    l3.className = 'nt-hint';
    l3.textContent = me.isAdmin
      ? 'This GitHub Pages edition uses synthetic data stored only in your browser.'
      : `Signed in as ${me.email}. This synthetic address appears in the bundled roster.csv.`;
    box.append(l1, l2, l3);
    list.appendChild(box);
  }
  // The map still works — you can browse and click rooms.
  document.dispatchEvent(new CustomEvent('timetable:empty'));
}

function showLogin() {
  document.getElementById('login-screen')?.classList.remove('out');
  document.getElementById('app')?.classList.remove('show');
}

/** Swap every skeleton placeholder for the real content. */
function markLoaded() {
  document.body.classList.add('loaded');
  const sk = document.getElementById('p-skeleton');
  if (sk) sk.remove();
}

function showApp(me) {
  document.getElementById('login-screen')?.classList.add('out');
  document.getElementById('app')?.classList.add('show');

  // textContent — never innerHTML. ASVS V1.3.1
  setAppText('uc-name', me.name || me.email);
  setAppText('uc-mail', me.isGuest ? 'Explore the campus' : me.email);
  setAppText('signout', me.isGuest ? 'Exit guest mode' : 'Sign out');
  document.getElementById('admin-tab')?.toggleAttribute('hidden', !me.isAdmin);

  if (me.picture) {
    const img = document.getElementById('uc-avatar');
    if (img) {
      img.classList.remove('u-invisible');
      img.src = me.picture;
      img.alt = '';
    }
  }
}

/** Replace CSP-blocked inline image handlers with external event listeners. */
function installImageFallbacks() {
  document.querySelectorAll('[data-image-fallback]').forEach((img) => {
    const revealFallback = () => {
      img.classList.add('u-hide');
      img.nextElementSibling?.classList.remove('u-hide');
    };
    img.addEventListener('error', revealFallback);
    if (img.complete && img.naturalWidth === 0) revealFallback();
  });

  const avatar = document.getElementById('uc-avatar');
  avatar?.addEventListener('error', () => avatar.classList.add('u-invisible'));
}

installImageFallbacks();

function setAppText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

/** Build the schedule with createElement + textContent only. */
function renderTimetable(data) {
  setAppText('sn', data.student.name);
  setAppText('sc', data.student.class);
  markLoaded();
  window.__TIMETABLE__ = { weekA: data.weekA, weekB: data.weekB };
  document.dispatchEvent(new CustomEvent('timetable:loaded'));
}

/* ------------------------------ login ------------------------------ */

/*
 * The Google sign-in enhancement belongs to the full-stack edition. It is
 * deliberately disabled for this public GitHub Pages build.
 */
const signInLink = document.getElementById('google-signin');
if (signInLink && !window.__STATIC_DEMO__) {
  const returnTo = encodeURIComponent(location.pathname + location.search);
  signInLink.setAttribute('href', `/auth/login?returnTo=${returnTo}`);
}

/*
 * static-api.js handles demo sign-out by clearing the synthetic role choice.
 */

document.addEventListener('DOMContentLoaded', init);

// Failsafe — if anything above throws, don't leave the user staring at a
// shimmering placeholder. After 8 seconds, reveal whatever we have.
setTimeout(() => {
  if (!document.body.classList.contains('loaded')) {
    console.warn('[timetable] load timed out — revealing the interface');
    markLoaded();
  }
}, 8000);

/* Move the existing schedule and account controls into the phone layout.
 * One set of controls keeps desktop, phone and rotation state in sync. */
document.addEventListener('DOMContentLoaded', () => {
  const media = window.matchMedia('(max-width: 820px), (max-width: 1024px) and (pointer: coarse) and (max-height: 600px)');
  const app = document.getElementById('app');
  const schedule = document.getElementById('mobile-schedule');
  const toggle = document.getElementById('mobile-sheet-toggle');
  const accountDialog = document.getElementById('mobile-account-dialog');
  const accountContent = document.getElementById('mobile-account-content');
  const weekToggle = document.getElementById('week-toggle');
  const placements = [
    [document.getElementById('tt-sec'), schedule],
    [document.querySelector('.user-chip'), accountContent],
    [document.getElementById('admin-tab'), accountContent],
  ].map(([node, destination]) => {
    const marker = document.createComment('desktop control position');
    node.before(marker);
    return { node, destination, marker };
  });

  function setSheet(open) {
    const expanded = media.matches && open && !document.documentElement.classList.contains('guest-mode');
    // Return focus before hiding a schedule control activated with a keyboard.
    if (!expanded && schedule.contains(document.activeElement)) toggle.focus();
    app.classList.toggle('mobile-sheet-open', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Hide timetable' : 'Show timetable');
    schedule.hidden = !expanded;
    document.getElementById('mobile-location').hidden = expanded;
  }

  function syncOverview() {
    const content = (id) => document.getElementById(id)?.textContent ?? '';
    const mirror = (target, source) => {
      const node = document.getElementById(target);
      const value = content(source);
      if (node.textContent !== value) node.textContent = value;
    };
    mirror('mobile-clock-hm', 'clock-hm');
    document.getElementById('mobile-clock-ampm').textContent = content('clock-ampm').toLowerCase();
    mirror('mobile-date', 'date-display');
    mirror('mobile-week-name', 'wk-name');
    mirror('mobile-name', 'uc-name');
    mirror('mobile-room', 'lcr');
    mirror('mobile-lesson', 'lct');
    mirror('mobile-floor', 'floor-tag');
    document.getElementById('mobile-week').setAttribute('aria-label', `Switch to Week ${weekToggle.checked ? 'A' : 'B'}`);
  }

  function applyLayout() {
    if (accountDialog.open) accountDialog.close();
    placements.forEach(({ node, destination, marker }) => {
      if (media.matches) destination.appendChild(node);
      else marker.after(node);
    });
    setSheet(false);
    syncOverview();
  }

  toggle.addEventListener('click', () => setSheet(toggle.getAttribute('aria-expanded') !== 'true'));
  document.getElementById('mobile-week').addEventListener('click', () => {
    weekToggle.checked = !weekToggle.checked;
    weekToggle.dispatchEvent(new Event('change', { bubbles: true }));
    syncOverview();
  });
  document.getElementById('mobile-account').addEventListener('click', () => accountDialog.showModal());
  document.getElementById('mobile-account-close').addEventListener('click', () => accountDialog.close());
  accountDialog.addEventListener('close', () => {
    if (media.matches && !document.querySelector('#admin-modal[open]')) document.getElementById('mobile-account').focus();
  });
  document.getElementById('admin-toggle').addEventListener('click', () => accountDialog.close(), { capture: true });
  document.addEventListener('map:room-selected', () => {
    if (media.matches) setSheet(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && app.classList.contains('mobile-sheet-open') && !document.querySelector('dialog[open]')) {
      setSheet(false);
      toggle.focus();
    }
  });
  const observer = new MutationObserver(syncOverview);
  ['clock-hm', 'clock-ampm', 'date-display', 'wk-name', 'uc-name', 'lcr', 'lct', 'floor-tag'].forEach((id) => {
    observer.observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
  });
  media.addEventListener('change', applyLayout);
  applyLayout();
});
