// Copyright (c) 2026 lenhonbp <lenhonbp@gmail.com> — https://github.com/lenhonbp/pixijs-skill-vfx
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import { documentationIssues, exportedNames } from './check-docs.mjs';

const exportsFrom = files => exportedNames('/kit/index.ts', file => {
  const source = files[file];
  if (source === undefined) throw new Error(`Missing fixture: ${file}`);
  return source;
});

test('resolves declarations, star exports, named/type aliases and local exports', () => {
  assert.deepEqual(exportsFrom({
    '/kit/index.ts': `export * from './base'; export { value as renamed, type Shape as Form } from './base';
      export type { Shape } from './base'; export { local as visible }; export * as nested from './base';`,
    '/kit/base.ts': `// export const fake = 1;
      export const value = 'export const fakeString = 0';
      export interface Shape {} export type Mode = 'a'; export class World {}
      export function run() {} export default 1;`,
  }), ['Form', 'Mode', 'Shape', 'World', 'nested', 'renamed', 'run', 'value', 'visible']);
});

test('empty modules and cyclic stars terminate and resolve transitively', () => {
  assert.deepEqual(exportsFrom({ '/kit/index.ts': '' }), []);
  assert.deepEqual(exportsFrom({
    '/kit/index.ts': `export * from './a'; export * from './b';`,
    '/kit/a.ts': `export * from './b'; export const a = 1;`,
    '/kit/b.ts': `export * from './a'; export const b = 2;`,
  }), ['a', 'b']);
});

test('collects multiple variable names without treating initializer commas as declarations', () => {
  assert.deepEqual(exportsFrom({
    '/kit/index.ts': `export const first = [1, 2], second: number = fn(1, 2), third = { a: 1, b: 2 };`,
  }), ['first', 'second', 'third']);
});

test('invalid re-exports, unsupported declarations and missing modules fail clearly', () => {
  assert.throws(() => exportsFrom({ '/kit/index.ts': `export { absent } from './base';`, '/kit/base.ts': '' }), /Missing re-export absent/);
  assert.throws(() => exportsFrom({ '/kit/index.ts': `export * from './absent';` }), /Missing fixture/);
  assert.throws(() => exportsFrom({ '/kit/index.ts': `export const { item } = source;` }), /Unsupported exported declaration/);
});

const fixture = () => ({ names: ['World'], api: '- `World` — world — source.',
  skill: '29 complete skills\n## Files\n- `kit/index.ts`\n- `tools/check-docs.mjs`\n',
  readme: '29 complete sample skills', files: ['kit/index.ts', 'tools/check-docs.mjs'],
  samples: Array.from({ length: 29 }, (_, i) => `    id: 'sample-${i}',`).join('\n') });

test('normal API, file-map and sample counts agree', () => {
  assert.deepEqual(documentationIssues(fixture()), { issues: [], sampleCount: 29 });
});

test('empty lists can agree, and omitted count claims fail', () => {
  const input = { names: [], files: [], api: '', skill: '0 samples\n## Files\nEmpty.\n', readme: '0 samples', samples: '' };
  assert.deepEqual(documentationIssues(input), { issues: [], sampleCount: 0 });
  assert.match(documentationIssues({ ...input, readme: '' }).issues.join('\n'), /README.md must state/);
});

test('reports every missing name/file and every inconsistent stated count', () => {
  const input = fixture();
  input.names.push('Missing');
  input.files.push('kit/new.ts', 'tools/new.mjs');
  input.skill = '28 skills\n## Files\n- `kit/index.ts`\n';
  input.readme = '30 sample skills';
  assert.deepEqual(documentationIssues(input).issues, [
    'API index missing export: Missing',
    'SKILL.md file map missing: tools/check-docs.mjs',
    'SKILL.md file map missing: kit/new.ts',
    'SKILL.md file map missing: tools/new.mjs',
    'README.md says "30 sample skills"; examples/skills.ts has 29 ids',
    'SKILL.md says "28 skills"; examples/skills.ts has 29 ids',
  ]);
  assert.match(documentationIssues({ ...input, skill: '29 skills' }).issues.join('\n'), /missing its ## Files map/);
});

test('ignores commented sample ids and incidental mentions outside the file map', () => {
  const input = fixture();
  input.samples += `\n// id: 'comment'\n/* id: 'block' */\nconst label = "id: 'string'";`;
  input.skill = '29 skills; `kit/index.ts`\n## Files\n- `tools/check-docs.mjs`\n';
  assert.deepEqual(documentationIssues(input).issues, ['SKILL.md file map missing: kit/index.ts']);
});
