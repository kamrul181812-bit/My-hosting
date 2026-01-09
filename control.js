// ==============================================
// BOT CONTROL FUNCTIONS
// ==============================================

// Bot control state
let botControls = {
    isRunning: false,
    deploymentStatus: 'stopped',
    currentDeployment: null,
    activityInterval: null,
    uptimeInterval: null
};

// Initialize bot controls
function initBotControls() {
    console.log('✅ Bot controls initialized');
    
    // Check if we have existing bot state
    const savedState = localStorage.getItem('botControlState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            botControls = { ...botControls, ...state };
            console.log('Loaded saved bot state:', state);
        } catch (error) {
            console.error('Error loading bot state:', error);
        }
    }
    
    // Setup periodic state save
    setInterval(() => {
        localStorage.setItem('botControlState', JSON.stringify({
            isRunning: botControls.isRunning,
            deploymentStatus: botControls.deploymentStatus
        }));
    }, 5000);
}

// Get current user ID
function getCurrentUserId() {
    return window.currentUser?.uid;
}

// Get current user email
function getCurrentUserEmail() {
    return window.currentUser?.email;
}

// Get Firebase token
async function getFirebaseToken() {
    if (!window.currentUser) return null;
    try {
        return await window.currentUser.getIdToken();
    } catch (error) {
        console.error('Error getting Firebase token:', error);
        return null;
    }
}

// Start the bot
async function startBot() {
    if (botControls.isRunning) {
        addToConsole('Bot is already running', 'warning');
        return;
    }

    try {
        addToConsole('🚀 Starting bot...', 'info');
        
        // Update UI immediately
        updateBotStatus('running');
        botControls.isRunning = true;
        
        // Disable start button, enable stop button
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        
        // Get Firebase token
        const token = await getFirebaseToken();
        if (!token) {
            throw new Error('Authentication required. Please login again.');
        }
        
        // Call serverless function to start bot
        const response = await fetch('/.netlify/functions/bot-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'start',
                userId: getCurrentUserId(),
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            addToConsole('✅ Bot started successfully', 'success');
            addToConsole(`Status: ${data.botState}`, 'info');
            addToConsole(`Started at: ${new Date().toLocaleTimeString()}`, 'info');
            
            // Start simulated activity
            startSimulatedActivity();
            
            // Start uptime counter
            startUptimeCounter();
            
            // Update Firestore
            await updateFirestoreBotState('running');
            
        } else {
            throw new Error(data.error || 'Failed to start bot');
        }
        
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        addToConsole(`Error: ${error.message}`, 'error');
        updateBotStatus('error');
        botControls.isRunning = false;
        
        // Re-enable start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) startBtn.disabled = false;
    }
}

// Stop the bot
async function stopBot() {
    if (!botControls.isRunning) {
        addToConsole('Bot is not running', 'warning');
        return;
    }

    try {
        addToConsole('🛑 Stopping bot...', 'warning');
        
        // Update UI
        updateBotStatus('stopped');
        botControls.isRunning = false;
        
        // Disable stop button, enable start button
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        
        // Stop simulated activity
        stopSimulatedActivity();
        
        // Stop uptime counter
        stopUptimeCounter();
        
        // Call serverless function to stop bot
        const token = await getFirebaseToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const response = await fetch('/.netlify/functions/bot-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'stop',
                userId: getCurrentUserId(),
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            addToConsole('✅ Bot stopped successfully', 'info');
            addToConsole(`Stopped at: ${new Date().toLocaleTimeString()}`, 'info');
            
            // Update Firestore
            await updateFirestoreBotState('stopped');
            
        } else {
            throw new Error(data.error || 'Failed to stop bot');
        }
        
    } catch (error) {
        console.error('❌ Error stopping bot:', error);
        addToConsole(`Error: ${error.message}`, 'error');
        updateBotStatus('error');
        
        // Re-enable stop button
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) stopBtn.disabled = false;
    }
}

