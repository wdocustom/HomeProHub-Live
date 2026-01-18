/**
 * ResearcherService.js
 * External Web Search for Contractor Procurement
 *
 * When internal database has insufficient contractors (<3),
 * this service searches the web using Tavily API and parses
 * results with GPT-4o to create "Ghost Profiles" (unclaimed contractors).
 */

const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class ResearcherService {
  /**
   * Search the web for contractors when internal DB is insufficient
   * @param {string} trade - Contractor trade type (e.g., "electrician", "plumber")
   * @param {string} zipCode - ZIP code to search in
   * @returns {Array} Array of contractor ghost profiles from web search
   */
  static async searchWeb(trade, zipCode) {
    console.log(`[Researcher] Searching web for ${trade} contractors near ${zipCode}...`);

    try {
      // Check if Tavily API key is configured
      const tavilyApiKey = process.env.TAVILY_API_KEY;

      if (!tavilyApiKey) {
        console.warn('[Researcher] TAVILY_API_KEY not configured, using fallback');
        return await this.fallbackSearch(trade, zipCode);
      }

      // Perform Tavily web search
      const searchResults = await this.tavilySearch(trade, zipCode);

      if (!searchResults || searchResults.length === 0) {
        console.log('[Researcher] No web results found');
        return [];
      }

      // Parse search results with GPT-4o
      const parsedContractors = await this.parseSearchResults(searchResults, trade, zipCode);

      console.log(`[Researcher] ✅ Found ${parsedContractors.length} contractors from web search`);

      return parsedContractors;

    } catch (error) {
      console.error('[Researcher] Error searching web:', error);
      return [];
    }
  }

  /**
   * Perform Tavily API search
   * @param {string} trade - Trade type
   * @param {string} zipCode - ZIP code
   * @returns {Array} Raw search results
   */
  static async tavilySearch(trade, zipCode) {
    const tavilyApiKey = process.env.TAVILY_API_KEY;

    const query = `${trade} contractors in ${zipCode} contact phone number`;

    console.log(`[Researcher] Tavily query: "${query}"`);

    try {
      // Use fetch to call Tavily API
      const fetch = (await import('node-fetch')).default;

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: query,
          search_depth: 'advanced', // Deep search for more results
          include_answer: false,
          include_raw_content: true, // Get full page content
          max_results: 10,
          include_domains: [
            'yelp.com',
            'angieslist.com',
            'thumbtack.com',
            'homeadvisor.com',
            'bbb.org',
            'yellowpages.com'
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();

      console.log(`[Researcher] Tavily returned ${data.results?.length || 0} results`);

      return data.results || [];

    } catch (error) {
      console.error('[Researcher] Tavily search error:', error);
      return [];
    }
  }

  /**
   * Parse search results using GPT-4o to extract structured contractor data
   * @param {Array} searchResults - Raw Tavily search results
   * @param {string} trade - Trade type
   * @param {string} zipCode - ZIP code
   * @returns {Array} Parsed contractor profiles
   */
  static async parseSearchResults(searchResults, trade, zipCode) {
    console.log('[Researcher] Parsing search results with GPT-4o...');

    try {
      // Prepare search results for GPT-4o
      const resultsText = searchResults.map((result, idx) => {
        return `
========== RESULT ${idx + 1} ==========
Title: ${result.title}
URL: ${result.url}
Content: ${result.content || result.raw_content || 'N/A'}
`;
      }).join('\n');

      const prompt = `
You are a data extraction specialist. Parse these web search results for ${trade} contractors near ZIP ${zipCode}.

Extract structured contractor information from the search results below.

SEARCH RESULTS:
${resultsText}

EXTRACTION RULES:
1. Extract company name, phone number, and rating (if available)
2. Phone numbers must be in format: (555) 555-5555 or +1-555-555-5555
3. Ratings should be numerical (e.g., 4.5) or N/A
4. Only extract contractors that match the trade: ${trade}
5. Include the source URL for each contractor
6. Maximum 10 contractors

OUTPUT FORMAT (JSON):
{
  "contractors": [
    {
      "name": "Company Name",
      "phone": "(555) 555-5555",
      "rating": "4.5",
      "review_count": 123,
      "source_url": "https://...",
      "trade": "${trade}",
      "zip_code": "${zipCode}",
      "is_verified": false
    }
  ]
}

Return ONLY valid JSON. If no contractors found, return {"contractors": []}.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction expert specializing in parsing contractor information from web search results.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 2000
      });

      const parsed = JSON.parse(response.choices[0].message.content);

      console.log(`[Researcher] GPT-4o extracted ${parsed.contractors?.length || 0} contractors`);

      // Transform to ghost profile format
      const ghostProfiles = (parsed.contractors || []).map(contractor => ({
        company_name: contractor.name,
        phone: contractor.phone || 'N/A',
        rating: contractor.rating === 'N/A' ? '0.0' : contractor.rating,
        review_count: contractor.review_count || 0,
        source_url: contractor.source_url,
        trade: contractor.trade || trade,
        location_zip: contractor.zip_code || zipCode,
        is_unclaimed: true, // Ghost profile flag
        is_verified: false,
        distance_miles: 0, // Unknown distance from web search
        license_verified: false,
        email: null, // Not available from web search
        id: null // Not in database yet
      }));

      return ghostProfiles;

    } catch (error) {
      console.error('[Researcher] Error parsing search results:', error);
      return [];
    }
  }

  /**
   * Fallback search using OpenAI when Tavily is not configured
   * Uses GPT-4o to generate plausible contractor suggestions based on common patterns
   * @param {string} trade - Trade type
   * @param {string} zipCode - ZIP code
   * @returns {Array} Fallback contractor suggestions
   */
  static async fallbackSearch(trade, zipCode) {
    console.log('[Researcher] Using fallback search (no Tavily API)...');

    try {
      const prompt = `
Generate a list of 3-5 realistic ${trade} contractors that might serve ZIP code ${zipCode}.

Use realistic business naming patterns for ${trade} contractors.
Generate realistic phone numbers in format (XXX) XXX-XXXX.
Use realistic ratings between 3.5-5.0.

OUTPUT FORMAT (JSON):
{
  "contractors": [
    {
      "name": "Realistic Company Name",
      "phone": "(555) 555-5555",
      "rating": "4.5",
      "review_count": 50,
      "source_url": "https://example.com",
      "trade": "${trade}",
      "zip_code": "${zipCode}"
    }
  ],
  "note": "These are AI-generated suggestions. User should verify independently."
}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const parsed = JSON.parse(response.choices[0].message.content);

      console.log(`[Researcher] Fallback generated ${parsed.contractors?.length || 0} suggestions`);

      // Transform to ghost profile format
      const ghostProfiles = (parsed.contractors || []).map(contractor => ({
        company_name: contractor.name,
        phone: contractor.phone || 'N/A',
        rating: contractor.rating || '0.0',
        review_count: contractor.review_count || 0,
        source_url: contractor.source_url || 'AI-generated',
        trade: contractor.trade || trade,
        location_zip: contractor.zip_code || zipCode,
        is_unclaimed: true,
        is_verified: false,
        distance_miles: 0,
        license_verified: false,
        email: null,
        id: null,
        is_ai_generated: true // Flag for AI-generated fallback
      }));

      return ghostProfiles;

    } catch (error) {
      console.error('[Researcher] Fallback search error:', error);
      return [];
    }
  }

  /**
   * Create unclaimed ghost profile in database for web-found contractor
   * Allows homeowners/GCs to invite them, contractor can claim later
   * @param {Object} ghostProfile - Ghost profile data
   * @returns {Object} Created profile or error
   */
  static async createGhostProfile(ghostProfile) {
    console.log(`[Researcher] Creating ghost profile for ${ghostProfile.company_name}...`);

    const db = require('../database/db');

    try {
      // Check if ghost profile already exists (by phone number)
      const existing = await db.query(
        'SELECT * FROM ghost_contractors WHERE phone = $1',
        [ghostProfile.phone]
      );

      if (existing.rows.length > 0) {
        console.log('[Researcher] Ghost profile already exists');
        return existing.rows[0];
      }

      // Insert ghost profile
      const result = await db.query(`
        INSERT INTO ghost_contractors (
          company_name, phone, trade, location_zip, rating, review_count,
          source_url, is_unclaimed, is_ai_generated, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `, [
        ghostProfile.company_name,
        ghostProfile.phone,
        ghostProfile.trade,
        ghostProfile.location_zip,
        ghostProfile.rating || '0.0',
        ghostProfile.review_count || 0,
        ghostProfile.source_url || '',
        true, // is_unclaimed
        ghostProfile.is_ai_generated || false
      ]);

      console.log(`[Researcher] ✅ Ghost profile created: ${result.rows[0].id}`);

      return result.rows[0];

    } catch (error) {
      // If ghost_contractors table doesn't exist, return the profile without storing
      if (error.message.includes('relation "ghost_contractors" does not exist')) {
        console.warn('[Researcher] ghost_contractors table not created yet, returning profile without DB storage');
        return ghostProfile;
      }

      console.error('[Researcher] Error creating ghost profile:', error);
      return { error: error.message };
    }
  }
}

module.exports = ResearcherService;
