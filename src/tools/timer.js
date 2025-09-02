/**
 * Timer Tool - ES6 Module
 * Pomodoro and focus timer with session tracking and enhanced functionality
 * Built on the ucanduit tool framework
 */

import { ToolBase } from './tool-base.js';

export class TimerTool extends ToolBase {
    constructor(container) {
        super(container);
        
        // Timer state
        this.totalSeconds = 25 * 60; // Default 25 minutes (Pomodoro)
        this.remainingSeconds = this.totalSeconds;
        this.isRunning = false;
        this.intervalId = null;
        this.startTime = null;
        
        // Presets for common timer durations
        this.presets = {
            pomodoro: 25 * 60,
            shortBreak: 5 * 60,
            longBreak: 15 * 60,
            focus: 45 * 60,
            quick: 10 * 60
        };
        
        // Session tracking
        this.sessions = [];
        this.currentSession = null;
        
        // Timer uses existing main CSS styles
    }
    
    // Override base class init to load data before rendering
    async init() {
        await this.loadFromStorage();
        await super.init(); // This will call render() and bindEvents()
    }
    
    
    async loadFromStorage() {
        try {
            // Load timer sessions and settings
            if (window.__TAURI__ && window.__TAURI__.core) {
                const sessionData = await window.__TAURI__.core.invoke('read_json_file', {
                    filename: 'ucanduit-timer-sessions.json'
                });
                if (sessionData) {
                    this.sessions = sessionData.sessions || [];
                    console.log('✅ Timer sessions loaded from external file');
                }
            }
        } catch (error) {
            console.log('📁 No external timer file found, checking localStorage...');
        }
        
        try {
            // Fallback to localStorage
            const storedSessions = localStorage.getItem('ucanduit_timer_sessions');
            if (storedSessions && !this.sessions.length) {
                const data = JSON.parse(storedSessions);
                this.sessions = data.sessions || [];
                console.log('✅ Timer sessions loaded from localStorage');
                
                // Migrate to external file if Tauri available
                if (window.__TAURI__ && window.__TAURI__.core) {
                    await this.saveToStorage();
                    console.log('🔄 Migrated timer data to external file');
                }
            }
        } catch (error) {
            console.error('❌ Failed to load timer data:', error);
            this.sessions = [];
        }
    }
    
