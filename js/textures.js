import * as THREE from '../vendor/three.module.js';

let maxAniso = 4;
const texCache = new Map();
const baseCanvasCache = new Map();
const sharedStdMatCache = new Map();

export function getStandardMaterial(color, roughness = 0.68, metalness = 0.05, extra = {}) {
  const extraKeys = Object.keys(extra);
  if (extraKeys.length === 0) {
    const key = `${color}:${roughness}:${metalness}`;
    if (sharedStdMatCache.has(key)) return sharedStdMatCache.get(key);
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    sharedStdMatCache.set(key, m);
    return m;
  }
  if (extra.emissive !== undefined || extra.emissiveMap !== undefined) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  }
  const sig = extraKeys
    .sort()
    .map((k) => {
      const v = extra[k];
      if (v && v.isTexture) return `${k}:${v.uuid}`;
      if (v && v.isColor) return `${k}:${v.getHexString()}`;
      return `${k}:${String(v)}`;
    })
    .join('|');
  const key = `${color}:${roughness}:${metalness}|${sig}`;
  if (sharedStdMatCache.has(key)) return sharedStdMatCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  sharedStdMatCache.set(key, m);
  return m;
}

export function setMaxAnisotropy(n) {
  maxAniso = Math.max(1, Math.min(8, n || 4));
  for (const tex of texCache.values()) {
    if (tex && tex.isTexture) {
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
    }
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function registerTex(key, canvas, repX = 1, repY = 1, isColor = true, rotation = 0) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repX, repY);
  if (rotation !== 0) {
    tex.center.set(0.5, 0.5);
    tex.rotation = rotation;
  }
  tex.anisotropy = maxAniso;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texCache.set(key, tex);
  return tex;
}

function seededNoise(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampWallHex(hexColor, maxVal = 0.73) {
  const c = new THREE.Color(hexColor);
  const maxCh = Math.max(c.r, c.g, c.b);
  if (maxCh > maxVal) {
    c.multiplyScalar(maxVal / maxCh);
  }
  return `#${c.getHexString()}`;
}

export function getAsphaltMaps(repX = 10, repY = 2) {
  const key = `asphalt:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`),
      roughnessMap: texCache.get(`${key}:rough`)
    };
  }
  let base = baseCanvasCache.get('asphalt');
  if (!base) {
    const rng = seededNoise(101);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);
    const [cRough, gRough] = makeCanvas(512, 512);

    // Rich dark charcoal asphalt (prevents bright road washout)
    gMap.fillStyle = '#222832';
    gMap.fillRect(0, 0, 512, 512);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 512, 512);
    gRough.fillStyle = '#e2e2e2';
    gRough.fillRect(0, 0, 512, 512);

    // Realistic wheel-track wear bands
    for (const ly of [116, 204, 308, 396]) {
      const gr = gMap.createLinearGradient(0, ly - 32, 0, ly + 32);
      gr.addColorStop(0, 'rgba(12,16,24,0)');
      gr.addColorStop(0.5, 'rgba(10,14,22,0.42)');
      gr.addColorStop(1, 'rgba(12,16,24,0)');
      gMap.fillStyle = gr;
      gMap.fillRect(0, ly - 32, 512, 64);

      gRough.fillStyle = 'rgba(148,148,148,0.36)';
      gRough.fillRect(0, ly - 22, 512, 44);
    }

    // Fine crushed basalt aggregate & subtle tar repair seams
    for (let i = 0; i < 13000; i += 1) {
      const x = rng() * 512;
      const y = rng() * 512;
      const v = Math.floor(26 + rng() * 40);
      gMap.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
      gMap.fillRect(x, y, 2, 2);

      const bv = Math.floor(76 + rng() * 104);
      gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
      gBump.fillRect(x, y, 2, 2);
    }

    gMap.strokeStyle = 'rgba(14,18,26,0.55)';
    gMap.lineWidth = 2;
    for (let c = 0; c < 4; c += 1) {
      gMap.beginPath();
      let cx = rng() * 512;
      let cy = rng() * 512;
      gMap.moveTo(cx, cy);
      for (let s = 0; s < 5; s += 1) {
        cx += 22 + rng() * 34;
        cy += (rng() - 0.5) * 18;
        gMap.lineTo(cx, cy);
      }
      gMap.stroke();
    }
    base = { cMap, cBump, cRough };
    baseCanvasCache.set('asphalt', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false),
    roughnessMap: registerTex(`${key}:rough`, base.cRough, repX, repY, false)
  };
}

export function getLateriteRoadMaps(repX = 12, repY = 2, rotated = false) {
  // Authentic 1980s Thủ Đức weathered red-laterite shoulder + worn tar center road for Chặng 1 (Bao cấp)
  const key = `laterite:${repX}:${repY}${rotated ? ':rot' : ''}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`),
      roughnessMap: texCache.get(`${key}:rough`)
    };
  }
  let base = baseCanvasCache.get('laterite');
  if (!base) {
    const rng = seededNoise(151);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);
    const [cRough, gRough] = makeCanvas(512, 512);

    const gr = gMap.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#784c30');
    gr.addColorStop(0.16, '#5c4536');
    gr.addColorStop(0.5, '#3e3a37');
    gr.addColorStop(0.84, '#5c4536');
    gr.addColorStop(1, '#784c30');
    gMap.fillStyle = gr;
    gMap.fillRect(0, 0, 512, 512);

    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 512, 512);
    gRough.fillStyle = '#efefef';
    gRough.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 11000; i += 1) {
      const x = rng() * 512;
      const y = rng() * 512;
      const d = Math.floor(50 + rng() * 52);
      const isEdge = y < 95 || y > 417;
      gMap.fillStyle =
        isEdge || rng() > 0.55
          ? `rgba(${d + 38},${d + 10},${d - 14},0.38)`
          : `rgba(34,31,28,0.32)`;
      gMap.fillRect(x, y, 3, 2);
      const bv = Math.floor(68 + rng() * 118);
      gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
      gBump.fillRect(x, y, 3, 2);
    }
    base = { cMap, cBump, cRough };
    baseCanvasCache.set('laterite', base);
  }

  const rot = rotated ? Math.PI / 2 : 0;
  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true, rot),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false, rot),
    roughnessMap: registerTex(`${key}:rough`, base.cRough, repX, repY, false, rot)
  };
}

