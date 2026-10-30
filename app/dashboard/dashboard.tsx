'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EMPTY_FILTERS, filterTasks, KINDS, STATUS, summarize, type Catalog, type Filters, type Task, type TaskStatus } from './task-model';
import styles from './dashboard.module.css';

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M5 12h14m-5-5 5 5-5 5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}><span className={styles.statusDot} />{STATUS[status].label}</span>;
}
function TaskRow({ task, catalog }: { task: Task; catalog: Catalog }) {
  return (
    <article className={styles.task} id={`task-${task.id}`} aria-label={`${task.id} ${task.title}`}>
      <div className={styles.taskHeading}>
        <span className={styles.taskId}>{task.id}</span>
        <div><h4>{task.title}</h4><p className={styles.ownership}>{KINDS[task.kind]}<span>／</span>{task.stage}<span>·</span>{task.module}</p></div>
        <StatusBadge status={task.status} />
      </div>
      <dl className={styles.taskExplanation}>
        <div><dt>在系统中的作用</dt><dd>{task.purpose}</dd></div>
        <div><dt>完成后的意义</dt><dd>{task.outcome}</dd></div>
      </dl>
      <div className={styles.taskCurrent}><span>当前进展</span><p>{task.current}</p></div>
      <div className={styles.taskBottom}>
        <details className={styles.evidence}>
          <summary>完成标准与前置工作 <span aria-hidden="true">＋</span></summary>
          <div><p><strong>完成标准</strong>{task.acceptance}</p><p><strong>前置工作</strong>{task.dependencies.length ? task.dependencies.map((id) => { const parent = catalog.tasks.find((item) => item.id === id); return `${id} ${parent?.title ?? ''}`; }).join('；') : '可独立准备，无额外任务依赖。'}</p></div>
        </details>
        {task.route && task.route !== '/' && <Link className={styles.taskLink} href={task.route}>{task.status === 'reference' ? '查看参考页' : task.route === '/lab' || task.route === '/study' || task.route === '/checks' ? '打开项目页面' : task.status === 'planned' ? '查看占位页' : '打开检查页'}<Arrow diagonal /></Link>}
      </div>
    </article>
  );
}

