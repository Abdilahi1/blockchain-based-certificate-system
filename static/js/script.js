// Global Configuration
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:5000',
    MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB
    ALLOWED_FILE_TYPES: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'],
    TOAST_DURATION: 5000,
    CREDENTIAL_ID_PATTERN: /^[a-fA-F0-9]{64}$/,
    WITH_CREDENTIALS: true
};

// Global State
let currentUser = null;
let userCredentials = {
    issued: [],
    owned: []
};

// UTILITY FUNCTIONS

// Helper function for authenticated requests
async function makeAuthenticatedRequest(url, options = {}) {
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    return fetch(url, { ...defaultOptions, ...options });
}

// Check session on page load
async function checkSession() {
    try {
        const response = await makeAuthenticatedRequest(`${CONFIG.API_BASE_URL}/check-session`);
        const data = await response.json();
        
        if (data.logged_in) {
            currentUser = data;
            updateUserInterface();
            showPage('dashboardPage');
            console.log('✅ User session restored:', data.username);
        } else {
            showPage('loginRegisterPage');
            console.log('ℹ️ No active session found');
        }
    } catch (error) {
        console.error('Session check failed:', error);
        showPage('loginRegisterPage');
    }
}

// Show loading overlay
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    text.textContent = message;
    overlay.classList.add('active');
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('active');
}

// Show toast notification
function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="closeToast(this)">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            closeToast(toast.querySelector('.toast-close'));
        }
    }, duration);
    
    return toast;
}

// Close toast notification
function closeToast(closeBtn) {
    const toast = closeBtn.closest('.toast');
    toast.style.animation = 'slideInRight 0.3s reverse';
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Show modal
function showModal(modalId, data = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Populate modal with data if provided
    if (data.title) {
        const title = modal.querySelector('.modal-header h3, #successTitle');
        if (title) title.textContent = data.title;
    }
    
    if (data.message) {
        const message = modal.querySelector('#successMessage, #errorMessage');
        if (message) message.textContent = data.message;
    }
    
    if (data.details) {
        const details = modal.querySelector('#successDetails');
        if (details) details.innerHTML = data.details;
    }
    
    modal.classList.add('active');
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modalId);
        }
    });
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Copy to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success', 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate blockchain address
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get user initials
function getUserInitials(username) {
    return username.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// PAGE NAVIGATION

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page-specific data
        switch (pageId) {
            case 'dashboardPage':
                loadDashboardData();
                break;
            case 'credentialsPage':
                loadUserCredentials();
                break;
            case 'userProfilePage':
                loadUserProfile();
                break;
        }
    }
}

// AUTHENTICATION

// Switch between login and register forms
function switchToLogin() {
    document.getElementById('loginToggle').classList.add('active');
    document.getElementById('registerToggle').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
}

function switchToRegister() {
    document.getElementById('registerToggle').classList.add('active');
    document.getElementById('loginToggle').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.parentNode.querySelector('.password-toggle');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.innerHTML = '<img src="/static/images/hide.png" alt="hide" width="20">';

    } else {
        input.type = 'password';
        toggle.innerHTML = '<img src="/static/images/view.png" alt="eye" width="20">';

    }
}

// Check password strength
function checkPasswordStrength(password) {
    const strength = {
        score: 0,
        feedback: 'Password Strength'
    };
    
    if (password.length >= 8) strength.score += 1;
    if (/[a-z]/.test(password)) strength.score += 1;
    if (/[A-Z]/.test(password)) strength.score += 1;
    if (/[0-9]/.test(password)) strength.score += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength.score += 1;
    
    const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const classes = ['', 'weak', 'fair', 'good', 'strong'];
    
    strength.feedback = levels[strength.score] || 'Very Weak';
    strength.class = classes[strength.score] || '';
    
    return strength;
}

// Update password strength indicator
function updatePasswordStrength() {
    const password = document.getElementById('registerPassword').value;
    const strengthFill = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthFill || !strengthText) return;
    
    const strength = checkPasswordStrength(password);
    
    strengthFill.className = `strength-fill ${strength.class}`;
    strengthText.textContent = strength.feedback;
}

