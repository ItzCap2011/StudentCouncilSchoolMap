/* Administrative student and timetable management. */

const adminState = {
  students: [],
  stats: null,
  search: '',
  year: '',
  sort: 'az',
  detail: null,
  deleteTarget: null,
  pendingCsv: '',
  pendingPreview: null,
};

const adminEl = (id) => document.getElementById(id);
const adminModal = adminEl('admin-modal');
const adminImportDialog = adminEl('admin-import-dialog');
const adminDeleteDialog = adminEl('admin-delete-dialog');

function adminSetText(id, value) {
  const element = adminEl(id);
  if (element) element.textContent = value ?? '';
}

function adminClear(element) {
  if (element) element.textContent = '';
}

function adminShowStatus(id, message = '', type = '') {
  const element = adminEl(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', type === 'error');
  element.classList.toggle('is-success', type === 'success');
}

function adminIcon(pathData) {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.setAttribute('class', 'ui-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  for (const data of pathData) {
    const pathElement = document.createElementNS(namespace, 'path');
    pathElement.setAttribute('d', data);
    icon.appendChild(pathElement);
  }
  return icon;
}

function adminOpenManager() {
  if (!adminModal) return;
  adminShowListPanel();
  if (!adminModal.open) adminModal.showModal();
  adminLoadRoster();
}

function adminCloseManager() {
  adminModal?.close();
  adminEl('admin-toggle')?.focus();
}

async function adminLoadRoster(successMessage = '') {
  adminShowStatus('admin-status', 'Loading student data…');
  try {
    const response = await api.get('/api/admin/roster');
    adminState.students = response.students ?? [];
    adminState.stats = response.stats ?? null;
    adminPopulateYears();
    adminRenderStudents();
    adminShowStatus('admin-status', successMessage, successMessage ? 'success' : '');
  } catch (error) {
    adminShowStatus('admin-status', error.message, 'error');
  }
}

function adminPopulateYears() {
  const select = adminEl('admin-year-filter');
  if (!select) return;
  const current = adminState.year;
  while (select.options.length > 1) select.remove(1);
  const years = [...new Set(adminState.students.map((student) => student.year))]
    .filter(Boolean)
    .sort((left, right) => {
      const leftNumber = Number(String(left).match(/\d+/)?.[0] ?? 999);
      const rightNumber = Number(String(right).match(/\d+/)?.[0] ?? 999);
      return leftNumber - rightNumber || left.localeCompare(right);
    });
  for (const year of years) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    select.appendChild(option);
  }
  select.value = years.includes(current) ? current : '';
  adminState.year = select.value;
}

function adminFilteredStudents() {
  return window.AdminFilters.filterStudents(adminState.students, {
    search: adminState.search,
    year: adminState.year,
    sort: adminState.sort,
  });
}

