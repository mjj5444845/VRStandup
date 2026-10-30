import { fileURLToPath } from 'node:url';
import { checkBoundaries } from './check-boundaries';

try {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const report = checkBoundaries(root);
  for (const issue of report.violations) {
    console.error(`${issue.file}:${issue.line}:${issue.column} ${issue.reason}${issue.dependency ? ` [${issue.dependency}]` : ''}`);
  }
  console.log(`模块边界：检查 ${report.files} 个源码文件，其中 ${report.formalFiles} 个属于正式模块；发现 ${report.violations.length} 个问题。`);
  if (report.formalFiles === 0) console.log('正式模块尚未建立，不能据此宣称正式功能已完成。');
  process.exitCode = report.violations.length ? 1 : 0;
} catch (error) {
  console.error(`模块边界检查未完成：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