    async saveToStorage() {
        const data = {
            sessions: this.sessions
        };
        
        try {
            if (window.__TAURI__ && window.__TAURI__.core) {
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-timer-sessions.json',
                    data: data
                });
                console.log('✅ Timer sessions saved to external file');
            } else {
                localStorage.setItem('ucanduit_timer_sessions', JSON.stringify(data));
                console.log('✅ Timer sessions saved to localStorage');
            }
        } catch (error) {
            console.error('❌ Failed to save timer data:', error);
        }
    }
    
    async render() {
        const todaysSession = this.getTodaysSessionCount();
        
        this.container.innerHTML = `
            <div style="text-align: center;">
                <!-- Basic Timer View -->
                <div id="timer-basic-view-${this.id}" class="timer-view">
                    <!-- Timer Duration Display -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Quicksand', monospace;" id="timer-time-${this.id}">
                            ${this.formatTime(this.remainingSeconds)}
                        </div>
                    </div>
                    
                    <!-- Duration Slider -->
                    <div style="margin-bottom: 12px;">
                        <input type="range" class="slider" id="timer-slider-${this.id}" 
                               min="5" max="120" value="25" step="5">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                            <span id="slider-label-${this.id}">25 minutes</span>
                        </div>
                    </div>
                    
                    <!-- Timer Controls -->
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; margin-bottom: 10px;">
                        <button id="timer-start-${this.id}" style="font-size: 12px; padding: 6px 10px;">
                            ▶ Start
                        </button>
                        <button id="timer-pause-${this.id}" style="font-size: 12px; padding: 6px 10px;">
                            ⏸ Pause
                        </button>
                        <button id="timer-reset-${this.id}" style="font-size: 12px; padding: 6px 10px;">
                            ⏹ Reset
                        </button>
                    </div>
                    
                    <!-- Expand Options Button -->
                    <button id="timer-expand-${this.id}" style="font-size: 11px; padding: 4px 8px;">
                        <i class="iconoir-settings"></i> More Options
                    </button>
                </div>

                <!-- Expanded Timer View (hidden initially) -->
                <div id="timer-expanded-view-${this.id}" class="timer-view" style="display: none;">
                    <!-- Quick Presets -->
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Quick Presets</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            <button class="timer-preset-btn" data-minutes="5" style="font-size: 11px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center;">
                                <i class="iconoir-flash" style="margin-bottom: 2px;"></i>
                                <span style="font-weight: 600;">5 min</span>
                                <span style="font-size: 9px; color: var(--text-secondary);">Quick</span>
                            </button>
                            <button class="timer-preset-btn" data-minutes="15" style="font-size: 11px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center;">
                                <i class="iconoir-coffee-cup" style="margin-bottom: 2px;"></i>
                                <span style="font-weight: 600;">15 min</span>
                                <span style="font-size: 9px; color: var(--text-secondary);">Break</span>
                            </button>
                            <button class="timer-preset-btn active" data-minutes="25" style="font-size: 11px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center;">
                                <i class="iconoir-timer" style="margin-bottom: 2px;"></i>
                                <span style="font-weight: 600;">25 min</span>
                                <span style="font-size: 9px; color: var(--text-secondary);">Pomodoro</span>
                            </button>
                            <button class="timer-preset-btn" data-minutes="45" style="font-size: 11px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center;">
                                <i class="iconoir-brain" style="margin-bottom: 2px;"></i>
                                <span style="font-weight: 600;">45 min</span>
                                <span style="font-size: 9px; color: var(--text-secondary);">Focus</span>
                            </button>
                        </div>
                    </div>

                    <!-- Today's Stats -->
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Today's Sessions</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                            <div style="text-align: center; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 4px;">
                                <div style="font-size: 16px; font-weight: 700; color: var(--success);" id="timer-sessions-today-${this.id}">${todaysSession}</div>
                                <div style="font-size: 9px; color: var(--text-secondary);">Completed</div>
                            </div>
                            <div style="text-align: center; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 4px;">
                                <div style="font-size: 16px; font-weight: 700; color: var(--primary);" id="timer-minutes-today-${this.id}">0</div>
                                <div style="font-size: 9px; color: var(--text-secondary);">Minutes</div>
                            </div>
                            <div style="text-align: center; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 4px;">
                                <div style="font-size: 16px; font-weight: 700; color: var(--accent);" id="timer-avg-session-${this.id}">0</div>
                                <div style="font-size: 9px; color: var(--text-secondary);">Avg Length</div>
                            </div>
                        </div>
                    </div>

                    <!-- Back Button -->
                    <button id="timer-back-${this.id}" style="font-size: 11px; padding: 4px 8px;">
                        <i class="iconoir-arrow-left"></i> Back
                    </button>
                </div>
            </div>
        `;
        
        // Cache DOM elements for performance
        this.elements = {
            // Basic view elements
            basicView: this.find(`#timer-basic-view-${this.id}`),
            timeDisplay: this.find(`#timer-time-${this.id}`),
            startBtn: this.find(`#timer-start-${this.id}`),
            pauseBtn: this.find(`#timer-pause-${this.id}`),
            resetBtn: this.find(`#timer-reset-${this.id}`),
            expandBtn: this.find(`#timer-expand-${this.id}`),
            slider: this.find(`#timer-slider-${this.id}`),
            sliderLabel: this.find(`#slider-label-${this.id}`),
            
            // Expanded view elements
            expandedView: this.find(`#timer-expanded-view-${this.id}`),
            backBtn: this.find(`#timer-back-${this.id}`),
            sessionsToday: this.find(`#timer-sessions-today-${this.id}`),
            minutesToday: this.find(`#timer-minutes-today-${this.id}`),
            avgSession: this.find(`#timer-avg-session-${this.id}`),
            
            // Preset buttons (will be found after render)
            presetBtns: []
        };
        
        // Find preset buttons
        this.elements.presetBtns = this.container.querySelectorAll('.timer-preset-btn');
        
        this.updateDisplay();
        
        // Initialize timer ring after DOM is ready
        setTimeout(() => {
            this.initializeTimerRing();
        }, 100);
    }
    
    bindEvents() {
        // Main control buttons
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.pauseBtn.addEventListener('click', () => this.pause());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        
        // Duration slider
        this.elements.slider.addEventListener('input', (e) => {
            const minutes = parseInt(e.target.value);
            this.setDuration(minutes * 60);
            this.elements.sliderLabel.textContent = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        });
        
        // View toggle buttons
        this.elements.expandBtn.addEventListener('click', () => this.showExpandedView());
        this.elements.backBtn.addEventListener('click', () => this.showBasicView());
        
        // Preset buttons
        this.elements.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                this.setDuration(minutes * 60);
                this.updateActivePreset(minutes);
            });
        });
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateDisplay() {
        // Update time display
        this.elements.timeDisplay.textContent = this.formatTime(this.remainingSeconds);
        
        // Update slider to match current duration
        const minutes = Math.floor(this.totalSeconds / 60);
        this.elements.slider.value = minutes;
        this.elements.sliderLabel.textContent = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        
        // Update timer ring in oscilloscope
        this.updateTimerRing();
        
        // Calculate progress for oscilloscope integration
        const progress = 1 - (this.remainingSeconds / this.totalSeconds);
        
        // Notify parent window for oscilloscope integration
        if (window.timerUpdate) {
            window.timerUpdate(progress, this.isRunning, this.remainingSeconds);
        }
    }
    
    start() {
        if (this.isRunning || this.remainingSeconds === 0) return;
        
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Create new session record
        this.currentSession = {
            id: this.generateId(),
            startTime: this.startTime,
            duration: this.totalSeconds,
            type: this.getSessionType(),
            completed: false
        };
        
        // Start countdown
        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.updateDisplay();
            
            if (this.remainingSeconds === 0) {
                this.complete();
            }
        }, 1000);
        
        // Analytics tracking
        if (window.usageAnalytics) {
            const durationMinutes = Math.floor(this.totalSeconds / 60);
            window.usageAnalytics.trackTimerStart(durationMinutes);
        }
        
        // Status update
        if (window.updateStatus) {
            window.updateStatus('Timer Started', 'success', 2000);
        }
        
        console.log(`🍅 Timer started: ${Math.floor(this.totalSeconds / 60)} minutes`);
    }
    
    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Update current session with pause time
        if (this.currentSession) {
            this.currentSession.pausedAt = Date.now();
        }
        
        this.updateDisplay();
        
        if (window.updateStatus) {
            window.updateStatus('Timer Paused', 'warning', 2000);
        }
        
        console.log('⏸️ Timer paused');
    }
    
    reset() {
        this.pause();
        this.remainingSeconds = this.totalSeconds;
        this.currentSession = null;
        this.updateDisplay();
        
        if (window.updateStatus) {
            window.updateStatus('Timer Reset', 'accent', 2000);
        }
        
        console.log('⏹️ Timer reset');
    }
    
    showExpandedView() {
        this.elements.basicView.style.display = 'none';
        this.elements.expandedView.style.display = 'block';
        this.updateStats();
    }
    
    showBasicView() {
        this.elements.basicView.style.display = 'block';
        this.elements.expandedView.style.display = 'none';
    }
    
    updateActivePreset(minutes) {
        this.elements.presetBtns.forEach(btn => {
            const isActive = parseInt(btn.dataset.minutes) === minutes;
            btn.classList.toggle('active', isActive);
        });
    }
    
    updateStats() {
        const today = new Date().toDateString();
        const todaySessions = this.sessions.filter(session => {
            const sessionDate = new Date(session.startTime).toDateString();
            return sessionDate === today && session.completed;
        });

        // Update session count
        this.elements.sessionsToday.textContent = todaySessions.length;
        
        // Calculate total minutes today
        const totalMinutes = todaySessions.reduce((sum, session) => 
            sum + Math.floor(session.duration / 60), 0);
        this.elements.minutesToday.textContent = totalMinutes;
        
        // Calculate average session length
        const avgSession = todaySessions.length > 0 ? 
            Math.round(totalMinutes / todaySessions.length) : 0;
        this.elements.avgSession.textContent = avgSession;
    }
    
    setDuration(seconds) {
        this.pause();
        this.totalSeconds = Math.max(60, Math.min(120 * 60, seconds)); // 1 minute to 2 hours
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        
        // Update slider display
        const minutes = Math.floor(this.totalSeconds / 60);
        this.elements.slider.value = minutes;
        
        // Update active preset
        this.updateActivePreset(minutes);
        
        console.log(`⏱️ Timer duration set to ${minutes} minutes`);
    }
    
    complete() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Complete the current session
        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
            this.currentSession.completed = true;
            this.currentSession.actualDuration = this.currentSession.endTime - this.currentSession.startTime;
            
            // Add to sessions history
            this.sessions.push(this.currentSession);
            this.saveToStorage();
            
            // Update stats if expanded view is showing
            if (this.elements.expandedView.style.display !== 'none') {
                this.updateStats();
            }
        }
        
        this.updateDisplay();
        
        // Analytics tracking
        if (window.usageAnalytics && this.startTime) {
            const actualMinutes = Math.floor((Date.now() - this.startTime) / 1000 / 60);
            window.usageAnalytics.trackTimerComplete(actualMinutes);
        }
        
        // Status and sound
        if (window.updateStatus) {
            window.updateStatus('🎉 Timer Complete!', 'success', 5000);
        }
        
        this.playCompletionSound();
        
        // Notify parent for oscilloscope celebration
        if (window.timerComplete) {
            window.timerComplete();
        }
        
        // Auto-reset after display time
        setTimeout(() => {
            this.reset();
        }, 3000);
        
        console.log('🎉 Timer completed!');
    }
    
    playCompletionSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a more pleasant completion chime
            const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 chord
            const duration = 0.8;
            
            frequencies.forEach((freq, i) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = 'sine';
                
                const startTime = audioContext.currentTime + (i * 0.1);
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            });
        } catch (error) {
            console.log('Could not play completion sound:', error);
        }
    }
    
    getTodaysSessionCount() {
        const today = new Date().toDateString();
        return this.sessions.filter(session => {
            const sessionDate = new Date(session.startTime).toDateString();
            return sessionDate === today && session.completed;
        }).length;
    }
    
    getSessionType() {
        // Try to determine session type based on duration
        const minutes = Math.floor(this.totalSeconds / 60);
        if (minutes === 25) return 'pomodoro';
        if (minutes === 5) return 'shortBreak';
        if (minutes === 15) return 'longBreak';
        if (minutes === 45) return 'focus';
        if (minutes === 10) return 'quick';
        return 'custom';
    }
    
    updateSessionType(type) {
        // This could be used to update UI to show current session type
        console.log(`📋 Session type: ${type}`);
    }
    
    initializeTimerRing() {
        const timerRing = document.getElementById('timer-ring');
        const timerRingBackground = document.getElementById('timer-ring-background');
        const timerRingProgress = document.getElementById('timer-ring-progress');
        const oscilloscopeContainer = document.getElementById('oscilloscope-container');
        
        if (!timerRing || !timerRingBackground || !timerRingProgress || !oscilloscopeContainer) {
            console.warn('Timer ring elements not found');
            return;
        }
        
        // Get oscilloscope container dimensions
        const containerRect = oscilloscopeContainer.getBoundingClientRect();
        const containerSize = Math.min(containerRect.width, containerRect.height);
        
        // Calculate ring dimensions (slightly larger than container)
        const ringSize = containerSize + 20;
        const ringRadius = (ringSize / 2) - 10;
        const center = ringSize / 2;
        const strokeWidth = 3;
        
        // Set SVG dimensions and positioning
        timerRing.setAttribute('width', ringSize);
        timerRing.setAttribute('height', ringSize);
        timerRing.style.top = '-10px';
        timerRing.style.left = '-10px';
        
        // Configure background circle
        timerRingBackground.setAttribute('cx', center);
        timerRingBackground.setAttribute('cy', center);
        timerRingBackground.setAttribute('r', ringRadius);
        timerRingBackground.setAttribute('stroke', 'rgba(42, 45, 52, 0.1)');
        timerRingBackground.setAttribute('stroke-width', strokeWidth);
        
        // Configure progress circle
        timerRingProgress.setAttribute('cx', center);
        timerRingProgress.setAttribute('cy', center);
        timerRingProgress.setAttribute('r', ringRadius);
        timerRingProgress.setAttribute('stroke-width', strokeWidth);
        
        // Calculate circumference and set up stroke-dasharray
        this.ringCircumference = 2 * Math.PI * ringRadius;
        timerRingProgress.style.strokeDasharray = this.ringCircumference;
        timerRingProgress.style.strokeDashoffset = this.ringCircumference;
        timerRingProgress.style.transformOrigin = `${center}px ${center}px`;
        
        console.log(`🎯 Timer ring initialized: ${ringSize}x${ringSize}, radius: ${ringRadius}`);
    }
    
    updateTimerRing() {
        const timerRing = document.getElementById('timer-ring');
        const timerRingProgress = document.getElementById('timer-ring-progress');
        
        if (!timerRing || !timerRingProgress || !this.ringCircumference) {
            // Initialize if not already done
            this.initializeTimerRing();
            return;
        }
        
        if (this.isRunning && this.remainingSeconds > 0) {
            // Show timer ring
            timerRing.style.opacity = '1';
            
            // Calculate progress
            const progress = 1 - (this.remainingSeconds / this.totalSeconds);
            const strokeDashoffset = this.ringCircumference - (progress * this.ringCircumference);
            timerRingProgress.style.strokeDashoffset = strokeDashoffset;
            
            // Update ring color based on time remaining
            if (this.remainingSeconds < 60) {
                // Last minute - red
                timerRingProgress.style.stroke = 'var(--danger)';
            } else if (this.remainingSeconds < 300) {
                // Last 5 minutes - orange
                timerRingProgress.style.stroke = 'var(--warning)';
            } else {
                // Normal - green
                timerRingProgress.style.stroke = 'var(--udu-green)';
            }
        } else if (this.remainingSeconds === 0 && !this.isRunning) {
            // Timer completed - show full ring briefly
            timerRing.style.opacity = '1';
            timerRingProgress.style.strokeDashoffset = '0';
            timerRingProgress.style.stroke = 'var(--success)';
            
            // Hide after celebration
            setTimeout(() => {
                timerRing.style.opacity = '0';
            }, 3000);
        } else {
            // Hide timer ring when not running
            timerRing.style.opacity = '0';
        }
    }
    
    async openTimerWindow() {
        try {
            // Setup message listeners for timer window communication
            this.setupTimerWindowListeners();
            
            if (!window.__TAURI__) {
                // Browser fallback - open in new tab
                const url = '../src/timer-window.html';
                window.open(url, '_blank', 'width=400,height=600');
                if (window.updateStatus) {
                    window.updateStatus('Opened timer window (browser mode)', 'primary', 2000);
                }
                return;
            }

            // Use the same pattern as working memo/weather windows
            if (window.__TAURI__.webview && window.__TAURI__.webviewWindow) {
                const { webviewWindow } = window.__TAURI__;
                
                const windowLabel = `timer-window-${Date.now()}`;
                const windowTitle = `Timer - ucanduit`;
                    
                const timerWindow = new webviewWindow.WebviewWindow(windowLabel, {
                    url: '../src/timer-window.html',
                    title: windowTitle,
                    width: 400,
                    height: 600,
                    alwaysOnTop: false,
                    decorations: true,
                    transparent: false,
                    titleBarStyle: 'overlay',
                    center: true
                });

                // Handle window events
                timerWindow.once('tauri://created', () => {
                    console.log('Timer window created successfully');
                    if (window.updateStatus) {
                        window.updateStatus('Timer window opened', 'success', 2000);
                    }
                });

                timerWindow.once('tauri://error', (error) => {
                    console.error('Timer window creation error:', error);
                    if (window.updateStatus) {
                        window.updateStatus('Failed to open timer window', 'danger', 3000);
                    }
                });
                
            } else {
                throw new Error('webviewWindow API not available');
            }

        } catch (error) {
            console.error('Error opening timer window:', error);
            if (window.updateStatus) {
                window.updateStatus('Error: ' + error.message, 'danger', 3000);
            }
            
            // Fallback: open in browser tab
            const fallbackUrl = './src/timer-window.html';
            window.open(fallbackUrl, '_blank', 'width=400,height=600');
        }
    }
    
    setupTimerWindowListeners() {
        if (this.listenersSetup) return; // Avoid duplicate listeners
        this.listenersSetup = true;
        
        // Setup Tauri event listener
        if (window.__TAURI__ && window.__TAURI__.event) {
            const { listen } = window.__TAURI__.event;
            listen('timer-window-action', (event) => {
                console.log('🔗 Received Tauri event:', event);
                this.handleTimerWindowMessage(event.payload);
            });
            console.log('🔗 Tauri timer window listeners setup');
        }
        
        // Setup browser fallback listener using localStorage polling
        this.setupBrowserFallbackListener();
        
        console.log('🔗 Timer window listeners setup complete');
    }
    
    setupBrowserFallbackListener() {
        // Poll localStorage for messages from timer window
        this.messageCheckInterval = setInterval(() => {
            try {
                const messageData = localStorage.getItem('timer-window-message');
                if (messageData) {
                    const message = JSON.parse(messageData);
                    
                    // Only process if it's a new message (timestamp check)
                    if (!this.lastProcessedTimestamp || message.timestamp > this.lastProcessedTimestamp) {
                        this.lastProcessedTimestamp = message.timestamp;
                        console.log('🔗 Received browser fallback message:', message);
                        this.handleTimerWindowMessage(message);
                        
                        // Clear the message after processing
                        localStorage.removeItem('timer-window-message');
                    }
                }
            } catch (error) {
                console.error('Error processing timer window message:', error);
            }
        }, 100); // Check every 100ms
        
        console.log('🔗 Browser fallback listener setup with localStorage polling');
    }
    
    handleTimerWindowMessage(message) {
        const { action, data } = message;
        console.log(`📨 Received timer window action: ${action}`, data);
        
        switch (action) {
            case 'timer-start':
                this.start();
                break;
            case 'timer-pause':
                this.pause();
                break;
            case 'timer-reset':
                this.reset();
                break;
            case 'timer-set-duration':
                if (data && data.seconds) {
                    this.setDuration(data.seconds);
                }
                break;
            default:
                console.warn(`Unknown timer window action: ${action}`);
        }
    }
    
    // Cleanup when tool is destroyed
    destroy() {
        this.pause();
        
        // Clean up message polling interval
        if (this.messageCheckInterval) {
            clearInterval(this.messageCheckInterval);
            this.messageCheckInterval = null;
        }
        
        // Hide timer ring
        const timerRing = document.getElementById('timer-ring');
        if (timerRing) {
            timerRing.style.opacity = '0';
        }
        
        if (window.updateStatus) {
            window.updateStatus('Assistant Ready', 'success');
        }
        
        console.log('🧹 Timer tool cleaned up');
    }
}