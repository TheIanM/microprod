// Window Management Utilities
// Modular window sizing and positioning functions for ucanduit

class WindowManager {
    constructor() {
        this.currentWindow = null;
        this.isReady = false;
        this.screenInfo = null;
    }

    // Screen calculation utilities
    async getScreenInfo() {
        try {
            const currentPos = await window.tauriWindow.outerPosition();
            console.log('Current window position:', currentPos);
            
            // Import monitor functions from Tauri API
            const { availableMonitors, currentMonitor: getCurrentMonitor } = window.__TAURI__ ? 
                window.__TAURI__.window : 
                await import('https://cdn.skypack.dev/@tauri-apps/api/window');
            
            const monitors = await availableMonitors();
            console.log('Available monitors count:', monitors.length);
            monitors.forEach((monitor, index) => {
                console.log(`Monitor ${index}:`, {
                    name: monitor.name,
                    size: monitor.size,
                    position: monitor.position,
                    scaleFactor: monitor.scaleFactor
                });
            });
            
            let currentMonitor = null;
            for (const monitor of monitors) {
                const monitorLeft = monitor.position.x;
                const monitorRight = monitor.position.x + monitor.size.width;
                const monitorTop = monitor.position.y;
                const monitorBottom = monitor.position.y + monitor.size.height;
                
                if (currentPos.x >= monitorLeft && currentPos.x < monitorRight &&
                    currentPos.y >= monitorTop && currentPos.y < monitorBottom) {
                    currentMonitor = monitor;
                    break;
                }
            }
            
            if (!currentMonitor) {
                console.log('Position-based detection failed, using currentMonitor()');
                currentMonitor = await getCurrentMonitor();
            }
            
            if (currentMonitor) {
                console.log('Using monitor:', currentMonitor);
                const scaleFactor = currentMonitor.scaleFactor || 1;
                const logicalWidth = currentMonitor.size.width / scaleFactor;
                const logicalHeight = currentMonitor.size.height / scaleFactor;
                
                console.log('Scale factor conversion:');
                console.log('- Physical size:', currentMonitor.size.width, 'x', currentMonitor.size.height);
                console.log('- Scale factor:', scaleFactor);
                console.log('- Logical size:', logicalWidth, 'x', logicalHeight);
                
                return {
                    width: logicalWidth,
                    height: logicalHeight,
                    scaleFactor: scaleFactor,
                    position: currentMonitor.position
                };
            }
        } catch (error) {
            console.error('Error getting screen info:', error);
        }
        return { width: 1440, height: 900, scaleFactor: 1, position: { x: 0, y: 0 } };
    }
    
    calculateWindowSizes(screenWidth, screenHeight, monitorPosition = { x: 0, y: 0 }) {
        const topMargin = 10;
        const bottomMargin = 80;
        const leftMargin = 10;
        const rightMargin = 10;
        
        const usableWidth = screenWidth - leftMargin - rightMargin;
        const usableHeight = screenHeight - topMargin - bottomMargin;
        
        const horizontalConfig = {
            width: usableWidth,
            height: 200,
            x: monitorPosition.x + leftMargin,
            y: monitorPosition.y + topMargin
        };
        
        const verticalConfig = {
            width: 200,
            height: usableHeight,
            x: monitorPosition.x + leftMargin,
            y: monitorPosition.y + topMargin
        };
        
        horizontalConfig.width = Math.max(horizontalConfig.width, 400);
        horizontalConfig.height = Math.max(horizontalConfig.height, 150);
        
        verticalConfig.width = Math.max(verticalConfig.width, 180);
        verticalConfig.height = Math.max(verticalConfig.height, 400);
        
        horizontalConfig.width = Math.min(horizontalConfig.width, screenWidth - 20);
        horizontalConfig.height = Math.min(horizontalConfig.height, screenHeight - 100);
        
        verticalConfig.width = Math.min(verticalConfig.width, screenWidth - 20);
        verticalConfig.height = Math.min(verticalConfig.height, screenHeight - 100);
        
        console.log('=== WINDOW SIZE CALCULATION DEBUG ===');
        console.log('Input values:');
        console.log('- screenWidth:', screenWidth);
        console.log('- screenHeight:', screenHeight);
        console.log('- monitorPosition:', monitorPosition);
        console.log('Margin calculations:');
        console.log('- topMargin:', topMargin, 'bottomMargin:', bottomMargin);
        console.log('- leftMargin:', leftMargin, 'rightMargin:', rightMargin);
        console.log('- usableWidth:', usableWidth, '(', screenWidth, '-', leftMargin, '-', rightMargin, ')');
        console.log('- usableHeight:', usableHeight, '(', screenHeight, '-', topMargin, '-', bottomMargin, ')');
        console.log('Initial configs:');
        console.log('- horizontalConfig.width (initial):', horizontalConfig.width);
        console.log('- horizontalConfig after min constraint:', Math.max(horizontalConfig.width, 400));
        console.log('- horizontalConfig after max constraint:', Math.min(Math.max(horizontalConfig.width, 400), screenWidth - 20));
        console.log('Final configs:');
        console.log('- Horizontal:', horizontalConfig);
        console.log('- Vertical:', verticalConfig);
        console.log('=== END WINDOW SIZE CALCULATION DEBUG ===');
        
        return { horizontal: horizontalConfig, vertical: verticalConfig };
    }
    
