/**
 * Animated 3D assets — bright, colourful variants for mic / orb / speaker /
 * flask / gear / logo / wave / crystal / ring.
 */
import * as THREE from 'three';

export type SceneVariant =
  | 'mic'
  | 'orb'
  | 'speaker'
  | 'flask'
  | 'gear'
  | 'logo'
  | 'wave'
  | 'crystal'
  | 'ring';
export type SceneDensity = 'full' | 'compact' | 'card';

export type VoiceSceneHandle = {
  dispose: () => void;
  setAccent: (hex: string) => void;
};

export type VoiceSceneOptions = {
  accent?: string;
  density?: SceneDensity;
  variant?: SceneVariant;
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function accentFromSeed(seed: string): string {
  const hue = hashHue(seed);
  return `hsl(${hue} 90% 62%)`;
}

/** Pick a distinct 3D shape from a preset / sound id. */
export function variantFromSeed(seed: string): SceneVariant {
  const all: SceneVariant[] = [
    'mic',
    'orb',
    'speaker',
    'flask',
    'gear',
    'logo',
    'wave',
    'crystal',
    'ring',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return all[h % all.length];
}

export function createVoiceScene(
  container: HTMLElement,
  options: VoiceSceneOptions = {},
): VoiceSceneHandle {
  const accent = new THREE.Color(options.accent || '#8dff6a');
  const density = options.density || 'full';
  const variant = options.variant || 'mic';
  const card = density === 'card';
  const compact = density === 'compact' || card;

  const scene = new THREE.Scene();
  if (!card) scene.fog = new THREE.FogExp2(0x000000, 0.032);

  const camera = new THREE.PerspectiveCamera(card ? 34 : 40, 1, 0.1, 100);
  camera.position.set(0, card ? 0.05 : 0.15, card ? 3.9 : compact ? 5.4 : 5.0);

  const renderer = new THREE.WebGLRenderer({
    antialias: !card,
    alpha: true,
    powerPreference: card ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, card ? 1.35 : 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.position = 'relative';
  renderer.domElement.style.zIndex = '1';
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  root.position.y = card ? 0 : 0.05;
  scene.add(root);

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x12181a,
    metalness: 0.9,
    roughness: 0.22,
    emissive: accent.clone().multiplyScalar(0.22),
  });
  const limeMat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.28,
    roughness: 0.28,
    emissive: accent,
    emissiveIntensity: card ? 0.85 : 0.7,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.32,
    emissive: accent,
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide,
  });
  const glowMats: THREE.MeshStandardMaterial[] = [
    limeMat,
    new THREE.MeshStandardMaterial({
      color: accent.clone().offsetHSL(0.12, 0, 0.05),
      metalness: 0.2,
      roughness: 0.3,
      emissive: accent.clone().offsetHSL(0.12, 0, 0),
      emissiveIntensity: 0.7,
    }),
    new THREE.MeshStandardMaterial({
      color: accent.clone().offsetHSL(-0.14, 0, 0.08),
      metalness: 0.25,
      roughness: 0.35,
      emissive: accent.clone().offsetHSL(-0.14, 0, 0),
      emissiveIntensity: 0.65,
    }),
  ];

  const spin: THREE.Object3D[] = [];
  const floaters: THREE.Object3D[] = [];

  const addRing = (r: number, tube: number, rx: number, rz = 0, mat = ringMat) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, tube, card ? 8 : 12, card ? 40 : 96),
      mat,
    );
    mesh.rotation.x = rx;
    mesh.rotation.z = rz;
    root.add(mesh);
    spin.push(mesh);
    return mesh;
  };

  const addSpark = (color: THREE.Color, r = 0.14) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 10),
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.15,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.9,
      }),
    );
    root.add(m);
    floaters.push(m);
    return m;
  };

  if (variant === 'mic') {
    const mic = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.15, card ? 5 : 8, card ? 14 : 24),
      darkMat,
    );
    body.position.y = 0.2;
    mic.add(body);
    const grille = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 8, 28), limeMat);
    grille.rotation.x = Math.PI / 2;
    grille.position.y = 0.75;
    mic.add(grille);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 12), darkMat);
    stem.position.y = -0.85;
    mic.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 20), limeMat);
    base.position.y = -1.35;
    mic.add(base);
    root.add(mic);
    spin.push(mic);
    addRing(1.35, 0.035, Math.PI / 2.6);
    if (!card) {
      addRing(1.85, 0.025, Math.PI / 2.4, 0, glowMats[1]);
      addRing(2.25, 0.018, Math.PI / 1.7, 0.6, glowMats[2]);
    }
    addSpark(accent.clone().offsetHSL(0.08, 0, 0.1), 0.12).position.set(1.1, 0.6, 0.4);
    addSpark(accent.clone().offsetHSL(-0.1, 0, 0.05), 0.1).position.set(-1.0, -0.2, 0.5);
  } else if (variant === 'orb') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, card ? 1 : 2), limeMat);
    root.add(core);
    spin.push(core);
    addRing(1.25, 0.045, Math.PI / 2.2);
    addRing(1.55, 0.025, Math.PI / 1.6, 0.8, glowMats[1]);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), glowMats[2]);
    moon.position.set(1.4, 0.3, 0);
    root.add(moon);
    floaters.push(moon);
    addSpark(new THREE.Color('#ffffff'), 0.08).position.set(-1.2, 0.8, 0.3);
  } else if (variant === 'speaker') {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.1, 0.9, 28), darkMat);
    cone.rotation.x = Math.PI / 2;
    root.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 10, 36), limeMat);
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
    const dust = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), glowMats[1]);
    dust.rotation.x = Math.PI / 2;
    dust.position.z = 0.2;
    root.add(dust);
    spin.push(cone, rim);
    addRing(1.55, 0.03, Math.PI / 2.5, 0, glowMats[2]);
    addSpark(accent.clone(), 0.11).position.set(1.3, 0.7, 0.2);
  } else if (variant === 'flask') {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 22, 22), limeMat);
    bulb.position.y = -0.35;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 14), darkMat);
    neck.position.y = 0.55;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 8, 22), glowMats[1]);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 1.0;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), glowMats[2]);
    bubble.position.set(0.25, -0.2, 0.55);
    root.add(bulb, neck, lip, bubble);
    spin.push(bulb, neck);
    floaters.push(bubble);
    addRing(1.4, 0.035, Math.PI / 2.3);
  } else if (variant === 'gear') {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 22), darkMat);
    hub.rotation.x = Math.PI / 2;
    root.add(hub);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.35), glowMats[i % 3]);
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
      tooth.rotation.z = a;
      root.add(tooth);
      spin.push(tooth);
    }
    spin.push(hub);
    addRing(1.35, 0.035, Math.PI / 2.4, 0, glowMats[1]);
  } else if (variant === 'logo') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 0.28), darkMat);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), limeMat);
    gem.position.z = 0.38;
    const gem2 = new THREE.Mesh(new THREE.TetrahedronGeometry(0.28, 0), glowMats[1]);
    gem2.position.set(0.7, 0.7, 0.45);
    root.add(plate, gem, gem2);
    spin.push(plate, gem);
    floaters.push(gem2);
    addRing(1.35, 0.04, Math.PI / 2.5, 0, glowMats[2]);
  } else if (variant === 'crystal') {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), limeMat);
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4, 0), glowMats[1]);
    shard.position.set(0.9, 0.4, 0.3);
    const shard2 = new THREE.Mesh(new THREE.TetrahedronGeometry(0.28, 0), glowMats[2]);
    shard2.position.set(-0.85, -0.35, 0.25);
    root.add(crystal, shard, shard2);
    spin.push(crystal);
    floaters.push(shard, shard2);
    addRing(1.3, 0.04, Math.PI / 2.4);
  } else if (variant === 'ring') {
    addRing(0.95, 0.12, Math.PI / 2.1, 0, limeMat);
    addRing(1.35, 0.05, Math.PI / 1.7, 0.5, glowMats[1]);
    addRing(1.65, 0.03, Math.PI / 2.8, -0.4, glowMats[2]);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), darkMat);
    root.add(core);
    spin.push(core);
    addSpark(accent.clone(), 0.12).position.set(0, 1.1, 0);
  } else {
    // wave — sound bars
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.45 + i * 0.14, 0.24),
        glowMats[i % 3],
      );
      bar.position.x = (i - 2) * 0.4;
      root.add(bar);
      floaters.push(bar);
    }
    addRing(1.5, 0.035, Math.PI / 2.3, 0, limeMat);
  }

  // Colourful orbit sparks on every density
  const sparkColors = [
    accent.clone(),
    accent.clone().offsetHSL(0.15, 0, 0.08),
    accent.clone().offsetHSL(-0.18, 0, 0.1),
    new THREE.Color('#ffffff'),
  ];
  sparkColors.forEach((c, i) => {
    if (card && i > 2) return;
    const s = addSpark(c, card ? 0.1 : 0.14 + (i % 2) * 0.04);
    const a = (i / sparkColors.length) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.35, Math.sin(a * 1.3) * 0.35, Math.sin(a) * 1.1);
  });

  let particles: THREE.Points | null = null;
  {
    const count = card ? 72 : compact ? 140 : 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const spread = card ? 5 : 12;
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * (card ? 4 : 8);
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: accent,
        size: card ? 0.045 : 0.038,
        transparent: true,
        opacity: card ? 0.75 : 0.7,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    );
    scene.add(particles);
  }

  const key = new THREE.DirectionalLight(0xffffff, card ? 1.65 : 1.25);
  key.position.set(3, 5, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, card ? 0.55 : 0.32));
  const rim = new THREE.PointLight(accent.getHex(), card ? 2.2 : 2.4, 14);
  rim.position.set(-2.2, 1.5, 2);
  scene.add(rim);
  const fill = new THREE.PointLight(accent.clone().offsetHSL(0.2, 0, 0).getHex(), 1.2, 10);
  fill.position.set(2.4, -1.2, 1.5);
  scene.add(fill);

  let raf = 0;
  let disposed = false;
  let visible = true;
  const clock = new THREE.Clock();

  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (w < 2 || h < 2) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(container);
  window.addEventListener('resize', resize);

  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          ([entry]) => {
            visible = Boolean(entry?.isIntersecting);
            if (visible && !raf && !disposed) raf = requestAnimationFrame(tick);
          },
          { threshold: 0.02, rootMargin: '40px' },
        )
      : null;
  io?.observe(container);

  const tick = () => {
    if (disposed) return;
    raf = 0;
    if (!visible) return;
    const t = clock.getElapsedTime();
    root.rotation.y = t * (card ? 0.7 : 0.4);
    root.rotation.x = Math.sin(t * 0.35) * (card ? 0.16 : 0.08);
    spin.forEach((o, i) => {
      o.rotation.z = t * (0.25 + i * 0.06);
    });
    floaters.forEach((o, i) => {
      const a = t * 0.85 + i;
      if (variant === 'wave') {
        o.scale.y = 0.65 + Math.abs(Math.sin(a * 2.2)) * 1.55;
      } else {
        const radius = card ? 1.15 : 1.45;
        o.position.x = Math.cos(a) * radius;
        o.position.z = Math.sin(a) * radius;
        o.position.y = Math.sin(a * 1.4) * (card ? 0.35 : 0.45);
      }
    });
    if (particles) particles.rotation.y = t * 0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  requestAnimationFrame(() => {
    resize();
    raf = requestAnimationFrame(tick);
  });
  setTimeout(resize, 80);

  return {
    setAccent(hex: string) {
      accent.set(hex);
      limeMat.color.copy(accent);
      limeMat.emissive.copy(accent);
      darkMat.emissive.copy(accent.clone().multiplyScalar(0.22));
      ringMat.emissive.copy(accent);
      rim.color.copy(accent);
      fill.color.copy(accent.clone().offsetHSL(0.2, 0, 0));
      glowMats[1].color.copy(accent.clone().offsetHSL(0.12, 0, 0.05));
      glowMats[1].emissive.copy(accent.clone().offsetHSL(0.12, 0, 0));
      glowMats[2].color.copy(accent.clone().offsetHSL(-0.14, 0, 0.08));
      glowMats[2].emissive.copy(accent.clone().offsetHSL(-0.14, 0, 0));
      if (particles) (particles.material as THREE.PointsMaterial).color.copy(accent);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('resize', resize);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      try {
        renderer.forceContextLoss();
      } catch {
        /* */
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
