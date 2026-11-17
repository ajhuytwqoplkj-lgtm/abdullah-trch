import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';

type ProductModelId = 'diffuser' | 'stand' | 'packaging';
type FinishId = 'slate' | 'ceramic' | 'teal' | 'bronze';
type CameraPresetId = 'perspective' | 'front' | 'top';
type LightingPresetId = 'studio' | 'warm';

const FINISH_COLORS: Record<
  FinishId,
  { label: string; hex: number; swatch: string; metalness: number; roughness: number }
> = {
  slate: {
    label: 'تيتانيوم داكن',
    hex: 0x26303d,
    swatch: '#26303d',
    metalness: 0.78,
    roughness: 0.28,
  },
  ceramic: {
    label: 'أبيض خزفي',
    hex: 0xf1f5f9,
    swatch: '#f1f5f9',
    metalness: 0.12,
    roughness: 0.42,
  },
  teal: {
    label: 'زمردي معدني',
    hex: 0x0f766e,
    swatch: '#0f766e',
    metalness: 0.65,
    roughness: 0.26,
  },
  bronze: {
    label: 'نحاسي مصقول',
    hex: 0x9a6b4c,
    swatch: '#9a6b4c',
    metalness: 0.88,
    roughness: 0.22,
  },
};

const PRODUCT_NAMES: Record<ProductModelId, string> = {
  diffuser: 'فواحة ذكية (٨ أجزاء)',
  stand: 'حامل مغناطيسي مكتبي (٧ أجزاء)',
  packaging: 'عبوة وتغليف تجاري (٦ أجزاء)',
};

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  perspective: { label: 'منظوري', pos: [3.2, 2.2, 3.6], target: [0, 0.85, 0] },
  front: { label: 'أمامي', pos: [0, 1.15, 4.4], target: [0, 0.85, 0] },
  top: { label: 'علوي', pos: [0.01, 4.6, 1.1], target: [0, 0.4, 0] },
};

// Scratch objects outside animation loop for zero GC churn
const _camGoal = new THREE.Vector3();
const _targetGoal = new THREE.Vector3();

function createProceduralFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.14)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface ExplodablePart {
  mesh: THREE.Object3D;
  baseY: number;
  explodeY: number;
}

