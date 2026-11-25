import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const edgeBin = EDGE_PATHS.find((p) => fs.existsSync(p));
assert.ok(edgeBin, 'Microsoft Edge binary not found for headless WebGL verification');

const PORT = 9344 + Math.floor(Math.random() * 400);
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldh3d-edge-'));
const captureShapes = process.argv.includes('--screenshots');
const outDir = path.join(__dirname, '.tmp_shots');
if (captureShapes) {
  fs.mkdirSync(outDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const browser = spawn(
  edgeBin,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-extensions',
    '--no-first-run',
    'about:blank'
  ],
  { stdio: 'ignore' }
);

let ws = null;
try {
  let versionInfo = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) {
        versionInfo = await r.json();
        break;
      }
    } catch {
      // wait for Edge CDP
    }
    await sleep(150);
  }
  assert.ok(versionInfo, 'Failed to connect to headless Edge CDP');

  const targetsRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'No page target found');

  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let msgId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const pageExceptions = [];

  ws.addEventListener('message', (ev) => {
    const data = JSON.parse(String(ev.data));
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') {
      pageExceptions.push(data.params?.exceptionDetails?.text || 'Unknown exception');
    } else if (data.method === 'Runtime.consoleAPICalled') {
      if (data.params?.type === 'error') {
        const txt = (data.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        consoleErrors.push(txt);
      }
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      msgId += 1;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  };

  const snap = async (filename) => {
    if (!captureShapes) return;
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, filename), Buffer.from(data, 'base64'));
    console.log('Saved screenshot:', filename);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: 'http://127.0.0.1:8755/' });

  // Wait for Three.js CampusScene3D boot
  for (let i = 0; i < 40; i += 1) {
    const ready = await evaluate('Boolean(window.__campusApp && window.__campusApp.scene3d)');
    if (ready) break;
    await sleep(150);
  }
  await sleep(600);

  // 1. Check WebGL render stats & exposure discipline on Intro Showcase (Stage 3 Demo)
  const bootStats = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.setShowcaseOrbit(false);
    // Warm up frustum upload across full 360° & zoom out once so all vehicles upload, then verify 0 runtime geometry leak!
    scene3d.curOrbit.radius = 60;
    scene3d.targetOrbit.radius = 60;
    for (let a = 0; a < 8; a++) {
      scene3d.curOrbit.azimuth = (a * Math.PI) / 4;
      scene3d.targetOrbit.azimuth = scene3d.curOrbit.azimuth;
      scene3d.update(gameState, 0.05);
    }
    scene3d.resetCamera();
    scene3d.curOrbit.radius = scene3d.defaultOrbit.radius;
    scene3d.curOrbit.azimuth = scene3d.defaultOrbit.azimuth;
    for (let w = 0; w < 120; w++) scene3d.update(gameState, 0.05);
    const geoBefore = scene3d.renderer.info.memory.geometries;
    for (let f = 0; f < 40; f++) scene3d.update(gameState, 0.05);
    const geoAfter = scene3d.renderer.info.memory.geometries;
    // Render main 3D scene pass directly once to inspect true 3D triangle & draw-call count before OutputPass quad resets info
    scene3d.renderer.render(scene3d.scene, scene3d.camera);
    const info = scene3d.renderer.info;
    const stats = {
      isWebGL2: scene3d.renderer.capabilities.isWebGL2,
      exposure: scene3d.renderer.toneMappingExposure,
      envIntensity: scene3d.scene.environmentIntensity,
      bloomThreshold: scene3d.bloomPass ? scene3d.bloomPass.threshold : null,
      triangles: info.render.triangles,
      calls: info.render.calls,
      geometries: info.memory.geometries,
      geoDeltaAfter40Frames: geoAfter - geoBefore,
      textures: info.memory.textures
    };
    if (scene3d.composer) scene3d.composer.render();
    return stats;
  })()`);
  console.log('WebGL Boot Stats:', bootStats);
  assert.ok(bootStats.triangles > 50000, `Expected rich 3D geometry (>50k tris), got ${bootStats.triangles}`);
  assert.ok(bootStats.calls < 900, `Expected optimized WebGL draw calls (<900), got ${bootStats.calls}`);
  assert.equal(bootStats.geoDeltaAfter40Frames, 0, `Expected 0 geometry leak over 40 frames, got ${bootStats.geoDeltaAfter40Frames}`);
  assert.ok(bootStats.exposure <= 0.92, `Exposure should stay grounded <= 0.92, got ${bootStats.exposure}`);
  assert.ok(bootStats.bloomThreshold >= 1.0, `Bloom threshold must be >= 1.0 to prevent washout`);

  // 2. Test Stage 1 (Thời Bao Cấp) — Verify ZERO Metro & authentic Bao cấp actors!
  await evaluate(`(() => {
    window.__campusApp.enterStage(1, false);
    const { scene3d, gameState } = window.__campusApp;
    for (let i = 0; i < 8; i++) gameState.stepStage1(0.1);
    scene3d.curOrbit.azimuth = 0.42;
    scene3d.targetOrbit.azimuth = 0.42;
    scene3d.curOrbit.polar = 0.78;
    scene3d.targetOrbit.polar = 0.78;
    scene3d.curOrbit.radius = 34;
    scene3d.targetOrbit.radius = 34;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(250);

  const s1Check = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    return {
      stageId: gameState.stageId,
      baocapVisible: scene3d.eraGroups.baocapGroup.visible,
      modernBaseVisible: scene3d.eraGroups.modernBaseGroup.visible,
      thaNoiVisible: scene3d.eraGroups.thaNoiGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      baocapActorsVisible: scene3d.baocapActorsGroup.visible,
      modernActorsVisible: scene3d.modernActorsGroup.visible,
      queueCount: gameState.queueCount,
      visibleQueueMeshes: scene3d.queueStudents.filter((s) => s.visible).length,
      pinLabels: Array.from(document.querySelectorAll('.lot-pin-lbl')).map((n) => n.textContent)
    };
  })()`);
  console.log('Stage 1 Historical Check:', s1Check);
  assert.equal(s1Check.baocapVisible, true, 'Bao cấp environment must be visible in Stage 1');
  assert.equal(s1Check.modernBaseVisible, false, 'Modern landmarks must be hidden in Stage 1');
  assert.equal(s1Check.xhcnInfraVisible, false, 'Metro viaduct & Ga ĐHQG must be hidden in Stage 1');
  assert.equal(s1Check.metroTrainVisible, false, 'Metro train MUST NOT exist in Stage 1 Bao cấp');
  assert.equal(s1Check.baocapActorsVisible, true, 'Bao cấp bicycles/trucks/people must be active');
  assert.equal(s1Check.modernActorsVisible, false, 'Modern scooters/taxis must be hidden in Stage 1');
  assert.equal(s1Check.visibleQueueMeshes, s1Check.queueCount, '3D queue meshes must match queueCount');
  assert.ok(!s1Check.pinLabels.some((t) => t.includes('Metro')), `Stage 1 pin labels must not mention Metro: ${s1Check.pinLabels.join(', ')}`);

  await snap('shot_s1_baocap.png');

  // 3. Test Stage 2 (Thị trường thả nổi) — Unfinished Metro crane + Tangled street wires + Congestion
  await evaluate(`(() => {
    window.__campusApp.enterStage(2, false);
    const { scene3d, gameState } = window.__campusApp;
    gameState.advanceStage2Phase();
    gameState.advanceStage2Phase();
    scene3d.curOrbit.azimuth = -0.35;
    scene3d.targetOrbit.azimuth = -0.35;
    scene3d.curOrbit.polar = 0.78;
    scene3d.targetOrbit.polar = 0.78;
    scene3d.curOrbit.radius = 35;
    scene3d.targetOrbit.radius = 35;
    scene3d.update(gameState, 0.05);
  })()`);
  await sleep(250);

  const s2Check = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    return {
      stageId: gameState.stageId,
      phase: gameState.stage2Phase,
      baocapVisible: scene3d.eraGroups.baocapGroup.visible,
      modernBaseVisible: scene3d.eraGroups.modernBaseGroup.visible,
      thaNoiVisible: scene3d.eraGroups.thaNoiGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      visibleMotorbikes: scene3d.modernMotorbikes.filter((m) => m.mesh.visible).length,
      pinLabels: Array.from(document.querySelectorAll('.lot-pin-lbl')).map((n) => n.textContent)
    };
  })()`);
  console.log('Stage 2 Unregulated Market Check:', s2Check);
  assert.equal(s2Check.thaNoiVisible, true, 'Unfinished Metro piers & crane must be visible in Stage 2');
  assert.equal(s2Check.metroTrainVisible, false, 'Metro train must not run on unfinished Stage 2 viaduct');
  assert.ok(s2Check.visibleMotorbikes >= 20, 'Stage 2 high congestion should show dense motorbikes');
  assert.ok(!s2Check.pinLabels.some((t) => t.includes('Metro')), `Stage 2 pin labels must not claim completed Metro: ${s2Check.pinLabels.join(', ')}`);

  await snap('shot_s2_thanoi.png');

  // 3B. Test Stage 3 Initial / Non-XHCN Transit — Verify Metro stays under construction until transit === 'xhcn'!
  await evaluate(`(() => {
    window.__campusApp.enterStage(3, false);
    const { gameState, scene3d } = window.__campusApp;
    scene3d.curOrbit.azimuth = 0.42;
    scene3d.targetOrbit.azimuth = 0.42;
    scene3d.curOrbit.polar = 0.78;
    scene3d.targetOrbit.polar = 0.78;
    scene3d.curOrbit.radius = 36.5;
    scene3d.targetOrbit.radius = 36.5;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(150);
  await snap('shot_s3_pre_metro.png');

  const s3PreMetroCheck = await evaluate(`(() => {
    const { gameState, scene3d } = window.__campusApp;
    const initial = {
      transitVariant: gameState.lotVariants.transit,
      metroConstructionVisible: scene3d.eraGroups.metroConstructionGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      s3AvenueVisible: scene3d.eraGroups.s3AvenueGroup.visible,
      busesVisible: scene3d.buses.filter((b) => b.mesh.visible).length
    };
    gameState.applyLotChoice('transit', 'state');
    scene3d.syncWithGameState(gameState);
    scene3d.update(gameState, 0.016);
    const stateTransit = {
      transitVariant: gameState.lotVariants.transit,
      metroConstructionVisible: scene3d.eraGroups.metroConstructionGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible
    };
    gameState.applyLotChoice('transit', 'xhcn');
    scene3d.syncWithGameState(gameState, 'transit');
    scene3d.update(gameState, 0.016);
    const xhcnTransit = {
      metroConstructionVisible: scene3d.eraGroups.metroConstructionGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      busesVisible: scene3d.buses.filter((b) => b.mesh.visible).length
    };
    gameState.applyLotChoice('transit', 'private');
    scene3d.syncWithGameState(gameState, 'transit');
    scene3d.update(gameState, 0.016);
    const downgradedPrivate = {
      metroConstructionVisible: scene3d.eraGroups.metroConstructionGroup.visible,
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      busesVisible: scene3d.buses.filter((b) => b.mesh.visible).length
    };
    return { initial, stateTransit, xhcnTransit, downgradedPrivate };
  })()`);
  console.log('Stage 3 Pre-XHCN Transit Metro Check:', s3PreMetroCheck);
  assert.equal(s3PreMetroCheck.initial.transitVariant, 'private');
  assert.equal(s3PreMetroCheck.initial.metroConstructionVisible, true, 'Unupgraded Stage 3 must show Metro construction site');
  assert.equal(s3PreMetroCheck.initial.xhcnInfraVisible, false, 'Completed Ga Metro must not appear beside 50k parking lot');
  assert.equal(s3PreMetroCheck.initial.metroTrainVisible, false, 'Metro train must not run before transit === xhcn');
  assert.equal(s3PreMetroCheck.initial.s3AvenueVisible, true, 'Stage 3 avenue streetlamps should be present');
  assert.equal(s3PreMetroCheck.initial.busesVisible, 0, 'Subsidized buses should not run before transit === xhcn');
  assert.equal(s3PreMetroCheck.stateTransit.metroConstructionVisible, true, 'State quota transit should still keep Metro awaiting synchronized investment');
  assert.equal(s3PreMetroCheck.stateTransit.xhcnInfraVisible, false);
  assert.equal(s3PreMetroCheck.stateTransit.metroTrainVisible, false);
  assert.equal(s3PreMetroCheck.xhcnTransit.metroConstructionVisible, false);
  assert.equal(s3PreMetroCheck.xhcnTransit.xhcnInfraVisible, true);
  assert.equal(s3PreMetroCheck.xhcnTransit.metroTrainVisible, true);
  assert.equal(s3PreMetroCheck.xhcnTransit.busesVisible, 3);
  assert.equal(s3PreMetroCheck.downgradedPrivate.metroConstructionVisible, true, 'Downgrading transit back to private must restore Metro construction site');
  assert.equal(s3PreMetroCheck.downgradedPrivate.xhcnInfraVisible, false);
  assert.equal(s3PreMetroCheck.downgradedPrivate.metroTrainVisible, false);
  assert.equal(s3PreMetroCheck.downgradedPrivate.busesVisible, 0);

  // 3C. Rapid mid-bounce transit switching + Day/Sunset emissive sync stress test!
  const midBounceCheck = await evaluate(`(() => {
    const { gameState, scene3d, toggleTimeOfDay } = window.__campusApp;
    gameState.baseMetrics.budget = 500;
    gameState.applyLotChoice('transit', 'xhcn');
    scene3d.syncWithGameState(gameState, 'transit');
    scene3d.update(gameState, 0.05); // mid-bounce (bounceTime > 0)
    const xhcnCached = scene3d.lotModelCache.get('transit:xhcn');
    gameState.applyLotChoice('transit', 'state');
    scene3d.syncWithGameState(gameState, 'transit');
    const prevScaleRestored = xhcnCached ? xhcnCached.scale.x : 0;
    scene3d.update(gameState, 0.05);
    gameState.applyLotChoice('transit', 'xhcn');
    scene3d.syncWithGameState(gameState, 'transit');
    toggleTimeOfDay(); // -> sunset
    scene3d.update(gameState, 0.05);
    const sunsetLamp = scene3d.streetLampBulbs[0]?.emissiveIntensity ?? 0;
    const sunsetEnvGlow = scene3d.envGlowMats[0]?.emissiveIntensity ?? 0;
    toggleTimeOfDay(); // -> back to day
    scene3d.update(gameState, 0.05);
    const dayLamp = scene3d.streetLampBulbs[0]?.emissiveIntensity ?? 0;
    scene3d.clearParticles();
    return { prevScaleRestored, sunsetLamp, sunsetEnvGlow, dayLamp };
  })()`);
  console.log('Mid-Bounce & Emissive Sync Check:', midBounceCheck);
  assert.equal(midBounceCheck.prevScaleRestored, 1, 'Removed mid-bounce lot model must restore scale to 1');
  assert.ok(midBounceCheck.sunsetLamp > 1.5 && midBounceCheck.sunsetEnvGlow > 0.9, 'Sunset emissive intensity must sync');
  assert.ok(midBounceCheck.dayLamp < 0.5, 'Daytime lamp emissive intensity must restore cleanly');

  // 4. Test Stage 3 (KTTT Định hướng XHCN) — Full Build + Buses + Metro + Close-Ups + Brightness Check!
  await evaluate(`(() => {
    window.__campusApp.enterStage(3, false);
    const { gameState, scene3d } = window.__campusApp;
    for (const lid of ['jobs', 'housing', 'food', 'transit', 'study', 'welfare']) {
      gameState.applyLotChoice(lid, 'xhcn');
      if (gameState.pendingEvent) {
        gameState.chooseEvent(gameState.pendingEvent.id, 'B');
      }
    }
    scene3d.syncWithGameState(gameState);
    // Clear build burst particles and position Metro train near Ga ĐHQG for clean inspection
    scene3d.particles = [];
    scene3d.metroCycle = 7.2;
    scene3d.curOrbit.azimuth = 0.46;
    scene3d.targetOrbit.azimuth = 0.46;
    scene3d.curOrbit.polar = 0.75;
    scene3d.targetOrbit.polar = 0.75;
    scene3d.curOrbit.radius = 36.5;
    scene3d.targetOrbit.radius = 36.5;
    scene3d.curOrbit.target.set(0, 0.6, 0.5);
    scene3d.targetOrbit.target.set(0, 0.6, 0.5);
    for (let i = 0; i < 15; i++) scene3d.update(gameState, 0.05);
  })()`);
  await sleep(250);

  const s3Check = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    let lotIntrusions = 0;
    let minBusCarClearance = Infinity;
    for (const bus of scene3d.buses) {
      for (const car of scene3d.modernCars) {
        if (car.onHighway !== bus.onHighway || car.dir !== bus.dir) continue;
        const dx = Math.abs(bus.x - car.x);
        const wrapDx = Math.min(dx, 70 - dx);
        if (wrapDx < minBusCarClearance) minBusCarClearance = wrapDx;
      }
    }
    // Step 120 frames (6s) and verify zero vehicles/walkers ever clip through study (0,-10) or transit (0,9.2) pads!
    for (let step = 0; step < 120; step++) {
      scene3d.update(gameState, 0.05);
      const actors = [
        ...scene3d.modernWalkers.map((w) => w.mesh),
        ...scene3d.modernMotorbikes.filter((m) => m.mesh.visible).map((m) => m.mesh),
        ...scene3d.modernCars.map((c) => c.mesh),
        ...scene3d.buses.filter((b) => b.mesh.visible).map((b) => b.mesh)
      ];
      for (const m of actors) {
        const x = m.position.x;
        const z = m.position.z;
        const inStudy = Math.abs(x) < 4.35 && z > -13.35 && z < -6.65;
        const inTransit = Math.abs(x) < 4.35 && z > 5.85 && z < 12.55;
        if (inStudy || inTransit) lotIntrusions += 1;
      }
    }
    scene3d.metroCycle = 7.2;
    scene3d.update(gameState, 0.05);
    return {
      complete: gameState.isStage3Complete(),
      xhcnInfraVisible: scene3d.eraGroups.xhcnInfraGroup.visible,
      metroTrainVisible: scene3d.metroTrain.visible,
      metroX: scene3d.metroTrain.position.x,
      metroZ: scene3d.metroTrain.position.z,
      busesVisible: scene3d.buses.filter((b) => b.mesh.visible).length,
      minBusCarClearance: Number(minBusCarClearance.toFixed(2)),
      lotIntrusions,
      endingTier: gameState.classifyEnding().badgeClass
    };
  })()`);
  console.log('Stage 3 Planned XHCN Check:', s3Check);
  assert.equal(s3Check.complete, true);
  assert.equal(s3Check.xhcnInfraVisible, true);
  assert.equal(s3Check.metroTrainVisible, true);
  assert.equal(s3Check.metroZ, 15.75, 'Hitachi Metro train must center on Track 1 (z = 15.75)');
  assert.equal(s3Check.busesVisible, 3, 'All 3 green HCMC student buses should be active');
  assert.ok(s3Check.minBusCarClearance >= 4.0, `Expected >=4.0m bus-car clearance, got ${s3Check.minBusCarClearance}`);
  assert.equal(s3Check.lotIntrusions, 0, `Expected 0 actor intrusions into study/transit lot pads, got ${s3Check.lotIntrusions}`);
  assert.equal(s3Check.endingTier, 'tier-s');

  // 4B. Multi-Frame Physical Anti-Collision Proof (Stage 1, Stage 2 Peak Congestion & Stage 3 Full Traffic)
  const collisionAudit = await evaluate(`(() => {
    const { scene3d, gameState, enterStage } = window.__campusApp;

    // Exact 2D Oriented Bounding Box (OBB) overlap test in world XZ plane
    function makeActorBox(mesh, halfLen, halfWid, kind, label) {
      const yaw = mesh.rotation.y || 0;
      const fx = Math.cos(yaw);
      const fz = -Math.sin(yaw);
      return {
        x: mesh.position.x,
        z: mesh.position.z,
        fx,
        fz,
        rx: -fz,
        rz: fx,
        hl: halfLen,
        hw: halfWid,
        kind,
        label
      };
    }

    function obbOverlap(a, b) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (dx * dx + dz * dz > 26) return false;
      const axes = [
        [a.fx, a.fz],
        [a.rx, a.rz],
        [b.fx, b.fz],
        [b.rx, b.rz]
      ];
      for (let i = 0; i < 4; i++) {
        const ux = axes[i][0];
        const uz = axes[i][1];
        const dist = Math.abs(dx * ux + dz * uz);
        const ra = a.hl * Math.abs(a.fx * ux + a.fz * uz) + a.hw * Math.abs(a.rx * ux + a.rz * uz);
        const rb = b.hl * Math.abs(b.fx * ux + b.fz * uz) + b.hw * Math.abs(b.rx * ux + b.rz * uz);
        if (dist >= ra + rb) return false;
      }
      return true;
    }

    function auditStageFrames(frames) {
      let vehPed = 0;
      let vehVeh = 0;
      let pedPed = 0;
      let sample = null;
      const distMap = new Map();
      const prevPos = new Map();
      const trackTravel = (key, mesh) => {
        const px = mesh.position.x;
        const pz = mesh.position.z;
        if (prevPos.has(key)) {
          const prev = prevPos.get(key);
          const step = Math.hypot(px - prev.x, pz - prev.z);
          // Ignore wrap-around teleport jumps (> 15m in one frame)
          if (step < 15) {
            distMap.set(key, (distMap.get(key) || 0) + step);
          }
        } else {
          distMap.set(key, 0);
        }
        prevPos.set(key, { x: px, z: pz });
      };

      for (let f = 0; f < frames; f++) {
        scene3d.update(gameState, 0.05);
        const vehs = [];
        const peds = [];
        if (gameState.stageId === 1) {
          for (let i = 0; i < scene3d.queueStudents.length; i++) {
            const m = scene3d.queueStudents[i];
            if (m.visible) peds.push(makeActorBox(m, 0.16, 0.16, 'ped', 'queue:' + i));
          }
          for (let i = 0; i < scene3d.baocapWalkers.length; i++) {
            const m = scene3d.baocapWalkers[i].mesh;
            trackTravel('bcWalk:' + i, m);
            peds.push(makeActorBox(m, 0.17, 0.17, 'ped', 'bcWalk:' + i));
          }
          for (let i = 0; i < scene3d.baocapCycles.length; i++) {
            const m = scene3d.baocapCycles[i].mesh;
            trackTravel('bcCyc:' + i, m);
            vehs.push(makeActorBox(m, 0.46, 0.18, 'veh', 'bcCyc:' + i));
          }
          for (let i = 0; i < scene3d.baocapTrucks.length; i++) {
            const m = scene3d.baocapTrucks[i].mesh;
            trackTravel('bcTrk:' + i, m);
            vehs.push(makeActorBox(m, 1.22, 0.46, 'veh', 'bcTrk:' + i));
          }
        } else {
          for (let i = 0; i < scene3d.modernWalkers.length; i++) {
            const m = scene3d.modernWalkers[i].mesh;
            trackTravel('modWalk:' + i, m);
            peds.push(makeActorBox(m, 0.17, 0.17, 'ped', 'modWalk:' + i));
          }
          for (let i = 0; i < scene3d.modernMotorbikes.length; i++) {
            const m = scene3d.modernMotorbikes[i];
            if (m.mesh.visible) {
              trackTravel('moto:' + i, m.mesh);
              vehs.push(makeActorBox(m.mesh, 0.46, 0.18, 'veh', 'moto:' + i));
            }
          }
          for (let i = 0; i < scene3d.modernCars.length; i++) {
            const m = scene3d.modernCars[i].mesh;
            trackTravel('car:' + i, m);
            vehs.push(makeActorBox(m, 1.18, 0.46, 'veh', 'car:' + i));
          }
          for (let i = 0; i < scene3d.buses.length; i++) {
            const b = scene3d.buses[i];
            if (b.mesh.visible) {
              trackTravel('bus:' + i, b.mesh);
              vehs.push(makeActorBox(b.mesh, 1.62, 0.5, 'veh', 'bus:' + i));
            }
          }
        }

        for (let i = 0; i < vehs.length; i++) {
          for (let j = i + 1; j < vehs.length; j++) {
            if (obbOverlap(vehs[i], vehs[j])) {
              vehVeh++;
              if (!sample) sample = { f, a: vehs[i], b: vehs[j] };
            }
          }
          for (let j = 0; j < peds.length; j++) {
            if (obbOverlap(vehs[i], peds[j])) {
              vehPed++;
              if (!sample) sample = { f, a: vehs[i], b: peds[j] };
            }
          }
        }
        for (let i = 0; i < peds.length; i++) {
          for (let j = i + 1; j < peds.length; j++) {
            if (peds[i].label.startsWith('queue:') && peds[j].label.startsWith('queue:')) continue;
            if (obbOverlap(peds[i], peds[j])) {
              pedPed++;
              if (!sample) sample = { f, a: peds[i], b: peds[j] };
            }
          }
        }
      }
      let minVehDist = Infinity;
      let minWalkDist = Infinity;
      let slowestActor = '';
      for (const [k, d] of distMap.entries()) {
        if (k.includes('Walk')) {
          if (d < minWalkDist) minWalkDist = d;
        } else {
          if (d < minVehDist) {
            minVehDist = d;
            slowestActor = k;
          }
        }
      }
      return {
        vehPed,
        vehVeh,
        pedPed,
        minVehDist: Number(minVehDist.toFixed(2)),
        minWalkDist: Number(minWalkDist.toFixed(2)),
        slowestActor,
        sample
      };
    }

    // Audit Stage 1 with full 14-student canteen queue (300 frames = 15s)
    enterStage(1, false);
    gameState.queueCount = 14;
    const s1 = auditStageFrames(300);

    // Audit Stage 2 at peak congestion (Phase 3 -> all 24 motorbikes + slow speedFactor, 320 frames = 16s)
    enterStage(2, false);
    gameState.advanceStage2Phase();
    gameState.advanceStage2Phase();
    gameState.advanceStage2Phase();
    const s2 = auditStageFrames(320);

    // Audit Stage 3 UNUPGRADED / PARTIAL (2/6 built — exact state from user bug report! 320 frames = 16s)
    enterStage(3, false);
    gameState.applyLotChoice('jobs', 'xhcn');
    gameState.applyLotChoice('welfare', 'xhcn');
    if (gameState.pendingEvent) gameState.chooseEvent(gameState.pendingEvent.id, 'B');
    scene3d.syncWithGameState(gameState);
    const s3Partial = auditStageFrames(320);

    // Restore Stage 3 full XHCN build & audit 320 frames (16s > 1.5x full 10s signal cycle)
    enterStage(3, false);
    for (const lid of ['jobs', 'housing', 'food', 'transit', 'study', 'welfare']) {
      gameState.applyLotChoice(lid, 'xhcn');
      if (gameState.pendingEvent) gameState.chooseEvent(gameState.pendingEvent.id, 'B');
    }
    scene3d.syncWithGameState(gameState);
    const s3 = auditStageFrames(320);

    // Restore camera & metro position for subsequent luminance & close-up checks
    scene3d.particles = [];
    scene3d.clearParticles();
    scene3d.metroCycle = 7.2;
    scene3d.curOrbit.azimuth = 0.46;
    scene3d.targetOrbit.azimuth = 0.46;
    scene3d.curOrbit.polar = 0.75;
    scene3d.targetOrbit.polar = 0.75;
    scene3d.curOrbit.radius = 36.5;
    scene3d.targetOrbit.radius = 36.5;
    scene3d.curOrbit.target.set(0, 0.6, 0.5);
    scene3d.targetOrbit.target.set(0, 0.6, 0.5);
    scene3d.update(gameState, 0.05);

    return { s1, s2, s3Partial, s3 };
  })()`);
  console.log('Multi-Frame 2D OBB Anti-Collision & Flow Audit:', JSON.stringify(collisionAudit));
  for (const [label, res] of Object.entries(collisionAudit)) {
    assert.equal(res.vehPed, 0, `${label} vehicle-pedestrian collisions: ${JSON.stringify(res)}`);
    assert.equal(res.vehVeh, 0, `${label} vehicle-vehicle collisions: ${JSON.stringify(res)}`);
    assert.equal(res.pedPed, 0, `${label} pedestrian-pedestrian collisions: ${JSON.stringify(res)}`);
    const minExpectedVeh = label === 's2' ? 3.5 : 10.0;
    assert.ok(res.minVehDist >= minExpectedVeh, `${label} vehicle deadlock detected! minVehDist=${res.minVehDist} (${res.slowestActor})`);
    assert.ok(res.minWalkDist >= 4.0, `${label} walker deadlock detected! minWalkDist=${res.minWalkDist}`);
  }

  // Measure actual rendered canvas brightness by drawing WebGL canvas onto a 2D sampling canvas
  await evaluate(`document.getElementById('hud-top').classList.add('hidden'); document.getElementById('hud-bottom').classList.add('hidden');`);
  await sleep(100);
  const lumStats = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.update(gameState, 0.016);
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 112;
    const ctx = c.getContext('2d');
    ctx.drawImage(scene3d.canvas, 0, 0, 180, 112);
    const data = ctx.getImageData(0, 0, 180, 112).data;
    let sumLum = 0;
    let blownCount = 0;
    const total = 180 * 112;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumLum += lum;
      if (r > 248 && g > 248 && b > 248) blownCount += 1;
    }
    return {
      meanLuminance: Number((sumLum / total).toFixed(1)),
      blownOutFraction: Number((blownCount / total).toFixed(4))
    };
  })()`);
  console.log('Daylight Luminance & Anti-Glare Check:', lumStats);
  assert.ok(lumStats.meanLuminance > 45 && lumStats.meanLuminance < 168, `Expected balanced daylight luminance (45..168), got ${lumStats.meanLuminance}`);
  assert.ok(lumStats.blownOutFraction < 0.015, `Expected <1.5% blown-out white pixels, got ${lumStats.blownOutFraction}`);

  await snap('shot_s3_day_overview.png');

  // Close-up 1: Street-level view along Đại lộ Tạ Quang Bửu & Chợ Đêm (people, scooters, buses, trees)
  await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    document.getElementById('world-labels').classList.add('hidden');
    scene3d.targetOrbit.target.set(8.5, 1.0, -2.5);
    scene3d.curOrbit.target.set(8.5, 1.0, -2.5);
    scene3d.targetOrbit.azimuth = -0.55;
    scene3d.curOrbit.azimuth = -0.55;
    scene3d.targetOrbit.polar = 1.08;
    scene3d.curOrbit.polar = 1.08;
    scene3d.targetOrbit.radius = 11.5;
    scene3d.curOrbit.radius = 11.5;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(150);
  await snap('shot_closeup_street_actors.png');

  // Close-up 2: NVH Sinh Viên, Nhà Điều Hành ĐHQG & Hồ Đá Quarry Cliffs
  await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.targetOrbit.target.set(6.0, 1.8, -12.5);
    scene3d.curOrbit.target.set(6.0, 1.8, -12.5);
    scene3d.targetOrbit.azimuth = 0.52;
    scene3d.curOrbit.azimuth = 0.52;
    scene3d.targetOrbit.polar = 0.92;
    scene3d.curOrbit.polar = 0.92;
    scene3d.targetOrbit.radius = 21.0;
    scene3d.curOrbit.radius = 21.0;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(150);
  await snap('shot_closeup_landmarks.png');

  // Close-up 3: Ga Metro Số 1 + Hitachi 5-Car Train + Bến Xe Buýt 08/33
  await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.metroCycle = 7.5;
    scene3d.targetOrbit.target.set(0.0, 2.6, 13.0);
    scene3d.curOrbit.target.set(0.0, 2.6, 13.0);
    scene3d.targetOrbit.azimuth = 0.58;
    scene3d.curOrbit.azimuth = 0.58;
    scene3d.targetOrbit.polar = 0.95;
    scene3d.curOrbit.polar = 0.95;
    scene3d.targetOrbit.radius = 17.5;
    scene3d.curOrbit.radius = 17.5;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(150);
  await snap('shot_closeup_metro_bus.png');

  // Close-up 4: Hồ Đá Quarry Lake + KTX Khu B + Active Football Pitch
  await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.targetOrbit.target.set(25.5, 1.0, -2.0);
    scene3d.curOrbit.target.set(25.5, 1.0, -2.0);
    scene3d.targetOrbit.azimuth = -0.45;
    scene3d.curOrbit.azimuth = -0.45;
    scene3d.targetOrbit.polar = 0.86;
    scene3d.curOrbit.polar = 0.86;
    scene3d.targetOrbit.radius = 24.0;
    scene3d.curOrbit.radius = 24.0;
    scene3d.update(gameState, 0.016);
  })()`);
  await sleep(150);
  await snap('shot_closeup_hoda_ktxb.png');

  // Sunset Showcase Shot
  await evaluate(`(() => {
    const { scene3d, gameState, toggleTimeOfDay, updateHud } = window.__campusApp;
    document.getElementById('world-labels').classList.remove('hidden');
    document.getElementById('hud-top').classList.remove('hidden');
    document.getElementById('hud-bottom').classList.remove('hidden');
    if (updateHud) updateHud();
    toggleTimeOfDay();
    scene3d.resetCamera();
    scene3d.curOrbit.azimuth = 0.45;
    scene3d.targetOrbit.azimuth = 0.45;
    scene3d.curOrbit.polar = 0.78;
    scene3d.targetOrbit.polar = 0.78;
    scene3d.curOrbit.radius = 35.5;
    scene3d.targetOrbit.radius = 35.5;
    scene3d.curOrbit.target.set(0, 0.6, 0.5);
    scene3d.targetOrbit.target.set(0, 0.6, 0.5);
    for (let i = 0; i < 30; i++) scene3d.update(gameState, 0.05);
  })()`);
  await sleep(200);
  await snap('shot_s3_sunset.png');

  // Capture UI Theory Typography & Upgrade FX Showcase Shots when --screenshots is passed
  if (captureShapes) {
    await evaluate(`(() => {
      const { enterStage, scene3d, gameState } = window.__campusApp;
      if (scene3d.timeOfDay === 'sunset') window.__campusApp.toggleTimeOfDay();
      enterStage(3, false);
      // Click housing lot & upgrade to XHCN via actual UI button to trigger shockwave, beam, floaters & toast!
      document.querySelector('[data-lot-pin="housing"]').click();
      document.querySelector('[data-choice-variant="xhcn"]').click();
      for (let i = 0; i < 6; i++) scene3d.update(gameState, 0.04);
    })()`);
    await sleep(180);
    await snap('shot_upgrade_fx_toast.png');

    await evaluate(`(() => {
      window.__campusApp.showSummaryScreen(true);
    })()`);
    await sleep(180);
    await snap('shot_ui_summary_theory.png');

    await evaluate(`(() => {
      document.getElementById('btn-open-review').click();
    })()`);
    await sleep(180);
    await snap('shot_ui_review_modal.png');
    await evaluate(`document.getElementById('btn-close-review').click();`);
  }

  // 5. Stage-Switching GPU Memory Leak Stress Check (10 full cycles across all lot variants)
  const leakCheck = await evaluate(`(() => {
    const { scene3d, enterStage, showSummaryScreen, gameState } = window.__campusApp;
    const lotIds = ['jobs', 'housing', 'food', 'transit', 'study', 'welfare'];
    // Warm up every cached lot variant once (baocap/fenced, private, empty, state, xhcn)
    enterStage(1, false);
    scene3d.update(gameState, 0.016);
    enterStage(2, false);
    scene3d.update(gameState, 0.016);
    enterStage(3, false);
    scene3d.update(gameState, 0.016);
    for (const variant of ['state', 'private', 'xhcn']) {
      gameState.baseMetrics.budget = 600;
      for (const l of lotIds) {
        gameState.applyLotChoice(l, variant);
        if (gameState.pendingEvent) gameState.chooseEvent(gameState.pendingEvent.id, 'B');
      }
      scene3d.syncWithGameState(gameState);
      scene3d.update(gameState, 0.016);
    }
    const before = { ...scene3d.renderer.info.memory };
    for (let c = 0; c < 10; c++) {
      enterStage(1, false);
      scene3d.update(gameState, 0.016);
      enterStage(2, false);
      scene3d.update(gameState, 0.016);
      enterStage(3, false);
      gameState.baseMetrics.budget = 600;
      for (const l of lotIds) {
        gameState.applyLotChoice(l, c % 2 === 0 ? 'state' : 'xhcn');
        if (gameState.pendingEvent) gameState.chooseEvent(gameState.pendingEvent.id, 'B');
      }
      scene3d.syncWithGameState(gameState);
      scene3d.update(gameState, 0.016);
      showSummaryScreen(false);
      scene3d.update(gameState, 0.016);
    }
    const after = { ...scene3d.renderer.info.memory };
    return {
      cachedLotVariants: scene3d.lotModelCache ? scene3d.lotModelCache.size : 0,
      before,
      after,
      leakedGeometries: after.geometries - before.geometries,
      leakedTextures: after.textures - before.textures
    };
  })()`);
  console.log('Stage-Switching Memory Leak Check:', leakCheck);
  assert.equal(leakCheck.leakedGeometries, 0, `Expected 0 leaked geometries across 10 stage cycles, got ${leakCheck.leakedGeometries}`);
  assert.equal(leakCheck.leakedTextures, 0, `Expected 0 leaked textures across 10 stage cycles, got ${leakCheck.leakedTextures}`);

  // 5. Mobile Portrait Viewport Check (390 x 844) — Verify responsive camera & zero horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(250);
  const mobileCheck = await evaluate(`(() => {
    const { scene3d, gameState } = window.__campusApp;
    scene3d.resize();
    scene3d.update(gameState, 0.016);
    const s1Labels = Array.from(document.querySelectorAll('.lot-pin')).map((el) => el.textContent);
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      mobileRadius: scene3d.defaultOrbit.radius,
      pinCount: s1Labels.length
    };
  })()`);
  console.log('Mobile Portrait Viewport Check:', mobileCheck);
  assert.equal(mobileCheck.overflowX, false, 'Should have zero horizontal scroll overflow on 390px mobile');
  assert.ok(mobileCheck.mobileRadius > 45, 'Mobile portrait camera should pull back cleanly to frame campus');

  assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
  assert.equal(pageExceptions.length, 0, `Unexpected page exceptions: ${pageExceptions.join('; ')}`);

  console.log('PASS: All Headless Edge WebGL 3D, Historical Era & Anti-Glare checks succeeded!');
} finally {
  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  browser.kill();
  await sleep(300);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup race
  }
}
