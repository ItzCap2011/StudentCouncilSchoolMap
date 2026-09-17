(function installAdminFilters(global) {
  'use strict';

  function filterStudents(students, filters = {}) {
    const search = String(filters.search ?? '').trim().toLocaleLowerCase('en');
    const year = String(filters.year ?? '');
    const sort = String(filters.sort ?? 'az');

    let result = Array.isArray(students) ? [...students] : [];

    if (search) {
      result = result.filter((student) => [
        student.name,
        student.email,
        student.year,
        student.class,
      ].some((value) => String(value ?? '').toLocaleLowerCase('en').includes(search)));
    }

    if (year) result = result.filter((student) => student.year === year);

    const byName = (left, right) => String(left.name || left.email).localeCompare(
      String(right.name || right.email),
      'en',
      { sensitivity: 'base' },
    );
    const byEmail = (left, right) => String(left.email).localeCompare(
      String(right.email),
      'en',
      { sensitivity: 'base' },
    );
    const byYear = (left, right, direction = 1) => {
      const leftYear = yearNumber(left.year ?? left.class);
      const rightYear = yearNumber(right.year ?? right.class);
      const leftKnown = Number.isFinite(leftYear);
      const rightKnown = Number.isFinite(rightYear);
      if (leftKnown && rightKnown && leftYear !== rightYear) {
        return (leftYear - rightYear) * direction;
      }
      if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
      return byName(left, right);
    };

    result.sort((left, right) => {
      if (sort === 'za') return byName(right, left);
      if (sort === 'year-asc') return byYear(left, right, 1);
      if (sort === 'year-desc') return byYear(left, right, -1);
      if (sort === 'entries-desc') return right.entries - left.entries || byName(left, right);
      if (sort === 'entries-asc') return left.entries - right.entries || byName(left, right);
      if (sort === 'email') return byEmail(left, right);
      return byName(left, right);
    });

    return result;
  }

  function yearNumber(value) {
    const match = String(value ?? '').match(/(?:year\s*|y\s*)?(1[0-3]|[7-9])\b/i);
    return match ? Number(match[1]) : Number.NaN;
  }

  function formatYearStage(value) {
    const year = yearNumber(value);
    if (year >= 7 && year <= 9) return `Year ${year} - KS3`;
    if (year >= 10 && year <= 11) return `Year ${year} - KS4`;
    if (year >= 12 && year <= 13) return `Year ${year} - KS5`;
    return String(value ?? '').trim() || 'Year not specified';
  }

  global.AdminFilters = Object.freeze({ filterStudents, formatYearStage });
}(window));
