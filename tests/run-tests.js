const fs = require('fs');
const path = require('path');

// Mock browser global environment
global.window = global;
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const baseDir = path.join(__dirname, '..');

// Load modules at top-level with global assignment
const storageCode = fs.readFileSync(path.join(baseDir, 'js/storage.js'), 'utf8')
  .replace('const CarbonStorage =', 'global.CarbonStorage =');
eval(storageCode);

const calculatorCode = fs.readFileSync(path.join(baseDir, 'js/calculator.js'), 'utf8')
  .replace('var CarbonCalculator =', 'global.CarbonCalculator =');
eval(calculatorCode);

const insightsCode = fs.readFileSync(path.join(baseDir, 'js/insights.js'), 'utf8')
  .replace('const CarbonInsights =', 'global.CarbonInsights =');
eval(insightsCode);

const gamificationCode = fs.readFileSync(path.join(baseDir, 'js/gamification.js'), 'utf8')
  .replace('const CarbonGamification =', 'global.CarbonGamification =');
eval(gamificationCode);

// Load calculator test first to initialize TestRunner
const calcTestCode = fs.readFileSync(path.join(baseDir, 'tests/calculator.test.js'), 'utf8');
eval(calcTestCode);

// Expose globals for other test files
global.TestRunner = TestRunner;
global.describe = TestRunner.describe;
global.it = TestRunner.it;
global.expect = TestRunner.expect;

// Load other test files
const storageTestCode = fs.readFileSync(path.join(baseDir, 'tests/storage.test.js'), 'utf8');
eval(storageTestCode);

const insightsTestCode = fs.readFileSync(path.join(baseDir, 'tests/insights.test.js'), 'utf8');
eval(insightsTestCode);

const gamificationTestCode = fs.readFileSync(path.join(baseDir, 'tests/gamification.test.js'), 'utf8');
eval(gamificationTestCode);

// Run/report results
const results = TestRunner.getResults();
const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

console.log('--- TEST RESULTS ---');
console.log(`Total tests: ${results.length}`);
console.log(`Passed:      ${passed.length}`);
console.log(`Failed:      ${failed.length}`);
console.log(`Pass Rate:   ${results.length ? Math.round((passed.length / results.length) * 100) : 0}%`);

if (failed.length > 0) {
  console.log('\n--- FAILED TESTS ---');
  failed.forEach(f => {
    console.log(`[FAIL] ${f.suite} -> ${f.name}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('All tests passed successfully!');
  process.exit(0);
}
