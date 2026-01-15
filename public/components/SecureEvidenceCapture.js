/**
 * ========================================
 * SecureEvidenceCapture Component
 * ========================================
 * PHASE 5: The Sentinel - Live-Only Photo Verification
 *
 * Features:
 * - Live camera stream ONLY (no file uploads allowed)
 * - GPS location capture at moment of photo
 * - Uploads to Supabase storage
 * - Sends to Sentinel Agent for forensic analysis
 *
 * Security:
 * - No <input type="file"> - prevents old photo uploads
 * - getUserMedia() required - ensures live capture
 * - GPS timestamp synchronized with photo timestamp
 */

class SecureEvidenceCapture {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element #${containerId} not found`);
    }

    this.options = {
      onSuccess: options.onSuccess || (() => {}),
      onError: options.onError || ((error) => console.error(error)),
      onCaptureStart: options.onCaptureStart || (() => {}),
      apiEndpoint: options.apiEndpoint || '/api/agents/sentinel/verify',
      ...options
    };

    this.videoElement = null;
    this.canvasElement = null;
    this.stream = null;
    this.gpsCoords = null;

    this.init();
  }

  init() {
    this.render();
    this.startCamera();
  }

  render() {
    this.container.innerHTML = `
      <div class="secure-evidence-capture" style="max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
        <!-- Header -->
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0 0 8px 0; font-size: 24px;">📸 Live Verification</h2>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">Take a live photo to verify milestone completion</p>
        </div>

        <!-- Status Bar -->
        <div id="status-bar" style="padding: 12px 20px; background: #f7fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div id="camera-status" style="display: flex; align-items: center; gap: 6px;">
            <div class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #cbd5e0;"></div>
            <span style="font-size: 13px; color: #4a5568;">Camera: Initializing...</span>
          </div>
          <div id="gps-status" style="display: flex; align-items: center; gap: 6px;">
            <div class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #cbd5e0;"></div>
            <span style="font-size: 13px; color: #4a5568;">GPS: Waiting...</span>
          </div>
        </div>

        <!-- Camera View -->
        <div style="background: #000; position: relative; overflow: hidden;">
          <video
            id="camera-video"
            autoplay
            playsinline
            style="width: 100%; max-height: 500px; display: block; object-fit: cover;"
          ></video>

          <!-- Capture Overlay -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 400px; aspect-ratio: 4/3; border: 3px dashed rgba(255,255,255,0.6); border-radius: 12px; pointer-events: none;"></div>

          <!-- GPS Lock Indicator -->
          <div id="gps-lock-indicator" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; display: none;">
            <span>📍 GPS Locked</span>
          </div>
        </div>

        <!-- Hidden canvas for capturing -->
        <canvas id="capture-canvas" style="display: none;"></canvas>

        <!-- Controls -->
        <div style="padding: 24px 20px; background: white; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <!-- Warning Notice -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; gap: 12px;">
            <span style="font-size: 18px;">⚠️</span>
            <div style="flex: 1; font-size: 13px; color: #92400e;">
              <strong>Security Notice:</strong> This must be a live photo taken at the job site. Old photos and screenshots will be automatically rejected.
            </div>
          </div>

          <!-- Requirements Checklist -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #2d3748;">Before you capture:</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #4a5568;">
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="check-onsite" style="width: 16px; height: 16px;">
                <span>I am physically at the job site</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="check-complete" style="width: 16px; height: 16px;">
                <span>The work shown meets all milestone requirements</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="check-clear" style="width: 16px; height: 16px;">
                <span>The photo clearly shows the completed work</span>
              </label>
            </div>
          </div>

          <!-- Capture Button -->
          <button
            id="capture-btn"
            disabled
            style="width: 100%; padding: 16px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: not-allowed; opacity: 0.5; transition: all 0.2s;">
            <span id="capture-btn-text">📸 Capture & Submit</span>
          </button>

          <!-- Processing Indicator -->
          <div id="processing" style="display: none; text-align: center; margin-top: 16px;">
            <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p id="processing-text" style="margin-top: 12px; color: #4a5568; font-size: 14px;">Processing...</p>
          </div>

          <!-- Error Message -->
          <div id="error-message" style="display: none; margin-top: 16px; padding: 12px; background: #fee; border: 1px solid #f87171; border-radius: 8px; color: #b91c1c; font-size: 13px;"></div>
        </div>
      </div>

      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .status-dot.active {
          background: #48bb78 !important;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        #capture-btn:not(:disabled) {
          cursor: pointer;
          opacity: 1;
        }

        #capture-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
        }

        #capture-btn:not(:disabled):active {
          transform: translateY(0);
        }
      </style>
    `;

    this.videoElement = document.getElementById('camera-video');
    this.canvasElement = document.getElementById('capture-canvas');

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Checklist validation
    const checkboxes = [
      document.getElementById('check-onsite'),
      document.getElementById('check-complete'),
      document.getElementById('check-clear')
    ];

    const captureBtn = document.getElementById('capture-btn');

    const updateButtonState = () => {
      const allChecked = checkboxes.every(cb => cb.checked);
      const cameraReady = this.stream !== null;
      const gpsReady = this.gpsCoords !== null;

      if (allChecked && cameraReady && gpsReady) {
        captureBtn.disabled = false;
        captureBtn.style.cursor = 'pointer';
        captureBtn.style.opacity = '1';
      } else {
        captureBtn.disabled = true;
        captureBtn.style.cursor = 'not-allowed';
        captureBtn.style.opacity = '0.5';
      }
    };

    checkboxes.forEach(cb => cb.addEventListener('change', updateButtonState));

    // Capture button
    captureBtn.addEventListener('click', () => this.capturePhoto());
  }

  async startCamera() {
    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.videoElement.srcObject = this.stream;

      // Update camera status
      this.updateStatus('camera', 'ready', 'Camera: Ready');

      // Start GPS acquisition
      this.acquireGPS();

    } catch (error) {
      console.error('Camera access denied:', error);
      this.updateStatus('camera', 'error', 'Camera: Access Denied');
      this.showError('Camera access is required for verification. Please enable camera permissions and refresh the page.');
    }
  }

  async acquireGPS() {
    if (!navigator.geolocation) {
      this.updateStatus('gps', 'error', 'GPS: Not Supported');
      this.showError('GPS is not supported on this device.');
      return;
    }

    this.updateStatus('gps', 'acquiring', 'GPS: Acquiring...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.gpsCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        console.log('GPS acquired:', this.gpsCoords);
        this.updateStatus('gps', 'ready', `GPS: Locked (±${Math.round(this.gpsCoords.accuracy)}m)`);

        // Show GPS lock indicator
        document.getElementById('gps-lock-indicator').style.display = 'block';

        // Re-validate button state
        this.setupEventListeners();
      },
      (error) => {
        console.error('GPS error:', error);
        this.updateStatus('gps', 'error', 'GPS: Failed');
        this.showError('GPS location is required. Please enable location services and refresh the page.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  updateStatus(type, status, text) {
    const statusEl = document.getElementById(`${type}-status`);
    if (!statusEl) return;

    const dot = statusEl.querySelector('.status-dot');
    const span = statusEl.querySelector('span');

    const colors = {
      ready: '#48bb78',
      error: '#f56565',
      acquiring: '#ed8936'
    };

    dot.style.background = colors[status] || '#cbd5e0';
    if (status === 'ready') {
      dot.classList.add('active');
    }
    span.textContent = text;
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  hideError() {
    document.getElementById('error-message').style.display = 'none';
  }

  async capturePhoto() {
    if (!this.stream || !this.gpsCoords) {
      this.showError('Camera and GPS must be ready before capturing.');
      return;
    }

    this.hideError();
    this.options.onCaptureStart();

    // Hide button, show processing
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('processing').style.display = 'block';
    document.getElementById('processing-text').textContent = 'Capturing photo...';

    try {
      // Capture frame from video to canvas
      const video = this.videoElement;
      const canvas = this.canvasElement;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

      console.log('Photo captured:', blob.size, 'bytes');

      // Update processing status
      document.getElementById('processing-text').textContent = 'Uploading to secure storage...';

      // Upload to Supabase
      const photoUrl = await this.uploadToSupabase(blob);

      console.log('Photo uploaded:', photoUrl);

      // Update processing status
      document.getElementById('processing-text').textContent = 'Verifying authenticity...';

      // Submit for verification
      await this.submitForVerification(photoUrl);

    } catch (error) {
      console.error('Capture error:', error);
      this.showError(`Failed to capture photo: ${error.message}`);

      // Restore button
      document.getElementById('capture-btn').style.display = 'block';
      document.getElementById('processing').style.display = 'none';
    }
  }

  async uploadToSupabase(blob) {
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const filename = `evidence/${timestamp}-${randomStr}.jpg`;

    // Get Supabase client from auth service
    if (typeof window.authService === 'undefined') {
      throw new Error('Auth service not loaded');
    }

    const { data, error } = await window.authService.supabase.storage
      .from('project-evidence')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = window.authService.supabase.storage
      .from('project-evidence')
      .getPublicUrl(filename);

    return publicUrl;
  }

  async submitForVerification(photoUrl) {
    const token = this.options.verificationToken;

    const payload = {
      token,
      photo_url: photoUrl,
      gps_latitude: this.gpsCoords.latitude,
      gps_longitude: this.gpsCoords.longitude,
      gps_accuracy: this.gpsCoords.accuracy,
      photo_metadata: {
        captured_at: new Date().toISOString(),
        gps_timestamp: this.gpsCoords.timestamp,
        video_width: this.videoElement.videoWidth,
        video_height: this.videoElement.videoHeight
      },
      user_agent: navigator.userAgent,
      ip_address: null // Server will log this
    };

    const response = await fetch(this.options.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Verification failed');
    }

    console.log('Verification result:', result);

    // Stop camera
    this.stopCamera();

    // Call success callback
    this.options.onSuccess(result);
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  destroy() {
    this.stopCamera();
    this.container.innerHTML = '';
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecureEvidenceCapture;
}
