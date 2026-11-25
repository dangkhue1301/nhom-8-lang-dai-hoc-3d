import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { LOTS } from './data.js';
import {
  createAmbulanceVanMesh,
  createDetailedPerson
} from './actors3d.js';
import {
  addBalconyBay,
  addBougainvilleaPlanter,
  addContactShadow,
  addFairyLightGarland,
  addFireHydrant,
  addFlagpole,
  addInoxWaterTank,
  addManholeAndGrates,
  addModernAvenueLamp,
  addParkBench,
  addParkedBikesRow,
  addPlasticStool,
  addPublicTrashBin,
  addRoadSign,
  addSolarArray,
  addStreetDiningSet,
  addTowerCrane,
  addTrafficLight,
  addUtilityPole,
  createInstancedNature,
  createTropicalTree,
  getFoliageMat
} from './archDetails.js';
import {
  createCrispSignMaterial,
  createStreetSignMaterial,
  getAsphaltMaps,
  getBaoCapPadMaps,
  getBrickWallMaps,
  getCorrugatedTinMaps,
  getDormFacadeMaps,
  getGlassCurtainMaps,
  getGrassMaps,
  getLakeWaterGradientTexture,
  getLateriteRoadMaps,
  getRockCliffMaps,
  getSidewalkMaps,
  getSportsFieldTexture,
  getStandardMaterial,
  getStripedAwningTexture,
  getStuccoMaps,
  getTactilePavingTexture,
  getTerracottaRoofMaps,
  getWaterBumpMap,
  getWoodPlankMaps,
  optimizeStaticSubtree
} from './textures.js';

function makeStdMat(color, roughness = 0.68, metalness = 0.05, extra = {}) {
  return getStandardMaterial(color, roughness, metalness, extra);
}

function addRoundedBox(parent, w, h, d, x, y, z, mat, r = 0.06, cast = true, receive = true) {
  const minDim = Math.min(w, h, d);
  const maxDim = Math.max(w, h, d);
  const rad = Math.min(r, minDim * 0.42);
  const segs = minDim >= 0.42 && maxDim >= 1.4 ? 2 : 1;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segs, rad), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, w, h, d, x, y, z, mat, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function createGableRoof(width, height, depth, roofMat) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1
  });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, roofMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const SIGN_FACE_GEO = new THREE.PlaneGeometry(1, 1);

function addSignBoard(parent, w, h, x, y, z, text, bgColor, textColor = '#f1f5f9', borderColor = '#eab308', opts = null) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const backMat = makeStdMat(0x1e293b, 0.65, 0.2);
  const strutMat = makeStdMat(0x334155, 0.45, 0.68);
  const frontMat = createCrispSignMaterial(text, bgColor, textColor, borderColor);

  const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.13, 1, 0.035), backMat);
  frame.castShadow = true;
  frame.receiveShadow = true;
  grp.add(frame);

  const fPlane = new THREE.Mesh(SIGN_FACE_GEO, frontMat);
  fPlane.scale.set(w - 0.04, h - 0.04, 1);
  fPlane.position.z = 0.068;

  const bPlane = new THREE.Mesh(SIGN_FACE_GEO, frontMat);
  bPlane.scale.set(w - 0.04, h - 0.04, 1);
  bPlane.rotation.y = Math.PI;
  bPlane.position.z = -0.068;

  grp.add(fPlane, bPlane);

  if (opts && opts.struts) {
    const sh = opts.struts;
    const span = opts.strutSpan ?? Math.min(w * 0.36, 1.75);
    const shiftX = opts.strutShiftX ?? 0;
    for (const sx of [-span, span]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.085, sh, 0.085), strutMat);
      post.position.set(shiftX + sx, -h * 0.5 - sh * 0.5 + 0.04, opts.strutZ ?? 0);
      post.castShadow = true;
      grp.add(post);
    }
  }

  parent.add(grp);
  return grp;
}

function makeGlassMat(tintHex, warmInterior, cols, rows, glowList = null) {
  const gMaps = getGlassCurtainMaps(tintHex, warmInterior, cols, rows);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.36,
    map: gMaps.map,
    roughnessMap: gMaps.roughnessMap,
    bumpMap: gMaps.bumpMap,
    bumpScale: 0.03,
    emissive: new THREE.Color(warmInterior ? 0xffffff : 0x38bdf8),
    emissiveMap: gMaps.emissiveMap,
    emissiveIntensity: warmInterior ? 0.18 : 0.08
  });
  if (glowList) glowList.push(mat);
  return mat;
}

function makeDormMat(wallHex, accentHex, cols, rows, glowList = null) {
  const dMaps = getDormFacadeMaps(wallHex, accentHex, cols, rows);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.06,
    map: dMaps.map,
    bumpMap: dMaps.bumpMap,
    bumpScale: 0.045,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: dMaps.emissiveMap,
    emissiveIntensity: 0.16
  });
  if (glowList) glowList.push(mat);
  return mat;
}

// Organic terrain height function: flat graded campus plateau, sunken Hồ Đá basin, rolling Thủ Đức hills
export function getTerrainHeight(x, z) {
  const lakeDist = Math.hypot(x - 26.5, z + 10.8);
  if (lakeDist < 7.5) {
    // Steep deep quarry basin so emerald lake water fills cleanly to the rocky shore!
    if (lakeDist < 5.9) return -2.2;
    const t = (7.5 - lakeDist) / 1.6;
    return -2.2 * t * t;
  }

  const dx = Math.max(0, Math.abs(x) - 31);
  const dz = Math.max(0, Math.abs(z) - 24);
  const distOut = Math.hypot(dx, dz);
  if (distOut <= 0.1) return 0;

  const hill =
    Math.sin(x * 0.075) * Math.cos(z * 0.085) * 1.4 +
    Math.sin(x * 0.04 + z * 0.05) * 2.2 +
    2.4;
  return Math.min(6.8, hill * Math.min(1, distOut / 18));
}

function isBlockedForNature(x, z) {
  if (Math.abs(z) < 4.8 && Math.abs(x) < 38) return true;
  if (Math.abs(x) < 4.5 && z > -26 && z < 16) return true;
  if (z > 13.8 && z < 25.0 && Math.abs(x) < 40) return true;
  if (Math.hypot(x, z) < 6.6) return true;
  if (Math.hypot(x - 26.5, z + 10.8) < 8.6) return true;
  if (Math.abs(x) < 10 && z < -16.5 && z > -27) return true;
  if (x < -19 && x > -32 && Math.abs(z - 8.8) < 4.8) return true;
  if (x > 19 && x < 34 && Math.abs(z - 8.6) < 6.4) return true;
  if (x < -19 && x > -32 && z < -9 && z > -18) return true;
  // Keep park walkways clear of grass tufts
  if (x > 16.5 && x < 23.8 && z > -7.2 && z < -3.6) return true;
  if (Math.abs(x - -25.8) < 1.8 && z > -10 && z < 6) return true;
  if (Math.abs(x - 25.8) < 1.8 && z > 2.5 && z < 9) return true;

  for (const lot of LOTS) {
    if (Math.abs(x - lot.pos.x) < 5.2 && Math.abs(z - lot.pos.z) < 4.6) return true;
  }
  return false;
}

