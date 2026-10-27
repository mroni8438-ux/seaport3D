import { api } from './api.js';

/**
 * SeaPort 3D — Realtime Port & Vessel Visual Tracking System
 * Client-side Controller & Three.js 3D WebGL Engine
 */

// =============================================================================
// 1. GLOBAL STATE & DEMO MOCK DATA
// =============================================================================
const STATE = {
  user: null,
  token: null,
  selectedVesselId: 'VSL-001',
  activeDrawerTab: 'berth',
  autoRotate: false,
  kpi: {
    total_vessels: 6,
    active_berths: 3,
    total_berths: 4,
    berth_occupancy: 75,
    avg_dwelling_hours: 18.4
  },
  berths: [
    { id: 'BRT-01', nama_berth: 'Berth 01 North', panjang_meter: 320, draft_meter: 14.5, status: 'Occupied', id_kapal_aktif: 'VSL-002', utilisasi_persen: 85 },
    { id: 'BRT-02', nama_berth: 'Berth 02 North', panjang_meter: 300, draft_meter: 13.8, status: 'Occupied', id_kapal_aktif: 'VSL-001', utilisasi_persen: 90 },
    { id: 'BRT-03', nama_berth: 'Berth 03 South', panjang_meter: 340, draft_meter: 15.0, status: 'Occupied', id_kapal_aktif: 'VSL-003', utilisasi_persen: 80 },
    { id: 'BRT-04', nama_berth: 'Berth 04 South', panjang_meter: 280, draft_meter: 13.5, status: 'Available', id_kapal_aktif: null, utilisasi_persen: 0 }
  ],
  cranes: [
    { id: 'QC-01', nama_crane: 'Quay Crane STS-1', id_berth: 'BRT-01', status_crane: 'Operating', target_kontainer: 350, kontainer_terlayani: 290, produktivitas_mph: 29 },
    { id: 'QC-02', nama_crane: 'Quay Crane STS-2', id_berth: 'BRT-02', status_crane: 'Operating', target_kontainer: 400, kontainer_terlayani: 280, produktivitas_mph: 28 },
    { id: 'QC-03', nama_crane: 'Quay Crane STS-3', id_berth: 'BRT-03', status_crane: 'Operating', target_kontainer: 420, kontainer_terlayani: 150, produktivitas_mph: 31 },
    { id: 'QC-04', nama_crane: 'Quay Crane STS-4', id_berth: 'BRT-04', status_crane: 'Idle', target_kontainer: 0, kontainer_terlayani: 0, produktivitas_mph: 0 }
  ],
  vessels: [
    { id: 'VSL-001', nama_kapal: 'MV Nusantara Star', call_sign: 'YBKA2', imo_number: 'IMO9456781', bendera: 'Indonesia', kapasitas_teu: 3500, status_alur: 'Cargo Ops', id_berth: 'BRT-02', id_crane: 'QC-02', target_box: 400, served_box: 280, eta: '2026-10-20 08:00', etd: '2026-10-21 16:00' },
    { id: 'VSL-002', nama_kapal: 'MV Meratus Express', call_sign: 'PKME3', imo_number: 'IMO9124578', bendera: 'Indonesia', kapasitas_teu: 2800, status_alur: 'Cargo Ops', id_berth: 'BRT-01', id_crane: 'QC-01', target_box: 350, served_box: 290, eta: '2026-10-20 06:30', etd: '2026-10-21 12:00' },
    { id: 'VSL-003', nama_kapal: 'Ever Apex', call_sign: '3FYB9', imo_number: 'IMO9893929', bendera: 'Panama', kapasitas_teu: 5200, status_alur: 'Cargo Ops', id_berth: 'BRT-03', id_crane: 'QC-03', target_box: 420, served_box: 150, eta: '2026-10-20 10:15', etd: '2026-10-22 04:00' },
    { id: 'VSL-004', nama_kapal: 'Pacific Pioneer', call_sign: 'V7AB2', imo_number: 'IMO9341123', bendera: 'Marshall Is', kapasitas_teu: 4100, status_alur: 'Inbound', id_berth: null, id_crane: null, target_box: 300, served_box: 0, eta: '2026-10-20 14:00', etd: '2026-10-22 18:00' },
    { id: 'VSL-005', nama_kapal: 'Samudera Mandiri', call_sign: 'YCSM1', imo_number: 'IMO9773210', bendera: 'Indonesia', kapasitas_teu: 1900, status_alur: 'Anchorage', id_berth: null, id_crane: null, target_box: 220, served_box: 0, eta: '2026-10-20 16:30', etd: '2026-10-23 10:00' },
    { id: 'VSL-006', nama_kapal: 'Asian Glory', call_sign: '9V8912', imo_number: 'IMO9662341', bendera: 'Singapore', kapasitas_teu: 3300, status_alur: 'Anchorage', id_berth: null, id_crane: null, target_box: 310, served_box: 0, eta: '2026-10-20 18:00', etd: '2026-10-23 20:00' }
  ]
};

