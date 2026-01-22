/**
 * Review Service
 *
 * Handles contractor review logic including:
 * - Validating review tokens
 * - Submitting public reviews
 * - Calculating overall ratings
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials not found in ReviewService. Review functionality may not work.');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

class ReviewService {
  /**
   * Get contractor information by review token
   * @param {string} token - Review token
   * @returns {Promise<Object|null>} Contractor data or null if not found
   */
  async getContractorByToken(token) {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Query the users table for contractor with matching review_token
      const { data, error } = await supabase
        .from('users')
        .select('id, email, business_name, display_name, avatar_url, bio, license_verified, insurance_verified, created_at')
        .eq('review_token', token)
        .eq('account_type', 'contractor')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      // Calculate member since year
      const memberSince = data.created_at ? new Date(data.created_at).getFullYear() : new Date().getFullYear();

      return {
        user_id: data.id,
        email: data.email,
        company_name: data.business_name,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        bio: data.bio,
        license_verified: data.license_verified || false,
        insurance_verified: data.insurance_verified || false,
        member_since_year: memberSince
      };

    } catch (error) {
      console.error('Error getting contractor by token:', error);
      throw error;
    }
  }

  /**
   * Submit a public review
   * @param {Object} reviewData - Review data
   * @param {string} reviewData.contractor_token - Contractor review token
   * @param {string} reviewData.reviewer_name - Reviewer name
   * @param {string} reviewData.reviewer_email - Reviewer email
   * @param {number} reviewData.quality_rating - Quality rating (1-5)
   * @param {number} reviewData.timeliness_rating - Timeliness rating (1-5)
   * @param {number} reviewData.budget_rating - Budget rating (1-5)
   * @param {number} reviewData.communication_rating - Communication rating (1-5)
   * @param {string} reviewData.review_text - Review text
   * @returns {Promise<Object>} Created review
   */
  async submitPublicReview(reviewData) {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // First, validate the contractor exists via token
      const contractor = await this.getContractorByToken(reviewData.contractor_token);

      if (!contractor) {
        throw new Error('Invalid review link or contractor not found');
      }

      // Calculate overall rating as average of 4 sub-ratings
      const rating_overall = (
        reviewData.quality_rating +
        reviewData.timeliness_rating +
        reviewData.budget_rating +
        reviewData.communication_rating
      ) / 4;

      // Insert review into contractor_reviews table
      const { data, error } = await supabase
        .from('contractor_reviews')
        .insert({
          contractor_id: contractor.user_id,
          reviewer_name: reviewData.reviewer_name,
          reviewer_email: reviewData.reviewer_email,
          rating_quality: reviewData.quality_rating,
          rating_timeliness: reviewData.timeliness_rating,
          rating_budget: reviewData.budget_rating,
          rating_communication: reviewData.communication_rating,
          rating_overall: rating_overall,
          review_text: reviewData.review_text || null,
          is_verified: false, // Reviews start as unverified
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        review: data,
        contractor_name: contractor.company_name
      };

    } catch (error) {
      console.error('Error submitting public review:', error);
      throw error;
    }
  }

  /**
   * Calculate average ratings for a contractor
   * @param {string} contractorId - Contractor user ID
   * @returns {Promise<Object>} Average ratings
   */
  async getContractorAverageRatings(contractorId) {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('contractor_reviews')
        .select('rating_quality, rating_timeliness, rating_budget, rating_communication, rating_overall')
        .eq('contractor_id', contractorId);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          count: 0,
          avg_quality: 0,
          avg_timeliness: 0,
          avg_budget: 0,
          avg_communication: 0,
          avg_overall: 0
        };
      }

      const count = data.length;
      const avg_quality = data.reduce((sum, r) => sum + (r.rating_quality || 0), 0) / count;
      const avg_timeliness = data.reduce((sum, r) => sum + (r.rating_timeliness || 0), 0) / count;
      const avg_budget = data.reduce((sum, r) => sum + (r.rating_budget || 0), 0) / count;
      const avg_communication = data.reduce((sum, r) => sum + (r.rating_communication || 0), 0) / count;
      const avg_overall = data.reduce((sum, r) => sum + (r.rating_overall || 0), 0) / count;

      return {
        count,
        avg_quality: Math.round(avg_quality * 10) / 10,
        avg_timeliness: Math.round(avg_timeliness * 10) / 10,
        avg_budget: Math.round(avg_budget * 10) / 10,
        avg_communication: Math.round(avg_communication * 10) / 10,
        avg_overall: Math.round(avg_overall * 10) / 10
      };

    } catch (error) {
      console.error('Error calculating average ratings:', error);
      throw error;
    }
  }
}

module.exports = new ReviewService();
