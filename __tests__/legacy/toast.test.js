/**
 * Unit Tests for Toast Notification System
 * Tests toast creation, display, dismissal, and queue management
 */

describe('Toast Notification System', () => {
    let Toast;
    let mockErrorHandler;

    beforeEach(() => {
        // Clear any existing toast containers
        document.body.innerHTML = '';

        // Mock ErrorHandler
        mockErrorHandler = {
            sanitizeInput: jest.fn((input) => {
                if (typeof input !== 'string') return input;
                return input.replace(/[<>]/g, '').trim();
            })
        };

        // Set up Toast object
        Toast = {
            container: null,
            queue: [],
            activeToasts: [],
            maxToasts: 3,

            init() {
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = 'toastContainer';
                    this.container.className = 'toast-container';
                    this.container.setAttribute('role', 'region');
                    this.container.setAttribute('aria-label', 'Notifications');
                    this.container.setAttribute('aria-live', 'polite');
                    document.body.appendChild(this.container);
                }
            },

            show(message, type = 'info', duration = 4000) {
                this.init();

                const toast = {
                    id: Date.now() + Math.random(),
                    message: mockErrorHandler.sanitizeInput(message),
                    type,
                    duration
                };

                if (this.activeToasts.length >= this.maxToasts) {
                    this.queue.push(toast);
                    return;
                }

                this.displayToast(toast);
            },

            displayToast(toast) {
                const toastEl = document.createElement('div');
                toastEl.className = `toast toast-${toast.type}`;
                toastEl.setAttribute('role', 'alert');
                toastEl.setAttribute('aria-atomic', 'true');
                toastEl.dataset.toastId = toast.id;

                const icons = {
                    success: '✓',
                    error: '✗',
                    warning: '⚠',
                    info: 'ℹ'
                };

                toastEl.innerHTML = `
                    <span class="toast-icon">${icons[toast.type] || icons.info}</span>
                    <span class="toast-message">${toast.message}</span>
                    <button class="toast-close" aria-label="Close notification">×</button>
                `;

                const closeBtn = toastEl.querySelector('.toast-close');
                closeBtn.onclick = () => this.dismiss(toast.id);

                this.container.appendChild(toastEl);
                this.activeToasts.push(toast.id);

                setTimeout(() => toastEl.classList.add('toast-show'), 10);

                if (toast.duration > 0) {
                    setTimeout(() => this.dismiss(toast.id), toast.duration);
                }
            },

            dismiss(toastId) {
                const toastEl = this.container.querySelector(`[data-toast-id="${toastId}"]`);
                if (toastEl) {
                    toastEl.classList.remove('toast-show');
                    toastEl.classList.add('toast-hide');

                    setTimeout(() => {
                        toastEl.remove();
                        this.activeToasts = this.activeToasts.filter(id => id !== toastId);

                        if (this.queue.length > 0) {
                            const nextToast = this.queue.shift();
                            this.displayToast(nextToast);
                        }
                    }, 300);
                }
            },

            success(message, duration) {
                this.show(message, 'success', duration);
            },

            error(message, duration) {
                this.show(message, 'error', duration);
            },

            warning(message, duration) {
                this.show(message, 'warning', duration);
            },

            info(message, duration) {
                this.show(message, 'info', duration);
            },

            clearAll() {
                this.activeToasts.forEach(id => this.dismiss(id));
                this.queue = [];
            }
        };

        // Make Toast available globally for tests
        global.Toast = Toast;
    });

    afterEach(() => {
        Toast.clearAll();
        if (Toast.container) {
            Toast.container.remove();
            Toast.container = null;
        }
        jest.clearAllTimers();
    });

    describe('Initialization', () => {
        test('should initialize container on first call', () => {
            Toast.init();

            expect(Toast.container).not.toBeNull();
            expect(Toast.container.id).toBe('toastContainer');
            expect(Toast.container.className).toBe('toast-container');
        });

        test('should have proper ARIA attributes', () => {
            Toast.init();

            expect(Toast.container.getAttribute('role')).toBe('region');
            expect(Toast.container.getAttribute('aria-label')).toBe('Notifications');
            expect(Toast.container.getAttribute('aria-live')).toBe('polite');
        });

        test('should not create duplicate containers', () => {
            Toast.init();
            Toast.init();

            const containers = document.querySelectorAll('#toastContainer');
            expect(containers.length).toBe(1);
        });

        test('should append container to body', () => {
            Toast.init();

            expect(document.body.contains(Toast.container)).toBe(true);
        });
    });

    describe('Toast Display', () => {
        test('should display a toast with correct structure', () => {
            Toast.show('Test message', 'info');

            const toast = document.querySelector('.toast');
            expect(toast).not.toBeNull();
            expect(toast.className).toContain('toast-info');
        });

        test('should include icon, message, and close button', () => {
            Toast.show('Test message', 'success');

            const icon = document.querySelector('.toast-icon');
            const message = document.querySelector('.toast-message');
            const closeBtn = document.querySelector('.toast-close');

            expect(icon).not.toBeNull();
            expect(icon.textContent).toBe('✓');
            expect(message.textContent).toBe('Test message');
            expect(closeBtn).not.toBeNull();
        });

        test('should have proper ARIA attributes on toast', () => {
            Toast.show('Test message', 'info');

            const toast = document.querySelector('.toast');
            expect(toast.getAttribute('role')).toBe('alert');
            expect(toast.getAttribute('aria-atomic')).toBe('true');
        });

        test('should use correct icons for different types', () => {
            const types = [
                { type: 'success', icon: '✓' },
                { type: 'error', icon: '✗' },
                { type: 'warning', icon: '⚠' },
                { type: 'info', icon: 'ℹ' }
            ];

            types.forEach(({ type, icon }) => {
                // Clear all previous toasts
                Toast.clearAll();
                if (Toast.container) {
                    Toast.container.innerHTML = '';
                }
                Toast.activeToasts = [];

                // Show new toast
                Toast.show('Test', type);

                const toastIcon = document.querySelector('.toast-icon');
                expect(toastIcon).not.toBeNull();
                expect(toastIcon.textContent).toBe(icon);
            });
        });

        test('should sanitize message content', () => {
            Toast.show('<script>alert("xss")</script>Hello', 'info');

            const message = document.querySelector('.toast-message');
            expect(message.textContent).not.toContain('<script>');
            expect(mockErrorHandler.sanitizeInput).toHaveBeenCalled();
        });
    });

    describe('Toast Shorthand Methods', () => {
        test('success() should create success toast', () => {
            Toast.success('Success message');

            const toast = document.querySelector('.toast-success');
            expect(toast).not.toBeNull();
        });

        test('error() should create error toast', () => {
            Toast.error('Error message');

            const toast = document.querySelector('.toast-error');
            expect(toast).not.toBeNull();
        });

        test('warning() should create warning toast', () => {
            Toast.warning('Warning message');

            const toast = document.querySelector('.toast-warning');
            expect(toast).not.toBeNull();
        });

        test('info() should create info toast', () => {
            Toast.info('Info message');

            const toast = document.querySelector('.toast-info');
            expect(toast).not.toBeNull();
        });
    });

    describe('Toast Dismissal', () => {
        test('should dismiss toast when close button is clicked', () => {
            jest.useFakeTimers();
            Toast.show('Test message', 'info');

            const closeBtn = document.querySelector('.toast-close');
            closeBtn.click();

            jest.advanceTimersByTime(300);

            const toast = document.querySelector('.toast');
            expect(toast).toBeNull();
            jest.useRealTimers();
        });

        test('should auto-dismiss after specified duration', () => {
            jest.useFakeTimers();
            Toast.show('Test message', 'info', 1000);

            expect(document.querySelector('.toast')).not.toBeNull();

            jest.advanceTimersByTime(1000);

            jest.advanceTimersByTime(300); // animation duration

            expect(document.querySelector('.toast')).toBeNull();
            jest.useRealTimers();
        });

        test('should not auto-dismiss if duration is 0', () => {
            jest.useFakeTimers();
            Toast.show('Test message', 'info', 0);

            jest.advanceTimersByTime(10000);

            expect(document.querySelector('.toast')).not.toBeNull();
            jest.useRealTimers();
        });

        test('should remove toast from activeToasts array', () => {
            jest.useFakeTimers();
            Toast.show('Test message', 'info');

            expect(Toast.activeToasts.length).toBe(1);

            const toastId = Toast.activeToasts[0];
            Toast.dismiss(toastId);

            jest.advanceTimersByTime(300);

            expect(Toast.activeToasts.length).toBe(0);
            jest.useRealTimers();
        });
    });

    describe('Queue Management', () => {
        test('should queue toasts when max limit is reached', () => {
            Toast.show('Toast 1', 'info');
            Toast.show('Toast 2', 'info');
            Toast.show('Toast 3', 'info');
            Toast.show('Toast 4', 'info'); // Should be queued

            expect(Toast.activeToasts.length).toBe(3);
            expect(Toast.queue.length).toBe(1);
        });

        test('should display queued toast after one is dismissed', () => {
            jest.useFakeTimers();

            Toast.show('Toast 1', 'info');
            Toast.show('Toast 2', 'info');
            Toast.show('Toast 3', 'info');
            Toast.show('Toast 4', 'info'); // Queued

            const firstToastId = Toast.activeToasts[0];
            Toast.dismiss(firstToastId);

            jest.advanceTimersByTime(300);

            expect(Toast.activeToasts.length).toBe(3);
            expect(Toast.queue.length).toBe(0);

            jest.useRealTimers();
        });

        test('should respect maxToasts limit', () => {
            for (let i = 0; i < 10; i++) {
                Toast.show(`Toast ${i}`, 'info');
            }

            expect(Toast.activeToasts.length).toBe(3);
            expect(Toast.queue.length).toBe(7);
        });
    });

    describe('clearAll', () => {
        test('should dismiss all active toasts', () => {
            jest.useFakeTimers();

            Toast.show('Toast 1', 'info');
            Toast.show('Toast 2', 'info');
            Toast.show('Toast 3', 'info');

            expect(Toast.activeToasts.length).toBe(3);

            Toast.clearAll();

            jest.advanceTimersByTime(300);

            expect(Toast.activeToasts.length).toBe(0);
            expect(document.querySelectorAll('.toast').length).toBe(0);

            jest.useRealTimers();
        });

        test('should clear the queue', () => {
            Toast.show('Toast 1', 'info');
            Toast.show('Toast 2', 'info');
            Toast.show('Toast 3', 'info');
            Toast.show('Toast 4', 'info');
            Toast.show('Toast 5', 'info');

            expect(Toast.queue.length).toBe(2);

            Toast.clearAll();

            expect(Toast.queue.length).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty message', () => {
            Toast.show('', 'info');

            const message = document.querySelector('.toast-message');
            expect(message.textContent).toBe('');
        });

        test('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            Toast.show(longMessage, 'info');

            const message = document.querySelector('.toast-message');
            expect(message.textContent.length).toBe(1000);
        });

        test('should handle special characters in message', () => {
            const specialMessage = '!@#$%^&*()_+-={}[]|:";\'<>?,./';
            Toast.show(specialMessage, 'info');

            const message = document.querySelector('.toast-message');
            // After sanitization, < and > should be removed
            expect(message.textContent).not.toContain('<');
            expect(message.textContent).not.toContain('>');
        });

        test('should handle rapid consecutive calls', () => {
            for (let i = 0; i < 20; i++) {
                Toast.show(`Toast ${i}`, 'info');
            }

            expect(Toast.activeToasts.length).toBe(3);
            expect(Toast.queue.length).toBe(17);
        });

        test('should handle dismissing non-existent toast', () => {
            // Ensure container exists
            Toast.init();

            expect(() => {
                Toast.dismiss('non-existent-id');
            }).not.toThrow();
        });
    });

    describe('Accessibility', () => {
        test('close button should have aria-label', () => {
            Toast.show('Test message', 'info');

            const closeBtn = document.querySelector('.toast-close');
            expect(closeBtn.getAttribute('aria-label')).toBe('Close notification');
        });

        test('container should have aria-live=polite', () => {
            Toast.init();

            expect(Toast.container.getAttribute('aria-live')).toBe('polite');
        });

        test('toast should have role=alert', () => {
            Toast.show('Test message', 'info');

            const toast = document.querySelector('.toast');
            expect(toast.getAttribute('role')).toBe('alert');
        });

        test('toast should have aria-atomic=true', () => {
            Toast.show('Test message', 'info');

            const toast = document.querySelector('.toast');
            expect(toast.getAttribute('aria-atomic')).toBe('true');
        });
    });
});
