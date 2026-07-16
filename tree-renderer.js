(()=>{'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
function render(s,species,pots,season,d){
  const sp=species[s.sp],pot=pots.find(x=>x[0]===s.pot)||pots[0];
  const autumn=season===2&&s.sp==='maple';
  const leaf=autumn?'#b85b37':sp.leaf;
  const flower=s.sp==='azalea'&&season===0;
  const prune=Number(s.prune||0),wireCount=Number(s.wire||0);
  const leafShape=(x,y,sc,rot,i)=>{
    if(s.sp==='pine'){
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})" opacity="${(.72+rand(i)*.25).toFixed(2)}"><path d="M-${(8*sc).toFixed(1)} 0 L${(8*sc).toFixed(1)} 0 M0 -${(6*sc).toFixed(1)} L0 ${(6*sc).toFixed(1)} M-${(6*sc).toFixed(1)} -${(4*sc).toFixed(1)} L${(6*sc).toFixed(1)} ${(4*sc).toFixed(1)} M-${(6*sc).toFixed(1)} ${(4*sc).toFixed(1)} L${(6*sc).toFixed(1)} -${(4*sc).toFixed(1)}" stroke="url(#leafG)" stroke-width="${(1.35*sc).toFixed(2)}" stroke-linecap="round"/></g>`;
    }
    const w=6.2*sc,h=3.2*sc;
    return `<path d="M${(x-w).toFixed(1)} ${y.toFixed(1)} Q${x.toFixed(1)} ${(y-h*1.6).toFixed(1)} ${(x+w).toFixed(1)} ${y.toFixed(1)} Q${x.toFixed(1)} ${(y+h*1.6).toFixed(1)} ${(x-w).toFixed(1)} ${y.toFixed(1)}Z" fill="url(#leafG)" opacity="${(.7+rand(i)*.28).toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  };
  const pad=(cx,cy,rx,ry,seed,count)=>{
    const a=[];
    for(let i=0;i<count;i++){
      const ang=rand(seed+i*3.1)*Math.PI*2,r=Math.sqrt(rand(seed+i*7.3));
      const x=cx+Math.cos(ang)*rx*r,y=cy+Math.sin(ang)*ry*r*.82;
      const sc=.55+rand(seed+i*5.7)*.75,rot=-70+rand(seed+i*9.1)*140;
      a.push(leafShape(x,y,sc,rot,seed+i));
      if(flower&&i%11===0)a.push(`<circle cx="${(x+3).toFixed(1)}" cy="${(y-2).toFixed(1)}" r="${(2.8+rand(i)*2.2).toFixed(1)}" fill="url(#flowerG)" opacity=".95"/>`);
    }
    return `<g>${a.join('')}</g>`;
  };
  let pads=[[166,118,84,38,11,48],[277,84,79,34,31,44],[376,121,76,37,59,46],[222,166,92,43,83,54],[337,172,88,40,113,52],[154,205,67,34,149,36],[284,220,100,43,181,58]];
  const keep=clamp(pads.length-Math.floor(prune/2),4,pads.length);
  pads=pads.slice(0,keep);
  const density=clamp(1-prune*.025,.72,1);
  const foliage=pads.map(p=>pad(p[0],p[1],p[2],p[3],p[4],Math.round(p[5]*density))).join('');
  const wire=wireCount?`<path d="M270 310 C246 263 287 226 252 181 C226 145 245 111 271 70" fill="none" stroke="#b87333" stroke-width="2.6" opacity=".5" stroke-dasharray="4 7"/>`:'';
  const potBody=pot[4];
  return `<svg class="tree" viewBox="0 0 520 390" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.n}の盆栽">
  <defs>
    <linearGradient id="barkG" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#2b1912"/><stop offset=".23" stop-color="#6f432d"/><stop offset=".47" stop-color="#3d2419"/><stop offset=".7" stop-color="#895c3c"/><stop offset="1" stop-color="#251610"/></linearGradient>
    <linearGradient id="barkHi" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c08a5b" stop-opacity=".68"/><stop offset="1" stop-color="#3a2118" stop-opacity="0"/></linearGradient>
    <radialGradient id="leafG" cx="35%" cy="28%"><stop stop-color="${autumn?'#e39a61':'#7ca878'}"/><stop offset=".48" stop-color="${leaf}"/><stop offset="1" stop-color="#153624"/></radialGradient>
    <radialGradient id="flowerG"><stop stop-color="#fff4f5"/><stop offset=".45" stop-color="#e9a2ae"/><stop offset="1" stop-color="#9d4860"/></radialGradient>
    <linearGradient id="potG" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".2"/><stop offset=".14" stop-color="${potBody}"/><stop offset=".72" stop-color="${potBody}"/><stop offset="1" stop-color="#000" stop-opacity=".46"/></linearGradient>
    <linearGradient id="soilG" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#66774a"/><stop offset=".22" stop-color="#30432d"/><stop offset=".28" stop-color="#4b382a"/><stop offset="1" stop-color="#1c1511"/></linearGradient>
    <filter id="treeShadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="13" stdDeviation="10" flood-color="#000" flood-opacity=".48"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="5"/></filter>
    <pattern id="barkTex" width="18" height="30" patternUnits="userSpaceOnUse"><path d="M4 0 Q10 8 5 15 T8 30" fill="none" stroke="#d5a47c" stroke-opacity=".21" stroke-width="2"/><path d="M13 2 Q7 11 13 20 T11 30" fill="none" stroke="#1d100c" stroke-opacity=".4" stroke-width="2"/></pattern>
  </defs>
  <ellipse cx="260" cy="360" rx="150" ry="18" fill="#000" opacity=".38" filter="url(#soft)"/>
  <g filter="url(#treeShadow)">
    <path d="M267 322 C247 284 269 254 261 224 C251 188 225 169 237 133 C245 107 269 94 267 61" stroke="url(#barkG)" stroke-width="36" fill="none" stroke-linecap="round"/>
    <path d="M266 320 C257 279 279 254 269 219 C258 182 240 168 250 134 C257 111 276 96 275 63" stroke="url(#barkHi)" stroke-width="10" fill="none" stroke-linecap="round" opacity=".75"/>
    <path d="M267 322 C247 284 269 254 261 224 C251 188 225 169 237 133 C245 107 269 94 267 61" stroke="url(#barkTex)" stroke-width="28" fill="none" stroke-linecap="round" opacity=".82"/>
    <g fill="none" stroke="url(#barkG)" stroke-linecap="round"><path d="M250 145 C214 135 182 120 151 92" stroke-width="17"/><path d="M252 169 C200 171 160 165 121 146" stroke-width="15"/><path d="M261 129 C304 118 334 96 365 72" stroke-width="16"/><path d="M263 187 C310 177 351 152 397 121" stroke-width="15"/><path d="M258 220 C215 220 178 213 142 195" stroke-width="13"/><path d="M264 231 C310 229 346 214 381 191" stroke-width="12"/><path d="M268 92 C289 83 309 70 323 51" stroke-width="10"/></g>
    <g fill="none" stroke="#a97650" stroke-linecap="round" opacity=".52"><path d="M250 145 C214 135 182 120 151 92" stroke-width="4"/><path d="M261 129 C304 118 334 96 365 72" stroke-width="4"/><path d="M263 187 C310 177 351 152 397 121" stroke-width="3"/></g>
    ${wire}${foliage}
    <g><ellipse cx="260" cy="319" rx="112" ry="24" fill="url(#soilG)"/><path d="M184 318 Q260 291 337 318" fill="none" stroke="#75865b" stroke-width="8" opacity=".82"/><path d="M229 315 Q248 303 266 317 M275 316 Q293 301 312 318" stroke="#91a971" stroke-width="5" fill="none" stroke-linecap="round" opacity=".72"/></g>
    <g><rect x="145" y="320" width="230" height="27" rx="7" fill="url(#potG)"/><path d="M157 344 H363 L339 384 H181 Z" fill="url(#potG)"/><path d="M183 384 h39 l-5 8 h-31z M298 384h39l-3 8h-32z" fill="#1d1714"/><path d="M160 329 H360" stroke="#fff" stroke-opacity=".18" stroke-width="2"/></g>
  </g></svg>`;
}
window.BonsaiVisual={render};
})();
