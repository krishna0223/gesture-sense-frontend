// ================================================
// CONFIGURATION
// ================================================
const API_BASE = "https://gesture-sense-backend-production.up.railway.app";
const POLL_INTERVAL = 200; // milliseconds
let lastUpdateTime = Date.now();
let frameCount = 0;

// Video elements
let videoElement;
let canvasElement;
let canvasCtx;
let isWebcamReady = false;

// ================================================
// INITIALIZE WEBCAM
// ================================================
async function initializeWebcam() {
    videoElement = document.getElementById('webcam');
    canvasElement = document.getElementById('canvas');
    canvasCtx = canvasElement.getContext('2d');
    
    // Set canvas size
    canvasElement.width = 200;
    canvasElement.height = 200;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        videoElement.srcObject = stream;
        
        // Wait for video to be ready
        videoElement.onloadedmetadata = () => {
            videoElement.play();
            isWebcamReady = true;
            updateStatus('Camera ready - Show your hand!', 'active');
            console.log('✅ Webcam initialized');
        };
        
        return true;
    } catch (error) {
        console.error('❌ Camera error:', error);
        updateStatus('Camera access denied', 'inactive');
        alert('Please allow camera access to use this application');
        return false;
    }
}

// ================================================
// CAPTURE FRAME AS BASE64
// ================================================
function captureFrame() {
    if (!isWebcamReady || !videoElement || videoElement.readyState !== 4) {
        return null;
    }
    
    // Draw video frame to canvas
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // Convert to base64
    return canvasElement.toDataURL('image/jpeg', 0.8);
}

// ================================================
// PREDICTION POLLING
// ================================================
async function pollPredictions() {
    if (!isWebcamReady) {
        setTimeout(pollPredictions, POLL_INTERVAL);
        return;
    }
    
    try {
        const base64ImageData = captureFrame();
        
        if (!base64ImageData) {
            setTimeout(pollPredictions, POLL_INTERVAL);
            return;
        }
        
        const response = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64ImageData })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update FPS counter
        frameCount++;
        const now = Date.now();
        if (now - lastUpdateTime >= 1000) {
            const fps = Math.round(frameCount / ((now - lastUpdateTime) / 1000));
            document.getElementById('fps').textContent = fps;
            frameCount = 0;
            lastUpdateTime = now;
        }
        
        // Update UI with prediction
        updatePredictionDisplay(data);
        
    } catch (error) {
        console.error('❌ Error fetching prediction:', error);
        updateStatus('Error connecting to server', 'inactive');
    }
    
    // Continue polling
    setTimeout(pollPredictions, POLL_INTERVAL);
}

// ================================================
// UPDATE PREDICTION DISPLAY
// ================================================
function updatePredictionDisplay(data) {
    const letterElement = document.getElementById('predictedLetter');
    const confidenceFill = document.getElementById('confidenceFill');
    const confidenceValue = document.getElementById('confidenceValue');
    
    if (data.label && data.confidence > 0) {
        // Update letter
        letterElement.textContent = data.label;
        letterElement.style.color = getConfidenceColor(data.confidence);
        
        // Update confidence bar
        const confidencePercent = (data.confidence * 100).toFixed(1);
        confidenceFill.style.width = confidencePercent + '%';
        confidenceFill.style.backgroundColor = getConfidenceColor(data.confidence);
        confidenceValue.textContent = confidencePercent + '%';
        
        // Update status
        updateStatus('Hand detected - Predicting...', 'active');
    } else {
        // No hand detected
        letterElement.textContent = '-';
        letterElement.style.color = '#ccc';
        confidenceFill.style.width = '0%';
        confidenceValue.textContent = '0%';
        updateStatus('Waiting for hand...', 'inactive');
    }
}

// ================================================
// HELPER FUNCTIONS
// ================================================
function getConfidenceColor(confidence) {
    if (confidence >= 0.8) return '#4caf50'; // Green
    if (confidence >= 0.6) return '#ff9800'; // Orange
    return '#f44336'; // Red
}

function updateStatus(text, state) {
    const statusText = document.getElementById('statusText');
    const indicator = document.querySelector('.status-indicator');
    
    statusText.textContent = text;
    indicator.className = 'status-indicator ' + state;
}

// ================================================
// APP START
// ================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 ASL Recognition started, polling from', API_BASE);
    updateStatus('Requesting camera access...', 'inactive');
    
    const cameraReady = await initializeWebcam();
    if (cameraReady) {
        // Start prediction loop after a short delay
        setTimeout(() => {
            pollPredictions();
        }, 500);
    }
});
