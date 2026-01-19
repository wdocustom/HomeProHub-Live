/**
 * Code Indexer
 *
 * CLI tool to index the codebase into the Knowledge Base
 * Run with: node services/CodeIndexer.js [options]
 *
 * Options:
 *   --full          Full reindex of all files
 *   --dir <path>    Index specific directory (default: project root)
 *   --watch         Watch for file changes and auto-reindex
 *
 * @author Principal AI Systems Architect
 */

const knowledgeBase = require('./KnowledgeBase');
const path = require('path');
const fs = require('fs').promises;

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    full: args.includes('--full'),
    watch: args.includes('--watch'),
    dir: null
};

// Get directory argument
const dirIndex = args.indexOf('--dir');
if (dirIndex !== -1 && args[dirIndex + 1]) {
    options.dir = args[dirIndex + 1];
}

// Directories to index
const DIRECTORIES_TO_INDEX = options.dir ? [options.dir] : [
    'public',
    'services',
    'routes',
    'database'
];

// Directories to exclude
const EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    '.mechanic_sandbox',
    'dist',
    'build',
    'coverage',
    '.env'
];

/**
 * Main indexing function
 */
async function indexCodebase() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         HOMEPROHUB CODE INDEXER                        ║');
    console.log('║         Building Knowledge Base...                     ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    const startTime = Date.now();
    let totalStats = {
        totalFiles: 0,
        totalChunks: 0
    };

    try {
        for (const dir of DIRECTORIES_TO_INDEX) {
            const fullPath = path.join(process.cwd(), dir);

            // Check if directory exists
            try {
                await fs.access(fullPath);
            } catch {
                console.log(`⚠️  Skipping ${dir} (not found)`);
                continue;
            }

            console.log(`\n📁 Indexing: ${dir}/`);
            console.log('─'.repeat(60));

            const stats = await knowledgeBase.indexDirectory(fullPath, EXCLUDE_PATTERNS);

            totalStats.totalFiles += stats.totalFiles;
            totalStats.totalChunks += stats.totalChunks;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║         INDEXING COMPLETE ✓                            ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`📊 Statistics:`);
        console.log(`   Files Indexed:  ${totalStats.totalFiles}`);
        console.log(`   Chunks Created: ${totalStats.totalChunks}`);
        console.log(`   Duration:       ${duration}s`);
        console.log('');
        console.log('🎯 Knowledge Base is ready for agent queries!');
        console.log('');

        return totalStats;

    } catch (error) {
        console.error('');
        console.error('❌ Indexing failed:', error);
        console.error('');
        throw error;
    }
}

/**
 * Watch mode - monitor file changes and auto-reindex
 */
async function watchMode() {
    console.log('');
    console.log('👀 Watch mode enabled - monitoring for file changes...');
    console.log('   Press Ctrl+C to stop');
    console.log('');

    const chokidar = require('chokidar');

    // Debounce reindexing
    let reindexTimeout = null;
    const changedFiles = new Set();

    const watcher = chokidar.watch(DIRECTORIES_TO_INDEX, {
        ignored: EXCLUDE_PATTERNS,
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
        changedFiles.add(filePath);

        // Clear existing timeout
        if (reindexTimeout) {
            clearTimeout(reindexTimeout);
        }

        // Debounce - wait 2 seconds after last change
        reindexTimeout = setTimeout(async () => {
            console.log('');
            console.log(`🔄 Detected changes in ${changedFiles.size} file(s)`);

            for (const file of changedFiles) {
                console.log(`   Reindexing: ${file}`);
                await knowledgeBase.indexFile(file);
            }

            console.log('✓ Reindexing complete');
            console.log('');

            changedFiles.clear();
        }, 2000);
    });

    // Keep process alive
    process.on('SIGINT', () => {
        console.log('');
        console.log('🛑 Stopping watcher...');
        watcher.close();
        process.exit(0);
    });
}

/**
 * Test Knowledge Base query
 */
async function testQuery() {
    console.log('');
    console.log('🧪 Testing Knowledge Base queries...');
    console.log('');

    const testQueries = [
        'How does user authentication work?',
        'How are job postings created?',
        'What database operations are available?'
    ];

    for (const query of testQueries) {
        console.log(`Query: "${query}"`);

        const results = await knowledgeBase.queryContext(query, 3);

        if (results.length > 0) {
            console.log(`  ✓ Found ${results.length} relevant results:`);
            results.forEach((result, idx) => {
                console.log(`    ${idx + 1}. ${result.file} (${result.relevance} relevant)`);
            });
        } else {
            console.log('  ⚠️  No results found');
        }

        console.log('');
    }
}

/**
 * Show help text
 */
function showHelp() {
    console.log('');
    console.log('HomeProHub Code Indexer');
    console.log('========================');
    console.log('');
    console.log('Usage:');
    console.log('  node services/CodeIndexer.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --full          Full reindex of all files');
    console.log('  --dir <path>    Index specific directory');
    console.log('  --watch         Watch for file changes and auto-reindex');
    console.log('  --test          Test queries after indexing');
    console.log('  --help          Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node services/CodeIndexer.js --full');
    console.log('  node services/CodeIndexer.js --dir services');
    console.log('  node services/CodeIndexer.js --full --test');
    console.log('  node services/CodeIndexer.js --watch');
    console.log('');
}

// Run indexer
(async function main() {
    if (args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.error('');
        console.error('❌ Error: OPENAI_API_KEY not set in environment');
        console.error('');
        console.error('Please set your OpenAI API key:');
        console.error('  export OPENAI_API_KEY=your_key_here');
        console.error('');
        process.exit(1);
    }

    try {
        // Run indexing
        await indexCodebase();

        // Test queries if requested
        if (args.includes('--test')) {
            await testQuery();
        }

        // Enter watch mode if requested
        if (options.watch) {
            await watchMode();
        } else {
            process.exit(0);
        }

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();

module.exports = { indexCodebase, testQuery };