function adminRenderStudents() {
  const body = adminEl('admin-student-rows');
  if (!body) return;
  adminClear(body);
  const students = adminFilteredStudents();

  for (const student of students) {
    const row = document.createElement('tr');
    const studentCell = document.createElement('td');
    const name = document.createElement('div');
    name.className = 'student-name';
    name.textContent = student.name || 'Unnamed student';
    const className = document.createElement('div');
    className.className = 'student-class';
    className.textContent = window.AdminFilters.formatYearStage(student.year ?? student.class);
    studentCell.append(name, className);

    const accountCell = document.createElement('td');
    const email = document.createElement('span');
    email.className = 'account-email';
    email.textContent = student.email;
    accountCell.appendChild(email);

    const yearCell = document.createElement('td');
    yearCell.textContent = student.year;
    const entriesCell = document.createElement('td');
    entriesCell.textContent = String(student.entries);
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = 'status-badge';
    status.textContent = student.status;
    statusCell.appendChild(status);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const view = document.createElement('button');
    view.className = 'table-action';
    view.type = 'button';
    view.textContent = 'View';
    view.setAttribute('aria-label', `View timetable for ${student.name}`);
    view.addEventListener('click', () => adminOpenDetail(student.id));
    const remove = document.createElement('button');
    remove.className = 'table-action danger';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete timetable data for ${student.name}`);
    remove.addEventListener('click', () => adminOpenDelete(student));
    actions.append(view, remove);
    actionsCell.appendChild(actions);
    row.append(studentCell, accountCell, yearCell, entriesCell, statusCell, actionsCell);
    body.appendChild(row);
  }

  adminEl('admin-empty')?.toggleAttribute('hidden', students.length !== 0);
  const total = adminState.students.length;
  const noun = total === 1 ? 'student' : 'students';
  adminSetText(
    'admin-result-count',
    students.length === total ? `${total} ${noun}` : `${students.length} of ${total} students`,
  );
  adminEl('admin-search-clear')?.toggleAttribute('hidden', !adminState.search);
  adminRenderFilterChips();
}

function adminRenderFilterChips() {
  const container = adminEl('admin-filter-chips');
  if (!container) return;
  adminClear(container);
  const filters = [];
  if (adminState.search) filters.push({
    label: `Search: ${adminState.search}`,
    clear: () => {
      adminState.search = '';
      adminEl('admin-search').value = '';
    },
  });
  if (adminState.year) filters.push({
    label: adminState.year,
    clear: () => {
      adminState.year = '';
      adminEl('admin-year-filter').value = '';
    },
  });
  if (adminState.sort !== 'az') filters.push({
    label: `Sort: ${adminEl('admin-sort')?.selectedOptions?.[0]?.textContent ?? adminState.sort}`,
    clear: () => {
      adminState.sort = 'az';
      adminEl('admin-sort').value = 'az';
    },
  });

  for (const filter of filters) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    const label = document.createElement('span');
    label.textContent = filter.label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove filter: ${filter.label}`);
    remove.appendChild(adminIcon(['M18 6 6 18', 'm6 6 12 12']));
    remove.addEventListener('click', () => {
      filter.clear();
      adminRenderStudents();
    });
    chip.append(label, remove);
    container.appendChild(chip);
  }
  adminEl('admin-clear-filters')?.toggleAttribute('hidden', filters.length === 0);
}

function adminClearFilters() {
  adminState.search = '';
  adminState.year = '';
  adminState.sort = 'az';
  adminEl('admin-search').value = '';
  adminEl('admin-year-filter').value = '';
  adminEl('admin-sort').value = 'az';
  adminRenderStudents();
}

async function adminOpenDetail(studentId) {
  adminShowStatus('admin-status', 'Loading timetable details…');
  try {
    const response = await api.get(`/api/admin/roster/student/${encodeURIComponent(studentId)}`);
    adminState.detail = response.student;
    adminRenderDetail(response.student);
    adminEl('admin-list-panel').hidden = true;
    adminEl('admin-detail-panel').hidden = false;
    adminEl('admin-detail-back')?.focus();
    adminShowStatus('admin-status');
  } catch (error) {
    adminShowStatus('admin-status', error.message, 'error');
  }
}

function adminRenderDetail(student) {
  adminSetText('admin-detail-title', student.name);
  adminSetText('admin-detail-email', student.email);
  adminSetText('admin-detail-year', student.year);
  adminSetText('admin-detail-entries', String(student.entries));
  const body = adminEl('admin-detail-rows');
  adminClear(body);
  for (const lesson of student.rows ?? []) {
    const row = document.createElement('tr');
    for (const value of [
      lesson.week,
      lesson.day,
      lesson.period,
      lesson.start && lesson.end ? `${lesson.start}–${lesson.end}` : '—',
      lesson.subject,
      lesson.teacher || '—',
      lesson.room,
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
}

function adminShowListPanel() {
  if (adminEl('admin-list-panel')) adminEl('admin-list-panel').hidden = false;
  if (adminEl('admin-detail-panel')) adminEl('admin-detail-panel').hidden = true;
  adminState.detail = null;
}

function adminOpenImport() {
  adminResetImport();
  adminImportDialog?.showModal();
}

function adminResetImport() {
  adminState.pendingCsv = '';
  adminState.pendingPreview = null;
  if (adminEl('admin-csv-file')) adminEl('admin-csv-file').value = '';
  adminSetText('admin-file-name', 'Maximum 2 MB');
  adminEl('admin-import-preview')?.setAttribute('hidden', '');
  adminEl('admin-import-confirm').disabled = true;
  adminShowStatus('admin-import-status');
}

function adminCloseImport() {
  adminImportDialog?.close();
  adminEl('admin-import-open')?.focus();
}

async function adminChooseCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    adminShowStatus('admin-import-status', 'That file is larger than 2 MB.', 'error');
    return;
  }
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    adminShowStatus('admin-import-status', 'Choose a CSV file.', 'error');
    return;
  }
  adminSetText('admin-file-name', file.name);
  adminState.pendingCsv = await file.text();
  await adminPreviewImport();
}

