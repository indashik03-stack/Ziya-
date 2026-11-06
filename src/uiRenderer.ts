import JSZip from 'jszip';
import { jarvisAudio } from './jarvisAudio';
import { jarvisAI, SupportedLanguage } from './jarvisAI';
import { JarvisHoloOrb } from './threeOrb';
import { ANDROID_PROJECT_FILES, AndroidFile } from './androidProjectCode';
import { SharedControlState } from './xrScene';
import { mountBatteryChart, unmountBatteryChart } from './batteryChart';
import { syncSystemSettings, fetchSystemSettings, subscribeToRecentVoiceLogs, VoiceLogRecord } from './firebase';

export class HyperOSUIManager {
  private container: HTMLElement;
  private state: SharedControlState;
  private orb: JarvisHoloOrb | null = null;
  private isFullscreenMode = false;
  private isTorchActive = false;
  private liquidGlassStyle: 'clear' | 'tinted' = 'clear';
  private isBackgroundScanActive = false;
  private isExpandedIsland = false;
  private activeModal: 'none' | 'dialer' | 'notifications' | 'apps' | 'camera' | 'system' | 'code' | 'devices' | 'glassSettings' = 'none';
  private selectedCodeFile: AndroidFile = ANDROID_PROJECT_FILES[0];
  private currentTranscript = '';
  private jarvisStatus = 'At your service, Sir.';
  private activeCallContact: string | null = null;
  private activeCameraStream: MediaStream | null = null;

  // Media tracks
  private tracks = [
    { title: 'Far closer', artist: 'David E. Smith' },
    { title: 'Dream It Possible', artist: 'Delacey (HyperOS Edition)' },
    { title: 'Arc Reactor Pulse', artist: 'Stark Sound Lab' }
  ];
  private currentTrackIdx = 0;

  // Notifications
  private notifications = [
    {
      id: '1',
      app: 'WhatsApp',
      icon: 'chat',
      title: 'Pepper Potts',
      text: 'Jarvis, schedule the briefing with the board for 10 AM.',
      time: '2m ago',
      hasActions: false
    },
    {
      id: '2',
      app: 'Instagram',
      icon: 'photo_camera',
      title: 'Received 1 photo',
      text: 'Stark Industries R&D shared a blueprint photo.',
      time: '6m ago',
      hasActions: true
    },
    {
      id: '3',
      app: 'HyperOS System',
      icon: 'security',
      title: 'HyperOS 4.0 Liquid Glass',
      text: 'All system modules and Android 16 security patches up to date.',
      time: '18m ago',
      hasActions: false
    },
    {
      id: '4',
      app: 'Stark Defense',
      icon: 'shield',
      title: 'Armor Diagnostic',
      text: 'Mark 85 repulsors at 100% nominal readiness.',
      time: '42m ago',
      hasActions: false
    }
  ];

  constructor(container: HTMLElement, sharedState: SharedControlState) {
    this.container = container;
    this.state = sharedState;
    this.init();
  }

  private init() {
    this.render();
    this.setupJarvisAIListeners();
    this.startClock();
    // Default background scan active on startup per user preference
    this.setBackgroundScan(true, false);
    this.loadFirebaseSettings();
  }

  private loadFirebaseSettings() {
    fetchSystemSettings().then(saved => {
      if (saved) {
        this.state.isWifiOn = saved.isWifiOn;
        this.state.isBluetoothOn = saved.isBluetoothOn;
        this.state.isMobileDataOn = saved.isMobileDataOn;
        this.state.brightness = saved.brightness;
        this.state.volume = saved.volume;
        if (saved.activeLanguage) {
          this.state.activeLanguage = saved.activeLanguage as SupportedLanguage;
          jarvisAI.setLanguage(this.state.activeLanguage);
        }
        if (saved.liquidGlassStyle) {
          this.setGlassStyle(saved.liquidGlassStyle, false);
        }
        if (saved.backgroundScanActive !== undefined) {
          this.setBackgroundScan(saved.backgroundScanActive, false);
        }
        if (saved.isFlashlightOn !== undefined) {
          this.setFlashlight(saved.isFlashlightOn, false);
        }
        this.updateUiElements();
      }
    }).catch(() => {});
  }

  private syncToFirebase() {
    syncSystemSettings({
      isWifiOn: this.state.isWifiOn,
      isBluetoothOn: this.state.isBluetoothOn,
      isMobileDataOn: this.state.isMobileDataOn,
      isFlashlightOn: this.isTorchActive,
      brightness: this.state.brightness,
      volume: this.state.volume,
      activeLanguage: this.state.activeLanguage,
      liquidGlassStyle: this.liquidGlassStyle,
      backgroundScanActive: this.isBackgroundScanActive
    }).catch(err => console.warn('[Firebase] Sync failed:', err));
  }

  public setGlassStyle(style: 'clear' | 'tinted', sync = true) {
    this.liquidGlassStyle = style;
    const phoneFrame = this.container.querySelector('#phoneFrame');
    const labelGlass = this.container.querySelector('#labelGlassStyle');
    if (phoneFrame) {
      phoneFrame.classList.toggle('liquid-glass-tinted', style === 'tinted');
      phoneFrame.classList.toggle('liquid-glass-clear', style === 'clear');
    }
    if (labelGlass) {
      labelGlass.textContent = `Glass: ${style === 'clear' ? 'Clear' : 'Tinted'}`;
    }
    jarvisAudio.playClick();
    if (sync) this.syncToFirebase();
  }

  public toggleGlassStyle() {
    this.setGlassStyle(this.liquidGlassStyle === 'clear' ? 'tinted' : 'clear');
  }

  public setBackgroundScan(active: boolean, sync = true) {
    this.isBackgroundScanActive = active;
    if (active) {
      jarvisAudio.startBackgroundScan();
    } else {
      jarvisAudio.stopBackgroundScan();
    }
    const btnScan = this.container.querySelector('#btnToggleScan');
    const labelScan = this.container.querySelector('#labelScanSound');
    if (btnScan) {
      btnScan.classList.toggle('scan-active-pulse', active);
    }
    if (labelScan) {
      labelScan.textContent = active ? 'Scan: Active' : 'Scan Sound';
    }
    if (sync) this.syncToFirebase();
  }

  public toggleBackgroundScan() {
    this.setBackgroundScan(!this.isBackgroundScanActive);
    jarvisAudio.playToggle(this.isBackgroundScanActive);
  }

  public updateIslandState() {
    const wrapper = this.container.querySelector('.phone-island-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
      <div class="island-capsule-row">
        <!-- 90W 32.56% Super Fast Charge Capsule (Screenshot 3) -->
        <div class="island-sub-pill charging-pill" id="islandChargePill" title="Xiaomi HyperCharge 90W">
          <span class="material-symbols-outlined" style="font-size: 13px;">bolt</span>
          <span>90W 32.56%</span>
        </div>

        <!-- Center Main Dynamic Island Pill -->
        <div class="dynamic-island" id="dynamicIsland" title="Click to expand HyperOS Live Island / Talk to ZOYA">
          <div class="island-camera-dot"></div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 15px; color: var(--hyper-cyan);">
              ${this.state.isMusicPlaying ? 'graphic_eq' : 'cognition'}
            </span>
            <span id="islandText" style="font-size: 11px; font-weight: 600; color: #fff; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.state.isMusicPlaying ? 'Far closer' : 'ZOYA'}
            </span>
          </div>
          <span class="material-symbols-outlined" style="font-size: 15px; color: #94a3b8;">mic</span>
        </div>

        <!-- Right Micro Capsule: Flashlight or Timer (Screenshot 3) -->
        ${this.isTorchActive ? `
          <div class="island-sub-pill torch-pill" id="islandTorchPill">
            <span class="material-symbols-outlined" style="font-size: 13px;">flashlight_on</span>
            <button class="island-mini-btn" id="btnIslandTurnOffTorch">Turn off</button>
          </div>
        ` : `
          <div class="island-sub-pill timer-pill" id="islandTimerPill" title="Timer countdown">
            <span class="material-symbols-outlined" style="font-size: 13px;">hourglass_bottom</span>
            <span>03:58</span>
          </div>
        `}
      </div>
    `;

    // Reattach listeners to island capsules
    this.container.querySelector('#dynamicIsland')?.addEventListener('click', () => this.toggleExpandedIsland());
    this.container.querySelector('#btnIslandTurnOffTorch')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setFlashlight(false);
    });
    this.container.querySelector('#islandChargePill')?.addEventListener('click', () => {
      this.openModal('system');
    });
    this.container.querySelector('#islandTimerPill')?.addEventListener('click', () => {
      this.toggleExpandedIsland();
    });
  }

  public toggleExpandedIsland() {
    this.isExpandedIsland = !this.isExpandedIsland;
    const overlay = this.container.querySelector('#expandedIslandOverlay') as HTMLElement | null;
    if (!overlay) return;

    if (!this.isExpandedIsland) {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      return;
    }

    jarvisAudio.playClick();
    overlay.style.display = 'block';
    overlay.innerHTML = `
      <div class="dynamic-island-expanded-card">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--hyper-cyan), var(--hyper-electric-blue)); display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #000;">cognition</span>
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #fff;">HyperOS 4 Live Island</div>
              <div style="font-size: 10px; color: var(--hyper-cyan);">ZOYA Active Context</div>
            </div>
          </div>
          <button id="btnCloseIslandExpanded" style="background: rgba(255, 255, 255, 0.1); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
          </button>
        </div>