export function getSidewalkMaps(repX = 6, repY = 4) {
  const key = `sidewalk:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  let base = baseCanvasCache.get('sidewalk');
  if (!base) {
    const rng = seededNoise(202);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);

    // Grounded stone-grey mortar & mid-tone Vietnamese terrazzo sidewalk pavers (zero glare)
    gMap.fillStyle = '#4a535f';
    gMap.fillRect(0, 0, 512, 512);
    gBump.fillStyle = '#242424';
    gBump.fillRect(0, 0, 512, 512);

    const step = 64;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const shade = 126 + Math.floor((rng() - 0.5) * 16);
        const warm = (row + col) % 2 === 0 ? 5 : -3;
        gMap.fillStyle = `rgb(${shade + warm},${shade + 2},${shade - 2})`;
        gMap.fillRect(col * step + 3, row * step + 3, step - 6, step - 6);

        // Subtle inner scored terrazzo pattern
        gMap.strokeStyle = 'rgba(30,41,59,0.16)';
        gMap.lineWidth = 1;
        gMap.strokeRect(col * step + 10, row * step + 10, step - 20, step - 20);

        gBump.fillStyle = '#d0d0d0';
        gBump.fillRect(col * step + 3, row * step + 3, step - 6, step - 6);
      }
    }

    for (let i = 0; i < 3200; i += 1) {
      const x = rng() * 512;
      const y = rng() * 512;
      gMap.fillStyle = rng() > 0.5 ? 'rgba(203,213,225,0.14)' : 'rgba(30,41,59,0.18)';
      gMap.fillRect(x, y, 2, 2);
    }
    base = { cMap, cBump };
    baseCanvasCache.set('sidewalk', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getTactilePavingTexture(repX = 16, repY = 1) {
  const key = `tactile:${repX}:${repY}`;
  if (texCache.has(key)) return texCache.get(key);
  let c = baseCanvasCache.get('tactile');
  if (!c) {
    const [canvas, g] = makeCanvas(128, 128);
    g.fillStyle = '#b4821b';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#78500d';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 124, 124);
    for (let y = 20; y <= 108; y += 22) {
      for (let x = 20; x <= 108; x += 22) {
        g.fillStyle = '#d49b27';
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    c = canvas;
    baseCanvasCache.set('tactile', c);
  }
  return registerTex(key, c, repX, repY, true);
}

export function getGrassMaps(repX = 12, repY = 10) {
  const key = `grass:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  let base = baseCanvasCache.get('grass');
  if (!base) {
    const rng = seededNoise(303);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);

    // Deep, natural Southern Vietnamese tropical turf green
    gMap.fillStyle = '#366824';
    gMap.fillRect(0, 0, 512, 512);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 512, 512);

    // Organic soil & lush patch variation
    for (let p = 0; p < 48; p += 1) {
      const px = rng() * 512;
      const py = rng() * 512;
      const pr = 28 + rng() * 56;
      const gr = gMap.createRadialGradient(px, py, 2, px, py, pr);
      gr.addColorStop(0, rng() > 0.45 ? 'rgba(72,118,38,0.26)' : 'rgba(28,62,20,0.26)');
      gr.addColorStop(1, 'rgba(54,104,36,0)');
      gMap.fillStyle = gr;
      gMap.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }

    for (let i = 0; i < 11000; i += 1) {
      const x = rng() * 512;
      const y = rng() * 512;
      const pick = rng();
      if (pick < 0.42) gMap.fillStyle = 'rgba(92, 148, 52, 0.28)';
      else if (pick < 0.82) gMap.fillStyle = 'rgba(24, 68, 19, 0.32)';
      else gMap.fillStyle = 'rgba(96, 70, 42, 0.18)';
      gMap.fillRect(x, y, 2, 5);

      const bv = Math.floor(82 + rng() * 108);
      gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
      gBump.fillRect(x, y, 2, 4);
    }
    base = { cMap, cBump };
    baseCanvasCache.set('grass', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getBarkMaps(kind = 'dark') {
  const key = `bark:${kind}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(kind === 'palm' ? 361 : 355);
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  if (kind === 'palm') {
    gMap.fillStyle = '#6e675f';
    gMap.fillRect(0, 0, 256, 256);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 256, 256);
    // Horizontal ringed leaf-scar bands characteristic of Cau Vua (Royal Palm)
    for (let y = 0; y < 256; y += 14) {
      gMap.fillStyle = 'rgba(42,38,34,0.45)';
      gMap.fillRect(0, y, 256, 3);
      gMap.fillStyle = 'rgba(148,142,132,0.28)';
      gMap.fillRect(0, y + 3, 256, 4);
      gBump.fillStyle = '#383838';
      gBump.fillRect(0, y, 256, 3);
      gBump.fillStyle = '#c4c4c4';
      gBump.fillRect(0, y + 3, 256, 9);
    }
  } else {
    gMap.fillStyle = kind === 'light' ? '#5c4b3b' : '#463222';
    gMap.fillRect(0, 0, 256, 256);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 340; i += 1) {
      const x = rng() * 256;
      const y = rng() * 256;
      const w = 2 + rng() * 5;
      const h = 18 + rng() * 54;
      const dark = rng() > 0.44;
      gMap.fillStyle = dark ? 'rgba(24, 16, 10, 0.58)' : 'rgba(104, 82, 62, 0.36)';
      gMap.fillRect(x, y, w, h);

      gBump.fillStyle = dark ? '#323232' : '#cecece';
      gBump.fillRect(x, y, w, h);
    }
    // Subtle pale-green tropical moss/lichen specks
    for (let m = 0; m < 45; m += 1) {
      gMap.fillStyle = 'rgba(95, 118, 78, 0.22)';
      gMap.beginPath();
      gMap.arc(rng() * 256, rng() * 256, 3 + rng() * 5, 0, Math.PI * 2);
      gMap.fill();
    }
  }

  return {
    map: registerTex(`${key}:map`, cMap, 2, 2, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 2, 2, false)
  };
}

export function getFoliageMaps(baseHex = '#2a6228') {
  const key = `foliage:${baseHex}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(388 + baseHex.charCodeAt(1));
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  gMap.fillStyle = baseHex;
  gMap.fillRect(0, 0, 256, 256);
  gBump.fillStyle = '#787878';
  gBump.fillRect(0, 0, 256, 256);

  // Crisp overlapping botanical leaf clusters for rich canopy relief
  for (let i = 0; i < 2000; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 2.8 + rng() * 5.2;
    const ang = rng() * Math.PI;
    const lite = rng() > 0.48;
    gMap.fillStyle = lite ? 'rgba(220,245,190,0.16)' : 'rgba(8,26,12,0.28)';
    gMap.beginPath();
    gMap.ellipse(x, y, r, r * 0.56, ang, 0, Math.PI * 2);
    gMap.fill();

    const bv = lite ? 195 : 58;
    gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBump.beginPath();
    gMap.ellipse(x, y, r, r * 0.56, ang, 0, Math.PI * 2);
    gBump.fill();
  }

  return {
    map: registerTex(`${key}:map`, cMap, 2, 2, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 2, 2, false)
  };
}

export function getTerracottaRoofMaps(repX = 4, repY = 3, weathered = false) {
  const key = `tile:${repX}:${repY}:${weathered}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const baseKey = `tile:${weathered}`;
  let base = baseCanvasCache.get(baseKey);
  if (!base) {
    const rng = seededNoise(weathered ? 419 : 404);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);

    const rows = 12;
    const cols = 16;
    const rh = 512 / rows;
    const cw = 512 / cols;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw;
        const y = r * rh;
        const tone = Math.floor((rng() - 0.5) * (weathered ? 34 : 20));
        const baseR = weathered ? 138 : 168;
        const baseG = weathered ? 62 : 68;
        const baseB = weathered ? 36 : 34;
        const gr = gMap.createLinearGradient(x, y, x, y + rh);
        gr.addColorStop(0, `rgb(${baseR + tone},${baseG + Math.floor(tone * 0.4)},${baseB})`);
        gr.addColorStop(0.8, `rgb(${baseR - 26 + tone},${baseG - 14 + Math.floor(tone * 0.3)},${baseB - 8})`);
        gr.addColorStop(1, 'rgb(74,26,14)');
        gMap.fillStyle = gr;
        gMap.fillRect(x, y, cw, rh);

        gMap.fillStyle = 'rgba(38,12,6,0.32)';
        gMap.fillRect(x, y, 2.2, rh);

        const bGr = gBump.createLinearGradient(x, y, x + cw, y + rh);
        bGr.addColorStop(0, '#eaeaea');
        bGr.addColorStop(0.7, '#949494');
        bGr.addColorStop(1, '#2c2c2c');
        gBump.fillStyle = bGr;
        gBump.fillRect(x, y, cw - 2, rh - 2);
      }
    }

    if (weathered) {
      // Mossy damp streaks on old Bao cấp clay tiles
      for (let i = 0; i < 65; i += 1) {
        gMap.fillStyle = 'rgba(42, 58, 32, 0.26)';
        gMap.fillRect(rng() * 512, rng() * 512, 8 + rng() * 26, 6 + rng() * 20);
      }
    }
    base = { cMap, cBump };
    baseCanvasCache.set(baseKey, base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getStuccoMaps(hexColor = '#cfd6de', weathered = false) {
  const safeHex = clampWallHex(hexColor);
  const key = `stucco:${safeHex}:${weathered}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(weathered ? 517 : 505);
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  gMap.fillStyle = safeHex;
  gMap.fillRect(0, 0, 256, 256);

  gMap.strokeStyle = 'rgba(15,23,42,0.09)';
  gMap.lineWidth = 2;
  for (let y = 64; y < 256; y += 64) {
    gMap.beginPath();
    gMap.moveTo(0, y);
    gMap.lineTo(256, y);
    gMap.stroke();
  }

  const ao = gMap.createLinearGradient(0, 0, 0, 256);
  ao.addColorStop(0, weathered ? 'rgba(30,25,15,0.22)' : 'rgba(255,255,255,0.03)');
  ao.addColorStop(0.2, 'rgba(15,23,42,0)');
  ao.addColorStop(0.74, 'rgba(15,23,42,0)');
  ao.addColorStop(1, weathered ? 'rgba(35,32,22,0.38)' : 'rgba(15,23,42,0.24)');
  gMap.fillStyle = ao;
  gMap.fillRect(0, 0, 256, 256);

  if (weathered) {
    // Tropical monsoon vertical water streaks & aged lime plaster patches
    for (let s = 0; s < 36; s += 1) {
      const sx = rng() * 256;
      const sh = 35 + rng() * 110;
      const gr = gMap.createLinearGradient(0, 0, 0, sh);
      gr.addColorStop(0, 'rgba(48,42,28,0.28)');
      gr.addColorStop(1, 'rgba(48,42,28,0)');
      gMap.fillStyle = gr;
      gMap.fillRect(sx, 0, 2 + rng() * 5, sh);
    }
  }

  gBump.fillStyle = '#808080';
  gBump.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3800; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    gMap.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.065)';
    gMap.fillRect(x, y, 2, 2);
    const bv = Math.floor(102 + rng() * 52);
    gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBump.fillRect(x, y, 2, 2);
  }

  return {
    map: registerTex(`${key}:map`, cMap, 1, 1, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 1, 1, false)
  };
}

