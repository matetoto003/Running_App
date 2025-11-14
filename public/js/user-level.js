// User Level System - Simple Color Management
let userLevelColor = '#007bff';

// Fetch and apply user level color
async function loadUserLevel() {
    try {
        const response = await fetch('/api/user-level?t=' + Date.now(), {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            userLevelColor = data.color;
            // Update the CSS variable
            document.documentElement.style.setProperty('--level-color', userLevelColor);
            console.log(`Level: ${data.level} - Color: ${userLevelColor}`);
        }
    } catch (error) {
        console.error('Error loading user level:', error);
    }
}

// Load immediately (before DOMContentLoaded)
loadUserLevel();

// Load on page load as well
document.addEventListener('DOMContentLoaded', () => {
    loadUserLevel();
    // Check every 30 seconds for level changes
    setInterval(loadUserLevel, 30000);
});

