/**
 * Storage Utility
 * Provides robust localStorage operations with error handling and validation
 */

class StorageManager {
    constructor(errorHandler, validator) {
        this.errorHandler = errorHandler;
        this.validator = validator;
        this.prefix = 'englishLearning_';
        this.compressionThreshold = 1024 * 100; // 100KB
    }

    /**
     * Save data to localStorage with validation and error handling
     * @param {string} key - Storage key
     * @param {*} data - Data to store
     * @param {Object} options - Storage options
     * @returns {boolean} Success status
     */
    async save(key, data, options = {}) {
        const {
            validate = true,
            compress = false,
            backup = true
        } = options;

        const fullKey = this.prefix + key;

        return await this.errorHandler.withErrorBoundary(
            async () => {
                // Validate data if required
                if (validate && !this.validator.validateStorageData(key, data)) {
                    throw new StorageError(`Invalid data for key: ${key}`, 'save');
                }

                // Create backup of existing data
                if (backup) {
                    this.createBackup(key);
                }

                // Prepare data for storage
                let storageData = {
                    value: data,
                    timestamp: Date.now(),
                    version: '1.0'
                };

                // Compress if needed
                if (compress || this.shouldCompress(storageData)) {
                    storageData = this.compress(storageData);
                }

                // Store data
                localStorage.setItem(fullKey, JSON.stringify(storageData));

                return true;
            },
            false,
            { operation: 'storage.save', key }
        );
    }

    /**
     * Load data from localStorage with validation
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @param {Object} options - Load options
     * @returns {*} Stored data or default value
     */
    async load(key, defaultValue = null, options = {}) {
        const {
            validate = true,
            maxAge = null
        } = options;

        const fullKey = this.prefix + key;

        return await this.errorHandler.withErrorBoundary(
            async () => {
                const stored = localStorage.getItem(fullKey);

                if (!stored) {
                    return defaultValue;
                }

                // Parse stored data
                let storageData = JSON.parse(stored);

                // Decompress if needed
                if (storageData.compressed) {
                    storageData = this.decompress(storageData);
                }

                // Check age if maxAge is specified
                if (maxAge && Date.now() - storageData.timestamp > maxAge) {
                    console.warn(`Data for ${key} is expired`);
                    this.remove(key);
                    return defaultValue;
                }

                // Validate data if required
                if (validate && !this.validateData(key, storageData.value)) {
                    console.warn(`Invalid data for ${key}, using default`);
                    return defaultValue;
                }

                return storageData.value;
            },
            defaultValue,
            { operation: 'storage.load', key }
        );
    }

    /**
     * Remove data from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} Success status
     */
    remove(key) {
        const fullKey = this.prefix + key;
        
        return this.errorHandler.withErrorBoundary(
            () => {
                localStorage.removeItem(fullKey);
                return true;
            },
            false,
            { operation: 'storage.remove', key }
        );
    }