// Register new user
async function register() {
    try {
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim().toLowerCase();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validation
        if (!username || !email || !password) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        
        if (password.length < 8) {
            showToast('Password must be at least 8 characters long', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        showLoading('Creating your account...');
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Account created successfully!', 'success');
            
            // Show success modal with details
            showModal('successModal', {
                title: 'Welcome to Blockchain Credentials!',
                message: 'Your account has been created successfully.',
                details: `
                    <div class="success-details">
                        <p><strong>Username:</strong> ${data.username}</p>
                        <p><strong>Email:</strong> ${data.email}</p>
                        <p><strong>Blockchain Address:</strong> ${data.blockchain_address}</p>
                    </div>
                `
            });
            
            // Auto-login after successful registration
            setTimeout(() => {
                closeModal('successModal');
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').value = password;
                login();
            }, 3000);
            
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection.', 'error');
    } finally {
        hideLoading();
    }
}

// Login user
async function login() {
    try {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!username || !password) {
            showToast('Please enter username and password', 'error');
            return;
        }
        
        showLoading('Signing you in...');
        
        const response = await makeAuthenticatedRequest(`${CONFIG.API_BASE_URL}/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data;
            updateUserInterface();
            showPage('dashboardPage');
            showToast(`Welcome back, ${data.username}!`, 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please check your connection.', 'error');
    } finally {
        hideLoading();
    }
}

// Update user interface with current user data
function updateUserInterface() {
    if (!currentUser) return;
    
    const initials = getUserInitials(currentUser.username);
    
    // Update dashboard
    document.getElementById('dashboardTitle').textContent = `Welcome, ${currentUser.username}`;
    document.getElementById('userDisplayName').textContent = currentUser.username;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userInitials').textContent = initials;
    
    // Update profile page
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileAddress').textContent = currentUser.address;
    document.getElementById('profileInitials').textContent = initials;
}

// Logout user
async function logout() {
    try {
        await makeAuthenticatedRequest(`${CONFIG.API_BASE_URL}/logout`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    currentUser = null;
    userCredentials = { issued: [], owned: [] };
    
    // Clear forms and UI
    document.querySelectorAll('input').forEach(input => input.value = '');
    document.querySelectorAll('.result-card').forEach(card => card.style.display = 'none');
    
    closeUserMenu();
    showPage('loginRegisterPage');
    showToast('You have been logged out', 'info');
}

// USER DROPDOWN MENU

function toggleUserMenu() {
    const dropdown = document.querySelector('.user-dropdown');
    const menu = document.getElementById('userMenu');
    
    if (dropdown.classList.contains('open')) {
        closeUserMenu();
    } else {
        dropdown.classList.add('open');
        menu.classList.add('open');
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 100);
    }
}

function closeUserMenu() {
    const dropdown = document.querySelector('.user-dropdown');
    const menu = document.getElementById('userMenu');
    
    dropdown.classList.remove('open');
    menu.classList.remove('open');
    
    document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(event) {
    const dropdown = document.querySelector('.user-dropdown');
    if (!dropdown.contains(event.target)) {
        closeUserMenu();
    }
}

// FILE UPLOAD AND IPFS

// Initialize file upload
function initializeFileUpload() {
    const uploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('documentFile');
    
    if (!uploadArea || !fileInput) return;
    
    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!uploadArea.contains(e.relatedTarget)) {
            uploadArea.classList.remove('dragover');
        }
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// Handle file upload
async function handleFileUpload(file) {
    try {
        // Validate file
        if (!validateFile(file)) return;
        
        // Show progress
        showUploadProgress();
        
        // Upload to IPFS
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showUploadResult(file.name, data.ipfs_hash);
            showToast('File uploaded to IPFS successfully!', 'success');
        } else {
            throw new Error(data.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('File upload error:', error);
        showToast('File upload failed: ' + error.message, 'error');
        hideUploadProgress();
    }
}

// Validate file
function validateFile(file) {
    // Check file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast(`File size must be less than ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
        return false;
    }
    
    // Check file type
    const extension = file.name.split('.').pop().toLowerCase();
    if (!CONFIG.ALLOWED_FILE_TYPES.includes(extension)) {
        showToast(`File type not supported. Allowed: ${CONFIG.ALLOWED_FILE_TYPES.join(', ')}`, 'error');
        return false;
    }
    
    return true;
}

// Show upload progress
function showUploadProgress() {
    const progress = document.getElementById('uploadProgress');
    const result = document.getElementById('uploadResult');
    
    if (progress) {
        progress.style.display = 'block';
        
        // Animate progress bar
        const fill = progress.querySelector('.progress-fill');
        if (fill) {
            let width = 0;
            const interval = setInterval(() => {
                width += Math.random() * 10;
                if (width >= 90) {
                    clearInterval(interval);
                    width = 90;
                }
                fill.style.width = width + '%';
            }, 100);
        }
    }
    
    if (result) {
        result.style.display = 'none';
    }
}

// Show upload result
function showUploadResult(filename, ipfsHash) {
    const progress = document.getElementById('uploadProgress');
    const result = document.getElementById('uploadResult');
    
    if (progress) {
        // Complete progress bar
        const fill = progress.querySelector('.progress-fill');
        if (fill) fill.style.width = '100%';
        
        setTimeout(() => {
            progress.style.display = 'none';
        }, 1000);
    }
    
    if (result) {
        result.style.display = 'block';
        
        const filename_span = result.querySelector('.result-filename');
        const hash_span = result.querySelector('.result-hash');
        
        if (filename_span) filename_span.textContent = filename;
        if (hash_span) hash_span.textContent = `IPFS: ${ipfsHash}`;
        
        // Store IPFS hash for credential issuance
        window.currentIPFSHash = ipfsHash;
    }
}

function hideUploadProgress() {
    const progress = document.getElementById('uploadProgress');
    if (progress) progress.style.display = 'none';
}

// CREDENTIAL MANAGEMENT

// Issue credential
// Fixed issueCredential function
async function issueCredential() {
    try {
        if (!currentUser) {
            showToast('Please log in first', 'error');
            return;
        }
        
        const recipient = document.getElementById('recipientAddress').value.trim();
        const credentialType = document.getElementById('credentialType').value.trim();
        const ipfsHash = window.currentIPFSHash;
        
        // Validation
        if (!recipient) {
            showToast('Please enter recipient address or email', 'error');
            return;
        }
        
        if (!isValidEmail(recipient) && !isValidAddress(recipient)) {
            showToast('Please enter a valid email address or blockchain address', 'error');
            return;
        }
        
        if (!credentialType) {
            showToast('Please enter credential type', 'error');
            return;
        }
        
        if (!ipfsHash) {
            showToast('Please upload a document first', 'error');
            return;
        }
        
        // Show loading state - safer approach
        const btn = document.querySelector('#issuePage .btn-primary');
        let originalBtnText = '';
        
        if (btn) {
            originalBtnText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Issuing...';
        }
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                issuer: currentUser,
                owner: recipient,
                ipfs_hash: ipfsHash,
                credential_type: credentialType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success result
            const resultCard = document.getElementById('issueResult');
            resultCard.className = 'result-card success';
            resultCard.style.display = 'block';
            
            resultCard.innerHTML = `
                <div class="result-header">
                    <div class="result-icon">✅</div>
                    <h3>Credential Issued Successfully!</h3>
                </div>
                
                <div class="result-details">
                    <div class="detail-row">
                        <span class="detail-label">Credential ID:</span>
                        <span class="detail-value font-mono">${data.credential_id}</span>
                        <button class="copy-btn" onclick="copyText('${data.credential_id}')">📋</button>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Transaction Hash:</span>
                        <span class="detail-value font-mono">${data.transaction_hash}</span>
                        <button class="copy-btn" onclick="copyText('${data.transaction_hash}')">📋</button>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Recipient:</span>
                        <span class="detail-value">${recipient}</span>
                    </div>
                </div>
                
                <div class="result-actions">
                    <button class="btn btn-secondary" onclick="showQRCode('${data.credential_id}', '${data.qr_code}')">
                        📱 Show QR Code
                    </button>
                    <button class="btn btn-secondary" onclick="verifyCredentialById('${data.credential_id}')">
                        ✅ Verify Now
                    </button>
                </div>
            `;
            
            showToast('Credential issued and emails sent!', 'success');
            
            // Clear form
            document.getElementById('recipientAddress').value = '';
            document.getElementById('credentialType').value = '';
            const uploadResult = document.getElementById('uploadResult');
            if (uploadResult) uploadResult.style.display = 'none';
            window.currentIPFSHash = null;
            
        } else {
            throw new Error(data.error || 'Failed to issue credential');
        }
        
    } catch (error) {
        console.error('Issue credential error:', error);
        
        const resultCard = document.getElementById('issueResult');
        if (resultCard) {
            resultCard.className = 'result-card error';
            resultCard.style.display = 'block';
            resultCard.innerHTML = `
                <div class="result-header">
                    <div class="result-icon">❌</div>
                    <h3>Error Issuing Credential</h3>
                </div>
                <p>${error.message}</p>
            `;
        }
        
        showToast('Failed to issue credential: ' + error.message, 'error');
    } finally {
        // Reset button state - safer approach
        const btn = document.querySelector('#issuePage .btn-primary');
        if (btn) {
            btn.disabled = false;
            // Only restore text if we have the original
            if (btn.textContent === 'Issuing...') {
                btn.textContent = 'Issue Credential';
            }
        }
    }
}

// Verify credential
async function verifyCredential() {
    try {
        const credentialId = document.getElementById('credentialId').value.trim();

        if (!credentialId) {
            showToast('Please enter a credential ID', 'error');
            return;
        }

        if (!CONFIG.CREDENTIAL_ID_PATTERN.test(credentialId)) {
            showToast('Please enter a valid credential ID (0x...)', 'error');
            return;
        }

        // Find the button and show loading state
        const btn = document.querySelector('#verifyPage .btn-primary');
        if (btn) {
            const btnText = btn.querySelector('.btn-text');
            const btnSpinner = btn.querySelector('.btn-spinner');
            btn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnSpinner) btnSpinner.style.display = 'inline';
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/verify/${credentialId}`);
        const data = await response.json();

        if (response.ok) {
            // Show success result
            const resultCard = document.getElementById('verifyResult');
            resultCard.className = 'result-card success';
            resultCard.style.display = 'block';
            
            const timestamp = new Date(data.timestamp * 1000);
            
            // Helper function to display name with fallback to address
            const getDisplayName = (name, address) => {
                if (name && name.trim()) {
                    return `${name} <small>(${address.substring(0, 8)}...${address.substring(address.length - 6)})</small>`;
                }
                return address;
            };
            
            resultCard.innerHTML = `
                <div class="result-header">
                    <div class="result-icon">✅</div>
                    <h3>Credential Verified Successfully!</h3>
                </div>
                
                <div class="result-details">
                    <div class="detail-row">
                        <span class="detail-label">Owner:</span>
                        <span class="detail-value">${getDisplayName(data.owner_name, data.owner)}</span>
                        <button class="copy-btn" onclick="copyText('${data.owner}')">📋 Copy</button>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Issuer:</span>
                        <span class="detail-value">${getDisplayName(data.issuer_name, data.issuer)}</span>
                        <button class="copy-btn" onclick="copyText('${data.issuer}')">📋 Copy</button>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Issue Date:</span>
                        <span class="detail-value">${timestamp.toLocaleString()}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Credential ID:</span>
                        <span class="detail-value font-mono">${credentialId}</span>
                        <button class="copy-btn" onclick="copyText('${credentialId}')">📋 Copy</button>
                    </div>

                    <div class="detail-row">
                        <span class="detail-label">IPFS Document:</span>
                        <a href="${data.ipfs_url}" target="_blank" class="detail-link">View Document</a>
                    </div>
                </div>
                
                <div class="result-actions">
                    <button class="btn btn-secondary" onclick="showQRCode('${credentialId}', '${data.qr_code}')">
                        📱 Show QR Code
                    </button>
                </div>
            `;
            
            showToast('Credential verified successfully!', 'success');
        } else {
            throw new Error(data.error || 'Verification failed');
        }
        
    } catch (error) {
        console.error('Verify credential error:', error);
        
        const resultCard = document.getElementById('verifyResult');
        resultCard.className = 'result-card error';
        resultCard.style.display = 'block';
        resultCard.innerHTML = `
            <div class="result-header">
                <div class="result-icon">❌</div>
                <h3>Verification Failed</h3>
            </div>
            <p>${error.message}</p>
        `;
        
        showToast('Verification failed: ' + error.message, 'error');
    } finally {
        // Reset button state
        const btn = document.querySelector('#verifyPage .btn-primary');
        if (btn) {
            btn.disabled = false;
            const btnText = btn.querySelector('.btn-text');
            const btnSpinner = btn.querySelector('.btn-spinner');
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
        }
    }
}

// Verify credential by ID (called from other functions)
function verifyCredentialById(credentialId) {
    document.getElementById('credentialId').value = credentialId;
    showPage('verifyPage');
    setTimeout(() => verifyCredential(), 500);
}

// Copy text to clipboard
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success', 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

// QR CODE FUNCTIONALITY

// Show QR code modal
function showQRCode(credentialId, qrCodeBase64) {
    const modal = document.getElementById('qrModal');
    const image = document.getElementById('qrImage');
    const credIdElement = document.getElementById('qrCredentialId');
    
    if (qrCodeBase64) {
        image.src = `data:image/png;base64,${qrCodeBase64}`;
    } else {
        image.src = `${CONFIG.API_BASE_URL}/qr/${credentialId}`;
    }
    
    credIdElement.textContent = credentialId;
    
    // Update modal title and description for IPFS
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = 'Scan to View Document';
    }
    
    // Update description text if it exists
    const description = modal.querySelector('.qr-description');
    if (description) {
        description.textContent = 'Scan this QR code to directly access the credential document on IPFS';
    }
    
    showModal('qrModal');
}

// Download QR code
function downloadQR() {
    const image = document.getElementById('qrImage');
    const credentialId = document.getElementById('qrCredentialId').textContent;
    
    const link = document.createElement('a');
    link.download = `credential-qr-${credentialId.substring(0, 8)}.png`;
    link.href = image.src;
    link.click();
    
    showToast('QR code downloaded!', 'success');
}

// Share QR code
function shareQR() {
    const credentialId = document.getElementById('qrCredentialId').textContent;
    
    // Since QR now points to IPFS, we should get the IPFS URL for sharing
    // This would require getting the credential data first
    fetch(`${CONFIG.API_BASE_URL}/verify/${credentialId}`)
        .then(response => response.json())
        .then(data => {
            const shareUrl = data.ipfs_url || `https://ipfs.io/ipfs/${data.ipfs_hash}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'Blockchain Credential Document',
                    text: 'View this blockchain credential document',
                    url: shareUrl
                });
            } else {
                copyText(shareUrl);
                showToast('Document URL copied to clipboard!', 'success');
            }
        })
        .catch(error => {
            console.error('Error getting credential data:', error);
            // Fallback to verification URL
            const verifyUrl = `${window.location.origin}/verify/${credentialId}`;
            copyText(verifyUrl);
            showToast('Verification URL copied to clipboard!', 'success');
        });
}

