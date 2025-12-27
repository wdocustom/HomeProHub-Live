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
  async function getUserData() {
    try {
      // Wait for authService to be ready
      if (!window.authService || !window.authService.initialized) {
        await new Promise(resolve => {
          const checkAuth = setInterval(() => {
            if (window.authService && window.authService.initialized) {
              clearInterval(checkAuth);
              resolve();
            }
          }, 100);
        });
      }

      const user = await window.authService.getCurrentUser();
      if (!user) {
        return null;
      }

      const profile = await window.authService.getUserProfile();
      if (!profile) {
        return null;
      }

      return {
        role: profile.role,
        name: profile.name || user.email,
        email: user.email
      };
    } catch (e) {
      console.error('Error getting user data:', e);
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
    const user = await getUserData();
    if (!user) {
      throw new Error('Authentication required');
    }

    const response = await window.authService.authenticatedFetch("/ask", {
      method: "POST",
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
    return {
      answer: data.answer || '',
      intent: data.intent || 'issue',
      autoRedirect: data.autoRedirect || false
    };
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
        const result = await askBackend(question, lastImageBase64, lastImageType);
        const { answer, intent, autoRedirect } = result;

        // Save context
        lastQuestion = question;
        lastAIAnswer = answer;

        // Check if this is a project request that should auto-redirect to job posting
        if (intent === 'project' && autoRedirect) {
          aiStatus.textContent = "Perfect! Let's get this project posted to find the right contractor...";
          aiStatus.style.color = '#10b981';

          // Extract budget from AI response
          const estimatedBudget = extractBudgetFromAI(answer);

          // Store data for job posting page
          sessionStorage.setItem('pendingJob', JSON.stringify({
            originalQuestion: question,
            aiAnalysis: answer,
            budgetLow: estimatedBudget.low,
            budgetHigh: estimatedBudget.high,
            fromAI: true,
            isProject: true
          }));

          // Auto-redirect after short delay to show message
          setTimeout(() => {
            window.location.href = 'homeowner-dashboard.html';
          }, 1500);

          return; // Exit early, don't show response section
        }

        // For issues, show the response with clarify option
        if (aiResponseContent) aiResponseContent.textContent = answer;
        if (aiResponseSection) aiResponseSection.classList.add('show');
        if (jobPostCta) jobPostCta.classList.add('show');

        // Update button text based on intent
        if (postJobBtn) {
          if (intent === 'project') {
            postJobBtn.textContent = '📋 Post This Project & Get Bids';
          } else {
            postJobBtn.textContent = '📋 Post This Issue & Get Help';
          }
        }

        aiStatus.textContent = intent === 'project'
          ? "Project analysis complete! ✅"
          : "Analysis complete! ✅";
        aiStatus.style.color = '#10b981';

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
        const result = await askBackend(combinedQuestion, lastImageBase64, lastImageType);
        const { answer, intent } = result;

        if (aiResponseContent) aiResponseContent.textContent = answer;

        // Update button text based on intent
        if (postJobBtn) {
          if (intent === 'project') {
            postJobBtn.textContent = '📋 Post This Project & Get Bids';
          } else {
            postJobBtn.textContent = '📋 Post This Issue & Get Help';
          }
        }

        clarifyStatus.textContent = "Analysis updated! ✅";
        clarifyStatus.style.color = '#10b981';

        lastQuestion = combinedQuestion;
        lastAIAnswer = answer;
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

  // Extract budget from AI response
  function extractBudgetFromAI(aiResponse) {
    // Look for dollar amounts in the response
    const dollarMatches = aiResponse.match(/\$[\d,]+/g);

    if (dollarMatches && dollarMatches.length >= 1) {
      const amounts = dollarMatches.map(m => parseInt(m.replace(/[$,]/g, ''))).filter(n => !isNaN(n) && n > 0);

      if (amounts.length >= 2) {
        return {
          low: Math.min(...amounts),
          high: Math.max(...amounts)
        };
      } else if (amounts.length === 1) {
        // If only one amount, use it as base and add reasonable range
        const base = amounts[0];
        return {
          low: Math.floor(base * 0.8),
          high: Math.ceil(base * 1.2)
        };
      }
    }

    // Default rough estimates if no amounts found
    return {
      low: 500,
      high: 2000
    };
  }

  // Post job handler
  if (postJobBtn) {
    postJobBtn.addEventListener('click', () => {
      if (!lastQuestion || !lastAIAnswer) {
        alert("Please generate a project analysis first.");
        return;
      }

      // Extract budget from AI response
      const estimatedBudget = extractBudgetFromAI(lastAIAnswer);

      // Store data for job posting page
      sessionStorage.setItem('pendingJob', JSON.stringify({
        originalQuestion: lastQuestion,
        aiAnalysis: lastAIAnswer,
        budgetLow: estimatedBudget.low,
        budgetHigh: estimatedBudget.high,
        fromAI: true
      }));

      // Redirect to job posting page
      window.location.href = 'homeowner-dashboard.html';
    });
  }

  // Check auth on page load
  async function initialize() {
    // Check for pending question from navigation
    const pendingQuestion = sessionStorage.getItem('pendingQuestion');
    if (pendingQuestion && homeIssueInput) {
      homeIssueInput.value = pendingQuestion;
      sessionStorage.removeItem('pendingQuestion');

      // Verify user is authenticated before auto-triggering
      const user = await getUserData();
      if (user && user.role === 'homeowner') {
        // Auto-trigger AI if there's a pending question
        setTimeout(() => {
          if (askAiBtn) askAiBtn.click();
        }, 500);
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