export function getGlassCurtainMaps(tintColor = '#1e4e79', warmInterior = false, cols = 4, rows = 4) {
  const key = `glass:${tintColor}:${warmInterior}:${cols}x${rows}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      roughnessMap: texCache.get(`${key}:rough`),
      emissiveMap: texCache.get(`${key}:emit`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(606 + cols * 13 + rows * 7);
  const [cMap, gMap] = makeCanvas(512, 512);
  const [cRough, gRough] = makeCanvas(512, 512);
  const [cEmit, gEmit] = makeCanvas(512, 512);
  const [cBump, gBump] = makeCanvas(512, 512);

  // Dark anodized aluminum mullion grid + concrete spandrel floor slabs
  gMap.fillStyle = '#293548';
  gMap.fillRect(0, 0, 512, 512);
  gRough.fillStyle = '#b4b4b4';
  gRough.fillRect(0, 0, 512, 512);
  gEmit.fillStyle = '#000000';
  gEmit.fillRect(0, 0, 512, 512);
  gBump.fillStyle = '#e4e4e4';
  gBump.fillRect(0, 0, 512, 512);

  const cw = 512 / cols;
  const rh = 512 / rows;

  for (let r = 0; r < rows; r += 1) {
    gMap.fillStyle = '#3e4c5e';
    gMap.fillRect(0, r * rh, 512, Math.max(6, rh * 0.17));

    for (let c = 0; c < cols; c += 1) {
      const x = c * cw + 6;
      const y = r * rh + Math.max(8, rh * 0.19);
      const w = cw - 12;
      const h = rh - Math.max(14, rh * 0.25);

      const isLit = rng() > (warmInterior ? 0.42 : 0.65);
      const hasBlind = rng() > 0.54;
      const gr = gMap.createLinearGradient(x, y, x + w * 0.6, y + h);
      if (isLit && warmInterior) {
        gr.addColorStop(0, '#3e5066');
        gr.addColorStop(0.38, '#c7a25c');
        gr.addColorStop(1, '#6c4f23');
      } else {
        gr.addColorStop(0, '#2e5c84');
        gr.addColorStop(0.48, '#173252');
        gr.addColorStop(1, '#0c192c');
      }
      gMap.fillStyle = gr;
      gMap.fillRect(x, y, w, h);

      if (hasBlind) {
        const blindH = h * (0.22 + rng() * 0.28);
        gMap.fillStyle = 'rgba(190, 202, 216, 0.32)';
        gMap.fillRect(x + 2, y + 2, w - 4, blindH);
      } else {
        gMap.fillStyle = 'rgba(12, 19, 34, 0.38)';
        gMap.fillRect(x, y, w, h * 0.24);
      }

      // Vertical casement bar + horizontal transom
      gMap.fillStyle = '#1b2536';
      gMap.fillRect(x + w * 0.5 - 1.5, y, 3, h);
      gMap.fillRect(x, y + h * 0.28, w, 2.5);

      // Subtle diagonal sky reflection
      gMap.fillStyle = 'rgba(170, 216, 248, 0.12)';
      gMap.beginPath();
      gMap.moveTo(x + w * 0.12, y);
      gMap.lineTo(x + w * 0.32, y);
      gMap.lineTo(x + w * 0.08, y + h);
      gMap.lineTo(x, y + h);
      gMap.closePath();
      gMap.fill();

      gRough.fillStyle = '#181818';
      gRough.fillRect(x, y, w, h);

      gBump.fillStyle = '#4c4c4c';
      gBump.fillRect(x, y, w, h);

      if (isLit) {
        if (warmInterior) {
          const roomPick = rng();
          gEmit.fillStyle =
            roomPick < 0.36
              ? '#fef3c7' // Warm fluorescent lecture/office tube
              : roomPick < 0.68
              ? '#fbbf24' // Soft golden study lamp
              : roomPick < 0.84
              ? '#d97706' // Cozy amber lounge light
              : '#bae6fd'; // Cool computer lab / monitor glow
        } else {
          gEmit.fillStyle = '#38bdf8';
        }
        const blindCut = hasBlind ? h * 0.28 : 4;
        gEmit.fillRect(x + 3, y + blindCut, w - 6, Math.max(4, h - blindCut - 4));
      }
    }
  }

  return {
    map: registerTex(`${key}:map`, cMap, 1, 1, true),
    roughnessMap: registerTex(`${key}:rough`, cRough, 1, 1, false),
    emissiveMap: registerTex(`${key}:emit`, cEmit, 1, 1, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 1, 1, false)
  };
}

export function getDormFacadeMaps(wallHex = '#cfd6de', accentHex = '#0284c7', cols = 6, rows = 5) {
  // Realistic Vietnamese KTX Khu B / University Dormitory concrete grid with recessed loggias & windows
  const safeWall = clampWallHex(wallHex);
  const key = `dorm:${safeWall}:${accentHex}:${cols}x${rows}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`),
      emissiveMap: texCache.get(`${key}:emit`)
    };
  }
  const rng = seededNoise(655 + cols * 11 + rows * 5);
  const [cMap, gMap] = makeCanvas(512, 512);
  const [cBump, gBump] = makeCanvas(512, 512);
  const [cEmit, gEmit] = makeCanvas(512, 512);

  gMap.fillStyle = safeWall;
  gMap.fillRect(0, 0, 512, 512);
  gBump.fillStyle = '#d8d8d8';
  gBump.fillRect(0, 0, 512, 512);
  gEmit.fillStyle = '#000000';
  gEmit.fillRect(0, 0, 512, 512);

  const cw = 512 / cols;
  const rh = 512 / rows;

  for (let r = 0; r < rows; r += 1) {
    // Concrete floor slab band & subtle drip shadow
    gMap.fillStyle = 'rgba(15,23,42,0.14)';
    gMap.fillRect(0, r * rh, 512, 5);
    gMap.fillStyle = accentHex;
    gMap.fillRect(0, r * rh + rh - 6, 512, 4);

    for (let c = 0; c < cols; c += 1) {
      const bx = c * cw + 8;
      const by = r * rh + 10;
      const bw = cw - 16;
      const bh = rh - 20;

      // Recessed loggia shadow cavity
      gMap.fillStyle = '#293548';
      gMap.fillRect(bx, by, bw, bh);
      gBump.fillStyle = '#404040';
      gBump.fillRect(bx, by, bw, bh);

      // Inner window glass
      const lit = rng() > 0.46;
      const roomTone = rng();
      gMap.fillStyle = !lit
        ? '#1b3654'
        : roomTone < 0.42
        ? '#cfc299'
        : roomTone < 0.78
        ? '#b8924e'
        : '#7da8c4';
      gMap.fillRect(bx + 5, by + 4, bw - 10, bh * 0.68);

      // Balcony parapet railing bars at bottom of each cell
      gMap.fillStyle = '#475569';
      gMap.fillRect(bx, by + bh * 0.66, bw, 4);
      for (let rx = bx + 4; rx < bx + bw - 2; rx += 7) {
        gMap.fillRect(rx, by + bh * 0.66, 2, bh * 0.34);
      }

      if (lit) {
        gEmit.fillStyle =
          roomTone < 0.42
            ? '#fef3c7' // KTX fluorescent study tube
            : roomTone < 0.72
            ? '#fde68a' // Soft warm dorm light
            : roomTone < 0.86
            ? '#f59e0b' // Warm bedside lamp
            : '#bae6fd'; // Cool late-night laptop / LED glow
        gEmit.fillRect(bx + 6, by + 5, bw - 12, bh * 0.6);
      }
    }
  }

  return {
    map: registerTex(`${key}:map`, cMap, 1, 1, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 1, 1, false),
    emissiveMap: registerTex(`${key}:emit`, cEmit, 1, 1, true)
  };
}

export function getCorrugatedTinMaps(rusty = false) {
  const key = `tin:${rusty}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(707);
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  for (let x = 0; x < 256; x += 1) {
    const wave = Math.sin((x / 12) * Math.PI * 2) * 0.5 + 0.5;
    const base = rusty ? 92 + wave * 36 : 116 + wave * 42;
    const r = rusty ? base + 26 : base - 10;
    const g = rusty ? base - 8 : base + 4;
    const b = rusty ? base - 22 : base + 16;
    gMap.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    gMap.fillRect(x, 0, 1, 256);

    const bv = Math.floor(50 + wave * 170);
    gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBump.fillRect(x, 0, 1, 256);
  }

  if (rusty) {
    for (let i = 0; i < 1100; i += 1) {
      gMap.fillStyle = rng() > 0.35 ? 'rgba(112, 42, 14, 0.32)' : 'rgba(68, 28, 10, 0.28)';
      gMap.fillRect(rng() * 256, rng() * 256, 4 + rng() * 10, 2 + rng() * 7);
    }
  }

  return {
    map: registerTex(`${key}:map`, cMap, 2, 2, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 2, 2, false)
  };
}