export function createCampusEnvironment() {
  const env = new THREE.Group();
  const swayingCanopies = [];
  const streetLampBulbs = [];
  const trafficSignals = [];
  const flagMeshes = [];
  const envGlowMats = [];
  const sportsActors = { basketballPlayers: [], basketball: null, footballPlayers: [], football: null };

  // Historical Era Containers
  const baocapGroup = new THREE.Group(); // Stage 1 ONLY (pre-1986 Bao cấp — zero Metro, laterite roads, classic vôi-vàng halls)
  const modernBaseGroup = new THREE.Group(); // Stage 2 & 3 (modern asphalt, ĐHQG landmarks, active courts)
  const thaNoiGroup = new THREE.Group(); // Stage 2 ONLY (tangled black telecom street wires)
  const metroConstructionGroup = new THREE.Group(); // Stage 2 + Stage 3 when transit !== 'xhcn' (stalled Metro piers, crane & barricades)
  const s3AvenueGroup = new THREE.Group(); // Stage 3 + Showcase (Smart Solar LED avenue streetlamps & sorting bins)
  const xhcnInfraGroup = new THREE.Group(); // Stage 3 when transit === 'xhcn' + Showcase (completed Metro Line 1 + Ga ĐHQG + Skybridge)
  env.add(baocapGroup, modernBaseGroup, thaNoiGroup, metroConstructionGroup, s3AvenueGroup, xhcnInfraGroup);

  // 1. Displaced Undulating Campus & Horizon Terrain Mesh (176 x 176)
  const terrainGeo = new THREE.PlaneGeometry(176, 176, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cVal = new THREE.Color();

  for (let i = 0; i < posAttr.count; i += 1) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);

    if (vy < -0.2) {
      cVal.setHex(0x4a4642); // Deep quarry stone inside Hồ Đá
    } else if (vy > 2.2) {
      cVal.setHex(0x6d9942); // Natural upland olive-green hills (grounded, never neon!)
    } else {
      cVal.setHex(0xdbe2d5); // Grounded lawn tint multiplied by rich grass texture
    }
    colors[i * 3] = cVal.r;
    colors[i * 3 + 1] = cVal.g;
    colors[i * 3 + 2] = cVal.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const grassMaps = getGrassMaps(24, 24);
  const terrainMat = makeStdMat(0xffffff, 0.92, 0.0, {
    map: grassMaps.map,
    bumpMap: grassMaps.bumpMap,
    bumpScale: 0.08,
    vertexColors: true
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  env.add(terrainMesh);

  // Shared Roof & Wall Materials
  const roofMaps = getTerracottaRoofMaps(4, 2, false);
  const tileMat = makeStdMat(0xffffff, 0.72, 0.04, { map: roofMaps.map, bumpMap: roofMaps.bumpMap, bumpScale: 0.08 });
  const oldRoofMaps = getTerracottaRoofMaps(4, 2, true);
  const oldTileMat = makeStdMat(0xffffff, 0.82, 0.02, {
    map: oldRoofMaps.map,
    bumpMap: oldRoofMaps.bumpMap,
    bumpScale: 0.09
  });
  const oldOchreStucco = getStuccoMaps('#d4bd87', true);
  const oldOchreWall = makeStdMat(0xffffff, 0.88, 0.0, {
    map: oldOchreStucco.map,
    bumpMap: oldOchreStucco.bumpMap,
    bumpScale: 0.045
  });

  // ==========================================================================
  // 2A. CHẶNG 1 (THỜI BAO CẤP) ROADS & HISTORIC LANDMARKS — ZERO METRO!
  // ==========================================================================
  const latMain = getLateriteRoadMaps(14, 2);
  const latMatMain = makeStdMat(0xffffff, 0.92, 0.02, {
    map: latMain.map,
    bumpMap: latMain.bumpMap,
    roughnessMap: latMain.roughnessMap,
    bumpScale: 0.05
  });
  const latNS = getLateriteRoadMaps(2, 9, true);
  const latMatNS = makeStdMat(0xffffff, 0.92, 0.02, {
    map: latNS.map,
    bumpMap: latNS.bumpMap,
    roughnessMap: latNS.roughnessMap,
    bumpScale: 0.05
  });
  const dirtWalkMat = makeStdMat(0x8c7358, 0.94, 0.0);

  // Weathered laterite/tar roads in Bao cấp (N-S road cleanly terminates at lot forecourts instead of cutting under fenced lots!)
  addBox(baocapGroup, 74, 0.11, 7.6, 0, 0.055, 0, dirtWalkMat, false, true);
  addBox(baocapGroup, 74, 0.08, 4.8, 0, 0.105, 0, latMatMain, false, true);
  addBox(baocapGroup, 6.8, 0.1, 12.2, 0, 0.05, -0.4, dirtWalkMat, false, true);
  addBox(baocapGroup, 4.2, 0.08, 12.2, 0, 0.1, -0.4, latMatNS, false, true);
  addBox(baocapGroup, 7.6, 0.09, 5.8, 0, 0.05, -16.3, dirtWalkMat, false, true);
  // Old 2-lane Biên Hòa highway at z = 21.8 (no Metro corridor!)
  addBox(baocapGroup, 76, 0.09, 4.6, 0, 0.075, 21.8, latMatMain, false, true);

  // Rural trees along z = 16.5 in Stage 1 where Metro doesn't exist yet!
  for (const rx of [-26, -16, -6, 6, 16, 26]) {
    const rt = createTropicalTree(rx % 12 === 0 ? 'phuong' : 'saoden', 1.08, swayingCanopies, { whitewash: false });
    rt.position.set(rx, 0.04, 16.5 + (rx % 3) * 0.4);
    baocapGroup.add(rt);
  }

  // Bao cấp Central Roundabout: Radial packed-laterite surface (warm natural tone matching red-laterite avenue!)
  const bcRound = new THREE.Group();
  const bcPadMaps = getBaoCapPadMaps(3, 3);
  const bcRoundRoadMat = makeStdMat(0xd8cbb8, 0.92, 0.02, {
    map: bcPadMaps.map,
    bumpMap: bcPadMaps.bumpMap,
    bumpScale: 0.05
  });
  const bcRing = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.11, 32), bcRoundRoadMat);
  bcRing.position.y = 0.105;
  bcRing.receiveShadow = true;
  bcRound.add(bcRing);
  const bcIsland = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.8, 0.26, 24),
    makeStdMat(0x8f3112, 0.88, 0, { map: getBrickWallMaps('#8f3112').map })
  );
  bcIsland.position.y = 0.2;
  bcRound.add(bcIsland);
  const bcGrass = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.29, 24), makeStdMat(0x366824, 0.9));
  bcGrass.position.y = 0.22;
  bcRound.add(bcGrass);
  addRoundedBox(bcRound, 0.95, 2.5, 0.95, 0, 1.45, 0, oldOchreWall, 0.04);
  addRoundedBox(bcRound, 1.15, 0.22, 1.15, 0, 2.75, 0, makeStdMat(0x991b1b, 0.7), 0.03);
  addSignBoard(bcRound, 2.1, 0.56, 0, 1.8, 0.52, 'THI ĐUA HỌC TẬP', '#991b1b', '#fde047', '#f59e0b');
  for (let h = 0; h < 4; h += 1) {
    const ha = (h * Math.PI) / 2;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10, 1, true), makeStdMat(0x94a3b8, 0.45, 0.65));
    horn.position.set(Math.cos(ha) * 0.34, 3.05, Math.sin(ha) * 0.34);
    horn.rotation.z = -Math.cos(ha) * 1.1;
    horn.rotation.x = Math.sin(ha) * 1.1;
    bcRound.add(horn);
  }
  baocapGroup.add(bcRound);

  // Bao cấp West Gate ("KHU ĐẠI HỌC THỦ ĐỨC")
  const bcGate = new THREE.Group();
  bcGate.position.set(-25.8, 0.08, 0);
  const bcBrick = makeStdMat(0xffffff, 0.88, 0, { map: getBrickWallMaps('#8f3112').map });
  for (const gz of [-3.3, 3.3]) {
    addRoundedBox(bcGate, 1.1, 3.6, 1.1, 0, 1.8, gz, bcBrick, 0.04);
    addRoundedBox(bcGate, 1.3, 0.24, 1.3, 0, 3.7, gz, oldOchreWall, 0.03);
  }
  addBox(bcGate, 0.45, 0.72, 7.6, 0, 4.1, 0, oldOchreWall);
  const bcGateSign = addSignBoard(bcGate, 5.8, 0.76, 0.28, 4.1, 0, 'KHU ĐẠI HỌC THỦ ĐỨC', '#7f1d1d', '#fef08a', '#d97706');
  bcGateSign.rotation.y = Math.PI / 2;
  baocapGroup.add(bcGate);

  // Bao cấp North Hall ("BAN QUẢN LÝ & HỘI TRƯỜNG CŨ")
  const bcAdmin = new THREE.Group();
  bcAdmin.position.set(0, 0.08, -22.2);
  addContactShadow(bcAdmin, 14, 6.5, 0, 0.03, 0);
  addRoundedBox(bcAdmin, 12.2, 3.2, 4.2, 0, 1.6, 0, oldOchreWall, 0.06);
  const bcAdminRoof = createGableRoof(13.0, 1.45, 4.8, oldTileMat);
  bcAdminRoof.position.set(0, 3.2, 0);
  bcAdmin.add(bcAdminRoof);
  const greenShutter = makeStdMat(0x14532d, 0.8);
  const bcWarmGlow = makeStdMat(0xfde68a, 0.55, 0.02, { emissive: 0xd97706, emissiveIntensity: 0.14 });
  envGlowMats.push(bcWarmGlow);
  for (let r = 0; r < 2; r += 1) {
    for (let c = -4; c <= 4; c += 1) {
      if (r === 0 && Math.abs(c) <= 1) continue;
      addBox(bcAdmin, 0.62, 0.78, 0.1, c * 1.22, 0.95 + r * 1.35, 2.12, greenShutter);
      if ((c + r) % 2 === 0) {
        addBox(bcAdmin, 0.44, 0.58, 0.12, c * 1.22, 0.95 + r * 1.35, 2.13, bcWarmGlow);
      }
    }
  }
  addBox(bcAdmin, 2.4, 1.35, 0.12, 0, 0.75, 2.12, makeStdMat(0x5c2e0e, 0.82));
  addSignBoard(bcAdmin, 6.4, 0.76, 0, 3.55, 2.45, 'HỘI TRƯỜNG · DẠY TỐT HỌC TỐT', '#881b1b', '#fef08a', '#d97706');
  baocapGroup.add(bcAdmin);

  // Bao cấp North-West Old Lecture Hall + Dirt Yard
  const bcLecture = new THREE.Group();
  bcLecture.position.set(-25.8, 0.08, -13.5);
  addContactShadow(bcLecture, 10, 6, 0, 0.03, 0);
  addRoundedBox(bcLecture, 8.6, 2.9, 4.0, 0, 1.45, 0, oldOchreWall, 0.05);
  const bcLecRoof = createGableRoof(9.2, 1.25, 4.5, oldTileMat);
  bcLecRoof.position.set(0, 2.9, 0);
  bcLecture.add(bcLecRoof);
  for (let c = -3; c <= 3; c += 1) {
    addBox(bcLecture, 0.58, 0.72, 0.1, c * 1.1, 1.0, 2.02, greenShutter);
    addBox(bcLecture, 0.58, 0.72, 0.1, c * 1.1, 2.15, 2.02, greenShutter);
  }
  addSignBoard(bcLecture, 4.8, 0.72, 0, 3.25, 2.3, 'GIẢNG ĐƯỜNG KỸ THUẬT', '#78350f', '#fef3c7', '#d97706');
  baocapGroup.add(bcLecture);

  // Bao cấp Dirt Volleyball Yard at (-25.8, 8.8)
  const bcVolley = new THREE.Group();
  bcVolley.position.set(-25.8, 0.06, 8.8);
  addRoundedBox(bcVolley, 8.4, 0.1, 5.2, 0, 0.05, 0, dirtWalkMat, 0.04, false, true);
  for (const vz of [-2.1, 2.1]) {
    addBox(bcVolley, 0.1, 2.1, 0.1, 0, 1.05, vz, makeStdMat(0x5c3a21, 0.85));
  }
  addBox(bcVolley, 0.04, 0.65, 4.1, 0, 1.65, 0, makeStdMat(0xd6d0c4, 0.85, 0, { transparent: true, opacity: 0.7 }));
  baocapGroup.add(bcVolley);

  // Bao cấp South-East Collective Staff Dormitory ("KHU TẬP THỂ CÁN BỘ")
  const bcDormB = new THREE.Group();
  bcDormB.position.set(27.0, 0.08, 6.2);
  addContactShadow(bcDormB, 8.8, 4.4, 0, 0.03, 0);
  addRoundedBox(bcDormB, 7.6, 2.2, 3.4, 0, 1.1, 0, oldOchreWall, 0.05);
  const bcDormRoof = createGableRoof(8.2, 1.05, 3.9, oldTileMat);
  bcDormRoof.position.set(0, 2.2, 0);
  bcDormB.add(bcDormRoof);
  for (let c = -2; c <= 2; c += 1) {
    addBox(bcDormB, 0.56, 0.7, 0.1, c * 1.35, 1.05, 1.72, greenShutter);
  }
  addParkedBikesRow(bcDormB, -1.8, 2.4, 3, 0, 'baocap');
  addSignBoard(bcDormB, 4.6, 0.7, 0, 2.55, 2.0, 'KHU TẬP THỂ CÁN BỘ', '#78350f', '#fef3c7', '#d97706');
  baocapGroup.add(bcDormB);

  // Bao cấp concrete loudspeaker poles along avenues
  for (const px of [-19.5, -10.5, 10.5, 19.5]) {
    addUtilityPole(baocapGroup, px, -3.1, 'baocap');
    addUtilityPole(baocapGroup, px, 20.0, 'baocap');
  }

  // ==========================================================================
  // 2B. MODERN BASE WORLD (STAGE 2 & STAGE 3): ASPHALT AVENUES & ĐHQG LANDMARKS
  // ==========================================================================
  const asphaltMain = getAsphaltMaps(16, 2);
  const roadMatMain = makeStdMat(0xffffff, 0.82, 0.05, {
    map: asphaltMain.map,
    bumpMap: asphaltMain.bumpMap,
    bumpScale: 0.035,
    roughnessMap: asphaltMain.roughnessMap
  });
  const asphaltNS = getAsphaltMaps(2, 10);
  const roadMatNS = makeStdMat(0xffffff, 0.82, 0.05, {
    map: asphaltNS.map,
    bumpMap: asphaltNS.bumpMap,
    bumpScale: 0.035,
    roughnessMap: asphaltNS.roughnessMap
  });

  const walkMaps = getSidewalkMaps(22, 2);
  const walkMat = makeStdMat(0xffffff, 0.84, 0.03, {
    map: walkMaps.map,
    bumpMap: walkMaps.bumpMap,
    bumpScale: 0.04
  });
  const curbMat = makeStdMat(0x949da8, 0.78, 0.04);
  const stripeMat = makeStdMat(0xcfd6de, 0.55, 0);
  const yellowTactileMat = makeStdMat(0xffffff, 0.75, 0.02, { map: getTactilePavingTexture(22, 1) });

  // Đại lộ Tạ Quang Bửu (z = 0) — 9.4m wide promenade so trees/lamps never block walking lanes!
  addBox(modernBaseGroup, 74, 0.12, 9.4, 0, 0.06, 0, walkMat, false, true);
  addBox(modernBaseGroup, 74, 0.08, 5.2, 0, 0.11, 0, roadMatMain, false, true);
  addBox(modernBaseGroup, 74, 0.14, 0.22, 0, 0.13, -2.65, curbMat, false, true);
  addBox(modernBaseGroup, 74, 0.14, 0.22, 0, 0.13, 2.65, curbMat, false, true);
  // Tactile yellow blind-guiding sidewalk strips along curb!
  addBox(modernBaseGroup, 62, 0.015, 0.24, 0, 0.13, -2.96, yellowTactileMat, false, true);
  addBox(modernBaseGroup, 62, 0.015, 0.24, 0, 0.13, 2.96, yellowTactileMat, false, true);

  for (let x = -34; x <= 34; x += 3.0) {
    if (Math.abs(x) < 6.2) continue;
    addBox(modernBaseGroup, 1.45, 0.02, 0.13, x, 0.155, 0, stripeMat, false, false);
  }

  // Đường Mạc Đĩnh Chi approach stems (z ∈ [-6.6, +5.8]) + Flagpole Ceremonial Granite Forecourt (z ∈ [-18.8, -13.3])
  addBox(modernBaseGroup, 7.8, 0.11, 12.4, 0, 0.055, -0.4, walkMat, false, true);
  addBox(modernBaseGroup, 4.6, 0.08, 12.4, 0, 0.1, -0.4, roadMatNS, false, true);
  addBox(modernBaseGroup, 9.2, 0.1, 5.6, 0, 0.05, -16.1, walkMat, false, true);

  // Paved Stone Campus Garden Footpaths connecting avenues to Lots, Hồ Đá & Sports Courts!
  const pathMaps = getSidewalkMaps(4, 2);
  const pathMat = makeStdMat(0xffffff, 0.86, 0.02, { map: pathMaps.map, bumpMap: pathMaps.bumpMap, bumpScale: 0.03 });
  const nsPathMaps = getSidewalkMaps(2, 10);
  const nsPathMat = makeStdMat(0xffffff, 0.86, 0.02, {
    map: nsPathMaps.map,
    bumpMap: nsPathMaps.bumpMap,
    bumpScale: 0.03
  });
  for (const sideX of [-5.15, 5.15]) {
    addBox(modernBaseGroup, 1.5, 0.06, 29.0, sideX, 0.035, -3.0, nsPathMat, false, true);
  }
  for (const lx of [-13.0, 13.0]) {
    addBox(modernBaseGroup, 2.2, 0.06, 2.4, lx, 0.035, -4.8, pathMat, false, true);
    addBox(modernBaseGroup, 2.2, 0.06, 2.2, lx, 0.035, 4.6, pathMat, false, true);
  }
  addBox(modernBaseGroup, 6.4, 0.06, 1.7, 20.2, 0.035, -5.2, pathMat, false, true); // Promenade path to Hồ Đá
  addBox(modernBaseGroup, 1.8, 0.06, 7.6, -25.8, 0.035, -7.2, pathMat, false, true); // Path to Cụm BK-UIT
  addBox(modernBaseGroup, 1.8, 0.06, 4.2, -25.8, 0.035, 5.2, pathMat, false, true); // Path to Sân bóng rổ
  addBox(modernBaseGroup, 1.8, 0.06, 5.8, 25.8, 0.035, 5.8, pathMat, false, true); // Path to KTX Khu B & Sân bóng đá

  // Xa lộ Hà Nội / Võ Nguyên Giáp Highway (z = 21.8)
  addBox(modernBaseGroup, 76, 0.09, 5.6, 0, 0.075, 21.8, roadMatMain, false, true);
  addBox(modernBaseGroup, 76, 0.26, 0.26, 0, 0.2, 21.8, curbMat, true, true); // Concrete highway median Jersey barrier!
  for (let x = -34; x <= 34; x += 3.4) {
    addBox(modernBaseGroup, 1.5, 0.02, 0.12, x, 0.13, 20.4, stripeMat, false, false);
    addBox(modernBaseGroup, 1.5, 0.02, 0.12, x, 0.13, 23.2, stripeMat, false, false);
  }

  // Zebra crosswalks (All 4 arms of Vòng xoay Quảng Trường Sáng Tạo) & Cast-iron Manholes + Storm Grates
  for (const cx of [-6.4, 6.4]) {
    for (let z = -2.1; z <= 2.1; z += 0.65) {
      addBox(modernBaseGroup, 1.35, 0.02, 0.26, cx, 0.156, z, stripeMat, false, false);
    }
  }
  for (const cz of [-5.85, 5.45]) {
    for (let x = -1.8; x <= 1.8; x += 0.6) {
      addBox(modernBaseGroup, 0.26, 0.02, 1.15, x, 0.152, cz, stripeMat, false, false);
    }
  }
  addManholeAndGrates(modernBaseGroup, -8.2, -1.2);
  addManholeAndGrates(modernBaseGroup, 8.4, 1.2);
  addManholeAndGrates(modernBaseGroup, -15.6, 1.2);
  addFireHydrant(modernBaseGroup, -7.6, -4.32);
  addFireHydrant(modernBaseGroup, 7.8, 4.32);
  // Right-hand Vietnamese traffic signs: R.303 Roundabout on approach curbs + I.423a Crosswalk signs!
  addRoadSign(modernBaseGroup, -7.25, 2.84, -Math.PI / 2, 'roundabout');
  addRoadSign(modernBaseGroup, 7.25, -2.84, Math.PI / 2, 'roundabout');
  addRoadSign(modernBaseGroup, -6.95, -2.84, Math.PI / 2, 'crosswalk');
  addRoadSign(modernBaseGroup, 6.95, 2.84, -Math.PI / 2, 'crosswalk');

  // Vòng xoay Quảng Trường Sáng Tạo (Modern ĐHQG Spire + Concentric Gardens)
  const roundabout = new THREE.Group();
  const ringAsph = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.11, 40), roadMatMain);
  ringAsph.position.y = 0.105;
  ringAsph.receiveShadow = true;
  roundabout.add(ringAsph);

  const plazaIsland = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.26, 36), makeStdMat(0x9ba3ae, 0.72));
  plazaIsland.position.y = 0.21;
  plazaIsland.receiveShadow = true;
  roundabout.add(plazaIsland);

  const flowerBed = new THREE.Mesh(new THREE.CylinderGeometry(2.48, 2.48, 0.29, 32), makeStdMat(0x2b6224, 0.85));
  flowerBed.position.y = 0.23;
  roundabout.add(flowerBed);

  // Concentric red/gold flower ring inside roundabout
  const bloomRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.22, 8, 24), makeStdMat(0xb91c1c, 0.8));
  bloomRing.rotation.x = Math.PI / 2;
  bloomRing.position.y = 0.36;
  roundabout.add(bloomRing);

  // Grounded Brushed-Steel & Blue-Granite ĐHQG Spire (no blinding white!)
  const monumentBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.45, 8), makeStdMat(0x334155, 0.5, 0.4));
  monumentBase.position.y = 0.52;
  roundabout.add(monumentBase);

  const monumentMat = makeStdMat(0xbcc6d2, 0.34, 0.58);
  const blueFinMat = makeStdMat(0x0369a1, 0.32, 0.45);
  for (let i = 0; i < 3; i += 1) {
    const ang = (i * Math.PI * 2) / 3;
    const fin = addRoundedBox(roundabout, 0.24, 2.75, 0.7, 0, 0, 0, monumentMat, 0.05);
    fin.position.set(Math.cos(ang) * 0.58, 1.82, Math.sin(ang) * 0.58);
    fin.rotation.set(0, -ang, 0.18);
    const accent = addBox(roundabout, 0.1, 2.2, 0.24, Math.cos(ang) * 0.78, 1.65, Math.sin(ang) * 0.78, blueFinMat);
    accent.rotation.set(0, -ang, 0.18);
  }
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    makeStdMat(0xd97706, 0.26, 0.78, { emissive: 0xb45309, emissiveIntensity: 0.18 })
  );
  orb.position.y = 3.25;
  orb.castShadow = true;
  roundabout.add(orb);
  modernBaseGroup.add(roundabout);

  addTrafficLight(modernBaseGroup, -5.0, -2.92, 0, trafficSignals, 0);
  addTrafficLight(modernBaseGroup, 5.0, 2.92, Math.PI, trafficSignals, 0);
  addTrafficLight(modernBaseGroup, -5.0, 2.92, Math.PI / 2, trafficSignals, 0.5);
  addTrafficLight(modernBaseGroup, 5.0, -2.92, -Math.PI / 2, trafficSignals, 0.5);

  // Landmark A: Cổng Chào Khu Đô Thị ĐHQG-HCM (West Entrance x = -26.0, z = 0)
  const gate = new THREE.Group();
  gate.position.set(-26.0, 0.08, 0);
  const gateStone = makeStdMat(0xffffff, 0.72, 0.05, { map: getStuccoMaps('#cfd6de').map });
  const gateBlue = makeStdMat(0x0369a1, 0.38, 0.3);
  for (const gz of [-3.7, 3.7]) {
    addRoundedBox(gate, 1.5, 0.65, 1.5, 0, 0.32, gz, makeStdMat(0x475569, 0.72), 0.06);
    addRoundedBox(gate, 1.05, 4.5, 1.05, 0, 2.65, gz, gateStone, 0.08);
    addBox(gate, 1.12, 3.2, 0.24, 0, 2.5, gz > 0 ? gz - 0.45 : gz + 0.45, gateBlue);
    // Natural leafy Bougainvillea (Hoa giấy ngũ sắc) planter boxes beside gate pillars
    addBougainvilleaPlanter(gate, 1.35, 0, gz, 1.35, 1.35);
  }
  // Detailed Security Guard Booth (Chốt An Ninh ĐHQG) with framed reflective windows & door
  const boothGlass = makeGlassMat('#0284c7', true, 2, 1, envGlowMats);
  addRoundedBox(gate, 1.55, 2.15, 1.55, 1.6, 1.08, -5.3, gateStone, 0.06);
  addRoundedBox(gate, 1.82, 0.2, 1.82, 1.6, 2.22, -5.3, gateBlue, 0.04);
  addBox(gate, 1.25, 0.78, 1.6, 1.6, 1.34, -5.3, boothGlass);
  addBox(gate, 1.6, 0.78, 1.22, 1.6, 1.34, -5.3, boothGlass);
  addBox(gate, 0.56, 1.65, 0.06, 1.6, 0.85, -4.51, makeStdMat(0x1e3a8a, 0.5));
  // Raised security boom barrier post beside guard booth
  addBox(gate, 0.2, 0.85, 0.2, 1.6, 0.42, -3.5, makeStdMat(0xd97706, 0.5));
  const boom = addBox(gate, 0.07, 1.45, 0.07, 1.6, 1.32, -3.15, makeStdMat(0xdc2626, 0.45));
  boom.rotation.x = 0.52;

  // Modern Cantilevered Span Arch + Double-Sided Welcome Sign (visible entering & leaving!)
  addRoundedBox(gate, 1.35, 0.92, 9.6, 0, 5.05, 0, gateBlue, 0.08);
  addRoundedBox(gate, 1.52, 0.18, 10.0, 0, 5.56, 0, gateStone, 0.05);
  for (const dirX of [-0.72, 0.72]) {
    const gSign = addSignBoard(
      gate,
      7.2,
      0.84,
      dirX,
      5.05,
      0,
      'ĐẠI HỌC QUỐC GIA TP.HCM · LÀNG ĐH',
      '#0c4a6e',
      '#fef08a',
      '#38bdf8'
    );
    gSign.rotation.y = Math.PI / 2;
  }
  modernBaseGroup.add(gate);

  // Landmark B: Tòa Nhà Điều Hành ĐHQG-HCM (North Grand Symmetrical Complex x = 0, z = -22.4)
  const admin = new THREE.Group();
  admin.position.set(0, 0.08, -22.4);
  addContactShadow(admin, 17.5, 8.4, 0, 0.03, 0);
  const adminStone = makeStdMat(0xffffff, 0.68, 0.04, { map: getStuccoMaps('#d2d8df').map });
  const adminBlueTrim = makeStdMat(0x0369a1, 0.38, 0.28);
  const adminGlass = makeGlassMat('#1e4e79', true, 6, 4, envGlowMats);
  const wingGlass = makeGlassMat('#1e4e79', true, 4, 3, envGlowMats);

  // Ceremonial stepped granite podium + grand front approach staircase
  addRoundedBox(admin, 16.4, 0.44, 6.4, 0, 0.22, 0, makeStdMat(0x94a3b8, 0.72), 0.08);
  addRoundedBox(admin, 6.2, 0.28, 1.1, 0, 0.14, 3.45, makeStdMat(0xa3aeb9, 0.72), 0.04);
  addRoundedBox(admin, 5.6, 0.14, 0.7, 0, 0.07, 3.92, makeStdMat(0xb4bec8, 0.72), 0.03);
  // Manicured green parterre hedges flanking forecourt around flagpole
  for (const hx of [-3.6, 3.6]) {
    addRoundedBox(admin, 2.6, 0.26, 1.3, hx, 0.13, 4.7, makeStdMat(0x78716c, 0.82), 0.04);
    addRoundedBox(admin, 2.35, 0.28, 1.05, hx, 0.32, 4.7, makeStdMat(0x28662a, 0.85), 0.08);
  }
  // Central 6-story Command Tower
  addRoundedBox(admin, 6.6, 5.4, 4.6, 0, 2.9, -0.3, adminStone, 0.08);
  addBox(admin, 5.8, 4.4, 4.66, 0, 2.95, -0.3, adminGlass);
  addRoundedBox(admin, 7.0, 0.34, 5.0, 0, 5.72, -0.3, adminBlueTrim, 0.06);
  // Vertical architectural sun-louvre fins on central tower
  for (let lx = -2.5; lx <= 2.5; lx += 1.0) {
    addBox(admin, 0.1, 4.5, 0.24, lx, 2.95, 2.08, adminStone);
  }
  // Symmetrical East & West 4-story Wings with stone parapet cornices
  for (const dir of [-1, 1]) {
    addRoundedBox(admin, 4.6, 3.6, 4.0, dir * 5.3, 2.0, -0.2, adminStone, 0.08);
    addBox(admin, 3.9, 2.7, 4.06, dir * 5.3, 2.05, -0.2, wingGlass);
    addBox(admin, 4.66, 2.7, 3.2, dir * 5.3, 2.05, -0.2, wingGlass);
    addRoundedBox(admin, 4.85, 0.26, 4.25, dir * 5.3, 3.9, -0.2, adminBlueTrim, 0.05);
    addRoundedBox(admin, 4.55, 0.16, 3.95, dir * 5.3, 4.1, -0.2, adminStone, 0.04);
  }
  // Grand Portico Entrance Canopy & Columns
  addRoundedBox(admin, 5.4, 0.24, 2.1, 0, 2.15, 2.65, adminStone, 0.05);
  for (const cx of [-2.1, -0.8, 0.8, 2.1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.75, 12), adminStone);
    col.position.set(cx, 1.25, 3.4);
    col.castShadow = true;
    admin.add(col);
  }
  addSolarArray(admin, 0, 6.02, -0.3, 3.8, 2.2);
  addSignBoard(admin, 7.2, 0.88, 0, 6.28, 2.0, 'NHÀ ĐIỀU HÀNH ĐHQG-HCM', '#991b1b', '#fef08a', '#f59e0b', {
    struts: 0.36
  });
  modernBaseGroup.add(admin);

  // National Flagpole stands proudly in front of North Hall in ALL eras!
  addFlagpole(env, 0, -17.1, flagMeshes);

  // Landmark C: Hồ Đá Làng Đại Học (Angular Fractured Quarry Cliffs + Deep Emerald Basin)
  const lake = new THREE.Group();
  lake.position.set(26.5, 0, -10.8);
  const cliffMaps = getRockCliffMaps(2, 2);
  const cliffMat = makeStdMat(0xffffff, 0.9, 0.04, {
    map: cliffMaps.map,
    bumpMap: cliffMaps.bumpMap,
    bumpScale: 0.18,
    flatShading: true
  });
  const waterBump = getWaterBumpMap();
  const waterUniforms = { uWaterTime: { value: 0 } };
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.16,
    metalness: 0.16,
    map: getLakeWaterGradientTexture(),
    bumpMap: waterBump,
    bumpScale: 0.04,
    emissive: new THREE.Color(0x0b4f56),
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.94
  });
  waterMat.customProgramCacheKey = () => 'hoda-water-fresnel-v1';
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterUniforms.uWaterTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vLakePos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vLakePos = position.xy;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
varying vec2 vLakePos;`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
float wR1 = sin(vLakePos.x * 7.3 + vLakePos.y * 3.1 + uWaterTime * 1.9);
float wR2 = sin(vLakePos.x * -4.7 + vLakePos.y * 8.9 - uWaterTime * 1.55);
float wR3 = sin(vLakePos.x * 11.7 - vLakePos.y * 6.3 + uWaterTime * 2.35) * 0.55;
float wR4 = cos(length(vLakePos) * 5.8 - uWaterTime * 1.25) * 0.45;
vec2 wRipple = vec2(wR1 + wR3 - wR2 * 0.6, wR2 + wR4 + wR1 * 0.5) * 0.009;
normal = normalize(normal + vec3(wRipple, 0.0));`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 macroN = normalize(geometryNormal + vec3(wRipple * 0.35, 0.0));
float fres = pow(1.0 - clamp(dot(macroN, normalize(vViewPosition)), 0.0, 1.0), 3.4);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.44, 0.72, 0.84), fres * 0.22);
#include <dithering_fragment>`
      );
  };
  const lakeWater = new THREE.Mesh(new THREE.CircleGeometry(6.48, 44), waterMat);
  lakeWater.rotation.x = -Math.PI / 2;
  lakeWater.position.y = -0.28;
  lakeWater.receiveShadow = true;
  lake.add(lakeWater);

  // Subtle emerald-jade shallow reef ring near rocky shore
  const foamRing = new THREE.Mesh(
    new THREE.RingGeometry(5.68, 6.36, 36),
    makeStdMat(0x2dd4bf, 0.4, 0, { transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  foamRing.rotation.x = -Math.PI / 2;
  foamRing.position.y = -0.26;
  lake.add(foamRing);

  // Authentic Angular Vertical Fractured Quarry Cliffs & Craggy Rock Ridges (zero flat-topped coasters!)
  const cliffColumns = [
    [-5.4, -3.5, 1.55, 2.05, 1.9, 5, 0.4],
    [-3.4, -5.8, 1.95, 2.55, 2.8, 6, 0.85],
    [-0.4, -6.5, 2.15, 2.85, 3.35, 6, 0.2],
    [2.8, -6.1, 2.0, 2.65, 3.05, 5, 1.05],
    [5.3, -4.2, 1.85, 2.45, 2.6, 6, 0.55],
    [6.4, -1.2, 1.65, 2.15, 2.0, 5, 0.9],
    [6.2, 1.6, 1.4, 1.85, 1.45, 5, 0.3]
  ];
  const cliffLeafDeep = getFoliageMat('#23541f');
  const cliffLeafMid = getFoliageMat('#316b28');
  const cliffLeafSun = getFoliageMat('#4a7f30');
  const scrubGeo = new THREE.IcosahedronGeometry(1, 1);
  const cragGeo = new THREE.DodecahedronGeometry(1, 0);

  for (let idx = 0; idx < cliffColumns.length; idx += 1) {
    const [cx, cz, rTop, rBot, h, sides, rotY] = cliffColumns[idx];
    // Sheer terraced polygonal quarry face with sculpted jagged top rim (zero flat horizontal cylinder caps!)
    const colGeo = new THREE.CylinderGeometry(rTop, rBot, h, sides, 3);
    const cPos = colGeo.attributes.position;
    for (let vi = 0; vi < cPos.count; vi += 1) {
      const vy = cPos.getY(vi);
      const vx = cPos.getX(vi);
      const vz = cPos.getZ(vi);
      if (vy > h * 0.42) {
        const angV = Math.atan2(vz, vx);
        const radFrac = Math.hypot(vx, vz) / Math.max(0.01, rTop);
        const jag =
          radFrac < 0.2
            ? 0.24 + (idx % 3) * 0.1
            : 0.18 * Math.sin(angV * 2 + idx * 1.3) + 0.14 * Math.cos(angV * 3 - idx);
        cPos.setY(vi, vy + jag);
      }
    }
    colGeo.computeVertexNormals();
    const col = new THREE.Mesh(colGeo, cliffMat);
    col.position.set(cx, h * 0.5 - 0.55, cz);
    col.rotation.y = rotY;
    col.castShadow = true;
    col.receiveShadow = true;
    lake.add(col);

    // Stepped lower quarry rock bench along water edge
    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.72, rBot * 0.84, h * 0.52, sides), cliffMat);
    ledge.position.set(cx * 0.83, h * 0.22 - 0.52, cz * 0.83);
    ledge.rotation.y = rotY + 0.5;
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    lake.add(ledge);

    // Jagged fractured rock crown crags breaking up the upper crest!
    const outAng = Math.atan2(cz, cx);
    for (let k = 0; k < 4; k += 1) {
      const a = outAng + (k - 1.5) * 0.82 + idx * 0.35;
      const dist = k === 3 ? rTop * 0.08 : rTop * (0.28 + (k % 2) * 0.22);
      const crag = new THREE.Mesh(cragGeo, cliffMat);
      const sx = rTop * (k === 3 ? 0.56 : 0.5 - k * 0.05);
      const sy = 0.34 + ((idx + k) % 3) * 0.16;
      const sz = rTop * (k === 3 ? 0.48 : 0.44 - k * 0.04);
      crag.scale.set(sx, sy, sz);
      crag.position.set(cx + Math.cos(a) * dist, h - 0.44 + sy * 0.36, cz + Math.sin(a) * dist);
      crag.rotation.set(0.22 * (k - 1), a, -0.18 * ((idx + k) % 2 ? 1 : -1));
      crag.castShadow = true;
      crag.receiveShadow = true;
      lake.add(crag);
    }

    // Organic botanical-textured cliff scrub & wild grass tufts tucked asymmetrically on outer shoulders & crevices!
    const shrubCount = 2 + (idx % 2);
    for (let s = 0; s < shrubCount; s += 1) {
      const sa = outAng + (s - 0.5) * 0.82 + (idx % 3) * 0.18;
      const sr = rTop * (0.48 + s * 0.16);
      const bx = cx + Math.cos(sa) * sr;
      const bz = cz + Math.sin(sa) * sr;
      const bushMat = s === 0 ? cliffLeafDeep : s === 1 ? cliffLeafMid : cliffLeafSun;
      const bush = new THREE.Mesh(scrubGeo, bushMat);
      const bRad = rTop * (0.24 + ((idx + s) % 3) * 0.07);
      bush.scale.set(bRad * 1.25, bRad * 0.68, bRad * 1.05);
      bush.position.set(bx, h - 0.44 + (s % 2) * 0.08, bz);
      bush.rotation.y = sa;
      bush.castShadow = true;
      bush.receiveShadow = true;
      lake.add(bush);
    }
  }
  env.add(lake);

  // Modern Hồ Đá Safety Fence, Grounded Warning Sign & Timber Viewing Deck (with 3-sided water guardrail & lakeside bench facing lake!)
  const lakeDeck = new THREE.Group();
  lakeDeck.position.set(26.5, 0, -10.8);
  const woodMaps = getWoodPlankMaps(2, 2);
  const woodMat = makeStdMat(0xd6bfa8, 0.74, 0.02, { map: woodMaps.map, bumpMap: woodMaps.bumpMap, bumpScale: 0.05 });
  const deckTrimMat = makeStdMat(0x3b2313, 0.78, 0.04);
  addRoundedBox(lakeDeck, 4.2, 0.2, 2.2, -3.1, 0.14, 5.05, woodMat, 0.05);
  // Dark hardwood architectural perimeter border trim framing the viewing deck
  addBox(lakeDeck, 4.28, 0.22, 0.09, -3.1, 0.145, 3.96, deckTrimMat);
  addBox(lakeDeck, 4.28, 0.22, 0.09, -3.1, 0.145, 6.14, deckTrimMat);
  addBox(lakeDeck, 0.09, 0.22, 2.26, -5.19, 0.145, 5.05, deckTrimMat);
  addBox(lakeDeck, 0.09, 0.22, 2.26, -1.01, 0.145, 5.05, deckTrimMat);

  // Crisp red-white lakeside safety guardrail around all 3 water-exposed sides of the cantilevered deck!
  const redPostMat = makeStdMat(0xb91c1c, 0.55);
  const whiteRailMat = makeStdMat(0xd4dce4, 0.48);
  for (let px = -5.08; px <= -1.12; px += 0.99) {
    addBox(lakeDeck, 0.08, 0.68, 0.08, px, 0.52, 4.02, redPostMat);
  }
  addBox(lakeDeck, 4.04, 0.065, 0.065, -3.1, 0.78, 4.02, whiteRailMat);
  addBox(lakeDeck, 4.04, 0.055, 0.055, -3.1, 0.52, 4.02, redPostMat);
  for (const sideX of [-5.08, -1.12]) {
    addBox(lakeDeck, 0.08, 0.68, 0.08, sideX, 0.52, 5.02, redPostMat);
    addBox(lakeDeck, 0.08, 0.68, 0.08, sideX, 0.52, 5.98, redPostMat);
    addBox(lakeDeck, 0.065, 0.065, 2.04, sideX, 0.78, 5.0, whiteRailMat);
    addBox(lakeDeck, 0.055, 0.055, 2.04, sideX, 0.52, 5.0, redPostMat);
  }

  // Continuing safety fence along southeast rocky shore (strictly clear of sidewalk z >= -4.7!)
  const shoreFencePts = [
    [3.18, 5.68],
    [4.35, 4.88],
    [5.35, 3.8],
    [6.05, 2.52]
  ];
  for (let i = 0; i < shoreFencePts.length; i += 1) {
    const [fx, fz] = shoreFencePts[i];
    addBox(lakeDeck, 0.08, 0.68, 0.08, fx, 0.36, fz, redPostMat);
    if (i < shoreFencePts.length - 1) {
      const [nx, nz] = shoreFencePts[i + 1];
      const len = Math.hypot(nx - fx, nz - fz);
      const yaw = Math.atan2(-(nz - fz), nx - fx);
      const topBar = addBox(lakeDeck, len, 0.065, 0.065, (fx + nx) * 0.5, 0.64, (fz + nz) * 0.5, whiteRailMat);
      topBar.rotation.y = yaw;
      const midBar = addBox(lakeDeck, len, 0.05, 0.05, (fx + nx) * 0.5, 0.42, (fz + nz) * 0.5, redPostMat);
      midBar.rotation.y = yaw;
    }
  }

  // Grounded lakeside warning sign on twin galvanized steel posts
  const warnGrp = new THREE.Group();
  warnGrp.position.set(-5.68, 0, 5.28);
  warnGrp.rotation.y = 0.38;
  const signPostMat = makeStdMat(0x475569, 0.45, 0.68);
  for (const sx of [-0.42, 0.42]) {
    addBox(warnGrp, 0.06, 1.12, 0.06, sx, 0.56, 0, signPostMat);
  }
  const warnMat = createStreetSignMaterial('CẢNH BÁO', 'HỒ SÂU NGUY HIỂM', '#991b1b', '#fef08a', '#f87171');
  addBox(warnGrp, 1.28, 0.56, 0.06, 0, 1.12, 0, warnMat);
  lakeDeck.add(warnGrp);

  addSignBoard(lakeDeck, 4.2, 0.78, -0.2, 3.68, -6.25, 'HỒ ĐÁ LÀNG ĐẠI HỌC', '#0f766e', '#fef08a', '#2dd4bf', {
    struts: 0.72
  });
  // Centered on viewing deck & facing -Z (rotY = Math.PI) so both students gaze out across Hồ Đá!
  addParkBench(lakeDeck, -3.1, 5.45, Math.PI, true, 5, 0.24, { variant: 'lakeside', twoSitters: true });
  modernBaseGroup.add(lakeDeck);

  // Landmark D: Cụm Trường ĐH Bách Khoa & UIT (North-West x = -25.8, z = -13.5) + Active Basketball Court
  const bkHall = new THREE.Group();
  bkHall.position.set(-25.8, 0.08, -13.5);
  addContactShadow(bkHall, 11.5, 8.2, 0, 0.03, 0);
  const hallWall = makeStdMat(0xffffff, 0.7, 0.02, { map: getStuccoMaps('#cfd6de').map });
  const bkGlass = makeGlassMat('#0284c7', true, 5, 4, envGlowMats);
  const bkSideGlass = makeGlassMat('#0284c7', true, 3, 4, envGlowMats);
  const bkWingMat = makeDormMat('#cfd6de', '#0284c7', 4, 4, envGlowMats);

  // Main UIT/BK Tower + Side Glazing + Perpendicular Lab Wing with proper concrete parapet roof!
  addRoundedBox(bkHall, 8.6, 4.8, 4.4, 0, 2.4, -0.3, hallWall, 0.1);
  addBox(bkHall, 7.6, 3.8, 4.46, 0, 2.45, -0.3, bkGlass);
  addBox(bkHall, 8.66, 3.8, 3.4, 0, 2.45, -0.3, bkSideGlass);
  addRoundedBox(bkHall, 9.0, 0.34, 4.8, 0, 4.92, -0.3, makeStdMat(0x0369a1, 0.4), 0.08);
  // Vertical blue aluminum sun-breakers
  for (let sx = -3.4; sx <= 3.4; sx += 1.36) {
    addBox(bkHall, 0.1, 3.8, 0.26, sx, 2.45, 2.04, makeStdMat(0x0284c7, 0.38, 0.35));
  }
  addRoundedBox(bkHall, 3.4, 3.5, 3.6, -3.4, 1.75, 2.1, bkWingMat, 0.08);
  addRoundedBox(bkHall, 3.68, 0.26, 3.88, -3.4, 3.6, 2.1, makeStdMat(0x0369a1, 0.42), 0.06);
  addRoundedBox(bkHall, 3.38, 0.14, 3.58, -3.4, 3.76, 2.1, hallWall, 0.04);
  addSolarArray(bkHall, -1.8, 5.2, -0.3, 3.4, 2.1);
  addInoxWaterTank(bkHall, 2.6, 5.08, -0.3);
  addSignBoard(bkHall, 5.8, 0.82, 0.5, 5.4, 1.9, 'CỤM ĐH BÁCH KHOA · UIT', '#0369a1', '#f8fafc', '#38bdf8');
  modernBaseGroup.add(bkHall);

  // Active Outdoor Student Basketball Court (-25.8, 8.8) with 4 Players & Bouncing Ball!
  const bCourt = new THREE.Group();
  bCourt.position.set(-25.8, 0.06, 8.8);
  addRoundedBox(
    bCourt,
    9.2,
    0.16,
    6.2,
    0,
    0.08,
    0,
    makeStdMat(0xffffff, 0.74, 0.02, { map: getSportsFieldTexture('basketball') }),
    0.06,
    false,
    true
  );
  for (const sx of [-4.1, 4.1]) {
    const dir = sx > 0 ? -1 : 1;
    addBox(bCourt, 0.12, 2.25, 0.12, sx, 1.18, 0, makeStdMat(0x293548, 0.5, 0.6));
    addBox(bCourt, 0.45, 0.1, 0.1, sx + dir * 0.2, 2.25, 0, makeStdMat(0x293548, 0.5, 0.6));
    addBox(
      bCourt,
      0.06,
      0.78,
      1.18,
      sx + dir * 0.42,
      2.22,
      0,
      makeStdMat(0xcfd8e3, 0.2, 0.3, { transparent: true, opacity: 0.78 })
    );
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), makeStdMat(0xea580c, 0.4));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(sx + dir * 0.62, 2.02, 0);
    bCourt.add(rim);
  }
  const bball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), makeStdMat(0xd9531e, 0.6));
  bball.castShadow = true;
  bCourt.add(bball);
  sportsActors.basketball = bball;

  const bJerseyCols = [0xdc2626, 0xdc2626, 0x2563eb, 0x2563eb];
  const bPos = [
    [-1.8, -1.1],
    [-0.6, 1.2],
    [1.6, -0.9],
    [0.8, 1.0]
  ];
  for (let p = 0; p < 4; p += 1) {
    const pl = createDetailedPerson(p + 3, 'modern', 'walk', {
      f: false,
      top: bJerseyCols[p],
      bot: 0x1e293b,
      style: 'sport',
      prop: 'none',
      glasses: false,
      mask: false
    });
    pl.position.set(bPos[p][0], 0.16, bPos[p][1]);
    bCourt.add(pl);
    sportsActors.basketballPlayers.push({ mesh: pl, baseX: bPos[p][0], baseZ: bPos[p][1], phase: p * 1.5 });
  }
  modernBaseGroup.add(bCourt);

  // Landmark E: KTX Khu B ĐHQG-HCM Multi-Wing Striped Towers & Active Football Pitch
  const ktxB = new THREE.Group();
  ktxB.position.set(27.4, 0.08, 5.2);
  addContactShadow(ktxB, 9.8, 5.2, 0, 0.03, 0);
  const ktxFacadeA = makeDormMat('#d2d8e0', '#0284c7', 6, 6, envGlowMats);
  const ktxFacadeB = makeDormMat('#d2d8e0', '#ea580c', 4, 6, envGlowMats);

  // Main Tower Block B1 + Offset Wing B2 (signature KTX Khu B Thủ Đức sky-blue & orange vertical stripes!)
  addRoundedBox(ktxB, 6.2, 5.8, 3.2, -1.0, 2.9, 0, ktxFacadeA, 0.08);
  addRoundedBox(ktxB, 6.5, 0.28, 3.45, -1.0, 5.92, 0, makeStdMat(0x0284c7, 0.42), 0.05);
  addBox(ktxB, 0.45, 5.8, 3.28, -3.4, 2.9, 0, makeStdMat(0x0284c7, 0.45));

  addRoundedBox(ktxB, 3.6, 5.2, 3.0, 2.8, 2.6, -0.4, ktxFacadeB, 0.08);
  addRoundedBox(ktxB, 3.85, 0.26, 3.25, 2.8, 5.32, -0.4, makeStdMat(0xc2410c, 0.45), 0.05);
  addBox(ktxB, 0.42, 5.2, 3.08, 4.1, 2.6, -0.4, makeStdMat(0xea580c, 0.45));

  for (const by of [1.6, 3.1, 4.5]) {
    addBalconyBay(ktxB, -1.8, by, 1.6, 1.1, 0.34, true, true, true);
    addBalconyBay(ktxB, 0.2, by, 1.6, 1.1, 0.34, false, true, true);
  }
  addInoxWaterTank(ktxB, -2.4, 6.06, 0);
  addInoxWaterTank(ktxB, -0.2, 6.06, 0);
  addInoxWaterTank(ktxB, 2.8, 5.45, -0.4);
  addSignBoard(ktxB, 5.2, 0.8, -0.2, 6.45, 1.5, 'KTX KHU B · ĐHQG-HCM', '#047857', '#fef08a', '#34d399');
  modernBaseGroup.add(ktxB);

  // Active 5-a-side Artificial Turf Student Football Pitch (25.6, 10.8) + Floodlights + 6 Players!
  const fPitch = new THREE.Group();
  fPitch.position.set(25.6, 0.06, 10.8);
  addRoundedBox(
    fPitch,
    9.4,
    0.16,
    5.6,
    0,
    0.08,
    0,
    makeStdMat(0xffffff, 0.82, 0, { map: getSportsFieldTexture('football') }),
    0.06,
    false,
    true
  );
  const goalPostMat = makeStdMat(0xcfd8e3, 0.35, 0.4);
  const netMat = makeStdMat(0xcfd8e3, 0.8, 0, { transparent: true, opacity: 0.32 });
  for (const gx of [-4.25, 4.25]) {
    const dir = gx > 0 ? 1 : -1;
    addBox(fPitch, 0.07, 1.0, 0.07, gx, 0.58, -0.82, goalPostMat);
    addBox(fPitch, 0.07, 1.0, 0.07, gx, 0.58, 0.82, goalPostMat);
    addBox(fPitch, 0.07, 0.07, 1.7, gx, 1.06, 0, goalPostMat);
    addBox(fPitch, 0.45, 0.96, 1.64, gx + dir * 0.22, 0.56, 0, netMat, false, false);
  }
  // 4 Tall Stadium Floodlight Masts
  for (const [lx, lz] of [
    [-4.4, -2.65],
    [4.4, -2.65],
    [-4.4, 2.65],
    [4.4, 2.65]
  ]) {
    addBox(fPitch, 0.08, 3.4, 0.08, lx, 1.75, lz, makeStdMat(0x334155, 0.5, 0.7));
    const floodMat = makeStdMat(0xfef9c3, 0.2, 0, { emissive: 0xfef08a, emissiveIntensity: 0.35 });
    addBox(fPitch, 0.28, 0.16, 0.12, lx, 3.45, lz, floodMat);
    envGlowMats.push(floodMat);
  }
  const sBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), makeStdMat(0xe2e8f0, 0.4));
  sBall.castShadow = true;
  fPitch.add(sBall);
  sportsActors.football = sBall;

  const fSetup = [
    [-2.2, -0.8, 0xdc2626],
    [-0.9, 1.1, 0xdc2626],
    [0.5, -1.2, 0xdc2626],
    [2.3, 0.7, 0x0284c7],
    [1.1, -0.5, 0x0284c7],
    [-0.6, -0.2, 0x0284c7]
  ];
  for (let i = 0; i < fSetup.length; i += 1) {
    const [fx, fz, jCol] = fSetup[i];
    const fp = createDetailedPerson(i + 10, 'modern', 'walk', {
      f: false,
      top: jCol,
      bot: 0x0f172a,
      style: 'sport',
      prop: 'none',
      glasses: false,
      mask: false
    });
    fp.position.set(fx, 0.16, fz);
    fPitch.add(fp);
    sportsActors.footballPlayers.push({ mesh: fp, baseX: fx, baseZ: fz, phase: i * 1.1 });
  }
  modernBaseGroup.add(fPitch);

  // ==========================================================================
  // 2C. UNFINISHED METRO CONSTRUCTION CORRIDOR (STAGE 2 + STAGE 3 BEFORE TRANSIT === 'XHCN') & STAGE 2 WIRES
  // ==========================================================================
  const rawConcMat = makeStdMat(0x8b949e, 0.88, 0.05);
  for (let px = -28; px <= 28; px += 9.2) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3.8, 12), rawConcMat);
    col.position.set(px, 1.9, 16.5);
    col.castShadow = true;
    metroConstructionGroup.add(col);
    addRoundedBox(metroConstructionGroup, 1.4, 0.46, 3.3, px, 3.88, 16.5, rawConcMat, 0.06);
    // Orange construction barricades around unfinished pier bases
    addBox(metroConstructionGroup, 2.2, 0.45, 0.12, px, 0.26, 14.8, makeStdMat(0xea580c, 0.6));
  }
  // Half-built disconnected girder spans (stalled public transit project awaiting synchronized public investment!)
  addRoundedBox(metroConstructionGroup, 21, 0.55, 3.3, -18.5, 4.35, 16.5, rawConcMat, 0.06);
  addRoundedBox(metroConstructionGroup, 16, 0.55, 3.3, 19.5, 4.35, 16.5, rawConcMat, 0.06);
  addTowerCrane(metroConstructionGroup, -3.9, 15.65);
  // Construction site project noticeboard facing Transit Lot
  for (const sx of [0.4, 3.6]) {
    addBox(metroConstructionGroup, 0.1, 1.45, 0.1, sx, 0.72, 14.55, makeStdMat(0x334155, 0.5, 0.6));
  }
  addSignBoard(
    metroConstructionGroup,
    4.6,
    0.72,
    2.0,
    1.45,
    14.55,
    'CÔNG TRƯỜNG METRO · CHỜ VỐN CÔNG',
    '#9a3412',
    '#fef08a',
    '#f59e0b'
  );

  // Tangled black telecom poles & sagging overhead wire bundles ("mạng nhện dây điện") in Stage 2 ONLY!
  const wireMat = makeStdMat(0x111827, 0.85, 0.05);
  for (const px of [-20.0, -11.5, 11.5, 20.0]) {
    addUtilityPole(thaNoiGroup, px, -4.3, 'thanoi');
    addUtilityPole(thaNoiGroup, px, 4.3, 'thanoi');
  }
  for (const wz of [-4.3, 4.3]) {
    for (const [x1, x2] of [
      [-20.0, -11.5],
      [11.5, 20.0]
    ]) {
      for (const [yBase, sag, zOff] of [
        [3.62, 0.42, -0.14],
        [3.52, 0.58, 0.12],
        [3.34, 0.72, 0.02]
      ]) {
        const pts = [];
        for (let s = 0; s <= 10; s += 1) {
          const t = s / 10;
          pts.push(
            new THREE.Vector3(
              THREE.MathUtils.lerp(x1, x2, t),
              yBase - Math.sin(t * Math.PI) * sag,
              wz + zOff
            )
          );
        }
        const cable = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 4, false),
          wireMat
        );
        thaNoiGroup.add(cable);
      }
    }
  }

  // ==========================================================================
  // 2D. CHẶNG 3 (ĐỊNH HƯỚNG XHCN): COMPLETED METRO SỐ 1 + GA ĐHQG + SMART SOLAR LAMPS
  // ==========================================================================
  const pierMat = makeStdMat(0xbcc6d2, 0.74, 0.08);
  const girderMat = makeStdMat(0xaab4c0, 0.7, 0.1);
  const railMat = makeStdMat(0x3b4758, 0.36, 0.85);

  for (let px = -30; px <= 30; px += 8.6) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 3.9, 14), pierMat);
    col.position.set(px, 1.95, 16.5);
    col.castShadow = true;
    xhcnInfraGroup.add(col);
    addRoundedBox(xhcnInfraGroup, 1.45, 0.48, 3.5, px, 3.95, 16.5, pierMat, 0.08);
  }
  addRoundedBox(xhcnInfraGroup, 76, 0.58, 3.6, 0, 4.4, 16.5, girderMat, 0.08);
  // Acoustic side barriers along viaduct
  addBox(xhcnInfraGroup, 76, 0.48, 0.16, 0, 4.88, 14.8, pierMat);
  addBox(xhcnInfraGroup, 76, 0.48, 0.16, 0, 4.88, 18.2, pierMat);
  addBox(xhcnInfraGroup, 76, 0.12, 0.18, 0, 5.15, 14.8, makeStdMat(0x0284c7, 0.45));
  addBox(xhcnInfraGroup, 76, 0.12, 0.18, 0, 5.15, 18.2, makeStdMat(0x0284c7, 0.45));

  for (const rz of [15.5, 16.0, 17.0, 17.5]) {
    addBox(xhcnInfraGroup, 76, 0.08, 0.08, 0, 4.72, rz, railMat, false, false);
  }
  for (let cx = -28; cx <= 28; cx += 11.2) {
    addBox(xhcnInfraGroup, 0.11, 2.2, 0.11, cx, 5.7, 14.88, railMat);
    addBox(xhcnInfraGroup, 0.11, 2.2, 0.11, cx, 5.7, 18.12, railMat);
    addBox(xhcnInfraGroup, 0.11, 0.09, 3.4, cx, 6.75, 16.5, railMat);
  }
  addBox(xhcnInfraGroup, 76, 0.028, 0.028, 0, 6.62, 15.75, railMat, false, false);
  addBox(xhcnInfraGroup, 76, 0.028, 0.028, 0, 6.62, 17.25, railMat, false, false);

  // Iconic Curved-Vaulted Ga Metro ĐHQG Station + Non-Overlapping Pedestrian Glass Skybridge!
  const gaGroup = new THREE.Group();
  gaGroup.position.set(0, 4.7, 16.5);
  const archShellMat = makeStdMat(0xcfd8e3, 0.35, 0.25, { side: THREE.DoubleSide });
  const skylightMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.16,
    metalness: 0.15,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.84,
    side: THREE.DoubleSide
  });

  // Station concrete passenger platforms + yellow tactile safety strips + warm interior platform LEDs!
  const stationGlowMat = makeStdMat(0xfef3c7, 0.25, 0.05, { emissive: 0xf59e0b, emissiveIntensity: 0.28 });
  envGlowMats.push(stationGlowMat);
  for (const pz of [-2.05, 2.05]) {
    addRoundedBox(gaGroup, 13.8, 0.34, 1.25, 0, 0.18, pz, pierMat, 0.04);
    const tacZ = pz > 0 ? pz - 0.48 : pz + 0.48;
    addBox(gaGroup, 13.2, 0.02, 0.14, 0, 0.36, tacZ, yellowTactileMat, false, false);
    // Warm overhead platform light strips for Sunset/Dusk realism!
    addBox(gaGroup, 12.6, 0.06, 0.12, 0, 2.15, pz * 0.72, stationGlowMat, false, false);
    // Platform commuter benches
    for (const bx of [-3.6, 3.6]) {
      addRoundedBox(gaGroup, 1.2, 0.12, 0.32, bx, 0.46, pz, makeStdMat(0x0284c7, 0.45), 0.03);
    }
  }

  // Curved barrel-vault roof properly arched upward (+Y) just like real HCMC Metro Line 1 elevated stations!
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(2.86, 2.86, 13.8, 22, 1, true, Math.PI * 0.12, Math.PI * 0.76),
    archShellMat
  );
  vault.rotation.z = Math.PI / 2;
  vault.position.y = 0.15;
  vault.castShadow = true;
  gaGroup.add(vault);

  const skyStrip = new THREE.Mesh(
    new THREE.CylinderGeometry(2.9, 2.9, 13.84, 14, 1, true, Math.PI * 0.36, Math.PI * 0.28),
    skylightMat
  );
  skyStrip.rotation.z = Math.PI / 2;
  skyStrip.position.y = 0.16;
  gaGroup.add(skyStrip);

  // Concentric structural steel arch ribs & support columns aligned flush with vault ends & eave edges!
  const ribMat = makeStdMat(0x0369a1, 0.35, 0.6, { side: THREE.DoubleSide });
  for (const rx of [-6.8, -3.4, 0, 3.4, 6.8]) {
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(2.94, 2.94, 0.18, 22, 1, true, Math.PI * 0.11, Math.PI * 0.78),
      ribMat
    );
    rib.rotation.z = Math.PI / 2;
    rib.position.set(rx, 0.15, 0);
    gaGroup.add(rib);

    for (const cz of [-2.72, 2.72]) {
      addBox(gaGroup, 0.16, 1.12, 0.16, rx, 0.66, cz, ribMat);
    }
  }
  // Longitudinal steel eave fascia beams + flush mounted station signs (zero floating gap!)
  for (const sz of [-1, 1]) {
    addBox(gaGroup, 13.85, 0.18, 0.16, 0, 1.18, sz * 2.72, ribMat);
    const stSign = addSignBoard(
      gaGroup,
      6.4,
      0.78,
      0,
      1.92,
      sz * 2.54,
      'GA ĐẠI HỌC QUỐC GIA · METRO SỐ 1',
      '#0369a1',
      '#f8fafc',
      '#38bdf8'
    );
    stSign.rotation.x = sz * -0.46;
  }
  xhcnInfraGroup.add(gaGroup);

  // Glass Pedestrian Skybridge + Elevator/Stair Access Tower at x = -5.65 (cleanly beside Transit Lot x = -4.4..+4.4!)
  addRoundedBox(xhcnInfraGroup, 1.85, 0.22, 4.1, -5.65, 3.68, 13.55, pierMat, 0.05);
  addBox(xhcnInfraGroup, 1.8, 0.96, 4.0, -5.65, 4.24, 13.55, makeGlassMat('#0284c7', false, 4, 1, envGlowMats));
  addRoundedBox(xhcnInfraGroup, 2.0, 0.16, 4.2, -5.65, 4.76, 13.55, makeStdMat(0x0284c7, 0.4), 0.04);
  // Elevator & stair access tower at (-5.65, 11.2) + paved walkway linking directly into Transit Lot!
  addRoundedBox(xhcnInfraGroup, 1.95, 4.65, 1.75, -5.65, 2.32, 11.2, pierMat, 0.06);
  addBox(xhcnInfraGroup, 1.45, 3.85, 1.81, -5.65, 2.38, 11.2, makeGlassMat('#0284c7', true, 2, 3, envGlowMats));
  addRoundedBox(xhcnInfraGroup, 2.15, 0.2, 1.95, -5.65, 4.72, 11.2, makeStdMat(0x0284c7, 0.4), 0.04);
  addBox(xhcnInfraGroup, 2.8, 0.07, 2.2, -5.2, 0.04, 10.6, pathMat, false, true);

  // Smart Solar LED Avenue Streetlamps along curb strip (z = ±2.82) + Waste Sorting Bins on outer verge (Stage 3)
  for (const lx of [-20.0, -11.5, 11.5, 20.0]) {
    addModernAvenueLamp(
      s3AvenueGroup,
      lx,
      -2.82,
      1,
      streetLampBulbs,
      Math.abs(lx) === 11.5 ? 'TẠ QUANG BỬU' : ''
    );
    addModernAvenueLamp(s3AvenueGroup, lx, 2.82, -1, streetLampBulbs, '');
  }
  addModernAvenueLamp(s3AvenueGroup, -2.65, -14.0, 1, streetLampBulbs, 'MẠC ĐĨNH CHI');
  addPublicTrashBin(s3AvenueGroup, -7.15, -4.48, 0);
  addPublicTrashBin(s3AvenueGroup, 7.15, 4.48, Math.PI);

  // ==========================================================================
  // 3. MULTI-SPECIES BOTANICAL CAMPUS TREES & BENCHES (ALL ERAS)
  // ==========================================================================
  // Avenue Royal Palms grouped into West & East boulevard clusters so off-screen palms frustum-cull cleanly!
  const palmsWest = new THREE.Group();
  const palmsEast = new THREE.Group();
  modernBaseGroup.add(palmsWest, palmsEast);
  const palmXs = [-21.5, -16.5, -9.2, 9.2, 16.5, 21.5];
  for (const px of palmXs) {
    for (const pz of [-4.22, 4.22]) {
      const pTree = createTropicalTree('palm', 0.96, swayingCanopies, { hasCurb: true });
      pTree.position.set(px, 0.1, pz);
      (px < 0 ? palmsWest : palmsEast).add(pTree);
    }
  }

  // Campus botanical trees partitioned into 4 map quadrants for localized frustum culling when zoomed in
  const treesNW = new THREE.Group();
  const treesNE = new THREE.Group();
  const treesSW = new THREE.Group();
  const treesSE = new THREE.Group();
  env.add(treesNW, treesNE, treesSW, treesSE);

  const campusTrees = [
    ['phuong', -19.5, -14.2, 1.22],
    ['saoden', -19.2, -5.4, 1.18],
    ['banglang', -8.8, -15.4, 1.15],
    ['phuong', -6.5, -18.5, 1.08],
    ['phuong', 6.8, -18.5, 1.16],
    ['bang', 9.2, -15.4, 1.14],
    ['phuong', 18.8, -5.6, 1.25],
    ['saoden', 19.4, -14.2, 1.18],
    ['banglang', 20.2, -6.8, 1.08],
    ['saoden', 29.5, -3.5, 1.22],
    ['phuong', 33.6, -17.2, 1.28],
    ['bang', -19.8, 5.2, 1.14],
    ['saoden', -20.0, 12.6, 1.18],
    ['phuong', -7.4, 12.8, 1.1],
    ['banglang', 7.4, 12.8, 1.14],
    ['phuong', 19.6, 5.4, 1.18],
    ['saoden', 20.5, 13.0, 1.12],
    ['saoden', -32.2, -6.5, 1.28],
    ['phuong', -32.5, 4.8, 1.22],
    ['saoden', 34.5, 4.5, 1.28],
    ['saoden', -15.0, -22.5, 1.35],
    ['phuong', 15.0, -22.5, 1.32],
    ['banglang', -28.0, -24.5, 1.38],
    ['saoden', 28.0, -24.5, 1.35],
    ['phuong', -36.0, 14.0, 1.35],
    ['saoden', 37.0, -14.0, 1.35]
  ];
  for (const [sp, tx, tz, sc] of campusTrees) {
    // Only whitewash inner university campus trees; wild hillside & Hồ Đá quarry trees keep natural mossy bark!
    const isWildHillOrQuarry = Math.abs(tx) > 24 || Math.abs(tz) > 19 || Math.hypot(tx - 26.5, tz + 10.8) < 10.5;
    const t = createTropicalTree(sp, sc, swayingCanopies, { whitewash: !isWildHillOrQuarry });
    t.position.set(tx, getTerrainHeight(tx, tz) + 0.04, tz);
    const quad = tx < 0 ? (tz < 0 ? treesNW : treesSW) : tz < 0 ? treesNE : treesSE;
    quad.add(t);
  }

  // 4 Boulevard Benches set on paved alcoves beside the avenue grass verge, 100% clear of crosswalks & walkways!
  for (const [bx, bz, hasSit, seed] of [
    [-8.12, -4.55, true, 12],
    [8.12, -4.55, false, 14],
    [-8.12, 4.55, false, 16],
    [8.12, 4.55, true, 19]
  ]) {
    const yaw = bz < 0 ? 0 : Math.PI;
    const alcove = addRoundedBox(roundabout, 1.75, 0.11, 0.92, bx, 0.055, bz, pathMat, 0.04, false, true);
    alcove.rotation.y = yaw;
    addParkBench(roundabout, bx, bz, yaw, hasSit, seed, 0.11);
  }
  createInstancedNature(env, getTerrainHeight, isBlockedForNature);

  // Merge static same-material geometry per spatial landmark cluster so GPU frustum culling works at street-level zoom!
  const dynamicNodes = new Set([
    ...swayingCanopies.map((s) => s.crown),
    ...flagMeshes,
    ...sportsActors.basketballPlayers.map((p) => p.mesh),
    ...sportsActors.footballPlayers.map((p) => p.mesh),
    lakeWater
  ]);
  if (sportsActors.basketball) dynamicNodes.add(sportsActors.basketball);
  if (sportsActors.football) dynamicNodes.add(sportsActors.football);

  // Consolidate modern landmarks into 3 spatial campus sectors (West / Center / East)
  // -> Preserves localized GPU frustum culling when zoomed in while cutting ~110 draw calls!
  const modernWestSector = new THREE.Group();
  const modernCenterSector = new THREE.Group();
  const modernEastSector = new THREE.Group();
  modernWestSector.add(gate, bkHall, bCourt, palmsWest);
  modernCenterSector.add(roundabout, admin);
  modernEastSector.add(lakeDeck, ktxB, fPitch, palmsEast);
  modernBaseGroup.add(modernWestSector, modernCenterSector, modernEastSector);

  const treesWest = new THREE.Group();
  const treesEast = new THREE.Group();
  treesWest.add(treesNW, treesSW);
  treesEast.add(treesNE, treesSE);
  env.add(treesWest, treesEast);

  const bcWestSector = new THREE.Group();
  const bcEastSector = new THREE.Group();
  bcWestSector.add(bcGate, bcLecture, bcVolley);
  bcEastSector.add(bcRound, bcAdmin, bcDormB);
  baocapGroup.add(bcWestSector, bcEastSector);

  optimizeStaticSubtree(bcWestSector, dynamicNodes);
  optimizeStaticSubtree(bcEastSector, dynamicNodes);
  optimizeStaticSubtree(baocapGroup, new Set([...dynamicNodes, bcWestSector, bcEastSector]));

  for (const sec of [modernWestSector, modernCenterSector, modernEastSector]) {
    optimizeStaticSubtree(sec, dynamicNodes);
  }
  optimizeStaticSubtree(
    modernBaseGroup,
    new Set([...dynamicNodes, modernWestSector, modernCenterSector, modernEastSector])
  );

  optimizeStaticSubtree(thaNoiGroup, dynamicNodes);
  optimizeStaticSubtree(metroConstructionGroup, dynamicNodes);
  optimizeStaticSubtree(s3AvenueGroup, dynamicNodes);
  optimizeStaticSubtree(xhcnInfraGroup, dynamicNodes);

  optimizeStaticSubtree(lake, dynamicNodes);
  optimizeStaticSubtree(treesWest, dynamicNodes);
  optimizeStaticSubtree(treesEast, dynamicNodes);

  const envSkip = new Set([
    ...dynamicNodes,
    lake,
    treesWest,
    treesEast,
    baocapGroup,
    modernBaseGroup,
    thaNoiGroup,
    metroConstructionGroup,
    s3AvenueGroup,
    xhcnInfraGroup
  ]);
  optimizeStaticSubtree(env, envSkip);

  return {
    group: env,
    eraGroups: {
      baocapGroup,
      modernBaseGroup,
      thaNoiGroup,
      metroConstructionGroup,
      s3AvenueGroup,
      xhcnInfraGroup
    },
    sportsActors,
    streetLampBulbs,
    swayingCanopies,
    waterBump,
    waterUniforms,
    trafficSignals,
    flagMeshes,
    envGlowMats
  };
}

