document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoStream');
    const canvas = document.getElementById('frameCanvas');
    const ctx = canvas.getContext('2d');
    let lastUpdateTime = Date.now();
    let frameCount = 0;

    // Attempt to access webcam
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.play();
            startPredictionLoop();
        })
        .catch(err => {
            console.error('Webcam error:', err);
            document.getElementById('statusText').textContent = 'Camera access denied';
            document.querySelector('.status-indicator').classList.add('inactive');
        });

    function captureFrame() {
        // Draw video frame to canvas and return base64 image
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    function startPredictionLoop() {
        setInterval(async () => {
            if (video.readyState === 4) {
                const base64ImageData = captureFrame();

                try {
                    const response = await fetch('/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64ImageData })
                    });
                    const data = await response.json();
                    updatePredictionDisplay(data);
                } catch (err) {
                    console.error(err);
                }

                // FPS logic (update as needed for your UI)
                frameCount++;
                const now = Date.now();
                if (now - lastUpdateTime >= 1000) {
                    document.getElementById('fps').textContent =
                        Math.round(frameCount / ((now - lastUpdateTime) / 1000));
                    frameCount = 0;
                    lastUpdateTime = now;
                }
            }
        }, 250); // Adjust as needed for prediction frequency
    }

    function updatePredictionDisplay(data) {
        const letterElement = document.getElementById('predictedLetter');
        const confidenceFill = document.getElementById('confidenceFill');
        const confidenceValue = document.getElementById('confidenceValue');
        const statusText = document.getElementById('statusText');
        const indicator = document.querySelector('.status-indicator');

        if (data.label && data.confidence > 0) {
            letterElement.textContent = data.label;
            confidenceFill.style.width = (data.confidence * 100) + '%';
            confidenceValue.textContent = (data.confidence * 100).toFixed(1) + '%';
            statusText.textContent = 'Hand detected - Predicting...';
            indicator.classList.remove('inactive');
            indicator.classList.add('active');
        } else {
            letterElement.textContent = '-';
            confidenceFill.style.width = '0%';
            confidenceValue.textContent = '0%';
            statusText.textContent = 'Waiting for hand...';
            indicator.classList.remove('active');
            indicator.classList.add('inactive');
        }
    }
});
