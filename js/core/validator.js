/**
 * Validation Utility
 * Provides input validation, sanitization, and data integrity checks
 */

class Validator {
    /**
     * Sanitize HTML to prevent XSS
     * @param {string} input - Input string
     * @returns {string} Sanitized string
     */
    static sanitizeHTML(input) {
        if (typeof input !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Sanitize input by removing dangerous characters
     * @param {string} input - Input string
     * @returns {string} Sanitized string
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, ''); // Remove event handlers
    }

    /**
     * Validate email format
     * @param {string} email - Email address
     * @returns {boolean}
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL format
     * @param {string} url - URL string
     * @returns {boolean}
     */
    static isValidURL(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Validate string length
     * @param {string} str - String to validate
     * @param {number} min - Minimum length
     * @param {number} max - Maximum length
     * @returns {boolean}
     */
    static isValidLength(str, min = 0, max = Infinity) {
        if (typeof str !== 'string') return false;
        const length = str.trim().length;
        return length >= min && length <= max;
    }

    /**
     * Validate number range
     * @param {number} num - Number to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean}
     */
    static isInRange(num, min = -Infinity, max = Infinity) {
        return typeof num === 'number' && num >= min && num <= max;
    }

    /**
     * Validate array
     * @param {*} arr - Value to check
     * @param {number} minLength - Minimum array length
     * @param {number} maxLength - Maximum array length
     * @returns {boolean}
     */
    static isValidArray(arr, minLength = 0, maxLength = Infinity) {
        return Array.isArray(arr) && 
               arr.length >= minLength && 
               arr.length <= maxLength;
    }

    /**
     * Validate object structure against schema
     * @param {Object} obj - Object to validate
     * @param {Object} schema - Schema definition
     * @returns {Object} { valid: boolean, errors: Array }
     */
    static validateSchema(obj, schema) {
        const errors = [];

        const validate = (data, schemaObj, path = '') => {
            for (const [key, rules] of Object.entries(schemaObj)) {
                const currentPath = path ? `${path}.${key}` : key;
                const value = data[key];

                // Check required fields
                if (rules.required && (value === undefined || value === null)) {
                    errors.push(`${currentPath} is required`);
                    continue;
                }

                // Skip validation if field is optional and not provided
                if (!rules.required && (value === undefined || value === null)) {
                    continue;
                }

                // Type validation
                if (rules.type) {
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    if (actualType !== rules.type) {
                        errors.push(`${currentPath} must be of type ${rules.type}, got ${actualType}`);
                        continue;
                    }
                }

                // Nested object validation
                if (rules.type === 'object' && rules.schema) {
                    validate(value, rules.schema, currentPath);
                }

                // Array validation
                if (rules.type === 'array') {
                    if (rules.minLength !== undefined && value.length < rules.minLength) {
                        errors.push(`${currentPath} must have at least ${rules.minLength} items`);
                    }
                    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                        errors.push(`${currentPath} must have at most ${rules.maxLength} items`);
                    }
                    if (rules.itemType) {
                        value.forEach((item, index) => {
                            const itemType = Array.isArray(item) ? 'array' : typeof item;
                            if (itemType !== rules.itemType) {
                                errors.push(`${currentPath}[${index}] must be of type ${rules.itemType}`);
                            }
                        });
                    }
                }

                // String validation
                if (rules.type === 'string') {
                    if (rules.minLength !== undefined && value.length < rules.minLength) {
                        errors.push(`${currentPath} must be at least ${rules.minLength} characters`);
                    }
                    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                        errors.push(`${currentPath} must be at most ${rules.maxLength} characters`);
                    }
                    if (rules.pattern && !rules.pattern.test(value)) {
                        errors.push(`${currentPath} does not match required pattern`);
                    }
                    if (rules.enum && !rules.enum.includes(value)) {
                        errors.push(`${currentPath} must be one of: ${rules.enum.join(', ')}`);
                    }
                }

                // Number validation
                if (rules.type === 'number') {
                    if (rules.min !== undefined && value < rules.min) {
                        errors.push(`${currentPath} must be at least ${rules.min}`);
                    }
                    if (rules.max !== undefined && value > rules.max) {
                        errors.push(`${currentPath} must be at most ${rules.max}`);
                    }
                }

                // Custom validation
                if (rules.validate && typeof rules.validate === 'function') {
                    const customError = rules.validate(value);
                    if (customError) {
                        errors.push(`${currentPath}: ${customError}`);
                    }
                }
            }
        };