export function getRockCliffMaps(repX = 2, repY = 2) {
  const key = `rock:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  let base = baseCanvasCache.get('rock');
  if (!base) {
    const rng = seededNoise(808);
    const [cMap, gMap] = makeCanvas(512, 512);
    const [cBump, gBump] = makeCanvas(512, 512);

    // Authentic Hồ Đá Thủ Đức fractured grey-slate & weathered brown andesite quarry rock (angular cleavage, zero beehive rings!)
    gMap.fillStyle = '#4e4b47';
    gMap.fillRect(0, 0, 512, 512);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 512, 512);

    // Angular polygonal rock facets
    for (let p = 0; p < 140; p += 1) {
      const cx = rng() * 512;
      const cy = rng() * 512;
      const rw = 26 + rng() * 68;
      const rh = 38 + rng() * 96;
      const shade = 52 + Math.floor(rng() * 52);
      const warm = rng() > 0.55 ? 8 : -2;
      gMap.fillStyle = `rgba(${shade + warm},${shade + 3},${shade},0.62)`;
      gMap.beginPath();
      gMap.moveTo(cx - rw * 0.4, cy - rh * 0.5);
      gMap.lineTo(cx + rw * 0.5, cy - rh * 0.36);
      gMap.lineTo(cx + rw * 0.42, cy + rh * 0.48);
      gMap.lineTo(cx - rw * 0.48, cy + rh * 0.38);
      gMap.closePath();
      gMap.fill();

      const bv = Math.floor(62 + rng() * 135);
      gBump.fillStyle = `rgba(${bv},${bv},${bv},0.65)`;
      gBump.fill();
    }

    // Steep vertical & diagonal quarry blast fractures
    for (let f = 0; f < 34; f += 1) {
      let fx = rng() * 512;
      let fy = rng() * 120;
      gMap.strokeStyle = 'rgba(18,17,15,0.55)';
      gMap.lineWidth = 1.5 + rng() * 2.5;
      gBump.strokeStyle = '#262626';
      gBump.lineWidth = 2.5;
      gMap.beginPath();
      gBump.beginPath();
      gMap.moveTo(fx, fy);
      gBump.moveTo(fx, fy);
      for (let s = 0; s < 5; s += 1) {
        fx += (rng() - 0.5) * 28;
        fy += 55 + rng() * 55;
        gMap.lineTo(fx, fy);
        gBump.lineTo(fx, fy);
      }
      gMap.stroke();
      gBump.stroke();
    }

    // Subtle mossy damp patches & mineral speckles
    for (let m = 0; m < 28; m += 1) {
      gMap.fillStyle = 'rgba(54, 78, 42, 0.24)';
      gMap.beginPath();
      gMap.ellipse(rng() * 512, rng() * 512, 10 + rng() * 22, 6 + rng() * 12, rng() * 3, 0, Math.PI * 2);
      gMap.fill();
    }
    for (let i = 0; i < 5200; i += 1) {
      const x = rng() * 512;
      const y = rng() * 512;
      gMap.fillStyle = rng() > 0.5 ? 'rgba(185,180,172,0.13)' : 'rgba(18,16,14,0.22)';
      gMap.fillRect(x, y, 2, 3);
    }
    base = { cMap, cBump };
    baseCanvasCache.set('rock', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getBaoCapPadMaps(repX = 3, repY = 2) {
  const key = `baocappad:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  let base = baseCanvasCache.get('baocappad');
  if (!base) {
    const rng = seededNoise(833);
    const [cMap, gMap] = makeCanvas(256, 256);
    const [cBump, gBump] = makeCanvas(256, 256);

    // Authentic 1980s weathered laterite-dusted cement & compacted earth yard
    gMap.fillStyle = '#786652';
    gMap.fillRect(0, 0, 256, 256);
    gBump.fillStyle = '#808080';
    gBump.fillRect(0, 0, 256, 256);

    for (let p = 0; p < 32; p += 1) {
      const px = rng() * 256;
      const py = rng() * 256;
      const pr = 16 + rng() * 38;
      const gr = gMap.createRadialGradient(px, py, 2, px, py, pr);
      gr.addColorStop(0, rng() > 0.45 ? 'rgba(132,96,64,0.34)' : 'rgba(84,80,74,0.34)');
      gr.addColorStop(1, 'rgba(120,102,82,0)');
      gMap.fillStyle = gr;
      gMap.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    for (let i = 0; i < 3600; i += 1) {
      const x = rng() * 256;
      const y = rng() * 256;
      const v = Math.floor(75 + rng() * 65);
      gMap.fillStyle = `rgba(${v + 20},${v + 6},${v - 10},0.28)`;
      gMap.fillRect(x, y, 2, 2);
      const bv = Math.floor(72 + rng() * 110);
      gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
      gBump.fillRect(x, y, 2, 2);
    }
    base = { cMap, cBump };
    baseCanvasCache.set('baocappad', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getNationalFlagTexture() {
  const key = 'flag:vn';
  if (texCache.has(key)) return texCache.get(key);
  const [c, ctx] = makeCanvas(256, 160);
  ctx.fillStyle = '#c81e1e';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 44 : 17;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const fx = 128 + Math.cos(a) * r;
    const fy = 80 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(fx, fy);
    else ctx.lineTo(fx, fy);
  }
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function getWoodPlankMaps(repX = 2, repY = 2) {
  const key = `wood:${repX}:${repY}`;
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  let base = baseCanvasCache.get('wood');
  if (!base) {
    const rng = seededNoise(909);
    const [cMap, gMap] = makeCanvas(256, 256);
    const [cBump, gBump] = makeCanvas(256, 256);

    const planks = 6;
    const ph = 256 / planks;
    for (let p = 0; p < planks; p += 1) {
      const v = Math.floor(132 + (rng() - 0.5) * 26);
      gMap.fillStyle = `rgb(${v},${Math.floor(v * 0.65)},${Math.floor(v * 0.38)})`;
      gMap.fillRect(0, p * ph + 2, 256, ph - 3);
      gMap.fillStyle = 'rgba(48,18,4,0.46)';
      gMap.fillRect(0, p * ph, 256, 2);

      // Fine wood grain streaks
      for (let g = 0; g < 16; g += 1) {
        gMap.fillStyle = 'rgba(62,28,8,0.12)';
        gMap.fillRect(rng() * 180, p * ph + 4 + rng() * (ph - 8), 40 + rng() * 70, 1.5);
      }

      gBump.fillStyle = '#c8c8c8';
      gBump.fillRect(0, p * ph + 2, 256, ph - 3);
      gBump.fillStyle = '#282828';
      gBump.fillRect(0, p * ph, 256, 2);
    }
    base = { cMap, cBump };
    baseCanvasCache.set('wood', base);
  }

  return {
    map: registerTex(`${key}:map`, base.cMap, repX, repY, true),
    bumpMap: registerTex(`${key}:bump`, base.cBump, repX, repY, false)
  };
}

export function getWaterBumpMap() {
  const key = 'water:bump';
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 512);

  // Seamless 5-harmonic organic wind-blown lake ripple field (even integer frequencies -> 0 tile seam & 0 grid artifacts!)
  const tau = Math.PI * 2;
  for (let y = 0; y < 512; y += 2) {
    const vNorm = y / 512;
    for (let x = 0; x < 512; x += 2) {
      const uNorm = x / 512;
      const w =
        Math.sin((uNorm * 3 + vNorm * 1) * tau) * 0.32 +
        Math.cos((vNorm * 5 - uNorm * 2) * tau + 0.7) * 0.26 +
        Math.sin((uNorm * 7 - vNorm * 4) * tau + 1.9) * 0.2 +
        Math.cos((uNorm * 4 + vNorm * 9) * tau + 2.8) * 0.14 +
        Math.sin((uNorm * 11 + vNorm * 6) * tau + 0.4) * 0.08;
      const v = Math.floor(128 + w * 40);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  return registerTex(key, c, 3, 3, false);
}

export function getLakeWaterGradientTexture() {
  const key = 'water:hodagradient';
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(256, 256);
  // Deep quarry emerald-slate center fading to translucent rocky jade rim
  const gr = g.createRadialGradient(128, 128, 14, 128, 128, 126);
  gr.addColorStop(0, '#0b3b42');
  gr.addColorStop(0.58, '#0f5257');
  gr.addColorStop(0.88, '#196f68');
  gr.addColorStop(1, '#2b7a6b');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function getContactShadowTexture() {
  const key = 'contact:shadow';
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(10, 16, 28, 0.56)');
  gr.addColorStop(0.55, 'rgba(10, 16, 28, 0.24)');
  gr.addColorStop(1, 'rgba(10, 16, 28, 0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(key, tex);
  return tex;
}

export function createCrispSignMaterial(text, bgColor = '#0f172a', textColor = '#f1f5f9', borderColor = '#eab308') {
  const key = `sign:${text}|${bgColor}|${textColor}|${borderColor}`;
  if (texCache.has(key)) {
    return texCache.get(key);
  }
  const [c, ctx] = makeCanvas(512, 128);

  const gr = ctx.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, bgColor);
  gr.addColorStop(1, '#090d16');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 7;
  ctx.strokeRect(7, 7, 498, 114);

  let fontSize = 48;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (fontSize > 20) {
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    if (ctx.measureText(text).width <= 462) break;
    fontSize -= 2;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillText(text, 256, 68);
  ctx.fillStyle = textColor;
  ctx.fillText(text, 256, 65);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48, metalness: 0.08 });
  texCache.set(key, mat);
  return mat;
}

export function createStreetSignMaterial(line1, line2 = '', bgColor = '#1e3a8a', textColor = '#f8fafc', borderColor = '#e2e8f0') {
  const key = `stsign:${line1}|${line2}|${bgColor}`;
  if (texCache.has(key)) return texCache.get(key);
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 116);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (line2) {
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(line1, 128, 44);
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText(line2, 128, 84);
  } else {
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(line1, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.12 });
  texCache.set(key, mat);
  return mat;
}

export function getSportsFieldTexture(kind = 'football') {
  const key = `sports:${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(512, 512);

  if (kind === 'football') {
    for (let i = 0; i < 10; i += 1) {
      g.fillStyle = i % 2 === 0 ? '#1c6630' : '#165326';
      g.fillRect(i * 51.2, 0, 52, 512);
    }
    g.strokeStyle = '#d4dde4';
    g.lineWidth = 5;
    g.strokeRect(22, 22, 468, 468);
    g.beginPath();
    g.moveTo(256, 22);
    g.lineTo(256, 490);
    g.stroke();
    g.beginPath();
    g.arc(256, 256, 56, 0, Math.PI * 2);
    g.stroke();
    g.strokeRect(22, 146, 74, 220);
    g.strokeRect(416, 146, 74, 220);
  } else {
    g.fillStyle = '#1d4c84';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#a84c14';
    g.fillRect(36, 44, 440, 424);
    g.strokeStyle = '#d8e0e8';
    g.lineWidth = 5;
    g.strokeRect(36, 44, 440, 424);
    g.beginPath();
    g.moveTo(256, 44);
    g.lineTo(256, 468);
    g.stroke();
    g.beginPath();
    g.arc(256, 256, 52, 0, Math.PI * 2);
    g.stroke();
    // Three-point arcs
    g.beginPath();
    g.arc(76, 256, 118, -Math.PI * 0.42, Math.PI * 0.42);
    g.stroke();
    g.beginPath();
    g.arc(436, 256, 118, Math.PI * 0.58, Math.PI * 1.42);
    g.stroke();
    g.fillStyle = '#1b3878';
    g.fillRect(36, 186, 86, 140);
    g.fillRect(390, 186, 86, 140);
    g.strokeRect(36, 186, 86, 140);
    g.strokeRect(390, 186, 86, 140);
  }
  return registerTex(key, c, 1, 1, true);
}

export function getStripedAwningTexture(colorA = '#c2410c', colorB = '#dfd8cc') {
  const safeB = clampWallHex(colorB);
  const key = `awning:${colorA}:${safeB}`;
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(256, 256);
  const bands = 8;
  const bw = 256 / bands;
  for (let i = 0; i < bands; i += 1) {
    g.fillStyle = i % 2 === 0 ? colorA : safeB;
    g.fillRect(i * bw, 0, bw, 256);
  }
  const shade = g.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.06)');
  shade.addColorStop(1, 'rgba(15,23,42,0.28)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 256);
  return registerTex(key, c, 2, 1, true);
}

export function getBrickWallMaps(hexTint = '#8f3112') {
  const key = `brick:${hexTint}`;
  if (texCache.has(`${key}:map`)) {
    return { map: texCache.get(`${key}:map`), bumpMap: texCache.get(`${key}:bump`) };
  }
  const rng = seededNoise(991);
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  gMap.fillStyle = '#7b8490';
  gMap.fillRect(0, 0, 256, 256);
  gBump.fillStyle = '#303030';
  gBump.fillRect(0, 0, 256, 256);

  const rows = 12;
  const cols = 6;
  const rh = 256 / rows;
  const cw = 256 / cols;

  for (let r = 0; r < rows; r += 1) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c += 1) {
      const bx = c * cw + offset;
      const by = r * rh;
      gMap.fillStyle = hexTint;
      gMap.fillRect(bx + 2, by + 2, cw - 4, rh - 4);
      gMap.fillStyle = `rgba(0,0,0,${(rng() * 0.24).toFixed(2)})`;
      gMap.fillRect(bx + 2, by + 2, cw - 4, rh - 4);

      gBump.fillStyle = '#d4d4d4';
      gBump.fillRect(bx + 2, by + 2, cw - 4, rh - 4);
    }
  }
  return {
    map: registerTex(`${key}:map`, cMap, 2, 2, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 2, 2, false)
  };
}


export function getNeutralFoliageMaps() {
  const key = 'foliage:neutral:vcol';
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const rng = seededNoise(392);
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  gMap.fillStyle = '#dfe7dd';
  gMap.fillRect(0, 0, 256, 256);
  gBump.fillStyle = '#787878';
  gBump.fillRect(0, 0, 256, 256);

  // Neutral high-relief botanical leaf clusters ready for exact vertex-color tinting
  for (let i = 0; i < 2200; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 2.8 + rng() * 5.2;
    const ang = rng() * Math.PI;
    const lite = rng() > 0.48;
    gMap.fillStyle = lite ? 'rgba(255,255,255,0.42)' : 'rgba(22,36,24,0.36)';
    gMap.beginPath();
    gMap.ellipse(x, y, r, r * 0.56, ang, 0, Math.PI * 2);
    gMap.fill();

    const bv = lite ? 198 : 56;
    gBump.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBump.beginPath();
    gBump.ellipse(x, y, r, r * 0.56, ang, 0, Math.PI * 2);
    gBump.fill();
  }

  return {
    map: registerTex(`${key}:map`, cMap, 2, 2, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 2, 2, false)
  };
}

export function getManholeMaps() {
  const key = 'street:manhole';
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const [cMap, gMap] = makeCanvas(256, 256);
  const [cBump, gBump] = makeCanvas(256, 256);

  // Cast-iron manhole lid with outer seating rim, radial ribs, waffle studs & pry slots
  gMap.fillStyle = '#2d343e';
  gMap.fillRect(0, 0, 256, 256);
  gBump.fillStyle = '#707070';
  gBump.fillRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;

  // Outer seating flange + dark recessed lid gap
  gMap.strokeStyle = '#475261';
  gMap.lineWidth = 14;
  gMap.beginPath();
  gMap.arc(cx, cy, 118, 0, Math.PI * 2);
  gMap.stroke();

  gBump.strokeStyle = '#d4d4d4';
  gBump.lineWidth = 14;
  gBump.beginPath();
  gBump.arc(cx, cy, 118, 0, Math.PI * 2);
  gBump.stroke();

  gMap.strokeStyle = '#11161d';
  gMap.lineWidth = 6;
  gMap.beginPath();
  gMap.arc(cx, cy, 107, 0, Math.PI * 2);
  gMap.stroke();

  gBump.strokeStyle = '#181818';
  gBump.lineWidth = 6;
  gBump.beginPath();
  gBump.arc(cx, cy, 107, 0, Math.PI * 2);
  gBump.stroke();

  // Inner concentric cast-iron rings
  for (const r of [98, 66, 34]) {
    gMap.strokeStyle = '#4d5968';
    gMap.lineWidth = 6;
    gMap.beginPath();
    gMap.arc(cx, cy, r, 0, Math.PI * 2);
    gMap.stroke();

    gBump.strokeStyle = '#e0e0e0';
    gBump.lineWidth = 6;
    gBump.beginPath();
    gBump.arc(cx, cy, r, 0, Math.PI * 2);
    gBump.stroke();
  }

  // 12 radial structural cast-iron ribs
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6;
    const r0 = i % 2 === 0 ? 34 : 66;
    gMap.strokeStyle = '#4a5564';
    gMap.lineWidth = 5;
    gMap.beginPath();
    gMap.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    gMap.lineTo(cx + Math.cos(a) * 98, cy + Math.sin(a) * 98);
    gMap.stroke();

    gBump.strokeStyle = '#dcdcdc';
    gBump.lineWidth = 5;
    gBump.beginPath();
    gBump.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    gBump.lineTo(cx + Math.cos(a) * 98, cy + Math.sin(a) * 98);
    gBump.stroke();
  }

  // Anti-slip raised studs in middle band + 2 pry/ventilation keyhole slots
  for (let i = 0; i < 12; i += 1) {
    const a = ((i + 0.5) * Math.PI) / 6;
    for (const rr of [50, 82]) {
      const sx = cx + Math.cos(a) * rr;
      const sy = cy + Math.sin(a) * rr;
      gMap.fillStyle = '#556273';
      gMap.beginPath();
      gMap.arc(sx, sy, 3.5, 0, Math.PI * 2);
      gMap.fill();

      gBump.fillStyle = '#e8e8e8';
      gBump.beginPath();
      gBump.arc(sx, sy, 3.5, 0, Math.PI * 2);
      gBump.fill();
    }
  }

  for (const sx of [cx - 90, cx + 90]) {
    gMap.fillStyle = '#0d1117';
    gMap.fillRect(sx - 5, cy - 10, 10, 20);
    gBump.fillStyle = '#101010';
    gBump.fillRect(sx - 5, cy - 10, 10, 20);
  }

  // Central cast relief emblem
  gMap.fillStyle = '#556273';
  gMap.font = '900 16px system-ui, sans-serif';
  gMap.textAlign = 'center';
  gMap.textBaseline = 'middle';
  gMap.fillText('ĐHQG', cx, cy);
  gBump.fillStyle = '#e2e2e2';
  gBump.font = '900 16px system-ui, sans-serif';
  gBump.textAlign = 'center';
  gBump.textBaseline = 'middle';
  gBump.fillText('ĐHQG', cx, cy);

  return {
    map: registerTex(`${key}:map`, cMap, 1, 1, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 1, 1, false)
  };
}

export function getStormGrateMaps() {
  const key = 'street:stormgrate';
  if (texCache.has(`${key}:map`)) {
    return {
      map: texCache.get(`${key}:map`),
      bumpMap: texCache.get(`${key}:bump`)
    };
  }
  const [cMap, gMap] = makeCanvas(256, 128);
  const [cBump, gBump] = makeCanvas(256, 128);

  // Heavy cast-iron perimeter frame
  gMap.fillStyle = '#38424f';
  gMap.fillRect(0, 0, 256, 128);
  gBump.fillStyle = '#d4d4d4';
  gBump.fillRect(0, 0, 256, 128);

  gMap.strokeStyle = '#4e5b6b';
  gMap.lineWidth = 10;
  gMap.strokeRect(5, 5, 246, 118);

  // Center longitudinal spine bar
  const slots = 8;
  const padX = 20;
  const stepX = (256 - padX * 2) / slots;
  for (let i = 0; i < slots; i += 1) {
    const sx = padX + i * stepX + 4;
    const sw = stepX - 8;
    for (const [sy, sh] of [
      [16, 42],
      [70, 42]
    ]) {
      gMap.fillStyle = '#090d14';
      gMap.fillRect(sx, sy, sw, sh);
      gBump.fillStyle = '#141414';
      gBump.fillRect(sx, sy, sw, sh);
    }
  }

  return {
    map: registerTex(`${key}:map`, cMap, 1, 1, true),
    bumpMap: registerTex(`${key}:bump`, cBump, 1, 1, false)
  };
}

export function getTrafficSignTexture(kind = 'roundabout') {
  const key = `trafficsign:${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const [c, g] = makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);

  if (kind === 'roundabout') {
    // Vietnamese R.303 Roundabout Sign: blue disc, crisp white rim, 3 counter-clockwise white directional arrows (right-hand traffic!)
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.arc(128, 128, 122, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#1d4ed8';
    g.beginPath();
    g.arc(128, 128, 110, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#f8fafc';
    g.fillStyle = '#f8fafc';
    g.lineWidth = 16;
    g.lineCap = 'round';

    for (let i = 0; i < 3; i += 1) {
      // In canvas 2D (+Y down), decreasing angle with anticlockwise=true sweeps counter-clockwise!
      const a0 = (i * Math.PI * 2) / 3 + 0.35;
      const a1 = a0 - 1.28;
      g.beginPath();
      g.arc(128, 128, 62, a0, a1, true);
      g.stroke();

      // Arrowhead at counter-clockwise leading end (a1)
      const tipA = a1 - 0.22;
      const tx = 128 + Math.cos(tipA) * 62;
      const ty = 128 + Math.sin(tipA) * 62;
      const backA = a1 + 0.14;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(128 + Math.cos(backA) * 40, 128 + Math.sin(backA) * 40);
      g.lineTo(128 + Math.cos(backA) * 84, 128 + Math.sin(backA) * 84);
      g.closePath();
      g.fill();
    }
  } else {
    // Vietnamese I.423a Pedestrian Crosswalk Sign
    g.fillStyle = '#f8fafc';
    g.fillRect(8, 8, 240, 240);
    g.fillStyle = '#0284c7';
    g.fillRect(18, 18, 220, 220);
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.moveTo(128, 38);
    g.lineTo(222, 206);
    g.lineTo(34, 206);
    g.closePath();
    g.fill();
    // Zebra bars + pedestrian silhouette
    g.fillStyle = '#0f172a';
    for (let x = 68; x <= 176; x += 26) {
      g.fillRect(x, 178, 14, 20);
    }
    g.beginPath();
    g.arc(128, 98, 13, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#0f172a';
    g.beginPath();
    g.moveTo(128, 112);
    g.lineTo(124, 146);
    g.lineTo(106, 174);
    g.moveTo(124, 146);
    g.lineTo(148, 174);
    g.moveTo(108, 132);
    g.lineTo(148, 126);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

const mergedMatCache = new Map();

function getSharedVColorMat(pbrKind, side) {
  const key = `vcol:${pbrKind}:${side}`;
  if (mergedMatCache.has(key)) return mergedMatCache.get(key);
  let roughness = 0.76;
  let metalness = 0.04;
  if (pbrKind === 'glass_spec') {
    roughness = 0.09;
    metalness = 0.76;
  } else if (pbrKind === 'metal') {
    roughness = 0.26;
    metalness = 0.72;
  } else if (pbrKind === 'gloss') {
    roughness = 0.26;
    metalness = 0.24;
  }
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    side,
    vertexColors: true
  });
  mergedMatCache.set(key, m);
  return m;
}

function getSharedTexVColorMat(templateMat) {
  const key = `texvcol:${templateMat.map.uuid}:${templateMat.bumpMap ? templateMat.bumpMap.uuid : ''}:${
    templateMat.roughnessMap ? templateMat.roughnessMap.uuid : ''
  }:${templateMat.roughness.toFixed(2)}:${templateMat.metalness.toFixed(2)}:${templateMat.bumpScale.toFixed(3)}:${
    templateMat.side
  }`;
  if (mergedMatCache.has(key)) return mergedMatCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: templateMat.map,
    bumpMap: templateMat.bumpMap || null,
    bumpScale: templateMat.bumpScale,
    roughnessMap: templateMat.roughnessMap || null,
    roughness: templateMat.roughness,
    metalness: templateMat.metalness,
    side: templateMat.side,
    vertexColors: true
  });
  mergedMatCache.set(key, m);
  return m;
}

export function optimizeStaticSubtree(root, skipNodes = null, opts = {}) {
  const skipSet = skipNodes instanceof Set ? skipNodes : new Set(skipNodes || []);
  const unifyShadows = opts.unifyShadows || null;
  const allowVColor = opts.allowVertexColorMerge !== false;
  const singlePbrBucket = opts.singlePbrBucket || null;

  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const buckets = new Map();

  function collect(obj) {
    if (skipSet.has(obj) || !obj.visible) return;
    if (
      obj.isMesh &&
      !obj.isInstancedMesh &&
      !obj.isSkinnedMesh &&
      !Array.isArray(obj.material) &&
      obj.geometry &&
      obj.material &&
      obj.children.length === 0
    ) {
      const attrs = obj.geometry.attributes;
      if (
        attrs.position &&
        attrs.normal &&
        attrs.position.itemSize === 3 &&
        attrs.normal.itemSize === 3 &&
        (!attrs.uv || attrs.uv.itemSize === 2) &&
        (!attrs.color || attrs.color.itemSize >= 3)
      ) {
        const relMat = invRoot.clone().multiply(obj.matrixWorld);
        if (relMat.determinant() > 0) {
          const mat = obj.material;
          const zeroEmissive =
            !mat.emissive || (mat.emissive.r === 0 && mat.emissive.g === 0 && mat.emissive.b === 0);
          const isDecal = Boolean(mat.transparent && !mat.depthWrite);
          const cast =
            isDecal || !zeroEmissive ? false : unifyShadows ? Boolean(unifyShadows.cast) : Boolean(obj.castShadow);
          const receive = isDecal ? false : unifyShadows ? Boolean(unifyShadows.receive) : Boolean(obj.receiveShadow);

          const isPureSolid =
            allowVColor &&
            mat.isMeshStandardMaterial &&
            !mat.map &&
            !mat.bumpMap &&
            !mat.normalMap &&
            !mat.roughnessMap &&
            !mat.metalnessMap &&
            !mat.aoMap &&
            !mat.alphaMap &&
            !mat.emissiveMap &&
            !mat.transparent &&
            !mat.flatShading &&
            !mat.wireframe &&
            mat.opacity >= 0.999 &&
            zeroEmissive;

          const isTexTintable =
            allowVColor &&
            !isPureSolid &&
            mat.isMeshStandardMaterial &&
            Boolean(mat.map) &&
            !mat.normalMap &&
            !mat.metalnessMap &&
            !mat.aoMap &&
            !mat.alphaMap &&
            !mat.emissiveMap &&
            !mat.transparent &&
            !mat.flatShading &&
            !mat.wireframe &&
            mat.opacity >= 0.999 &&
            zeroEmissive;

          let key;
          let mode = 'exact';
          let pbrKind = 'matte';

          if (isPureSolid) {
            mode = 'vcol';
            if (singlePbrBucket) pbrKind = singlePbrBucket;
            else if (mat.metalness >= 0.55 && mat.roughness < 0.16) pbrKind = 'glass_spec';
            else if (mat.metalness >= 0.62) pbrKind = 'metal';
            else if (mat.roughness < 0.48) pbrKind = 'gloss';
            else pbrKind = 'matte';
            key = `vcol:${pbrKind}:${mat.side}|${cast ? 1 : 0}|${receive ? 1 : 0}`;
          } else if (isTexTintable) {
            mode = 'texvcol';
            key = `texvcol:${mat.map.uuid}:${mat.bumpMap ? mat.bumpMap.uuid : ''}:${
              mat.roughnessMap ? mat.roughnessMap.uuid : ''
            }:${mat.roughness.toFixed(2)}:${mat.metalness.toFixed(2)}:${mat.bumpScale.toFixed(3)}:${mat.side}|${
              cast ? 1 : 0
            }|${receive ? 1 : 0}`;
          } else {
            key = `exact:${mat.uuid}|${cast ? 1 : 0}|${receive ? 1 : 0}`;
          }

          if (!buckets.has(key)) {
            buckets.set(key, {
              mode,
              pbrKind,
              templateMat: mat,
              cast,
              receive,
              items: []
            });
          }
          buckets.get(key).items.push({ mesh: obj, relMat });
          return;
        }
      }
    }
    for (let i = 0; i < obj.children.length; i += 1) {
      collect(obj.children[i]);
    }
  }

  collect(root);

  for (const bucket of buckets.values()) {
    if (bucket.items.length < 2) {
      if (bucket.items.length === 1 && unifyShadows) {
        bucket.items[0].mesh.castShadow = bucket.cast;
        bucket.items[0].mesh.receiveShadow = bucket.receive;
      }
      continue;
    }

    let useVertexColors = bucket.mode === 'vcol';
    let targetMat = bucket.templateMat;

    if (bucket.mode === 'vcol') {
      targetMat = getSharedVColorMat(bucket.pbrKind, bucket.templateMat.side);
    } else if (bucket.mode === 'texvcol') {
      const firstUuid = bucket.items[0].mesh.material.uuid;
      const anyDiffMatOrColor = bucket.items.some(
        ({ mesh }) => mesh.material.uuid !== firstUuid || Boolean(mesh.geometry.attributes.color)
      );
      if (anyDiffMatOrColor) {
        useVertexColors = true;
        targetMat = getSharedTexVColorMat(bucket.templateMat);
      }
    } else if (bucket.items.some(({ mesh }) => Boolean(mesh.geometry.attributes.color))) {
      useVertexColors = Boolean(targetMat.vertexColors);
    }

    const prepared = [];
    let totalVerts = 0;

    for (const { mesh, relMat } of bucket.items) {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(relMat);
      prepared.push({ g, matColor: mesh.material.color || new THREE.Color(0xffffff) });
      totalVerts += g.attributes.position.count;
      if (mesh.parent) mesh.parent.remove(mesh);
    }

    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const uvArr = new Float32Array(totalVerts * 2);
    const colArr = useVertexColors ? new Float32Array(totalVerts * 3) : null;
    let vOffset = 0;

    for (const { g, matColor } of prepared) {
      const count = g.attributes.position.count;
      posArr.set(g.attributes.position.array, vOffset * 3);
      normArr.set(g.attributes.normal.array, vOffset * 3);
      if (g.attributes.uv) {
        uvArr.set(g.attributes.uv.array, vOffset * 2);
      }
      if (colArr) {
        const srcCol = g.attributes.color;
        const mr = matColor.r;
        const mg = matColor.g;
        const mb = matColor.b;
        if (srcCol) {
          for (let v = 0; v < count; v += 1) {
            const dst = (vOffset + v) * 3;
            colArr[dst] = srcCol.getX(v) * mr;
            colArr[dst + 1] = srcCol.getY(v) * mg;
            colArr[dst + 2] = srcCol.getZ(v) * mb;
          }
        } else {
          for (let v = 0; v < count; v += 1) {
            const dst = (vOffset + v) * 3;
            colArr[dst] = mr;
            colArr[dst + 1] = mg;
            colArr[dst + 2] = mb;
          }
        }
      }
      vOffset += count;
      g.dispose();
    }

    const mergedGeo = new THREE.BufferGeometry();
    mergedGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    mergedGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    mergedGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    if (colArr) {
      mergedGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    }
    mergedGeo.computeBoundingSphere();

    const mergedMesh = new THREE.Mesh(mergedGeo, targetMat);
    mergedMesh.castShadow = bucket.cast;
    mergedMesh.receiveShadow = bucket.receive;
    root.add(mergedMesh);
  }

  return root;
}
