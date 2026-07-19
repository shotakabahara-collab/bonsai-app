import { useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import type { BonsaiState } from './model';
import {
  PRUNING_GROUPS,
  PRUNING_SITES,
  PRUNING_TECHNIQUES,
  pruningPrediction,
  pruningSitesForGroup,
  type PruningGroupId,
  type PruningSiteId,
  type PruningTechnique
} from './craft-v3';
import {
  pruningSuitability,
  responseLabel,
  seasonalOverview
} from './seasonal-craft-v4';

export function PrecisionPruningV4({ bonsai, onClose, onApply }: {
  bonsai: BonsaiState;
  onClose: () => void;
  onApply: (siteId: PruningSiteId, technique: PruningTechnique) => void;
}) {
  const [group, setGroup] = useState<PruningGroupId>('apex');
  const [siteId, setSiteId] = useState<PruningSiteId>('apexLeader');
  const [technique, setTechnique] = useState<PruningTechnique>('needleThin');
  const sites = pruningSitesForGroup(bonsai.craft, group);
  const selected = sites.find(site => site.id === siteId) ?? sites[0];
  const selectedState = selected?.state;
  const overview = useMemo(() => seasonalOverview(bonsai), [bonsai]);
  const suitability = selected ? pruningSuitability(bonsai, selected.id, technique) : null;
  const prediction = selected ? pruningPrediction(bonsai.craft, selected.id, technique) : [];

  const chooseGroup = (next: PruningGroupId) => {
    setGroup(next);
    const first = PRUNING_SITES.find(site => site.group === next);
    if (first) setSiteId(first.id);
  };

  const apply = () => {
    if (!selected || selected.blocked || selected.state.removed || suitability?.status === 'blocked') return;
    const label = PRUNING_TECHNIQUES.find(item => item.id === technique)?.label ?? technique;
    const caution = suitability?.status === 'danger'
      ? `\n\n師匠は強く反対しています。危険度${suitability.risk.score}。枯れ込み、病害虫、枯死を含む結果を取り消せません。`
      : suitability?.status === 'caution'
        ? `\n\n注意が必要です。危険度${suitability.risk.score}。回復と芽吹きが不安定になる可能性があります。`
        : '';
    const warning = technique === 'removeBranch'
      ? `${selected.label}を枝系統ごと除去します。先にある枝葉と芽もすべて失い、元に戻せません。${caution}`
      : `${selected.label}へ「${label}」を行います。失った枝葉や芽は取り消せません。結果は後日の芽吹き・回復で現れます。${caution}`;
    if (!window.confirm(warning)) return;
    onApply(selected.id, technique);
  };

  return (
    <div className="care-overlay" role="dialog" aria-modal="true" aria-label="季節連動精密剪定">
      <section className="care-sheet precision-pruning-sheet precision-v4-sheet" data-total-sites={PRUNING_SITES.length}>
        <header>
          <div><div className="eyebrow">枝系統 → 枝位置 → 適期 → 技法</div><h2>精密剪定・26箇所</h2></div>
          <button type="button" aria-label="閉じる" onClick={onClose}>✕</button>
        </header>

        <section className="seasonal-banner" data-testid="seasonal-banner">
          <div><span>{overview.climate}</span><b>ゲーム内 {overview.month}・{overview.phase}</b></div>
          <em>現実の約10倍速</em>
          <p>適期・樹勢・局所健康は実行禁止ではなく、作業後の結果へ反映します。成立しない部位・技法だけ実行できません。</p>
        </section>

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
              <span>局所樹勢<b>{Math.round(selectedState.vigor)}</b></span>
              <span>健康<b>{Math.round(selectedState.health)}</b></span>
            </div>
          </section>
        )}

        <div className="precision-technique-grid seasonal-technique-grid" aria-label="剪定技法">
          {PRUNING_TECHNIQUES.map(item => {
            const roleAllowed = selected ? techniqueAllowed(selected.role, item.id) : false;
            const calendar = selected ? pruningSuitability(bonsai, selected.id, item.id) : null;
            const disabled = !roleAllowed || calendar?.status === 'blocked';
            return (
              <button
                key={item.id}
                type="button"
                className={`${technique === item.id ? 'active' : ''} suitability-${calendar?.status ?? 'blocked'}`}
                disabled={disabled}
                onClick={() => setTechnique(item.id)}
              >
                <div><b>{item.label}</b><em>{roleAllowed ? calendar?.label : '部位不適'}</em></div>
                <small>{item.description}</small>
              </button>
            );
          })}
        </div>

        {suitability && (
          <section className={`suitability-card ${suitability.status}`} data-testid="suitability-card" data-risk-score={suitability.risk.score}>
            <header><span>師匠の判断</span><b>{suitability.label}</b></header>
            <blockquote data-testid="mentor-pruning-advice">「{suitability.mentorAdvice}」</blockquote>
            {suitability.reasons.map(reason => <p key={reason}>{reason}</p>)}
            {suitability.status !== 'blocked' && (
              <div className="risk-forecast" aria-label="作業後リスク">
                <span>危険度<b>{suitability.risk.score}</b></span>
                <span>病気<b>{suitability.risk.diseaseChance}%</b></span>
                <span>害虫<b>{suitability.risk.pestChance}%</b></span>
                <span>枯れ込み<b>{suitability.risk.diebackChance}%</b></span>
                <span>枯死<b>{suitability.risk.deathChance}%</b></span>
                <span>生育抑制<b>{suitability.risk.growthPenalty}%</b></span>
              </div>
            )}
          </section>
        )}

        <section className="pruning-forecast">
          <div className="eyebrow">確定前の変化予測</div>
          {prediction.map(item => <span key={item}>{item}</span>)}
          <p>剪定直後は完成ではありません。芽吹き・枝の回復・傷の安定を時間経過後に反映します。</p>
        </section>

        {overview.activeResponses.length > 0 && (
          <section className="seasonal-response-list" aria-label="結果待ちの作業">
            <header><span>時間経過で結果が現れる作業</span><b>{overview.activeResponses.length}件</b></header>
            {overview.activeResponses.slice(0, 5).map(response => (
              <article key={response.id}>
                <div><b>{PRUNING_SITES.find(item => item.id === response.siteId)?.label}</b><span>{responseLabel(response)}</span></div>
                <time>ゲーム内約{Math.max(0, Math.ceil((response.dueAt - Date.now()) / 86_400_000 * 10))}日</time>
              </article>
            ))}
          </section>
        )}

        <button
          className="primary-button"
          type="button"
          disabled={!selected || selected.blocked || selected.state.removed || suitability?.status === 'blocked'}
          onClick={apply}
        >
          {suitability?.status === 'blocked' ? 'この作業は成立しません' : suitability?.status === 'danger' ? '強い反対を理解して実行する' : 'この箇所へ確定する'}
        </button>
      </section>
    </div>
  );
}

function techniqueAllowed(role: string, technique: PruningTechnique): boolean {
  if (technique === 'budPinch' || technique === 'budSelect') return ['leader', 'tip', 'foliagePad', 'interior'].includes(role);
  if (technique === 'needleThin') return ['leader', 'tip', 'foliagePad', 'interior', 'segment'].includes(role);
  if (technique === 'innerTwigThin') return ['interior', 'segment', 'foliagePad', 'defectBranch'].includes(role);
  if (technique === 'removeBranch') return ['branchBase', 'segment', 'defectBranch'].includes(role);
  return true;
}
