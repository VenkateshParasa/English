// Enhanced UI Micro-interactions
(function() {
    'use strict';

    // Initialize enhanced interactions when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeRippleEffects();
        initializeButtonEnhancements();
        initializeProgressAnimations();
        initializeCounterAnimations();
        initializeSectionTransitions();
    });

    // Add ripple effects to buttons
    function initializeRippleEffects() {
        const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .nav-btn');
        buttons.forEach(button => {
            button.classList.add('ripple');
        });
    }

    // Enhanced button interactions
    function initializeButtonEnhancements() {
        // Add floating effect to primary buttons
        const primaryButtons = document.querySelectorAll('.btn-primary');
        primaryButtons.forEach(button => {
            if (!button.classList.contains('nav-btn')) {
                button.classList.add('floating');
            }
        });

        // Enhanced theme toggle animation
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                this.classList.add('switching');
                setTimeout(() => {
                    this.classList.remove('switching');
                }, 500);
            });
        }

        // Enhanced navigation button clicks
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                navButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
            });
        });

        // Enhanced difficulty button selection
        const difficultyButtons = document.querySelectorAll('.diff-btn');
        difficultyButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from siblings
                const siblings = this.parentElement.querySelectorAll('.diff-btn');
                siblings.forEach(sibling => sibling.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
            });
        });
    }

    // Animate progress bars
    function initializeProgressAnimations() {
        const progressBars = document.querySelectorAll('.progress-fill');
        progressBars.forEach(bar => {
            // Add animated class when progress changes
            const observer = new MutationObserver(() => {
                bar.classList.add('animated');
                setTimeout(() => {
                    bar.classList.remove('animated');
                }, 2000);
            });

            observer.observe(bar, {
                attributes: true,
                attributeFilter: ['style']
            });
        });
    }

    // Animate counter numbers
    function initializeCounterAnimations() {
        function animateCounter(element, target) {
            const start = parseInt(element.textContent) || 0;
            const end = target;
            const duration = 1000;
            const increment = (end - start) / (duration / 16);
            let current = start;

            element.classList.add('counting');

            const timer = setInterval(() => {
                current += increment;
                if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                    current = end;
                    clearInterval(timer);
                    element.classList.remove('counting');
                }
                element.textContent = Math.floor(current);
            }, 16);
        }

        // Watch for changes in stat numbers
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(statNumber => {
            const observer = new MutationObserver(() => {
                const newValue = parseInt(statNumber.textContent);
                if (!isNaN(newValue)) {
                    animateCounter(statNumber, newValue);
                }
            });

            observer.observe(statNumber, {
                childList: true,
                characterData: true,
                subtree: true
            });
        });
    }

    // Enhanced section transitions
    function initializeSectionTransitions() {
        const sections = document.querySelectorAll('.section');

        // Add intersection observer for sections
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('entering');
                    setTimeout(() => {
                        entry.target.classList.remove('entering');
                    }, 500);
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }

    // Enhanced form interactions
    function initializeFormEnhancements() {
        // Enhanced checkbox animations
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    this.classList.add('success');
                    setTimeout(() => {
                        this.classList.remove('success');
                    }, 400);
                }
            });
        });

        // Enhanced input focus states
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });

            input.addEventListener('blur', function() {
                this.parentElement.classList.remove('focused');
            });
        });
    }

    // Utility functions for adding animations
    window.addSuccessAnimation = function(element) {
        element.classList.add('celebrate');
        setTimeout(() => {
            element.classList.remove('celebrate');
        }, 800);
    };

    window.addErrorAnimation = function(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    };

    window.addLoadingState = function(element) {
        element.classList.add('loading');
    };

    window.removeLoadingState = function(element) {
        element.classList.remove('loading');
    };

    // Initialize form enhancements when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', initializeFormEnhancements);
})();