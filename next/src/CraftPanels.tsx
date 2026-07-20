import { useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import {
  PARTS,
  type BonsaiState,
  type PartId,
  type SpeciesId,
  type WireState
} from './model';
import {
  PRUNING_GROUPS,
  PRUNING_SITES,
  PRUNING_TECHNIQUES,
  deadwoodStatus,
  pruningPrediction,
  pruningSitesForGroup,
  wireLifecycle,
  type DeadwoodProject,
  type PruningGroupId,
  type PruningSiteId,
  type PruningTechnique
} from './craft-v3';

export function PrecisionPruningSheet({ bonsai, onClose, onApply }: {
  bonsai: BonsaiState;
  onClose: () => void;
  onApply: (siteId: PruningSiteId, technique: PruningTechnique) => void;
}) {
  const [group, setGroup] = useState<PruningGroupId>('apex');
  const firstId = PRUNING_SITES.find(site => site.group === group)?.id ?? 'apexLeader';
  const [siteId, setSiteId] = useState<PruningSiteId>(firstId);
  const [technique, setTechnique] = useState<PruningTechnique>('needleThin');
  const sites = pruningSitesForGroup(bonsai.craft, group);
  const selected = sites.find(site => site.id === siteId) ?? sites[0];
  const selectedState = selected?.state;
  const prediction = selected ? pruningPrediction(bonsai.craft, selected.id, technique) : [];

  const chooseGroup = (next: PruningGroupId) => {
    setGroup(next);
    const first = PRUNING_SITES.find(site => site.group === next);
    if (first) setSiteId(first.id);
  };

  const apply = () => {
    if (!selected || selected.blocked || selected.state.removed) return;
    const label = PRUNING_TECHNIQUES.find(item => item.id === technique)?.label ?? technique;
    const warning = technique === 'removeBranch'
      ? `${selected.label}を枝系統ごと除去します。先にある枝葉と芽もすべて失い、元に戻せません。`
      : `${selected.label}へ「${label}」を行います。失った枝葉や芽は取り消せません。`;
    if (!window.confirm(warning)) return;
    onApply(selected.id, technique);
  };

  return (
    <div className="care-overlay" role="dialog" aria-modal="true" aria-label="精密剪定">
      <section className="care-sheet precision-pruning-sheet" data-total-sites={PRUNING_SITES.length}>
        <header>
          <div><div className="eyebrow">枝系統 → 枝位置 → 技法</div><h2>精密剪定・26箇所</h2></div>
          <button type="button" aria-label="閉じる" onClick={onClose}>✕</button>
        </header>

        <div className="precision-stage-wrap">
          <BonsaiStage bonsai={bonsai} className="care-stage" />
          {sites.map(site => (
            <button
              key={site.id}
              type="button"
              aria-label={`${site.label}を選択`}
              className={`precision-site-pin ${site.id === selected?.id ? 'selected' : ''} ${site.state.removed || site.blocked ? 'disabled' : ''}`}
              style={{ left: `${site.x}%`, top: `${site.y}%` }}
              disabled={site.state.removed || site.blocked}
              onClick={() => setSiteId(site.id)}
            >
              {site.short}
            </button>
          ))}
        </div>

        <div className="precision-group-tabs" aria-label="枝系統">
          {PRUNING_GROUPS.map(item => (
            <button key={item.id} type="button" className={group === item.id ? 'active' : ''} onClick={() => chooseGroup(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="precision-group-copy">{PRUNING_GROUPS.find(item => item.id === group)?.description}</p>

        <div className="precision-site-grid" aria-label="剪定箇所">
          {sites.map(site => (
            <button
              key={site.id}
              type="button"
              className={site.id === selected?.id ? 'active' : ''}
              disabled={site.state.removed || site.blocked}
              onClick={() => setSiteId(site.id)}
            >
              <b>{site.label}</b>
              <small>{site.state.removed ? '除去済み' : site.blocked ? '親枝が除去済み' : `葉量 ${Math.round(site.state.foliage)}・芽 ${site.state.budCount}`}</small>
            </button>
          ))}
        </div>

        {selected && selectedState && (
          <section className="precision-inspector">
            <header><div><span>選択箇所</span><b>{selected.label}</b></div><em>{selected.role}</em></header>
            <div className="precision-state-grid">
              <span>葉量<b>{Math.round(selectedState.foliage)}</b></span>
              <span>芽数<b>{selectedState.budCount}</b></span>
              <span>樹勢<b>{Math.round(selectedState.vigor)}</b></span>
              <span>抜け<b>{Math.round(selectedState.openness)}</b></span>
            </div>
          </section>
        )}

        <div className="precision-technique-grid" aria-label="剪定技法">
          {PRUNING_TECHNIQUES.map(item => {
            const allowed = selected ? techniqueAllowed(selected.role, item.id) : false;
            return (
              <button key={item.id} type="button" className={technique === item.id ? 'active' : ''} disabled={!allowed} onClick={() => setTechnique(item.id)}>
                <b>{item.label}</b><small>{item.description}</small>
              </button>
            );
          })}
        </div>

        <section className="pruning-forecast">
          <div className="eyebrow">確定前の変化予測</div>
          {prediction.map(item => <span key={item}>{item}</span>)}
          <p>予測は将来の芽吹きを保証しません。確定後の剪定は取り消せません。</p>
        </section>

        <button className="primary-button" type="button" disabled={!selected || selected.blocked || selected.state.removed} onClick={apply}>
          この箇所へ確定する
        </button>
      </section>
    </div>
  );
}

function techniqueAllowed(role: string, technique: PruningTechnique): boolean {
  if (technique === 'budPinch' || technique === 'budSelect') return ['leader', 'tip', 'foliagePad', 'interior'].includes(role);
  if (technique === 'needleThin') return ['leader', 'tip', 'foliagePad', 'interior', 'segment'].includes(role);
  if (technique === 'innerTwigThin') return ['interior', 'segment', 'foliagePad', 'defectBranch'].includes(role);
  return true;
}

export function DeadwoodLifecycleSheet({ bonsai, onClose, onStartJin, onStartShari, onAdvance, onPause, onResume }: {
  bonsai: BonsaiState;
  onClose: () => void;
  onStartJin: (partId: PartId) => void;
  onStartShari: (side: 'left' | 'right') => void;
  onAdvance: (projectId: string) => void;
  onPause: (projectId: string) => void;
  onResume: (projectId: string) => void;
}) {
  const branchParts = PARTS.filter(part => !['trunk', 'roots'].includes(part.id));
  const [targetPart, setTargetPart] = useState<PartId>('thirdLeft');
  const projects = [...bonsai.craft.deadwoodProjects].sort((a, b) => b.startedAt - a.startedAt);
  const activeJinParts = new Set(projects.filter(project => project.kind === 'jin' && project.stage !== 'mature').map(project => project.targetPartId));
  const activeShari = projects.some(project => project.kind === 'shari' && project.stage !== 'mature');
  const jinLevel = Math.max(0, ...projects.filter(project => project.kind === 'jin' && project.targetPartId === targetPart && project.stage === 'mature').map(project => project.level));
  const shariLevel = Math.max(0, ...projects.filter(project => project.kind === 'shari' && project.stage === 'mature').map(project => project.level));

  return (
    <div className="care-overlay" role="dialog" aria-modal="true" aria-label="神舎利の工程管理">
      <section className="care-sheet deadwood-lifecycle-sheet">
        <header>
          <div><div className="eyebrow">剥離 → 乾燥 → 整形 → 保護 → 風化</div><h2>神・舎利の工程管理</h2></div>
          <button type="button" aria-label="閉じる" onClick={onClose}>✕</button>
        </header>
        <BonsaiStage bonsai={bonsai} className="care-stage" />

        <section className="deadwood-intro">
          <b>強度と経過時間が、同じ加工面の姿へ段階的に残ります</b>
          <p>第1〜第3強度で加工面積が不可逆に広がり、各工程の待機中も湿潤・乾燥・風化の表情が進みます。未完成工程がある作品は品評会へ出展できません。</p>
        </section>

        <div className="deadwood-project-list">
          {projects.length === 0 && <p className="completion-empty">進行中・完成済みの神／舎利はありません。</p>}
          {projects.map(project => <DeadwoodProjectCard key={project.id} project={project} onAdvance={onAdvance} onPause={onPause} onResume={onResume} />)}
        </div>

        <section className="deadwood-start-panel">
          <div className="eyebrow">新しい神を始める</div>
          <div className="deadwood-target-grid">
            {branchParts.map(part => (
              <button key={part.id} type="button" className={targetPart === part.id ? 'active' : ''} onClick={() => setTargetPart(part.id)}>
                {part.name}
              </button>
            ))}
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={bonsai.lifeStatus === 'dead' || bonsai.vitality < 60 || activeJinParts.has(targetPart) || jinLevel >= 3}
            onClick={() => {
              const nextLevel = Math.min(3, jinLevel + 1);
              if (!window.confirm(`${PARTS.find(item => item.id === targetPart)?.name}の神を第${nextLevel}強度として加工します。加工面は元には戻せません。`)) return;
              onStartJin(targetPart);
            }}
          >
            {jinLevel >= 3 ? 'この枝の神は第3強度まで完成済み' : `この枝で神の第${jinLevel + 1}強度を始める`}
          </button>
          {bonsai.vitality < 60 && <small>樹勢60以上が必要です。</small>}
        </section>

        <section className="deadwood-start-panel">
          <div className="eyebrow">新しい舎利を始める</div>
          <p>生き筋を残し、第1〜第3強度で同じ舎利面を段階的に広げます。強度が高いほど樹勢と幹の健康への負担も増えます。</p>
          <div className="two-buttons">
            <button type="button" disabled={bonsai.lifeStatus === 'dead' || bonsai.vitality < 70 || activeShari || shariLevel >= 3} onClick={() => onStartShari('left')}>{shariLevel >= 3 ? '左側・第3強度まで完成済み' : `左側・第${shariLevel + 1}強度を始める`}</button>
            <button type="button" disabled={bonsai.lifeStatus === 'dead' || bonsai.vitality < 70 || activeShari || shariLevel >= 3} onClick={() => onStartShari('right')}>{shariLevel >= 3 ? '右側・第3強度まで完成済み' : `右側・第${shariLevel + 1}強度を始める`}</button>
          </div>
          {bonsai.vitality < 70 && <small>樹勢70以上が必要です。</small>}
        </section>
      </section>
    </div>
  );
}

function DeadwoodProjectCard({ project, onAdvance, onPause, onResume }: {
  project: DeadwoodProject;
  onAdvance: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const status = deadwoodStatus(project);
  const title = project.kind === 'jin' ? `${PARTS.find(item => item.id === project.targetPartId)?.name}の神・第${project.level}強度` : `主幹${project.side === 'right' ? '右' : '左'}側の舎利・第${project.level}強度`;
  return (
    <article className={`deadwood-project deadwood-stage-${project.stage} ${status.paused ? 'paused' : ''}`} data-project-paused={status.paused ? 'true' : 'false'}>
      <header><div><small>{project.kind === 'jin' ? 'JIN' : 'SHARI'}</small><b>{title}</b></div><em>{status.label}</em></header>
      <ol>
        {['fresh', 'drying', 'carving', 'preserving', 'weathering', 'mature'].map(stage => (
          <li key={stage} className={project.stage === stage ? 'current' : stageCompleted(project.stage, stage) ? 'done' : ''}>{stageShort(stage)}</li>
        ))}
      </ol>
      <div className="deadwood-progress-meter" aria-label={`工程進行 ${Math.round(status.progress)}%`}><span style={{ width: `${status.progress}%` }} /></div>
      <div className="deadwood-progress-caption"><span>工程内の経過</span><b>{Math.round(status.progress)}%</b></div>
      {project.stage === 'mature' ? <p>第{project.level}強度の風化完成。展示前には周囲の生き筋と木部の調和を確認します。</p> : status.paused ? (
        <>
          <p>工程は中断中です。加工済みの木部は残り、待機時間は停止しています。未完成のため品評会へは出展できません。</p>
          <button type="button" className="primary-button" onClick={() => onResume(project.id)}>この工程を再開する</button>
        </>
      ) : (
        <>
          <p>{status.ready ? `次の作業「${status.nextAction}」を行えます。` : `次の確認までゲーム内約${Math.ceil(status.remainingInGameDays)}日。`}</p>
          <div className="deadwood-project-actions">
            <button type="button" disabled={!status.ready} onClick={() => onAdvance(project.id)}>{status.nextAction}</button>
            <button type="button" className="ghost-button" onClick={() => onPause(project.id)}>この工程を中断する</button>
          </div>
        </>
      )}
    </article>
  );
}

function stageCompleted(current: string, candidate: string): boolean {
  const order = ['fresh', 'drying', 'carving', 'preserving', 'weathering', 'mature'];
  return order.indexOf(candidate) < order.indexOf(current);
}
function stageShort(stage: string): string {
  return ({ fresh: '剥離', drying: '乾燥', carving: '整形', preserving: '保護', weathering: '風化', mature: '完成' } as Record<string, string>)[stage] ?? stage;
}

export function WireLifecycleStatus({ wire, species }: { wire: WireState; species: SpeciesId }) {
  const view = useMemo(() => wireLifecycle(wire, species), [wire, species]);
  const label = view.status === 'training' ? '養成中' : view.status === 'ready' ? '外し頃' : '食い込み注意';
  return (
    <section className={`wire-lifecycle-card wire-status-${view.status}`}>
      <header><div><span>針金養成</span><b>{label}</b></div><em>{Math.round(view.progress)}%</em></header>
      <i><span style={{ width: `${Math.min(100, view.progress)}%` }} /></i>
      <p>{view.status === 'training'
        ? `適期までゲーム内約${Math.ceil(view.remainingInGameDays)}日。今外すと定着予測 ${Math.round(view.predictedRetention)}%。`
        : view.status === 'ready'
          ? `枝姿が定着しました。現在の定着予測 ${Math.round(view.predictedRetention)}%。`
          : `適期を過ぎています。食い込み危険度 ${Math.round(view.biteRisk)}%。早く外してください。`}</p>
    </section>
  );
}