// =============================================================================
// 2. SERVER COMMUNICATION LAYER (panggilServer)
// =============================================================================
async function panggilServer(namaFungsi, ...args) {
  // Mode Google Apps Script Web App
  if (window.google && google.script && google.script.run) {
    return new Promise((resolve) => {
      google.script.run
        .withSuccessHandler((response) => resolve(response))
        .withFailureHandler((err) => resolve({ ok: false, pesan: err ? (err.message || err.toString()) : 'Galat server' }))
        [namaFungsi](...args);
    });
  }

  // Set Pro — Supabase API & Edge Functions
  try {
    if (namaFungsi === 'masuk') {
      const [identitas, sandi] = args;
      const res = await api.masuk(identitas, sandi);
      if (res && res.ok) {
        return {
          ok: true,
          token: res.sesi?.access_token || 'TOKEN-' + Date.now(),
          peran: res.pengguna?.peran || 'Controller',
          nama: res.pengguna?.nama_lengkap || identitas,
          wajib_ganti_sandi: (res.pengguna?.wajib_ganti_sandi === true || res.pengguna?.wajib_ganti_sandi === 'Ya') ? 'Ya' : 'Tidak'
        };
      }
      return res || { ok: false, pesan: 'ID atau kata sandi tidak cocok' };
    }

    if (namaFungsi === 'getDataAwal') {
      const res = await api.getDataAwal();
      if (res && res.ok && res.data) {
        return res;
      }
      return eksekusiMockServer('getDataAwal', args);
    }

    if (namaFungsi === 'updateStatusKapal') {
      const [_token, idKapal, statusBaru] = args;
      const res = await api.updateStatusKapal(idKapal, statusBaru);
      if (res && res.ok) {
        const vsl = STATE.vessels.find(v => v.id === idKapal);
        if (vsl) {
          vsl.status_alur = statusBaru;
          if (statusBaru === 'Departure' && vsl.id_berth) {
            const brt = STATE.berths.find(b => b.id === vsl.id_berth);
            if (brt) {
              brt.status = 'Available';
              brt.id_kapal_aktif = null;
            }
            vsl.id_berth = null;
          }
        }
        return res;
      }
      return res || { ok: false, pesan: 'Gagal update status kapal' };
    }

    if (namaFungsi === 'alokasiDermaga') {
      const [_token, idKapal, idBerth] = args;
      const res = await api.alokasiDermaga(idKapal, idBerth);
      if (res && res.ok) {
        const vsl = STATE.vessels.find(v => v.id === idKapal);
        const brt = STATE.berths.find(b => b.id === idBerth);
        if (vsl && brt) {
          vsl.id_berth = idBerth;
          vsl.status_alur = 'Berthing';
          brt.status = 'Occupied';
          brt.id_kapal_aktif = idKapal;
        }
        return res;
      }
      return res || { ok: false, pesan: 'Gagal alokasi dermaga' };
    }

    if (namaFungsi === 'tugaskanCrane') {
      const [_token, idKapal, idCrane] = args;
      return await api.tugaskanCrane(idKapal, idCrane);
    }

    if (namaFungsi === 'gantiSandi') {
      const [_token, sandiLama, sandiBaru] = args;
      return await api.gantiSandi(sandiLama, sandiBaru);
    }

    if (namaFungsi === 'aturUlangSandi') {
      const [_token, idPengguna] = args;
      return await api.aturUlangSandi(idPengguna);
    }

    return eksekusiMockServer(namaFungsi, args);
  } catch (err) {
    console.error(`[panggilServer] Galat ${namaFungsi}:`, err);
    return { ok: false, pesan: err.message || 'Galat sistem' };
  }
}

function eksekusiMockServer(namaFungsi, args) {
  if (namaFungsi === 'masuk') {
    const [identitas, sandi] = args;
    const userRole = (identitas.toLowerCase().includes('view')) ? 'Viewer' : 'Controller';
    const userName = (userRole === 'Viewer') ? 'Staf Viewer' : 'Capt. Hartono';
    return {
      ok: true,
      token: 'SESSION-TOKEN-DEMO-999',
      peran: userRole,
      nama: userName,
      wajib_ganti_sandi: (sandi === 'force123') ? 'Ya' : 'Tidak'
    };
  }

  if (namaFungsi === 'getDataAwal') {
    return {
      ok: true,
      data: {
        kapal: STATE.vessels,
        dermaga: STATE.berths,
        crane: STATE.cranes,
        kpi: STATE.kpi
      }
    };
  }

  if (namaFungsi === 'updateStatusKapal') {
    const [token, idKapal, statusBaru] = args;
    const vsl = STATE.vessels.find(v => v.id === idKapal);
    if (vsl) {
      vsl.status_alur = statusBaru;
      if (statusBaru === 'Departure') {
        // Bebaskan dermaga
        if (vsl.id_berth) {
          const brt = STATE.berths.find(b => b.id === vsl.id_berth);
          if (brt) {
            brt.status = 'Available';
            brt.id_kapal_aktif = null;
          }
          vsl.id_berth = null;
        }
      }
      return { ok: true, kapal: vsl, pesan: `Status kapal ${vsl.nama_kapal} berhasil diubah ke ${statusBaru}` };
    }
    return { ok: false, pesan: 'Kapal tidak ditemukan' };
  }

  if (namaFungsi === 'alokasiDermaga') {
    const [token, idKapal, idBerth] = args;
    const vsl = STATE.vessels.find(v => v.id === idKapal);
    const brt = STATE.berths.find(b => b.id === idBerth);
    if (vsl && brt) {
      brt.status = 'Occupied';
      brt.id_kapal_aktif = vsl.id;
      vsl.id_berth = brt.id;
      vsl.status_alur = 'Berthing';
      return { ok: true, pesan: `Kapal ${vsl.nama_kapal} dialokasikan ke ${brt.nama_berth}` };
    }
    return { ok: false, pesan: 'Dermaga atau kapal tidak valid' };
  }

  if (namaFungsi === 'gantiSandi') {
    return { ok: true, pesan: 'Kata sandi Anda berhasil diperbarui.' };
  }

  if (namaFungsi === 'aturUlangSandi') {
    const tempPass = 'PORT-' + Math.floor(1000 + Math.random() * 9000);
    return { ok: true, sandiSementara: tempPass, pesan: 'Sandi staf berhasil direset.' };
  }

  return { ok: true, pesan: 'Operasi sukses (Mock).' };
}

