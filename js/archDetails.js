import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { createDetailedPerson } from './actors3d.js';
import {
  createStreetSignMaterial,
  getBarkMaps,
  getContactShadowTexture,
  getManholeMaps,
  getNationalFlagTexture,
  getNeutralFoliageMaps,
  getRockCliffMaps,
  getStandardMaterial,
  getStormGrateMaps,
  getTrafficSignTexture,
  getWoodPlankMaps,
  optimizeStaticSubtree
} from './textures.js';

const matCache = new Map();
function stdMat(color, roughness = 0.68, metalness = 0.05, _keyExtra = '', extra = {}) {
  return getStandardMaterial(color, roughness, metalness, extra);
}

const PLANE_GEO = new THREE.PlaneGeometry(1, 1);

export function addContactShadow(parent, w, d, x = 0, y = 0.025, z = 0, opacity = 0.68) {
  const mat = stdMat(0xffffff, 1, 0, `cshadow:${opacity}`, {
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false
  });
  const m = new THREE.Mesh(PLANE_GEO, mat);
  m.scale.set(w, d, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function getFoliageMat(hex) {
  const key = `folmat:${hex}`;
  if (matCache.has(key)) return matCache.get(key);
  const maps = getNeutralFoliageMaps();
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: 0.06,
    roughness: 0.84,
    metalness: 0.0
  });
  matCache.set(key, m);
  return m;
}

function getBarkMat(kind = 'dark') {
  const key = `barkmat:${kind}`;
  if (matCache.has(key)) return matCache.get(key);
  const maps = getBarkMaps(kind);
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: 0.07,
    roughness: 0.92,
    metalness: 0.0
  });
  matCache.set(key, m);
  return m;
}

