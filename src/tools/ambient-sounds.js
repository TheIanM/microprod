/**
 * Focus Noise Generator Tool - ES6 Module
 * Handles procedural noise generation for focus and concentration
 */

import { AudioToolBase } from './audio-tool-base.js';

// Standalone Noise Generator class
class NoiseGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }
    
    generateNoise(type, config) {
        const bufferSize = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                let sample = (Math.random() * 2 - 1) * 0.4;
                const normalizedPos = i / bufferSize;
                if (config.frequency < 120) {
                    sample += (Math.random() * 2 - 1) * 0.3 * Math.sin(normalizedPos * Math.PI * 8);
                } else if (config.frequency > 120) {
                    sample += (Math.random() * 2 - 1) * 0.25 * Math.sin(normalizedPos * Math.PI * 12);
                }
                data[i] = Math.max(-0.9, Math.min(0.9, sample));
            }
        } else if (type === 'pink') {
            let b0, b1, b2, b3, b4, b5, b6;
            b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = (Math.random() * 2 - 1) * 0.6;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.15;
                b6 = white * 0.115926;
            }
        } else if (type === 'brown') {
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = (Math.random() * 2 - 1) * 0.5;
                data[i] = (lastOut + (0.21 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 1.8;
            }
        }
        
        const fadeLength = Math.floor(bufferSize * 0.01);
        for (let i = 0; i < fadeLength; i++) {
            const fadeIn = i / fadeLength;
            const fadeOut = (fadeLength - i) / fadeLength;
            data[i] *= fadeIn;
            data[bufferSize - 1 - i] *= fadeOut;
        }
        
        return buffer;
    }
}

export class FocusNoiseGeneratorTool extends AudioToolBase {
    constructor(container) {
        super(container);
        this.audioContext = null;
        this.masterGain = null;
        this.noiseGenerator = null;
        
        // Noise generator configurations
        this.soundConfigs = {
            'white-noise': { frequency: 800, type: 'white', baseGain: 0.4 },
            'brown-noise': { frequency: 300, type: 'brown', baseGain: 0.45 }
        };
        
        this.render();
        this.bindEvents();
    }
    
    render() {
        console.log(`[FocusNoiseGeneratorTool] render() called, container:`, this.container);
        this.container.innerHTML = `
            <div class="noise-controls" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 20px;
                margin: 10px 0 20px 0;
                padding: 10px 0;
            ">
                <div class="noise-item" style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 8px 0;
                ">
                    <div class="noise-label" style="
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--text-primary);
                        text-align: center;
                    ">White Noise</div>
                    <input type="range" class="slider volume-slider" data-sound="white-noise" min="0" max="100" value="0">
                </div>
                <div class="noise-item" style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 8px 0;
                ">
                    <div class="noise-label" style="
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--text-primary);
                        text-align: center;
                    ">Brown Noise</div>
                    <input type="range" class="slider volume-slider" data-sound="brown-noise" min="0" max="100" value="0">
                </div>
            </div>
            
            ${this.getSliderStyles()}
        `;
    }
    
    bindEvents() {
        console.log(`[FocusNoiseGeneratorTool] bindEvents() called`);
        this.bindSliderEvents();
    }
    
    // Implement base class method for getting volume percentage
    getSoundVolumeForSlider(sound) {
        if (sound && sound.gainNode) {
            return Math.round((sound.gainNode.gain.value / sound.config.baseGain) * 100);
        }
        return 0;
    }
    
