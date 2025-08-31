/**
 * Interactive Metaballs Oscilloscope Tool
 * A goo creature companion that responds to audio with metaballs visualization
 * Uses metaballs as masks to reveal breathing circles underneath
 */

export class OscilloscopeTool {
    constructor(canvasElement) {
        this.canvas = canvasElement || document.getElementById('oscilloscope-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas dimensions and center
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        
        // Rectangular boundary container system (adapts to window modes)
        this.containerBounds = { x: 0, y: 0, width: 0, height: 0 };
        this.showBoundary = false; // Optional visual boundary for debugging
        
        // Audio context and analyzer  
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = 0;
        
        // Animation state
        this.animationId = null;
        this.isPlaying = false;
        
        // Metaballs system
        this.metaballs = [];
        this.numMetaballs = 8;
        this.baseRadius = 25;
        
        // Goo creature behavior
        this.emotionalState = 'calm';
        this.currentEmote = null;
        this.thoughtBubble = null;
        
        // Audio detection
        this.audioThreshold = 10;
        this.hasActiveAudio = false;
        this.demoMode = false;
        
        // Breathing circles (now static background within container)
        this.breathingCircles = [];
        
        this.initializeCanvas();
        this.initializeBoundaryContainer();
        this.initializeBreathingBackground();
        this.initializeMetaballs();
        this.startVisualization();
    }
    
    initializeCanvas() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
        
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;
    }
    
    initializeBoundaryContainer() {
        // Get available canvas space
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        const canvasAspect = canvasWidth / canvasHeight;
        
        // Base dimensions from current OSSC effective area
        const baseWidth = 150;
        const baseHeight = 200;
        
        // Adapt boundary to window mode
        let containerWidth, containerHeight;
        
        if (canvasAspect > 1.2) {
            // Horizontal mode - use more horizontal space
            containerWidth = Math.min(baseWidth * 1.2, canvasWidth * 0.8);
            containerHeight = Math.min(baseHeight * 0.9, canvasHeight * 0.9);
        } else {
            // Vertical mode - use more vertical space  
            containerWidth = Math.min(baseWidth * 0.9, canvasWidth * 0.9);
            containerHeight = Math.min(baseHeight * 1.1, canvasHeight * 0.8);
        }
        
        // Center the boundary container
        this.containerBounds = {
            x: this.centerX - containerWidth / 2,
            y: this.centerY - containerHeight / 2,
            width: containerWidth,
            height: containerHeight
        };
        
        console.log('Rectangular boundary container initialized:', this.containerBounds);
    }
    
