import * as THREE from 'three';
import { jarvisAudio } from './jarvisAudio';

export class JarvisHoloOrb {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbMesh: THREE.Mesh;
  private innerCore: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private particles: THREE.Points;
  private animationFrameId: number | null = null;
  private isListening = false;
  private isSpeaking = false;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 240;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.z = 3.6;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Ambient & Point Lights
    const ambientLight = new THREE.AmbientLight(0x00f2fe, 1.2);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 3.5, 10);
    pointLight.position.set(2, 2, 3);
    this.scene.add(pointLight);

    const backLight = new THREE.PointLight(0x2563eb, 2.8, 10);
    backLight.position.set(-2, -2, -2);
    this.scene.add(backLight);

    // 1. Outer Liquid Glass Sphere
    const orbGeo = new THREE.SphereGeometry(1, 64, 64);
    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f2fe,
      emissive: 0x0a2540,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.82,
      ior: 1.45,
      thickness: 0.8,
      transparent: true,
      opacity: 0.9,
      wireframe: false,
    });
    this.orbMesh = new THREE.Mesh(orbGeo, orbMat);
    this.scene.add(this.orbMesh);

    // 2. Inner Glowing Pulsating Core
    const coreGeo = new THREE.IcosahedronGeometry(0.55, 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      wireframe: true,
    });
    this.innerCore = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(this.innerCore);

    // 3. Holographic Orbital Ring
    const ringGeo = new THREE.TorusGeometry(1.35, 0.015, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 3;
    this.scene.add(this.ringMesh);

    // 4. Floating Holographic Quantum Particles
    const particleCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.3 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.045,
      transparent: true,
      opacity: 0.8
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particles);

    this.startAnimation();
    window.addEventListener('resize', this.onResize);
  }

  setListening(listening: boolean) {
    this.isListening = listening;
  }

  setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startAnimation() {
    let clock = new THREE.Clock();

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Audio reactive amplitude
      const freqData = jarvisAudio.getAudioFrequencyData();
      let avgAudio = 0;
      if (freqData.length > 0) {
        let sum = 0;
        for (let i = 0; i < 16; i++) sum += freqData[i];
        avgAudio = sum / (16 * 255);
      }

      const pulseBase = this.isListening ? 0.35 : (this.isSpeaking ? 0.5 : 0.08);
      const pulse = 1.0 + Math.sin(elapsedTime * 3) * 0.05 + (avgAudio * 0.4) + (pulseBase * 0.2);

      this.orbMesh.scale.set(pulse, pulse, pulse);
      this.orbMesh.rotation.y = elapsedTime * 0.4;
      this.orbMesh.rotation.x = Math.sin(elapsedTime * 0.2) * 0.15;

      this.innerCore.scale.set(pulse * 0.95, pulse * 0.95, pulse * 0.95);
      this.innerCore.rotation.y = -elapsedTime * 0.7;
      this.innerCore.rotation.z = elapsedTime * 0.3;

      this.ringMesh.rotation.z = elapsedTime * 0.25;
      this.ringMesh.rotation.y = Math.cos(elapsedTime * 0.3) * 0.4;

      this.particles.rotation.y = elapsedTime * 0.12;

      // Color dynamics based on state
      const mat = this.orbMesh.material as THREE.MeshPhysicalMaterial;
      if (this.isListening) {
        mat.color.setHex(0x00f2fe); // Cyan bright
        mat.emissive.setHex(0x0284c7);
      } else if (this.isSpeaking) {
        mat.color.setHex(0x38bdf8); // Sky blue neon
        mat.emissive.setHex(0x1d4ed8);
      } else {
        mat.color.setHex(0x0284c7); // Calm dark cyan
        mat.emissive.setHex(0x0f172a);
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
