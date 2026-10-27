import { validateGameData } from '../src/data/validateData.js';

const { ok, errors, report } = validateGameData();
console.table(report);
if (!ok) {
  console.error('Data validation FAILED:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('Data validation passed: every answer key agrees with the triangle geometry.');
