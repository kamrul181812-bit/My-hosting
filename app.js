// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD5gpqaMxgVcFgTXnUI5agJeq0E88i3Fdk",
    authDomain: "my-hosting-d5bdf.firebaseapp.com",
    projectId: "my-hosting-d5bdf",
    storageBucket: "my-hosting-d5bdf.firebasestorage.app",
    messagingSenderId: "773336711456",
    appId: "1:773336711456:web:099ab86b732db6818a9745"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.getAuth(app);
const db = firebase.getFirestore(app);

// Global State
let currentUser = null;
let botFiles = { bot: null, req: null };
let botStatus = 'stopped';
let userData = null;
let activityInterval = null;
let uptimeStart = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    firebase.onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            document.getElementById('user-email').textContent = user.email;
            showDashboard();
            await loadUserData();
            setupRealtimeListeners();
        } else {
            showLogin();
        }
    });
});

// Show Login
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
}

function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}

// Show Dashboard
function showDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    setupFileUploads();
}

// Handle Login
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
        return;
    }
    
    try {
        await firebase.signInWithEmailAndPassword(auth, email, password);
        errorEl.classList.add('hidden');
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

// Handle Signup
async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const errorEl = document.getElementById('signup-error');
    
    if (!email || !password || !confirm) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
        return;
    }
    
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
        return;
    }
    
    try {
        const userCredential = await firebase.createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document
        await firebase.setDoc(firebase.doc(db, 'users', userCredential.user.uid), {
            email: email,
            balance: 100.00,
            createdAt: firebase.serverTimestamp(),
            botState: 'stopped',
            botFiles: {},
            lastDeployed: null,
            netlifyUrl: null,
            githubRepo: null,
            uptimeStart: null
        });
        
        errorEl.classList.add('hidden');
        showLogin();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

// Handle Logout
async function handleLogout() {
    try {
        await firebase.signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load User Data
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await firebase.getDoc(firebase.doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
            userData = userDoc.data();
            
            // Update balance
            if (userData.balance) {
                document.getElementById('balance').textContent = userData.balance.toFixed(2);
            }
            
            // Update status
            if (userData.botState) {
                updateBotStatus(userData.botState);
            }
            
            // Update bot files
            if (userData.botFiles) {
                botFiles = userData.botFiles;
                updateFileDisplays();
            }
            
            // Update bot URL
            if (userData.netlifyUrl) {
                updateBotUrlDisplay(userData.netlifyUrl);
            }
            
            // Update last deployed
            if (userData.lastDeployed) {
                const date = userData.lastDeployed.toDate ? 
                    userData.lastDeployed.toDate() : 
                    new Date(userData.lastDeployed.seconds * 1000);
                document.getElementById('last-deployed').textContent = date.toLocaleString();
            }
            
            // Start uptime counter if bot is running
            if (userData.botState === 'running' && userData.uptimeStart) {
                startUptimeCounter(userData.uptimeStart);
            }
        } else {
            // Create user document if doesn't exist
            await firebase.setDoc(firebase.doc(db, 'users', currentUser.uid), {
                email: currentUser.email,
                balance: 100.00,
                createdAt: firebase.serverTimestamp(),
                botState: 'stopped',
                botFiles: {},
                lastDeployed: null,
                netlifyUrl: null,
                githubRepo: null
            });
            
            userData = {
                email: currentUser.email,
                balance: 100.00,
                botState: 'stopped',
                botFiles: {}
            };
        }
    } catch (error) {
        addToConsole(`Error loading user data: ${error.message}`, 'error');
    }
}

// Setup File Uploads
function setupFileUploads() {
    const uploadArea = document.getElementById('file-upload-area');
    const botFileInput = document.getElementById('bot-file');
    const reqFileInput = document.getElementById('req-file');
    
    if (!uploadArea) return;
    
    // Click handler
    uploadArea.addEventListener('click', () => {
        botFileInput.click();
    });
    
    // File change handlers
    botFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0], 'bot');
    });
    
    reqFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0], 'req');
    });
    
    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        });
    });
    
    // Handle drop
    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        for (let file of files) {
            if (file.name.endsWith('.py')) {
                handleFileUpload(file, 'bot');
            } else if (file.name.endsWith('.txt') || file.name === 'requirements.txt') {
                handleFileUpload(file, 'req');
            }
        }
    });
}

