/**
 * Lo-Fi Music Tool - ES6 Module
 * Handles lo-fi music streaming and playlists for productivity and focus
 */

import { AudioToolBase } from './audio-tool-base.js';

export class LofiTool extends AudioToolBase {
    constructor(container) {
        super(container);
        this.audioContext = null;
        this.masterGain = null;
        this.directoryCache = new Map(); // Cache discovered files
        
        // Audio loop configurations - will be dynamically populated by scanning directories
        this.musicConfigs = {};
        
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
            // First discover the lo-fi music directories
            await this.discoverLofiDirectories();
            
            // Then render the UI with discovered configurations
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('❌ Failed to initialize LofiTool:', error);
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
    
    // Automatically discover lo-fi music directories and build configurations
    async discoverLofiDirectories() {
        try {
            await this.waitForTauri();
            
            const { core } = window.__TAURI__;
            const audioDirectories = await core.invoke('scan_audio_directories');
            console.log('Lo-fi directory list:', audioDirectories);
            
            // Build music configurations from discovered directories, filtering for lo-fi relevant ones
            this.musicConfigs = {};
            for (const dir of audioDirectories) {
                const lowerDirName = dir.name.toLowerCase();
                
                // Only include directories that seem lo-fi related
                const isLofiRelevant = lowerDirName.includes('lofi') || 
                                     lowerDirName.includes('lo-fi') ||
                                     lowerDirName.includes('chill') ||
                                     lowerDirName.includes('jazz') ||
                                     lowerDirName.includes('beats') ||
                                     lowerDirName.includes('hip-hop') ||
                                     lowerDirName.includes('study') ||
                                     lowerDirName.includes('relax');
                
                if (isLofiRelevant) {
                    const key = dir.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    
                    // Create display name from directory name
                    const displayName = dir.name
                        .split(/[-_\s]+/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                    
                    // Set base gain - lo-fi music generally plays at moderate volume
                    let baseGain = 0.7;
                    if (lowerDirName.includes('chill') || lowerDirName.includes('relax')) {
                        baseGain = 0.6;
                    } else if (lowerDirName.includes('beats') || lowerDirName.includes('hip-hop')) {
                        baseGain = 0.8;
                    }
                    
                    this.musicConfigs[key] = {
                        directory: dir.path, // Already formatted as /audio/{name}
                        baseGain: baseGain,
                        displayName: displayName,
                        fileCount: dir.file_count
                    };
                }
            }
            
            // If no lo-fi specific directories found, create a generic music category
            if (Object.keys(this.musicConfigs).length === 0 && audioDirectories.length > 0) {
                console.log('No specific lo-fi directories found, using first available directory');
                const firstDir = audioDirectories[0];
                const key = 'lofi-music';
                
                this.musicConfigs[key] = {
                    directory: firstDir.path,
                    baseGain: 0.7,
                    displayName: 'Lo-Fi Music',
                    fileCount: firstDir.file_count
                };
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to discover lo-fi directories:', error);
            this.musicConfigs = {};
            return false;
        }
    }
    
    async scanDirectory(directory, forceRefresh = false) {
        console.log('🔍 About to scan lo-fi directory:', directory);
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
        console.log(`[LofiTool] render() called, container:`, this.container);
        // Check if we have any music configurations discovered yet
        const hasConfigs = Object.keys(this.musicConfigs).length > 0;
        
        let musicItems = '';
        if (hasConfigs) {
            musicItems = Object.entries(this.musicConfigs).map(([key, config]) => `
                <div class="music-item" style="
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 8px 0;
                ">
                    <div class="music-label" style="
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
            musicItems = `
                <div style="
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                    color: #666;
                    font-style: italic;
                ">
                    Discovering lo-fi music directories...
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="music-controls" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 20px;
                margin: 10px 0 20px 0;
                padding: 10px 0;
            ">
                ${musicItems}
            </div>
            
            <div class="now-playing" style="
                text-align: center;
                padding: 12px;
                margin: 10px 0;
                background: var(--background-secondary);
                border-radius: 8px;
                font-size: 12px;
                color: var(--text-secondary);
                display: none;
            " id="now-playing">
                ♪ Now Playing: Loading...
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
                Loading lo-fi music files...
            </div>
            
            ${this.getSliderStyles()}
        `;
    }
    
    bindEvents() {
        console.log(`[LofiTool] bindEvents() called`);
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
        this.updateMusicVolume(soundName, volume);
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
            console.log('Initializing lo-fi music system (Web Audio API + HTML5 fallback)...');
            
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
            
            // Initialize music placeholders (no file loading yet)
            Object.entries(this.musicConfigs).forEach(([name, config]) => {
                this.sounds[name] = {
                    audioElements: [],
                    availableFiles: [],
                    currentIndex: 0,
                    isPlaying: false,
                    config: config,
                    loaded: false,
                    volume: 0,
                    rotationTimeout: null,
                    currentTrackName: ''
                };
            });
            
            this.isInitialized = true;
            if (statusEl) {
                statusEl.textContent = 'Lo-fi music ready';
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 2000);
            }
            
            console.log('Lo-fi music system initialized');
            
            // Expose to parent for OssC integration (using different global name)
            if (window.childLofiMusic !== this) {
                window.childLofiMusic = this;
            }
            
        } catch (error) {
            console.error('Failed to initialize lo-fi music system:', error);
            if (statusEl) {
                statusEl.textContent = 'Failed to load lo-fi music files';
                statusEl.style.color = '#e74c3c';
            }
        }
    }
    
    async createLofiMusic(config, forceRefresh = false) {
        const music = {
            audioElements: [],
            availableFiles: [],
            currentIndex: 0,
            isPlaying: false,
            config: config,
            loaded: false,
            volume: 0,
            rotationTimeout: null,
            currentTrackName: '',
            loadingInBackground: false,
            backgroundBatchSize: 5,  // Load more files at once for music
            filesUsed: 0,
            pendingFiles: []
        };
        
        try {
            music.availableFiles = await this.scanDirectory(config.directory, forceRefresh);
            
            if (music.availableFiles.length > 0) {
                // Filter files by format preference (MP3 first, then others)
                const mp3Files = music.availableFiles.filter(file => file.toLowerCase().endsWith('.mp3'));
                const otherFiles = music.availableFiles.filter(file => !file.toLowerCase().endsWith('.mp3'));
                
                // Prefer MP3 files for music
                const filesToUse = mp3Files.length > 0 ? mp3Files : otherFiles;
                
                console.log(`[LofiTool] Found ${filesToUse.length} music files for ${config.displayName}, loading first track`);
                
                // Load only the FIRST file immediately for instant playback
                if (filesToUse.length > 0) {
                    const firstFile = filesToUse[0];
                    const firstElement = await this.loadSingleAudioFile(firstFile);
                    
                    if (firstElement) {
                        music.audioElements = [firstElement];
                        music.loaded = true;
                        music.currentTrackName = this.extractTrackName(firstFile);
                        console.log(`✅ ${config.displayName}: First track loaded, ready to play instantly!`);
                        
                        // Queue remaining files for gradual loading
                        if (filesToUse.length > 1) {
                            music.pendingFiles = filesToUse.slice(1);
                            this.loadNextBatchIfNeeded(music);
                        }
                    } else {
                        console.warn(`❌ Failed to load first track for ${config.displayName}`);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to load music for ${config.displayName}:`, error);
        }
        
        return music;
    }
    
    // Extract track name from file path for display
    extractTrackName(filePath) {
        const fileName = filePath.split('/').pop() || filePath;
        return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }
    
    // Load a single audio file (reuse from ambient-sounds with minor modifications)
    async loadSingleAudioFile(file) {
        try {
            console.log(`Loading single music file: ${file}`);
            
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
                    audio.loop = false; // Lo-fi tracks typically don't loop
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
                    
                    // Set up track end event for automatic next track
                    audio.addEventListener('ended', () => {
                        console.log(`Track ended: ${file}`);
                        this.playNextTrack();
                    });
                    
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
                        
                        setTimeout(() => reject(new Error('Audio load timeout')), 15000);
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
    
    // Load next batch when needed
    loadNextBatchIfNeeded(music) {
        if (music.loadingInBackground || music.pendingFiles.length === 0) {
            return;
        }
        
        // Load more aggressively for music - when we have fewer than 5 files or 3/5 have been used
        const shouldLoadMore = music.audioElements.length < 5 || music.filesUsed >= 3;
        
        if (!shouldLoadMore) {
            return;
        }
        
        music.loadingInBackground = true;
        const batchSize = Math.min(music.backgroundBatchSize, music.pendingFiles.length);
        const currentBatch = music.pendingFiles.splice(0, batchSize);
        
        console.log(`🔄 Loading next music batch for ${music.config.displayName}: ${batchSize} files`);
        
        this.loadBatch(music, currentBatch);
    }
    
    // Load a specific batch of files (reuse from ambient-sounds)
    async loadBatch(music, filesToLoad) {
        const batchPromises = filesToLoad.map(file => this.loadSingleAudioFile(file));
        const results = await Promise.all(batchPromises);
        
        const loadedElements = results.filter(result => result !== null);
        music.audioElements.push(...loadedElements);
        
        console.log(`✅ Music batch loaded: ${loadedElements.length}/${filesToLoad.length} tracks. Total: ${music.audioElements.length} tracks available`);
        
        music.loadingInBackground = false;
        music.filesUsed = Math.max(0, music.filesUsed - 3);
        
        if (music.pendingFiles.length === 0) {
            console.log(`🎉 All tracks loaded for ${music.config.displayName}: ${music.audioElements.length} total tracks`);
        }
    }
    
    startSound(soundName) {
        console.log(`🎵 Starting lo-fi music: ${soundName}`);
        
        if (!this.sounds[soundName]) {
            console.log(`❌ Music ${soundName} not found`);
            return;
        }
        
        const music = this.sounds[soundName];
        
        if (music.isPlaying) {
            console.log(`⚠️ Music ${soundName} already playing`);
            return;
        }
        
        if (!music.loaded || music.audioElements.length === 0) {
            console.log(`❌ Music ${soundName} not loaded`);
            return;
        }
        
        // Select random track from available options
        const randomIndex = Math.floor(Math.random() * music.audioElements.length);
        const selectedElement = music.audioElements[randomIndex];
        
        console.log(`🎵 Playing ${soundName} track ${randomIndex}: ${selectedElement.file}`);
        
        // Update now playing display
        this.updateNowPlaying(this.extractTrackName(selectedElement.file));
        
        if (selectedElement.useWebAudio) {
            // Web Audio API playback
            const source = this.audioContext.createBufferSource();
            source.buffer = selectedElement.audioBuffer;
            source.loop = false; // No looping for music tracks
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = music.volume;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // Set up automatic next track when this one ends
            source.addEventListener('ended', () => {
                console.log(`Web Audio track ended, playing next`);
                this.playNextTrack(soundName);
            });
            
            source.start();
            
            // Store references for later control
            music.currentSource = source;
            music.currentGainNode = gainNode;
        } else {
            // HTML5 Audio playback
            selectedElement.audio.currentTime = 0;
            
            // Use Web Audio API gain control if available
            if (selectedElement.gainNode) {
                selectedElement.gainNode.gain.value = music.volume;
                selectedElement.audio.volume = 1.0;
            } else {
                selectedElement.audio.volume = music.volume;
            }
            
            selectedElement.audio.play();
        }
        
        music.isPlaying = true;
        music.currentIndex = randomIndex;
        music.filesUsed++;
        
        // Check if we need to load more files after using this one
        this.loadNextBatchIfNeeded(music);
    }
    
    // Play next track in sequence
    playNextTrack(soundName) {
        const music = this.sounds[soundName];
        if (!music || !music.isPlaying || music.audioElements.length <= 1) return;
        
        // Stop current track
        this.stopCurrentTrack(music);
        
        // Select next random track (different from current)
        const availableIndices = music.audioElements
            .map((_, index) => index)
            .filter(index => index !== music.currentIndex);
        
        if (availableIndices.length > 0) {
            const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            const nextElement = music.audioElements[nextIndex];
            
            music.currentIndex = nextIndex;
            music.filesUsed++;
            
            console.log(`🎵 Auto-playing next track: ${nextElement.file}`);
            
            // Update now playing display
            this.updateNowPlaying(this.extractTrackName(nextElement.file));
            
            // Start the next track
            if (nextElement.useWebAudio) {
                const source = this.audioContext.createBufferSource();
                source.buffer = nextElement.audioBuffer;
                source.loop = false;
                
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = music.volume;
                
                source.connect(gainNode);
                gainNode.connect(this.masterGain);
                
                source.addEventListener('ended', () => {
                    this.playNextTrack(soundName);
                });
                
                source.start();
                
                music.currentSource = source;
                music.currentGainNode = gainNode;
            } else {
                if (nextElement.gainNode) {
                    nextElement.gainNode.gain.value = music.volume;
                    nextElement.audio.volume = 1.0;
                } else {
                    nextElement.audio.volume = music.volume;
                }
                nextElement.audio.currentTime = 0;
                nextElement.audio.play();
            }
            
            // Check if we need to load more tracks
            this.loadNextBatchIfNeeded(music);
        }
    }
    
    // Stop current track without stopping the entire music session
    stopCurrentTrack(music) {
        if (music.currentSource) {
            music.currentSource.stop();
            music.currentSource = null;
            music.currentGainNode = null;
        } else if (music.audioElements[music.currentIndex]) {
            const element = music.audioElements[music.currentIndex];
            if (element.audio) {
                element.audio.pause();
                element.audio.currentTime = 0;
            }
        }
    }
    
    stopSound(soundName) {
        if (!this.sounds[soundName]) return;
        
        const music = this.sounds[soundName];
        if (music.isPlaying) {
            this.stopCurrentTrack(music);
            music.isPlaying = false;
            
            // Hide now playing display
            this.updateNowPlaying('');
        }
    }
    
    // Update the now playing display
    updateNowPlaying(trackName) {
        const nowPlayingEl = this.container.querySelector('#now-playing');
        if (nowPlayingEl) {
            if (trackName) {
                nowPlayingEl.textContent = `♪ Now Playing: ${trackName}`;
                nowPlayingEl.style.display = 'block';
            } else {
                nowPlayingEl.style.display = 'none';
            }
        }
    }
    
    async setVolume(soundName, volume) {
        if (!this.sounds[soundName]) return;
        
        const music = this.sounds[soundName];
        const normalizedVolume = (volume / 100) * music.config.baseGain;
        music.volume = normalizedVolume;
        
        // Lazy load music files only when volume > 0 and not loaded yet
        if (volume > 0 && !music.loaded) {
            console.log(`Lazy loading music for ${soundName}...`);
            try {
                const loadedMusic = await this.createLofiMusic(music.config);
                // Copy loaded data back to existing music object
                music.audioElements = loadedMusic.audioElements;
                music.availableFiles = loadedMusic.availableFiles;
                music.loaded = loadedMusic.loaded;
                music.currentTrackName = loadedMusic.currentTrackName;
            } catch (error) {
                console.error(`Failed to lazy load ${soundName}:`, error);
                return;
            }
        }
        
        if (volume > 0 && !music.isPlaying && music.loaded) {
            this.startSound(soundName);
        }
        
        // Apply volume to currently playing audio element
        if (music.isPlaying) {
            if (music.currentGainNode) {
                // Web Audio API - update gain node
                music.currentGainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
            } else if (music.audioElements[music.currentIndex]) {
                const currentElement = music.audioElements[music.currentIndex];
                if (currentElement.gainNode) {
                    // HTML5 + Web Audio API hybrid - update per-element gain node
                    currentElement.gainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
                } else if (currentElement.audio) {
                    // Pure HTML5 Audio fallback - update volume
                    currentElement.audio.volume = normalizedVolume;
                }
            }
        }
        
        if (volume === 0 && music.isPlaying) {
            this.stopSound(soundName);
        }
    }
    
    async updateMusicVolume(soundName, volume) {
        if (!this.isInitialized) {
            // Only initialize the audio context, not reload music
            await this.initialize();
        }
        await this.setVolume(soundName, volume);
        this.updateSliderScale(soundName, volume);
    }
    
    // Get combined audio data for oscilloscope visualization
    getCombinedAudioData() {
        let hasActiveMusic = false;
        
        // Check if any music is playing
        for (const [name, music] of Object.entries(this.sounds)) {
            if (music.isPlaying && music.volume > 0) {
                hasActiveMusic = true;
                break;
            }
        }
        
        if (!hasActiveMusic || !this.analyser) {
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
        
        // Apply music-specific visualization enhancements
        for (let i = 0; i < visualData.length; i++) {
            // Boost mid frequencies (common in lo-fi music)
            const midFreqBoost = (i >= 32 && i <= 128) ? 1.2 : 1.0;
            visualData[i] = Math.min(255, visualData[i] * midFreqBoost);
        }
        
        return visualData;
    }
    
    // Override base class method to remove specific global reference
    removeGlobalReference() {
        if (window.childLofiMusic === this) {
            window.childLofiMusic = null;
        }
    }
}