export function createTropicalTree(species = 'saoden', scale = 1, swayingList = null, opts = {}) {
  const g = new THREE.Group();
  addContactShadow(g, 2.35 * scale, 2.35 * scale, 0, 0.028, 0, 0.54);

  if (opts.hasCurb) {
    // Authentic Vietnamese stone sidewalk tree-pit curb + dark mulch soil
    const curbMat = stdMat(0x8b95a1, 0.82, 0.04);
    const soilMat = stdMat(0x3b2a1e, 0.95, 0.0);
    const pit = new THREE.Mesh(new RoundedBoxGeometry(1.06 * scale, 0.13, 1.06 * scale, 1, 0.03), curbMat);
    pit.position.y = 0.065;
    pit.receiveShadow = true;
    g.add(pit);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.86 * scale, 0.14, 0.86 * scale), soilMat);
    soil.position.y = 0.07;
    g.add(soil);
  }

  // 1. CAU VUA / ROYAL PALM ('palm') — Natural Feathery Swept-Forward Pinnate Fronds (Zero Spiderweb Rings!)
  if (species === 'palm') {
    const palmBark = getBarkMat('palm');
    const crownShaftMat = stdMat(0x2d6e32, 0.44, 0.04);
    const frondDeep = getFoliageMat('#215c26');
    const frondMid = getFoliageMat('#2c702d');
    const frondSun = getFoliageMat('#3d8435');

    let curY = 0;
    let curX = 0;
    for (let seg = 0; seg < 6; seg += 1) {
      // Characteristic Cau Vua slight mid-trunk bulge then graceful taper
      const bulge = seg === 2 ? 0.012 : seg === 3 ? 0.008 : 0;
      const rBot = (0.18 - seg * 0.014 + bulge) * scale;
      const rTop = (0.166 - seg * 0.014 + (seg === 1 ? 0.012 : 0)) * scale;
      const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 0.54 * scale, 12), palmBark);
      segMesh.position.set(curX, curY + 0.27 * scale, 0);
      segMesh.rotation.z = -0.018 * seg;
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;
      g.add(segMesh);
      curY += 0.51 * scale;
      curX += 0.01 * seg * scale;
    }

    // Smooth glossy green Royal Palm crownshaft (Bẹ cau vua xanh mướt)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.108 * scale, 0.118 * scale, 0.62 * scale, 12),
      crownShaftMat
    );
    shaft.position.set(curX + 0.016 * scale, curY + 0.28 * scale, 0);
    shaft.castShadow = true;
    g.add(shaft);

    // Realistic branched golden-green palm seed sprays at base of crownshaft
    const seedStemMat = stdMat(0x6b8e23, 0.72);
    const berryMat = stdMat(0x84a92c, 0.68);
    for (const sa of [0.6, 2.7, 4.7]) {
      const sx = curX + Math.cos(sa) * 0.13 * scale;
      const sz = Math.sin(sa) * 0.13 * scale;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * scale, 0.008 * scale, 0.18 * scale, 5), seedStemMat);
      stalk.position.set(sx, curY - 0.02 * scale, sz);
      stalk.rotation.set(Math.sin(sa) * 0.45, 0, -Math.cos(sa) * 0.45);
      g.add(stalk);
      for (let b = 0; b < 3; b += 1) {
        const drupe = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scale, 6, 5), berryMat);
        drupe.position.set(
          sx + Math.cos(sa + (b - 1) * 0.35) * 0.04 * scale,
          curY - (0.04 + b * 0.035) * scale,
          sz + Math.sin(sa + (b - 1) * 0.35) * 0.04 * scale
        );
        g.add(drupe);
      }
    }

    const crown = new THREE.Group();
    crown.position.set(curX + 0.018 * scale, curY + 0.54 * scale, 0);

    const stemMat = stdMat(0x3a7a32, 0.62, 0.02);
    const frondCount = 13;
    for (let f = 0; f < frondCount; f += 1) {
      const tier = f < 4 ? 2 : f < 9 ? 1 : 0; // 2: upper ascending, 1: mid spreading, 0: lower gracefully drooping
      const ang =
        tier === 2
          ? (f * Math.PI * 2) / 4 + 0.42
          : tier === 1
          ? ((f - 4) * Math.PI * 2) / 5 + 0.15
          : ((f - 9) * Math.PI * 2) / 4 + 0.88;
      // Asymmetric frond lengths break up any radial ring pattern completely
      const lenMul = (0.88 + ((f * 7) % 5) * 0.065) * (tier === 2 ? 0.86 : 1.04);
      const pivot = new THREE.Group();
      pivot.rotation.y = ang;

      const fMat = tier === 2 ? frondSun : f % 2 === 0 ? frondMid : frondDeep;
      const numPairs = 12;
      const lift = tier === 2 ? 0.52 : tier === 1 ? 0.28 : 0.14;
      const droop = tier === 2 ? 0.22 : tier === 1 ? 0.54 : 0.76;
      const frondPt = (u) => ({
        x: (0.06 + u * 1.48 * lenMul) * scale,
        y: (Math.sin(u * Math.PI * 0.72) * lift - u * u * droop) * lenMul * scale
      });

      for (let p = 0; p < numPairs; p += 1) {
        const u0 = p / numPairs;
        const u1 = (p + 1) / numPairs;
        const u = (p + 0.5) / numPairs;
        const p0 = frondPt(u0);
        const p1 = frondPt(u1);
        const mx = (p0.x + p1.x) * 0.5;
        const my = (p0.y + p1.y) * 0.5;
        const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const tangent = Math.atan2(p1.y - p0.y, p1.x - p0.x);

        const thick = 0.022 * scale * (1.12 - u * 0.62);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(chord * 1.08, thick, thick * 1.05), stemMat);
        seg.position.set(mx, my, 0);
        seg.rotation.z = tangent;
        pivot.add(seg);

        // Swept-forward overlapping V-folded plumose leaflets anchored directly onto the rachis tangent!
        const env = Math.sin(Math.pow(u, 0.72) * Math.PI);
        const leafLen = (0.11 + env * 0.41) * lenMul * scale;
        const leafW = 0.092 * scale * (1.05 - u * 0.38);
        const sweep = leafLen * 0.24;
        for (const side of [-1, 1]) {
          const leaflet = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.011 * scale, leafLen), fMat);
          leaflet.position.set(
            mx + Math.cos(tangent) * sweep,
            my + Math.sin(tangent) * sweep - 0.012 * scale,
            side * leafLen * 0.34
          );
          leaflet.rotation.set(side * (0.34 + u * 0.16), -side * 0.62, tangent - 0.05);
          // Cast shadow on every other leaflet pair so ground shadows stay soft & feathery without Moiré!
          leaflet.castShadow = p % 2 === 0;
          pivot.add(leaflet);
        }
      }
      // Terminal spear leaflet at the very tip of the rachis
      const pEnd = frondPt(1.0);
      const pPrev = frondPt(0.92);
      const endTan = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
      const tipLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * lenMul * scale, 0.01 * scale, 0.055 * scale),
        fMat
      );
      tipLeaf.position.set(pEnd.x + Math.cos(endTan) * 0.07 * scale, pEnd.y + Math.sin(endTan) * 0.07 * scale, 0);
      tipLeaf.rotation.z = endTan;
      pivot.add(tipLeaf);

      crown.add(pivot);
    }

    optimizeStaticSubtree(crown, null, { unifyShadows: { cast: true, receive: true } });
    g.add(crown);
    if (swayingList) {
      optimizeStaticSubtree(g, new Set([crown]));
      swayingList.push({ crown, phase: Math.random() * Math.PI * 2 });
    } else {
      optimizeStaticSubtree(g);
    }
    return g;
  }

  // 2. HARDWOOD VIETNAMESE CAMPUS TREES ('saoden', 'phuong', 'banglang', 'bang')
  const barkMat = getBarkMat(species === 'banglang' ? 'light' : 'dark');
  const barkBump = getBarkMaps('dark').bumpMap;
  const limeWashMat = stdMat(0xcad0d7, 0.9, 0.0, 'limebark', { bumpMap: barkBump, bumpScale: 0.05 });
  const redRingMat = stdMat(0xa61c1c, 0.78, 0.0);

  // Sculpted flared buttress root collar
  const root = new THREE.Mesh(new THREE.CylinderGeometry(0.185 * scale, 0.3 * scale, 0.38 * scale, 10), barkMat);
  root.position.y = 0.19 * scale;
  root.castShadow = true;
  root.receiveShadow = true;
  g.add(root);

  const trunkH =
    species === 'phuong'
      ? 1.52 * scale
      : species === 'bang'
      ? 2.22 * scale
      : species === 'banglang'
      ? 1.66 * scale
      : 1.92 * scale;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.118 * scale, 0.185 * scale, trunkH, 10), barkMat);
  trunk.position.y = 0.24 * scale + trunkH * 0.5;
  trunk.rotation.z = species === 'phuong' ? 0.03 : -0.015;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // Flush bark-textured white-limewash lower trunk collar (Gốc cây quét vôi trắng đặc trưng trường đại học Việt Nam)
  if (opts.whitewash !== false) {
    const limeH = 0.52 * scale;
    const lime = new THREE.Mesh(
      new THREE.CylinderGeometry(0.168 * scale, 0.192 * scale, limeH, 10),
      limeWashMat
    );
    lime.position.y = 0.22 * scale + limeH * 0.5;
    lime.castShadow = true;
    g.add(lime);
    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.169 * scale, 0.171 * scale, 0.038 * scale, 10),
      redRingMat
    );
    redBand.position.y = 0.22 * scale + limeH;
    g.add(redBand);
  }

  // Primary & secondary scaffold limbs reaching visibly up into the foliage clusters
  const forkAngles =
    species === 'phuong'
      ? [0.25, 1.52, 2.78, 4.05, 5.3]
      : species === 'bang'
      ? [0.4, 2.5, 4.6]
      : [0.2, 1.75, 3.35, 4.85];

  for (let i = 0; i < forkAngles.length; i += 1) {
    const ang = forkAngles[i];
    const spread = species === 'phuong' ? 0.74 : species === 'bang' ? 0.35 : 0.52;
    const len = (species === 'phuong' ? 1.28 : 0.98) * scale;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * scale, 0.092 * scale, len, 7), barkMat);
    br.position.set(
      Math.cos(ang) * 0.32 * scale,
      trunkH * 0.9 + (i % 2) * 0.1 * scale,
      Math.sin(ang) * 0.32 * scale
    );
    br.rotation.set(Math.sin(ang) * spread, 0, -Math.cos(ang) * spread);
    br.castShadow = true;
    g.add(br);
  }

  const crown = new THREE.Group();
  crown.position.y = trunkH + 0.18 * scale;

  const deepLeaf = getFoliageMat('#1c4d21');
  const midLeaf = getFoliageMat('#28662a');
  const sunLeaf = getFoliageMat('#3a7d31');
  const foliageGeo = new THREE.IcosahedronGeometry(1, 2);
  const subFoliageGeo = new THREE.IcosahedronGeometry(1, 1);

  if (species === 'bang') {
    // Cây Bàng Đài Loan: Visible central leader + horizontal branch whorls + 3 airy multi-pad pagoda tiers!
    const leader = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.095 * scale, 1.15 * scale, 7), barkMat);
    leader.position.y = 0.35 * scale;
    crown.add(leader);

    const tiers = [
      [-0.22, 0.96, 0.22],
      [0.34, 0.72, 0.19],
      [0.84, 0.46, 0.17]
    ];
    tiers.forEach(([ty, rad, th], idx) => {
      // Horizontal whorled branches under each tier
      for (let w = 0; w < 4; w += 1) {
        const wa = (w * Math.PI) / 2 + idx * 0.5;
        const twig = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018 * scale, 0.032 * scale, rad * 0.92 * scale, 5),
          barkMat
        );
        twig.position.set(Math.cos(wa) * rad * 0.42 * scale, (ty - 0.06) * scale, Math.sin(wa) * rad * 0.42 * scale);
        twig.rotation.set(Math.sin(wa) * 1.38, 0, -Math.cos(wa) * 1.38);
        crown.add(twig);
      }
      // Center foliage cushion + 5 outer overlapping leaf sub-lobes for natural scalloped silhouette
      const mat = idx === 2 ? sunLeaf : idx === 1 ? midLeaf : deepLeaf;
      const centerPad = new THREE.Mesh(foliageGeo, mat);
      centerPad.scale.set(rad * 0.78 * scale, th * scale, rad * 0.78 * scale);
      centerPad.position.set(0, ty * scale, 0);
      centerPad.castShadow = true;
      centerPad.receiveShadow = true;
      crown.add(centerPad);
      for (let l = 0; l < 5; l += 1) {
        const la = (l * Math.PI * 2) / 5 + idx * 0.4;
        const sub = new THREE.Mesh(subFoliageGeo, l % 2 === 0 ? sunLeaf : mat);
        sub.scale.set(rad * 0.52 * scale, th * 0.88 * scale, rad * 0.52 * scale);
        sub.position.set(Math.cos(la) * rad * 0.58 * scale, (ty + (l % 2) * 0.03) * scale, Math.sin(la) * rad * 0.58 * scale);
        sub.castShadow = true;
        sub.receiveShadow = true;
        crown.add(sub);
      }
    });
  } else if (species === 'phuong') {
    // Cây Phượng Vĩ: Wide spreading umbrella foliage + 34 delicate clustered scarlet/coral floral sprays!
    const greenPads = [
      [0, 0.24, 0, 1.02, 0.4, 1.02, deepLeaf],
      [-0.86, 0.16, 0.36, 0.76, 0.34, 0.76, midLeaf],
      [0.88, 0.2, -0.32, 0.78, 0.34, 0.78, midLeaf],
      [0.28, 0.18, 0.84, 0.74, 0.33, 0.74, midLeaf],
      [-0.34, 0.22, -0.82, 0.74, 0.34, 0.74, sunLeaf],
      [0.54, 0.42, 0.36, 0.64, 0.3, 0.64, sunLeaf],
      [-0.54, 0.4, -0.28, 0.64, 0.3, 0.64, sunLeaf],
      [-0.18, 0.48, 0.44, 0.54, 0.28, 0.54, sunLeaf],
      [0.22, 0.48, -0.42, 0.54, 0.28, 0.54, sunLeaf]
    ];
    for (let gi = 0; gi < greenPads.length; gi += 1) {
      const [lx, ly, lz, sx, sy, sz, mat] = greenPads[gi];
      const m = new THREE.Mesh(gi < 5 ? foliageGeo : subFoliageGeo, mat);
      m.scale.set(sx * scale, sy * scale, sz * scale);
      m.position.set(lx * scale, ly * scale, lz * scale);
      m.castShadow = true;
      m.receiveShadow = true;
      crown.add(m);
    }
    const redFlowerA = getFoliageMat('#c81e1e');
    const redFlowerB = getFoliageMat('#ea3c1e');
    const blossomGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 34; i += 1) {
      const ring = i < 8 ? 0.28 : i < 20 ? 0.68 : 1.06;
      const ang = i * 2.39996;
      const bx = Math.cos(ang) * ring;
      const bz = Math.sin(ang) * ring;
      const by = 0.58 - ring * 0.22 + (i % 3) * 0.045;
      const rSc = 0.135 + (i % 3) * 0.028;
      const b = new THREE.Mesh(blossomGeo, i % 2 === 0 ? redFlowerA : redFlowerB);
      b.scale.set(rSc * 1.25 * scale, rSc * 0.62 * scale, rSc * scale);
      b.position.set(bx * scale, by * scale, bz * scale);
      b.rotation.set(0.12, ang, 0.08);
      crown.add(b);
    }
    // Scattered fallen crimson phượng petals on the grass below
    const petalMat = stdMat(0xc81e1e, 0.85);
    for (let p = 0; p < 14; p += 1) {
      const pa = p * 2.4;
      const pr = (0.42 + (p % 4) * 0.26) * scale;
      const petal = new THREE.Mesh(new THREE.CircleGeometry(0.045 * scale, 5), petalMat);
      petal.rotation.x = -Math.PI / 2;
      petal.position.set(Math.cos(pa) * pr, 0.035, Math.sin(pa) * pr);
      g.add(petal);
    }
  } else if (species === 'banglang') {
    // Cây Bằng Lăng Tím: Rounded lush canopy studded with 28 upright lavender-violet flower panicles!
    const lobes = [
      [0, 0.52, 0, 0.86, 0.68, 0.86, deepLeaf],
      [-0.58, 0.28, 0.28, 0.64, 0.52, 0.64, midLeaf],
      [0.6, 0.32, -0.24, 0.64, 0.54, 0.64, midLeaf],
      [0.2, 0.3, 0.6, 0.58, 0.5, 0.58, sunLeaf],
      [-0.22, 0.34, -0.58, 0.6, 0.5, 0.6, midLeaf],
      [0.12, 0.86, 0.08, 0.54, 0.44, 0.54, sunLeaf]
    ];
    for (let li = 0; li < lobes.length; li += 1) {
      const [lx, ly, lz, sx, sy, sz, mat] = lobes[li];
      const m = new THREE.Mesh(li === 0 ? foliageGeo : subFoliageGeo, mat);
      m.scale.set(sx * scale, sy * scale, sz * scale);
      m.position.set(lx * scale, ly * scale, lz * scale);
      m.castShadow = true;
      m.receiveShadow = true;
      crown.add(m);
    }
    const violetA = getFoliageMat('#7c3aed');
    const violetB = getFoliageMat('#a855f7');
    const panicleGeo = new THREE.ConeGeometry(0.095 * scale, 0.24 * scale, 5);
    for (let i = 0; i < 28; i += 1) {
      const ring = i < 7 ? 0.24 : i < 18 ? 0.58 : 0.84;
      const ang = i * 2.39996 + 0.5;
      const bx = Math.cos(ang) * ring;
      const bz = Math.sin(ang) * ring;
      const by = 0.98 - ring * 0.38 + (i % 2) * 0.06;
      const b = new THREE.Mesh(panicleGeo, i % 2 === 0 ? violetA : violetB);
      b.position.set(bx * scale, by * scale, bz * scale);
      b.rotation.set(Math.sin(ang) * 0.28, 0, -Math.cos(ang) * 0.28);
      crown.add(b);
    }
  } else {
    // Cây Sao Đen / Dầu Rái: Majestic multi-lobed deep tropical hardwood canopy
    const lobes = [
      [0, 0.56, 0, 0.86, 0.72, 0.86, deepLeaf],
      [-0.62, 0.24, 0.3, 0.64, 0.54, 0.64, midLeaf],
      [0.64, 0.3, -0.24, 0.66, 0.56, 0.66, midLeaf],
      [0.2, 0.28, 0.64, 0.58, 0.52, 0.58, midLeaf],
      [-0.24, 0.34, -0.6, 0.6, 0.52, 0.6, midLeaf],
      [-0.38, 0.88, 0.18, 0.54, 0.46, 0.54, sunLeaf],
      [0.36, 0.92, -0.16, 0.54, 0.46, 0.54, sunLeaf],
      [0.02, 1.22, 0.04, 0.5, 0.44, 0.5, sunLeaf]
    ];
    for (let li = 0; li < lobes.length; li += 1) {
      const [lx, ly, lz, sx, sy, sz, mat] = lobes[li];
      const mesh = new THREE.Mesh(li < 3 ? foliageGeo : subFoliageGeo, mat);
      mesh.scale.set(sx * scale, sy * scale, sz * scale);
      mesh.position.set(lx * scale, ly * scale, lz * scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      crown.add(mesh);
    }
  }

  optimizeStaticSubtree(crown, null, { unifyShadows: { cast: true, receive: true } });
  g.add(crown);
  if (swayingList) {
    optimizeStaticSubtree(g, new Set([crown]));
    swayingList.push({ crown, phase: Math.random() * Math.PI * 2 });
  } else {
    optimizeStaticSubtree(g);
  }
  return g;
}

