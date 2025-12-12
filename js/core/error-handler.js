/**
 * Error Handler Utility
 * Provides comprehensive error handling, retry logic, and error recovery
 */

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.retryAttempts = new Map();
        this.errorListeners = [];
    }

    /**
     * Execute function with retry logic
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Retry options
     * @returns {Promise} Result of function execution
     */
    async withRetry(fn, options = {}) {
        const {
            maxRetries = 3,
            delay = 1000,
            backoff = 2,
            onRetry = null,
            shouldRetry = (error) => true
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                
                // Clear retry count on success
                if (this.retryAttempts.has(fn.name)) {
                    this.retryAttempts.delete(fn.name);
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                // Check if we should retry
                if (attempt < maxRetries && shouldRetry(error)) {
                    const waitTime = delay * Math.pow(backoff, attempt);
                    
                    // Track retry attempts
                    this.retryAttempts.set(fn.name, attempt + 1);
                    
                    // Call retry callback if provided
                    if (onRetry) {
                        onRetry(error, attempt + 1, waitTime);
                    }
                    
                    console.warn(`Retry attempt ${attempt + 1}/${maxRetries} for ${fn.name} after ${waitTime}ms`);
                    
                    // Wait before retrying
                    await this.sleep(waitTime);
                } else {
                    break;
                }
            }
        }
        
        // All retries failed
        this.logError(lastError, { function: fn.name, attempts: maxRetries + 1 });
        throw lastError;
    }

    /**
     * Execute function with timeout
     * @param {Function} fn - Function to execute
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Result or timeout error
     */
    async withTimeout(fn, timeout = 5000) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
            )
        ]);
    }

    /**
     * Execute function with error boundary
     * @param {Function} fn - Function to execute
     * @param {*} fallback - Fallback value on error
     * @param {Object} context - Error context
     * @returns {*} Result or fallback
     */
    async withErrorBoundary(fn, fallback = null, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.logError(error, context);
            this.notifyListeners(error, context);
            return fallback;
        }
    }

    /**
     * Wrap async function with comprehensive error handling
     * @param {Function} fn - Async function to wrap
     * @param {Object} options - Error handling options
     * @returns {Function} Wrapped function
     */
    wrap(fn, options = {}) {
        const {
            retry = false,
            timeout = null,
            fallback = null,
            context = {}
        } = options;

        return async (...args) => {
            try {
                let operation = () => fn(...args);

                // Apply timeout if specified
                if (timeout) {
                    operation = () => this.withTimeout(() => fn(...args), timeout);
                }

                // Apply retry if specified
                if (retry) {
                    const retryOptions = typeof retry === 'object' ? retry : {};
                    return await this.withRetry(operation, retryOptions);
                }

                return await operation();
            } catch (error) {
                this.logError(error, { ...context, function: fn.name, args });
                this.notifyListeners(error, context);
                
                if (fallback !== null) {
                    return typeof fallback === 'function' ? fallback(error) : fallback;
                }
                
                throw error;
            }
        };
    }

    /**
     * Log error with context
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    logError(error, context = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errorLog.push(errorEntry);

        // Maintain max log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // Log to console in development
        if (this.isDevelopment()) {
            console.error('Error logged:', errorEntry);
        }

        // Store in localStorage for persistence
        this.persistErrorLog();
    }

    /**
     * Add error listener
     * @param {Function} listener - Error listener callback
     */
    addListener(listener) {
        this.errorListeners.push(listener);
    }

    /**
     * Remove error listener
     * @param {Function} listener - Error listener to remove
     */
    removeListener(listener) {
        const index = this.errorListeners.indexOf(listener);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }

    /**
     * Notify all error listeners
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    notifyListeners(error, context) {
        this.errorListeners.forEach(listener => {
            try {
                listener(error, context);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        });
    }

    /**
     * Get error log
     * @param {number} limit - Number of recent errors to return
     * @returns {Array} Error log entries
     */
    getErrorLog(limit = 10) {
        return this.errorLog.slice(-limit);
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
        localStorage.removeItem('errorLog');
    }

    /**
     * Persist error log to localStorage
     */
    persistErrorLog() {
        try {
            const recentErrors = this.errorLog.slice(-20);
            localStorage.setItem('errorLog', JSON.stringify(recentErrors));
        } catch (e) {
            console.warn('Failed to persist error log:', e);
        }
    }

    /**
     * Load error log from localStorage
     */
    loadErrorLog() {
        try {
            const stored = localStorage.getItem('errorLog');
            if (stored) {
                this.errorLog = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load error log:', e);
        }
    }

    /**
     * Check if in development mode
     * @returns {boolean}
     */
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create custom error
     * @param {string} name - Error name
     * @param {string} message - Error message
     * @param {Object} data - Additional error data
     * @returns {Error}
     */
    static createError(name, message, data = {}) {
        const error = new Error(message);
        error.name = name;
        Object.assign(error, data);
        return error;
    }
}

/**
 * Specific Error Types
 */
class NetworkError extends Error {
    constructor(message, statusCode = null) {
        super(message);
        this.name = 'NetworkError';
        this.statusCode = statusCode;
    }
}

class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class StorageError extends Error {
    constructor(message, operation = null) {
        super(message);
        this.name = 'StorageError';
        this.operation = operation;
    }
}

class APIError extends Error {
    constructor(message, endpoint = null, statusCode = null) {
        super(message);
        this.name = 'APIError';
        this.endpoint = endpoint;
        this.statusCode = statusCode;
    }
}

/**
 * Global error handler instance
 */
const errorHandler = new ErrorHandler();

// Load persisted errors on initialization
errorHandler.loadErrorLog();

// Global error event listeners
window.addEventListener('error', (event) => {
    errorHandler.logError(event.error || new Error(event.message), {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    errorHandler.logError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { type: 'unhandled-promise' }
    );
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        errorHandler,
        ErrorHandler,
        NetworkError,
        ValidationError,
        StorageError,
        APIError
    };
}