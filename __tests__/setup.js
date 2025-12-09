// Test Setup and Global Mocks
// This file runs before all tests

// Mock localStorage
global.localStorage = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = value.toString();
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

// Mock sessionStorage
global.sessionStorage = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = value.toString();
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
    writable: true,
    value: true
});

// Mock SpeechSynthesisUtterance
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
    constructor(text) {
        this.text = text;
        this.rate = 1;
        this.lang = 'en-US';
    }
};

// Mock speechSynthesis
global.speechSynthesis = {
    speaking: false,
    pending: false,
    paused: false,
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => [])
};

// Mock fetch API
global.fetch = jest.fn();

// Mock AbortSignal.timeout
if (!AbortSignal.timeout) {
    AbortSignal.timeout = (ms) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
    };
}

// Clean up after each test
afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
});

// Set up DOM testing library matchers
require('@testing-library/jest-dom');

console.log('Test environment initialized');