// =============================================================================
// 3. THREE.JS 3D PROCEDURAL HARBOR ENGINE
// =============================================================================
let scene, camera, renderer, controls;
let oceanMesh, lighthouseLight, craneTrolleys = [];
let harbor3DMeshes = { vessels: {}, berths: {}, cranes: {} };

function init3DScene() {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('viewport-3d-canvas');
  if (!canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070d1e);
  scene.fog = new THREE.FogExp2(0x070d1e, 0.0035);

  // Camera Isometric Perspective
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
  camera.position.set(280, 220, 360);

  // Renderer WebGL
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.05; // Mencegah kamera tembus air
  controls.minDistance = 60;
  controls.maxDistance = 850;
  controls.target.set(0, 10, 0);

  // Lighting
  setupLighting();

  // Harbor Environment Objects
  buildOceanWater();
  buildDocksAndQuay();
  buildQuayCranes();
  buildPortControlTower();
  buildContainerShips();

  // Window Resize Event
  window.addEventListener('resize', onWindowResize);

  // Raycaster for Ship / Berth Clicking
  setup3DInteraction();

  // Start Animation Loop
  animate3D();
}

function setupLighting() {
  // Ambient Soft Night Blue
  const ambientLight = new THREE.AmbientLight(0x1e293b, 1.4);
  scene.add(ambientLight);

  // Directional Moon / Main Port Light
  const dirLight = new THREE.DirectionalLight(0x7dd3fc, 1.6);
  dirLight.position.set(200, 350, 150);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // Secondary Warm Amber Harbor Glow
  const dockLight = new THREE.PointLight(0xf59e0b, 2.5, 300);
  dockLight.position.set(0, 45, 40);
  scene.add(dockLight);
}

function buildOceanWater() {
  const waterGeo = new THREE.PlaneGeometry(1600, 1600, 64, 64);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x071e3d,
    roughness: 0.2,
    metalness: 0.8,
    flatShading: true
  });
  oceanMesh = new THREE.Mesh(waterGeo, waterMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = 0;
  oceanMesh.receiveShadow = true;
  scene.add(oceanMesh);
}

function buildDocksAndQuay() {
  // Main Quay Wharf Platform (Beton Dermaga)
  const wharfGeo = new THREE.BoxGeometry(480, 14, 140);
  const wharfMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const wharf = new THREE.Mesh(wharfGeo, wharfMat);
  wharf.position.set(0, 6, 70);
  wharf.receiveShadow = true;
  wharf.castShadow = true;
  scene.add(wharf);

  // Yellow Safety Hazard Border Edge
  const edgeGeo = new THREE.BoxGeometry(480, 1.5, 4);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.set(0, 13.5, 2);
  scene.add(edge);

  // Mooring Bollards (Bolder Tambat Kapal)
  for (let x = -220; x <= 220; x += 40) {
    const bollardGeo = new THREE.CylinderGeometry(1.8, 1.8, 4, 12);
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const bollard = new THREE.Mesh(bollardGeo, bollardMat);
    bollard.position.set(x, 15, 6);
    scene.add(bollard);
  }

  // 4 Berth Markings
  const berthPositions = [-170, -55, 55, 170];
  berthPositions.forEach((bx, idx) => {
    const lineGeo = new THREE.BoxGeometry(3, 0.4, 60);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(bx, 13.2, 40);
    scene.add(line);
  });
}

function buildQuayCranes() {
  const craneXPositions = [-170, -55, 55, 170];
  craneTrolleys = [];

  craneXPositions.forEach((cx, idx) => {
    const craneGroup = new THREE.Group();
    craneGroup.position.set(cx, 13, 30);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const amberAccentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });

    // Portal Crane Legs (A-Frame Structure)
    const legGeo = new THREE.BoxGeometry(4, 55, 4);
    const leg1 = new THREE.Mesh(legGeo, metalMat);
    leg1.position.set(-12, 27.5, -15);
    const leg2 = new THREE.Mesh(legGeo, metalMat);
    leg2.position.set(12, 27.5, -15);
    const leg3 = new THREE.Mesh(legGeo, metalMat);
    leg3.position.set(-12, 27.5, 15);
    const leg4 = new THREE.Mesh(legGeo, metalMat);
    leg4.position.set(12, 27.5, 15);
    craneGroup.add(leg1, leg2, leg3, leg4);

    // Boom Horizontal Arm reaching over water
    const boomGeo = new THREE.BoxGeometry(10, 6, 110);
    const boom = new THREE.Mesh(boomGeo, metalMat);
    boom.position.set(0, 56, -15);
    boom.castShadow = true;
    craneGroup.add(boom);

    // Crane Tower Top
    const towerGeo = new THREE.BoxGeometry(18, 30, 20);
    const tower = new THREE.Mesh(towerGeo, amberAccentMat);
    tower.position.set(0, 70, 0);
    craneGroup.add(tower);

    // Beacon light on top of crane
    const beaconGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 86, 0);
    craneGroup.add(beacon);

    // Trolley & Spreader (moving parts)
    const trolleyGeo = new THREE.BoxGeometry(6, 3, 8);
    const trolleyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const trolley = new THREE.Mesh(trolleyGeo, trolleyMat);
    trolley.position.set(0, 52, -25);

    // Spreader Cables & Container Clamp
    const spreaderGeo = new THREE.BoxGeometry(7, 2, 14);
    const spreaderMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const spreader = new THREE.Mesh(spreaderGeo, spreaderMat);
    spreader.position.set(0, -18, 0);
    trolley.add(spreader);

    craneGroup.add(trolley);
    scene.add(craneGroup);

    craneTrolleys.push({
      mesh: trolley,
      baseZ: -25,
      offset: idx * 1.5,
      active: (idx < 3)
    });
  });
}

