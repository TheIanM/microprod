/**
 * Ambient Sounds Tool - ES6 Module
 * Handles real ambient sound loops for relaxation and atmosphere
 */

import { AudioToolBase } from './audio-tool-base.js';

export class AmbientSoundsTool extends AudioToolBase {
    constructor(container) {
        super(container);
        this.audioContext = null;
        this.masterGain = null;
        this.directoryCache = new Map(); // Cache discovered files
        
        // Audio loop configurations - will be dynamically populated by scanning directories
        this.soundConfigs = {};
        
        // Supported audio formats
        this.supportedFormats = ['mp3', 'wav', 'ogg', 'm4a', 'aac'];
        
        // Test audio format support at startup (async)
        this.checkAudioSupport().catch(console.error);
        
        // Discover audio directories and initialize
        this.initializeAsync();
    }
    
    // Async initialization that discovers directories first, then renders
    async initializeAsync() {
        try {
            // First discover the audio directories
            await this.discoverAudioDirectories();
            
            // Then render the UI with discovered configurations
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('❌ Failed to initialize AmbientSoundsTool:', error);
            // Still render empty UI so the container doesn't break
            this.render();
            this.bindEvents();
        }
    }
    
    // Check audio format support using both Tauri and browser capabilities
    async checkAudioSupport() {
        // Wait for Tauri to be available
        await this.waitForTauri();
        
        try {
            // Get Tauri's supported formats using correct API
            const { core } = window.__TAURI__;
            console.log('🦀 Calling get_supported_audio_formats...');
            const tauriFormats = await core.invoke('get_supported_audio_formats');
            console.log('🦀 Tauri supported formats:', tauriFormats);
            
            // Also check browser support for web audio playback
            const audio = new Audio();
            const supportMap = {
                mp3: audio.canPlayType('audio/mpeg'),
                wav: audio.canPlayType('audio/wav'),
                ogg: audio.canPlayType('audio/ogg; codecs="vorbis"'),
                m4a: audio.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
                aac: audio.canPlayType('audio/aac'),
                flac: audio.canPlayType('audio/flac'),
                wma: audio.canPlayType('audio/x-ms-wma')
            };
            
            console.log('🎧 Browser audio format support:');
            for (const [format, support] of Object.entries(supportMap)) {
                console.log(`  ${format}: ${support || 'not supported'}`);
            }
            
            // Use intersection of Tauri supported formats and browser supported formats
            this.supportedFormats = tauriFormats.filter(format => 
                supportMap[format] && supportMap[format] !== ''
            );
            
            console.log(`📋 Will use formats: ${this.supportedFormats.join(', ')}`);
        } catch (error) {
            console.warn('⚠️ Failed to get Tauri audio support, using defaults:', error);
            // Fallback to basic supported formats
            this.supportedFormats = ['mp3', 'wav', 'ogg'];
        }
    }
    