// USER CREDENTIALS MANAGEMENT

// Load user credentials
async function loadUserCredentials() {
    if (!currentUser) return;
    
    try {
        showLoading('Loading your credentials...');
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/user/${currentUser.user_id}/credentials`);
        const data = await response.json();
        
        if (response.ok) {
            userCredentials = data;
            renderCredentials();
            updateCredentialCounts();
        } else {
            throw new Error(data.error || 'Failed to load credentials');
        }
        
    } catch (error) {
        console.error('Load credentials error:', error);
        showToast('Failed to load credentials: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Render credentials in the UI
function renderCredentials() {
    renderIssuedCredentials();
    renderOwnedCredentials();
}

// Render issued credentials
function renderIssuedCredentials() {
    const container = document.getElementById('issuedCredentialsList');
    const credentials = userCredentials.issued || [];
    
    if (credentials.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📄</div>
                <p>No credentials issued yet</p>
                <button class="btn btn-primary" onclick="showPage('issuePage')">Issue Your First Credential</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = credentials.map(cred => `
        <div class="credential-card" data-id="${cred.credential_id}">
            <div class="credential-header">
                <div class="credential-type">${cred.credential_type}</div>
                <div class="credential-status ${cred.status}">${cred.status}</div>
            </div>
            
            <div class="credential-id">${cred.credential_id}</div>
            
            <div class="credential-meta">
                <div class="meta-row">
                    <span class="meta-label">Recipient:</span>
                    <span class="meta-value">${cred.owner}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Issued:</span>
                    <span class="meta-value">${new Date(cred.issued_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="credential-actions">
                <button class="action-btn primary" onclick="showQRCode('${cred.credential_id}', '${cred.qr_code}')">
                    📱 QR
                </button>
                <button class="action-btn secondary" onclick="verifyCredentialById('${cred.credential_id}')">
                    ✅ Verify
                </button>
                <button class="action-btn secondary" onclick="copyText('${cred.credential_id}')">
                    📋 Copy
                </button>
            </div>
        </div>
    `).join('');
}

// Render owned credentials
function renderOwnedCredentials() {
    const container = document.getElementById('ownedCredentialsList');
    const credentials = userCredentials.owned || [];
    
    if (credentials.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏅</div>
                <p>No credentials received yet</p>
                <small>Credentials issued to your email or address will appear here</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = credentials.map(cred => `
        <div class="credential-card" data-id="${cred.credential_id}">
            <div class="credential-header">
                <div class="credential-type">${cred.credential_type}</div>
                <div class="credential-status ${cred.status}">${cred.status}</div>
            </div>
            
            <div class="credential-id">${cred.credential_id}</div>
            
            <div class="credential-meta">
                <div class="meta-row">
                    <span class="meta-label">Issued by:</span>
                    <span class="meta-value">${cred.issuer_name}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Received:</span>
                    <span class="meta-value">${new Date(cred.issued_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="credential-actions">
                <button class="action-btn primary" onclick="showQRCode('${cred.credential_id}', '${cred.qr_code}')">
                    📱 QR
                </button>
                <button class="action-btn secondary" onclick="verifyCredentialById('${cred.credential_id}')">
                    ✅ Verify
                </button>
                <button class="action-btn secondary" onclick="copyText('${cred.credential_id}')">
                    📋 Copy
                </button>
            </div>
        </div>
    `).join('');
}

// Update credential counts
function updateCredentialCounts() {
    const issuedCount = userCredentials.issued ? userCredentials.issued.length : 0;
    const ownedCount = userCredentials.owned ? userCredentials.owned.length : 0;
    
    document.getElementById('issuedCount').textContent = issuedCount;
    document.getElementById('ownedCount').textContent = ownedCount;
    
    // Update dashboard stats
    document.getElementById('totalIssued').textContent = issuedCount;
    document.getElementById('totalOwned').textContent = ownedCount;
}

// View IPFS document
function viewIPFS(ipfsHash) {
    const url = `https://ipfs.io/ipfs/${ipfsHash}`;
    window.open(url, '_blank');
}

// CREDENTIALS SEARCH AND FILTER

// Initialize credential search
function initializeCredentialSearch() {
    const searchInput = document.getElementById('credentialSearch');
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCredentials);
    }
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Apply filter
            filterCredentials();
        });
    });
}