export function createLotPad(lot) {
  const pad = new THREE.Group();
  pad.position.set(lot.pos.x, 0.08, lot.pos.z);

  const plazaMaps = getSidewalkMaps(4, 3);
  const modernPadMat = makeStdMat(0xffffff, 0.84, 0.04, {
    map: plazaMaps.map,
    bumpMap: plazaMaps.bumpMap,
    bumpScale: 0.04
  });
  const bcPadMaps = getBaoCapPadMaps(3, 2);
  const baocapPadMat = makeStdMat(0xffffff, 0.92, 0.01, {
    map: bcPadMaps.map,
    bumpMap: bcPadMaps.bumpMap,
    bumpScale: 0.05
  });

  const padSlab = addRoundedBox(pad, 8.8, 0.22, 6.8, 0, 0.05, 0, modernPadMat, 0.1, false, true);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 4.95, 44), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  pad.add(ring);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 6.8, 7.0),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 3.2;
  hitbox.userData.lotId = lot.id;
  pad.add(hitbox);

  return { pad, padSlab, modernPadMat, baocapPadMat, ring, ringMat, hitbox };
}

function buildFencedLot() {
  const g = new THREE.Group();
  addRoundedBox(g, 7.2, 0.12, 5.2, 0, 0.06, 0, makeStdMat(0x8c6d4e, 0.95), 0.04, false, true);

  const postMat = makeStdMat(0x6b3410, 0.86);
  const redBar = makeStdMat(0xb91c1c, 0.6);
  const whiteBar = makeStdMat(0xcfd6de, 0.6);
  for (const [cx, cz] of [
    [-3.6, -2.6],
    [0, -2.6],
    [3.6, -2.6],
    [-3.6, 2.6],
    [0, 2.6],
    [3.6, 2.6],
    [-3.6, 0],
    [3.6, 0]
  ]) {
    addBox(g, 0.16, 0.88, 0.16, cx, 0.44, cz, postMat);
  }
  addBox(g, 7.2, 0.13, 0.1, 0, 0.7, 2.6, redBar);
  addBox(g, 7.2, 0.13, 0.1, 0, 0.38, 2.6, whiteBar);
  addBox(g, 7.2, 0.13, 0.1, 0, 0.7, -2.6, redBar);
  addBox(g, 0.1, 0.13, 5.2, -3.6, 0.7, 0, redBar);
  addBox(g, 0.1, 0.13, 5.2, 3.6, 0.7, 0, redBar);

  // Stacked concrete drainage culverts & wild weeds on unallocated Bao cấp land
  const pipeMat = makeStdMat(0x8b949e, 0.88);
  for (const [px, py] of [
    [-1.45, 0.32],
    [-0.95, 0.32],
    [-1.2, 0.7]
  ]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 12), pipeMat);
    p.rotation.x = Math.PI / 2;
    p.position.set(px, py, -0.5);
    p.castShadow = true;
    g.add(p);
  }
  const weedLeafA = getFoliageMat('#2d6324');
  const weedLeafB = getFoliageMat('#457d2f');
  const weedGeo = new THREE.IcosahedronGeometry(0.18, 1);
  const bladeGeo = new THREE.ConeGeometry(0.06, 0.34, 4);
  for (const [wx, wz, seed] of [
    [2.1, -1.3, 0],
    [-2.4, 1.2, 1],
    [2.5, 1.4, 2]
  ]) {
    for (let c = 0; c < 3; c += 1) {
      const ca = seed + c * 2.1;
      const bush = new THREE.Mesh(weedGeo, c % 2 === 0 ? weedLeafA : weedLeafB);
      bush.scale.set(1.15 - c * 0.15, 0.55 + (c % 2) * 0.2, 1.0);
      bush.position.set(wx + Math.cos(ca) * 0.16, 0.16, wz + Math.sin(ca) * 0.16);
      bush.castShadow = true;
      g.add(bush);

      const blade = new THREE.Mesh(bladeGeo, weedLeafB);
      blade.position.set(wx + Math.cos(ca + 0.8) * 0.18, 0.24, wz + Math.sin(ca + 0.8) * 0.18);
      blade.rotation.set((c - 1) * 0.18, ca, (1 - c) * 0.15);
      g.add(blade);
    }
  }
  addBox(g, 0.14, 1.25, 0.14, 1.1, 0.62, 0.3, postMat);
  addSignBoard(g, 3.9, 0.88, 1.1, 1.5, 0.3, 'ĐẤT CHỜ CHỈ TIÊU', '#881b1b', '#fef3c7', '#f87171');
  return g;
}

