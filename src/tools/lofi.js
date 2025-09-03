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
        console.log('🔍 [LofiTool] Starting directory discovery...');
        try {
            await this.waitForTauri();
            console.log('🦀 [LofiTool] Tauri ready, scanning audio directories...');
            
            const { core } = window.__TAURI__;
            const audioDirectories = await core.invoke('scan_audio_directories');
            console.log('📁 [LofiTool] Audio directories found:', audioDirectories.length);
            console.log('📋 [LofiTool] Full directory list:', audioDirectories);
            
            // Build music configurations from discovered directories - only include "Lofi" directory
            this.musicConfigs = {};
            let foundLofiDir = false;
            
            for (const dir of audioDirectories) {
                console.log(`🔍 [LofiTool] Checking directory: "${dir.name}" (${dir.file_count} files)`);
                
                // Only include directories named "Lofi" (case insensitive)
                if (dir.name.toLowerCase() === 'lofi' || dir.name.toLowerCase() === 'lo-fi' || dir.name.toLowerCase() === '') {
                    const key = 'lofi-music';
                    
                    this.musicConfigs[key] = {
                        directory: dir.path, // Already formatted as /audio/{name}
                        baseGain: 0.9,
                        displayName: 'Volume',
                        fileCount: dir.file_count
                    };
                    
                    console.log(`✅ [LofiTool] Found Lofi directory: "${dir.name}" at ${dir.path} with ${dir.file_count} files`);
                    foundLofiDir = true;
                    break; // We only want the Lofi directory
                } else {
                    console.log(`⏭️ [LofiTool] Skipping directory: "${dir.name}" (not a Lofi directory)`);
                }
            }
            
            // If no Lofi directory found, log a warning
            if (!foundLofiDir) {
                console.warn('⚠️ [LofiTool] No "Lofi" directory found in audio directories');
                console.log('📝 [LofiTool] Available directories were:', audioDirectories.map(d => d.name));
                
                // Create a placeholder that will show "no music found" message
                this.musicConfigs['no-lofi'] = {
                    directory: '',
                    baseGain: 0.7,
                    displayName: 'No Lofi Directory Found',
                    fileCount: 0
                };
                console.log('🔧 [LofiTool] Created placeholder config for missing Lofi directory');
            }
            
            console.log('✅ [LofiTool] Directory discovery completed. Found configs:', Object.keys(this.musicConfigs));
            return true;
            
        } catch (error) {
            console.error('❌ [LofiTool] Failed to discover lo-fi directories:', error);
            this.musicConfigs = {};
            return false;
        }
    }
    
    async scanDirectory(directory, forceRefresh = false) {
        console.log('🔍 [LofiTool] About to scan lo-fi directory:', directory);
        console.log('🔧 [LofiTool] Force refresh:', forceRefresh);
        
        const cacheKey = directory;
        if (!forceRefresh && this.directoryCache.has(cacheKey)) {
            const cachedFiles = this.directoryCache.get(cacheKey);
            console.log('📋 [LofiTool] Using cached result for:', directory);
            console.log('📁 [LofiTool] Cached files count:', cachedFiles.length);
            return cachedFiles;
        }
        
        try {
            await this.waitForTauri();
            console.log('🦀 [LofiTool] Tauri ready, invoking scan_audio_directory...');
            
            const { core } = window.__TAURI__;
            
            const result = await core.invoke('scan_audio_directory', { 
                directoryPath: directory 
            });
            
            console.log('📁 [LofiTool] Raw scan result:', result);
            console.log('🎵 [LofiTool] Found files count:', result.files ? result.files.length : 0);
            
            // Convert to simple web paths
            const fileUrls = result.files.map(file => file.path);
            console.log('🔗 [LofiTool] Converted file URLs:', fileUrls);
            
            // Log file types found
            const fileTypes = fileUrls.map(url => url.split('.').pop().toLowerCase());
            const typeCount = fileTypes.reduce((acc, type) => {
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});
            console.log('🎶 [LofiTool] File types found:', typeCount);
            
            this.directoryCache.set(cacheKey, fileUrls);
            console.log('💾 [LofiTool] Cached results for:', directory);
            return fileUrls;
            
        } catch (error) {
            console.error(`❌ [LofiTool] Failed to scan directory ${directory}:`, error);
            return [];
        }
    }
    
    // Recursively scan directory and all subdirectories for audio files
    async scanDirectoryRecursive(directory, forceRefresh = false) {
        console.log('🌳 [LofiTool] Starting recursive scan of:', directory);
        console.log('🔧 [LofiTool] Force refresh:', forceRefresh);
        
        const cacheKey = `${directory}_recursive`;
        if (!forceRefresh && this.directoryCache.has(cacheKey)) {
            const cachedFiles = this.directoryCache.get(cacheKey);
            console.log('📋 [LofiTool] Using cached recursive result for:', directory);
            console.log('📁 [LofiTool] Cached files count:', cachedFiles.length);
            return cachedFiles;
        }
        
        let allFiles = [];
        let mainDirFiles = []; // Declare outside try block to fix scope issue
        
        try {
            await this.waitForTauri();
            const { core } = window.__TAURI__;
            
            // First, scan the main directory
            console.log('📁 [LofiTool] Scanning main directory:', directory);
            mainDirFiles = await this.scanDirectory(directory, forceRefresh);
            console.log(`📁 [LofiTool] Found ${mainDirFiles.length} files in main directory`);
            allFiles.push(...mainDirFiles);
            
            // For subdirectories, we need to use a different approach since scan_audio_directories 
            // scans the entire audio root. Let's try using the scan_audio_directory with 
            // individual subdirectory paths if we can discover them
            console.log('🔍 [LofiTool] Attempting to find subdirectories using filesystem...');
            
            // Try alternative method: scan with recursive flag if supported
            try {
                const recursiveResult = await core.invoke('scan_audio_directory', { 
                    directoryPath: directory,
                    recursive: true  // Try with recursive flag
                });
                
                console.log('📁 [LofiTool] Recursive scan result:', recursiveResult);
                
                if (recursiveResult && recursiveResult.files && recursiveResult.files.length > mainDirFiles.length) {
                    // If recursive scan returned more files than the main directory scan
                    const recursiveFiles = recursiveResult.files.map(file => file.path);
                    console.log(`📂 [LofiTool] Recursive scan found ${recursiveFiles.length} total files`);
                    allFiles = recursiveFiles; // Use all recursive results
                } else {
                    console.log('📂 [LofiTool] Recursive scan not supported or no additional files found');
                }
            } catch (recursiveError) {
                console.log('⚠️ [LofiTool] Recursive scan parameter not supported:', recursiveError.message);
                
                // Manual subdirectory discovery approach
                // Since we only have the main directory files, let's manually check for common subdirectory patterns
                const commonSubdirs = ['chillhop', 'jazz', 'study', 'beats', 'ambient', 'piano', 'guitar', 'cafe', 'rain'];
                console.log('🔍 [LofiTool] Trying manual subdirectory discovery...');
                
                for (const subdir of commonSubdirs) {
                    try {
                        const subdirPath = `${directory}/${subdir}`;
                        console.log(`🔍 [LofiTool] Checking for subdirectory: ${subdirPath}`);
                        
                        const subdirFiles = await this.scanDirectory(subdirPath, forceRefresh);
                        if (subdirFiles.length > 0) {
                            console.log(`📂 [LofiTool] Found ${subdirFiles.length} files in ${subdir} subdirectory`);
                            allFiles.push(...subdirFiles);
                        }
                    } catch (subdirError) {
                        // Silently ignore if subdirectory doesn't exist
                        console.log(`📂 [LofiTool] Subdirectory ${subdir} not found or inaccessible`);
                    }
                }
            }
            
        } catch (error) {
            console.error(`❌ [LofiTool] Failed to scan directory recursively ${directory}:`, error);
            return mainDirFiles; // Return at least the main directory files
        }
        
        // Remove duplicates (in case a file appears in multiple scans)
        allFiles = [...new Set(allFiles)];
        
        console.log(`🌳 [LofiTool] Recursive scan complete for ${directory}:`);
        console.log(`   Total files found: ${allFiles.length}`);
        console.log(`   Files from main directory: ${mainDirFiles.length}`);
        console.log(`   Files from subdirectories: ${allFiles.length - mainDirFiles.length}`);
        
        // Log which subdirectories contributed files
        const subdirFiles = allFiles.filter(file => !mainDirFiles.includes(file));
        if (subdirFiles.length > 0) {
            const subdirs = [...new Set(subdirFiles.map(file => {
                const parts = file.split('/');
                const lofiIndex = parts.findIndex(part => part.toLowerCase() === 'lofi');
                return lofiIndex >= 0 && lofiIndex < parts.length - 1 ? parts[lofiIndex + 1] : 'unknown';
            }))];
            console.log(`📂 [LofiTool] Subdirectories with files:`, subdirs);
        }
        
        // Cache the results
        this.directoryCache.set(cacheKey, allFiles);
        console.log('💾 [LofiTool] Cached recursive results for:', directory);
        
        return allFiles;
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

        // Add CSS class to container for scoped styling
        this.container.classList.add('lofi-tool');
        
        this.container.innerHTML = `
            <div class="lofi-header">
                <!-- Album Icon - shown when playing -->
                <div class="album-icon" id="album-icon">
                    <i class="iconoir-album-open"></i>
                </div>
<!-- Now Playing - Below Controls -->
                <div class="now-playing" id="now-playing">
                    ♪ Now Playing: Loading...
                </div>
            </div>
            
            <div class="music-controls">
                ${musicItems}
            </div>
            
            <div class="audio-status" id="audio-status">
                Loading lo-fi music files...
            </div>
                
                <!-- Playback Controls - Always Visible -->
                <div class="playback-controls" id="playback-controls">
                    <button class="control-btn" id="skip-back" title="Previous Track">
                        <i class="iconoir-skip-prev"></i>
                    </button>
                    
                    <button class="control-btn" id="play-pause" title="Play/Pause">
                        <i class="iconoir-play" id="play-pause-icon"></i>
                    </button>
                    
                    <button class="control-btn" id="skip-forward" title="Next Track">
                        <i class="iconoir-skip-next"></i>
                    </button>
                </div>
                
                
            
            ${this.getSliderStyles()}
        `;
    }
    
    bindEvents() {
        console.log(`[LofiTool] bindEvents() called`);
        this.bindSliderEvents();
        this.bindControlEvents();
    }
    
    bindControlEvents() {
        // Play/Pause button
        const playPauseBtn = this.container.querySelector('#play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        // Skip back button
        const skipBackBtn = this.container.querySelector('#skip-back');
        if (skipBackBtn) {
            skipBackBtn.addEventListener('click', () => {
                this.skipToTrack('previous');
            });
        }
        
        // Skip forward button
        const skipForwardBtn = this.container.querySelector('#skip-forward');
        if (skipForwardBtn) {
            skipForwardBtn.addEventListener('click', () => {
                this.skipToTrack('next');
            });
        }
    }
    
    // Add styles for control buttons
    getControlStyles() {
        return `
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                
                .control-btn:hover {
                    transform: scale(1.1);
                    background-color: var(--background-hover, rgba(78, 207, 157, 0.1)) !important;
                }
                
                .play-pause-btn:hover {
                    background-color: var(--accent-hover, #3fb88a) !important;
                    transform: scale(1.05);
                }
                
                .control-btn:active {
                    transform: scale(0.95);
                }
                
                .playback-controls {
                    animation: fadeIn 0.3s ease-in-out;
                }
                
                .album-icon {
                    animation: fadeIn 0.5s ease-in-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
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
                    currentTrackName: '',
                    loadingInBackground: false,
                    backgroundBatchSize: 5,
                    filesUsed: 0,
                    pendingFiles: []
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
        console.log(`🎵 [LofiTool] Creating lo-fi music for: ${config.displayName}`);
        console.log(`📁 [LofiTool] Directory: ${config.directory}`);
        console.log(`🔧 [LofiTool] Force refresh: ${forceRefresh}`);
        
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
            console.log(`🔍 [LofiTool] Scanning directory and subdirectories for ${config.displayName}...`);
            music.availableFiles = await this.scanDirectoryRecursive(config.directory, forceRefresh);
            console.log(`📁 [LofiTool] Found ${music.availableFiles.length} total files for ${config.displayName}`);
            
            if (music.availableFiles.length > 0) {
                // Filter files by format preference (MP3 first, then others)
                const mp3Files = music.availableFiles.filter(file => file.toLowerCase().endsWith('.mp3'));
                const otherFiles = music.availableFiles.filter(file => !file.toLowerCase().endsWith('.mp3','.wav'));
                
                console.log(`🎶 [LofiTool] File breakdown for ${config.displayName}:`);
                console.log(`   MP3 files: ${mp3Files.length}`);
                console.log(`   Other files: ${otherFiles.length}`);
                
                // Prefer MP3 files for music
                const filesToUse = mp3Files.length > 0 ? mp3Files : otherFiles;
                
                console.log(`🎯 [LofiTool] Using ${filesToUse.length} ${mp3Files.length > 0 ? 'MP3' : 'other'} files for ${config.displayName}`);
                console.log(`🎵 [LofiTool] Files to use:`, filesToUse.map(f => f.split('/').pop()));
                
                // Load only the FIRST file immediately for instant playback
                if (filesToUse.length > 0) {
                    const firstFile = filesToUse[0];
                    console.log(`⚡ [LofiTool] Loading first track for instant playback: ${firstFile.split('/').pop()}`);
                    
                    const firstElement = await this.loadSingleAudioFile(firstFile);
                    
                    if (firstElement) {
                        music.audioElements = [firstElement];
                        music.loaded = true;
                        music.currentTrackName = this.extractTrackName(firstFile);
                        console.log(`✅ [LofiTool] ${config.displayName}: First track loaded successfully!`);
                        console.log(`🎼 [LofiTool] Track name: "${music.currentTrackName}"`);
                        console.log(`🔊 [LofiTool] Audio method: ${firstElement.useWebAudio ? 'Web Audio API' : 'HTML5 Audio'}`);
                        
                        // Queue remaining files for gradual loading
                        if (filesToUse.length > 1) {
                            music.pendingFiles = filesToUse.slice(1);
                            console.log(`⏳ [LofiTool] Queued ${music.pendingFiles.length} additional tracks for background loading`);
                            this.loadNextBatchIfNeeded(music);
                        } else {
                            console.log(`ℹ️ [LofiTool] Only one track available, no background loading needed`);
                        }
                    } else {
                        console.warn(`❌ [LofiTool] Failed to load first track for ${config.displayName}: ${firstFile}`);
                    }
                }
            } else {
                console.warn(`⚠️ [LofiTool] No files found in directory for ${config.displayName}`);
            }
        } catch (error) {
            console.error(`❌ [LofiTool] Failed to load music for ${config.displayName}:`, error);
        }
        
        console.log(`📊 [LofiTool] Music creation complete for ${config.displayName}:`);
        console.log(`   Loaded: ${music.loaded}`);
        console.log(`   Audio elements: ${music.audioElements.length}`);
        console.log(`   Pending files: ${music.pendingFiles.length}`);
        
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
        console.log(`🔄 [LofiTool] Checking if next batch needed for ${music.config.displayName}`);
        console.log(`   Loading in background: ${music.loadingInBackground}`);
        console.log(`   Pending files: ${music.pendingFiles ? music.pendingFiles.length : 'undefined'}`);
        console.log(`   Audio elements: ${music.audioElements.length}`);
        console.log(`   Files used: ${music.filesUsed}`);
        
        if (music.loadingInBackground || !music.pendingFiles || music.pendingFiles.length === 0) {
            console.log(`⏸️ [LofiTool] Skipping batch load: loading=${music.loadingInBackground}, pendingFiles=${music.pendingFiles?.length || 0}`);
            return;
        }
        
        // Load more aggressively for music - when we have fewer than 5 files or 3/5 have been used
        const shouldLoadMore = music.audioElements.length < 5 || music.filesUsed >= 3;
        
        console.log(`📊 [LofiTool] Load more check: audioElements=${music.audioElements.length}<5 OR filesUsed=${music.filesUsed}>=3 = ${shouldLoadMore}`);
        
        if (!shouldLoadMore) {
            console.log(`⏸️ [LofiTool] No need to load more files yet`);
            return;
        }
        
        music.loadingInBackground = true;
        const batchSize = Math.min(music.backgroundBatchSize, music.pendingFiles.length);
        const currentBatch = music.pendingFiles.splice(0, batchSize);
        
        console.log(`🚀 [LofiTool] Loading next music batch for ${music.config.displayName}:`);
        console.log(`   Batch size: ${batchSize} files`);
        console.log(`   Files to load:`, currentBatch.map(f => f.split('/').pop()));
        console.log(`   Remaining in queue: ${music.pendingFiles.length}`);
        
        this.loadBatch(music, currentBatch);
    }
    
    // Load a specific batch of files (reuse from ambient-sounds)
    async loadBatch(music, filesToLoad) {
        console.log(`⚡ [LofiTool] Starting batch load for ${music.config.displayName}`);
        console.log(`📁 [LofiTool] Loading ${filesToLoad.length} files in parallel...`);
        
        const batchPromises = filesToLoad.map(async (file, index) => {
            console.log(`🔄 [LofiTool] Loading file ${index + 1}/${filesToLoad.length}: ${file.split('/').pop()}`);
            return await this.loadSingleAudioFile(file);
        });
        
        const results = await Promise.all(batchPromises);
        
        const loadedElements = results.filter(result => result !== null);
        const failedCount = results.length - loadedElements.length;
        
        music.audioElements.push(...loadedElements);
        
        console.log(`✅ [LofiTool] Batch load complete for ${music.config.displayName}:`);
        console.log(`   Successfully loaded: ${loadedElements.length}/${filesToLoad.length} tracks`);
        if (failedCount > 0) {
            console.log(`   Failed to load: ${failedCount} tracks`);
        }
        console.log(`   Total tracks available: ${music.audioElements.length}`);
        console.log(`   Loaded track names:`, loadedElements.map(e => e.file.split('/').pop()));
        
        music.loadingInBackground = false;
        music.filesUsed = Math.max(0, music.filesUsed - 3);
        
        console.log(`📊 [LofiTool] Updated stats: filesUsed=${music.filesUsed}, pendingFiles=${music.pendingFiles.length}`);
        
        if (music.pendingFiles.length === 0) {
            console.log(`🎉 [LofiTool] All tracks loaded for ${music.config.displayName}: ${music.audioElements.length} total tracks`);
        } else {
            console.log(`⏳ [LofiTool] ${music.pendingFiles.length} tracks remaining in queue`);
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
    
    // Play next track in sequence with crossfade (adapted from ambient-sounds-loops)
    playNextTrack(soundName, forceSkip = false) {
        const music = this.sounds[soundName];
        if (!music || (!music.isPlaying && !forceSkip) || music.audioElements.length <= 1) return;
        
        if (forceSkip) {
            // Immediate transition for manual skip
            this.stopCurrentTrack(music);
            
            const availableIndices = music.audioElements
                .map((_, index) => index)
                .filter(index => index !== music.currentIndex);
            
            if (availableIndices.length > 0) {
                const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                this.startTrackAtIndex(soundName, nextIndex);
            }
            return;
        }
        
        // Crossfade transition (adapted from ambient-sounds rotateSound method)
        const currentElement = music.audioElements[music.currentIndex];
        const currentVolume = music.volume;
        
        // Fade out current track
        const fadeOutInterval = setInterval(() => {
            let currentFadeVolume;
            
            if (music.currentGainNode) {
                // Web Audio API fade out
                currentFadeVolume = music.currentGainNode.gain.value;
                if (currentFadeVolume > 0.05) {
                    const newVolume = Math.max(0.05, currentFadeVolume - 0.1);
                    music.currentGainNode.gain.setValueAtTime(newVolume, this.audioContext.currentTime);
                } else {
                    clearInterval(fadeOutInterval);
                    this.stopCurrentTrack(music);
                    this.startNextTrackWithFadeIn(soundName, currentVolume);
                }
            } else if (currentElement && currentElement.audio) {
                // HTML5 Audio fade out
                currentFadeVolume = currentElement.audio.volume;
                if (currentFadeVolume > 0.05) {
                    currentElement.audio.volume = Math.max(0.05, currentFadeVolume - 0.1);
                } else {
                    clearInterval(fadeOutInterval);
                    this.stopCurrentTrack(music);
                    this.startNextTrackWithFadeIn(soundName, currentVolume);
                }
            } else {
                clearInterval(fadeOutInterval);
                this.startNextTrackWithFadeIn(soundName, currentVolume);
            }
        }, 150); // Faster fade than ambient sounds for music
    }
    
    // Start next track with fade in (helper method)
    startNextTrackWithFadeIn(soundName, targetVolume) {
        const music = this.sounds[soundName];
        
        // Select next random track
        const availableIndices = music.audioElements
            .map((_, index) => index)
            .filter(index => index !== music.currentIndex);
        
        if (availableIndices.length > 0) {
            const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            const nextElement = music.audioElements[nextIndex];
            
            music.currentIndex = nextIndex;
            music.filesUsed++;
            
            console.log(`🎵 Crossfading to next track: ${nextElement.file}`);
            
            // Update now playing display
            this.updateNowPlaying(this.extractTrackName(nextElement.file));
            
            // Start the next track at low volume
            if (nextElement.useWebAudio) {
                // Web Audio API
                const source = this.audioContext.createBufferSource();
                source.buffer = nextElement.audioBuffer;
                source.loop = false;
                
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0.05; // Start very quiet
                
                source.connect(gainNode);
                gainNode.connect(this.masterGain);
                
                source.addEventListener('ended', () => {
                    this.playNextTrack(soundName);
                });
                
                source.start();
                
                music.currentSource = source;
                music.currentGainNode = gainNode;
                
                // Fade in new track
                const fadeInInterval = setInterval(() => {
                    const currentFadeVolume = gainNode.gain.value;
                    if (currentFadeVolume < targetVolume) {
                        const newVolume = Math.min(targetVolume, currentFadeVolume + 0.1);
                        gainNode.gain.setValueAtTime(newVolume, this.audioContext.currentTime);
                    } else {
                        clearInterval(fadeInInterval);
                    }
                }, 150);
                
            } else {
                // HTML5 Audio
                if (nextElement.gainNode) {
                    nextElement.gainNode.gain.value = 0.05;
                    nextElement.audio.volume = 1.0;
                } else {
                    nextElement.audio.volume = 0.05;
                }
                nextElement.audio.currentTime = 0;
                nextElement.audio.play();
                
                // Fade in new track
                const fadeInInterval = setInterval(() => {
                    let currentFadeVolume;
                    if (nextElement.gainNode) {
                        currentFadeVolume = nextElement.gainNode.gain.value;
                        if (currentFadeVolume < targetVolume) {
                            const newVolume = Math.min(targetVolume, currentFadeVolume + 0.1);
                            nextElement.gainNode.gain.setValueAtTime(newVolume, this.audioContext.currentTime);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    } else {
                        currentFadeVolume = nextElement.audio.volume;
                        if (currentFadeVolume < targetVolume) {
                            nextElement.audio.volume = Math.min(targetVolume, currentFadeVolume + 0.1);
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }
                }, 150);
            }
            
            music.isPlaying = true;
            music.isPaused = false;
            
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
    
    // Update the now playing display and show/hide controls
    updateNowPlaying(trackName) {
        const nowPlayingEl = this.container.querySelector('#now-playing');
        const albumIcon = this.container.querySelector('#album-icon');
        
        if (trackName) {
            // Show now playing
            if (nowPlayingEl) {
                nowPlayingEl.textContent = `♪ Now Playing: ${trackName}`;
                nowPlayingEl.classList.add('show');
            }
            
            // Show album icon (controls are always visible now)
            if (albumIcon) {
                albumIcon.classList.add('show');
            }
            
            // Update play/pause button to show pause icon
            this.updatePlayPauseIcon(true);
        } else {
            // Hide elements when not playing
            if (nowPlayingEl) {
                nowPlayingEl.classList.remove('show');
            }
            if (albumIcon) {
                albumIcon.classList.remove('show');
            }
        }
    }
    
    // Update play/pause button icon
    updatePlayPauseIcon(isPlaying) {
        const playPauseIcon = this.container.querySelector('#play-pause-icon');
        if (playPauseIcon) {
            if (isPlaying) {
                playPauseIcon.className = 'iconoir-pause';
            } else {
                playPauseIcon.className = 'iconoir-play';
            }
        }
    }
    
    // Toggle play/pause
    togglePlayPause() {
        // Find the active music (first one that's playing)
        for (const [soundName, music] of Object.entries(this.sounds)) {
            if (music.volume > 0) {
                if (music.isPlaying) {
                    this.pauseSound(soundName);
                } else {
                    this.resumeSound(soundName);
                }
                break;
            }
        }
    }
    
    // Pause sound (without stopping completely)
    pauseSound(soundName) {
        if (!this.sounds[soundName]) return;
        
        const music = this.sounds[soundName];
        if (!music.isPlaying) return;
        
        if (music.currentSource) {
            // Web Audio API - can't pause, so we'll stop and remember position
            music.currentSource.stop();
            music.currentSource = null;
            music.currentGainNode = null;
        } else if (music.audioElements[music.currentIndex]) {
            // HTML5 Audio - can pause
            const element = music.audioElements[music.currentIndex];
            if (element.audio) {
                element.audio.pause();
            }
        }
        
        music.isPlaying = false;
        music.isPaused = true;
        this.updatePlayPauseIcon(false);
    }
    
    // Resume sound
    resumeSound(soundName) {
        if (!this.sounds[soundName]) return;
        
        const music = this.sounds[soundName];
        if (music.isPlaying || !music.isPaused) return;
        
        if (music.audioElements[music.currentIndex]) {
            const element = music.audioElements[music.currentIndex];
            
            if (element.useWebAudio) {
                // Web Audio API - need to create new source (can't resume)
                const source = this.audioContext.createBufferSource();
                source.buffer = element.audioBuffer;
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
                // HTML5 Audio - resume
                if (element.audio) {
                    element.audio.play();
                }
            }
        }
        
        music.isPlaying = true;
        music.isPaused = false;
        this.updatePlayPauseIcon(true);
    }
    
    // Skip to previous or next track
    skipToTrack(direction) {
        // Find the active music
        for (const [soundName, music] of Object.entries(this.sounds)) {
            if (music.volume > 0 && (music.isPlaying || music.isPaused)) {
                if (direction === 'next') {
                    this.playNextTrack(soundName, true); // Force skip
                } else {
                    this.playPreviousTrack(soundName);
                }
                break;
            }
        }
    }
    
    // Play previous track
    playPreviousTrack(soundName) {
        const music = this.sounds[soundName];
        if (!music || music.audioElements.length <= 1) return;
        
        // Stop current track
        this.stopCurrentTrack(music);
        
        // Get previous index
        let prevIndex = music.currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = music.audioElements.length - 1;
        }
        
        // Start previous track
        this.startTrackAtIndex(soundName, prevIndex);
    }
    
    // Start a specific track by index
    startTrackAtIndex(soundName, index) {
        const music = this.sounds[soundName];
        if (!music || !music.audioElements[index]) return;
        
        const selectedElement = music.audioElements[index];
        console.log(`🎵 Playing ${soundName} track ${index}: ${selectedElement.file}`);
        
        // Update now playing display
        this.updateNowPlaying(this.extractTrackName(selectedElement.file));
        
        if (selectedElement.useWebAudio) {
            // Web Audio API playback
            const source = this.audioContext.createBufferSource();
            source.buffer = selectedElement.audioBuffer;
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
            // HTML5 Audio playback
            selectedElement.audio.currentTime = 0;
            
            if (selectedElement.gainNode) {
                selectedElement.gainNode.gain.value = music.volume;
                selectedElement.audio.volume = 1.0;
            } else {
                selectedElement.audio.volume = music.volume;
            }
            
            selectedElement.audio.play();
        }
        
        music.isPlaying = true;
        music.isPaused = false;
        music.currentIndex = index;
        music.filesUsed++;
        
        this.loadNextBatchIfNeeded(music);
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