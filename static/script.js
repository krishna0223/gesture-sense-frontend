// ================================================
// CONFIGURATION
// ================================================
const API_BASE = "https://gesture-sense-backend-production.up.railway.app";
const POLL_INTERVAL = 200;
let lastUpdateTime = Date.now();
let frameCount = 0;

// Video elements
let videoElement;
let canvasElement;
let canvasCtx;

// ================================================
// INITIALIZE WEBCAM
// ================================================
async function initializeWebcam() {
    videoElement = document.createElement('video');
    canvasElement = document.createElement('canvas');
    canvasCtx = canvasElement.getContext('2d');
    
    canvasElement.width = 200;
    canvasElement.height = 200;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 200, height: 200 } 
        });
        videoElement.srcObject = stream;
        videoElement.play();
        
        updateStatus('Camera ready', 'active');
        return true;
    } catch (error) {
        console.error('❌ Camera error:', error);
        updateStatus('Camera access denied', 'inactive');
        return false;
    }
}

// ================================================
// CAPTURE FRAME AS BASE64
// ================================================
function captureFrame() {
    if (!videoElement || videoElement.readyState !== 4) {
        return null;
    }
    
    canvasCtx.drawImage(videoElement, 0, 0, 200, 200);
    return canvasElement.toDataURL('image/jpeg');
}

// ================================================
// PREDICTION POLLING
// ================================================
async function pollPredictions() {
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
        letterElement.textContent = data.label;
        letterElement.style.color = getConfidenceColor(data.confidence);
        
        const confidencePercent = (data.confidence * 100).toFixed(1);
        confidenceFill.style.width = confidencePercent + '%';
        confidenceValue.textContent = confidencePercent + '%';
        
        updateStatus('Hand detected - Predicting...', 'active');
    } else {
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
    if (confidence >= 0.8) return '#4caf50';
    if (confidence >= 0.6) return '#ff9800';
    return '#f44336';
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
    
    const cameraReady = await initializeWebcam();
    if (cameraReady) {
        // Wait for video to be ready before starting predictions
        videoElement.addEventListener('loadeddata', () => {
            pollPredictions();
        });
    }
});
