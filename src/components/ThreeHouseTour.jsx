import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export default function ThreeHouseTour({
  lightingMode,       // 'day' | 'sunset' | 'night'
  lightSwitches,      // { living: true/false, kitchen: true/false, bedroom: true/false, bathroom: true/false }
  tvOn,               // boolean
  fireplaceOn,        // boolean
  activeRoom,
  setActiveRoom,
  selectedHotspot,
  setSelectedHotspot,
  teleportTarget,
  clearTeleportTarget,
  isPlayingTour,
  tourTargetIndex,
  onTourPointReached,
  minimapCanvasRef,
  onStep
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const ambientLightRef = useRef(null);
  const sunLightRef = useRef(null);
  
  // Spotlight references
  const spotlightsRef = useRef({});
  
  // Interactive mesh references for animations
  const tvDisplayRef = useRef(null);
  const tvCanvasRef = useRef(null);
  const tvCanvasCtxRef = useRef(null);
  const fireplaceGlowRef = useRef(null);
  const fireplaceFlameRef = useRef(null);
  const bedDoorRef = useRef(null);
  const bathDoorRef = useRef(null);
  const hotspotMeshesRef = useRef([]);

  // Store key states
  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  // Tour variables
  const tourRef = useRef({
    points: [
      { pos: new THREE.Vector3(-2.5, 1.7, 5), lookAt: new THREE.Vector3(-3, 1.7, 3.5), room: "Living Room", label: "Enjoy the premium, comfortable sofa set." },
      { pos: new THREE.Vector3(-5.5, 1.7, 1.5), lookAt: new THREE.Vector3(-5.8, 1.7, 1.5), room: "Living Room", label: "Check out the custom oak library floating shelves." },
      { pos: new THREE.Vector3(4.5, 1.7, 0.5), lookAt: new THREE.Vector3(5.5, 1.3, 2), room: "Kitchen", label: "View the luxury quartz countertop and modern stove." },
      { pos: new THREE.Vector3(-3.5, 1.7, -20), lookAt: new THREE.Vector3(-3.5, 1.2, -21), room: "Bedroom", label: "Relax in the king-size bedroom with memory foam mattress." },
      { pos: new THREE.Vector3(4.5, 1.7, -19.5), lookAt: new THREE.Vector3(4.5, 0.8, -19.5), room: "Bathroom", label: "Unwind in the freestanding bathtub with heated floors." },
    ],
    t: 0
  });

  // Sound triggering callbacks
  const onStepCallback = useRef(null);

  // Define Hotspots
  const hotspots = [
    {
      name: "hs_sofa",
      pos: new THREE.Vector3(-3, 1.5, 3.5),
      title: "🛋️ Premium Sofa",
      desc: "Italian linen fabric sectional with solid walnut legs. Features removable covers and integrated USB charging. Dimensions: 320×90×85cm.",
      color: 0x7a7a9d
    },
    {
      name: "hs_tv",
      pos: new THREE.Vector3(-3, 2, 7.5),
      title: "📺 Entertainment Wall",
      desc: "65\" 4K OLED TV pre-mounted with custom active wallpaper animation. Built-in media console with oak veneer finish.",
      color: 0x1a1a2e
    },
    {
      name: "hs_kitchen",
      pos: new THREE.Vector3(4.5, 1.5, 1.5),
      title: "🍳 Gourmet Kitchen",
      desc: "Full induction hob, integrated dishwasher, quartz worktops, and soft-close cabinetry. Bosch appliance package included.",
      color: 0x4a8a6a
    },
    {
      name: "hs_fridge",
      pos: new THREE.Vector3(6.3, 1.5, -2.8),
      title: "❄️ French Door Fridge",
      desc: "Samsung 600L smart refrigerator with water dispenser, ice maker, and Wi-Fi connectivity. Energy Rating: A+++.",
      color: 0x2a5a8a
    },
    {
      name: "hs_bed",
      pos: new THREE.Vector3(-3.5, 1.2, -21),
      title: "🛏️ Master Bedroom",
      desc: "King-size solid oak bed frame with memory foam mattress. Room dimensions: 4.5×5m with blackout blinds and AC.",
      color: 0x9a7a5a
    },
    {
      name: "hs_wardrobe",
      pos: new THREE.Vector3(-5.2, 1.8, -24.5),
      title: "🗄️ Built-in Wardrobe",
      desc: "2-door sliding wardrobe with internal fittings: hanging rails, shelves, and shoe rack. Height 2.4m floor-to-ceiling.",
      color: 0x8b5e3c
    },
    {
      name: "hs_bath",
      pos: new THREE.Vector3(4.5, 1.2, -19.5),
      title: "🛀 Freestanding Bath",
      desc: "Cast iron freestanding bathtub with chrome mixer tap. Heated towel rail included. Porcelain floor tiles with underfloor heating.",
      color: 0x5a8aaa
    },
    {
      name: "hs_shower",
      pos: new THREE.Vector3(4.7, 1.5, -24.5),
      title: "🚿 Rain Shower",
      desc: "Frameless glass enclosure with 300mm rainfall head and handheld attachment. Thermostatic valve, anti-slip base.",
      color: 0x5a8aaa
    },
    {
      name: "hs_bookshelf",
      pos: new THREE.Vector3(-5.8, 1.5, 1.5),
      title: "📚 Library Nook",
      desc: "Custom solid oak floating shelves spanning 1.4m. Adjustable LED strip lighting integrated. Perfect reading corner.",
      color: 0x8b5e3c
    },
    {
      name: "hs_plant",
      pos: new THREE.Vector3(-6.4, 1, 4.8),
      title: "🌿 Indoor Garden",
      desc: "Curated selection of indoor plants included with the property. Low-maintenance tropical varieties with self-watering pots.",
      color: 0x4a8a6a
    }
  ];

  // Helper to determine room based on coordinates
  const getRoomName = (pos) => {
    if (pos.z > -16) {
      if (pos.x > 1.5) return "Kitchen";
      return "Living Room";
    } else {
      if (pos.x > 1.5) return "Bathroom";
      return "Bedroom";
    }
  };

  // Setup footstep timing
  const lastStepTime = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(-2.5, 1.7, 5); // Start in Living Room
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(camera);
    controlsRef.current = controls;

    // Add controls listeners to notify React (if needed)
    controls.addEventListener('lock', () => {
      // Custom pointer locked state
    });
    controls.addEventListener('unlock', () => {
      // Custom pointer unlocked state
    });

    // --- Lighting Setup ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xfffaed, 0.8);
    sunLight.position.set(10, 15, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // --- Spotlights ---
    const makeSpot = (id, x, y, z, targetX, targetY, targetZ, color = 0xfff3d6, intensity = 1.5) => {
      const light = new THREE.SpotLight(color, intensity, 18, Math.PI / 4, 0.4, 1.5);
      light.position.set(x, y, z);
      light.target.position.set(targetX, targetY, targetZ);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -1e-3;
      scene.add(light);
      scene.add(light.target);
      
      spotlightsRef.current[id] = light;

      // Add simple visual lamp fixture on ceiling
      const fixtureGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.15, 8);
      const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(x, 4.9, z);
      scene.add(fixture);
    };

    makeSpot("living", -2, 4.8, 4, -2, 0, 4, 0xfff3d6, 1.5);
    makeSpot("kitchen", 4.5, 4.8, 0, 4.5, 0, 0, 0xfff3d6, 1.5);
    makeSpot("bedroom", -3.5, 4.8, -21, -3.5, 0, -21, 0xfff3d6, 1.3);
    makeSpot("bathroom", 4.5, 4.8, -22, 4.5, 0, -22, 0xfff3d6, 1.3);

    // --- Materials ---
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xc8a97e, roughness: 0.5, metalness: 0.1 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0ea, roughness: 0.8 });
    const wallAccentMat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.8 }); // Navy blue accent wall
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c593c, roughness: 0.6, metalness: 0.05 });
    const blackWoodMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.5 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x5a5a6c, roughness: 0.7 });
    const cushMat = new THREE.MeshStandardMaterial({ color: 0xc8a97e, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.95 });
    const goldMetalMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xe0f2f1, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3 });
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0, metalness: 1 });
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x3a5f0b, roughness: 0.9 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0xcb6d51, roughness: 0.7 });
    const rugMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 1.0 });
    const bedMat = new THREE.MeshStandardMaterial({ color: 0xdcdbe3, roughness: 0.9 });
    const bedAccentMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.9 });
    const kitchenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.2 });
    const fireplaceStone = new THREE.MeshStandardMaterial({ color: 0x6e665f, roughness: 0.9 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 0.9 });

    // --- Mesh Helpers ---
    const box = (w, h, d, mat, x, y, z, name) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name || "";
      scene.add(m);
      return m;
    };

    const cyl = (rt, rb, h, seg, mat, x, y, z, name) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name || "";
      scene.add(m);
      return m;
    };

    // --- Room Labels ---
    const makeRoomLabel = (text, x, y, z) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 128);
      ctx.font = "bold 44px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(45, 45, 55, 0.85)";
      ctx.textAlign = "center";
      ctx.fillText(text, 256, 76);
      
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.9), mat);
      mesh.position.set(x, y, z);
      mesh.name = "label_" + text;
      scene.add(mesh);
    };

    // --- Build Structure ---
    // Floor & Ceiling
    box(14, 0.15, 36, floorMat, 0, -0.075, -8, "floor_main");
    box(14, 0.15, 36, ceilMat, 0, 5.075, -8, "ceiling_main");

    // Outer Walls
    box(0.2, 5.2, 36, wallMat, -7, 2.5, -8, "wall_left");
    box(0.2, 5.2, 36, wallMat, 7, 2.5, -8, "wall_right");
    box(14, 5.2, 0.2, wallMat, 0, 2.5, 10, "wall_front");
    box(14, 5.2, 0.2, wallMat, 0, 2.5, -26, "wall_back");

    // Room Dividers
    box(0.2, 5.2, 10, wallMat, 1.5, 2.5, 0.5, "divider_lk"); // Living/Kitchen divider (front)
    box(0.2, 5.2, 6, wallMat, 1.5, 2.5, -15, "divider_lk2"); // Living/Kitchen divider (middle)
    box(14, 5.2, 0.2, wallMat, 0, 2.5, -16.1, "divider_bed"); // Bedroom wall divider
    box(3, 1.5, 0.2, wallMat, -3.5, 4.25, -16.1, "door_header_bed"); // Bedroom door lintel
    box(0.2, 5.2, 10, wallMat, 1.5, 2.5, -21, "divider_bath"); // Bedroom/Bathroom wall divider
    box(0.2, 1.5, 3, wallMat, 1.5, 4.25, -18.5, "door_header_bath"); // Bathroom door lintel

    // Add Baseboards along bottom of all walls for rich visual aesthetic!
    box(0.12, 0.15, 36, blackWoodMat, -6.88, 0.075, -8, "baseboard_l");
    box(0.12, 0.15, 36, blackWoodMat, 6.88, 0.075, -8, "baseboard_r");

    // Room Labels
    makeRoomLabel("Living Room", -2.5, 4.5, 5);
    makeRoomLabel("Kitchen", 4.5, 4.5, 0);
    makeRoomLabel("Bedroom", -3.5, 4.5, -21);
    makeRoomLabel("Bathroom", 4.5, 4.5, -21);

    // --- Windows ---
    const makeWindow = (x, y, z, rotY) => {
      const frame = box(2.2, 1.8, 0.12, woodMat, x, y, z, "win_frame");
      frame.rotation.y = rotY;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), glassMat);
      glass.position.set(x, y, z + (rotY === 0 ? 0.07 : 0));
      glass.rotation.y = rotY;
      glass.name = "win_glass";
      scene.add(glass);
    };
    makeWindow(-6.85, 2.5, 5, 0);
    makeWindow(-6.85, 2.5, -2, 0);
    makeWindow(6.85, 2.5, 3, 0);
    makeWindow(0, 2.5, -25.9, 0);

    // --- Sliding Doors ---
    // Bedroom Sliding Door (slides from x = -3.5 to x = -1.2)
    const bedDoor = box(2.8, 3.5, 0.08, doorMat, -3.5, 1.75, -16.1, "bed_door");
    bedDoorRef.current = bedDoor;

    // Bathroom Sliding Door (slides from z = -18.5 to z = -21)
    const bathDoor = box(0.08, 3.5, 2.8, doorMat, 1.5, 1.75, -18.5, "bath_door");
    bathDoorRef.current = bathDoor;

    // --- Wall Paintings ---
    // Add dynamic modern canvas art to Living Room wall
    const makePainting = (w, h, x, y, z, rotY, color1, color2, title) => {
      const artCanvas = document.createElement("canvas");
      artCanvas.width = 256;
      artCanvas.height = 256;
      const actx = artCanvas.getContext("2d");
      const grad = actx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      actx.fillStyle = grad;
      actx.fillRect(0, 0, 256, 256);
      actx.fillStyle = "rgba(255,255,255,0.15)";
      actx.font = "italic bold 18px 'Inter', sans-serif";
      actx.fillText(title, 30, 130);
      
      const frame = box(w + 0.1, h + 0.1, 0.08, blackWoodMat, x, y, z);
      frame.rotation.y = rotY;
      
      const canvasTex = new THREE.CanvasTexture(artCanvas);
      const artMat = new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.2 });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.position.set(x + (rotY === 0 ? 0 : 0.045), y, z + (rotY === 0 ? 0.045 : 0));
      art.rotation.y = rotY;
      scene.add(art);
    };

    makePainting(2.2, 1.5, -6.85, 2.5, 1.5, Math.PI / 2, "#ff7b00", "#ff007b", "A B S T R A C T");
    makePainting(1.8, 1.8, -1.8, 2.5, -15.95, 0, "#007bff", "#00ffcc", "G A L A X Y");

    // --- Living Room Furniture ---
    // Premium Sofa
    box(3.2, 0.5, 1.1, sofaMat, -3, 0.35, 3.5, "sofa_base");
    box(3.2, 0.6, 0.2, sofaMat, -3, 0.75, 4, "sofa_back");
    box(3.2, 0.3, 1.1, cushMat, -3, 0.65, 3.5, "sofa_cushions");
    box(0.15, 0.65, 1.1, woodMat, -4.5, 0.35, 3.5, "sofa_leg_l");
    box(0.15, 0.65, 1.1, woodMat, -1.5, 0.35, 3.5, "sofa_leg_r");
    box(0.45, 0.35, 0.12, cushMat, -1.7, 0.85, 3.95, "sofa_pillow1");
    box(0.45, 0.35, 0.12, cushMat, -4.3, 0.85, 3.95, "sofa_pillow2");
    
    // Coffee Table
    box(1.4, 0.08, 0.7, woodMat, -3, 0.75, 2.3, "coffee_table_top");
    box(0.07, 0.73, 0.07, metalMat, -3.55, 0.39, 2.65, "ct_leg1");
    box(0.07, 0.73, 0.07, metalMat, -2.45, 0.39, 2.65, "ct_leg2");
    box(0.07, 0.73, 0.07, metalMat, -3.55, 0.39, 1.95, "ct_leg3");
    box(0.07, 0.73, 0.07, metalMat, -2.45, 0.39, 1.95, "ct_leg4");

    // Entertainment TV Wall unit
    box(2.8, 0.08, 0.5, blackWoodMat, -3, 0.55, 7.5, "tv_unit_top");
    box(2.8, 0.55, 0.5, blackWoodMat, -3, 0.3, 7.5, "tv_unit_body");
    box(2.2, 1.3, 0.08, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 }), -3, 1.85, 7.82, "tv_screen");

    // TV Display Canvas
    const tvCanvas = document.createElement("canvas");
    tvCanvas.width = 512;
    tvCanvas.height = 256;
    tvCanvasRef.current = tvCanvas;
    tvCanvasCtxRef.current = tvCanvas.getContext("2d");
    
    const tvTexture = new THREE.CanvasTexture(tvCanvas);
    const tvDisplayMat = new THREE.MeshStandardMaterial({
      map: tvTexture,
      emissiveMap: tvTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.0,
      roughness: 0.1
    });
    
    const tvDisplay = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.2), tvDisplayMat);
    tvDisplay.position.set(-3, 1.85, 7.87);
    scene.add(tvDisplay);
    tvDisplayRef.current = tvDisplay;

    // Cozy fireplace
    box(1.8, 1.2, 0.5, fireplaceStone, -3, 0.6, -15.8, "fireplace_body");
    // Fire cavity
    const fireCavity = box(1.0, 0.6, 0.4, new THREE.MeshStandardMaterial({ color: 0x111111 }), -3, 0.4, -15.6);
    
    // Fire particles / glow
    const fireLight = new THREE.PointLight(0xff7700, 0, 5);
    fireLight.position.set(-3, 0.5, -15.3);
    scene.add(fireLight);
    fireplaceGlowRef.current = fireLight;

    const fireGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
    const fireMesh = new THREE.Mesh(fireGeo, fireMat);
    fireMesh.position.set(-3, 0.35, -15.4);
    scene.add(fireMesh);
    fireplaceFlameRef.current = fireMesh;

    // Bookshelf & books
    box(1.4, 2.2, 0.32, woodMat, -5.8, 1.1, 1.5, "bookshelf");
    const bookColors = [0xc0392b, 0x27ae60, 0x2980b9, 0xf39c12, 0x8e44ad];
    bookColors.forEach((color, i) => {
      box(0.12, 0.5, 0.28, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), -6.35 + i * 0.17, 1.6, 1.5, `book_${i}`);
      box(0.12, 0.42, 0.28, new THREE.MeshStandardMaterial({ color: color ^ 0x333333, roughness: 0.8 }), -6.35 + i * 0.17, 1.0, 1.5, `book2_${i}`);
    });

    // Floor Rug
    box(3.8, 0.02, 2.4, rugMat, -3, 0.02, 3, "living_rug");

    // Armchair
    box(1, 0.4, 0.9, sofaMat, 0.3, 0.35, 2.8, "armchair_base");
    box(1, 0.55, 0.15, sofaMat, 0.3, 0.65, 3.2, "armchair_back");
    box(0.12, 0.6, 0.9, sofaMat, -0.15, 0.55, 2.8, "armchair_arm_l");
    box(0.12, 0.6, 0.9, sofaMat, 0.75, 0.55, 2.8, "armchair_arm_r");
    box(1, 0.3, 0.9, cushMat, 0.3, 0.58, 2.8, "armchair_cushion");

    // Floor Lamp
    cyl(0.03, 0.03, 1.8, 8, metalMat, 0.5, 0.9, 1.5, "lamp_pole");
    cyl(0.22, 0.28, 0.28, 16, cushMat, 0.5, 1.9, 1.5, "lamp_shade");
    cyl(0.15, 0.15, 0.04, 16, metalMat, 0.5, 0.03, 1.5, "lamp_base");
    const lampLight = new THREE.PointLight(0xfffaed, 0.8, 5);
    lampLight.position.set(0.5, 1.85, 1.5);
    scene.add(lampLight);

    // Decorative Plants
    cyl(0.22, 0.25, 0.35, 12, potMat, -6.4, 0.18, 4.8, "plant_pot");
    cyl(0.04, 0.04, 0.45, 6, woodMat, -6.4, 0.55, 4.8, "plant_stem");
    cyl(0.4, 0.1, 0.5, 8, plantMat, -6.4, 0.95, 4.8, "plant_top");
    cyl(0.25, 0.05, 0.35, 6, plantMat, -6, 1.05, 4.6, "plant_leaf1");
    cyl(0.2, 0.04, 0.3, 6, plantMat, -6.8, 0.95, 4.9, "plant_leaf2");

    // --- Kitchen Furniture ---
    // Counter Main (with stove and sink)
    box(4.5, 0.1, 0.7, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }), 4.5, 0.95, 2, "counter_top_main");
    box(4.5, 0.96, 0.65, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), 4.5, 0.49, 2, "counter_body");
    
    // Counter Side L-Shape
    box(0.7, 0.1, 3.5, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }), 6.7, 0.95, -1, "counter_top_side");
    box(0.65, 0.96, 3.5, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), 6.7, 0.49, -1, "counter_side_body");

    // Sink basin
    box(0.7, 0.08, 0.5, metalMat, 5.5, 0.98, 2, "sink_basin");
    box(0.55, 0.12, 0.35, new THREE.MeshStandardMaterial({ color: 0x33598d, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.7 }), 5.5, 0.95, 2, "sink_water");
    cyl(0.025, 0.025, 0.3, 8, metalMat, 5.3, 1.2, 1.75, "faucet");

    // Stove top burners
    box(0.9, 0.08, 0.6, metalMat, 3.2, 0.98, 2, "stove_top");
    [-0.2, 0.2].forEach((ox, i) => [-0.12, 0.12].forEach((oz, j) => {
      cyl(0.1, 0.1, 0.02, 16, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }), 3.2 + ox, 1.04, 2 + oz, `burner_${i}_${j}`);
    }));

    // Upper Cabinets
    box(4.5, 0.9, 0.4, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 }), 4.5, 2.5, 1.85, "upper_cabinets");

    // Fridge
    box(0.9, 2.0, 0.7, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.2 }), 6.55, 1.0, -2.8, "fridge");
    box(0.04, 0.35, 0.04, metalMat, 6.12, 1.5, -2.5, "fridge_handle");

    // Kitchen Dining Table
    box(1.6, 0.08, 0.9, woodMat, 4, 0.78, -0.8, "kitchen_table");
    box(0.06, 0.78, 0.06, woodMat, 3.3, 0.4, -0.45, "kt_leg1");
    box(0.06, 0.78, 0.06, woodMat, 4.7, 0.4, -0.45, "kt_leg2");
    box(0.06, 0.78, 0.06, woodMat, 3.3, 0.4, -1.15, "kt_leg3");
    box(0.06, 0.78, 0.06, woodMat, 4.7, 0.4, -1.15, "kt_leg4");

    // Dining Chairs
    [[3.1, -0.8], [4.9, -0.8], [4, 0.2], [4, -1.8]].forEach(([cx, cz], i) => {
      box(0.5, 0.05, 0.5, woodMat, cx, 0.46, cz, `kchair_seat_${i}`);
      box(0.5, 0.5, 0.06, woodMat, cx, 0.72, cz + (cz < -0.8 ? -0.22 : cz > -0.8 ? 0.22 : 0), `kchair_back_${i}`);
      box(0.04, 0.46, 0.04, woodMat, cx - 0.2, 0.23, cz - 0.2, `kchair_l1_${i}`);
      box(0.04, 0.46, 0.04, woodMat, cx + 0.2, 0.23, cz - 0.2, `kchair_l2_${i}`);
      box(0.04, 0.46, 0.04, woodMat, cx - 0.2, 0.23, cz + 0.2, `kchair_l3_${i}`);
      box(0.04, 0.46, 0.04, woodMat, cx + 0.2, 0.23, cz + 0.2, `kchair_l4_${i}`);
    });

    // --- Bedroom Furniture ---
    // Bed Frame & Mattress
    box(2.2, 0.22, 3.2, woodMat, -3.5, 0.12, -21, "bed_frame");
    box(2.2, 0.35, 3.2, bedMat, -3.5, 0.42, -21, "bed_mattress");
    box(2.2, 0.9, 0.12, woodMat, -3.5, 0.7, -19.4, "bed_headboard");
    box(0.7, 0.18, 0.5, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), -3.0, 0.69, -19.7, "pillow1");
    box(0.7, 0.18, 0.5, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), -4.0, 0.69, -19.7, "pillow2");
    box(2.0, 0.1, 2.0, bedAccentMat, -3.5, 0.62, -21.5, "bed_blanket");

    // Nightstands & Lamps
    [[-4.8, -20.5], [-2.2, -20.5]].forEach(([nx, nz], i) => {
      box(0.6, 0.55, 0.5, woodMat, nx, 0.28, nz, `nightstand_${i}`);
      cyl(0.12, 0.12, 0.02, 16, metalMat, nx, 0.56, nz, `ns_lamp_base_${i}`);
      cyl(0.18, 0.1, 0.25, 12, cushMat, nx, 0.7, nz, `ns_lamp_shade_${i}`);
      
      const nsLight = new THREE.PointLight(0xfff3d6, 0.5, 3);
      nsLight.position.set(nx, 0.7, nz);
      scene.add(nsLight);
    });

    // Wardrobe
    box(2.0, 2.4, 0.55, woodMat, -5.2, 1.2, -24.5, "wardrobe");
    box(0.04, 2.35, 0.04, metalMat, -4.25, 1.2, -24.2, "wardrobe_handle_l");
    box(0.04, 2.35, 0.04, metalMat, -6.15, 1.2, -24.2, "wardrobe_handle_r");

    // Writing Desk & Monitor
    box(1.4, 0.06, 0.65, woodMat, -1.0, 0.76, -22.5, "desk_top");
    [[-1.6, -22.85], [-0.4, -22.85], [-1.6, -22.15], [-0.4, -22.15]].forEach(([lx, lz], i) => {
      box(0.05, 0.76, 0.05, woodMat, lx, 0.38, lz, `desk_leg_${i}`);
    });
    box(0.7, 0.45, 0.04, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 }), -1.0, 1.12, -22.83, "monitor");
    box(0.08, 0.22, 0.08, metalMat, -1.0, 0.88, -22.73, "monitor_stand");

    // Bedroom Rug
    box(3.0, 0.02, 2.4, new THREE.MeshStandardMaterial({ color: 0x5c5c5c, roughness: 1.0 }), -3.5, 0.02, -22.5, "bed_rug");

    // --- Bathroom Furniture ---
    // Bathtub
    box(1.8, 0.5, 0.9, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }), 4.5, 0.3, -19.5, "bathtub_outer");
    box(1.5, 0.35, 0.65, new THREE.MeshStandardMaterial({ color: 0x55aaee, roughness: 0.05, transparent: true, opacity: 0.5 }), 4.5, 0.38, -19.5, "bathtub_water");

    // Toilet
    box(0.5, 0.4, 0.65, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }), 6.0, 0.2, -22.5, "toilet_base");
    box(0.5, 0.1, 0.6, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }), 6.0, 0.45, -22.5, "toilet_seat");
    box(0.45, 0.55, 0.15, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }), 6.0, 0.48, -22.88, "toilet_tank");

    // Vanity & Mirror
    box(0.8, 0.85, 0.5, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }), 3.2, 0.43, -22.5, "bath_vanity");
    box(0.65, 0.06, 0.4, new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 }), 3.2, 0.88, -22.5, "bath_sink");
    cyl(0.025, 0.025, 0.25, 8, metalMat, 3.1, 1.0, -22.3, "bath_faucet");
    box(0.7, 0.9, 0.05, mirrorMat, 3.2, 1.7, -22.83, "bath_mirror");
    
    // Towel rack
    box(0.6, 0.025, 0.025, metalMat, 2.1, 1.2, -22.85, "towel_rail");
    box(0.55, 0.3, 0.04, new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 }), 2.1, 1.05, -22.83, "towel");

    // Shower Glass enclosure
    box(0.05, 2.0, 1.2, glassMat, 5.2, 1.1, -24.5, "shower_glass1");
    box(1.2, 2.0, 0.05, glassMat, 4.7, 1.1, -25.1, "shower_glass2");
    cyl(0.03, 0.03, 0.4, 8, metalMat, 4.9, 2.0, -24.1, "shower_head");

    // --- Interactive Hotspots Setup ---
    const hotspotMeshes = [];
    hotspots.forEach((hs) => {
      const geo = new THREE.SphereGeometry(0.16, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: hs.color,
        emissive: hs.color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.4
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(hs.pos);
      mesh.name = hs.name;
      mesh.userData = { isHotspot: true, title: hs.title, desc: hs.desc, color: hs.color, mat, rawData: hs };
      scene.add(mesh);
      hotspotMeshes.push(mesh);
    });
    hotspotMeshesRef.current = hotspotMeshes;

    // --- Event Listeners ---
    const handleKeyDown = (e) => {
      const k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') keysRef.current.w = true;
      if (k === 'KeyA' || k === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'KeyS' || k === 'ArrowDown') keysRef.current.s = true;
      if (k === 'KeyD' || k === 'ArrowRight') keysRef.current.d = true;
    };

    const handleKeyUp = (e) => {
      const k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') keysRef.current.w = false;
      if (k === 'KeyA' || k === 'ArrowLeft') keysRef.current.a = false;
      if (k === 'KeyS' || k === 'ArrowDown') keysRef.current.s = false;
      if (k === 'KeyD' || k === 'ArrowRight') keysRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Canvas click triggers pointer lock and hotspot inspection
    const raycaster = new THREE.Raycaster();
    const center2D = new THREE.Vector2(0, 0);

    const handleCanvasClick = () => {
      if (controls.isLocked) {
        // Raycast from camera center
        raycaster.setFromCamera(center2D, camera);
        const hits = raycaster.intersectObjects(hotspotMeshes);
        
        if (hits.length > 0) {
          const hitObject = hits[0].object;
          if (hitObject.userData.isHotspot) {
            setSelectedHotspot(hitObject.userData.rawData);
            controls.unlock(); // Release pointer so they can view details
          }
        }
      } else {
        // If not locked and not clicking on HTML elements (which bubble), lock it
        // Only lock if we are not actively viewing a hotspot card
        if (!selectedHotspot) {
          controls.lock();
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // --- Resize Handler ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    let velocity = new THREE.Vector3();
    let direction = new THREE.Vector3();
    let animTime = 0;

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1); // Cap delta to prevent massive jumps
      animTime += delta;

      // 1. GUIDED TOUR MODE ANIMATION OVERRIDE
      if (isPlayingTour) {
        const tour = tourRef.current;
        const currentTarget = tour.points[tourTargetIndex];
        
        if (currentTarget) {
          // Lerp camera position
          camera.position.lerp(currentTarget.pos, delta * 1.5);
          
          // Lerp target lookAt
          // We look at an interpolated point
          const currentLookAt = new THREE.Vector3();
          const targetLookAt = currentTarget.lookAt;
          
          // Use camera direction to interpolate lookAt smoothly
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const currentLookPoint = new THREE.Vector3().addVectors(camera.position, camDir.multiplyScalar(4));
          
          currentLookPoint.lerp(targetLookAt, delta * 2.0);
          camera.lookAt(currentLookPoint);

          // Check if close enough to trigger next room notification and point completion
          const dist = camera.position.distanceTo(currentTarget.pos);
          if (dist < 0.25) {
            onTourPointReached();
          }
        }
      }
      // 2. REGULAR PLAYER MOVEMENT CONTROLS
      else if (controls.isLocked) {
        direction.z = (keysRef.current.w ? 1 : 0) - (keysRef.current.w ? 0 : 0) + (keysRef.current.s ? -1 : 0);
        direction.x = (keysRef.current.d ? 1 : 0) - (keysRef.current.d ? 0 : 0) + (keysRef.current.a ? -1 : 0);
        direction.normalize();

        const speed = 4.5;
        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;

        // Save old position in case of collision
        const oldPos = camera.position.clone();

        controls.moveForward(velocity.z * delta);
        controls.moveRight(velocity.x * delta);

        // Keep player vertical level at standard eye height
        camera.position.y = 1.7;

        // --- COLLISION DETECTION & WALL CLAMPING ---
        // Outer boundaries
        camera.position.x = Math.max(-6.5, Math.min(6.5, camera.position.x));
        camera.position.z = Math.max(-25.4, Math.min(9.4, camera.position.z));

        // Living/Kitchen divider wall at x = 1.5 (front: z in [-4.5, 5.5], back: z in [-18, -12])
        const z = camera.position.z;
        const x = camera.position.x;
        const playerRadius = 0.45;

        // Divider LK 1 (front)
        if (z > -4.5 && z < 5.5) {
          if (Math.abs(x - 1.5) < playerRadius) {
            // Push player back to whichever side they came from
            camera.position.x = oldPos.x;
          }
        }
        // Divider LK 2 (middle)
        if (z > -15 && z < -12) {
          if (Math.abs(x - 1.5) < playerRadius) {
            camera.position.x = oldPos.x;
          }
        }

        // Bedroom Wall divider at z = -16.1
        // Sliding Door is at x = -3.5 (door width 2.8m, opening spans approx x in [-4.9, -2.1])
        if (Math.abs(z - (-16.1)) < playerRadius) {
          // If we are not in the sliding door opening or if the door is shut
          const isNearDoorway = (x > -4.8 && x < -2.2);
          const doorIsOpen = bedDoorRef.current.position.x > -2.0; // Open slides towards x = -1
          
          if (!isNearDoorway || !doorIsOpen) {
            camera.position.z = oldPos.z;
          }
        }

        // Bedroom/Bathroom divider at x = 1.5 (z in [-26, -16])
        // Doorway is at z = -18.5 (spans z in [-19.8, -17.2])
        if (z < -16.1) {
          if (Math.abs(x - 1.5) < playerRadius) {
            const isNearBathDoorway = (z > -19.7 && z < -17.3);
            const bathDoorIsOpen = bathDoorRef.current.position.z < -19.8; // Open slides towards z = -21
            
            if (!isNearBathDoorway || !bathDoorIsOpen) {
              camera.position.x = oldPos.x;
            }
          }
        }

        // Trigger footstep sound callbacks
        if (velocity.lengthSq() > 0.1) {
          const now = Date.now();
          if (now - lastStepTime.current > 420) {
            if (onStepCallback.current) onStepCallback.current();
            lastStepTime.current = now;
          }
        }
      }

      // --- Room Monitoring ---
      const currentRoomName = getRoomName(camera.position);
      if (currentRoomName !== activeRoom) {
        setActiveRoom(currentRoomName);
      }

      // --- Sliding Doors Automation ---
      // Auto open bedroom door if player walks close (within 2.8 units)
      const distToBedDoor = camera.position.distanceTo(new THREE.Vector3(-3.5, 1.7, -16.1));
      if (distToBedDoor < 2.8) {
        // Slide open (Lerp X to -1.0)
        bedDoorRef.current.position.x = THREE.MathUtils.lerp(bedDoorRef.current.position.x, -1.0, delta * 3.5);
      } else {
        // Slide closed (Lerp X to -3.5)
        bedDoorRef.current.position.x = THREE.MathUtils.lerp(bedDoorRef.current.position.x, -3.5, delta * 3.5);
      }

      // Auto open bathroom door if player walks close
      const distToBathDoor = camera.position.distanceTo(new THREE.Vector3(1.5, 1.7, -18.5));
      if (distToBathDoor < 2.5) {
        // Slide open (Lerp Z to -21.2)
        bathDoorRef.current.position.z = THREE.MathUtils.lerp(bathDoorRef.current.position.z, -21.2, delta * 3.5);
      } else {
        // Slide closed (Lerp Z to -18.5)
        bathDoorRef.current.position.z = THREE.MathUtils.lerp(bathDoorRef.current.position.z, -18.5, delta * 3.5);
      }

      // --- Hotspot Animations (pulsing) ---
      hotspotMeshes.forEach((mesh, index) => {
        const pulseScale = 1.0 + 0.16 * Math.sin(animTime * 2.8 + index * 0.5);
        mesh.scale.setScalar(pulseScale);
        mesh.userData.mat.emissiveIntensity = 0.4 + 0.35 * Math.sin(animTime * 2.5 + index);
      });

      // --- TV Display Screen Animation (Synthwave scene drawing on canvas) ---
      if (tvOn && tvCanvasCtxRef.current) {
        const ctx = tvCanvasCtxRef.current;
        const w = 512, h = 256;
        
        ctx.fillStyle = "#0a0314";
        ctx.fillRect(0, 0, w, h);
        
        // Draw grid
        ctx.strokeStyle = "#ff007f";
        ctx.lineWidth = 2;
        const gridY = 140;
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(w, gridY);
        ctx.stroke();

        const lines = 12;
        for (let i = 0; i <= lines; i++) {
          const xOffset = (i / lines) * w;
          ctx.beginPath();
          ctx.moveTo(w / 2, gridY);
          ctx.lineTo(w / 2 + (xOffset - w / 2) * 2.5, h);
          ctx.stroke();
        }
        
        // Draw animated horizon lines
        const horizLines = 6;
        const speedMultiplier = (animTime * 45) % (h - gridY);
        for (let i = 0; i < horizLines; i++) {
          const curY = gridY + ((i * (h - gridY) / horizLines + speedMultiplier) % (h - gridY));
          ctx.strokeStyle = `rgba(255, 0, 127, ${1 - (curY - gridY) / (h - gridY)})`;
          ctx.beginPath();
          ctx.moveTo(0, curY);
          ctx.lineTo(w, curY);
          ctx.stroke();
        }

        // Draw Sunset Sun
        const sunRadius = 45;
        const sunX = w / 2;
        const sunY = gridY - 8;
        const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY);
        sunGrad.addColorStop(0, "#ffff00");
        sunGrad.addColorStop(1, "#ff007f");
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, Math.PI, 0);
        ctx.fill();

        // Sun overlay lines (synthwave style)
        ctx.fillStyle = "#0a0314";
        for (let i = 1; i <= 4; i++) {
          const cutHeight = 3.5;
          const cutY = sunY - i * 8;
          ctx.fillRect(sunX - sunRadius, cutY, sunRadius * 2, cutHeight);
        }

        // Notify Three.js to upload canvas updates
        tvTexture.needsUpdate = true;
      } else if (!tvOn && tvCanvasCtxRef.current) {
        // TV is off, clear screen
        const ctx = tvCanvasCtxRef.current;
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, 512, 256);
        tvTexture.needsUpdate = true;
      }

      // --- Fireplace Animation ---
      if (fireplaceOn) {
        const scaleVal = 1 + 0.12 * Math.sin(animTime * 18);
        fireplaceFlameRef.current.scale.set(scaleVal, scaleVal * 1.5, scaleVal);
        fireplaceGlowRef.current.intensity = 1.2 + 0.3 * Math.sin(animTime * 15);
      } else {
        fireplaceFlameRef.current.scale.setScalar(0.001);
        fireplaceGlowRef.current.intensity = 0;
      }

      // --- Minimap Canvas Drawing ---
      if (minimapCanvasRef && minimapCanvasRef.current) {
        const canvas = minimapCanvasRef.current;
        const mmCtx = canvas.getContext('2d');
        if (mmCtx) {
          mmCtx.clearRect(0, 0, 160, 180);
          mmCtx.fillStyle = "rgba(10, 8, 6, 0.85)";
          mmCtx.fillRect(0, 0, 160, 180);
          
          const toMM = (wx, wz) => {
            return [(wx + 7) / 14 * 160, (10 - wz) / 36 * 174 + 3];
          };
          
          const rooms = [
            { label: "Living", x1: -7, z1: 10, x2: 1.5, z2: -16, color: "rgba(150,130,110,0.15)" },
            { label: "Kitchen", x1: 1.5, z1: 10, x2: 7, z2: -16, color: "rgba(100,150,120,0.15)" },
            { label: "Bedroom", x1: -7, z1: -16, x2: 1.5, z2: -26, color: "rgba(100,110,160,0.15)" },
            { label: "Bathroom", x1: 1.5, z1: -16, x2: 7, z2: -26, color: "rgba(80,140,160,0.15)" }
          ];
          
          rooms.forEach((r) => {
            const [sx, sy] = toMM(r.x1, r.z1);
            const [ex, ey] = toMM(r.x2, r.z2);
            mmCtx.fillStyle = r.color;
            mmCtx.fillRect(sx, sy, ex - sx, ey - sy);
            mmCtx.strokeStyle = "rgba(255,255,255,0.08)";
            mmCtx.lineWidth = 0.5;
            mmCtx.strokeRect(sx, sy, ex - sx, ey - sy);
            
            const [mx, my] = toMM((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2);
            mmCtx.fillStyle = "rgba(255,255,255,0.35)";
            mmCtx.font = "8px 'Inter', sans-serif";
            mmCtx.textAlign = "center";
            mmCtx.fillText(r.label, mx, my);
          });
          
          hotspots.forEach((hs) => {
            const [hx, hy] = toMM(hs.pos.x, hs.pos.z);
            mmCtx.beginPath();
            mmCtx.arc(hx, hy, 3.5, 0, Math.PI * 2);
            const hex = "#" + hs.color.toString(16).padStart(6, "0");
            mmCtx.fillStyle = hex;
            mmCtx.fill();
            
            // Pulse ring
            mmCtx.strokeStyle = hex;
            mmCtx.lineWidth = 0.8;
            mmCtx.beginPath();
            mmCtx.arc(hx, hy, 3.5 + 2 * Math.sin(animTime * 3.5), 0, Math.PI * 2);
            mmCtx.stroke();
          });
          
          // Player dot
          const [px, py] = toMM(camera.position.x, camera.position.z);
          mmCtx.beginPath();
          mmCtx.arc(px, py, 4.5, 0, Math.PI * 2);
          mmCtx.fillStyle = "#ffffff";
          mmCtx.fill();
          
          // Player view direction arrow
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const arrowLen = 10;
          mmCtx.beginPath();
          mmCtx.moveTo(px, py);
          mmCtx.lineTo(px + dir.x * arrowLen, py - dir.z * arrowLen);
          mmCtx.strokeStyle = "#ffffff";
          mmCtx.lineWidth = 1.5;
          mmCtx.stroke();
        }
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    // Clean up function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        rendererRef.current.setAnimationLoop(null);
        if (containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [isPlayingTour]); // Re-init bindings when tour mode toggles

  // --- Dynamic Lighting Updates ---
  useEffect(() => {
    if (!sceneRef.current || !ambientLightRef.current || !sunLightRef.current) return;
    const scene = sceneRef.current;
    const ambient = ambientLightRef.current;
    const sun = sunLightRef.current;

    if (lightingMode === 'day') {
      scene.background = new THREE.Color(0xf0ece6);
      scene.fog = new THREE.Fog(0xf0ece6, 18, 40);
      ambient.color.setHex(0xffffff);
      ambient.intensity = 0.55;
      sun.color.setHex(0xfffaed);
      sun.intensity = 0.85;
      sun.position.set(10, 15, 8);
    } else if (lightingMode === 'sunset') {
      scene.background = new THREE.Color(0xfd5e53);
      scene.fog = new THREE.Fog(0xfd5e53, 14, 32);
      ambient.color.setHex(0xffaa66);
      ambient.intensity = 0.35;
      sun.color.setHex(0xff5500);
      sun.intensity = 0.65;
      sun.position.set(12, 5, 2);
    } else if (lightingMode === 'night') {
      scene.background = new THREE.Color(0x0a0810);
      scene.fog = new THREE.Fog(0x0a0810, 12, 28);
      ambient.color.setHex(0x334466);
      ambient.intensity = 0.12;
      sun.color.setHex(0x88aacc);
      sun.intensity = 0.15;
      sun.position.set(-8, 12, -4);
    }
  }, [lightingMode]);

  // --- Spotlights Toggles ---
  useEffect(() => {
    const spots = spotlightsRef.current;
    if (spots.living) spots.living.intensity = lightSwitches.living ? 1.5 : 0;
    if (spots.kitchen) spots.kitchen.intensity = lightSwitches.kitchen ? 1.5 : 0;
    if (spots.bedroom) spots.bedroom.intensity = lightSwitches.bedroom ? 1.3 : 0;
    if (spots.bathroom) spots.bathroom.intensity = lightSwitches.bathroom ? 1.3 : 0;
  }, [lightSwitches]);

  // --- TV Emissive Intensity ---
  useEffect(() => {
    if (tvDisplayRef.current) {
      tvDisplayRef.current.material.emissiveIntensity = tvOn ? 1.0 : 0.0;
    }
  }, [tvOn]);

  // --- Teleport Action ---
  useEffect(() => {
    if (!teleportTarget || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Teleport camera position
    camera.position.copy(teleportTarget.pos);
    camera.position.y = 1.7; // Ensure standard height is maintained

    // Face the target direction
    const dir = new THREE.Vector3().subVectors(teleportTarget.lookAt, teleportTarget.pos).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    
    // Set yaw on camera directly
    camera.rotation.set(0, yaw, 0);

    clearTeleportTarget();

    // Lock controls after short delay to let browser process focus
    setTimeout(() => {
      if (!selectedHotspot && !isPlayingTour) {
        controls.lock();
      }
    }, 120);

  }, [teleportTarget]);

  // Sync onStep callback
  useEffect(() => {
    onStepCallback.current = onStep;
  }, [onStep]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }} 
    />
  );
}
