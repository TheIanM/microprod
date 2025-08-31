/**
 * Settings UI Controller - ES6 Module
 * Handles the settings window user interface and interactions
 */

import { settings } from './settings.js';

export class SettingsUI {
    constructor() {
        this.currentSection = 'general';
        this.saveTimeout = null;
        this.init();
    }

    async init() {
        // Wait for settings to load
        await settings.load();
        
        // Set up event listeners
        this.setupNavigation();
        this.setupInputHandlers();
        this.setupActionHandlers();
        
        // Load current settings into UI
        this.loadSettingsIntoUI();
        
        // Listen for settings changes
        settings.addListener('changed', this.onSettingsChanged.bind(this));
        settings.addListener('saved', this.onSettingsSaved.bind(this));
        
        console.log('⚙️ Settings UI initialized');
    }

    setupNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.settings-section');

        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const sectionId = tab.dataset.section;
                
                // Update active tab
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active section
                sections.forEach(s => s.classList.remove('active'));
                document.getElementById(`${sectionId}-section`).classList.add('active');
                
                this.currentSection = sectionId;
            });
        });
    }

    setupInputHandlers() {
        // General settings
        this.bindInput('language-select', 'general.language');
        this.bindCheckbox('start-minimized', 'general.startMinimized');
        this.bindCheckbox('show-notifications', 'ui.showNotifications');
        this.bindCheckbox('check-updates', 'general.checkUpdates');

        // Weather settings
        this.bindInput('weather-locale', 'weather.locale');
        this.bindInput('weather-units', 'weather.units');
        this.bindInput('weather-update-interval', 'weather.updateInterval', parseInt);

        // Timer settings
        this.bindInput('timer-default-duration', 'timer.defaultDuration', parseInt);
        this.bindInput('preset-pomodoro', 'timer.presets.pomodoro', parseInt);
        this.bindInput('preset-short-break', 'timer.presets.shortBreak', parseInt);
        this.bindInput('preset-long-break', 'timer.presets.longBreak', parseInt);
        this.bindInput('preset-focus', 'timer.presets.focus', parseInt);
        this.bindCheckbox('timer-sound-enabled', 'timer.soundEnabled');
        this.bindCheckbox('timer-auto-start', 'timer.autoStart');

        // Audio settings
        this.bindSlider('master-volume', 'audio.masterVolume', (val) => val / 100);
        this.bindSlider('ambient-volume', 'audio.ambientVolume', (val) => val / 100);
        this.bindSlider('music-volume', 'audio.musicVolume', (val) => val / 100);

        // Appearance settings
        this.bindInput('theme-select', 'ui.theme');
        this.bindCheckbox('always-on-top', 'ui.alwaysOnTop');
        this.bindCheckbox('minimize-to-tray', 'ui.minimizeToTray');
    }

    bindInput(elementId, settingsPath, transform = null) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.addEventListener('change', async () => {
            const value = transform ? transform(element.value) : element.value;
            await settings.set(settingsPath, value);
        });
    }

    bindCheckbox(elementId, settingsPath) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.addEventListener('change', async () => {
            await settings.set(settingsPath, element.checked);
        });
    }

    bindSlider(elementId, settingsPath, transform = null) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const updateValue = async () => {
            const value = transform ? transform(parseInt(element.value)) : parseInt(element.value);
            await settings.set(settingsPath, value);
            
            // Update display value
            const valueDisplay = element.parentNode.querySelector('.volume-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${element.value}%`;
            }
        };

        element.addEventListener('input', updateValue);
        element.addEventListener('change', updateValue);
    }

    setupActionHandlers() {
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', this.handleReset.bind(this));
        }

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.handleExport.bind(this));
        }

        // Import button
        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', this.handleImport.bind(this));
        }
    }

    loadSettingsIntoUI() {
        const allSettings = settings.getAll();

        // General settings
        this.setInputValue('language-select', allSettings.general?.language);
        this.setCheckboxValue('start-minimized', allSettings.general?.startMinimized);
        this.setCheckboxValue('show-notifications', allSettings.ui?.showNotifications);
        this.setCheckboxValue('check-updates', allSettings.general?.checkUpdates);

        // Weather settings
        this.setInputValue('weather-locale', allSettings.weather?.locale);
        this.setInputValue('weather-units', allSettings.weather?.units);
        this.setInputValue('weather-update-interval', allSettings.weather?.updateInterval);

        // Timer settings
        this.setInputValue('timer-default-duration', allSettings.timer?.defaultDuration);
        this.setInputValue('preset-pomodoro', allSettings.timer?.presets?.pomodoro);
        this.setInputValue('preset-short-break', allSettings.timer?.presets?.shortBreak);
        this.setInputValue('preset-long-break', allSettings.timer?.presets?.longBreak);
        this.setInputValue('preset-focus', allSettings.timer?.presets?.focus);
        this.setCheckboxValue('timer-sound-enabled', allSettings.timer?.soundEnabled);
        this.setCheckboxValue('timer-auto-start', allSettings.timer?.autoStart);

        // Audio settings
        this.setSliderValue('master-volume', Math.round((allSettings.audio?.masterVolume || 0.7) * 100));
        this.setSliderValue('ambient-volume', Math.round((allSettings.audio?.ambientVolume || 0.5) * 100));
        this.setSliderValue('music-volume', Math.round((allSettings.audio?.musicVolume || 0.8) * 100));

        // Appearance settings
        this.setInputValue('theme-select', allSettings.ui?.theme);
        this.setCheckboxValue('always-on-top', allSettings.ui?.alwaysOnTop);
        this.setCheckboxValue('minimize-to-tray', allSettings.ui?.minimizeToTray);
    }

    setInputValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.value = value;
        }
    }

    setCheckboxValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.checked = value;
        }
    }

    setSliderValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.value = value;
            
            // Update display value
            const valueDisplay = element.parentNode.querySelector('.volume-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${value}%`;
            }
        }
    }

    async handleReset() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            await settings.reset();
            this.loadSettingsIntoUI();
            this.showStatus('Settings reset to defaults', 'saved');
        }
    }

    handleExport() {
        const settingsData = settings.export();
        const blob = new Blob([settingsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ucanduit-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
        this.showStatus('Settings exported', 'saved');
    }

    async handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                await settings.import(text);
                this.loadSettingsIntoUI();
                this.showStatus('Settings imported successfully', 'saved');
            } catch (error) {
                this.showStatus('Failed to import settings: Invalid format', 'error');
            }
        };
        
        input.click();
    }

    onSettingsChanged({ path, value }) {
        // Clear any existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        // Show saving status
        this.showStatus('Saving...', 'saving');
        
        // Set timeout to show saved status
        this.saveTimeout = setTimeout(() => {
            this.showStatus('Settings saved automatically', 'saved');
        }, 1000);
    }

    onSettingsSaved() {
        // Settings were saved successfully
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.showStatus('Settings saved automatically', 'saved');
    }

    showStatus(message, type = 'saved') {
        const statusElement = document.getElementById('save-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `save-status ${type}`;
        }
    }
}

// Initialize settings UI when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SettingsUI();
    });
} else {
    new SettingsUI();
}