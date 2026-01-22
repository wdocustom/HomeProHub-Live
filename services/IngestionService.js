/**
 * Ingestion Service - Zero-App Protocol Air Gap
 * Handles all incoming Twilio webhooks (SMS, MMS, Voice)
 * Routes data through AI agents and updates project state
 */

const { supabase } = require('../database/db');
const OpenAI = require('openai');
const { OrchestratorAgent, SentinelAgent, DiplomatAgent } = require('./universalAgentServices');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class IngestionService {
  /**
   * Main entry point for all Twilio webhooks
   * @param {Object} payload - Twilio webhook payload
   * @returns {Promise<Object>} - Processing result
   */
  async handleIncoming(payload) {
    console.log('[IngestionService] Incoming webhook:', {
      from: payload.From,
      to: payload.To,
      type: this.detectMessageType(payload)
    });

    try {
      const { From, To, Body, NumMedia, RecordingUrl } = payload;

      // 1. IDENTIFICATION - Find contractor and project
      const contractor = await this.getContractor(From);

      if (!contractor) {
        console.warn('[IngestionService] Unknown contractor phone:', From);
        return { error: 'Unknown contractor', phone: From };
      }

      // 2. SMS BRIDGE INTEGRATION - Route to messages table if this is a direct message
      // Check if this SMS is intended for the messaging system (not project-specific)
      const directMessage = await this.handleDirectMessage(contractor, Body);
      if (directMessage) {
        console.log('[IngestionService] SMS routed to messages table');
        return {
          success: true,
          type: 'direct_message',
          contractor: contractor.name
        };
      }

      // 3. PROJECT WORKFLOW - Continue with project-specific processing
      const project = await this.getProject(To);

      if (!project) {
        console.warn('[IngestionService] Unknown project phone:', To);
        return { error: 'Unknown project', phone: To };
      }

      console.log(`[IngestionService] Matched: ${contractor.name} → Project #${project.id}`);

      // 4. MEDIA PROCESSING
      let content = Body || '';
      let mediaUrls = [];

      // Handle MMS (photos)
      if (NumMedia && parseInt(NumMedia) > 0) {
        console.log(`[IngestionService] Processing ${NumMedia} media attachment(s)...`);
        mediaUrls = this.extractMediaUrls(payload);

        // Analyze photos with Sentinel
        const visualAnalysis = await SentinelAgent.analyzeJobSitePhotos(mediaUrls);
        if (visualAnalysis) {
          content += `\n\n[AI VISION ANALYSIS]\n${visualAnalysis}`;
        }
      }

      // Handle Voice (recordings)
      if (RecordingUrl) {
        console.log('[IngestionService] Processing voice recording...');
        const transcription = await this.transcribeVoice(RecordingUrl);
        if (transcription) {
          content += `\n\n[VOICE TRANSCRIPTION]\n${transcription}`;
        }
      }

      // 5. LOG TO FIELD_LOGS
      await this.logToFieldLogs({
        project_id: project.id,
        contractor_id: contractor.id,
        content,
        media_urls: mediaUrls,
        raw_payload: payload
      });

      // 6. ORCHESTRATE ACTIONS
      const updateResult = await OrchestratorAgent.processFieldUpdate(project.id, content);

      // 7. NOTIFY HOMEOWNER (if needed)
      if (updateResult.notifyHomeowner) {
        await this.notifyHomeowner(project, updateResult.summary);
      }

      console.log('[IngestionService] Processing complete:', updateResult.summary);

      return {
        success: true,
        contractor: contractor.name,
        project: project.title,
        summary: updateResult.summary
      };

    } catch (error) {
      console.error('[IngestionService] Processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * SMS BRIDGE - Handle direct messages to homeowners
   * If SMS is from a contractor to a homeowner, insert into messages table
   * @param {Object} contractor - Contractor info
   * @param {string} messageText - SMS text content
   * @returns {Promise<boolean>} - True if handled as direct message
   */
  async handleDirectMessage(contractor, messageText) {
    try {
      // Get active conversations for this contractor
      const { data: recentMessages, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${contractor.id},receiver_id.eq.${contractor.id}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !recentMessages || recentMessages.length === 0) {
        // No recent conversation found - not a direct message
        return false;
      }

      // Determine the homeowner (the other party in the conversation)
      const lastMessage = recentMessages[0];
      const homeownerId = lastMessage.sender_id === contractor.id
        ? lastMessage.receiver_id
        : lastMessage.sender_id;

      // Verify the receiver is a homeowner
      const { data: homeowner, error: homeownerError } = await supabase
        .from('user_profiles')
        .select('id, role')
        .eq('id', homeownerId)
        .eq('role', 'homeowner')
        .single();

      if (homeownerError || !homeowner) {
        return false;
      }

      // Insert SMS into messages table
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: contractor.id,
          receiver_id: homeownerId,
          content: messageText,
          read: false,
          created_at: new Date().toISOString(),
          source: 'sms' // Mark as SMS-originated
        });

      if (insertError) {
        console.error('[IngestionService] Failed to insert SMS message:', insertError);
        return false;
      }

      console.log(`[IngestionService] SMS from ${contractor.name} inserted into messages for homeowner ${homeownerId}`);
      return true;

    } catch (error) {
      console.error('[IngestionService] Error handling direct message:', error);
      return false;
    }
  }

  /**
   * Detect message type from payload
   */
  detectMessageType(payload) {
    if (payload.RecordingUrl) return 'voice';
    if (payload.NumMedia && parseInt(payload.NumMedia) > 0) return 'mms';
    return 'sms';
  }

  /**
   * Find contractor by phone number
   */
  async getContractor(phoneNumber) {
    const cleanPhone = this.normalizePhone(phoneNumber);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email, phone, mobile_phone')
      .eq('role', 'contractor')
      .or(`phone.eq.${cleanPhone},mobile_phone.eq.${cleanPhone}`)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('[IngestionService] Contractor lookup failed:', error?.message);
      return null;
    }

    return {
      id: data.id,
      name: `${data.first_name} ${data.last_name}`,
      email: data.email,
      phone: data.phone || data.mobile_phone
    };
  }

  /**
   * Find project by dedicated phone number
   */
  async getProject(phoneNumber) {
    const cleanPhone = this.normalizePhone(phoneNumber);

    const { data, error } = await supabase
      .from('job_postings')
      .select('id, title, address, homeowner_email, project_phone_number')
      .eq('project_phone_number', cleanPhone)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('[IngestionService] Project lookup failed:', error?.message);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      address: data.address,
      homeowner_email: data.homeowner_email,
      phone: data.project_phone_number
    };
  }

  /**
   * Extract media URLs from Twilio payload
   */
  extractMediaUrls(payload) {
    const urls = [];
    const numMedia = parseInt(payload.NumMedia) || 0;

    for (let i = 0; i < numMedia; i++) {
      const url = payload[`MediaUrl${i}`];
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }

  /**
   * Transcribe voice recording using OpenAI Whisper
   */
  async transcribeVoice(recordingUrl) {
    try {
      console.log('[IngestionService] Transcribing voice with Whisper...');

      // Download the recording
      const response = await fetch(recordingUrl);
      const audioBuffer = await response.arrayBuffer();

      // Create a File object for Whisper
      const audioFile = new File([audioBuffer], 'recording.mp3', { type: 'audio/mpeg' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en'
      });

      console.log('[IngestionService] Transcription complete');
      return transcription.text;
    } catch (error) {
      console.error('[IngestionService] Voice transcription failed:', error);
      return '[Transcription failed]';
    }
  }

  /**
   * Save raw entry to field_logs table
   */
  async logToFieldLogs({ project_id, contractor_id, content, media_urls, raw_payload }) {
    console.log(`[IngestionService] Logging to field_logs for project ${project_id}...`);

    const { error } = await supabase
      .from('field_logs')
      .insert({
        project_id,
        contractor_id,
        content,
        media_urls: media_urls.length > 0 ? media_urls : null,
        raw_payload,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[IngestionService] Failed to log to field_logs:', error);
      throw new Error(`Failed to log: ${error.message}`);
    }

    console.log('[IngestionService] Logged to field_logs successfully');
  }

  /**
   * Notify homeowner via Diplomat
   */
  async notifyHomeowner(project, summary) {
    console.log(`[IngestionService] Notifying homeowner for project ${project.id}...`);

    try {
      // Queue SMS notification
      await supabase
        .from('notification_log')
        .insert({
          recipient: project.homeowner_email,
          notification_type: 'sms',
          subject: `Update: ${project.title}`,
          message: summary,
          status: 'queued',
          created_at: new Date().toISOString()
        });

      console.log('[IngestionService] Homeowner notification queued');
    } catch (error) {
      console.error('[IngestionService] Failed to queue notification:', error);
    }
  }

  /**
   * Normalize phone number format
   */
  normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }
}

module.exports = new IngestionService();
