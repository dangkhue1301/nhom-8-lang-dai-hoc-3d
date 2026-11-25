import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { getContactShadowTexture, getStandardMaterial, optimizeStaticSubtree } from './textures.js';

const matCache = new Map();
function getMat(color, roughness = 0.68, metalness = 0.05, _extraKey = '', extra = {}) {
  return getStandardMaterial(color, roughness, metalness, extra);
}

const SHARED_GEO = {
  shadowPlane: new THREE.PlaneGeometry(1, 1),
  head: new THREE.SphereGeometry(0.112, 12, 10),
  neck: new THREE.CylinderGeometry(0.04, 0.046, 0.075, 8),
  nose: new THREE.BoxGeometry(0.022, 0.03, 0.028),
  ear: new THREE.SphereGeometry(0.023, 6, 6),
  eye: new THREE.SphereGeometry(0.013, 6, 6),
  brow: new THREE.BoxGeometry(0.032, 0.008, 0.01),
  mouth: new THREE.BoxGeometry(0.034, 0.007, 0.01),
  upperArm: new THREE.CapsuleGeometry(0.035, 0.11, 4, 8),
  foreArm: new THREE.CapsuleGeometry(0.029, 0.105, 4, 8),
  hand: new THREE.SphereGeometry(0.03, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.047, 0.125, 4, 8),
  calf: new THREE.CapsuleGeometry(0.038, 0.125, 4, 8),
  sock: new THREE.CylinderGeometry(0.039, 0.039, 0.045, 8),
  shoeUpper: new RoundedBoxGeometry(0.08, 0.05, 0.155, 1, 0.02),
  shoeSole: new THREE.BoxGeometry(0.084, 0.02, 0.162),
  wheelTire: new THREE.TorusGeometry(0.115, 0.038, 8, 14),
  bikeWheelTire: new THREE.TorusGeometry(0.135, 0.019, 6, 16),
  bikeRim: new THREE.TorusGeometry(0.122, 0.009, 5, 14)
};

function addShadow(parent, w, d, opacity = 0.52) {
  const mat = getMat(0xffffff, 1, 0, `shadow:${opacity}`, {
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false
  });
  const m = new THREE.Mesh(SHARED_GEO.shadowPlane, mat);
  m.scale.set(w, d, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.022;
  parent.add(m);
  return m;
}

function makeCapsule(r, l) {
  return new THREE.CapsuleGeometry(r, l, 4, 8);
}

const SKIN_TONES = [0xe4b897, 0xdba782, 0xebc2a4, 0xcf9770, 0xe6bc9c, 0xd69f78];
const HAIR_TONES = [0x15171e, 0x1c1e26, 0x2a1c13, 0x3b2416, 0x101217, 0x452a18];

// 32 distinct modern Vietnamese university students, lecturers & citizens
const MODERN_PROFILES = [
  { f: false, top: 0xcfd8e3, bot: 0x1e293b, shoe: 0xd0d7e2, hair: 'short_part', prop: 'backpack', propCol: 0x1e3a8a, glasses: true, lanyard: 0x0284c7, style: 'shirt' },
  { f: true, top: 0xd4dde7, bot: 0x1e293b, shoe: 0x1e293b, hair: 'ponytail', prop: 'totebag', propCol: 0xcbc3b4, glasses: false, lanyard: 0xdc2626, style: 'skirt' },
  { f: false, top: 0x1d4ed8, bot: 0x334155, shoe: 0xcfd8e3, hair: 'cap', capCol: 0x0f172a, prop: 'backpack', propCol: 0x334155, glasses: false, style: 'hoodie' },
  { f: true, top: 0xcbe4f9, bot: 0xd0d7e2, shoe: 0xcfd8e3, hair: 'long_straight', prop: 'books', propCol: 0x0284c7, glasses: true, style: 'aodai' },
  { f: false, top: 0x0f766e, bot: 0xb8a878, shoe: 0x1e293b, hair: 'comma_hair', prop: 'boba', propCol: 0xd97706, glasses: true, lanyard: 0x0f766e, style: 'polo' },
  { f: true, top: 0xe996a6, bot: 0x2f68b5, shoe: 0xcfd8e3, hair: 'bob', prop: 'umbrella', propCol: 0x7cb5ec, glasses: false, style: 'suncoat' },
  { f: false, top: 0x7f1d1d, bot: 0x1e293b, shoe: 0x881b1b, hair: 'short_part', prop: 'backpack', propCol: 0x0f172a, glasses: false, style: 'varsity' },
  { f: true, top: 0xe6d373, bot: 0x1e3a5f, shoe: 0xcfd8e3, hair: 'ponytail', prop: 'boba', propCol: 0xf59e0b, glasses: true, style: 'shirt' },
  { f: false, top: 0x334155, bot: 0x475569, shoe: 0xcfd8e3, hair: 'cap', capCol: 0x1d4ed8, prop: 'phone', propCol: 0x0f172a, glasses: true, mask: true, style: 'shorts' },
  { f: true, top: 0x8fdcc0, bot: 0x1e293b, shoe: 0xcfd8e3, hair: 'long_straight', prop: 'backpack', propCol: 0xe11d48, glasses: false, lanyard: 0x059669, style: 'skirt' },
  { f: false, top: 0xc26a08, bot: 0x1f2937, shoe: 0x111827, hair: 'comma_hair', prop: 'satchel', propCol: 0x6b300d, glasses: false, style: 'hoodie' },
  { f: true, top: 0xcfd8e3, bot: 0x0369a1, shoe: 0xcfd8e3, hair: 'bun', prop: 'books', propCol: 0xd97706, glasses: true, lanyard: 0x0284c7, style: 'shirt' },
  { f: false, top: 0x0369a1, bot: 0xc4bfb8, shoe: 0x0369a1, hair: 'buzz', prop: 'backpack', propCol: 0x1e293b, glasses: false, style: 'varsity' },
  { f: true, top: 0xebb8d2, bot: 0xd0d7e2, shoe: 0xdb65a2, hair: 'long_straight', prop: 'totebag', propCol: 0xcfd8e3, glasses: false, style: 'aodai' },
  { f: false, top: 0x15803d, bot: 0x1e293b, shoe: 0xcfd8e3, hair: 'short_part', prop: 'backpack', propCol: 0xb47b04, glasses: true, lanyard: 0x15803d, style: 'polo' },
  { f: true, top: 0xb4c2ec, bot: 0x334155, shoe: 0xcfd8e3, hair: 'bucket', capCol: 0xc8c1b4, prop: 'umbrella', propCol: 0xeba0ac, glasses: false, mask: true, style: 'suncoat' },
  { f: false, top: 0x475569, bot: 0x1e293b, shoe: 0xd49b08, hair: 'comma_hair', prop: 'books', propCol: 0x059669, glasses: true, lanyard: 0x2563eb, style: 'shirt' },
  { f: true, top: 0xe8be90, bot: 0x374151, shoe: 0xcfd8e3, hair: 'ponytail', prop: 'backpack', propCol: 0x4f46e5, glasses: false, style: 'hoodie' },
  { f: false, top: 0xcad4df, bot: 0x0f172a, shoe: 0x0f172a, hair: 'buzz', prop: 'satchel', propCol: 0x1e293b, glasses: true, lanyard: 0xdc2626, style: 'shirt' },
  { f: true, top: 0x84dfd0, bot: 0x1e3a8a, shoe: 0xcfd8e3, hair: 'bob', prop: 'boba', propCol: 0xec4899, glasses: true, style: 'skirt' },
  { f: false, top: 0x991b1b, bot: 0xb8a878, shoe: 0xcfd8e3, hair: 'cap', capCol: 0xcad4df, prop: 'backpack', propCol: 0x334155, glasses: false, style: 'shorts' },
  { f: true, top: 0xa4d4f0, bot: 0x334155, shoe: 0x1e293b, hair: 'pigtails', prop: 'books', propCol: 0xdb2777, glasses: false, style: 'shirt' },
  { f: false, top: 0x1e40af, bot: 0x1e293b, shoe: 0xcfd8e3, hair: 'short_part', prop: 'phone', propCol: 0x1e293b, glasses: true, style: 'varsity' },
  { f: true, top: 0xcac2f0, bot: 0x1f2937, shoe: 0xcfd8e3, hair: 'long_straight', prop: 'totebag', propCol: 0x8b5cf6, glasses: false, mask: true, style: 'hoodie' },
  { f: false, top: 0x0284c7, bot: 0x1e293b, shoe: 0xcfd8e3, hair: 'short_part', prop: 'backpack', propCol: 0x0f172a, glasses: false, lanyard: 0xf59e0b, style: 'polo' },
  { f: true, top: 0xd6d3c9, bot: 0x3f3f46, shoe: 0x27272a, hair: 'bun', prop: 'totebag', propCol: 0x78350f, glasses: true, style: 'shirt' },
  { f: false, top: 0x374151, bot: 0x1f2937, shoe: 0x991b1b, hair: 'comma_hair', prop: 'boba', propCol: 0x10b981, glasses: false, style: 'shorts' },
  { f: true, top: 0xfca5a5, bot: 0x1e3a8a, shoe: 0xcfd8e3, hair: 'ponytail', prop: 'backpack', propCol: 0x334155, glasses: false, lanyard: 0x0284c7, style: 'skirt' },
  { f: false, top: 0x115e59, bot: 0x27272a, shoe: 0xcfd8e3, hair: 'bucket', capCol: 0x1e293b, prop: 'satchel', propCol: 0x92400e, glasses: true, style: 'shirt' },
  { f: true, top: 0xd5e3d8, bot: 0x1e293b, shoe: 0x1e293b, hair: 'bob', prop: 'phone', propCol: 0x334155, glasses: false, style: 'polo' },
  { f: false, top: 0x7c2d12, bot: 0x334155, shoe: 0xcfd8e3, hair: 'buzz', prop: 'backpack', propCol: 0x1e40af, glasses: false, style: 'hoodie' },
  { f: true, top: 0xcfd8e3, bot: 0x111827, shoe: 0x111827, hair: 'long_straight', prop: 'books', propCol: 0xb91c1c, glasses: true, style: 'aodai' }
];

// 12 Authentic 1980s Bao cấp student, lecturer & cadre profiles (faded cotton shirts, pith helmets, nón lá, cặp lồng nhôm, canvas satchels)
const BAOCAP_PROFILES = [
  { f: false, top: 0xcbc6ba, bot: 0x1e293b, shoe: 0x451a03, hair: 'short_part', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' },
  { f: true, top: 0xd1ccc0, bot: 0x111827, shoe: 0x3f2305, hair: 'pigtails', prop: 'satchel', propCol: 0x4d5d3b, style: 'shirt' },
  { f: false, top: 0x5f6652, bot: 0x27272a, shoe: 0x451a03, hair: 'mu_coi', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' },
  { f: true, top: 0xbfc8d4, bot: 0x0f172a, shoe: 0x451a03, hair: 'non_la', prop: 'satchel', propCol: 0x785a32, style: 'shirt' },
  { f: false, top: 0x8994a3, bot: 0x1e293b, shoe: 0x292524, hair: 'buzz', prop: 'books', propCol: 0x78350f, glasses: true, style: 'shirt' },
  { f: true, top: 0xd6d0c4, bot: 0x18181b, shoe: 0x451a03, hair: 'long_straight', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' },
  { f: false, top: 0x6e675f, bot: 0x1c1917, shoe: 0x451a03, hair: 'mu_coi', prop: 'satchel', propCol: 0x3f4e30, style: 'shirt' },
  { f: true, top: 0xc7c7cc, bot: 0x1e293b, shoe: 0x451a03, hair: 'non_la', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' },
  { f: false, top: 0x738290, bot: 0x1e293b, shoe: 0x3b1d08, hair: 'short_part', prop: 'satchel', propCol: 0x5c4028, glasses: true, style: 'shirt' },
  { f: true, top: 0xc9c2b2, bot: 0x18181b, shoe: 0x3b1d08, hair: 'bun', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' },
  { f: false, top: 0x525b44, bot: 0x262626, shoe: 0x451a03, hair: 'mu_coi', prop: 'books', propCol: 0x713f12, style: 'shirt' },
  { f: true, top: 0xc4cdd6, bot: 0x111827, shoe: 0x3f2305, hair: 'pigtails', prop: 'cap_long', propCol: 0x94a3b8, style: 'shirt' }
];

function buildHairOrHat(headGroup, style, hairMat, accentCol = 0x1e293b) {
  if (style === 'non_la') {
    const strawMat = getMat(0xc9a974, 0.86, 0.02);
    const rimMat = getMat(0xb08d55, 0.88, 0.02);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.245, 0.165, 18), strawMat);
    cone.position.set(0, 0.11, 0);
    cone.castShadow = true;
    headGroup.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 18), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.03;
    headGroup.add(rim);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), hairMat);
    bun.position.set(0, -0.005, -0.108);
    headGroup.add(bun);
    return;
  }

  if (style === 'mu_coi') {
    const pithMat = getMat(0x4b683b, 0.82, 0.04);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.124, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), pithMat);
    dome.position.y = 0.028;
    dome.castShadow = true;
    headGroup.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.172, 0.022, 14), pithMat);
    brim.position.y = 0.032;
    brim.rotation.x = 0.06;
    headGroup.add(brim);
    // Tiny front badge
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.01), getMat(0xd97706, 0.4, 0.5));
    star.position.set(0, 0.08, 0.12);
    headGroup.add(star);
    return;
  }

  if (style === 'cap') {
    const capMat = getMat(accentCol, 0.72, 0.05);
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 10, 8), hairMat);
    backHair.scale.set(0.98, 0.85, 0.98);
    headGroup.add(backHair);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54), capMat);
    dome.position.y = 0.026;
    dome.castShadow = true;
    headGroup.add(dome);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.155, 0.016, 0.125, 1, 0.008), capMat);
    visor.position.set(0, 0.034, 0.11);
    visor.rotation.x = 0.14;
    headGroup.add(visor);
    return;
  }

  if (style === 'bucket') {
    const bMat = getMat(accentCol, 0.82, 0.02);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.124, 0.088, 12), bMat);
    top.position.y = 0.074;
    top.castShadow = true;
    headGroup.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.174, 0.028, 14), bMat);
    brim.position.y = 0.03;
    headGroup.add(brim);
    return;
  }

  // Sculpted natural hair base cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  cap.position.set(0, 0.018, -0.006);
  cap.castShadow = true;
  headGroup.add(cap);

  if (style === 'short_part') {
    const fringe = new THREE.Mesh(new RoundedBoxGeometry(0.148, 0.046, 0.068, 1, 0.02), hairMat);
    fringe.position.set(0.016, 0.072, 0.082);
    fringe.rotation.z = -0.14;
    headGroup.add(fringe);
  } else if (style === 'comma_hair') {
    for (const sx of [-0.042, 0.042]) {
      const bang = new THREE.Mesh(new RoundedBoxGeometry(0.072, 0.055, 0.06, 1, 0.022), hairMat);
      bang.position.set(sx, 0.066, 0.085);
      bang.rotation.z = sx < 0 ? 0.25 : -0.25;
      headGroup.add(bang);
    }
  } else if (style === 'long_straight') {
    const backHair = new THREE.Mesh(new RoundedBoxGeometry(0.205, 0.28, 0.09, 1, 0.035), hairMat);
    backHair.position.set(0, -0.082, -0.074);
    backHair.castShadow = true;
    headGroup.add(backHair);
    for (const sx of [-0.094, 0.094]) {
      const lock = new THREE.Mesh(makeCapsule(0.026, 0.14), hairMat);
      lock.position.set(sx, -0.042, 0.012);
      headGroup.add(lock);
    }
  } else if (style === 'ponytail') {
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.024, 8), getMat(0xe11d48, 0.6));
    tie.rotation.x = Math.PI / 2;
    tie.position.set(0, 0.048, -0.114);
    headGroup.add(tie);
    const tail = new THREE.Mesh(makeCapsule(0.036, 0.16), hairMat);
    tail.position.set(0, -0.022, -0.152);
    tail.rotation.x = 0.42;
    tail.castShadow = true;
    headGroup.add(tail);
  } else if (style === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), hairMat);
    bun.position.set(0, 0.075, -0.105);
    headGroup.add(bun);
    const scrunch = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 6, 10), getMat(0x0284c7, 0.65));
    scrunch.position.set(0, 0.062, -0.092);
    scrunch.rotation.x = 0.6;
    headGroup.add(scrunch);
  } else if (style === 'bob') {
    for (const sx of [-0.096, 0.096]) {
      const side = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.158, 0.148, 1, 0.022), hairMat);
      side.position.set(sx, -0.015, -0.01);
      headGroup.add(side);
    }
    const bangs = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.04, 0.048, 1, 0.015), hairMat);
    bangs.position.set(0, 0.065, 0.092);
    headGroup.add(bangs);
  } else if (style === 'pigtails') {
    for (const sx of [-0.102, 0.102]) {
      const braid = new THREE.Mesh(makeCapsule(0.025, 0.16), hairMat);
      braid.position.set(sx, -0.07, -0.038);
      braid.rotation.z = sx < 0 ? 0.18 : -0.18;
      headGroup.add(braid);
    }
  }
}

