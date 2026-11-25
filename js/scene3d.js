import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { LOTS } from './data.js';
import {
  animatePersonWalk,
  createBicycleMesh,
  createBirdMesh,
  createBusMesh,
  createCloudMesh,
  createDetailedCar,
  createDetailedMotorbike,
  createDetailedPerson,
  createMetroTrainMesh,
  spinVehicleWheels
} from './actors3d.js';
import { createCampusEnvironment, createLotBuilding, createLotPad } from './buildings3d.js';
import { setMaxAnisotropy } from './textures.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uBottomColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = dir.y;
    vec3 col = h >= 0.0
      ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.52))
      : mix(uHorizonColor, uBottomColor, clamp(-h * 3.0, 0.0, 1.0));

    float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sunAmt, 28.0) * 0.11 + pow(sunAmt, 240.0) * 0.68);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BURST_BOX_GEO = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const SMOKE_PUFF_GEO = new THREE.DodecahedronGeometry(0.22, 0);
const FX_RING_A_GEO = new THREE.RingGeometry(0.78, 1.0, 40);
FX_RING_A_GEO.rotateX(-Math.PI / 2);
const FX_RING_B_GEO = new THREE.RingGeometry(0.88, 1.0, 40);
FX_RING_B_GEO.rotateX(-Math.PI / 2);
const FX_BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
FX_BEAM_GEO.translate(0, 0.5, 0);

