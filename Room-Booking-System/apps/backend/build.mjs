import { build } from 'esbuild';
import { mkdir, readdir, unlink } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
// Only remove generated files directly inside this package's fixed output directory.
for (const item of await readdir(output, { withFileTypes: true })) {
  if (item.isFile()) await unlink(new URL(item.name, output));
}
await build({
  entryPoints: ['src/main.ts', 'src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  splitting: true,
  sourcemap: true,
  tsconfig: 'tsconfig.json',
});