// Handle File Upload
async function handleFileUpload(file, type) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const content = e.target.result;
        
        botFiles[type] = {
            name: file.name,
            content: content,
            size: file.size,
            lastModified: new Date().toISOString()
        };
        
        // Update UI
        updateFileDisplays();
        
        // Save to Firestore
        try {
            await firebase.updateDoc(firebase.doc(db, 'users', currentUser.uid), {
                [`botFiles.${type}`]: botFiles[type]
            });
            
            addToConsole(`✓ Uploaded ${file.name} (${formatFileSize(file.size)})`, 'success');
        } catch (error) {
            addToConsole(`Error saving file: ${error.message}`, 'error');
        }
    };
    
    reader.readAsText(file);
}

// Update File Displays
function updateFileDisplays() {
    // bot.py
    if (botFiles.bot) {
        document.getElementById('bot-file-status').textContent = 'Uploaded';
        document.getElementById('bot-file-status').className = 'text-green-400';
        document.getElementById('bot-file-info').classList.remove('hidden');
        document.getElementById('bot-file-info').innerHTML = `
            ${botFiles.bot.name} <span class="text-gray-500">(${formatFileSize(botFiles.bot.size)})</span>
        `;
    }
    
    // requirements.txt
    if (botFiles.req) {
        document.getElementById('req-file-status').textContent = 'Uploaded';
        document.getElementById('req-file-status').className = 'text-green-400';
        document.getElementById('req-file-info').classList.remove('hidden');
        document.getElementById('req-file-info').innerHTML = `
            ${botFiles.req.name} <span class="text-gray-500">(${formatFileSize(botFiles.req.size)})</span>
        `;
    }
    
    // Update file list
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    
    if (botFiles.bot) {
        fileList.innerHTML += `
            <div class="flex items-center justify-between p-2 bg-gray-700 rounded">
                <div class="flex items-center">
                    <i class="fas fa-file-code text-blue-400 mr-3"></i>
                    <span>${botFiles.bot.name}</span>
                </div>
                <span class="text-sm text-gray-400">${formatFileSize(botFiles.bot.size)}</span>
            </div>
        `;
    }
    
    if (botFiles.req) {
        fileList.innerHTML += `
            <div class="flex items-center justify-between p-2 bg-gray-700 rounded">
                <div class="flex items-center">
                    <i class="fas fa-file-alt text-green-400 mr-3"></i>
                    <span>${botFiles.req.name}</span>
                </div>
                <span class="text-sm text-gray-400">${formatFileSize(botFiles.req.size)}</span>
            </div>
        `;
    }
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Deploy to Netlify
async function deployToNetlify() {
    if (!botFiles.bot) {
        addToConsole('Error: Please upload bot.py first', 'error');
        return;
    }
    
    const deployBtn = document.getElementById('deploy-btn');
    const spinner = document.getElementById('deploy-spinner');
    
    deployBtn.disabled = true;
    spinner.classList.remove('hidden');
    
    addToConsole('Starting deployment to Netlify...', 'info');
    updateBotStatus('deploying');
    
    try {
        const token = await currentUser.getIdToken();
        
        const response = await fetch('/.netlify/functions/deploy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                email: currentUser.email,
                files: botFiles
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            addToConsole('✓ Deployment successful!', 'success');
            addToConsole(`Bot URL: ${data.netlifyUrl}`, 'info');
            addToConsole(`GitHub Repo: ${data.githubRepo}`, 'info');
            
            // Update bot URL display
            updateBotUrlDisplay(data.netlifyUrl);
            
            // Update Firestore
            await firebase.updateDoc(firebase.doc(db, 'users', currentUser.uid), {
                netlifyUrl: data.netlifyUrl,
                githubRepo: data.githubRepo,
                lastDeployed: firebase.serverTimestamp(),
                botState: 'stopped'
            });
            
            updateBotStatus('stopped');
            
        } else {
            throw new Error(data.error || 'Deployment failed');
        }
        
    } catch (error) {
        addToConsole(`Deployment error: ${error.message}`, 'error');
        updateBotStatus('error');
    } finally {
        deployBtn.disabled = false;
        spinner.classList.add('hidden');
    }
}

// Start Bot
async function startBot() {
    addToConsole('Starting bot...', 'info');
    updateBotStatus('running');
    
    try {
        // Call bot-control function
        const token = await currentUser.getIdToken();
        const response = await fetch('/.netlify/functions/bot-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'start',
                userId: currentUser.uid
            })
        });
        
        if (response.ok) {
            addToConsole('✓ Bot started successfully', 'success');
            
            // Start simulated activity
            startSimulatedActivity();
            
            // Start uptime counter
            startUptimeCounter(new Date());
            
        } else {
            throw new Error('Failed to start bot');
        }
    } catch (error) {
        addToConsole(`Error starting bot: ${error.message}`, 'error');
        updateBotStatus('error');
    }
}

