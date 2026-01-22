/**
 * MessageService - Facebook-Style Messaging
 * Handles real-time messaging between homeowners and contractors
 */

class MessageService {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.activeConversation = null;
    this.messageSubscription = null;
  }

  /**
   * Initialize the message service
   */
  async init() {
    // Wait for auth service to be ready
    if (!window.authService || !window.authService.initialized) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.authService && window.authService.initialized) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    this.supabase = window.authService.supabase;
    this.currentUser = window.authService.currentUser;

    if (!this.currentUser) {
      console.error('[MessageService] No authenticated user found');
      return false;
    }

    console.log('[MessageService] Initialized for user:', this.currentUser.email);
    return true;
  }

  /**
   * Get all conversations for the current user
   */
  async getConversations() {
    if (!this.supabase || !this.currentUser) {
      throw new Error('MessageService not initialized');
    }

    try {
      // Fetch conversations where user is either sender or receiver
      const { data, error } = await this.supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          read,
          sender:sender_id(email, business_name, display_name),
          receiver:receiver_id(email, business_name, display_name)
        `)
        .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation partner
      const conversations = this.groupByConversation(data);
      return conversations;
    } catch (error) {
      console.error('[MessageService] Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Group messages by conversation partner
   */
  groupByConversation(messages) {
    const conversationMap = new Map();

    messages.forEach(msg => {
      // Determine the other party in the conversation
      const isReceived = msg.receiver_id === this.currentUser.id;
      const partnerId = isReceived ? msg.sender_id : msg.receiver_id;
      const partnerData = isReceived ? msg.sender : msg.receiver;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: partnerData?.business_name || partnerData?.display_name || partnerData?.email || 'Unknown User',
          partnerInitials: this.getInitials(partnerData?.business_name || partnerData?.display_name || partnerData?.email),
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unread: !msg.read && isReceived
        });
      }
    });

    return Array.from(conversationMap.values());
  }

  /**
   * Get messages for a specific conversation
   */
  async getMessages(partnerId) {
    if (!this.supabase || !this.currentUser) {
      throw new Error('MessageService not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          read,
          attachments
        `)
        .or(`and(sender_id.eq.${this.currentUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${this.currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Mark received messages as read
      await this.markAsRead(partnerId);

      return data;
    } catch (error) {
      console.error('[MessageService] Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Send a new message
   */
  async sendMessage(receiverId, content, attachments = []) {
    if (!this.supabase || !this.currentUser) {
      throw new Error('MessageService not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          sender_id: this.currentUser.id,
          receiver_id: receiverId,
          content,
          attachments: attachments.length > 0 ? attachments : null,
          read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[MessageService] Message sent:', data.id);
      return data;
    } catch (error) {
      console.error('[MessageService] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Mark messages from a specific user as read
   */
  async markAsRead(partnerId) {
    if (!this.supabase || !this.currentUser) {
      throw new Error('MessageService not initialized');
    }

    try {
      const { error } = await this.supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', this.currentUser.id)
        .eq('read', false);

      if (error) throw error;

      console.log('[MessageService] Messages marked as read from:', partnerId);
    } catch (error) {
      console.error('[MessageService] Error marking messages as read:', error);
    }
  }

  /**
   * Subscribe to real-time message updates
   */
  subscribeToMessages(partnerId, callback) {
    if (!this.supabase || !this.currentUser) {
      throw new Error('MessageService not initialized');
    }

    // Unsubscribe from previous subscription
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    // Subscribe to new messages
    this.messageSubscription = this.supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${this.currentUser.id}`
      }, payload => {
        console.log('[MessageService] New message received:', payload.new);
        if (callback) {
          callback(payload.new);
        }
      })
      .subscribe();

    console.log('[MessageService] Subscribed to real-time messages');
    return this.messageSubscription;
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
      console.log('[MessageService] Unsubscribed from real-time messages');
    }
  }

  /**
   * Get initials from a name
   */
  getInitials(name) {
    if (!name) return '??';

    // Handle email addresses
    if (name.includes('@')) {
      name = name.split('@')[0];
    }

    // Split by spaces and take first letter of first two words
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      return words[0].substring(0, 2).toUpperCase();
    } else if (words.length === 1 && words[0].length === 1) {
      return words[0][0].toUpperCase();
    }

    return '??';
  }

  /**
   * Format timestamp for display
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

// Export singleton instance
window.MessageService = new MessageService();
