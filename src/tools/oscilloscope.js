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
        this.numMetaballs = 4;  // Scale up to small cluster
        this.baseRadius = 25;   // Scale down individual ball size
        
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
                    start: Math.floor(i * 64),  // Wider frequency bands for 4 metaballs
                    end: Math.floor((i + 1) * 64)
                },
                breathingPhase: Math.random() * Math.PI * 2,
                breathingSpeed: 0.008 + Math.random() * 0.015,
                // Fluid deformation properties
                deformationX: 1.0, // Scale factor for X deformation
                deformationY: 1.0, // Scale factor for Y deformation
                compressionForce: 0, // How much the ball is compressed
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
            
            // Update metaball radius based on audio — dramatic expansion for visible reactivity
            const normalizedAmplitude = amplitude / 255;
            ball.currentRadius = ball.baseRadius + normalizedAmplitude * 55;

            // Organic movement with strong audio influence so the creature visibly dances
            ball.breathingPhase += ball.breathingSpeed;
            const audioInfluence = normalizedAmplitude * 1.8;
            ball.x += ball.vx + Math.sin(ball.breathingPhase) * (0.4 + audioInfluence);
            ball.y += ball.vy + Math.cos(ball.breathingPhase * 1.1) * (0.3 + audioInfluence * 0.8);

            // Store amplitude for rendering (glow intensity, outline thickness)
            ball.audioAmplitude = normalizedAmplitude;
            
            // Apply container physics
            this.applyContainerPhysics(ball);
        }
    }
    
    applyContainerPhysics(ball) {
        const bounds = this.containerBounds;
        
        // Convert to absolute coordinates
        const absX = this.centerX + ball.x;
        const absY = this.centerY + ball.y;
        
        // Reset deformation each frame
        ball.deformationX = 1.0;
        ball.deformationY = 1.0;
        ball.compressionForce = 0;
        
        const effectiveRadius = ball.currentRadius * 0.8;
        let hitWall = false;
        
        // Check boundaries and apply fluid deformation
        // Left wall
        if (absX - effectiveRadius < bounds.x) {
            const penetration = Math.max(0, (bounds.x - (absX - effectiveRadius)) / effectiveRadius);
            ball.x = bounds.x + effectiveRadius - this.centerX;
            ball.vx = Math.abs(ball.vx) * 0.5; // Gentle bounce
            ball.deformationX = Math.max(0.3, 1.0 - penetration * 0.6); // Squish horizontally
            ball.compressionForce = penetration;
            hitWall = true;
        }
        // Right wall  
        else if (absX + effectiveRadius > bounds.x + bounds.width) {
            const penetration = Math.max(0, ((absX + effectiveRadius) - (bounds.x + bounds.width)) / effectiveRadius);
            ball.x = bounds.x + bounds.width - effectiveRadius - this.centerX;
            ball.vx = -Math.abs(ball.vx) * 0.5;
            ball.deformationX = Math.max(0.3, 1.0 - penetration * 0.6);
            ball.compressionForce = penetration;
            hitWall = true;
        }
        
        // Top wall
        if (absY - effectiveRadius < bounds.y) {
            const penetration = Math.max(0, (bounds.y - (absY - effectiveRadius)) / effectiveRadius);
            ball.y = bounds.y + effectiveRadius - this.centerY;
            ball.vy = Math.abs(ball.vy) * 0.5;
            ball.deformationY = Math.max(0.3, 1.0 - penetration * 0.6); // Squish vertically
            ball.compressionForce = Math.max(ball.compressionForce, penetration);
            hitWall = true;
        }
        // Bottom wall
        else if (absY + effectiveRadius > bounds.y + bounds.height) {
            const penetration = Math.max(0, ((absY + effectiveRadius) - (bounds.y + bounds.height)) / effectiveRadius);
            ball.y = bounds.y + bounds.height - effectiveRadius - this.centerY;
            ball.vy = -Math.abs(ball.vy) * 0.5;
            ball.deformationY = Math.max(0.3, 1.0 - penetration * 0.6);
            ball.compressionForce = Math.max(ball.compressionForce, penetration);
            hitWall = true;
        }
        
        // When compressed, the ball spreads out in the non-compressed direction (fluid behavior)
        if (hitWall && ball.compressionForce > 0) {
            const expansion = 1.0 + ball.compressionForce * 0.4;
            if (ball.deformationX < 1.0) {
                ball.deformationY *= expansion; // Spread vertically when compressed horizontally
            }
            if (ball.deformationY < 1.0) {
                ball.deformationX *= expansion; // Spread horizontally when compressed vertically
            }
        }
    }
    
    generateDemoAnimation() {
        const time = Date.now() * 0.001;
        
        // Update metaballs with synthetic animation
        for (let i = 0; i < this.metaballs.length; i++) {
            const ball = this.metaballs[i];
            
            // Synthetic audio-like patterns — noticeable pulsing even in demo
            const wave = Math.sin(time * 1.5 + i * 0.7) * 0.5 + 0.5;
            ball.currentRadius = ball.baseRadius + wave * 30;
            ball.audioAmplitude = wave * 0.6; // Feed into glow so demo mode also glows

            // Organic movement — visible drift so the creature feels alive
            ball.breathingPhase += ball.breathingSpeed;
            ball.x += Math.sin(ball.breathingPhase + i) * 0.25;
            ball.y += Math.cos(ball.breathingPhase * 0.9 + i) * 0.2;
            
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
    
    /**
     * Renders metaballs using an offscreen canvas with alpha thresholding.
     *
     * How it works:
     * 1. Draw each metaball as a radial gradient on an offscreen canvas
     *    (center is opaque, edges fade out). Where blobs overlap, alpha adds up.
     * 2. Read the pixel data and threshold the alpha channel — any pixel above
     *    the threshold becomes fully opaque, everything else is transparent.
     *    This creates a single merged silhouette where overlapping blobs fuse together.
     * 3. Use this silhouette as a clipping mask on the main canvas, then draw
     *    the breathing background *only* inside the mask. The result: the goo
     *    creature's body reveals colorful inner light.
     * 4. Draw a subtle outline around the merged shape for definition.
     */
    drawMergedMetaballs() {
        if (this.metaballs.length === 0) return;

        const canvasW = this.canvas.width / window.devicePixelRatio;
        const canvasH = this.canvas.height / window.devicePixelRatio;

        // Create (or reuse) an offscreen canvas for the metaball field
        if (!this._offscreen || this._offscreen.width !== canvasW || this._offscreen.height !== canvasH) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = canvasW;
            this._offscreen.height = canvasH;
        }
        const offCtx = this._offscreen.getContext('2d');
        offCtx.clearRect(0, 0, canvasW, canvasH);

        // --- Pass 1: Draw metaball gradients onto offscreen canvas ---
        // Each ball is a radial gradient: opaque center, transparent edge.
        // Overlapping balls accumulate alpha, which is key to the merging effect.
        for (const ball of this.metaballs) {
            const x = this.centerX + ball.x;
            const y = this.centerY + ball.y;

            offCtx.save();
            // Apply wall-squish deformation (keeps the physics system intact)
            offCtx.translate(x, y);
            offCtx.scale(ball.deformationX, ball.deformationY);
            offCtx.translate(-x, -y);

            const gradient = offCtx.createRadialGradient(x, y, 0, x, y, ball.currentRadius);
            // High alpha in center, falls to 0 at edge
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            offCtx.fillStyle = gradient;
            offCtx.beginPath();
            offCtx.arc(x, y, ball.currentRadius, 0, Math.PI * 2);
            offCtx.fill();
            offCtx.restore();
        }

        // --- Pass 2: Alpha threshold to create a crisp merged silhouette ---
        const imageData = offCtx.getImageData(0, 0, canvasW, canvasH);
        const pixels = imageData.data;
        // Threshold: pixels with alpha above this value become solid, the rest become transparent.
        // Lower = more blobby/expansive, higher = tighter shapes. 0.38 feels organic.
        const alphaThreshold = 0.38 * 255;

        for (let i = 3; i < pixels.length; i += 4) {
            pixels[i] = pixels[i] >= alphaThreshold ? 255 : 0;
        }
        offCtx.putImageData(imageData, 0, 0);

        // --- Pass 3: Use the silhouette as a clip mask, draw breathing bg inside ---
        this.ctx.save();
        // Draw the offscreen mask as a clip path using 'destination-in' composite trick:
        // First draw breathing background, then mask it with the silhouette.

        // We use a second temporary canvas to composite the breathing bg + mask
        if (!this._compositeCanvas || this._compositeCanvas.width !== canvasW || this._compositeCanvas.height !== canvasH) {
            this._compositeCanvas = document.createElement('canvas');
            this._compositeCanvas.width = canvasW;
            this._compositeCanvas.height = canvasH;
        }
        const compCtx = this._compositeCanvas.getContext('2d');
        compCtx.clearRect(0, 0, canvasW, canvasH);

        // Draw the breathing background onto the composite canvas
        compCtx.save();
        this.breathingCircles.forEach(circle => {
            // Advance breathing animation
            circle.breathingPhase += circle.breathingSpeed;
            const breathingScale = circle.breathingScale + 0.25 * Math.sin(circle.breathingPhase);
            const currentRadius = circle.baseRadius * breathingScale;

            const circleX = this.centerX + circle.x;
            const circleY = this.centerY + circle.y;

            const gradient = compCtx.createRadialGradient(
                circleX, circleY, 0,
                circleX, circleY, currentRadius
            );
            const color1 = this.hexToRgba(circle.colors[0], circle.opacity);
            const color2 = this.hexToRgba(circle.colors[1], circle.opacity * 0.5);
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);

            compCtx.fillStyle = gradient;
            compCtx.beginPath();
            compCtx.arc(circleX, circleY, currentRadius, 0, Math.PI * 2);
            compCtx.fill();
        });
        compCtx.restore();

        // Mask: keep only the breathing bg pixels where the metaball silhouette exists
        compCtx.globalCompositeOperation = 'destination-in';
        compCtx.drawImage(this._offscreen, 0, 0);
        compCtx.globalCompositeOperation = 'source-over';

        // Draw the masked result onto the main canvas
        this.ctx.drawImage(this._compositeCanvas, 0, 0);

        // --- Pass 4: Outline / glow around the merged shape ---
        const baseColor = window.currentBackgroundColor || '#4ecf9d';
        const complementary = this.getComplementaryColor(baseColor);

        // Average audio amplitude across all metaballs for outline intensity
        let avgAmplitude = 0;
        for (const ball of this.metaballs) {
            avgAmplitude += (ball.audioAmplitude || 0);
        }
        avgAmplitude /= this.metaballs.length;

        // Draw a subtle glow by stroking the outline of the thresholded shape.
        // We re-read the mask from the offscreen canvas and draw it as a soft outline.
        this.ctx.save();
        this.ctx.globalAlpha = 0.4 + avgAmplitude * 0.4;
        this.ctx.shadowColor = complementary;
        this.ctx.shadowBlur = 8 + avgAmplitude * 12;
        // Draw the silhouette as a colored overlay for the glow effect
        // We tint the offscreen mask by drawing a colored rect masked by it
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.fillStyle = complementary;
        offCtx.fillRect(0, 0, canvasW, canvasH);
        offCtx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(this._offscreen, 0, 0);
        this.ctx.restore();

        this.ctx.restore();
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio,
                         this.canvas.height / window.devicePixelRatio);

        this.updateWaveformData();

        // Optional debug boundary
        this.drawBoundaryContainer();

        // Render the goo creature: merged metaballs revealing breathing background
        this.drawMergedMetaballs();

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