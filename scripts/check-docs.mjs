#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const files = ['README.md', 'runtime/README.md', 'docs/pack-format.md', 'showcase/index.html', 'skills/lenhon-vfx/SKILL.md'];
for (const file of files) readFileSync(file);
const readme = readFileSync('README.md', 'utf8');
if (!/MIT/i.test(readme) || !/showcase/i.test(readme) || !/runtime/i.test(readme)) throw new Error('README must describe the MIT runtime and showcase');
const skill = readFileSync('skills/lenhon-vfx/SKILL.md', 'utf8');
if (!/^---\nname: lenhon-vfx\ndescription: .+\n/.test(skill)) throw new Error('Agent skill needs name and description frontmatter');
const ids = JSON.parse(readFileSync('showcase/public/packs/free/index.json', 'utf8')).map(p => p.id);
const listed = [...skill.matchAll(/^\| `([a-z-]+)` \|/gm)].map(m => m[1]);
if (listed.join() !== ids.join()) throw new Error('Agent skill pack table must list exactly the free collection, in index order');
console.log('Documentation checks passed (runtime README, pack format, showcase docs, agent skill catalog).');
