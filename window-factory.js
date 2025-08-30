/**
 * Window Factory Module
 * Provides a centralized way to create consistent ucanduit windows
 * Usage: import { createUcanduitWindow, WindowManager } from './window-factory.js';
 */

import { getWindowConfig, getWindowTitle, validateWindowConfig, WINDOW_EVENT_HANDLERS } from './window-config.js';

/**
 * Creates a new ucanduit window with consistent configuration
 * @param {string} windowType - Type of window (memo, settings, etc.)
 * @param {string} label - Unique label for the window
 * @param {string} url - URL/path to load in the window
 * @param {string} [contentTitle] - Content-specific title (optional)
 * @param {Object} [overrides] - Optional configuration overrides
 * @param {Object} [eventHandlers] - Optional custom event handlers
 * @returns {Promise<WebviewWindow>} Promise that resolves to the created window
 */
export async function createUcanduitWindow(
    windowType, 
    label, 
    url, 
    contentTitle = '', 
    overrides = {}, 
    eventHandlers = {}
) {
    try {
        // Check if Tauri is available
        if (!window.__TAURI__ || !window.__TAURI__.webviewWindow) {
            throw new Error('Tauri webviewWindow API not available');
        }

        const { webviewWindow } = window.__TAURI__;
        const { WebviewWindow } = webviewWindow;
        
        // Get window configuration
        const config = getWindowConfig(windowType, overrides);
        
        // Validate configuration
        if (!validateWindowConfig(config)) {
            throw new Error(`Invalid window configuration for type: ${windowType}`);
        }
        
        // Generate title
        const title = getWindowTitle(windowType, contentTitle);
        
        console.log(`🪟 Creating ${windowType} window:`, { label, title, config });
        
        // Create window
        const window = new WebviewWindow(label, {
            url,
            title,
            ...config
        });
        
        // Set up event handlers
        const handlers = { ...WINDOW_EVENT_HANDLERS, ...eventHandlers };
        
        window.once('tauri://created', () => {
            if (handlers.onCreated) {
                handlers.onCreated(windowType, window);
            }
        });
        
        window.once('tauri://error', (error) => {
            if (handlers.onError) {
                handlers.onError(windowType, error);
            }
        });
        
        // Optional: Set up focus handler
        if (handlers.onFocus) {
            window.onFocusChanged(({ payload: focused }) => {
                if (focused) {
                    handlers.onFocus(windowType, window);
                }
            });
        }
        
        // Register window in manager
        WindowManager.register(label, windowType, window);
        
        return window;
        
    } catch (error) {
        console.error(`❌ Failed to create ${windowType} window:`, error);
        throw error;
    }
}

/**
 * Window Manager - keeps track of open windows and provides utilities
 */
export class WindowManager {
    static windows = new Map();
    
    /**
     * Register a window with the manager
     * @param {string} label - Window label
     * @param {string} type - Window type
     * @param {WebviewWindow} window - Window instance
     */
    static register(label, type, window) {
        this.windows.set(label, { type, window, createdAt: new Date() });
        console.log(`📝 Registered ${type} window: ${label}`);
    }
    
    /**
     * Unregister a window (call when window is closed)
     * @param {string} label - Window label
     */
    static unregister(label) {
        if (this.windows.has(label)) {
            const { type } = this.windows.get(label);
            this.windows.delete(label);
            console.log(`🗑️ Unregistered ${type} window: ${label}`);
        }
    }
    
    /**
     * Get a window by label
     * @param {string} label - Window label
     * @returns {Object|null} Window info or null if not found
     */
    static get(label) {
        return this.windows.get(label) || null;
    }
    
    /**
     * Get all windows of a specific type
     * @param {string} type - Window type
     * @returns {Array} Array of window info objects
     */
    static getByType(type) {
        return Array.from(this.windows.values()).filter(w => w.type === type);
    }
    
    /**
     * Check if a window with the given label exists
     * @param {string} label - Window label
     * @returns {boolean} True if window exists
     */
    static exists(label) {
        return this.windows.has(label);
    }
    
    /**
     * Focus a window by label
     * @param {string} label - Window label
     * @returns {Promise<boolean>} True if window was focused
     */
    static async focus(label) {
        const windowInfo = this.get(label);
        if (windowInfo) {
            try {
                await windowInfo.window.setFocus();
                return true;
            } catch (error) {
                console.error(`Failed to focus window ${label}:`, error);
            }
        }
        return false;
    }
    
    /**
     * Close a window by label
     * @param {string} label - Window label
     * @returns {Promise<boolean>} True if window was closed
     */
    static async close(label) {
        const windowInfo = this.get(label);
        if (windowInfo) {
            try {
                await windowInfo.window.close();
                this.unregister(label);
                return true;
            } catch (error) {
                console.error(`Failed to close window ${label}:`, error);
            }
        }
        return false;
    }
    
    /**
     * Get statistics about open windows
     * @returns {Object} Window statistics
     */
    static getStats() {
        const stats = {};
        for (const { type } of this.windows.values()) {
            stats[type] = (stats[type] || 0) + 1;
        }
        return {
            total: this.windows.size,
            byType: stats,
            labels: Array.from(this.windows.keys())
        };
    }
}

/**
 * Convenience functions for specific window types
 */
export const WindowFactories = {
    /**
     * Create a memo window
     * @param {string} memoId - Memo ID (optional, for existing memos)
     * @param {string} [title] - Memo title (optional)
     * @param {Object} [overrides] - Configuration overrides
     * @returns {Promise<WebviewWindow>} Memo window
     */
    async createMemoWindow(memoId = null, title = '', overrides = {}) {
        const label = memoId ? `memo-window-${memoId}` : `memo-window-new-${Date.now()}`;
        const url = memoId ? `memo-window.html?memoId=${memoId}` : 'memo-window.html';
        
        return createUcanduitWindow('memo', label, url, title, overrides);
    },
    
    /**
     * Create a settings window
     * @param {Object} [overrides] - Configuration overrides
     * @returns {Promise<WebviewWindow>} Settings window
     */
    async createSettingsWindow(overrides = {}) {
        return createUcanduitWindow('settings', 'settings-window', 'settings.html', '', overrides);
    },
    
    /**
     * Create a memo browser window
     * @param {Object} [overrides] - Configuration overrides
     * @returns {Promise<WebviewWindow>} Memo browser window
     */
    async createMemoBrowserWindow(overrides = {}) {
        return createUcanduitWindow('memoBrowser', 'memo-browser-window', 'memo-browser.html', '', overrides);
    }
};

/**
 * Initialize window factory (call this on app startup)
 */
export function initializeWindowFactory() {
    console.log('🏭 Window Factory initialized');
    
    // Clean up window manager when windows are closed
    if (window.__TAURI__) {
        // This would be set up in the main app initialization
        console.log('📋 Window manager ready');
    }
}