export function createInstancedNature(parent, getTerrainY, isBlockedFn) {
  let seed = 777;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // 1. 460 Grounded Natural Tropical Grass Tufts across campus lawns & hills
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.32, 4);
  const tuftMat = stdMat(0xffffff, 0.88, 0, 'instTuft');
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 460);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const greens = [0x2d6424, 0x39752b, 0x4b8330, 0x24531d];

  let placed = 0;
  let attempts = 0;
  while (placed < 460 && attempts < 2800) {
    attempts += 1;
    const x = (rand() - 0.5) * 98;
    const z = (rand() - 0.5) * 80;
    if (isBlockedFn(x, z)) continue;
    const y = getTerrainY(x, z);
    dummy.position.set(x, y + 0.12, z);
    dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
    const sc = 0.7 + rand() * 0.8;
    dummy.scale.set(sc, sc * (0.75 + rand() * 0.55), sc);
    dummy.updateMatrix();
    tufts.setMatrixAt(placed, dummy.matrix);
    color.setHex(greens[placed % greens.length]);
    tufts.setColorAt(placed, color);
    placed += 1;
  }
  tufts.count = placed;
  tufts.receiveShadow = true;
  parent.add(tufts);

  // 2. 140 Low-Lying Flowering Shrub Cushions rooted flush with the grass lawn!
  const shrubGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const shrubMat = stdMat(0x285e22, 0.86, 0, 'instShrub');
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, 140);

  const flowerGeo = new THREE.DodecahedronGeometry(0.09, 0);
  const flowerMat = stdMat(0xffffff, 0.76, 0, 'instFlwr');
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 140);
  const fColors = [0xd99b16, 0xc83e5b, 0xd4d0c8, 0xd96b1f, 0x8b3fd9];

  let fPlaced = 0;
  attempts = 0;
  while (fPlaced < 140 && attempts < 1800) {
    attempts += 1;
    const x = (rand() - 0.5) * 68;
    const z = (rand() - 0.5) * 52;
    if (isBlockedFn(x, z)) continue;
    const y = getTerrainY(x, z);
    const sc = 0.8 + rand() * 0.6;

    dummy.position.set(x, y + 0.04, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(sc * 1.25, sc * 0.42, sc * 1.25);
    dummy.updateMatrix();
    shrubs.setMatrixAt(fPlaced, dummy.matrix);

    dummy.position.set(x, y + 0.1, z);
    dummy.scale.set(sc * 0.95, sc * 0.45, sc * 0.95);
    dummy.updateMatrix();
    flowers.setMatrixAt(fPlaced, dummy.matrix);
    color.setHex(fColors[fPlaced % fColors.length]);
    flowers.setColorAt(fPlaced, color);
    fPlaced += 1;
  }
  shrubs.count = fPlaced;
  shrubs.receiveShadow = true;
  flowers.count = fPlaced;
  parent.add(shrubs, flowers);

  // 3. Angular Quarry Shore Boulders ringing Hồ Đá (x = 26.5, z = -10.8) — rock-textured & strictly clear of sidewalk + viewing deck!
  const rockMaps = getRockCliffMaps(1, 1);
  const rockGeo = new THREE.DodecahedronGeometry(0.46, 0);
  const rockMat = stdMat(0xffffff, 0.9, 0.04, 'instRockTex', {
    map: rockMaps.map,
    bumpMap: rockMaps.bumpMap,
    bumpScale: 0.12,
    flatShading: true
  });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 68);
  const stoneShades = [0xd8d2ca, 0xbab3aa, 0xe5dfd6, 0x9e978f];
  let rPlaced = 0;
  for (let i = 0; i < 68; i += 1) {
    const ang = (i / 68) * Math.PI * 2 + (rand() - 0.5) * 0.14;
    const rad = 6.18 + (rand() - 0.3) * 1.15;
    const rx = 26.5 + Math.cos(ang) * rad;
    const rz = -10.8 + Math.sin(ang) * rad;
    // Keep shore boulders strictly off the Đại lộ Tạ Quang Bửu sidewalk (z >= -4.95) and off the wooden viewing deck!
    if (rz > -4.95) continue;
    if (rx > 20.0 && rx < 25.9 && rz > -7.5 && rz < -3.4) continue;
    dummy.position.set(rx, 0.05 + rand() * 0.22, rz);
    dummy.rotation.set(rand() * 2, rand() * 2, rand() * 2);
    dummy.scale.set(0.68 + rand() * 1.05, 0.46 + rand() * 0.68, 0.68 + rand() * 0.95);
    dummy.updateMatrix();
    rocks.setMatrixAt(rPlaced, dummy.matrix);
    color.setHex(stoneShades[i % stoneShades.length]);
    rocks.setColorAt(rPlaced, color);
    rPlaced += 1;
  }
  rocks.count = rPlaced;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  parent.add(rocks);
}

