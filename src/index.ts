import * as xb from 'xrblocks';
import { HyperOSUIManager } from './uiRenderer';
import { HyperOSXRScene, SharedControlState } from './xrScene';

const sharedState: SharedControlState = {
  isWifiOn: true,
  isBluetoothOn: true,
  isMobileDataOn: true,
  isFlashlightOn: false,
  isMusicPlaying: false,
  brightness: 0.72,
  volume: 0.65,
  activeLanguage: 'en'
};

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    new HyperOSUIManager(appContainer, sharedState);
  }

  // Configure XR Blocks options for Spatial XR Mode & Desktop Simulator
  const options = new xb.Options();
  options.setAppTitle('JARVIS AI - HyperOS Control Centre');
  options.setAppDescription(
    'Futuristic JARVIS AI Control Centre inspired by Xiaomi HyperOS Liquid Glass with Quick Settings, Voice Assistant & Android Kotlin project.'
  );
  options.xrButton.showEnterSimulatorButton = true;

  // Add the 3D WebXR Spatial Scene
  const xrScene = new HyperOSXRScene(sharedState);
  xb.add(xrScene);

  await xb.init(options);
});
