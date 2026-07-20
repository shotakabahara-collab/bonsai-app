import { useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import {
  PEOPLE,
  SPECIES,
  createBonsai,
  type BonsaiState,
  type GameState,
  type SpeciesId
} from './model';
import { activeSaveSlot, listSaveSlots, resetSaveSlot, switchSaveSlot, type SaveSlotId, type SaveSlotSummary } from './storage';

const LESSONS = [
  {
    icon: '✂️',
    title: '剪定は、未来を選ぶ',
    effect: '残した芽と枝へ力が集まり、樹形と芽吹きが変わります。',
    risk: '切った枝は戻りません。季節外や衰弱時には病気、枯れ込み、枯死の危険が上がります。'
  },
  {
    icon: '🪢',
    title: '針金は、時間を掛ける',
    effect: '枝角度は養成期間を経て定着します。軽針金と強針金で速度と負担が異なります。',
    risk: '早く外すと戻り、遅いと食い込み傷が残ります。装着中は品評会へ出せません。'
  },
  {
    icon: '🪵',
    title: '神・舎利は、古さを育てる',
    effect: '剥離、乾燥、繊維整形、保護、風化を経て古木の景色になります。',
    risk: '加工は不可逆です。強度が高いほど樹勢を消耗し、未完成中は品評会へ出せません。'
  },
  {
    icon: '🩺',
    title: '失敗も一本の履歴になる',
    effect: '病害虫や衰弱から回復させた履歴も、同じ作品へ残ります。',
    risk: '無理な作業を重ねると成長が止まり、最悪の場合はその一本が枯死します。'
  }
] as const;

export function StoryOnboarding({ onStart }: {
  onStart: (player: string, mentor: string, species: SpeciesId, tree: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [player, setPlayer] = useState('');
  const [tree, setTree] = useState('');
  const [species, setSpecies] = useState<SpeciesId>('pine');
  const [mentor, setMentor] = useState('gensai');
  const [slotMenuOpen, setSlotMenuOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<SaveSlotId>(() => activeSaveSlot());
  const [slotSummaries, setSlotSummaries] = useState(() => listSaveSlots());
  const preview = useMemo(() => createBonsai(species, `${SPECIES[species].name}・素材`), [species]);
  const mentorData = PEOPLE.find(person => person.id === mentor) ?? PEOPLE[0];

  return (
    <main className="story-onboarding" data-testid="onboarding" data-story-step={step}>
      <div className="story-atmosphere" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="story-brand"><b>BONSAI</b><span>一本の木に、判断の物語を刻む。</span></header>
      <button className="story-save-button" type="button" aria-label="セーブデータを開く" onClick={() => { setSlotSummaries(listSaveSlots()); setSlotMenuOpen(true); }}>三つの時間軸・セーブ{currentSlot}</button>
      <div className="story-progress" aria-label={`序章 ${step + 1}/5`}>
        {Array.from({ length: 5 }, (_, index) => <i key={index} className={index <= step ? 'active' : ''} />)}
      </div>

      {step === 0 && (
        <section className="story-scene prologue-scene">
          <div className="story-moon" aria-hidden="true" />
          <div className="story-tree-silhouette" aria-hidden="true">🌲</div>
          <div className="story-dialogue">
            <small>序章・雨上がりの盆栽園</small>
            <p>閉園間際。一本の若木の前で足を止めたあなたへ、奥から声が掛かる。</p>
            <blockquote>「完成した木を探すな。お前が十年を預けられる木を探せ。」</blockquote>
          </div>
          <button className="story-primary" type="button" onClick={() => setStep(1)}>声の主を追う</button>
        </section>
      )}

      {step === 1 && (
        <section className="story-scene mentor-scene">
          <div className="story-scene-heading"><small>第一章・師匠との出会い</small><h1>誰の眼で、木を学ぶか</h1><p>助言は答えではありません。最後に切るのは、あなたです。</p></div>
          <div className="mentor-story-list">
            {PEOPLE.slice(0, 3).map(person => (
              <button key={person.id} type="button" className={mentor === person.id ? 'selected' : ''} onClick={() => setMentor(person.id)}>
                <span className="mentor-story-face">{person.emoji}</span>
                <span><b>{person.name}</b><small>{person.role}</small><em>「{person.quote}」</em></span>
              </button>
            ))}
          </div>
          <div className="story-dialogue compact"><blockquote>師匠 {mentorData.name}「まず素材を見ろ。名前は、その後だ。」</blockquote></div>
          <button className="story-primary" type="button" onClick={() => setStep(2)}>素材棚へ進む</button>
          <button className="story-back" type="button" onClick={() => setStep(0)}>戻る</button>
        </section>
      )}

      {step === 2 && (
        <section className="story-scene material-scene">
          <div className="story-scene-heading"><small>第二章・樹木選定</small><h1>最初の一本を選ぶ</h1><p>育てやすさではなく、向き合いたい変化で選びます。</p></div>
          <div className="material-preview"><BonsaiStage bonsai={preview} /><span>候補素材・{SPECIES[species].name}</span></div>
          <div className="story-species-grid">
            {(Object.keys(SPECIES) as SpeciesId[]).map(id => (
              <button key={id} type="button" className={species === id ? 'selected' : ''} onClick={() => setSpecies(id)}>
                <span>{SPECIES[id].emoji}</span><b>{SPECIES[id].name}</b><small>{SPECIES[id].subtitle}</small>
                <em>{id === 'pine' ? '剪定と針金の王道' : id === 'maple' ? '芽吹きと季節変化' : '花と枝作りの両立'}</em>
              </button>
            ))}
          </div>
          <button className="story-primary" type="button" onClick={() => setStep(3)}>最初の講義を受ける</button>
          <button className="story-back" type="button" onClick={() => setStep(1)}>戻る</button>
        </section>
      )}

      {step === 3 && (
        <section className="story-scene lesson-scene">
          <div className="story-scene-heading"><small>第三章・最初の講義</small><h1>美しさには、代償がある</h1><p>ボタンの効果ではなく、一本に残る結果を理解してから作業します。</p></div>
          <div className="lesson-card-grid">
            {LESSONS.map(lesson => (
              <article key={lesson.title}><span>{lesson.icon}</span><div><b>{lesson.title}</b><p>{lesson.effect}</p><small>{lesson.risk}</small></div></article>
            ))}
          </div>
          <div className="story-dialogue compact"><blockquote>「失敗を避けるだけでは作品にならん。何を失うか分かった上で、選べ。」</blockquote></div>
          <button className="story-primary" type="button" onClick={() => setStep(4)}>一本に名を付ける</button>
          <button className="story-back" type="button" onClick={() => setStep(2)}>戻る</button>
        </section>
      )}

      {step === 4 && (
        <section className="story-scene naming-scene">
          <div className="story-scene-heading"><small>第四章・入門</small><h1>今日から、この木の時間を預かる</h1><p>セーブは3つ用意されています。別の一本を、別の判断で育てられます。</p></div>
          <div className="naming-tree"><BonsaiStage bonsai={preview} /></div>
          <label>盆栽師名<input value={player} onChange={event => setPlayer(event.target.value)} placeholder="あなた" maxLength={30} /></label>
          <label>作品の銘<input value={tree} onChange={event => setTree(event.target.value)} placeholder={`${SPECIES[species].name}・若樹`} maxLength={40} /></label>
          <button className="story-primary" data-testid="start-game" type="button" onClick={() => onStart(player, mentor, species, tree)}>この一本と始める</button>
          <button className="story-back" type="button" onClick={() => setStep(3)}>戻る</button>
        </section>
      )}
      {slotMenuOpen && (
        <SaveSlotSheet
          currentSlot={currentSlot}
          slots={slotSummaries}
          onClose={() => setSlotMenuOpen(false)}
          onReplay={() => { setSlotMenuOpen(false); setStep(3); }}
          onSwitch={slotId => {
            switchSaveSlot(slotId);
            setCurrentSlot(slotId);
            window.location.reload();
          }}
          onReset={slotId => {
            if (!window.confirm(`セーブ${slotId}を消去して最初から始めます。元に戻せません。`)) return;
            resetSaveSlot(slotId);
            setCurrentSlot(slotId);
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}

export function SaveSlotSheet({ currentSlot, slots, onSwitch, onReset, onReplay, onClose }: {
  currentSlot: SaveSlotId;
  slots: SaveSlotSummary[];
  onSwitch: (slot: SaveSlotId) => void;
  onReset: (slot: SaveSlotId) => void;
  onReplay: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop save-slot-backdrop" role="dialog" aria-modal="true" aria-label="セーブデータ管理">
      <section className="save-slot-sheet">
        <header><div><small>三つの時間軸</small><h2>セーブデータ</h2></div><button type="button" aria-label="閉じる" onClick={onClose}>✕</button></header>
        <p>それぞれ独立した盆栽師人生です。スロットを切り替えても、他のデータは変わりません。</p>
        <div className="save-slot-list">
          {slots.map(slot => (
            <article key={slot.id} className={`${slot.id === currentSlot ? 'active' : ''} ${slot.started ? '' : 'empty'}`}>
              <div className="slot-number">{slot.id}</div>
              <div className="slot-copy">
                <small>{slot.id === currentSlot ? '現在使用中' : slot.started ? '保存済み' : '空きスロット'}</small>
                <b>{slot.started ? slot.treeName : '新しい物語'}</b>
                <span>{slot.started ? `${slot.species ? SPECIES[slot.species].name : ''}・${slot.playerName}` : '師匠との出会いから始める'}</span>
                {slot.updatedAt > 0 && <time>{new Date(slot.updatedAt).toLocaleString('ja-JP')}</time>}
              </div>
              <button type="button" disabled={slot.id === currentSlot} onClick={() => onSwitch(slot.id)}>{slot.id === currentSlot ? '選択中' : slot.started ? '切替' : '開始'}</button>
            </article>
          ))}
        </div>
        <button className="save-replay" type="button" onClick={onReplay}>📖 序章と技法解説を見返す</button>
        <button className="save-reset" type="button" onClick={() => onReset(currentSlot)}>現在のスロットを消去して最初から</button>
        <button className="ghost-button" type="button" onClick={onClose}>閉じる</button>
      </section>
    </div>
  );
}

export function TutorialReplay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const lesson = LESSONS[page];
  return (
    <div className="modal-backdrop tutorial-replay" role="dialog" aria-modal="true" aria-label="技法解説">
      <section>
        <header><small>師匠の技法帳 {page + 1}/{LESSONS.length}</small><button type="button" onClick={onClose}>✕</button></header>
        <div className="replay-icon">{lesson.icon}</div><h2>{lesson.title}</h2><p>{lesson.effect}</p><blockquote>{lesson.risk}</blockquote>
        <div className="replay-dots">{LESSONS.map((_, index) => <button key={index} type="button" className={index === page ? 'active' : ''} onClick={() => setPage(index)} aria-label={`${index + 1}ページ`} />)}</div>
        <button className="primary-button" type="button" onClick={() => page < LESSONS.length - 1 ? setPage(page + 1) : onClose()}>{page < LESSONS.length - 1 ? '次の技法' : '技法帳を閉じる'}</button>
      </section>
    </div>
  );
}

type JourneyAction = 'water' | 'prune' | 'wire' | 'deadwood' | 'show' | 'wall';

export function JourneyCard({ game, bonsai, onAction }: { game: GameState; bonsai: BonsaiState; onAction: (action: JourneyAction) => void }) {
  const text = bonsai.logs.map(item => item.text).join('\n');
  const missions: Array<{ title: string; copy: string; done: boolean; action: JourneyAction; actionLabel: string; mentor: string }> = [
    { title: '一本を迎える', copy: '師匠と素材を選び、作品に名を付ける。', done: game.started, action: 'wall', actionLabel: '迎えた一本を見る', mentor: '名前を付けた瞬間から、この木の時間はお前のものだ。' },
    { title: '木の呼吸を読む', copy: '最初の水やりを行い、樹勢と水分の変化を見る。', done: /水を与え|水やり/.test(text), action: 'water', actionLabel: '最初の水を与える', mentor: '乾きだけを見るな。葉の張りと鉢の重さを覚えろ。' },
    { title: '残す芽を選ぶ', copy: '写真をタップして部位を選び、最初の剪定判断を残す。', done: /剪定|芽摘み|芽かき|葉透かし|切り戻し/.test(text), action: 'prune', actionLabel: '枝を見て判断する', mentor: '切る場所より、残した先の十年を見ろ。' },
    { title: '枝へ時間を掛ける', copy: '軽針金または強針金で一本の枝を養成する。', done: /針金/.test(text) || Object.values(bonsai.parts).some(part => part.wire), action: 'wire', actionLabel: '枝へ針金を掛ける', mentor: '曲げるのは一瞬でも、定着は時間が決める。' },
    { title: '古木の景色を始める', copy: '神または舎利の不可逆な工程を始める。', done: bonsai.craft.deadwoodProjects.length > 0 || Boolean(bonsai.shari), action: 'deadwood', actionLabel: '古木技法を学ぶ', mentor: '白くすることが目的ではない。生き筋を残して時間を刻め。' },
    { title: '作品を世に問う', copy: '出展資格を整え、品評会へ作品を出す。', done: bonsai.awards.length > 0, action: 'show', actionLabel: '出展資格を確かめる', mentor: '評価は結果だ。まず今の一本を正面から見せてみろ。' }
  ];
  const completed = missions.filter(item => item.done).length;
  const next = missions.find(item => !item.done) ?? missions[missions.length - 1];
  const complete = completed === missions.length;
  const action: JourneyAction = complete ? 'wall' : next.action;
  const actionLabel = complete ? '現在の作品を鑑賞する' : next.actionLabel;
  const mentorLine = complete ? 'ここから先に正解はない。次の景色は、お前自身が決めろ。' : next.mentor;
  return (
    <section className="journey-card" aria-label="物語の進行">
      <header><div><small>盆栽師の道</small><b>第{Math.min(completed + 1, missions.length)}章</b></div><span>{completed}/{missions.length}</span></header>
      <div className="journey-progress"><i style={{ width: `${completed / missions.length * 100}%` }} /></div>
      <h3>{complete ? '一本の履歴が、作品になった' : next.title}</h3><p>{complete ? 'ここから先は、あなた自身の判断で次の景色を作ります。' : next.copy}</p>
      <blockquote className="journey-mentor">師匠「{mentorLine}」</blockquote>
      <button className="journey-action" type="button" onClick={() => onAction(action)}>{actionLabel}</button>
      <div className="journey-marks">{missions.map((item, index) => <i key={item.title} className={item.done ? 'done' : index === completed ? 'current' : ''}>{index + 1}</i>)}</div>
    </section>
  );
}
