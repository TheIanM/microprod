/**
 * Window Configuration Module
 * Defines default window settings for ucanduit application
 * Usage: import { WINDOW_DEFAULTS, getWindowConfig } from './window-config.js';
 */

/**
 * Default window configurations for different window types
 * These settings ensure consistent styling and behavior across all windows
 */
export const WINDOW_DEFAULTS = {
    // Memo windows - for individual note editing
    memo: {
        width: 600,
        height: 500,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay', // Seamless title bar integration
        alwaysOnTop: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        skipTaskbar: false,
        center: true
    },
    
    // Settings/preferences windows
    settings: {
        width: 500,
        height: 700,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        alwaysOnTop: false,
        resizable: false,
        minimizable: true,
        maximizable: false,
        closable: true,
        skipTaskbar: false,
        center: true
    },
    
    // Master memo browser window
    memoBrowser: {
        width: 800,
        height: 600,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        alwaysOnTop: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        skipTaskbar: false,
        center: true
    },
    
    // Floating mini windows (quick access tools)
    mini: {
        width: 300,
        height: 200,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        alwaysOnTop: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: true,
        skipTaskbar: true,
        center: false
    },
    
    // Audio/music player window
    audio: {
        width: 400,
        height: 300,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        alwaysOnTop: false,
        resizable: false,
        minimizable: true,
        maximizable: false,
        closable: true,
        skipTaskbar: false,
        center: true
    },
    
    // Default fallback configuration
    default: {
        width: 600,
        height: 500,
        decorations: true,
        transparent: false,
        titleBarStyle: 'overlay',
        alwaysOnTop: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        skipTaskbar: false,
        center: true
    }
};

/**
 * Gets window configuration for a specific window type
 * @param {string} windowType - Type of window (memo, settings, etc.)
 * @param {Object} overrides - Optional overrides for specific settings
 * @returns {Object} Complete window configuration
 */
export function getWindowConfig(windowType, overrides = {}) {
    const baseConfig = WINDOW_DEFAULTS[windowType] || WINDOW_DEFAULTS.default;
    return { ...baseConfig, ...overrides };
}

/**
 * Validates window configuration to ensure all required properties exist
 * @param {Object} config - Window configuration to validate
 * @returns {boolean} True if configuration is valid
 */
export function validateWindowConfig(config) {
    const required = ['width', 'height', 'decorations', 'transparent'];
    return required.every(prop => config.hasOwnProperty(prop));
}

/**
 * Common window event handlers that can be reused
 */
export const WINDOW_EVENT_HANDLERS = {
    /**
     * Standard window creation success handler
     * @param {string} windowType - Type of window that was created
     */
    onCreated: (windowType) => {
        console.log(`✅ ${windowType} window created successfully`);
    },
    
    /**
     * Standard window creation error handler  
     * @param {string} windowType - Type of window that failed to create
     * @param {Error} error - Error that occurred
     */
    onError: (windowType, error) => {
        console.error(`❌ Failed to create ${windowType} window:`, error);
    },
    
    /**
     * Window focus handler
     * @param {string} windowType - Type of window that gained focus
     */
    onFocus: (windowType) => {
        console.log(`🎯 ${windowType} window focused`);
    }
};

/**
 * Gets the appropriate window title format
 * @param {string} windowType - Type of window
 * @param {string} content - Content-specific title (e.g., memo title)
 * @returns {string} Formatted window title
 */
export function getWindowTitle(windowType, content = '') {
    const appName = 'ucanduit';
    
    switch (windowType) {
        case 'memo':
            return content ? `${content} - ${appName}` : `New Memo - ${appName}`;
        case 'settings':
            return `Settings - ${appName}`;
        case 'memoBrowser':
            return `Memos - ${appName}`;
        case 'audio':
            return `Audio Player - ${appName}`;
        default:
            return content ? `${content} - ${appName}` : appName;
    }
}