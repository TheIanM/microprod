/**
 * Weather Tool - ES6 Module
 * Provides Canadian weather data using Environment and Climate Change Canada's datamart
 * Features animated weather icons using Skycons library
 */

import { ToolBase } from './tool-base.js';
import { WeatherService } from './weather-service.js';

export class WeatherTool extends ToolBase {
    constructor(container) {
        super(container);
        
        this.currentWeatherData = null;
        this.currentLocation = null;
        this.skycons = null;
        this.refreshTimer = null;
        this.refreshInterval = 30 * 60 * 1000; // 30 minutes
        this.weatherService = new WeatherService();
        
        // Weather condition mapping for Skycons
        this.conditionMapping = {
            'clear': 'clear-day',
            'sunny': 'clear-day', 
            'partly-cloudy': 'partly-cloudy-day',
            'cloudy': 'cloudy',
            'overcast': 'cloudy',
            'rain': 'rain',
            'drizzle': 'rain',
            'snow': 'snow',
            'sleet': 'sleet',
            'wind': 'wind',
            'fog': 'fog',
            'mist': 'fog'
        };
        
        // Load weather-specific CSS and Skycons library
        this.loadWeatherAssets();
    }
    
    loadWeatherAssets() {
        // Load weather CSS
        if (!document.querySelector('link[href*="weather.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = './tools/weather.css';
            document.head.appendChild(cssLink);
        }
        
        // Load Skycons library
        if (!window.Skycons) {
            const script = document.createElement('script');
            script.src = './libs/skycons.js';
            script.onload = () => {
                this.initializeSkycons();
            };
            document.head.appendChild(script);
        } else {
            this.initializeSkycons();
        }
    }
    
    initializeSkycons() {
        if (window.Skycons && !this.skycons) {
            this.skycons = new window.Skycons({ 
                color: '#2a2d34',
                resizeClear: true 
            });
        }
    }
    
    async init() {
        // Load saved location and weather data
        await this.loadFromStorage();
        await super.init();
        
        // Start auto-refresh timer
        this.startAutoRefresh();
    }
    
    async loadFromStorage() {
        try {
            // Load from Tauri file system if available
            if (window.__TAURI__ && window.__TAURI__.core) {
                const fileData = await window.__TAURI__.core.invoke('read_json_file', {
                    filename: 'ucanduit-weather.json'
                });
                if (fileData) {
                    this.currentLocation = fileData.currentLocation;
                    this.currentWeatherData = fileData.weatherData;
                    console.log('✅ Weather data loaded from external file');
                    return;
                }
            }
        } catch (error) {
            console.log('📁 No external weather file found, checking localStorage...');
        }
        
        try {
            // Fallback to localStorage
            const savedLocation = this.loadFromStorage('currentLocation');
            const savedWeather = this.loadFromStorage('weatherData');
            
            if (savedLocation) {
                this.currentLocation = savedLocation;
            }
            if (savedWeather) {
                this.currentWeatherData = savedWeather;
            }
            
            console.log('✅ Weather data loaded from localStorage');
        } catch (error) {
            console.error('❌ Failed to load weather data:', error);
        }
    }
    
    async saveToStorage() {
        const weatherData = {
            currentLocation: this.currentLocation,
            weatherData: this.currentWeatherData,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            // Save to Tauri file system if available
            if (window.__TAURI__ && window.__TAURI__.core) {
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-weather.json',
                    data: weatherData
                });
                console.log('✅ Weather data saved to external file');
            } else {
                // Fallback to localStorage
                this.saveToStorage('currentLocation', this.currentLocation);
                this.saveToStorage('weatherData', this.currentWeatherData);
                console.log('✅ Weather data saved to localStorage');
            }
        } catch (error) {
            console.error('❌ Failed to save weather data:', error);
        }
    }
    
    async render() {
        // Show loading state initially or if no data
        if (!this.currentWeatherData && !this.currentLocation) {
            this.renderInitialState();
            return;
        }
        
        // Show current weather if available
        if (this.currentWeatherData) {
            this.renderWeatherDisplay();
        } else {
            this.renderLoadingState();
        }
    }
    
    renderInitialState() {
        this.container.innerHTML = `
            <div class="weather-container">
                <div class="weather-location-input">
                    <input type="text" 
                           class="tool-input" 
                           id="weather-location-${this.id}"
                           placeholder="Enter postal code or city..."
                           style="font-size: 11px;">
                    <button class="tool-btn weather-search-btn" 
                            id="weather-search-${this.id}">
                        <i class="iconoir-search"></i>
                    </button>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #888; font-size: 11px;">
                    Enter a location to get started
                </div>
            </div>
        `;
    }
    
    renderLoadingState() {
        this.container.innerHTML = `
            <div class="weather-container">
                <div class="weather-location-input">
                    <input type="text" 
                           class="tool-input" 
                           id="weather-location-${this.id}"
                           value="${this.currentLocation || ''}"
                           placeholder="Enter postal code or city...">
                    <button class="tool-btn weather-search-btn" 
                            id="weather-search-${this.id}">
                        <i class="iconoir-search"></i>
                    </button>
                </div>
                
                <div class="weather-loading">
                    Loading weather data...
                </div>
            </div>
        `;
    }
    
    renderWeatherDisplay() {
        const weather = this.currentWeatherData;
        const lastUpdated = weather.timestamp ? 
            new Date(weather.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 'Unknown';
        
        this.container.innerHTML = `
            <div class="weather-container">
                <!-- Location Input -->
                <div class="weather-location-input">
                    <input type="text" 
                           class="tool-input" 
                           id="weather-location-${this.id}"
                           value="${this.currentLocation || ''}"
                           placeholder="Enter postal code or city...">
                    <button class="tool-btn weather-search-btn" 
                            id="weather-search-${this.id}">
                        <i class="iconoir-search"></i>
                    </button>
                </div>
                
                <!-- Current Weather Display -->
                <div class="weather-current">
                    <div class="weather-icon-container">
                        <canvas class="weather-icon" 
                                id="weather-icon-${this.id}"
                                width="48" 
                                height="48">
                        </canvas>
                    </div>
                    
                    <div class="weather-details">
                        <div class="weather-location">${this.escapeHtml(weather.location || this.currentLocation || 'Unknown')}</div>
                        <div class="weather-temperature">${Math.round(weather.temperature || 0)}°C</div>
                        <div class="weather-condition">${this.escapeHtml(weather.condition || 'Unknown')}</div>
                        
                        <div class="weather-stats">
                            <div class="weather-stat">
                                <canvas class="weather-stat-icon" id="humidity-icon-${this.id}" width="16" height="16"></canvas>
                                <span class="weather-stat-value">${weather.humidity || 0}%</span>
                            </div>
                            
                            <div class="weather-stat ${this.getUVClass(weather.uvIndex)}">
                                <canvas class="weather-stat-icon" id="uv-icon-${this.id}" width="16" height="16"></canvas>
                                <span class="weather-stat-value">UV ${weather.uvIndex || 0}</span>
                            </div>
                            
                            <div class="weather-stat ${this.getAirQualityClass(weather.airQuality)}">
                                <canvas class="weather-stat-icon" id="wind-icon-${this.id}" width="16" height="16"></canvas>
                                <span class="weather-stat-value">${weather.airQuality || 'N/A'}</span>
                            </div>
                            
                            <div class="weather-stat">
                                <canvas class="weather-stat-icon" id="temp-icon-${this.id}" width="16" height="16"></canvas>
                                <span class="weather-stat-value">${Math.round(weather.feelsLike || weather.temperature || 0)}°</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Weather Actions -->
                <div class="weather-actions">
                    <button class="tool-btn weather-refresh-btn" 
                            id="weather-refresh-${this.id}">
                        <i class="iconoir-refresh"></i>
                    </button>
                    <button class="tool-btn primary weather-details-btn" 
                            id="weather-details-${this.id}">
                        <i class="iconoir-stats-report"></i> Details
                    </button>
                </div>
                
                <div class="weather-last-updated">
                    Updated: ${lastUpdated}
                </div>
            </div>
        `;
        
        // Initialize weather icon animation
        this.initializeWeatherIcon(weather.condition);
    }
    
    renderErrorState(message) {
        this.container.innerHTML = `
            <div class="weather-container">
                <div class="weather-location-input">
                    <input type="text" 
                           class="tool-input" 
                           id="weather-location-${this.id}"
                           value="${this.currentLocation || ''}"
                           placeholder="Enter postal code or city...">
                    <button class="tool-btn weather-search-btn" 
                            id="weather-search-${this.id}">
                        <i class="iconoir-search"></i>
                    </button>
                </div>
                
                <div class="weather-error">
                    <div class="weather-error-icon"><i class="iconoir-warning-triangle"></i></div>
                    <div class="weather-error-message">Weather Unavailable</div>
                    <div class="weather-error-details">${this.escapeHtml(message)}</div>
                </div>
            </div>
        `;
    }
    
    initializeWeatherIcon(condition) {
        if (!this.skycons) {
            this.initializeSkycons();
            // Retry after a short delay if Skycons isn't ready
            setTimeout(() => this.initializeWeatherIcon(condition), 100);
            return;
        }
        
        const iconElement = this.find(`#weather-icon-${this.id}`);
        if (!iconElement) return;
        
        // Map weather condition to Skycons icon
        const skyconType = this.conditionMapping[condition?.toLowerCase()] || 'cloudy';
        
        // Remove existing icon if any
        this.skycons.remove(iconElement);
        
        // Add new icon
        this.skycons.add(iconElement, skyconType);
        
        // Initialize stat icons
        this.initializeStatIcons();
        
        this.skycons.play();
    }
    
    initializeStatIcons() {
        if (!this.skycons) return;
        
        // Humidity - use rain/drizzle icon
        const humidityIcon = this.find(`#humidity-icon-${this.id}`);
        if (humidityIcon) {
            this.skycons.remove(humidityIcon);
            this.skycons.add(humidityIcon, 'rain');
        }
        
        // UV - use sun icon
        const uvIcon = this.find(`#uv-icon-${this.id}`);
        if (uvIcon) {
            this.skycons.remove(uvIcon);
            this.skycons.add(uvIcon, 'clear-day');
        }
        
        // Air Quality - use wind icon
        const windIcon = this.find(`#wind-icon-${this.id}`);
        if (windIcon) {
            this.skycons.remove(windIcon);
            this.skycons.add(windIcon, 'wind');
        }
        
        // Feels Like Temperature - use cloudy for temperature
        const tempIcon = this.find(`#temp-icon-${this.id}`);
        if (tempIcon) {
            this.skycons.remove(tempIcon);
            this.skycons.add(tempIcon, 'cloudy');
        }
    }
    
    bindEvents() {
        const locationInput = this.find(`#weather-location-${this.id}`);
        const searchBtn = this.find(`#weather-search-${this.id}`);
        const refreshBtn = this.find(`#weather-refresh-${this.id}`);
        const detailsBtn = this.find(`#weather-details-${this.id}`);
        
        // Location search
        if (locationInput && searchBtn) {
            const handleSearch = () => {
                const location = locationInput.value.trim();
                if (location) {
                    this.searchLocation(location);
                }
            };
            
            locationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSearch();
                }
            });
            
            searchBtn.addEventListener('click', handleSearch);
        }
        
        // Refresh button
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.currentLocation) {
                    this.refreshWeather();
                }
            });
        }
        
        // Details button
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                this.openDetailsModal();
            });
        }
    }
    
    async searchLocation(location) {
        try {
            this.updateStatus('Fetching Toronto weather...', 'primary', 2000);
            
            // For Phase 1, we're fixed to Toronto regardless of input
            this.currentLocation = 'Toronto, ON';
            
            // Fetch real weather data
            this.currentWeatherData = await this.weatherService.getCurrentWeather();
            
            await this.saveToStorage();
            await this.render();
            this.bindEvents();
            
            this.updateStatus(`Weather loaded for Toronto`, 'success', 3000);
            
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.renderErrorState(error.message);
            this.updateStatus('Weather service failed', 'danger', 3000);
        }
    }
    
    async refreshWeather() {
        if (!this.currentLocation) return;
        
        try {
            this.updateStatus('Refreshing Toronto weather...', 'primary', 2000);
            
            // Clear cache and fetch fresh data
            this.weatherService.clearCache();
            this.currentWeatherData = await this.weatherService.getCurrentWeather();
            
            await this.saveToStorage();
            await this.render();
            this.bindEvents();
            
            this.updateStatus('Weather updated', 'success', 2000);
            
        } catch (error) {
            console.error('Error refreshing weather:', error);
            this.renderErrorState(error.message);
            this.updateStatus('Failed to refresh weather', 'danger', 3000);
        }
    }
    
    /* COMMENTED OUT - Mock weather data for development/testing/screenshots
    async fetchMockWeatherData(location) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const conditions = ['clear', 'partly-cloudy', 'cloudy', 'rain', 'snow'];
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
        
        return {
            location: location,
            temperature: Math.round(Math.random() * 30 - 10), // -10 to 20°C
            feelsLike: Math.round(Math.random() * 30 - 10),
            condition: randomCondition,
            humidity: Math.round(Math.random() * 40 + 40), // 40-80%
            uvIndex: Math.floor(Math.random() * 11), // 0-10
            airQuality: ['Good', 'Moderate', 'Poor'][Math.floor(Math.random() * 3)],
            timestamp: new Date().toISOString()
        };
    }
    */
    
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            if (this.currentLocation && document.visibilityState === 'visible') {
                this.refreshWeather();
            }
        }, this.refreshInterval);
    }
    
    async openDetailsModal() {
        try {
            if (!window.__TAURI__) {
                // Browser fallback - open in new tab
                const url = './weather-details.html';
                window.open(url, '_blank', 'width=700,height=600');
                this.updateStatus('Opened weather details (browser mode)', 'primary', 2000);
                return;
            }

            // Use Tauri window factory pattern
            if (window.__TAURI__.webview && window.__TAURI__.webviewWindow) {
                const { webviewWindow } = window.__TAURI__;
                
                const windowLabel = `weather-details-${Date.now()}`;
                const windowTitle = `${this.currentLocation || 'Weather'} Details - ucanduit`;
                    
                const weatherWindow = new webviewWindow.WebviewWindow(windowLabel, {
                    url: 'weather-details.html',
                    title: windowTitle,
                    width: 700,
                    height: 600,
                    alwaysOnTop: false,
                    decorations: true,
                    transparent: false,
                    titleBarStyle: 'overlay'
                });

                // Handle window events
                weatherWindow.once('tauri://created', () => {
                    console.log('Weather details window created successfully');
                    this.updateStatus('Weather details opened', 'success', 2000);
                });

                weatherWindow.once('tauri://error', (error) => {
                    console.error('Weather details window creation error:', error);
                    this.updateStatus('Failed to open weather details', 'danger', 3000);
                });
                
            } else {
                throw new Error('webviewWindow API not available');
            }

        } catch (error) {
            console.error('Error opening weather details window:', error);
            this.updateStatus('Error: ' + error.message, 'danger', 3000);
            
            // Fallback: open in browser tab
            const fallbackUrl = './weather-details.html';
            window.open(fallbackUrl, '_blank', 'width=700,height=600');
        }
    }
    
    getUVClass(uvIndex) {
        if (uvIndex <= 2) return 'uv-low';
        if (uvIndex <= 5) return 'uv-moderate';
        return 'uv-high';
    }
    
    getAirQualityClass(airQuality) {
        if (!airQuality) return '';
        const quality = airQuality.toLowerCase();
        if (quality.includes('good')) return 'air-good';
        if (quality.includes('moderate')) return 'air-moderate';
        return 'air-poor';
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Method to get weather summary for ticker
    getTickerSummary() {
        if (!this.currentWeatherData || !this.currentLocation) {
            return null;
        }
        
        const weather = this.currentWeatherData;
        const temp = Math.round(weather.temperature || 0);
        const conditionText = this.getConditionText(weather.condition);
        const uv = weather.uvIndex || 0;
        const air = weather.airQuality || 'N/A';
        
        return `${this.currentLocation}: ${temp}°C ${conditionText} UV:${uv} Air:${air}`;
    }
    
    getConditionText(condition) {
        const textMap = {
            'clear': 'Clear',
            'sunny': 'Sunny',
            'partly-cloudy': 'Partly Cloudy',
            'cloudy': 'Cloudy',
            'overcast': 'Overcast',
            'rain': 'Rain',
            'drizzle': 'Drizzle',
            'snow': 'Snow',
            'sleet': 'Sleet',
            'wind': 'Windy',
            'fog': 'Fog',
            'mist': 'Misty'
        };
        
        return textMap[condition?.toLowerCase()] || 'Cloudy';
    }
    
    onInitialized() {
        super.onInitialized();
        
        // If we have a saved location but no weather data, fetch it
        if (this.currentLocation && !this.currentWeatherData) {
            this.refreshWeather();
        }
    }
    
    destroy() {
        // Clean up auto-refresh timer
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        // Clean up Skycons
        if (this.skycons) {
            this.skycons.pause();
            const iconElement = this.find(`#weather-icon-${this.id}`);
            if (iconElement) {
                this.skycons.remove(iconElement);
            }
        }
        
        super.destroy();
    }
}