export function addBalconyBay(parent, x, y, z, w = 0.95, d = 0.38, hasPlant = true, hasAC = false, hasLaundry = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const slabMat = stdMat(0xc4cdd6, 0.72);
  const railMat = stdMat(0x293548, 0.42, 0.65);

  const slab = new THREE.Mesh(new RoundedBoxGeometry(w, 0.08, d, 1, 0.02), slabMat);
  slab.position.set(0, 0, d * 0.5);
  slab.castShadow = true;
  slab.receiveShadow = true;
  g.add(slab);

  // Top handrail + vertical balusters
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.035), railMat);
  rail.position.set(0, 0.34, d - 0.03);
  g.add(rail);
  const numBars = 5;
  for (let b = 0; b < numBars; b += 1) {
    const px = -w * 0.45 + (b * (w * 0.9)) / (numBars - 1);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.025), railMat);
    post.position.set(px, 0.17, d - 0.03);
    g.add(post);
  }

  if (hasPlant) {
    const pot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 0.13, 0.13), stdMat(0x9a4212, 0.82));
    pot.position.set(-w * 0.18, 0.1, d * 0.52);
    g.add(pot);
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.105, 0), stdMat(0x28692b, 0.84));
    bush.scale.set(1.4, 0.85, 0.8);
    bush.position.set(-w * 0.18, 0.21, d * 0.52);
    g.add(bush);
  }

  if (hasAC) {
    // Detailed Vietnamese apartment split-AC outdoor condenser unit + fan grille
    const acBox = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.2, 0.14, 1, 0.02), stdMat(0xcfd6de, 0.52));
    acBox.position.set(w * 0.24, 0.14, d * 0.34);
    acBox.castShadow = true;
    g.add(acBox);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.02, 10), stdMat(0x1e293b, 0.75));
    fan.rotation.x = Math.PI / 2;
    fan.position.set(w * 0.21, 0.14, d * 0.42);
    g.add(fan);
  }

  if (hasLaundry) {
    // Student shirts drying on balcony rod
    const colors = [0x38bdf8, 0xfda4af, 0xfef08a];
    for (let c = 0; c < 2; c += 1) {
      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.2, 0.02),
        stdMat(colors[(Math.abs(Math.round(x * 10)) + c) % colors.length], 0.85)
      );
      cloth.position.set(-0.12 + c * 0.18, 0.24, d * 0.68);
      g.add(cloth);
    }
  }

  parent.add(g);
}

export function addInoxWaterTank(parent, x, y, z) {
  const inoxMat = stdMat(0xd4dce4, 0.18, 0.88);
  const frameMat = stdMat(0x1d4ed8, 0.5, 0.55);
  // Tubular blue steel cradle legs + horizontal beams
  for (const lz of [-0.14, 0.14]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.045), frameMat);
    beam.position.set(x, y + 0.19, z + lz);
    beam.castShadow = true;
    parent.add(beam);
    for (const lx of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), frameMat);
      leg.position.set(x + lx, y + 0.1, z + lz);
      leg.castShadow = true;
      parent.add(leg);
    }
  }

  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 8, 14), inoxMat);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(x, y + 0.42, z);
  tank.castShadow = true;
  parent.add(tank);

  // Characteristic rolled stainless-steel reinforcing ribs
  for (const rx of [-0.16, 0, 0.16]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.009, 6, 14), inoxMat);
    rib.rotation.y = Math.PI / 2;
    rib.position.set(x + rx, y + 0.42, z);
    parent.add(rib);
  }

  // Top inspection dome cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), inoxMat);
  cap.position.set(x, y + 0.64, z);
  cap.castShadow = true;
  parent.add(cap);
}

export function addSolarArray(parent, x, y, z, w = 2.2, d = 1.4) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.x = 0.26;
  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(w + 0.1, 0.06, d + 0.1, 1, 0.02),
    stdMat(0x94a3b8, 0.35, 0.78)
  );
  frame.castShadow = true;
  g.add(frame);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), stdMat(0x172554, 0.16, 0.72));
  cell.position.y = 0.03;
  g.add(cell);
  // Silver photovoltaic busbars
  const barMat = stdMat(0xcbd5e1, 0.3, 0.8);
  for (let bx = -w * 0.33; bx <= w * 0.34; bx += w * 0.33) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, d), barMat);
    b.position.set(bx, 0.03, 0);
    g.add(b);
  }
  parent.add(g);
}