    // Wait for Tauri API to be available
    async waitForTauri() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        while (attempts < maxAttempts) {
            if (window.__TAURI__ && window.__TAURI__.core) {
                console.log('🦀 Tauri API is ready');
                console.log('🔍 Available Tauri APIs:', Object.keys(window.__TAURI__));
                return;
            }
            console.log(`⏳ Waiting for Tauri API... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Tauri API did not become available within timeout');
    }
    
    // Automatically discover audio directories and build sound configurations
    async discoverAudioDirectories() {
        try {
            await this.waitForTauri();
            
            const { core } = window.__TAURI__;
            const audioDirectories = await core.invoke('scan_audio_directories');
            console.log('directory list:',audioDirectories);
            
            // Build sound configurations from discovered directories
            this.soundConfigs = {};
            for (const dir of audioDirectories) {
                const key = dir.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                
                // Create display name from directory name
                const displayName = dir.name
                    .split(/[-_\s]+/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                
                // Set base gain based on sound type
                let baseGain = 0.5;
                const lowerDirName = dir.name.toLowerCase();
                if (lowerDirName.includes('rain') || lowerDirName.includes('storm')) {
                    baseGain = 0.6;
                } else if (lowerDirName.includes('cafe') || lowerDirName.includes('coffee')) {
                    baseGain = 0.3;
                } else if (lowerDirName.includes('thunder')) {
                    baseGain = 0.4;
                }
                
                this.soundConfigs[key] = {
                    directory: dir.path, // Already formatted as /audio/{name}
                    baseGain: baseGain,
                    displayName: displayName,
                    fileCount: dir.file_count
                };
            }
            return true;
            
        } catch (error) {
            console.error('Failed to discover audio directories:', error);
            this.soundConfigs = {};
            return false;
        }
    }
    
    // Scan directory for audio files 
    
    
    async scanDirectory(directory, forceRefresh = false) {
        console.log('🔍 About to scan directory:', directory);
        console.log('🔍 Directory type:', typeof directory);
        const cacheKey = directory;
        if (!forceRefresh && this.directoryCache.has(cacheKey)) {
            console.log('🔍 Using cached result for:', directory);
            return this.directoryCache.get(cacheKey);
        }
        
        try {
            await this.waitForTauri();
            
            const { core } = window.__TAURI__;
            
            const result = await core.invoke('scan_audio_directory', { 
                directoryPath: directory 
            });
            
            // Convert to simple web paths
            const fileUrls = result.files.map(file => file.path);
            
            this.directoryCache.set(cacheKey, fileUrls);
            return fileUrls;
            
        } catch (error) {
            console.error(`Failed to scan directory ${directory}:`, error);
            return [];
        }
    }
    
    // Select random file from available files
    selectRandomFile(files) {
        if (!files || files.length === 0) return null;
        return files[Math.floor(Math.random() * files.length)];
    }
    
    render() {
        console.log(`[AmbientSoundsTool] render() called, container:`, this.container);
        // Check if we have any sound configurations discovered yet
        const hasConfigs = Object.keys(this.soundConfigs).length > 0;
        
        let soundItems = '';
        if (hasConfigs) {
            soundItems = Object.entries(this.soundConfigs).map(([key, config]) => `
                <div class="sound-item" style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 8px 0;
                ">
                    <div class="sound-label" style="
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--text-primary);
                        text-align: center;
                    ">${config.displayName}</div>
                    <input type="range" class="slider volume-slider" data-sound="${key}" min="0" max="100" value="0">
                </div>
            `).join('');
        } else {
            // Show loading state while discovering directories
            soundItems = `
                <div style="
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                    color: #666;
                    font-style: italic;
                ">
                    Discovering audio directories...
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="sound-controls" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 20px;
                margin: 10px 0 20px 0;
                padding: 10px 0;
            ">
                ${soundItems}
            </div>
            
            <div class="audio-status" style="
                text-align: center;
                padding: 10px;
                margin: 10px 0;
                background: #f8f9fa;
                border-radius: 8px;
                font-size: 12px;
                color: #666;
                display: none;
            " id="audio-status">
                Loading audio files...
            </div>
            
            ${this.getSliderStyles()}
        `;
    }
    
    bindEvents() {
        console.log(`[AmbientSoundsTool] bindEvents() called`);
        this.bindSliderEvents();
    }
    
    // Implement base class method for getting volume percentage
    getSoundVolumeForSlider(sound) {
        if (sound && sound.volume > 0) {
            return Math.round((sound.volume / sound.config.baseGain) * 100);
        }
        return 0;
    }
    
    // Implement base class method for updating volume 
    updateVolumeMethod(soundName, volume) {
        this.updateSoundVolume(soundName, volume);
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        const statusEl = this.container.querySelector('#audio-status');
        if (statusEl) {
            statusEl.style.display = 'block';
        }
        
        try {
            // Ensure Tauri is ready before loading audio files
            await this.waitForTauri();
            console.log('Initializing hybrid audio system (Web Audio API + HTML5 fallback)...');
            
            // Initialize Web Audio Context for better performance
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            
            // Create analyzer for real-time waveform data
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512; // 256 frequency bins
            this.analyser.smoothingTimeConstant = 0.8;
            this.masterGain.connect(this.analyser);
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Initialize sound placeholders (no file loading yet)
            Object.entries(this.soundConfigs).forEach(([name, config]) => {
                this.sounds[name] = {
                    audioElements: [],
                    availableFiles: [],
                    currentIndex: 0,
                    isPlaying: false,
                    config: config,
                    loaded: false,
                    volume: 0,
                    rotationTimeout: null
                };
            });
            
            this.isInitialized = true;
            if (statusEl) {
                statusEl.textContent = 'Ambient sounds ready';
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 2000);
            }
            
            console.log('HTML5 ambient sounds system initialized');
            
            // Expose to parent for OssC integration
            if (window.childAmbientNoise !== this) {
                window.childAmbientNoise = this;
            }
            
        } catch (error) {
            console.error('Failed to initialize ambient sounds system:', error);
            if (statusEl) {
                statusEl.textContent = 'Failed to load audio files';
                statusEl.style.color = '#e74c3c';
            }
        }
    }
    
    async createAmbientSound(config, forceRefresh = false) {
        const sound = {
            audioElements: [],  // Changed from audioBuffers to audioElements
            availableFiles: [],
            currentIndex: 0,
            isPlaying: false,
            config: config,
            loaded: false,
            volume: 0,
            rotationTimeout: null,
            loadingInBackground: false,
            backgroundBatchSize: 3,  // Load 3 files per batch
            filesUsed: 0,  // Track how many files have been played
            pendingFiles: []  // Queue of remaining files to load
        };
        
        try {
            sound.availableFiles = await this.scanDirectory(config.directory, forceRefresh);
            
            if (sound.availableFiles.length > 0) {
                // Filter files by format preference (MP3 first, then OGG)
                const mp3Files = sound.availableFiles.filter(file => file.toLowerCase().endsWith('.mp3'));
                const oggFiles = sound.availableFiles.filter(file => file.toLowerCase().endsWith('.ogg'));
                
                // Use MP3 files if available, otherwise use OGG
                const filesToUse = mp3Files.length > 0 ? mp3Files : oggFiles;
                
                console.log(`[AmbientSoundsTool] Found ${filesToUse.length} files for ${config.displayName}, loading first file only`);
                
                // Load only the FIRST file immediately for instant playback
                if (filesToUse.length > 0) {
                    const firstFile = filesToUse[0];
                    const firstElement = await this.loadSingleAudioFile(firstFile);
                    
                    if (firstElement) {
                        sound.audioElements = [firstElement];
                        sound.loaded = true;
                        console.log(`✅ ${config.displayName}: First file loaded, ready to play instantly!`);
                        
                        // Queue remaining files for gradual loading
                        if (filesToUse.length > 1) {
                            sound.pendingFiles = filesToUse.slice(1);
                            this.loadNextBatchIfNeeded(sound);
                        }
                    } else {
                        console.warn(`❌ Failed to load first file for ${config.displayName}`);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to load sounds for ${config.displayName}:`, error);
        }
        
        return sound;
    }
    
    // Load a single audio file (used for first file and background batching)
    async loadSingleAudioFile(file) {
        try {
            console.log(`Loading single file: ${file}`);
            
            // Try Web Audio API first, fallback to HTML5 Audio
            try {
                // Web Audio API approach
                const { convertFileSrc } = window.__TAURI__.core;
                const assetUrl = convertFileSrc(file);
                
                const response = await fetch(assetUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                console.log(`✅ Web Audio API success: ${file}`);
                return { file, audioBuffer, useWebAudio: true };
                
            } catch (webAudioError) {
                console.warn(`❌ Web Audio API failed for ${file}: ${webAudioError.message}`);
                
                try {
                    // HTML5 Audio fallback with Web Audio API connection
                    const audio = new Audio();
                    audio.crossOrigin = 'anonymous';
                    audio.preload = 'none';
                    audio.loop = true;
                    audio.volume = 0;
                    
                    const { convertFileSrc } = window.__TAURI__.core;
                    const assetUrl = convertFileSrc(file);
                    
                    // Set type based on file extension
                    const ext = file.toLowerCase().split('.').pop();
                    if (ext === 'mp3') audio.type = 'audio/mpeg';
                    else if (ext === 'ogg') audio.type = 'audio/ogg';
                    else if (ext === 'm4a') audio.type = 'audio/mp4';
                    
                    audio.src = assetUrl;
                    audio.load();
                    
                    // Connect HTML5 audio to Web Audio API for analysis
                    let mediaSource = null;
                    let gainNode = null;
                    if (this.audioContext) {
                        try {
                            mediaSource = this.audioContext.createMediaElementSource(audio);
                            gainNode = this.audioContext.createGain();
                            mediaSource.connect(gainNode);
                            gainNode.connect(this.masterGain);
                        } catch (e) {
                            console.warn('Failed to connect HTML5 audio to Web Audio API:', e);
                        }
                    }
                    
                    await new Promise((resolve, reject) => {
                        audio.addEventListener('canplaythrough', resolve);
                        audio.addEventListener('error', (e) => {
                            const error = audio.error;
                            let errorMessage = 'Unknown audio error';
                            if (error) {
                                switch(error.code) {
                                    case error.MEDIA_ERR_ABORTED:
                                        errorMessage = 'Audio loading aborted';
                                        break;
                                    case error.MEDIA_ERR_NETWORK:
                                        errorMessage = 'Network error while loading audio';
                                        break;
                                    case error.MEDIA_ERR_DECODE:
                                        errorMessage = 'Audio decoding error';
                                        break;
                                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                        errorMessage = 'Audio format not supported';
                                        break;
                                }
                            }
                            reject(new Error(`${errorMessage} (code: ${error?.code})`));
                        });
                        
                        setTimeout(() => reject(new Error('Audio load timeout')), 10000);
                    });
                    
                    console.log(`✅ HTML5 Audio fallback success: ${file}`);
                    return { file, audio, useWebAudio: false, mediaSource, gainNode };
                    
                } catch (html5Error) {
                    console.error(`❌ Both Web Audio API and HTML5 Audio failed for ${file}:`, html5Error.message);
                    return null;
                }
            }
        } catch (error) {
            console.error(`Failed to load file ${file}:`, error);
            return null;
        }
    }
    
    // Load next batch only when needed (after 2 of 3 files have been used)
    loadNextBatchIfNeeded(sound) {
        if (sound.loadingInBackground || sound.pendingFiles.length === 0) {
            return;
        }
        
        // Only load more if we have fewer than 3 files available OR 2/3 files have been used
        const shouldLoadMore = sound.audioElements.length < 3 || sound.filesUsed >= 2;
        
        if (!shouldLoadMore) {
            return;
        }
        
        sound.loadingInBackground = true;
        const batchSize = Math.min(sound.backgroundBatchSize, sound.pendingFiles.length);
        const currentBatch = sound.pendingFiles.splice(0, batchSize);
        
        console.log(`🔄 Loading next batch for ${sound.config.displayName}: ${batchSize} files (${sound.pendingFiles.length} remaining in queue)`);
        
        this.loadBatch(sound, currentBatch);
    }
    
    // Load a specific batch of files
    async loadBatch(sound, filesToLoad) {
        // Load batch in parallel
        const batchPromises = filesToLoad.map(file => this.loadSingleAudioFile(file));
        const results = await Promise.all(batchPromises);
        
        // Add successfully loaded files to the sound
        const loadedElements = results.filter(result => result !== null);
        sound.audioElements.push(...loadedElements);
        
        console.log(`✅ Batch loaded: ${loadedElements.length}/${filesToLoad.length} files. Total: ${sound.audioElements.length} files available`);
        
        sound.loadingInBackground = false;
        
        // Reset usage counter when we add new files
        sound.filesUsed = Math.max(0, sound.filesUsed - 2);
        
        if (sound.pendingFiles.length === 0) {
            console.log(`🎉 All files loaded for ${sound.config.displayName}: ${sound.audioElements.length} total files`);
        }
    }
    
    startSound(soundName) {
        console.log(`🔊 Starting sound: ${soundName}`);
        
        if (!this.sounds[soundName]) {
            console.log(`❌ Sound ${soundName} not found`);
            return;
        }
        
        const sound = this.sounds[soundName];
        
        if (sound.isPlaying) {
            console.log(`⚠️ Sound ${soundName} already playing`);
            return;
        }
        
        if (!sound.loaded) {
            console.log(`❌ Sound ${soundName} not loaded`);
            return;
        }
        
        if (sound.audioElements.length === 0) {
            console.log(`❌ No audio elements available for ${soundName}`);
            return;
        }
        
        // Select random audio element from available options
        const randomIndex = Math.floor(Math.random() * sound.audioElements.length);
        const selectedElement = sound.audioElements[randomIndex];
        
        console.log(`🎵 Playing ${soundName} file ${randomIndex}: ${selectedElement.file}`);
        
        if (selectedElement.useWebAudio) {
            // Web Audio API playback
            const source = this.audioContext.createBufferSource();
            source.buffer = selectedElement.audioBuffer;
            source.loop = true;
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = sound.volume;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            source.start();
            
            // Store references for later control
            sound.currentSource = source;
            sound.currentGainNode = gainNode;
        } else {
            // HTML5 Audio playback
            selectedElement.audio.currentTime = 0;
            
            // Use Web Audio API gain control if available, otherwise fallback to HTML5 volume
            if (selectedElement.gainNode) {
                selectedElement.gainNode.gain.value = sound.volume;
                selectedElement.audio.volume = 1.0; // Let Web Audio API handle volume
            } else {
                selectedElement.audio.volume = sound.volume;
            }
            
            selectedElement.audio.play();
        }
        
        // Set up rotation to next file after a random duration (3-8 minutes)
        const rotationTime = (3 + Math.random() * 5) * 60 * 1000; // 3-8 minutes
        sound.rotationTimeout = setTimeout(() => {
            if (sound.isPlaying) {
                this.rotateSound(soundName);
            }
        }, rotationTime);
        
        sound.isPlaying = true;
        sound.currentIndex = randomIndex;
        sound.filesUsed++;
        
        // Check if we need to load more files after using this one
        this.loadNextBatchIfNeeded(sound);
    }
    
    rotateSound(soundName) {
        const sound = this.sounds[soundName];
        if (!sound.isPlaying || sound.audioElements.length <= 1) return;
        
        const currentElement = sound.audioElements[sound.currentIndex];
        const currentVolume = sound.volume;
        
        // Fade out current sound
        const fadeOutInterval = setInterval(() => {
            if (currentElement.audio.volume > 0.1) {
                currentElement.audio.volume -= 0.1;
            } else {
                clearInterval(fadeOutInterval);
                currentElement.audio.pause();
                currentElement.audio.currentTime = 0;
                
                // Start new random sound
                const availableIndices = sound.audioElements
                    .map((_, index) => index)
                    .filter(index => index !== sound.currentIndex);
                
                if (availableIndices.length > 0) {
                    const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                    const nextElement = sound.audioElements[nextIndex];
                    
                    sound.currentIndex = nextIndex;
                    sound.filesUsed++;
                    
                    // Set initial volume and start playing
                    if (nextElement.gainNode) {
                        nextElement.gainNode.gain.value = 0;
                        nextElement.audio.volume = 1.0;
                    } else {
                        nextElement.audio.volume = 0;
                    }
                    nextElement.audio.currentTime = 0;
                    nextElement.audio.play();
                    
                    // Check if we need to load more files after rotation
                    this.loadNextBatchIfNeeded(sound);
                    
                    // Fade in new sound
                    const fadeInInterval = setInterval(() => {
                        let currentFadeVolume;
                        if (nextElement.gainNode) {
                            currentFadeVolume = nextElement.gainNode.gain.value;
                            if (currentFadeVolume < currentVolume) {
                                const newVolume = Math.min(currentVolume, currentFadeVolume + 0.1);
                                nextElement.gainNode.gain.setValueAtTime(newVolume, this.audioContext.currentTime);
                            } else {
                                clearInterval(fadeInInterval);
                            }
                        } else {
                            currentFadeVolume = nextElement.audio.volume;
                            if (currentFadeVolume < currentVolume) {
                                nextElement.audio.volume = Math.min(currentVolume, currentFadeVolume + 0.1);
                            } else {
                                clearInterval(fadeInInterval);
                            }
                        }
                    }, 200);
                    
                    // Set up next rotation
                    const rotationTime = (3 + Math.random() * 5) * 60 * 1000;
                    sound.rotationTimeout = setTimeout(() => {
                        if (sound.isPlaying) {
                            this.rotateSound(soundName);
                        }
                    }, rotationTime);
                }
            }
        }, 200);
    }
    
    stopSound(soundName) {
        if (!this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        if (sound.isPlaying) {
            if (sound.currentSource) {
                // Web Audio API - stop the source
                sound.currentSource.stop();
                sound.currentSource = null;
                sound.currentGainNode = null;
            } else if (sound.audioElements[sound.currentIndex]) {
                // HTML5 Audio - pause the element
                const element = sound.audioElements[sound.currentIndex];
                if (element.audio) {
                    element.audio.pause();
                    element.audio.currentTime = 0;
                }
            }
            sound.isPlaying = false;
        }
        
        // Clear rotation timeout
        if (sound.rotationTimeout) {
            clearTimeout(sound.rotationTimeout);
            sound.rotationTimeout = null;
        }
    }
    
    async setVolume(soundName, volume) {
        if (!this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        const normalizedVolume = (volume / 100) * sound.config.baseGain;
        sound.volume = normalizedVolume;
        
        // Lazy load audio files only when volume > 0 and not loaded yet
        if (volume > 0 && !sound.loaded) {
            console.log(`Lazy loading audio for ${soundName}...`);
            try {
                const loadedSound = await this.createAmbientSound(sound.config);
                // Copy loaded data back to existing sound object
                sound.audioElements = loadedSound.audioElements;
                sound.availableFiles = loadedSound.availableFiles;
                sound.loaded = loadedSound.loaded;
            } catch (error) {
                console.error(`Failed to lazy load ${soundName}:`, error);
                return;
            }
        }
        
        if (volume > 0 && !sound.isPlaying && sound.loaded) {
            this.startSound(soundName);
        }
        
        // Apply volume to currently playing audio element
        if (sound.isPlaying) {
            if (sound.currentGainNode) {
                // Web Audio API - update gain node
                sound.currentGainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
            } else if (sound.audioElements[sound.currentIndex]) {
                const currentElement = sound.audioElements[sound.currentIndex];
                if (currentElement.gainNode) {
                    // HTML5 + Web Audio API hybrid - update per-element gain node
                    currentElement.gainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
                } else if (currentElement.audio) {
                    // Pure HTML5 Audio fallback - update volume
                    currentElement.audio.volume = normalizedVolume;
                }
            }
        }
        
        if (volume === 0 && sound.isPlaying) {
            this.stopSound(soundName);
        }
    }
    
    async updateSoundVolume(soundName, volume) {
        if (!this.isInitialized) {
            // Only initialize the audio context, not reload sounds
            await this.initialize();
        }
        await this.setVolume(soundName, volume);
        this.updateSliderScale(soundName, volume);
    }
    
    // Initialize just the audio context (separate from full initialization)
    // NOTE: HTML5 Audio doesn't need Web Audio Context, but keeping for compatibility
    async initializeAudioContext() {
        console.log('HTML5 Audio - no audio context needed');
        // HTML5 Audio elements manage their own audio context
        return;
    }
    
    // Refresh audio cache - rescan all directories
    async refreshAudioCache() {
        try {
            Object.keys(this.sounds).forEach(soundName => {
                this.stopSound(soundName);
            });
            
            this.directoryCache.clear();
            await this.discoverAudioDirectories();
            this.render();
            this.bindEvents();
            
            const soundPromises = Object.entries(this.soundConfigs).map(async ([name, config]) => {
                this.sounds[name] = await this.createAmbientSound(config, true);
            });
            
            await Promise.all(soundPromises);
        } catch (error) {
            console.error('Failed to refresh audio cache:', error);
        }
    }
    
    // Get combined audio data for oscilloscope visualization
    getCombinedAudioData() {
        let hasActiveSound = false;
        
        // Check if any sounds are playing
        for (const [name, sound] of Object.entries(this.sounds)) {
            if (sound.isPlaying && sound.volume > 0) {
                hasActiveSound = true;
                break;
            }
        }
        
        if (!hasActiveSound || !this.analyser) {
            return null;
        }
        
        // Get real-time frequency data from the Web Audio API analyzer
        this.analyser.getByteFrequencyData(this.frequencyData);
        
        // Convert frequency data to the expected 256-length array for oscilloscope
        const visualData = new Uint8Array(256);
        const sourceLength = this.frequencyData.length; // Should be 256 with fftSize=512
        
        if (sourceLength === 256) {
            // Direct copy if sizes match
            visualData.set(this.frequencyData);
        } else {
            // Resample if sizes don't match
            for (let i = 0; i < 256; i++) {
                const sourceIndex = Math.floor((i / 256) * sourceLength);
                visualData[i] = this.frequencyData[sourceIndex];
            }
        }
        
        // Apply some smoothing and enhance lower frequencies for better visualization
        for (let i = 0; i < visualData.length; i++) {
            // Boost lower frequencies (more visible in ambient sounds)
            const lowFreqBoost = i < 64 ? 1.3 : 1.0;
            visualData[i] = Math.min(255, visualData[i] * lowFreqBoost);
        }
        
        return visualData;
    }
    
    // Override base class method to remove specific global reference
    removeGlobalReference() {
        if (window.childAmbientNoise === this) {
            window.childAmbientNoise = null;
        }
    }
}