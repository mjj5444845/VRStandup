import { builtinModules } from 'node:module';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SOURCE = /\.(?:[cm]?[jt]sx?)$/i;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const PRIVATE = new Set(['archive', 'local_assets', 'data', 'certs', 'raw', 'recordings', 'output', 'backups']);
const BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const FORMAL = ['core', 'xr', 'web', 'server', 'tools', 'participant', 'console'] as const;
type Layer = typeof FORMAL[number] | 'prototype' | 'page' | 'unknown';
export type Violation = { file: string; line: number; column: number; reason: string; dependency?: string };
export type BoundaryReport = { files: number; formalFiles: number; violations: Violation[] };
const ALLOWED: Record<typeof FORMAL[number], readonly Layer[]> = {
  core: ['core'], xr: ['xr', 'core'], web: ['web', 'core'],
  server: ['server', 'core'], tools: ['tools', 'core'],
  participant: ['participant', 'xr', 'web'], console: ['console', 'web', 'core'],
};
const PACKAGES: Record<Layer, readonly string[]> = {
  core: [], xr: ['three'], web: [], server: ['ws'], tools: [],
  participant: ['next', 'react', 'react-dom'], console: ['next', 'react', 'react-dom'],
  prototype: [], page: ['next', 'react', 'react-dom'], unknown: [],
};
function slash(value: string) { return value.split(path.sep).join('/'); }
function isFormal(layer: Layer): layer is typeof FORMAL[number] { return FORMAL.some((item) => item === layer); }
function layerOf(file: string): Layer {
  if (file.startsWith('study/spikes/') || file.startsWith('app/spike/')) return 'prototype';
  for (const name of ['core', 'xr', 'web', 'server', 'tools'] as const) if (file.startsWith(`study/${name}/`)) return name;
  if (file.startsWith('app/study/')) return 'participant';
  if (file.startsWith('app/lab/')) return 'console';
  if (file.startsWith('app/')) return 'page';
  return 'unknown';
}
function packageName(name: string) { return name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]; }

/** Inspect the syntax tree, including type-only references and re-exports. Comments are not dependencies. */
function references(source: ts.SourceFile) {
  const result: { node: ts.Node; value?: string }[] = [];
  const add = (node: ts.Node, expression: ts.Node | undefined) => {
    result.push({ node, value: expression && ts.isStringLiteralLike(expression) ? expression.text : undefined });
  };
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node, node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node, node.moduleReference.expression);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node, node.argument.literal);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      || (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'require' && node.expression.name.text === 'resolve'))) add(node, node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

/** Scan only current source roots; never traverse historical or private directories. */
export function checkBoundaries(directory: string): BoundaryReport {
  const root = realpathSync(directory);
  const violations: Violation[] = [];
  const files: string[] = [];
  let formalFiles = 0;
  const relative = (name: string) => slash(path.relative(root, name));
  const report = (file: string, reason: string, line = 1, column = 1, dependency?: string) => violations.push({ file, line, column, reason, dependency });
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) report(relative(name), '源码目录不能使用符号链接绕过模块归属。');
      else if (entry.isDirectory()) walk(name);
      else if (SOURCE.test(entry.name)) files.push(name);
    }
  }
  for (const sourceRoot of ['app', 'study']) {
    const dir = path.join(root, sourceRoot);
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) report(sourceRoot, '源码根目录不能是符号链接。');
    else walk(dir);
  }
  const configFile = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error) throw new Error(`无法读取 tsconfig.json：${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`);
  // Resolve aliases with the actual project settings, rather than a second hard-coded alias table.
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const invalidOptions = parsed.errors.filter((error) => error.code !== 18003);
  if (invalidOptions.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(invalidOptions, {
    getCanonicalFileName: (file) => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  const cache = ts.createModuleResolutionCache(root, (file) => file, parsed.options);
  for (const file of files) {
    const from = relative(file), layer = layerOf(from), isTest = TEST.test(from);
    if (isFormal(layer)) formalFiles++;
    if (layer === 'unknown') report(from, '此源码不属于已登记模块；先明确职责，再更新模块规则。');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const ref of references(source)) {
      const position = source.getLineAndCharacterOfPosition(ref.node.getStart(source));
      const fail = (reason: string) => report(from, reason, position.line + 1, position.character + 1, ref.value);
      if (ref.value === undefined) { fail('依赖名称必须是固定字符串，才能检查所属模块。'); continue; }
      const name = ref.value;
      const builtin = name.replace(/^node:/, '');
      if (BUILTINS.has(builtin) || name.startsWith('node:')) {
        if (!isTest && !['server', 'tools', 'prototype'].includes(layer)) fail(`${layer} 不能导入 Node.js 系统模块。`);
        continue;
      }
      const resolved = ts.resolveModuleName(name, file, parsed.options, ts.sys, cache).resolvedModule;
      let target = resolved?.resolvedFileName;
      // CSS is a page asset and is intentionally not resolved as a TypeScript module.
      if (!target && name.startsWith('.') && /\.css$/.test(name)) {
        const css = path.resolve(path.dirname(file), name);
        if (existsSync(css)) target = css;
      }
      if (target && !resolved?.isExternalLibraryImport) {
        target = realpathSync(target);
        const to = relative(target);
        if (to === '..' || to.startsWith('../') || path.isAbsolute(to)) { fail('不能导入项目外的本机文件。'); continue; }
        if (PRIVATE.has(to.split('/')[0])) { fail('不能导入旧归档、私密资料或本机输出。'); continue; }
        if (!isTest && TEST.test(to)) { fail('运行代码不能依赖测试文件。'); continue; }
        const targetLayer = layerOf(to);
        if (isFormal(layer)) {
          if (!ALLOWED[layer].includes(targetLayer)) fail(`${layer} 不能依赖 ${to}；允许层：${ALLOWED[layer].join('、')}。`);
        } else if (layer === 'page' && ['server', 'tools', 'unknown'].includes(targetLayer)
          && !(/^docs\/.*\.json$/.test(to))) fail(`普通网页不能依赖 ${to}。`);
        continue;
      }
      if (name.startsWith('.') || name.startsWith('@/') || path.isAbsolute(name)) { fail('本地依赖无法解析，请核对路径、别名和文件是否存在。'); continue; }
      if (layer !== 'prototype' && !PACKAGES[layer].includes(packageName(name))) fail(`${layer} 未允许使用外部包 ${packageName(name)}。`);
    }
    // Triple-slash references can introduce platform types without an import statement.
    for (const ref of [...source.referencedFiles, ...source.typeReferenceDirectives, ...source.libReferenceDirectives]) {
      const p = source.getLineAndCharacterOfPosition(ref.pos);
      report(from, '模块源码不能通过三斜线指令引入额外依赖；请使用可检查的导入。', p.line + 1, p.character + 1, ref.fileName);
    }
  }
  return { files: files.length, formalFiles, violations };
}
