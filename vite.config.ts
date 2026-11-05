import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {
  getExtensionManifest,
  getExtensionBackgroundJs,
  getExtensionReadme
} from './src/utils/extensionGenerator';

function spidarManifestV3Plugin(): Plugin {
  return {
    name: 'spidar-manifest-v3-packager',
    apply: 'build',
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      // 1. Write Manifest V3 core configuration & service worker at the root of dist/
      fs.writeFileSync(path.join(distDir, 'manifest.json'), getExtensionManifest(), 'utf-8');
      fs.writeFileSync(path.join(distDir, 'background.js'), getExtensionBackgroundJs(), 'utf-8');
      fs.writeFileSync(path.join(distDir, 'README-INSTALL.txt'), getExtensionReadme(), 'utf-8');

      // 2. Bundle the shared React Content Script (src/contentScript.tsx) into dist/content.js
      await esbuild.build({
        entryPoints: [path.resolve(__dirname, 'src/contentScript.tsx')],
        bundle: true,
        format: 'iife',
        target: ['chrome110'],
        outfile: path.join(distDir, 'content.js'),
        jsx: 'automatic',
        minify: true,
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      });

      // 3. Copy the compiled Tailwind v4 stylesheet from dist/assets/*.css into dist/styles.css
      //    so the Shadow DOM content script (#spidar-v2-root) uses the exact same styles & animations
      const assetsDir = path.join(distDir, 'assets');
      let compiledCss = '';
      if (fs.existsSync(assetsDir)) {
        const cssFiles = fs
          .readdirSync(assetsDir)
          .filter((name) => name.endsWith('.css'));
        for (const cssFile of cssFiles) {
          compiledCss += fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8') + '\n';
        }
      }
      const shadowHostReset = `:host { all: initial; display: block; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f1f5f9; }\n:host *, :host *::before, :host *::after { box-sizing: border-box; }\n`;
      fs.writeFileSync(path.join(distDir, 'styles.css'), shadowHostReset + compiledCss, 'utf-8');

      // 4. Clone compiled React index.html into popup.html & options.html so the installed
      //    Chrome Extension and the AI Studio Preview render the exact same React components & logic
      const indexHtmlPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
        const popupHtml = indexHtml
          .replace(
            '</head>',
            '  <style>html, body { width: 370px; min-height: 500px; margin: 0; padding: 0; background: #090d15; overflow-x: hidden; }</style>\n  </head>'
          )
          .replace(/<body([^>]*)>/i, '<body$1 data-spidar-view="popup">');
        const optionsHtml = indexHtml.replace(
          /<body([^>]*)>/i,
          '<body$1 data-spidar-view="options" style="margin:0;background:#06090f;">'
        );
        fs.writeFileSync(path.join(distDir, 'popup.html'), popupHtml, 'utf-8');
        fs.writeFileSync(path.join(distDir, 'options.html'), optionsHtml, 'utf-8');
      }

      // 5. Build complete Load-Unpacked + Full Source ZIP at public/spidar-v2.7-complete-source.zip & dist/spidar-v2.7-complete-source.zip
      const zip = new JSZip();
      const addDirToZip = (dirPath: string, zipFolder: JSZip) => {
        const entries = fs.readdirSync(dirPath, {withFileTypes: true});
        for (const entry of entries) {
          if (entry.name === 'spidar-v2.7-complete-source.zip') continue;
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const sub = zipFolder.folder(entry.name);
            if (sub) addDirToZip(fullPath, sub);
          } else if (entry.isFile()) {
            zipFolder.file(entry.name, fs.readFileSync(fullPath));
          }
        }
      };

      // Include compiled extension & web app files at the root of the ZIP
      addDirToZip(distDir, zip);

      // Also include project source files so the ZIP serves as both the unpacked extension AND complete source archive
      const rootSourceFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'metadata.json',
        '.env.example',
        'server.ts'
      ];
      for (const rf of rootSourceFiles) {
        const full = path.resolve(__dirname, rf);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          zip.file(rf, fs.readFileSync(full));
        }
      }
      const devIndexFull = path.resolve(__dirname, 'index.html');
      if (fs.existsSync(devIndexFull)) {
        zip.file('index.dev.html', fs.readFileSync(devIndexFull));
      }
      const srcDir = path.resolve(__dirname, 'src');
      const srcFolder = zip.folder('src');
      if (fs.existsSync(srcDir) && srcFolder) {
        addDirToZip(srcDir, srcFolder);
      }

      const zipBuffer = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
      const publicZipPath = path.resolve(__dirname, 'public', 'spidar-v2.7-complete-source.zip');
      const distZipPath = path.join(distDir, 'spidar-v2.7-complete-source.zip');
      fs.writeFileSync(publicZipPath, zipBuffer);
      fs.writeFileSync(distZipPath, zipBuffer);
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), spidarManifestV3Plugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
