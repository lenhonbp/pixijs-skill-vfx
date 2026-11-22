#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const files = ['README.md', 'runtime/README.md', 'docs/pack-format.md', 'showcase/index.html'];
for (const file of files) readFileSync(file);
const readme = readFileSync('README.md', 'utf8');
if (!/MIT/i.test(readme) || !/showcase/i.test(readme) || !/runtime/i.test(readme)) throw new Error('README must describe the MIT runtime and showcase');
console.log('Documentation checks passed (runtime README, pack format, showcase docs).');