export function addFairyLightGarland(parent, p1, p2, sag = 0.35, count = 7, fairyBulbs = null) {
  const points = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const x = THREE.MathUtils.lerp(p1[0], p2[0], t);
    const z = THREE.MathUtils.lerp(p1[2], p2[2], t);
    const y = THREE.MathUtils.lerp(p1[1], p2[1], t) - Math.sin(t * Math.PI) * sag;
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.014, 4, false), stdMat(0x1e293b, 0.8));
  parent.add(wire);

  const bulbGeo = new THREE.SphereGeometry(0.052, 6, 6);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.32,
    roughness: 0.25
  });
  if (fairyBulbs) fairyBulbs.push(bulbMat);

  for (let b = 1; b < count; b += 1) {
    const pos = curve.getPoint(b / count);
    const m = new THREE.Mesh(bulbGeo, bulbMat);
    m.position.copy(pos);
    m.position.y -= 0.04;
    parent.add(m);
  }
}

export function addPlasticStool(parent, x, z, colorHex = 0xdc2626) {
  // Authentic 4-legged molded Vietnamese street plastic stool (Ghế đẩu nhựa Duy Tân)
  const st = new THREE.Group();
  st.position.set(x, 0, z);
  const mat = stdMat(colorHex, 0.42, 0.04);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.035, 0.22, 1, 0.012), mat);
  seat.position.y = 0.27;
  seat.castShadow = true;
  st.add(seat);
  for (const lx of [-0.085, 0.085]) {
    for (const lz of [-0.085, 0.085]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.27, 0.026), mat);
      leg.position.set(lx, 0.135, lz);
      leg.rotation.set(lz * 0.7, 0, -lx * 0.7);
      st.add(leg);
    }
  }
  parent.add(st);
}

export function addStreetDiningSet(parent, x, z, umbrellaColor = 0xc2410c, withDiners = false, dinerSeed = 0, baseY = 0) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  const wood = getWoodPlankMaps(1, 1);

  // Folding stainless/wood street table
  const top = new THREE.Mesh(
    new RoundedBoxGeometry(0.78, 0.05, 0.68, 1, 0.02),
    stdMat(0xffffff, 0.62, 0.05, 'dinetop', { map: wood.map })
  );
  top.position.y = 0.5;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const legMat = stdMat(0x64748b, 0.4, 0.7);
  for (const [lx, lz] of [
    [-0.3, -0.26],
    [0.3, -0.26],
    [-0.3, 0.26],
    [0.3, 0.26]
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), legMat);
    leg.position.set(lx, 0.25, lz);
    g.add(leg);
  }

  // Tiny Phở bowls, iced-tea cups & chopstick holder right on tabletop!
  const bowlMat = stdMat(0xd4dce4, 0.3);
  const brothMat = stdMat(0xb45309, 0.35);
  for (const [bx, bz] of [
    [-0.18, -0.1],
    [0.18, 0.1]
  ]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.045, 0.05, 10), bowlMat);
    bowl.position.set(bx, 0.55, bz);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.068, 8), brothMat);
    soup.rotation.x = -Math.PI / 2;
    soup.position.set(bx, 0.576, bz);
    g.add(bowl, soup);
  }
  const chopsticks = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.09, 8), stdMat(0x0284c7, 0.5));
  chopsticks.position.set(0, 0.57, -0.15);
  g.add(chopsticks);

  // 4 authentic 4-legged plastic stools
  const stoolCol = umbrellaColor === 0xc2410c || umbrellaColor === 0xea580c ? 0xdc2626 : 0x1d4ed8;
  for (const [sx, sz] of [
    [-0.5, 0],
    [0.5, 0],
    [0, -0.48],
    [0, 0.48]
  ]) {
    addPlasticStool(g, sx, sz, stoolCol);
  }

  // Seated student diners enjoying street food (feet flush with deck surface)!
  if (withDiners) {
    const d1 = createDetailedPerson(dinerSeed + 2, 'modern', 'sit', { prop: 'none', staticSit: true });
    d1.position.set(-0.5, 0.03, 0);
    d1.rotation.y = Math.PI / 2;
    d1.scale.setScalar(0.84);
    g.add(d1);

    const d2 = createDetailedPerson(dinerSeed + 7, 'modern', 'sit', { prop: 'none', staticSit: true });
    d2.position.set(0.5, 0.03, 0);
    d2.rotation.y = -Math.PI / 2;
    d2.scale.setScalar(0.84);
    g.add(d2);
  }

  // Sun parasol
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 1.62, 6), legMat);
  pole.position.y = 0.81;
  g.add(pole);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.32, 8), stdMat(umbrellaColor, 0.68));
  cap.position.y = 1.62;
  cap.castShadow = true;
  g.add(cap);

  parent.add(g);
}

export function addTrafficLight(parent, x, z, rotY = 0, signalList = null, groupOffset = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);
  g.rotation.y = rotY;
  const poleMat = stdMat(0x293548, 0.42, 0.72);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.45, 8), poleMat);
  post.position.y = 1.22;
  post.castShadow = true;
  g.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.98), poleMat);
  arm.position.set(0, 2.36, 0.46);
  g.add(arm);

  const box = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.62, 0.18, 1, 0.03), stdMat(0x0f172a, 0.6, 0.3));
  box.position.set(0, 2.28, 0.92);
  g.add(box);

  const lensGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.08 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.08 });

  for (const [mat, ly] of [
    [redMat, 2.47],
    [amberMat, 2.28],
    [greenMat, 2.09]
  ]) {
    const lens = new THREE.Mesh(lensGeo, mat);
    lens.position.set(0, ly, 1.0);
    g.add(lens);
  }
  if (signalList) signalList.push({ redMat, amberMat, greenMat, offset: groupOffset });
  parent.add(g);
  return g;
}

export function addParkBench(parent, x, z, rotY = 0, withSitter = false, sitterSeed = 1, baseY = 0.1, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  addContactShadow(g, 1.54, 0.62, 0, 0.012, 0, 0.52);

  const isLakeside = opts.variant === 'lakeside';
  const slatMat = isLakeside
    ? stdMat(0xdcd6c8, 0.52, 0.04) // Crisp light ivory-ash painted timber slats for high contrast on dark wood decks!
    : stdMat(0xd4a36a, 0.62, 0.04); // Warm light honey-oak slats distinct from dark walnut decks
  const frameMat = isLakeside ? stdMat(0x273445, 0.36, 0.78) : stdMat(0x1e293b, 0.42, 0.75);
  const trimSteel = stdMat(0x94a3b8, 0.28, 0.84);

  // 3 individual contoured horizontal seat slats with visible shadow gaps
  for (const sz of [-0.135, 0, 0.135]) {
    const slat = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.045, 0.11, 1, 0.015), slatMat);
    slat.position.set(0, 0.35, sz);
    slat.castShadow = true;
    slat.receiveShadow = true;
    g.add(slat);
  }

  // 3 individual angled backrest slats
  for (const [by, bz] of [
    [0.47, -0.17],
    [0.575, -0.19],
    [0.68, -0.21]
  ]) {
    const bSlat = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.082, 0.042, 1, 0.014), slatMat);
    bSlat.position.set(0, by, bz);
    bSlat.rotation.x = -0.18;
    bSlat.castShadow = true;
    bSlat.receiveShadow = true;
    g.add(bSlat);
  }

  // Cast-iron / brushed-steel end frames, backrest spines, curved armrests & base mounting plates
  const tieBar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.035, 0.035), trimSteel);
  tieBar.position.set(0, 0.2, -0.02);
  g.add(tieBar);

  for (const lx of [-0.58, 0.58]) {
    const fLeg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), frameMat);
    fLeg.position.set(lx, 0.17, 0.15);
    fLeg.castShadow = true;
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.71, 0.055), frameMat);
    rLeg.position.set(lx, 0.35, -0.17);
    rLeg.rotation.x = -0.1;
    rLeg.castShadow = true;
    const seatBeam = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.4), frameMat);
    seatBeam.position.set(lx, 0.32, -0.01);
    const armRest = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.042, 0.38, 1, 0.015), frameMat);
    armRest.position.set(lx, 0.5, -0.01);
    armRest.castShadow = true;
    const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.16, 0.045), frameMat);
    armPost.position.set(lx, 0.41, 0.14);
    const footPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.46), trimSteel);
    footPlate.position.set(lx, 0.01, -0.01);
    g.add(fLeg, rLeg, seatBeam, armRest, armPost, footPlate);
  }

  if (withSitter) {
    const sitter = createDetailedPerson(sitterSeed, 'modern', 'sit', { prop: 'books', staticSit: true });
    sitter.position.set(opts.twoSitters ? -0.31 : -0.22, 0.11, -0.03);
    sitter.scale.setScalar(0.86);
    g.add(sitter);

    if (opts.twoSitters) {
      const friend = createDetailedPerson(sitterSeed + 4, 'modern', 'sit', { prop: 'boba', staticSit: true });
      friend.position.set(0.31, 0.11, -0.03);
      friend.rotation.y = -0.12;
      friend.scale.setScalar(0.85);
      g.add(friend);
    }
  }

  parent.add(g);
  return g;
}

