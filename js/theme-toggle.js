// Theme Toggle Functionality
(function() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') ||
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    // Apply theme
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Initialize theme
    setTheme(savedTheme);

    // Toggle theme
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
})();