// Filter credentials based on search and tabs
function filterCredentials() {
    const searchTerm = document.getElementById('credentialSearch').value.toLowerCase();
    const activeFilter = document.querySelector('.filter-tab.active').dataset.filter;
    
    const issuedSection = document.querySelector('#issuedCredentialsList').parentElement;
    const ownedSection = document.querySelector('#ownedCredentialsList').parentElement;
    
    // Show/hide sections based on filter
    switch (activeFilter) {
        case 'issued':
            issuedSection.style.display = 'block';
            ownedSection.style.display = 'none';
            break;
        case 'owned':
            issuedSection.style.display = 'none';
            ownedSection.style.display = 'block';
            break;
        default:
            issuedSection.style.display = 'block';
            ownedSection.style.display = 'block';
    }
    
    // Filter credential cards by search term
    if (searchTerm) {
        const cards = document.querySelectorAll('.credential-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    } else {
        // Show all cards
        const cards = document.querySelectorAll('.credential-card');
        cards.forEach(card => {
            card.style.display = 'block';
        });
    }
}

// DASHBOARD DATA

// Load dashboard data
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        // Load user credentials for stats
        await loadUserCredentials();
        
        // Load recent activity (simplified)
        loadRecentActivity();
        
    } catch (error) {
        console.error('Dashboard data error:', error);
    }
}