export function Dashboard({ catalog }: { catalog: Catalog }) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['M0']));
  const totals = useMemo(() => summarize(catalog.tasks), [catalog]);
  const filtered = useMemo(() => filterTasks(catalog, filters), [catalog, filters]);
  const visibleStages = catalog.stages.filter((stage) => filtered.some((task) => task.stage === stage.id));
  const allExpanded = visibleStages.length > 0 && visibleStages.every((stage) => expanded.has(stage.id));
  const filteredBy = filters.stage !== 'all' || filters.status !== 'all' || filters.kind !== 'all' || filters.query.trim() !== '';
  function update(patch: Partial<Filters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    // Reveal matches after filtering so a result is never hidden inside a closed stage.
    setExpanded(new Set(catalog.stages.map((stage) => stage.id)));
  }
  function choose(patch: Partial<Filters>) {
    update(patch);
    document.getElementById('task-list')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function reset() { setFilters({ ...EMPTY_FILTERS }); setExpanded(new Set(['M0'])); }
  function toggle(id: string) {
    setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const cards = [
    { value: totals.mainline, label: '主线任务', note: `另保留 ${totals.reference} 项历史参考`, type: 'total' },
    { value: totals.complete, label: '已完成交付', note: '任务自身已交付，阶段仍单独验收', type: 'complete' },
    { value: totals.desktop, label: 'Mac 已验证', note: '其他平台与正式场景需分别验证', type: 'desktop' },
    { value: totals.pending, label: '待推进任务', note: `含 ${totals.confirm} 项待确认、${totals.paused} 项已暂缓`, type: 'pending' },
  ];

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#task-list">跳到任务清单</a>
      <aside className={styles.sidebar} aria-label="项目阶段">
        <Link href="/" className={styles.brand} aria-label="VR Standup 开发看板">
          <span className={styles.brandMark}><svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m14 3 10 6v11l-10 6-10-6V9l10-6Zm0 0v12m10-6-10 6L4 9m10 6v11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg></span>
          <span>VR Standup<small>PUNCHCAP · 开发工作台</small></span>
        </Link>
        <p className={styles.navLabel}>开发路线</p>
        <nav className={styles.stageNav} aria-label="按所属阶段筛选">
          <button aria-pressed={filters.stage === 'all'} onClick={() => choose({ stage: 'all' })}><span className={styles.allIcon} aria-hidden="true">▦</span><span>全部任务</span><small>{totals.total}</small></button>
          {catalog.stages.map((stage) => <button key={stage.id} aria-pressed={filters.stage === stage.id} onClick={() => choose({ stage: stage.id })}>
            <span className={styles.stageCode}>{stage.id === 'PREP' ? '起步' : stage.id === 'REF' ? '参考' : stage.id}</span><span>{stage.name}</span>
            <small>{catalog.tasks.filter((task) => task.stage === stage.id).length}</small>
          </button>)}
        </nav>
        <div className={styles.sidebarFoot}>
          <span className={styles.environmentLabel}>运行安排</span><p>Mac 开发<span>→</span>Windows 11 实验室</p><p className={styles.headsetNote}><span />Quest 3 · 连接调试已暂缓</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}><span className={styles.breadcrumb}>项目工作台 <span>/</span> 开发总览</span><div><Link className={styles.previewButton} href="/lab">项目工作台<Arrow diagonal /></Link><span className={styles.date}>状态截至 {catalog.updatedAt}</span><Link className={styles.previewButton} href="/spike/replay">打开回放检查<Arrow diagonal /></Link></div></header>
        <section className={styles.hero} aria-labelledby="dashboard-title">
          <p className={styles.eyebrow}>从技术验证，到完整实验</p>
          <h1 id="dashboard-title">开发进度看板<span className={styles.phaseTag}>当前阶段 M0</span></h1>
          <p className={styles.description}>每项任务归属于哪里、为什么要做、完成意味着什么，都在这里。<br className={styles.desktopBreak} />统计按任务条目计算，平台与设备验收分别标注。</p>
          <div className={styles.systemFlow} aria-label="系统主流程">
            {['演员预录动作与声音', '三维演员异步回放', '观众与花字互动', '实验数据与测量'].map((step, i) => <span key={step}><b>{String(i + 1).padStart(2, '0')}</b>{step}{i < 3 && <Arrow />}</span>)}
          </div>
        </section>

        <section className={styles.stats} aria-label="任务状态统计">{cards.map((card) => <div key={card.type} className={`${styles.statCard} ${styles[`stat${card.type}`]}`}><span className={styles.statLabel}>{card.label}</span><strong>{card.value}<small>项</small></strong><p>{card.note}</p></div>)}</section>

        <section className={styles.contextGrid} aria-label="当前开发情况">
          <div className={styles.focusCard}>
            <div className={styles.panelEyebrow}><span className={styles.focusDot} />当前进展</div>
            <h2>准备网页与条件规则已就绪，<br />真实录制等待头显恢复。</h2>
            <p>参与者准备、实验员工作台和独立检查目录已可用；模拟回放与模块分层已验证，正式剧场和实验服务仍待接入。</p>
            <div className={styles.focusLinks}><button onClick={() => choose({ stage: 'M0', kind: 'all', status: 'all', query: '' })}>查看技术验证任务<Arrow /></button><button onClick={() => choose({ stage: 'M5', kind: 'art', status: 'all', query: '' })}>模型精修计划 · 7 项<Arrow /></button></div>
          </div>
          <div className={styles.boundaries}>
            <h2>验收范围</h2>
            <div><span>Mac 本机检查</span><b className={styles.verified}>已有结果</b></div>
            <div><span>Windows 11 运行</span><b>待实测</b></div>
            <div><span>Quest 3 进入与退出 VR</span><b className={styles.waiting}>已暂缓</b></div>
            <div><span>正式完整实验</span><b>尚未开放</b></div>
            <p>当前显示项目记录，不是实时设备监控。</p>
          </div>
        </section>

        <section className={styles.taskList} id="task-list" aria-labelledby="tasks-title">
          <div className={styles.listTitle}><div><p className={styles.eyebrow}>按软件开发顺序推进</p><h2 id="tasks-title">任务清单<span>{catalog.tasks.length}</span></h2></div><details className={styles.legend}><summary>状态怎么读<span aria-hidden="true"> ⓘ</span></summary><div>{(Object.keys(STATUS) as TaskStatus[]).map((status) => <p key={status}><StatusBadge status={status} /><span>{STATUS[status].description}</span></p>)}</div></details></div>
          <div className={styles.filterPanel}>
            <div className={styles.filterTop}><label className={styles.search}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m15.5 15.5 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><span className={styles.srOnly}>搜索任务、用途或所属模块</span><input type="search" placeholder="搜索任务、用途或所属模块…" value={filters.query} onChange={(event) => update({ query: event.target.value })} /></label><label className={styles.kindFilter}><span className={styles.srOnly}>任务类别</span><select value={filters.kind} onChange={(event) => update({ kind: event.target.value })}><option value="all">全部类别</option>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <div className={styles.statusFilters} role="group" aria-label="按状态筛选"><button aria-pressed={filters.status === 'all'} onClick={() => update({ status: 'all' })}>全部状态<small>{totals.total}</small></button>{(Object.keys(STATUS) as TaskStatus[]).map((status) => <button key={status} aria-pressed={filters.status === status} onClick={() => update({ status })}><span className={`${styles.filterDot} ${styles[status]}`} />{STATUS[status].label}<small>{totals[status]}</small></button>)}</div>
          </div>
          <div className={styles.resultsBar}><p role="status" aria-live="polite">显示 <b>{filtered.length}</b> 项{filters.stage !== 'all' && <> · {catalog.stages.find((stage) => stage.id === filters.stage)?.name}</>}{filters.kind !== 'all' && <> · {KINDS[filters.kind as keyof typeof KINDS]}</>}</p><div>{filteredBy && <button onClick={reset}>重置筛选</button>}<button disabled={!visibleStages.length} onClick={() => setExpanded(allExpanded ? new Set() : new Set(visibleStages.map((stage) => stage.id)))}>{allExpanded ? '收起全部阶段' : '展开全部阶段'}<span aria-hidden="true">{allExpanded ? '−' : '＋'}</span></button></div></div>
          {filtered.length === 0 && <div className={styles.empty}><h3>没有匹配的任务</h3><p>可以尝试其他关键词，或清除阶段、类别和状态筛选。</p><button onClick={reset}>查看全部任务</button></div>}
          <div className={styles.stages}>{visibleStages.map((stage) => {
            const tasks = filtered.filter((task) => task.stage === stage.id);
            const stats = summarize(catalog.tasks.filter((task) => task.stage === stage.id));
            const isOpen = expanded.has(stage.id);
            return <section key={stage.id} className={`${styles.stage} ${stage.id === 'REF' ? styles.referenceStage : ''}`}>
              <button className={styles.stageHeading} aria-expanded={isOpen} aria-controls={`stage-${stage.id}`} onClick={() => toggle(stage.id)}>
                <span className={styles.stageNumber}>{stage.id === 'PREP' ? '准备' : stage.id === 'REF' ? '参考' : stage.id}</span>
                <span className={styles.stageText}><span className={styles.stageTitle}>{stage.name}<span>{stage.title}</span></span><span className={styles.stagePurpose}>{stage.purpose}</span></span>
                <span className={styles.stageProgress}><b>{tasks.length} 项任务</b><small>{stage.id === 'REF' ? '不计入主线统计' : `${stats.complete} 已完成 · ${stats.desktop} Mac 已验证`}</small></span>
                <span className={styles.chevron} aria-hidden="true">{isOpen ? '−' : '＋'}</span>
              </button>
              <div id={`stage-${stage.id}`} className={styles.stageBody} hidden={!isOpen}>{isOpen && tasks.map((task) => <TaskRow key={task.id} task={task} catalog={catalog} />)}</div>
            </section>;
          })}</div>
        </section>
        <footer className={styles.footer}><p>VR Standup / PunchCap<span>依据开发计划、系统设计与实际检查记录维护。</span></p><span>当前为开发阶段 · 正式实验尚未开放</span></footer>
      </main>
    </div>
  );
}