function buildPortControlTower() {
  const towerGroup = new THREE.Group();
  towerGroup.position.set(220, 13, 110);

  // Tower Shaft
  const shaftGeo = new THREE.CylinderGeometry(8, 12, 85, 16);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 42.5;
  towerGroup.add(shaft);

  // Observation Glass Deck (Octagonal)
  const glassGeo = new THREE.CylinderGeometry(18, 14, 16, 16);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 });
  const glassDeck = new THREE.Mesh(glassGeo, glassMat);
  glassDeck.position.y = 90;
  towerGroup.add(glassDeck);

  // Rotating Radar Antenna & Beacon
  const radarGeo = new THREE.BoxGeometry(16, 2, 3);
  const radarMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const radar = new THREE.Mesh(radarGeo, radarMat);
  radar.position.y = 104;
  towerGroup.add(radar);

  // Rotating Light Spot
  lighthouseLight = new THREE.SpotLight(0x38bdf8, 5, 400, Math.PI / 6, 0.4);
  lighthouseLight.position.set(220, 115, 110);
  lighthouseLight.target.position.set(0, 0, -150);
  scene.add(lighthouseLight);
  scene.add(lighthouseLight.target);

  scene.add(towerGroup);
}

function createContainerShipMesh(vessel) {
  const shipGroup = new THREE.Group();

  // Ship Hull
  const hullGeo = new THREE.BoxGeometry(26, 18, 140);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 6;
  hull.castShadow = true;
  shipGroup.add(hull);

  // Bow Wedge (Haluan Kapal Segitiga)
  const bowGeo = new THREE.ConeGeometry(13, 26, 4);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 6, -80);
  shipGroup.add(bow);

  // Deck Bridge / Superstructure
  const bridgeGeo = new THREE.BoxGeometry(24, 26, 24);
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 24, 45);
  shipGroup.add(bridge);

  // Funnel / Cerobong Asap
  const funnelGeo = new THREE.CylinderGeometry(3, 3, 16, 12);
  const funnelMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
  const funnel = new THREE.Mesh(funnelGeo, funnelMat);
  funnel.position.set(0, 36, 52);
  shipGroup.add(funnel);

  // Stacks of Colorful Containers
  const containerColors = [0x0ea5e9, 0xf59e0b, 0x10b981, 0xd97706, 0x6366f1];
  const boxGeo = new THREE.BoxGeometry(6.5, 6, 16);

  for (let z = -50; z <= 20; z += 18) {
    for (let x = -8; x <= 8; x += 8) {
      const tiers = Math.floor(Math.random() * 3) + 2;
      for (let y = 0; y < tiers; y++) {
        const cColor = containerColors[Math.floor(Math.random() * containerColors.length)];
        const cMat = new THREE.MeshStandardMaterial({ color: cColor, roughness: 0.6 });
        const cBox = new THREE.Mesh(boxGeo, cMat);
        cBox.position.set(x, 17 + (y * 6.5), z);
        cBox.castShadow = true;
        shipGroup.add(cBox);
      }
    }
  }

  // Ship Name Tag / Identification Flag (User interaction target)
  shipGroup.userData = { id: vessel.id, nama: vessel.nama_kapal };
  return shipGroup;
}

function buildContainerShips() {
  // Ship 1: MV Nusantara Star at Berth 02
  const ship1 = createContainerShipMesh(STATE.vessels[0]);
  ship1.position.set(-55, 0, -40);
  scene.add(ship1);
  harbor3DMeshes.vessels['VSL-001'] = ship1;

  // Ship 2: MV Meratus Express at Berth 01
  const ship2 = createContainerShipMesh(STATE.vessels[1]);
  ship2.position.set(-170, 0, -40);
  scene.add(ship2);
  harbor3DMeshes.vessels['VSL-002'] = ship2;

  // Ship 3: Ever Apex at Berth 03
  const ship3 = createContainerShipMesh(STATE.vessels[2]);
  ship3.position.set(55, 0, -40);
  scene.add(ship3);
  harbor3DMeshes.vessels['VSL-003'] = ship3;

  // Ship 4: Pacific Pioneer (Inbound / Approaching)
  const ship4 = createContainerShipMesh(STATE.vessels[3]);
  ship4.position.set(260, 0, -180);
  ship4.rotation.y = -Math.PI / 4;
  scene.add(ship4);
  harbor3DMeshes.vessels['VSL-004'] = ship4;

  // Ship 5 & 6 in Anchorage Waiting Area
  const ship5 = createContainerShipMesh(STATE.vessels[4]);
  ship5.position.set(-280, 0, -280);
  ship5.rotation.y = Math.PI / 6;
  scene.add(ship5);
  harbor3DMeshes.vessels['VSL-005'] = ship5;

  const ship6 = createContainerShipMesh(STATE.vessels[5]);
  ship6.position.set(120, 0, -320);
  ship6.rotation.y = -Math.PI / 3;
  scene.add(ship6);
  harbor3DMeshes.vessels['VSL-006'] = ship6;
}