// Deploy bot to Netlify
async function deployToNetlify() {
    const deployBtn = document.getElementById('deploy-btn');
    const deploySpinner = document.getElementById('deploy-spinner');
    
    // Check if bot.py is uploaded
    if (!window.botFiles || !window.botFiles.bot) {
        addToConsole('❌ Error: Please upload bot.py first', 'error');
        showNotification('Upload bot.py first', 'error');
        return;
    }
    
    try {
        // Update UI
        deployBtn.disabled = true;
        if (deploySpinner) deploySpinner.classList.remove('hidden');
        
        addToConsole('🚀 Starting deployment to Netlify...', 'info');
        updateBotStatus('deploying');
        
        // Get Firebase token
        const token = await getFirebaseToken();
        if (!token) {
            throw new Error('Authentication required. Please login again.');
        }
        
        // Show deployment steps
        addToConsole('Step 1: Creating GitHub repository...', 'info');
        
        // Call deploy function
        const response = await fetch('/.netlify/functions/deploy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: getCurrentUserId(),
                email: getCurrentUserEmail(),
                files: window.botFiles,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Deployment failed');
        }
        
        // Update UI with deployment results
        addToConsole('✅ Deployment successful!', 'success');
        addToConsole(`🌐 Bot URL: ${data.netlifyUrl}`, 'info');
        addToConsole(`📁 GitHub Repo: ${data.githubRepo}`, 'info');
        addToConsole('⚡ Your bot is now live on Netlify!', 'success');
        
        // Update bot URL display
        updateBotUrlDisplay(data.netlifyUrl);
        
        // Update Firestore
        await updateDeploymentInfo(data);
        
        // Update status
        updateBotStatus('stopped');
        
        // Show success notification
        showNotification('Deployment successful!', 'success');
        
    } catch (error) {
        console.error('❌ Deployment error:', error);
        addToConsole(`Error: ${error.message}`, 'error');
        updateBotStatus('error');
        
        // Show error to user
        showNotification(`Deployment failed: ${error.message}`, 'error');
        
    } finally {
        // Reset UI
        if (deployBtn) deployBtn.disabled = false;
        if (deploySpinner) deploySpinner.classList.add('hidden');
    }
}

// Update bot files
async function updateBotFiles() {
    if (!window.botFiles || (!window.botFiles.bot && !window.botFiles.req)) {
        addToConsole('❌ Error: No files to update', 'error');
        showNotification('No files to update', 'error');
        return;
    }
    
    try {
        addToConsole('📁 Updating bot files...', 'info');
        
        // Get Firebase token
        const token = await getFirebaseToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        
        // Update files in Firestore
        await updateFirestoreFiles(window.botFiles);
        
        addToConsole('✅ Files updated successfully', 'success');
        showNotification('Files updated successfully', 'success');
        
    } catch (error) {
        console.error('❌ Error updating files:', error);
        addToConsole(`Error: ${error.message}`, 'error');
        showNotification(`Update failed: ${error.message}`, 'error');
    }
}

// Update bot status display
function updateBotStatus(status) {
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    const statusDisplay = document.getElementById('status-display');
    
    if (!statusContainer || !statusText) return;
    
    // Remove all status classes
    statusContainer.className = 'status-indicator';
    statusContainer.classList.add(`status-${status}`);
    
    // Update text
    const statusLabels = {
        'running': 'Running',
        'stopped': 'Stopped',
        'error': 'Error',
        'deploying': 'Deploying...'
    };
    
    const label = statusLabels[status] || status;
    statusText.textContent = label;
    
    if (statusDisplay) {
        statusDisplay.textContent = label;
    }
    
    // Update button states
    updateControlButtons(status);
    
    // Save to local storage
    botControls.deploymentStatus = status;
}

// Update control button states
function updateControlButtons(status) {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const deployBtn = document.getElementById('deploy-btn');
    
    if (!startBtn || !stopBtn || !deployBtn) return;
    
    switch (status) {
        case 'running':
            startBtn.disabled = true;
            stopBtn.disabled = false;
            deployBtn.disabled = true;
            break;
            
        case 'stopped':
            startBtn.disabled = false;
            stopBtn.disabled = true;
            deployBtn.disabled = false;
            break;
            
        case 'deploying':
            startBtn.disabled = true;
            stopBtn.disabled = true;
            deployBtn.disabled = true;
            break;
            
        case 'error':
            startBtn.disabled = false;
            stopBtn.disabled = true;
            deployBtn.disabled = false;
            break;
    }
}

