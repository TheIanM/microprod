/**
 * Weather Service - Environment Canada API Integration
 * Phase 1: Fixed Toronto location for testing real API integration
 * Base URL: https://dd.weather.gc.ca/
 */

// Import Tauri's HTTP client from plugin
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export class WeatherService {
    constructor() {
        this.baseUrl = 'https://dd.weather.gc.ca';
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        
        // Fixed Toronto location for Phase 1 testing
        this.torontoLocation = {
            id: 'on-143',
            name: 'Toronto, ON',
            province: 'ON',
            coordinates: { lat: 43.6532, lon: -79.3832 }
        };
    }
    
    /**
     * Fetch current weather data for Toronto (fixed location for now)
     * @returns {Promise<Object>} Weather data object
     */
    async getCurrentWeather() {
        try {
            const cacheKey = 'weather_toronto';
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log('✅ Toronto weather data served from cache');
                    return cached.data;
                }
            }
            
            // Fetch fresh data from Environment Canada
            const weatherData = await this.fetchTorontoWeatherData();
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });
            
            console.log('✅ Toronto weather data fetched and cached');
            return weatherData;
            
        } catch (error) {
            console.error('❌ Weather service error:', error);
            
            // Check if we have stale cached data
            const cached = this.cache.get('weather_toronto');
            if (cached) {
                console.warn('⚠️ Using stale cached data due to API error');
                return { ...cached.data, isStale: true };
            }
            
            // No cache available - throw error for UI to handle
            throw new Error('Weather service unavailable; have you tried looking out a window?');
        }
    }
    
    /**
     * Fetch weather data from Environment Canada for Toronto
     * @returns {Promise<Object>} Parsed weather data
     */
    async fetchTorontoWeatherData() {
        console.log('🌤️ Fetching live weather data for Toronto from Environment Canada...');
        
        // Try Environment Canada weather endpoints for Toronto
        // Using coordinate-based Atom feeds for detailed weather data
        const endpoints = [
            `https://weather.gc.ca/rss/weather/43.655_-79.383_e.xml`, // Toronto coordinates Atom feed
            `https://weather.gc.ca/rss/city/on-143_e.xml`,            // Ottawa city feed (fallback)
            `https://weather.gc.ca/rss/city/on-118_e.xml`             // Ottawa RSS (fallback)
        ];
        
        let lastError = null;
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.fetchWithTimeout(endpoint, 10000);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const xmlText = await response.text();
                console.log('📄 Raw XML response (first 500 chars):', xmlText.substring(0, 500));
                const weatherData = this.parseEnvironmentCanadaXML(xmlText);
                
                if (weatherData) {
                    return weatherData;
                }
                
                throw new Error('Unable to parse weather data from XML');
                
            } catch (endpointError) {
                console.warn(`⚠️ Failed to fetch from ${endpoint}:`, endpointError.message);
                lastError = endpointError;
                continue;
            }
        }
        
        // All endpoints failed
        throw new Error(`All Environment Canada endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    /**
     * Fetch with Tauri HTTP client (bypasses CORS)
     * @param {string} url - URL to fetch
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} Response with text() method
     */
    async fetchWithTimeout(url, timeout = 10000) {
        try {
            // Check if we're in a Tauri context
            if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
                console.log(`🌐 Using Tauri HTTP plugin for: ${url}`);
                console.log('🔍 Tauri fetch function available:', typeof tauriFetch);
                console.log('🔍 Request details:', {
                    url: url,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/xml, text/xml, */*',
                        'User-Agent': 'ucanduit-weather/1.0'
                    }
                });
                
                const response = await tauriFetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/xml, text/xml, */*',
                        'User-Agent': 'ucanduit-weather/1.0'
                    }
                });
                
                console.log('✅ Tauri fetch successful:', response);
                return response; // Should be Web API compatible
            } else {
                throw new Error('Not in Tauri context, falling back to browser fetch');
            }
            
        } catch (error) {
            // Log detailed error information
            console.error('❌ Tauri HTTP error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                error: error
            });
            
            // No browser fallback for security - Tauri HTTP is required
            throw new Error(`Tauri HTTP request failed: ${error.message || 'Unknown error'}`);
        }
    }
    
    /**
     * Parse Environment Canada RSS XML response
     * @param {string} xmlText - Raw XML response
     * @returns {Object|null} Parsed weather data or null if parsing fails
     */
    parseEnvironmentCanadaXML(xmlText) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            
            // Check for parsing errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XML parsing failed');
            }
            
            // Look for Atom feed structure first (Environment Canada uses Atom)
            const feed = doc.querySelector('feed');
            if (feed) {
                return this.parseAtomWeatherFeed(doc);
            }
            
            // Look for RSS feed structure
            const channel = doc.querySelector('channel');
            if (channel) {
                return this.parseRSSWeatherFeed(doc);
            }
            
            // Fallback to direct weather XML structure
            const currentConditions = doc.querySelector('currentConditions');
            if (currentConditions) {
                return this.parseDirectWeatherXML(doc);
            }
            
            throw new Error('Unknown XML format - not Atom, RSS, or direct weather XML');
            
        } catch (error) {
            console.error('❌ XML parsing error:', error);
            throw new Error(`Failed to parse weather data: ${error.message}`);
        }
    }
    
    /**
     * Parse Atom weather feed format (Environment Canada's preferred format)
     * @param {Document} doc - Parsed XML document
     * @returns {Object} Weather data object
     */
    parseAtomWeatherFeed(doc) {
        console.log('🔍 Parsing Environment Canada Atom feed format...');
        
        // Get feed title for location
        const feedTitle = this.getXMLValue(doc, 'title');
        const locationMatch = feedTitle ? feedTitle.match(/(.+?) - Weather/) : null;
        const location = locationMatch ? locationMatch[1] : 'Unknown Location';
        
        // Find the "Current Conditions" entry and today's forecast entry
        const entries = doc.querySelectorAll('entry');
        let currentConditionsEntry = null;
        let todaysForecastEntry = null;
        
        for (const entry of entries) {
            const category = entry.querySelector('category');
            const title = entry.querySelector('title')?.textContent || '';
            
            if (category && category.getAttribute('term') === 'Current Conditions') {
                currentConditionsEntry = entry;
            } else if (category && category.getAttribute('term') === 'Weather Forecasts') {
                // Look for today's forecast (not tonight)
                if (!title.toLowerCase().includes('night') && !todaysForecastEntry) {
                    todaysForecastEntry = entry;
                }
            }
        }
        
        if (!currentConditionsEntry) {
            throw new Error('No "Current Conditions" entry found in Atom feed');
        }
        
        const entryTitle = currentConditionsEntry.querySelector('title')?.textContent || '';
        const entrySummary = currentConditionsEntry.querySelector('summary')?.textContent || '';
        
        console.log('📋 Current Conditions Entry:', { 
            title: entryTitle, 
            summaryLength: entrySummary.length 
        });
        
        // Parse the detailed CDATA summary which contains all weather data
        const weatherData = this.parseCurrentConditionsSummary(entrySummary);
        
        // Extract UV index from today's forecast if available
        let uvIndex = null;
        if (todaysForecastEntry) {
            const forecastSummary = todaysForecastEntry.querySelector('summary')?.textContent || '';
            console.log('📋 Today\'s forecast summary:', forecastSummary);
            const uvMatch = forecastSummary.match(/UV index (\d+)/i);
            uvIndex = uvMatch ? parseInt(uvMatch[1]) : null;
        }
        
        // Extract temperature and condition from title as backup
        const tempMatch = entryTitle.match(/(-?\d+\.?\d*)°C/);
        const titleTemp = tempMatch ? parseFloat(tempMatch[1]) : null;
        
        const conditionMatch = entryTitle.match(/Current Conditions: (.+?),/);
        const titleCondition = conditionMatch ? conditionMatch[1] : null;
        
        return {
            location: location,
            temperature: weatherData.temperature || titleTemp,
            feelsLike: weatherData.humidex || weatherData.temperature || titleTemp,
            condition: this.normalizeCondition(titleCondition || weatherData.condition),
            humidity: weatherData.humidity,
            uvIndex: uvIndex, // Extracted from today's forecast
            airQuality: weatherData.airQuality,
            windSpeed: weatherData.windSpeed,
            windDirection: weatherData.windDirection,
            pressure: weatherData.pressure,
            visibility: weatherData.visibility,
            dewpoint: weatherData.dewpoint,
            timestamp: new Date().toISOString(),
            source: 'Environment Canada Current Conditions',
            locationId: 'coordinates-based',
            rawTitle: entryTitle,
            rawSummary: entrySummary.substring(0, 300),
            observedAt: weatherData.observedAt
        };
    }
    
    /**
     * Parse the detailed current conditions HTML summary
     * @param {string} summaryHtml - HTML content from CDATA section
     * @returns {Object} Extracted weather data
     */
    parseCurrentConditionsSummary(summaryHtml) {
        const data = {};
        
        // Extract observed location and time
        const observedMatch = summaryHtml.match(/<b>Observed at:<\/b>\s*(.+?)<br\/>/);
        data.observedAt = observedMatch ? observedMatch[1].trim() : null;
        
        // Extract condition
        const conditionMatch = summaryHtml.match(/<b>Condition:<\/b>\s*(.+?)<br\/>/);
        data.condition = conditionMatch ? conditionMatch[1].trim() : null;
        
        // Extract temperature
        const tempMatch = summaryHtml.match(/<b>Temperature:<\/b>\s*(-?\d+\.?\d*)&deg;C/);
        data.temperature = tempMatch ? parseFloat(tempMatch[1]) : null;
        
        // Extract pressure
        const pressureMatch = summaryHtml.match(/<b>Pressure \/ Tendency:<\/b>\s*([\d.]+)\s*kPa/);
        data.pressure = pressureMatch ? parseFloat(pressureMatch[1]) : null;
        
        // Extract visibility
        const visibilityMatch = summaryHtml.match(/<b>Visibility:<\/b>\s*([\d.]+)\s*km/);
        data.visibility = visibilityMatch ? parseFloat(visibilityMatch[1]) : null;
        
        // Extract humidity
        const humidityMatch = summaryHtml.match(/<b>Humidity:<\/b>\s*(\d+)\s*%/);
        data.humidity = humidityMatch ? parseInt(humidityMatch[1]) : null;
        
        // Extract humidex (feels like)
        const humidexMatch = summaryHtml.match(/<b>Humidex:<\/b>\s*(\d+)/);
        data.humidex = humidexMatch ? parseInt(humidexMatch[1]) : null;
        
        // Extract dewpoint
        const dewpointMatch = summaryHtml.match(/<b>Dewpoint:<\/b>\s*(-?\d+\.?\d*)&deg;C/);
        data.dewpoint = dewpointMatch ? parseFloat(dewpointMatch[1]) : null;
        
        // Extract wind
        const windMatch = summaryHtml.match(/<b>Wind:<\/b>\s*([A-Z]+)\s*(\d+)\s*km\/h/);
        if (windMatch) {
            data.windDirection = windMatch[1];
            data.windSpeed = parseInt(windMatch[2]);
        }
        
        // Extract air quality and convert AQHI number to description
        const aqiMatch = summaryHtml.match(/<b>Air Quality Health Index:<\/b>\s*(\d+)/);
        if (aqiMatch) {
            const aqhi = parseInt(aqiMatch[1]);
            // Convert AQHI numeric scale to text description
            if (aqhi >= 1 && aqhi <= 3) data.airQuality = 'Good';
            else if (aqhi >= 4 && aqhi <= 6) data.airQuality = 'Moderate';
            else if (aqhi >= 7 && aqhi <= 10) data.airQuality = 'High';
            else if (aqhi >= 11) data.airQuality = 'Very High';
            else data.airQuality = 'Good'; // fallback for 0 or invalid
        } else {
            data.airQuality = null;
        }
        
        console.log('🔬 Parsed weather data:', data);
        return data;
    }
    
    /**
     * Parse RSS weather feed format
     * @param {Document} doc - Parsed XML document
     * @returns {Object} Weather data object
     */
    parseRSSWeatherFeed(doc) {
        const title = this.getXMLValue(doc, 'title');
        const description = this.getXMLValue(doc, 'description');
        
        // Get the first item which contains current conditions
        const firstItem = doc.querySelector('item');
        if (!firstItem) {
            throw new Error('No weather items found in RSS feed');
        }
        
        const itemTitle = firstItem.querySelector('title')?.textContent || '';
        const itemDescription = firstItem.querySelector('description')?.textContent || '';
        
        // Extract temperature from title (usually format: "Current Conditions: -2°C")
        const tempMatch = itemTitle.match(/(-?\d+)°C/);
        const temperature = tempMatch ? parseFloat(tempMatch[1]) : null;
        
        // Extract condition from title or description
        let condition = 'cloudy';
        if (itemTitle.toLowerCase().includes('clear')) condition = 'clear';
        else if (itemTitle.toLowerCase().includes('cloud')) condition = 'cloudy';
        else if (itemTitle.toLowerCase().includes('rain')) condition = 'rain';
        else if (itemTitle.toLowerCase().includes('snow')) condition = 'snow';
        else if (itemTitle.toLowerCase().includes('partly')) condition = 'partly-cloudy';
        
        // Extract location from channel title
        const channelTitle = this.getXMLValue(doc, 'channel > title') || 'Unknown Location';
        const locationMatch = channelTitle.match(/Weather for (.+?) \(/);
        const location = locationMatch ? locationMatch[1] : 'Toronto, ON';
        
        if (!temperature && temperature !== 0) {
            throw new Error('Unable to extract temperature from RSS feed');
        }
        
        return {
            location: location,
            temperature: temperature,
            feelsLike: temperature, // RSS feeds don't usually include feels-like
            condition: condition,
            humidity: null, // Not available in basic RSS
            uvIndex: null,
            airQuality: null,
            windSpeed: null,
            windDirection: null,
            pressure: null,
            visibility: null,
            timestamp: new Date().toISOString(),
            source: 'Environment Canada RSS',
            locationId: 'on-143',
            rawTitle: itemTitle,
            rawDescription: itemDescription
        };
    }
    
    /**
     * Parse direct weather XML format (fallback)
     * @param {Document} doc - Parsed XML document
     * @returns {Object} Weather data object
     */
    parseDirectWeatherXML(doc) {
        // Extract key weather data
        const temperature = this.getXMLValue(doc, 'temperature');
        const condition = this.getXMLValue(doc, 'condition');
        const humidity = this.getXMLValue(doc, 'relativeHumidity');
        const pressure = this.getXMLValue(doc, 'pressure');
        const visibility = this.getXMLValue(doc, 'visibility');
        const windSpeed = this.getXMLValue(doc, 'windSpeed');
        const windDirection = this.getXMLValue(doc, 'windDirection');
        
        // Validate essential data
        if (!temperature || !condition) {
            throw new Error('Missing essential weather data');
        }
        
        return {
            location: 'Toronto, ON',
            temperature: parseFloat(temperature),
            feelsLike: parseFloat(temperature),
            condition: this.normalizeCondition(condition),
            humidity: parseInt(humidity) || null,
            uvIndex: null,
            airQuality: null,
            windSpeed: parseFloat(windSpeed) || null,
            windDirection: windDirection || null,
            pressure: parseFloat(pressure) || null,
            visibility: parseFloat(visibility) || null,
            timestamp: new Date().toISOString(),
            source: 'Environment Canada Direct',
            locationId: 'on-143'
        };
    }
    
    /**
     * Extract value from XML document
     * @param {Document} doc - XML document
     * @param {string} tagName - Tag name to search for
     * @returns {string|null} Text content or null
     */
    getXMLValue(doc, tagName) {
        const element = doc.querySelector(tagName);
        return element ? element.textContent.trim() : null;
    }
    
    /**
     * Normalize weather condition text to standard format
     * @param {string} condition - Raw condition from API
     * @returns {string} Normalized condition
     */
    normalizeCondition(condition) {
        if (!condition) return 'cloudy';
        
        const normalized = condition.toLowerCase().trim();
        
        if (normalized.includes('clear') || normalized.includes('sunny')) return 'clear';
        if (normalized.includes('partly') || normalized.includes('partial')) return 'partly-cloudy';
        if (normalized.includes('cloud')) return 'cloudy';
        if (normalized.includes('rain') || normalized.includes('shower')) return 'rain';
        if (normalized.includes('snow') || normalized.includes('flurr')) return 'snow';
        if (normalized.includes('thunder') || normalized.includes('storm')) return 'thunderstorm';
        if (normalized.includes('fog') || normalized.includes('mist')) return 'fog';
        if (normalized.includes('wind')) return 'wind';
        
        return 'cloudy'; // Default fallback
    }
    
    /**
     * Clear cached weather data
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Weather cache cleared');
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache information
     */
    getCacheStats() {
        const entries = Array.from(this.cache.entries());
        const validEntries = entries.filter(([key, value]) => 
            Date.now() - value.timestamp < this.cacheTimeout
        );
        
        return {
            totalEntries: entries.length,
            validEntries: validEntries.length,
            cacheTimeoutMinutes: this.cacheTimeout / 1000 / 60
        };
    }
}