function buildCompositeProduct(
  modelId: ProductModelId,
  primaryMat: THREE.MeshPhysicalMaterial,
  accentMat: THREE.MeshStandardMaterial,
  glassMat: THREE.MeshPhysicalMaterial,
  darkMat: THREE.MeshStandardMaterial
): { group: THREE.Group; parts: ExplodablePart[] } {
  const group = new THREE.Group();
  const parts: ExplodablePart[] = [];

  const registerPart = (mesh: THREE.Object3D, baseY: number, explodeOffset: number) => {
    mesh.position.y = baseY;
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(mesh);
    parts.push({ mesh, baseY, explodeY: baseY + explodeOffset });
  };

  if (modelId === 'diffuser') {
    // 1. Non-slip cork/rubber foot ring (bottom-center flush with y=0)
    const footGeo = new THREE.CylinderGeometry(0.66, 0.68, 0.06, 48);
    const foot = new THREE.Mesh(footGeo, darkMat);
    registerPart(foot, 0.03, 0);

    // 2. Lathe anodized lower housing
    const basePts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.7, 0),
      new THREE.Vector2(0.74, 0.12),
      new THREE.Vector2(0.72, 0.48),
      new THREE.Vector2(0.66, 0.56),
      new THREE.Vector2(0.01, 0.56),
    ];
    const baseGeo = new THREE.LatheGeometry(basePts, 48);
    const baseMesh = new THREE.Mesh(baseGeo, primaryMat);
    registerPart(baseMesh, 0.06, 0.12);

    // 3. Machined brushed collar ring
    const collarGeo = new THREE.TorusGeometry(0.68, 0.035, 20, 48);
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, accentMat);
    registerPart(collar, 0.63, 0.38);

    // 4. Internal atomizer core column
    const coreGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.85, 24);
    const core = new THREE.Mesh(coreGeo, darkMat);
    registerPart(core, 0.62, 0.42);

    // 5. Frosted glass reservoir shell (Lathe)
    const domePts = [
      new THREE.Vector2(0.56, 0),
      new THREE.Vector2(0.64, 0.12),
      new THREE.Vector2(0.6, 0.58),
      new THREE.Vector2(0.42, 0.86),
      new THREE.Vector2(0.24, 0.96),
    ];
    const domeGeo = new THREE.LatheGeometry(domePts, 48);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.renderOrder = 2;
    registerPart(dome, 0.64, 0.72);

    // 6. Top metallic mist nozzle collar
    const capGeo = new THREE.CylinderGeometry(0.22, 0.27, 0.14, 36);
    const cap = new THREE.Mesh(capGeo, primaryMat);
    registerPart(cap, 1.56, 1.15);

    // 7. Inner recessed mist aperture ring
    const apertureGeo = new THREE.TorusGeometry(0.11, 0.02, 16, 32);
    apertureGeo.rotateX(Math.PI / 2);
    const aperture = new THREE.Mesh(apertureGeo, accentMat);
    registerPart(aperture, 1.64, 1.28);

    // 8. Front tactile power button bezel
    const btnGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.04, 24);
    btnGeo.rotateX(Math.PI / 2);
    const btn = new THREE.Mesh(btnGeo, accentMat);
    btn.position.z = 0.72;
    registerPart(btn, 0.34, 0.12);
  } else if (modelId === 'stand') {
    // 1. Beveled weighted base plate via ExtrudeGeometry
    const baseShape = new THREE.Shape();
    const w = 0.72;
    const d = 0.55;
    const r = 0.12;
    baseShape.moveTo(-w + r, -d);
    baseShape.lineTo(w - r, -d);
    baseShape.quadraticCurveTo(w, -d, w, -d + r);
    baseShape.lineTo(w, d - r);
    baseShape.quadraticCurveTo(w, d, w - r, d);
    baseShape.lineTo(-w + r, d);
    baseShape.quadraticCurveTo(-w, d, -w, d - r);
    baseShape.lineTo(-w, -d + r);
    baseShape.quadraticCurveTo(-w, -d, -w + r, -d);

    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    baseGeo.rotateX(-Math.PI / 2);
    const baseMesh = new THREE.Mesh(baseGeo, primaryMat);
    registerPart(baseMesh, 0.025, 0);

    // 2. Base silicone grip ring
    const padGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.015, 36);
    const pad = new THREE.Mesh(padGeo, darkMat);
    registerPart(pad, 0.135, 0.15);

    // 3. Lower hinge barrel
    const barrelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.42, 28);
    barrelGeo.rotateZ(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, accentMat);
    barrel.position.z = -0.24;
    registerPart(barrel, 0.22, 0.25);

    // 4. Curved articulated arm via TubeGeometry
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.24),
      new THREE.Vector3(0, 0.55, -0.32),
      new THREE.Vector3(0, 1.08, -0.08),
    ]);
    const armGeo = new THREE.TubeGeometry(armCurve, 28, 0.075, 16, false);
    const arm = new THREE.Mesh(armGeo, primaryMat);
    registerPart(arm, 0.24, 0.45);

    // 5. Upper ball-joint knuckle
    const jointGeo = new THREE.SphereGeometry(0.12, 24, 24);
    const joint = new THREE.Mesh(jointGeo, accentMat);
    joint.position.z = -0.06;
    registerPart(joint, 1.32, 0.72);

    // 6. Magnetic cradle back plate
    const plateGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 48);
    plateGeo.rotateX(Math.PI * 0.38);
    const plate = new THREE.Mesh(plateGeo, primaryMat);
    plate.position.z = 0.08;
    registerPart(plate, 1.38, 0.95);

    // 7. Magnetic alignment ring accent
    const magRingGeo = new THREE.TorusGeometry(0.32, 0.025, 16, 48);
    magRingGeo.rotateX(-Math.PI * 0.12);
    const magRing = new THREE.Mesh(magRingGeo, accentMat);
    magRing.position.z = 0.12;
    registerPart(magRing, 1.38, 1.15);
  } else {
    // Commercial Packaging & Glass Bottle Assembly (6 parts)
    // 1. Rigid outer gift box base
    const boxShape = new THREE.Shape();
    const s = 0.62;
    const rad = 0.08;
    boxShape.moveTo(-s + rad, -s);
    boxShape.lineTo(s - rad, -s);
    boxShape.quadraticCurveTo(s, -s, s, -s + rad);
    boxShape.lineTo(s, s - rad);
    boxShape.quadraticCurveTo(s, s, s - rad, s);
    boxShape.lineTo(-s + rad, s);
    boxShape.quadraticCurveTo(-s, s, -s, s - rad);
    boxShape.lineTo(-s, -s + rad);
    boxShape.quadraticCurveTo(-s, -s, -s + rad, -s);

    const boxGeo = new THREE.ExtrudeGeometry(boxShape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    boxGeo.rotateX(-Math.PI / 2);
    const boxBase = new THREE.Mesh(boxGeo, darkMat);
    registerPart(boxBase, 0.02, 0);

    // 2. Molded inner tray insert
    const trayGeo = new THREE.CylinderGeometry(0.44, 0.46, 0.1, 36);
    const tray = new THREE.Mesh(trayGeo, primaryMat);
    registerPart(tray, 0.52, 0.28);

    // 3. Lathe glass bottle body
    const bottlePts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.34, 0),
      new THREE.Vector2(0.38, 0.08),
      new THREE.Vector2(0.38, 0.72),
      new THREE.Vector2(0.22, 0.88),
      new THREE.Vector2(0.16, 0.98),
    ];
    const bottleGeo = new THREE.LatheGeometry(bottlePts, 48);
    const bottle = new THREE.Mesh(bottleGeo, glassMat);
    bottle.renderOrder = 2;
    registerPart(bottle, 0.56, 0.6);

    // 4. Inner liquid/essence core cylinder
    const liquidGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.62, 32);
    const liquid = new THREE.Mesh(liquidGeo, primaryMat);
    registerPart(liquid, 0.62, 0.58);

    // 5. Brushed metallic dropper collar
    const collarGeo = new THREE.CylinderGeometry(0.19, 0.2, 0.16, 36);
    const collar = new THREE.Mesh(collarGeo, accentMat);
    registerPart(collar, 1.54, 0.98);

    // 6. Silicone dropper bulb tip (Lathe)
    const tipPts = [
      new THREE.Vector2(0.13, 0),
      new THREE.Vector2(0.14, 0.12),
      new THREE.Vector2(0.1, 0.28),
      new THREE.Vector2(0.02, 0.34),
    ];
    const tipGeo = new THREE.LatheGeometry(tipPts, 32);
    const tip = new THREE.Mesh(tipGeo, darkMat);
    registerPart(tip, 1.7, 1.18);
  }

  return { group, parts };
}

