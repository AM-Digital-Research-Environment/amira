/* eslint-disable no-console */
// Computes the transitive closure of static imports for the home page entry
// and reports the total uncompressed bytes pulled in. Intended for ad-hoc
// bundle inspection — run with `node scripts/measure-home-page.mjs`.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, basename, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(
	new URL('../.svelte-kit/output/client/_app/immutable/', import.meta.url)
);
const nodesDir = pathResolve(root, 'nodes');

const homePage = readdirSync(nodesDir).find((f) => f.startsWith('2.') && f.endsWith('.js'));
if (!homePage) throw new Error('home page node not found');

const importRegex = /from\s*["'](\.\.?\/[^"']+\.js)["']/g;
const visited = new Set();
const queue = [join(nodesDir, homePage)];

let total = 0;
const list = [];
while (queue.length) {
	const file = queue.shift();
	if (visited.has(file)) continue;
	visited.add(file);
	let content;
	try {
		content = readFileSync(file, 'utf8');
	} catch {
		continue;
	}
	const size = statSync(file).size;
	total += size;
	list.push({ file: basename(file), size });
	const fileDir =
		file.substring(0, file.lastIndexOf('/')) || file.substring(0, file.lastIndexOf('\\'));
	let m;
	while ((m = importRegex.exec(content)) !== null) {
		queue.push(pathResolve(fileDir, m[1]));
	}
}

list.sort((a, b) => b.size - a.size);
for (const { file, size } of list) {
	console.log(`${(size / 1024).toFixed(1).padStart(8)} KiB  ${file}`);
}
console.log('---');
console.log(`Total: ${(total / 1024).toFixed(1)} KiB across ${list.length} files`);
