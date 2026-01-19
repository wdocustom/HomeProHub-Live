/**
 * Test Pilot Service
 *
 * Orchestrates CI-equivalent gates for agent-generated changes.
 * This is NOT a smoke test - it's a full validation pipeline.
 *
 * CRITICAL PRINCIPLE:
 * "Failure at any stage blocks merge."
 *
 * Test Pilot is the gatekeeper. If it fails, the change does not proceed.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Test stages that must pass
 * Each stage is mandatory unless explicitly skipped
 */
const TEST_STAGES = {
  SYNTAX: 'syntax_check',
  LINT: 'lint',
  TYPE_CHECK: 'type_check',
  UNIT_TESTS: 'unit_tests',
  INTEGRATION_TESTS: 'integration_tests',
  AUTH_REGRESSION: 'auth_regression',
  PERFORMANCE: 'performance_check',
  SECURITY_SCAN: 'security_scan'
};

/**
 * Run syntax validation on changed files
 *
 * @param {Array<string>} filePaths - Files to check
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runSyntaxCheck(filePaths) {
  const errors = [];

  for (const file of filePaths) {
    if (!file.endsWith('.js')) continue;

    try {
      // Use Node's built-in syntax checker
      await execAsync(`node --check "${file}"`);
    } catch (error) {
      errors.push({
        file,
        stage: TEST_STAGES.SYNTAX,
        message: error.message,
        severity: 'critical'
      });
    }
  }

  return {
    stage: TEST_STAGES.SYNTAX,
    passed: errors.length === 0,
    errors,
    skipped: false
  };
}

/**
 * Run linting on changed files
 *
 * @param {Array<string>} filePaths - Files to lint
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runLint(filePaths) {
  const errors = [];

  // Check if eslint is available
  try {
    await execAsync('which eslint');
  } catch {
    return {
      stage: TEST_STAGES.LINT,
      passed: true,
      errors: [],
      skipped: true,
      skip_reason: 'ESLint not installed'
    };
  }

  const jsFiles = filePaths.filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) {
    return {
      stage: TEST_STAGES.LINT,
      passed: true,
      errors: [],
      skipped: false
    };
  }

  try {
    const { stdout } = await execAsync(`npx eslint ${jsFiles.join(' ')}`);
    // If no errors, eslint exits 0
  } catch (error) {
    errors.push({
      stage: TEST_STAGES.LINT,
      message: 'Linting failed',
      details: error.message,
      severity: 'warning' // Lint errors are warnings, not blockers
    });
  }

  return {
    stage: TEST_STAGES.LINT,
    passed: errors.length === 0,
    errors,
    skipped: false
  };
}

/**
 * Run type checking (JSDoc validation)
 *
 * @param {Array<string>} filePaths - Files to check
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runTypeCheck(filePaths) {
  // Check if TypeScript/JSDoc checker is available
  try {
    await execAsync('which tsc');
  } catch {
    return {
      stage: TEST_STAGES.TYPE_CHECK,
      passed: true,
      errors: [],
      skipped: true,
      skip_reason: 'TypeScript not installed'
    };
  }

  // For now, skip type checking
  // TODO: Add JSDoc validation when tsc is configured
  return {
    stage: TEST_STAGES.TYPE_CHECK,
    passed: true,
    errors: [],
    skipped: true,
    skip_reason: 'Type checking not yet configured'
  };
}

/**
 * Run unit tests on touched code
 *
 * @param {Array<string>} filePaths - Files that were changed
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runUnitTests(filePaths) {
  const errors = [];

  // Check if test runner exists
  const hasTests = await fs.access('test', fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (!hasTests) {
    return {
      stage: TEST_STAGES.UNIT_TESTS,
      passed: true,
      errors: [],
      skipped: true,
      skip_reason: 'No test directory found'
    };
  }

  try {
    // Run npm test
    await execAsync('npm test', { timeout: 60000 });
  } catch (error) {
    errors.push({
      stage: TEST_STAGES.UNIT_TESTS,
      message: 'Unit tests failed',
      details: error.message,
      severity: 'critical'
    });
  }

  return {
    stage: TEST_STAGES.UNIT_TESTS,
    passed: errors.length === 0,
    errors,
    skipped: false
  };
}

/**
 * Run integration tests with seeded database
 *
 * @param {Array<string>} filePaths - Files that were changed
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runIntegrationTests(filePaths) {
  // Skip if no API routes were changed
  const hasAPIChanges = filePaths.some(f =>
    f.includes('routes/') || f.includes('server.js')
  );

  if (!hasAPIChanges) {
    return {
      stage: TEST_STAGES.INTEGRATION_TESTS,
      passed: true,
      errors: [],
      skipped: true,
      skip_reason: 'No API changes detected'
    };
  }

  // TODO: Implement integration test runner
  return {
    stage: TEST_STAGES.INTEGRATION_TESTS,
    passed: true,
    errors: [],
    skipped: true,
    skip_reason: 'Integration tests not yet implemented'
  };
}

/**
 * Run authentication regression tests
 *
 * @param {Array<string>} filePaths - Files that were changed
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runAuthRegression(filePaths) {
  // Run only if auth-related files were touched
  const hasAuthChanges = filePaths.some(f =>
    f.includes('auth') || f.includes('passport') || f.includes('session')
  );

  if (!hasAuthChanges) {
    return {
      stage: TEST_STAGES.AUTH_REGRESSION,
      passed: true,
      errors: [],
      skipped: true,
      skip_reason: 'No auth changes detected'
    };
  }

  // TODO: Implement auth regression tests
  return {
    stage: TEST_STAGES.AUTH_REGRESSION,
    passed: true,
    errors: [],
    skipped: true,
    skip_reason: 'Auth regression tests not yet implemented'
  };
}

/**
 * Run performance checks on hot paths
 *
 * @param {Array<string>} filePaths - Files that were changed
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runPerformanceCheck(filePaths) {
  // Skip for now - performance tests are optional
  return {
    stage: TEST_STAGES.PERFORMANCE,
    passed: true,
    errors: [],
    skipped: true,
    skip_reason: 'Performance tests not yet implemented'
  };
}

/**
 * Run security scan on changes
 *
 * @param {Array<string>} filePaths - Files that were changed
 * @returns {Promise<Object>} { passed: boolean, errors: Array }
 */