    // Implement base class method for updating volume 
    updateVolumeMethod(soundName, volume) {
        this.updateNoiseVolume(soundName, volume);
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            
            this.noiseGenerator = new NoiseGenerator(this.audioContext);
            
            const soundPromises = Object.entries(this.soundConfigs).map(async ([name, config]) => {
                this.sounds[name] = await this.createAmbientSound(config);
            });
            await Promise.all(soundPromises);
            
            this.isInitialized = true;
            console.log('Focus noise generator initialized');
            
            // Expose to parent for OssC integration
            if (window.childFocusNoise !== this) {
                window.childFocusNoise = this;
            }
        } catch (error) {
            console.error('Failed to initialize ambient noise system:', error);
        }
    }
    
    async createAmbientSound(config) {
        const sound = {
            oscillator: null,
            audioBuffer: null,
            gainNode: null,
            filterNode: null,
            isPlaying: false,
            config: config,
            useFile: false
        };
        
        if (config.file) {
            try {
                const response = await fetch(config.file);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    sound.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    sound.useFile = true;
                    console.log(`Loaded audio file: ${config.file}`);
                } else {
                    console.log(`Audio file not found: ${config.file}, using procedural generation`);
                }
            } catch (error) {
                console.log(`Failed to load ${config.file}, using procedural generation:`, error.message);
            }
        }
        
        sound.gainNode = this.audioContext.createGain();
        sound.gainNode.gain.value = 0;
        
        sound.filterNode = this.audioContext.createBiquadFilter();
        sound.filterNode.type = 'lowpass';
        sound.filterNode.frequency.value = config.frequency;
        sound.filterNode.Q.value = 0.7;
        
        sound.filterNode.connect(sound.gainNode);
        sound.gainNode.connect(this.masterGain);
        
        return sound;
    }
    
    startSound(soundName) {
        if (!this.isInitialized || !this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        if (sound.isPlaying) return;
        
        if (sound.useFile && sound.audioBuffer) {
            sound.oscillator = this.audioContext.createBufferSource();
            sound.oscillator.buffer = sound.audioBuffer;
            sound.oscillator.loop = true;
            sound.oscillator.connect(sound.filterNode);
            sound.oscillator.start();
            sound.isPlaying = true;
        } else {
            sound.oscillator = this.audioContext.createBufferSource();
            sound.oscillator.buffer = this.noiseGenerator.generateNoise(sound.config.type, sound.config);
            sound.oscillator.loop = true;
            sound.oscillator.connect(sound.filterNode);
            sound.oscillator.start();
            sound.isPlaying = true;
        }
    }
    
    stopSound(soundName) {
        if (!this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        if (sound.oscillator && sound.isPlaying) {
            sound.oscillator.stop();
            sound.oscillator = null;
            sound.isPlaying = false;
        }
    }
    
    setVolume(soundName, volume) {
        if (!this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        const normalizedVolume = (volume / 100) * sound.config.baseGain;
        
        if (volume > 0 && !sound.isPlaying) {
            this.startSound(soundName);
        }
        
        if (sound.gainNode) {
            sound.gainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
        }
        
        if (volume === 0 && sound.isPlaying) {
            this.stopSound(soundName);
        }
    }
    
    async updateNoiseVolume(soundName, volume) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        this.setVolume(soundName, volume);
        this.updateSliderScale(soundName, volume);
    }
    
    // Get combined audio data for oscilloscope visualization
    getCombinedAudioData() {
        const combinedData = new Uint8Array(256);
        let hasActiveSound = false;
        const time = Date.now() * 0.001;
        
        for (const [name, sound] of Object.entries(this.sounds)) {
            if (sound.isPlaying && sound.gainNode.gain.value > 0) {
                hasActiveSound = true;
                const volume = sound.gainNode.gain.value * 255;
                const baseFreq = sound.config.frequency / 100;
                
                for (let i = 0; i < combinedData.length; i++) {
                    const freq = (i / combinedData.length) * 10;
                    let amplitude = 0;
                    
                    if (sound.config.type === 'white') {
                        amplitude = volume * (0.8 + 0.4 * Math.sin(freq * 3 + time * 2));
                    } else if (sound.config.type === 'pink') {
                        amplitude = volume * (1.2 / (freq + 1)) * (0.9 + 0.3 * Math.sin(freq * 2 + time * 1.5));
                    } else if (sound.config.type === 'brown') {
                        amplitude = volume * (1.5 / ((freq + 0.5) * (freq + 0.5))) * (0.95 + 0.2 * Math.sin(freq + time));
                    }
                    
                    combinedData[i] = Math.min(255, combinedData[i] + amplitude * (0.8 + 0.4 * Math.random()));
                }
            }
        }
        
        return hasActiveSound ? combinedData : null;
    }
    
    // Override base class method to remove specific global reference
    removeGlobalReference() {
        if (window.childFocusNoise === this) {
            window.childFocusNoise = null;
        }
    }
}