// Start simulated bot activity
function startSimulatedActivity() {
    // Clear any existing interval
    if (botControls.activityInterval) {
        clearInterval(botControls.activityInterval);
    }
    
    // Initial activity messages
    const initialActivities = [
        'Initializing bot components...',
        'Loading configuration...',
        'Connecting to database...',
        'Setting up API connections...',
        'Starting main event loop...'
    ];
    
    let initStep = 0;
    const initInterval = setInterval(() => {
        if (initStep < initialActivities.length) {
            addToConsole(initialActivities[initStep], 'info');
            initStep++;
        } else {
            clearInterval(initInterval);
            // Start regular activity
            startRegularActivity();
        }
    }, 1500);
    
    function startRegularActivity() {
        // Start new activity simulation
        botControls.activityInterval = setInterval(() => {
            if (!botControls.isRunning) {
                clearInterval(botControls.activityInterval);
                return;
            }
            
            // Simulate random bot activities
            const activities = [
                { 
                    message: 'Processing new data batch (size: 256 records)', 
                    type: 'info' 
                },
                { 
                    message: 'Task completed successfully (execution time: 1.2s)', 
                    type: 'success' 
                },
                { 
                    message: 'Fetching latest market data...', 
                    type: 'info' 
                },
                { 
                    message: 'Database updated with new entries', 
                    type: 'info' 
                },
                { 
                    message: 'API call to external service successful', 
                    type: 'success' 
                },
                { 
                    message: 'Memory usage: 45MB | CPU: 12%', 
                    type: 'info' 
                },
                { 
                    message: 'Health check passed ✅', 
                    type: 'success' 
                },
                { 
                    message: 'Scheduled maintenance task executed', 
                    type: 'info' 
                }
            ];
            
            const activity = activities[Math.floor(Math.random() * activities.length)];
            addToConsole(activity.message, activity.type);
            
        }, 4000); // Every 4 seconds
    }
}

// Stop simulated activity
function stopSimulatedActivity() {
    if (botControls.activityInterval) {
        clearInterval(botControls.activityInterval);
        botControls.activityInterval = null;
    }
    
    // Show shutdown messages
    const shutdownMessages = [
        'Shutting down bot components...',
        'Closing database connections...',
        'Stopping event loops...',
        'Cleaning up resources...',
        'Bot shutdown complete'
    ];
    
    let step = 0;
    const shutdownInterval = setInterval(() => {
        if (step < shutdownMessages.length) {
            addToConsole(shutdownMessages[step], 'warning');
            step++;
        } else {
            clearInterval(shutdownInterval);
        }
    }, 1000);
}

// Start uptime counter
function startUptimeCounter() {
    // Clear existing interval
    if (botControls.uptimeInterval) {
        clearInterval(botControls.uptimeInterval);
    }
    
    const startTime = new Date();
    
    // Update uptime every second
    botControls.uptimeInterval = setInterval(() => {
        if (!botControls.isRunning) {
            clearInterval(botControls.uptimeInterval);
            return;
        }
        
        const now = new Date();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        let uptimeText = '';
        if (hours > 0) {
            uptimeText = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            uptimeText = `${minutes}m ${seconds}s`;
        } else {
            uptimeText = `${seconds}s`;
        }
        
        const uptimeElement = document.getElementById('uptime');
        if (uptimeElement) {
            uptimeElement.textContent = uptimeText;
        }
    }, 1000);
}

// Stop uptime counter
function stopUptimeCounter() {
    if (botControls.uptimeInterval) {
        clearInterval(botControls.uptimeInterval);
        botControls.uptimeInterval = null;
    }
    
    const uptimeElement = document.getElementById('uptime');
    if (uptimeElement) {
        uptimeElement.textContent = '0 minutes';
    }
}

// Update bot URL display
function updateBotUrlDisplay(url) {
    const urlDisplay = document.getElementById('url-display');
    const botUrl = document.getElementById('bot-url');
    const botUrlText = document.getElementById('bot-url-text');
    const noUrlMessage = document.getElementById('no-url-message');
    
    if (!urlDisplay || !botUrl || !botUrlText || !noUrlMessage) return;
    
    if (url) {
        urlDisplay.classList.remove('hidden');
        botUrl.href = url;
        botUrlText.textContent = url;
        noUrlMessage.classList.add('hidden');
    } else {
        urlDisplay.classList.add('hidden');
        noUrlMessage.classList.remove('hidden');
    }
}

