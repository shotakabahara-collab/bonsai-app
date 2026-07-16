# Photo integration diagnostic

- status: PASS

## detail

```text
inline JavaScript parsed successfully
```

## svg excerpt

```javascript
10:3;s.stats.shows++;s.lastWeek=week();s.awards.unshift({at:Date.now(),score:me,rank:r,award,field});log(`${award}。${field.length}作品中${r}位、${me}点。`);save();modal='result';render()}function svg(){if(s.sp==='pine'&&window.BonsaiPhotos&&window.BonsaiPhotos.pine){return `<figure class="photo-bonsai"><img src="${window.BonsaiPhotos.pine}" alt="実写品質で撮影された黒松盆栽" draggable="false"></figure>`}return window.BonsaiVisual.render(s,SP,POTS,season(),d())}function home(){let x=d(),tip=x.w<45?'土が乾いている。水を急げ。':x.s>30?'今は触らず回復を待て。':'急いで完成させるな。十年後の姿を見ろ。';return`<div class="card"><div class="head"><span class="badge">${rank()}</span><h1>${esc(s.tree)}</h1><div class="small">${SP[s.sp][0]}・樹齢${days().toFixed(1)}年・${POTS.find(p=>p[0]===s.pot)[1]}</div></div><div class="stage">${svg()}<div class="metrics"><div class="metric"><b>${Math.round(x.w)}%</b><span>水分</span></div><div class="metric"><b>${Math.round(x.v)}%</b><span>樹勢</span></div><div class="metric"><b>${Math.round(x.m)}%</b><span>作品性</span></div></div></div><div class="actions"><bu
```
