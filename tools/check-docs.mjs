#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function tokens(source) {
  return [...source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g)]
    .map(([token]) => token).filter(token => !token.startsWith('//') && !token.startsWith('/*'));
}

export function exportedNames(entry, read = file => readFileSync(file, 'utf8')) {
  const modules = new Map();
  const visit = file => {
    if (modules.has(file)) return;
    const module = { names: new Set(), stars: [], named: [] };
    modules.set(file, module);
    const source = tokens(read(file));
    const dependency = specifier => {
      if (!specifier.startsWith('.')) throw new Error(`Non-local export in ${file}: ${specifier}`);
      const target = resolve(dirname(file), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`);
      visit(target);
      return target;
    };
    let depth = 0;
    for (let i = 0; i < source.length; i++) {
      const token = source[i];
      if (token === '{') depth++;
      if (token === '}') depth--;
      if (depth || token !== 'export') continue;
      let j = i + 1;
      if (source[j] === 'type' && ['*', '{'].includes(source[j + 1])) j++;
      if (source[j] === '*') {
        j++;
        let alias;
        if (source[j] === 'as') { alias = source[j + 1]; j += 2; }
        if (source[j] !== 'from') throw new Error(`Unsupported star export in ${file}`);
        const target = dependency(source[j + 1].slice(1, -1));
        if (alias) module.names.add(alias);
        else module.stars.push(target);
        i = j + 1;
      } else if (source[j] === '{') {
        const entries = [];
        j++;
        while (source[j] !== '}') {
          if (j >= source.length) throw new Error(`Unclosed export list in ${file}`);
          if (source[j] === ',') { j++; continue; }
          if (source[j] === 'type' && ![',', '}', 'as'].includes(source[j + 1])) j++;
          const name = source[j++];
          let alias = name;
          if (source[j] === 'as') { alias = source[j + 1]; j += 2; }
          entries.push({ name, alias });
        }
        j++;
        if (source[j] === 'from') {
          const target = dependency(source[j + 1].slice(1, -1));
          module.named.push(...entries.map(entry => ({ ...entry, target })));
          j += 2;
        } else for (const { alias } of entries) module.names.add(alias);
        i = j - 1;
      } else {
        while (['declare', 'async', 'abstract'].includes(source[j])) j++;
        if (source[j] === 'default') module.names.add('default');
        else if (['function', 'class', 'interface', 'type', 'enum', 'namespace', 'const', 'let', 'var'].includes(source[j])) {
          if (!/^[A-Za-z_$][\w$]*$/.test(source[j + 1] ?? '')) {
            throw new Error(`Unsupported exported declaration in ${file}`);
          }
          module.names.add(source[j + 1]);
          if (['const', 'let', 'var'].includes(source[j])) {
            let nesting = 0;
            for (let k = j + 2; k < source.length; k++) {
              if (['(', '[', '{'].includes(source[k])) nesting++;
              if ([')', ']', '}'].includes(source[k])) nesting--;
              if (!nesting && source[k] === ';') break;
              if (!nesting && source[k] === ',' && ['=', ':'].includes(source[k + 2])) {
                module.names.add(source[k + 1]);
              }
            }
          }
        } else throw new Error(`Unsupported export in ${file}: ${source[j]}`);
      }
    }
  };
  visit(resolve(entry));
  let changed;
  do {
    changed = false;
    for (const module of modules.values()) {
      const add = name => {
        if (!module.names.has(name)) { module.names.add(name); changed = true; }
      };
      for (const target of module.stars) {
        for (const name of modules.get(target).names) if (name !== 'default') add(name);
      }
      for (const { target, name, alias } of module.named) {
        if (modules.get(target).names.has(name)) add(alias);
      }
    }
  } while (changed);
  for (const [file, module] of modules) {
    for (const { target, name } of module.named) {
      if (!modules.get(target).names.has(name)) throw new Error(`Missing re-export ${name} from ${target} in ${file}`);
    }
  }
  return [...modules.get(resolve(entry)).names].sort();
}

export function documentationIssues({ names, api, skill, readme, samples, files }) {
  const issues = [];
  const publicApi = api.split(/^## Direct-module-only helpers/m)[0];
  const indexed = new Set([...publicApi.matchAll(/^- `([^`]+)` — /gm)].map(match => match[1]));
  for (const name of names) if (!indexed.has(name)) issues.push(`API index missing export: ${name}`);
  const map = (skill.match(/^## Files\s*\n([\s\S]*)/m)?.[1] ?? '').split(/^## /m)[0];
  const mapped = new Set([...map.matchAll(/`([^`]+)`/g)].map(match => match[1]));
  if (!map) issues.push('SKILL.md is missing its ## Files map');
  for (const file of files) if (!mapped.has(file)) issues.push(`SKILL.md file map missing: ${file}`);
  const sampleTokens = tokens(samples);
  const sampleCount = sampleTokens.filter((token, i) => token === 'id' && sampleTokens[i + 1] === ':' && /^['"]/.test(sampleTokens[i + 2] ?? '')).length;
  for (const [file, text] of [['README.md', readme], ['SKILL.md', skill]]) {
    const counts = [...text.matchAll(/\b(\d+)\s+(?:(?:complete|gameplay-agnostic|sample)\s+)*(?:skills|samples)\b/gi)];
    if (!counts.length) issues.push(`${file} must state the sample count`);
    for (const [claim, count] of counts) {
      if (Number(count) !== sampleCount) issues.push(`${file} says "${claim}"; examples/skills.ts has ${sampleCount} ids`);
    }
  }
  return { issues, sampleCount };
}

export function checkDocs(directory = root) {
  const read = file => readFileSync(resolve(directory, file), 'utf8');
  const names = exportedNames(resolve(directory, 'kit/index.ts'));
  const files = [
    ...readdirSync(resolve(directory, 'kit')).filter(file => file.endsWith('.ts')).map(file => `kit/${file}`),
    ...readdirSync(resolve(directory, 'tools'), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => `tools/${entry.name}`),
  ].sort();
  const result = documentationIssues({ names, files, api: read('references/api.md'), skill: read('SKILL.md'),
    readme: read('README.md'), samples: read('examples/skills.ts') });
  if (result.issues.length) throw new Error(result.issues.join('\n'));
  return `Documentation checks passed (${names.length} exports, ${files.length} mapped files, ${result.sampleCount} samples).`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(checkDocs()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