export function addFlagpole(parent, x, z, flagMeshes = null) {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);

  // Ceremonial stepped granite base pedestal
  const pedMat = stdMat(0x94a3b8, 0.72, 0.08);
  const p1 = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.18, 1.3, 1, 0.03), pedMat);
  p1.position.y = 0.09;
  p1.receiveShadow = true;
  const p2 = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.22, 0.86, 1, 0.03), pedMat);
  p2.position.y = 0.28;
  p2.castShadow = true;
  g.add(p1, p2);

  const steelMat = stdMat(0xd4dce4, 0.22, 0.88);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.072, 5.1, 10), steelMat);
  pole.position.y = 2.75;
  pole.castShadow = true;
  g.add(pole);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), stdMat(0xd97706, 0.25, 0.85));
  finial.position.y = 5.34;
  g.add(finial);

  const tex = getNationalFlagTexture();
  const flagGeo = new THREE.PlaneGeometry(1.55, 0.98, 14, 6);
  flagGeo.translate(0.775, 0, 0);

  // GPU Vertex-Shader cloth simulation with analytical partial-derivative normals (silky folds, 0% CPU!)
  const flagUniforms = { uFlagTime: { value: 0 } };
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.64,
    metalness: 0.0,
    map: tex,
    side: THREE.DoubleSide
  });
  flagMat.customProgramCacheKey = () => 'vn-flag-cloth-wave-v1';
  flagMat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlagTime = flagUniforms.uFlagTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFlagTime;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float fU = clamp(position.x / 1.55, 0.0, 1.0);
float fPhase = position.x * 4.2 - uFlagTime * 5.8 + position.y * 1.2;
float dzdx = (cos(fPhase) * 4.2 * fU + sin(fPhase) / 1.55) * 0.14;
float dzdy = cos(fPhase) * 1.2 * 0.14 * fU;
objectNormal = normalize(vec3(-dzdx, -dzdy, 1.0));`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float fU2 = clamp(position.x / 1.55, 0.0, 1.0);
transformed.z += sin(position.x * 4.2 - uFlagTime * 5.8 + position.y * 1.2) * 0.14 * fU2;`
      );
  };

  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0, 4.72, 0);
  flag.castShadow = true;
  flag.userData.flagUniforms = flagUniforms;
  g.add(flag);
  if (flagMeshes) flagMeshes.push(flag);
  parent.add(g);
  return g;
}

export function addBougainvilleaPlanter(parent, x, y, z, w = 1.4, d = 1.4) {
  // Authentic Vietnamese Campus Bougainvillea (Bồn hoa giấy ngũ sắc) — stone curb + leafy green cushion + vibrant magenta/coral bracts!
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, 0.36, d, 1, 0.04), stdMat(0x78716c, 0.84));
  box.position.y = 0.18;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.06, d - 0.18), stdMat(0x3b2a1e, 0.95));
  soil.position.y = 0.35;
  g.add(soil);

  const leafMat = getFoliageMat('#256328');
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  for (const [bx, by, bz, sx, sy, sz] of [
    [0, 0.52, 0, w * 0.42, 0.24, d * 0.42],
    [-w * 0.2, 0.46, d * 0.16, w * 0.28, 0.2, d * 0.28],
    [w * 0.22, 0.48, -d * 0.15, w * 0.28, 0.2, d * 0.28]
  ]) {
    const mound = new THREE.Mesh(bushGeo, leafMat);
    mound.scale.set(sx, sy, sz);
    mound.position.set(bx, by, bz);
    mound.castShadow = true;
    g.add(mound);
  }

  const magentaMat = getFoliageMat('#be185d');
  const roseMat = getFoliageMat('#e11d48');
  for (let i = 0; i < 12; i += 1) {
    const ang = i * 2.39996;
    const rad = (0.14 + (i % 3) * 0.12) * Math.min(w, d);
    const fl = new THREE.Mesh(bushGeo, i % 2 === 0 ? magentaMat : roseMat);
    fl.scale.set(0.11, 0.08, 0.11);
    fl.position.set(Math.cos(ang) * rad, 0.64 - (i % 3) * 0.05, Math.sin(ang) * rad);
    g.add(fl);
  }
  parent.add(g);
  return g;
}

export function addParkedBikesRow(parent, x, z, count = 4, rotY = 0, era = 'modern', baseY = 0) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  const colors =
    era === 'baocap'
      ? [0x3f5232, 0x1e293b, 0x5c3a21, 0x2b4c7e]
      : [0x991b1b, 0x1e3a8a, 0xc7cfd9, 0x0f766e, 0xb45309, 0x111827];
  const tireMat = stdMat(0x18181b, 0.9);
  const trimMat = stdMat(0x1e293b, 0.75);
  const chromeMat = stdMat(0xcbd5e1, 0.26, 0.85);
  const lampMat = stdMat(0xfef9c3, 0.2, 0.1);
  const tailMat = stdMat(0xdc2626, 0.3, 0.1);

  for (let i = 0; i < count; i += 1) {
    const bx = (i - (count - 1) / 2) * 0.56;
    const bike = new THREE.Group();
    bike.position.set(bx, 0, (i % 2) * 0.06);
    bike.rotation.y = ((i % 3) - 1) * 0.06;
    bike.rotation.z = 0.09; // Leaning naturally on side kickstand!

    const pMat = stdMat(colors[i % colors.length], 0.28, 0.35);

    for (const wz of [-0.24, 0.24]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.032, 6, 12), tireMat);
      tire.rotation.y = Math.PI / 2;
      tire.position.set(0, 0.135, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 8), chromeMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(0, 0.135, wz);
      bike.add(tire, hub);
    }

    // Side kickstand touching ground
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), trimMat);
    stand.position.set(-0.06, 0.09, -0.02);
    stand.rotation.z = 0.38;
    bike.add(stand);

    if (era === 'baocap' && i % 2 === 0) {
      // Complete parked 1980s diamond-frame bicycle
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.46), pMat);
      bar.position.set(0, 0.33, 0);
      const downTube = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.28, 0.024), pMat);
      downTube.position.set(0, 0.24, 0.1);
      downTube.rotation.x = 0.65;
      const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.28, 6), pMat);
      seatTube.position.set(0, 0.26, -0.08);
      const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.13, 1, 0.01), trimMat);
      saddle.position.set(0, 0.41, -0.09);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), chromeMat);
      stem.position.set(0, 0.32, 0.22);
      stem.rotation.x = -0.18;
      bike.add(bar, downTube, seatTube, saddle, stem);
    } else {
      // Complete parked scooter with front forks, fender, floorboard, cowl, headlight & mirrors!
      for (const fx of [-0.042, 0.042]) {
        const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 6), chromeMat);
        fork.position.set(fx, 0.25, 0.21);
        fork.rotation.x = -0.22;
        bike.add(fork);
      }
      const fender = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.045, 0.15, 1, 0.018), pMat);
      fender.position.set(0, 0.23, 0.25);
      fender.rotation.x = 0.2;
      const floor = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.05, 0.26, 1, 0.015), trimMat);
      floor.position.set(0, 0.16, 0.04);
      const rearBody = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.19, 0.36, 1, 0.045), pMat);
      rearBody.position.set(0, 0.28, -0.12);
      rearBody.castShadow = true;
      const apron = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.3, 0.13, 1, 0.04), pMat);
      apron.position.set(0, 0.32, 0.16);
      apron.rotation.x = -0.22;
      apron.castShadow = true;
      const seat = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.065, 0.34, 1, 0.025), trimMat);
      seat.position.set(0, 0.39, -0.1);
      const cowl = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.08, 0.1, 1, 0.025), pMat);
      cowl.position.set(0, 0.5, 0.15);
      const hLight = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), lampMat);
      hLight.position.set(0, 0.5, 0.2);
      const tLight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.025), tailMat);
      tLight.position.set(0, 0.34, -0.3);
      bike.add(fender, floor, rearBody, apron, seat, cowl, hLight, tLight);

      for (const mx of [-0.13, 0.13]) {
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.02), trimMat);
        mir.position.set(mx, 0.58, 0.15);
        bike.add(mir);
      }
    }

    const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), trimMat);
    hBar.rotation.z = Math.PI / 2;
    hBar.position.set(0, 0.5, 0.15);
    bike.add(hBar);

    g.add(bike);
  }
  parent.add(g);
}

