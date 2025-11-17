// User Level System - Simple Color Management
let userLevelColor = '#007bff';

// Fetch and apply user level color
async function loadUserLevel() {
    try {
        const response = await fetch('/api/user-level?t=' + Date.now(), {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            userLevelColor = data.color;
            // Update the CSS variable
            document.documentElement.style.setProperty('--level-color', userLevelColor);
            console.log(`Level: ${data.level} - Color: ${userLevelColor}`);
        } else if (response.status === 401) {
            // Not authenticated yet, will retry on DOMContentLoaded
            console.log('User not authenticated yet for level');
        } else {
            console.error('Error fetching user level:', response.status);
        }
    } catch (error) {
        console.error('Error loading user level:', error);
    }
}

// Load on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUserLevel();
    // Check every 30 seconds for level changes
    setInterval(loadUserLevel, 30000);
});

