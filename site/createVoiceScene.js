/**
 * Animated 3D voice emblem (Hyperlinks Space–style black void + lime accent).
 * Pauses when off-screen to avoid scroll jank.
 */
import * as THREE from 'three';

export function createVoiceScene(container, options = {}) {
  const accent = new THREE.Color(options.accent || '#d4ff4a');
  const compact = options.density === 'compact';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.038);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  // Pull back slightly so the full mic + rings fit without bottom clipping
  camera.position.set(0, 0.15, compact ? 5.6 : 5.1);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  root.position.y = 0.05;
  scene.add(root);

  const micMat = new THREE.MeshStandardMaterial({
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

  const mic = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.15, 8, 24), micMat);
  body.position.y = 0.2;
  mic.add(body);
  const grille = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 12, 48), limeMat);
  grille.rotation.x = Math.PI / 2;
  grille.position.y = 0.75;
  mic.add(grille);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 16), micMat);
  stem.position.y = -0.85;
  mic.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 32), limeMat);
  base.position.y = -1.35;
  mic.add(base);
  root.add(mic);

  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.025, 10, 96), ringMat);
  ringA.rotation.x = Math.PI / 2.4;
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.018, 10, 96), ringMat.clone());
  ringB.rotation.x = Math.PI / 1.7;
  ringB.rotation.z = 0.6;
  root.add(ringA, ringB);

  const orbs = [];
  const orbColors = [0xd4ff4a, 0x5ce1ff, 0xff5cad, 0xb388ff];
  orbColors.forEach((c, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + (i % 2) * 0.06, 24, 24),
      new THREE.MeshStandardMaterial({
        color: c,
        metalness: 0.2,
        roughness: 0.35,
        emissive: new THREE.Color(c),
        emissiveIntensity: 0.45,
      }),
    );
    const a = (i / orbColors.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 2.1, Math.sin(a * 1.3) * 0.6, Math.sin(a) * 2.1);
    orbs.push(m);
    root.add(m);
  });

  const count = compact ? 120 : 220;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
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

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(3, 5, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));
  const rim = new THREE.PointLight(accent.getHex(), 2.2, 12);
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
          { threshold: 0.05 },
        )
      : null;
  io?.observe(container);

  const tick = () => {
    if (disposed) return;
    raf = 0;
    if (!visible) return;
    const t = clock.getElapsedTime();
    mic.rotation.y = t * 0.35;
    mic.position.y = Math.sin(t * 0.9) * 0.08;
    ringA.rotation.z = t * 0.4;
    ringB.rotation.y = -t * 0.28;
    orbs.forEach((o, i) => {
      const a = t * 0.55 + (i / orbs.length) * Math.PI * 2;
      o.position.x = Math.cos(a) * (2.0 + Math.sin(t + i) * 0.15);
      o.position.z = Math.sin(a) * (2.0 + Math.cos(t + i) * 0.15);
      o.position.y = Math.sin(t * 1.2 + i) * 0.45;
    });
    particles.rotation.y = t * 0.03;
    root.rotation.x = Math.sin(t * 0.2) * 0.06;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  // Layout may settle after fonts/images — resize twice
  requestAnimationFrame(() => {
    resize();
    raf = requestAnimationFrame(tick);
  });
  setTimeout(resize, 120);

  return {
    setAccent(hex) {
      accent.set(hex);
      limeMat.color.copy(accent);
      limeMat.emissive.copy(accent);
      rim.color.copy(accent);
      particles.material.color.copy(accent);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
