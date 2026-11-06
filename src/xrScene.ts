import * as THREE from 'three';
import * as xb from 'xrblocks';
import { jarvisAudio } from './jarvisAudio';
import { jarvisAI } from './jarvisAI';

export interface SharedControlState {
  isWifiOn: boolean;
  isBluetoothOn: boolean;
  isMobileDataOn: boolean;
  isFlashlightOn: boolean;
  isMusicPlaying: boolean;
  brightness: number;
  volume: number;
  activeLanguage: 'en' | 'hi' | 'bn';
}

export class HyperOSXRScene extends xb.Script {
  private sharedState: SharedControlState;
  private statusText?: xb.UIText;
  private wifiBtn?: xb.UIButton;
  private btBtn?: xb.UIButton;
  private torchBtn?: xb.UIButton;
  private orbMesh?: THREE.Mesh;
  private orbCore?: THREE.Mesh;
  private card?: xb.UICard;

  constructor(sharedState: SharedControlState) {
    super();
    this.sharedState = sharedState;
  }

  init() {
    this.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 2.5));
    const dirLight = new THREE.DirectionalLight(0x00f2fe, 1.8);
    dirLight.position.set(1, 3, 2);
    this.add(dirLight);

    // 1. Floating Holographic 3D Orb in XR Space
    const orbGroup = new THREE.Group();
    const orbGeo = new THREE.SphereGeometry(0.14, 32, 32);
    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f2fe,
      emissive: 0x0284c7,
      transmission: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    this.orbMesh = new THREE.Mesh(orbGeo, orbMat);

    const coreGeo = new THREE.IcosahedronGeometry(0.08, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true
    });
    this.orbCore = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(this.orbMesh, this.orbCore);
    orbGroup.position.set(0, 1.78, -1.1);
    this.add(orbGroup);

    // 2. Spatial UI Card - HyperOS Control Center
    this.statusText = new xb.UIText({
      text: 'JARVIS HyperOS Control Centre Active',
      style: { fontSize: 16, textAlign: 'center', opacity: 0.85 }
    });

    this.wifiBtn = new xb.UIButton({
      label: this.sharedState.isWifiOn ? 'Wi-Fi: ON' : 'Wi-Fi: OFF',
      icon: 'wifi',
      style: { flexGrow: 1 },
      onClick: () => {
        this.sharedState.isWifiOn = !this.sharedState.isWifiOn;
        if (this.wifiBtn) {
          this.wifiBtn.label = this.sharedState.isWifiOn ? 'Wi-Fi: ON' : 'Wi-Fi: OFF';
        }
        jarvisAudio.playToggle(this.sharedState.isWifiOn);
      }
    });

    this.btBtn = new xb.UIButton({
      label: this.sharedState.isBluetoothOn ? 'Bluetooth: ON' : 'Bluetooth: OFF',
      icon: 'bluetooth',
      style: { flexGrow: 1 },
      onClick: () => {
        this.sharedState.isBluetoothOn = !this.sharedState.isBluetoothOn;
        if (this.btBtn) {
          this.btBtn.label = this.sharedState.isBluetoothOn ? 'Bluetooth: ON' : 'Bluetooth: OFF';
        }
        jarvisAudio.playToggle(this.sharedState.isBluetoothOn);
      }
    });

    this.torchBtn = new xb.UIButton({
      label: this.sharedState.isFlashlightOn ? 'Torch: ON' : 'Torch: OFF',
      icon: 'flashlight_on',
      style: { flexGrow: 1 },
      onClick: () => {
        this.sharedState.isFlashlightOn = !this.sharedState.isFlashlightOn;
        if (this.torchBtn) {
          this.torchBtn.label = this.sharedState.isFlashlightOn ? 'Torch: ON' : 'Torch: OFF';
        }
        jarvisAudio.playToggle(this.sharedState.isFlashlightOn);
      }
    });

    const musicBtn = new xb.UIButton({
      label: 'Play Media',
      icon: 'play_arrow',
      style: { flexGrow: 1 },
      onClick: () => {
        const playing = jarvisAudio.toggleMusic();
        this.sharedState.isMusicPlaying = playing;
        musicBtn.label = playing ? 'Pause Media' : 'Play Media';
        musicBtn.icon = playing ? 'pause' : 'play_arrow';
      }
    });

    const voiceBtn = new xb.UIButton({
      label: 'JARVIS Voice',
      icon: 'mic',
      style: { flexGrow: 1 },
      onClick: () => {
        jarvisAI.toggleListening();
      }
    });

    const brightnessSlider = new xb.UISlider({
      ariaLabel: 'Brightness Slider',
      min: 10,
      max: 100,
      step: 5,
      value: Math.round(this.sharedState.brightness * 100),
      style: { width: '100%', height: 38 },
      onInput: (val) => {
        this.sharedState.brightness = val / 100;
        if (this.statusText) {
          this.statusText.text = `Screen Brightness: ${val}%`;
        }
      }
    });

    this.card = new xb.UICard({
      size: { width: 0.65, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 14,
        padding: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderRadius: 24,
      },
      children: [
        new xb.UIText({
          text: 'HYPEROS CONTROL CENTRE',
          style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' }
        }),
        this.statusText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [this.wifiBtn, this.btBtn]
        }),
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [this.torchBtn, musicBtn]
        }),
        new xb.UIText({
          text: 'Screen Brightness',
          style: { fontSize: 16 }
        }),
        brightnessSlider,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [voiceBtn]
        }),
        new xb.UIText({
          text: 'Touch or pinch in XR to control your device',
          style: { fontSize: 13, opacity: 0.65, textAlign: 'center' }
        })
      ]
    });

    this.card.position.set(0, 1.42, -1.1);
    this.add(this.card);
  }

  update() {
    const time = performance.now() * 0.001;
    if (this.orbMesh) {
      this.orbMesh.rotation.y = time * 0.5;
      const s = 1.0 + Math.sin(time * 3) * 0.05;
      this.orbMesh.scale.set(s, s, s);
    }
    if (this.orbCore) {
      this.orbCore.rotation.x = -time * 0.8;
      this.orbCore.rotation.z = time * 0.4;
    }
  }

  dispose() {
    this.orbMesh?.geometry.dispose();
    this.orbCore?.geometry.dispose();
  }
}
