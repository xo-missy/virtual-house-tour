import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  FaSun, 
  FaCloudMoon, 
  FaMoon, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaPlay, 
  FaPause, 
  FaTv, 
  FaFire, 
  FaCompass, 
  FaInfoCircle, 
  FaTimes, 
  FaLightbulb 
} from 'react-icons/fa';
import ThreeHouseTour from './components/ThreeHouseTour.jsx';
import './App.css';

// Predefined rooms coordinates for teleportation
const TELEPORT_ROOMS = [
  {
    id: "living",
    label: "Living Room",
    emoji: "🛋️",
    pos: { x: -2.5, y: 1.7, z: 5 },
    lookAt: { x: -3, y: 1.7, z: 3 },
    accent: "#c8a97e",
    desc: "4.5 × 6m · Oak floors · Cozy fireplace · 65\" OLED TV",
    details: "Spacious area featuring solid oak flooring, baseboard lighting, and custom built-in bookshelf. Connected to the kitchen walkway."
  },
  {
    id: "kitchen",
    label: "Kitchen",
    emoji: "🍳",
    pos: { x: 4.5, y: 1.7, z: 0 },
    lookAt: { x: 4.5, y: 1.7, z: 2 },
    accent: "#4a8a6a",
    desc: "3 × 4m · Quartz tops · Samsung French Door Fridge",
    details: "Modern, high-gloss white cabinets with quartz worktops. Outfitted with Bosch induction hob, faucet basin, and French-door smart fridge."
  },
  {
    id: "bedroom",
    label: "Bedroom",
    emoji: "🛏️",
    pos: { x: -3.5, y: 1.7, z: -18 },
    lookAt: { x: -3.5, y: 1.7, z: -21 },
    accent: "#9a7a5a",
    desc: "4.5 × 5m · King bed · Writing desk · Starry skylight",
    details: "Private retreat with memory foam king mattress, dual nightstands with ambient lamps, floating study desk, and dual-sliding wood doors."
  },
  {
    id: "bathroom",
    label: "Bathroom",
    emoji: "🛀",
    pos: { x: 4.5, y: 1.7, z: -18 },
    lookAt: { x: 4.5, y: 1.7, z: -22 },
    accent: "#5a8aaa",
    desc: "2.5 × 3m · Rain shower · Heated floors · Cast iron tub",
    details: "Luxury washroom equipped with freestanding bath, walk-in frameless glass shower enclosure, single vanity, and modern wall-hung mirror."
  }
];

