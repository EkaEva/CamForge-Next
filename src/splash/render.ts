import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

async function render() {
  const entry = path.resolve(__dirname, 'index.ts');
  console.log('Bundling Remotion project...');

  const bundleLocation = await bundle({
    entryPoint: entry,
    publicDir: path.resolve(__dirname, '../../public'),
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'CamForgeSplash',
  });

  const output = path.resolve(__dirname, '../../public/splash.mp4');

  console.log('Rendering splash animation...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rProgress: ${(progress * 100).toFixed(1)}%`);
    },
  });

  console.log(`\nDone! Output: ${output}`);
}

render().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
