/**
 * Settings Management Tool - ES6 Module
 * Centralized settings management for ucanduit application
 * Handles user preferences including locale, timer defaults, and weather settings
 */

export class SettingsManager {
    constructor() {
        this.settings = this.getDefaultSettings();
        this.listeners = new Map();
    }

    /**
     * Default settings structure
     */
    getDefaultSettings() {
        return {
            version: "1.0.0",
            weather: {
                locale: "toronto_on", // Default to Toronto for now
                units: "metric", // metric or imperial
                updateInterval: 30 // minutes
            },
            timer: {
                defaultDuration: 25, // minutes - Pomodoro default
                presets: {
                    pomodoro: 25,
                    shortBreak: 5,
                    longBreak: 15,
                    focus: 45,
                    quick: 10
                },
                soundEnabled: true,
                autoStart: false
            },
            ui: {
                theme: "auto", // auto, light, dark
                alwaysOnTop: true,
                showNotifications: true,
                minimizeToTray: true
            },
            audio: {
                masterVolume: 0.7,
                ambientVolume: 0.5,
                musicVolume: 0.8,
                timerSounds: true
            },
            general: {
                startMinimized: false,
                checkUpdates: true,
                analyticsEnabled: false,
                language: "en"
            }
        };
    }

    /**
     * Load settings from storage
     */
    async load() {
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                const settingsData = await window.__TAURI__.core.invoke('read_json_file', {
                    filename: 'ucanduit-settings.json'
                });
                
                if (settingsData) {
                    // Merge with defaults to ensure all properties exist
                    this.settings = this.mergeWithDefaults(settingsData);
                    console.log('⚙️ Settings loaded from storage');
                } else {
                    console.log('⚙️ Using default settings (no saved settings found)');
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load settings, using defaults:', error);
        }
        
        // Notify listeners that settings have been loaded
        this.notifyListeners('loaded', this.settings);
    }

    /**
     * Save settings to storage
     */
    async save() {
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-settings.json',
                    data: this.settings
                });
                console.log('💾 Settings saved to storage');
                
                // Notify listeners that settings have been saved
                this.notifyListeners('saved', this.settings);
            }
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
            throw error;
        }
    }

    /**
     * Merge loaded settings with defaults to ensure all properties exist
     */
    mergeWithDefaults(loadedSettings) {
        const defaults = this.getDefaultSettings();
        
        function deepMerge(target, source) {
            const result = { ...target };
            
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = deepMerge(target[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
            
            return result;
        }
        
        return deepMerge(defaults, loadedSettings);
    }

    /**
     * Get a setting value by path (e.g., 'timer.defaultDuration')
     */
    get(path) {
        const keys = path.split('.');
        let value = this.settings;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Set a setting value by path and save
     */
    async set(path, value) {
        const keys = path.split('.');
        let current = this.settings;
        
        // Navigate to parent of target property
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set the value
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        // Special handling for weather locale - also save to weather module storage
        if (path === 'weather.locale') {
            await this.updateWeatherLocation(value);
        }
        
        // Save to storage
        await this.save();
        
        // Notify listeners of the change
        this.notifyListeners('changed', { path, value, oldValue });
    }

    /**
     * Update weather module location storage when settings change
     */
    async updateWeatherLocation(locale) {
        try {
            // Map locale to readable location name
            const locationMap = {
                'toronto_on': 'Toronto, ON',
                'vancouver_bc': 'Vancouver, BC', 
                'montreal_qc': 'Montreal, QC',
                'calgary_ab': 'Calgary, AB',
                'winnipeg_mb': 'Winnipeg, MB',
                'halifax_ns': 'Halifax, NS'
            };
            
            const locationName = locationMap[locale] || 'Toronto, ON';
            
            // Save to localStorage for weather module compatibility
            localStorage.setItem('ucanduit_weather_currentLocation', JSON.stringify(locationName));
            
            // Also save to Tauri storage if available
            if (window.__TAURI__ && window.__TAURI__.core) {
                const weatherData = await window.__TAURI__.core.invoke('read_json_file', {
                    filename: 'ucanduit-weather.json'
                }).catch(() => ({}));
                
                weatherData.currentLocation = locationName;
                
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-weather.json',
                    data: weatherData
                });
            }
            
            console.log(`🌍 Weather location updated to: ${locationName}`);
        } catch (error) {
            console.error('Failed to update weather location storage:', error);
        }
    }

    /**
     * Add a listener for settings changes
     */
    addListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove a listener
     */
    removeListener(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notify all listeners of an event
     */
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in settings listener:', error);
                }
            });
        }
    }

    /**
     * Get all settings
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Reset to defaults
     */
    async reset() {
        this.settings = this.getDefaultSettings();
        await this.save();
        this.notifyListeners('reset', this.settings);
    }

    /**
     * Export settings as JSON string
     */
    export() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings from JSON string
     */
    async import(settingsJson) {
        try {
            const importedSettings = JSON.parse(settingsJson);
            this.settings = this.mergeWithDefaults(importedSettings);
            await this.save();
            this.notifyListeners('imported', this.settings);
        } catch (error) {
            console.error('Failed to import settings:', error);
            throw new Error('Invalid settings format');
        }
    }
}

// Global settings instance
export const settings = new SettingsManager();

// Initialize settings on module load
if (typeof window !== 'undefined') {
    // Auto-load settings when the module is imported
    settings.load().catch(console.error);
}