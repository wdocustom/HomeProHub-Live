/**
 * Test Pilot Service
 *
 * Enhanced testing service for the Autonomous Development Trinity
 * Combines the TestFlightRunner with headless browser testing
 *
 * Features:
 * - Child process execution (from TestFlightRunner)
 * - Headless browser testing (Puppeteer)
 * - API endpoint testing
 * - Console error detection
 * - Performance metrics
 *
 * @module TestPilotService
 * @author Principal DevOps Engineering Lead
 */

const { TestFlightRunner, CriteriaType } = require('./TestFlightRunner');
const puppeteer = require('puppeteer');
const path = require('path');

class TestPilotService {
    constructor(options = {}) {
        this.testRunner = new TestFlightRunner(options);
        this.browser = null;
        this.baseUrl = options.baseUrl || 'http://localhost:3000';
    }

    /**
     * Test a sandboxed code file
     * Uses TestFlightRunner for isolated execution
     *
     * @param {string} sandboxFile - Path to sandboxed file
     * @param {Object} testCase - Test configuration
     * @returns {Promise<Object>} Test results
     */
    async testCode(sandboxFile, testCase) {
        console.log(`[TestPilot] Testing code: ${sandboxFile}`);
        return await this.testRunner.runTestFlight(sandboxFile, testCase);
    }

    /**
     * Test a web page in headless browser
     * Detects JavaScript errors, failed requests, and console warnings
     *
     * @param {string} pagePath - Page path (e.g., '/dashboard.html')
     * @param {Object} options - Test options
     * @returns {Promise<Object>} Test results
     */
    async testPage(pagePath, options = {}) {
        const {
            timeout = 30000,
            waitForSelector = null,
            checkConsole = true,
            checkNetworkErrors = true
        } = options;

        console.log(`[TestPilot] Testing page: ${pagePath}`);

        const errors = [];
        const warnings = [];
        const networkErrors = [];
        let consoleErrors = [];

        try {
            // Launch browser if not already running
            if (!this.browser) {
                this.browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            }

            const page = await this.browser.newPage();

            // Listen for console messages
            if (checkConsole) {
                page.on('console', msg => {
                    const type = msg.type();
                    const text = msg.text();

                    if (type === 'error') {
                        consoleErrors.push(text);
                    } else if (type === 'warning') {
                        warnings.push(text);
                    }
                });
            }

            // Listen for JavaScript errors
            page.on('pageerror', error => {
                errors.push(error.message);
            });

            // Listen for failed requests
            if (checkNetworkErrors) {
                page.on('requestfailed', request => {
                    networkErrors.push({
                        url: request.url(),
                        method: request.method(),
                        failure: request.failure().errorText
                    });
                });
            }

            // Navigate to page
            const url = this.baseUrl + (pagePath.startsWith('/') ? pagePath : '/' + pagePath);
            const response = await page.goto(url, {
                timeout,
                waitUntil: 'networkidle2'
            });

            // Check response status
            const statusCode = response.status();
            if (statusCode >= 400) {
                errors.push(`HTTP ${statusCode}: ${response.statusText()}`);
            }

            // Wait for specific selector if specified
            if (waitForSelector) {
                try {
                    await page.waitForSelector(waitForSelector, { timeout: 5000 });
                } catch (error) {
                    errors.push(`Selector not found: ${waitForSelector}`);
                }
            }

            // Take screenshot for debugging
            const screenshot = await page.screenshot({ encoding: 'base64' });

            await page.close();

            // Determine success
            const success = errors.length === 0 && networkErrors.length === 0;

            const result = {
                success,
                url,
                statusCode,
                errors,
                warnings,
                networkErrors,
                consoleErrors,
                screenshot // Base64 encoded screenshot
            };

            console.log(`[TestPilot] Page test ${success ? 'PASSED' : 'FAILED'}: ${pagePath}`);
            if (!success) {
                console.log(`[TestPilot] Errors: ${errors.join(', ')}`);
            }

            return result;

        } catch (error) {
            console.error(`[TestPilot] Page test crashed:`, error);

            return {
                success: false,
                url: pagePath,
                statusCode: null,
                errors: [error.message],
                warnings,
                networkErrors,
                consoleErrors,
                screenshot: null
            };
        }
    }

    /**
     * Test an API endpoint
     *
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Test results
     */
    async testAPI(endpoint, options = {}) {
        const {
            method = 'GET',
            body = null,
            headers = {},
            expectedStatus = 200,
            expectedFields = []
        } = options;

        console.log(`[TestPilot] Testing API: ${method} ${endpoint}`);

        try {
            const url = this.baseUrl + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);

            const fetchOptions = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            if (body) {
                fetchOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);
            const statusCode = response.status;
            let responseData = null;

            try {
                responseData = await response.json();
            } catch {
                // Not JSON response
                responseData = await response.text();
            }

            // Check status code
            const statusMatches = statusCode === expectedStatus;

            // Check expected fields
            const missingFields = [];
            if (expectedFields.length > 0 && typeof responseData === 'object') {
                for (const field of expectedFields) {
                    if (!(field in responseData)) {
                        missingFields.push(field);
                    }
                }
            }

            const success = statusMatches && missingFields.length === 0;

            const result = {
                success,
                url,
                method,
                statusCode,
                expectedStatus,
                responseData,
                missingFields
            };

            console.log(`[TestPilot] API test ${success ? 'PASSED' : 'FAILED'}: ${endpoint}`);

            return result;

        } catch (error) {
            console.error(`[TestPilot] API test crashed:`, error);

            return {
                success: false,
                url: endpoint,
                method,
                statusCode: null,
                error: error.message
            };
        }
    }

    /**
     * Run a comprehensive test suite for a deployment
     *
     * @param {Object} deployment - Deployment info
     * @returns {Promise<Object>} Test suite results
     */
    async testDeployment(deployment) {
        const {
            type, // 'page', 'api', 'code'
            target, // page path, API endpoint, or code file
            testCases = []
        } = deployment;

        console.log(`[TestPilot] Running deployment test: ${type} - ${target}`);

        const results = [];

        if (type === 'page') {
            // Test the page
            const pageResult = await this.testPage(target);
            results.push(pageResult);

        } else if (type === 'api') {
            // Test API endpoints
            for (const testCase of testCases) {
                const apiResult = await this.testAPI(target, testCase);
                results.push(apiResult);
            }

        } else if (type === 'code') {
            // Test code in sandbox
            for (const testCase of testCases) {
                const codeResult = await this.testCode(target, testCase);
                results.push(codeResult);
            }
        }

        const allPassed = results.every(r => r.success);

        return {
            success: allPassed,
            type,
            target,
            results,
            summary: {
                total: results.length,
                passed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }

    /**
     * Close browser and cleanup
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = TestPilotService;