// Stop Bot
async function stopBot() {
    addToConsole('Stopping bot...', 'warning');
    updateBotStatus('stopped');
    
    try {
        // Call bot-control function
        const token = await currentUser.getIdToken();
        const response = await fetch('/.netlify/functions/bot-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'stop',
                userId: currentUser.uid
            })
        });
        
        if (response.ok) {
            addToConsole('✓ Bot stopped', 'info');
            
            // Stop simulated activity
            stopSimulatedActivity();
            
            // Stop uptime counter
            stopUptimeCounter();
            
        } else {
            throw new Error('Failed to stop bot');
        }
    } catch (error) {
        addToConsole(`Error stopping bot: ${error.message}`, 'error');
    }
}

// Update Files
async function updateFiles() {
    if (!botFiles.bot && !botFiles.req) {
        addToConsole('Error: No files to update', 'error');
        return;
    }
    
    addToConsole('Updating bot files...', 'info');
    
    try {
        await firebase.updateDoc(firebase.doc(db, 'users', currentUser.uid), {
            botFiles: botFiles
        });
        
        addToConsole('✓ Files updated successfully', 'success');
    } catch (error) {
        addToConsole(`Error updating files: ${error.message}`, 'error');
    }
}

// Update Bot Status
function updateBotStatus(status) {
    botStatus = status;
    
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    const statusDisplay = document.getElementById('status-display');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const deployBtn = document.getElementById('deploy-btn');
    
    if (statusContainer) {
        const dot = statusContainer.querySelector('.status-dot');
        dot.className = 'status-dot';
        dot.classList.add(`status-${status}`);
        
        const statusLabels = {
            'running': 'Running',
            'stopped': 'Stopped', 
            'error': 'Error',
            'deploying': 'Deploying...'
        };
        
        statusText.textContent = statusLabels[status] || status;
    }
    
    if (statusDisplay) {
        statusDisplay.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    // Update button states
    if (startBtn) startBtn.disabled = status === 'running';
    if (stopBtn) stopBtn.disabled = status !== 'running';
    if (deployBtn) deployBtn.disabled = status === 'deploying';
}

// Update Bot URL Display
function updateBotUrlDisplay(url) {
    const urlDisplay = document.getElementById('url-display');
    const botUrl = document.getElementById('bot-url');
    const botUrlText = document.getElementById('bot-url-text');
    const noUrlMessage = document.getElementById('no-url-message');
    
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

// Start Uptime Counter
function startUptimeCounter(startTime) {
    if (uptimeStart) return;
    
    uptimeStart = startTime instanceof Date ? startTime : new Date(startTime);
    
    // Update every minute
    const updateUptime = () => {
        if (botStatus !== 'running') {
            clearInterval(uptimeInterval);
            uptimeStart = null;
            return;
        }
        
        const now = new Date();
        const diff = now - uptimeStart;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        let uptimeText = '';
        if (hours > 0) {
            uptimeText = `${hours}h ${remainingMinutes}m`;
        } else {
            uptimeText = `${minutes}m`;
        }
        
        document.getElementById('uptime').textContent = uptimeText;
    };
    
    const uptimeInterval = setInterval(updateUptime, 60000);
    updateUptime(); // Initial update
}

// Stop Uptime Counter
function stopUptimeCounter() {
    uptimeStart = null;
    document.getElementById('uptime').textContent = '0 minutes';
}

// Start Simulated Activity
function startSimulatedActivity() {
    // Clear existing interval
    if (activityInterval) {
        clearInterval(activityInterval);
    }
    
    // Start new activity simulation
    activityInterval = setInterval(() => {
        if (botStatus !== 'running') {
            clearInterval(activityInterval);
            return;
        }
        
        // Simulate random bot activities
        const activities = [
            { message: 'Processing data...', type: 'info' },
            { message: 'Task completed successfully', type: 'success' },
            { message: 'Fetching latest data...', type: 'info' },
            { message: 'Database updated', type: 'info' },
            { message: 'API call successful', type: 'success' },
            { message: 'Memory usage: 45MB', type: 'info' }
        ];
        
        const activity = activities[Math.floor(Math.random() * activities.length)];
        addToConsole(activity.message, activity.type);
        
    }, 5000); // Every 5 seconds
}

// Stop Simulated Activity
function stopSimulatedActivity() {
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
    }
}

// Add to Console
function addToConsole(message, type = 'info') {
    const consoleEl = document.getElementById('console');
    if (!consoleEl) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `console-log log-${type}`;
    logLine.textContent = `[${timestamp}] ${message}`;
    
    consoleEl.appendChild(logLine);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Clear Console
function clearConsole() {
    const consoleEl = document.getElementById('console');
    if (consoleEl) {
        consoleEl.innerHTML = `
            <div class="console-log log-info">[System] Console cleared at ${new Date().toLocaleTimeString()}</div>
            <div class="console-log log-info">[System] Ready for new logs</div>
        `;
    }
}

// Refresh Logs
function refreshLogs() {
    addToConsole('Refreshing logs...', 'info');
}

// Setup Realtime Listeners
function setupRealtimeListeners() {
    if (!currentUser) return;
    
    // Listen for user data changes
    firebase.onSnapshot(firebase.doc(db, 'users', currentUser.uid), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            userData = data;
            
            // Update status if changed
            if (data.botState && data.botState !== botStatus) {
                updateBotStatus(data.botState);
            }
            
            // Update bot files if changed
            if (data.botFiles) {
                botFiles = data.botFiles;
                updateFileDisplays();
            }
            
            // Update balance
            const balanceEl = document.getElementById('balance');
            if (balanceEl && data.balance) {
                balanceEl.textContent = data.balance.toFixed(2);
            }
            
            // Update last deployed
            const lastDeployedEl = document.getElementById('last-deployed');
            if (lastDeployedEl && data.lastDeployed) {
                const date = data.lastDeployed.toDate ? 
                    data.lastDeployed.toDate() : 
                    new Date(data.lastDeployed.seconds * 1000);
                lastDeployedEl.textContent = date.toLocaleString();
            }
            
            // Update bot URL
            if (data.netlifyUrl) {
                updateBotUrlDisplay(data.netlifyUrl);
            }
        }
    });
}

// Make functions globally available
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.handleLogout = handleLogout;
window.deployToNetlify = deployToNetlify;
window.startBot = startBot;
window.stopBot = stopBot;
window.updateFiles = updateFiles;
window.clearConsole = clearConsole;
window.refreshLogs = refreshLogs;
window.addToConsole = addToConsole;