// Load recent activity from database
async function loadRecentActivity() {
    if (!currentUser) return;
    
    const activityList = document.getElementById('activityList');
    
    try {
        // Fetch recent activities from your backend
        const response = await makeAuthenticatedRequest(`${CONFIG.API_BASE_URL}/user/${currentUser.user_id}/recent-activity`);
        const data = await response.json();
        
        if (response.ok && data.activities && data.activities.length > 0) {
            // Clear existing content
            activityList.innerHTML = '';
            
            // Render activities from database
            data.activities.forEach(activity => {
                const timeAgo = getTimeAgo(activity.performed_at);
                const icon = getActivityIcon(activity.action_type);
                const message = formatActivityMessage(activity);
                
                activityList.innerHTML += `
                    <div class="activity-item">
                        <div class="activity-icon">${icon}</div>
                        <div class="activity-content">
                            <p>${message}</p>
                            <span class="activity-time" data-timestamp="${activity.performed_at}">${timeAgo}</span>
                        </div>
                    </div>
                `;
            });
            
        } else {
            // Fallback to default activity display
            showDefaultActivity();
        }
        
    } catch (error) {
        console.error('Failed to load recent activity:', error);
        // Fallback to default activity display
        showDefaultActivity();
    }
}

// Helper function to get appropriate icon for activity type
function getActivityIcon(actionType) {
    const icons = {
        'issued': '📄',
        'verified': '✅', 
        'revoked': '❌',
        'viewed': '👁️',
        'welcome': '🎉'
    };
    return icons[actionType] || '📋';
}