function buildBaocapLot(lotId, glowMats) {
  const g = new THREE.Group();
  const ochreStucco = getStuccoMaps('#d6bf88', true);
  const ochreWall = makeStdMat(0xffffff, 0.86, 0, {
    map: ochreStucco.map,
    bumpMap: ochreStucco.bumpMap,
    bumpScale: 0.04
  });
  const roofMaps = getTerracottaRoofMaps(4, 2, true);
  const roofMat = makeStdMat(0xffffff, 0.78, 0.04, { map: roofMaps.map, bumpMap: roofMaps.bumpMap, bumpScale: 0.08 });
  const shutterMat = makeStdMat(0x166534, 0.78);
  const bcGlowMat = makeStdMat(0xfde68a, 0.55, 0.02, { emissive: 0xd97706, emissiveIntensity: 0.16 });
  glowMats.push(bcGlowMat);
  const brickMaps = getBrickWallMaps('#8f3112');
  const brickMat = makeStdMat(0xffffff, 0.88, 0, { map: brickMaps.map, bumpMap: brickMaps.bumpMap, bumpScale: 0.05 });

  if (lotId === 'housing') {
    // 1980s KTX Sinh Viên Cũ: Weathered vôi-vàng 2-story hall, exterior corridor, brick water tank & clothesline!
    addContactShadow(g, 7.2, 4.4);
    addRoundedBox(g, 6.0, 2.9, 3.1, -0.3, 1.45, -0.45, ochreWall, 0.06);
    const roof = createGableRoof(6.5, 1.12, 3.5, roofMat);
    roof.position.set(-0.3, 2.9, -0.45);
    g.add(roof);

    // Exterior 2nd-floor concrete walkway & brick balustrade
    addBox(g, 6.0, 0.12, 0.68, -0.3, 1.48, 1.38, makeStdMat(0x949da8, 0.85));
    addBox(g, 6.0, 0.48, 0.12, -0.3, 1.76, 1.66, ochreWall);
    for (let c = -2; c <= 2; c += 1) {
      const cx = -0.3 + c * 1.15;
      addBox(g, 0.56, 0.72, 0.1, cx, 0.92, 1.12, shutterMat);
      addBox(g, 0.56, 0.72, 0.1, cx, 2.18, 1.12, shutterMat);
      if (c % 2 === 0) {
        addBox(g, 0.38, 0.52, 0.12, cx, 2.18, 1.13, bcGlowMat);
      } else {
        addBox(g, 0.38, 0.52, 0.12, cx, 0.92, 1.13, bcGlowMat);
      }
      addBox(g, 0.14, 1.48, 0.14, cx, 0.74, 1.64, ochreWall);
    }

    // Communal Brick Water Tank (Bể nước tập thể xây gạch) + Student Clothesline
    addBox(g, 1.05, 0.95, 0.95, 3.25, 0.48, -0.6, brickMat);
    addParkedBikesRow(g, -1.6, 2.18, 3, 0, 'baocap');
    for (const px of [1.6, 3.2]) {
      addBox(g, 0.06, 1.45, 0.06, px, 0.72, 1.85, makeStdMat(0x5c3a21, 0.85));
    }
    addBox(g, 1.65, 0.02, 0.02, 2.4, 1.38, 1.85, makeStdMat(0x94a3b8, 0.5));
    addBox(g, 0.24, 0.34, 0.03, 2.1, 1.18, 1.85, makeStdMat(0xcbc6ba, 0.85));
    addBox(g, 0.24, 0.36, 0.03, 2.65, 1.17, 1.85, makeStdMat(0x64748b, 0.85));

    addSignBoard(g, 3.9, 0.78, -0.3, 2.8, 1.55, 'KTX SINH VIÊN · CŨ', '#78350f', '#fef3c7', '#d97706');
  } else {
    // 1980s Căng Tin Quốc Doanh Tem Phiếu: Rusty tin veranda, small ration window, big aluminum soup pots & wooden queue rails!
    addContactShadow(g, 7.2, 4.8);
    const tinMaps = getCorrugatedTinMaps(true);
    const tinMat = makeStdMat(0xffffff, 0.65, 0.35, { map: tinMaps.map, bumpMap: tinMaps.bumpMap, bumpScale: 0.06 });
    addRoundedBox(g, 6.1, 2.4, 3.0, 0, 1.2, -0.65, ochreWall, 0.06);
    addRoundedBox(g, 6.5, 0.18, 3.4, 0, 2.46, -0.65, tinMat, 0.04);

    // Small ration-coupon serving hatches (Ô cửa phát cơm tem phiếu)
    addBox(g, 0.72, 0.68, 0.12, -1.1, 1.25, 0.88, bcGlowMat);
    addBox(g, 0.72, 0.68, 0.12, 1.1, 1.25, 0.88, bcGlowMat);

    const veranda = addRoundedBox(g, 5.6, 0.12, 1.9, 0, 1.86, 1.42, tinMat, 0.03);
    veranda.rotation.x = 0.12;
    for (const px of [-2.4, 0, 2.4]) {
      addBox(g, 0.12, 1.82, 0.12, px, 0.91, 2.2, makeStdMat(0x5c3a21, 0.85));
    }
    // Brick counter + big aluminum soup cauldrons (Nồi canh nhôm quân dụng)
    addBox(g, 4.2, 0.85, 0.48, 0, 0.43, 1.0, brickMat);
    addBox(g, 4.3, 0.07, 0.56, 0, 0.88, 1.02, makeStdMat(0xbcc6d2, 0.32, 0.78));
    for (const potX of [-0.6, 0.5]) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.21, 0.34, 12),
        makeStdMat(0xcbd5e1, 0.28, 0.82)
      );
      pot.position.set(potX, 1.08, 1.02);
      g.add(pot);
    }

    // Wooden queue guide rails
    const railMat = makeStdMat(0x6b4423, 0.82);
    for (const rx of [-0.95, 0.95]) {
      addBox(g, 0.08, 0.68, 1.55, rx, 0.34, 2.15, railMat);
    }
    addSignBoard(g, 4.4, 0.84, 0, 2.8, 1.05, 'CĂNG TIN TEM PHIẾU', '#7c2d12', '#fef08a', '#d97706');
  }
  g.userData.glowMats = glowMats;
  return g;
}