    initializeBreathingBackground() {
        // Static breathing circles that fill the container area
        const baseColor = window.currentBackgroundColor || '#4ecf9d';
        const complementary = this.getComplementaryColor(baseColor);
        const [analogous1, analogous2] = this.getAnalogousColors(complementary);
        
        const colors = [
            [complementary, analogous1],
            [complementary, analogous2], 
            [analogous1, analogous2],
            [analogous2, complementary],
            [analogous1, complementary],
        ];
        
        this.breathingCircles = [];
        const numCircles = 8;
        
        // Position breathing circles to fill the container bounds
        for (let i = 0; i < numCircles; i++) {
            const angle = (Math.PI * 2 * i / numCircles) + (Math.random() - 0.5) * 1.0;
            // Use container dimensions for positioning
            const maxDistanceX = this.containerBounds.width * 0.3;
            const maxDistanceY = this.containerBounds.height * 0.3;
            const distance = Math.random() * Math.min(maxDistanceX, maxDistanceY);
            
            this.breathingCircles.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                baseRadius: 20 + Math.random() * 30,
                colors: colors[Math.floor(Math.random() * colors.length)],
                breathingPhase: Math.random() * Math.PI * 2,
                breathingSpeed: 0.015 + Math.random() * 0.02,
                breathingScale: 0.8 + Math.random() * 0.4,
                opacity: 0.7 + Math.random() * 0.3
            });
        }
    }
    
    initializeMetaballs() {
        this.metaballs = [];
        
        // Create metaballs in organic cluster formation within container bounds
        const clusterRadius = Math.min(this.containerBounds.width, this.containerBounds.height) * 0.25;
        
        for (let i = 0; i < this.numMetaballs; i++) {
            const angle = (Math.PI * 2 * i / this.numMetaballs) + (Math.random() - 0.5) * 0.8;
            const distance = Math.random() * clusterRadius;
            
            this.metaballs.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                baseRadius: this.baseRadius + Math.random() * 10,
                currentRadius: this.baseRadius,
                vx: (Math.random() - 0.5) * 0.2, // Gentle organic movement
                vy: (Math.random() - 0.5) * 0.2,
                frequencyRange: {
                    start: Math.floor(i * 32),
                    end: Math.floor((i + 1) * 32)
                },
                breathingPhase: Math.random() * Math.PI * 2,
                breathingSpeed: 0.008 + Math.random() * 0.015
            });
        }
    }
    
    // Color utility methods
    hexToHsl(hex) {
        const r = parseInt(hex.substr(1, 2), 16) / 255;
        const g = parseInt(hex.substr(3, 2), 16) / 255;
        const b = parseInt(hex.substr(5, 2), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return [h * 360, s * 100, l * 100];
    }
    
    hslToHex(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = hue2rgb(p, q, h + 1/3);
        const g = hue2rgb(p, q, h);
        const b = hue2rgb(p, q, h - 1/3);
        
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    getComplementaryColor(hex) {
        const [h, s, l] = this.hexToHsl(hex);
        const complementaryH = (h + 180) % 360;
        return this.hslToHex(complementaryH, s, l);
    }
    
    getAnalogousColors(hex) {
        const [h, s, l] = this.hexToHsl(hex);
        const analogous1 = this.hslToHex((h + 30) % 360, s, l);
        const analogous2 = this.hslToHex((h - 30 + 360) % 360, s, l);
        return [analogous1, analogous2];
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    initializeAudio() {
        console.log('Using synthetic waveform for privacy-friendly operation');
        this.useSyntheticWaveform();
    }
    
    useSyntheticWaveform() {
        this.bufferLength = 256;
        this.dataArray = new Uint8Array(this.bufferLength);
        this.isPlaying = true;
        this.demoMode = true;
    }
    
    updateWaveformData() {
        // Check for data from both focus noise generator and ambient sounds
        const focusNoiseData = window.childFocusNoise ? window.childFocusNoise.getCombinedAudioData() : null;
        const ambientData = window.childAmbientNoise ? window.childAmbientNoise.getCombinedAudioData() : null;
        
        if (focusNoiseData || ambientData) {
            // Combine data from both sources
            let combinedData = null;
            
            if (focusNoiseData && ambientData) {
                const maxLength = Math.max(focusNoiseData.length, ambientData.length);
                combinedData = new Uint8Array(maxLength);
                for (let i = 0; i < maxLength; i++) {
                    const focus = i < focusNoiseData.length ? focusNoiseData[i] : 0;
                    const ambient = i < ambientData.length ? ambientData[i] : 0;
                    combinedData[i] = Math.min(255, focus + ambient);
                }
            } else {
                combinedData = focusNoiseData || ambientData;
            }
            
            // Update metaballs from audio data
            this.updateMetaballsFromAudio(combinedData);
            this.hasActiveAudio = true;
            
        } else if (this.demoMode) {
            // Generate synthetic animation
            this.generateDemoAnimation();
            this.hasActiveAudio = true;
        } else {
            this.hasActiveAudio = false;
        }
    }
    
    updateMetaballsFromAudio(audioData) {
        for (let i = 0; i < this.metaballs.length; i++) {
            const ball = this.metaballs[i];
            
            // Get frequency amplitude for this metaball's range
            let amplitude = 0;
            for (let j = ball.frequencyRange.start; j < ball.frequencyRange.end && j < audioData.length; j++) {
                amplitude += audioData[j];
            }
            amplitude /= (ball.frequencyRange.end - ball.frequencyRange.start);
            
            // Update metaball radius based on audio
            ball.currentRadius = ball.baseRadius + (amplitude / 255) * 25;
            
            // Organic movement with audio influence
            ball.breathingPhase += ball.breathingSpeed;
            const audioInfluence = (amplitude / 255) * 0.5;
            ball.x += ball.vx + Math.sin(ball.breathingPhase) * (0.3 + audioInfluence);
            ball.y += ball.vy + Math.cos(ball.breathingPhase * 1.1) * (0.2 + audioInfluence * 0.5);
            
            // Apply container physics
            this.applyContainerPhysics(ball);
        }
    }
    
    applyContainerPhysics(ball) {
        const margin = ball.currentRadius * 0.8;
        const bounds = this.containerBounds;
        
        // Convert to absolute coordinates
        const absX = this.centerX + ball.x;
        const absY = this.centerY + ball.y;
        
        // Check boundaries and bounce with squishing effect
        if (absX - margin < bounds.x) {
            ball.x = bounds.x + margin - this.centerX;
            ball.vx = Math.abs(ball.vx) * 0.5; // Gentle bounce
        } else if (absX + margin > bounds.x + bounds.width) {
            ball.x = bounds.x + bounds.width - margin - this.centerX;
            ball.vx = -Math.abs(ball.vx) * 0.5;
        }
        
        if (absY - margin < bounds.y) {
            ball.y = bounds.y + margin - this.centerY;
            ball.vy = Math.abs(ball.vy) * 0.5;
        } else if (absY + margin > bounds.y + bounds.height) {
            ball.y = bounds.y + bounds.height - margin - this.centerY;
            ball.vy = -Math.abs(ball.vy) * 0.5;
        }
    }
    
    generateDemoAnimation() {
        const time = Date.now() * 0.001;
        
        // Update metaballs with synthetic animation
        for (let i = 0; i < this.metaballs.length; i++) {
            const ball = this.metaballs[i];
            
            // Synthetic audio-like patterns
            const wave = Math.sin(time * 1.5 + i * 0.7) * 0.5 + 0.5;
            ball.currentRadius = ball.baseRadius + wave * 18;
            
            // Gentle organic movement
            ball.breathingPhase += ball.breathingSpeed;
            ball.x += Math.sin(ball.breathingPhase + i) * 0.15;
            ball.y += Math.cos(ball.breathingPhase * 0.9 + i) * 0.12;
            
            this.applyContainerPhysics(ball);
        }
    }
    
    drawBoundaryContainer() {
        if (!this.showBoundary) return;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            this.containerBounds.x,
            this.containerBounds.y,
            this.containerBounds.width,
            this.containerBounds.height
        );
        this.ctx.setLineDash([]);
    }
    
    drawBreathingBackground() {
        // Draw static breathing circles within container bounds as background
        this.ctx.save();
        
        // Clip to container bounds
        this.ctx.beginPath();
        this.ctx.rect(
            this.containerBounds.x,
            this.containerBounds.y,
            this.containerBounds.width,
            this.containerBounds.height
        );
        this.ctx.clip();
        
        // Draw all breathing circles
        this.breathingCircles.forEach(circle => {
            circle.breathingPhase += circle.breathingSpeed;
            
            const breathingScale = circle.breathingScale + 0.25 * Math.sin(circle.breathingPhase);
            const currentRadius = circle.baseRadius * breathingScale;
            
            const circleX = this.centerX + circle.x;
            const circleY = this.centerY + circle.y;
            
            const gradient = this.ctx.createRadialGradient(
                circleX, circleY, 0,
                circleX, circleY, currentRadius
            );
            
            const color1 = this.hexToRgba(circle.colors[0], circle.opacity);
            const color2 = this.hexToRgba(circle.colors[1], circle.opacity * 0.5);
            
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(circleX, circleY, currentRadius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }
    
    drawMetaballsMask() {
        // Draw metaballs as masks that reveal the breathing background
        this.ctx.save();
        
        // Set up composite operation for masking
        this.ctx.globalCompositeOperation = 'source-atop';
        
        const baseColor = window.currentBackgroundColor || '#4ecf9d';
        const complementary = this.getComplementaryColor(baseColor);
        
        for (const ball of this.metaballs) {
            const x = this.centerX + ball.x;
            const y = this.centerY + ball.y;
            
            // Draw metaball shape
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, ball.currentRadius);
            gradient.addColorStop(0, this.hexToRgba(complementary, 0.9));
            gradient.addColorStop(0.7, this.hexToRgba(complementary, 0.6));
            gradient.addColorStop(1, this.hexToRgba(complementary, 0.1));
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, ball.currentRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add subtle glow
            this.ctx.shadowColor = complementary;
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.restore();
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, 
                         this.canvas.height / window.devicePixelRatio);
        
        this.updateWaveformData();
        
        this.drawBoundaryContainer(); // Debug boundary (optional)
        this.drawBreathingBackground(); // Static breathing circles background
        this.drawMetaballsMask(); // Metaballs as masks revealing background
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    startVisualization() {
        this.initializeAudio();
        this.animate();
    }
    
    updateComplementaryColors() {
        // Reinitialize breathing background with new colors
        this.initializeBreathingBackground();
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isPlaying = false;
    }
    
    // Future methods for interactive features
    setEmotionalState(state) {
        this.emotionalState = state;
        console.log(`Goo creature emotional state: ${state}`);
    }
    
    triggerEmote(emoteType) {
        this.currentEmote = {
            type: emoteType,
            startTime: Date.now(),
            duration: 2000
        };
        console.log(`Goo creature emote: ${emoteType}`);
    }
    
    showThoughtBubble(message, priority = 'normal') {
        this.thoughtBubble = {
            message: message,
            priority: priority,
            startTime: Date.now(),
            duration: priority === 'important' ? 8000 : 3000
        };
        console.log(`Goo creature thinking: ${message}`);
    }
    
    hideThoughtBubble() {
        this.thoughtBubble = null;
    }
}