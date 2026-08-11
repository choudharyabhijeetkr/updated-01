const { parseListLine } = require('./testRunner');
const lines = [
  '  ✓  2 [Android-Chrome] › tests\\spec\\azerbaijan-visa.spec.ts:11:5 › Azerbaijan Visa Application (7.2s)',
  '  ✓  1 [Desktop-Firefox] › tests\\spec\\azerbaijan-visa.spec.ts:11:5 › Azerbaijan Visa Application',
  '1 passed, 0 failed (1m 23s)',
  'Running 12 tests using 4 workers',
];
for (const line of lines) {
  console.log('LINE:', JSON.stringify(line));
  console.log('PARSED:', parseListLine(line));
}