// Helper function to format activity message based on action type and data
function formatActivityMessage(activity) {
    switch (activity.action_type) {
        case 'issued':
            const recipientDisplay = activity.owner_identifier.includes('@') 
                ? activity.owner_identifier.split('@')[0] 
                : `${activity.owner_identifier.substring(0, 6)}...`;
            return `Issued "${activity.credential_type}" to ${recipientDisplay}`;
            
        case 'verified':
            const credentialPreview = activity.credential_id 
                ? `${activity.credential_id.substring(0, 8)}...`
                : 'credential';
            return `Verified ${credentialPreview} ${activity.verification_result ? 'successfully' : 'failed'}`;
            
        case 'revoked':
            return `Revoked credential: ${activity.credential_id.substring(0, 8)}...`;
            
        case 'viewed':
            return `Viewed credential: ${activity.credential_id.substring(0, 8)}...`;
            
        case 'welcome':
            return activity.notes || 'Welcome to Blockchain Credentials!';
            
        default:
            return activity.notes || 'Activity occurred';
    }
}

// Function to calculate time difference and return human-readable format
function getTimeAgo(timestamp) {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - activityTime) / 1000);
    
    // Less than a minute
    if (diffInSeconds < 60) {
        return 'Just now';
    }
    
    // Less than an hour
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than a day
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    // Less than a week
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    
    // Less than a month
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }
    
    // More than a month - show actual date
    return activityTime.toLocaleDateString();
}

