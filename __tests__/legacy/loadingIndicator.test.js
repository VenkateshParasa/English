/**
 * Unit Tests for LoadingIndicator System
 * Tests loading overlay display, operation tracking, and state management
 */

describe('LoadingIndicator System', () => {
    let LoadingIndicator;

    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';

        // Set up LoadingIndicator object
        LoadingIndicator = {
            overlay: null,
            activeOperations: new Set(),

            init() {
                if (!this.overlay) {
                    this.overlay = document.createElement('div');
                    this.overlay.id = 'loadingOverlay';
                    this.overlay.className = 'loading-overlay';
                    this.overlay.setAttribute('role', 'status');
                    this.overlay.setAttribute('aria-live', 'polite');
                    this.overlay.innerHTML = `
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                            <span class="loading-text">Loading...</span>
                        </div>
                    `;
                    document.body.appendChild(this.overlay);
                }
            },

            show(operationId = 'default', message = 'Loading...') {
                this.init();
                this.activeOperations.add(operationId);

                const loadingText = this.overlay.querySelector('.loading-text');
                if (loadingText) {
                    loadingText.textContent = message;
                }

                this.overlay.classList.add('loading-show');
                this.overlay.setAttribute('aria-busy', 'true');
            },

            hide(operationId = 'default') {
                this.activeOperations.delete(operationId);

                if (this.activeOperations.size === 0 && this.overlay) {
                    this.overlay.classList.remove('loading-show');
                    this.overlay.setAttribute('aria-busy', 'false');
                }
            },

            isLoading() {
                return this.activeOperations.size > 0;
            }
        };

        // Make LoadingIndicator available globally for tests
        global.LoadingIndicator = LoadingIndicator;
    });

    afterEach(() => {
        if (LoadingIndicator.overlay) {
            LoadingIndicator.overlay.remove();
            LoadingIndicator.overlay = null;
        }
        LoadingIndicator.activeOperations.clear();
    });

    describe('Initialization', () => {
        test('should initialize overlay on first call', () => {
            LoadingIndicator.init();

            expect(LoadingIndicator.overlay).not.toBeNull();
            expect(LoadingIndicator.overlay.id).toBe('loadingOverlay');
            expect(LoadingIndicator.overlay.className).toBe('loading-overlay');
        });

        test('should have proper ARIA attributes', () => {
            LoadingIndicator.init();

            expect(LoadingIndicator.overlay.getAttribute('role')).toBe('status');
            expect(LoadingIndicator.overlay.getAttribute('aria-live')).toBe('polite');
        });

        test('should contain spinner and loading text', () => {
            LoadingIndicator.init();

            const spinner = LoadingIndicator.overlay.querySelector('.spinner');
            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');

            expect(spinner).not.toBeNull();
            expect(loadingText).not.toBeNull();
            expect(loadingText.textContent).toBe('Loading...');
        });

        test('should not create duplicate overlays', () => {
            LoadingIndicator.init();
            LoadingIndicator.init();

            const overlays = document.querySelectorAll('#loadingOverlay');
            expect(overlays.length).toBe(1);
        });

        test('should append overlay to body', () => {
            LoadingIndicator.init();

            expect(document.body.contains(LoadingIndicator.overlay)).toBe(true);
        });
    });

    describe('Show Loading', () => {
        test('should show loading overlay', () => {
            LoadingIndicator.show();

            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(true);
        });

        test('should set aria-busy to true', () => {
            LoadingIndicator.show();

            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('true');
        });

        test('should update loading text with custom message', () => {
            LoadingIndicator.show('default', 'Loading vocabulary...');

            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');
            expect(loadingText.textContent).toBe('Loading vocabulary...');
        });

        test('should add operation to activeOperations', () => {
            LoadingIndicator.show('operation1');

            expect(LoadingIndicator.activeOperations.has('operation1')).toBe(true);
            expect(LoadingIndicator.activeOperations.size).toBe(1);
        });

        test('should handle multiple operations with same ID', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation1');

            // Set should only contain unique values
            expect(LoadingIndicator.activeOperations.size).toBe(1);
        });

        test('should use default operation ID if not specified', () => {
            LoadingIndicator.show();

            expect(LoadingIndicator.activeOperations.has('default')).toBe(true);
        });

        test('should use default message if not specified', () => {
            LoadingIndicator.show('operation1');

            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');
            expect(loadingText.textContent).toBe('Loading...');
        });
    });

    describe('Hide Loading', () => {
        test('should hide loading overlay when no operations are active', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.hide('operation1');

            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(false);
        });

        test('should set aria-busy to false when no operations are active', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.hide('operation1');

            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('false');
        });

        test('should remove operation from activeOperations', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.hide('operation1');

            expect(LoadingIndicator.activeOperations.has('operation1')).toBe(false);
            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });

        test('should keep overlay visible if other operations are active', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation2');
            LoadingIndicator.hide('operation1');

            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(true);
            expect(LoadingIndicator.activeOperations.size).toBe(1);
        });

        test('should use default operation ID if not specified', () => {
            LoadingIndicator.show();
            LoadingIndicator.hide();

            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });

        test('should not throw error when hiding non-existent operation', () => {
            expect(() => {
                LoadingIndicator.hide('non-existent');
            }).not.toThrow();
        });

        test('should handle hiding operation twice', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.hide('operation1');
            LoadingIndicator.hide('operation1');

            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });
    });

    describe('Multiple Operations', () => {
        test('should track multiple concurrent operations', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation2');
            LoadingIndicator.show('operation3');

            expect(LoadingIndicator.activeOperations.size).toBe(3);
            expect(LoadingIndicator.isLoading()).toBe(true);
        });

        test('should keep loading visible until all operations complete', () => {
            LoadingIndicator.show('operation1', 'Loading data 1');
            LoadingIndicator.show('operation2', 'Loading data 2');
            LoadingIndicator.show('operation3', 'Loading data 3');

            LoadingIndicator.hide('operation1');
            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(true);

            LoadingIndicator.hide('operation2');
            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(true);

            LoadingIndicator.hide('operation3');
            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(false);
        });

        test('should update message to last shown operation', () => {
            LoadingIndicator.show('operation1', 'Loading vocabulary...');
            LoadingIndicator.show('operation2', 'Loading sentences...');

            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');
            expect(loadingText.textContent).toBe('Loading sentences...');
        });
    });

    describe('isLoading', () => {
        test('should return false when no operations are active', () => {
            expect(LoadingIndicator.isLoading()).toBe(false);
        });

        test('should return true when operations are active', () => {
            LoadingIndicator.show('operation1');

            expect(LoadingIndicator.isLoading()).toBe(true);
        });

        test('should return false after all operations are hidden', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation2');

            expect(LoadingIndicator.isLoading()).toBe(true);

            LoadingIndicator.hide('operation1');
            expect(LoadingIndicator.isLoading()).toBe(true);

            LoadingIndicator.hide('operation2');
            expect(LoadingIndicator.isLoading()).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty string as operation ID', () => {
            LoadingIndicator.show('');
            expect(LoadingIndicator.activeOperations.has('')).toBe(true);

            LoadingIndicator.hide('');
            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });

        test('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            LoadingIndicator.show('operation1', longMessage);

            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');
            expect(loadingText.textContent).toBe(longMessage);
        });

        test('should handle special characters in message', () => {
            const specialMessage = '!@#$%^&*()_+-={}[]|:";\'<>?,./';
            LoadingIndicator.show('operation1', specialMessage);

            const loadingText = LoadingIndicator.overlay.querySelector('.loading-text');
            expect(loadingText.textContent).toBe(specialMessage);
        });

        test('should handle rapid show/hide calls', () => {
            for (let i = 0; i < 100; i++) {
                LoadingIndicator.show(`operation${i}`);
            }

            expect(LoadingIndicator.activeOperations.size).toBe(100);

            for (let i = 0; i < 100; i++) {
                LoadingIndicator.hide(`operation${i}`);
            }

            expect(LoadingIndicator.activeOperations.size).toBe(0);
            expect(LoadingIndicator.overlay.classList.contains('loading-show')).toBe(false);
        });

        test('should handle hiding before showing', () => {
            expect(() => {
                LoadingIndicator.hide('operation1');
            }).not.toThrow();

            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });
    });

    describe('Accessibility', () => {
        test('overlay should have role=status', () => {
            LoadingIndicator.init();

            expect(LoadingIndicator.overlay.getAttribute('role')).toBe('status');
        });

        test('overlay should have aria-live=polite', () => {
            LoadingIndicator.init();

            expect(LoadingIndicator.overlay.getAttribute('aria-live')).toBe('polite');
        });

        test('should update aria-busy based on loading state', () => {
            LoadingIndicator.show('operation1');
            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('true');

            LoadingIndicator.hide('operation1');
            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('false');
        });

        test('should maintain aria-busy=true with multiple operations', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation2');

            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('true');

            LoadingIndicator.hide('operation1');
            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('true');

            LoadingIndicator.hide('operation2');
            expect(LoadingIndicator.overlay.getAttribute('aria-busy')).toBe('false');
        });
    });

    describe('State Management', () => {
        test('activeOperations should be a Set', () => {
            expect(LoadingIndicator.activeOperations).toBeInstanceOf(Set);
        });

        test('should maintain operation uniqueness', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation1');

            expect(LoadingIndicator.activeOperations.size).toBe(1);
        });

        test('should clear activeOperations on hide', () => {
            LoadingIndicator.show('operation1');
            LoadingIndicator.show('operation2');
            LoadingIndicator.show('operation3');

            expect(LoadingIndicator.activeOperations.size).toBe(3);

            LoadingIndicator.hide('operation1');
            LoadingIndicator.hide('operation2');
            LoadingIndicator.hide('operation3');

            expect(LoadingIndicator.activeOperations.size).toBe(0);
        });
    });

    describe('Integration Scenarios', () => {
        test('should work with async operations', async () => {
            const asyncOperation = async () => {
                LoadingIndicator.show('async1', 'Loading async data...');
                await new Promise(resolve => setTimeout(resolve, 100));
                LoadingIndicator.hide('async1');
            };

            await asyncOperation();

            expect(LoadingIndicator.isLoading()).toBe(false);
        });

        test('should handle overlapping async operations', async () => {
            const operation1 = async () => {
                LoadingIndicator.show('op1');
                await new Promise(resolve => setTimeout(resolve, 100));
                LoadingIndicator.hide('op1');
            };

            const operation2 = async () => {
                LoadingIndicator.show('op2');
                await new Promise(resolve => setTimeout(resolve, 50));
                LoadingIndicator.hide('op2');
            };

            const promise1 = operation1();
            const promise2 = operation2();

            // At this point, both operations should be active
            await Promise.resolve(); // Let microtasks run
            expect(LoadingIndicator.activeOperations.size).toBe(2);

            await Promise.all([promise1, promise2]);

            expect(LoadingIndicator.isLoading()).toBe(false);
        });
    });
});
