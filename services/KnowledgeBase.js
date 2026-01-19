/**
 * Knowledge Base Service
 *
 * Provides RAG (Retrieval-Augmented Generation) capabilities for the Autonomous Agent Trinity.
 * Agents query this service to understand existing code before making changes.
 *
 * Features:
 * - Semantic code search using vector embeddings
 * - Codebase indexing and maintenance
 * - Context retrieval for LLM prompts
 * - Dependency tracking
 *
 * @module KnowledgeBase
 * @author Principal AI Systems Architect
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const db = require('../database/db');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const CONFIG = {
    EMBEDDING_MODEL: 'text-embedding-3-small',
    EMBEDDING_DIMENSIONS: 1536,
    CHUNK_SIZE: 2000, // Characters per chunk
    CHUNK_OVERLAP: 200, // Overlap between chunks
    MAX_CONTEXT_RESULTS: 10, // Results to return for queries
    ALLOWED_EXTENSIONS: ['.js', '.html', '.css', '.json', '.md']
};

class KnowledgeBase {
    constructor() {
        this.indexing = false;
        this.stats = {
            totalFiles: 0,
            totalChunks: 0,
            lastIndexed: null
        };
    }

    /**
     * Query the knowledge base for relevant code context
     *
     * This is the main entry point for agents to understand existing code
     *
     * @param {string} query - Natural language query (e.g., "how does user authentication work?")
     * @param {number} limit - Number of results to return
     * @returns {Promise<Array>} Relevant code chunks with context
     */
    async queryContext(query, limit = CONFIG.MAX_CONTEXT_RESULTS) {
        console.log(`[KnowledgeBase] Querying: "${query}"`);

        try {
            // Generate embedding for the query
            const queryEmbedding = await this._generateEmbedding(query);

            // Search for similar code chunks
            const results = await db.queryCodeEmbeddings(queryEmbedding, limit);

            // Format results for agent consumption
            const formattedResults = results.map(result => ({
                file: result.file_path,
                type: result.file_type,
                code: result.chunk_text,
                lineRange: `${result.line_start}-${result.line_end}`,
                function: result.function_name,
                imports: result.imports,
                relevance: (result.similarity * 100).toFixed(1) + '%'
            }));

            console.log(`[KnowledgeBase] Found ${results.length} relevant code chunks`);

            return formattedResults;

        } catch (error) {
            console.error('[KnowledgeBase] Query failed:', error);
            throw error;
        }
    }

    /**
     * Index a single file into the knowledge base
     *
     * @param {string} filePath - Path to file to index
     * @returns {Promise<number>} Number of chunks created
     */
    async indexFile(filePath) {
        try {
            // Read file content
            const content = await fs.readFile(filePath, 'utf8');

            // Calculate file hash
            const fileHash = this._calculateHash(content);

            // Check if file has changed since last index
            const existing = await db.getFileEmbeddings(filePath);
            if (existing.length > 0 && existing[0].file_hash === fileHash) {
                console.log(`[KnowledgeBase] File unchanged: ${filePath}`);
                return 0;
            }

            // Delete old embeddings
            await db.deleteFileEmbeddings(filePath);

            // Extract file metadata
            const fileType = path.extname(filePath).slice(1);
            const chunks = this._chunkCode(content);
            const imports = this._extractImports(content, fileType);

            let chunksCreated = 0;

            // Process each chunk
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                // Generate embedding
                const embedding = await this._generateEmbedding(chunk.text);

                // Extract function name if this chunk contains one
                const functionName = this._extractFunctionName(chunk.text, fileType);

                // Store in database
                await db.storeCodeEmbedding({
                    file_path: filePath,
                    file_type: fileType,
                    chunk_text: chunk.text,
                    chunk_index: i,
                    file_hash: fileHash,
                    embedding: embedding,
                    line_start: chunk.lineStart,
                    line_end: chunk.lineEnd,
                    function_name: functionName,
                    imports: imports
                });

                chunksCreated++;
            }

            console.log(`[KnowledgeBase] Indexed ${filePath}: ${chunksCreated} chunks`);

            return chunksCreated;

        } catch (error) {
            console.error(`[KnowledgeBase] Failed to index ${filePath}:`, error);
            return 0;
        }
    }

    /**
     * Index an entire directory recursively
     *
     * @param {string} dirPath - Directory to index
     * @param {Array<string>} exclude - Patterns to exclude
     * @returns {Promise<Object>} Indexing statistics
     */
    async indexDirectory(dirPath, exclude = ['node_modules', '.git', '.mechanic_sandbox']) {
        if (this.indexing) {
            throw new Error('Indexing already in progress');
        }

        this.indexing = true;
        const startTime = Date.now();
        let filesProcessed = 0;
        let chunksCreated = 0;

        console.log(`[KnowledgeBase] Starting index of: ${dirPath}`);

        try {
            const files = await this._scanDirectory(dirPath, exclude);

            for (const file of files) {
                // Check if file extension is allowed
                const ext = path.extname(file);
                if (!CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
                    continue;
                }

                const chunks = await this.indexFile(file);
                filesProcessed++;
                chunksCreated += chunks;

                // Rate limiting - don't overwhelm OpenAI API
                if (filesProcessed % 10 === 0) {
                    await this._delay(1000); // 1 second pause every 10 files
                }
            }

            this.stats = {
                totalFiles: filesProcessed,
                totalChunks: chunksCreated,
                lastIndexed: new Date()
            };

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            console.log(`[KnowledgeBase] Index complete:`);
            console.log(`  Files: ${filesProcessed}`);
            console.log(`  Chunks: ${chunksCreated}`);
            console.log(`  Duration: ${duration}s`);

            return this.stats;

        } finally {
            this.indexing = false;
        }
    }

    /**
     * Get code context for a specific file
     *
     * Useful when agents need to understand a particular file
     *
     * @param {string} filePath - Path to file
     * @returns {Promise<Object>} File context
     */
    async getFileContext(filePath) {
        try {
            const chunks = await db.getFileEmbeddings(filePath);

            if (chunks.length === 0) {
                return null;
            }

            // Reconstruct full file content
            const fullContent = chunks
                .sort((a, b) => a.chunk_index - b.chunk_index)
                .map(c => c.chunk_text)
                .join('\n');

            return {
                path: filePath,
                type: chunks[0].file_type,
                content: fullContent,
                imports: chunks[0].imports || [],
                functions: chunks
                    .map(c => c.function_name)
                    .filter(f => f)
                    .filter((f, i, arr) => arr.indexOf(f) === i), // unique
                chunksCount: chunks.length
            };

        } catch (error) {
            console.error(`[KnowledgeBase] Failed to get file context for ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Find files related to a concept or feature
     *
     * @param {string} concept - Concept to search for (e.g., "authentication", "payment")
     * @returns {Promise<Array<string>>} Related file paths
     */
    async findRelatedFiles(concept) {
        const results = await this.queryContext(concept, 20);

        // Get unique file paths
        const files = [...new Set(results.map(r => r.file))];

        return files;
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    /**
     * Generate embedding using OpenAI
     */
    async _generateEmbedding(text) {
        try {
            const response = await openai.embeddings.create({
                model: CONFIG.EMBEDDING_MODEL,
                input: text.substring(0, 8000), // OpenAI limit
                dimensions: CONFIG.EMBEDDING_DIMENSIONS
            });

            return response.data[0].embedding;

        } catch (error) {
            console.error('[KnowledgeBase] Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Split code into overlapping chunks for better context
     */
    _chunkCode(content) {
        const lines = content.split('\n');
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;
        let lineStart = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineSize = line.length + 1; // +1 for newline

            if (currentSize + lineSize > CONFIG.CHUNK_SIZE && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    text: currentChunk.join('\n'),
                    lineStart: lineStart,
                    lineEnd: i
                });

                // Start new chunk with overlap
                const overlapLines = Math.floor(CONFIG.CHUNK_OVERLAP / 50); // ~50 chars per line
                currentChunk = currentChunk.slice(-overlapLines);
                currentSize = currentChunk.reduce((sum, l) => sum + l.length + 1, 0);
                lineStart = i - overlapLines + 1;
            }

            currentChunk.push(line);
            currentSize += lineSize;
        }

        // Add final chunk
        if (currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.join('\n'),
                lineStart: lineStart,
                lineEnd: lines.length
            });
        }

        return chunks;
    }

    /**
     * Extract import/require statements from code
     */
    _extractImports(content, fileType) {
        const imports = [];

        if (fileType === 'js') {
            // Match require() statements
            const requireRegex = /require\(['"](.*?)['"]\)/g;
            let match;
            while ((match = requireRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }

            // Match import statements
            const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        }

        if (fileType === 'html') {
            // Match script src
            const scriptRegex = /<script[^>]*src=["'](.*?)["']/g;
            let match;
            while ((match = scriptRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }

            // Match link href (CSS)
            const linkRegex = /<link[^>]*href=["'](.*?)["']/g;
            while ((match = linkRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        }

        return imports;
    }

    /**
     * Extract function/class name from code chunk
     */
    _extractFunctionName(chunk, fileType) {
        if (fileType !== 'js') return null;

        // Try to find function declaration
        const functionRegex = /(?:async\s+)?function\s+(\w+)/;
        const arrowRegex = /const\s+(\w+)\s*=\s*(?:async\s+)?\(/;
        const classRegex = /class\s+(\w+)/;

        let match = chunk.match(functionRegex) || chunk.match(arrowRegex) || chunk.match(classRegex);

        return match ? match[1] : null;
    }

    /**
     * Calculate MD5 hash of content
     */
    _calculateHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Recursively scan directory for files
     */
    async _scanDirectory(dirPath, exclude = []) {
        const files = [];

        async function scan(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                // Check exclusions
                if (exclude.some(pattern => fullPath.includes(pattern))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }

        await scan(dirPath);
        return files;
    }

    /**
     * Delay utility for rate limiting
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get statistics about the knowledge base
     */
    getStats() {
        return this.stats;
    }
}

// Singleton instance
const knowledgeBase = new KnowledgeBase();

module.exports = knowledgeBase;