async function adminPreviewImport() {
  if (!adminState.pendingCsv) return;
  const mode = adminEl('admin-import-mode').value;
  adminShowStatus('admin-import-status', 'Validating CSV…');
  adminEl('admin-import-confirm').disabled = true;
  try {
    const response = await api.post('/api/admin/roster/preview', {
      csv: adminState.pendingCsv,
      mode,
    });
    adminState.pendingPreview = response.preview;
    adminRenderPreview(response.preview);
    adminShowStatus(
      'admin-import-status',
      response.preview.canImport
        ? 'Validation passed. Review the changes before importing.'
        : 'Correct the invalid rows before importing.',
      response.preview.canImport ? 'success' : 'error',
    );
    adminEl('admin-import-confirm').disabled = !response.preview.canImport;
  } catch (error) {
    adminState.pendingPreview = null;
    adminEl('admin-import-preview')?.setAttribute('hidden', '');
    adminShowStatus('admin-import-status', error.message, 'error');
  }
}

function adminRenderPreview(preview) {
  adminEl('admin-import-preview')?.removeAttribute('hidden');
  adminSetText('preview-students', preview.studentsDetected);
  adminSetText('preview-rows', preview.timetableRows);
  adminSetText('preview-new', preview.newStudents);
  adminSetText('preview-updated', preview.updatedStudents);
  adminSetText('preview-removed', preview.removedStudents);
  adminSetText('preview-invalid', preview.invalidRows);
  adminSetText('preview-duplicates', preview.duplicateRows);
  adminSetText('preview-result', `${preview.resultingStudents} students · ${preview.resultingRows} rows`);
  const errorBox = adminEl('admin-preview-errors');
  const list = adminEl('admin-preview-error-list');
  adminClear(list);
  for (const item of preview.errors ?? []) {
    const line = document.createElement('li');
    line.textContent = `Line ${item.line}: ${adminPreviewError(item.code)}`;
    list.appendChild(line);
  }
  errorBox?.toggleAttribute('hidden', !preview.errors?.length);
}

function adminPreviewError(code) {
  const labels = {
    invalid_email: 'invalid account email',
    invalid_name: 'missing or invalid student name',
    invalid_class: 'invalid year/class value',
    invalid_week: 'week must be A or B',
    invalid_day: 'invalid school day',
    invalid_period: 'invalid timetable period',
    invalid_start: 'invalid start time',
    invalid_end: 'invalid end time',
    invalid_subject: 'missing or invalid subject',
    invalid_room: 'invalid room code',
    invalid_teacher: 'invalid teacher value',
    duplicate_timetable_slot: 'more than one lesson uses the same week/day/period',
    inconsistent_student_name: 'student name differs from earlier rows for this account',
    inconsistent_year_group: 'year/class differs from earlier rows for this account',
  };
  return labels[code] ?? 'invalid row';
}

async function adminCommitImport() {
  const preview = adminState.pendingPreview;
  if (!preview?.canImport) return;
  const button = adminEl('admin-import-confirm');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  adminShowStatus('admin-import-status', 'Saving demo data in this browser…');
  try {
    const response = await api.post('/api/admin/roster/import', {
      csv: adminState.pendingCsv,
      mode: adminEl('admin-import-mode').value,
      previewDigest: preview.previewDigest,
      confirm: true,
    });
    adminCloseImport();
    const result = response.result;
    await adminLoadRoster(`Imported ${result.resultingRows} timetable entries for ${result.resultingStudents} students.`);
  } catch (error) {
    adminShowStatus('admin-import-status', error.message, 'error');
    button.disabled = false;
  } finally {
    button.removeAttribute('aria-busy');
  }
}

function adminOpenDelete(student) {
  adminState.deleteTarget = student;
  adminSetText('admin-delete-account', student.email);
  adminSetText('admin-delete-entries', `${student.entries} timetable entries`);
  adminShowStatus('admin-delete-status');
  adminDeleteDialog?.showModal();
}