// Fallback function for when no database activities are available
function showDefaultActivity() {
    const activityList = document.getElementById('activityList');
    
    activityList.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon">🎉</div>
            <div class="activity-content">
                <p>Welcome to Blockchain Credentials!</p>
                <span class="activity-time">Just now</span>
            </div>
        </div>
    `;
    
    // Add credential-based activities with real timestamps if available
    const issuedCount = userCredentials.issued ? userCredentials.issued.length : 0;
    const ownedCount = userCredentials.owned ? userCredentials.owned.length : 0;
    
    if (issuedCount > 0) {
        // Get the most recent issued credential timestamp
        const mostRecentIssued = userCredentials.issued[0];
        const timeAgo = mostRecentIssued.issued_at ? getTimeAgo(mostRecentIssued.issued_at) : 'Recently';
        
        activityList.innerHTML += `
            <div class="activity-item">
                <div class="activity-icon">📄</div>
                <div class="activity-content">
                    <p>You have issued ${issuedCount} credential${issuedCount > 1 ? 's' : ''}</p>
                    <span class="activity-time" data-timestamp="${mostRecentIssued.issued_at}">${timeAgo}</span>
                </div>
            </div>
        `;
    }
    
    if (ownedCount > 0) {
        // Get the most recent owned credential timestamp  
        const mostRecentOwned = userCredentials.owned[0];
        const timeAgo = mostRecentOwned.issued_at ? getTimeAgo(mostRecentOwned.issued_at) : 'Recently';
        
        activityList.innerHTML += `
            <div class="activity-item">
                <div class="activity-icon">🏅</div>
                <div class="activity-content">
                    <p>You own ${ownedCount} credential${ownedCount > 1 ? 's' : ''}</p>
                    <span class="activity-time" data-timestamp="${mostRecentOwned.issued_at}">${timeAgo}</span>
                </div>
            </div>
        `;
    }
}

// Function to update timestamps every minute
function updateActivityTimestamps() {
    const timeElements = document.querySelectorAll('.activity-time[data-timestamp]');
    
    timeElements.forEach(element => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            element.textContent = getTimeAgo(timestamp);
        }
    });
}

// Auto-update timestamps every minute
setInterval(updateActivityTimestamps, 60000);

// Function to manually refresh activity list
function refreshActivity() {
    loadRecentActivity();
}

// USER PROFILE

// Load user profile data
function loadUserProfile() {
    if (!currentUser) return;
    
    // Update profile information
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileAddress').textContent = currentUser.address;
    
    // Update profile stats
    const issuedCount = userCredentials.issued ? userCredentials.issued.length : 0;
    const ownedCount = userCredentials.owned ? userCredentials.owned.length : 0;
    
    document.getElementById('profileIssuedCount').textContent = issuedCount;
    document.getElementById('profileOwnedCount').textContent = ownedCount;
    
    // Set join date (would come from API)
    document.getElementById('profileJoinDate').textContent = 'Recently';
    document.getElementById('profileLastLogin').textContent = 'Now';
}

// Edit profile (placeholder)
function editProfile() {
    showToast('Profile editing will be available soon!', 'info');
}

// Change password (placeholder)
function changePassword() {
    showToast('Password change will be available soon!', 'info');
}

// Delete account (placeholder)
function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        showToast('Account deletion will be available soon!', 'warning');
    }
}

// KEYBOARD SHORTCUTS AND ACCESSIBILITY

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape key closes modals
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
            
            // Close user dropdown
            closeUserMenu();
        }
        
        // Enter key on login/register forms
        if (e.key === 'Enter') {
            const activeForm = document.querySelector('.auth-form.active');
            if (activeForm) {
                const isLogin = activeForm.id === 'loginForm';
                if (isLogin) {
                    login();
                } else {
                    register();
                }
            }
        }
        
        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    const searchInput = document.getElementById('credentialSearch');
                    if (searchInput) searchInput.focus();
                    break;
            }
        }
    });
}

// ERROR HANDLING AND VALIDATION

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showToast('An unexpected error occurred', 'error');
});

// Handle fetch errors
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    showToast('Network error occurred', 'error');
});

// INITIALIZATION

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Blockchain Credentials App Initialized');
    
    // Initialize components
    initializeFileUpload();
    initializeCredentialSearch();
    initializeKeyboardShortcuts();
    setupFormEventListeners();
    checkURLParameters();
    addButtonLoadingStates();
    
    // Check if user is already logged in
    checkSession();
});

// Setup form event listeners
function setupFormEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                login();
            }
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                register();
            }
        });
    }
    
    // Password strength checker
    const passwordInput = document.getElementById('registerPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }
    
    // Toggle buttons
    document.getElementById('loginToggle')?.addEventListener('click', switchToLogin);
    document.getElementById('registerToggle')?.addEventListener('click', switchToRegister);
}

// Check URL parameters for direct links
function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const credentialId = urlParams.get('verify');
    
    if (credentialId && CONFIG.CREDENTIAL_ID_PATTERN.test(credentialId)) {
        // Direct verification link
        document.getElementById('credentialId').value = credentialId;
        showPage('verifyPage');
        showToast('Credential ID loaded from URL', 'info');
    }
}

// Add loading states to buttons
function addButtonLoadingStates() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        if (!btn.querySelector('.btn-text') && !btn.querySelector('.btn-spinner')) {
            const text = btn.innerHTML;
            btn.innerHTML = `
                <span class="btn-text">${text}</span>
                <span class="btn-spinner" style="display: none;">⟳</span>
            `;
        }
    });
}

// HELPER FUNCTIONS FOR DEVELOPMENT

// Debug function to check current state
window.debugApp = function() {
    console.log('Current User:', currentUser);
    console.log('User Credentials:', userCredentials);
    console.log('Current IPFS Hash:', window.currentIPFSHash);
};

// Function to simulate demo data (for testing)
window.loadDemoData = function() {
    if (!currentUser) {
        showToast('Please log in first', 'warning');
        return;
    }
    
    userCredentials = {
        issued: [
            {
                credential_id: '0xabc123def456789012345678901234567890abcdef123456789012345678901234',
                owner: 'demo@example.com',
                owner_type: 'email',
                credential_type: 'Demo Certificate',
                issued_at: new Date().toISOString(),
                status: 'active',
                qr_code: 'demo_qr_code_base64'
            }
        ],
        owned: [
            {
                credential_id: '0xdef789abc123456789012345678901234567890def789abc123456789012345678',
                issuer_name: 'Demo University',
                credential_type: 'Demo Diploma',
                issued_at: new Date(Date.now() - 86400000).toISOString(),
                status: 'active',
                qr_code: 'demo_qr_code_base64'
            }
        ]
    };
    
    renderCredentials();
    updateCredentialCounts();
    showToast('Demo data loaded!', 'success');
};

// Export functions for global access
window.showPage = showPage;
window.login = login;
window.register = register;
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.closeUserMenu = closeUserMenu;
window.switchToLogin = switchToLogin;
window.switchToRegister = switchToRegister;
window.togglePassword = togglePassword;
window.issueCredential = issueCredential;
window.verifyCredential = verifyCredential;
window.verifyCredentialById = verifyCredentialById;
window.showQRCode = showQRCode;
window.downloadQR = downloadQR;
window.shareQR = shareQR;
window.showModal = showModal;
window.closeModal = closeModal;
window.copyToClipboard = copyToClipboard;
window.copyText = copyText;
window.viewIPFS = viewIPFS;
window.editProfile = editProfile;
window.changePassword = changePassword;
window.deleteAccount = deleteAccount;

console.log('✅ Blockchain Credentials JavaScript Loaded Successfully!');