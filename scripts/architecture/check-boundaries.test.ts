import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkBoundaries } from './check-boundaries';

/** Real files exercise TypeScript path resolution, not a second mock resolver. */
function fixture(files: Record<string, string>, paths: Record<string, string[]> = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'punchcap-boundaries-'));
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, paths: { '@/*': ['./*'], ...paths } },
  }));
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  }
  return { root, check: () => checkBoundaries(root), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const dirs = { core: 'study/core', xr: 'study/xr', web: 'study/web', storage: 'study/storage', server: 'study/server', tools: 'study/tools', participant: 'app/study', console: 'app/lab' };

test('all declared layers allow their own code and only their documented neighbours', () => {
  const allowed = { core: ['core'], xr: ['xr', 'core'], web: ['web', 'core'], storage: ['storage', 'core'], server: ['server', 'storage', 'core'], tools: ['tools', 'storage', 'core'], participant: ['participant', 'xr', 'web'], console: ['console', 'web', 'core'] };
  for (const [from, fromDir] of Object.entries(dirs)) {
    for (const [to, toDir] of Object.entries(dirs)) {
      const f = fixture({ [`${fromDir}/consumer.ts`]: `import { value } from '@/${toDir}/value';`, [`${toDir}/value.ts`]: 'export const value = 1;' });
      try {
        const issues = f.check().violations;
        const permitted = allowed[from as keyof typeof allowed].includes(to);
        assert.equal(issues.length === 0, permitted, `${from} → ${to}: ${JSON.stringify(issues)}`);
      } finally { f.cleanup(); }
    }
  }
});

test('forbidden edges are found in static, side-effect, type, re-export, require and dynamic imports', () => {
  const forms = [
    "import { value } from '../xr/value';", "import '../xr/value';", "import type { value } from '../xr/value';",
    "export * from '../xr/value';", "export { value } from '../xr/value';", "type T = import('../xr/value').value;",
    "import x = require('../xr/value');", "const x = require('../xr/value');", "require.resolve('../xr/value');",
    "void import('../xr/value');", 'void import(`../xr/value`);',
  ];
  for (const code of forms) {
    const f = fixture({ 'study/core/consumer.ts': `// header\n${code}`, 'study/xr/value.ts': 'export const value = 1;' });
    try { const result = f.check(); assert.equal(result.violations.length, 1, code); assert.equal(result.violations[0].line, 2); }
    finally { f.cleanup(); }
  }
});

test('real project aliases, JavaScript extension mapping and barrel files cannot hide violations', () => {
  const f = fixture({
    'study/core/consumer.ts': "import { value } from '#shared';",
    'study/core/index.ts': "export { value } from '../xr/value.js';",
    'study/xr/value.ts': 'export const value = 1;',
    'app/study/view.tsx': "import '@/study/spikes/demo';",
    'study/spikes/demo.ts': 'export {};',
    'study/web/client.ts': "import { value } from '../core/index.js';",
  }, { '#shared': ['./study/core/index.ts'] });
  try {
    const result = f.check();
    assert.equal(result.violations.length, 2);
    assert.deepEqual(result.violations.map((item) => item.file).sort(), ['app/study/view.tsx', 'study/core/index.ts']);
  } finally { f.cleanup(); }
});

test('platform and package dependencies stay confined to their permitted modules', () => {
  const f = fixture({
    'study/core/rules.ts': "import { readFile } from 'node:fs/promises'; import { Group } from 'three';",
    'study/web/socket.ts': "import fs from 'fs'; import { Group } from 'three';",
    'study/xr/scene.ts': "import { Group } from 'three'; import 'three/addons/'; import fs from 'node:fs';",
    'study/server/session.ts': "import fs from 'node:fs'; import { WebSocket } from 'ws';",
    'study/tools/offline.ts': "import path from 'node:path';",
    'app/study/page.tsx': "import Link from 'next/link'; import { useState } from 'react'; import fs from 'node:fs';",
  });
  try {
    const result = f.check();
    assert.equal(result.violations.length, 6);
    assert.ok(!result.violations.some((issue) => issue.file.includes('session') || issue.file.includes('offline')));
  } finally { f.cleanup(); }
});

test('computed module names and triple-slash directives fail, comments and strings do not', () => {
  const f = fixture({
    'study/core/computed.ts': 'const name = "./rule"; void import(name); require(name);',
    'study/core/types.ts': '/// <reference types="node" />\n/// <reference lib="dom" />\nexport {};',
    'study/core/comments.ts': '// import "three";\nconst text = "import(unknown)"; export { text };',
  });
  try {
    const result = f.check(); assert.equal(result.violations.length, 4);
    assert.ok(!result.violations.some((issue) => issue.file.endsWith('comments.ts')));
  } finally { f.cleanup(); }
});

test('unknown modules, missing files, private imports and hidden tests are rejected', () => {
  const f = fixture({
    'study/forgotten/file.ts': 'export {};',
    'app/escape.ts': "import '../archive/old'; import '../local_assets/private'; import './missing';",
    'archive/old.ts': 'throw new Error("must not execute");',
    'local_assets/private.ts': 'throw new Error("must not execute");',
    'study/core/rules.test.ts': "import { test } from 'node:test'; import assert from 'node:assert/strict';",
    'study/core/rules.ts': "import './rules.test';",
  });
  try {
    const result = f.check(); assert.equal(result.files, 4); assert.equal(result.violations.length, 5);
    assert.ok(!result.violations.some((issue) => issue.file.endsWith('rules.test.ts')));
  } finally { f.cleanup(); }
});

test('page-local styles remain valid and source symlinks cannot change ownership', () => {
  const f = fixture({
    'app/study/page.tsx': "import './page.module.css';", 'app/study/page.module.css': 'body {}',
    'study/spikes/demo.ts': 'export {};',
  });
  try {
    assert.equal(f.check().violations.length, 0);
    // A file symlink works without Windows directory-junction semantics.
    try { symlinkSync(path.join(f.root, 'study/spikes/demo.ts'), path.join(f.root, 'app/study/hidden.ts'), 'file'); }
    catch (error) {
      // Windows may deny symlink creation without developer mode. Other failures must not be hidden.
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') return;
      throw error;
    }
    assert.equal(f.check().violations.length, 1);
  } finally { f.cleanup(); }
});

test('current repository sources actually pass the same checker', () => {
  const result = checkBoundaries(fileURLToPath(new URL('../../', import.meta.url)));
  assert.ok(result.files > 0); assert.ok(result.formalFiles >= 2);
  assert.deepEqual(result.violations, []);
});