const PERSON_SKIN_MAT = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.72,
  metalness: 0.05,
  vertexColors: true
});
PERSON_SKIN_MAT.customProgramCacheKey = () => 'person-skin-vcol-pbr-v1';
PERSON_SKIN_MAT.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
attribute vec2 aPbr;
varying vec2 vPbr;`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vPbr = aPbr;`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec2 vPbr;`
    )
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPbr.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPbr.y;');
};

function bakePersonToSkinnedMesh(root, bones) {
  root.updateMatrixWorld(true);
  const boneSet = new Set(bones);
  const parts = [];
  const meshesToRemove = [];
  let totalVerts = 0;

  const collectForBone = (obj, bIdx) => {
    for (let i = 0; i < obj.children.length; i += 1) {
      const ch = obj.children[i];
      if (boneSet.has(ch)) continue;
      if (ch.isMesh && ch.geometry && ch.material) {
        const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
        g.applyMatrix4(ch.matrixWorld);
        parts.push({
          g,
          color: ch.material.color || new THREE.Color(0xffffff),
          roughness: ch.material.roughness ?? 0.72,
          metalness: ch.material.metalness ?? 0.05,
          bIdx
        });
        totalVerts += g.attributes.position.count;
        meshesToRemove.push(ch);
      }
      if (ch.children.length > 0) {
        collectForBone(ch, bIdx);
      }
    }
  };

  for (let bIdx = 0; bIdx < bones.length; bIdx += 1) {
    collectForBone(bones[bIdx], bIdx);
  }

  for (const m of meshesToRemove) {
    if (m.parent) m.parent.remove(m);
  }
  // Remove any empty helper Groups inside bones so only pure Bone nodes remain
  for (const bone of bones) {
    for (let i = bone.children.length - 1; i >= 0; i -= 1) {
      const ch = bone.children[i];
      if (!boneSet.has(ch) && !ch.isBone) {
        bone.remove(ch);
      }
    }
  }

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const uvArr = new Float32Array(totalVerts * 2);
  const colArr = new Float32Array(totalVerts * 3);
  const pbrArr = new Float32Array(totalVerts * 2);
  const skinIdxArr = new Uint16Array(totalVerts * 4);
  const skinWgtArr = new Float32Array(totalVerts * 4);

  let vOffset = 0;
  for (const { g, color, roughness, metalness, bIdx } of parts) {
    const count = g.attributes.position.count;
    posArr.set(g.attributes.position.array, vOffset * 3);
    normArr.set(g.attributes.normal.array, vOffset * 3);
    if (g.attributes.uv) {
      uvArr.set(g.attributes.uv.array, vOffset * 2);
    }
    const cr = color.r;
    const cg = color.g;
    const cb = color.b;
    for (let v = 0; v < count; v += 1) {
      const cDst = (vOffset + v) * 3;
      colArr[cDst] = cr;
      colArr[cDst + 1] = cg;
      colArr[cDst + 2] = cb;
      const pDst = (vOffset + v) * 2;
      pbrArr[pDst] = roughness;
      pbrArr[pDst + 1] = metalness;
      const sDst = (vOffset + v) * 4;
      skinIdxArr[sDst] = bIdx;
      skinWgtArr[sDst] = 1.0;
    }
    vOffset += count;
    g.dispose();
  }

  const skinnedGeo = new THREE.BufferGeometry();
  skinnedGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  skinnedGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  skinnedGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  skinnedGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  skinnedGeo.setAttribute('aPbr', new THREE.BufferAttribute(pbrArr, 2));
  skinnedGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdxArr, 4));
  skinnedGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWgtArr, 4));
  skinnedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.4);

  const skeleton = new THREE.Skeleton(bones);
  const skinnedMesh = new THREE.SkinnedMesh(skinnedGeo, PERSON_SKIN_MAT);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  root.add(skinnedMesh);
  skinnedMesh.bind(skeleton, new THREE.Matrix4());
}

export function createDetailedPerson(variantIndex = 0, era = 'modern', pose = 'walk', customOpts = null) {
  const list = era === 'baocap' ? BAOCAP_PROFILES : MODERN_PROFILES;
  const baseProf = list[Math.abs(variantIndex) % list.length];
  const prof = customOpts ? { ...baseProf, ...customOpts } : baseProf;
  const useSkin = !prof.staticSit;
  const makeNode = () => (useSkin ? new THREE.Bone() : new THREE.Group());

  const skinMat = getMat(SKIN_TONES[Math.abs(variantIndex) % SKIN_TONES.length], 0.62, 0.02);
  const hairMat = getMat(HAIR_TONES[(Math.abs(variantIndex) * 3) % HAIR_TONES.length], 0.85, 0.02);
  const topMat = getMat(prof.top, 0.74, 0.02);
  const botMat = getMat(prof.bot, 0.8, 0.02);
  const shoeMat = getMat(prof.shoe, 0.58, 0.05);
  const soleMat = getMat(0xcfd8e3, 0.75, 0.02);
  const eyeMat = getMat(0x0f172a, 0.3, 0.1);
  const lipMat = getMat(0xb86b64, 0.65, 0.02);

  const root = new THREE.Group();
  if (pose !== 'sit') {
    addShadow(root, 0.54, 0.54, 0.5);
  }

  // Individual height & build variation so no two pedestrians look cloned
  const heightScale = prof.f ? 0.9 + (variantIndex % 4) * 0.022 : 0.95 + (variantIndex % 5) * 0.025;
  const widthScale = prof.f ? 0.91 + (variantIndex % 2) * 0.03 : 0.97 + (variantIndex % 3) * 0.035;
  const body = makeNode();
  body.scale.set(widthScale, heightScale, widthScale);
  root.add(body);

  // 1. Torso & Clothing Cut
  const torsoW = prof.f ? 0.208 : 0.242;
  const torsoD = prof.f ? 0.132 : 0.152;
  const torso = new THREE.Mesh(new RoundedBoxGeometry(torsoW, 0.28, torsoD, 1, 0.044), topMat);
  torso.position.y = 0.52;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Shirt placket / hoodie pocket / university badge micro-details
  if (prof.style === 'shirt') {
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.25, 0.008), getMat(0xbcc6d4, 0.75));
    placket.position.set(0, 0.52, torsoD * 0.5 + 0.003);
    body.add(placket);
  } else if (prof.style === 'polo') {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.008), getMat(0xf59e0b, 0.5));
    crest.position.set(-0.052, 0.575, torsoD * 0.5 + 0.004);
    body.add(crest);
  } else if (prof.style === 'hoodie' || prof.style === 'suncoat') {
    const pouch = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.68, 0.085, 0.018, 1, 0.008), topMat);
    pouch.position.set(0, 0.435, torsoD * 0.5 + 0.005);
    body.add(pouch);
  }

  let aoDaiFront = null;
  let aoDaiBack = null;

  // Pelvis / Pleated Skirt / Áo Dài Panels
  if (prof.style === 'skirt') {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.47, torsoW * 0.72, 0.19, 14), botMat);
    skirt.position.y = 0.33;
    skirt.castShadow = true;
    body.add(skirt);
  } else if (prof.style === 'aodai') {
    const hip = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.92, 0.1, torsoD * 0.9, 1, 0.03), botMat);
    hip.position.y = 0.36;
    body.add(hip);
    aoDaiFront = makeNode();
    aoDaiFront.position.set(0, 0.38, torsoD * 0.48);
    const fPanel = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.9, 0.25, 0.018, 1, 0.007), topMat);
    fPanel.position.set(0, -0.12, 0);
    fPanel.castShadow = true;
    aoDaiFront.add(fPanel);

    aoDaiBack = makeNode();
    aoDaiBack.position.set(0, 0.38, -torsoD * 0.48);
    const bPanel = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.9, 0.25, 0.018, 1, 0.007), topMat);
    bPanel.position.set(0, -0.12, 0);
    bPanel.castShadow = true;
    aoDaiBack.add(bPanel);
    body.add(aoDaiFront, aoDaiBack);
  } else {
    const pelvis = new THREE.Mesh(new RoundedBoxGeometry(torsoW * 0.94, 0.11, torsoD * 0.94, 1, 0.03), botMat);
    pelvis.position.y = 0.36;
    pelvis.castShadow = true;
    body.add(pelvis);
  }

  // Collar / Hood / Student ID Lanyard
  if (prof.style === 'hoodie' || prof.style === 'suncoat') {
    const hood = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.072, 0.115, 1, 0.028), topMat);
    hood.position.set(0, 0.66, -0.044);
    body.add(hood);
  } else if (prof.style === 'polo' || prof.style === 'shirt' || prof.style === 'aodai') {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.038, 10), topMat);
    collar.position.y = 0.665;
    body.add(collar);
  }

  if (prof.lanyard && era === 'modern') {
    const lanMat = getMat(prof.lanyard, 0.5);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.14, 0.012), lanMat);
    strapL.position.set(-0.025, 0.58, torsoD * 0.5 + 0.005);
    strapL.rotation.z = -0.18;
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.14, 0.012), lanMat);
    strapR.position.set(0.025, 0.58, torsoD * 0.5 + 0.005);
    strapR.rotation.z = 0.18;
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.055, 0.01), getMat(0xd0d7e2, 0.4));
    card.position.set(0, 0.49, torsoD * 0.5 + 0.008);
    body.add(strapL, strapR, card);
  }

  // 2. Neck & Detailed Head
  const neck = new THREE.Mesh(SHARED_GEO.neck, skinMat);
  neck.position.y = 0.685;
  body.add(neck);

  const headPivot = makeNode();
  headPivot.position.y = 0.788;
  body.add(headPivot);

  const head = new THREE.Mesh(SHARED_GEO.head, skinMat);
  head.scale.set(0.94, 1.04, 0.96);
  head.castShadow = true;
  headPivot.add(head);

  const nose = new THREE.Mesh(SHARED_GEO.nose, skinMat);
  nose.position.set(0, -0.005, 0.106);
  headPivot.add(nose);

  const mouth = new THREE.Mesh(SHARED_GEO.mouth, lipMat);
  mouth.position.set(0, -0.042, 0.098);
  headPivot.add(mouth);

  for (const ex of [-0.104, 0.104]) {
    const ear = new THREE.Mesh(SHARED_GEO.ear, skinMat);
    ear.position.set(ex, -0.005, 0);
    headPivot.add(ear);
  }
  for (const ex of [-0.037, 0.037]) {
    const eye = new THREE.Mesh(SHARED_GEO.eye, eyeMat);
    eye.position.set(ex, 0.015, 0.1);
    const brow = new THREE.Mesh(SHARED_GEO.brow, hairMat);
    brow.position.set(ex, 0.038, 0.101);
    headPivot.add(eye, brow);
  }

  if (prof.glasses) {
    const frameMat = getMat(0x1e293b, 0.3, 0.72);
    for (const gx of [-0.039, 0.039]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.028, 0.01), frameMat);
      rim.position.set(gx, 0.015, 0.11);
      headPivot.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.01), frameMat);
    bridge.position.set(0, 0.019, 0.111);
    headPivot.add(bridge);
  }

  if (prof.mask && era === 'modern') {
    const mask = new THREE.Mesh(
      new RoundedBoxGeometry(0.112, 0.064, 0.052, 1, 0.018),
      getMat(0x9bd2f2, 0.76, 0.0)
    );
    mask.position.set(0, -0.034, 0.086);
    headPivot.add(mask);
  }

  buildHairOrHat(headPivot, prof.hair, hairMat, prof.capCol || 0x1e293b);

  // 3. Articulated Arms with Sleeves, Forearms & Hands
  const sleeveMat = prof.style === 'varsity' ? getMat(0xcfd8e3, 0.68) : topMat;
  const longSleeve =
    prof.style === 'hoodie' || prof.style === 'varsity' || prof.style === 'aodai' || prof.style === 'suncoat';
  const sleeveless = prof.style === 'sport';

  const makeArm = (side) => {
    const pivot = makeNode();
    pivot.position.set(side * (torsoW * 0.5 + 0.036), 0.63, 0);

    const upper = new THREE.Mesh(SHARED_GEO.upperArm, sleeveless ? skinMat : sleeveMat);
    upper.position.y = -0.074;
    upper.castShadow = true;
    pivot.add(upper);

    const forePivot = makeNode();
    forePivot.position.set(0, -0.145, 0);
    forePivot.rotation.x = -0.22;
    pivot.add(forePivot);

    const fore = new THREE.Mesh(SHARED_GEO.foreArm, longSleeve ? sleeveMat : skinMat);
    fore.position.y = -0.055;
    fore.castShadow = true;
    forePivot.add(fore);

    if (side === -1 && !longSleeve && variantIndex % 2 === 0) {
      const watch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.031, 0.031, 0.016, 8),
        getMat(era === 'baocap' ? 0x94a3b8 : 0x1e293b, 0.35, 0.65)
      );
      watch.position.set(0, -0.105, 0);
      forePivot.add(watch);
    }

    const hand = new THREE.Mesh(SHARED_GEO.hand, skinMat);
    hand.position.set(0, -0.132, 0.006);
    forePivot.add(hand);

    body.add(pivot);
    return { pivot, forePivot };
  };

  const armLObj = makeArm(-1);
  const armRObj = makeArm(1);
  const armL = armLObj.pivot;
  const armR = armRObj.pivot;

  // 4. Articulated Legs with True Knee Pivot, Socks & Two-Tone Footwear
  const bareCalf = prof.style === 'skirt' || prof.style === 'shorts' || prof.style === 'sport';
  const makeLeg = (side) => {
    const pivot = makeNode();
    pivot.position.set(side * 0.06, 0.35, 0);

    const thigh = new THREE.Mesh(SHARED_GEO.thigh, prof.style === 'skirt' ? skinMat : botMat);
    thigh.position.y = -0.092;
    thigh.castShadow = true;
    pivot.add(thigh);

    const kneePivot = makeNode();
    kneePivot.position.set(0, -0.178, 0);
    pivot.add(kneePivot);

    const calf = new THREE.Mesh(SHARED_GEO.calf, bareCalf ? skinMat : botMat);
    calf.position.y = -0.082;
    calf.castShadow = true;
    kneePivot.add(calf);

    if (era === 'modern' && bareCalf) {
      const sock = new THREE.Mesh(SHARED_GEO.sock, soleMat);
      sock.position.y = -0.13;
      kneePivot.add(sock);
    }

    const shoe = new THREE.Mesh(SHARED_GEO.shoeUpper, shoeMat);
    shoe.position.set(0, -0.148, 0.025);
    shoe.castShadow = true;
    kneePivot.add(shoe);

    if (era === 'modern') {
      const sole = new THREE.Mesh(SHARED_GEO.shoeSole, soleMat);
      sole.position.set(0, -0.17, 0.025);
      kneePivot.add(sole);
    }

    if (pose === 'sit') {
      pivot.rotation.x = -Math.PI * 0.41;
      kneePivot.rotation.x = Math.PI * 0.41;
    }

    body.add(pivot);
    return { pivot, kneePivot };
  };

  const legLObj = makeLeg(-1);
  const legRObj = makeLeg(1);

  // 5. Distinct Props & Accessories
  const propMat = getMat(prof.propCol || 0x334155, 0.7, 0.06);
  let holdLeft = false;
  let holdRight = false;

  if (prof.prop === 'backpack' && pose !== 'sit') {
    const pack = new THREE.Mesh(new RoundedBoxGeometry(0.185, 0.235, 0.105, 1, 0.034), propMat);
    pack.position.set(0, 0.52, -(torsoD * 0.5 + 0.052));
    pack.castShadow = true;
    body.add(pack);
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.145, 0.105, 0.038, 1, 0.018), propMat);
    pocket.position.set(0, 0.47, -(torsoD * 0.5 + 0.11));
    body.add(pocket);
    // Side water bottle in mesh pocket
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.095, 8), getMat(0x38bdf8, 0.25, 0.1));
    bottle.position.set(0.1, 0.48, -(torsoD * 0.5 + 0.05));
    body.add(bottle);
    const strapMat = getMat(0x1e293b, 0.8);
    for (const sx of [-0.064, 0.064]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.235, 0.16), strapMat);
      st.position.set(sx, 0.54, 0);
      body.add(st);
    }
  } else if (prof.prop === 'totebag') {
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.205, 0.175, 1, 0.02), propMat);
    bag.position.set(torsoW * 0.5 + 0.052, 0.36, -0.01);
    bag.castShadow = true;
    body.add(bag);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.175, 0.105), propMat);
    handle.position.set(torsoW * 0.5 + 0.028, 0.525, -0.01);
    body.add(handle);
  } else if (prof.prop === 'satchel') {
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.165, 0.195, 1, 0.024), propMat);
    bag.position.set(-(torsoW * 0.5 + 0.048), 0.34, 0.01);
    bag.castShadow = true;
    body.add(bag);
    const crossStrap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.024, 0.165), propMat);
    crossStrap.position.set(0, 0.51, 0);
    crossStrap.rotation.z = 0.68;
    body.add(crossStrap);
  } else if (prof.prop === 'books') {
    holdLeft = true;
    armL.rotation.x = -0.58;
    armLObj.forePivot.rotation.x = -0.65;
    const book1 = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.18, 0.032, 1, 0.008), propMat);
    book1.position.set(0.035, -0.1, 0.055);
    book1.rotation.set(0.4, 0.2, -0.2);
    armLObj.forePivot.add(book1);
  } else if (prof.prop === 'boba' && era === 'modern') {
    // Vietnamese student holding a Boba Milk Tea / Iced Coffee cup with straw!
    holdRight = true;
    armR.rotation.x = -0.42;
    armRObj.forePivot.rotation.x = -0.78;
    const cupGrp = new THREE.Group();
    cupGrp.position.set(-0.01, -0.13, 0.045);
    cupGrp.rotation.x = 1.15;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.021, 0.082, 10), getMat(0xd6b07a, 0.25, 0.05));
    const pearls = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.02, 0.022, 10), getMat(0x1c1917, 0.4));
    pearls.position.y = -0.028;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), getMat(0xe2e8f0, 0.2));
    lid.position.y = 0.04;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.065, 6), propMat);
    straw.position.set(0.005, 0.062, 0);
    straw.rotation.z = -0.12;
    cupGrp.add(cup, pearls, lid, straw);
    armRObj.forePivot.add(cupGrp);
  } else if (prof.prop === 'phone' && era === 'modern') {
    holdRight = true;
    armR.rotation.x = -0.48;
    armRObj.forePivot.rotation.x = -0.88;
    const phone = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.072, 0.008, 1, 0.003),
      getMat(0x0f172a, 0.25, 0.4)
    );
    phone.position.set(-0.02, -0.13, 0.04);
    phone.rotation.set(0.9, 0.2, 0.15);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.062, 0.004),
      getMat(0x38bdf8, 0.2, 0.1)
    );
    screen.position.set(-0.02, -0.128, 0.043);
    screen.rotation.set(0.9, 0.2, 0.15);
    armRObj.forePivot.add(phone, screen);
  } else if (prof.prop === 'umbrella' && pose === 'walk') {
    holdRight = true;
    armR.rotation.x = -0.92;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.54, 6), getMat(0x94a3b8, 0.3, 0.8));
    shaft.position.set(-0.04, 0.02, 0.18);
    shaft.rotation.x = 0.85;
    armR.add(shaft);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.115, 12), propMat);
    canopy.position.set(-0.04, 0.22, 0.38);
    canopy.rotation.x = 0.85;
    canopy.castShadow = true;
    armR.add(canopy);
  } else if (prof.prop === 'cap_long') {
    // 3-tier stacked aluminum tiffin lunchbox (Cặp lồng nhôm thời Bao cấp)
    const inoxMat = getMat(0xbcc6d2, 0.32, 0.76);
    const rimMat = getMat(0x64748b, 0.4, 0.7);
    const boxGrp = new THREE.Group();
    boxGrp.position.set(0, -0.19, 0.02);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.135, 10), inoxMat);
    boxGrp.add(cyl);
    for (const ry of [-0.02, 0.025, 0.065]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 10), rimMat);
      band.position.y = ry;
      boxGrp.add(band);
    }
    armRObj.forePivot.add(boxGrp);
  }

  if (useSkin) {
    const bones = [
      body,
      headPivot,
      armL,
      armLObj.forePivot,
      armR,
      armRObj.forePivot,
      legLObj.pivot,
      legLObj.kneePivot,
      legRObj.pivot,
      legRObj.kneePivot
    ];
    if (aoDaiFront) bones.push(aoDaiFront);
    if (aoDaiBack) bones.push(aoDaiBack);
    bakePersonToSkinnedMesh(root, bones);
  } else {
    optimizeStaticSubtree(root, null, { unifyShadows: { cast: true, receive: true } });
  }

  root.userData = {
    body,
    legL: legLObj.pivot,
    legR: legRObj.pivot,
    kneeL: legLObj.kneePivot,
    kneeR: legRObj.kneePivot,
    armL,
    armR,
    foreArmL: armLObj.forePivot,
    foreArmR: armRObj.forePivot,
    headPivot,
    aoDaiFront,
    aoDaiBack,
    holdLeft,
    holdRight
  };
  return root;
}

export function animatePersonWalk(person, animTime, speed = 1.2, phase = 0, baseGroundY = 0.15) {
  const ud = person.userData;
  if (!ud || !ud.legL) return;
  const moveAmp = Math.min(1, Math.max(0, speed) / 0.32);
  const freq = 5.4 + speed * 1.4;
  const cyc = animTime * freq + phase;
  const stride = Math.sin(cyc) * 0.46 * moveAmp;

  ud.legL.rotation.x = stride;
  ud.legR.rotation.x = -stride;

  // Natural human knee flexion on recovery stroke (settles to straight standing legs when stopped at red light!)
  if (ud.kneeL) ud.kneeL.rotation.x = Math.max(0, -Math.cos(cyc) * 0.42) * moveAmp;
  if (ud.kneeR) ud.kneeR.rotation.x = Math.max(0, Math.cos(cyc) * 0.42) * moveAmp;

  // Counter-swinging arms (unless holding books/umbrella/boba)
  if (!ud.holdLeft) {
    ud.armL.rotation.x = -stride * 0.78;
    if (ud.foreArmL) ud.foreArmL.rotation.x = -0.22 - Math.max(0, stride) * 0.25;
  }
  if (!ud.holdRight) {
    ud.armR.rotation.x = stride * 0.78;
    if (ud.foreArmR) ud.foreArmR.rotation.x = -0.22 - Math.max(0, -stride) * 0.25;
  }

  // Subtle vertical step bob & torso sway
  person.position.y = baseGroundY + Math.abs(Math.cos(cyc)) * 0.026 * moveAmp;
  if (ud.body) {
    ud.body.rotation.y = Math.sin(cyc) * 0.055 * moveAmp;
  }
  if (ud.headPivot) {
    ud.headPivot.rotation.y = Math.sin(animTime * 0.9 + phase) * 0.14;
  }
  if (ud.aoDaiFront && ud.aoDaiBack) {
    ud.aoDaiFront.rotation.x = -0.06 - Math.abs(stride) * 0.18;
    ud.aoDaiBack.rotation.x = 0.08 + Math.abs(stride) * 0.22;
  }
}

// ============================================================================
// REALISTIC VIETNAMESE VEHICLES (Bicycles, Scooters, Underbones, Shippers, Cars, Taxis, SUVs, Trucks, Bus 08/33/53, Metro 1)
// ============================================================================

export function spinVehicleWheels(vehicleMesh, travelDist) {
  const wheels = vehicleMesh?.userData?.wheels;
  if (!wheels || !wheels.length) return;
  const radius = vehicleMesh.userData.wheelRadius || 0.16;
  const dAngle = travelDist / radius;
  for (let i = 0; i < wheels.length; i += 1) {
    wheels[i].rotation.z -= dAngle;
  }
}

export function createBicycleMesh(variantIndex = 0, era = 'baocap') {
  const g = new THREE.Group();
  addShadow(g, 1.05, 0.38, 0.48);

  const frameColors =
    era === 'baocap'
      ? [0x2d4a2b, 0x1e293b, 0x4a2511, 0x1f3a52]
      : [0x0284c7, 0x0d9488, 0xd97706, 0x334155, 0xe11d48];
  const frameMat = getMat(frameColors[variantIndex % frameColors.length], 0.42, 0.55);
  const chromeMat = getMat(0xcbd5e1, 0.22, 0.88);
  const tireMat = getMat(0x18181b, 0.92, 0.04);
  const leatherMat = getMat(0x5c2e0e, 0.78, 0.05);

  const wheels = [];
  for (const wx of [-0.34, 0.34]) {
    const wSpin = new THREE.Group();
    wSpin.position.set(wx, 0.155, 0);
    const tire = new THREE.Mesh(SHARED_GEO.bikeWheelTire, tireMat);
    const rim = new THREE.Mesh(SHARED_GEO.bikeRim, chromeMat);
    wSpin.add(tire, rim);
    for (let s = 0; s < 6; s += 1) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.24, 4), chromeMat);
      spoke.rotation.z = (s * Math.PI) / 6;
      wSpin.add(spoke);
    }
    g.add(wSpin);
    wheels.push(wSpin);

    // Stationary curved chrome mudguard above wheel
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.154, 0.011, 6, 12, Math.PI * 0.85), chromeMat);
    guard.position.set(wx, 0.155, 0);
    guard.rotation.z = 0.22;
    g.add(guard);
  }

  // Tubular Diamond Bicycle Frame
  const addTube = (p1, p2, r = 0.012, mat = frameMat) => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const len = v1.distanceTo(v2);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    cyl.position.copy(v1).add(v2).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
    cyl.castShadow = true;
    g.add(cyl);
  };

  addTube([-0.34, 0.155, 0], [-0.04, 0.16, 0]);
  addTube([-0.34, 0.155, 0], [-0.12, 0.42, 0]);
  addTube([-0.04, 0.16, 0], [-0.14, 0.46, 0], 0.014);
  addTube([-0.04, 0.16, 0], [0.22, 0.41, 0], 0.015);
  addTube([-0.12, 0.42, 0], [0.21, 0.42, 0], 0.013);
  addTube([0.34, 0.155, 0], [0.2, 0.54, 0], 0.014);

  // Chainring & handlebars & front basket / rear rack
  const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.012, 10), chromeMat);
  chainring.rotation.x = Math.PI / 2;
  chainring.position.set(-0.04, 0.16, 0.02);
  g.add(chainring);

  const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6), chromeMat);
  hBar.rotation.x = Math.PI / 2;
  hBar.position.set(0.18, 0.55, 0);
  g.add(hBar);

  if (era === 'modern' && variantIndex % 2 === 0) {
    // Front wire basket on student bicycle
    const basket = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.13, 0.18, 1, 0.02), getMat(0x475569, 0.5, 0.6));
    basket.position.set(0.28, 0.45, 0);
    g.add(basket);
  }

  const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.035, 0.09, 1, 0.014), leatherMat);
  saddle.position.set(-0.14, 0.47, 0);
  g.add(saddle);

  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.11), chromeMat);
  rack.position.set(-0.34, 0.33, 0);
  g.add(rack);
  if (era === 'baocap' && variantIndex % 2 === 0) {
    const bundle = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.11, 0.14, 1, 0.03), getMat(0x8c6d43, 0.88));
    bundle.position.set(-0.34, 0.39, 0);
    g.add(bundle);
  }

  const rider = createDetailedPerson(variantIndex, era, 'sit', {
    prop: era === 'modern' ? (variantIndex % 2 === 0 ? 'backpack' : 'none') : variantIndex % 2 === 0 ? 'satchel' : 'none'
  });
  rider.rotation.y = Math.PI / 2;
  rider.position.set(-0.11, 0.14, 0);
  rider.scale.setScalar(0.86);
  rider.userData.armL.rotation.x = -1.14;
  rider.userData.armR.rotation.x = -1.14;
  if (rider.userData.foreArmL) rider.userData.foreArmL.rotation.x = -0.16;
  if (rider.userData.foreArmR) rider.userData.foreArmR.rotation.x = -0.16;
  g.add(rider);
  for (const w of wheels) optimizeStaticSubtree(w, null, { unifyShadows: { cast: false, receive: false }, singlePbrBucket: 'gloss' });
  optimizeStaticSubtree(g, new Set([...wheels, rider]), { unifyShadows: { cast: true, receive: true } });

  g.userData = { rider, wheels, wheelRadius: 0.15 };
  return g;
}

function createPlateMaterial(plateText, bgHex = '#f1f5f9', textHex = '#0f172a') {
  const key = `plate:${plateText}:${bgHex}`;
  if (matCache.has(key)) return matCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 44);
  ctx.fillStyle = textHex;
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateText, 64, 25);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.15 });
  matCache.set(key, m);
  return m;
}

export function createDetailedMotorbike(variantIndex = 0, era = 'modern') {
  const g = new THREE.Group();
  addShadow(g, 1.08, 0.48, 0.56);

  const tireMat = getMat(0x18181b, 0.9, 0.05);
  const alloyMat = getMat(0x94a3b8, 0.28, 0.84);
  const chromeMat = getMat(0xd4dce6, 0.2, 0.9);
  const darkTrim = getMat(0x1e293b, 0.72, 0.15);
  const seatMat = getMat(0x111827, 0.78, 0.05);
  const mirrorMat = getMat(0x0f172a, 0.35, 0.6);
  const headlampMat = getMat(0xfef9c3, 0.15, 0.1, 'headlamp', { emissive: 0xfde047, emissiveIntensity: 0.55 });
  const blinkerMat = getMat(0xf59e0b, 0.24, 0.2);
  const tailMat = getMat(0xef4444, 0.25, 0.1, 'taillamp', { emissive: 0xdc2626, emissiveIntensity: 0.55 });

  const kind =
    era === 'baocap'
      ? 'cub81'
      : variantIndex % 4 === 3
      ? 'shipper'
      : variantIndex % 4 === 2
      ? 'underbone'
      : 'scooter';

  const paintPalette =
    kind === 'cub81'
      ? [0x4a6b53, 0x2b4c7e, 0x5f6b54]
      : kind === 'shipper'
      ? [0x1e293b, 0x991b1b, 0x0f766e]
      : [0x991b1b, 0x1e3a8a, 0xc7cfd9, 0x111827, 0x0e7490, 0xb45309, 0x065f46];
  const bodyMat = getMat(paintPalette[variantIndex % paintPalette.length], 0.24, 0.4);

  const wheels = [];
  for (const wx of [-0.3, 0.31]) {
    const wSpin = new THREE.Group();
    wSpin.position.set(wx, 0.145, 0);
    const tire = new THREE.Mesh(SHARED_GEO.wheelTire, tireMat);
    wSpin.add(tire);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.032, 10),
      kind === 'cub81' ? chromeMat : alloyMat
    );
    hub.rotation.x = Math.PI / 2;
    wSpin.add(hub);
    if (kind === 'cub81') {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 6, 14), chromeMat);
      wSpin.add(rim);
      for (let s = 0; s < 5; s += 1) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.19, 4), chromeMat);
        sp.rotation.z = (s * Math.PI) / 5;
        wSpin.add(sp);
      }
    } else {
      for (let s = 0; s < 3; s += 1) {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.016, 0.022), alloyMat);
        mag.rotation.z = (s * Math.PI) / 3;
        wSpin.add(mag);
      }
      if (wx > 0) {
        // Front drilled disc-brake rotor
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.008, 12), chromeMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.z = 0.024;
        wSpin.add(disc);
      }
    }
    g.add(wSpin);
    wheels.push(wSpin);
  }

  // Front forks + brake caliper + rear shock absorber springs
  for (const fz of [-0.055, 0.055]) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6), alloyMat);
    fork.position.set(0.27, 0.28, fz);
    fork.rotation.z = 0.26;
    g.add(fork);

    const shock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6),
      kind === 'underbone' ? getMat(0xdc2626, 0.4, 0.5) : chromeMat
    );
    shock.position.set(-0.26, 0.24, fz * 1.25);
    shock.rotation.z = -0.22;
    g.add(shock);
  }
  if (kind !== 'cub81') {
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, 0.026), getMat(0xb45309, 0.4, 0.6));
    caliper.position.set(0.26, 0.18, 0.035);
    g.add(caliper);
  }
  const frontFender = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.05, 0.11, 1, 0.02), bodyMat);
  frontFender.position.set(0.32, 0.25, 0);
  frontFender.rotation.z = -0.22;
  g.add(frontFender);

  const muffler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.034, 0.36, 8),
    kind === 'cub81' ? chromeMat : darkTrim
  );
  muffler.rotation.z = kind === 'cub81' ? Math.PI / 2 : Math.PI / 2 - 0.15;
  muffler.position.set(-0.23, 0.175, 0.098);
  g.add(muffler);
  if (kind !== 'cub81') {
    const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.014), chromeMat);
    heatShield.position.set(-0.23, 0.182, 0.13);
    heatShield.rotation.z = 0.15;
    g.add(heatShield);
  }

  if (kind === 'scooter') {
    const floorboard = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.06, 0.23, 1, 0.02), darkTrim);
    floorboard.position.set(0.04, 0.17, 0);
    g.add(floorboard);

    const frontShield = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.36, 0.25, 1, 0.045), bodyMat);
    frontShield.position.set(0.22, 0.35, 0);
    frontShield.rotation.z = 0.24;
    frontShield.castShadow = true;
    g.add(frontShield);

    // Chrome V-garnish & front turn-signal strips on scooter apron
    const vTrim = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.16), chromeMat);
    vTrim.position.set(0.3, 0.37, 0);
    vTrim.rotation.z = 0.24;
    g.add(vTrim);
    for (const bz of [-0.088, 0.088]) {
      const fBlink = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.075, 0.026), blinkerMat);
      fBlink.position.set(0.295, 0.39, bz);
      fBlink.rotation.z = 0.24;
      g.add(fBlink);
    }

    const rearPod = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.22, 0.25, 1, 0.06), bodyMat);
    rearPod.position.set(-0.18, 0.31, 0);
    rearPod.rotation.z = -0.08;
    rearPod.castShadow = true;
    g.add(rearPod);
  } else if (kind === 'cub81') {
    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.13, 0.14, 1, 0.03), bodyMat);
    spine.position.set(-0.04, 0.28, 0);
    g.add(spine);
    const whiteShield = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.33, 0.29, 1, 0.03), getMat(0xdad4c6, 0.42));
    whiteShield.position.set(0.19, 0.31, 0);
    whiteShield.rotation.z = 0.22;
    g.add(whiteShield);
    const frontBasket = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.12, 0.17, 1, 0.02), darkTrim);
    frontBasket.position.set(0.31, 0.44, 0);
    g.add(frontBasket);
  } else {
    const nose = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.24, 0.2, 1, 0.04), bodyMat);
    nose.position.set(0.22, 0.38, 0);
    nose.rotation.z = 0.35;
    nose.castShadow = true;
    g.add(nose);

    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.15, 0.17, 1, 0.04), bodyMat);
    spine.position.set(-0.12, 0.31, 0);
    spine.rotation.z = -0.14;
    spine.castShadow = true;
    g.add(spine);

    const engine = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.12, 0.16, 1, 0.02), alloyMat);
    engine.position.set(0.02, 0.19, 0);
    g.add(engine);

    // Footpeg bar for underbone/shipper bikes
    const pegBar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6), darkTrim);
    pegBar.rotation.x = Math.PI / 2;
    pegBar.position.set(0.06, 0.16, 0);
    g.add(pegBar);
  }

  const seat = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, 0.08, 0.19, 1, 0.03),
    kind === 'cub81' ? getMat(0x27272a, 0.72) : seatMat
  );
  seat.position.set(-0.14, 0.43, 0);
  seat.castShadow = true;
  g.add(seat);

  const grabRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.18), chromeMat);
  grabRail.position.set(-0.37, 0.45, 0);
  g.add(grabRail);

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.11), tailMat);
  tailLight.position.set(-0.4, 0.38, 0);
  g.add(tailLight);
  for (const rz of [-0.075, 0.075]) {
    const rBlink = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.032, 0.028), blinkerMat);
    rBlink.position.set(-0.395, 0.38, rz);
    g.add(rBlink);
  }

  const motoPlates = ['59-X3', '60-B8', '61-D1', '59-K2', '72-C1'];
  const plateMat =
    era === 'baocap'
      ? createPlateMaterial('50-812', '#334155', '#f8fafc')
      : createPlateMaterial(motoPlates[variantIndex % motoPlates.length]);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.075, 0.105), plateMat);
  plate.position.set(-0.42, 0.29, 0);
  plate.rotation.z = 0.28;
  g.add(plate);

  const cowl = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.22, 1, 0.03), bodyMat);
  cowl.position.set(0.2, 0.56, 0);
  g.add(cowl);

  const hLight = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), headlampMat);
  hLight.position.set(0.255, 0.56, 0);
  g.add(hLight);

  const grips = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 6), darkTrim);
  grips.rotation.x = Math.PI / 2;
  grips.position.set(0.19, 0.56, 0);
  g.add(grips);

  for (const mz of [-0.16, 0.16]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.11, 4), chromeMat);
    stalk.position.set(0.19, 0.62, mz * 0.78);
    stalk.rotation.x = mz < 0 ? -0.35 : 0.35;
    g.add(stalk);
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.025, 0.045, 0.07, 1, 0.01), mirrorMat);
    mirror.position.set(0.19, 0.67, mz);
    g.add(mirror);
  }

  const shipperBrands = [
    { jacket: 0x16a34a, box: 0x15803d, helm: 0x16a34a }, // Grab
    { jacket: 0xea580c, box: 0xc2410c, helm: 0xea580c }, // ShopeeFood
    { jacket: 0xeab308, box: 0xca8a04, helm: 0x1e3a8a } // Be
  ];
  const brand = shipperBrands[variantIndex % shipperBrands.length];

  const riderJacketCols = [0x1e293b, 0x0284c7, 0x15803d, 0xcad4df, 0x991b1b, 0x64748b, 0xfda4af, 0x93c5fd];
  const riderPantsCols = [0x1e293b, 0x1e3a5f, 0x334155, 0x27272a, 0xb8a878];
  const helmetCols = [0xcfd8e3, 0x1e293b, 0xdc2626, 0x0284c7, 0xeab308, 0xec4899, 0x10b981];
  const shoeCols = [0xcfd8e3, 0x1e293b, 0x991b1b, 0x0369a1];

  const makeRiderBody = (xPos, jCol, hCol, leanForward = true, hasPack = false, seedShift = 0) => {
    const r = new THREE.Group();
    r.position.set(xPos, 0.44, 0);
    const idx = variantIndex + seedShift;
    const isFemale = era === 'modern' && kind !== 'shipper' && idx % 2 === 1;
    const jMat = getMat(jCol, 0.72);
    const pMat = getMat(riderPantsCols[idx % riderPantsCols.length], 0.82);
    const sMat = getMat(SKIN_TONES[idx % SKIN_TONES.length], 0.62);
    const hairMat = getMat(HAIR_TONES[idx % HAIR_TONES.length], 0.85);
    const shoeMat = getMat(era === 'baocap' ? 0x451a03 : shoeCols[idx % shoeCols.length], 0.58);
    const soleMat = getMat(0xe2e8f0, 0.75);

    // Torso & Collar
    const torso = new THREE.Mesh(
      new RoundedBoxGeometry(isFemale ? 0.138 : 0.155, 0.25, isFemale ? 0.175 : 0.195, 1, 0.04),
      jMat
    );
    torso.position.set(0, 0.15, 0);
    torso.rotation.z = leanForward ? -0.18 : -0.05;
    torso.castShadow = true;
    r.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.065, 8), sMat);
    neck.position.set(leanForward ? 0.032 : 0.005, 0.28, 0);
    r.add(neck);

    // Head with sculpted face, ears, optional mask/glasses & Vietnamese open-face helmet
    const headX = leanForward ? 0.048 : 0.01;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), sMat);
    face.position.set(headX, 0.34, 0);
    r.add(face);

    for (const ez of [-0.084, 0.084]) {
      const ear = new THREE.Mesh(SHARED_GEO.ear, sMat);
      ear.position.set(headX - 0.005, 0.335, ez);
      r.add(ear);
    }
    for (const eyz of [-0.03, 0.03]) {
      const eye = new THREE.Mesh(SHARED_GEO.eye, getMat(0x0f172a, 0.3));
      eye.position.set(headX + 0.08, 0.35, eyz);
      r.add(eye);
    }

    if (era === 'modern' && idx % 3 === 1) {
      // Blue/white breathable commuter face mask
      const mask = new THREE.Mesh(new RoundedBoxGeometry(0.048, 0.052, 0.095, 1, 0.015), getMat(0x93c5fd, 0.78));
      mask.position.set(headX + 0.068, 0.318, 0);
      r.add(mask);
    }

    // Authentic Vietnamese half-shell / 3/4 helmet (or pith helmet in Bao cấp)
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.104, 12, 10, 0, Math.PI * 2, 0, era === 'baocap' ? Math.PI * 0.54 : Math.PI * 0.58),
      getMat(hCol, era === 'baocap' ? 0.8 : 0.26, era === 'baocap' ? 0.04 : 0.2)
    );
    helm.position.set(headX - 0.004, 0.358, 0);
    helm.castShadow = true;
    r.add(helm);

    // Helmet front peak visor + chinstrap
    const peak = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.014, 0.13, 1, 0.006), darkTrim);
    peak.position.set(headX + 0.082, 0.388, 0);
    peak.rotation.z = -0.15;
    r.add(peak);
    for (const cz of [-0.082, 0.082]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.008), darkTrim);
      strap.position.set(headX + 0.01, 0.32, cz);
      r.add(strap);
    }

    if (isFemale) {
      // Ponytail flowing behind helmet
      const tail = new THREE.Mesh(makeCapsule(0.028, 0.13), hairMat);
      tail.position.set(headX - 0.105, 0.29, 0);
      tail.rotation.z = -0.42;
      r.add(tail);
    } else {
      const napeHair = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.055, 0.13, 1, 0.018), hairMat);
      napeHair.position.set(headX - 0.068, 0.32, 0);
      r.add(napeHair);
    }

    if (kind === 'shipper' || (era === 'modern' && idx % 5 === 0)) {
      // Clear-smoke wind visor shield
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.106, 0.106, 0.048, 10, 1, true, Math.PI * 0.18, Math.PI * 0.64),
        getMat(0x1e293b, 0.12, 0.5, 'mvisor', { transparent: true, opacity: 0.55 })
      );
      visor.position.set(headX, 0.352, 0);
      r.add(visor);
    }

    if (hasPack) {
      const pack = new THREE.Mesh(
        new RoundedBoxGeometry(0.105, 0.2, 0.155, 1, 0.025),
        getMat(idx % 2 === 0 ? 0x334155 : 0x1e3a8a, 0.75)
      );
      pack.position.set(-0.105, 0.16, 0);
      pack.castShadow = true;
      r.add(pack);
    }

    for (const sz of [-1, 1]) {
      // Thigh + Calf + Two-Tone Sneaker/Sandal resting on floorboard/pegs!
      const thigh = new THREE.Mesh(makeCapsule(0.039, 0.135), pMat);
      thigh.position.set(0.068, 0.0, sz * 0.088);
      thigh.rotation.z = 1.18;
      r.add(thigh);

      const shin = new THREE.Mesh(makeCapsule(0.033, 0.13), pMat);
      shin.position.set(leanForward ? 0.125 : 0.085, -0.125, sz * 0.095);
      shin.rotation.z = leanForward ? -0.14 : 0.18;
      r.add(shin);

      const footX = leanForward ? 0.148 : 0.082;
      const footY = leanForward ? -0.225 : -0.21;
      const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.125, 0.042, 0.058, 1, 0.015), shoeMat);
      shoe.position.set(footX, footY, sz * 0.098);
      r.add(shoe);
      if (era === 'modern') {
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 0.062), soleMat);
        sole.position.set(footX, footY - 0.022, sz * 0.098);
        r.add(sole);
      }

      if (leanForward) {
        // Articulated Upper Arm + Forearm + Skin Hand gripping handlebar at (0.19 - xPos, 0.12, ±0.15)!
        const gripLocalX = 0.19 - xPos;
        const upperArm = new THREE.Mesh(makeCapsule(0.028, 0.115), jMat);
        upperArm.position.set(0.075, 0.185, sz * 0.115);
        upperArm.rotation.set(sz * 0.18, 0, 1.02);
        r.add(upperArm);

        const foreArm = new THREE.Mesh(makeCapsule(0.024, 0.11), idx % 2 === 0 ? jMat : sMat);
        foreArm.position.set(gripLocalX - 0.065, 0.132, sz * 0.14);
        foreArm.rotation.set(sz * 0.12, 0, 1.45);
        r.add(foreArm);

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), sMat);
        hand.position.set(gripLocalX, 0.12, sz * 0.15);
        r.add(hand);
      } else {
        // Pillion passenger holding driver's waist with hands!
        const pArm = new THREE.Mesh(makeCapsule(0.026, 0.14), jMat);
        pArm.position.set(0.085, 0.14, sz * 0.105);
        pArm.rotation.z = 1.32;
        const pHand = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), sMat);
        pHand.position.set(0.165, 0.115, sz * 0.095);
        r.add(pArm, pHand);
      }
    }
    g.add(r);
  };

  if (kind === 'shipper') {
    makeRiderBody(-0.04, brand.jacket, brand.helm, true, false, 0);
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.27, 0.28, 1, 0.03), getMat(brand.box, 0.45, 0.08));
    box.position.set(-0.31, 0.59, 0);
    box.castShadow = true;
    g.add(box);
    const refl = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.028, 0.29), getMat(0xcfd8e3, 0.35));
    refl.position.set(-0.31, 0.64, 0);
    g.add(refl);
  } else {
    const jCol = era === 'baocap' ? 0xcbc6ba : riderJacketCols[variantIndex % riderJacketCols.length];
    const hCol = era === 'baocap' ? 0x4b683b : helmetCols[variantIndex % helmetCols.length];
    const hasTwoRiders = era === 'modern' && (variantIndex % 4 === 1 || variantIndex % 7 === 0);
    makeRiderBody(-0.05, jCol, hCol, true, !hasTwoRiders && era === 'modern' && variantIndex % 2 === 0, 0);

    if (hasTwoRiders) {
      makeRiderBody(
        -0.26,
        riderJacketCols[(variantIndex + 3) % riderJacketCols.length],
        helmetCols[(variantIndex + 2) % helmetCols.length],
        false,
        true,
        3
      );
    }
  }

  for (const w of wheels) optimizeStaticSubtree(w, null, { unifyShadows: { cast: false, receive: false }, singlePbrBucket: 'gloss' });
  optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
  g.userData = { wheels, wheelRadius: 0.145 };
  return g;
}

function createExtrudedProfile(pts, width, mat, bevel = 0.04) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1
  });
  geo.translate(0, 0, -width * 0.5);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createDetailedCar(variantIndex = 0, era = 'modern') {
  const g = new THREE.Group();
  addShadow(g, 2.42, 1.2, 0.62);

  const tireMat = getMat(0x18181b, 0.9, 0.05);
  const rimMat = getMat(0xcbd5e1, 0.24, 0.86);
  const wellMat = getMat(0x0b111e, 0.92, 0.04);
  const glassMat = getMat(0x0a192f, 0.09, 0.78);
  const interiorMat = getMat(0x1e293b, 0.85, 0.05);
  const bumperMat = getMat(0x1e293b, 0.65, 0.2);
  const headMat = getMat(0xfef9c3, 0.18, 0.1, 'carhead', { emissive: 0xfef08a, emissiveIntensity: 0.65 });
  const blinkerMat = getMat(0xf59e0b, 0.24, 0.2);
  const tailMat = getMat(0xef4444, 0.22, 0.1, 'cartail', { emissive: 0xdc2626, emissiveIntensity: 0.65 });

  const wheels = [];
  const addCarWheels = (frontX, rearX, halfZ, radius = 0.165) => {
    for (const wx of [rearX, frontX]) {
      // Dark wheel-well liner so tires sit inside sculpted wheel arches
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.038, radius + 0.038, halfZ * 2.02, 14, 1, false, 0, Math.PI),
        wellMat
      );
      arch.rotation.x = Math.PI / 2;
      arch.rotation.y = Math.PI / 2;
      arch.position.set(wx, radius + 0.01, 0);
      g.add(arch);

      for (const wz of [-halfZ, halfZ]) {
        const wSpin = new THREE.Group();
        wSpin.position.set(wx, radius, wz);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.115, 12), tireMat);
        t.rotation.x = Math.PI / 2;
        t.castShadow = true;
        const r = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, 0.122, 10), rimMat);
        r.rotation.x = Math.PI / 2;
        wSpin.add(t, r);
        for (let sp = 0; sp < 3; sp += 1) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.15, 0.022, 0.126), bumperMat);
          spoke.rotation.z = (sp * Math.PI) / 3;
          wSpin.add(spoke);
        }
        optimizeStaticSubtree(wSpin, null, { unifyShadows: { cast: false, receive: false }, singlePbrBucket: 'gloss' });
        g.add(wSpin);
        wheels.push(wSpin);
      }
    }
    g.userData.wheels = wheels;
    g.userData.wheelRadius = radius;
  };

  if (era === 'baocap') {
    if (variantIndex % 2 === 0) {
      // Vintage 1980s Olive-Green State Cargo Truck (Xe tải thùng bạt Quốc doanh IFA W50)
      const cabMat = getMat(0x3f5232, 0.6, 0.18);
      const tarpMat = getMat(0x786e52, 0.88, 0.02);
      const woodBedMat = getMat(0x6b4423, 0.82, 0.04);

      addCarWheels(0.76, -0.68, 0.46, 0.2);

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 0.88), bumperMat);
      chassis.position.set(0, 0.24, 0);
      g.add(chassis);
      const fBumper = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.12, 0.98, 1, 0.02), bumperMat);
      fBumper.position.set(1.24, 0.26, 0);
      g.add(fBumper);

      // Lower cab + upper glazed cab with visible front & side windows!
      const cabLower = createExtrudedProfile(
        [
          [0.32, 0.26],
          [1.18, 0.26],
          [1.2, 0.64],
          [0.92, 0.68],
          [0.32, 0.68]
        ],
        0.9,
        cabMat,
        0.03
      );
      g.add(cabLower);

      const cabGlass = createExtrudedProfile(
        [
          [0.35, 0.66],
          [0.92, 0.66],
          [0.82, 1.04],
          [0.35, 1.04]
        ],
        0.88,
        glassMat,
        0.015
      );
      g.add(cabGlass);

      const cabRoof = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.08, 0.94, 1, 0.03), cabMat);
      cabRoof.position.set(0.58, 1.07, 0);
      g.add(cabRoof);
      const rearCabWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.93), cabMat);
      rearCabWall.position.set(0.35, 0.85, 0);
      g.add(rearCabWall);

      // Front radiator grille + round headlamps + side mirrors
      const grille = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.22, 0.56, 1, 0.01), bumperMat);
      grille.position.set(1.22, 0.46, 0);
      g.add(grille);

      const bed = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.36, 0.98, 1, 0.02), woodBedMat);
      bed.position.set(-0.46, 0.48, 0);
      bed.castShadow = true;
      g.add(bed);

      const tarp = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 1.44, 12, 1, false, 0, Math.PI), tarpMat);
      tarp.rotation.z = Math.PI / 2;
      tarp.rotation.x = -Math.PI / 2;
      tarp.position.set(-0.46, 0.66, 0);
      tarp.castShadow = true;
      g.add(tarp);

      // Canvas tarp structural ribs
      for (const rx of [-1.0, -0.46, 0.08]) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.495, 0.014, 6, 12, Math.PI), getMat(0x5c533c, 0.9));
        rib.rotation.y = Math.PI / 2;
        rib.position.set(rx, 0.66, 0);
        g.add(rib);
      }

      for (const lz of [-0.35, 0.35]) {
        const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 10), headMat);
        hl.rotation.z = Math.PI / 2;
        hl.position.set(1.22, 0.44, lz);
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.08), bumperMat);
        mir.position.set(0.84, 0.86, lz > 0 ? 0.51 : -0.51);
        g.add(hl, mir);
      }
      return optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
    }

    // Vintage 1980s Cream & Brick-Red Coach (Xe khách Ba Đình cũ + Baga mui chở hàng)
    const creamMat = getMat(0xcfc8b8, 0.55, 0.1);
    const redBand = getMat(0x881b1b, 0.52, 0.1);
    addCarWheels(0.82, -0.82, 0.46, 0.19);

    // Lower coach body + roof cap with framed multi-pane passenger windows in between!
    const lowerCoach = new THREE.Mesh(new RoundedBoxGeometry(2.58, 0.48, 0.96, 2, 0.06), creamMat);
    lowerCoach.position.set(0, 0.42, 0);
    lowerCoach.castShadow = true;
    g.add(lowerCoach);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.98), redBand);
    stripe.position.set(0, 0.41, 0);
    g.add(stripe);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.32, 0.92), glassMat);
    glassBand.position.set(0, 0.79, 0);
    g.add(glassBand);

    // Individual window pillars + split front windshield bar
    for (const px of [-1.2, -0.72, -0.24, 0.24, 0.72, 1.2]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.95), creamMat);
      pil.position.set(px, 0.79, 0);
      g.add(pil);
    }
    const centerSplit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), creamMat);
    centerSplit.position.set(1.21, 0.79, 0);
    g.add(centerSplit);

    const roofCoach = new THREE.Mesh(new RoundedBoxGeometry(2.54, 0.16, 0.95, 2, 0.06), creamMat);
    roofCoach.position.set(0, 1.01, 0);
    roofCoach.castShadow = true;
    g.add(roofCoach);

    const fBumper = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.1, 0.98, 1, 0.02), rimMat);
    fBumper.position.set(1.3, 0.24, 0);
    const rBumper = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.1, 0.98, 1, 0.02), rimMat);
    rBumper.position.set(-1.3, 0.24, 0);
    const grille = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.16, 0.54, 1, 0.01), bumperMat);
    grille.position.set(1.29, 0.38, 0);
    g.add(fBumper, rBumper, grille);

    for (const sz of [-0.35, 0.35]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 10), headMat);
      hl.rotation.z = Math.PI / 2;
      hl.position.set(1.29, 0.39, sz);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.12), tailMat);
      tl.position.set(-1.29, 0.39, sz);
      g.add(hl, tl);
    }

    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.05, 0.78), rimMat);
    rack.position.set(-0.1, 1.11, 0);
    g.add(rack);
    const luggage = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.16, 0.62, 1, 0.04), getMat(0x785a32, 0.85));
    luggage.position.set(-0.15, 1.2, 0);
    const sack2 = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.14, 0.52, 1, 0.04), getMat(0x4a5d46, 0.85));
    sack2.position.set(0.55, 1.18, 0);
    g.add(luggage, sack2);
    return optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
  }

  // MODERN VEHICLES:
  // 0: Xanh SM Electric Taxi | 1: Vinasun / Sedan | 2: Crossover SUV | 3: Compact Blue Box-Truck
  const type = variantIndex % 4;
  const carPlates = ['51K-889.68', '60A-452.19', '61A-318.05', '51H-246.88', '50E-109.79'];
  const plateMat = createPlateMaterial(
    carPlates[variantIndex % carPlates.length],
    type === 0 || (type === 1 && variantIndex % 8 === 1) ? '#facc15' : '#f1f5f9'
  );

  if (type === 3) {
    // Modern Light Cargo Mini-Truck (Thaco Towner / Kia Frontier)
    const cabMat = getMat(0x1d4ed8, 0.3, 0.38);
    const vanMat = getMat(0xc8d1db, 0.45, 0.3);
    addCarWheels(0.68, -0.64, 0.42, 0.165);

    // Lower cab up to beltline + protruding upper glazed cab so windows are 100% visible!
    const cabLower = createExtrudedProfile(
      [
        [0.24, 0.2],
        [1.06, 0.2],
        [1.08, 0.56],
        [0.24, 0.56]
      ],
      0.84,
      cabMat,
      0.03
    );
    g.add(cabLower);

    const cabGlass = createExtrudedProfile(
      [
        [0.27, 0.55],
        [1.02, 0.55],
        [0.86, 0.94],
        [0.27, 0.94]
      ],
      0.82,
      glassMat,
      0.015
    );
    g.add(cabGlass);

    const cabRoof = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.075, 0.86, 1, 0.03), cabMat);
    cabRoof.position.set(0.56, 0.97, 0);
    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.86), cabMat);
    cabBack.position.set(0.28, 0.75, 0);
    g.add(cabRoof, cabBack);

    const cargoBox = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.94, 0.94, 1, 0.03), vanMat);
    cargoBox.position.set(-0.46, 0.68, 0);
    cargoBox.castShadow = true;
    g.add(cargoBox);

    // Corrugated side ribs + rear barn-door seam on cargo box
    for (const ry of [0.48, 0.7, 0.92]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.025, 0.96), rimMat);
      rib.position.set(-0.46, ry, 0);
      g.add(rib);
    }
    const fPlate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.068, 0.24), plateMat);
    fPlate.position.set(1.12, 0.25, 0);
    g.add(fPlate);

    for (const lz of [-0.31, 0.31]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), headMat);
      hl.position.set(1.1, 0.38, lz);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.14), tailMat);
      tl.position.set(-1.16, 0.32, lz);
      const mir = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.12, 0.07, 1, 0.01), bumperMat);
      mir.position.set(0.92, 0.72, lz > 0 ? 0.47 : -0.47);
      g.add(hl, tl, mir);
    }
    return optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
  }

  const isSUV = type === 2 || type === 0;
  const isVinasun = type === 1 && variantIndex % 8 === 1;
  const paintHex =
    type === 0
      ? 0x0891b2 // Xanh SM Cyan Electric SUV/Crossover!
      : isVinasun
      ? 0xd8dfe8 // Vinasun White Taxi
      : type === 1
      ? variantIndex % 3 === 0
        ? 0x94a3b8
        : 0x1e3a5f
      : variantIndex % 3 === 0
      ? 0x1e293b
      : 0x881b1b;

  const paintMat = getMat(paintHex, 0.2, 0.5);
  addCarWheels(0.64, -0.64, 0.43, isSUV ? 0.175 : 0.16);

  // 1. Sculpted Lower Body up to Beltline ONLY (so upper greenhouse windows sit cleanly above!)
  const beltY = isSUV ? 0.54 : 0.49;
  const lowerPts = isSUV
    ? [
        [-1.04, 0.2],
        [1.06, 0.2],
        [1.08, 0.45],
        [0.58, beltY],
        [-0.98, beltY],
        [-1.04, 0.46]
      ]
    : [
        [-1.04, 0.18],
        [1.06, 0.18],
        [1.08, 0.41],
        [0.56, beltY],
        [-0.78, beltY],
        [-1.02, 0.45]
      ];
  const carBody = createExtrudedProfile(lowerPts, 0.86, paintMat, 0.035);
  g.add(carBody);

  // Dark lower rocker sills + front & rear bumper diffusers
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.045, 0.94), bumperMat);
  sill.position.set(0, 0.21, 0);
  g.add(sill);

  // 2. Crisp Reflective Automotive Glass Greenhouse (Windshield + Side Windows + Rear Window!)
  const roofY = isSUV ? 0.87 : 0.78;
  const cabinPts = isSUV
    ? [
        [-0.86, beltY - 0.02],
        [0.5, beltY - 0.02],
        [0.18, roofY],
        [-0.74, roofY]
      ]
    : [
        [-0.74, beltY - 0.02],
        [0.48, beltY - 0.02],
        [0.14, roofY],
        [-0.46, roofY]
      ];
  const glassHouse = createExtrudedProfile(cabinPts, 0.78, glassMat, 0.015);
  g.add(glassHouse);

  // Interior seat headrests silhouette visible subtly at cabin center
  const seatsIn = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.62), interiorMat);
  seatsIn.position.set(-0.12, beltY + 0.1, 0);
  g.add(seatsIn);

  // 3. Painted Roof Cap + A / B / C Structural Roof Pillars + Chrome Window Sill Trim
  const roofLen = isSUV ? 0.96 : 0.66;
  const roofCenterX = isSUV ? -0.28 : -0.16;
  const roofCap = new THREE.Mesh(new RoundedBoxGeometry(roofLen, 0.055, 0.81, 1, 0.024), paintMat);
  roofCap.position.set(roofCenterX, roofY + 0.018, 0);
  roofCap.castShadow = true;
  g.add(roofCap);

  // B-Pillar & C-Pillar & A-Pillars
  const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.055, roofY - beltY + 0.02, 0.825), bumperMat);
  bPillar.position.set(-0.12, (roofY + beltY) * 0.5, 0);
  g.add(bPillar);

  for (const sz of [-1, 1]) {
    // Painted A-pillars flanking front windshield
    const aPil = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.045), paintMat);
    aPil.position.set(0.33, (roofY + beltY) * 0.5, sz * 0.385);
    aPil.rotation.z = 0.76;
    // Painted C-pillars flanking rear window
    const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.34, 0.048), paintMat);
    cPil.position.set(isSUV ? -0.8 : -0.6, (roofY + beltY) * 0.5, sz * 0.385);
    cPil.rotation.z = isSUV ? -0.35 : -0.72;
    // Chrome beltline trim & door handles
    const chromeBelt = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.016, 0.016), rimMat);
    chromeBelt.position.set(-0.15, beltY + 0.02, sz * 0.415);
    const handle1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), rimMat);
    handle1.position.set(0.06, beltY - 0.06, sz * 0.468);
    const handle2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), rimMat);
    handle2.position.set(-0.36, beltY - 0.06, sz * 0.468);
    g.add(aPil, cPil, chromeBelt, handle1, handle2);
  }

  // Windshield wipers
  for (const wz of [-0.14, 0.14]) {
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.22), bumperMat);
    wiper.position.set(0.46, beltY + 0.035, wz);
    wiper.rotation.y = 0.2;
    g.add(wiper);
  }

  if (isVinasun) {
    // Signature Vinasun green & red waist stripes
    const gStripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.035, 0.945), getMat(0x15803d, 0.4));
    gStripe.position.set(0, 0.36, 0);
    const rStripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.025, 0.948), getMat(0xdc2626, 0.4));
    rStripe.position.set(0, 0.33, 0);
    g.add(gStripe, rStripe);
  }

  const grille = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.14, 0.5, 1, 0.02), bumperMat);
  grille.position.set(1.09, 0.31, 0);
  g.add(grille);

  if (type === 0) {
    // Signature VinFast V-shaped front & rear LED light strips!
    for (const sz of [-1, 1]) {
      const fVLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.24), headMat);
      fVLed.position.set(1.11, 0.42, sz * 0.13);
      fVLed.rotation.x = sz * 0.22;
      const rVLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.24), tailMat);
      rVLed.position.set(-1.06, 0.46, sz * 0.13);
      rVLed.rotation.x = sz * 0.2;
      g.add(fVLed, rVLed);
    }
  }

  const fPlate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.24), plateMat);
  fPlate.position.set(1.115, 0.23, 0);
  const rPlate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.068, 0.24), plateMat);
  rPlate.position.set(-1.075, 0.33, 0);
  g.add(fPlate, rPlate);

  for (const sz of [-1, 1]) {
    const hl = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.075, 0.16, 1, 0.02), headMat);
    hl.position.set(1.07, 0.39, sz * 0.32);
    const flBlink = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.06), blinkerMat);
    flBlink.position.set(1.075, 0.33, sz * 0.37);
    const tl = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.08, 0.18, 1, 0.02), tailMat);
    tl.position.set(-1.04, 0.43, sz * 0.31);
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.055, 0.11, 1, 0.02), paintMat);
    mirror.position.set(0.28, beltY + 0.05, sz * 0.47);
    g.add(hl, flBlink, tl, mirror);

    if (isSUV && type !== 0) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.03), rimMat);
      rail.position.set(-0.28, roofY + 0.055, sz * 0.33);
      g.add(rail);
    }
  }

  if (type === 0 || isVinasun) {
    const taxiSign = new THREE.Mesh(
      new RoundedBoxGeometry(0.16, 0.082, 0.34, 1, 0.02),
      getMat(0xfef9c3, 0.25, 0.05, 'taxisign', { emissive: 0xfacc15, emissiveIntensity: 0.45 })
    );
    taxiSign.position.set(-0.12, roofY + 0.08, 0);
    g.add(taxiSign);
  }

  return optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
}

export function createAmbulanceVanMesh() {
  // Clean compact Campus Medical Van parked outside Trạm Y Tế ĐHQG (with visible cab windows & medical crosses!)
  const g = new THREE.Group();
  addShadow(g, 2.25, 1.18, 0.6);
  const whiteBody = getMat(0xd4dce6, 0.3, 0.22);
  const redStripe = getMat(0xdc2626, 0.35, 0.1);
  const glassMat = getMat(0x0a192f, 0.1, 0.76);
  const tireMat = getMat(0x18181b, 0.9);
  const rimMat = getMat(0xcbd5e1, 0.3, 0.8);

  const vanLower = createExtrudedProfile(
    [
      [-1.0, 0.2],
      [1.02, 0.2],
      [1.04, 0.54],
      [-1.0, 0.54]
    ],
    0.86,
    whiteBody,
    0.035
  );
  g.add(vanLower);

  const vanUpper = createExtrudedProfile(
    [
      [-0.98, 0.52],
      [0.98, 0.52],
      [0.66, 0.96],
      [-0.96, 0.96]
    ],
    0.84,
    whiteBody,
    0.03
  );
  g.add(vanUpper);

  // Front sloped windshield & cab side windows protruding cleanly beyond whiteUpper!
  const cabGlass = createExtrudedProfile(
    [
      [0.32, 0.56],
      [0.95, 0.56],
      [0.67, 0.92],
      [0.32, 0.92]
    ],
    0.86,
    glassMat,
    0.015
  );
  g.add(cabGlass);

  const band = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.11, 0.95), redStripe);
  band.position.set(0, 0.46, 0);
  g.add(band);

  // Red medical cross emblem on both side panels of ambulance!
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.93), redStripe);
  crossH.position.set(-0.38, 0.75, 0);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.93), redStripe);
  crossV.position.set(-0.38, 0.75, 0);
  g.add(crossH, crossV);

  const siren = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.08, 0.44, 1, 0.02),
    getMat(0xef4444, 0.2, 0.1, 'siren', { emissive: 0xdc2626, emissiveIntensity: 0.48 })
  );
  siren.position.set(0.36, 1.03, 0);
  g.add(siren);

  for (const wx of [-0.6, 0.62]) {
    for (const wz of [-0.43, 0.43]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 14), tireMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.17, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.116, 10), rimMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, 0.17, wz);
      g.add(w, hub);
    }
  }
  return optimizeStaticSubtree(g, null, { unifyShadows: { cast: true, receive: true } });
}

function createLedRouteMaterial(text, badgeNum) {
  const key = `busled:${text}:${badgeNum}`;
  if (matCache.has(key)) return matCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(6, 8, 62, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeNum, 37, 33);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.fillText(text, 160, 33);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xf59e0b,
    emissiveMap: tex,
    emissiveIntensity: 0.42,
    roughness: 0.3
  });
  matCache.set(key, m);
  return m;
}

export function createBusMesh(routeNum = '08') {
  const g = new THREE.Group();
  addShadow(g, 3.68, 1.48, 0.68);

  const greenBody = getMat(0x15803d, 0.3, 0.2);
  const upperIvory = getMat(0xd4dce6, 0.36, 0.12);
  const yellowRibbon = getMat(0xd97706, 0.4, 0.1);
  const darkFrame = getMat(0x0f172a, 0.45, 0.3);
  const busGlass = getMat(0x0a1c34, 0.09, 0.72);
  const seatBlue = getMat(0x0284c7, 0.6);
  const tireMat = getMat(0x18181b, 0.9);
  const hubMat = getMat(0xcbd5e1, 0.3, 0.82);

  const lower = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.56, 1.06, 2, 0.06), greenBody);
  lower.position.set(0, 0.44, 0);
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.09, 1.08), yellowRibbon);
  ribbon.position.set(0, 0.68, 0);
  g.add(ribbon);

  const upper = new THREE.Mesh(new RoundedBoxGeometry(3.38, 0.62, 1.05, 2, 0.07), upperIvory);
  upper.position.set(0, 0.98, 0);
  upper.castShadow = true;
  g.add(upper);

  const fWind = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.48, 0.94, 1, 0.03), busGlass);
  fWind.position.set(1.68, 0.88, 0);
  const rWind = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.34, 0.88, 1, 0.03), busGlass);
  rWind.position.set(-1.67, 0.92, 0);
  g.add(fWind, rWind);

  const routeNames = { '08': 'ĐHQG - Q.8', '33': 'ĐHQG - AN SƯƠNG', '53': 'ĐHQG - Q.5' };
  const ledMat = createLedRouteMaterial(routeNames[routeNum] || 'ĐHQG - TP', routeNum);
  const fLed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.74), ledMat);
  fLed.position.set(1.7, 1.18, 0);
  const sLed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 1.085), ledMat);
  sLed.position.set(0.68, 0.6, 0);
  g.add(fLed, sLed);

  const busPlate = createPlateMaterial(`51B-0${routeNum}.88`, '#facc15');
  const fPlate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.26), busPlate);
  fPlate.position.set(1.715, 0.25, 0);
  g.add(fPlate);

  for (const wz of [-0.2, 0.18]) {
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.02), darkFrame);
    wiper.position.set(1.72, 0.74, wz);
    wiper.rotation.x = 0.38;
    g.add(wiper);
  }

  for (const mz of [-0.6, 0.6]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.18), darkFrame);
    arm.position.set(1.68, 1.16, mz * 0.85);
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.2, 0.09, 1, 0.02), darkFrame);
    pod.position.set(1.78, 1.04, mz);
    g.add(arm, pod);
  }

  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.42, 1.07), busGlass);
  sideGlass.position.set(-0.04, 0.95, 0);
  g.add(sideGlass);

  for (const px of [-1.15, -0.6, -0.05, 0.5, 1.05]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.46, 1.08), darkFrame);
    mullion.position.set(px, 0.95, 0);
    g.add(mullion);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.86), seatBlue);
    seat.position.set(px - 0.18, 0.82, 0);
    g.add(seat);
  }

  for (const dx of [-1.28, 1.28]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.86, 1.075), darkFrame);
    door.position.set(dx, 0.66, 0);
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.72, 1.085), busGlass);
    doorGlass.position.set(dx, 0.68, 0);
    g.add(door, doorGlass);
  }

  const cngPod = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.19, 0.68, 2, 0.06), getMat(0xcfd8e2, 0.45));
  cngPod.position.set(0.15, 1.37, 0);
  cngPod.castShadow = true;
  g.add(cngPod);

  const acPod = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.14, 0.64, 1, 0.04), getMat(0xbcc6d2, 0.5));
  acPod.position.set(-1.05, 1.35, 0);
  g.add(acPod);

  const headMat = getMat(0xfef9c3, 0.2, 0, 'bushead', { emissive: 0xfef08a, emissiveIntensity: 0.7 });
  const blinkMat = getMat(0xf59e0b, 0.24, 0.2);
  const tailMat = getMat(0xef4444, 0.2, 0, 'bustail', { emissive: 0xdc2626, emissiveIntensity: 0.7 });
  for (const sz of [-0.38, 0.38]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.18), headMat);
    hl.position.set(1.71, 0.36, sz);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.1), blinkMat);
    bl.position.set(1.71, 0.46, sz * 1.12);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.12), tailMat);
    tl.position.set(-1.71, 0.48, sz);
    g.add(hl, bl, tl);
  }

  const wheels = [];
  for (const wx of [-1.02, 1.04]) {
    for (const wz of [-0.5, 0.5]) {
      const wSpin = new THREE.Group();
      wSpin.position.set(wx, 0.22, wz);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 16), tireMat);
      t.rotation.x = Math.PI / 2;
      t.castShadow = true;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 10), hubMat);
      r.rotation.x = Math.PI / 2;
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), darkFrame);
      wSpin.add(t, r, lug);
      g.add(wSpin);
      wheels.push(wSpin);
    }
  }
  for (const w of wheels) optimizeStaticSubtree(w, null, { unifyShadows: { cast: false, receive: false }, singlePbrBucket: 'gloss' });
  optimizeStaticSubtree(g, new Set(wheels), { unifyShadows: { cast: true, receive: true } });
  g.userData = { wheels, wheelRadius: 0.22 };
  return g;
}

export function createMetroTrainMesh() {
  // Authentic Hitachi 5-Car HCMC Metro Line 1 (Bến Thành - Suối Tiên) — crisp silver-white body & flush sloped cab windshields!
  const g = new THREE.Group();
  const bodyMat = getMat(0xe2e8f0, 0.24, 0.28);
  const blueBand = getMat(0x0284c7, 0.28, 0.32);
  const cyanAccent = getMat(0x38bdf8, 0.28, 0.25);
  const darkGlass = getMat(0x091526, 0.1, 0.75, 'metroglass', { emissive: 0xbae6fd, emissiveIntensity: 0.18 });
  const doorFrameMat = getMat(0x94a3b8, 0.32, 0.68);
  const gangwayMat = getMat(0x1e293b, 0.85, 0.15);
  const bogieMat = getMat(0x0f172a, 0.75, 0.4);
  const pantoMat = getMat(0x64748b, 0.35, 0.85);
  const headMat = getMat(0xfef9c3, 0.15, 0, 'metrohead', { emissive: 0xfef08a, emissiveIntensity: 0.85 });
  const tailMat = getMat(0xef4444, 0.2, 0, 'metrotail', { emissive: 0xdc2626, emissiveIntensity: 0.75 });

  const offsets = [-6.9, -3.45, 0, 3.45, 6.9];
  for (let idx = 0; idx < offsets.length; idx += 1) {
    const ox = offsets[idx];
    const car = new THREE.Group();
    car.position.x = ox;

    const shell = new THREE.Mesh(new RoundedBoxGeometry(3.22, 1.02, 1.02, 2, 0.12), bodyMat);
    shell.position.y = 0.62;
    shell.castShadow = true;
    shell.receiveShadow = true;
    car.add(shell);

    const waist = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.15, 1.04), blueBand);
    waist.position.y = 0.42;
    car.add(waist);

    const thinLine = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.05, 1.045), cyanAccent);
    thinLine.position.y = 0.51;
    car.add(thinLine);

    const roofBand = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.03), blueBand);
    roofBand.position.y = 1.02;
    car.add(roofBand);

    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.34, 1.045), darkGlass);
    winStrip.position.y = 0.74;
    car.add(winStrip);

    for (const dx of [-1.02, 0, 1.02]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.76, 1.05), doorFrameMat);
      door.position.y = 0.56;
      door.position.x = dx;
      const dWin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 1.06), darkGlass);
      dWin.position.set(dx, 0.74, 0);
      car.add(door, dWin);
    }

    for (const bx of [-1.05, 1.05]) {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.88), bogieMat);
      bogie.position.set(bx, 0.1, 0);
      car.add(bogie);
    }
    const hvac = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.13, 0.62, 1, 0.04), doorFrameMat);
    hvac.position.y = 1.17;
    car.add(hvac);

    if (idx === 1 || idx === 3) {
      const panto = new THREE.Group();
      panto.position.set(0, 1.22, 0);
      const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.32), pantoMat);
      lowerArm.position.set(-0.1, 0.18, 0);
      lowerArm.rotation.z = 0.58;
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.28), pantoMat);
      upperArm.position.set(-0.08, 0.46, 0);
      upperArm.rotation.z = -0.55;
      const collector = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.68), pantoMat);
      collector.position.set(0.1, 0.66, 0);
      panto.add(lowerArm, upperArm, collector);
      car.add(panto);
    }

    g.add(car);

    if (idx < offsets.length - 1) {
      const bellow = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.92, 0.92, 1, 0.04), gangwayMat);
      bellow.position.set(ox + 1.725, 0.6, 0);
      g.add(bellow);
    }
  }

  // Streamlined Front (+X) & Rear (-X) Hitachi Nose Cones without negative scale determinant!
  for (const dir of [-1, 1]) {
    const nosePts =
      dir === 1
        ? [
            [0, 0.15],
            [0.92, 0.17],
            [0.98, 0.42],
            [0.44, 0.94],
            [0, 1.09]
          ]
        : [
            [-0.92, 0.17],
            [0, 0.15],
            [0, 1.09],
            [-0.44, 0.94],
            [-0.98, 0.42]
          ];
    const nose = createExtrudedProfile(nosePts, 0.95, bodyMat, 0.035);
    nose.position.x = dir * 8.44;
    g.add(nose);

    // Wrap-around Hitachi blue & cyan waist stripe on nose sides
    const noseBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 1.035), blueBand);
    noseBand.position.set(dir * 8.84, 0.41, 0);
    const noseCyan = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.045, 1.04), cyanAccent);
    noseCyan.position.set(dir * 8.8, 0.5, 0);
    g.add(noseBand, noseCyan);

    // Flush sloped driver cab windshield + side cab windows (aligned parallel to nose slope!)
    const cabGlass = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.08, 0.88, 1, 0.025), darkGlass);
    cabGlass.position.set(dir * 9.14, 0.72, 0);
    cabGlass.rotation.z = -dir * 0.76;
    const cabSideWin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 1.035), darkGlass);
    cabSideWin.position.set(dir * 8.7, 0.74, 0);
    g.add(cabGlass, cabSideWin);

    const skirt = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.16, 0.96, 1, 0.03), bogieMat);
    skirt.position.set(dir * 9.26, 0.18, 0);
    g.add(skirt);

    for (const lz of [-0.31, 0.31]) {
      const lamp = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.075, 0.16, 1, 0.02),
        dir === 1 ? headMat : tailMat
      );
      lamp.position.set(dir * 9.38, 0.38, lz);
      g.add(lamp);
    }
  }

  return optimizeStaticSubtree(g, null, { unifyShadows: { cast: true, receive: true } });
}

export function createBirdMesh() {
  const g = new THREE.Group();
  const bodyMat = getMat(0xcfd8e2, 0.65, 0.02);
  const tipMat = getMat(0x334155, 0.7, 0.02);

  const fuselage = new THREE.Mesh(makeCapsule(0.042, 0.16), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  g.add(fuselage);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 4), bodyMat);
  tail.rotation.z = -Math.PI / 2;
  tail.scale.set(1, 1, 0.3);
  tail.position.x = -0.14;
  g.add(tail);

  const makeWing = (side) => {
    const pivot = new THREE.Group();
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.28), bodyMat);
    inner.position.set(0.01, 0, side * 0.14);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.2), tipMat);
    outer.position.set(-0.02, 0.01, side * 0.34);
    outer.rotation.x = side * 0.12;
    pivot.add(inner, outer);
    optimizeStaticSubtree(pivot);
    g.add(pivot);
    return pivot;
  };

  const wL = makeWing(-1);
  const wR = makeWing(1);
  optimizeStaticSubtree(g, new Set([wL, wR]));
  g.userData.wL = wL;
  g.userData.wR = wR;
  return g;
}

export function createCloudMesh() {
  // Grounded soft sky-tinted clouds (merged into 1 draw call per cloud, never blinding pure white!)
  const g = new THREE.Group();
  const mat = getMat(0xcbd7e4, 0.96, 0.0, 'cloud', {
    transparent: true,
    opacity: 0.78
  });
  for (const [cx, cy, cz, rx, ry, rz] of [
    [0, 0, 0, 1.5, 0.85, 1.2],
    [-1.15, -0.14, 0.16, 1.05, 0.68, 0.95],
    [1.18, -0.12, -0.1, 1.1, 0.7, 0.95],
    [0.38, 0.28, 0.24, 0.9, 0.62, 0.85]
  ]) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), mat);
    puff.scale.set(rx, ry, rz);
    puff.position.set(cx, cy, cz);
    g.add(puff);
  }
  return optimizeStaticSubtree(g, null, { allowVertexColorMerge: false });
}