export function addUtilityPole(parent, x, z, kind = 'baocap') {
  const g = new THREE.Group();
  g.position.set(x, 0.1, z);
  const concMat = stdMat(0x7c8591, 0.88, 0.04);
  const ironMat = stdMat(0x334155, 0.5, 0.65);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.105, 3.8, 8), concMat);
  pole.position.y = 1.9;
  pole.castShadow = true;
  g.add(pole);

  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.06), ironMat);
  cross.position.set(0, 3.55, 0);
  g.add(cross);

  if (kind === 'baocap') {
    // Authentic 1980s Conical Iron Loudspeaker Horns (Loa phóng thanh hợp tác xã / khu tập thể)
    const hornMat = stdMat(0x94a3b8, 0.42, 0.68);
    for (const dir of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 10, 1, true), hornMat);
      horn.position.set(dir * 0.22, 3.22, 0.1);
      horn.rotation.z = dir * 1.15;
      horn.rotation.x = 0.25;
      g.add(horn);
    }
  } else if (kind === 'thanoi') {
    // Tangled black telecom cable loops ("Mạng nhện dây điện" in Stage 2 unregulated market!)
    const wireMat = stdMat(0x111827, 0.85, 0.05);
    for (let c = 0; c < 3; c += 1) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.19 + c * 0.03, 0.022, 6, 14), wireMat);
      coil.position.set(0.08, 2.65 + c * 0.08, 0.08);
      coil.rotation.y = c * 0.4;
      g.add(coil);
    }
    const junctionBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.14), stdMat(0xcbd5e1, 0.6));
    junctionBox.position.set(0, 1.85, 0.11);
    g.add(junctionBox);
  }

  parent.add(g);
  return g;
}

export function addModernAvenueLamp(parent, x, z, dirZ = 1, streetLampBulbs = null, streetName = '') {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0.12, z);

  const poleMat = stdMat(0x273445, 0.38, 0.72);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.088, 2.95, 8), poleMat);
  pole.position.y = 1.48;
  pole.castShadow = true;
  lamp.add(pole);

  // Curved gooseneck arm + modern flat Cobra-head LED luminaire
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.82), poleMat);
  arm.position.set(0, 2.9, dirZ * 0.36);
  arm.rotation.x = -dirZ * 0.12;
  lamp.add(arm);

  const headHousing = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.07, 0.36, 1, 0.02), poleMat);
  headHousing.position.set(0, 2.94, dirZ * 0.74);
  lamp.add(headHousing);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.25,
    roughness: 0.25
  });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.28), bulbMat);
  lens.position.set(0, 2.9, dirZ * 0.74);
  lamp.add(lens);
  if (streetLampBulbs) streetLampBulbs.push(bulbMat);

  // Mini rooftop solar panel on smart campus lamppost
  const pv = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.24), stdMat(0x172554, 0.2, 0.7));
  pv.position.set(0, 3.04, 0);
  pv.rotation.x = 0.28;
  lamp.add(pv);

  // Vertical cyan/emerald ĐHQG student welcome banner
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.68, 0.22), stdMat(0x0284c7, 0.55));
  banner.position.set(0, 1.95, -dirZ * 0.14);
  lamp.add(banner);

  if (streetName) {
    const signMat = createStreetSignMaterial('ĐƯỜNG', streetName, '#1e3a8a', '#f8fafc', '#cbd5e1');
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.26, 0.04), signMat);
    blade.position.set(0.36, 2.32, 0);
    lamp.add(blade);
  }

  parent.add(lamp);
  return lamp;
}

export function addPublicTrashBin(parent, x, z, rotY = 0) {
  // Vietnamese 2-compartment Waste Sorting Bins (Xanh Hữu cơ - Cam Tái chế)
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);
  g.rotation.y = rotY;
  const frameMat = stdMat(0x334155, 0.45, 0.65);

  const roof = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.05, 0.38, 1, 0.015), frameMat);
  roof.position.y = 0.66;
  g.add(roof);

  const b1 = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.46, 0.26, 1, 0.03), stdMat(0x15803d, 0.5));
  b1.position.set(-0.15, 0.32, 0);
  b1.castShadow = true;
  const b2 = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.46, 0.26, 1, 0.03), stdMat(0xc2410c, 0.5));
  b2.position.set(0.15, 0.32, 0);
  b2.castShadow = true;
  g.add(b1, b2);

  parent.add(g);
}

export function addFireHydrant(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);
  const redMat = stdMat(0xb91c1c, 0.38, 0.25);
  const capMat = stdMat(0xcbd5e1, 0.3, 0.8);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.48, 8), redMat);
  body.position.y = 0.24;
  body.castShadow = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.088, 8, 6), redMat);
  dome.position.y = 0.48;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 6), capMat);
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.y = 0.34;
  g.add(body, dome, nozzle);
  parent.add(g);
}

export function addManholeAndGrates(parent, x, z, opts = {}) {
  const isNS = Math.abs(z) > 2.6;
  const roadY = opts.roadY ?? (isNS ? 0.14 : 0.15);

  const mhMaps = getManholeMaps();
  const manholeMat = stdMat(0xffffff, 0.52, 0.68, 'manholelid', {
    map: mhMaps.map,
    bumpMap: mhMaps.bumpMap,
    bumpScale: 0.028
  });
  const collarMat = stdMat(0x4b5563, 0.82, 0.18);

  // Flush concrete/cast-iron seating collar + ribbed cast-iron manhole cover (realistic Ø0.52m scale, zero far-zoom z-fighting!)
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.315, 0.008, 22), collarMat);
  collar.position.set(x, roadY + 0.004, z);
  collar.receiveShadow = true;
  parent.add(collar);

  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.01, 22), manholeMat);
  cover.position.set(x, roadY + 0.007, z);
  cover.receiveShadow = true;
  parent.add(cover);

  // Curbside slotted cast-iron storm-drain grates (Song chắn rác thoát nước sát vỉa hè) + curb throat inlet!
  const grMaps = getStormGrateMaps();
  const grateMat = stdMat(0xffffff, 0.46, 0.72, 'stormgrate', {
    map: grMaps.map,
    bumpMap: grMaps.bumpMap,
    bumpScale: 0.03
  });
  const throatMat = stdMat(0x0b0f17, 0.92, 0.05);

  if (!isNS) {
    for (const side of [-1, 1]) {
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.29), grateMat);
      grate.position.set(x, roadY + 0.005, side * 2.38);
      grate.receiveShadow = true;
      const throat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.055, 0.045), throatMat);
      throat.position.set(x, roadY + 0.026, side * 2.53);
      parent.add(grate, throat);
    }
  } else {
    for (const side of [-1, 1]) {
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.01, 0.56), grateMat);
      grate.position.set(side * 2.12, roadY + 0.005, z);
      grate.receiveShadow = true;
      const throat = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.5), throatMat);
      throat.position.set(side * 2.27, roadY + 0.026, z);
      parent.add(grate, throat);
    }
  }
}

