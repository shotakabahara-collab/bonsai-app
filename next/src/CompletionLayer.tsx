import { useEffect, useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import {
  PEOPLE,
  SPECIES,
  activeBonsai,
  createBonsai,
  exhibitionScore,
  titleForReputation,
  visualSignature,
  weekKey,
  type BonsaiState,
  type GameState,
  type SpeciesId
} from './model';
import { loadGame, persistGame } from './storage';

const GAME_EVENT = 'bonsai:game-updated';
const OFFER_KEY = 'bonsai:offers:v1';
const ARCHIVE_KEY = 'bonsai:visual-archive:v1';
const MATERIAL_PRICE = 1800;

type CompletionTab = 'grow' | 'pots' | 'show' | 'people' | 'memorial';
type Panel = 'offers' | 'field' | 'archive' | null;
type OfferKind = 'purchase' | 'hotelRental' | 'restaurantRental';

interface OfferRecord {
  id: string;
  awardId: string;
  bonsaiId: string;
  kind: OfferKind;
  issuer: string;
  title: string;
  amount: number;
  score: number;
  createdAt: number;
  expiresAt: number;
}

interface ArchiveRecord {
  id: string;
  bonsaiId: string;
  at: number;
  reason: string;
  signature: string;
  fingerprint: string;
  bonsai: BonsaiState;
}

interface FieldEntry {
  id: string;
  name: string;
  title: string;
  work: string;
  score: number;
  player?: boolean;
}

export function CompletionLayer() {
  const [game, setGame] = useState<GameState>(() => loadGame());
  const [tab, setTab] = useState<CompletionTab>('grow');
  const [panel, setPanel] = useState<Panel>(null);
  const [offers, setOffers] = useState<OfferRecord[]>(() => loadOffers());
  const [archive, setArchive] = useState<ArchiveRecord[]>(() => loadArchive());

  const bonsai = activeBonsai(game);

  useEffect(() => {
    const onGame = (event: Event) => {
      const detail = (event as CustomEvent<GameState>).detail;
      setGame(detail ?? loadGame());
    };
    window.addEventListener(GAME_EVENT, onGame);
    return () => window.removeEventListener(GAME_EVENT, onGame);
  }, []);

  useEffect(() => {
    const detect = () => {
      const active = document.querySelector<HTMLButtonElement>('.bottom-nav button.active');
      const label = active?.textContent ?? '';
      const next: CompletionTab = label.includes('鉢') ? 'pots'
        : label.includes('大会') ? 'show'
          : label.includes('人物') ? 'people'
            : label.includes('銘木録') ? 'memorial'
              : 'grow';
      setTab(next);
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', detect, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', detect, true);
    };
  }, []);

  useEffect(() => {
    if (!game.started) return;
    const nextOffers = generateOffers(game, loadOffers());
    saveOffers(nextOffers);
    setOffers(nextOffers);

    const nextArchive = synchronizeArchive(game, loadArchive());
    saveArchive(nextArchive);
    setArchive(nextArchive);
  }, [game]);

  const field = useMemo(() => buildField(game), [game]);
  const activeOffers = offers.filter(offer => offer.expiresAt > Date.now());
  const activeArchive = bonsai ? archive.filter(item => item.bonsaiId === bonsai.id) : [];

  if (!game.started || !bonsai) return null;

  const closePanel = () => setPanel(null);

  const dismissOffer = (offerId: string) => {
    const next = offers.filter(item => item.id !== offerId);
    saveOffers(next);
    setOffers(next);
  };

  const acceptRental = (offer: OfferRecord) => {
    const next = structuredClone(game);
    const tree = next.bonsai.find(item => item.id === offer.bonsaiId);
    if (!tree) return dismissOffer(offer.id);
    next.money += offer.amount;
    next.reputation += offer.kind === 'hotelRental' ? 7 : 5;
    tree.logs.unshift({
      id: uid(),
      at: Date.now(),
      text: `${offer.issuer}へ作品を貸し出し、¥${offer.amount.toLocaleString('ja-JP')}を受け取った。`
    });
    persistGame(next);
    setGame(next);
    dismissOffer(offer.id);
  };

  const acceptPurchase = (offer: OfferRecord, replacementSpecies: SpeciesId) => {
    const next = structuredClone(game);
    const index = next.bonsai.findIndex(item => item.id === offer.bonsaiId);
    if (index < 0) return dismissOffer(offer.id);

    const sold = next.bonsai[index];
    const soldArchive = createArchiveRecord(sold, '富豪へ売却する直前の最終姿');
    const archiveNext = [soldArchive, ...loadArchive()].slice(0, 80);
    saveArchive(archiveNext);
    setArchive(archiveNext);

    const replacement = createBonsai(replacementSpecies, `${SPECIES[replacementSpecies].name}・新素材`);
    replacement.logs.unshift({
      id: uid(),
      at: Date.now(),
      text: `${sold.name}を${offer.issuer}へ¥${offer.amount.toLocaleString('ja-JP')}で売却し、新しい素材を迎えた。`
    });
    next.bonsai[index] = replacement;
    next.activeBonsaiId = replacement.id;
    next.money += Math.max(0, offer.amount - MATERIAL_PRICE);
    next.reputation += 12;
    persistGame(next);
    setGame(next);

    const remaining = offers.filter(item => item.bonsaiId !== offer.bonsaiId);
    saveOffers(remaining);
    setOffers(remaining);
    setPanel(null);
  };

  return (
    <>
      <div className={`completion-dock completion-dock-${tab}`} aria-label="完成版追加機能">
        {tab === 'show' && <button type="button" onClick={() => setPanel('field')}>👥 出展作品</button>}
        {activeOffers.length > 0 && <button className="offer-button" type="button" onClick={() => setPanel('offers')}>✉️ オファー {activeOffers.length}</button>}
        {tab === 'memorial' && <button type="button" onClick={() => setPanel('archive')}>📷 作品写真 {activeArchive.length}</button>}
      </div>

      {panel && (
        <div className="completion-backdrop" role="dialog" aria-modal="true" aria-label={panelTitle(panel)}>
          <section className="completion-panel">
            <header>
              <div><span className="completion-kicker">BONSAI</span><h2>{panelTitle(panel)}</h2></div>
              <button type="button" aria-label="閉じる" onClick={closePanel}>×</button>
            </header>

            {panel === 'field' && (
              <div className="field-list">
                <p className="completion-copy">同時ログインしていない盆栽師の作品も、今週の同じ評論会へ非同期出展しています。</p>
                {field.map((entry, index) => (
                  <article key={entry.id} className={entry.player ? 'player-entry' : ''}>
                    <strong>{index + 1}</strong>
                    <div><b>{entry.name}</b><small>{entry.title}・「{entry.work}」</small></div>
                    <em>{entry.score}点</em>
                  </article>
                ))}
              </div>
            )}

            {panel === 'offers' && (
              <div className="offer-list">
                {activeOffers.length === 0 && <p className="completion-empty">現在届いているオファーはありません。</p>}
                {activeOffers.map(offer => (
                  <article key={offer.id} className={`offer-card offer-${offer.kind}`}>
                    <span>{offerIcon(offer.kind)}</span>
                    <div className="offer-copy">
                      <small>{offer.title}・評価 {offer.score}点</small>
                      <h3>{offer.issuer}</h3>
                      <p>{offerMessage(offer)}</p>
                      <b>提示額 ¥{offer.amount.toLocaleString('ja-JP')}</b>
                    </div>
                    {offer.kind === 'purchase' ? (
                      <div className="replacement-grid">
                        {(Object.keys(SPECIES) as SpeciesId[]).map(species => (
                          <button key={species} type="button" onClick={() => acceptPurchase(offer, species)}>
                            {SPECIES[species].emoji} 売却して{SPECIES[species].name}へ買替
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button className="completion-primary" type="button" onClick={() => acceptRental(offer)}>貸出を受ける</button>
                    )}
                    <button className="completion-secondary" type="button" onClick={() => dismissOffer(offer.id)}>今回は断る</button>
                  </article>
                ))}
              </div>
            )}

            {panel === 'archive' && (
              <div className="archive-list">
                <p className="completion-copy">剪定、鉢替え、受賞、病害虫、神・舎利など、作品の姿が変わった節目を同じ個体の状態画像として保存します。</p>
                {activeArchive.length === 0 && <p className="completion-empty">状態画像はまだありません。</p>}
                {activeArchive.map(item => (
                  <article key={item.id} className="archive-card">
                    <BonsaiStage bonsai={item.bonsai} />
                    <div><time>{new Date(item.at).toLocaleString('ja-JP')}</time><b>{item.reason}</b><small>{item.signature.slice(0, 72)}…</small></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function panelTitle(panel: Exclude<Panel, null>): string {
  return panel === 'offers' ? '届いたオファー' : panel === 'field' ? '今週の出展作品' : '作品状態アーカイブ';
}

function offerIcon(kind: OfferKind): string {
  return kind === 'purchase' ? '🤵' : kind === 'hotelRental' ? '🏨' : '🍽️';
}

function offerMessage(offer: OfferRecord): string {
  if (offer.kind === 'purchase') return '作品を正式に買い取りたいという依頼です。売却前の姿は銘木録へ永久保存されます。';
  if (offer.kind === 'hotelRental') return 'ロビーの季節展示として一定期間借りたいという依頼です。作品の所有権は残ります。';
  return '特別席のしつらえとして借りたいという依頼です。作品の所有権は残ります。';
}

function loadOffers(): OfferRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(OFFER_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isOffer).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveOffers(offers: OfferRecord[]): void {
  try { localStorage.setItem(OFFER_KEY, JSON.stringify(offers.slice(0, 12))); } catch {}
}

function isOffer(value: unknown): value is OfferRecord {
  const item = value as Partial<OfferRecord> | null;
  return Boolean(item && typeof item.id === 'string' && typeof item.bonsaiId === 'string' && typeof item.amount === 'number');
}

function generateOffers(game: GameState, current: OfferRecord[]): OfferRecord[] {
  const now = Date.now();
  const valid = current.filter(item => item.expiresAt > now && game.bonsai.some(tree => tree.id === item.bonsaiId));
  const known = new Set(valid.map(item => item.id));
  const generated = [...valid];

  for (const tree of game.bonsai) {
    for (const award of tree.awards.slice(0, 6)) {
      if (award.score < 76) continue;
      const seed = hash(`${award.id}:${tree.id}:${award.score}`);
      const rentalKind: OfferKind = seed % 2 ? 'hotelRental' : 'restaurantRental';
      const rentalId = `offer:${award.id}:${rentalKind}`;
      if (!known.has(rentalId)) {
        const issuer = rentalKind === 'hotelRental' ? 'ホテル翠嶺 東京' : '料亭 月白';
        const amount = Math.round(650 + award.score * 16 + (seed % 520));
        generated.push({
          id: rentalId, awardId: award.id, bonsaiId: tree.id, kind: rentalKind, issuer,
          title: rentalKind === 'hotelRental' ? '館内展示・貸出依頼' : '季節席・貸出依頼',
          amount, score: award.score, createdAt: now, expiresAt: now + 14 * 86_400_000
        });
        known.add(rentalId);
      }

      if (award.score >= 82 || award.rank === 1) {
        const purchaseId = `offer:${award.id}:purchase`;
        if (!known.has(purchaseId)) {
          const amount = Math.round(6200 + award.score * 115 + game.reputation * 18 + (seed % 2400));
          generated.push({
            id: purchaseId, awardId: award.id, bonsaiId: tree.id, kind: 'purchase', issuer: PEOPLE[6]?.name ?? '名木収集家',
            title: '名木・購入希望', amount, score: award.score, createdAt: now, expiresAt: now + 21 * 86_400_000
          });
          known.add(purchaseId);
        }
      }
    }
  }
  return generated.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
}

function loadArchive(): ArchiveRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isArchive).slice(0, 80) : [];
  } catch {
    return [];
  }
}

function saveArchive(records: ArchiveRecord[]): void {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(records.slice(0, 80))); } catch {}
}

function isArchive(value: unknown): value is ArchiveRecord {
  const item = value as Partial<ArchiveRecord> | null;
  return Boolean(item && typeof item.id === 'string' && typeof item.bonsaiId === 'string' && item.bonsai && typeof item.bonsai === 'object');
}

function synchronizeArchive(game: GameState, current: ArchiveRecord[]): ArchiveRecord[] {
  const next = [...current];
  let changed = false;
  for (const tree of game.bonsai) {
    const fingerprint = archiveFingerprint(tree);
    const previous = next.find(item => item.bonsaiId === tree.id);
    if (previous?.fingerprint === fingerprint) continue;
    next.unshift(createArchiveRecord(tree, archiveReason(tree, previous?.bonsai)));
    changed = true;
  }
  return changed ? next.slice(0, 80) : current;
}

function createArchiveRecord(tree: BonsaiState, reason: string): ArchiveRecord {
  const snapshot = structuredClone(tree);
  snapshot.logs = snapshot.logs.slice(0, 12);
  snapshot.awards = snapshot.awards.slice(0, 12);
  snapshot.memorials = [];
  return {
    id: uid(),
    bonsaiId: tree.id,
    at: Date.now(),
    reason,
    signature: visualSignature(tree),
    fingerprint: archiveFingerprint(tree),
    bonsai: snapshot
  };
}

function archiveFingerprint(tree: BonsaiState): string {
  const state = visualSignature(tree).replace(/^(.*?):(.*?):\d+:\d+:/, (_all, species, pot) => `${species}:${pot}:${Math.round(tree.water / 10)}:${Math.round(tree.vitality / 10)}:`);
  return `${state}:awards${tree.awards.length}`;
}

function archiveReason(tree: BonsaiState, previous?: BonsaiState): string {
  if (!previous) return '初期状態・継承時の姿';
  if (previous.potId !== tree.potId) return '鉢替え後の作品';
  if (previous.awards.length !== tree.awards.length) return tree.awards[0]?.title ? `${tree.awards[0].title}受賞時` : '展覧会出展時';
  if (previous.shari?.level !== tree.shari?.level) return '舎利を入れた後の姿';
  for (const [id, part] of Object.entries(tree.parts)) {
    const before = previous.parts[id as keyof typeof previous.parts];
    if (!before) continue;
    if (before.pruneLevel !== part.pruneLevel || before.foliage !== part.foliage) return '不可逆剪定後の姿';
    if (before.deadwood !== part.deadwood) return '神を作成した後の姿';
    if (before.disease !== part.disease || before.pest !== part.pest) return part.disease || part.pest ? '病害虫発生時' : '病害虫回復後';
    if (JSON.stringify(before.wire) !== JSON.stringify(part.wire)) return '整姿・針金作業後';
  }
  return '樹勢・水分状態の節目';
}

function buildField(game: GameState): FieldEntry[] {
  const tree = activeBonsai(game);
  if (!tree) return [];
  const seed = hash(`${weekKey()}:${game.playerName}:${tree.id}`);
  const profiles = [
    ['翠川みのり', '紅葉を待つ人', '山もみじ・夕映'],
    ['風間宗樹', '松柏の旅人', '黒松・潮騒'],
    ['花守あかり', '季節の編者', '皐月・花筏'],
    ['結城庵', '古鉢蒐集家', '真柏・石庭'],
    ['岩城 岳斗', '松柏専門・若手筆頭', '黒松・不動'],
    ['橘 蓮', '現代盆栽アーティスト', '五葉松・余白']
  ];
  const entries: FieldEntry[] = profiles.map((profile, index) => ({
    id: `async-${index}`,
    name: profile[0],
    title: profile[1],
    work: profile[2],
    score: 59 + ((seed * (index + 5) * 17) % 34)
  }));
  entries.push({
    id: 'player', name: game.playerName, title: titleForReputation(game.reputation), work: tree.name,
    score: exhibitionScore(tree).score, player: true
  });
  return entries.sort((a, b) => b.score - a.score);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