export default function App() {
  const [startOverlay, setStartOverlay] = useState(true);
  const [lightingMode, setLightingMode] = useState('day'); // 'day' | 'sunset' | 'night'
  const [lightSwitches, setLightSwitches] = useState({
    living: true,
    kitchen: true,
    bedroom: true,
    bathroom: true
  });
  const [tvOn, setTvOn] = useState(false);
  const [fireplaceOn, setFireplaceOn] = useState(true);
  
  const [activeRoom, setActiveRoom] = useState("Living Room");
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  
  // Teleport state passed to ThreeHouseTour
  const [teleportTarget, setTeleportTarget] = useState(null);
  const [flashAnimation, setFlashAnimation] = useState(false);

  // Guided Tour state
  const [isPlayingTour, setIsPlayingTour] = useState(false);
  const [tourTargetIndex, setTourTargetIndex] = useState(0);
  const [tourCaption, setTourCaption] = useState("");

  // Audio settings
  const [audioMuted, setAudioMuted] = useState(true);
  const audioCtxRef = useRef(null);
  const musicOscRef = useRef(null);
  const musicGainRef = useRef(null);
  const synthTimerRef = useRef(null);

  // Minimap Canvas reference
  const minimapCanvasRef = useRef(null);

  // --- Web Audio API Synthesizer ---
  const initAudio = () => {
    if (audioCtxRef.current) return;
    
    // Create AudioContext (fallback for safari)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Create Main Music Volume Gain
    const musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(0.00, ctx.currentTime); // start silent
    musicGain.connect(ctx.destination);
    musicGainRef.current = musicGain;

    // Start background chord progression loop
    playAmbientMusicLoop();
  };

  const playAmbientMusicLoop = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Ambient chords (synth pads): Cmaj7, Am7, Fmaj7, G6
    const chords = [
      [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
      [110.00, 146.83, 164.81, 220.00], // Am7 (A2, D3, E3, A3)
      [174.61, 220.00, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
      [196.00, 246.94, 293.66, 392.00]  // G6 (G3, B3, D4, G4)
    ];
    let chordIndex = 0;

    const playChordStep = () => {
      const now = ctx.currentTime;
      const notes = chords[chordIndex];
      chordIndex = (chordIndex + 1) % chords.length;

      // Play 4 notes simultaneously with slow attack and release
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        // Modulate filter frequency slightly for warmth
        filter.frequency.exponentialRampToValueAtTime(1200, now + 3);
        filter.frequency.exponentialRampToValueAtTime(500, now + 7.8);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.04, now + 2.0); // Slow attack
        gainNode.gain.setValueAtTime(0.04, now + 6.0);
        gainNode.gain.linearRampToValueAtTime(0, now + 7.9); // Slow release

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(musicGainRef.current);

        osc.start(now);
        osc.stop(now + 8.0);
      });

      // Repeat chord every 8 seconds
      synthTimerRef.current = setTimeout(playChordStep, 8000);
    };

    playChordStep();
  };

  const playClickSound = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioMuted) return;
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.09);
  };

  const playTeleportSound = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioMuted) return;
    
    const now = ctx.currentTime;
    
    // Whoosh frequency sweep
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  };

  const playStepSound = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioMuted) return;
    
    const now = ctx.currentTime;
    
    // Generate soft white noise burst for footsteps
    const bufferSize = ctx.sampleRate * 0.12; // 0.12s duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now); // Low thud
    filter.Q.setValueAtTime(1, now);
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    
    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noiseNode.start(now);
  };

  // Toggle Background Music Mute
  useEffect(() => {
    if (!musicGainRef.current) return;
    const targetVolume = audioMuted ? 0.00 : 0.40;
    const ctx = audioCtxRef.current;
    if (ctx) {
      musicGainRef.current.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 0.5);
    }
  }, [audioMuted]);

  // Clean up sound loops on unmount
  useEffect(() => {
    return () => {
      if (synthTimerRef.current) clearTimeout(synthTimerRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // --- Handlers ---
  const handleStartTour = () => {
    initAudio();
    setAudioMuted(false);
    setStartOverlay(false);
    playClickSound();
  };

  const handleMuteToggle = () => {
    initAudio(); // make sure audio context exists
    setAudioMuted(prev => !prev);
    playClickSound();
  };

  const handleTeleport = (room) => {
    playClickSound();
    setFlashAnimation(true);
    playTeleportSound();
    
    setTimeout(() => {
      setTeleportTarget({
        pos: new THREE.Vector3(room.pos.x, room.pos.y, room.pos.z),
        lookAt: new THREE.Vector3(room.lookAt.x, room.lookAt.y, room.lookAt.z)
      });
      setFlashAnimation(false);
    }, 110);
  };

  const toggleLightSwitch = (roomKey) => {
    playClickSound();
    setLightSwitches(prev => ({
      ...prev,
      [roomKey]: !prev[roomKey]
    }));
  };

  const handleHotspotClose = () => {
    playClickSound();
    setSelectedHotspot(null);
  };

  // --- Guided Tour Loop ---
  const startGuidedTour = () => {
    initAudio();
    setAudioMuted(false);
    setSelectedHotspot(null);
    setTourTargetIndex(0);
    setIsPlayingTour(true);
    setStartOverlay(false);
    playClickSound();
  };

  const stopGuidedTour = () => {
    setIsPlayingTour(false);
    playClickSound();
  };

  const tourPoints = [
    { pos: new THREE.Vector3(-2.5, 1.7, 5), lookAt: new THREE.Vector3(-3, 1.7, 3.5), room: "Living Room", desc: "Welcome to the Living Room! Check out the fireplace and entertainment unit." },
    { pos: new THREE.Vector3(-5.5, 1.7, 1.5), lookAt: new THREE.Vector3(-5.8, 1.7, 1.5), room: "Living Room", desc: "This library nook offers custom oak shelving and dedicated LED baseboard lighting." },
    { pos: new THREE.Vector3(4.5, 1.7, 0.5), lookAt: new THREE.Vector3(5.5, 1.3, 2), room: "Kitchen", desc: "Here we have the spacious Gourmet Kitchen equipped with clean quartz countertops." },
    { pos: new THREE.Vector3(-3.5, 1.7, -20), lookAt: new THREE.Vector3(-3.5, 1.2, -21), room: "Bedroom", desc: "Step into the cozy Master Bedroom containing an elegant king size bed set." },
    { pos: new THREE.Vector3(4.5, 1.7, -19.5), lookAt: new THREE.Vector3(4.5, 0.8, -19.5), room: "Bathroom", desc: "Finally, the Bathroom offers a deep freestanding tub and a rain shower." }
  ];

  const handleTourPointReached = () => {
    if (tourTargetIndex < tourPoints.length - 1) {
      setTourTargetIndex(prev => prev + 1);
    } else {
      setIsPlayingTour(false); // Tour completed
    }
  };

  useEffect(() => {
    if (isPlayingTour) {
      const currentPoint = tourPoints[tourTargetIndex];
      if (currentPoint) {
        setTourCaption(currentPoint.desc);
        setActiveRoom(currentPoint.room);
      }
    }
  }, [tourTargetIndex, isPlayingTour]);

  return (
    <div className="app-container">
      {/* 3D Viewport */}
      <ThreeHouseTour
        lightingMode={lightingMode}
        lightSwitches={lightSwitches}
        tvOn={tvOn}
        fireplaceOn={fireplaceOn}
        activeRoom={activeRoom}
        setActiveRoom={setActiveRoom}
        selectedHotspot={selectedHotspot}
        setSelectedHotspot={setSelectedHotspot}
        teleportTarget={teleportTarget}
        clearTeleportTarget={() => setTeleportTarget(null)}
        isPlayingTour={isPlayingTour}
        tourTargetIndex={tourTargetIndex}
        onTourPointReached={handleTourPointReached}
        minimapCanvasRef={minimapCanvasRef}
        onStep={playStepSound}
      />

      {/* Start Screen Overlay */}
      {startOverlay && (
        <div className="glass-overlay">
          <div className="start-modal card-glow">
            <h1 className="main-title">🏡 Luxury 3D House Tour</h1>
            <p className="subtitle">An interactive architectural walkthrough built in React & Three.js</p>
            
            <div className="controls-guide">
              <h3>Controls Guide</h3>
              <div className="grid-guide">
                <div><span>W A S D</span> / <span>Arrows</span> to Move</div>
                <div><span>Mouse Look</span> drag/rotate camera</div>
                <div><span>Click Hotspots</span> inspect furniture details</div>
                <div><span>ESC Key</span> release mouse lock</div>
              </div>
            </div>

            <div className="overlay-buttons">
              <button className="btn btn-primary" onClick={handleStartTour}>
                Explore Freely <FaCompass style={{marginLeft: '8px'}} />
              </button>
              <button className="btn btn-secondary" onClick={startGuidedTour}>
                Guided Tour <FaPlay style={{marginLeft: '8px'}} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Tour Banner Overlay */}
      {isPlayingTour && (
        <div className="tour-banner card-glow">
          <div className="tour-header">
            <div className="pulse-indicator"></div>
            <span>Cinematic Guided Tour (Room {tourTargetIndex + 1}/{tourPoints.length})</span>
          </div>
          <p className="tour-caption">"{tourCaption}"</p>
          <div className="tour-controls">
            <button className="btn btn-sm btn-danger" onClick={stopGuidedTour}>
              <FaPause style={{marginRight: '6px'}} /> Stop Tour
            </button>
          </div>
        </div>
      )}

      {/* Teleport Flash Visual Effect */}
      <div className={`teleport-flash ${flashAnimation ? 'flash' : ''}`} />

      {/* Top HUD Dashboard */}
      {!startOverlay && (
        <header className="hud-header glassmorphic">
          <div className="hud-brand">
            <span className="room-badge">{activeRoom}</span>
          </div>

          <div className="hud-actions">
            {/* Day / Sunset / Night Toggle */}
            <div className="mood-controller">
              <button 
                className={`mood-btn ${lightingMode === 'day' ? 'active' : ''}`}
                onClick={() => { setLightingMode('day'); playClickSound(); }}
                title="Daytime"
              >
                <FaSun />
              </button>
              <button 
                className={`mood-btn ${lightingMode === 'sunset' ? 'active' : ''}`}
                onClick={() => { setLightingMode('sunset'); playClickSound(); }}
                title="Sunset Mood"
              >
                <FaCloudMoon />
              </button>
              <button 
                className={`mood-btn ${lightingMode === 'night' ? 'active' : ''}`}
                onClick={() => { setLightingMode('night'); playClickSound(); }}
                title="Cozy Night"
              >
                <FaMoon />
              </button>
            </div>

            {/* Audio Toggle */}
            <button className="hud-icon-btn" onClick={handleMuteToggle} title="Toggle Audio">
              {audioMuted ? <FaVolumeMute className="text-red" /> : <FaVolumeUp />}
            </button>
          </div>
        </header>
      )}

      {/* Side HUD Panels */}
      {!startOverlay && (
        <>
          {/* Left Room Navigator */}
          <aside className="hud-left glassmorphic scrollbar-hidden">
            <h2 className="panel-title">Room Navigator</h2>
            <p className="panel-subtitle">Select a room to teleport</p>
            
            <div className="room-list">
              {TELEPORT_ROOMS.map((room) => (
                <div 
                  key={room.id}
                  className={`room-item-card ${activeRoom === room.label ? 'active' : ''}`}
                  onClick={() => handleTeleport(room)}
                >
                  <div className="room-item-header">
                    <span className="room-emoji">{room.emoji}</span>
                    <span className="room-label">{room.label}</span>
                  </div>
                  <p className="room-item-desc">{room.desc}</p>
                  <span className="room-teleport-badge">⚡ Go Here</span>
                </div>
              ))}
            </div>

            <div className="tour-trigger-section">
              <button className="btn btn-primary w-full" onClick={startGuidedTour}>
                <FaPlay style={{marginRight: '8px'}} /> Start Guided Tour
              </button>
            </div>
          </aside>

          {/* Right Bottom HUD: Minimap & Interactive Switches */}
          <div className="hud-right-bottom">
            {/* Interactive Object Switches */}
            <div className="control-panel glassmorphic mb-4">
              <h3 className="control-title">Smart House controls</h3>
              
              <div className="switch-row">
                <span>📺 Living Room TV</span>
                <button 
                  className={`switch-btn ${tvOn ? 'active' : ''}`}
                  onClick={() => { setTvOn(!tvOn); playClickSound(); }}
                >
                  <FaTv className="mr-1" /> {tvOn ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="switch-row">
                <span>🔥 Fireplace Flame</span>
                <button 
                  className={`switch-btn ${fireplaceOn ? 'active' : ''}`}
                  onClick={() => { setFireplaceOn(!fireplaceOn); playClickSound(); }}
                >
                  <FaFire className="mr-1" /> {fireplaceOn ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Room Lighting switches */}
              <div className="divider-line" />
              <div className="light-switches-grid">
                <button 
                  className={`light-switch-btn ${lightSwitches.living ? 'on' : ''}`} 
                  onClick={() => toggleLightSwitch('living')}
                >
                  <FaLightbulb /> Living
                </button>
                <button 
                  className={`light-switch-btn ${lightSwitches.kitchen ? 'on' : ''}`} 
                  onClick={() => toggleLightSwitch('kitchen')}
                >
                  <FaLightbulb /> Kitchen
                </button>
                <button 
                  className={`light-switch-btn ${lightSwitches.bedroom ? 'on' : ''}`} 
                  onClick={() => toggleLightSwitch('bedroom')}
                >
                  <FaLightbulb /> Bed
                </button>
                <button 
                  className={`light-switch-btn ${lightSwitches.bathroom ? 'on' : ''}`} 
                  onClick={() => toggleLightSwitch('bathroom')}
                >
                  <FaLightbulb /> Bath
                </button>
              </div>
            </div>

            {/* Interactive Minimap */}
            <div className="minimap-container glassmorphic card-glow">
              <canvas ref={minimapCanvasRef} width={160} height={180} />
              <div className="minimap-label">HOUSE MAP</div>
            </div>
          </div>

          {/* Controls hint legend (bottom left) */}
          <div className="hud-bottom-left glassmorphic">
            <p><span>W, A, S, D</span> / <span>Arrows</span> to Move</p>
            <p><span>Mouse Click</span> to lock cursor & explore</p>
            <p><span>Click Hotspot Dots</span> to inspect items</p>
            <p><span>ESC Key</span> to unlock mouse</p>
          </div>
        </>
      )}

      {/* Selected Hotspot Detail Panel (Modal) */}
      {selectedHotspot && (
        <div className="glass-overlay">
          <div className="detail-modal card-glow">
            <button className="detail-close" onClick={handleHotspotClose}>
              <FaTimes />
            </button>
            <div className="detail-header">
              <span className="detail-bullet" style={{background: `#${selectedHotspot.color.toString(16).padStart(6, '0')}`}}></span>
              <h2 className="detail-title">{selectedHotspot.title}</h2>
            </div>
            <p className="detail-desc">{selectedHotspot.desc}</p>
            <div className="detail-footer">
              <button className="btn btn-secondary w-full" onClick={handleHotspotClose}>
                Resume Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