function buildStateLot(lotId, glowMats) {
  const g = new THREE.Group();
  addContactShadow(g, 7.4, 4.8);
  const stucco = getStuccoMaps('#b8c2ce', true);
  const wallMat = makeStdMat(0xffffff, 0.86, 0.02, {
    map: stucco.map,
    bumpMap: stucco.bumpMap,
    bumpScale: 0.04
  });
  const ochreStucco = getStuccoMaps('#cfc29d', true);
  const ochreMat = makeStdMat(0xffffff, 0.86, 0.02, {
    map: ochreStucco.map,
    bumpMap: ochreStucco.bumpMap,
    bumpScale: 0.04
  });
  const trimMat = makeStdMat(0x526071, 0.78);
  const ironFenceMat = makeStdMat(0x334155, 0.58, 0.52);
  const stateWinMat = makeGlassMat('#334155', true, 4, 2, glowMats);
  const oldTileMaps = getTerracottaRoofMaps(4, 2, true);
  const oldTileMat = makeStdMat(0xffffff, 0.82, 0.02, {
    map: oldTileMaps.map,
    bumpMap: oldTileMaps.bumpMap,
    bumpScale: 0.08
  });

  if (lotId === 'housing') {
    // 100% State-Subsidized Rigid Dormitory: 3-story drab concrete block with iron bars, loudspeaker & curfew gate
    const dormMat = makeDormMat('#b8c2ce', '#475569', 5, 3, glowMats);
    addRoundedBox(g, 6.2, 3.85, 3.3, 0, 1.92, -0.25, dormMat, 0.06);
    addRoundedBox(g, 6.5, 0.26, 3.55, 0, 3.98, -0.25, trimMat, 0.05);
    addInoxWaterTank(g, -2.0, 4.12, -0.25);
    addUtilityPole(g, 3.1, 1.9, 'baocap');
    addParkedBikesRow(g, -1.8, 1.95, 3, 0, 'baocap');
    addBox(g, 6.6, 0.62, 0.06, 0, 0.31, 2.35, ironFenceMat);
    addSignBoard(g, 4.7, 0.82, 0, 4.45, 1.4, 'KTX BAO CẤP 100%', '#7f1d1d', '#fef3c7', '#dc2626', { struts: 0.34 });
  } else if (lotId === 'food') {
    // State Quota Canteen Hall: Long single-story tiled hall with tin exhaust chimney & ration menu board
    addRoundedBox(g, 6.3, 2.55, 3.4, 0, 1.28, -0.35, ochreMat, 0.06);
    const roof = createGableRoof(6.8, 1.05, 3.85, oldTileMat);
    roof.position.set(0, 2.55, -0.35);
    g.add(roof);
    addBox(g, 5.4, 1.15, 3.46, 0, 1.38, -0.35, stateWinMat);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.35, 10), trimMat);
    chimney.position.set(-2.5, 3.35, -1.2);
    g.add(chimney);
    for (const rx of [-1.0, 1.0]) {
      addBox(g, 0.07, 0.65, 1.4, rx, 0.33, 1.95, ironFenceMat);
    }
    addSignBoard(g, 4.8, 0.82, 0, 2.75, 1.62, 'CĂNG TIN QUỐC DOANH', '#7f1d1d', '#fef3c7', '#dc2626');
  } else if (lotId === 'transit') {
    // Quota Ticket Dispatch Station: Drab concrete dispatch office + closed red-white barrier (no private vehicles)
    addRoundedBox(g, 4.2, 2.6, 2.8, -1.1, 1.3, -0.3, wallMat, 0.06);
    addRoundedBox(g, 4.5, 0.24, 3.1, -1.1, 2.7, -0.3, trimMat, 0.05);
    addBox(g, 3.4, 1.15, 2.86, -1.1, 1.38, -0.3, stateWinMat);
    // Closed vehicle quota checkpoint gate
    addBox(g, 0.22, 0.95, 0.22, 1.35, 0.48, 1.2, ironFenceMat);
    addBox(g, 2.3, 0.1, 0.1, 2.5, 0.82, 1.2, makeStdMat(0xb91c1c, 0.55));
    addSignBoard(g, 4.3, 0.82, -1.1, 3.24, 1.05, 'TRẠM VÉ CHỈ TIÊU', '#7f1d1d', '#fef3c7', '#dc2626', { struts: 0.32 });
  } else if (lotId === 'jobs') {
    // Administrative Labor Assignment Bureau: Symmetrical 2-story concrete office with noticeboard & iron fence
    addRoundedBox(g, 5.9, 3.35, 3.3, 0, 1.68, -0.25, wallMat, 0.06);
    addRoundedBox(g, 6.25, 0.28, 3.6, 0, 3.46, -0.25, trimMat, 0.05);
    addBox(g, 5.1, 2.25, 3.36, 0, 1.72, -0.25, stateWinMat);
    addBox(g, 5.96, 2.25, 2.4, 0, 1.72, -0.25, stateWinMat);
    // Official assignment bulletin board in front courtyard
    addBox(g, 1.5, 0.95, 0.1, -1.9, 0.95, 1.85, makeStdMat(0x7f1d1d, 0.7));
    addBox(g, 6.4, 0.56, 0.06, 0, 0.28, 2.35, ironFenceMat);
    addSignBoard(g, 4.7, 0.82, 0, 3.92, 1.4, 'SỞ PHÂN CÔNG VIỆC', '#7f1d1d', '#fef3c7', '#dc2626', { struts: 0.32 });
  } else if (lotId === 'study') {
    // Restricted-Hours Closed-Stack Reading Hall: Brick wainscoting, barred tall windows & pitched roof
    const brickMaps = getBrickWallMaps('#8f3112');
    const brickMat = makeStdMat(0xffffff, 0.88, 0, { map: brickMaps.map, bumpMap: brickMaps.bumpMap, bumpScale: 0.04 });
    addRoundedBox(g, 5.8, 0.85, 3.4, 0, 0.43, -0.2, brickMat, 0.04);
    addRoundedBox(g, 5.7, 2.25, 3.3, 0, 1.9, -0.2, ochreMat, 0.05);
    const roof = createGableRoof(6.2, 1.0, 3.75, oldTileMat);
    roof.position.set(0, 3.02, -0.2);
    g.add(roof);
    addBox(g, 4.8, 1.35, 3.36, 0, 1.92, -0.2, stateWinMat);
    addSignBoard(g, 4.7, 0.82, 0, 3.18, 1.72, 'PHÒNG ĐỌC CHỈ TIÊU', '#7f1d1d', '#fef3c7', '#dc2626');
  } else {
    // Equal-Ration State Infirmary: 2-story clinic block with faded red cross & wooden waiting bench
    addRoundedBox(g, 5.6, 3.0, 3.25, 0, 1.5, -0.2, wallMat, 0.06);
    addRoundedBox(g, 5.9, 0.26, 3.55, 0, 3.12, -0.2, trimMat, 0.05);
    addBox(g, 4.6, 1.95, 3.31, 0, 1.56, -0.2, stateWinMat);
    addBox(g, 5.66, 1.95, 2.2, 0, 1.56, -0.2, stateWinMat);
    const fadedCross = makeStdMat(0x991b1b, 0.65);
    addBox(g, 0.78, 0.24, 0.12, -2.0, 2.2, 1.45, fadedCross);
    addBox(g, 0.24, 0.78, 0.12, -2.0, 2.2, 1.45, fadedCross);
    addParkBench(g, 1.6, 1.95, Math.PI, false, 4, 0.02);
    addSignBoard(g, 4.7, 0.82, 0, 3.62, 1.42, 'TRẠM Y TẾ BÌNH QUÂN', '#7f1d1d', '#fef3c7', '#dc2626', { struts: 0.34 });
  }

  g.userData.glowMats = glowMats;
  return g;
}

