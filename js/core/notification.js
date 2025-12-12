/**
 * Notification System
 * Provides toast notifications, loading states, and user feedback
 */

class NotificationManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 3000;
        this.init();
    }

    /**
     * Initialize notification container
     */
    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }

        // Create screen reader announcer
        if (!document.getElementById('sr-announcer')) {
            const announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.className = 'sr-only';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: success, error, warning, info
     * @param {number} duration - Duration in milliseconds
     * @param {Object} options - Additional options
     */
    show(message, type = 'info', duration = this.defaultDuration, options = {}) {
        const {
            dismissible = true,
            action = null,
            position = 'top-right'
        } = options;

        // Limit number of toasts
        if (this.toasts.length >= this.maxToasts) {
            this.dismiss(this.toasts[0].id);
        }

        const toast = this.createToast(message, type, dismissible, action);
        const container = document.getElementById('toast-container');
        container.appendChild(toast.element);

        // Add to tracking
        this.toasts.push(toast);

        // Announce to screen readers
        this.announce(message);

        // Show animation
        setTimeout(() => toast.element.classList.add('show'), 10);

        // Auto-dismiss if duration is set
        if (duration > 0) {
            toast.timeout = setTimeout(() => this.dismiss(toast.id), duration);
        }

        return toast.id;
    }

    /**
     * Create toast element
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {boolean} dismissible - Can be dismissed
     * @param {Object} action - Action button config
     * @returns {Object} Toast object
     */
    createToast(message, type, dismissible, action) {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        const icon = this.getIcon(type);
        
        let html = `
            <div class="toast-content">
                <span class="toast-icon" aria-hidden="true">${icon}</span>
                <span class="toast-message">${this.escapeHTML(message)}</span>
            </div>
        `;

        if (action) {
            html += `
                <button class="toast-action" data-toast-id="${id}">
                    ${this.escapeHTML(action.label)}
                </button>
            `;
        }

        if (dismissible) {
            html += `
                <button class="toast-close" aria-label="Close notification" data-toast-id="${id}">
                    <span aria-hidden="true">×</span>
                </button>
            `;
        }

        toast.innerHTML = html;

        // Add event listeners
        if (dismissible) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => this.dismiss(id));
        }

        if (action) {
            const actionBtn = toast.querySelector('.toast-action');
            actionBtn.addEventListener('click', () => {
                action.callback();
                this.dismiss(id);
            });
        }

        return {
            id,
            element: toast,
            timeout: null
        };
    }

    /**
     * Dismiss toast
     * @param {string} id - Toast ID
     */
    dismiss(id) {
        const toastIndex = this.toasts.findIndex(t => t.id === id);
        if (toastIndex === -1) return;

        const toast = this.toasts[toastIndex];
        
        // Clear timeout
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }

        // Hide animation
        toast.element.classList.remove('show');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
        }, 300);

        // Remove from tracking
        this.toasts.splice(toastIndex, 1);
    }

    /**
     * Dismiss all toasts
     */
    dismissAll() {
        [...this.toasts].forEach(toast => this.dismiss(toast.id));
    }

    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {number} duration - Duration in milliseconds
     */
    success(message, duration = this.defaultDuration) {
        return this.show(message, 'success', duration);
    }

    /**
     * Show error notification
     * @param {string} message - Error message
     * @param {number} duration - Duration (0 = no auto-dismiss)
     */
    error(message, duration = 0) {
        return this.show(message, 'error', duration);
    }

    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {number} duration - Duration in milliseconds
     */
    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {number} duration - Duration in milliseconds
     */
    info(message, duration = this.defaultDuration) {
        return this.show(message, 'info', duration);
    }

    /**
     * Show loading notification
     * @param {string} message - Loading message
     * @returns {string} Toast ID (use to dismiss when done)
     */
    loading(message = 'Loading...') {
        return this.show(message, 'loading', 0, { dismissible: false });
    }

    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} Icon HTML
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ',
            loading: '⟳'
        };
        return icons[type] || icons.info;
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    announce(message) {
        const announcer = document.getElementById('sr-announcer');
        if (announcer) {
            announcer.textContent = message;
            // Clear after announcement
            setTimeout(() => announcer.textContent = '', 1000);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

/**
 * Loading Manager
 * Manages loading states for async operations
 */
class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
    }

    /**
     * Show loading indicator
     * @param {HTMLElement|string} target - Target element or selector
     * @param {string} message - Loading message
     * @param {Object} options - Loading options
     * @returns {string} Loader ID
     */
    show(target, message = 'Loading...', options = {}) {
        const {
            overlay = true,
            spinner = true,
            blocking = true
        } = options;

        const element = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;

        if (!element) {
            console.warn('Loading target not found:', target);
            return null;
        }

        const id = `loader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const loader = document.createElement('div');
        loader.id = id;
        loader.className = `loader-overlay ${overlay ? 'with-overlay' : ''}`;
        loader.setAttribute('role', 'status');
        loader.setAttribute('aria-live', 'polite');
        loader.setAttribute('aria-busy', 'true');

        let html = '<div class="loader-content">';
        
        if (spinner) {
            html += '<div class="spinner" aria-hidden="true"></div>';
        }
        
        html += `<p class="loader-message">${this.escapeHTML(message)}</p>`;
        html += '</div>';

        loader.innerHTML = html;

        // Make blocking if specified
        if (blocking) {
            loader.style.pointerEvents = 'all';
        }

        element.style.position = 'relative';
        element.appendChild(loader);

        // Track active loader
        this.activeLoaders.set(id, { element, loader });

        return id;
    }

    /**
     * Hide loading indicator
     * @param {string} id - Loader ID
     */
    hide(id) {
        const loaderData = this.activeLoaders.get(id);
        if (!loaderData) return;

        const { loader } = loaderData;
        
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }

        this.activeLoaders.delete(id);
    }

    /**
     * Hide all loaders in target
     * @param {HTMLElement|string} target - Target element or selector
     */
    hideAll(target) {
        const element = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;

        if (!element) return;

        const loaders = element.querySelectorAll('.loader-overlay');
        loaders.forEach(loader => {
            if (loader.parentNode) {
                loader.parentNode.removeChild(loader);
            }
        });

        // Clean up tracking
        this.activeLoaders.forEach((data, id) => {
            if (data.element === element) {
                this.activeLoaders.delete(id);
            }
        });
    }

    /**
     * Update loader message
     * @param {string} id - Loader ID
     * @param {string} message - New message
     */
    updateMessage(id, message) {
        const loaderData = this.activeLoaders.get(id);
        if (!loaderData) return;

        const messageEl = loaderData.loader.querySelector('.loader-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    /**
     * Escape HTML
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

/**
 * Confirmation Dialog Manager
 */
class ConfirmationManager {
    /**
     * Show confirmation dialog
     * @param {Object} options - Dialog options
     * @returns {Promise<boolean>} User's choice
     */
    static async confirm(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'warning'
        } = options;

        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'confirmation-dialog';
            dialog.setAttribute('role', 'alertdialog');
            dialog.setAttribute('aria-labelledby', 'dialog-title');
            dialog.setAttribute('aria-describedby', 'dialog-message');

            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content dialog-${type}">
                    <h3 id="dialog-title">${this.escapeHTML(title)}</h3>
                    <p id="dialog-message">${this.escapeHTML(message)}</p>
                    <div class="dialog-actions">
                        <button class="btn-secondary dialog-cancel" autofocus>
                            ${this.escapeHTML(cancelText)}
                        </button>
                        <button class="btn-primary dialog-confirm">
                            ${this.escapeHTML(confirmText)}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            // Focus trap
            const focusableElements = dialog.querySelectorAll('button');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // Handle keyboard navigation
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    cleanup(false);
                } else if (e.key === 'Tab') {
                    if (e.shiftKey && document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    } else if (!e.shiftKey && document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            });

            const cleanup = (result) => {
                dialog.classList.add('hiding');
                setTimeout(() => {
                    if (dialog.parentNode) {
                        dialog.parentNode.removeChild(dialog);
                    }
                }, 200);
                resolve(result);
            };

            dialog.querySelector('.dialog-confirm').addEventListener('click', () => cleanup(true));
            dialog.querySelector('.dialog-cancel').addEventListener('click', () => cleanup(false));
            dialog.querySelector('.dialog-overlay').addEventListener('click', () => cleanup(false));

            // Show dialog
            setTimeout(() => dialog.classList.add('show'), 10);
            firstElement.focus();
        });
    }

    /**
     * Escape HTML
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    static escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Create global instances
const notificationManager = new NotificationManager();
const loadingManager = new LoadingManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        notificationManager,
        loadingManager,
        NotificationManager,
        LoadingManager,
        ConfirmationManager
    };
}