const API_URL = 'https://gesture-sense-backend-production.up.railway.app';  // Your Railway URL

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoStream');
    const canvas = document.getElementById('frameCanvas');
    
    if (!video || !canvas) {
        console.error('❌ Video or canvas element not found!');
        return;
    }
    
    // Set canvas dimensions
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    let lastUpdateTime = Date.now();
    let frameCount = 0;
    let isStreaming = false;

    console.log('🚀 Initializing webcam...');

    // Request webcam access
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
        } 
    })
    .then(stream => {
        console.log('✅ Webcam access granted');
        video.srcObject = stream;
        
        // Wait for video metadata to load
        video.onloadedmetadata = () => {
            console.log(`📹 Video loaded: ${video.videoWidth}x${video.videoHeight}`);
            video.play()
                .then(() => {
                    console.log('▶️ Video playing');
                    isStreaming = true;
                    
                    // Update status
                    updateStatus('Camera ready - Show your hand!', 'active');
                    
                    // Start predictions after a short delay
                    setTimeout(startPredictionLoop, 1000);
                })
                .catch(err => {
                    console.error('❌ Video play error:', err);
                });
        };

        video.onerror = (err) => {
            console.error('❌ Video error:', err);
            updateStatus('Video error', 'inactive');
        };
    })
    .catch(err => {
        console.error('❌ Webcam access denied:', err);
        updateStatus('Camera access denied - Please allow camera', 'inactive');
        alert('Please allow camera access to use this application');
    });

    function captureFrame() {
        if (!isStreaming || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return null;
        }

        try {
            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to base64 JPEG
            const base64Image = canvas.toDataURL('image/jpeg', 0.95);
            return base64Image;
        } catch (err) {
            console.error('❌ Frame capture error:', err);
            return null;
        }
    }

    function startPredictionLoop() {
        console.log('🔄 Starting prediction loop...');
        
        setInterval(async () => {
            if (!isStreaming) return;

            const base64ImageData = captureFrame();
            
            if (!base64ImageData) {
                console.warn('⚠️ No frame captured');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/predict`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ image: base64ImageData })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Check for errors in response
                if (data.error) {
                    console.error('❌ Server error:', data.error);
                    updateStatus('Server error: ' + data.error, 'inactive');
                    return;
                }
                
                // Update display
                updatePredictionDisplay(data);
                
            } catch (err) {
                console.error('❌ Prediction request failed:', err);
                updateStatus('Connection error', 'inactive');
            }

            // Update FPS counter
            frameCount++;
            const now = Date.now();
            if (now - lastUpdateTime >= 1000) {
                const fps = Math.round(frameCount / ((now - lastUpdateTime) / 1000));
                document.getElementById('fps').textContent = fps;
                frameCount = 0;
                lastUpdateTime = now;
            }
        }, 250); // Send frame every 250ms (4 FPS)
    }

    function updatePredictionDisplay(data) {
        const letterElement = document.getElementById('predictedLetter');
        const confidenceFill = document.getElementById('confidenceFill');
        const confidenceValue = document.getElementById('confidenceValue');

        if (data.label && data.confidence > 0) {
            // Hand detected with prediction
            letterElement.textContent = data.label;
            letterElement.style.color = getConfidenceColor(data.confidence);
            
            const confidencePercent = (data.confidence * 100).toFixed(1);
            confidenceFill.style.width = confidencePercent + '%';
            confidenceValue.textContent = confidencePercent + '%';
            
            updateStatus(`Detected: ${data.label} (${confidencePercent}%)`, 'active');
            
            console.log(`✅ Prediction: ${data.label} @ ${confidencePercent}%`);
        } else {
            // No hand detected
            letterElement.textContent = '-';
            letterElement.style.color = '#ccc';
            confidenceFill.style.width = '0%';
            confidenceValue.textContent = '0%';
            updateStatus('Waiting for hand...', 'inactive');
        }
    }

    function getConfidenceColor(confidence) {
        if (confidence >= 0.8) return '#4caf50'; // Green
        if (confidence >= 0.6) return '#ff9800'; // Orange
        return '#f44336'; // Red
    }

    function updateStatus(text, state) {
        const statusText = document.getElementById('statusText');
        const indicator = document.querySelector('.status-indicator');
        
        if (statusText) statusText.textContent = text;
        if (indicator) {
            indicator.className = 'status-indicator ' + state;
        }
    }
});