function buildPrivateLot(lotId, glowMats) {
  const g = new THREE.Group();

  if (lotId === 'housing') {
    // Stark contrast: Crammed 6-story "Trọ VIP Giá x3" tube tower + Cramped rusty-tin brick alley boarding row!
    addContactShadow(g, 4.4, 4.0, -1.55, 0.03, -0.2);
    addContactShadow(g, 3.6, 3.8, 2.0, 0.03, 0.3);

    const towerMat = makeGlassMat('#334155', true, 4, 6, glowMats);
    addRoundedBox(g, 3.45, 6.4, 3.2, -1.55, 3.2, -0.2, makeStdMat(0x293548, 0.45, 0.5), 0.08);
    addBox(g, 3.15, 5.85, 3.26, -1.55, 3.25, -0.2, towerMat);
    addBox(g, 3.51, 5.85, 2.75, -1.55, 3.25, -0.2, towerMat);
    addRoundedBox(g, 3.75, 0.3, 3.45, -1.55, 6.5, -0.2, makeStdMat(0x9f1239, 0.45), 0.06);
    // Stacked AC units & cramped iron "chuồng cọp" balconies
    for (const by of [1.8, 3.2, 4.6]) {
      addBalconyBay(g, -1.55, by, 1.42, 1.8, 0.3, false, true, true);
    }
    addInoxWaterTank(g, -1.55, 6.65, -0.2);

    // Cramped brick-and-corrugated-tin student shack row next door (with rusty iron doors, barred windows & electric meters!)
    const brickMaps = getBrickWallMaps('#8f3112');
    const brickWall = makeStdMat(0xffffff, 0.88, 0, {
      map: brickMaps.map,
      bumpMap: brickMaps.bumpMap,
      bumpScale: 0.05
    });
    const tinMaps = getCorrugatedTinMaps(true);
    const tinMat = makeStdMat(0xffffff, 0.65, 0.35, { map: tinMaps.map, bumpMap: tinMaps.bumpMap, bumpScale: 0.06 });
    const ironDoorMat = makeStdMat(0x1e3a5f, 0.68, 0.35);
    const dimWinMat = makeStdMat(0xd97706, 0.4, 0.1, { emissive: 0xb45309, emissiveIntensity: 0.22 });
    glowMats.push(dimWinMat);

    addRoundedBox(g, 2.85, 1.68, 2.85, 2.0, 0.84, 0.35, brickWall, 0.04);
    const slantRoof = addBox(g, 3.18, 0.12, 3.18, 2.0, 1.72, 0.35, tinMat);
    slantRoof.rotation.z = -0.09;
    // Doors & small barred windows on front (+Z) AND back (-Z) & side (+X) so it looks like a real student alley row!
    for (const dx of [1.25, 2.55]) {
      addBox(g, 0.56, 1.25, 0.06, dx, 0.63, 1.78, ironDoorMat);
      addBox(g, 0.48, 0.46, 0.06, dx, 1.08, -1.08, dimWinMat);
      // Wall-mounted electric sub-meters ("điện 5k/số")
      addBox(g, 0.14, 0.2, 0.08, dx + 0.38, 1.15, 1.79, makeStdMat(0xcbd5e1, 0.5));
    }
    addBox(g, 0.52, 0.48, 0.06, 1.9, 1.05, 1.78, dimWinMat);
    addBox(g, 0.06, 0.48, 0.68, 3.43, 1.05, 0.35, dimWinMat);
    addParkedBikesRow(g, 2.0, 2.3, 3, 0.12);

    addSignBoard(g, 3.7, 0.85, -1.55, 7.12, 1.36, 'TRỌ VIP · GIÁ x3', '#9f1239', '#ffffff', '#fb7185', {
      struts: 0.34,
      strutSpan: 1.3
    });
  } else if (lotId === 'food') {
    // Chaotic unregulated street stalls: makeshift tarps, smoky oil-drum grill, scattered stools & trash!
    addContactShadow(g, 7.2, 4.6);
    const tinMaps = getCorrugatedTinMaps(true);
    const tinMat = makeStdMat(0xffffff, 0.62, 0.35, { map: tinMaps.map, bumpMap: tinMaps.bumpMap, bumpScale: 0.06 });
    const stallWin = makeGlassMat('#92400e', true, 2, 1, glowMats);
    addRoundedBox(g, 3.2, 2.0, 2.6, -1.5, 1.0, -0.45, makeStdMat(0x7f1d1d, 0.78), 0.05);
    addBox(g, 2.4, 0.9, 2.66, -1.5, 1.05, -0.45, stallWin);
    addRoundedBox(g, 2.75, 1.75, 2.25, 1.65, 0.88, -0.25, makeStdMat(0x475569, 0.82), 0.05);
    addBox(g, 2.1, 0.85, 2.31, 1.65, 0.95, -0.25, stallWin);
    addBox(g, 6.6, 0.12, 3.2, 0.05, 2.05, 0.05, tinMat);
    // Blue makeshift plastic tarpaulin awning encroaching sidewalk
    const blueTarp = addBox(g, 3.4, 0.06, 1.5, -1.4, 1.75, 1.45, makeStdMat(0x1d4ed8, 0.75));
    blueTarp.rotation.x = 0.25;

    // Smoky charcoal grill drum + chimney pipe
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.68, 12), makeStdMat(0x27272a, 0.8, 0.4));
    drum.position.set(-2.2, 0.34, 1.2);
    g.add(drum);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.45, 8), makeStdMat(0x52525b, 0.55, 0.6));
    pipe.position.set(-2.2, 2.58, -0.7);
    g.add(pipe);

    // Scattered 4-legged plastic stools + black trash bags
    for (const [sx, sz, col] of [
      [-1.5, 1.75, 0x1d4ed8],
      [-0.85, 1.95, 0xdc2626],
      [-0.35, 1.6, 0xdc2626],
      [1.1, 1.75, 0x1d4ed8],
      [1.65, 2.05, 0xdc2626]
    ]) {
      addPlasticStool(g, sx, sz, col);
    }
    const bagMat = makeStdMat(0x18181b, 0.88);
    for (const [bx, bz, sc] of [
      [2.35, 1.7, 0.3],
      [2.7, 1.5, 0.26],
      [2.5, 1.95, 0.22]
    ]) {
      const bag = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), bagMat);
      bag.position.set(bx, sc * 0.8, bz);
      g.add(bag);
    }
    addSignBoard(g, 4.5, 0.82, 0, 2.55, 1.55, 'QUÁN TỰ PHÁT · MẤT ATTP', '#9f1239', '#fecdd3', '#f43f5e', {
      struts: 0.3
    });
  } else if (lotId === 'transit') {
    // Price-gouging 50k private parking lot crammed with scooters + attendant cashier booth + red toll arm!
    const asphalt = getAsphaltMaps(3, 3);
    addBox(
      g,
      7.6,
      0.12,
      5.4,
      0,
      0.06,
      0,
      makeStdMat(0xffffff, 0.86, 0.04, { map: asphalt.map, bumpMap: asphalt.bumpMap, bumpScale: 0.04 }),
      false,
      true
    );
    const boothWin = makeGlassMat('#9f1239', true, 2, 1, glowMats);
    addRoundedBox(g, 1.75, 1.95, 1.75, -2.55, 0.98, -1.25, makeStdMat(0x475569, 0.72), 0.06);
    addBox(g, 1.4, 0.75, 1.81, -2.55, 1.25, -1.25, boothWin);
    addBox(g, 2.1, 0.15, 2.1, -2.55, 2.02, -1.25, makeStdMat(0x9f1239, 0.55));
    // Toll barrier facing the avenue (-Z) AND grounded steel gantry posts holding up the 50k parking sign!
    addBox(g, 0.22, 1.0, 0.22, -1.1, 0.5, -1.95, makeStdMat(0x334155, 0.6));
    addBox(g, 3.8, 0.11, 0.11, 0.9, 0.86, -1.95, makeStdMat(0xdc2626, 0.45));
    addParkedBikesRow(g, 1.1, -0.35, 6, 0, 'modern', 0.12);
    addParkedBikesRow(g, 1.1, 1.25, 6, 0.05, 'modern', 0.12);
    addSignBoard(g, 4.4, 0.82, 0.75, 2.62, -1.95, 'GIỮ XE TƯ · 50K/LƯỢT', '#881337', '#fef08a', '#fb7185', {
      struts: 2.18,
      strutSpan: 1.95
    });
  } else if (lotId === 'jobs') {
    // Monolithic dark corporate tower (360° curtain wall + VIP executive drop-off canopy + rooftop HVAC & helipad)
    addContactShadow(g, 6.6, 5.0);
    const corpMat = makeGlassMat('#1e293b', true, 5, 6, glowMats);
    const corpSideMat = makeGlassMat('#1e293b', true, 3, 6, glowMats);
    addRoundedBox(g, 5.4, 5.8, 3.6, 0, 2.9, 0, makeStdMat(0x1e293b, 0.42, 0.58), 0.1);
    addBox(g, 5.05, 5.25, 3.68, 0, 2.95, 0, corpMat);
    addBox(g, 5.48, 5.25, 3.15, 0, 2.95, 0, corpSideMat);
    addRoundedBox(g, 2.8, 0.18, 1.2, 0, 1.95, -2.15, makeStdMat(0x0f172a, 0.35, 0.7), 0.04);
    addRoundedBox(g, 2.8, 0.18, 1.2, 0, 1.95, 2.15, makeStdMat(0x0f172a, 0.35, 0.7), 0.04);
    const heliRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 24), makeStdMat(0xd97706, 0.5));
    heliRing.rotation.x = -Math.PI / 2;
    heliRing.position.set(0, 5.82, 0);
    g.add(heliRing);
    addSignBoard(g, 4.6, 0.85, 0, 6.25, 1.62, 'TẬP ĐOÀN ĐỘC QUYỀN', '#0f172a', '#fda4af', '#f43f5e', {
      struts: 0.3
    });
  } else if (lotId === 'study') {
    // Exclusive 90k/cup luxury lounge café (wrap-around warm bronze glazing + gold roof trim + VIP terrace)
    addContactShadow(g, 6.6, 4.4);
    const darkWood = getWoodPlankMaps(2, 2);
    const cafeGlass = makeGlassMat('#92400e', true, 3, 2, glowMats);
    addRoundedBox(
      g,
      5.8,
      2.95,
      3.5,
      0,
      1.48,
      -0.2,
      makeStdMat(0x451a03, 0.55, 0.1, { map: darkWood.map, bumpMap: darkWood.bumpMap, bumpScale: 0.04 }),
      0.08
    );
    addBox(g, 5.0, 2.0, 3.56, 0, 1.42, -0.2, cafeGlass);
    addBox(g, 5.86, 2.0, 2.65, 0, 1.42, -0.2, cafeGlass);
    addRoundedBox(g, 6.2, 0.28, 3.9, 0, 3.05, -0.2, makeStdMat(0x78350f, 0.45), 0.06);
    addRoundedBox(g, 3.2, 0.14, 1.2, 0, 1.95, 1.95, makeStdMat(0xb45309, 0.4, 0.35), 0.04);
    // Gold stanchion posts blocking non-VIP students
    for (const px of [-1.4, 1.4]) {
      addBox(g, 0.06, 0.72, 0.06, px, 0.36, 2.25, makeStdMat(0xd97706, 0.25, 0.85));
    }
    addBox(g, 2.8, 0.04, 0.04, 0, 0.62, 2.25, makeStdMat(0x9f1239, 0.6));
    addSignBoard(g, 4.2, 0.82, 0, 3.6, 1.56, 'CAFE VIP · 90K/LY', '#451a03', '#fde047', '#f59e0b', {
      struts: 0.32
    });
  } else {
    // High-fee private clinic cutting scholarships (360° glazed windows + maroon canopy + private cross)
    addContactShadow(g, 6.6, 4.4);
    const wall = makeStdMat(0xffffff, 0.65, 0.02, { map: getStuccoMaps('#cfd6de').map });
    const clinicGlass = makeGlassMat('#9f1239', true, 4, 2, glowMats);
    addRoundedBox(g, 5.8, 3.25, 3.4, 0, 1.62, -0.1, wall, 0.08);
    addBox(g, 4.8, 2.2, 3.46, 0, 1.6, -0.1, clinicGlass);
    addBox(g, 5.86, 2.2, 2.45, 0, 1.6, -0.1, clinicGlass);
    addRoundedBox(g, 6.2, 0.34, 3.8, 0, 3.36, -0.1, makeStdMat(0x9f1239, 0.45), 0.06);
    addRoundedBox(g, 2.6, 0.16, 1.15, 0, 2.02, 1.95, makeStdMat(0x9f1239, 0.45), 0.04);
    addSignBoard(g, 4.6, 0.82, 0, 3.92, 1.5, 'VIỆN PHÍ TƯ · CẮT HỌC BỔNG', '#9f1239', '#ffffff', '#fb7185', {
      struts: 0.34
    });
  }

  g.userData.glowMats = glowMats;
  return g;
}