        <!-- Far closer - David E. Smith Media Live Tile (Screenshot 3) -->
        <div style="display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.06); padding: 10px 14px; border-radius: 18px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #ef4444); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">
            <span class="material-symbols-outlined" style="color: #fff; font-size: 24px;">graphic_eq</span>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Far closer</div>
            <div style="font-size: 12px; color: var(--hyper-text-muted);">David.E.Smith</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
              <span style="font-size: 10px; color: var(--hyper-text-muted); font-family: monospace;">2:54</span>
              <div style="flex: 1; height: 3px; background: rgba(255, 255, 255, 0.15); border-radius: 999px; overflow: hidden;">
                <div style="width: 74%; height: 100%; background: var(--hyper-cyan);"></div>
              </div>
              <span style="font-size: 10px; color: var(--hyper-text-muted); font-family: monospace;">3:56</span>
            </div>
          </div>
          <button id="btnIslandPlayPause" style="width: 36px; height: 36px; border-radius: 50%; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <span class="material-symbols-outlined" style="color: #000; font-size: 20px;">
              ${this.state.isMusicPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>

        <!-- Received 1 photo live capsule (Screenshot 3) -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.06); padding: 10px 14px; border-radius: 18px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">photo_library</span>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #fff;">Received 1 photo</div>
              <div style="font-size: 10px; color: var(--hyper-text-muted);">Stark Lab shared blueprint.jpg</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="btnIslandDeclinePhoto" style="padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); border: none; color: #fff; font-size: 11px; cursor: pointer;">Decline</button>
            <button id="btnIslandAcceptPhoto" style="padding: 4px 10px; border-radius: 999px; background: var(--hyper-cyan); border: none; color: #000; font-size: 11px; font-weight: 700; cursor: pointer;">Accept</button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#btnCloseIslandExpanded')?.addEventListener('click', () => this.toggleExpandedIsland());
    this.container.querySelector('#btnIslandPlayPause')?.addEventListener('click', () => {
      this.toggleMediaPlay();
      this.toggleExpandedIsland();
    });
    this.container.querySelector('#btnIslandAcceptPhoto')?.addEventListener('click', () => {
      this.openModal('camera');
      this.toggleExpandedIsland();
    });
    this.container.querySelector('#btnIslandDeclinePhoto')?.addEventListener('click', () => {
      this.toggleExpandedIsland();
    });
  }

  private updateUiElements() {
    const tileWifi = this.container.querySelector('#tileWifi');
    if (tileWifi) {
      tileWifi.classList.toggle('active', this.state.isWifiOn);
      const sub = tileWifi.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isWifiOn ? 'JARVIS_5G_ULTRA' : 'Off';
    }
    const tileBt = this.container.querySelector('#tileBluetooth');
    if (tileBt) {
      tileBt.classList.toggle('active', this.state.isBluetoothOn);
      const sub = tileBt.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isBluetoothOn ? 'Stark Buds Pro' : 'Off';
    }
    const tileData = this.container.querySelector('#tileMobileData');
    if (tileData) {
      tileData.classList.toggle('active', this.state.isMobileDataOn);
      const sub = tileData.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isMobileDataOn ? '5G Ultra' : 'Off';
    }
    const phoneFrame = this.container.querySelector('#phoneFrame');
    if (phoneFrame) {
      phoneFrame.classList.toggle('liquid-glass-tinted', this.liquidGlassStyle === 'tinted');
      phoneFrame.classList.toggle('liquid-glass-clear', this.liquidGlassStyle === 'clear');
    }
    this.setBrightness(this.state.brightness, false);
    this.setVolume(this.state.volume, false);
    this.updateIslandState();
  }

  private startClock() {
    setInterval(() => {
      const timeElem = this.container.querySelector('#clockTime');
      const dateElem = this.container.querySelector('#clockDate');
      if (timeElem && dateElem) {
        const now = new Date();
        timeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        dateElem.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      }
    }, 1000);
  }

  private setupJarvisAIListeners() {
    jarvisAI.onTranscriptChange = (transcript) => {
      this.currentTranscript = transcript;
      const transcriptEl = this.container.querySelector('#jarvisTranscript');
      if (transcriptEl) transcriptEl.textContent = `"${transcript}"`;
    };

    jarvisAI.onStateChange = (isListening, isSpeaking) => {
      if (this.orb) {
        this.orb.setListening(isListening);
        this.orb.setSpeaking(isSpeaking);
      }
      const titleEl = this.container.querySelector('#jarvisStatusTitle');
      const pillEl = this.container.querySelector('#dynamicIsland');
      if (titleEl) {
        if (isListening) {
          titleEl.textContent = 'ZOYA Listening...';
          titleEl.classList.add('pulse-cyan');
        } else if (isSpeaking) {
          titleEl.textContent = 'ZOYA Speaking';
        } else {
          titleEl.textContent = 'ZOYA AI Assistant';
        }
      }
      if (pillEl) {
        if (isListening || isSpeaking) pillEl.classList.add('expanded');
        else pillEl.classList.remove('expanded');
      }
    };

    jarvisAI.onCommandExecuted = (result) => {
      this.jarvisStatus = result.response;
      const statusEl = this.container.querySelector('#jarvisStatusTitle');
      if (statusEl) statusEl.textContent = 'ZOYA: ' + result.response;

      if (result.action === 'flashlight_on') {
        this.setFlashlight(true);
      } else if (result.action === 'flashlight_off') {
        this.setFlashlight(false);
      } else if (result.action === 'toggle_wifi') {
        this.toggleWifi();
      } else if (result.action === 'toggle_bluetooth') {
        this.toggleBluetooth();
      } else if (result.action === 'open_camera') {
        this.openModal('camera');
      } else if (result.action === 'open_notifications') {
        this.openModal('notifications');
      } else if (result.action === 'open_dialer') {
        this.openModal('dialer');
      } else if (result.action === 'toggle_music') {
        this.toggleMediaPlay();
      } else if (result.action === 'max_brightness') {
        this.setBrightness(1.0);
      } else if (result.action === 'open_whatsapp') {
        window.open('https://web.whatsapp.com', '_blank');
      }
    };
  }

  private render() {
    this.container.innerHTML = `
      <div class="ambient-bg">
        <div class="ambient-grid"></div>
      </div>

      <!-- Top Global Bar -->
      <header class="top-nav">
        <div class="brand-badge">
          <div class="brand-icon">
            <span class="material-symbols-outlined" style="font-size: 20px; color: #000;">cognition</span>
          </div>
          <div>
            <div class="brand-title">ZOYA AI CONTROL CENTRE</div>
          </div>
          <span class="brand-tag">HYPEROS 4</span>
        </div>

        <div class="nav-actions">
          <button class="nav-btn" id="btnToggleGlass" title="Switch Liquid Glass Style (Clear vs Tinted)">
            <span class="material-symbols-outlined" style="font-size: 18px; color: var(--hyper-cyan);">blur_on</span>
            <span id="labelGlassStyle">Glass: ${this.liquidGlassStyle === 'clear' ? 'Clear' : 'Tinted'}</span>
          </button>
          <button class="nav-btn ${this.isBackgroundScanActive ? 'scan-active-pulse' : ''}" id="btnToggleScan" title="All-time Background Scan Sound / San (Radar sound)">
            <span class="material-symbols-outlined" style="font-size: 18px; color: ${this.isBackgroundScanActive ? 'var(--hyper-cyan)' : '#94a3b8'};">radar</span>
            <span id="labelScanSound">${this.isBackgroundScanActive ? 'Scan: Active' : 'Scan Sound'}</span>
          </button>
          <button class="nav-btn" id="btnOpenDevices" title="Xiaomi HyperOS Connected Device Center">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #38bdf8;">hub</span>
            <span>Devices</span>
          </button>
          <button class="nav-btn" id="btnToggleView">
            <span class="material-symbols-outlined" style="font-size: 18px;">
              ${this.isFullscreenMode ? 'smartphone' : 'fullscreen'}
            </span>
            <span>${this.isFullscreenMode ? 'Phone Frame' : 'Fullscreen'}</span>
          </button>
          <button class="nav-btn primary" id="btnOpenCode">
            <span class="material-symbols-outlined" style="font-size: 18px;">code</span>
            <span>Android Kotlin Project</span>
          </button>
        </div>
      </header>

      <!-- Main Workspace -->
      <main class="workspace">
        <div class="phone-mockup ${this.isFullscreenMode ? 'fullscreen-mode' : ''} ${this.liquidGlassStyle === 'tinted' ? 'liquid-glass-tinted' : 'liquid-glass-clear'}" id="phoneFrame">
          
          <!-- Screen Container -->
          <div class="phone-screen" id="screenLuminescence">

            <!-- Dynamic Island Capsule Row (Screenshot 3) -->
            <div class="phone-island-wrapper">
              <div class="island-capsule-row">
                <div class="island-sub-pill charging-pill" id="islandChargePill" title="Xiaomi HyperCharge 90W">
                  <span class="material-symbols-outlined" style="font-size: 13px;">bolt</span>
                  <span>90W 32.56%</span>
                </div>
                <div class="dynamic-island" id="dynamicIsland" title="Click to expand HyperOS Live Island / Talk to ZOYA">
                  <div class="island-camera-dot"></div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined" style="font-size: 15px; color: var(--hyper-cyan);">graphic_eq</span>
                    <span id="islandText" style="font-size: 11px; font-weight: 600; color: #fff; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">ZOYA</span>
                  </div>
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #94a3b8;">mic</span>
                </div>
                <div class="island-sub-pill timer-pill" id="islandTimerPill" title="Timer countdown">
                  <span class="material-symbols-outlined" style="font-size: 13px;">hourglass_bottom</span>
                  <span>03:58</span>
                </div>
              </div>
            </div>

            <!-- Expanded Live Island Overlay (When user clicks dynamic island) -->
            <div id="expandedIslandOverlay" style="display: none;"></div>

            <!-- Status Bar Header -->
            <div class="status-bar-header">
              <div class="clock-display">
                <span class="time-text" id="clockTime">08:36</span>
                <span class="date-text" id="clockDate">Wed, Nov 6</span>
              </div>
              <div class="status-indicators">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #38bdf8;">wifi</span>
                <span class="material-symbols-outlined" style="font-size: 16px; color: #38bdf8;">signal_cellular_alt</span>
                <div class="battery-pill">
                  <span class="material-symbols-outlined" style="font-size: 16px; color: var(--hyper-cyan);">battery_charging_full</span>
                  <span>88%</span>
                </div>
              </div>
            </div>

            <!-- Control Centre Scrollable Body -->
            <div class="control-centre-body">

              <!-- ZOYA Voice Hero & 3D Interactive Orb Stage -->
              <div class="jarvis-hero-card" id="heroOrbCard">
                <div class="orb-stage">
                  <div class="orb-canvas-container" id="orbCanvasContainer"></div>
                </div>
                <div class="jarvis-voice-details">
                  <div class="jarvis-status-title" id="jarvisStatusTitle">
                    <span class="material-symbols-outlined" style="font-size: 18px;">auto_awesome</span>
                    <span>ZOYA AI Assistant</span>
                  </div>
                  <div class="jarvis-transcript" id="jarvisTranscript">
                    "Tap orb or say 'Hey Zoya' to activate"
                  </div>

                  <!-- Language Selector -->
                  <div class="lang-chips">
                    <button class="lang-chip ${this.state.activeLanguage === 'en' ? 'active' : ''}" data-lang="en">English</button>
                    <button class="lang-chip ${this.state.activeLanguage === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी (Hindi)</button>
                    <button class="lang-chip ${this.state.activeLanguage === 'bn' ? 'active' : ''}" data-lang="bn">বাংলা (Bengali)</button>
                  </div>

                  <!-- Quick Voice Commands Chips -->
                  <div class="prompt-chips">
                    <div class="prompt-chip" data-cmd="turn on flashlight">🔦 Torch</div>
                    <div class="prompt-chip" data-cmd="open whatsapp">💬 WhatsApp</div>
                    <div class="prompt-chip" data-cmd="open camera">📷 Camera</div>
                    <div class="prompt-chip" data-cmd="call a contact">📞 Call</div>
                    <div class="prompt-chip" data-cmd="show notifications">🔔 Alerts</div>
                    <div class="prompt-chip" data-cmd="play music">🎵 Music</div>
                  </div>
                </div>
              </div>

              <!-- Primary 2x2 Big Liquid Glass Cards -->
              <div class="liquid-tiles-grid">
                <!-- Wi-Fi Card -->
                <div class="liquid-tile ${this.state.isWifiOn ? 'active' : ''}" id="tileWifi">
                  <div class="liquid-tile-icon-box">
                    <span class="material-symbols-outlined">wifi</span>
                  </div>
                  <div class="liquid-tile-info">
                    <span class="liquid-tile-title">Wi-Fi</span>
                    <span class="liquid-tile-sub">${this.state.isWifiOn ? 'JARVIS_5G_ULTRA' : 'Off'}</span>
                  </div>
                </div>

                <!-- Mobile Data Card -->
                <div class="liquid-tile ${this.state.isMobileDataOn ? 'active' : ''}" id="tileMobileData">
                  <div class="liquid-tile-icon-box">
                    <span class="material-symbols-outlined">swap_vert</span>
                  </div>
                  <div class="liquid-tile-info">
                    <span class="liquid-tile-title">Mobile data</span>
                    <span class="liquid-tile-sub">${this.state.isMobileDataOn ? '5G Ultra' : 'Off'}</span>
                  </div>
                </div>

                <!-- Bluetooth Card -->
                <div class="liquid-tile ${this.state.isBluetoothOn ? 'active' : ''}" id="tileBluetooth">
                  <div class="liquid-tile-icon-box">
                    <span class="material-symbols-outlined">bluetooth</span>
                  </div>
                  <div class="liquid-tile-info">
                    <span class="liquid-tile-title">Bluetooth</span>
                    <span class="liquid-tile-sub">${this.state.isBluetoothOn ? 'Stark Buds Pro' : 'Off'}</span>
                  </div>
                </div>

                <!-- Flashlight Card -->
                <div class="liquid-tile ${this.state.isFlashlightOn ? 'active' : ''}" id="tileFlashlight">
                  <div class="liquid-tile-icon-box">
                    <span class="material-symbols-outlined">flashlight_on</span>
                  </div>
                  <div class="liquid-tile-info">
                    <span class="liquid-tile-title">Flashlight</span>
                    <span class="liquid-tile-sub">${this.state.isFlashlightOn ? 'On' : 'Off'}</span>
                  </div>
                </div>
              </div>

              <!-- Media Player & Dual Vertical Sliders Row -->
              <div class="media-sliders-row">
                <!-- Media Player -->
                <div class="media-card">
                  <div class="media-top">
                    <div class="album-art">
                      <span class="material-symbols-outlined" style="font-size: 24px;">music_note</span>
                    </div>
                    <div class="media-meta">
                      <span class="media-title" id="mediaTitle">${this.tracks[this.currentTrackIdx].title}</span>
                      <span class="media-artist" id="mediaArtist">${this.tracks[this.currentTrackIdx].artist}</span>
                    </div>
                  </div>
                  <div class="media-controls">
                    <button class="media-btn" id="btnPrevTrack">
                      <span class="material-symbols-outlined">skip_previous</span>
                    </button>
                    <button class="media-btn play-btn" id="btnPlayPause">
                      <span class="material-symbols-outlined" id="playPauseIcon">
                        ${this.state.isMusicPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <button class="media-btn" id="btnNextTrack">
                      <span class="material-symbols-outlined">skip_next</span>
                    </button>
                  </div>
                </div>

                <!-- Vertical Brightness Slider -->
                <div class="vertical-slider-container" id="sliderBrightness" title="Drag to adjust screen brightness">
                  <div class="slider-fill" id="fillBrightness" style="height: ${this.state.brightness * 100}%;"></div>
                  <div class="slider-val-tag" id="valBrightness">${Math.round(this.state.brightness * 100)}%</div>
                  <div class="slider-icon-box">
                    <span class="material-symbols-outlined" style="font-size: 22px; color: #000;">light_mode</span>
                  </div>
                </div>

                <!-- Vertical Volume Slider -->
                <div class="vertical-slider-container volume" id="sliderVolume" title="Drag to adjust sound volume">
                  <div class="slider-fill" id="fillVolume" style="height: ${this.state.volume * 100}%;"></div>
                  <div class="slider-val-tag" id="valVolume">${Math.round(this.state.volume * 100)}%</div>
                  <div class="slider-icon-box">
                    <span class="material-symbols-outlined" style="font-size: 22px; color: #000;">volume_up</span>
                  </div>
                </div>
              </div>

              <!-- Smart Hub Bar -->
              <div class="smart-hub-bar" id="smartHubBar">
                <div class="hub-left">
                  <div class="hub-dots">
                    <div class="hub-dot" style="background: #38bdf8;"></div>
                    <div class="hub-dot" style="background: #a855f7;"></div>
                    <div class="hub-dot" style="background: #10b981;"></div>
                  </div>
                  <span style="font-size: 14px; font-weight: 600; color: #fff;">Stark Smart Hub</span>
                </div>
                <span style="font-size: 12px; color: var(--hyper-cyan); font-weight: 500;">6 Devices Connected</span>
              </div>

              <!-- Quick Action Circular Toggles (4x3 Grid) -->
              <div class="toggles-grid">
                <div class="toggle-item" id="toggleDialer">
                  <div class="toggle-circle"><span class="material-symbols-outlined">call</span></div>
                  <span class="toggle-label">Dialer</span>
                </div>
                <div class="toggle-item" id="toggleNotifications">
                  <div class="toggle-circle"><span class="material-symbols-outlined">notifications</span></div>
                  <span class="toggle-label">Alerts</span>
                </div>
                <div class="toggle-item" id="toggleAppLauncher">
                  <div class="toggle-circle"><span class="material-symbols-outlined">apps</span></div>
                  <span class="toggle-label">Apps</span>
                </div>
                <div class="toggle-item" id="toggleCamera">
                  <div class="toggle-circle"><span class="material-symbols-outlined">photo_camera</span></div>
                  <span class="toggle-label">Camera</span>
                </div>

                <div class="toggle-item" id="toggleAirplane">
                  <div class="toggle-circle"><span class="material-symbols-outlined">flight</span></div>
                  <span class="toggle-label">Airplane</span>
                </div>
                <div class="toggle-item active" id="toggleRotate">
                  <div class="toggle-circle"><span class="material-symbols-outlined">screen_rotation</span></div>
                  <span class="toggle-label">Auto rotate</span>
                </div>
                <div class="toggle-item" id="toggleBatterySaver">
                  <div class="toggle-circle"><span class="material-symbols-outlined">battery_saver</span></div>
                  <span class="toggle-label">Battery saver</span>
                </div>
                <div class="toggle-item" id="toggleDnd">
                  <div class="toggle-circle"><span class="material-symbols-outlined">do_not_disturb_on</span></div>
                  <span class="toggle-label">DND</span>
                </div>

                <div class="toggle-item active" id="toggleLocation">
                  <div class="toggle-circle"><span class="material-symbols-outlined">location_on</span></div>
                  <span class="toggle-label">Location</span>
                </div>
                <div class="toggle-item" id="toggleHotspot">
                  <div class="toggle-circle"><span class="material-symbols-outlined">wifi_tethering</span></div>
                  <span class="toggle-label">Hotspot</span>
                </div>
                <div class="toggle-item active" id="toggleDarkMode">
                  <div class="toggle-circle"><span class="material-symbols-outlined">dark_mode</span></div>
                  <span class="toggle-label">Dark mode</span>
                </div>
                <div class="toggle-item" id="toggleSystemInfo">
                  <div class="toggle-circle"><span class="material-symbols-outlined">info</span></div>
                  <span class="toggle-label">System Info</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Live Torch Overlay when Flashlight is active -->
          <div class="torch-overlay" id="torchOverlay" style="display: ${this.isTorchActive ? 'flex' : 'none'};">
            <span class="material-symbols-outlined" style="font-size: 72px;">flashlight_on</span>
            <div style="font-size: 24px; font-weight: 700;">FLASHLIGHT ACTIVE</div>
            <button class="nav-btn primary" id="btnCloseTorch" style="padding: 12px 28px; font-size: 15px;">Turn Off</button>
          </div>

          <!-- Modals & Drawers Container -->
          <div id="modalHost"></div>

        </div>
      </main>
    `;

    this.mount3DOrb();
    this.attachEvents();
  }

  private mount3DOrb() {
    const orbContainer = this.container.querySelector('#orbCanvasContainer') as HTMLElement;
    if (orbContainer) {
      if (this.orb) this.orb.destroy();
      this.orb = new JarvisHoloOrb(orbContainer);
    }
  }

  private attachEvents() {
    // 1. View mode toggle
    const btnToggleView = this.container.querySelector('#btnToggleView');
    btnToggleView?.addEventListener('click', () => {
      this.isFullscreenMode = !this.isFullscreenMode;
      const phoneFrame = this.container.querySelector('#phoneFrame');
      if (phoneFrame) {
        phoneFrame.classList.toggle('fullscreen-mode', this.isFullscreenMode);
      }
      btnToggleView.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">
          ${this.isFullscreenMode ? 'smartphone' : 'fullscreen'}
        </span>
        <span>${this.isFullscreenMode ? 'Phone Frame' : 'Fullscreen'}</span>
      `;
    });

    // 1b. Glass style, Background Scan, and Devices nav buttons
    this.container.querySelector('#btnToggleGlass')?.addEventListener('click', () => {
      this.openModal('glassSettings');
    });
    this.container.querySelector('#btnToggleScan')?.addEventListener('click', () => {
      this.toggleBackgroundScan();
    });
    this.container.querySelector('#btnOpenDevices')?.addEventListener('click', () => {
      this.openModal('devices');
    });
    this.container.querySelector('#smartHubBar')?.addEventListener('click', () => {
      this.openModal('devices');
    });

    // 2. Open Android Project code modal
    const btnOpenCode = this.container.querySelector('#btnOpenCode');
    btnOpenCode?.addEventListener('click', () => {
      this.openModal('code');
    });

    // 3. Hero Orb & Dynamic island voice toggle
    const heroCard = this.container.querySelector('#heroOrbCard');
    const dynamicIsland = this.container.querySelector('#dynamicIsland');
    heroCard?.addEventListener('click', (e) => {
      // Don't trigger if clicked on language chips or prompt chips
      if ((e.target as HTMLElement).closest('.lang-chips') || (e.target as HTMLElement).closest('.prompt-chips')) return;
      jarvisAI.toggleListening();
    });
    dynamicIsland?.addEventListener('click', () => {
      this.toggleExpandedIsland();
    });

    // 4. Language Selector
    const langChips = this.container.querySelectorAll('.lang-chip');
    langChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = (chip as HTMLElement).dataset.lang as SupportedLanguage;
        this.state.activeLanguage = lang;
        jarvisAI.setLanguage(lang);
        langChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        jarvisAudio.playClick();
        this.syncToFirebase();
        jarvisAudio.speak(
          lang === 'hi' ? 'नमस्ते, मैं ज़ोया हूँ, आपकी सेवा में तैयार हूँ।' : (lang === 'bn' ? 'নমস্কার, আমি জোয়া, আপনার কমান্ডের জন্য প্রস্তুত।' : 'Zoya online and ready in English, Sir.'),
          lang
        );
      });
    });

    // 5. Prompt suggestion chips
    const promptChips = this.container.querySelectorAll('.prompt-chip');
    promptChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = (chip as HTMLElement).dataset.cmd;
        if (cmd) {
          const transcriptEl = this.container.querySelector('#jarvisTranscript');
          if (transcriptEl) transcriptEl.textContent = `"${cmd}"`;
          jarvisAI.processVoiceCommand(cmd);
        }
      });
    });

    // 6. Big Liquid Tiles (Wi-Fi, Mobile Data, Bluetooth, Flashlight)
    this.container.querySelector('#tileWifi')?.addEventListener('click', () => this.toggleWifi());
    this.container.querySelector('#tileMobileData')?.addEventListener('click', () => this.toggleMobileData());
    this.container.querySelector('#tileBluetooth')?.addEventListener('click', () => this.toggleBluetooth());
    this.container.querySelector('#tileFlashlight')?.addEventListener('click', () => this.toggleFlashlight());

    // 7. Media Controls
    this.container.querySelector('#btnPlayPause')?.addEventListener('click', () => this.toggleMediaPlay());
    this.container.querySelector('#btnPrevTrack')?.addEventListener('click', () => this.changeTrack(-1));
    this.container.querySelector('#btnNextTrack')?.addEventListener('click', () => this.changeTrack(1));

    // 8. Vertical Sliders Drag Handling (Touch & Mouse)
    this.setupVerticalSlider('sliderBrightness', (pct) => this.setBrightness(pct));
    this.setupVerticalSlider('sliderVolume', (pct) => this.setVolume(pct));

    // 9. Quick Action Circular Toggles
    this.container.querySelector('#toggleDialer')?.addEventListener('click', () => this.openModal('dialer'));
    this.container.querySelector('#toggleNotifications')?.addEventListener('click', () => this.openModal('notifications'));
    this.container.querySelector('#toggleAppLauncher')?.addEventListener('click', () => this.openModal('apps'));
    this.container.querySelector('#toggleCamera')?.addEventListener('click', () => this.openModal('camera'));
    this.container.querySelector('#toggleSystemInfo')?.addEventListener('click', () => this.openModal('system'));

    ['Airplane', 'Rotate', 'BatterySaver', 'Dnd', 'Location', 'Hotspot', 'DarkMode'].forEach(name => {
      this.container.querySelector(`#toggle${name}`)?.addEventListener('click', (e) => {
        const el = (e.currentTarget as HTMLElement);
        el.classList.toggle('active');
        jarvisAudio.playToggle(el.classList.contains('active'));
      });
    });

    // 10. Close Torch
    this.container.querySelector('#btnCloseTorch')?.addEventListener('click', () => this.setFlashlight(false));
  }

  private toggleWifi() {
    this.state.isWifiOn = !this.state.isWifiOn;
    jarvisAudio.playToggle(this.state.isWifiOn);
    const tile = this.container.querySelector('#tileWifi');
    if (tile) {
      tile.classList.toggle('active', this.state.isWifiOn);
      const sub = tile.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isWifiOn ? 'JARVIS_5G_ULTRA' : 'Off';
    }
    this.syncToFirebase();
  }

  private toggleMobileData() {
    this.state.isMobileDataOn = !this.state.isMobileDataOn;
    jarvisAudio.playToggle(this.state.isMobileDataOn);
    const tile = this.container.querySelector('#tileMobileData');
    if (tile) {
      tile.classList.toggle('active', this.state.isMobileDataOn);
      const sub = tile.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isMobileDataOn ? '5G Ultra' : 'Off';
    }
    this.syncToFirebase();
  }

  private toggleBluetooth() {
    this.state.isBluetoothOn = !this.state.isBluetoothOn;
    jarvisAudio.playToggle(this.state.isBluetoothOn);
    const tile = this.container.querySelector('#tileBluetooth');
    if (tile) {
      tile.classList.toggle('active', this.state.isBluetoothOn);
      const sub = tile.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = this.state.isBluetoothOn ? 'Stark Buds Pro' : 'Off';
    }
    this.syncToFirebase();
  }

  private toggleFlashlight() {
    this.setFlashlight(!this.isTorchActive);
  }

  private setFlashlight(on: boolean, sync = true) {
    this.isTorchActive = on;
    this.state.isFlashlightOn = on;
    jarvisAudio.playToggle(on);
    const tile = this.container.querySelector('#tileFlashlight');
    if (tile) {
      tile.classList.toggle('active', on);
      const sub = tile.querySelector('.liquid-tile-sub');
      if (sub) sub.textContent = on ? 'On' : 'Off';
    }
    const torchOverlay = this.container.querySelector('#torchOverlay') as HTMLElement;
    if (torchOverlay) {
      torchOverlay.style.display = on ? 'flex' : 'none';
    }
    this.updateIslandState();
    if (sync) this.syncToFirebase();
  }

  private toggleMediaPlay() {
    const isPlaying = jarvisAudio.toggleMusic();
    this.state.isMusicPlaying = isPlaying;
    const icon = this.container.querySelector('#playPauseIcon');
    if (icon) icon.textContent = isPlaying ? 'pause' : 'play_arrow';
  }

  private changeTrack(direction: number) {
    this.currentTrackIdx = (this.currentTrackIdx + direction + this.tracks.length) % this.tracks.length;
    const track = this.tracks[this.currentTrackIdx];
    const titleEl = this.container.querySelector('#mediaTitle');
    const artistEl = this.container.querySelector('#mediaArtist');
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    jarvisAudio.playClick();
  }

  private setupVerticalSlider(elementId: string, onValueChange: (pct: number) => void) {
    const slider = this.container.querySelector(`#${elementId}`) as HTMLElement;
    if (!slider) return;

    let isDragging = false;

    const updateSlider = (clientY: number) => {
      const rect = slider.getBoundingClientRect();
      const height = rect.height;
      const offsetY = clientY - rect.top;
      // Inverted because bottom is 0%, top is 100%
      const rawPct = (height - offsetY) / height;
      const pct = Math.max(0.05, Math.min(1.0, rawPct));
      onValueChange(pct);
    };

    slider.addEventListener('pointerdown', (e) => {
      isDragging = true;
      slider.setPointerCapture(e.pointerId);
      updateSlider(e.clientY);
      jarvisAudio.playClick();
    });

    slider.addEventListener('pointermove', (e) => {
      if (isDragging) updateSlider(e.clientY);
    });

    slider.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        slider.releasePointerCapture(e.pointerId);
      }
    });
  }

  private setBrightness(pct: number, sync = true) {
    this.state.brightness = pct;
    const fill = this.container.querySelector('#fillBrightness') as HTMLElement;
    const val = this.container.querySelector('#valBrightness');
    if (fill) fill.style.height = `${pct * 100}%`;
    if (val) val.textContent = `${Math.round(pct * 100)}%`;

    // Visual screen luminescence effect
    const screen = this.container.querySelector('#screenLuminescence') as HTMLElement;
    if (screen) {
      const opacity = 0.35 + pct * 0.65;
      screen.style.filter = `brightness(${opacity})`;
    }
    if (sync) this.syncToFirebase();
  }

  private setVolume(pct: number, sync = true) {
    this.state.volume = pct;
    const fill = this.container.querySelector('#fillVolume') as HTMLElement;
    const val = this.container.querySelector('#valVolume');
    if (fill) fill.style.height = `${pct * 100}%`;
    if (val) val.textContent = `${Math.round(pct * 100)}%`;
    jarvisAudio.setVolume(pct);
    if (sync) this.syncToFirebase();
  }

  // Modals Manager
  private openModal(type: typeof this.activeModal) {
    this.activeModal = type;
    const modalHost = this.container.querySelector('#modalHost');
    if (!modalHost) return;

    jarvisAudio.playClick();

    if (type === 'none') {
      unmountBatteryChart();
      modalHost.innerHTML = '';
      if (this.activeCameraStream) {
        this.activeCameraStream.getTracks().forEach(t => t.stop());
        this.activeCameraStream = null;
      }
      return;
    }

    if (type === 'dialer') {
      this.renderDialerModal(modalHost);
    } else if (type === 'notifications') {
      this.renderNotificationsModal(modalHost);
    } else if (type === 'apps') {
      this.renderAppsModal(modalHost);
    } else if (type === 'camera') {
      this.renderCameraModal(modalHost);
    } else if (type === 'system') {
      this.renderSystemModal(modalHost);
    } else if (type === 'code') {
      this.renderCodeModal(modalHost);
    } else if (type === 'devices') {
      this.renderDevicesModal(modalHost);
    } else if (type === 'glassSettings') {
      this.renderGlassSettingsModal(modalHost);
    }
  }

  // 1. Phone Dialer & Communication Controls Modal
  private renderDialerModal(host: Element) {
    let dialedNumber = '';
    const contacts = [
      { name: 'Pepper Potts', number: '+1 (555) 019-2834', role: 'Stark Industries CEO' },
      { name: 'Bruce Banner', number: '+1 (555) 014-9921', role: 'Lab Science & Gamma' },
      { name: 'Happy Hogan', number: '+1 (555) 018-7744', role: 'Head of Security' },
      { name: 'Rhodey (War Machine)', number: '+1 (555) 012-3321', role: 'USAF Liaison' }
    ];

    const updateView = () => {
      host.innerHTML = `
        <div class="hyper-modal-backdrop" id="modalBackdrop">
          <div class="hyper-drawer">
            <div class="drawer-header">
              <div class="drawer-title">
                <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">call</span>
                <span>Communication Centre</span>
              </div>
              <button class="close-btn" id="btnCloseModal">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Number Display -->
            <div style="background: rgba(0, 0, 0, 0.4); border-radius: 16px; padding: 14px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
              <div style="font-size: 28px; font-weight: 700; font-family: monospace; letter-spacing: 2px; min-height: 36px; color: var(--hyper-cyan);">
                ${dialedNumber || 'Enter number...'}
              </div>
            </div>

            <!-- Dialpad Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 260px; margin: 0 auto;">
              ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => `
                <button class="key-btn" data-key="${key}" style="
                  height: 48px; border-radius: 50%; background: rgba(255, 255, 255, 0.08);
                  border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; font-size: 18px; font-weight: 600;
                  display: flex; align-items: center; justify-content: center; cursor: pointer;
                ">${key}</button>
              `).join('')}
            </div>

            <!-- Call Action Button (Requirement: Asks for safety confirmation) -->
            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 4px;">
              <button class="nav-btn primary" id="btnInitiateCall" style="padding: 12px 32px; border-radius: 999px; font-size: 16px; width: 100%; justify-content: center;">
                <span class="material-symbols-outlined">call</span>
                <span>Call with Confirmation</span>
              </button>
            </div>

            <!-- Contacts List -->
            <div style="margin-top: 8px;">
              <div style="font-size: 12px; color: var(--hyper-text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Quick Contacts</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${contacts.map(c => `
                  <div class="contact-card" data-name="${c.name}" data-num="${c.number}" style="
                    display: flex; align-items: center; justify-content: space-between; padding: 10px 14px;
                    border-radius: 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
                    cursor: pointer;
                  ">
                    <div>
                      <div style="font-size: 14px; font-weight: 600; color: #fff;">${c.name}</div>
                      <div style="font-size: 11px; color: var(--hyper-text-muted);">${c.role} • ${c.number}</div>
                    </div>
                    <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">phone_forwarded</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- External Communication Shortcuts -->
            <div style="display: flex; justify-content: space-around; padding: 12px 0 4px 0; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <a href="https://web.whatsapp.com" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 4px; color: #22c55e; font-size: 11px;">
                <span class="material-symbols-outlined">chat</span>WhatsApp
              </a>
              <a href="https://t.me" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 4px; color: #38bdf8; font-size: 11px;">
                <span class="material-symbols-outlined">send</span>Telegram
              </a>
              <a href="https://instagram.com" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 4px; color: #ec4899; font-size: 11px;">
                <span class="material-symbols-outlined">camera_alt</span>Instagram
              </a>
            </div>

          </div>
        </div>
      `;

      host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));
      host.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          dialedNumber += (btn as HTMLElement).dataset.key || '';
          jarvisAudio.playClick();
          updateView();
        });
      });

      host.querySelectorAll('.contact-card').forEach(card => {
        card.addEventListener('click', () => {
          const name = (card as HTMLElement).dataset.name || '';
          const num = (card as HTMLElement).dataset.num || '';
          this.promptCallConfirmation(name, num);
        });
      });

      host.querySelector('#btnInitiateCall')?.addEventListener('click', () => {
        if (!dialedNumber) {
          dialedNumber = '+1 (555) STARK-01';
        }
        this.promptCallConfirmation('Direct Dial', dialedNumber);
      });
    };

    updateView();
  }

  // Safety Confirmation Dialog as required by Android prompt
  private promptCallConfirmation(contactName: string, number: string) {
    const modalHost = this.container.querySelector('#modalHost');
    if (!modalHost) return;

    modalHost.innerHTML = `
      <div class="hyper-modal-backdrop">
        <div class="hyper-drawer" style="max-height: 40%; text-align: center; align-items: center;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(0, 242, 254, 0.2); border: 2px solid var(--hyper-cyan); display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
            <span class="material-symbols-outlined" style="font-size: 32px; color: var(--hyper-cyan);">call</span>
          </div>
          <div style="font-size: 18px; font-weight: 700; color: #fff;">Confirm Outgoing Call</div>
          <div style="font-size: 14px; color: var(--hyper-text-muted); margin: 6px 0 16px 0;">
            Initiate high-priority voice transmission to <b>${contactName}</b> (${number})?
          </div>
          <div style="display: flex; gap: 12px; width: 100%;">
            <button class="nav-btn" id="btnCancelCall" style="flex: 1; justify-content: center; padding: 12px;">Cancel</button>
            <button class="nav-btn primary" id="btnConfirmCall" style="flex: 1; justify-content: center; padding: 12px;">Confirm Call</button>
          </div>
        </div>
      </div>
    `;

    modalHost.querySelector('#btnCancelCall')?.addEventListener('click', () => this.openModal('dialer'));
    modalHost.querySelector('#btnConfirmCall')?.addEventListener('click', () => {
      jarvisAudio.playJarvisChime();
      jarvisAudio.speak(`Connecting voice call to ${contactName}, Sir.`, this.state.activeLanguage);
      alert(`[JARVIS Android Intent dispatched]\nandroid.intent.action.CALL initiated for ${contactName} (${number}).`);
      this.openModal('none');
    });
  }

  // 2. Notification Centre Drawer
  private renderNotificationsModal(host: Element) {
    host.innerHTML = `
      <div class="hyper-modal-backdrop" id="modalBackdrop">
        <div class="hyper-drawer">
          <div class="drawer-header">
            <div class="drawer-title">
              <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">notifications</span>
              <span>Notification Centre</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="nav-btn" id="btnClearNotifs" style="padding: 4px 10px; font-size: 11px;">Clear All</button>
              <button class="close-btn" id="btnCloseModal">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div style="font-size: 12px; color: var(--hyper-text-muted);">
            Listening via Android <code>NotificationListenerService</code>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;" id="notifList">
            ${this.notifications.map(n => `
              <div class="notif-card" data-id="${n.id}" style="
                background: rgba(30, 41, 59, 0.45); backdrop-filter: blur(25px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; padding: 14px;
                display: flex; flex-direction: column; gap: 6px;
              ">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(0, 242, 254, 0.2); display: flex; align-items: center; justify-content: center;">
                      <span class="material-symbols-outlined" style="font-size: 14px; color: var(--hyper-cyan);">${n.icon}</span>
                    </div>
                    <span style="font-size: 13px; font-weight: 700; color: #fff;">${n.title}</span>
                  </div>
                  <span style="font-size: 11px; color: var(--hyper-text-muted);">${n.time}</span>
                </div>
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.3;">
                  ${n.text}
                </div>
                ${n.hasActions ? `
                  <div style="display: flex; gap: 8px; margin-top: 6px;">
                    <button class="nav-btn" style="flex: 1; justify-content: center; padding: 6px; font-size: 12px;">Decline</button>
                    <button class="nav-btn primary" style="flex: 1; justify-content: center; padding: 6px; font-size: 12px;">Accept</button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));
    host.querySelector('#btnClearNotifs')?.addEventListener('click', () => {
      this.notifications = [];
      this.renderNotificationsModal(host);
    });
  }

  // 3. Installed App Launcher Modal
  private renderAppsModal(host: Element) {
    const apps = [
      { name: 'Phone', icon: 'call', color: '#10b981' },
      { name: 'WhatsApp', icon: 'chat', color: '#22c55e' },
      { name: 'Camera', icon: 'photo_camera', color: '#38bdf8' },
      { name: 'Gallery', icon: 'photo_library', color: '#ec4899' },
      { name: 'Settings', icon: 'settings', color: '#94a3b8' },
      { name: 'Telegram', icon: 'send', color: '#0ea5e9' },
      { name: 'Instagram', icon: 'camera_alt', color: '#f43f5e' },
      { name: 'Chrome', icon: 'public', color: '#f59e0b' },
      { name: 'Maps', icon: 'map', color: '#3b82f6' },
      { name: 'Notes', icon: 'edit_note', color: '#eab308' },
      { name: 'Calculator', icon: 'calculate', color: '#8b5cf6' },
      { name: 'Security', icon: 'shield', color: '#06b6d4' }
    ];

    host.innerHTML = `
      <div class="hyper-modal-backdrop" id="modalBackdrop">
        <div class="hyper-drawer">
          <div class="drawer-header">
            <div class="drawer-title">
              <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">apps</span>
              <span>Installed Apps (Launcher)</span>
            </div>
            <button class="close-btn" id="btnCloseModal"><span class="material-symbols-outlined">close</span></button>
          </div>

          <div style="position: relative;">
            <input type="text" placeholder="Search installed apps..." id="appSearchInput" style="
              width: 100%; padding: 10px 14px 10px 40px; border-radius: 14px;
              background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12);
              color: #fff; font-size: 13px; outline: none;
            " />
            <span class="material-symbols-outlined" style="position: absolute; left: 12px; top: 10px; font-size: 18px; color: var(--hyper-text-muted);">search</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 10px;" id="appsGrid">
            ${apps.map(app => `
              <div class="app-item" data-app="${app.name}" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;">
                <div style="width: 52px; height: 52px; border-radius: 16px; background: ${app.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                  <span class="material-symbols-outlined" style="color: #fff; font-size: 26px;">${app.icon}</span>
                </div>
                <span style="font-size: 11px; color: #fff; font-weight: 500;">${app.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));
    host.querySelectorAll('.app-item').forEach(item => {
      item.addEventListener('click', () => {
        const appName = (item as HTMLElement).dataset.app;
        jarvisAudio.playJarvisChime();
        jarvisAudio.speak(`Launching ${appName}, Sir.`, this.state.activeLanguage);
        alert(`[Android PackageManager]\nLaunching ${appName} using Intent.ACTION_MAIN.`);
        this.openModal('none');
      });
    });
  }

  // 4. Camera Viewfinder & AI Photo Editing Entry Point
  private async renderCameraModal(host: Element) {
    host.innerHTML = `
      <div class="hyper-modal-backdrop" id="modalBackdrop">
        <div class="hyper-drawer" style="max-height: 90%;">
          <div class="drawer-header">
            <div class="drawer-title">
              <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">photo_camera</span>
              <span>Camera & AI Photo Studio</span>
            </div>
            <button class="close-btn" id="btnCloseModal"><span class="material-symbols-outlined">close</span></button>
          </div>

          <!-- Video Viewfinder -->
          <div style="position: relative; width: 100%; height: 260px; border-radius: 18px; overflow: hidden; background: #000; border: 1px solid rgba(0, 242, 254, 0.3);">
            <video id="cameraVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
            <div style="position: absolute; inset: 0; pointer-events: none; border: 2px dashed rgba(0, 242, 254, 0.4); border-radius: 18px;"></div>
            <div style="position: absolute; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.6); padding: 4px 8px; border-radius: 8px; font-size: 11px; color: var(--hyper-cyan);">
              4K 60FPS • AI ENHANCED
            </div>
          </div>

          <!-- Controls: Capture, Pick from Gallery, AI Modes -->
          <div style="display: flex; justify-content: space-around; align-items: center; padding: 6px 0;">
            <label class="nav-btn" style="cursor: pointer;">
              <span class="material-symbols-outlined">photo_library</span>
              <span>Pick Photo</span>
              <input type="file" accept="image/*" id="galleryFileInput" style="display: none;" />
            </label>
            <button class="nav-btn primary" id="btnSnapPhoto" style="width: 56px; height: 56px; border-radius: 50%; padding: 0; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 28px;">camera</span>
            </button>
            <button class="nav-btn" id="btnSwitchLens">
              <span class="material-symbols-outlined">flip_camera_android</span>
              <span>Flip</span>
            </button>
          </div>

          <!-- AI Photo Editing Entry Point (Requirement 7) -->
          <div style="background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 16px; padding: 12px;">
            <div style="font-size: 13px; font-weight: 700; color: var(--hyper-cyan); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">auto_awesome</span>
              <span>AI Photo Enhancement Tools</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="nav-btn" id="btnAiSuperRes" style="padding: 6px 8px; font-size: 11px; justify-content: center;">Super Res</button>
              <button class="nav-btn" id="btnAiNight" style="padding: 6px 8px; font-size: 11px; justify-content: center;">Night Vision</button>
              <button class="nav-btn" id="btnAiHolo" style="padding: 6px 8px; font-size: 11px; justify-content: center;">Holo Filter</button>
            </div>
          </div>

        </div>
      </div>
    `;

    host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));

    // Try starting webcam feed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.activeCameraStream = stream;
      const video = host.querySelector('#cameraVideo') as HTMLVideoElement;
      if (video) video.srcObject = stream;
    } catch {
      console.warn('Webcam permission not granted or available; fallback HUD active');
    }

    host.querySelector('#btnSnapPhoto')?.addEventListener('click', () => {
      jarvisAudio.playJarvisChime();
      alert('Snapshot captured! Processing with JARVIS Neural Upscaler.');
    });

    host.querySelector('#btnAiSuperRes')?.addEventListener('click', () => {
      alert('AI Super Resolution applied: Texture clarity increased by 400%.');
    });
    host.querySelector('#btnAiNight')?.addEventListener('click', () => {
      alert('AI Night Vision HDR activated.');
    });
    host.querySelector('#btnAiHolo')?.addEventListener('click', () => {
      alert('Holographic HUD filter overlay rendered.');
    });
  }

  // 5. System Information Modal (Requirement 8)
  private renderSystemModal(host: Element) {
    host.innerHTML = `
      <div class="hyper-modal-backdrop" id="modalBackdrop">
        <div class="hyper-drawer" style="max-height: 90%;">
          <div class="drawer-header">
            <div class="drawer-title">
              <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">memory</span>
              <span>Device & System Telemetry</span>
            </div>
            <button class="close-btn" id="btnCloseModal"><span class="material-symbols-outlined">close</span></button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <!-- Recharts Battery Drain Line Chart Card -->
            <div class="notif-card" style="background: rgba(15, 23, 42, 0.7); padding: 14px; border-radius: 20px; border: 1px solid rgba(0, 242, 254, 0.28); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div>
                  <div style="font-size: 11px; color: var(--hyper-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">24-HOUR BATTERY DRAIN TRENDS</div>
                  <div style="font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <span class="material-symbols-outlined" style="font-size: 18px; color: var(--hyper-cyan);">show_chart</span>
                    <span>Recharts Consumption Curve</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 12px; color: #10b981; font-weight: 700;">88% Current</span>
                  <div style="font-size: 10px; color: var(--hyper-text-muted);">Avg. -2.8%/hr</div>
                </div>
              </div>

              <!-- Recharts React Mount Target -->
              <div id="rechartsBatteryContainer" style="width: 100%; min-height: 200px; margin: 4px 0;"></div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                <div style="text-align: center; background: rgba(255, 255, 255, 0.04); padding: 6px; border-radius: 8px;">
                  <div style="color: var(--hyper-text-muted); font-size: 10px;">SCREEN ON</div>
                  <div style="font-weight: 700; color: #fff;">6h 42m</div>
                </div>
                <div style="text-align: center; background: rgba(255, 255, 255, 0.04); padding: 6px; border-radius: 8px;">
                  <div style="color: var(--hyper-text-muted); font-size: 10px;">HYPERCHARGE</div>
                  <div style="font-weight: 700; color: #10b981;">120W Spike</div>
                </div>
                <div style="text-align: center; background: rgba(255, 255, 255, 0.04); padding: 6px; border-radius: 8px;">
                  <div style="color: var(--hyper-text-muted); font-size: 10px;">BATTERY HEALTH</div>
                  <div style="font-weight: 700; color: var(--hyper-cyan);">100%</div>
                </div>
              </div>
            </div>

            <!-- Firebase Firestore Realtime Status & Voice Logs Card -->
            <div class="notif-card" style="background: rgba(15, 23, 42, 0.7); padding: 14px; border-radius: 20px; border: 1px solid rgba(255, 179, 0, 0.35); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="color: #ffb300; font-size: 20px;">local_fire_department</span>
                  <span style="font-size: 14px; font-weight: 700; color: #fff;">Firebase Firestore Database</span>
                </div>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(34, 197, 94, 0.2); color: #22c55e; font-weight: 700;">● Online</span>
              </div>
              <div style="font-size: 11px; color: var(--hyper-text-muted); margin-bottom: 8px;">
                Project: <code>googly-dogfish-qbcxw</code> • Region: <code>asia-southeast1</code>
              </div>

              <div style="font-size: 11px; font-weight: 700; color: var(--hyper-cyan); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
                Recent Synced Voice Interactions (/voice_logs)
              </div>
              <div id="firebaseVoiceLogsList" style="display: flex; flex-direction: column; gap: 6px; max-height: 130px; overflow-y: auto;">
                <div style="font-size: 11px; color: var(--hyper-text-muted); text-align: center; padding: 8px;">
                  Connecting to Firestore realtime stream...
                </div>
              </div>
            </div>

            <!-- Device Specs -->
            <div class="notif-card" style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--hyper-text-muted);">DEVICE MODEL</div>
              <div style="font-size: 16px; font-weight: 700; color: #fff;">Xiaomi 15 Pro (Stark Edition)</div>
            </div>
            <div class="notif-card" style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--hyper-text-muted);">OS & PLATFORM</div>
              <div style="font-size: 16px; font-weight: 700; color: var(--hyper-cyan);">Xiaomi HyperOS 4.0 (Android 16 - API 35)</div>
            </div>
            <div class="notif-card" style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--hyper-text-muted);">BATTERY HEALTH & CHARGING</div>
              <div style="font-size: 16px; font-weight: 700; color: #10b981;">88% • Fast Charging (120W HyperCharge)</div>
            </div>
            <div class="notif-card" style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--hyper-text-muted);">STORAGE STATUS</div>
              <div style="font-size: 16px; font-weight: 700; color: #fff;">382 GB Available / 512 GB Total</div>
            </div>
            <div class="notif-card" style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--hyper-text-muted);">NETWORK SPEED</div>
              <div style="font-size: 16px; font-weight: 700; color: #38bdf8;">TRZ 5G Connected • 28.6 MB/s Down</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mount Recharts line chart component
    const rechartsContainer = host.querySelector('#rechartsBatteryContainer') as HTMLElement;
    if (rechartsContainer) {
      mountBatteryChart(rechartsContainer);
    }

    // Subscribe to Firestore live voice logs
    const unsubLogs = subscribeToRecentVoiceLogs((logs) => {
      const listEl = host.querySelector('#firebaseVoiceLogsList');
      if (listEl) {
        if (logs.length === 0) {
          listEl.innerHTML = '<div style="font-size: 11px; color: var(--hyper-text-muted); text-align: center; padding: 6px;">No voice logs yet. Tap the orb or say "Hey Zoya"!</div>';
          return;
        }
        listEl.innerHTML = logs.map(l => `
          <div style="background: rgba(255, 255, 255, 0.05); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--hyper-text-muted);">
              <span style="color: var(--hyper-cyan); font-weight: 600;">"${l.command}"</span>
              <span>${l.language.toUpperCase()} • ${new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div style="font-size: 11px; color: #e2e8f0; margin-top: 2px;">
              ${l.response}
            </div>
          </div>
        `).join('');
      }
    });

    host.querySelector('#btnCloseModal')?.addEventListener('click', () => {
      unsubLogs();
      unmountBatteryChart();
      this.openModal('none');
    });
  }

  // 6. Complete Android Studio Project Code Explorer & ZIP Download (Requirement 12)
  private renderCodeModal(host: Element) {
    const renderExplorer = () => {
      host.innerHTML = `
        <div class="code-modal-backdrop" id="codeBackdrop">
          <div class="code-modal-window">
            
            <!-- Code Modal Header -->
            <div class="code-modal-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">developer_mode</span>
                <span style="font-weight: 700; font-size: 16px; color: #fff;">Android Studio Project: JARVIS AI Control Centre</span>
                <span class="brand-tag">Jetpack Compose</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="nav-btn primary" id="btnDownloadZip">
                  <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
                  <span>Download Project ZIP</span>
                </button>
                <button class="nav-btn" id="btnCopyCode">
                  <span class="material-symbols-outlined" style="font-size: 18px;">content_copy</span>
                  <span>Copy File</span>
                </button>
                <button class="close-btn" id="btnCloseCodeModal">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <!-- Code Modal Body -->
            <div class="code-modal-body">
              
              <!-- Left Project File Tree -->
              <div class="code-sidebar">
                <div style="font-size: 11px; font-weight: 700; color: var(--hyper-cyan); text-transform: uppercase; padding: 6px 8px;">
                  Project Files (${ANDROID_PROJECT_FILES.length})
                </div>
                ${ANDROID_PROJECT_FILES.map(file => `
                  <div class="code-file-item ${file.path === this.selectedCodeFile.path ? 'active' : ''}" data-path="${file.path}">
                    <span class="material-symbols-outlined" style="font-size: 16px;">
                      ${file.category === 'Compose' || file.category === 'Kotlin' ? 'code' : (file.category === 'Manifest' ? 'description' : 'settings')}
                    </span>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Right Code Viewer -->
              <div class="code-editor-pane">
                <div class="code-editor-header">
                  <span>${this.selectedCodeFile.path}</span>
                  <span style="color: var(--hyper-cyan);">${this.selectedCodeFile.category}</span>
                </div>
                <pre class="code-pre"><code>${this.escapeHtml(this.selectedCodeFile.content)}</code></pre>
              </div>

            </div>

          </div>
        </div>
      `;

      host.querySelector('#btnCloseCodeModal')?.addEventListener('click', () => this.openModal('none'));

      host.querySelectorAll('.code-file-item').forEach(item => {
        item.addEventListener('click', () => {
          const path = (item as HTMLElement).dataset.path;
          const found = ANDROID_PROJECT_FILES.find(f => f.path === path);
          if (found) {
            this.selectedCodeFile = found;
            jarvisAudio.playClick();
            renderExplorer();
          }
        });
      });

      host.querySelector('#btnCopyCode')?.addEventListener('click', () => {
        navigator.clipboard.writeText(this.selectedCodeFile.content);
        alert(`Copied ${this.selectedCodeFile.name} to clipboard!`);
      });

      host.querySelector('#btnDownloadZip')?.addEventListener('click', () => {
        this.downloadProjectAsZip();
      });
    };

    renderExplorer();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async downloadProjectAsZip() {
    try {
      const zip = new JSZip();
      ANDROID_PROJECT_FILES.forEach(file => {
        zip.file(file.path, file.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'JARVIS_AI_HyperOS_Android_Project.zip';
      link.click();
      jarvisAudio.playJarvisChime();
    } catch (e) {
      alert('Failed to generate ZIP: ' + String(e));
    }
  }

  // 7. Fusion Device Center Modal (Screenshot 1: 融合设备中心)
  private renderDevicesModal(host: Element) {
    let carAcOn = true;
    let carLocked = true;
    let budMode: 'anc' | 'trans' | 'off' = 'anc';
    let livingRoomAcOn = true;

    const render = () => {
      host.innerHTML = `
        <div class="hyper-modal-backdrop" id="modalBackdrop">
          <div class="hyper-drawer" style="max-width: 440px;">
            <div class="drawer-header">
              <div class="drawer-title">
                <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">hub</span>
                <div>
                  <div style="font-size: 16px; font-weight: 700; color: #fff;">融合设备中心</div>
                  <div style="font-size: 11px; color: var(--hyper-text-muted);">Connected Devices • HyperOS Link</div>
                </div>
              </div>
              <button class="close-btn" id="btnCloseModal">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="device-center-grid">
              <!-- Xiaomi SU7 Hero Card (Screenshot 1) -->
              <div class="device-card hero">
                <div class="device-header">
                  <div class="device-icon-box" style="background: rgba(0, 242, 254, 0.15);">
                    <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">directions_car</span>
                  </div>
                  <span class="device-status-badge">74% Battery • Connected</span>
                </div>
                <div>
                  <div class="device-name">Xiaomi SU7 Ultra</div>
                  <div class="device-meta">Range: 560 km • Status: ${carLocked ? 'Secured' : 'Unlocked'} • Sentry Armed</div>
                </div>
                <div class="device-actions-row">
                  <button class="device-btn ${carAcOn ? 'active' : ''}" id="btnCarAc">
                    <span class="material-symbols-outlined" style="font-size: 14px;">ac_unit</span>
                    <span>${carAcOn ? 'AC 22°C (On)' : 'AC Off'}</span>
                  </button>
                  <button class="device-btn ${carLocked ? '' : 'active'}" id="btnCarLock">
                    <span class="material-symbols-outlined" style="font-size: 14px;">${carLocked ? 'lock' : 'lock_open'}</span>
                    <span>${carLocked ? 'Locked' : 'Unlocked'}</span>
                  </button>
                  <button class="device-btn" id="btnCarFlash">
                    <span class="material-symbols-outlined" style="font-size: 14px;">flare</span>
                    <span>Flash</span>
                  </button>
                </div>
              </div>

              <!-- Xiaomi Buds 4 Pro Card -->
              <div class="device-card">
                <div class="device-header">
                  <div class="device-icon-box">
                    <span class="material-symbols-outlined">headphones</span>
                  </div>
                  <span class="device-status-badge">Connected</span>
                </div>
                <div>
                  <div class="device-name">Xiaomi Buds 4 Pro</div>
                  <div class="device-meta">L: 92% | R: 88% | Case: 100%</div>
                </div>
                <div class="device-actions-row">
                  <button class="device-btn ${budMode === 'anc' ? 'active' : ''}" id="btnBudAnc" title="Noise Cancellation">
                    <span>ANC</span>
                  </button>
                  <button class="device-btn ${budMode === 'trans' ? 'active' : ''}" id="btnBudTrans" title="Transparency Mode">
                    <span>Trans</span>
                  </button>
                </div>
              </div>

              <!-- Xiaomi Pad 6 Card -->
              <div class="device-card">
                <div class="device-header">
                  <div class="device-icon-box">
                    <span class="material-symbols-outlined">tablet_android</span>
                  </div>
                  <span class="device-status-badge">Mirrored</span>
                </div>
                <div>
                  <div class="device-name">Xiaomi Pad 6 Max</div>
                  <div class="device-meta">Cross-screen streaming active</div>
                </div>
                <div class="device-actions-row">
                  <button class="device-btn active" id="btnPadShare">
                    <span class="material-symbols-outlined" style="font-size: 14px;">cast</span>
                    <span>Shared</span>
                  </button>
                </div>
              </div>

              <!-- Xiaomi Watch S Card -->
              <div class="device-card">
                <div class="device-header">
                  <div class="device-icon-box">
                    <span class="material-symbols-outlined">watch</span>
                  </div>
                  <span class="device-status-badge">68% Batt</span>
                </div>
                <div>
                  <div class="device-name">Xiaomi Watch S3</div>
                  <div class="device-meta">72 bpm • 8,420 steps</div>
                </div>
                <div class="device-actions-row">
                  <button class="device-btn" id="btnSyncVitals">
                    <span class="material-symbols-outlined" style="font-size: 14px;">sync</span>
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              <!-- Living Room Smart AC -->
              <div class="device-card">
                <div class="device-header">
                  <div class="device-icon-box">
                    <span class="material-symbols-outlined">air</span>
                  </div>
                  <span class="device-status-badge ${livingRoomAcOn ? '' : 'off'}">${livingRoomAcOn ? '24°C Cool' : 'Off'}</span>
                </div>
                <div>
                  <div class="device-name">Living Room AC</div>
                  <div class="device-meta">Smart Inverter • Auto Fan</div>
                </div>
                <div class="device-actions-row">
                  <button class="device-btn ${livingRoomAcOn ? 'active' : ''}" id="btnLivingAc">
                    <span class="material-symbols-outlined" style="font-size: 14px;">power_settings_new</span>
                    <span>${livingRoomAcOn ? 'Power Off' : 'Turn On'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));
      host.querySelector('#modalBackdrop')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'modalBackdrop') this.openModal('none');
      });

      host.querySelector('#btnCarAc')?.addEventListener('click', () => {
        carAcOn = !carAcOn;
        jarvisAudio.playToggle(carAcOn);
        render();
      });

      host.querySelector('#btnCarLock')?.addEventListener('click', () => {
        carLocked = !carLocked;
        jarvisAudio.playToggle(carLocked);
        render();
      });

      host.querySelector('#btnCarFlash')?.addEventListener('click', () => {
        jarvisAudio.playJarvisChime();
        alert('Car flashlights signaled with acoustic confirmation!');
      });

      host.querySelector('#btnBudAnc')?.addEventListener('click', () => {
        budMode = 'anc';
        jarvisAudio.playClick();
        render();
      });

      host.querySelector('#btnBudTrans')?.addEventListener('click', () => {
        budMode = 'trans';
        jarvisAudio.playClick();
        render();
      });

      host.querySelector('#btnLivingAc')?.addEventListener('click', () => {
        livingRoomAcOn = !livingRoomAcOn;
        jarvisAudio.playToggle(livingRoomAcOn);
        render();
      });

      host.querySelector('#btnSyncVitals')?.addEventListener('click', () => {
        jarvisAudio.playJarvisChime();
        alert('Vitals synchronized: Heart rate 72 bpm, 8,420 steps.');
      });
    };

    render();
  }

  // 8. Liquid Glass Settings Modal (Screenshot 2: Liquid Glass Clear vs Tinted)
  private renderGlassSettingsModal(host: Element) {
    const render = () => {
      host.innerHTML = `
        <div class="hyper-modal-backdrop" id="modalBackdrop">
          <div class="hyper-drawer" style="max-width: 440px;">
            <div class="drawer-header">
              <div class="drawer-title">
                <span class="material-symbols-outlined" style="color: var(--hyper-cyan);">blur_on</span>
                <div>
                  <div style="font-size: 16px; font-weight: 700; color: #fff;">Liquid Glass</div>
                  <div style="font-size: 11px; color: var(--hyper-text-muted);">Visual Transparency & Contrast</div>
                </div>
              </div>
              <button class="close-btn" id="btnCloseModal">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Visual Preview Card (Screenshot 2) -->
            <div style="
              height: 140px; border-radius: 20px; overflow: hidden; position: relative; margin-bottom: 16px;
              background: linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 60%, #0284c7 100%);
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            ">
              <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.25), transparent 70%);"></div>
              
              <!-- Floating Pill Preview -->
              <div style="
                background: ${this.liquidGlassStyle === 'clear' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.75)'};
                backdrop-filter: blur(28px);
                border: 1px solid rgba(255, 255, 255, ${this.liquidGlassStyle === 'clear' ? '0.4' : '0.25'});
                border-radius: 999px; padding: 10px 24px; display: flex; align-items: center; gap: 24px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
              ">
                <span class="material-symbols-outlined" style="color: #fff; font-size: 22px;">delete</span>
                <span class="material-symbols-outlined" style="color: #fff; font-size: 22px;">folder</span>
                <span class="material-symbols-outlined" style="color: #fff; font-size: 22px;">reply</span>
              </div>
            </div>

            <!-- Radio Options List -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <!-- Option: Clear -->
              <div class="glass-option-item" id="optGlassClear" style="
                padding: 14px 16px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between;
                background: ${this.liquidGlassStyle === 'clear' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.05)'};
                border: 1px solid ${this.liquidGlassStyle === 'clear' ? 'var(--hyper-cyan)' : 'rgba(255, 255, 255, 0.1)'};
                cursor: pointer; transition: all 0.2s;
              ">
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #fff;">Clear</div>
                  <div style="font-size: 12px; color: var(--hyper-text-muted); margin-top: 2px;">
                    More transparent, revealing the wallpaper content beneath.
                  </div>
                </div>
                ${this.liquidGlassStyle === 'clear' ? `
                  <span class="material-symbols-outlined" style="color: var(--hyper-cyan); font-weight: 700;">check</span>
                ` : ''}
              </div>

              <!-- Option: Tinted -->
              <div class="glass-option-item" id="optGlassTinted" style="
                padding: 14px 16px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between;
                background: ${this.liquidGlassStyle === 'tinted' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.05)'};
                border: 1px solid ${this.liquidGlassStyle === 'tinted' ? 'var(--hyper-cyan)' : 'rgba(255, 255, 255, 0.1)'};
                cursor: pointer; transition: all 0.2s;
              ">
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #fff;">Tinted</div>
                  <div style="font-size: 12px; color: var(--hyper-text-muted); margin-top: 2px;">
                    Increases opacity and adds more contrast for maximum readability.
                  </div>
                </div>
                ${this.liquidGlassStyle === 'tinted' ? `
                  <span class="material-symbols-outlined" style="color: var(--hyper-cyan); font-weight: 700;">check</span>
                ` : ''}
              </div>
            </div>

            <div style="margin-top: 14px; font-size: 11px; color: var(--hyper-text-muted); line-height: 1.4;">
              Choose your preferred look for Liquid Glass. Your preference is automatically synchronized with Firebase Cloud Firestore.
            </div>
          </div>
        </div>
      `;

      host.querySelector('#btnCloseModal')?.addEventListener('click', () => this.openModal('none'));
      host.querySelector('#modalBackdrop')?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'modalBackdrop') this.openModal('none');
      });

      host.querySelector('#optGlassClear')?.addEventListener('click', () => {
        this.setGlassStyle('clear');
        render();
      });

      host.querySelector('#optGlassTinted')?.addEventListener('click', () => {
        this.setGlassStyle('tinted');
        render();
      });
    };

    render();
  }
}