function adminCloseDelete() {
  adminDeleteDialog?.close();
  adminState.deleteTarget = null;
}

async function adminConfirmDelete() {
  const student = adminState.deleteTarget;
  if (!student || !adminState.stats?.digest) return;
  const button = adminEl('admin-delete-confirm');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  adminShowStatus('admin-delete-status', 'Deleting timetable data…');
  try {
    await api.delete(`/api/admin/roster/student/${encodeURIComponent(student.id)}`, {
      confirm: true,
      digest: adminState.stats.digest,
    });
    adminCloseDelete();
    adminShowListPanel();
    await adminLoadRoster(`Deleted the timetable data linked to ${student.email}.`);
  } catch (error) {
    adminShowStatus('admin-delete-status', error.message, 'error');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

async function adminExportStudents(studentKeys, filename = 'powiis-roster.csv') {
  adminShowStatus('admin-status', 'Preparing CSV export…');
  try {
    const response = await fetch('/api/admin/roster/export', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/csv' },
      body: JSON.stringify({ studentKeys }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(friendly(data.error));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    adminShowStatus('admin-status', 'CSV export ready.', 'success');
  } catch (error) {
    adminShowStatus('admin-status', error.message, 'error');
  }
}

function adminExportCurrent() {
  const filtered = adminFilteredStudents();
  const filtersActive = Boolean(adminState.search || adminState.year);
  adminExportStudents(filtersActive ? filtered.map((student) => student.id) : []);
}

function adminUpdateImportModeText() {
  const replace = adminEl('admin-import-mode').value === 'replace';
  adminSetText(
    'admin-import-mode-help',
    replace
      ? 'Every existing student dataset not present in this file will be removed after confirmation.'
      : 'Students included in the file receive a complete replacement timetable. Other students remain unchanged.',
  );
  if (adminState.pendingCsv) adminPreviewImport();
}

adminEl('admin-toggle')?.addEventListener('click', adminOpenManager);
adminEl('admin-close')?.addEventListener('click', adminCloseManager);
adminEl('admin-search')?.addEventListener('input', (event) => {
  adminState.search = event.target.value;
  adminRenderStudents();
});
adminEl('admin-search-clear')?.addEventListener('click', () => {
  adminState.search = '';
  adminEl('admin-search').value = '';
  adminRenderStudents();
  adminEl('admin-search').focus();
});
adminEl('admin-year-filter')?.addEventListener('change', (event) => {
  adminState.year = event.target.value;
  adminRenderStudents();
});
adminEl('admin-sort')?.addEventListener('change', (event) => {
  adminState.sort = event.target.value;
  adminRenderStudents();
});
adminEl('admin-clear-filters')?.addEventListener('click', adminClearFilters);
adminEl('admin-import-open')?.addEventListener('click', adminOpenImport);
adminEl('admin-export')?.addEventListener('click', adminExportCurrent);
adminEl('admin-detail-back')?.addEventListener('click', adminShowListPanel);
adminEl('admin-detail-export')?.addEventListener('click', () => {
  if (adminState.detail) {
    adminExportStudents([adminState.detail.id], `${adminState.detail.name || 'student'}-timetable.csv`);
  }
});
adminEl('admin-detail-delete')?.addEventListener('click', () => {
  if (adminState.detail) adminOpenDelete(adminState.detail);
});
adminEl('admin-import-close')?.addEventListener('click', adminCloseImport);
adminEl('admin-import-cancel')?.addEventListener('click', adminCloseImport);
adminEl('admin-csv-file')?.addEventListener('change', adminChooseCsv);
adminEl('admin-import-mode')?.addEventListener('change', adminUpdateImportModeText);
adminEl('admin-import-confirm')?.addEventListener('click', adminCommitImport);
adminEl('admin-delete-cancel')?.addEventListener('click', adminCloseDelete);
adminEl('admin-delete-confirm')?.addEventListener('click', adminConfirmDelete);
adminModal?.addEventListener('cancel', (event) => {
  event.preventDefault();
  adminCloseManager();
});
adminImportDialog?.addEventListener('cancel', (event) => {
  event.preventDefault();
  adminCloseImport();
});
adminDeleteDialog?.addEventListener('cancel', (event) => {
  event.preventDefault();
  adminCloseDelete();
});