function setup3DInteraction() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('click', (event) => {
    // Abaikan klik jika di atas panel UI melayang
    if (event.target.closest('.interactive-panel') || event.target.closest('.side-drawer-panel') || event.target.closest('.modal-card')) {
      return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let i = 0; i < intersects.length; i++) {
      let obj = intersects[i].object;
      while (obj.parent && !obj.userData.id) {
        obj = obj.parent;
      }
      if (obj.userData && obj.userData.id) {
        selectVessel(obj.userData.id);
        break;
      }
    }
  });
}

function animate3D() {
  requestAnimationFrame(animate3D);

  const time = performance.now() * 0.001;

  // Animated Water Wave Ripples
  if (oceanMesh) {
    const pos = oceanMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const z = Math.sin(u * 0.03 + time * 1.5) * 1.2 + Math.cos(v * 0.03 + time * 1.2) * 1.2;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  // Rotate Lighthouse Spotlight
  if (lighthouseLight) {
    const angle = time * 0.8;
    lighthouseLight.target.position.x = 220 + Math.cos(angle) * 350;
    lighthouseLight.target.position.z = 110 + Math.sin(angle) * 350;
  }

  // Move Quay Crane Trolleys dynamically
  craneTrolleys.forEach((ct) => {
    if (ct.active) {
      const move = Math.sin(time * 0.9 + ct.offset) * 14;
      ct.mesh.position.z = ct.baseZ + move;
    }
  });

  // Floating gentle bobbing motion for ships
  Object.values(harbor3DMeshes.vessels).forEach((vMesh, idx) => {
    vMesh.position.y = Math.sin(time * 1.5 + idx) * 0.6;
    vMesh.rotation.z = Math.sin(time * 1.2 + idx) * 0.015;
  });

  // Controls update & Render
  controls.autoRotate = STATE.autoRotate;
  controls.update();
  renderer.render(scene, camera);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================================================
// 4. CAMERA VIEWPORT CONTROLS
// =============================================================================
function cameraZoomIn() {
  camera.position.multiplyScalar(0.85);
}

function cameraZoomOut() {
  camera.position.multiplyScalar(1.18);
}

function resetCameraView() {
  controls.reset();
  camera.position.set(280, 220, 360);
  controls.target.set(0, 10, 0);
  showToast('Sudut kamera diatur ulang ke default');
}

function setCameraTopDownView() {
  camera.position.set(0, 520, 20);
  controls.target.set(0, 0, 0);
  showToast('Tampilan bird-eye / top-down aktif');
}

function toggleAutoRotateCamera() {
  STATE.autoRotate = !STATE.autoRotate;
  const btn = document.getElementById('btn-auto-rotate');
  if (btn) btn.classList.toggle('active', STATE.autoRotate);
  showToast(STATE.autoRotate ? 'Rotasi kamera otomatis AKTIF' : 'Rotasi kamera otomatis NONAKTIF');
}

function focusCameraOnCurrentVessel() {
  const mesh = harbor3DMeshes.vessels[STATE.selectedVesselId];
  if (mesh) {
    controls.target.copy(mesh.position);
    camera.position.set(mesh.position.x + 90, mesh.position.y + 60, mesh.position.z + 110);
    showToast(`Fokus kamera mengunci: ${mesh.userData.nama}`);
  }
}

// =============================================================================
// 5. DOM & DATA INTERACTION HANDLERS
// =============================================================================
function selectVessel(vesselId) {
  STATE.selectedVesselId = vesselId;
  renderVesselStepper();
  renderSideDrawerContent();
  focusCameraOnCurrentVessel();
}

function renderVesselStepper() {
  const vsl = STATE.vessels.find(v => v.id === STATE.selectedVesselId);
  if (!vsl) return;

  document.getElementById('stepper-vessel-name').textContent = vsl.nama_kapal;
  document.getElementById('stepper-vessel-meta').textContent = `Call Sign: ${vsl.call_sign} • ${vsl.imo_number} • ${vsl.kapasitas_teu.toLocaleString()} TEU`;

  // Berth status badge
  const berth = STATE.berths.find(b => b.id === vsl.id_berth);
  document.getElementById('stepper-berth-label').textContent = berth ? berth.nama_berth : (vsl.status_alur === 'Inbound' ? 'Alur Pandu Masuk' : 'Anchorage Waiting Area');

  // Cargo progress bar
  const percent = vsl.target_box > 0 ? Math.round((vsl.served_box / vsl.target_box) * 100) : 0;
  document.getElementById('stepper-cargo-percent').textContent = `${percent}% (${vsl.served_box} / ${vsl.target_box} Box)`;
  document.getElementById('stepper-cargo-bar').style.width = `${percent}%`;

  // Update Stepper Stages Nodes
  const stages = ['Anchorage', 'Inbound', 'Berthing', 'Cargo Ops', 'Departure'];
  const curIdx = stages.indexOf(vsl.status_alur);

  const nodes = document.querySelectorAll('.step-node');
  const lines = document.querySelectorAll('.step-line');

  nodes.forEach((node, idx) => {
    node.classList.remove('completed', 'active-pulse');
    if (idx < curIdx) {
      node.classList.add('completed');
    } else if (idx === curIdx) {
      node.classList.add('active-pulse');
    }
  });

  lines.forEach((line, idx) => {
    if (idx < curIdx) {
      line.classList.add('active');
    } else {
      line.classList.remove('active');
    }
  });

  // Action Button for Controller
  const btnAction = document.getElementById('btn-advance-status');
  const labelAction = document.getElementById('label-advance-action');
  const actionWrapper = document.getElementById('controller-stepper-actions');

  if (STATE.user && STATE.user.peran === 'Viewer') {
    if (btnAction) btnAction.style.display = 'none';
  } else {
    if (btnAction) btnAction.style.display = 'flex';
    const nextStageLabels = {
      'Anchorage': 'Pindahkan ke Pandu Masuk (Inbound)',
      'Inbound': 'Sandarkan Kapal di Dermaga (Berthing)',
      'Berthing': 'Mulai Operasi Bongkar Muat (Cargo Ops)',
      'Cargo Ops': 'Selesaikan Cargo Ops & Siapkan Keberangkatan (Departure)',
      'Departure': 'Kapal Telah Berangkat (Selesai Operasi)'
    };
    if (labelAction) labelAction.textContent = nextStageLabels[vsl.status_alur] || 'Lanjut Tahap Berikutnya';
  }
}

async function handleAdvanceStatus() {
  const vsl = STATE.vessels.find(v => v.id === STATE.selectedVesselId);
  if (!vsl) return;

  const stages = ['Anchorage', 'Inbound', 'Berthing', 'Cargo Ops', 'Departure'];
  const curIdx = stages.indexOf(vsl.status_alur);
  if (curIdx >= stages.length - 1) {
    showToast('Kapal telah berada pada tahapan akhir (Departure)');
    return;
  }

  const nextStage = stages[curIdx + 1];

  // Jika sandar tapi belum punya dermaga
  if (nextStage === 'Berthing' && !vsl.id_berth) {
    const availableBerth = STATE.berths.find(b => b.status === 'Available');
    if (availableBerth) {
      vsl.id_berth = availableBerth.id;
      availableBerth.status = 'Occupied';
      availableBerth.id_kapal_aktif = vsl.id;
    } else {
      showToast('Seluruh dermaga sedang penuh! Harap tunggu berth kosong.', 'error');
      return;
    }
  }

  showToast(`Memperbarui status ${vsl.nama_kapal}...`);
  const res = await panggilServer('updateStatusKapal', STATE.token, vsl.id, nextStage);
  if (res.ok) {
    vsl.status_alur = nextStage;
    if (nextStage === 'Cargo Ops') {
      vsl.served_box = Math.min(vsl.target_box, vsl.served_box + 100);
    }
    renderVesselStepper();
    renderSideDrawerContent();
    updateKPICards();
    showToast(res.pesan || `Status berhasil diubah ke ${nextStage}`, 'success');
  } else {
    showToast(res.pesan || 'Gagal mengubah status kapal', 'error');
  }
}

// Side Drawer Navigation & Content
function toggleSideDrawer(forceState) {
  const drawer = document.getElementById('s-04-drawer');
  if (!drawer) return;
  if (typeof forceState === 'boolean') {
    drawer.classList.toggle('open', forceState);
  } else {
    drawer.classList.toggle('open');
  }
  if (drawer.classList.contains('open')) {
    renderSideDrawerContent();
  }
}

function switchDrawerTab(tabName) {
  STATE.activeDrawerTab = tabName;
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-button')).find(b => b.textContent.toLowerCase().includes(tabName));
  if (activeBtn) activeBtn.classList.add('active');

  const activePane = document.getElementById(`tab-content-${tabName}`);
  if (activePane) activePane.classList.add('active');

  renderSideDrawerContent();
}

function renderSideDrawerContent() {
  // 1. Render Berths
  const berthList = document.getElementById('berth-cards-list');
  if (berthList) {
    berthList.innerHTML = STATE.berths.map(b => {
      const vsl = STATE.vessels.find(v => v.id === b.id_kapal_aktif);
      const isController = STATE.user && STATE.user.peran === 'Controller';
      return `
        <div class="berth-card-item">
          <div class="berth-item-header">
            <strong>${b.nama_berth}</strong>
            <span class="badge-status ${b.status.toLowerCase()}">${b.status}</span>
          </div>
          <p style="font-size:12px;color:var(--sp-text-muted);margin-bottom:6px;">
            Panjang: ${b.panjang_meter}m • Draft: ${b.draft_meter}m • Utilisasi: ${b.utilisasi_persen}%
          </p>
          <div style="font-size:13px;color:#fff;">
            Kapal: <span class="bold-white">${vsl ? vsl.nama_kapal : 'Tidak ada (Dermaga Siap Sandar)'}</span>
          </div>
          ${(b.status === 'Available' && isController) ? `
            <div style="margin-top:10px;">
              <select onchange="alokasikanKapalKeBerth('${b.id}', this.value)" class="select-field" style="padding:6px 10px;font-size:12px;">
                <option value="">-- Alokasikan Kapal Menunggu --</option>
                ${STATE.vessels.filter(v => !v.id_berth).map(v => `<option value="${v.id}">${v.nama_kapal} (${v.status_alur})</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // 2. Render Cranes
  const craneList = document.getElementById('crane-cards-list');
  if (craneList) {
    craneList.innerHTML = STATE.cranes.map(c => `
      <div class="crane-card-item">
        <div class="berth-item-header">
          <strong>${c.nama_crane}</strong>
          <span class="badge-status ${c.status_crane.toLowerCase()}">${c.status_crane}</span>
        </div>
        <p style="font-size:12px;color:var(--sp-text-muted);">Posisi: ${c.id_berth} • Produktivitas: <span class="bold-white">${c.produktivitas_mph} MPH</span></p>
        <div style="margin-top:6px;font-size:12px;color:#fff;">
          Kontainer Selesai: <strong>${c.kontainer_terlayani}</strong> dari target ${c.target_kontainer} Box
        </div>
      </div>
    `).join('');
  }

  // 3. Render Vessels List
  const vesselList = document.getElementById('vessels-cards-list');
  if (vesselList) {
    vesselList.innerHTML = STATE.vessels.map(v => `
      <div class="vessel-card-item" onclick="selectVessel('${v.id}')" style="cursor:pointer;border-left:${v.id === STATE.selectedVesselId ? '3px solid var(--sp-primary)' : '1px solid var(--sp-border-subtle)'};">
        <div class="vessel-item-header">
          <strong>${v.nama_kapal}</strong>
          <span class="badge-status ${v.status_alur === 'Cargo Ops' ? 'occupied' : 'available'}">${v.status_alur}</span>
        </div>
        <p style="font-size:12px;color:var(--sp-text-muted);">${v.call_sign} • ${v.bendera} • ${v.kapasitas_teu} TEU</p>
        <div style="font-size:11px;color:var(--sp-text-subtle);margin-top:4px;">
          Lokasi: ${v.id_berth || 'Perairan Luar'} • ETA: ${v.eta}
        </div>
      </div>
    `).join('');
  }
}

async function alokasikanKapalKeBerth(berthId, vesselId) {
  if (!vesselId) return;
  const res = await panggilServer('alokasiDermaga', STATE.token, vesselId, berthId);
  if (res.ok) {
    const vsl = STATE.vessels.find(v => v.id === vesselId);
    const brt = STATE.berths.find(b => b.id === berthId);
    if (vsl && brt) {
      vsl.id_berth = brt.id;
      vsl.status_alur = 'Berthing';
      brt.status = 'Occupied';
      brt.id_kapal_aktif = vsl.id;
    }
    renderVesselStepper();
    renderSideDrawerContent();
    updateKPICards();
    showToast(res.pesan || 'Alokasi dermaga berhasil', 'success');
  } else {
    showToast(res.pesan || 'Gagal mengalokasikan dermaga', 'error');
  }
}

function updateKPICards() {
  const occupiedCount = STATE.berths.filter(b => b.status === 'Occupied').length;
  const totalBerths = STATE.berths.length;
  const occupancyPercent = Math.round((occupiedCount / totalBerths) * 100);

  document.getElementById('kpi-vessels-count').textContent = STATE.vessels.length;
  document.getElementById('kpi-berth-occupancy').textContent = `${occupancyPercent}%`;
  document.getElementById('kpi-berth-sub').textContent = `${occupiedCount} dari ${totalBerths} Berth Aktif`;
}

function handleSearchVessel(query) {
  if (!query) return;
  const q = query.toLowerCase();
  const match = STATE.vessels.find(v => v.nama_kapal.toLowerCase().includes(q) || v.call_sign.toLowerCase().includes(q) || (v.id_berth && v.id_berth.toLowerCase().includes(q)));
  if (match) {
    selectVessel(match.id);
  }
}

// =============================================================================
// 6. AUTHENTICATION & PROFILE HANDLERS (S-01, S-05, S-06)
// =============================================================================
async function handleLoginSubmit(event) {
  event.preventDefault();
  const identitas = document.getElementById('login-identitas').value.trim();
  const sandi = document.getElementById('login-sandi').value;
  const alertBox = document.getElementById('login-alert');
  const alertMsg = document.getElementById('login-alert-msg');

  if (alertBox) alertBox.classList.add('hidden');

  const btnSubmit = document.getElementById('btn-login-submit');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span>Memeriksa kredensial...</span>';

  const res = await panggilServer('masuk', identitas, sandi);
  btnSubmit.disabled = false;
  btnSubmit.innerHTML = '<span>Masuk ke Dashboard 3D</span><i data-lucide="arrow-right"></i>';
  if (window.lucide) lucide.createIcons();

  if (res.ok) {
    STATE.token = res.token;
    STATE.user = {
      nama_lengkap: res.nama,
      peran: res.peran,
      email: identitas
    };

    if (res.wajib_ganti_sandi === 'Ya') {
      showScreen('s-06-force-password');
      return;
    }

    applyUserSession();
    showScreen('s-02-dashboard');
    showToast(`Selamat datang, ${res.nama}!`);

    // Ambil data terkini dari Supabase
    panggilServer('getDataAwal').then(dataAwal => {
      if (dataAwal && dataAwal.ok && dataAwal.data) {
        if (dataAwal.data.kapal?.length) STATE.vessels = dataAwal.data.kapal;
        if (dataAwal.data.dermaga?.length) STATE.berths = dataAwal.data.dermaga;
        if (dataAwal.data.crane?.length) STATE.cranes = dataAwal.data.crane;
        renderVesselStepper();
        renderSideDrawerContent();
        updateKPICards();
      }
    }).catch(console.warn);
  } else {
    if (alertBox) {
      alertMsg.textContent = res.pesan || 'ID / username / email atau password salah.';
      alertBox.classList.remove('hidden');
    }
  }
}

function fillQuickCredentials(username, pass) {
  document.getElementById('login-identitas').value = username;
  document.getElementById('login-sandi').value = pass;
}

function applyUserSession() {
  if (!STATE.user) return;
  document.getElementById('label-user-role').textContent = STATE.user.peran;
  const badge = document.getElementById('user-role-badge');
  badge.className = `badge-role ${STATE.user.peran.toLowerCase()}-role`;

  document.getElementById('user-display-name').textContent = STATE.user.nama_lengkap;
  const initials = STATE.user.nama_lengkap.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-initials').textContent = initials;
  document.getElementById('modal-avatar-lg').textContent = initials;
  document.getElementById('modal-user-name').textContent = STATE.user.nama_lengkap;
  document.getElementById('modal-user-email').textContent = STATE.user.email;
  document.getElementById('modal-role-pill').textContent = `${STATE.user.peran} Operasional`;

  // Hide admin section if Viewer
  const adminSec = document.getElementById('admin-reset-section');
  if (adminSec) {
    adminSec.style.display = (STATE.user.peran === 'Controller') ? 'block' : 'none';
  }

  renderVesselStepper();
}

function handleLogout() {
  STATE.user = null;
  STATE.token = null;
  showScreen('s-01-login');
  showToast('Sesi telah diakhiri.');
}

function showScreen(screenId) {
  document.querySelectorAll('.screen-view').forEach(sc => sc.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  if (screenId === 's-02-dashboard') {
    onWindowResize();
  }
}

function openProfileModal() {
  document.getElementById('s-05-modal-profil').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('s-05-modal-profil').classList.add('hidden');
}

async function handleGantiSandiSubmit(event) {
  event.preventDefault();
  const lama = document.getElementById('input-sandi-lama').value;
  const baru = document.getElementById('input-sandi-baru').value;
  const ulangi = document.getElementById('input-sandi-ulangi').value;

  if (baru !== ulangi) {
    showToast('Konfirmasi kata sandi baru tidak cocok', 'error');
    return;
  }
  if (baru.length < 8) {
    showToast('Kata sandi baru minimal 8 karakter', 'error');
    return;
  }

  const res = await panggilServer('gantiSandi', STATE.token, lama, baru);
  if (res.ok) {
    closeProfileModal();
    showToast('Kata sandi Anda berhasil diperbarui', 'success');
  } else {
    showToast(res.pesan || 'Gagal mengubah kata sandi', 'error');
  }
}

async function handleAturUlangSandiSubmit() {
  const targetId = document.getElementById('select-staff-user').value;
  const res = await panggilServer('aturUlangSandi', STATE.token, targetId);
  if (res.ok) {
    document.getElementById('text-sandi-sementara').textContent = res.sandiSementara;
    document.getElementById('box-sandi-sementara').classList.remove('hidden');
    showToast('Sandi sementara berhasil dibuat', 'success');
  } else {
    showToast(res.pesan || 'Gagal mereset sandi staf', 'error');
  }
}

function copyTemporaryPassword() {
  const code = document.getElementById('text-sandi-sementara').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Sandi sementara disalin ke clipboard');
  });
}

async function handleForcePasswordSubmit(event) {
  event.preventDefault();
  const baru = document.getElementById('force-sandi-baru').value;
  const ulangi = document.getElementById('force-sandi-ulangi').value;

  if (baru !== ulangi) {
    showToast('Konfirmasi kata sandi tidak cocok', 'error');
    return;
  }
  if (baru.length < 8) {
    showToast('Kata sandi minimal 8 karakter', 'error');
    return;
  }

  const res = await panggilServer('gantiSandi', STATE.token, '', baru);
  if (res.ok) {
    applyUserSession();
    showScreen('s-02-dashboard');
    showToast('Sandi baru berhasil diaktifkan. Selamat datang!', 'success');
  } else {
    showToast(res.pesan || 'Gagal mengaktifkan sandi baru', 'error');
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
}

function showToast(msg, type = 'normal') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.textContent = msg;
  container.appendChild(item);
  setTimeout(() => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(-10px)';
    setTimeout(() => item.remove(), 300);
  }, 3200);
}

// Live Clock Updater
function startLiveClock() {
  const clockEl = document.getElementById('live-clock-display');
  function update() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' • ' + now.toLocaleTimeString('id-ID') + ' WIB';
  }
  setInterval(update, 1000);
  update();
}

// =============================================================================
// 7. INITIALIZATION ON LOAD
// =============================================================================
window.addEventListener('DOMContentLoaded', () => {
  // Init 3D Scene
  init3DScene();

  // Start Clock
  startLiveClock();

  // Auto Login in Mock Mode if desired or stay on login screen
  renderVesselStepper();
  renderSideDrawerContent();

  if (window.lucide) {
    lucide.createIcons();
  }
});

// Bind all functions to window for HTML event handlers
Object.assign(window, {
  STATE,
  panggilServer,
  handleLoginSubmit,
  fillQuickCredentials,
  togglePasswordVisibility,
  handleLogout,
  openProfileModal,
  closeProfileModal,
  handleGantiSandiSubmit,
  handleAturUlangSandiSubmit,
  copyTemporaryPassword,
  handleForcePasswordSubmit,
  switchDrawerTab,
  toggleSideDrawer,
  selectVessel,
  handleAdvanceStatus,
  alokasikanKapalKeBerth,
  toggleAutoRotateCamera,
  resetCameraView,
  setCameraTopDownView,
  cameraZoomIn,
  cameraZoomOut,
  focusCameraOnCurrentVessel,
  handleSearchVessel,
  showToast,
  showScreen
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