export function addRoadSign(parent, x, z, rotY = 0, kind = 'crosswalk') {
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);
  g.rotation.y = rotY;

  const steelMat = stdMat(0xcbd5e1, 0.32, 0.82);
  const backMat = stdMat(0x64748b, 0.45, 0.65);

  // Galvanized steel sign post + concrete base collar
  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.08, 8), stdMat(0x94a3b8, 0.8));
  baseCollar.position.y = 0.04;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 1.58, 8), steelMat);
  pole.position.y = 0.79;
  pole.castShadow = true;
  g.add(baseCollar, pole);

  if (kind === 'roundabout') {
    const signTex = getTrafficSignTexture('roundabout');
    const faceMat = stdMat(0xffffff, 0.36, 0.12, 'r303face', { map: signTex });
    // Galvanized backing disc + mounting brackets (clear Z separation prevents grazing z-fighting!)
    const backDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.016, 20), backMat);
    backDisc.rotation.x = Math.PI / 2;
    backDisc.position.set(0, 1.52, -0.008);
    backDisc.castShadow = true;
    const frontDisc = new THREE.Mesh(new THREE.CircleGeometry(0.23, 20), faceMat);
    frontDisc.position.set(0, 1.52, 0.012);
    const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), steelMat);
    clamp1.position.set(0, 1.6, -0.018);
    const clamp2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), steelMat);
    clamp2.position.set(0, 1.44, -0.018);
    g.add(backDisc, frontDisc, clamp1, clamp2);
  } else if (kind === 'danger') {
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.024, 3), stdMat(0xfacc15, 0.45));
    tri.rotation.x = Math.PI / 2;
    tri.position.y = 1.52;
    const border = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 3), stdMat(0xdc2626, 0.45));
    border.rotation.x = Math.PI / 2;
    border.position.set(0, 1.52, -0.005);
    border.castShadow = true;
    g.add(border, tri);
  } else {
    const signTex = getTrafficSignTexture('crosswalk');
    const faceMat = stdMat(0xffffff, 0.36, 0.12, 'i423face', { map: signTex });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.4, 0.02, 1, 0.02), backMat);
    plate.position.set(0, 1.52, -0.005);
    plate.castShadow = true;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), faceMat);
    front.position.set(0, 1.52, 0.007);
    g.add(plate, front);
  }

  parent.add(g);
}

export function addTowerCrane(parent, x, z) {
  // Realistic Open-Lattice Yellow Steel Construction Tower Crane for Unfinished Metro Corridor!
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const yellowSteel = stdMat(0xd97706, 0.42, 0.55);
  const darkSteel = stdMat(0x334155, 0.5, 0.7);
  const concMat = stdMat(0x94a3b8, 0.85);

  // Base concrete ballast pad
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.34, 1.75), concMat);
  pad.position.y = 0.17;
  pad.receiveShadow = true;
  g.add(pad);

  // 4 corner mast chords + horizontal bracing rungs + diagonal lattice lacing
  const mastH = 9.2;
  for (const mx of [-0.34, 0.34]) {
    for (const mz of [-0.34, 0.34]) {
      const chord = new THREE.Mesh(new THREE.BoxGeometry(0.085, mastH, 0.085), yellowSteel);
      chord.position.set(mx, mastH * 0.5 + 0.2, mz);
      chord.castShadow = true;
      g.add(chord);
    }
  }
  for (let ry = 1.0; ry <= mastH; ry += 1.05) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.055, 0.74), yellowSteel);
    rung.position.y = ry;
    g.add(rung);
    if (ry < mastH - 0.5) {
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.24, 0.045), yellowSteel);
      diag.position.set(0, ry + 0.52, 0.34);
      diag.rotation.z = (Math.round(ry) % 2 === 0 ? 1 : -1) * 0.56;
      g.add(diag);
    }
  }

  // Operator cabin with dark glazed front window
  const cab = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.92, 0.86, 1, 0.05), stdMat(0xcfd8e3, 0.4));
  cab.position.set(0.35, mastH + 0.22, 0.46);
  const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.89), stdMat(0x0f172a, 0.16, 0.6));
  cabWin.position.set(0.45, mastH + 0.28, 0.46);
  g.add(cab, cabWin);

  // Open-Lattice Triangular Truss Jib (-3.3 to +8.3) + Counterweights + Cathead A-frame + Steel Pendant Tie-Rods!
  const jibY = mastH + 0.62;
  const topChord = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.08, 0.08), yellowSteel);
  topChord.position.set(2.5, jibY + 0.36, 0);
  topChord.castShadow = true;
  g.add(topChord);
  for (const jz of [-0.26, 0.26]) {
    const botChord = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.085, 0.085), yellowSteel);
    botChord.position.set(2.5, jibY, jz);
    botChord.castShadow = true;
    g.add(botChord);
  }
  for (let jx = -3.1; jx <= 8.1; jx += 0.92) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.58), yellowSteel);
    tie.position.set(jx, jibY, 0);
    g.add(tie);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.045), yellowSteel);
      strut.position.set(jx, jibY + 0.18, side * 0.13);
      strut.rotation.x = side * 0.58;
      g.add(strut);
    }
  }

  const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.82, 0.82), concMat);
  counterWeight.position.set(-2.65, jibY - 0.12, 0);
  counterWeight.castShadow = true;
  g.add(counterWeight);

  const apexY = mastH + 2.28;
  for (const az of [-0.24, 0.24]) {
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.75, 0.075), yellowSteel);
    legF.position.set(0.22, mastH + 1.45, az);
    legF.rotation.z = 0.26;
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.75, 0.075), yellowSteel);
    legB.position.set(-0.22, mastH + 1.45, az);
    legB.rotation.z = -0.26;
    g.add(legF, legB);
  }

  // Steel pendant suspension cables from cathead apex to main jib & counter-jib
  const addCableSpan = (p1, p2) => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, v1.distanceTo(v2), 4), darkSteel);
    rod.position.copy(v1).add(v2).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
    g.add(rod);
  };
  addCableSpan([0, apexY, 0], [6.8, jibY + 0.36, 0]);
  addCableSpan([0, apexY, 0], [3.6, jibY + 0.36, 0]);
  addCableSpan([0, apexY, 0], [-2.7, jibY + 0.36, 0]);

  // Trolley carriage, dual hoist cables & suspended precast concrete girder segment
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.62), darkSteel);
  trolley.position.set(5.4, jibY - 0.06, 0);
  g.add(trolley);
  for (const cz of [-0.14, 0.14]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 3.3, 4), darkSteel);
    cable.position.set(5.4, jibY - 1.72, cz);
    g.add(cable);
  }
  const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.38), yellowSteel);
  hookBlock.position.set(5.4, jibY - 3.4, 0);
  const precastSeg = new THREE.Mesh(new RoundedBoxGeometry(1.65, 0.38, 0.78, 1, 0.04), concMat);
  precastSeg.position.set(5.4, jibY - 3.82, 0);
  precastSeg.castShadow = true;
  g.add(hookBlock, precastSeg);

  parent.add(g);
  return g;
}