    async initializeWindow() {
        try {
            console.log('Checking for Tauri APIs...');
            console.log('window.__TAURI__:', window.__TAURI__);
            
            let getCurrentWindow, LogicalSize;
            
            if (window.__TAURI__) {
                getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
                LogicalSize = window.__TAURI__.window.LogicalSize;
                console.log('Using __TAURI__ global');
            } else {
                try {
                    const { getCurrentWindow: getCurrent } = await import('https://cdn.skypack.dev/@tauri-apps/api/window');
                    const { LogicalSize: Size } = await import('https://cdn.skypack.dev/@tauri-apps/api/window');
                    getCurrentWindow = getCurrent;
                    LogicalSize = Size;
                    console.log('Using dynamic import');
                } catch (importError) {
                    console.error('Failed to import Tauri APIs:', importError);
                    throw new Error('Tauri APIs not available via any method');
                }
            }
            
            console.log('getCurrentWindow:', getCurrentWindow);
            console.log('LogicalSize:', LogicalSize);
            
            this.currentWindow = getCurrentWindow();
            this.isReady = true;
            console.log('Window initialized successfully');
            
            window.tauriWindow = this.currentWindow;
            window.tauriLogicalSize = LogicalSize;
            
            this.screenInfo = await this.getScreenInfo();
            console.log('Screen info:', this.screenInfo);
            
            const windowConfigs = this.calculateWindowSizes(this.screenInfo.width, this.screenInfo.height, this.screenInfo.position);
            window.windowConfigs = windowConfigs;
            
            document.getElementById('status-badge').textContent = 'Screen analyzed! Switching to optimal vertical mode...';
            
            setTimeout(async () => {
                await this.resizeVertical();
                
                // Show window after resize is complete to prevent visual tearing
                try {
                    await window.tauriWindow.show();
                    console.log('Window revealed after successful initialization');
                } catch (error) {
                    console.warn('Could not show window:', error);
                    // Fallback: try to show anyway in case of API issues
                    try {
                        await window.tauriWindow.setVisible(true);
                    } catch (fallbackError) {
                        console.error('Both show methods failed:', fallbackError);
                    }
                }
            }, 500);
            
        } catch (error) {
            console.error('Error initializing window:', error);
            document.getElementById('status-badge').textContent = 'Error: ' + error.message;
            
            // Show window even on error to prevent it from staying hidden
            try {
                if (window.tauriWindow) {
                    await window.tauriWindow.show();
                    console.log('Window shown despite initialization error');
                }
            } catch (showError) {
                console.error('Could not show window after error:', showError);
            }
        }
    }
    
