# OssC Visualizer Redesign: Interactive Metaballs Goo

## Overview
Transform the OssC (Oscilloscope) visualizer into an interactive metaballs-based "goo creature" that serves as a digital companion. The metaballs approach eliminates current path closure issues while adding personality, emotes, and thought bubbles to create an engaging, organic audio-responsive assistant with fluid, blob-like behavior.

## Architecture Changes

### 1. Modularization
- **Extract OssC from index.html** → Create dedicated `oscilloscope.js` tool
- **Follow existing patterns** → `OscilloscopeTool extends AudioToolBase` 
- **Integration** → Plug into existing tool ecosystem alongside ambient-sounds, timer, etc.

### 2. Interactive Metaballs System

#### Boundary Container
- **Square boundary area** → Defined container that constrains the goo creature's movement
- **Collision physics** → Metaballs bounce/squish against container edges
- **Responsive sizing** → Container scales with canvas size while maintaining aspect ratio

#### Core Metaballs Concept
- **Dynamic blob cluster** → 6-12 metaballs that form a cohesive goo creature
- **Frequency mapping** → Each metaball assigned specific frequency range from audio data
- **Dynamic sizing** → Metaball radius/influence varies based on frequency amplitude
- **Seamless edges** → Organic blob shape with smooth mathematical blending

#### Technical Implementation
```
Boundary Container:
- Square container centered in canvas
- Container size = min(canvas.width, canvas.height) * 0.8
- Physics bounds for metaball collision detection
- Visual border (optional, toggleable)

Metaball Cluster Layout:
- Position metaballs in organic cluster formation (not rigid circle)
- Each metaball gets frequency range: frequencies[i * range_size : (i+1) * range_size]  
- Metaball influence radius = base_radius + (frequency_amplitude * scale_factor)
- Center of mass moves within container bounds
```

#### Interactive Features
1. **Emotional States** → Different metaball arrangements for happy, calm, excited, focused
2. **Thought Bubbles** → Small bubble cluster that appears above main goo with status text
3. **Emote Animations** → Temporary shape changes (bounce, stretch, wiggle) triggered by events
4. **Container Physics** → Goo squishes against boundaries, maintaining volume conservation

#### Rendering Strategy
1. **Calculate metaball field** → Generate influence field for all metaballs within boundary
2. **Apply container constraints** → Ensure goo shape stays within bounds
3. **Find edge contours** → Identify outline where field strength = threshold
4. **Render interactive elements** → Draw thought bubbles, emote effects
5. **Apply breathing effects** → Use metaball shapes as clipping masks for background gradients

### 3. Goo Creature Behaviors

#### Emotional States & Triggers
- **Happy** → Timer completed successfully, todo items checked off
- **Focused** → Timer running, high productivity metrics
- **Calm** → Ambient sounds active, steady breathing pattern
- **Excited** → Music playing, high audio activity
- **Sleepy** → Low audio activity for extended period
- **Bouncy** → User interaction detected (clicks, setting changes)

#### Thought Bubble System
- **Status Messages** → Current activity, motivational quotes, reminders
- **Bubble Positioning** → Always above goo creature, within container bounds
- **Auto-Hide Logic** → Fade out after 3-5 seconds unless important
- **Priority System** → Important messages (timer alerts) override routine status

#### Emote Animation Library
- **Bounce** → Vertical squish and stretch cycle
- **Wiggle** → Side-to-side sway with metaball oscillation  
- **Pulse** → Radial expansion/contraction synchronized with breathing
- **Stretch** → Horizontal elongation when "reaching" for something
- **Squish** → Compress against container walls when "excited"

### 4. Frequency Data Integration

#### Mapping Strategy
- **Low frequencies** (0-64) → Larger metaballs for bass response, affects overall goo mass
- **Mid frequencies** (65-128) → Medium metaballs for vocals/instruments, drives emotional state
- **High frequencies** (129-192) → Smaller metaballs for treble details, creates surface texture
- **Ultra-high** (193-256) → Micro metaballs for sparkle/detail, adds movement energy

#### Audio Source Compatibility
- **Ambient sounds** → Calm, flowing organic shapes
- **Focus sounds** → Steady, rhythmic patterns that promote concentration
- **Microphone** → Real-time environmental response
- **Demo mode** → Playful, attention-getting synthetic animation

## Benefits of Metaballs Approach

### Solves Current Issues
✅ **No path closure problems** → Mathematically continuous surfaces  
✅ **No jutting artifacts** → Smooth mathematical blending  
✅ **Complete circle coverage** → Multiple balls ensure full perimeter  
✅ **Organic visualization** → Natural, flowing audio representation  

### Enhanced Features
🎯 **Accurate frequency representation** → Each ball = specific frequency range  
🎯 **Seamless integration** → Metaballs as masks for existing breathing circles  
🎯 **Scalable complexity** → Easy to adjust number of balls for performance  
🎯 **Modular architecture** → Clean separation from main application logic  

## Implementation Phases

### Phase 1: Foundation & Boundary System
- Extract oscilloscope logic from index.html into dedicated `oscilloscope.js` tool
- Create OscilloscopeTool class structure following existing patterns
- Implement boundary container system with physics constraints
- Basic metaballs field calculation and rendering

### Phase 2: Interactive Goo Creature
- Implement metaballs clustering for organic blob formation
- Add container collision physics and squishing effects
- Create emotional state system with triggers
- Basic emote animation framework

### Phase 3: Thought Bubble System
- Design and implement thought bubble rendering
- Create message priority and display logic
- Integrate with existing status ticker system
- Auto-positioning within container bounds

### Phase 4: Audio Integration & Behaviors
- Map frequency data to metaball properties and emotional states
- Implement real-time behavioral responses to audio
- Connect to existing audio analysis pipeline
- Add demo mode with playful synthetic animations

### Phase 5: Visual Polish & Performance
- Optimize metaball field calculations for 60fps
- Fine-tune emotional state transitions and animations
- Polish thought bubble typography and styling
- Performance testing and memory optimization

## Technical Considerations

### Performance
- **Efficient field calculation** → Pre-compute where possible
- **Canvas optimization** → Use appropriate drawing methods
- **Frame rate target** → Maintain 60fps visualization

### Customization
- **Adjustable metaball count** → 8-16 balls based on performance
- **Frequency range tuning** → Configurable frequency-to-ball mapping
- **Visual parameters** → Customizable influence radius, threshold values

### Compatibility
- **Cross-browser** → Vanilla JS for maximum compatibility
- **Responsive** → Adapt to different canvas sizes
- **Audio source agnostic** → Work with any frequency data source

## Expected Outcome
A seamless, organic oscilloscope visualization that:
- Displays real audio frequency data as smooth, flowing shapes
- Eliminates all current visual artifacts and edge issues
- Integrates naturally with existing breathing circle aesthetics
- Provides modular, maintainable code architecture
- Delivers consistent 60fps performance across audio sources