    /**
     * Clear all app data from localStorage
     * @returns {boolean} Success status
     */
    clearAll() {
        return this.errorHandler.withErrorBoundary(
            () => {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith(this.prefix)) {
                        localStorage.removeItem(key);
                    }
                });
                return true;
            },
            false,
            { operation: 'storage.clearAll' }
        );
    }

    /**
     * Create backup of existing data
     * @param {string} key - Storage key
     */
    createBackup(key) {
        const fullKey = this.prefix + key;
        const backupKey = fullKey + '_backup';

        try {
            const existing = localStorage.getItem(fullKey);
            if (existing) {
                const backup = {
                    data: existing,
                    timestamp: Date.now()
                };
                localStorage.setItem(backupKey, JSON.stringify(backup));
            }
        } catch (error) {
            console.warn(`Failed to create backup for ${key}:`, error);
        }
    }

    /**
     * Restore from backup
     * @param {string} key - Storage key
     * @returns {boolean} Success status
     */
    restoreFromBackup(key) {
        const fullKey = this.prefix + key;
        const backupKey = fullKey + '_backup';

        return this.errorHandler.withErrorBoundary(
            () => {
                const backup = localStorage.getItem(backupKey);
                if (!backup) {
                    throw new StorageError(`No backup found for ${key}`, 'restore');
                }

                const { data, timestamp } = JSON.parse(backup);
                
                // Check if backup is not too old (7 days)
                const maxAge = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - timestamp > maxAge) {
                    throw new StorageError(`Backup for ${key} is too old`, 'restore');
                }

                localStorage.setItem(fullKey, data);
                return true;
            },
            false,
            { operation: 'storage.restore', key }
        );
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage stats
     */
    getStorageInfo() {
        try {
            let totalSize = 0;
            let appSize = 0;
            const items = {};

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                
                totalSize += size;
                
                if (key.startsWith(this.prefix)) {
                    appSize += size;
                    items[key.replace(this.prefix, '')] = {
                        size,
                        sizeKB: (size / 1024).toFixed(2)
                    };
                }
            }

            return {
                totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                appSize,
                appSizeMB: (appSize / (1024 * 1024)).toFixed(2),
                items,
                available: this.getAvailableSpace()
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return null;
        }
    }

    /**
     * Estimate available localStorage space
     * @returns {number} Available space in bytes (approximate)
     */
    getAvailableSpace() {
        const testKey = this.prefix + 'test_space';
        const testData = '0'.repeat(1024); // 1KB chunks
        let size = 0;

        try {
            // Test up to 10MB
            for (let i = 0; i < 10240; i++) {
                localStorage.setItem(testKey, testData.repeat(i));
                size = i * 1024;
            }
        } catch (e) {
            // Quota exceeded
        } finally {
            localStorage.removeItem(testKey);
        }

        return size;
    }

    /**
     * Check if data should be compressed
     * @param {Object} data - Data to check
     * @returns {boolean}
     */
    shouldCompress(data) {
        try {
            const size = new Blob([JSON.stringify(data)]).size;
            return size > this.compressionThreshold;
        } catch {
            return false;
        }
    }

    /**
     * Simple compression using base64 encoding
     * @param {Object} data - Data to compress
     * @returns {Object} Compressed data
     */
    compress(data) {
        try {
            const jsonString = JSON.stringify(data);
            const compressed = btoa(encodeURIComponent(jsonString));
            return {
                compressed: true,
                data: compressed,
                originalSize: jsonString.length,
                compressedSize: compressed.length
            };
        } catch (error) {
            console.warn('Compression failed, storing uncompressed:', error);
            return data;
        }
    }

    /**
     * Decompress data
     * @param {Object} data - Compressed data
     * @returns {Object} Decompressed data
     */
    decompress(data) {
        try {
            if (!data.compressed) return data;
            
            const decompressed = decodeURIComponent(atob(data.data));
            return JSON.parse(decompressed);
        } catch (error) {
            console.error('Decompression failed:', error);
            throw new StorageError('Failed to decompress data', 'decompress');
        }
    }

    /**
     * Validate stored data based on key
     * @param {string} key - Storage key
     * @param {*} data - Data to validate
     * @returns {boolean}
     */
    validateData(key, data) {
        // Key-specific validation
        switch (key) {
            case 'learningProgress':
                return this.validator.validateProgress(data).valid;
            
            case 'dailyStats':
                return data && typeof data === 'object' && 
                       typeof data.date === 'string';
            
            case 'completedExercises':
                return data && typeof data === 'object';
            
            default:
                return true;
        }
    }

    /**
     * Export all app data
     * @returns {Object} All app data
     */
    exportData() {
        const exported = {};
        
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const cleanKey = key.replace(this.prefix, '');
                    const value = localStorage.getItem(key);
                    try {
                        exported[cleanKey] = JSON.parse(value);
                    } catch {
                        exported[cleanKey] = value;
                    }
                }
            });
            
            return {
                version: '1.0',
                exportDate: new Date().toISOString(),
                data: exported
            };
        } catch (error) {
            console.error('Failed to export data:', error);
            return null;
        }
    }

    /**
     * Import data
     * @param {Object} importData - Data to import
     * @returns {boolean} Success status
     */
    importData(importData) {
        return this.errorHandler.withErrorBoundary(
            () => {
                if (!importData || !importData.data) {
                    throw new StorageError('Invalid import data', 'import');
                }

                // Backup current data before import
                const currentData = this.exportData();
                this.save('import_backup', currentData, { validate: false });

                // Import data
                Object.entries(importData.data).forEach(([key, value]) => {
                    const fullKey = this.prefix + key;
                    localStorage.setItem(fullKey, JSON.stringify(value));
                });

                return true;
            },
            false,
            { operation: 'storage.import' }
        );
    }

    /**
     * Check if localStorage is available
     * @returns {boolean}
     */
    static isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager };
}