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
                
                <!-- Timer Options Button -->
                <button id="timer-window-${this.id}" style="font-size: 11px; padding: 4px 8px;">
                    <i class="iconoir-settings"></i> Timer Options
                </button>
            </div>
        `;
        
        // Cache DOM elements for performance
        this.elements = {
            timeDisplay: this.find(`#timer-time-${this.id}`),
            startBtn: this.find(`#timer-start-${this.id}`),
            pauseBtn: this.find(`#timer-pause-${this.id}`),
            resetBtn: this.find(`#timer-reset-${this.id}`),
            windowBtn: this.find(`#timer-window-${this.id}`),
            slider: this.find(`#timer-slider-${this.id}`),
            sliderLabel: this.find(`#slider-label-${this.id}`)
        };
        
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
        
        // Timer options button - open detailed window
        this.elements.windowBtn.addEventListener('click', () => this.openTimerWindow());
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
    
    setDuration(seconds) {
        this.pause();
        this.totalSeconds = Math.max(60, Math.min(120 * 60, seconds)); // 1 minute to 2 hours
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        
        // Update custom input display
        const minutes = Math.floor(this.totalSeconds / 60);
        this.elements.customInput.value = minutes;
        
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
            
            // Update today's session count
            this.elements.todaysSessionsDisplay.textContent = this.getTodaysSessionCount();
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
        // TODO: Implement dedicated timer window with presets, stats, etc.
        console.log('🪟 Opening timer options window...');
        
        if (window.updateStatus) {
            window.updateStatus('Timer window coming soon!', 'accent', 2000);
        }
    }
    
    // Cleanup when tool is destroyed
    destroy() {
        this.pause();
        
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