SPIDAR v2.7 - Cyber-Arachnid Web Analyzer & Second Brain Extension
====================================================================
Version: 2.7.0 (Manifest V3 — Unified React Architecture)

SHARED SINGLE-SOURCE-OF-TRUTH UI PARITY:
- Content Script (content.js + styles.css): Compiled from src/contentScript.tsx & Tailwind CSS, mounting the shared React <SpidarCompanionOverlay />, <SpiderSvg />, <IntelligenceCard />, <NeuralBrainGraph />, and <NeuralVaultModal /> inside a Shadow DOM container (#spidar-v2-root) on any webpage.
- Toolbar Popup (popup.html): Mounts the compiled React application in popup surface mode (<ExtensionPopupSurface />).
- Extension Options (options.html): Mounts the compiled React application in options surface mode (<ExtensionOptionsPanel />).

HOW TO INSTALL UNPACKED IN CHROME / BRAVE / EDGE:
1. Extract this ZIP archive to a local folder (manifest.json is at the root of this folder).
2. Open chrome://extensions and enable "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select the extracted folder directly.