        validate(obj, schema);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate exercise data structure
     * @param {Object} exercise - Exercise object
     * @param {string} type - Exercise type
     * @returns {Object} Validation result
     */
    static validateExercise(exercise, type) {
        const schemas = {
            vocabulary: {
                word: { type: 'string', required: true, minLength: 1, maxLength: 50 },
                pronunciation: { type: 'string', required: false },
                definition: { type: 'string', required: true, minLength: 1 },
                example: { type: 'string', required: false },
                quiz: {
                    type: 'object',
                    required: true,
                    schema: {
                        question: { type: 'string', required: true },
                        options: { type: 'array', required: true, minLength: 2, itemType: 'string' },
                        correct: { type: 'number', required: true, min: 0 }
                    }
                }
            },
            sentence: {
                words: { type: 'array', required: true, minLength: 1, itemType: 'string' },
                correct: { type: 'string', required: true, minLength: 1 },
                fillBlank: {
                    type: 'object',
                    required: false,
                    schema: {
                        sentence: { type: 'string', required: true },
                        answer: { type: 'string', required: true },
                        options: { type: 'array', required: true, itemType: 'string' }
                    }
                }
            },
            reading: {
                title: { type: 'string', required: true, minLength: 1 },
                text: { type: 'string', required: true, minLength: 10 },
                questions: {
                    type: 'array',
                    required: true,
                    minLength: 1
                },
                dictation: { type: 'string', required: false }
            }
        };

        const schema = schemas[type];
        if (!schema) {
            return { valid: false, errors: [`Unknown exercise type: ${type}`] };
        }

        return this.validateSchema(exercise, schema);
    }

    /**
     * Validate progress data
     * @param {Object} progress - Progress object
     * @returns {Object} Validation result
     */
    static validateProgress(progress) {
        const schema = {
            currentSection: { type: 'string', required: true },
            currentDifficulty: { 
                type: 'string', 
                required: true, 
                enum: ['basic', 'intermediate', 'medium'] 
            },
            currentWordIndex: { type: 'number', required: true, min: 0 },
            currentSentenceIndex: { type: 'number', required: true, min: 0 },
            currentPassageIndex: { type: 'number', required: true, min: 0 },
            stats: {
                type: 'object',
                required: true,
                schema: {
                    wordsLearned: { type: 'number', required: true, min: 0 },
                    sentencesCompleted: { type: 'number', required: true, min: 0 },
                    readingCompleted: { type: 'number', required: true, min: 0 },
                    puzzlesSolved: { type: 'number', required: true, min: 0 }
                }
            }
        };

        return this.validateSchema(progress, schema);
    }

    /**
     * Sanitize and validate user answer
     * @param {string} answer - User's answer
     * @param {number} maxLength - Maximum allowed length
     * @returns {Object} { valid: boolean, sanitized: string, error: string }
     */
    static validateUserAnswer(answer, maxLength = 500) {
        if (typeof answer !== 'string') {
            return { valid: false, sanitized: '', error: 'Answer must be a string' };
        }

        const sanitized = this.sanitizeInput(answer);

        if (sanitized.length === 0) {
            return { valid: false, sanitized, error: 'Answer cannot be empty' };
        }

        if (sanitized.length > maxLength) {
            return { 
                valid: false, 
                sanitized: sanitized.substring(0, maxLength), 
                error: `Answer must be ${maxLength} characters or less` 
            };
        }

        return { valid: true, sanitized, error: null };
    }

    /**
     * Validate localStorage data integrity
     * @param {string} key - Storage key
     * @param {*} data - Data to validate
     * @returns {boolean}
     */
    static validateStorageData(key, data) {
        try {
            // Check if data can be stringified
            const stringified = JSON.stringify(data);
            
            // Check size (localStorage has ~5MB limit)
            const sizeInBytes = new Blob([stringified]).size;
            const sizeInMB = sizeInBytes / (1024 * 1024);
            
            if (sizeInMB > 4) {
                console.warn(`Storage data for ${key} is ${sizeInMB.toFixed(2)}MB, approaching limit`);
                return false;
            }

            // Verify it can be parsed back
            JSON.parse(stringified);
            
            return true;
        } catch (error) {
            console.error(`Invalid storage data for ${key}:`, error);
            return false;
        }
    }

    /**
     * Deep clone and validate object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object or null if invalid
     */
    static safeClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            console.error('Failed to clone object:', error);
            return null;
        }
    }

    /**
     * Check if value is empty
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    static isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Validate file size
     * @param {File} file - File object
     * @param {number} maxSizeMB - Maximum size in MB
     * @returns {boolean}
     */
    static isValidFileSize(file, maxSizeMB = 5) {
        if (!(file instanceof File)) return false;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    }

    /**
     * Validate file type
     * @param {File} file - File object
     * @param {Array} allowedTypes - Allowed MIME types
     * @returns {boolean}
     */
    static isValidFileType(file, allowedTypes = []) {
        if (!(file instanceof File)) return false;
        if (allowedTypes.length === 0) return true;
        return allowedTypes.includes(file.type);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
}