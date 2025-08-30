/**
 * Base class for audio tools with shared slider management and UI functionality
 * Provides common methods for slider restoration, event binding, and lifecycle management
 */

export class AudioToolBase {
    constructor(container) {
        this.container = container;
        this.sounds = {};
        this.isInitialized = false;
        this.startSleepWakeDetection();
    }
    
    // Sleep/wake detection using requestAnimationFrame timing
    startSleepWakeDetection() {
        let lastTime = Date.now();
        const checkSleep = async () => {
            const currentTime = Date.now();
            if (currentTime - lastTime > 10000) { // 10+ second gap indicates system sleep
                console.log(`[${this.constructor.name}] Wake detected, checking audio context...`);
                // Resume this instance's audio context
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    try {
                        await this.audioContext.resume();
                        console.log(`[${this.constructor.name}] Audio context resumed after wake`);
                    } catch (error) {
                        console.error(`[${this.constructor.name}] Failed to resume audio context:`, error);
                    }
                }
            }
            lastTime = currentTime;
            requestAnimationFrame(checkSleep);
        };
        checkSleep();
    }
    
    // Abstract method - subclasses must implement
    getSoundVolumeForSlider(sound) {
        throw new Error('getSoundVolumeForSlider must be implemented by subclass');
    }
    
    // Abstract method - subclasses must implement  
    updateVolumeMethod(soundName, volume) {
        throw new Error('updateVolumeMethod must be implemented by subclass');
    }
    
    // Shared slider event binding
    bindSliderEvents() {
        console.log(`[${this.constructor.name}] bindSliderEvents() called`);
        const sliders = this.container.querySelectorAll('.volume-slider');
        console.log(`[${this.constructor.name}] Found ${sliders.length} sliders in DOM`);
        
        sliders.forEach((slider, index) => {
            const soundName = slider.getAttribute('data-sound');
            console.log(`[${this.constructor.name}] Binding slider ${index}: ${soundName}`);
            
            slider.addEventListener('input', (e) => {
                const soundName = e.target.getAttribute('data-sound');
                const volume = parseInt(e.target.value);
                this.updateVolumeMethod(soundName, volume);
            });
        });
        
        // Restore slider states if audio is currently playing
        console.log(`[${this.constructor.name}] About to call restoreSliderStates()`);
        this.restoreSliderStates();
    }
    
    // Shared slider state restoration logic
    restoreSliderStates() {
        console.log(`[${this.constructor.name}] Restoring slider states...`);
        console.log(`[${this.constructor.name}] Available sounds:`, Object.keys(this.sounds));
        console.log(`[${this.constructor.name}] Sounds object:`, this.sounds);
        console.log(`[${this.constructor.name}] isInitialized:`, this.isInitialized);
        
        const sliders = this.container.querySelectorAll('.volume-slider');
        console.log(`[${this.constructor.name}] Sliders found:`, sliders.length);
        
        // If sounds object is empty but we have sliders, we need to initialize first
        if (Object.keys(this.sounds).length === 0) {
            if (sliders.length > 0) {
                console.log(`[${this.constructor.name}] Sounds object empty but sliders exist - initializing first`);
                // Call initialization asynchronously to populate sounds
                if (typeof this.initialize === 'function' && !this.isInitialized) {
                    this.initialize().then(() => {
                        console.log(`[${this.constructor.name}] Initialization complete, retrying slider restore`);
                        this.restoreSliderStatesInternal();
                    }).catch(error => {
                        console.error(`[${this.constructor.name}] Initialization failed:`, error);
                    });
                    return;
                }
            }
        } else {
            console.log(`[${this.constructor.name}] Sounds object has ${Object.keys(this.sounds).length} entries`);
        }
        
        this.restoreSliderStatesInternal();
    }
    
    // Internal method for actual slider restoration
    restoreSliderStatesInternal() {
        for (const [soundName, sound] of Object.entries(this.sounds)) {
            if (sound) {
                // Get volume from subclass-specific method
                const volumePercent = this.getSoundVolumeForSlider(sound);
                console.log(`[${this.constructor.name}] Sound ${soundName}: ${volumePercent}%`);
                
                const slider = this.container.querySelector(`[data-sound="${soundName}"]`);
                console.log(`[${this.constructor.name}] Slider for ${soundName}:`, slider ? 'found' : 'NOT FOUND');
                
                if (slider && volumePercent > 0) {
                    slider.value = volumePercent;
                    
                    // Also restore visual scale
                    const scale = 1 + (volumePercent / 100) * 0.5;
                    slider.style.setProperty('--thumb-scale', scale);
                    
                    console.log(`✅ Restored ${soundName} slider to ${volumePercent}%`);
                } else if (slider && volumePercent === 0) {
                    // Still log for debugging - slider exists but volume is 0
                    console.log(`⚪ ${soundName} slider exists but volume is 0%`);
                } else if (!slider) {
                    console.log(`❌ No slider found for ${soundName}`);
                }
            }
        }
    }
    
    // Shared slider visual scaling update
    updateSliderScale(soundName, volume) {
        const slider = this.container.querySelector(`[data-sound="${soundName}"]`);
        if (slider) {
            const scale = 1 + (volume / 100) * 0.5;
            slider.style.setProperty('--thumb-scale', scale);
        }
    }
    
    // Shared CSS styles for sliders
    getSliderStyles() {
        return `
            <style>
                /* Volume slider specific overrides for the shared .slider class */
                .volume-slider {
                    --thumb-scale: 1;
                }
                
                .volume-slider::-webkit-slider-thumb {
                    transform: scale(var(--thumb-scale));
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .volume-slider::-moz-range-thumb {
                    transform: scale(var(--thumb-scale));
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                .volume-slider::-ms-thumb {
                    transform: scale(var(--thumb-scale));
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                /* Responsive styles */
                @media (max-height: 250px) {
                    .sound-controls, .noise-controls { 
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 12px !important;
                        margin: 6px 0 !important;
                        padding: 0 !important;
                        flex-wrap: nowrap !important;
                        overflow-x: auto !important;
                    }
                    .sound-item, .noise-item { 
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 4px !important;
                        min-width: 70px !important;
                        flex-shrink: 0 !important;
                    }
                    .sound-label, .noise-label { 
                        font-size: 9px !important; 
                        text-align: center !important;
                        white-space: nowrap !important;
                    }
                    .volume-slider { 
                        height: 6px !important;
                        width: 100% !important;
                    }
                    .volume-slider::-webkit-slider-thumb {
                        width: 16px !important;
                        height: 16px !important;
                    }
                    .volume-slider::-moz-range-thumb {
                        width: 16px !important;
                        height: 16px !important;
                    }
                }

                @media (max-width: 250px) {
                    .sound-controls, .noise-controls { 
                        grid-template-columns: 1fr !important; 
                        gap: 6px !important;
                    }
                    .sound-label, .noise-label { font-size: 10px !important; }
                    .volume-slider { height: 4px !important; }
                }
            </style>
        `;
    }
    
    // Shared UI cleanup method 
    destroyUI() {
        // Clear DOM but preserve audio state
        if (this.container) {
            this.container.innerHTML = '';
        }
        console.log(`${this.constructor.name} UI destroyed, audio preserved`);
    }
    
    // Shared full cleanup method - calls subclass-specific cleanup
    destroy() {
        // Stop all sounds using subclass method
        if (this.stopAllSounds) {
            this.stopAllSounds();
        } else {
            // Fallback: stop sounds generically
            Object.keys(this.sounds).forEach(soundName => {
                if (this.stopSound) {
                    this.stopSound(soundName);
                }
            });
        }
        
        // Close audio context if available
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // Clear DOM
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove from global references based on class type
        this.removeGlobalReference();
        
        console.log(`${this.constructor.name} fully destroyed`);
    }
    
    // Remove global reference - subclasses can override
    removeGlobalReference() {
        // Default implementation - subclasses should override
        if (window.childFocusNoise === this) {
            window.childFocusNoise = null;
        }
        if (window.childAmbientNoise === this) {
            window.childAmbientNoise = null;
        }
    }
    
    // Shared method to generate visualization data
    generateVisualizationData(bufferLength = 256) {
        const combinedData = new Uint8Array(bufferLength);
        let hasActiveSound = false;
        const time = Date.now() * 0.001;
        
        // Subclasses can override this to provide specific visualization logic
        return { combinedData, hasActiveSound };
    }
}