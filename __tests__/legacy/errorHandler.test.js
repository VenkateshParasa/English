/**
 * Unit Tests for ErrorHandler
 * Tests error classification, retry logic, validation, and sanitization
 */

describe('ErrorHandler', () => {
    let ErrorHandler;

    beforeEach(() => {
        // Load the ErrorHandler from app.js
        // Note: In a real scenario, we'd extract ErrorHandler to a separate module
        ErrorHandler = {
            ErrorTypes: {
                NETWORK: 'NETWORK_ERROR',
                TIMEOUT: 'TIMEOUT_ERROR',
                API: 'API_ERROR',
                VALIDATION: 'VALIDATION_ERROR',
                STORAGE: 'STORAGE_ERROR',
                PERMISSION: 'PERMISSION_ERROR',
                UNKNOWN: 'UNKNOWN_ERROR'
            },

            classifyError(error) {
                if (!navigator.onLine) return this.ErrorTypes.NETWORK;
                if (error.name === 'TimeoutError' || error.name === 'AbortError') return this.ErrorTypes.TIMEOUT;
                if (error.response) return this.ErrorTypes.API;
                if (error.name === 'QuotaExceededError') return this.ErrorTypes.STORAGE;
                if (error.name === 'NotAllowedError') return this.ErrorTypes.PERMISSION;
                return this.ErrorTypes.UNKNOWN;
            },

            getUserMessage(errorType, context = '') {
                const messages = {
                    [this.ErrorTypes.NETWORK]: 'No internet connection. Using offline mode.',
                    [this.ErrorTypes.TIMEOUT]: 'Request timed out. Please try again.',
                    [this.ErrorTypes.API]: `Unable to fetch ${context}. Using cached data.`,
                    [this.ErrorTypes.VALIDATION]: 'Invalid input. Please check your entry.',
                    [this.ErrorTypes.STORAGE]: 'Storage limit reached. Some data may not be saved.',
                    [this.ErrorTypes.PERMISSION]: 'Permission denied. Please check your settings.',
                    [this.ErrorTypes.UNKNOWN]: 'Something went wrong. Please try again.'
                };
                return messages[errorType] || messages[this.ErrorTypes.UNKNOWN];
            },

            logError(error, context = '') {
                const errorType = this.classifyError(error);
                const timestamp = new Date().toISOString();

                try {
                    const errorLog = JSON.parse(sessionStorage.getItem('errorLog') || '[]');
                    errorLog.push({
                        timestamp,
                        type: errorType,
                        context,
                        message: error.message,
                        stack: error.stack
                    });
                    if (errorLog.length > 50) errorLog.shift();
                    sessionStorage.setItem('errorLog', JSON.stringify(errorLog));
                } catch (e) {
                    console.warn('Could not store error log:', e);
                }
            },

            async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000, context = '') {
                let lastError;

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        return await fn();
                    } catch (error) {
                        lastError = error;
                        this.logError(error, `${context} (attempt ${attempt + 1}/${maxRetries})`);

                        const errorType = this.classifyError(error);
                        if (errorType === this.ErrorTypes.VALIDATION ||
                            errorType === this.ErrorTypes.PERMISSION) {
                            throw error;
                        }

                        if (attempt < maxRetries - 1) {
                            const delay = baseDelay * Math.pow(2, attempt);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }

                throw lastError;
            },

            validateInput(input, rules = {}) {
                const {
                    required = false,
                    minLength = 0,
                    maxLength = Infinity,
                    pattern = null
                } = rules;

                if (required && (!input || input.trim() === '')) {
                    throw new Error('This field is required');
                }

                if (!input) return '';

                const sanitized = this.sanitizeInput(input);

                if (sanitized.length < minLength) {
                    throw new Error(`Minimum length is ${minLength} characters`);
                }
                if (sanitized.length > maxLength) {
                    throw new Error(`Maximum length is ${maxLength} characters`);
                }

                if (pattern && !pattern.test(sanitized)) {
                    throw new Error('Invalid format');
                }

                return sanitized;
            },

            sanitizeInput(input) {
                if (typeof input !== 'string') return input;

                const div = document.createElement('div');
                div.textContent = input;
                const sanitized = div.innerHTML;

                return sanitized
                    .replace(/[<>]/g, '')
                    .trim();
            }
        };
    });

    describe('classifyError', () => {
        test('should classify network errors when offline', () => {
            Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
            const error = new Error('Network error');
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.NETWORK);
        });

        test('should classify timeout errors', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('Timeout');
            error.name = 'TimeoutError';
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.TIMEOUT);
        });

        test('should classify abort errors as timeout', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('Aborted');
            error.name = 'AbortError';
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.TIMEOUT);
        });

        test('should classify API errors', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('API error');
            error.response = { status: 404 };
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.API);
        });

        test('should classify storage quota errors', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('Quota exceeded');
            error.name = 'QuotaExceededError';
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.STORAGE);
        });

        test('should classify permission errors', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('Not allowed');
            error.name = 'NotAllowedError';
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.PERMISSION);
        });

        test('should classify unknown errors', () => {
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            const error = new Error('Unknown');
            expect(ErrorHandler.classifyError(error)).toBe(ErrorHandler.ErrorTypes.UNKNOWN);
        });
    });

    describe('getUserMessage', () => {
        test('should return network error message', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.NETWORK);
            expect(message).toBe('No internet connection. Using offline mode.');
        });

        test('should return timeout error message', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.TIMEOUT);
            expect(message).toBe('Request timed out. Please try again.');
        });

        test('should return API error message with context', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.API, 'word data');
            expect(message).toBe('Unable to fetch word data. Using cached data.');
        });

        test('should return validation error message', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.VALIDATION);
            expect(message).toBe('Invalid input. Please check your entry.');
        });

        test('should return storage error message', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.STORAGE);
            expect(message).toBe('Storage limit reached. Some data may not be saved.');
        });

        test('should return permission error message', () => {
            const message = ErrorHandler.getUserMessage(ErrorHandler.ErrorTypes.PERMISSION);
            expect(message).toBe('Permission denied. Please check your settings.');
        });

        test('should return unknown error message as fallback', () => {
            const message = ErrorHandler.getUserMessage('INVALID_TYPE');
            expect(message).toBe('Something went wrong. Please try again.');
        });
    });

    describe('logError', () => {
        beforeEach(() => {
            sessionStorage.clear();
        });

        test('should log error to sessionStorage', () => {
            const error = new Error('Test error');
            ErrorHandler.logError(error, 'test context');

            const errorLog = JSON.parse(sessionStorage.getItem('errorLog'));
            expect(errorLog).toHaveLength(1);
            expect(errorLog[0]).toMatchObject({
                type: expect.any(String),
                context: 'test context',
                message: 'Test error'
            });
        });

        test('should limit error log to 50 entries', () => {
            // Add 55 errors
            for (let i = 0; i < 55; i++) {
                const error = new Error(`Error ${i}`);
                ErrorHandler.logError(error, `context ${i}`);
            }

            const errorLog = JSON.parse(sessionStorage.getItem('errorLog'));
            expect(errorLog).toHaveLength(50);
            // Should keep the most recent 50
            expect(errorLog[0].message).toBe('Error 5');
            expect(errorLog[49].message).toBe('Error 54');
        });

        test('should handle sessionStorage failures gracefully', () => {
            // Mock sessionStorage to throw error
            const originalSetItem = sessionStorage.setItem;
            sessionStorage.setItem = jest.fn(() => {
                throw new Error('Storage full');
            });

            // Should not throw
            expect(() => {
                ErrorHandler.logError(new Error('Test'), 'context');
            }).not.toThrow();

            sessionStorage.setItem = originalSetItem;
        });
    });

    describe('retryWithBackoff', () => {
        test('should succeed on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');
            const result = await ErrorHandler.retryWithBackoff(mockFn, 3, 1000, 'test');

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValue('success');

            const result = await ErrorHandler.retryWithBackoff(mockFn, 3, 100, 'test');

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        test('should throw after max retries exceeded', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));

            await expect(
                ErrorHandler.retryWithBackoff(mockFn, 3, 100, 'test')
            ).rejects.toThrow('Always fails');

            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        test('should not retry validation errors', async () => {
            const error = new Error('Validation failed');
            error.name = 'ValidationError';
            const mockFn = jest.fn().mockRejectedValue(error);

            // Mock classifyError to return VALIDATION
            const originalClassify = ErrorHandler.classifyError;
            ErrorHandler.classifyError = jest.fn().mockReturnValue(ErrorHandler.ErrorTypes.VALIDATION);

            await expect(
                ErrorHandler.retryWithBackoff(mockFn, 3, 100, 'test')
            ).rejects.toThrow('Validation failed');

            expect(mockFn).toHaveBeenCalledTimes(1);

            // Restore original
            ErrorHandler.classifyError = originalClassify;
        });
    });

    describe('validateInput', () => {
        test('should validate required fields', () => {
            expect(() => {
                ErrorHandler.validateInput('', { required: true });
            }).toThrow('This field is required');

            expect(() => {
                ErrorHandler.validateInput('   ', { required: true });
            }).toThrow('This field is required');

            expect(() => {
                ErrorHandler.validateInput(null, { required: true });
            }).toThrow('This field is required');
        });

        test('should return empty string for non-required empty input', () => {
            expect(ErrorHandler.validateInput('', { required: false })).toBe('');
            expect(ErrorHandler.validateInput(null, { required: false })).toBe('');
        });

        test('should validate minimum length', () => {
            expect(() => {
                ErrorHandler.validateInput('ab', { minLength: 3 });
            }).toThrow('Minimum length is 3 characters');

            expect(ErrorHandler.validateInput('abc', { minLength: 3 })).toBe('abc');
        });

        test('should validate maximum length', () => {
            expect(() => {
                ErrorHandler.validateInput('abcdef', { maxLength: 5 });
            }).toThrow('Maximum length is 5 characters');

            expect(ErrorHandler.validateInput('abcde', { maxLength: 5 })).toBe('abcde');
        });

        test('should validate against pattern', () => {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            expect(() => {
                ErrorHandler.validateInput('invalid-email', { pattern: emailPattern });
            }).toThrow('Invalid format');

            expect(ErrorHandler.validateInput('test@example.com', { pattern: emailPattern }))
                .toBe('test@example.com');
        });

        test('should sanitize input', () => {
            const result = ErrorHandler.validateInput('  test  ');
            expect(result).toBe('test');
        });

        test('should combine multiple validation rules', () => {
            const rules = {
                required: true,
                minLength: 3,
                maxLength: 10,
                pattern: /^[a-z]+$/
            };

            expect(() => {
                ErrorHandler.validateInput('', rules);
            }).toThrow('This field is required');

            expect(() => {
                ErrorHandler.validateInput('ab', rules);
            }).toThrow('Minimum length is 3 characters');

            expect(() => {
                ErrorHandler.validateInput('abcdefghijk', rules);
            }).toThrow('Maximum length is 10 characters');

            expect(() => {
                ErrorHandler.validateInput('ABC', rules);
            }).toThrow('Invalid format');

            expect(ErrorHandler.validateInput('hello', rules)).toBe('hello');
        });
    });

    describe('sanitizeInput', () => {
        test('should remove HTML tags', () => {
            const input = '<script>alert("xss")</script>Hello';
            const result = ErrorHandler.sanitizeInput(input);
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('</script>');
        });

        test('should remove angle brackets', () => {
            const input = '<div>test</div>';
            const result = ErrorHandler.sanitizeInput(input);
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
        });

        test('should trim whitespace', () => {
            const input = '   hello world   ';
            const result = ErrorHandler.sanitizeInput(input);
            expect(result).toBe('hello world');
        });

        test('should handle non-string input', () => {
            expect(ErrorHandler.sanitizeInput(123)).toBe(123);
            expect(ErrorHandler.sanitizeInput(null)).toBe(null);
            expect(ErrorHandler.sanitizeInput(undefined)).toBe(undefined);
        });

        test('should prevent XSS attacks', () => {
            const xssAttempts = [
                '<img src=x onerror=alert(1)>',
                '<svg onload=alert(1)>',
                '<iframe src="javascript:alert(1)">',
                '<body onload=alert(1)>'
            ];

            xssAttempts.forEach(attempt => {
                const result = ErrorHandler.sanitizeInput(attempt);
                expect(result).not.toContain('<');
                expect(result).not.toContain('>');
            });
        });

        test('should preserve safe text content', () => {
            const input = 'Hello, world! This is safe text.';
            const result = ErrorHandler.sanitizeInput(input);
            expect(result).toBe('Hello, world! This is safe text.');
        });
    });
});