function buildXhcnLot(lotId, glowMats, fairyBulbs) {
  const g = new THREE.Group();
  const cleanStucco = getStuccoMaps('#cfd6de');
  const whiteWall = makeStdMat(0xffffff, 0.68, 0.02, {
    map: cleanStucco.map,
    bumpMap: cleanStucco.bumpMap,
    bumpScale: 0.03
  });
  const skyGlassMat = makeGlassMat('#1e4e79', true, 3, 4, glowMats);
  const warmWood = getWoodPlankMaps(2, 2);
  const woodMat = makeStdMat(0xffffff, 0.68, 0.04, { map: warmWood.map, bumpMap: warmWood.bumpMap, bumpScale: 0.04 });
  const roofMaps = getTerracottaRoofMaps(4, 2);
  const tileMat = makeStdMat(0xffffff, 0.72, 0.04, { map: roofMaps.map, bumpMap: roofMaps.bumpMap, bumpScale: 0.08 });

  if (lotId === 'housing') {
    // KTX KHU A ĐHQG + NHÀ TRỌ MINH BẠCH KIỂU MẪU
    addContactShadow(g, 7.8, 5.2);
    const blueTrim = makeStdMat(0x0284c7, 0.4);
    const dormMat = makeDormMat('#cfd6de', '#0284c7', 4, 5, glowMats);

    addRoundedBox(g, 3.7, 4.85, 3.25, -1.7, 2.42, -0.35, dormMat, 0.1);
    addRoundedBox(g, 4.0, 0.28, 3.5, -1.7, 4.95, -0.35, blueTrim, 0.06);

    for (const bx of [-2.45, -0.95]) {
      addBalconyBay(g, bx, 1.55, 1.3, 1.08, 0.38, true, true, false);
      addBalconyBay(g, bx, 2.95, 1.3, 1.08, 0.38, true, true, true);
    }
    addInoxWaterTank(g, -2.55, 5.1, -0.65);
    addSolarArray(g, -1.0, 5.18, -0.1, 1.45, 0.92);

    // Regulated 2-story Student Homestay with 360° casement windows, posted price board & neat bike shed!
    const creamWall = makeStdMat(0xffffff, 0.72, 0, { map: getStuccoMaps('#dfd4b4').map });
    addRoundedBox(g, 2.8, 2.6, 2.85, 1.95, 1.3, -0.2, creamWall, 0.08);
    const houseRoof = createGableRoof(3.15, 0.98, 3.2, tileMat);
    houseRoof.position.set(1.95, 2.6, -0.2);
    g.add(houseRoof);
    addBox(g, 2.05, 1.5, 2.91, 1.95, 1.28, -0.2, skyGlassMat);
    for (const wy of [0.95, 1.95]) {
      addBox(g, 2.86, 0.58, 0.88, 1.95, wy, -0.2, skyGlassMat);
    }
    addBalconyBay(g, 1.95, 1.55, 1.28, 1.5, 0.32, true, true, false);

    // Covered motorbike shed + neat parked scooters
    addRoundedBox(g, 2.5, 0.08, 1.1, 1.95, 1.15, 2.08, makeStdMat(0x0f766e, 0.45), 0.03);
    addParkedBikesRow(g, 1.95, 2.08, 4, 0);

    const tree = createTropicalTree('saoden', 0.82);
    tree.position.set(-3.0, 0, 2.15);
    g.add(tree);

    addSignBoard(g, 4.2, 0.84, -1.7, 5.58, 1.15, 'KTX CÔNG + TRỌ MINH BẠCH', '#0369a1', '#f8fafc', '#38bdf8', {
      struts: 0.34,
      strutSpan: 1.45
    });
  } else if (lotId === 'study') {
    // NHÀ VĂN HÓA SINH VIÊN ĐHQG-HCM ("Nhà Trắng sinh viên") — Authentic Flat-Faced Hexagonal Landmark:
    // Dense Undulating White Concrete Vertical Wave-Louvers on All 6 Faces + Youthful Colors Recessed Behind Glass +
    // Wide Cantilevered Flat Hexagonal Roof with Genuinely Open Central Skylight Atrium + Clean Ceremonial Front Steps!
    addContactShadow(g, 8.2, 6.1);

    const czCenter = -0.36;
    const nvhWhiteMat = makeStdMat(0xe2e8f0, 0.46, 0.05);
    const podiumLowerMat = makeStdMat(0x9aa4b0, 0.72, 0.04);
    const podiumUpperMat = makeStdMat(0xbcc6d2, 0.68, 0.05);
    const hexInnerCoreMat = makeGlassMat('#0c3b66', true, 6, 4, glowMats);
    const recessedGlassVeilMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f3b66,
      roughness: 0.12,
      metalness: 0.22,
      clearcoat: 0.88,
      transparent: true,
      opacity: 0.46
    });
    const tealMat = makeStdMat(0x0284c7, 0.36, 0.28);
    const accentColors = [
      makeStdMat(0xea580c, 0.48, 0.05), // Youthful terracotta-orange
      makeStdMat(0xeab308, 0.46, 0.05), // Sunny student gold
      makeStdMat(0x0284c7, 0.44, 0.08), // VNU sky-blue
      makeStdMat(0x10b981, 0.46, 0.05) // Creative emerald
    ];

    const makeHexRingMesh = (rOuter, rInner, height, yBottom, mat) => {
      const shape = new THREE.Shape();
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * rOuter;
        const py = Math.sin(a) * rOuter;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      shape.closePath();

      if (rInner > 0) {
        const hole = new THREE.Path();
        for (let i = 5; i >= 0; i -= 1) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * rInner;
          const py = Math.sin(a) * rInner;
          if (i === 5) hole.moveTo(px, py);
          else hole.lineTo(px, py);
        }
        hole.closePath();
        shape.holes.push(hole);
      }

      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, yBottom, czCenter);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // 1. Stepped Ceremonial Forecourt + Hexagonal Upper Plinth + Clean Wide 5-Step Front Grand Staircase (zero dark corners!)
    addRoundedBox(g, 7.8, 0.16, 5.8, 0, 0.08, -0.04, podiumLowerMat, 0.06);
    const hexPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.42, 3.48, 0.26, 6), podiumUpperMat);
    hexPlinth.rotation.y = Math.PI / 6;
    hexPlinth.position.set(0, 0.27, czCenter);
    hexPlinth.castShadow = true;
    hexPlinth.receiveShadow = true;
    g.add(hexPlinth);

    for (let s = 0; s < 5; s += 1) {
      const stepH = 0.068 * (s + 1);
      const stepD = 0.82 - s * 0.14;
      const stepZ = 2.58 + stepD * 0.5;
      addBox(g, 3.24, 0.068, stepD, 0, stepH - 0.034 + 0.08, stepZ, s % 2 === 0 ? podiumUpperMat : nvhWhiteMat);
    }
    for (const sx of [-1.76, 1.76]) {
      addRoundedBox(g, 0.26, 0.44, 0.82, sx, 0.26, 2.86, podiumUpperMat, 0.03);
      addRoundedBox(g, 0.2, 0.12, 0.66, sx, 0.51, 2.86, getFoliageMat('#28662a'), 0.04);
    }

    // 2. Deeply Recessed Inner Core (R = 2.46) + Youthful Color Panels (r = 2.20) + Translucent Glass Veil IN FRONT (R = 2.70)!
    // Make inner core hollow (open cylinder + floor rings) so the central skylight atrium is genuinely open down inside!
    const hexInnerWall = new THREE.Mesh(
      new THREE.CylinderGeometry(2.46, 2.46, 3.48, 6, 1, true),
      hexInnerCoreMat
    );
    hexInnerWall.rotation.y = Math.PI / 6;
    hexInnerWall.position.set(0, 2.14, czCenter);
    hexInnerWall.castShadow = true;
    hexInnerWall.receiveShadow = true;
    g.add(hexInnerWall);

    // Translucent recessed architectural glass curtain wall enclosing the colorful student alcoves
    const hexGlassVeil = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 3.46, 6, 1, true),
      recessedGlassVeilMat
    );
    hexGlassVeil.rotation.y = Math.PI / 6;
    hexGlassVeil.position.set(0, 2.14, czCenter);
    g.add(hexGlassVeil);

    // Horizontal white precast floor-slab spandrel rings inside the louver veil
    for (const sy of [1.56, 2.72]) {
      makeHexRingMesh(2.88, 1.42, 0.1, sy - 0.05, nvhWhiteMat);
    }

    // 6 crisp white concrete corner pilasters at hexagon vertices (R = 3.04)
    for (let k = 0; k < 6; k += 1) {
      const vAng = ((k + 0.5) * Math.PI) / 3;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 3.52, 6), nvhWhiteMat);
      col.rotation.y = Math.PI / 6;
      col.position.set(Math.sin(vAng) * 3.04, 2.16, czCenter + Math.cos(vAng) * 3.04);
      col.castShadow = true;
      col.receiveShadow = true;
      g.add(col);
    }

    // 3. Dense Vertical White Concrete Wave-Louvers (15 per face spanning u = -1.36..+1.36 right up to corners!)
    const waveBands = [
      [0.4, 1.1, 0],
      [1.1, 1.8, 1],
      [1.8, 2.5, 2],
      [2.5, 3.2, 3],
      [3.2, 3.9, 4]
    ];
    for (let k = 0; k < 6; k += 1) {
      const phi = (k * Math.PI) / 3; // k=0 faces straight +Z (Front Entrance!)
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);
      const tx = Math.cos(phi);
      const tz = -Math.sin(phi);

      // Vibrant youthful geometric color panels positioned AT r = 2.21 BEHIND the R = 2.70 (apothem 2.338) glass veil!
      for (let p = 0; p < 3; p += 1) {
        const pu = (p - 1) * 0.78;
        const py = 1.05 + ((k + p) % 3) * 0.98;
        if (k === 0 && py < 1.85 && Math.abs(pu) < 0.75) continue;
        const acc = addBox(
          g,
          0.66,
          0.88,
          0.06,
          nx * 2.21 + tx * pu,
          py,
          czCenter + nz * 2.21 + tz * pu,
          accentColors[(k + p) % accentColors.length]
        );
        acc.rotation.y = phi;
      }

      // 15 slender vertical white precast-concrete fins per face with smooth 5-band 3D sinusoidal wave modulation!
      const louverCount = 15;
      for (let li = 0; li < louverCount; li += 1) {
        const u = -1.365 + li * 0.195;
        for (const [y0, y1, bIdx] of waveBands) {
          // Leave central 2-band portal open on Front Face (k = 0) for main entrance!
          if (k === 0 && bIdx <= 1 && Math.abs(u) <= 0.62) continue;
          const segH = y1 - y0;
          const wave =
            0.5 +
            0.5 * Math.sin((u / 1.36) * Math.PI * 1.45 + bIdx * 0.72 + (k % 3) * 0.85);
          const depth = 0.14 + wave * 0.26;
          const rMid = 2.41 + depth * 0.5;
          const blade = addBox(
            g,
            0.074,
            segH + 0.012,
            depth,
            nx * rMid + tx * u,
            (y0 + y1) * 0.5,
            czCenter + nz * rMid + tz * u,
            nvhWhiteMat
          );
          blade.rotation.y = phi;
        }
      }
    }

    // Sleek Recessed Front Entrance Portal & Cantilevered White/Teal Canopy (+Z face)
    const lobbyGlow = makeStdMat(0xfde68a, 0.35, 0.05, { emissive: 0xd97706, emissiveIntensity: 0.24 });
    glowMats.push(lobbyGlow);
    addBox(g, 1.44, 1.48, 0.08, 0, 1.15, czCenter + 2.28, lobbyGlow);
    for (const px of [-0.76, 0.76]) {
      addBox(g, 0.13, 1.54, 0.34, px, 1.16, czCenter + 2.52, nvhWhiteMat);
    }
    addRoundedBox(g, 2.46, 0.13, 0.98, 0, 1.76, czCenter + 2.8, nvhWhiteMat, 0.03);
    addBox(g, 2.5, 0.05, 1.0, 0, 1.83, czCenter + 2.81, tealMat);

    // 4. Wide Cantilevered Flat Hexagonal Roof Overhang + GENUINELY OPEN Central Hexagonal Skylight Atrium!
    makeHexRingMesh(3.48, 1.42, 0.28, 3.88, nvhWhiteMat);
    makeHexRingMesh(3.52, 3.28, 0.08, 4.16, tealMat); // Crisp outer roofline trim
    makeHexRingMesh(1.56, 1.4, 0.14, 4.16, nvhWhiteMat); // Raised white oculus curb

    // Open multi-story inner atrium glazed gallery walls + balcony ring + lush atrium tree rising inside the courtyard!
    const atriumGlassMat = makeGlassMat('#0c3b66', true, 6, 2, glowMats);
    atriumGlassMat.side = THREE.DoubleSide;
    const atriumUpperWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.35, 6, 1, true),
      atriumGlassMat
    );
    atriumUpperWall.rotation.y = Math.PI / 6;
    atriumUpperWall.position.set(0, 2.7, czCenter);
    g.add(atriumUpperWall);

    // Crisp white inner atrium gallery balcony ring at 2nd floor
    makeHexRingMesh(1.42, 1.18, 0.09, 2.72, nvhWhiteMat);

    // Inner atrium floor & central green reading-garden tree visible right down inside the open skylight!
    const atriumFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.42, 0.1, 6),
      makeStdMat(0xcbc5b9, 0.72, 0.04)
    );
    atriumFloor.rotation.y = Math.PI / 6;
    atriumFloor.position.set(0, 1.52, czCenter);
    atriumFloor.receiveShadow = true;
    g.add(atriumFloor);

    const innerPlanter = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.26, 12), nvhWhiteMat);
    innerPlanter.position.set(0, 1.68, czCenter);
    const innerTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.095, 1.35, 8),
      makeStdMat(0x4a3525, 0.9)
    );
    innerTrunk.position.set(0, 2.42, czCenter);
    const innerTreeCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), getFoliageMat('#2d742e'));
    innerTreeCrown.scale.set(1.08, 0.76, 1.08);
    innerTreeCrown.position.set(0, 3.18, czCenter);
    innerTreeCrown.castShadow = true;
    innerTreeCrown.receiveShadow = true;
    g.add(innerPlanter, innerTrunk, innerTreeCrown);

    // Slender white steel space-frame beams spanning the open skylight oculus (no opaque blue cap!)
    for (let b = 0; b < 3; b += 1) {
      const beam = addBox(g, 2.82, 0.055, 0.06, 0, 4.22, czCenter, nvhWhiteMat);
      beam.rotation.y = (b * Math.PI) / 3;
    }

    // Symmetrical rooftop solar PV arrays placed cleanly on the two rear hexagonal roof facets!
    for (const sx of [-1.52, 1.52]) {
      addSolarArray(g, sx, 4.24, czCenter - 1.84, 0.94, 0.66);
    }

    // Front Roofline Signboard mounted cleanly above entrance fascia
    for (const sx of [-1.65, 1.65]) {
      addBox(g, 0.09, 0.42, 0.09, sx, 4.38, czCenter + 2.72, makeStdMat(0x334155, 0.45, 0.7));
    }
    addSignBoard(
      g,
      4.85,
      0.78,
      0,
      4.68,
      czCenter + 2.72,
      'NVH SINH VIÊN · THƯ VIỆN MỞ',
      '#0369a1',
      '#f8fafc',
      '#38bdf8'
    );

    // Plaza benches elevated cleanly onto the lower granite forecourt (baseY = 0.16)
    addParkBench(g, -2.8, 2.45, 0.35, true, 21, 0.16);
    addParkBench(g, 2.8, 2.45, -0.35, true, 24, 0.16);
  } else if (lotId === 'food') {
    // CHỢ ĐÊM & PHỐ ẨM THỰC SINH VIÊN CHUẨN ATTP — Shophouses, Lit Stalls, Elevated Diners & Edison Lights!
    addContactShadow(g, 7.8, 5.4);
    const cream = makeStdMat(0xffffff, 0.7, 0, { map: getStuccoMaps('#dfd6c0').map });
    const sage = makeStdMat(0xffffff, 0.7, 0, { map: getStuccoMaps('#c8ded4').map });
    const woodShutter = makeStdMat(0x5c3a21, 0.75);
    addRoundedBox(g, 3.0, 2.8, 2.6, -1.7, 1.4, -0.72, cream, 0.08);
    addRoundedBox(g, 3.0, 3.0, 2.6, 1.7, 1.5, -0.72, sage, 0.08);

    // 2nd-story shophouse windows, side/back windows & hanging red lanterns!
    for (const wx of [-2.25, -1.15]) {
      addBox(g, 0.56, 0.65, 2.66, wx, 2.22, -0.72, skyGlassMat);
      addBox(g, 0.68, 0.08, 0.18, wx, 1.88, 0.65, woodShutter);
    }
    for (const wx of [1.15, 2.25]) {
      addBox(g, 0.56, 0.68, 2.66, wx, 2.34, -0.72, skyGlassMat);
      addBox(g, 0.68, 0.08, 0.18, wx, 1.98, 0.65, woodShutter);
    }
    addBox(g, 0.08, 0.65, 0.9, -3.21, 2.15, -0.72, skyGlassMat);
    addBox(g, 0.08, 0.65, 0.9, 3.21, 2.25, -0.72, skyGlassMat);
    addBox(g, 0.08, 0.65, 0.9, -3.21, 1.05, -0.72, woodShutter);
    addBox(g, 0.08, 0.65, 0.9, 3.21, 1.05, -0.72, woodShutter);

    // Warm hanging lanterns under shophouse eaves
    const lanternMat = makeStdMat(0xdc2626, 0.4, 0, { emissive: 0xea580c, emissiveIntensity: 0.45 });
    glowMats.push(lanternMat);
    for (const lx of [-2.8, -0.6, 0.6, 2.8]) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lanternMat);
      lan.scale.set(1, 1.25, 1);
      lan.position.set(lx, 1.56, 1.48);
      g.add(lan);
    }

    // Warm illuminated open storefront recesses + stainless-steel prep counters + stall menu signs!
    const warmStallBack = makeStdMat(0xfde68a, 0.5, 0, { emissive: 0xd97706, emissiveIntensity: 0.25 });
    glowMats.push(warmStallBack);
    for (const [sx, mLine1, mLine2, mBg] of [
      [-1.7, 'CƠM TẤM SV', '25.000Đ · ATTP', '#9a3412'],
      [1.7, 'PHỞ · TRÀ SỮA', 'GIÁ NIÊM YẾT', '#065f46']
    ]) {
      addBox(g, 2.25, 1.35, 0.08, sx, 0.82, 0.59, warmStallBack);
      addBox(g, 2.15, 0.72, 0.44, sx, 0.51, 0.74, makeStdMat(0xcbd5e1, 0.3, 0.78));
      addBox(
        g,
        2.08,
        0.48,
        0.38,
        sx,
        1.08,
        0.74,
        makeStdMat(0xbae6fd, 0.14, 0.2, { transparent: true, opacity: 0.62 })
      );
      const menuMat = createStreetSignMaterial(mLine1, mLine2, mBg, '#fef08a', '#fbbf24');
      addBox(g, 1.65, 0.34, 0.05, sx, 1.44, 0.62, menuMat);
    }

    const r1 = createGableRoof(3.3, 0.92, 2.95, tileMat);
    r1.position.set(-1.7, 2.8, -0.72);
    g.add(r1);
    const r2 = createGableRoof(3.3, 0.92, 2.95, tileMat);
    r2.position.set(1.7, 3.0, -0.72);
    g.add(r2);

    const awnMat1 = makeStdMat(0xffffff, 0.58, 0, { map: getStripedAwningTexture('#c2410c', '#dfd6c0') });
    const awnMat2 = makeStdMat(0xffffff, 0.58, 0, { map: getStripedAwningTexture('#059669', '#c8ded4') });
    const a1 = addRoundedBox(g, 3.05, 0.11, 1.18, -1.7, 1.82, 1.08, awnMat1, 0.04);
    a1.rotation.x = 0.24;
    const a2 = addRoundedBox(g, 3.05, 0.11, 1.18, 1.7, 1.82, 1.08, awnMat2, 0.04);
    a2.rotation.x = 0.24;

    // Timber terrace (top at y = 0.15) + 3 Street Dining Sets elevated to baseY = 0.15 so stools & shoes sit FLUSH on wood!
    addRoundedBox(g, 7.1, 0.14, 2.35, 0, 0.08, 1.7, woodMat, 0.04, false, true);
    addStreetDiningSet(g, -2.05, 1.86, 0xc2410c, true, 1, 0.15);
    addStreetDiningSet(g, 0.0, 1.86, 0x059669, false, 3, 0.15);
    addStreetDiningSet(g, 2.05, 1.86, 0xc2410c, true, 6, 0.15);
    addPublicTrashBin(g, 3.35, 0.85, -Math.PI / 2);

    addFairyLightGarland(g, [-3.2, 2.55, 0.8], [3.2, 2.55, 2.45], 0.42, 8, fairyBulbs);
    addFairyLightGarland(g, [3.2, 2.55, 0.8], [-3.2, 2.55, 2.45], 0.42, 8, fairyBulbs);

    addSignBoard(g, 5.0, 0.85, 0, 4.05, 0.62, 'CHỢ ĐÊM · CHUẨN ATTP ✓', '#047857', '#fef08a', '#34d399', {
      struts: 0.95,
      strutSpan: 1.7
    });
  } else if (lotId === 'transit') {
    // BẾN XE BUÝT ĐHQG (08 / 33 / 53) & TRẠM XE THÔNG MINH KẾT NỐI METRO (Dual-frontage, zero sign/skybridge collision!)
    addContactShadow(g, 7.8, 5.4);
    addRoundedBox(g, 7.6, 0.14, 5.0, 0, 0.07, 0, makeStdMat(0xa7c4bc, 0.78), 0.06, false, true);
    // Yellow tactile boarding strips along both avenue-facing (-Z) & Metro-facing (+Z) curbs!
    const tacMat = makeStdMat(0xffffff, 0.75, 0, { map: getTactilePavingTexture(10, 1) });
    addBox(g, 6.8, 0.02, 0.22, 0, 0.15, -2.18, tacMat);
    addBox(g, 6.8, 0.02, 0.22, 0, 0.15, 2.18, tacMat);

    const steelTeal = makeStdMat(0x0f766e, 0.3, 0.68);
    for (const px of [-2.75, 0, 2.75]) {
      addRoundedBox(g, 0.2, 2.65, 0.2, px, 1.38, -0.35, steelTeal, 0.04);
      addBox(g, 0.16, 0.14, 2.7, px, 2.66, -0.35, steelTeal);
    }
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d9488,
      roughness: 0.16,
      metalness: 0.14,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.88
    });
    const canopy = addRoundedBox(g, 6.9, 0.16, 3.05, 0, 2.74, -0.35, canopyMat, 0.06);
    canopy.rotation.x = 0.05;
    addSolarArray(g, 0, 2.9, -0.55, 3.6, 1.35);

    // Waiting benches elevated onto platform (baseY = 0.14) facing the avenue + neat parked student scooters/bikes!
    addParkBench(g, -1.4, -0.65, Math.PI, true, 9, 0.14);
    addParkBench(g, 1.4, -0.65, Math.PI, true, 15, 0.14);
    addParkedBikesRow(g, 1.85, 1.5, 5, 0, 'modern', 0.14);

    // Smart Card Kiosk + Digital LED Bus Arrival Totem ("TUYẾN 08 · 33 / VÉ SV 3.000Đ")
    addRoundedBox(g, 0.62, 2.25, 0.34, -3.15, 1.2, -1.35, makeStdMat(0x0f172a, 0.4, 0.5), 0.05);
    const busBoardMat = createStreetSignMaterial('TUYẾN 08 · 33', 'VÉ SV 3.000Đ', '#065f46', '#fde047', '#34d399');
    addBox(g, 0.54, 0.65, 0.37, -3.15, 1.78, -1.35, busBoardMat);

    // Signboard mounted cleanly on steel pylons ABOVE the solar array (y = 3.55, z = 0.85) — 100% unobstructed!
    for (const sx of [-1.8, 1.8]) {
      addBox(g, 0.1, 0.72, 0.1, sx, 3.12, 0.85, steelTeal);
    }
    addSignBoard(g, 5.0, 0.86, 0, 3.58, 0.85, 'XE BUÝT 08/33 · VÉ 3.000Đ', '#047857', '#fef08a', '#2dd4bf');
  } else if (lotId === 'jobs') {
    // KHU CÔNG NGHỆ PHẦN MỀM ĐHQG (ITP) & HUB KHỞI NGHIỆP SINH VIÊN (360° wrap-around curtain wall & louvers!)
    addContactShadow(g, 7.8, 5.4);
    const hubGlass = makeGlassMat('#0f4c81', true, 5, 3, glowMats);
    const hubSideGlass = makeGlassMat('#0f4c81', true, 3, 3, glowMats);
    const podSideGlass = makeGlassMat('#0f4c81', true, 3, 2, glowMats);

    addRoundedBox(g, 6.3, 2.65, 3.65, -0.2, 1.32, -0.1, whiteWall, 0.1);
    addBox(g, 5.85, 2.2, 3.72, -0.2, 1.35, -0.1, hubGlass);
    addBox(g, 6.36, 2.2, 3.1, -0.2, 1.35, -0.1, hubSideGlass);

    // Cantilevered upper timber-and-glass Innovation Pod (glazed on all 4 sides!)
    addRoundedBox(g, 3.9, 2.0, 2.95, 0.85, 3.55, -0.1, woodMat, 0.1);
    addBox(g, 3.45, 1.58, 3.02, 0.85, 3.6, -0.1, hubGlass);
    addBox(g, 3.96, 1.58, 2.4, 0.85, 3.6, -0.1, podSideGlass);

    // Vertical architectural aluminum louvers on both North & South facades
    for (let lx = -2.8; lx <= 2.4; lx += 0.86) {
      addBox(g, 0.08, 2.2, 0.22, lx, 1.35, 1.82, whiteWall);
      addBox(g, 0.08, 2.2, 0.22, lx, 1.35, -2.02, whiteWall);
    }
    // Landscaped Sky-Garden Terrace with rooftop greenery + Rooftop Solar
    addRoundedBox(g, 2.35, 0.22, 2.55, -2.0, 2.74, -0.1, makeStdMat(0x2d6a2e, 0.85), 0.06);
    for (const gz of [-0.7, 0.5]) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), makeStdMat(0x3a7d31, 0.85));
      bush.scale.set(1.1, 0.65, 1.1);
      bush.position.set(-2.0, 2.96, gz);
      g.add(bush);
    }
    addSolarArray(g, 0.85, 4.68, -0.1, 2.65, 1.9);

    const tree = createTropicalTree('bang', 0.88);
    tree.position.set(2.85, 0, 1.95);
    g.add(tree);
    addSignBoard(g, 4.5, 0.86, 0.85, 5.14, 1.18, 'ITP · HUB STARTUP & FDI', '#0369a1', '#fef08a', '#38bdf8', {
      struts: 0.36,
      strutSpan: 1.45
    });
  } else {
    // TRUNG TÂM Y TẾ ĐHQG & QUỸ HỌC BỔNG SINH VIÊN + XE CẤP CỨU KTX (360° glazed facades!)
    addContactShadow(g, 7.4, 5.2);
    const sideClinicGlass = makeGlassMat('#1e4e79', true, 3, 3, glowMats);
    addRoundedBox(g, 5.6, 3.05, 3.3, -0.45, 1.52, -0.25, whiteWall, 0.12);
    addBox(g, 4.6, 2.2, 3.36, -0.45, 1.52, -0.25, skyGlassMat);
    addBox(g, 5.66, 2.2, 2.45, -0.45, 1.52, -0.25, sideClinicGlass);
    addRoundedBox(g, 6.0, 0.34, 3.7, -0.45, 3.18, -0.25, makeStdMat(0x059669, 0.42), 0.08);
    // Entrance canopies on both front & avenue sides
    addRoundedBox(g, 2.4, 0.16, 1.2, -0.45, 2.05, 1.9, whiteWall, 0.04);
    addRoundedBox(g, 2.4, 0.16, 1.0, -0.45, 2.05, -2.35, whiteWall, 0.04);

    const crossMat = makeStdMat(0xdc2626, 0.3, 0.1, { emissive: 0xb91c1c, emissiveIntensity: 0.32 });
    addRoundedBox(g, 0.96, 0.3, 0.16, -2.15, 2.1, 1.48, crossMat, 0.04);
    addRoundedBox(g, 0.3, 0.96, 0.16, -2.15, 2.1, 1.48, crossMat, 0.04);
    glowMats.push(crossMat);

    // Compact Campus Medical Van parked ready in the side bay!
    const amb = createAmbulanceVanMesh();
    amb.scale.setScalar(0.76);
    amb.rotation.y = -Math.PI / 2;
    amb.position.set(2.95, 0.02, 0.55);
    g.add(amb);

    const tree = createTropicalTree('phuong', 0.84);
    tree.position.set(2.8, 0, 2.2);
    g.add(tree);
    addSignBoard(g, 4.9, 0.86, -0.45, 3.82, 1.25, 'Y TẾ ĐHQG & HỌC BỔNG SV', '#059669', '#fef08a', '#34d399', {
      struts: 0.32
    });
  }

  g.userData.glowMats = glowMats;
  g.userData.fairyBulbs = fairyBulbs;
  return g;
}

export function createLotBuilding(lotId, variant) {
  const glowMats = [];
  const fairyBulbs = [];
  let lotGrp;
  if (variant === 'fenced') lotGrp = buildFencedLot();
  else if (variant === 'baocap') lotGrp = buildBaocapLot(lotId, glowMats);
  else if (variant === 'state') lotGrp = buildStateLot(lotId, glowMats);
  else if (variant === 'private') lotGrp = buildPrivateLot(lotId, glowMats);
  else lotGrp = buildXhcnLot(lotId, glowMats, fairyBulbs);
  return optimizeStaticSubtree(lotGrp);
}
