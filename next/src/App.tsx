import { useCallback, useEffect, useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import {
  PARTS,
  PEOPLE,
  POTS,
  SPECIES,
  activeBonsai,
  addBonsai,
  addMemorial,
  buyOrSelectPot,
  createBonsai,
  createGame,
  createJin,
  createShari,
  diseaseName,
  enterWeeklyShow,
  exhibitionScore,
  inGameAgeYears,
  metrics,
  pestName,
  prunePart,
  removeWire,
  titleForReputation,
  treatPart,
  unlockedSlots,
  updateActiveBonsai,
  visualSignature,
  waterBonsai,
  wirePart,
  type AwardRecord,
  type GameState,
  type PartId,
  type PotId,
  type SpeciesId,
  type TabId,
  type WireDirection
} from './model';
import { loadGame, persistGame, repairRuntimeCaches } from './storage';

const NAV: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'grow', label: '育成', icon: '🌿' },
  { id: 'pots', label: '鉢', icon: '🏺' },
  { id: 'show', label: '大会', icon: '🏆' },
  { id: 'people', label: '人物', icon: '👥' },
  { id: 'memorial', label: '銘木録', icon: '📜' }
];

type CareMode = 'prune' | 'wire' | 'health' | 'deadwood';

interface ShowResult {
  award?: AwardRecord;
  notes: string[];
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => loadGame());
  const [tab, setTab] = useState<TabId>('grow');
  const [careMode, setCareMode] = useState<CareMode | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartId>('apex');
  const [wallMode, setWallMode] = useState(false);
  const [showResult, setShowResult] = useState<ShowResult | null>(null);
  const [toast, setToast] = useState('');
  const [newTreeSpecies, setNewTreeSpecies] = useState<SpeciesId | null>(null);

  const bonsai = activeBonsai(game);
  const commit = useCallback((next: GameState | ((current: GameState) => GameState), message?: string) => {
    setGame(current => {
      const value = typeof next === 'function' ? next(current) : next;
      persistGame(value);
      return value;
    });
    if (message) {
      setToast(message);
      window.setTimeout(() => setToast(''), 1800);
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const fresh = loadGame();
        setGame(fresh);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!game.started || !bonsai) {
    return <Onboarding onStart={(playerName, mentorId, species, treeName) => {
      const next = createGame();
      const first = createBonsai(species, treeName);
      next.started = true;
      next.playerName = playerName.trim() || 'あなた';
      next.mentorId = mentorId;
      next.bonsai = [first];
      next.activeBonsaiId = first.id;
      commit(next, '最初の盆栽を迎えました');
    }} />;
  }

  const mentor = PEOPLE.find(person => person.id === game.mentorId) ?? PEOPLE[0];
  const treeMetrics = metrics(bonsai);
  const activePart = bonsai.parts[selectedPart];
  const alerts = PARTS.flatMap(part => {
    const state = bonsai.parts[part.id];
    const labels: string[] = [];
    if (state.disease) labels.push(`${part.name}：${diseaseName(state.disease)}`);
    if (state.pest) labels.push(`${part.name}：${pestName(state.pest)}`);
    return labels;
  });

  return (
    <div className="app-shell" data-testid="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">BONSAI</div>
          <div className="eyebrow">{titleForReputation(game.reputation)}・{game.playerName}</div>
        </div>
        <div className="money">¥{game.money.toLocaleString('ja-JP')}</div>
      </header>

      <main className="app-main">
        {tab === 'grow' && (
          <GrowPage
            game={game}
            bonsai={bonsai}
            alerts={alerts}
            mentorName={mentor.name}
            mentorTip={mentorTip(bonsai)}
            onSelectBonsai={id => commit(current => ({ ...current, activeBonsaiId: id }))}
            onWater={() => commit(current => waterBonsai(current), '水やりを記録しました')}
            onOpenCare={mode => { setCareMode(mode); setSelectedPart(mode === 'deadwood' ? 'trunk' : 'apex'); }}
            onWall={() => setWallMode(true)}
            onAddTree={() => setNewTreeSpecies('pine')}
          />
        )}
        {tab === 'pots' && (
          <PotsPage game={game} activePot={bonsai.potId} onSelect={potId => {
            const owned = game.ownedPots.includes(potId);
            if (!owned && game.money < POTS[potId].price) {
              setToast('資金が不足しています');
              window.setTimeout(() => setToast(''), 1800);
              return;
            }
            commit(current => buyOrSelectPot(current, potId), owned ? '鉢を合わせました' : '鉢を購入して合わせました');
          }} />
        )}
        {tab === 'show' && (
          <ShowPage
            game={game}
            bonsai={bonsai}
            onEnter={() => {
              const result = enterWeeklyShow(game);
              if (!result.award) {
                setToast(result.notes[0] ?? '今週は出展済みです');
                window.setTimeout(() => setToast(''), 1800);
                return;
              }
              persistGame(result.game);
              setGame(result.game);
              setShowResult({ award: result.award, notes: result.notes });
            }}
          />
        )}
        {tab === 'people' && <PeoplePage mentorId={game.mentorId} />}
        {tab === 'memorial' && (
          <MemorialPage
            bonsai={bonsai}
            onRecord={() => commit(current => addMemorial(current, '現在の姿'), '現在の作品状態を銘木録へ記録しました')}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {NAV.map(item => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>

      {careMode && (
        <CareSheet
          mode={careMode}
          bonsai={bonsai}
          selectedPart={selectedPart}
          onSelectPart={setSelectedPart}
          onClose={() => setCareMode(null)}
          onPrune={level => {
            if (['trunk', 'roots'].includes(selectedPart)) return;
            if (!window.confirm(`${PARTS.find(item => item.id === selectedPart)?.name}を剪定します。切った枝葉は元に戻せません。`)) return;
            commit(current => prunePart(current, selectedPart, level), '不可逆の剪定を確定しました');
            setCareMode(null);
          }}
          onWire={(intensity, direction) => {
            commit(current => wirePart(current, selectedPart, intensity, direction), '部位と方向を指定して針金をかけました');
            setCareMode(null);
          }}
          onRemoveWire={() => {
            commit(current => removeWire(current, selectedPart), '針金を外しました');
            setCareMode(null);
          }}
          onTreat={() => {
            if (!activePart?.disease && !activePart?.pest) return;
            commit(current => treatPart(current, selectedPart), '病害虫へ対処しました');
            setCareMode(null);
          }}
          onJin={() => {
            if (!window.confirm('この枝を神にします。生きた枝には戻せません。')) return;
            commit(current => createJin(current, selectedPart), '神を作成しました');
            setCareMode(null);
          }}
          onShari={side => {
            if (!window.confirm('主幹へ舎利を入れます。元の樹皮には戻せません。')) return;
            commit(current => createShari(current, side), '舎利を作成しました');
            setCareMode(null);
          }}
        />
      )}

      {wallMode && (
        <div className="wall-mode" role="dialog" aria-label="鑑賞モード">
          <BonsaiStage bonsai={bonsai} className="wall-stage" />
          <div className="wall-caption"><b>{bonsai.name}</b><span>{SPECIES[bonsai.species].name}・{POTS[bonsai.potId].name}</span></div>
          <button type="button" onClick={() => setWallMode(false)}>鑑賞を終了</button>
        </div>
      )}

      {showResult && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="result-card">
            <div className="result-medal">{showResult.award?.rank === 1 ? '🥇' : showResult.award && showResult.award.rank <= 3 ? '🏅' : '🎖️'}</div>
            <div className="eyebrow">今週の展覧会</div>
            <h2>{showResult.award?.title}</h2>
            <div className="result-score">{showResult.award?.score}<small>点</small></div>
            <p>{showResult.award?.fieldSize}作品中 {showResult.award?.rank}位</p>
            <ul>{showResult.notes.map(note => <li key={note}>{note}</li>)}</ul>
            <button className="primary-button" type="button" onClick={() => setShowResult(null)}>銘木録へ進む</button>
          </section>
        </div>
      )}

      {newTreeSpecies && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="result-card">
            <div className="eyebrow">新しい素材</div>
            <h2>育てる樹種を選ぶ</h2>
            <div className="species-mini-grid">
              {(Object.keys(SPECIES) as SpeciesId[]).map(species => (
                <button key={species} className={newTreeSpecies === species ? 'selected' : ''} type="button" onClick={() => setNewTreeSpecies(species)}>
                  <span>{SPECIES[species].emoji}</span>{SPECIES[species].name}
                </button>
              ))}
            </div>
            <p>素材代 ¥1,800。名声に応じて最大3鉢まで同時育成できます。</p>
            <button className="primary-button" type="button" onClick={() => {
              const before = game.bonsai.length;
              const next = addBonsai(game, newTreeSpecies);
              if (next.bonsai.length === before) {
                setToast('育成枠または資金が不足しています');
                window.setTimeout(() => setToast(''), 1800);
              } else {
                commit(next, `${SPECIES[newTreeSpecies].name}の素材を迎えました`);
              }
              setNewTreeSpecies(null);
            }}>この素材を迎える</button>
            <button className="ghost-button" type="button" onClick={() => setNewTreeSpecies(null)}>キャンセル</button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Onboarding({ onStart }: { onStart: (player: string, mentor: string, species: SpeciesId, tree: string) => void }) {
  const [step, setStep] = useState(0);
  const [player, setPlayer] = useState('');
  const [tree, setTree] = useState('');
  const [species, setSpecies] = useState<SpeciesId>('pine');
  const [mentor, setMentor] = useState('gensai');
  return (
    <main className="onboarding" data-testid="onboarding">
      <div className="onboard-brand">BONSAI</div>
      <div className="eyebrow">育てた時間が、作品になる。</div>
      {step === 0 && (
        <section className="onboard-panel">
          <h1>最初の一本を選ぶ</h1>
          <p>実時間の10倍で季節と樹齢が進みます。剪定は取り消せません。</p>
          <div className="species-grid">
            {(Object.keys(SPECIES) as SpeciesId[]).map(id => (
              <button key={id} type="button" className={species === id ? 'selected' : ''} onClick={() => setSpecies(id)}>
                <span>{SPECIES[id].emoji}</span>
                <b>{SPECIES[id].name}</b>
                <small>{SPECIES[id].subtitle}</small>
              </button>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={() => setStep(1)}>師匠を選ぶ</button>
        </section>
      )}
      {step === 1 && (
        <section className="onboard-panel">
          <h1>師匠を選ぶ</h1>
          <p>師匠はチュートリアルと作品づくりの助言を担当します。</p>
          <div className="mentor-list">
            {PEOPLE.slice(0, 3).map(person => (
              <button key={person.id} type="button" className={mentor === person.id ? 'selected' : ''} onClick={() => setMentor(person.id)}>
                <span>{person.emoji}</span><div><b>{person.name}</b><small>{person.role}</small><em>「{person.quote}」</em></div>
              </button>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={() => setStep(2)}>名前を決める</button>
          <button className="ghost-button" type="button" onClick={() => setStep(0)}>戻る</button>
        </section>
      )}
      {step === 2 && (
        <section className="onboard-panel">
          <h1>盆栽師として始める</h1>
          <label>盆栽師名<input value={player} onChange={event => setPlayer(event.target.value)} placeholder="あなた" maxLength={30} /></label>
          <label>作品の銘<input value={tree} onChange={event => setTree(event.target.value)} placeholder={`${SPECIES[species].name}・若樹`} maxLength={40} /></label>
          <button className="primary-button" data-testid="start-game" type="button" onClick={() => onStart(player, mentor, species, tree)}>育成を始める</button>
          <button className="ghost-button" type="button" onClick={() => setStep(1)}>戻る</button>
        </section>
      )}
    </main>
  );
}

function GrowPage({ game, bonsai, alerts, mentorName, mentorTip, onSelectBonsai, onWater, onOpenCare, onWall, onAddTree }: {
  game: GameState;
  bonsai: NonNullable<ReturnType<typeof activeBonsai>>;
  alerts: string[];
  mentorName: string;
  mentorTip: string;
  onSelectBonsai: (id: string) => void;
  onWater: () => void;
  onOpenCare: (mode: CareMode) => void;
  onWall: () => void;
  onAddTree: () => void;
}) {
  const m = metrics(bonsai);
  const slots = unlockedSlots(game.reputation);
  return (
    <section className="page grow-page">
      <div className="tree-tabs">
        {game.bonsai.map(item => <button key={item.id} type="button" className={item.id === bonsai.id ? 'active' : ''} onClick={() => onSelectBonsai(item.id)}>{SPECIES[item.species].emoji} {item.name}</button>)}
        {game.bonsai.length < slots && <button className="add-tree" type="button" onClick={onAddTree}>＋ 新しい素材</button>}
      </div>
      <article className="artwork-card">
        <div className="artwork-head">
          <div><span className="badge">{titleForReputation(game.reputation)}</span><h1>{bonsai.name}</h1><p>{SPECIES[bonsai.species].name}・樹齢 {inGameAgeYears(bonsai).toFixed(1)}年・{POTS[bonsai.potId].name}</p></div>
          <button className="icon-button" type="button" aria-label="鑑賞モード" onClick={onWall}>⛶</button>
        </div>
        <BonsaiStage bonsai={bonsai} />
        <div className="metric-grid">
          <Metric label="水分" value={m.water} />
          <Metric label="樹勢" value={m.vitality} />
          <Metric label="作品性" value={m.artistry} />
        </div>
        <div className="action-grid">
          <ActionButton icon="💧" label="水やり" onClick={onWater} />
          <ActionButton icon="✂️" label="部位剪定" onClick={() => onOpenCare('prune')} />
          <ActionButton icon="🪢" label="部位針金" onClick={() => onOpenCare('wire')} />
        </div>
      </article>
      {alerts.length > 0 && <div className="alert-card"><b>作品に異変があります</b>{alerts.map(alert => <span key={alert}>{alert}</span>)}<button type="button" onClick={() => onOpenCare('health')}>診断と処置</button></div>}
      <div className="mentor-card"><div className="mentor-avatar">👴</div><div><b>師匠 {mentorName}</b><p>「{mentorTip}」</p></div></div>
      <div className="secondary-actions"><button type="button" onClick={() => onOpenCare('health')}>🩺 病害虫・健康</button><button type="button" onClick={() => onOpenCare('deadwood')}>🪵 神・舎利</button></div>
      <div className="stats-row"><div><small>名声</small><b>{game.reputation}</b></div><div><small>育成枠</small><b>{game.bonsai.length}/{slots}</b></div><div><small>受賞</small><b>{bonsai.awards.length}</b></div></div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><b>{Math.round(value)}%</b><span>{label}</span><i style={{ width: `${Math.max(3, value)}%` }} /></div>;
}
function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span>{icon}</span>{label}</button>;
}

function PotsPage({ game, activePot, onSelect }: { game: GameState; activePot: PotId; onSelect: (id: PotId) => void }) {
  return <section className="page"><div className="page-heading"><div className="eyebrow">作品の半分は鉢で決まる</div><h1>鉢蔵</h1><p>購入した鉢は所有品として残り、いつでも合わせ直せます。</p></div><div className="pot-list">{(Object.keys(POTS) as PotId[]).map(id => { const pot = POTS[id]; const owned = game.ownedPots.includes(id); return <article key={id} className={`pot-card ${activePot === id ? 'active' : ''}`}><div className="pot-preview" style={{ '--pot': pot.tone } as React.CSSProperties}><span /></div><div className="pot-copy"><b>{pot.name}</b><small>格 {pot.prestige}</small><p>{pot.description}</p></div><button type="button" onClick={() => onSelect(id)}>{activePot === id ? '使用中' : owned ? 'この鉢を使う' : pot.price === 0 ? '入手済み' : `¥${pot.price.toLocaleString('ja-JP')}`}</button></article>; })}</div></section>;
}

function ShowPage({ game, bonsai, onEnter }: { game: GameState; bonsai: NonNullable<ReturnType<typeof activeBonsai>>; onEnter: () => void }) {
  const evaluation = exhibitionScore(bonsai);
  const latest = bonsai.awards[0];
  return (
    <section className="page">
      <div className="page-heading">
        <div className="eyebrow">公開審査基準・週に一度の非同期大会</div>
        <h1>全国樹藝品評会</h1>
        <p>国風賞で公表されている「総合美・風格・鉢等との調和・培養状態」を参考に、ゲーム内で再現できる六つの審査軸へ定量化しています。審査は作品の状態だけを見て行い、名声や所持金は採点に加えません。</p>
      </div>
      <article className="show-card">
        <BonsaiStage bonsai={bonsai} />
        <div className="show-score"><small>三部門合議による予想評価</small><b>{evaluation.score}<span>点</span></b></div>
        <section className="judging-standard" aria-label="品評会の公開審査基準">
          <header><div><span>審査基準</span><b>{evaluation.standard}</b></div><em>100点満点</em></header>
          <div className="judge-panel-grid">
            {evaluation.panels.map(panel => <div key={panel.name}><span>{panel.name}</span><b>{panel.score}</b></div>)}
          </div>
          <div className="criterion-grid">
            {evaluation.breakdown.map(item => (
              <article className="criterion-card" key={item.id}>
                <div><b>{item.label}</b><span>配点 {item.weight}</span></div>
                <strong>{item.score}</strong>
                <i><span style={{ width: `${item.score}%` }} /></i>
              </article>
            ))}
          </div>
          {evaluation.penalties.length > 0 && <div className="judging-penalties"><b>明示減点</b>{evaluation.penalties.map(item => <span key={item}>{item}</span>)}</div>}
        </section>
        <ul className="judge-notes">{evaluation.notes.map(note => <li key={note}>{note}</li>)}</ul>
        <button className="primary-button" type="button" onClick={onEnter}>今週の展覧会へ出展</button>
      </article>
      {latest && <article className="latest-award"><span>{latest.rank === 1 ? '🥇' : latest.rank <= 3 ? '🏅' : '🎖️'}</span><div><small>直近の成績</small><b>{latest.title}・{latest.score}点</b><p>{new Date(latest.at).toLocaleString('ja-JP')}／{latest.fieldSize}作品中{latest.rank}位</p></div></article>}
    </section>
  );
}

function PeoplePage({ mentorId }: { mentorId: string }) {
  return <section className="page"><div className="page-heading"><div className="eyebrow">師匠・ライバル・審査員・評論家</div><h1>人物</h1><p>作品への評価やオファーは、人物ごとの美意識で変わります。</p></div><div className="people-list">{PEOPLE.map((person, index) => <article key={person.id} className={person.id === mentorId ? 'mentor-active' : ''}><div className="person-face">{person.emoji}</div><div><small>{person.role}</small><h2>{person.name}{person.id === mentorId && <em>師匠</em>}</h2><p>「{person.quote}」</p>{index === 3 && <span className="relationship rival">ライバル</span>}{index === 4 && <span className="relationship judge">審査員</span>}{index === 5 && <span className="relationship critic">評論家</span>}{index === 6 && <span className="relationship wealthy">富豪</span>}</div></article>)}</div></section>;
}

function MemorialPage({ bonsai, onRecord }: { bonsai: NonNullable<ReturnType<typeof activeBonsai>>; onRecord: () => void }) {
  const entries = [
    ...bonsai.awards.map(item => ({ id: item.id, at: item.at, title: `${item.title}・${item.score}点`, note: `${item.fieldSize}作品中${item.rank}位`, kind: 'award' })),
    ...bonsai.memorials.map(item => ({ id: item.id, at: item.at, title: item.title, note: item.reason, kind: 'memory' })),
    ...bonsai.logs.slice(0, 30).map(item => ({ id: item.id, at: item.at, title: item.text, note: '育成記録', kind: 'log' }))
  ].sort((a, b) => b.at - a.at);
  return <section className="page"><div className="page-heading"><div className="eyebrow">一本の木の生涯を残す</div><h1>銘木録</h1><p>剪定・鉢替え・受賞・古木技法の節目を作品の物語として保存します。</p></div><button className="primary-button memorial-button" type="button" onClick={onRecord}>📷 今の姿を記録</button><div className="memorial-hero"><BonsaiStage bonsai={bonsai} /><div><b>{bonsai.name}</b><span>{visualSignature(bonsai).slice(0, 76)}…</span></div></div><div className="timeline">{entries.length === 0 ? <p className="empty">まだ記録がありません。</p> : entries.map(entry => <article key={`${entry.kind}-${entry.id}`}><i className={`timeline-dot ${entry.kind}`} /><time>{new Date(entry.at).toLocaleString('ja-JP')}</time><b>{entry.title}</b><p>{entry.note}</p></article>)}</div></section>;
}

function CareSheet({ mode, bonsai, selectedPart, onSelectPart, onClose, onPrune, onWire, onRemoveWire, onTreat, onJin, onShari }: {
  mode: CareMode;
  bonsai: NonNullable<ReturnType<typeof activeBonsai>>;
  selectedPart: PartId;
  onSelectPart: (part: PartId) => void;
  onClose: () => void;
  onPrune: (level: 1 | 2 | 3) => void;
  onWire: (intensity: 'light' | 'strong', direction: WireDirection) => void;
  onRemoveWire: () => void;
  onTreat: () => void;
  onJin: () => void;
  onShari: (side: 'left' | 'right') => void;
}) {
  const part = bonsai.parts[selectedPart];
  const [wireIntensity, setWireIntensity] = useState<'light' | 'strong'>('light');
  const [direction, setDirection] = useState<WireDirection>('down');
  const title = { prune: '部位別剪定', wire: '部位別針金', health: '病害虫・健康', deadwood: '神・舎利' }[mode];
  return <div className="care-overlay" role="dialog" aria-modal="true"><section className="care-sheet"><header><div><div className="eyebrow">作品上の場所を指定する</div><h2>{title}</h2></div><button type="button" onClick={onClose}>✕</button></header><BonsaiStage bonsai={bonsai} interactive selectedPart={selectedPart} onSelectPart={onSelectPart} className="care-stage" /><div className="part-summary"><b>{PARTS.find(item => item.id === selectedPart)?.name}</b><span>葉量 {Math.round(part.foliage)}／健康 {Math.round(part.health)}／剪定 {part.pruneLevel}</span>{part.disease && <em>{diseaseName(part.disease)}</em>}{part.pest && <em>{pestName(part.pest)}</em>}{part.deadwood && <em>神</em>}</div>{mode === 'prune' && <div className="care-options"><p>剪定は確定後に取り消せません。対象部位だけの葉量と骨格が変わります。</p><div className="three-buttons"><button type="button" onClick={() => onPrune(1)}>軽剪定<small>葉量 −14</small></button><button type="button" onClick={() => onPrune(2)}>中剪定<small>葉量 −28</small></button><button className="danger-option" type="button" onClick={() => onPrune(3)}>強剪定<small>葉量 −45</small></button></div></div>}{mode === 'wire' && <div className="care-options"><div className="segmented"><button className={wireIntensity === 'light' ? 'active' : ''} type="button" onClick={() => setWireIntensity('light')}>軽針金</button><button className={wireIntensity === 'strong' ? 'active' : ''} type="button" onClick={() => setWireIntensity('strong')}>強針金</button></div><div className="direction-grid">{([['down','下げる'],['up','上げる'],['left','左へ'],['right','右へ'],['front','手前へ'],['back','奥へ']] as Array<[WireDirection,string]>).map(([id,label]) => <button key={id} className={direction === id ? 'active' : ''} type="button" onClick={() => setDirection(id)}>{label}</button>)}</div><button className="primary-button" type="button" disabled={['trunk','roots'].includes(selectedPart)} onClick={() => onWire(wireIntensity, direction)}>この部位へかける</button>{part.wire && <button className="ghost-button" type="button" onClick={onRemoveWire}>現在の針金を外す</button>}</div>}{mode === 'health' && <div className="care-options"><p>{part.disease ? `${diseaseName(part.disease)}が見つかっています。` : part.pest ? `${pestName(part.pest)}が発生しています。` : 'この部位に目立った病害虫はありません。'}</p><button className="primary-button" type="button" disabled={!part.disease && !part.pest} onClick={onTreat}>診断に応じて処置する</button></div>}{mode === 'deadwood' && <div className="care-options"><p>神・舎利は古木感を生む上級技法です。加工した部分は元に戻りません。</p>{selectedPart === 'trunk' ? <div className="two-buttons"><button type="button" onClick={() => onShari('left')}>左側へ舎利</button><button type="button" onClick={() => onShari('right')}>右側へ舎利</button></div> : <button className="primary-button" type="button" disabled={selectedPart === 'roots' || part.deadwood || bonsai.vitality < 60} onClick={onJin}>この枝を神にする</button>}</div>}</section></div>;
}

function mentorTip(bonsai: NonNullable<ReturnType<typeof activeBonsai>>): string {
  if (bonsai.water < 38) return '土が乾いている。まず水を見ろ。';
  if (bonsai.vitality < 55) return '今は切る時ではない。回復を待て。';
  const disease = Object.values(bonsai.parts).some(part => part.disease || part.pest);
  if (disease) return '異変を見落とすな。展示より治療が先だ。';
  const crowded = Object.values(bonsai.parts).filter(part => part.foliage > 82).length;
  if (crowded >= 2) return '葉が重い。切る場所より、残す余白を考えろ。';
  return '急いで完成させるな。十年後の姿を見ろ。';
}

export function RecoveryPanel({ error }: { error: Error }) {
  const [working, setWorking] = useState(false);
  return <main className="fatal-screen"><div className="onboard-brand">BONSAI</div><section><h1>起動を修復できます</h1><p>セーブデータは残したまま、古いキャッシュとService Workerだけを削除します。</p><pre>{error.message}</pre><button type="button" disabled={working} onClick={async () => { setWorking(true); await repairRuntimeCaches(); location.reload(); }}>{working ? '修復しています…' : '起動を修復する'}</button></section></main>;
}
