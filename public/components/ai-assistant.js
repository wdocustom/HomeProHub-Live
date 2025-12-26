/**
 * HomeProHub AI Assistant Component
 * Integrated AI assistant with photo upload, clarifications, and job posting
 */

(function() {
  'use strict';

  // Constants
  const STORAGE_KEYS = {
    USER_PROFILE: 'homeprohub_user',
    USER_ROLE: 'homeprohub_user_role',
    AUTH_TOKEN: 'homeprohub_auth_token',
    USERNAME: 'homeprohub_username',
    HISTORY: 'homeprohub_history_v1'
  };

  const MAX_QUESTION_LENGTH = 5000;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // State
  let lastQuestion = null;
  let lastAIAnswer = null;
  let lastImageBase64 = null;
  let lastImageType = null;

  // DOM Elements
  const homeIssueInput = document.getElementById('homeIssueInput');
  const askAiBtn = document.getElementById('askAiBtn');
  const photoInput = document.getElementById('photoInput');
  const aiStatus = document.getElementById('aiStatus');
  const aiResponseSection = document.getElementById('aiResponseSection');
  const aiResponseContent = document.getElementById('aiResponseContent');
  const clarifyInput = document.getElementById('clarifyInput');
  const clarifyBtn = document.getElementById('clarifyBtn');
  const clarifyStatus = document.getElementById('clarifyStatus');
  const jobPostCta = document.getElementById('jobPostCta');
  const postJobBtn = document.getElementById('postJobBtn');

  // Utility: Get user data
  function getUserData() {
    try {
      const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
      const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const rawProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);

      if (!role || !authToken) {
        return null;
      }

      const profile = rawProfile ? JSON.parse(rawProfile) : {};

      return {
        role: role,
        name: profile.name || 'User',
        email: profile.email || '',
        token: authToken
      };
    } catch (e) {
      return null;
    }
  }

  // Image: Read as base64
  function readImageAsBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        reject(new Error('File size exceeds 5MB limit'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result;
          const base64 = result.split(",")[1];
          resolve(base64);
        } catch (e) {
          reject(new Error('Failed to process image'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  // API: Ask backend
  async function askBackend(question, imageBase64, imageType) {
    const user = getUserData();
    if (!user) {
      throw new Error('Authentication required');
    }

    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.token}`
      },
      body: JSON.stringify({
        question: question.trim(),
        imageBase64,
        imageType
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    const data = await response.json();
    return data.answer || '';
  }

  // Photo input handler
  if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const imageType = file.type;
        const imageBase64 = await readImageAsBase64(file);

        lastImageBase64 = imageBase64;
        lastImageType = imageType;

        aiStatus.textContent = `📸 Photo uploaded: ${file.name}`;
        aiStatus.style.color = '#10b981';
      } catch (err) {
        aiStatus.textContent = err.message;
        aiStatus.style.color = '#ef4444';
      }
    });
  }

  // Main AI ask handler
  if (askAiBtn) {
    askAiBtn.addEventListener('click', async () => {
      const question = homeIssueInput ? homeIssueInput.value.trim() : '';

      if (!question) {
        aiStatus.textContent = "Please describe your issue in detail.";
        aiStatus.style.color = '#ef4444';
        return;
      }

      if (question.length > MAX_QUESTION_LENGTH) {
        aiStatus.textContent = `Question is too long. Maximum ${MAX_QUESTION_LENGTH} characters.`;
        aiStatus.style.color = '#ef4444';
        return;
      }

      // Disable inputs
      askAiBtn.disabled = true;
      if (homeIssueInput) homeIssueInput.disabled = true;
      if (photoInput) photoInput.disabled = true;
      if (clarifyBtn) clarifyBtn.disabled = true;

      aiStatus.textContent = "Analyzing your issue...";
      aiStatus.style.color = '#6b7280';
      if (aiResponseSection) aiResponseSection.classList.remove('show');
      if (jobPostCta) jobPostCta.classList.remove('show');

      try {
        const reply = await askBackend(question, lastImageBase64, lastImageType);

        if (aiResponseContent) aiResponseContent.textContent = reply;
        if (aiResponseSection) aiResponseSection.classList.add('show');
        if (jobPostCta) jobPostCta.classList.add('show');

        aiStatus.textContent = "Analysis complete! ✅";
        aiStatus.style.color = '#10b981';

        // Save context
        lastQuestion = question;
        lastAIAnswer = reply;

        // Scroll to response
        setTimeout(() => {
          aiResponseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

      } catch (err) {
        aiStatus.textContent = err.message || "Unable to process your request. Please try again.";
        aiStatus.style.color = '#ef4444';
      } finally {
        askAiBtn.disabled = false;
        if (homeIssueInput) homeIssueInput.disabled = false;
        if (photoInput) photoInput.disabled = false;
        if (clarifyBtn) clarifyBtn.disabled = false;
      }
    });
  }

  // Clarify handler
  if (clarifyBtn) {
    clarifyBtn.addEventListener('click', async () => {
      const extra = clarifyInput ? clarifyInput.value.trim() : '';

      if (!lastQuestion) {
        clarifyStatus.textContent = "Please ask an initial question first.";
        clarifyStatus.style.color = '#ef4444';
        return;
      }

      if (!extra) {
        clarifyStatus.textContent = "Please provide additional details.";
        clarifyStatus.style.color = '#ef4444';
        return;
      }

      if (extra.length > MAX_QUESTION_LENGTH) {
        clarifyStatus.textContent = `Clarification is too long. Maximum ${MAX_QUESTION_LENGTH} characters.`;
        clarifyStatus.style.color = '#ef4444';
        return;
      }

      // Disable inputs
      clarifyBtn.disabled = true;
      if (askAiBtn) askAiBtn.disabled = true;
      if (clarifyInput) clarifyInput.disabled = true;

      clarifyStatus.textContent = "Updating analysis...";
      clarifyStatus.style.color = '#6b7280';

      const combinedQuestion =
        `Original description from homeowner:\n` +
        lastQuestion +
        `\n\nNew details / clarifications from homeowner:\n` +
        extra +
        `\n\nPlease update and refine your previous guidance based on these new details. ` +
        `Keep the same structure (summary, severity, urgency, DIY checks, materials, safety, when to call a pro, script). ` +
        `If earlier advice is no longer correct, clearly correct it.`;

      try {
        const reply = await askBackend(combinedQuestion, lastImageBase64, lastImageType);

        if (aiResponseContent) aiResponseContent.textContent = reply;

        clarifyStatus.textContent = "Analysis updated! ✅";
        clarifyStatus.style.color = '#10b981';

        lastQuestion = combinedQuestion;
        lastAIAnswer = reply;
        if (clarifyInput) clarifyInput.value = "";

        // Scroll to top of response
        setTimeout(() => {
          aiResponseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

      } catch (err) {
        clarifyStatus.textContent = err.message || "Unable to update analysis. Please try again.";
        clarifyStatus.style.color = '#ef4444';
      } finally {
        clarifyBtn.disabled = false;
        if (askAiBtn) askAiBtn.disabled = false;
        if (clarifyInput) clarifyInput.disabled = false;
      }
    });
  }

  // Post job handler
  if (postJobBtn) {
    postJobBtn.addEventListener('click', () => {
      if (!lastQuestion || !lastAIAnswer) {
        alert("Please generate a project analysis first.");
        return;
      }

      // Store data for job posting page
      sessionStorage.setItem('pendingJob', JSON.stringify({
        originalQuestion: lastQuestion,
        aiAnalysis: lastAIAnswer,
        fromAI: true
      }));

      // Redirect to job posting page
      window.location.href = 'homeowner-dashboard.html';
    });
  }

  // Check auth on page load
  function initialize() {
    const user = getUserData();

    if (!user || user.role !== 'homeowner') {
      window.location.href = 'index.html';
      return;
    }

    // Check for pending question from navigation
    const pendingQuestion = sessionStorage.getItem('pendingQuestion');
    if (pendingQuestion && homeIssueInput) {
      homeIssueInput.value = pendingQuestion;
      sessionStorage.removeItem('pendingQuestion');

      // Auto-trigger AI if there's a pending question
      setTimeout(() => {
        if (askAiBtn) askAiBtn.click();
      }, 500);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