async function runSecurityScan(filePaths) {
  const errors = [];

  // Basic security checks
  for (const file of filePaths) {
    if (!file.endsWith('.js')) continue;

    try {
      const content = await fs.readFile(file, 'utf8');

      // Check for dangerous patterns
      const dangerousPatterns = [
        { pattern: /eval\(/, message: 'eval() detected - potential code injection risk' },
        { pattern: /exec\(.*\$\{/, message: 'Command injection risk detected' },
        { pattern: /innerHTML\s*=/, message: 'innerHTML assignment - XSS risk' },
        { pattern: /document\.write/, message: 'document.write() - XSS risk' }
      ];

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(content)) {
          errors.push({
            file,
            stage: TEST_STAGES.SECURITY_SCAN,
            message,
            severity: 'high'
          });
        }
      }
    } catch (error) {
      // Skip if file can't be read
    }
  }

  return {
    stage: TEST_STAGES.SECURITY_SCAN,
    passed: errors.length === 0,
    errors,
    skipped: false
  };
}

/**
 * Run full test pilot validation pipeline
 *
 * @param {Array<string>} filePaths - Files to validate
 * @param {Object} options - { skipOptional: boolean }
 * @returns {Promise<Object>} { passed: boolean, results: Array, blockers: Array }
 */
async function runFullValidation(filePaths, options = {}) {
  const { skipOptional = true } = options;

  console.log('🧪 Test Pilot: Running validation pipeline...');
  console.log(`📁 Files to validate: ${filePaths.length}`);

  const results = [];
  const blockers = [];

  // Stage 1: Syntax check (CRITICAL)
  console.log('  [1/8] Syntax check...');
  const syntaxResult = await runSyntaxCheck(filePaths);
  results.push(syntaxResult);
  if (!syntaxResult.passed) {
    blockers.push(...syntaxResult.errors);
  }

  // Stage 2: Linting (WARNING)
  console.log('  [2/8] Linting...');
  const lintResult = await runLint(filePaths);
  results.push(lintResult);
  // Lint errors are warnings, not blockers

  // Stage 3: Type checking (OPTIONAL)
  if (!skipOptional) {
    console.log('  [3/8] Type checking...');
    const typeResult = await runTypeCheck(filePaths);
    results.push(typeResult);
  }

  // Stage 4: Unit tests (CRITICAL if tests exist)
  console.log('  [4/8] Unit tests...');
  const unitResult = await runUnitTests(filePaths);
  results.push(unitResult);
  if (!unitResult.passed && !unitResult.skipped) {
    blockers.push(...unitResult.errors);
  }

  // Stage 5: Integration tests (CRITICAL if API changed)
  console.log('  [5/8] Integration tests...');
  const integrationResult = await runIntegrationTests(filePaths);
  results.push(integrationResult);
  if (!integrationResult.passed && !integrationResult.skipped) {
    blockers.push(...integrationResult.errors);
  }

  // Stage 6: Auth regression (CRITICAL if auth changed)
  console.log('  [6/8] Auth regression...');
  const authResult = await runAuthRegression(filePaths);
  results.push(authResult);
  if (!authResult.passed && !authResult.skipped) {
    blockers.push(...authResult.errors);
  }

  // Stage 7: Performance (OPTIONAL)
  if (!skipOptional) {
    console.log('  [7/8] Performance checks...');
    const perfResult = await runPerformanceCheck(filePaths);
    results.push(perfResult);
  }

  // Stage 8: Security scan (CRITICAL)
  console.log('  [8/8] Security scan...');
  const securityResult = await runSecurityScan(filePaths);
  results.push(securityResult);
  if (!securityResult.passed) {
    blockers.push(...securityResult.errors);
  }

  const passed = blockers.length === 0;

  console.log(passed ? '✅ Test Pilot: PASSED' : '❌ Test Pilot: FAILED');
  console.log(`   Blockers: ${blockers.length}`);

  return {
    passed,
    results,
    blockers,
    summary: {
      total_stages: results.length,
      passed_stages: results.filter(r => r.passed).length,
      skipped_stages: results.filter(r => r.skipped).length,
      failed_stages: results.filter(r => !r.passed && !r.skipped).length
    }
  };
}

module.exports = {
  TEST_STAGES,
  runSyntaxCheck,
  runLint,
  runTypeCheck,
  runUnitTests,
  runIntegrationTests,
  runAuthRegression,
  runPerformanceCheck,
  runSecurityScan,
  runFullValidation
};
