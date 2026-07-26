/**
 * Animated 3D assets (Hyperlinks Space–style black void + accent).
 * Variants cover mic / orb / speaker / flask / gear / logo / wave.
 */
import * as THREE from 'three';

export type SceneVariant = 'mic' | 'orb' | 'speaker' | 'flask' | 'gear' | 'logo' | 'wave';
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
  return `hsl(${hue} 85% 58%)`;
}

export function createVoiceScene(
  container: HTMLElement,
  options: VoiceSceneOptions = {},
): VoiceSceneHandle {
  const accent = new THREE.Color(options.accent || '#d4ff4a');
  const density = options.density || 'full';
  const variant = options.variant || 'mic';
  const card = density === 'card';
  const compact = density === 'compact' || card;

  const scene = new THREE.Scene();
  if (!card) scene.fog = new THREE.FogExp2(0x000000, 0.038);

  const camera = new THREE.PerspectiveCamera(card ? 36 : 40, 1, 0.1, 100);
  camera.position.set(0, card ? 0 : 0.15, card ? 4.2 : compact ? 5.6 : 5.1);

  const renderer = new THREE.WebGLRenderer({
    antialias: !card,
    alpha: true,
    powerPreference: card ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, card ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  root.position.y = card ? 0 : 0.05;
  scene.add(root);

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.85,
    roughness: 0.28,
    emissive: accent.clone().multiplyScalar(0.15),
  });
  const limeMat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.35,
    roughness: 0.35,
    emissive: accent,
    emissiveIntensity: 0.55,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.6,
    roughness: 0.4,
    emissive: accent,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
  });

  const spin: THREE.Object3D[] = [];
  const floaters: THREE.Object3D[] = [];

  const addRing = (r: number, tube: number, rx: number, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, card ? 6 : 10, card ? 32 : 96), ringMat);
    mesh.rotation.x = rx;
    mesh.rotation.z = rz;
    root.add(mesh);
    spin.push(mesh);
    return mesh;
  };

  if (variant === 'mic') {
    const mic = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.15, card ? 4 : 8, card ? 12 : 24),
      darkMat,
    );
    body.position.y = 0.2;
    mic.add(body);
    const grille = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 24), limeMat);
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
    if (!card) {
      addRing(1.85, 0.025, Math.PI / 2.4);
      addRing(2.25, 0.018, Math.PI / 1.7, 0.6);
    } else {
      addRing(1.35, 0.03, Math.PI / 2.6);
    }
  } else if (variant === 'orb') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, card ? 0 : 1), limeMat);
    root.add(core);
    spin.push(core);
    addRing(1.25, 0.04, Math.PI / 2.2);
    if (!card) addRing(1.55, 0.02, Math.PI / 1.6, 0.8);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), darkMat);
    moon.position.set(1.4, 0.3, 0);
    root.add(moon);
    floaters.push(moon);
  } else if (variant === 'speaker') {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.1, 0.9, 24), darkMat);
    cone.rotation.x = Math.PI / 2;
    root.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 8, 32), limeMat);
    rim.rotation.x = Math.PI / 2;
    root.add(rim);
    spin.push(cone, rim);
    addRing(1.55, 0.025, Math.PI / 2.5);
  } else if (variant === 'flask') {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 20), limeMat);
    bulb.position.y = -0.35;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 12), darkMat);
    neck.position.y = 0.55;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20), limeMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 1.0;
    root.add(bulb, neck, lip);
    spin.push(bulb, neck);
    addRing(1.4, 0.03, Math.PI / 2.3);
  } else if (variant === 'gear') {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 20), darkMat);
    hub.rotation.x = Math.PI / 2;
    root.add(hub);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.35), limeMat);
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
      tooth.rotation.z = a;
      root.add(tooth);
      spin.push(tooth);
    }
    spin.push(hub);
    addRing(1.35, 0.03, Math.PI / 2.4);
  } else if (variant === 'logo') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.28, 1, 1, 1), darkMat);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), limeMat);
    gem.position.z = 0.35;
    root.add(plate, gem);
    spin.push(plate, gem);
    addRing(1.35, 0.035, Math.PI / 2.5);
  } else {
    // wave — sound bars
    const bars: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.4 + i * 0.15, 0.22),
        i % 2 ? limeMat : darkMat,
      );
      bar.position.x = (i - 2) * 0.38;
      root.add(bar);
      bars.push(bar);
      floaters.push(bar);
    }
    addRing(1.5, 0.03, Math.PI / 2.3);
  }

  if (!card && variant === 'mic') {
    const orbColors = [0xd4ff4a, 0x5ce1ff, 0xff5cad, 0xb388ff];
    orbColors.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 + (i % 2) * 0.06, 16, 16),
        new THREE.MeshStandardMaterial({
          color: c,
          metalness: 0.2,
          roughness: 0.35,
          emissive: new THREE.Color(c),
          emissiveIntensity: 0.45,
        }),
      );
      root.add(m);
      floaters.push(m);
    });
  }

  let particles: THREE.Points | null = null;
  if (!card) {
    const count = compact ? 120 : 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: accent,
        size: 0.035,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    );
    scene.add(particles);
  }

  const key = new THREE.DirectionalLight(0xffffff, card ? 1.4 : 1.15);
  key.position.set(3, 5, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, card ? 0.45 : 0.28));
  const rim = new THREE.PointLight(accent.getHex(), card ? 1.6 : 2.2, 12);
  rim.position.set(-2.2, 1.5, 2);
  scene.add(rim);

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
    root.rotation.y = t * (card ? 0.55 : 0.35);
    root.rotation.x = Math.sin(t * 0.25) * (card ? 0.12 : 0.06);
    spin.forEach((o, i) => {
      o.rotation.z = t * (0.2 + i * 0.05);
    });
    floaters.forEach((o, i) => {
      const a = t * 0.7 + i;
      if (variant === 'wave') {
        o.scale.y = 0.7 + Math.abs(Math.sin(a * 2)) * 1.4;
      } else if (variant === 'mic' && !card) {
        o.position.x = Math.cos(a) * 2.0;
        o.position.z = Math.sin(a) * 2.0;
        o.position.y = Math.sin(a * 1.3) * 0.45;
      } else {
        o.position.y = Math.sin(a) * 0.25;
      }
    });
    if (particles) particles.rotation.y = t * 0.03;
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
      darkMat.emissive.copy(accent.clone().multiplyScalar(0.15));
      ringMat.emissive.copy(accent);
      rim.color.copy(accent);
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