export const ThreeDProductStudioView: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [modelId, setModelId] = useState<ProductModelId>('diffuser');
  const [finishId, setFinishId] = useState<FinishId>('teal');
  const [lightingId, setLightingId] = useState<LightingPresetId>('studio');
  const [explodeAmount, setExplodeAmount] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [contextLost, setContextLost] = useState<boolean>(false);

  // Refs synced to Three.js render loop without tearing down canvas
  const stateRef = useRef({
    modelId,
    finishId,
    lightingId,
    explodeAmount,
    autoRotate,
  });
  stateRef.current = {
    modelId,
    finishId,
    lightingId,
    explodeAmount,
    autoRotate,
  };

  const sceneApiRef = useRef<{
    rebuildProduct: (id: ProductModelId) => void;
    applyFinish: (finish: FinishId) => void;
    applyLighting: (preset: LightingPresetId) => void;
    setCameraPreset: (preset: CameraPresetId) => void;
    exportSnapshot: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 580;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0xeff3f7;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.055);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(3.2, 2.2, 3.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.0;
    controls.maxDistance = 9.0;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.85, 0);

    // Warm Key + Cool Fill + Rim + Area Softbox
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(4.5, 6.2, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0xcbd5e1, 0.85);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 1.1);
    rimLight.position.set(-4.0, 3.5, -4.5);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 2.5, 3.5, 2.0);
      softbox.position.set(-3.2, 3.0, 2.4);
      softbox.lookAt(0, 0.9, 0);
      scene.add(softbox);
    }

    // Procedural Studio Floor & Radial Contact Shadow
    const floorTex = createProceduralFloorTexture();
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floorGeo = new THREE.CircleGeometry(14, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.02;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.8, 2.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.y = 0.001;
    scene.add(shadowPlane);

    // Shared PBR Materials
    const initialFinish = FINISH_COLORS[stateRef.current.finishId];
    const primaryMat = new THREE.MeshPhysicalMaterial({
      color: initialFinish.hex,
      metalness: initialFinish.metalness,
      roughness: initialFinish.roughness,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xd4b08c,
      metalness: 0.92,
      roughness: 0.2,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.0,
      roughness: 0.14,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1,
      ior: 1.52,
      thickness: 0.6,
      depthWrite: false,
      clearcoat: 1.0,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.15,
      roughness: 0.82,
    });

    let activeGroup: THREE.Group | null = null;
    let activeParts: ExplodablePart[] = [];
    let currentExplode = 0;
    let camTransitionActive = false;

    const disposeGroup = (grp: THREE.Group | null) => {
      if (!grp) return;
      scene.remove(grp);
      grp.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    };

    const rebuildProduct = (id: ProductModelId) => {
      disposeGroup(activeGroup);
      const built = buildCompositeProduct(id, primaryMat, accentMat, glassMat, darkMat);
      activeGroup = built.group;
      activeParts = built.parts;
      scene.add(activeGroup);
    };

    rebuildProduct(stateRef.current.modelId);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    sceneApiRef.current = {
      rebuildProduct,
      applyFinish: (f: FinishId) => {
        const cfg = FINISH_COLORS[f];
        primaryMat.color.setHex(cfg.hex);
        primaryMat.metalness = cfg.metalness;
        primaryMat.roughness = cfg.roughness;
        primaryMat.needsUpdate = true;
      },
      applyLighting: (preset: LightingPresetId) => {
        if (preset === 'warm') {
          keyLight.color.setHex(0xffd7a8);
          keyLight.intensity = 2.45;
          hemiLight.color.setHex(0xfef3c7);
          hemiLight.intensity = 0.7;
          scene.background = new THREE.Color(0xf4efe8);
          (scene.fog as THREE.FogExp2).color.setHex(0xf4efe8);
        } else {
          keyLight.color.setHex(0xfff1dc);
          keyLight.intensity = 2.2;
          hemiLight.color.setHex(0xdbeafe);
          hemiLight.intensity = 0.85;
          scene.background = new THREE.Color(bgHex);
          (scene.fog as THREE.FogExp2).color.setHex(bgHex);
        }
      },
      setCameraPreset: (preset: CameraPresetId) => {
        const p = CAMERA_PRESETS[preset];
        _camGoal.set(p.pos[0], p.pos[1], p.pos[2]);
        _targetGoal.set(p.target[0], p.target[1], p.target[2]);
        camTransitionActive = true;
      },
      exportSnapshot: () => {
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = `sanad-3d-${stateRef.current.modelId}.png`;
        link.click();
      },
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);

      if (activeGroup) {
        if (stateRef.current.autoRotate && !isSoftwareGl) {
          activeGroup.rotation.y += delta * 0.35;
        }
        currentExplode = THREE.MathUtils.damp(
          currentExplode,
          stateRef.current.explodeAmount,
          6,
          delta
        );
        for (let i = 0; i < activeParts.length; i++) {
          const p = activeParts[i];
          p.mesh.position.y = THREE.MathUtils.lerp(
            p.baseY,
            p.explodeY,
            currentExplode
          );
        }
      }

      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, 6, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, 6, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, 6, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetGoal.x, 6, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetGoal.y, 6, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetGoal.z, 6, delta);
        if (camera.position.distanceTo(_camGoal) < 0.02) {
          camTransitionActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      disposeGroup(activeGroup);
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      primaryMat.dispose();
      accentMat.dispose();
      glassMat.dispose();
      darkMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleModelChange = (id: ProductModelId) => {
    setModelId(id);
    sceneApiRef.current?.rebuildProduct(id);
  };

  const handleFinishChange = (f: FinishId) => {
    setFinishId(f);
    sceneApiRef.current?.applyFinish(f);
  };

  const handleLightingChange = (l: LightingPresetId) => {
    setLightingId(l);
    sceneApiRef.current?.applyLighting(l);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">استوديو العرض ثلاثي الأبعاد</h1>
        <p className="text-sm text-slate-600">
          معاينة تفاعلية ثلاثية الأبعاد للمنتجات والعبوات التجارية مع تفكيك الأجزاء، تغيير
          الخامات والإضاءة، والتقاط صور جاهزة لحملاتك.
        </p>
      </header>

      {/* Full-bleed Viewport Container with Unified Collapsible Bottom Dock */}
      <div className="relative w-full h-[640px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
        {/* Isolated WebGL Mount */}
        <div ref={mountRef} className="w-full h-full" />

        {/* Minimal Top Corner Title */}
        <div
          className="absolute top-4 right-4 z-10 pointer-events-none px-3.5 py-2 rounded-lg border border-slate-200"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)' }}
        >
          <div className="text-xs font-bold text-slate-900">
            {PRODUCT_NAMES[modelId]}
          </div>
          <div className="text-[11px] text-slate-500">
            اسحب للتدوير · عجلة الفأرة للتقريب
          </div>
        </div>

        {contextLost && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100 text-slate-700 p-6 text-center space-y-2">
            <p className="text-sm font-semibold">تم إيقاف سياق العرض ثلاثي الأبعاد مؤقتاً</p>
            <p className="text-xs text-slate-500">أعد تحديث الصفحة لاستعادة العرض.</p>
          </div>
        )}

        {/* Collapsible Bottom Control Dock (no backdrop-filter over WebGL) */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-4xl flex flex-col items-center transition-transform duration-300"
          style={{
            transform: dockCollapsed
              ? 'translate(-50%, calc(100% - 36px))'
              : 'translate(-50%, 0)',
          }}
        >
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 border border-b-0 border-slate-200 rounded-t-lg cursor-pointer"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.96)' }}
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>إظهار أدوات التحكم</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>إخفاء الأدوات</span>
              </>
            )}
          </button>

          <div
            className="w-full border border-slate-200 rounded-xl p-3.5 shadow-lg space-y-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.96)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Product Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(PRODUCT_NAMES) as ProductModelId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleModelChange(id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      modelId === id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {PRODUCT_NAMES[id]}
                  </button>
                ))}
              </div>

              {/* Camera & Turntable & Snapshot */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => sceneApiRef.current?.setCameraPreset(preset)}
                    className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {CAMERA_PRESETS[preset].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  title={autoRotate ? 'إيقاف الدوران' : 'تشغيل الدوران'}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>دوران</span>
                </button>
                <button
                  type="button"
                  onClick={() => sceneApiRef.current?.exportSnapshot()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>التقاط صورة</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Explode Slider, Finish Swatches, Lighting */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2.5">
                <label htmlFor="explode-range" className="font-semibold text-slate-700 whitespace-nowrap">
                  تفكيك الأجزاء:
                </label>
                <input
                  id="explode-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explodeAmount}
                  onChange={(e) => setExplodeAmount(Number(e.target.value))}
                  className="w-28 accent-teal-700 cursor-pointer"
                />
                {explodeAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExplodeAmount(0)}
                    aria-label="إرجاع الأجزاء"
                    className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">الخامة:</span>
                {(Object.keys(FINISH_COLORS) as FinishId[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleFinishChange(f)}
                    title={FINISH_COLORS[f].label}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] cursor-pointer ${
                      finishId === f
                        ? 'border-teal-700 bg-teal-50 text-teal-950 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: FINISH_COLORS[f].swatch }}
                    />
                    <span>{FINISH_COLORS[f].label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">الإضاءة:</span>
                <button
                  type="button"
                  onClick={() => handleLightingChange('studio')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    lightingId === 'studio'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  نهاري
                </button>
                <button
                  type="button"
                  onClick={() => handleLightingChange('warm')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    lightingId === 'warm'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  دافئ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
