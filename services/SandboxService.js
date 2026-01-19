/**
 * SandboxService.js
 *
 * Provides isolated environment for The Mechanic AI to safely test code patches
 * before applying them to production.
 *
 * @module SandboxService
 * @author Principal Infrastructure Engineer
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const SANDBOX_DIR = path.join(process.cwd(), '.mechanic_sandbox');

class SandboxService {
    constructor() {
        this.activeSandboxes = new Map(); // Track active sandbox sessions
    }

    /**
     * Initialize the sandbox environment
     * Ensures the sandbox directory exists and is clean
     */
    async initialize() {
        try {
            await fs.mkdir(SANDBOX_DIR, { recursive: true });
            console.log('[SandboxService] Sandbox directory initialized:', SANDBOX_DIR);
        } catch (error) {
            console.error('[SandboxService] Failed to initialize sandbox:', error);
            throw error;
        }
    }

    /**
     * Prepare the test environment with patched code
     *
     * @param {string} originalFile - Path to the original file (e.g., 'services/SharkAgent.js')
     * @param {string} patchedCode - The modified code to test
     * @returns {Promise<Object>} Sandbox session information
     */
    async prepareTestEnv(originalFile, patchedCode) {
        const sessionId = this._generateSessionId();

        try {
            // Validate inputs
            await this._validateFile(originalFile);

            // Calculate the depth difference for import rewriting
            const originalPath = path.resolve(originalFile);
            const fileName = path.basename(originalFile);
            const sandboxFilePath = path.join(SANDBOX_DIR, `${sessionId}_${fileName}`);

            // Calculate how many directories deep the original file was
            const originalDepth = this._calculateDepth(originalFile);
            const sandboxDepth = this._calculateDepth(sandboxFilePath);
            const depthDifference = sandboxDepth - originalDepth;

            // Rewrite imports in the patched code
            const rewrittenCode = this._rewriteImports(patchedCode, depthDifference);

            // Write the patched code to sandbox
            await fs.writeFile(sandboxFilePath, rewrittenCode, 'utf8');

            const session = {
                sessionId,
                originalFile,
                sandboxFile: sandboxFilePath,
                createdAt: new Date(),
                depthDifference
            };

            this.activeSandboxes.set(sessionId, session);

            console.log(`[SandboxService] Test environment prepared:
  Session ID: ${sessionId}
  Original: ${originalFile}
  Sandbox: ${sandboxFilePath}
  Depth Adjustment: ${depthDifference > 0 ? '+' : ''}${depthDifference}`);

            return session;

        } catch (error) {
            console.error('[SandboxService] Failed to prepare test environment:', error);
            throw error;
        }
    }

    /**
     * Rewrite relative imports to work from the sandbox location
     *
     * @param {string} code - The code to process
     * @param {number} depthDifference - How many levels deeper the sandbox is
     * @returns {string} Code with rewritten imports
     */
    _rewriteImports(code, depthDifference) {
        if (depthDifference === 0) {
            return code; // No adjustment needed
        }

        // Match require() and import statements with relative paths
        const requireRegex = /require\(['"](\.\.[\/\\][^'"]+)['"]\)/g;
        const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"](\.\.[\/\\][^'"]+)['"]/g;
        const dynamicImportRegex = /import\(['"](\.\.[\/\\][^'"]+)['"]\)/g;

        let rewrittenCode = code;

        // Helper to add '../' prefixes based on depth
        const adjustPath = (match, importPath) => {
            const prefix = '../'.repeat(Math.abs(depthDifference));
            const adjustedPath = depthDifference > 0
                ? prefix + importPath
                : importPath.replace(new RegExp(`^(${'../'.repeat(Math.abs(depthDifference))})`), '');
            return match.replace(importPath, adjustedPath);
        };

        // Rewrite require() statements
        rewrittenCode = rewrittenCode.replace(requireRegex, (match, importPath) => {
            return adjustPath(match, importPath);
        });

        // Rewrite import statements
        rewrittenCode = rewrittenCode.replace(importRegex, (match, importPath) => {
            return adjustPath(match, importPath);
        });

        // Rewrite dynamic import() statements
        rewrittenCode = rewrittenCode.replace(dynamicImportRegex, (match, importPath) => {
            return adjustPath(match, importPath);
        });

        return rewrittenCode;
    }

    /**
     * Calculate directory depth from project root
     *
     * @param {string} filePath - Path to calculate depth for
     * @returns {number} Number of directories deep
     */
    _calculateDepth(filePath) {
        const relativePath = path.relative(process.cwd(), path.resolve(filePath));
        const parts = relativePath.split(path.sep).filter(p => p && p !== '.');
        return parts.length - 1; // Subtract 1 for the file itself
    }

    /**
     * Validate that the original file exists and is readable
     *
     * @param {string} filePath - Path to validate
     */
    async _validateFile(filePath) {
        try {
            await fs.access(filePath, fs.constants.R_OK);
        } catch (error) {
            throw new Error(`Original file not accessible: ${filePath}`);
        }
    }

    /**
     * Generate a unique session ID for sandbox isolation
     *
     * @returns {string} Unique session identifier
     */
    _generateSessionId() {
        return `sandbox_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Promote a successful sandbox file to production
     *
     * @param {string} sessionId - The sandbox session to promote
     * @returns {Promise<boolean>} Success status
     */
    async promoteToProduction(sessionId) {
        const session = this.activeSandboxes.get(sessionId);

        if (!session) {
            throw new Error(`Sandbox session not found: ${sessionId}`);
        }

        try {
            // Read the sandbox file
            const sandboxCode = await fs.readFile(session.sandboxFile, 'utf8');

            // Revert import paths back to original depth
            const productionCode = this._rewriteImports(sandboxCode, -session.depthDifference);

            // Create backup of original production file
            const backupPath = `${session.originalFile}.backup_${Date.now()}`;
            await fs.copyFile(session.originalFile, backupPath);

            // Overwrite production file
            await fs.writeFile(session.originalFile, productionCode, 'utf8');

            console.log(`[SandboxService] Promoted to production:
  Session: ${sessionId}
  File: ${session.originalFile}
  Backup: ${backupPath}`);

            // Cleanup sandbox
            await this.cleanup(sessionId);

            return true;

        } catch (error) {
            console.error('[SandboxService] Failed to promote to production:', error);
            throw error;
        }
    }

    /**
     * Clean up a sandbox session
     *
     * @param {string} sessionId - Session to clean up
     */
    async cleanup(sessionId) {
        const session = this.activeSandboxes.get(sessionId);

        if (!session) {
            console.warn(`[SandboxService] Session not found for cleanup: ${sessionId}`);
            return;
        }

        try {
            // Delete sandbox file
            await fs.unlink(session.sandboxFile);

            // Remove from active sessions
            this.activeSandboxes.delete(sessionId);

            console.log(`[SandboxService] Cleaned up sandbox session: ${sessionId}`);

        } catch (error) {
            console.error(`[SandboxService] Failed to cleanup session ${sessionId}:`, error);
        }
    }

    /**
     * Clean up all sandbox sessions (emergency cleanup)
     */
    async cleanupAll() {
        try {
            const files = await fs.readdir(SANDBOX_DIR);

            for (const file of files) {
                if (file.startsWith('sandbox_')) {
                    await fs.unlink(path.join(SANDBOX_DIR, file));
                }
            }

            this.activeSandboxes.clear();
            console.log('[SandboxService] All sandbox sessions cleaned up');

        } catch (error) {
            console.error('[SandboxService] Failed to cleanup all sessions:', error);
        }
    }

    /**
     * Get information about an active sandbox session
     *
     * @param {string} sessionId - Session to query
     * @returns {Object|null} Session information
     */
    getSession(sessionId) {
        return this.activeSandboxes.get(sessionId) || null;
    }

    /**
     * List all active sandbox sessions
     *
     * @returns {Array<Object>} All active sessions
     */
    listSessions() {
        return Array.from(this.activeSandboxes.values());
    }
}

// Singleton instance
const sandboxService = new SandboxService();

module.exports = sandboxService;
