// Settings Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const settingsButtons = document.querySelectorAll('#settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettings');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsSections = document.querySelectorAll('.settings-section');

    // Username and Password Display Elements
    const usernameDisplay = document.getElementById('usernameDisplay');
    const passwordDisplay = document.getElementById('passwordDisplay');

    // Username Elements
    const changeUsernameBtn = document.getElementById('changeUsernameBtn');
    const changeUsernameForm = document.getElementById('changeUsernameForm');
    const confirmUsernameBtn = document.getElementById('confirmUsernameBtn');
    const cancelUsernameBtn = document.getElementById('cancelUsernameBtn');
    const newUsernameInput = document.getElementById('newUsername');
    const usernameMessage = document.getElementById('usernameMessage');

    // Password Elements
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordMessage = document.getElementById('passwordMessage');

    // Open Settings Modal
    settingsButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.classList.add('active');
            loadCurrentUsername();
        });
    });

    // Close Settings Modal
    closeBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        resetAllForms();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
            resetAllForms();
        }
    });

    // Tab switching
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs and sections
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsSections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding section
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });

    // Change Username Button - Show Form
    changeUsernameBtn.addEventListener('click', () => {
        changeUsernameForm.classList.remove('hidden');
        changeUsernameBtn.style.display = 'none';
        newUsernameInput.focus();
    });

    // Cancel Username Change
    cancelUsernameBtn.addEventListener('click', () => {
        changeUsernameForm.classList.add('hidden');
        changeUsernameBtn.style.display = 'block';
        newUsernameInput.value = '';
        usernameMessage.textContent = '';
        usernameMessage.className = 'form-message';
    });

    // Confirm Username Change
    confirmUsernameBtn.addEventListener('click', async () => {
        const newUsername = newUsernameInput.value.trim();

        if (!newUsername) {
            showMessage(usernameMessage, 'Username cannot be empty', 'error');
            return;
        }

        if (newUsername.length < 3) {
            showMessage(usernameMessage, 'Username must be at least 3 characters', 'error');
            return;
        }

        try {
            confirmUsernameBtn.disabled = true;
            confirmUsernameBtn.textContent = 'Changing...';

            const response = await fetch('/api/change-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ newUsername })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(usernameMessage, 'Username changed successfully!', 'success');
                usernameDisplay.textContent = newUsername;
                setTimeout(() => {
                    changeUsernameForm.classList.add('hidden');
                    changeUsernameBtn.style.display = 'block';
                    newUsernameInput.value = '';
                    usernameMessage.textContent = '';
                    usernameMessage.className = 'form-message';
                }, 1500);
            } else {
                showMessage(usernameMessage, data.error || 'Failed to change username', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(usernameMessage, 'An error occurred', 'error');
        } finally {
            confirmUsernameBtn.disabled = false;
            confirmUsernameBtn.textContent = 'Confirm';
        }
    });

    // Change Password Button - Show Form
    changePasswordBtn.addEventListener('click', () => {
        changePasswordForm.classList.remove('hidden');
        changePasswordBtn.style.display = 'none';
        currentPasswordInput.focus();
    });

    // Cancel Password Change
    cancelPasswordBtn.addEventListener('click', () => {
        changePasswordForm.classList.add('hidden');
        changePasswordBtn.style.display = 'block';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordMessage.textContent = '';
        passwordMessage.className = 'form-message';
    });

    // Confirm Password Change
    confirmPasswordBtn.addEventListener('click', async () => {
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage(passwordMessage, 'All fields are required', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage(passwordMessage, 'New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showMessage(passwordMessage, 'New password must be at least 6 characters', 'error');
            return;
        }

        try {
            confirmPasswordBtn.disabled = true;
            confirmPasswordBtn.textContent = 'Changing...';

            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(passwordMessage, 'Password changed successfully!', 'success');
                setTimeout(() => {
                    changePasswordForm.classList.add('hidden');
                    changePasswordBtn.style.display = 'block';
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    passwordMessage.textContent = '';
                    passwordMessage.className = 'form-message';
                }, 1500);
            } else {
                showMessage(passwordMessage, data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(passwordMessage, 'An error occurred', 'error');
        } finally {
            confirmPasswordBtn.disabled = false;
            confirmPasswordBtn.textContent = 'Confirm';
        }
    });

    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `form-message ${type}`;
        if (type === 'success') {
            setTimeout(() => {
                element.className = 'form-message';
            }, 3000);
        }
    }

    function resetAllForms() {
        changeUsernameForm.classList.add('hidden');
        changeUsernameBtn.style.display = 'block';
        newUsernameInput.value = '';
        usernameMessage.textContent = '';
        usernameMessage.className = 'form-message';

        changePasswordForm.classList.add('hidden');
        changePasswordBtn.style.display = 'block';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordMessage.textContent = '';
        passwordMessage.className = 'form-message';
    }

    function loadCurrentUsername() {
        const usernameElement = document.querySelector('.username');
        if (usernameElement) {
            usernameDisplay.textContent = usernameElement.textContent;
        }
    }
});
