// Theme Toggle Functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;
    const body = document.body;

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.checked = true;
        }
    }

    // Theme toggle change event
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }
});