function createBeamAlphaTex() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.92)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.36)');
  gr.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 128);
  // Subtle vertical architectural light flutes
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let x = 4; x < 64; x += 12) {
    g.fillRect(x, 0, 3, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

const BEAM_ALPHA_TEX = createBeamAlphaTex();

// Smooth C1 bell curve on [-R, +R] for steering traffic & pedestrians naturally around the central roundabout!
function roundaboutDeflection(coord, R = 6.6) {
  const a = Math.abs(coord);
  if (a >= R) return { offset: 0, slope: 0 };
  const u = coord / R;
  const oneMinus = 1 - u * u;
  return {
    offset: oneMinus * oneMinus,
    slope: (-4 * u * oneMinus) / R
  };
}

export class CampusScene3D {
  constructor(canvas, onLotClick) {
    this.canvas = canvas;
    this.onLotClick = onLotClick;

    this.scene = new THREE.Scene();
    this.fogColor = new THREE.Color(0xaacbe4);
    this.scene.fog = new THREE.Fog(this.fogColor, 68, 152);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.2, 240);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85; // Calibrated natural filmic exposure (zero glare!)

    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    // Grounded PBR Image-Based Lighting (low intensity so shadows & diffuse colors stay rich and deep)
    this.pmremGen = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = this.pmremGen.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.25;

    // Realistic Vietnamese Tropical Sky Dome
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x1b6ca8) },
      uHorizonColor: { value: new THREE.Color(0xa8cbe6) },
      uBottomColor: { value: new THREE.Color(0x3a5f32) },
      uSunDir: { value: new THREE.Vector3(26, 36, 18).normalize() },
      uSunColor: { value: new THREE.Color(0xfff3d6) }
    };
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(162, 32, 20),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    this.scene.add(skyDome);

    // Calibrated 3-Point Outdoor Sunlit Rig (crisp readable shadows, zero washout)
    this.hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x2b4622, 0.45);
    this.scene.add(this.hemiLight);

    const initShadowRes = window.innerWidth < 640 ? 1024 : 2048;
    this.shadowMapRes = initShadowRes;
    this.sunOffset = new THREE.Vector3(26, 36, 18);
    this.sunLight = new THREE.DirectionalLight(0xfff3d8, 1.52);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(initShadowRes, initShadowRes);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 135;
    this.sunLight.shadow.camera.left = -36;
    this.sunLight.shadow.camera.right = 36;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.00042;
    this.sunLight.shadow.normalBias = 0.042;
    this._lastShadowExtent = 36;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.22);
    this.rimLight.position.set(-22, 16, -24);
    this.scene.add(this.rimLight);

    this.timeOfDay = 'day'; // 'day' | 'sunset'

    // Build Expanded Làng ĐH Thủ Đức World with Historical Era Layers
    const env = createCampusEnvironment();
    this.scene.add(env.group);
    this.eraGroups = env.eraGroups;
    this.sportsActors = env.sportsActors;
    this.streetLampBulbs = env.streetLampBulbs;
    this.swayingCanopies = env.swayingCanopies;
    this.waterBump = env.waterBump;
    this.waterUniforms = env.waterUniforms || null;
    this.trafficSignals = env.trafficSignals;
    this.flagMeshes = env.flagMeshes;
    this.envGlowMats = env.envGlowMats;

    // High-horizon drifting soft clouds (positioned along backdrop so they never block central campus views!)
    this.clouds = [];
    for (let i = 0; i < 6; i += 1) {
      const c = createCloudMesh();
      c.position.set(-42 + i * 17, 23.5 + (i % 3) * 2.4, i % 2 === 0 ? -38 - (i % 3) * 4 : 38 + (i % 3) * 4);
      c.scale.setScalar(1.1 + (i % 2) * 0.35);
      this.scene.add(c);
      this.clouds.push({ mesh: c, speed: 0.38 + (i % 3) * 0.12 });
    }

    // Lot Pads, Cached Lot Building Pool (0 GPU geometry leak on stage switches!) & Interactive Hitboxes
    this.lotModelCache = new Map();
    this.lotSlots = {};
    this.hitMeshes = [];
    for (const lot of LOTS) {
      const { pad, padSlab, modernPadMat, baocapPadMat, ring, ringMat, hitbox } = createLotPad(lot);
      this.scene.add(pad);
      this.hitMeshes.push(hitbox);
      this.lotSlots[lot.id] = {
        lot,
        pad,
        padSlab,
        modernPadMat,
        baocapPadMat,
        ring,
        ringMat,
        hitbox,
        buildingGroup: null,
        variant: null,
        bounceTime: 0
      };
    }

    this.selectedLotId = null;
    this.hoveredLotId = null;

    // Elevated Tuyến Metro Số 1 Hitachi 5-Car Train (centered on Track 1 z = 15.75 — VISIBLE ONLY WHEN TRANSIT === 'XHCN'!)
    this.metroTrain = createMetroTrainMesh();
    this.metroTrain.position.set(-36, 4.72, 15.75);
    this.scene.add(this.metroTrain);
    this.metroCycle = 0;

    // ========================================================================
    // ERA-SEPARATED HUMAN & VEHICLE POOLS
    // ========================================================================
    this.baocapActorsGroup = new THREE.Group();
    this.modernActorsGroup = new THREE.Group();
    this.scene.add(this.baocapActorsGroup, this.modernActorsGroup);

    // 1. Stage 1 Bao cấp Canteen Queue (14 distinct 1980s students with cặp lồng nhôm, mũ cối, nón lá, tóc bím)
    this.queueStudents = [];
    for (let q = 0; q < 14; q += 1) {
      const st = createDetailedPerson(q, 'baocap', 'walk');
      st.visible = false;
      this.baocapActorsGroup.add(st);
      this.queueStudents.push(st);
    }

    // 2. Stage 1 Bao cấp Pedestrians, Bicycles, Cub 81s & State Cargo Trucks (zero clipping through fenced lots!)
    this.baocapWalkers = [];
    const bcNsStartPos = [-11.5, -5.8, 7.8, 12.2];
    for (let w = 0; w < 14; w += 1) {
      const st = createDetailedPerson(w + 2, 'baocap', 'walk');
      this.baocapActorsGroup.add(st);
      const axis = w < 10 ? 'ew' : 'ns_outer';
      const side = w < 10 ? (w < 5 ? 1 : -1) : w % 2 === 0 ? 1 : -1;
      const dir = w % 2 === 0 ? 1 : -1;
      const startPos = axis === 'ew' ? -24 + ((w * 4.8) % 48) : bcNsStartPos[w - 10];
      this.baocapWalkers.push({
        mesh: st,
        axis,
        laneCoord: axis === 'ew' ? side * (dir === 1 ? 3.16 : 3.62) : side * (dir === 1 ? 6.18 : 6.68),
        pos: startPos,
        dir,
        speed: 0.92 + (w % 4) * 0.14,
        phase: w * 0.85
      });
    }

    this.baocapCycles = [];
    const bcSlotCounts = new Map();
    for (let b = 0; b < 12; b += 1) {
      const isCub = b % 4 === 3;
      const veh = isCub ? createDetailedMotorbike(b, 'baocap') : createBicycleMesh(b, 'baocap');
      const dir = b % 2 === 0 ? 1 : -1;
      const axis = b < 9 ? 'ew' : 'highway';
      const laneOffset =
        axis === 'highway' ? (dir === 1 ? 23.85 : 19.75) : Math.floor(b / 2) % 2 === 0 ? 1.62 : 2.12;
      const laneKey = `${axis}:${dir}:${laneOffset}`;
      const idxInLane = bcSlotCounts.get(laneKey) || 0;
      bcSlotCounts.set(laneKey, idxInLane + 1);
      this.baocapActorsGroup.add(veh);
      this.baocapCycles.push({
        mesh: veh,
        isBicycle: !isCub,
        axis,
        dir,
        pos: -26 + idxInLane * 16.5 + (dir === -1 ? 4.5 : 0),
        laneOffset,
        speed: isCub ? 2.85 : 1.95 + (b % 3) * 0.2,
        phase: b * 1.1
      });
    }

    this.baocapTrucks = [];
    const bcTruckStartX = [-28, -12, 7, 18];
    for (let t = 0; t < 4; t += 1) {
      const trk = createDetailedCar(t, 'baocap');
      const dir = t % 2 === 0 ? 1 : -1;
      const onOldHighway = t < 3;
      trk.rotation.y = dir === 1 ? 0 : Math.PI;
      this.baocapActorsGroup.add(trk);
      this.baocapTrucks.push({
        mesh: trk,
        onHighway: onOldHighway,
        x: bcTruckStartX[t],
        zBase: onOldHighway ? (dir === 1 ? 22.8 : 20.8) : dir === 1 ? 0.78 : -0.78,
        dir,
        speed: 3.1 + (t % 2) * 0.45
      });
    }

    // 3. Stage 2 & 3 Modern Diverse Pedestrians (well-separated directional sublanes + outer garden promenades)
    this.modernWalkers = [];
    const modNsStartPos = [-12.2, -7.8, -3.8, 7.6, 10.6, 13.2];
    for (let w = 0; w < 28; w += 1) {
      const st = createDetailedPerson(w, 'modern', 'walk');
      this.modernActorsGroup.add(st);
      const axis = w < 22 ? 'ew' : 'ns_outer';
      const side = w % 2 === 0 ? 1 : -1;
      const dir =
        axis === 'ew'
          ? Math.floor(w / 2) % 2 === 0
            ? 1
            : -1
          : Math.floor((w - 22) / 2) % 2 === 0
          ? 1
          : -1;
      const startPos = axis === 'ew' ? -26 + ((w * 2.45) % 52) : modNsStartPos[w - 22];
      this.modernWalkers.push({
        mesh: st,
        axis,
        laneCoord: axis === 'ew' ? side * (dir === 1 ? 3.22 : 3.76) : side * (dir === 1 ? 6.18 : 6.68),
        pos: startPos,
        dir,
        speed: 1.04 + (w % 4) * 0.14,
        phase: w * 0.67
      });
    }

    // 4. Modern Motorbikes (Scooters, Wave/Exciter, Shippers, 2-up riders) + Student Bicycles
    // Cleanly separated sublanes (1.66m inner moto lane vs 2.18m outer bike/moto lane -> concentric roundabout arcs!)
    this.modernMotorbikes = [];
    const motoLaneCounts = new Map();
    for (let m = 0; m < 24; m += 1) {
      const isStudentBike = m >= 21;
      const bike = isStudentBike ? createBicycleMesh(m, 'modern') : createDetailedMotorbike(m, 'modern');
      const dir = m % 2 === 0 ? 1 : -1;
      const axis = m >= 17 && m < 21 ? 'highway' : 'ew';
      this.modernActorsGroup.add(bike);
      const subLane = isStudentBike ? 2.18 : Math.floor(m / 2) % 2 === 0 ? 1.66 : 2.18;
      const laneOffset = axis === 'highway' ? (dir === 1 ? 24.05 : 19.55) : subLane;
      const laneKey = `${axis}:${dir}:${laneOffset}`;
      const idxInLane = motoLaneCounts.get(laneKey) || 0;
      motoLaneCounts.set(laneKey, idxInLane + 1);
      this.modernMotorbikes.push({
        mesh: bike,
        isBicycle: isStudentBike,
        axis,
        dir,
        pos: -29 + idxInLane * 11.4 + (subLane > 1.9 ? 3.2 : 0),
        laneOffset,
        baseSpeed: isStudentBike ? 2.35 : 3.55 + (m % 3) * 0.32,
        phase: m * 0.9
      });
    }

    // 5. Modern Cars, Xanh SM Electric Taxis, Vinasun Taxis, Crossover SUVs & Cargo Mini-Trucks
    this.modernCars = [];
    const modCarStartX = [-10, -24, 8, 0, 25, 23, 4, -6, 22, -24];
    for (let c = 0; c < 10; c += 1) {
      const car = createDetailedCar(c, 'modern');
      const dir = c % 2 === 0 ? 1 : -1;
      const onHighway = c < 6;
      car.rotation.y = dir === 1 ? 0 : Math.PI;
      this.modernActorsGroup.add(car);
      this.modernCars.push({
        mesh: car,
        onHighway,
        x: modCarStartX[c],
        // Right-hand Vietnamese traffic: Eastbound (+1) in +Z lane, Westbound (-1) in -Z lane!
        zBase: onHighway ? (dir === 1 ? 22.95 : 20.65) : dir === 1 ? 0.76 : -0.76,
        dir,
        speed: onHighway ? 5.4 + (c % 3) * 0.85 : 3.9 + (c % 2) * 0.35
      });
    }

    this._avenueVehScratch = [];

    // 6. Subsidized 3,000 VND Green HCMC Student Buses (Routes 08, 33, 53 — active when transit === 'xhcn')
    this.buses = [];
    this.wasBusesActive = false;
    const routes = ['08', '33', '53'];
    for (let b = 0; b < 3; b += 1) {
      const bus = createBusMesh(routes[b]);
      const dir = b % 2 === 0 ? 1 : -1;
      const onHighway = b === 2;
      bus.visible = false;
      this.modernActorsGroup.add(bus);
      this.buses.push({
        mesh: bus,
        onHighway,
        x: b === 0 ? -18 : b === 1 ? 16 : -24,
        zBase: onHighway ? 22.95 : dir === 1 ? 0.76 : -0.76,
        dir,
        speed: onHighway ? 4.9 : 3.85
      });
    }

    // Circling birds over Hồ Đá & Campus Hills
    this.birds = [];
    for (let b = 0; b < 7; b += 1) {
      const bird = createBirdMesh();
      this.scene.add(bird);
      this.birds.push({
        mesh: bird,
        cx: 24 + (b % 2) * -18,
        cz: -10 + (b % 3) * 4,
        radius: 6 + (b % 3) * 2.5,
        height: 8.6 + (b % 3) * 1.4,
        angle: b * 0.9,
        speed: 0.44 + (b % 3) * 0.1
      });
    }

    // Zero-churn InstancedMesh particle pools for build bursts & street-food smoke
    this.particles = [];
    this.smokeAccum = 0;
    this.burstInstMesh = new THREE.InstancedMesh(
      BURST_BOX_GEO,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      96
    );
    this.burstInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.burstInstMesh.frustumCulled = false;
    this.burstInstMesh.count = 0;
    this._pDummy = new THREE.Object3D();
    this._pColor = new THREE.Color(0xffffff);
    for (let i = 0; i < 96; i += 1) {
      this.burstInstMesh.setMatrixAt(i, this._pDummy.matrix);
      this.burstInstMesh.setColorAt(i, this._pColor);
    }
    this.smokeInstMesh = new THREE.InstancedMesh(
      SMOKE_PUFF_GEO,
      new THREE.MeshBasicMaterial({ color: 0x525b66, transparent: true, opacity: 0.45, depthWrite: false }),
      24
    );
    this.smokeInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smokeInstMesh.frustumCulled = false;
    this.smokeInstMesh.count = 0;
    for (let i = 0; i < 24; i += 1) {
      this.smokeInstMesh.setMatrixAt(i, this._pDummy.matrix);
    }
    this.scene.add(this.burstInstMesh, this.smokeInstMesh);

    // Pre-allocated 3D Upgrade Shockwave Rings & Architectural Light Beams (0 runtime GPU allocations!)
    this.fxPool = [];
    for (let f = 0; f < 8; f += 1) {
      const matA = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const matB = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const matBeam = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        alphaMap: BEAM_ALPHA_TEX,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const ringA = new THREE.Mesh(FX_RING_A_GEO, matA);
      const ringB = new THREE.Mesh(FX_RING_B_GEO, matB);
      const beam = new THREE.Mesh(FX_BEAM_GEO, matBeam);
      ringA.visible = false;
      ringB.visible = false;
      beam.visible = false;
      this.scene.add(ringA, ringB, beam);
      this.fxPool.push({
        active: false,
        age: 0,
        duration: 0.9,
        maxRadius: 5.8,
        beamHeight: 6.8,
        baseY: 0.22,
        withBeam: true,
        ringA,
        ringB,
        beam,
        matA,
        matB,
        matBeam
      });
    }

    // Reusable math scratchpad (zero GC allocations in 60Hz loop!)
    this.tempVec = new THREE.Vector3();
    this._tmpColA = new THREE.Color();
    this._tmpSunTarget = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._shForward = new THREE.Vector3();
    this._shRight = new THREE.Vector3();
    this._shUp = new THREE.Vector3();
    this._shCenter = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    // Camera spherical orbit & pan controller (supports zooming all the way down to street level r = 7.0!)
    this.showcaseOrbit = true;
    this.defaultOrbit = { azimuth: 0.5, polar: 0.74, radius: 37.5, target: new THREE.Vector3(0, 0.6, 0.5) };
    this.curOrbit = {
      azimuth: this.defaultOrbit.azimuth,
      polar: this.defaultOrbit.polar,
      radius: this.defaultOrbit.radius,
      target: this.defaultOrbit.target.clone()
    };
    this.targetOrbit = {
      azimuth: this.defaultOrbit.azimuth,
      polar: this.defaultOrbit.polar,
      radius: this.defaultOrbit.radius,
      target: this.defaultOrbit.target.clone()
    };

    // High-threshold MSAA Post-Processing Pipeline (zero diffuse washout!) + Adaptive DPR monitor
    this.composer = null;
    this.bloomPass = null;
    this._adaptiveSlowFrames = 0;
    this._adaptiveChecked = false;
    this._lastWallNow = 0;
    this.setupComposer();

    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = null;
    this.lastDragPos = null;
    this.dragButton = 0;
    this.isDragging = false;
    this.activePointers = new Map();
    this.prevPinchDist = null;
    this._pendingHoverPos = null;
    this.animTime = 0;

    this.bindEvents();
    this.resize();
  }

  setupComposer() {
    try {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const dpr = this.renderer.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(Math.floor(w * dpr), Math.floor(h * dpr), {
        type: THREE.HalfFloatType,
        samples: this.renderer.capabilities.isWebGL2 ? 4 : 0
      });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);

      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // High threshold (1.08) guarantees zero glare/washout on sunlit walls, sidewalks, or clouds!
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.08, 0.32, 1.08);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }
  }

  setTimeOfDay(tod) {
    this.timeOfDay = tod === 'sunset' ? 'sunset' : 'day';
    return this.timeOfDay;
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      this.defaultOrbit.azimuth = 0.08;
      this.defaultOrbit.polar = 0.72;
      this.defaultOrbit.radius = Math.min(72, Math.max(40, 34 / aspect));
      if (!this.selectedLotId && !this.isDragging) {
        this.targetOrbit.azimuth = this.defaultOrbit.azimuth;
        this.targetOrbit.polar = this.defaultOrbit.polar;
        this.targetOrbit.radius = this.defaultOrbit.radius;
      }
    } else {
      this.defaultOrbit.azimuth = 0.5;
      this.defaultOrbit.polar = 0.74;
      this.defaultOrbit.radius = 37.5;
      if (!this.selectedLotId && !this.isDragging) {
        this.targetOrbit.radius = 37.5;
      }
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  setShowcaseOrbit(enabled) {
    this.showcaseOrbit = Boolean(enabled);
  }

  resetCamera() {
    this.targetOrbit.azimuth = this.defaultOrbit.azimuth;
    this.targetOrbit.polar = this.defaultOrbit.polar;
    this.targetOrbit.radius = this.defaultOrbit.radius;
    this.targetOrbit.target.copy(this.defaultOrbit.target);
  }

  focusLot(lotId) {
    if (!lotId || !this.lotSlots[lotId]) {
      this.resetCamera();
      return;
    }
    const pos = this.lotSlots[lotId].lot.pos;
    this.targetOrbit.target.set(pos.x, 1.35, pos.z);
    this.targetOrbit.radius = window.innerWidth < 480 ? 21.5 : 17.5;
    this.targetOrbit.polar = 0.84;
  }

  setSelectedLot(lotId) {
    this.selectedLotId = lotId || null;
  }

  applyKeyboardNav(keysSet, dt) {
    if (!keysSet || keysSet.size === 0) return;
    const az = this.curOrbit.azimuth;
    const rx = Math.cos(az);
    const rz = -Math.sin(az);
    const fx = -Math.sin(az);
    const fz = -Math.cos(az);
    const panSpeed = (6.5 + this.curOrbit.radius * 0.28) * dt;

    let moveX = 0;
    let moveZ = 0;
    if (keysSet.has('w') || keysSet.has('arrowup')) {
      moveX += fx;
      moveZ += fz;
    }
    if (keysSet.has('s') || keysSet.has('arrowdown')) {
      moveX -= fx;
      moveZ -= fz;
    }
    if (keysSet.has('d') || keysSet.has('arrowright')) {
      moveX += rx;
      moveZ += rz;
    }
    if (keysSet.has('a') || keysSet.has('arrowleft')) {
      moveX -= rx;
      moveZ -= rz;
    }
    if (moveX !== 0 || moveZ !== 0) {
      const inv = 1 / Math.hypot(moveX, moveZ);
      this.targetOrbit.target.x = THREE.MathUtils.clamp(
        this.targetOrbit.target.x + moveX * inv * panSpeed,
        -26,
        26
      );
      this.targetOrbit.target.z = THREE.MathUtils.clamp(
        this.targetOrbit.target.z + moveZ * inv * panSpeed,
        -22,
        22
      );
    }
    if (keysSet.has('q')) {
      this.targetOrbit.azimuth -= 1.25 * dt;
    }
    if (keysSet.has('e')) {
      this.targetOrbit.azimuth += 1.25 * dt;
    }
  }

  triggerUpgradeFx(x, z, variant = 'xhcn', opts = {}) {
    if (!this.fxPool || !this.fxPool.length) return;
    let fx = this.fxPool.find((item) => !item.active);
    if (!fx) {
      fx = this.fxPool.reduce((oldest, cur) => (cur.age > oldest.age ? cur : oldest), this.fxPool[0]);
    }
    let colA = 0x10b981;
    let colB = 0x0ea5e9;
    let colBeam = 0x34d399;
    if (variant === 'private' || variant === 'warn') {
      colA = 0xf43f5e;
      colB = 0xf97316;
      colBeam = 0xfb7185;
    } else if (variant === 'state') {
      colA = 0x64748b;
      colB = 0x94a3b8;
      colBeam = 0xcbd5e1;
    } else if (variant === 'gold' || variant === 'canteen') {
      colA = 0xf59e0b;
      colB = 0x10b981;
      colBeam = 0xfbbf24;
    }

    const baseY = opts.baseY ?? 0.22;
    fx.active = true;
    fx.age = -(opts.delay ?? 0);
    fx.duration = opts.duration ?? 0.92;
    fx.maxRadius = opts.maxRadius ?? 5.9;
    fx.beamHeight = opts.beamHeight ?? 6.8;
    fx.baseY = baseY;
    fx.withBeam = opts.withBeam !== false;

    fx.matA.color.setHex(colA);
    fx.matB.color.setHex(colB);
    fx.matBeam.color.setHex(colBeam);
    fx.ringA.position.set(x, baseY, z);
    fx.ringB.position.set(x, baseY + 0.015, z);
    fx.beam.position.set(x, baseY, z);
    fx.ringA.visible = fx.age >= 0;
    fx.ringB.visible = false;
    fx.beam.visible = fx.withBeam && fx.age >= 0;
  }

  emitSparkBurstAt(x, y, z, palette, count = 26, spread = 3.2, upBoost = 1.0) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= 96) this.particles.shift();
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radSpd = (1.6 + Math.random() * 2.6) * (spread / 3.2);
      this.particles.push({
        kind: 'burst',
        colorHex: palette[i % palette.length],
        x: x + Math.cos(ang) * (0.6 + Math.random() * 1.4),
        y: y + Math.random() * 1.1,
        z: z + Math.sin(ang) * (0.6 + Math.random() * 1.2),
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        vx: Math.cos(ang) * radSpd,
        vy: (3.1 + Math.random() * 3.4) * upBoost,
        vz: Math.sin(ang) * radSpd,
        gravity: 7.2,
        life: 1.05,
        maxLife: 1.05
      });
    }
  }

  emitBuildBurst(lotId, variant) {
    const slot = this.lotSlots[lotId];
    if (!slot) return;
    const palette =
      variant === 'xhcn'
        ? [0x10b981, 0x0ea5e9, 0xfbbf24, 0x34d399]
        : variant === 'private'
        ? [0xf43f5e, 0xf97316, 0x94a3b8]
        : [0x94a3b8, 0x64748b, 0xcbd5e1];

    const px = slot.lot.pos.x;
    const pz = slot.lot.pos.z;
    this.triggerUpgradeFx(px, pz, variant, {
      maxRadius: variant === 'xhcn' ? 6.4 : 5.5,
      beamHeight: variant === 'xhcn' ? 7.6 : 5.6,
      duration: variant === 'xhcn' ? 1.02 : 0.85
    });
    this.emitSparkBurstAt(px, 1.35, pz, palette, variant === 'xhcn' ? 30 : 20, 3.4, variant === 'xhcn' ? 1.15 : 0.95);

    if (lotId === 'transit' && variant === 'xhcn') {
      // Inauguration wave right on elevated Ga Metro ĐHQG!
      this.triggerUpgradeFx(0, 16.5, 'xhcn', { baseY: 4.82, maxRadius: 7.5, beamHeight: 5.5, delay: 0.12 });
    }
  }

  triggerCanteenServeFx() {
    const slot = this.lotSlots.food;
    if (!slot) return;
    slot.bounceTime = 0.28;
    slot.bounceMax = 0.28;
    slot.bounceSpin = 0;
    this.triggerUpgradeFx(slot.lot.pos.x, slot.lot.pos.z + 1.1, 'canteen', {
      maxRadius: 3.4,
      duration: 0.58,
      withBeam: false
    });
    this.emitSparkBurstAt(slot.lot.pos.x, 1.35, slot.lot.pos.z + 1.2, [0xf59e0b, 0xfef08a, 0x10b981], 10, 1.8, 0.78);
  }

  triggerStage2WaveFx(phase) {
    const waveLots =
      phase === 1 ? ['housing', 'jobs'] : phase === 2 ? ['transit', 'food'] : ['study', 'welfare'];
    waveLots.forEach((lid, idx) => {
      const slot = this.lotSlots[lid];
      if (!slot) return;
      slot.bounceTime = 0.42;
      slot.bounceMax = 0.42;
      slot.bounceSpin = idx % 2 === 0 ? 1 : -1;
      this.triggerUpgradeFx(slot.lot.pos.x, slot.lot.pos.z, 'warn', {
        maxRadius: 5.4,
        beamHeight: 5.0,
        duration: 0.88,
        delay: idx * 0.12
      });
    });
  }

  triggerCampusCelebration() {
    this.triggerUpgradeFx(0, 0, 'gold', { baseY: 0.25, maxRadius: 8.2, beamHeight: 8.8, duration: 1.25 });
    this.emitSparkBurstAt(0, 2.2, 0, [0xfbbf24, 0x10b981, 0x0ea5e9, 0xf43f5e], 36, 4.8, 1.28);
  }

  projectWorldPoint(x, y, z) {
    this.tempVec.set(x, y, z);
    this.tempVec.project(this.camera);
    return {
      x: (this.tempVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tempVec.y * 0.5 + 0.5) * window.innerHeight,
      visible: this.tempVec.z > -1 && this.tempVec.z < 1
    };
  }

  clearParticles() {
    this.particles = [];
    this.smokeAccum = 0;
    if (this.burstInstMesh) this.burstInstMesh.count = 0;
    if (this.smokeInstMesh) this.smokeInstMesh.count = 0;
    if (this.fxPool) {
      for (const fx of this.fxPool) {
        fx.active = false;
        fx.ringA.visible = false;
        fx.ringB.visible = false;
        fx.beam.visible = false;
      }
    }
  }

  syncEraEnvironment(state) {
    const sId = state.stageId;
    const isBaoCap = sId === 1;
    const isThaNoi = sId === 2;
    const isStage3 = sId === 3;
    const isMetroCompleted = isStage3 && state.lotVariants.transit === 'xhcn';
    const isMetroUnderConstruction = isThaNoi || (isStage3 && !isMetroCompleted);

    this.eraGroups.baocapGroup.visible = isBaoCap;
    this.eraGroups.modernBaseGroup.visible = !isBaoCap;
    this.eraGroups.thaNoiGroup.visible = isThaNoi;
    if (this.eraGroups.metroConstructionGroup) {
      this.eraGroups.metroConstructionGroup.visible = isMetroUnderConstruction;
    }
    if (this.eraGroups.s3AvenueGroup) {
      this.eraGroups.s3AvenueGroup.visible = isStage3;
    }
    this.eraGroups.xhcnInfraGroup.visible = isMetroCompleted;

    // Historical & gameplay consistency: Completed Ga Metro & Hitachi 5-car train ONLY run when transit === 'xhcn'!
    this.metroTrain.visible = isMetroCompleted;

    this.baocapActorsGroup.visible = isBaoCap;
    this.modernActorsGroup.visible = !isBaoCap;

    // Switch lot courtyard surface between 1980s weathered laterite-cement (Stage 1) & modern terrazzo pavers (Stage 2/3)
    for (const lot of LOTS) {
      const slot = this.lotSlots[lot.id];
      if (slot.padSlab) {
        slot.padSlab.material = isBaoCap ? slot.baocapPadMat : slot.modernPadMat;
      }
    }
  }

  deconflictBusesWithCars() {
    for (const bus of this.buses) {
      const sameLane = this.modernCars
        .filter((c) => c.onHighway === bus.onHighway && c.dir === bus.dir)
        .map((c) => c.x);
      // Sample candidate positions along [-35, +35] avoiding crosswalk zones (±6.4) on the avenue!
      let bestX = bus.x;
      let bestClearance = -1;
      for (let k = 0; k < 70; k += 1) {
        const cand = -34.5 + k;
        if (!bus.onHighway && Math.abs(Math.abs(cand) - 6.4) < 4.4) continue;
        let minClear = 70;
        for (let i = 0; i < sameLane.length; i += 1) {
          const d = Math.abs(cand - sameLane[i]);
          const wrapD = Math.min(d, 70 - d);
          if (wrapD < minClear) minClear = wrapD;
        }
        if (minClear > bestClearance) {
          bestClearance = minClear;
          bestX = cand;
        }
      }
      bus.x = bestX;
    }
  }

  syncWithGameState(state, triggerBurstForLot = null) {
    if (!triggerBurstForLot) {
      this.clearParticles();
    }
    this.syncEraEnvironment(state);

    for (const lot of LOTS) {
      const slot = this.lotSlots[lot.id];
      const nextVariant = state.lotVariants[lot.id];
      if (slot.variant !== nextVariant) {
        if (slot.buildingGroup) {
          slot.buildingGroup.scale.set(1, 1, 1);
          slot.buildingGroup.position.y = 0.14;
          slot.buildingGroup.rotation.y = 0;
          slot.pad.remove(slot.buildingGroup);
        }
        const cacheKey = `${lot.id}:${nextVariant}`;
        let model = this.lotModelCache.get(cacheKey);
        if (!model) {
          model = createLotBuilding(lot.id, nextVariant);
          model.position.y = 0.14;
          this.lotModelCache.set(cacheKey, model);
        }
        model.position.y = 0.14;
        model.rotation.y = 0;
        if (slot.variant !== null && triggerBurstForLot === lot.id) {
          model.scale.set(0.22, 0.12, 0.22);
          model.position.y = -0.35;
          slot.bounceMax = 0.68;
          slot.bounceTime = 0.68;
          slot.bounceSpin = nextVariant === 'xhcn' ? 1 : -1;
        } else {
          model.scale.set(1, 1, 1);
          slot.bounceMax = 0.68;
          slot.bounceTime = 0;
          slot.bounceSpin = 0;
        }
        slot.pad.add(model);
        slot.buildingGroup = model;
        slot.variant = nextVariant;
        if (triggerBurstForLot === lot.id) {
          this.emitBuildBurst(lot.id, nextVariant);
          if (lot.id === 'transit' && nextVariant === 'xhcn') {
            // Have the newly inaugurated Hitachi Metro train glide right into Ga ĐHQG & space buses cleanly!
            this.metroCycle = 4.6;
            this.deconflictBusesWithCars();
          }
        }
      }
    }
  }

  updateAtmosphere(state, dt) {
    const isSunset = this.timeOfDay === 'sunset';
    let topHex = 0x1b6ca8;
    let horHex = 0xa8cbe6;
    let sunHex = 0xfff3d8;
    let sunPos = [26, 36, 18];
    let sunIntensity = 1.52;
    let exposure = 0.85;
    let envInt = 0.25;
    let fogNear = 68;

    if (isSunset) {
      topHex = 0x1e1b4b;
      horHex = 0xd97736;
      sunHex = 0xf59e42;
      sunPos = [-28, 11.5, -22];
      sunIntensity = 1.38;
      exposure = 0.9;
      envInt = 0.18;
      fogNear = 54;
    } else if (state.stageId === 1) {
      // Warm nostalgic 1980s morning atmosphere
      topHex = 0x3b7ea8;
      horHex = 0xd4cbb8;
      sunHex = 0xffedb8;
      sunIntensity = 1.44;
      fogNear = 62;
    } else if (state.stageId === 2 && state.stage2Phase >= 2) {
      // Unregulated traffic exhaust haze in Stage 2 Phase 2-3
      topHex = 0x5c7285;
      horHex = 0xbec2c6;
      sunHex = 0xf2c2a8;
      sunIntensity = 1.32;
      fogNear = 44;
    }

    const lerpRate = Math.min(1, dt * 2.8);
    this.skyUniforms.uTopColor.value.lerp(this._tmpColA.setHex(topHex), lerpRate);
    this.skyUniforms.uHorizonColor.value.lerp(this._tmpColA.setHex(horHex), lerpRate);
    this.skyUniforms.uSunColor.value.lerp(this._tmpColA.setHex(sunHex), lerpRate);
    this.fogColor.lerp(this._tmpColA.setHex(horHex), lerpRate);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.near += (fogNear - this.scene.fog.near) * lerpRate;

    this._tmpSunTarget.set(sunPos[0], sunPos[1], sunPos[2]);
    this.sunOffset.lerp(this._tmpSunTarget, lerpRate);
    this.skyUniforms.uSunDir.value.copy(this.sunOffset).normalize();
    this.sunLight.color.lerp(this._tmpColA.setHex(sunHex), lerpRate);
    this.sunLight.intensity += (sunIntensity - this.sunLight.intensity) * lerpRate;
    this.renderer.toneMappingExposure += (exposure - this.renderer.toneMappingExposure) * lerpRate;
    this.scene.environmentIntensity += (envInt - this.scene.environmentIntensity) * lerpRate;

    const lampPower = isSunset ? 1.85 : 0.22;
    for (const mat of this.streetLampBulbs) {
      mat.emissiveIntensity = lampPower;
    }
    const glowPower = isSunset ? 1.05 : 0.14;
    for (const mat of this.envGlowMats) {
      mat.emissiveIntensity = glowPower;
    }
    for (const lot of LOTS) {
      const grp = this.lotSlots[lot.id].buildingGroup;
      if (!grp) continue;
      if (grp.userData.glowMats) {
        for (const gm of grp.userData.glowMats) {
          gm.emissiveIntensity = isSunset ? 1.2 : 0.16;
        }
      }
      if (grp.userData.fairyBulbs) {
        for (const fb of grp.userData.fairyBulbs) {
          fb.emissiveIntensity = isSunset ? 1.95 : 0.35;
        }
      }
    }
    if (this.bloomPass) {
      this.bloomPass.strength = isSunset ? 0.22 : 0.08;
    }
  }

  getPedestrianRoadBrake(vPos, vDir, vHalfLen, walkers) {
    let factor = 1;
    for (let i = 0; i < walkers.length; i += 1) {
      const w = walkers[i];
      if (w.axis === 'ew') continue;
      const zApp = (w.pos - 2.5) * w.dir;
      // Only brake for pedestrians actively crossing (curb-waiting walkers stay at zApp <= -4.22!)
      if (zApp <= -4.16 || zApp >= 2.85) continue;
      const fwd = (w.mesh.position.x - vPos) * vDir;
      const stopGap = vHalfLen + 1.05;
      if (fwd > -0.25 && fwd < stopGap + 3.1) {
        const f = fwd <= stopGap ? 0 : (fwd - stopGap) / 3.1;
        if (f < factor) factor = f;
      }
    }
    return factor;
  }

  isCrosswalkOccupiedForWalker(wx, avenueVehicles, hasSignal = true) {
    if (!avenueVehicles) return false;
    for (let i = 0; i < avenueVehicles.length; i += 1) {
      const veh = avenueVehicles[i];
      const rel = (wx - veh.x) * veh.dir;
      if (hasSignal) {
        // E-W traffic has red light when walkers get walk signal: only wait for vehicles already past stop-line!
        if (rel > -(veh.halfLen + 0.65) && rel < veh.halfLen + 0.82) {
          return true;
        }
      } else if (rel > -(veh.halfLen + 0.65) && rel < veh.halfLen + 4.2) {
        return true;
      }
    }
    return false;
  }

  computeWalkerWorldPos(w, deflectR, isBaoCap, out) {
    const sign = Math.sign(w.laneCoord) || 1;
    if (w.axis === 'ew') {
      const { offset, slope } = roundaboutDeflection(w.pos, deflectR);
      const absLane = Math.abs(w.laneCoord);
      const targetArc = isBaoCap ? (absLane > 3.4 ? 5.66 : 5.24) : absLane > 3.45 ? 5.82 : 5.44;
      const deflectAmp = Math.max(0, targetArc - absLane);
      out.x = w.pos;
      out.z = w.laneCoord + sign * offset * deflectAmp;
      const vx = w.dir;
      const vz = w.dir * sign * slope * deflectAmp;
      const inv = 1 / Math.max(0.0001, Math.hypot(vx, vz));
      out.fx = vx * inv;
      out.fz = vz * inv;
      out.yaw = Math.atan2(vx, vz);
    } else {
      const zWorld = w.pos - 2.5;
      out.x = w.laneCoord;
      out.z = zWorld;
      out.fx = 0;
      out.fz = w.dir;
      out.yaw = w.dir === 1 ? 0 : Math.PI;
    }
  }

  updateWalkersList(
    walkers,
    safeDt,
    deflectR = 6.8,
    nsCrosswalkStop = false,
    avenueVehicles = null,
    isBaoCap = false
  ) {
    if (!this._walkerPoseScratch || this._walkerPoseScratch.length < walkers.length) {
      this._walkerPoseScratch = Array.from({ length: walkers.length }, () => ({
        x: 0,
        z: 0,
        fx: 1,
        fz: 0,
        yaw: 0
      }));
    }
    for (let i = 0; i < walkers.length; i += 1) {
      this.computeWalkerWorldPos(walkers[i], deflectR, isBaoCap, this._walkerPoseScratch[i]);
    }

    for (let i = 0; i < walkers.length; i += 1) {
      const w = walkers[i];
      const pose = this._walkerPoseScratch[i];
      const bound = w.axis === 'ew' ? 28 : 14.0;
      const loopLen = bound * 2;
      let stepDist = w.speed * safeDt;
      const zWorldPre = w.pos - 2.5;
      const zApp = zWorldPre * w.dir;
      const committedCrossing = w.axis !== 'ew' && zApp > -4.16 && zApp < 2.85;

      // Crosswalk signal + physical vehicle & near-side sidewalk gap compliance!
      // Wait at promenade edge (zApp ≈ -4.25, cleanly outside ew sidewalk |z| <= 3.83 & roadway |z| <= 2.75!)
      if (w.axis !== 'ew') {
        if (zApp > -5.0 && zApp <= -4.16) {
          const crossX = w.laneCoord;
          let nearSidewalkBusy = false;
          for (let j = 0; j < walkers.length; j += 1) {
            const ew = walkers[j];
            if (ew.axis !== 'ew' || ew.laneCoord * zWorldPre <= 0) continue;
            const ewRel = (crossX - ew.pos) * ew.dir;
            if (ewRel > -0.36 && ewRel < 0.48) {
              nearSidewalkBusy = true;
              break;
            }
          }
          if (nsCrosswalkStop || nearSidewalkBusy || this.isCrosswalkOccupiedForWalker(crossX, avenueVehicles, !isBaoCap)) {
            stepDist *= THREE.MathUtils.clamp((-4.25 - zApp) / 0.75, 0, 1);
            if (zApp >= -4.25) stepDist = 0;
          }
        } else if (committedCrossing) {
          // Briskly clear sidewalk & asphalt crosswalk without ever hesitating on the road!
          stepDist *= 1.38;
        } else if (zApp >= 2.85 && zApp < 4.15) {
          // Already safely off the asphalt on the far sidewalk: pause 0.2s if an ew walker is mid-stride at crossX
          for (let j = 0; j < walkers.length; j += 1) {
            const ew = walkers[j];
            if (ew.axis !== 'ew' || ew.laneCoord * zWorldPre <= 0) continue;
            const zToEw = (this._walkerPoseScratch[j].z - pose.z) * w.dir;
            if (Math.abs(ew.pos - w.laneCoord) < 0.44 && zToEw > 0.34 && zToEw < 0.85) {
              stepDist *= THREE.MathUtils.clamp((zToEw - 0.48) / 0.37, 0, 1);
            }
          }
        }
      }

      // Same-sublane headway + acyclic corner crossing right-of-way (zero deadlocks, zero clipping!)
      for (let j = 0; j < walkers.length; j += 1) {
        if (i === j) continue;
        const other = walkers[j];
        if (other.axis === w.axis) {
          if (other.dir !== w.dir) continue;
          if (Math.abs(other.laneCoord - w.laneCoord) > 0.22) continue;
          const fwd = (((other.pos - w.pos) * w.dir) % loopLen + loopLen) % loopLen;
          if (fwd > 0.001 && fwd < 1.08) {
            if (fwd < 0.72) {
              w.pos -= w.dir * Math.min(0.035, 0.72 - fwd);
              stepDist = 0;
            } else {
              stepDist = Math.min(stepDist, stepDist * ((fwd - 0.72) / 0.36));
            }
          }
        } else if (w.axis === 'ew') {
          const oPose = this._walkerPoseScratch[j];
          const ozApp = (other.pos - 2.5) * other.dir;
          const zToEw = (pose.z - oPose.z) * other.dir;
          // Yield before entering crossX when an ns_outer walker is approaching this sidewalk; briskly clear if already inside!
          if (ozApp > -4.18 && ozApp < 4.22 && zToEw > -0.36 && zToEw < 1.45) {
            const fwdX = (oPose.x - pose.x) * w.dir;
            if (fwdX >= 0.38 && fwdX < 1.15) {
              if (fwdX <= 0.54) stepDist = 0;
              else stepDist = Math.min(stepDist, stepDist * ((fwdX - 0.54) / 0.61));
            } else if (fwdX > -0.36 && fwdX < 0.38) {
              stepDist *= 1.32;
            }
          }
        }
      }

      w.pos += w.dir * stepDist;
      if (w.pos > bound) w.pos = -bound;
      else if (w.pos < -bound) w.pos = bound;

      const actualSpeed = safeDt > 0.0001 ? stepDist / safeDt : w.speed;
      this.computeWalkerWorldPos(w, deflectR, isBaoCap, pose);
      w.mesh.position.x = pose.x;
      w.mesh.position.z = pose.z;
      w.mesh.rotation.y = pose.yaw;
      if (w.axis === 'ew') {
        animatePersonWalk(w.mesh, this.animTime, actualSpeed, w.phase, 0.15);
      } else {
        const onAvenueWalk = Math.abs(pose.z) < 4.7;
        animatePersonWalk(w.mesh, this.animTime, actualSpeed, w.phase, onAvenueWalk ? 0.14 : 0.085);
      }
    }
  }

  updateRoundaboutVehicle(mesh, axis, pos, dir, laneMag, travelDist, groundY = 0.14, isBaoCap = false) {
    // Concentric multi-lane right-hand roundabout rings with swept-path off-tracking clearance for 3.4m buses:
    // Long 4-wheelers use a compact entry radius while 2-wheelers sweep wider before the curve!
    const isFourWheeler = laneMag <= 1.1;
    const deflectR = isBaoCap ? (isFourWheeler ? 5.9 : 6.7) : isFourWheeler ? 6.3 : 7.45;
    const targetArc = isBaoCap
      ? isFourWheeler
        ? 3.44
        : laneMag < 1.9
        ? 4.38
        : 4.82
      : isFourWheeler
      ? 3.5
      : laneMag < 1.9
      ? 4.64
      : 5.06;
    if (axis === 'ew') {
      const zSign = dir === 1 ? 1 : -1;
      const { offset, slope } = roundaboutDeflection(pos, deflectR);
      const amp = Math.max(0, targetArc - laneMag);
      const z = zSign * (laneMag + offset * amp);
      const dz_dx = zSign * slope * amp;
      mesh.position.set(pos, groundY, z);
      const vx = dir;
      const vz = dir * dz_dx;
      mesh.rotation.y = Math.atan2(-vz, vx);
    } else {
      const xSign = dir === 1 ? -1 : 1;
      const { offset, slope } = roundaboutDeflection(pos, deflectR);
      const amp = Math.max(0, targetArc - laneMag);
      const x = xSign * (laneMag + offset * amp);
      const dx_dz = xSign * slope * amp;
      mesh.position.set(x, groundY, pos);
      const vz = dir;
      const vx = dir * dx_dz;
      mesh.rotation.y = Math.atan2(-vz, vx);
    }
    spinVehicleWheels(mesh, travelDist);
  }

  update(state, dt) {
    const safeDt = Math.min(dt, 0.05);
    this.animTime += safeDt;
    this.syncEraEnvironment(state);
    this.updateAtmosphere(state, safeDt);

    // Gentle showcase camera rotation on Intro / Peek 3D
    if (this.showcaseOrbit && !this.isDragging && !this.selectedLotId) {
      this.targetOrbit.azimuth += safeDt * 0.1;
    }

    // Damped spherical camera interpolation
    const damp = Math.min(1, safeDt * 7.5);
    this.curOrbit.azimuth += (this.targetOrbit.azimuth - this.curOrbit.azimuth) * damp;
    this.curOrbit.polar += (this.targetOrbit.polar - this.curOrbit.polar) * damp;
    this.curOrbit.radius += (this.targetOrbit.radius - this.curOrbit.radius) * damp;
    this.curOrbit.target.lerp(this.targetOrbit.target, damp);

    const sinP = Math.sin(this.curOrbit.polar);
    this.camera.position.set(
      this.curOrbit.target.x + this.curOrbit.radius * sinP * Math.sin(this.curOrbit.azimuth),
      this.curOrbit.target.y + this.curOrbit.radius * Math.cos(this.curOrbit.polar),
      this.curOrbit.target.z + this.curOrbit.radius * sinP * Math.cos(this.curOrbit.azimuth)
    );
    this.camera.lookAt(this.curOrbit.target);
    this.updateShadowCamera();

    // Deferred 60Hz hover raycast (prevents 1000Hz gaming-mouse DOM/raycast thrashing!)
    if (this._pendingHoverPos && !this.isDragging) {
      const lotId = this.pickLotAtClientPos(this._pendingHoverPos.x, this._pendingHoverPos.y);
      this.hoveredLotId = lotId;
      this.canvas.style.cursor = lotId ? 'pointer' : 'grab';
      this._pendingHoverPos = null;
    }

    // Scroll Hồ Đá dual water ripples, sway tree canopies & wave Vietnamese National Flag via GPU shader!
    if (this.waterBump) {
      this.waterBump.offset.x += safeDt * 0.018;
      this.waterBump.offset.y += safeDt * 0.013;
    }
    if (this.waterUniforms) {
      this.waterUniforms.uWaterTime.value = this.animTime;
    }
    for (const tc of this.swayingCanopies) {
      tc.crown.rotation.z = Math.sin(this.animTime * 1.35 + tc.phase) * 0.032;
    }
    for (const flag of this.flagMeshes) {
      if (flag.userData.flagUniforms) {
        flag.userData.flagUniforms.uFlagTime.value = this.animTime;
      }
    }

    // Cycle Vòng xoay Quảng Trường Sáng Tạo Traffic Lights
    const sigT = this.animTime % 10;
    for (const sig of this.trafficSignals) {
      const localT = (sigT + sig.offset * 10) % 10;
      const isGreen = localT < 4.2;
      const isAmber = localT >= 4.2 && localT < 5.0;
      const isRed = localT >= 5.0;
      sig.greenMat.emissiveIntensity = isGreen ? 1.45 : 0.08;
      sig.amberMat.emissiveIntensity = isAmber ? 1.45 : 0.08;
      sig.redMat.emissiveIntensity = isRed ? 1.45 : 0.08;
    }

    // Drift overhead clouds & circling birds
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * safeDt;
      if (c.mesh.position.x > 46) c.mesh.position.x = -46;
    }
    for (const b of this.birds) {
      b.angle += b.speed * safeDt;
      const nx = b.cx + Math.cos(b.angle) * b.radius;
      const nz = b.cz + Math.sin(b.angle) * b.radius;
      b.mesh.position.set(nx, b.height + Math.sin(this.animTime * 2 + b.angle) * 0.35, nz);
      b.mesh.rotation.y = -b.angle;
      const flap = Math.sin(this.animTime * 7.5 + b.angle) * 0.45;
      b.mesh.userData.wL.rotation.x = flap;
      b.mesh.userData.wR.rotation.x = -flap;
    }

    // Elastic architectural rise, shockwave rings & glowing selection ring
    for (const lot of LOTS) {
      const slot = this.lotSlots[lot.id];
      const isSelected = this.selectedLotId === lot.id;
      const isHovered = this.hoveredLotId === lot.id;
      const restY = state.stageId === 3 && (isSelected || isHovered) ? 0.205 : 0.14;

      if (slot.bounceTime > 0 && slot.buildingGroup) {
        slot.bounceTime = Math.max(0, slot.bounceTime - safeDt);
        const dur = slot.bounceMax || 0.68;
        const prog = 1 - slot.bounceTime / dur;
        if (prog >= 0.99) {
          slot.buildingGroup.scale.set(1, 1, 1);
          slot.buildingGroup.position.y = restY;
          slot.buildingGroup.rotation.y = 0;
        } else {
          // Juicy damped spring overshoot (vertical stretch -> squash -> crisp settle!)
          const easeOut = 1 - Math.pow(1 - prog, 3);
          const spring = Math.sin(prog * Math.PI * 2.2) * (1 - prog) * 0.18;
          const sxz = 0.22 + 0.78 * easeOut - spring * 0.45;
          const sy = 0.12 + 0.88 * easeOut + spring * 1.15;
          slot.buildingGroup.scale.set(sxz, sy, sxz);
          slot.buildingGroup.position.y = THREE.MathUtils.lerp(-0.32, restY, easeOut) + Math.max(0, spring) * 0.35;
          slot.buildingGroup.rotation.y = (1 - easeOut) * 0.18 * (slot.bounceSpin || 0);
        }
      } else if (slot.buildingGroup) {
        slot.buildingGroup.position.y += (restY - slot.buildingGroup.position.y) * Math.min(1, safeDt * 12);
      }

      const targetOp = isSelected ? 0.92 : isHovered ? 0.58 : 0;
      slot.ringMat.opacity += (targetOp - slot.ringMat.opacity) * Math.min(1, safeDt * 12);
      slot.ringMat.color.setHex(isSelected ? 0x0ea5e9 : 0x10b981);
    }

    // Update 3D Upgrade Shockwave Rings & Holographic Light Pillars
    if (this.fxPool) {
      for (const fx of this.fxPool) {
        if (!fx.active) continue;
        fx.age += safeDt;
        if (fx.age < 0) continue;
        const p = fx.age / fx.duration;
        if (p >= 1) {
          fx.active = false;
          fx.ringA.visible = false;
          fx.ringB.visible = false;
          fx.beam.visible = false;
          continue;
        }
        const easeA = 1 - Math.pow(1 - p, 2.4);
        const radA = 0.7 + easeA * (fx.maxRadius - 0.7);
        fx.ringA.visible = true;
        fx.ringA.scale.set(radA, 1, radA);
        fx.matA.opacity = (1 - p) * 0.86;

        const pB = (fx.age - 0.13) / (fx.duration * 0.88);
        if (pB > 0 && pB < 1) {
          const easeB = 1 - Math.pow(1 - pB, 2.2);
          const radB = 0.6 + easeB * (fx.maxRadius * 1.14 - 0.6);
          fx.ringB.visible = true;
          fx.ringB.scale.set(radB, 1, radB);
          fx.matB.opacity = (1 - pB) * 0.62;
        } else {
          fx.ringB.visible = false;
        }

        if (fx.withBeam) {
          const beamFade = p < 0.18 ? p / 0.18 : Math.pow(1 - (p - 0.18) / 0.82, 1.6);
          const bRad = (3.8 - easeA * 1.1) * (fx.maxRadius / 5.9);
          const bH = (1.6 + easeA * fx.beamHeight);
          fx.beam.visible = true;
          fx.beam.scale.set(bRad, bH, bRad);
          fx.beam.rotation.y += safeDt * 1.8;
          fx.matBeam.opacity = beamFade * 0.42;
        } else {
          fx.beam.visible = false;
        }
      }
    }

    // ========================================================================
    // ERA-SPECIFIC ACTOR UPDATES (WITH REALISTIC SAME-LANE HEADWAY SPACING!)
    // ========================================================================
    if (state.stageId === 1) {
      // Stage 1: Bao cấp Canteen Queue + Bao cấp Walkers + Bicycles + Cub 81 + State Trucks!
      const showQueue = state.queueCount;
      for (let i = 0; i < this.queueStudents.length; i += 1) {
        const st = this.queueStudents[i];
        if (i < showQueue) {
          st.visible = true;
          const col = i < 7 ? 12.52 : 13.48;
          const row = i % 7;
          const sway = Math.sin(this.animTime * 1.8 + i * 0.9) * 0.035;
          // Strictly inside Căng Tin courtyard guide rails (z ∈ [-6.58, -4.42]), 100% clear of sidewalk (z = -3.62)!
          const zPos = -6.58 + row * 0.34 + (i >= 7 ? 0.12 : 0);
          st.position.set(col + sway * 0.35, 0.24, zPos);
          st.rotation.y = Math.PI + sway * 1.4;
          if (st.userData.headPivot) {
            st.userData.headPivot.rotation.y = Math.sin(this.animTime * 1.1 + i) * 0.18;
          }
        } else {
          st.visible = false;
        }
      }

      // Collect active Stage 1 avenue vehicles into zero-allocation scratch list for pedestrian curb safety
      let avCount = 0;
      const pushAv = (x, dir, halfLen) => {
        if (!this._avenueVehScratch[avCount]) {
          this._avenueVehScratch[avCount] = { x: 0, dir: 1, halfLen: 0.55 };
        }
        const slot = this._avenueVehScratch[avCount];
        slot.x = x;
        slot.dir = dir;
        slot.halfLen = halfLen;
        avCount += 1;
      };
      for (let i = 0; i < this.baocapCycles.length; i += 1) {
        const cyc = this.baocapCycles[i];
        if (cyc.axis === 'ew') pushAv(cyc.pos, cyc.dir, 0.54);
      }
      for (let i = 0; i < this.baocapTrucks.length; i += 1) {
        const trk = this.baocapTrucks[i];
        if (!trk.onHighway) pushAv(trk.x, trk.dir, 1.32);
      }
      this._avenueVehScratch.length = avCount;

      this.updateWalkersList(this.baocapWalkers, safeDt, 6.2, false, this._avenueVehScratch, true);

      for (const cyc of this.baocapCycles) {
        const limit = cyc.axis === 'highway' ? 34 : 32;
        const loopLen = limit * 2;
        let desiredDist = cyc.speed * safeDt;
        if (cyc.axis === 'ew') {
          desiredDist *= this.getPedestrianRoadBrake(cyc.pos, cyc.dir, 0.54, this.baocapWalkers);
        }
        for (const other of this.baocapCycles) {
          if (other === cyc || other.axis !== cyc.axis || other.dir !== cyc.dir) continue;
          if (Math.abs(other.laneOffset - cyc.laneOffset) > 0.3) continue;
          const fwd = (((other.pos - cyc.pos) * cyc.dir) % loopLen + loopLen) % loopLen;
          if (fwd > 0.001 && fwd < 2.2) {
            if (fwd < 1.55) {
              cyc.pos -= cyc.dir * Math.min(0.05, 1.55 - fwd);
              desiredDist = 0;
            } else {
              desiredDist = Math.min(desiredDist, desiredDist * ((fwd - 1.55) / 0.65));
            }
          }
        }
        cyc.pos += cyc.dir * desiredDist;
        if (cyc.pos > limit) cyc.pos = -limit;
        if (cyc.pos < -limit) cyc.pos = limit;

        if (cyc.axis === 'highway') {
          cyc.mesh.position.set(cyc.pos, 0.12, cyc.laneOffset);
          cyc.mesh.rotation.y = cyc.dir === 1 ? 0 : Math.PI;
          spinVehicleWheels(cyc.mesh, desiredDist);
        } else {
          this.updateRoundaboutVehicle(cyc.mesh, 'ew', cyc.pos, cyc.dir, cyc.laneOffset, desiredDist, 0.14, true);
        }

        if (cyc.isBicycle && cyc.mesh.userData.rider) {
          const pedAmp = Math.min(1, (desiredDist / Math.max(0.0001, safeDt)) / 0.55);
          const ped = Math.sin(this.animTime * 8.5 + cyc.phase) * 0.34 * pedAmp;
          const ru = cyc.mesh.userData.rider.userData;
          ru.legL.rotation.x = -Math.PI * 0.41 + ped;
          ru.legR.rotation.x = -Math.PI * 0.41 - ped;
          if (ru.kneeL) ru.kneeL.rotation.x = Math.PI * 0.41 - ped * 0.52;
          if (ru.kneeR) ru.kneeR.rotation.x = Math.PI * 0.41 + ped * 0.52;
        }
      }

      for (const trk of this.baocapTrucks) {
        let dist = trk.speed * safeDt;
        if (!trk.onHighway) {
          dist *= this.getPedestrianRoadBrake(trk.x, trk.dir, 1.32, this.baocapWalkers);
        }
        for (const other of this.baocapTrucks) {
          if (other === trk || other.onHighway !== trk.onHighway || other.dir !== trk.dir) continue;
          const fwd = (((other.x - trk.x) * trk.dir) % 70 + 70) % 70;
          if (fwd > 0.001 && fwd < 4.8) {
            if (fwd < 3.7) {
              trk.x -= trk.dir * Math.min(0.08, 3.7 - fwd);
              dist = 0;
            } else {
              dist = Math.min(dist, dist * ((fwd - 3.7) / 1.1));
            }
          }
        }
        trk.x += trk.dir * dist;
        if (trk.x > 35) trk.x = -35;
        if (trk.x < -35) trk.x = 35;
        if (trk.onHighway) {
          trk.mesh.position.set(trk.x, 0.12, trk.zBase);
          trk.mesh.rotation.y = trk.dir === 1 ? 0 : Math.PI;
          spinVehicleWheels(trk.mesh, dist);
        } else {
          this.updateRoundaboutVehicle(trk.mesh, 'ew', trk.x, trk.dir, Math.abs(trk.zBase), dist, 0.13, true);
        }
      }
    } else {
      // Stage 2 & Stage 3 (Modern Làng ĐH Thủ Đức — Multi-Lane Concentric Roundabout & Physical Yielding!)
      const ewLocalT = (sigT + 5) % 10;
      const ewVehStop = ewLocalT >= 4.45; // E-W vehicles stop at crosswalk stop-lines on Amber + Red
      const nsPedStop = sigT >= 3.75 || sigT < 0.75; // Generous 3.0s walk window + clean clearance before E-W green!

      const sev = state.getTrafficSeverity();
      const visibleBikes = Math.max(10, Math.round(10 + sev * 14));
      const speedFactor = 1.0 - sev * 0.72;
      const busesActive = state.hasTransitBus();
      if (busesActive && !this.wasBusesActive) {
        this.deconflictBusesWithCars();
      }
      this.wasBusesActive = busesActive;

      // Build active avenue vehicle occupancy list so curb pedestrians wait if a slow congested vehicle is still crossing!
      let avCount = 0;
      const pushAv = (x, dir, halfLen) => {
        if (!this._avenueVehScratch[avCount]) {
          this._avenueVehScratch[avCount] = { x: 0, dir: 1, halfLen: 0.55 };
        }
        const slot = this._avenueVehScratch[avCount];
        slot.x = x;
        slot.dir = dir;
        slot.halfLen = halfLen;
        avCount += 1;
      };
      for (let i = 0; i < visibleBikes && i < this.modernMotorbikes.length; i += 1) {
        const m = this.modernMotorbikes[i];
        if (m.axis === 'ew') pushAv(m.pos, m.dir, 0.55);
      }
      for (let i = 0; i < this.modernCars.length; i += 1) {
        const c = this.modernCars[i];
        if (!c.onHighway) pushAv(c.x, c.dir, 1.3);
      }
      if (busesActive) {
        for (let i = 0; i < this.buses.length; i += 1) {
          const b = this.buses[i];
          if (!b.onHighway) pushAv(b.x, b.dir, 1.75);
        }
      }
      this._avenueVehScratch.length = avCount;

      this.updateWalkersList(this.modernWalkers, safeDt, 6.8, nsPedStop, this._avenueVehScratch, false);

      // Elevated Tuyến Metro Số 1 Train (Stage 3 when transit === 'xhcn' — stops smoothly for 2.5s at Ga ĐHQG x = 0)
      if (state.stageId === 3 && state.lotVariants.transit === 'xhcn') {
        this.metroCycle = (this.metroCycle + safeDt) % 16.0;
        let mx = 0;
        if (this.metroCycle < 6.5) {
          const p = this.metroCycle / 6.5;
          const easeOut = 1 - Math.pow(1 - p, 2);
          mx = -42 + easeOut * 42;
        } else if (this.metroCycle < 9.0) {
          mx = 0;
        } else {
          const p = (this.metroCycle - 9.0) / 7.0;
          const easeIn = p * p;
          mx = easeIn * 44;
        }
        this.metroTrain.position.x = mx;
      }

      // Update ALL 24 motorbikes/bicycles continuously so newly revealed bikes never unhide overlapping another actor!
      for (let i = 0; i < this.modernMotorbikes.length; i += 1) {
        const m = this.modernMotorbikes[i];
        m.mesh.visible = i < visibleBikes;

        const limit = m.axis === 'highway' ? 35 : 33;
        const loopLen = limit * 2;
        let dist = m.baseSpeed * (m.axis === 'highway' ? 1.0 : speedFactor) * safeDt;

        // Stop before zebra crosswalk (x = ±6.4) when E-W signal is red OR when a pedestrian is crossing!
        if (m.axis === 'ew') {
          if (ewVehStop) {
            const app = m.pos * m.dir;
            if (app > -10.1 && app < -8.15) {
              dist *= THREE.MathUtils.clamp((-8.15 - app) / 1.95, 0, 1);
            }
          }
          dist *= this.getPedestrianRoadBrake(m.pos, m.dir, 0.55, this.modernWalkers);
        }

        for (let j = 0; j < this.modernMotorbikes.length; j += 1) {
          if (i === j) continue;
          const other = this.modernMotorbikes[j];
          if (other.axis !== m.axis || other.dir !== m.dir) continue;
          if (Math.abs(other.laneOffset - m.laneOffset) > 0.3) continue;
          const fwd = (((other.pos - m.pos) * m.dir) % loopLen + loopLen) % loopLen;
          if (fwd > 0.001 && fwd < 2.25) {
            if (fwd < 1.55) {
              m.pos -= m.dir * Math.min(0.06, 1.55 - fwd);
              dist = 0;
            } else {
              dist = Math.min(dist, dist * ((fwd - 1.55) / 0.7));
            }
          }
        }

        m.pos += m.dir * dist;
        if (m.pos > limit) m.pos = -limit;
        if (m.pos < -limit) m.pos = limit;

        if (m.axis === 'highway') {
          m.mesh.position.set(m.pos, 0.12, m.laneOffset);
          m.mesh.rotation.y = m.dir === 1 ? 0 : Math.PI;
          spinVehicleWheels(m.mesh, dist);
        } else {
          this.updateRoundaboutVehicle(m.mesh, 'ew', m.pos, m.dir, m.laneOffset, dist, 0.14, false);
        }

        if (m.isBicycle && m.mesh.userData.rider) {
          const pedAmp = Math.min(1, (dist / Math.max(0.0001, safeDt)) / 0.6);
          const ped = Math.sin(this.animTime * 8.5 + m.phase) * 0.34 * pedAmp;
          const ru = m.mesh.userData.rider.userData;
          ru.legL.rotation.x = -Math.PI * 0.41 + ped;
          ru.legR.rotation.x = -Math.PI * 0.41 - ped;
          if (ru.kneeL) ru.kneeL.rotation.x = Math.PI * 0.41 - ped * 0.52;
          if (ru.kneeR) ru.kneeR.rotation.x = Math.PI * 0.41 + ped * 0.52;
        }
      }

      // Subsidized 3,000 VND Green Student Buses (Routes 08, 33, 53) + Modern Cars/Taxis/SUVs with Shared-Lane Headway!
      for (const bus of this.buses) {
        bus.mesh.visible = busesActive;
        if (busesActive) {
          const curBusSpeed = bus.speed * (bus.onHighway ? 1.0 : Math.max(0.42, speedFactor));
          let dist = curBusSpeed * safeDt;
          if (!bus.onHighway) {
            if (ewVehStop) {
              const app = bus.x * bus.dir;
              if (app > -12.3 && app < -9.55) {
                dist *= THREE.MathUtils.clamp((-9.55 - app) / 2.75, 0, 1);
              }
            }
            dist *= this.getPedestrianRoadBrake(bus.x, bus.dir, 1.75, this.modernWalkers);
          }
          for (const car of this.modernCars) {
            if (car.onHighway !== bus.onHighway || car.dir !== bus.dir) continue;
            const fwd = (((car.x - bus.x) * bus.dir) % 70 + 70) % 70;
            if (fwd > 0.001 && fwd < 6.2) {
              if (fwd < 4.5) {
                bus.x -= bus.dir * Math.min(0.05, 4.5 - fwd);
                dist = 0;
              } else {
                dist = Math.min(dist, dist * ((fwd - 4.5) / 1.7));
              }
            }
          }
          bus.x += bus.dir * dist;
          if (bus.x > 35) bus.x = -35;
          if (bus.x < -35) bus.x = 35;
          if (bus.onHighway) {
            bus.mesh.position.set(bus.x, 0.12, bus.zBase);
            bus.mesh.rotation.y = bus.dir === 1 ? 0 : Math.PI;
            spinVehicleWheels(bus.mesh, dist);
          } else {
            this.updateRoundaboutVehicle(bus.mesh, 'ew', bus.x, bus.dir, Math.abs(bus.zBase), dist, 0.14, false);
          }
        }
      }

      for (const car of this.modernCars) {
        const curSpeed = car.speed * (car.onHighway ? 1.0 : speedFactor);
        let dist = curSpeed * safeDt;
        if (!car.onHighway) {
          if (ewVehStop) {
            const app = car.x * car.dir;
            if (app > -11.6 && app < -8.95) {
              dist *= THREE.MathUtils.clamp((-8.95 - app) / 2.65, 0, 1);
            }
          }
          dist *= this.getPedestrianRoadBrake(car.x, car.dir, 1.3, this.modernWalkers);
        }
        for (const other of this.modernCars) {
          if (other === car || other.onHighway !== car.onHighway || other.dir !== car.dir) continue;
          const fwd = (((other.x - car.x) * car.dir) % 70 + 70) % 70;
          if (fwd > 0.001 && fwd < 4.8) {
            if (fwd < 3.45) {
              car.x -= car.dir * Math.min(0.08, 3.45 - fwd);
              dist = 0;
            } else {
              dist = Math.min(dist, dist * ((fwd - 3.45) / 1.35));
            }
          }
        }
        if (busesActive) {
          for (const bus of this.buses) {
            if (bus.onHighway !== car.onHighway || bus.dir !== car.dir) continue;
            const fwd = (((bus.x - car.x) * car.dir) % 70 + 70) % 70;
            if (fwd > 0.001 && fwd < 6.2) {
              if (fwd < 4.5) {
                car.x -= car.dir * (4.52 - fwd);
                dist = 0;
              } else {
                dist = Math.min(dist, dist * ((fwd - 4.5) / 1.7));
              }
            } else if (fwd > 65.5) {
              // Car was slightly overlapping ahead of bus (<4.5m): push car cleanly ahead of bus!
              const ahead = 70 - fwd;
              car.x += car.dir * (4.52 - ahead);
            }
          }
        }
        car.x += car.dir * dist;
        if (car.x > 35) car.x = -35;
        if (car.x < -35) car.x = 35;

        if (car.onHighway) {
          car.mesh.position.set(car.x, 0.12, car.zBase);
          car.mesh.rotation.y = car.dir === 1 ? 0 : Math.PI;
          spinVehicleWheels(car.mesh, dist);
        } else {
          this.updateRoundaboutVehicle(car.mesh, 'ew', car.x, car.dir, Math.abs(car.zBase), dist, 0.13, false);
        }
      }

      // Animate Coordinated Student Basketball & Football Matches (real dribbling, passing & jump-shot arcs!)
      if (this.sportsActors) {
        const t = this.animTime;
        const bPlayers = this.sportsActors.basketballPlayers;
        if (bPlayers.length >= 4) {
          const bPlay = Math.floor(t / 2.4);
          const bU = (t % 2.4) / 2.4;
          const hIdx = (bPlay * 3) % bPlayers.length;
          const rIdx = (hIdx + 1 + (bPlay % 2)) % bPlayers.length;
          const isShot = bPlay % 2 === 1;
          const hoopX = hIdx < 2 ? 3.45 : -3.45;

          for (let i = 0; i < bPlayers.length; i += 1) {
            const bp = bPlayers[i];
            const cutAmp = i === hIdx ? 0.95 : 0.65;
            const goalX = THREE.MathUtils.clamp(
              bp.baseX + Math.sin(t * 1.65 + bp.phase) * cutAmp + (i === hIdx ? (hoopX > 0 ? 0.45 : -0.45) : 0),
              -3.3,
              3.3
            );
            const goalZ = THREE.MathUtils.clamp(bp.baseZ + Math.cos(t * 1.35 + bp.phase) * 0.58, -2.15, 2.15);
            const dx = goalX - bp.mesh.position.x;
            const dz = goalZ - bp.mesh.position.z;
            const stepLen = Math.hypot(dx, dz);
            bp.mesh.position.x = goalX;
            bp.mesh.position.z = goalZ;
            const lookX = i === hIdx ? hoopX - goalX : bPlayers[hIdx].mesh.position.x - goalX;
            const lookZ = i === hIdx ? -goalZ : bPlayers[hIdx].mesh.position.z - goalZ;
            const targetYaw = stepLen > 0.002 ? Math.atan2(dx, dz) : Math.atan2(lookX, lookZ);
            bp.mesh.rotation.y = targetYaw;
            animatePersonWalk(bp.mesh, t, Math.min(2.2, stepLen / Math.max(0.001, safeDt)), bp.phase, 0.16);
          }

          if (this.sportsActors.basketball) {
            const hMesh = bPlayers[hIdx].mesh;
            const rMesh = bPlayers[rIdx].mesh;
            if (bU < 0.56) {
              // Active player dribbles ball right in front of hands
              const fwdX = Math.sin(hMesh.rotation.y) * 0.24;
              const fwdZ = Math.cos(hMesh.rotation.y) * 0.24;
              this.sportsActors.basketball.position.set(
                hMesh.position.x + fwdX,
                0.21 + Math.abs(Math.sin(t * 10.5)) * 0.42,
                hMesh.position.z + fwdZ
              );
            } else {
              // Crisp chest-pass to teammate OR high-arc jump shot to rim!
              const f = (bU - 0.56) / 0.44;
              const tx = isShot ? hoopX : rMesh.position.x;
              const tz = isShot ? 0 : rMesh.position.z;
              const tyEnd = isShot ? 2.02 : 0.58;
              const arc = Math.sin(f * Math.PI) * (isShot ? 1.15 : 0.42);
              this.sportsActors.basketball.position.set(
                THREE.MathUtils.lerp(hMesh.position.x, tx, f),
                THREE.MathUtils.lerp(0.62, tyEnd, f) + arc,
                THREE.MathUtils.lerp(hMesh.position.z, tz, f)
              );
            }
          }
        }

        const fPlayers = this.sportsActors.footballPlayers;
        if (fPlayers.length >= 2) {
          const fPlay = Math.floor(t / 2.0);
          const fU = (t % 2.0) / 2.0;
          const pA = (fPlay * 5) % fPlayers.length;
          let pB = (fPlay * 5 + 2 + (fPlay % 3)) % fPlayers.length;
          if (pB === pA) pB = (pA + 1) % fPlayers.length;

          for (let i = 0; i < fPlayers.length; i += 1) {
            const fp = fPlayers[i];
            const runAmp = i === pA || i === pB ? 1.05 : 0.72;
            const nx = THREE.MathUtils.clamp(fp.baseX + Math.sin(t * 1.45 + fp.phase) * runAmp, -3.65, 3.65);
            const nz = THREE.MathUtils.clamp(fp.baseZ + Math.cos(t * 1.2 + fp.phase) * (runAmp * 0.68), -2.05, 2.05);
            const dx = nx - fp.mesh.position.x;
            const dz = nz - fp.mesh.position.z;
            const stepLen = Math.hypot(dx, dz);
            fp.mesh.position.x = nx;
            fp.mesh.position.z = nz;
            if (stepLen > 0.0015) {
              fp.mesh.rotation.y = Math.atan2(dx, dz);
            }
            animatePersonWalk(fp.mesh, t, Math.min(2.4, stepLen / Math.max(0.001, safeDt)), fp.phase, 0.16);
          }

          if (this.sportsActors.football) {
            const mA = fPlayers[pA].mesh;
            const mB = fPlayers[pB].mesh;
            if (fU < 0.34) {
              // Dribble at passer's feet
              const leadX = Math.sin(mA.rotation.y) * 0.22;
              const leadZ = Math.cos(mA.rotation.y) * 0.22;
              this.sportsActors.football.position.set(mA.position.x + leadX, 0.16, mA.position.z + leadZ);
            } else {
              // Driven pass across pitch to receiver's feet with subtle hop
              const k = (fU - 0.34) / 0.66;
              const easeK = 1 - Math.pow(1 - k, 1.6);
              this.sportsActors.football.position.set(
                THREE.MathUtils.lerp(mA.position.x, mB.position.x, easeK),
                0.16 + Math.sin(k * Math.PI) * 0.28,
                THREE.MathUtils.lerp(mA.position.z, mB.position.z, easeK)
              );
            }
          }
        }
      }
    }

    // Unregulated street food smoke puffs (food lot === 'private')
    if (state.lotVariants.food === 'private') {
      this.smokeAccum += safeDt;
      if (this.smokeAccum >= 0.42) {
        this.smokeAccum = 0;
        if (this.particles.length >= 80) this.particles.shift();
        this.particles.push({
          kind: 'smoke',
          colorHex: 0x525b66,
          x: 10.8,
          y: 3.15,
          z: -8.7,
          rx: Math.random() * Math.PI,
          ry: Math.random() * Math.PI,
          vx: (Math.random() - 0.5) * 0.45,
          vy: 1.25,
          vz: (Math.random() - 0.5) * 0.45,
          gravity: -0.2,
          life: 1.15,
          maxLife: 1.15
        });
      }
    }

    // Update burst & smoke particles via zero-allocation InstancedMesh pools
    let writeIdx = 0;
    let burstCount = 0;
    let smokeCount = 0;
    for (let i = 0; i < this.particles.length; i += 1) {
      const pt = this.particles[i];
      pt.life -= safeDt;
      if (pt.life <= 0) continue;
      pt.vy -= pt.gravity * safeDt;
      pt.x += pt.vx * safeDt;
      pt.y = Math.max(0.18, pt.y + pt.vy * safeDt);
      pt.z += pt.vz * safeDt;
      pt.rx += safeDt * 3;
      pt.ry += safeDt * 3;
      const ratio = Math.max(0, pt.life / pt.maxLife);

      this._pDummy.position.set(pt.x, pt.y, pt.z);
      this._pDummy.rotation.set(pt.rx, pt.ry, 0);
      if (pt.kind === 'smoke') {
        if (smokeCount < 24) {
          const sc = (1.35 - 0.55 * ratio) * Math.min(1, ratio * 2.4);
          this._pDummy.scale.setScalar(Math.max(0.05, sc));
          this._pDummy.updateMatrix();
          this.smokeInstMesh.setMatrixAt(smokeCount, this._pDummy.matrix);
          smokeCount += 1;
        }
      } else if (burstCount < 96) {
        this._pDummy.scale.setScalar(Math.max(0.06, 0.22 + 0.92 * ratio));
        this._pDummy.updateMatrix();
        this.burstInstMesh.setMatrixAt(burstCount, this._pDummy.matrix);
        this._pColor.setHex(pt.colorHex);
        this.burstInstMesh.setColorAt(burstCount, this._pColor);
        burstCount += 1;
      }
      this.particles[writeIdx] = pt;
      writeIdx += 1;
    }
    this.particles.length = writeIdx;
    if (this.burstInstMesh.count !== burstCount || burstCount > 0) {
      this.burstInstMesh.count = burstCount;
      this.burstInstMesh.instanceMatrix.needsUpdate = true;
      if (burstCount > 0 && this.burstInstMesh.instanceColor) {
        this.burstInstMesh.instanceColor.needsUpdate = true;
      }
    }
    if (this.smokeInstMesh.count !== smokeCount || smokeCount > 0) {
      this.smokeInstMesh.count = smokeCount;
      this.smokeInstMesh.instanceMatrix.needsUpdate = true;
    }

    // Adaptive DPR safeguard for integrated laptop / classroom GPUs
    if (!this._adaptiveChecked && this.renderer.getPixelRatio() > 1.05) {
      const nowMs = performance.now();
      if (this._lastWallNow > 0) {
        const wallDt = nowMs - this._lastWallNow;
        if (wallDt > 27 && wallDt < 180) {
          this._adaptiveSlowFrames += 1;
          if (this._adaptiveSlowFrames >= 45) {
            this._adaptiveChecked = true;
            this.renderer.setPixelRatio(1);
            this.resize();
          }
        } else if (wallDt <= 22 && this._adaptiveSlowFrames > 0) {
          this._adaptiveSlowFrames -= 1;
        }
      }
      this._lastWallNow = nowMs;
    }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateShadowCamera() {
    const isSunset = this.timeOfDay === 'sunset';
    const maxExt = isSunset ? 42 : 38;
    const zoomT = THREE.MathUtils.clamp((this.curOrbit.radius - 13) / 25, 0, 1);
    const halfX = Math.round(16 + zoomT * (maxExt - 16));
    const halfY = Math.round(halfX * 0.84 * 2) * 0.5;

    const cam = this.sunLight.shadow.camera;
    if (this._lastShadowExtent !== halfX) {
      this._lastShadowExtent = halfX;
      cam.left = -halfX;
      cam.right = halfX;
      cam.top = halfY;
      cam.bottom = -halfY;
      this.sunLight.shadow.normalBias = 0.018 + 0.026 * (halfX / 38);
      cam.updateProjectionMatrix();
    }

    // Center shadow frustum on orbit target (+ subtle sunset shadow-throw lead when zoomed out) with texel snapping!
    const sunsetLead = isSunset ? zoomT : 0;
    const cx = THREE.MathUtils.clamp(this.curOrbit.target.x, -28, 28) + sunsetLead * 3.8;
    const cz = THREE.MathUtils.clamp(this.curOrbit.target.z, -24, 24) + sunsetLead * 2.6;

    this._shForward.copy(this.sunOffset).negate().normalize();
    this._shRight.crossVectors(this._shForward, this._worldUp).normalize();
    this._shUp.crossVectors(this._shRight, this._shForward).normalize();

    this._shCenter.set(cx, 0, cz);
    const texelX = (halfX * 2) / this.shadowMapRes;
    const texelY = (halfY * 2) / this.shadowMapRes;
    const uSnap = Math.round(this._shCenter.dot(this._shRight) / texelX) * texelX;
    const vSnap = Math.round(this._shCenter.dot(this._shUp) / texelY) * texelY;
    const wProj = this._shCenter.dot(this._shForward);

    this.sunLight.target.position
      .set(0, 0, 0)
      .addScaledVector(this._shRight, uSnap)
      .addScaledVector(this._shUp, vSnap)
      .addScaledVector(this._shForward, wProj);
    this.sunLight.position.copy(this.sunLight.target.position).add(this.sunOffset);
  }

  getProjectedLotPins() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pins = [];
    for (const lot of LOTS) {
      const yOffset = this.lotSlots[lot.id].variant === 'private' ? 5.8 : 5.1;
      this.tempVec.set(lot.pos.x, yOffset, lot.pos.z);
      this.tempVec.project(this.camera);
      const visible = this.tempVec.z > -1 && this.tempVec.z < 1;
      pins.push({
        lot,
        variant: this.lotSlots[lot.id].variant,
        x: (this.tempVec.x * 0.5 + 0.5) * w,
        y: (-this.tempVec.y * 0.5 + 0.5) * h,
        visible
      });
    }
    return pins;
  }

  pickLotAtClientPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this._ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    return hits.length ? hits[0].object.userData.lotId : null;
  }

  bindEvents() {
    this.onResizeBound = () => this.resize();
    window.addEventListener('resize', this.onResizeBound);

    this.onContextMenuBound = (ev) => ev.preventDefault();
    this.canvas.addEventListener('contextmenu', this.onContextMenuBound);

    this.onPointerDownBound = (ev) => {
      this.activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.activePointers.size === 1) {
        this.pointerDownPos = { x: ev.clientX, y: ev.clientY };
        this.lastDragPos = { x: ev.clientX, y: ev.clientY };
        this.dragButton = ev.button;
        this.isDragging = true;
      } else if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDownBound);

    this.onPointerMoveBound = (ev) => {
      if (this.activePointers.has(ev.pointerId)) {
        this.activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }
      if (this.activePointers.size === 2 && this.prevPinchDist !== null) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const delta = this.prevPinchDist - dist;
        this.prevPinchDist = dist;
        this.targetOrbit.radius = Math.max(7.0, Math.min(64, this.targetOrbit.radius + delta * 0.06));
        return;
      }

      if (this.isDragging && this.lastDragPos) {
        const dx = ev.clientX - this.lastDragPos.x;
        const dy = ev.clientY - this.lastDragPos.y;
        this.lastDragPos = { x: ev.clientX, y: ev.clientY };
        if (this.dragButton === 2 || ev.shiftKey) {
          const az = this.curOrbit.azimuth;
          const panScale = this.curOrbit.radius * 0.0014;
          const rx = Math.cos(az);
          const rz = -Math.sin(az);
          const fx = Math.sin(az);
          const fz = Math.cos(az);
          this.targetOrbit.target.x = Math.max(
            -26,
            Math.min(26, this.targetOrbit.target.x - (dx * rx + dy * fx) * panScale)
          );
          this.targetOrbit.target.z = Math.max(
            -22,
            Math.min(22, this.targetOrbit.target.z - (dx * rz + dy * fz) * panScale)
          );
        } else {
          this.targetOrbit.azimuth -= dx * 0.007;
          this.targetOrbit.polar = Math.max(0.36, Math.min(1.26, this.targetOrbit.polar - dy * 0.006));
        }
      } else {
        this._pendingHoverPos = { x: ev.clientX, y: ev.clientY };
      }
    };
    this.canvas.addEventListener('pointermove', this.onPointerMoveBound);

    this.onEndPointerBound = (ev) => {
      const wasSingle = this.activePointers.size === 1;
      this.activePointers.delete(ev.pointerId);
      if (this.activePointers.size < 2) {
        this.prevPinchDist = null;
      }
      if (this.activePointers.size === 0) {
        this.isDragging = false;
        this.lastDragPos = null;
      }
      if (wasSingle && this.pointerDownPos) {
        const dist = Math.hypot(ev.clientX - this.pointerDownPos.x, ev.clientY - this.pointerDownPos.y);
        this.pointerDownPos = null;
        if (dist < 10 && ev.button === 0) {
          const lotId = this.pickLotAtClientPos(ev.clientX, ev.clientY);
          if (lotId && this.onLotClick) {
            this.onLotClick(lotId);
          }
        }
      }
    };

    this.canvas.addEventListener('pointerup', this.onEndPointerBound);
    this.canvas.addEventListener('pointercancel', this.onEndPointerBound);

    this.onWheelBound = (ev) => {
      ev.preventDefault();
      this.targetOrbit.radius = Math.max(7.0, Math.min(64, this.targetOrbit.radius + ev.deltaY * 0.022));
    };
    this.canvas.addEventListener('wheel', this.onWheelBound, { passive: false });
  }

  dispose() {
    window.removeEventListener('resize', this.onResizeBound);
    this.canvas.removeEventListener('contextmenu', this.onContextMenuBound);
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.removeEventListener('pointerup', this.onEndPointerBound);
    this.canvas.removeEventListener('pointercancel', this.onEndPointerBound);
    this.canvas.removeEventListener('wheel', this.onWheelBound);
    this.clearParticles();
    if (this.lotModelCache) {
      for (const grp of this.lotModelCache.values()) {
        grp.traverse((obj) => {
          if (obj.isMesh && obj.geometry) {
            obj.geometry.dispose();
          }
        });
      }
      this.lotModelCache.clear();
    }
    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) if (m && m.dispose) m.dispose();
        } else if (obj.material && obj.material.dispose) {
          obj.material.dispose();
        }
      }
    });
    if (this.envRenderTarget) this.envRenderTarget.dispose();
    if (this.pmremGen) this.pmremGen.dispose();
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
  }
}
