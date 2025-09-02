/**
 * Animated Background Module
 * Creates breathing animated circles for ucanduit windows
 * Usage: import { createAnimatedBackground } from './animated-background.js';
 *        createAnimatedBackground();
 */

/**
 * Creates animated breathing circles in the background
 * @param {Object} options - Configuration options
 * @param {string} options.containerId - ID of the container element (default: animated-background)
 * @param {Array} options.circles - Array of circle configurations to override defaults
 */
export function createAnimatedBackground(options = {}) {
    const { 
        containerId = 'animated-background',
        circles = getDefaultCircles()
    } = options;
    
    const container = document.getElementById(containerId) || document.querySelector('.animated-background');
    if (!container) {
        console.warn('Animated background container not found');
        return;
    }
    
    // Clear existing circles
    container.innerHTML = '';
    
    // Create circles
    circles.forEach(circle => {
        const div = document.createElement('div');
        div.className = 'animated-circle';
        div.style.width = circle.size + 'px';
        div.style.height = circle.size + 'px';
        div.style.background = `radial-gradient(circle, ${circle.colors.join(', ')})`;
        div.style.animationDelay = circle.delay;
        
        // Position the circle
        if (circle.top) div.style.top = circle.top;
        if (circle.bottom) div.style.bottom = circle.bottom;
        if (circle.left) div.style.left = circle.left;
        if (circle.right) div.style.right = circle.right;
        
        container.appendChild(div);
    });
}

/**
 * Returns the default circle configuration
 * @returns {Array} Array of circle configurations
 */
export function getDefaultCircles() {
    return [
        { 
            size: 200, 
            top: '20%', 
            left: '10%', 
            colors: ['var(--udu-green)', 'var(--candu-blue)'], 
            delay: '0s' 
        },
        { 
            size: 150, 
            top: '60%', 
            right: '15%', 
            colors: ['var(--perfect-pink)', 'var(--please-purple)'], 
            delay: '7s' 
        },
        { 
            size: 120, 
            top: '10%', 
            right: '30%', 
            colors: ['var(--oh-orange)', 'var(--woohoo-red)'], 
            delay: '14s' 
        },
        { 
            size: 180, 
            bottom: '20%', 
            left: '25%', 
            colors: ['var(--candu-blue)', 'var(--please-purple)'], 
            delay: '3s' 
        },
        { 
            size: 100, 
            top: '40%', 
            left: '50%', 
            colors: ['var(--udu-green)', 'var(--perfect-pink)'], 
            delay: '10s' 
        }
    ];
}

/**
 * Creates circle configurations for different window types and sizes
 * @param {string} windowType - Type of window ('small', 'medium', 'large', 'kanban', 'timer', 'memo', 'weather')
 * @param {Object} options - Optional overrides for circle properties
 * @returns {Array} Array of circle configurations optimized for the window type
 */
export function getWindowCircles(windowType = 'default', options = {}) {
    const colorPalettes = {
        primary: ['var(--udu-green)', 'var(--candu-blue)'],
        secondary: ['var(--perfect-pink)', 'var(--please-purple)'],
        tertiary: ['var(--oh-orange)', 'var(--woohoo-red)'],
        quaternary: ['var(--candu-blue)', 'var(--perfect-pink)'],
        quinary: ['var(--please-purple)', 'var(--udu-green)']
    };

    const configurations = {
        small: [
            { size: 80, top: '15%', left: '15%', colors: colorPalettes.primary, delay: '0s' },
            { size: 60, top: '70%', right: '20%', colors: colorPalettes.secondary, delay: '4s' },
            { size: 70, top: '40%', right: '40%', colors: colorPalettes.tertiary, delay: '8s' }
        ],
        medium: [
            { size: 120, top: '15%', left: '15%', colors: colorPalettes.primary, delay: '0s' },
            { size: 100, top: '70%', right: '20%', colors: colorPalettes.secondary, delay: '5s' },
            { size: 80, top: '20%', right: '40%', colors: colorPalettes.tertiary, delay: '10s' }
        ],
        large: [
            { size: 140, top: '10%', left: '10%', colors: colorPalettes.primary, delay: '0s' },
            { size: 120, top: '20%', right: '15%', colors: colorPalettes.quaternary, delay: '4s' },
            { size: 160, bottom: '15%', left: '40%', colors: colorPalettes.secondary, delay: '8s' },
            { size: 110, bottom: '25%', right: '20%', colors: colorPalettes.quinary, delay: '2s' },
            { size: 90, top: '60%', left: '80%', colors: colorPalettes.tertiary, delay: '6s' }
        ],
        default: [
            { size: 100, top: '20%', left: '15%', colors: colorPalettes.primary, delay: '0s' },
            { size: 80, bottom: '20%', right: '15%', colors: colorPalettes.secondary, delay: '5s' },
            { size: 90, top: '50%', left: '50%', colors: colorPalettes.tertiary, delay: '10s' }
        ]
    };

    // Alias common window types to size categories
    const windowTypeMap = {
        'timer': 'small',
        'memo': 'medium', 
        'weather': 'medium',
        'kanban': 'large',
        'settings': 'medium',
        'audio': 'small'
    };

    const configKey = windowTypeMap[windowType] || windowType;
    const baseConfig = configurations[configKey] || configurations.default;

    // Apply any overrides from options
    return baseConfig.map(circle => ({ ...circle, ...options }));
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use getWindowCircles('small') instead
 */
export function getSmallWindowCircles() {
    return getWindowCircles('small');
}

/**
 * Auto-initialize animated background when DOM is loaded
 * Call this function to automatically create backgrounds on page load
 */
export function autoInitAnimatedBackground(options = {}) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => createAnimatedBackground(options));
    } else {
        createAnimatedBackground(options);
    }
}