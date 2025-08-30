/**
 * Base class for tools with shared UI management and lifecycle functionality
 * Provides common patterns for tool initialization, rendering, and cleanup
 */

export class ToolBase {
    constructor(container) {
        this.container = container;
        this.isInitialized = false;
        this.id = this.generateId();
        
        // Load base CSS
        this.loadBaseCSS();
        
        // Initialize the tool
        this.init();
    }
    
    // Load base CSS file (shared across all tools)
    loadBaseCSS() {
        if (!document.querySelector('link[href*="tool-base.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './tools/tool-base.css';
            document.head.appendChild(link);
        }
    }
    
    // Generate unique ID for this tool instance
    generateId() {
        return `${this.constructor.name.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Main initialization method
    async init() {
        try {
            await this.render();
            this.bindEvents();
            this.isInitialized = true;
            this.onInitialized();
        } catch (error) {
            console.error(`Error initializing ${this.constructor.name}:`, error);
            this.renderError(error);
        }
    }
    
    // Abstract method - subclasses must implement
    async render() {
        throw new Error('render method must be implemented by subclass');
    }
    
    // Abstract method - subclasses should implement
    bindEvents() {
        // Default implementation does nothing
        // Subclasses can override to add specific event bindings
    }
    
    // Hook called after successful initialization
    onInitialized() {
        console.log(`${this.constructor.name} initialized successfully`);
    }
    
    // Render error state
    renderError(error) {
        this.container.innerHTML = `
            <div style="
                color: #d72638;
                text-align: center;
                padding: 20px;
                border: 2px solid #d72638;
                border-radius: 8px;
                background: rgba(215, 38, 56, 0.1);
                margin: 10px 0;
            ">
                <div style="font-weight: 600; margin-bottom: 5px;">Error loading ${this.constructor.name}</div>
                <div style="font-size: 12px; opacity: 0.8;">${error.message}</div>
            </div>
        `;
    }
    
    // Helper to create elements with classes and attributes
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.style) {
            Object.entries(options.style).forEach(([key, value]) => {
                element.style[key] = value;
            });
        }
        
        return element;
    }
    
    // Helper to find elements by selector within this tool's container
    find(selector) {
        return this.container.querySelector(selector);
    }
    
    findAll(selector) {
        return this.container.querySelectorAll(selector);
    }
    
    // Helper to safely get/set data in localStorage with tool prefix
    getStorageKey(key) {
        return `ucanduit_${this.constructor.name.toLowerCase()}_${key}`;
    }
    
    saveToStorage(key, data) {
        try {
            const storageKey = this.getStorageKey(key);
            localStorage.setItem(storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`Failed to save to storage:`, error);
            return false;
        }
    }
    
    loadFromStorage(key, defaultValue = null) {
        try {
            const storageKey = this.getStorageKey(key);
            const data = localStorage.getItem(storageKey);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Failed to load from storage:`, error);
            return defaultValue;
        }
    }
    
    // Cleanup method - subclasses can override
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        console.log(`${this.constructor.name} destroyed`);
    }
    
    // Update status in main app ticker
    updateStatus(text, type = 'success', duration = 3000) {
        if (window.updateStatus) {
            window.updateStatus(text, type, duration);
        }
    }
}