// Update Firestore bot state
async function updateFirestoreBotState(state) {
    try {
        const userId = getCurrentUserId();
        if (!userId) return;
        
        await window.firebase.updateDoc(window.firebase.doc(window.db, 'users', userId), {
            botState: state,
            lastUpdated: window.firebase.serverTimestamp(),
            ...(state === 'running' ? { uptimeStart: window.firebase.serverTimestamp() } : {})
        });
        
        console.log(`Firestore updated: botState = ${state}`);
        
    } catch (error) {
        console.error('❌ Error updating Firestore:', error);
        addToConsole(`Error updating database: ${error.message}`, 'error');
    }
}

// Update Firestore files
async function updateFirestoreFiles(files) {
    try {
        const userId = getCurrentUserId();
        if (!userId) return;
        
        await window.firebase.updateDoc(window.firebase.doc(window.db, 'users', userId), {
            botFiles: files,
            filesUpdated: window.firebase.serverTimestamp()
        });
        
        console.log('Firestore files updated');
        
    } catch (error) {
        console.error('❌ Error updating files in Firestore:', error);
        throw error;
    }
}

// Update deployment info in Firestore
async function updateDeploymentInfo(data) {
    try {
        const userId = getCurrentUserId();
        if (!userId) return;
        
        await window.firebase.updateDoc(window.firebase.doc(window.db, 'users', userId), {
            netlifyUrl: data.netlifyUrl,
            githubRepo: data.githubRepo,
            deploymentId: data.deploymentId,
            lastDeployed: window.firebase.serverTimestamp(),
            botState: 'stopped'
        });
        
        console.log('Firestore deployment info updated');
        
    } catch (error) {
        console.error('❌ Error updating deployment info:', error);
        throw error;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 20px;
                border-radius: 10px;
                background: #1f2937;
                border-left: 4px solid #3b82f6;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-width: 300px;
                max-width: 400px;
                z-index: 1000;
                animation: slideIn 0.3s ease;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            .notification-success {
                border-left-color: #10b981;
            }
            .notification-error {
                border-left-color: #ef4444;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }
            .notification-close {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                margin-left: 12px;
            }
            .notification-close:hover {
                color: white;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to body
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Check bot status from server
async function checkBotStatus() {
    try {
        const token = await getFirebaseToken();
        if (!token) return;
        
        const response = await fetch('/.netlify/functions/bot-control', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.botState) {
                if (data.botState !== botControls.deploymentStatus) {
                    updateBotStatus(data.botState);
                    botControls.isRunning = data.botState === 'running';
                    
                    if (data.botState === 'running' && !botControls.activityInterval) {
                        startSimulatedActivity();
                        startUptimeCounter();
                    } else if (data.botState !== 'running') {
                        stopSimulatedActivity();
                        stopUptimeCounter();
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking bot status:', error);
    }
}

// Initialize periodic status checks
function initStatusChecker() {
    // Check status every 10 seconds
    setInterval(checkBotStatus, 10000);
    
    // Initial check
    setTimeout(checkBotStatus, 2000);
}

// Add to console function
function addToConsole(message, type = 'info') {
    if (typeof window.addToConsole === 'function') {
        window.addToConsole(message, type);
    } else {
        // Fallback
        console.log(`[${type}] ${message}`);
        
        // Try to find console element
        const consoleEl = document.getElementById('console');
        if (consoleEl) {
            const timestamp = new Date().toLocaleTimeString();
            const logLine = document.createElement('div');
            logLine.className = `console-log log-${type}`;
            logLine.textContent = `[${timestamp}] ${message}`;
            consoleEl.appendChild(logLine);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }
}

// Initialize when loaded
document.addEventListener('DOMContentLoaded', () => {
    initBotControls();
    initStatusChecker();
    console.log('🔧 Control module loaded and ready');
});

// Make functions globally available
window.startBot = startBot;
window.stopBot = stopBot;
window.deployToNetlify = deployToNetlify;
window.updateBotFiles = updateBotFiles;
window.updateBotStatus = updateBotStatus;
window.updateBotUrlDisplay = updateBotUrlDisplay;
window.showNotification = showNotification;
window.checkBotStatus = checkBotStatus;