    // Window resize functions
    async resizeHorizontal() {
        console.log('=== HORIZONTAL MODE DEBUG ===');
        console.log('resizeHorizontal called, isReady:', this.isReady);
        if (!this.isReady || !window.tauriWindow || !window.tauriLogicalSize) {
            alert('Window APIs not ready yet');
            return;
        }
        try {
            console.log('Getting current screen info for horizontal mode...');
            const currentScreenInfo = await this.getScreenInfo();
            console.log('Screen info retrieved:', currentScreenInfo);
            
            console.log('Calculating window sizes...');
            const currentConfigs = this.calculateWindowSizes(currentScreenInfo.width, currentScreenInfo.height, currentScreenInfo.position);
            const config = currentConfigs.horizontal;
            
            console.log('HORIZONTAL CONFIG DETAILS:');
            console.log('- Screen width:', currentScreenInfo.width);
            console.log('- Screen height:', currentScreenInfo.height);
            console.log('- Monitor position:', currentScreenInfo.position);
            console.log('- Calculated width:', config.width);
            console.log('- Calculated height:', config.height);
            console.log('- Target position:', config.x, config.y);
            console.log('- Full config object:', config);
            
            const newSize = new window.tauriLogicalSize(config.width, config.height);
            console.log('Created LogicalSize:', newSize);
            await window.tauriWindow.setSize(newSize);
            console.log('Size set successfully');
            
            const { LogicalPosition } = window.__TAURI__ ? window.__TAURI__.window : 
                await import('https://cdn.skypack.dev/@tauri-apps/api/window');
            
            const newPosition = new LogicalPosition(config.x, config.y);
            console.log('Created LogicalPosition:', newPosition);
            await window.tauriWindow.setPosition(newPosition);
            console.log('Position set successfully');
            
            console.log(`✅ Resized to horizontal mode: ${config.width}x${config.height} at position ${config.x},${config.y}`);
            console.log('=== END HORIZONTAL MODE DEBUG ===');
            document.getElementById('status-badge').textContent = `Horizontal Mode - ${config.width}x${config.height}`;
            
            // Ensure window is visible (in case it was hidden during startup)
            try {
                await window.tauriWindow.show();
            } catch (error) {
                console.warn('Could not ensure window visibility:', error);
            }
        } catch (error) {
            console.error('❌ Error resizing horizontally:', error);
            console.error('Error stack:', error.stack);
            alert('Error: ' + error.message);
        }
    }
    
    async resizeVertical() {
        console.log('resizeVertical called, isReady:', this.isReady);
        if (!this.isReady || !window.tauriWindow || !window.tauriLogicalSize) {
            alert('Window APIs not ready yet');
            return;
        }
        try {
            const currentScreenInfo = await this.getScreenInfo();
            const currentConfigs = this.calculateWindowSizes(currentScreenInfo.width, currentScreenInfo.height, currentScreenInfo.position);
            const config = currentConfigs.vertical;
            
            console.log('Using vertical config for current monitor:', config);
            
            const newSize = new window.tauriLogicalSize(config.width, config.height);
            await window.tauriWindow.setSize(newSize);
            
            const { LogicalPosition } = window.__TAURI__ ? window.__TAURI__.window : 
                await import('https://cdn.skypack.dev/@tauri-apps/api/window');
            
            const newPosition = new LogicalPosition(config.x, config.y);
            await window.tauriWindow.setPosition(newPosition);
            
            console.log(`Resized to vertical mode: ${config.width}x${config.height} at position ${config.x},${config.y}`);
            document.getElementById('status-badge').textContent = `Vertical Mode - ${config.width}x${config.height}`;
        } catch (error) {
            console.error('Error resizing vertically:', error);
            alert('Error: ' + error.message);
        }
    }
    
    async resetSize() {
        console.log('resetSize called - resetting to default vertical mode');
        await this.resizeVertical();
    }
}

// Create global instance
window.windowManager = new WindowManager();

// Export window management functions to global scope for backwards compatibility
window.resizeHorizontal = () => window.windowManager.resizeHorizontal();
window.resizeVertical = () => window.windowManager.resizeVertical();
window.resetSize = () => window.windowManager.resetSize();

export { WindowManager };