(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const n of o)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function e(o){const n={};return o.integrity&&(n.integrity=o.integrity),o.referrerPolicy&&(n.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?n.credentials="include":o.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(o){if(o.ep)return;o.ep=!0;const n=e(o);fetch(o.href,n)}})();const k={GRID_WIDTH:30,GRID_HEIGHT:30,TOTAL_TILES:900,TILE_SIZE:32},H=3,ht=30,b={CAP:"CAP",CIU:"CIU",TR:"TR",MPT:"MPT",FT:"FT",AG:"AG",MPA:"MPA",FA:"FA"},G={NORMAL:"NORMAL",CONFLICT:"CONFLICT",BLOCKED:"BLOCKED"},ce={[G.NORMAL]:"#22C55E",[G.CONFLICT]:"#EAB308",[G.BLOCKED]:"#EF4444"},Lt={[b.CAP]:"#718096",[b.CIU]:"#718096",[b.TR]:"#8D5B4C",[b.MPT]:"#8D5B4C",[b.FT]:"#8D5B4C",[b.AG]:"#3182CE",[b.MPA]:"#3182CE",[b.FA]:"#3182CE"},Z=[{id:"nation-0",nationId:0,name:"Nación Amarilla",color:"#EAB308"},{id:"nation-1",nationId:1,name:"Nación Roja",color:"#EF4444"},{id:"nation-2",nationId:2,name:"Nación Verde",color:"#22C55E"},{id:"nation-3",nationId:3,name:"Nación Morada",color:"#A855F7"}],le=Z.map(a=>a.color),S={JOIN_GAME:"join_game",START_GAME:"start_game",RESTART_GAME:"restart_game",READY_PHASE_END:"ready_phase_end",SET_GAME_PAUSED:"set_game_paused",END_GAME:"end_game",GAME_STATE_UPDATE:"game_state_update",SET_TAX_RATE:"set_tax_rate",PLAYER_ACTION:"player_action",PROPOSE_OI_RESOLUTION:"propose_oi_resolution",SUBMIT_OI_VOTE:"submit_oi_vote",PROPOSE_TREATY:"propose_treaty",RESPOND_TO_TREATY:"respond_to_treaty",CANCEL_TREATY_OFFER:"cancel_treaty_offer",FINANCIAL_ACTION:"financial_action",ACTION_ERROR:"action_error"},F={NON_AGGRESSION_PACT:"NON_AGGRESSION_PACT",FREE_TRADE:"FREE_TRADE"},Y={ARMAMENT_LIMIT:"ARMAMENT_LIMIT",INDUSTRY_LIMIT:"INDUSTRY_LIMIT",DEMILITARIZED_ZONE:"DEMILITARIZED_ZONE",CONDITIONAL_SUBSIDY:"CONDITIONAL_SUBSIDY"},ut={MIN_TAX_RATE:.05,MAX_TAX_RATE:.5,DEFAULT_TAX_RATE:.2},y={ROUND_START:"ROUND_START",PLANNING:"PLANNING",RESOLVING:"RESOLVING",CLOSING:"CLOSING",INTERNATIONAL_MEETING:"INTERNATIONAL_MEETING"},pe={RESOLUTION_LOADING_THRESHOLD_MS:350},de=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],he=[[0,-1],[1,0],[0,1],[-1,0]],ue=12;function fe(a){let t=a>>>0;return function(){t|=0,t=t+1831565813|0;let i=Math.imul(t^t>>>15,1|t);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296}}function St(a,t,e,i){return a>=0&&t>=0&&a<e&&t<i}function Ut(a){return a===b.CAP?"CAPITAL":a===b.CIU?"CITY":a===b.FT||a===b.FA?"FACTORY":null}function xe(a,t,e,i=null){const o=i==null?null:Z[i];return{x:a,y:t,type:e,nationId:i,ownerId:o?o.id:null,building:Ut(e),population:0,troops:0,defense:0,status:G.NORMAL}}function X(a,t,e={}){a&&(a.type=t,a.building=Ut(t),Object.assign(a,e))}function ge(a,t,e){let i=0;for(let o=0;o<e;o++)for(let n=0;n<t;n++)a[o][n]&&(i+=1);return i}function be(a,t,e){const i=a.map(o=>o.slice());for(let o=0;o<e;o++)for(let n=0;n<t;n++){let s=0;for(const[r,c]of de){const p=n+r,l=o+c;(!St(p,l,t,e)||a[l][p])&&(s+=1)}i[o][n]=s>=5}return i}function me(a,t,e,i,o=.62,n=.78){const s=e*i;let r=ge(a,e,i);const c=p=>{const l=[];for(let h=0;h<i;h++)for(let u=0;u<e;u++)!!a[h][u]==!p&&l.push({x:u,y:h});return l};for(;r/s<o;){const p=c(!0);if(p.length===0)break;const l=p[Math.floor(t()*p.length)];a[l.y][l.x]=!0,r+=1}for(;r/s>n;){const p=c(!1);if(p.length===0)break;const l=p[Math.floor(t()*p.length)];a[l.y][l.x]=!1,r-=1}}function ye(a,t){const e=[{x:.22,y:.22},{x:.78,y:.22},{x:.22,y:.78},{x:.78,y:.78}],i=1;return e.slice(0,Z.length).map(o=>({x:Math.round((a-1)*o.x),y:Math.round((t-1)*o.y),radius:i}))}function nt(a,t,e){return e.findIndex(i=>Math.abs(a-i.x)<=i.radius&&Math.abs(t-i.y)<=i.radius)}function ve(a,t,e){const i=new Set,o=[];for(let n=0;n<e;n++)for(let s=0;s<t;s++){const r=n*t+s;if(a[n][s]||i.has(r))continue;const c=[],p=[{x:s,y:n}];i.add(r);for(let l=0;l<p.length;l++){const h=p[l];c.push(h);for(const[u,d]of he){const f=h.x+u,x=h.y+d;if(!St(f,x,t,e)||a[x][f])continue;const T=x*t+f;i.has(T)||(i.add(T),p.push({x:f,y:x}))}}o.push(c)}return o}function Te(a,t,e){for(const i of ve(a,t,e))if(i.length<ue)for(const{x:o,y:n}of i)a[n][o]=!0}function Ae(a,t,e,i,o){const n=Array.from({length:e},()=>Array(t).fill(!1)),s=Math.max(1,Math.floor(t*.35)),r=Math.min(t-2,Math.ceil(t*.65));let c=Math.floor((s+r)/2),p=0;for(n[p][c]=!0,a[p][c]=!1;p<e-1;){const l=Math.floor(o()*3)-1,h=Math.max(s,Math.min(r,c+l)),u=Math.sign(h-c);for(;c!==h;){const f=c+u;if(nt(f,p,i)>=0)break;c=f,n[p][c]=!0,a[p][c]=!1}const d=p+1;if(nt(c,d,i)>=0){const f=c===s?c+1:c-1;if(f<s||f>r||nt(f,d,i)>=0)break;c=f}p=d,n[p][c]=!0,a[p][c]=!1}return n}function Ht(a,t,e){const i=[];for(const o of a)for(const n of o)e(n)&&i.push(n);return i.length===0?null:i[Math.floor(t()*i.length)]}function ft(a,t,e,i){const o=[];for(let n=t.y-2;n<=t.y+2;n++)for(let s=t.x-2;s<=t.x+2;s++){const r=a[n]&&a[n][s];r&&r.nationId===i&&(r.x===t.x&&r.y===t.y||r.type===b.TR&&o.push(r))}return o.length>0?o[Math.floor(e()*o.length)]:Ht(a,e,n=>n.nationId===i&&n.type===b.TR)}function we(a=Date.now()){const t=fe(Math.floor(a)||1),e=k.GRID_WIDTH,i=k.GRID_HEIGHT;let o=[];for(let l=0;l<i;l++){const h=[];for(let u=0;u<e;u++)h.push(t()<.74);o.push(h)}for(let l=0;l<3;l++)o=be(o,e,i);me(o,t,e,i);const n=ye(e,i);n.forEach(l=>{for(let h=l.y-l.radius;h<=l.y+l.radius;h++)for(let u=l.x-l.radius;u<=l.x+l.radius;u++)St(u,h,e,i)&&(o[h][u]=!0)}),Te(o,e,i);const s=Ae(o,e,i,n,t),r=[];for(let l=0;l<i;l++){const h=[];for(let u=0;u<e;u++){const d=o[l][u],f=d?nt(u,l,n):-1,x=f>=0?f:null,T=d?b.TR:b.AG,I=xe(u,l,T,x);I.waterFeature=d?null:s[l][u]?"RIVER":"SEA",h.push(I)}r.push(h)}n.forEach((l,h)=>{X(r[l.y][l.x],b.CAP,{nationId:h,ownerId:Z[h].id,defense:4,population:100,troops:4});const u=ft(r,l,t,h);u&&X(u,b.CIU,{defense:2,population:80,troops:2});const d=ft(r,l,t,h);d&&X(d,b.MPT);const f=ft(r,l,t,h);f&&X(f,b.FT)});const c=(l,h,u)=>{for(const d of r)for(const f of d)f.type===l&&t()<u&&X(f,h)};c(b.TR,b.MPT,.08),c(b.TR,b.FT,.05),c(b.AG,b.MPA,.08),c(b.AG,b.FA,.04);const p=(l,h)=>{if(r.some(f=>f.some(x=>x.type===l)))return;const d=Ht(r,t,h);d&&X(d,l)};return p(b.MPA,l=>l.type===b.AG),p(b.FA,l=>l.type===b.AG),p(b.MPT,l=>l.type===b.TR),p(b.FT,l=>l.type===b.TR),r}const Mt=["#FFD21F","#FF4B55","#35E879","#C16BFF"],Pt=1.5;let Ee=class{constructor(t,e=()=>{}){this.viewport=t,this.container=document.createElement("div"),this.container.style.cssText=["position:absolute","inset:0","display:flex","overflow:auto","align-items:center","justify-content:center"].join(";"),this.onTileSelected=e,this.canvas=document.createElement("canvas"),this.ctx=this.canvas.getContext("2d"),this.grid=null,this.selectedPosition=null,this.dmzZones=[],this.selectionFromUser=!1,this.actionHighlights=[],this.proposalPreview=null,this.hoveredPosition=null,this.zoom=1,this.minZoom=.2,this.maxZoom=2,this.dragStart=null,this.didDrag=!1,this.targetSelectionMode=!1,this.tileSize=k==null?void 0:k.TILE_SIZE,this.cols=k==null?void 0:k.GRID_WIDTH,this.rows=k==null?void 0:k.GRID_HEIGHT;const i=this.cols*this.tileSize,o=this.rows*this.tileSize;this.canvas.width=i,this.canvas.height=o,this.canvas.style.display="block",this.canvas.style.width=`${i}px`,this.canvas.style.height=`${o}px`,this.canvas.style.minWidth=`${i}px`,this.canvas.style.minHeight=`${o}px`,this.canvas.style.flexShrink="0",this.canvas.style.borderRadius="8px",this.canvas.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.5)",this.canvas.style.cursor="grab",this.canvas.style.touchAction="none",this.viewport.innerHTML="",this.viewport.appendChild(this.container),this.container.appendChild(this.canvas),this.canvas.addEventListener("click",n=>this.handleClick(n)),this.canvas.addEventListener("pointerdown",n=>this.startPan(n)),this.canvas.addEventListener("pointermove",n=>this.pan(n)),this.canvas.addEventListener("pointerleave",()=>{this.hoveredPosition&&(this.hoveredPosition=null,this.grid&&this.render(this.grid,!1))}),this.canvas.addEventListener("pointerup",()=>this.endPan()),this.canvas.addEventListener("pointercancel",()=>{this.endPan(),this.didDrag=!1}),this.container.addEventListener("wheel",n=>this.handleWheel(n),{passive:!1}),this.createZoomControls(),this.zoom=this.getFitZoom(),this.applyZoom(),this.render(we())}setTargetSelectionMode(t){this.targetSelectionMode=!!t,this.targetSelectionMode||(this.proposalPreview=null),this.canvas.style.cursor=this.targetSelectionMode?"crosshair":"grab",this.grid&&this.render(this.grid,!1)}setDemilitarizedZones(t=[],e=!0){this.dmzZones=t,e&&this.grid&&this.render(this.grid,!1)}createZoomControls(){this.controls=document.createElement("div"),this.controls.style.cssText=["position:absolute","top:12px","right:12px","z-index:2","display:flex","align-items:center","gap:6px","padding:6px","border:1px solid #475569","border-radius:8px","background:rgba(15, 23, 42, 0.92)","color:#f8fafc","font:12px system-ui, sans-serif"].join(";"),this.controls.innerHTML=`
      <button type="button" aria-label="Alejar" title="Alejar" data-zoom="out">−</button>
      <span aria-live="polite" data-zoom-label></span>
      <button type="button" aria-label="Acercar" title="Acercar" data-zoom="in">+</button>
      <button type="button" title="Ajustar al panel" data-zoom="fit">Ajustar</button>
    `;for(const t of this.controls.querySelectorAll("button"))t.style.cssText=["min-width:30px","height:28px","border:1px solid #475569","border-radius:5px","background:#1e293b","color:#f8fafc","cursor:pointer","font:inherit"].join(";"),t.addEventListener("click",()=>{t.dataset.zoom==="in"&&this.zoomAt(this.zoom*1.2),t.dataset.zoom==="out"&&this.zoomAt(this.zoom/1.2),t.dataset.zoom==="fit"&&this.fitToPanel()});this.zoomLabel=this.controls.querySelector("[data-zoom-label]"),this.viewport.appendChild(this.controls)}getFitZoom(){const t=Math.max(1,this.container.clientWidth-32),e=Math.max(1,this.container.clientHeight-32),i=Math.min(t/this.canvas.width,e/this.canvas.height);return Math.min(1,Math.max(this.minZoom,i))}applyZoom(){const t=this.canvas.width*this.zoom,e=this.canvas.height*this.zoom;this.canvas.style.width=`${t}px`,this.canvas.style.height=`${e}px`,this.canvas.style.minWidth=`${t}px`,this.canvas.style.minHeight=`${e}px`,this.container.style.justifyContent=t>this.container.clientWidth?"flex-start":"center",this.container.style.alignItems=e>this.container.clientHeight?"flex-start":"center",this.zoomLabel.textContent=`${Math.round(this.zoom*100)}%`}zoomAt(t,e,i){const o=Math.min(this.maxZoom,Math.max(this.minZoom,t));if(o===this.zoom)return;const n=this.container.getBoundingClientRect(),s=this.canvas.getBoundingClientRect(),r=e??n.left+this.container.clientWidth/2,c=i??n.top+this.container.clientHeight/2,p=(r-s.left)/this.zoom,l=(c-s.top)/this.zoom,h=s.left-n.left+this.container.scrollLeft,u=s.top-n.top+this.container.scrollTop;this.zoom=o,this.applyZoom(),this.container.scrollLeft=h+p*o-(r-n.left),this.container.scrollTop=u+l*o-(c-n.top)}fitToPanel(){this.zoomAt(this.getFitZoom()),this.container.scrollLeft=0,this.container.scrollTop=0}handleWheel(t){t.preventDefault(),this.zoomAt(this.zoom*(t.deltaY<0?1.1:1/1.1),t.clientX,t.clientY)}startPan(t){t.button===0&&(this.dragStart={pointerId:t.pointerId,clientX:t.clientX,clientY:t.clientY,scrollLeft:this.container.scrollLeft,scrollTop:this.container.scrollTop},this.didDrag=!1,this.canvas.setPointerCapture(t.pointerId))}pan(t){var n,s;let e=this.updateProposalPreview(t);if(this.dragStart&&t.pointerId===this.dragStart.pointerId){const r=t.clientX-this.dragStart.clientX,c=t.clientY-this.dragStart.clientY;(Math.abs(r)>3||Math.abs(c)>3)&&(this.didDrag=!0,this.canvas.style.cursor="grabbing"),this.didDrag&&(this.container.scrollLeft=this.dragStart.scrollLeft-r,this.container.scrollTop=this.dragStart.scrollTop-c)}const o=this.didDrag?null:this.getPositionAtEvent(t);((o==null?void 0:o.x)!==((n=this.hoveredPosition)==null?void 0:n.x)||(o==null?void 0:o.y)!==((s=this.hoveredPosition)==null?void 0:s.y))&&(this.hoveredPosition=o,e=!0),e&&this.grid&&this.render(this.grid,!1)}endPan(){this.dragStart&&(this.dragStart=null,this.canvas.style.cursor=this.targetSelectionMode?"crosshair":"grab")}getTerrainColor(t){return Lt[t]||Lt[b.TR]}getNationColor(t){return t==null||t.nationId==null?null:le[t.nationId]||null}getTile(t,e,i){return i<0||e<0||i>=this.rows||e>=this.cols?null:t[i]&&t[i][e]?t[i][e]:null}setActionHighlights(t=[]){this.actionHighlights=t.filter(e=>Number.isInteger(e==null?void 0:e.x)&&Number.isInteger(e==null?void 0:e.y)),this.grid&&this.render(this.grid,!1)}render(t,e=!0){if(!(!t||!Array.isArray(t))){this.grid=t,this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);for(let i=0;i<this.rows;i++)for(let o=0;o<this.cols;o++){const n=this.getTile(t,o,i),s=(n==null?void 0:n.type)||b.TR,r=o*this.tileSize,c=i*this.tileSize;this.ctx.fillStyle=(n==null?void 0:n.waterFeature)==="RIVER"?"#38BDF8":this.getTerrainColor(s),this.ctx.fillRect(r,c,this.tileSize,this.tileSize),this.drawTileIcon(s,r,c),this.ctx.fillStyle="#ffffff",this.ctx.font="bold 6px system-ui, sans-serif",this.ctx.textAlign="left",this.ctx.textBaseline="top";const p=(n==null?void 0:n.defense)??0;p>0&&this.ctx.fillText(`D${p}`,r+3,c+3),this.ctx.font="5px system-ui, sans-serif",this.ctx.textBaseline="bottom";const l=(n==null?void 0:n.population)??0;l>0&&this.ctx.fillText(`P${l}`,r+3,c+this.tileSize-3);const h=(n==null?void 0:n.troops)??0;this.drawTroopMarkers(h,r,c)}this.drawBorders(t),this.drawDemilitarizedZones(),this.drawHover(),this.drawSelection(),this.drawProposalPreview(),e&&this.selectedPosition&&this.onTileSelected(this.getTile(t,this.selectedPosition.x,this.selectedPosition.y))}}animateTroopMovements(t=[],e=1800){const i=t.filter(s=>{var r;return(s==null?void 0:s.ok)&&((r=s.action)==null?void 0:r.type)==="MOVE_TROOPS"&&Number.isInteger(s.action.x)&&Number.isInteger(s.action.y)&&Number.isInteger(s.action.targetX)&&Number.isInteger(s.action.targetY)}).map(s=>{var r;return{action:s.action,color:Mt[(r=s.playerId)==null?void 0:r.split("-").pop()]||"#f8fafc"}});if(!i.length)return;const o=performance.now(),n=s=>{const r=Math.min(1,(s-o)/e);this.render(this.grid,!1);const c=1-(1-r)**3;for(const p of i){const{action:l}=p,h=l.x+(l.targetX-l.x)*c,u=l.y+(l.targetY-l.y)*c,d=Math.min(8,Math.max(1,Math.floor(l.troops||1)));for(let f=0;f<d;f+=1){const x=f%4*2.5-3.75,T=Math.floor(f/4)*2.5-1.25;this.ctx.beginPath(),this.ctx.arc((h+.5)*this.tileSize+x,(u+.5)*this.tileSize+T,Math.max(2,this.tileSize/12),0,Math.PI*2),this.ctx.fillStyle=p.color,this.ctx.fill(),this.ctx.strokeStyle="#111827",this.ctx.lineWidth=1,this.ctx.stroke()}}r<1?requestAnimationFrame(n):this.render(this.grid,!1)};requestAnimationFrame(n)}drawTroopMarkers(t,e,i){const o=Math.min(16,Math.max(0,Math.floor(t||0))),n=4,s=this.tileSize/8,r=Math.max(1,this.tileSize/14),c=this.ctx;for(let p=0;p<o;p+=1){const l=p%n,h=Math.floor(p/n),u=e+this.tileSize-s*(l+.75),d=i+this.tileSize-s*(h+.75);c.beginPath(),c.arc(u,d,r,0,Math.PI*2),c.fillStyle="#000000",c.fill(),c.strokeStyle="rgba(255, 255, 255, 0.65)",c.lineWidth=.75,c.stroke()}}drawDemilitarizedZones(){const t=this.ctx;for(const e of this.dmzZones)for(let i=Math.max(0,e.y-2);i<=Math.min(this.rows-1,e.y+2);i+=1)for(let o=Math.max(0,e.x-2);o<=Math.min(this.cols-1,e.x+2);o+=1){const n=o*this.tileSize,s=i*this.tileSize;t.fillStyle="rgba(147, 51, 234, 0.2)",t.fillRect(n,s,this.tileSize,this.tileSize),t.strokeStyle="rgba(216, 180, 254, 0.75)",t.lineWidth=1,t.strokeRect(n+.5,s+.5,this.tileSize-1,this.tileSize-1)}}drawTileIcon(t,e,i){const o=this.ctx,n=e+this.tileSize/2,s=i+this.tileSize/2+1,r=this.tileSize*.23;if(o.save(),o.strokeStyle="rgba(255, 255, 255, 0.88)",o.fillStyle="rgba(255, 255, 255, 0.88)",o.lineWidth=Math.max(1,this.tileSize/24),o.lineCap="round",o.lineJoin="round",t===b.AG||t===b.MPA)for(let c=-1;c<=1;c++){const p=s+c*r*.65;o.beginPath(),o.moveTo(n-r,p),o.quadraticCurveTo(n-r/2,p-r*.4,n,p),o.quadraticCurveTo(n+r/2,p+r*.4,n+r,p),o.stroke()}else if(t===b.CAP||t===b.CIU||t===b.FT||t===b.FA){const c=r*1.8,p=r*(t===b.CAP?1.9:1.5);o.fillRect(n-c/2,s-p/2,c,p),t===b.CAP&&(o.beginPath(),o.moveTo(n-c/2,s-p/2),o.lineTo(n,s-p),o.lineTo(n+c/2,s-p/2),o.fill()),o.fillStyle=this.getTerrainColor(t),o.fillRect(n-r*.3,s+r*.1,r*.6,r*.9)}else o.beginPath(),o.moveTo(n-r,s+r*.7),o.lineTo(n,s-r),o.lineTo(n+r,s+r*.7),o.closePath(),o.fill(),t===b.MPT&&(o.beginPath(),o.arc(n,s+r*.1,r*.22,0,Math.PI*2),o.fillStyle=this.getTerrainColor(t),o.fill());o.restore()}drawBorders(t){const e=this.tileSize,i=this.ctx;i.lineCap="square";for(let n=0;n<this.rows;n++)for(let s=0;s<this.cols;s++){const r=this.getTile(t,s,n);if(!r||r.ownerId!=null)continue;const c=s*e,p=n*e;i.strokeStyle="#334155",i.lineWidth=Pt,i.strokeRect(c+.5,p+.5,e-1,e-1)}const o=[{dx:0,dy:-1,x1:0,y1:0,x2:1,y2:0},{dx:1,dy:0,x1:1,y1:0,x2:1,y2:1},{dx:0,dy:1,x1:0,y1:1,x2:1,y2:1},{dx:-1,dy:0,x1:0,y1:0,x2:0,y2:1}];for(let n=0;n<this.rows;n++)for(let s=0;s<this.cols;s++){const r=this.getTile(t,s,n);if(!r||r.ownerId==null)continue;const c=Mt[r.nationId]||this.getNationColor(r)||"#f8fafc",p=s*e,l=n*e;for(const h of o){const u=this.getTile(t,s+h.dx,n+h.dy),d=(u==null?void 0:u.ownerId)!=null&&u.ownerId!==r.ownerId;i.beginPath(),i.moveTo(p+h.x1*e,l+h.y1*e),i.lineTo(p+h.x2*e,l+h.y2*e),i.strokeStyle=d?"#ffffff":c,i.lineWidth=Pt,i.stroke()}}}drawSelection(){const t=this.ctx;for(const o of this.actionHighlights){const n=o.x*this.tileSize,s=o.y*this.tileSize,r=o.role==="target";t.fillStyle=r?"rgba(34, 211, 238, 0.2)":"rgba(250, 204, 21, 0.2)",t.fillRect(n+2,s+2,this.tileSize-4,this.tileSize-4),t.strokeStyle=r?"#22d3ee":"#facc15",t.lineWidth=3,t.setLineDash([]),t.strokeRect(n+2,s+2,this.tileSize-4,this.tileSize-4)}if(!this.selectedPosition)return;const e=this.selectedPosition.x*this.tileSize,i=this.selectedPosition.y*this.tileSize;t.strokeStyle="#FFFFFF",t.lineWidth=2,t.setLineDash([4,2]),t.strokeRect(e+3,i+3,this.tileSize-6,this.tileSize-6),t.setLineDash([])}drawHover(){if(!this.hoveredPosition)return;const t=this.hoveredPosition.x*this.tileSize,e=this.hoveredPosition.y*this.tileSize,i=this.ctx;i.fillStyle="rgba(255, 255, 255, 0.1)",i.fillRect(t+1,e+1,this.tileSize-2,this.tileSize-2),i.strokeStyle="rgba(255, 255, 255, 0.42)",i.lineWidth=1,i.strokeRect(t+1.5,e+1.5,this.tileSize-3,this.tileSize-3)}drawProposalPreview(){if(!this.proposalPreview)return;const{x:t,y:e}=this.proposalPreview,i=this.ctx;for(let o=Math.max(0,e-2);o<=Math.min(this.rows-1,e+2);o+=1)for(let n=Math.max(0,t-2);n<=Math.min(this.cols-1,t+2);n+=1){const s=n*this.tileSize,r=o*this.tileSize,c=n===t&&o===e;i.fillStyle=c?"rgba(203, 213, 225, 0.45)":"rgba(148, 163, 184, 0.3)",i.fillRect(s+2,r+2,this.tileSize-4,this.tileSize-4),i.strokeStyle=c?"#e2e8f0":"rgba(226, 232, 240, 0.75)",i.lineWidth=c?3:1.5,i.setLineDash([]),i.strokeRect(s+2,r+2,this.tileSize-4,this.tileSize-4)}}updateProposalPreview(t){var i,o;if(!this.targetSelectionMode||this.dragStart)return!1;const e=this.getPositionAtEvent(t);return(e==null?void 0:e.x)===((i=this.proposalPreview)==null?void 0:i.x)&&(e==null?void 0:e.y)===((o=this.proposalPreview)==null?void 0:o.y)?!1:(this.proposalPreview=e,!0)}getPositionAtEvent(t){const e=this.canvas.getBoundingClientRect(),i=this.canvas.width/e.width,o=this.canvas.height/e.height,n=Math.floor((t.clientX-e.left)*i/this.tileSize),s=Math.floor((t.clientY-e.top)*o/this.tileSize),r=this.getTile(this.grid,n,s);return r?{x:r.x,y:r.y}:null}handleClick(t){if(this.didDrag){this.didDrag=!1;return}if(!this.grid)return;const e=this.getPositionAtEvent(t),i=e?this.getTile(this.grid,e.x,e.y):null;if(i){this.selectedPosition=e,this.selectionFromUser=!0;try{this.render(this.grid,!1),this.onTileSelected(i)}finally{this.selectionFromUser=!1}}}};const Se={[b.CAP]:"Capital",[b.CIU]:"Ciudad",[b.TR]:"Tierra",[b.MPT]:"Materia prima terrestre",[b.FT]:"Fábrica terrestre",[b.AG]:"Agua",[b.MPA]:"Materia prima acuática",[b.FA]:"Fábrica acuática"},_e={CAP:"♜",CIU:"▥",TR:"▲",MPT:"◆",FT:"▥",AG:"≋",MPA:"◈",FA:"▤"},Re={[G.NORMAL]:"Normal",[G.CONFLICT]:"En conflicto",[G.BLOCKED]:"Bloqueada"};function xt(a){return String(a).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}class Ie{constructor(t){this.container=t,this.player=null,this.phase=1,this.onAction=()=>{},this.tile=null,this.renderSignature=null,this.activeSlot=0,this.actionQuantities=new Map,this.grid=null,this.render()}setContext(t,e,i=this.onAction,o=this.activeSlot,n=this.grid){this.player=t,this.phase=e,this.onAction=i,this.activeSlot=o,this.grid=n,JSON.stringify({playerId:t==null?void 0:t.id,resources:t==null?void 0:t.resources,plannedActions:t==null?void 0:t.plannedActions,phase:e,activeSlot:o,tile:this.tile})!==this.renderSignature&&this.render()}getActions(t,e){var N,R,U,w,V;const i=!!(this.player&&t&&t.ownerId===this.player.id),o=((N=this.player)==null?void 0:N.resources)||{},n=A=>(o.SILVER||0)>=A,s=A=>(o.MATERIALS||0)>=A,r=this.phase===2,c=["TR","MPT"].includes(t==null?void 0:t.type)&&!(t!=null&&t.building),p=["AG","MPA"].includes(t==null?void 0:t.type)&&!(t!=null&&t.building),l=(((R=this.player)==null?void 0:R.plannedActions)||[]).filter((A,E)=>A&&E!==this.activeSlot),h=l.reduce((A,E)=>{var tt,et;if(E.type==="BUILD_CITY")return A+50;if(E.type==="BUILD_FACTORY"){const M=(et=(tt=this.grid)==null?void 0:tt[E.y])==null?void 0:et[E.x];return A+((M==null?void 0:M.type)==="MPT"||(M==null?void 0:M.type)==="MPA"?5:10)}return E.type==="RECRUIT_TROOP"?A+5*(E.count||1):E.type==="MOVE_CAPITAL"?A+10:A},0),u=l.reduce((A,E)=>E.type==="RECRUIT_TROOP"?A+2*(E.count||1):E.type==="MOVE_CAPITAL"?A+2:A,0),d=Math.max(0,(o.SILVER||0)-h),f=Math.max(0,(o.MATERIALS||0)-u),x=Math.floor(Math.min(d/5,f/2)),T=l.filter(A=>A.type==="MOVE_TROOPS"&&A.x===(t==null?void 0:t.x)&&A.y===(t==null?void 0:t.y)).reduce((A,E)=>A+E.troops,0),I=((w=t==null?void 0:t.visitingTroops)==null?void 0:w[(U=this.player)==null?void 0:U.id])||0,j=(t==null?void 0:t.ownerId)===((V=this.player)==null?void 0:V.id)?(t.troops||0)-Object.entries(t.visitingTroops||{}).filter(([A])=>A!==this.player.id).reduce((A,[,E])=>A+E,0):I,z=Math.max(0,j-T),g=(A,E,tt,et)=>{const M=`${t==null?void 0:t.x}:${t==null?void 0:t.y}:${A}`,kt=this.actionQuantities.has(M),re=kt?this.actionQuantities.get(M):A==="MOVE_TROOPS"?E:1,Ct=E>0?Math.min(E,Math.max(1,re)):0;return kt&&E>0&&this.actionQuantities.set(M,Ct),{max:E,unit:tt,field:et,value:Ct}};return[{type:"BUILD_CITY",title:"Construir ciudad",cost:"50 plata",enabled:r&&i&&t.type==="TR"&&!t.building&&n(50),reason:r?i?(t==null?void 0:t.type)!=="TR"||t!=null&&t.building?"Requiere tierra vacía":"Plata insuficiente":"Requiere territorio propio":"Disponible en fase de planificación"},{type:"BUILD_FACTORY",title:"Construir fábrica",cost:`${["MPT","MPA"].includes(t==null?void 0:t.type)?5:10} plata`,enabled:r&&i&&(c||p)&&n(["MPT","MPA"].includes(t==null?void 0:t.type)?5:10),reason:r?i?c||p?"Plata insuficiente":"Terreno no apto o ya edificado":"Requiere territorio propio":"Disponible en fase de planificación"},{type:"RECRUIT_TROOP",title:"Reclutar tropa",cost:"5 plata · 2 materiales por tropa",quantity:g("RECRUIT_TROOP",x,"tropas","count"),enabled:r&&i&&x>0,reason:r?i?"Recursos insuficientes o reservados":"Requiere territorio propio":"Disponible en fase de planificación"},{type:"MOVE_TROOPS",title:"Mover tropas",cost:`${z} tropas disponibles`,quantity:g("MOVE_TROOPS",z,"tropas","troops"),enabled:r&&(i||I>0)&&z>0,reason:r?!i&&I===0?"No hay tropas propias en esta casilla":"No hay tropas disponibles para otro movimiento":"Disponible en fase de planificación"},{type:"MOVE_CAPITAL",title:"Trasladar capital",cost:"10 plata · 2 materiales",enabled:r&&i&&(t==null?void 0:t.type)==="CIU"&&n(10)&&s(2),reason:r?i?(t==null?void 0:t.type)!=="CIU"?"Selecciona una ciudad propia":"Recursos insuficientes":"Requiere territorio propio":"Disponible en fase de planificación"}]}render(t=this.tile){var l,h,u;this.tile=t,this.renderSignature=JSON.stringify({playerId:(l=this.player)==null?void 0:l.id,resources:(h=this.player)==null?void 0:h.resources,plannedActions:(u=this.player)==null?void 0:u.plannedActions,phase:this.phase,activeSlot:this.activeSlot,tile:t});const e=(t==null?void 0:t.nationId)==null?null:Z[t.nationId],i=(t==null?void 0:t.status)||G.NORMAL,o=ce[i]||"#64748b";if(!t){this.container.innerHTML=`
        <section class="pax-inspector">
          <header class="pax-section-heading"><span class="pax-heading-icon">⌖</span> Inspector de Casilla</header>
          <div class="pax-inspector-empty">Selecciona una casilla del mapa para ver sus datos.</div>
        </section>
      `;return}const n=xt(Se[t.type]||t.type||"—"),s=e?xt(e.name):"Territorio neutral",r=t.building?xt(t.building):"Sin edificio",c=t.waterFeature==="RIVER"?"Río":t.waterFeature==="SEA"?"Mar":null,p=[["Población",t.population??0,"♟"],["Tropas",t.troops??0,"⚔"],["Defensa",t.defense??0,"⬡"]];this.container.innerHTML=`
      <section class="pax-inspector">
        <header class="pax-section-heading">
          <span class="pax-heading-icon">⌖</span>
          <span>Inspector de Casilla</span>
          <span class="pax-coordinates">(X: ${t.x}, Y: ${t.y})</span>
        </header>
        <div class="pax-inspector-content">
          <article class="pax-tile-card" style="--nation-color:${(e==null?void 0:e.color)||"#334155"};--tile-accent:${(e==null?void 0:e.color)||"#f2a900"}">
            <div class="pax-tile-card-top">
              <span class="pax-tile-defense">⬡ ${t.defense??0}</span>
              <span class="pax-tile-type">${n}</span>
            </div>
            <div class="pax-tile-art" aria-hidden="true">${_e[t.type]||"◇"}</div>
            <div class="pax-tile-owner">${s}</div>
            <div class="pax-tile-details">
              ${p.map(([d,f,x])=>`
                <span title="${d}"><i>${x}</i>${f}</span>
              `).join("")}
            </div>
            <div class="pax-tile-card-bottom">
              <span>${r}</span>
              <span class="pax-status-dot" style="--status-color:${o}" title="${Re[i]||i}"></span>
            </div>
          </article>
          <section class="pax-development">
            <h3>Opciones de desarrollo</h3>
            ${c?`<div class="pax-feature-tag">${c}</div>`:""}
            <p>${this.phase===2?"Elige un espacio de acción abajo. La orden queda guardada allí y se ejecuta al terminar el tiempo.":"Las órdenes se habilitan durante la fase de planificación y se ejecutan al terminar."}</p>
            <div class="pax-tile-actions">
              ${this.getActions(t,e).map(d=>`
                <div class="pax-tile-action-control">
                  ${d.quantity?`
                    <label class="pax-tile-quantity">
                      <span>Cantidad (${d.quantity.unit})</span>
                      <input type="number" min="1" max="${d.quantity.max}" step="1"
                        value="${d.quantity.value}" data-action-amount="${d.type}"
                        aria-label="Cantidad de ${d.quantity.unit} para ${d.title}"
                        ${d.enabled?"":"disabled"}>
                    </label>
                  `:""}
                  <button
                    class="pax-tile-action ${d.enabled?"":"is-unavailable"}"
                    type="button"
                    data-action="${d.type}"
                    ${d.enabled?"":"disabled"}
                    title="${d.enabled?d.title:d.reason}"
                  >
                    <span class="pax-tile-action-copy">
                      <strong>${d.title}</strong>
                      <small>${d.enabled?d.cost:d.reason}</small>
                    </span>
                  </button>
                </div>
              `).join("")}
            </div>
          </section>
        </div>
      </section>
    `;for(const d of this.container.querySelectorAll("[data-action-amount]"))d.addEventListener("input",()=>{const f=Number(d.value);Number.isInteger(f)&&f>=1&&f<=Number(d.max)&&this.actionQuantities.set(`${t.x}:${t.y}:${d.dataset.actionAmount}`,f)});for(const d of this.container.querySelectorAll("[data-action]"))d.addEventListener("click",()=>{const f=d.dataset.action,x=d.parentElement.querySelector(`[data-action-amount="${f}"]`),T=x?Number(x.value):null;this.onAction({type:f,x:t.x,y:t.y,...f==="RECRUIT_TROOP"?{count:T}:{},...f==="MOVE_TROOPS"?{troops:T}:{}})})}}class Oe{constructor(t,e){this.container=t,this.onChange=e,this.currentValue=ut.DEFAULT_TAX_RATE,this.render()}render(){this.container.innerHTML=`
      <div class="tax-slider-container">
        <label for="taxInput">
          Tasa Impositiva (τ): <span id="taxValue">${Math.round(this.currentValue*100)}%</span>
        </label>
        <input
          type="range" 
          id="taxInput" 
          min="${ut.MIN_TAX_RATE}" 
          max="${ut.MAX_TAX_RATE}" 
          step="0.01" 
          value="${this.currentValue}"
        />
        <p>
          * Impuestos altos aumentan el ingreso inmediato, pero reducen el crecimiento demográfico (G = 1 / 100τ).
        </p>
      </div>
    `,this.attachEvents()}attachEvents(){const t=this.container.querySelector("#taxInput"),e=this.container.querySelector("#taxValue");t.addEventListener("input",i=>{this.currentValue=parseFloat(i.target.value),e.textContent=`${Math.round(this.currentValue*100)}%`,typeof this.onChange=="function"&&this.onChange(this.currentValue)})}setEnabled(t){const e=this.container.querySelector("#taxInput");e&&(e.disabled=!t,this.container.style.opacity=t?"1":"0.5")}setValue(t){this.currentValue=t;const e=this.container.querySelector("#taxInput"),i=this.container.querySelector("#taxValue");e&&(e.value=String(t)),i&&(i.textContent=`${Math.round(t*100)}%`)}}function Ne(a,t){return a.flat().reduce((e,i)=>{const o=i.visitingTroops||{};if(i.ownerId===t){const n=Object.values(o).reduce((s,r)=>s+r,0);return e+Math.max(0,(i.troops||0)-n)}return e+(o[t]||0)},0)}function Yt(a){const t=Array.isArray(a==null?void 0:a.players)?a.players:[],e=Array.isArray(a==null?void 0:a.grid)?a.grid:[];return t.map(i=>{const o=e.flat().filter(l=>l.ownerId===i.id),n=i.resources||{},s=o.reduce((l,h)=>l+(h.population||0),0),r=n.SILVER||0,c=n.MATERIALS||0,p=n.INFLUENCE||0;return{player:i,ownedTiles:o,population:s,troops:Ne(e,i.id),cities:o.filter(l=>l.type==="CIU"||l.type==="CAP").length,factories:o.filter(l=>l.building==="FACTORY").reduce((l,h)=>l+(h.factoriesCount||1),0),silver:r,materials:c,influence:p,total:Math.floor(r+c+p+s)}}).sort((i,o)=>o.total-i.total)}const qt={[F.NON_AGGRESSION_PACT]:"Pacto de No Agresión",[F.FREE_TRADE]:"Tratado de Libre Comercio"},ke={[y.ROUND_START]:"Inicio de ronda",[y.PLANNING]:"Planificación",[y.RESOLVING]:"Resolviendo acciones…",[y.CLOSING]:"Actualizando el mundo…",[y.INTERNATIONAL_MEETING]:"Reunión de la OI"};function P(a){return String(a).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function q(a){return Number.isFinite(a)?Math.floor(a).toLocaleString("es-ES"):"0"}class Ce{constructor(t,{onProposeTreaty:e,onRespondToTreaty:i,onCancelTreatyOffer:o}={}){this.container=t,this.onProposeTreaty=e||(()=>{}),this.onRespondToTreaty=i||(()=>{}),this.onCancelTreatyOffer=o||(()=>{}),this.container.addEventListener("change",n=>{n.target.matches("#treaty-recipient")&&this.updateTLCOption()}),this.container.addEventListener("submit",n=>{var c,p;const s=(p=(c=n.target).closest)==null?void 0:p.call(c,"[data-treaty-form]");if(!s)return;n.preventDefault();const r=new FormData(s);this.onProposeTreaty({recipientId:r.get("recipientId"),type:r.get("type")})}),this.container.addEventListener("click",n=>{var c,p,l,h;const s=(p=(c=n.target).closest)==null?void 0:p.call(c,"[data-treaty-response]");if(s){this.onRespondToTreaty({offerId:s.dataset.offerId,accepted:s.dataset.treatyResponse==="accept"});return}const r=(h=(l=n.target).closest)==null?void 0:h.call(l,"[data-treaty-cancel]");r&&this.onCancelTreatyOffer(r.dataset.offerId)}),this.init()}init(){this.container.innerHTML=`
      <section class="pax-global-panel">
        <div class="pax-scoreboard-status">
          <div><span>Estado</span><strong id="global-phase">Inicio de ronda</strong></div>
          <div class="pax-scoreboard-clock"><span>Tiempo</span><strong id="global-timer">60s</strong></div>
        </div>
        <div class="pax-global-table-scroll">
          <table class="pax-global-table">
            <thead>
              <tr>
                <th>País</th><th>Control</th><th>Territorio</th><th>Población</th>
                <th>Tropas</th><th>Ciudades</th><th>Fábricas</th><th>Impuesto</th>
                <th>Plata</th><th>Materiales</th><th>Influencia</th><th>GDI</th>
              </tr>
            </thead>
            <tbody id="global-player-list"><tr><td colspan="12">Cargando países...</td></tr></tbody>
          </table>
        </div>
        <p class="pax-scoreboard-note">GDI: Plata + Materiales + Influencia + Población.</p>
        <section class="pax-global-treaties">
          <h3>Tratados vigentes</h3>
          <div id="global-treaty-list"></div>
        </section>
        <section class="pax-global-treaties">
          <h3>Conflictos activos</h3>
          <div id="global-conflict-list"></div>
        </section>
        <section class="pax-global-treaties">
          <h3>Propuestas pendientes</h3>
          <div id="global-treaty-offers"></div>
        </section>
        <form class="pax-global-treaty-form" data-treaty-form>
          <h3>Proponer un tratado</h3>
          <label>País destinatario
            <select name="recipientId" id="treaty-recipient"></select>
          </label>
          <label>Tratado
            <select name="type">
              <option value="${F.NON_AGGRESSION_PACT}">Pacto de No Agresión</option>
              <option value="${F.FREE_TRADE}">Tratado de Libre Comercio</option>
            </select>
          </label>
          <p>Los tratados aceptados duran cinco rondas. Un TLC exime del arancel del 20% en transferencias directas mientras no haya conflicto militar.</p>
          <button type="submit" id="treaty-propose-button">Enviar propuesta</button>
          <p class="pax-global-panel-status" id="treaty-status" role="status"></p>
        </form>
      </section>
    `}update(t,e){this.gameState=t,this.localPlayerId=e;const i=Array.isArray(t==null?void 0:t.players)?t.players:[],o=(t==null?void 0:t.currentRound)||1,n=i.find(g=>g.id===e),s=(t==null?void 0:t.currentPhase)||1,r=(t==null?void 0:t.currentStage)||(s===1?y.ROUND_START:s===2?y.PLANNING:s===3?y.RESOLVING:s===6?y.INTERNATIONAL_MEETING:y.CLOSING);this.container.querySelector("#global-phase").textContent=ke[r]||"En curso",this.container.querySelector("#global-timer").textContent=`${(t==null?void 0:t.timeRemaining)??60}s${t!=null&&t.isPaused?" · Pausado":""}`;const c=Yt(t);this.container.querySelector("#global-player-list").innerHTML=c.map((g,N)=>{const{player:R}=g,U=/^#[0-9a-f]{6}$/i.test(R.color||"")?R.color:"#2563eb",w=R.isBot?"Bot":R.phaseReady&&r===y.PLANNING?"Listo":"Humano";return`
        <tr style="--score-nation-color:${U}" class="${R.id===e?"is-local-player":""}">
          <th><span class="pax-score-rank">${N+1}</span>${P(R.name||"País")}</th>
          <td>${w}</td>
          <td>${q(g.ownedTiles.length)}</td>
          <td>${q(g.population)}</td>
          <td>${q(g.troops)}</td>
          <td>${q(g.cities)}</td>
          <td>${q(g.factories)}</td>
          <td>${q((R.taxRate||0)*100)}%</td>
          <td>${q(g.silver)}</td>
          <td>${q(g.materials)}</td>
          <td>${q(g.influence)}</td>
          <td class="pax-score-total">${q(g.total)}</td>
        </tr>
      `}).join("")||'<tr><td colspan="12">Sin países en la sala.</td></tr>';const p=new Map(i.map(g=>[g.id,g.name])),l=((t==null?void 0:t.nonAggressionPacts)||[]).filter(g=>g.expiresAfterRound>=o).map(g=>({...g,type:F.NON_AGGRESSION_PACT})),h=((t==null?void 0:t.freeTradeTreaties)||[]).filter(g=>g.expiresAfterRound>=o).map(g=>({...g,type:F.FREE_TRADE})),u=[...l,...h];this.container.querySelector("#global-treaty-list").innerHTML=u.length?u.map(g=>`
        <div class="pax-global-treaty">
          <strong>${qt[g.type]}</strong>
          <span>${g.playerIds.map(N=>P(p.get(N)||N)).join(" · ")}</span>
          <small>${Math.max(0,g.expiresAfterRound-o+1)} rondas restantes</small>
        </div>
      `).join(""):'<p class="pax-global-empty">No hay tratados vigentes.</p>';const d=(t==null?void 0:t.activeConflicts)||[];this.container.querySelector("#global-conflict-list").innerHTML=d.length?d.map(g=>`
        <div class="pax-global-treaty">
          <strong>En guerra</strong>
          <span>${g.playerNames.map(P).join(" · ")}</span>
          <small>${g.occupied?"Tropas en territorio rival":`Combate en las últimas tres rondas (ronda ${g.round})`}</small>
        </div>
      `).join(""):'<p class="pax-global-empty">No hay conflictos activos.</p>';const f=(t==null?void 0:t.treatyOffers)||[],x=!!(n&&(t!=null&&t.gameStarted)&&!(t!=null&&t.gameOver)&&r===y.PLANNING);this.container.querySelector("#global-treaty-offers").innerHTML=f.length?f.map(g=>{const N=g.recipientId===e,R=N?g.proposerName:g.recipientName;return`
          <div class="pax-global-treaty">
            <strong>${qt[g.type]}</strong>
            <span>${N?`De ${P(R)}`:`Para ${P(R)}`}</span>
            ${N?`
              <button type="button" data-treaty-response="accept" data-offer-id="${P(g.id)}" ${x?"":"disabled"}>Aceptar</button>
              <button type="button" data-treaty-response="reject" data-offer-id="${P(g.id)}" ${x?"":"disabled"}>Rechazar</button>
            `:`
              <small>Esperando respuesta</small>
              ${g.proposerId===e?`<button type="button" data-treaty-cancel data-offer-id="${P(g.id)}" ${x?"":"disabled"}>Cancelar propuesta</button>`:""}
            `}
          </div>
        `}).join(""):'<p class="pax-global-empty">No hay propuestas pendientes.</p>';const T=this.container.querySelector("#treaty-recipient"),I=T.value;T.innerHTML=i.filter(g=>g.id!==e).map(g=>`<option value="${P(g.id)}">${P(g.name)}</option>`).join(""),i.some(g=>g.id===I)&&(T.value=I);const j=this.updateTLCOption(),z=!!(n&&(t!=null&&t.gameStarted)&&!(t!=null&&t.gameOver)&&r===y.PLANNING);for(const g of this.container.querySelectorAll("[data-treaty-form] select, #treaty-propose-button"))g.disabled=!z||T.options.length===0;this.container.querySelector("#treaty-status").textContent=z?j?"No se puede proponer un TLC durante un conflicto activo con ese país.":"":r===y.INTERNATIONAL_MEETING?"La negociación se suspende durante la reunión de la OI.":"La negociación está disponible durante la planificación."}updateTLCOption(){var s,r,c,p,l;const t=this.container.querySelector("#treaty-recipient").value,i=(((s=this.gameState)==null?void 0:s.activeConflicts)||[]).some(h=>h.playerIds.includes(this.localPlayerId)&&h.playerIds.includes(t)),o=this.container.querySelector(`[name="type"] option[value="${F.FREE_TRADE}"]`);o.disabled=i,i&&this.container.querySelector('[name="type"]').value===F.FREE_TRADE&&(this.container.querySelector('[name="type"]').value=F.NON_AGGRESSION_PACT);const n=this.container.querySelector("#treaty-status");return n&&i&&((r=this.gameState)!=null&&r.gameStarted)&&!((c=this.gameState)!=null&&c.gameOver)?n.textContent="No se puede proponer un TLC durante un conflicto activo con ese país.":n&&((p=this.gameState)!=null&&p.gameStarted)&&!((l=this.gameState)!=null&&l.gameOver)&&(n.textContent=""),i}}function $t(a){return String(a).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function gt(a){return Number.isFinite(a)?Math.floor(a).toLocaleString("es-ES"):"0"}class Le{constructor(t,e=()=>{}){this.container=t,this.root=t.closest(".pax-sidebar")||t,this.onAction=e,this.container.innerHTML=`
      <section class="pax-finance">
        <div id="finance-economy-content">
        <p class="pax-finance-note">Compra materiales por 3 de plata o vende cada material por 1 de plata. Las operaciones se suspenden durante la reunión de la OI.</p>
        <div class="pax-market-card">
          <div class="pax-market-quantity">
            <button type="button" data-quantity-adjust="-1" aria-label="Reducir cantidad">−</button>
            <output id="market-quantity">1</output>
            <input name="quantity" id="market-quantity-input" type="number" min="1" step="1" value="1" required aria-label="Cantidad de materiales">
            <button type="button" data-quantity-adjust="1" aria-label="Aumentar cantidad">+</button>
            <button type="button" data-quantity-max>Max</button>
          </div>
          <div class="pax-market-actions">
            <button type="button" data-market-action="BUY_MATERIALS">Comprar</button>
            <button type="button" data-market-action="SELL_MATERIALS">Vender</button>
          </div>
        </div>
        </div>
        <div id="finance-debt-content">
          <div class="pax-bank-card">
            <div id="finance-debts"></div>
            <p class="pax-finance-note">Fondo del Banco Mundial: <strong id="finance-bank-fund">0 plata · 0 materiales</strong></p>
          </div>
          <div class="pax-bank-card pax-bank-actions">
            <button type="button" data-issue-bond>Emitir Bono (+20 plata)</button>
            <button type="button" data-donate-world-bank>Donar al BM (-15 plata, +1 Influencia)</button>
          </div>
          <div class="pax-bank-card" id="finance-repayment-card">
            <h4>Pago de deuda</h4>
            <div id="finance-repayment"></div>
          </div>
          <p class="pax-finance-status" id="finance-status" role="status"></p>
        </div>
      </section>
    `,this.root.addEventListener("click",i=>{var p,l,h,u,d,f,x;const o=(l=(p=i.target).closest)==null?void 0:l.call(p,"[data-quantity-adjust], [data-quantity-max]");if(o){const T=this.container.querySelector("#market-quantity-input");if(!T)return;T.value=o.hasAttribute("data-quantity-max")?T.max||"1":Math.max(1,Number(T.value||1)+Number(o.dataset.quantityAdjust)),this.updateMarketQuantity();return}const n=(u=(h=i.target).closest)==null?void 0:u.call(h,"[data-market-action]");if(n){this.onAction({type:n.dataset.marketAction,quantity:Number(((d=this.container.querySelector("#market-quantity-input"))==null?void 0:d.value)||1)});return}const s=(x=(f=i.target).closest)==null?void 0:x.call(f,"[data-issue-bond], [data-repay-bond], [data-donate-world-bank]");if(!s)return;if(s.matches("[data-donate-world-bank]")){this.onAction({type:"DONATE_TO_WORLD_BANK"});return}if(s.matches("[data-issue-bond]")){this.onAction({type:"ISSUE_BOND"});return}const r=s.closest("[data-bond-form]"),c=Number(new FormData(r).get("amount"));this.onAction({type:"REPAY_BOND",bondId:s.dataset.repayBond,amount:c})}),this.root.addEventListener("input",i=>{i.target.matches("#market-quantity-input")&&this.updateMarketQuantity()})}update(t,e){var d,f;const i=this.root,n=(Array.isArray(t==null?void 0:t.players)?t.players:[]).find(x=>x.id===e),s=!!(n&&(t!=null&&t.gameStarted)&&!(t!=null&&t.gameOver)&&(t==null?void 0:t.currentStage)===y.PLANNING),r=Number(((d=n==null?void 0:n.resources)==null?void 0:d.SILVER)??(n==null?void 0:n.silver)??0),c=Number(((f=n==null?void 0:n.resources)==null?void 0:f.MATERIALS)??(n==null?void 0:n.materials)??0),p=i.querySelector("#market-quantity-input");p&&(p.max=String(Math.max(1,Math.min(c,Math.floor(r/3)||1)))),this.updateMarketQuantity();for(const x of i.querySelectorAll("[data-market-action], #market-quantity-input, [data-quantity-adjust], [data-quantity-max], [data-issue-bond], [data-donate-world-bank]"))x.disabled=!s;const l=((t==null?void 0:t.bonds)||[]).filter(x=>x.playerId===e&&!x.paid),h=new Map(Array.from(i.querySelectorAll("[data-bond-amount]"),x=>[x.dataset.bondAmount,x.value]));i.querySelector("#finance-debts").innerHTML=l.length?l.map(x=>`<div class="pax-finance-debt"><strong>Deuda pendiente: ${gt(x.balance)} plata</strong><small>${x.defaulted?"En impago":"Pendiente"} · vence ronda ${x.dueRound}</small></div>`).join(""):'<p class="pax-finance-note">No tienes deuda pendiente.</p>',i.querySelector("#finance-repayment-card").hidden=!l.length,i.querySelector("#finance-repayment").innerHTML=l.map(x=>`
      <div class="pax-repayment-row">
        <input name="amount" data-bond-amount="${$t(x.id)}" type="number" min="1" max="${x.balance}" step="1" value="${Math.min(x.balance,Math.max(1,Number(h.get(x.id))||x.balance))}" required ${s?"":"disabled"}>
        <button type="button" data-repay-bond="${$t(x.id)}" ${s?"":"disabled"}>Pagar Deuda</button>
      </div>
    `).join("");const u=(t==null?void 0:t.worldBankFund)||(t==null?void 0:t.bankFund);i.querySelector("#finance-bank-fund").textContent=`${gt(u==null?void 0:u.SILVER)} plata · ${gt(u==null?void 0:u.MATERIALS)} materiales`}updateMarketQuantity(){const t=this.container.querySelector("#market-quantity-input"),e=this.container.querySelector("#market-quantity");!t||!e||(e.textContent=t.value||"1")}setStatus(t){this.root.querySelector("#finance-status").textContent=t}}const B=Object.create(null);B.open="0";B.close="1";B.ping="2";B.pong="3";B.message="4";B.upgrade="5";B.noop="6";const at=Object.create(null);Object.keys(B).forEach(a=>{at[B[a]]=a});const vt={type:"error",data:"parser error"},jt=typeof Blob=="function"||typeof Blob<"u"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",Xt=typeof ArrayBuffer=="function",Wt=a=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(a):a&&a.buffer instanceof ArrayBuffer,_t=({type:a,data:t},e,i)=>jt&&t instanceof Blob?e?i(t):Bt(t,i):Xt&&(t instanceof ArrayBuffer||Wt(t))?e?i(t):Bt(new Blob([t]),i):i(B[a]+(t||"")),Bt=(a,t)=>{const e=new FileReader;return e.onload=function(){const i=e.result.split(",")[1];t("b"+(i||""))},e.readAsDataURL(a)};function zt(a){return a instanceof Uint8Array?a:a instanceof ArrayBuffer?new Uint8Array(a):new Uint8Array(a.buffer,a.byteOffset,a.byteLength)}let bt;function Me(a,t){if(jt&&a.data instanceof Blob)return a.data.arrayBuffer().then(zt).then(t);if(Xt&&(a.data instanceof ArrayBuffer||Wt(a.data)))return t(zt(a.data));_t(a,!1,e=>{bt||(bt=new TextEncoder),t(bt.encode(e))})}const Dt="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",Q=typeof Uint8Array>"u"?[]:new Uint8Array(256);for(let a=0;a<Dt.length;a++)Q[Dt.charCodeAt(a)]=a;const Pe=a=>{let t=a.length*.75,e=a.length,i,o=0,n,s,r,c;a[a.length-1]==="="&&(t--,a[a.length-2]==="="&&t--);const p=new ArrayBuffer(t),l=new Uint8Array(p);for(i=0;i<e;i+=4)n=Q[a.charCodeAt(i)],s=Q[a.charCodeAt(i+1)],r=Q[a.charCodeAt(i+2)],c=Q[a.charCodeAt(i+3)],l[o++]=n<<2|s>>4,l[o++]=(s&15)<<4|r>>2,l[o++]=(r&3)<<6|c&63;return p},qe=typeof ArrayBuffer=="function",Rt=(a,t)=>{if(typeof a!="string")return{type:"message",data:Zt(a,t)};const e=a.charAt(0);return e==="b"?{type:"message",data:$e(a.substring(1),t)}:at[e]?a.length>1?{type:at[e],data:a.substring(1)}:{type:at[e]}:vt},$e=(a,t)=>{if(qe){const e=Pe(a);return Zt(e,t)}else return{base64:!0,data:a}},Zt=(a,t)=>{switch(t){case"blob":return a instanceof Blob?a:new Blob([a]);case"arraybuffer":default:return a instanceof ArrayBuffer?a:a.buffer}},Kt="",Be=(a,t)=>{const e=a.length,i=new Array(e);let o=0;a.forEach((n,s)=>{_t(n,!1,r=>{i[s]=r,++o===e&&t(i.join(Kt))})})},ze=(a,t)=>{const e=a.split(Kt),i=[];for(let o=0;o<e.length;o++){const n=Rt(e[o],t);if(i.push(n),n.type==="error")break}return i};function De(){return new TransformStream({transform(a,t){Me(a,e=>{const i=e.length;let o;if(i<126)o=new Uint8Array(1),new DataView(o.buffer).setUint8(0,i);else if(i<65536){o=new Uint8Array(3);const n=new DataView(o.buffer);n.setUint8(0,126),n.setUint16(1,i)}else{o=new Uint8Array(9);const n=new DataView(o.buffer);n.setUint8(0,127),n.setBigUint64(1,BigInt(i))}a.data&&typeof a.data!="string"&&(o[0]|=128),t.enqueue(o),t.enqueue(e)})}})}let mt;function it(a){return a.reduce((t,e)=>t+e.length,0)}function ot(a,t){if(a[0].length===t)return a.shift();const e=new Uint8Array(t);let i=0;for(let o=0;o<t;o++)e[o]=a[0][i++],i===a[0].length&&(a.shift(),i=0);return a.length&&i<a[0].length&&(a[0]=a[0].slice(i)),e}function Fe(a,t){mt||(mt=new TextDecoder);const e=[];let i=0,o=-1,n=!1;return new TransformStream({transform(s,r){for(e.push(s);;){if(i===0){if(it(e)<1)break;const c=ot(e,1);n=(c[0]&128)===128,o=c[0]&127,o<126?i=3:o===126?i=1:i=2}else if(i===1){if(it(e)<2)break;const c=ot(e,2);o=new DataView(c.buffer,c.byteOffset,c.length).getUint16(0),i=3}else if(i===2){if(it(e)<8)break;const c=ot(e,8),p=new DataView(c.buffer,c.byteOffset,c.length),l=p.getUint32(0);if(l>Math.pow(2,21)-1){r.enqueue(vt);break}o=l*Math.pow(2,32)+p.getUint32(4),i=3}else{if(it(e)<o)break;const c=ot(e,o);r.enqueue(Rt(n?c:mt.decode(c),t)),i=0}if(o===0||o>a){r.enqueue(vt);break}}}})}const Jt=4;function _(a){if(a)return Ve(a)}function Ve(a){for(var t in _.prototype)a[t]=_.prototype[t];return a}_.prototype.on=_.prototype.addEventListener=function(a,t){return this._callbacks=this._callbacks||{},(this._callbacks["$"+a]=this._callbacks["$"+a]||[]).push(t),this};_.prototype.once=function(a,t){function e(){this.off(a,e),t.apply(this,arguments)}return e.fn=t,this.on(a,e),this};_.prototype.off=_.prototype.removeListener=_.prototype.removeAllListeners=_.prototype.removeEventListener=function(a,t){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var e=this._callbacks["$"+a];if(!e)return this;if(arguments.length==1)return delete this._callbacks["$"+a],this;for(var i,o=0;o<e.length;o++)if(i=e[o],i===t||i.fn===t){e.splice(o,1);break}return e.length===0&&delete this._callbacks["$"+a],this};_.prototype.emit=function(a){this._callbacks=this._callbacks||{};for(var t=new Array(arguments.length-1),e=this._callbacks["$"+a],i=1;i<arguments.length;i++)t[i-1]=arguments[i];if(e){e=e.slice(0);for(var i=0,o=e.length;i<o;++i)e[i].apply(this,t)}return this};_.prototype.emitReserved=_.prototype.emit;_.prototype.listeners=function(a){return this._callbacks=this._callbacks||{},this._callbacks["$"+a]||[]};_.prototype.hasListeners=function(a){return!!this.listeners(a).length};const pt=typeof Promise=="function"&&typeof Promise.resolve=="function"?t=>Promise.resolve().then(t):(t,e)=>e(t,0),C=typeof self<"u"?self:typeof window<"u"?window:Function("return this")(),Ge="arraybuffer";function Qt(a,...t){return t.reduce((e,i)=>(a.hasOwnProperty(i)&&(e[i]=a[i]),e),{})}const Ue=C.setTimeout,He=C.clearTimeout;function dt(a,t){t.useNativeTimers?(a.setTimeoutFn=Ue.bind(C),a.clearTimeoutFn=He.bind(C)):(a.setTimeoutFn=C.setTimeout.bind(C),a.clearTimeoutFn=C.clearTimeout.bind(C))}const Ye=1.33;function je(a){return typeof a=="string"?Xe(a):Math.ceil((a.byteLength||a.size)*Ye)}function Xe(a){let t=0,e=0;for(let i=0,o=a.length;i<o;i++)t=a.charCodeAt(i),t<128?e+=1:t<2048?e+=2:t<55296||t>=57344?e+=3:(i++,e+=4);return e}function te(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function We(a){let t="";for(let e in a)a.hasOwnProperty(e)&&(t.length&&(t+="&"),t+=encodeURIComponent(e)+"="+encodeURIComponent(a[e]));return t}function Ze(a){let t={},e=a.split("&");for(let i=0,o=e.length;i<o;i++){let n=e[i].split("=");t[decodeURIComponent(n[0])]=decodeURIComponent(n[1])}return t}class Ke extends Error{constructor(t,e,i){super(t),this.description=e,this.context=i,this.type="TransportError"}}class It extends _{constructor(t){super(),this.writable=!1,dt(this,t),this.opts=t,this.query=t.query,this.socket=t.socket,this.supportsBinary=!t.forceBase64}onError(t,e,i){return super.emitReserved("error",new Ke(t,e,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(t){this.readyState==="open"&&this.write(t)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(t){const e=Rt(t,this.socket.binaryType);this.onPacket(e)}onPacket(t){super.emitReserved("packet",t)}onClose(t){this.readyState="closed",super.emitReserved("close",t)}pause(t){}createUri(t,e={}){return t+"://"+this._hostname()+this._port()+this.opts.path+this._query(e)}_hostname(){const t=this.opts.hostname;return t.indexOf(":")===-1?t:"["+t+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(t){const e=We(t);return e.length?"?"+e:""}}class Je extends It{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(t){this.readyState="pausing";const e=()=>{this.readyState="paused",t()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||e()})),this.writable||(i++,this.once("drain",function(){--i||e()}))}else e()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(t){const e=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};ze(t,this.socket.binaryType).forEach(e),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const t=()=>{this.write([{type:"close"}])};this.readyState==="open"?t():this.once("open",t)}write(t){this.writable=!1,Be(t,e=>{this.doWrite(e,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const t=this.opts.secure?"https":"http",e=this.query||{};return this.opts.timestampRequests!==!1&&(e[this.opts.timestampParam]=te()),!this.supportsBinary&&!e.sid&&(e.b64=1),this.createUri(t,e)}}let ee=!1;try{ee=typeof XMLHttpRequest<"u"&&"withCredentials"in new XMLHttpRequest}catch{}const Qe=ee;function ti(){}class ei extends Je{constructor(t){if(super(t),typeof location<"u"){const e=location.protocol==="https:";let i=location.port;i||(i=e?"443":"80"),this.xd=typeof location<"u"&&t.hostname!==location.hostname||i!==t.port}}doWrite(t,e){const i=this.request({method:"POST",data:t});i.on("success",e),i.on("error",(o,n)=>{this.onError("xhr post error",o,n)})}doPoll(){const t=this.request();t.on("data",this.onData.bind(this)),t.on("error",(e,i)=>{this.onError("xhr poll error",e,i)}),this.pollXhr=t}}class $ extends _{constructor(t,e,i){super(),this.createRequest=t,dt(this,i),this._opts=i,this._method=i.method||"GET",this._uri=e,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var t;const e=Qt(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");e.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(e);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let o in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(o)&&i.setRequestHeader(o,this._opts.extraHeaders[o])}}catch{}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch{}try{i.setRequestHeader("Accept","*/*")}catch{}(t=this._opts.cookieJar)===null||t===void 0||t.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var o;i.readyState===3&&((o=this._opts.cookieJar)===null||o===void 0||o.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(o){this.setTimeoutFn(()=>{this._onError(o)},0);return}typeof document<"u"&&(this._index=$.requestsCount++,$.requests[this._index]=this)}_onError(t){this.emitReserved("error",t,this._xhr),this._cleanup(!0)}_cleanup(t){if(!(typeof this._xhr>"u"||this._xhr===null)){if(this._xhr.onreadystatechange=ti,t)try{this._xhr.abort()}catch{}typeof document<"u"&&delete $.requests[this._index],this._xhr=null}}_onLoad(){const t=this._xhr.responseText;t!==null&&(this.emitReserved("data",t),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}$.requestsCount=0;$.requests={};if(typeof document<"u"){if(typeof attachEvent=="function")attachEvent("onunload",Ft);else if(typeof addEventListener=="function"){const a="onpagehide"in C?"pagehide":"unload";addEventListener(a,Ft,!1)}}function Ft(){for(let a in $.requests)$.requests.hasOwnProperty(a)&&$.requests[a].abort()}const ii=function(){const a=ie({xdomain:!1});return a&&a.responseType!==null}();class oi extends ei{constructor(t){super(t);const e=t&&t.forceBase64;this.supportsBinary=ii&&!e}request(t={}){return Object.assign(t,{xd:this.xd},this.opts),new $(ie,this.uri(),t)}}function ie(a){const t=a.xdomain;try{if(typeof XMLHttpRequest<"u"&&(!t||Qe))return new XMLHttpRequest}catch{}if(!t)try{return new C[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch{}}const oe=typeof navigator<"u"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class ni extends It{get name(){return"websocket"}doOpen(){const t=this.uri(),e=this.opts.protocols,i=oe?{}:Qt(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(t,e,i)}catch(o){return this.emitReserved("error",o)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=t=>this.onClose({description:"websocket connection closed",context:t}),this.ws.onmessage=t=>this.onData(t.data),this.ws.onerror=t=>this.onError("websocket error",t)}write(t){this.writable=!1;for(let e=0;e<t.length;e++){const i=t[e],o=e===t.length-1;_t(i,this.supportsBinary,n=>{try{this.doWrite(i,n)}catch{}o&&pt(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws<"u"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const t=this.opts.secure?"wss":"ws",e=this.query||{};return this.opts.timestampRequests&&(e[this.opts.timestampParam]=te()),this.supportsBinary||(e.b64=1),this.createUri(t,e)}}const yt=C.WebSocket||C.MozWebSocket;class ai extends ni{createSocket(t,e,i){return oe?new yt(t,e,i):e?new yt(t,e):new yt(t)}doWrite(t,e){this.ws.send(e)}}class si extends It{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(t){return this.emitReserved("error",t)}this._transport.closed.then(()=>{this.onClose()}).catch(t=>{this.onError("webtransport error",t)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(t=>{const e=Fe(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=t.readable.pipeThrough(e).getReader(),o=De();o.readable.pipeTo(t.writable),this._writer=o.writable.getWriter();const n=()=>{i.read().then(({done:r,value:c})=>{r||(this.onPacket(c),n())}).catch(r=>{})};n();const s={type:"open"};this.query.sid&&(s.data=`{"sid":"${this.query.sid}"}`),this._writer.write(s).then(()=>this.onOpen())})})}write(t){this.writable=!1;for(let e=0;e<t.length;e++){const i=t[e],o=e===t.length-1;this._writer.write(i).then(()=>{o&&pt(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var t;(t=this._transport)===null||t===void 0||t.close()}}const ri={websocket:ai,webtransport:si,polling:oi},ci=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,li=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Tt(a){if(a.length>8e3)throw"URI too long";const t=a,e=a.indexOf("["),i=a.indexOf("]");e!=-1&&i!=-1&&(a=a.substring(0,e)+a.substring(e,i).replace(/:/g,";")+a.substring(i,a.length));let o=ci.exec(a||""),n={},s=14;for(;s--;)n[li[s]]=o[s]||"";return e!=-1&&i!=-1&&(n.source=t,n.host=n.host.substring(1,n.host.length-1).replace(/;/g,":"),n.authority=n.authority.replace("[","").replace("]","").replace(/;/g,":"),n.ipv6uri=!0),n.pathNames=pi(n,n.path),n.queryKey=di(n,n.query),n}function pi(a,t){const e=/\/{2,9}/g,i=t.replace(e,"/").split("/");return(t.slice(0,1)=="/"||t.length===0)&&i.splice(0,1),t.slice(-1)=="/"&&i.splice(i.length-1,1),i}function di(a,t){const e={};return t.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,o,n){o&&(e[o]=n)}),e}const At=typeof addEventListener=="function"&&typeof removeEventListener=="function",st=[];At&&addEventListener("offline",()=>{st.forEach(a=>a())},!1);let ne=class W extends _{constructor(t,e={}){var i,o;if(super(),this.binaryType=Ge,this.writeBuffer=[],this._prevBufferLen=0,this._upgrades=[],this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,t&&typeof t=="object"&&(e=t,t=null),t){const n=Tt(t);e.hostname=n.host,e.secure=n.protocol==="https"||n.protocol==="wss",e.port=n.port,n.query&&(e.query=n.query)}else e.host&&(e.hostname=Tt(e.host).host);if(dt(this,e),this.secure=e.secure!=null?e.secure:typeof location<"u"&&location.protocol==="https:",e.hostname&&!e.port&&(e.port=this.secure?"443":"80"),this.hostname=e.hostname||(typeof location<"u"?location.hostname:"localhost"),this.port=e.port||(typeof location<"u"&&location.port?location.port:this.secure?"443":"80"),e.transportImplementations&&e.transports)throw new Error("specifying both 'transportImplementations' and 'transports' options is not supported");e.transportImplementations||!((i=e.transports)===null||i===void 0)&&i.length&&typeof e.transports[0]=="function"?(this.transports=[],this._transportsByName=Object.create(null),((o=e.transportImplementations)!==null&&o!==void 0?o:e.transports).forEach(n=>{const s=n.prototype.name;this.transports.push(s),this._transportsByName[s]=n})):(this.transports=e.transports?[...e.transports]:["polling","websocket","webtransport"],this._transportsByName=ri),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},e),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=Ze(this.opts.query)),At&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},st.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(t){const e=Object.assign({},this.opts.query);e.EIO=Jt,e.transport=t,this.id&&(e.sid=this.id);const i=Object.assign({},this.opts,{query:e,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[t]);return new this._transportsByName[t](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const t=this.opts.rememberUpgrade&&W.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const e=this.createTransport(t);e.open(),this.setTransport(e)}setTransport(t){this.transport&&this.transport.removeAllListeners(),this.transport=t,t.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",e=>this._onClose("transport close",e))}_probe(t){let e=this.createTransport(t),i=!1;W.priorWebsocketSuccess=!1;const o=()=>{i||(e.send([{type:"ping",data:"probe"}]),e.once("packet",h=>{if(!i)if(h.type==="pong"&&h.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",e),!e)return;W.priorWebsocketSuccess=e.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(l(),this.setTransport(e),e.send([{type:"upgrade"}]),this.emitReserved("upgrade",e),e=null,this.upgrading=!1,this.flush())})}else{const u=new Error("probe error");u.transport=e.name,this.emitReserved("upgradeError",u)}}))};function n(){i||(i=!0,l(),e.close(),e=null)}const s=h=>{const u=new Error("probe error: "+h);u.transport=e.name,n(),this.emitReserved("upgradeError",u)};function r(){s("transport closed")}function c(){s("socket closed")}function p(h){e&&h.name!==e.name&&n()}const l=()=>{e.removeListener("open",o),e.removeListener("error",s),e.removeListener("close",r),this.off("close",c),this.off("upgrading",p)};e.once("open",o),e.once("error",s),e.once("close",r),this.once("close",c),this.once("upgrading",p),this._upgrades.indexOf("webtransport")!==-1&&t!=="webtransport"?this.setTimeoutFn(()=>{i||e.open()},200):e.open()}onOpen(){if(this.readyState="open",W.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush(),this.readyState==="open"&&this.opts.upgrade)for(let t=0;t<this._upgrades.length;t++)this._probe(this._upgrades[t])}_onPacket(t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",t),this.emitReserved("heartbeat"),t.type){case"open":this.onHandshake(JSON.parse(t.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const e=new Error("server error");e.code=t.data,this._onError(e);break;case"message":this.emitReserved("data",t.data),this.emitReserved("message",t.data);break}}onHandshake(t){this.emitReserved("handshake",t),this.id=t.sid,this.transport.query.sid=t.sid,this._upgrades=this._filterUpgrades(t.upgrades),this._pingInterval=t.pingInterval,this._pingTimeout=t.pingTimeout,this._maxPayload=t.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const t=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+t,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},t),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const t=this._getWritablePackets();this.transport.send(t),this._prevBufferLen=t.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let e=1;for(let i=0;i<this.writeBuffer.length;i++){const o=this.writeBuffer[i].data;if(o&&(e+=je(o)),i>0&&e>this._maxPayload)return this.writeBuffer.slice(0,i);e+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const t=Date.now()>this._pingTimeoutTime;return t&&(this._pingTimeoutTime=0,pt(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),t}write(t,e,i){return this._sendPacket("message",t,e,i),this}send(t,e,i){return this._sendPacket("message",t,e,i),this}_sendPacket(t,e,i,o){if(typeof e=="function"&&(o=e,e=void 0),typeof i=="function"&&(o=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const n={type:t,data:e,options:i};this.emitReserved("packetCreate",n),this.writeBuffer.push(n),o&&this.once("flush",o),this.flush()}close(){const t=()=>{this._onClose("forced close"),this.transport.close()},e=()=>{this.off("upgrade",e),this.off("upgradeError",e),t()},i=()=>{this.once("upgrade",e),this.once("upgradeError",e)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():t()}):this.upgrading?i():t()),this}_onError(t){if(W.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",t),this._onClose("transport error",t)}_onClose(t,e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),At&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=st.indexOf(this._offlineEventListener);i!==-1&&st.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",t,e),this.writeBuffer=[],this._prevBufferLen=0}}_filterUpgrades(t){const e=[];for(let i=0;i<t.length;i++)~this.transports.indexOf(t[i])&&e.push(t[i]);return e}};ne.protocol=Jt;function hi(a,t="",e){let i=a;e=e||typeof location<"u"&&location,a==null&&(a=e.protocol+"//"+e.host),typeof a=="string"&&(a.charAt(0)==="/"&&(a.charAt(1)==="/"?a=e.protocol+a:a=e.host+a),/^(https?|wss?):\/\//.test(a)||(typeof e<"u"?a=e.protocol+"//"+a:a="https://"+a),i=Tt(a)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const n=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+n+":"+i.port+t,i.href=i.protocol+"://"+n+(e&&e.port===i.port?"":":"+i.port),i}const ui=typeof ArrayBuffer=="function",fi=a=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(a):a.buffer instanceof ArrayBuffer,ae=Object.prototype.toString,xi=typeof Blob=="function"||typeof Blob<"u"&&ae.call(Blob)==="[object BlobConstructor]",gi=typeof File=="function"||typeof File<"u"&&ae.call(File)==="[object FileConstructor]";function Ot(a){return ui&&(a instanceof ArrayBuffer||fi(a))||xi&&a instanceof Blob||gi&&a instanceof File}function rt(a,t){if(!a||typeof a!="object")return!1;if(Array.isArray(a)){for(let e=0,i=a.length;e<i;e++)if(rt(a[e]))return!0;return!1}if(Ot(a))return!0;if(a.toJSON&&typeof a.toJSON=="function"&&arguments.length===1)return rt(a.toJSON(),!0);for(const e in a)if(Object.prototype.hasOwnProperty.call(a,e)&&rt(a[e]))return!0;return!1}function bi(a){const t=[],e=a.data,i=a;return i.data=ct(e,t),i.attachments=t.length,{packet:i,buffers:t}}function ct(a,t,e){if(!a)return a;if(Ot(a)){const i={_placeholder:!0,num:t.length};return t.push(a),i}else if(Array.isArray(a)){const i=new Array(a.length);for(let o=0;o<a.length;o++)i[o]=ct(a[o],t);return i}else if(typeof a=="object"&&!(a instanceof Date)){if(a.toJSON&&typeof a.toJSON=="function"&&!e)return ct(a.toJSON(),t,!0);const i={};for(const o in a)Object.prototype.hasOwnProperty.call(a,o)&&(i[o]=ct(a[o],t));return i}return a}function mi(a,t){return a.data=wt(a.data,t),delete a.attachments,a}function wt(a,t){if(!a)return a;if(a&&a._placeholder===!0){if(typeof a.num=="number"&&a.num>=0&&a.num<t.length)return t[a.num];throw new Error("illegal attachments")}else if(Array.isArray(a))for(let e=0;e<a.length;e++)a[e]=wt(a[e],t);else if(typeof a=="object")for(const e in a)Object.prototype.hasOwnProperty.call(a,e)&&(a[e]=wt(a[e],t));return a}const yi=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var v;(function(a){a[a.CONNECT=0]="CONNECT",a[a.DISCONNECT=1]="DISCONNECT",a[a.EVENT=2]="EVENT",a[a.ACK=3]="ACK",a[a.CONNECT_ERROR=4]="CONNECT_ERROR",a[a.BINARY_EVENT=5]="BINARY_EVENT",a[a.BINARY_ACK=6]="BINARY_ACK"})(v||(v={}));class vi{constructor(t){this.replacer=t}encode(t){return(t.type===v.EVENT||t.type===v.ACK)&&rt(t)?this.encodeAsBinary({type:t.type===v.EVENT?v.BINARY_EVENT:v.BINARY_ACK,nsp:t.nsp,data:t.data,id:t.id}):[this.encodeAsString(t)]}encodeAsString(t){let e=""+t.type;return(t.type===v.BINARY_EVENT||t.type===v.BINARY_ACK)&&(e+=t.attachments+"-"),t.nsp&&t.nsp!=="/"&&(e+=t.nsp+","),t.id!=null&&(e+=t.id),t.data!=null&&(e+=JSON.stringify(t.data,this.replacer)),e}encodeAsBinary(t){const e=bi(t),i=this.encodeAsString(e.packet),o=e.buffers;return o.unshift(i),o}}class Nt extends _{constructor(t){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof t=="function"?{reviver:t}:t)}add(t){let e;if(typeof t=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");e=this.decodeString(t);const i=e.type===v.BINARY_EVENT;i||e.type===v.BINARY_ACK?(e.type=i?v.EVENT:v.ACK,this.reconstructor=new Ti(e)):super.emitReserved("decoded",e)}else if(Ot(t)||t.base64)if(this.reconstructor)e=this.reconstructor.takeBinaryData(t),e&&(this.reconstructor=null,super.emitReserved("decoded",e));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+t)}decodeString(t){let e=0;const i={type:Number(t.charAt(0))};if(v[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===v.BINARY_EVENT||i.type===v.BINARY_ACK){const n=e+1;for(;t.charAt(++e)!=="-"&&e!=t.length;);const s=t.substring(n,e);if(s!=Number(s)||t.charAt(e)!=="-")throw new Error("Illegal attachments");const r=Number(s);if(!Ai(r)||r<1)throw new Error("Illegal attachments");if(r>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=r}if(t.charAt(e+1)==="/"){const n=e+1;for(;++e&&!(t.charAt(e)===","||e===t.length););i.nsp=t.substring(n,e)}else i.nsp="/";const o=t.charAt(e+1);if(o!==""&&Number(o)==o){const n=e+1;for(;++e;){const s=t.charAt(e);if(s==null||Number(s)!=s){--e;break}if(e===t.length)break}i.id=Number(t.substring(n,e+1))}if(t.charAt(++e)){const n=this.tryParse(t.substr(e));if(Nt.isPayloadValid(i.type,n))i.data=n;else throw new Error("invalid payload")}return i}tryParse(t){try{return JSON.parse(t,this.opts.reviver)}catch{return!1}}static isPayloadValid(t,e){switch(t){case v.CONNECT:return Vt(e);case v.DISCONNECT:return e===void 0;case v.CONNECT_ERROR:return typeof e=="string"||Vt(e);case v.EVENT:case v.BINARY_EVENT:return Array.isArray(e)&&(typeof e[0]=="number"||typeof e[0]=="string"&&yi.indexOf(e[0])===-1);case v.ACK:case v.BINARY_ACK:return Array.isArray(e)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Ti{constructor(t){this.packet=t,this.buffers=[],this.reconPack=t}takeBinaryData(t){if(this.buffers.push(t),this.buffers.length===this.reconPack.attachments){const e=mi(this.reconPack,this.buffers);return this.finishedReconstruction(),e}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Ai=Number.isInteger||function(a){return typeof a=="number"&&isFinite(a)&&Math.floor(a)===a};function Vt(a){return Object.prototype.toString.call(a)==="[object Object]"}const wi=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Nt,Encoder:vi,get PacketType(){return v}},Symbol.toStringTag,{value:"Module"}));function L(a,t,e){return a.on(t,e),function(){a.off(t,e)}}const Ei=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class se extends _{constructor(t,e,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=t,this.nsp=e,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const t=this.io;this.subs=[L(t,"open",this.onopen.bind(this)),L(t,"packet",this.onpacket.bind(this)),L(t,"error",this.onerror.bind(this)),L(t,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...t){return t.unshift("message"),this.emit.apply(this,t),this}emit(t,...e){var i,o,n;if(Ei.hasOwnProperty(t))throw new Error('"'+t.toString()+'" is a reserved event name');if(e.unshift(t),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(e),this;const s={type:v.EVENT,data:e};if(s.options={},s.options.compress=this.flags.compress!==!1,typeof e[e.length-1]=="function"){const l=this.ids++,h=e.pop();this._registerAckCallback(l,h),s.id=l}const r=(o=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||o===void 0?void 0:o.writable,c=this.connected&&!(!((n=this.io.engine)===null||n===void 0)&&n._hasPingExpired());return this.flags.volatile&&!r||(c?(this.notifyOutgoingListeners(s),this.packet(s)):this.sendBuffer.push(s)),this.flags={},this}_registerAckCallback(t,e){var i;const o=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(o===void 0){this.acks[t]=e;return}const n=this.io.setTimeoutFn(()=>{delete this.acks[t];for(let r=0;r<this.sendBuffer.length;r++)this.sendBuffer[r].id===t&&this.sendBuffer.splice(r,1);e.call(this,new Error("operation has timed out"))},o),s=(...r)=>{this.io.clearTimeoutFn(n),e.apply(this,r)};s.withError=!0,this.acks[t]=s}emitWithAck(t,...e){return new Promise((i,o)=>{const n=(s,r)=>s?o(s):i(r);n.withError=!0,e.push(n),this.emit(t,...e)})}_addToQueue(t){let e;typeof t[t.length-1]=="function"&&(e=t.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:t,flags:Object.assign({fromQueue:!0},this.flags)};t.push((o,...n)=>(this._queue[0],o!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),e&&e(o)):(this._queue.shift(),e&&e(null,...n)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(t=!1){if(!this.connected||this._queue.length===0)return;const e=this._queue[0];e.pending&&!t||(e.pending=!0,e.tryCount++,this.flags=e.flags,this.emit.apply(this,e.args))}packet(t){t.nsp=this.nsp,this.io._packet(t)}onopen(){typeof this.auth=="function"?this.auth(t=>{this._sendConnectPacket(t)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(t){this.packet({type:v.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},t):t})}onerror(t){this.connected||this.emitReserved("connect_error",t)}onclose(t,e){this.connected=!1,delete this.id,this.emitReserved("disconnect",t,e),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(t=>{if(!this.sendBuffer.some(i=>String(i.id)===t)){const i=this.acks[t];delete this.acks[t],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(t){if(t.nsp===this.nsp)switch(t.type){case v.CONNECT:t.data&&t.data.sid?this.onconnect(t.data.sid,t.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case v.EVENT:case v.BINARY_EVENT:this.onevent(t);break;case v.ACK:case v.BINARY_ACK:this.onack(t);break;case v.DISCONNECT:this.ondisconnect();break;case v.CONNECT_ERROR:this.destroy();const i=new Error(t.data.message);i.data=t.data.data,this.emitReserved("connect_error",i);break}}onevent(t){const e=t.data||[];t.id!=null&&e.push(this.ack(t.id)),this.connected?this.emitEvent(e):this.receiveBuffer.push(Object.freeze(e))}emitEvent(t){if(this._anyListeners&&this._anyListeners.length){const e=this._anyListeners.slice();for(const i of e)i.apply(this,t)}super.emit.apply(this,t),this._pid&&t.length&&typeof t[t.length-1]=="string"&&(this._lastOffset=t[t.length-1])}ack(t){const e=this;let i=!1;return function(...o){i||(i=!0,e.packet({type:v.ACK,id:t,data:o}))}}onack(t){const e=this.acks[t.id];typeof e=="function"&&(delete this.acks[t.id],e.withError&&t.data.unshift(null),e.apply(this,t.data))}onconnect(t,e){this.id=t,this.recovered=e&&this._pid===e,this._pid=e,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(t=>this.emitEvent(t)),this.receiveBuffer=[],this.sendBuffer.forEach(t=>{this.notifyOutgoingListeners(t),this.packet(t)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(t=>t()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:v.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(t){return this.flags.compress=t,this}get volatile(){return this.flags.volatile=!0,this}timeout(t){return this.flags.timeout=t,this}onAny(t){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(t),this}prependAny(t){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(t),this}offAny(t){if(!this._anyListeners)return this;if(t){const e=this._anyListeners;for(let i=0;i<e.length;i++)if(t===e[i])return e.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(t){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(t),this}prependAnyOutgoing(t){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(t),this}offAnyOutgoing(t){if(!this._anyOutgoingListeners)return this;if(t){const e=this._anyOutgoingListeners;for(let i=0;i<e.length;i++)if(t===e[i])return e.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(t){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const e=this._anyOutgoingListeners.slice();for(const i of e)i.apply(this,t.data)}}}function K(a){a=a||{},this.ms=a.min||100,this.max=a.max||1e4,this.factor=a.factor||2,this.jitter=a.jitter>0&&a.jitter<=1?a.jitter:0,this.attempts=0}K.prototype.duration=function(){var a=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var t=Math.random(),e=Math.floor(t*this.jitter*a);a=Math.floor(t*10)&1?a+e:a-e}return Math.min(a,this.max)|0};K.prototype.reset=function(){this.attempts=0};K.prototype.setMin=function(a){this.ms=a};K.prototype.setMax=function(a){this.max=a};K.prototype.setJitter=function(a){this.jitter=a};class Et extends _{constructor(t,e){var i;super(),this.nsps={},this.subs=[],t&&typeof t=="object"&&(e=t,t=void 0),e=e||{},e.path=e.path||"/socket.io",this.opts=e,dt(this,e),this.reconnection(e.reconnection!==!1),this.reconnectionAttempts(e.reconnectionAttempts||1/0),this.reconnectionDelay(e.reconnectionDelay||1e3),this.reconnectionDelayMax(e.reconnectionDelayMax||5e3),this.randomizationFactor((i=e.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new K({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(e.timeout==null?2e4:e.timeout),this._readyState="closed",this.uri=t;const o=e.parser||wi;this.encoder=new o.Encoder,this.decoder=new o.Decoder,this._autoConnect=e.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(t){return arguments.length?(this._reconnection=!!t,t||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(t){return t===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=t,this)}reconnectionDelay(t){var e;return t===void 0?this._reconnectionDelay:(this._reconnectionDelay=t,(e=this.backoff)===null||e===void 0||e.setMin(t),this)}randomizationFactor(t){var e;return t===void 0?this._randomizationFactor:(this._randomizationFactor=t,(e=this.backoff)===null||e===void 0||e.setJitter(t),this)}reconnectionDelayMax(t){var e;return t===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=t,(e=this.backoff)===null||e===void 0||e.setMax(t),this)}timeout(t){return arguments.length?(this._timeout=t,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(t){if(~this._readyState.indexOf("open"))return this;this.engine=new ne(this.uri,this.opts);const e=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const o=L(e,"open",function(){i.onopen(),t&&t()}),n=r=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",r),t?t(r):this.maybeReconnectOnOpen()},s=L(e,"error",n);if(this._timeout!==!1){const r=this._timeout,c=this.setTimeoutFn(()=>{o(),n(new Error("timeout")),e.close()},r);this.opts.autoUnref&&c.unref(),this.subs.push(()=>{this.clearTimeoutFn(c)})}return this.subs.push(o),this.subs.push(s),this}connect(t){return this.open(t)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const t=this.engine;this.subs.push(L(t,"ping",this.onping.bind(this)),L(t,"data",this.ondata.bind(this)),L(t,"error",this.onerror.bind(this)),L(t,"close",this.onclose.bind(this)),L(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(t){try{this.decoder.add(t)}catch(e){this.onclose("parse error",e)}}ondecoded(t){pt(()=>{this.emitReserved("packet",t)},this.setTimeoutFn)}onerror(t){this.emitReserved("error",t)}socket(t,e){let i=this.nsps[t];return i?this._autoConnect&&!i.active&&i.connect():(i=new se(this,t,e),this.nsps[t]=i),i}_destroy(t){const e=Object.keys(this.nsps);for(const i of e)if(this.nsps[i].active)return;this._close()}_packet(t){const e=this.encoder.encode(t);for(let i=0;i<e.length;i++)this.engine.write(e[i],t.options)}cleanup(){this.subs.forEach(t=>t()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(t,e){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",t,e),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const t=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const e=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{t.skipReconnect||(this.emitReserved("reconnect_attempt",t.backoff.attempts),!t.skipReconnect&&t.open(o=>{o?(t._reconnecting=!1,t.reconnect(),this.emitReserved("reconnect_error",o)):t.onreconnect()}))},e);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const t=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",t)}}const J={};function lt(a,t){typeof a=="object"&&(t=a,a=void 0),t=t||{};const e=hi(a,t.path||"/socket.io"),i=e.source,o=e.id,n=e.path,s=J[o]&&n in J[o].nsps,r=t.forceNew||t["force new connection"]||t.multiplex===!1||s;let c;return r?c=new Et(i,t):(J[o]||(J[o]=new Et(i,t)),c=J[o]),e.query&&!t.query&&(t.query=e.queryKey),c.socket(e.path,t)}Object.assign(lt,{Manager:Et,Socket:se,io:lt,connect:lt});const Si=typeof window>"u"?"http://localhost:3000":`${window.location.protocol}//${window.location.hostname}:3000`,_i=Si,m=lt(_i,{autoConnect:!0}),Gt={[y.ROUND_START]:"Inicio de ronda",[y.PLANNING]:"Planificación",[y.RESOLVING]:"Resolviendo acciones…",[y.CLOSING]:"Actualizando el mundo…",[y.INTERNATIONAL_MEETING]:"Reunión de la OI"},Ri=`
  .pax-shell {
    --pax-bg: #050a19;
    --pax-panel: #0d1426;
    --pax-panel-raised: #121c31;
    --pax-border: #263249;
    --pax-muted: #8390a8;
    --pax-text: #e2e8f0;
    --pax-gold: #f5a900;
    height: 100dvh;
    width: 100%;
    display: grid;
    grid-template-rows: 58px minmax(0, 1fr);
    overflow: hidden;
    background: var(--pax-bg);
    color: var(--pax-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
  }
  .pax-start-menu {
    position: fixed;
    z-index: 10;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 7, 18, .88);
    backdrop-filter: blur(8px);
  }
  .pax-start-menu[hidden] { display: none; }
  .pax-start-card {
    width: min(440px, 100%);
    padding: 36px;
    border: 1px solid #34435d;
    border-radius: 16px;
    background: linear-gradient(145deg, #121d32, #080e1d);
    box-shadow: 0 24px 80px #0009;
    text-align: center;
  }
  .pax-start-brand { color: #f5a900; font-size: 42px; font-weight: 950; letter-spacing: .12em; }
  .pax-start-card h1 { margin: 10px 0; font-size: 23px; }
  .pax-start-card p { margin: 0; color: #9ba9bf; line-height: 1.6; }
  .pax-start-button {
    width: 100%;
    margin-top: 24px;
    padding: 13px 18px;
    border: 1px solid #eab23e;
    border-radius: 8px;
    color: #17120a;
    background: linear-gradient(180deg, #ffd66c, #efa91d);
    font: inherit;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
  }
  .pax-start-button:disabled { opacity: .5; cursor: not-allowed; }
  .pax-start-status { min-height: 18px; margin-top: 12px !important; font-size: 11px; }
  .pax-stage-overlay {
    position: fixed; inset: 0; z-index: 8; display: grid; place-items: center;
    pointer-events: none; background: rgba(3, 7, 18, .18);
  }
  .pax-stage-overlay[hidden] { display: none; }
  .pax-stage-overlay-card {
    padding: 12px 18px; border: 1px solid #53627d; border-radius: 9px;
    color: #e2e8f0; background: rgba(13, 20, 38, .94); box-shadow: 0 12px 35px #0008;
    font-weight: 800; letter-spacing: .02em;
  }
  .pax-shell *, .pax-shell *::before, .pax-shell *::after { box-sizing: border-box; }
  .pax-topbar {
    display: grid;
    grid-template-columns: 38px 68px minmax(186px, 240px) minmax(170px, 1fr) auto 112px;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    background: #080e1d;
    border-bottom: 1px solid var(--pax-border);
  }
  .pax-brand { color: var(--pax-gold); font-size: 18px; font-weight: 900; letter-spacing: .05em; white-space: nowrap; }
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button {
    min-height: 40px;
    display: flex;
    align-items: center;
    border: 1px solid var(--pax-border);
    border-radius: 7px;
    background: #10192b;
  }
  .pax-round { gap: 10px; padding: 0 10px; }
  .pax-round-icon { color: var(--pax-gold); font-size: 17px; }
  .pax-label { display: block; color: var(--pax-muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .pax-round-value { font-size: 13px; font-weight: 800; }
  .pax-timer { margin-left: auto; color: var(--pax-gold); font-size: 15px; font-weight: 900; font-variant-numeric: tabular-nums; }
  .pax-force-button, .pax-global-panel-button, .pax-action-button, .pax-development button {
    border: 1px solid #39455d;
    border-radius: 6px;
    color: var(--pax-text);
    background: #1a263b;
    font: inherit;
  }
  .pax-force-button { margin-left: 8px; padding: 5px 8px; color: #f4bd4d; font-size: 10px; font-weight: 800; }
  .pax-menu-button { width: 34px; height: 34px; border: 1px solid #39455d; border-radius: 6px; color: #e2e8f0; background: #10192b; font-size: 18px; cursor: pointer; }
  .pax-menu-overlay { position: fixed; z-index: 12; inset: 0; display: grid; place-items: center; padding: 20px; background: #030712cc; backdrop-filter: blur(6px); }
  .pax-menu-overlay[hidden] { display: none; }
  .pax-menu-card { width: min(360px, 100%); padding: 24px; border: 1px solid #34435d; border-radius: 12px; background: linear-gradient(145deg, #121d32, #080e1d); box-shadow: 0 24px 80px #0009; }
  .pax-menu-card h2 { margin: 0 0 18px; font-size: 18px; }
  .pax-menu-actions { display: grid; gap: 10px; }
  .pax-menu-actions button { min-height: 42px; padding: 9px 12px; border: 1px solid #39455d; border-radius: 6px; color: var(--pax-text); background: #1a263b; font: inherit; font-weight: 700; cursor: pointer; }
  .pax-menu-actions .pax-menu-end { border-color: #713a43; color: #fecaca; background: #351a22; }
  .pax-phase { display: block; min-width: 0; padding: 6px 12px; }
  .pax-phase strong { display: block; overflow: hidden; margin-top: 2px; color: #dce4f2; font-size: 11px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .pax-resources { justify-content: center; gap: 0; padding: 0 4px; }
  .pax-resource { display: flex; align-items: center; gap: 5px; padding: 0 9px; color: #d8e1ef; font-weight: 800; white-space: nowrap; }
  .pax-resource + .pax-resource { border-left: 1px solid var(--pax-border); }
  .pax-resource-icon { color: var(--pax-gold); }
  .pax-resource-icon[data-tooltip] { position: relative; font-style: normal; }
  .pax-resource-icon[data-tooltip]::after {
    position: absolute;
    z-index: 20;
    left: 50%;
    bottom: calc(100% + 9px);
    width: max-content;
    max-width: 180px;
    padding: 6px 8px;
    border: 1px solid #40506a;
    border-radius: 5px;
    color: #e8edf5;
    background: #111b2d;
    box-shadow: 0 5px 16px #0008;
    content: attr(data-tooltip);
    font: inherit;
    font-size: 11px;
    line-height: 1.3;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 3px);
    transition: opacity .12s, transform .12s;
    visibility: hidden;
  }
  .pax-resource-icon[data-tooltip]:hover::after,
  .pax-resource-icon[data-tooltip]:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
    visibility: visible;
  }
  .pax-resource:nth-child(2) .pax-resource-icon { color: #df8d31; }
  .pax-resource:nth-child(3) .pax-resource-icon { color: #a878e8; }
  .pax-resource:nth-child(4) .pax-resource-icon { color: #60a5fa; }
  .pax-resource-change { margin-left: -2px; color: #29ce9a; font-size: 10px; }
  .pax-global-panel-button { justify-content: center; gap: 8px; cursor: pointer; font-size: 11px; font-weight: 800; }
  .pax-global-panel-button span:first-child { color: #ffd24b; }
  .pax-main {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(250px, 22.5%) minmax(0, 1fr) minmax(260px, 23%);
  }
  .pax-sidebar, .pax-inspector {
    min-width: 0;
    min-height: 0;
    background: var(--pax-panel);
  }
  .pax-sidebar { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--pax-border); }
  .pax-nation {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 74px;
    padding: 13px 15px;
    border-bottom: 1px solid var(--pax-border);
  }
  .pax-nation-dot { flex: 0 0 14px; width: 14px; height: 14px; border: 2px solid #50350a; border-radius: 50%; background: var(--nation-color); box-shadow: 0 0 10px color-mix(in srgb, var(--nation-color), transparent 55%); }
  .pax-nation-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 800; line-height: 1.35; }
  .pax-human-tag { padding: 4px 7px; border: 1px solid #674914; border-radius: 5px; color: #f5b72f; background: #251c12; font-size: 10px; font-weight: 800; }
  .pax-panel-section { padding: 14px 12px; border-bottom: 1px solid #1c273b; }
  .pax-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 8px; border-bottom: 1px solid var(--pax-border); background: #0a1120; }
  .pax-tab { min-width: 0; min-height: 34px; padding: 6px 4px; border: 1px solid #293750; border-radius: 6px; color: #93a1b5; background: #10192b; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-tab:hover { color: #e2e8f0; border-color: #53627d; }
  .pax-tab.is-active { color: #17120a; border-color: #f5b72f; background: linear-gradient(180deg, #ffd66c, #efa91d); }
  .pax-tab-panel { min-height: 0; flex: 1; overflow: auto; }
  .pax-tab-panel[hidden] { display: none; }
  .pax-tab-panel.log-tab-panel { overflow: hidden; }
  .pax-tab-panel.log-tab-panel .pax-panel-section {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }
  .pax-info-heading { cursor: help; }
  .pax-panel-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; color: #9ba9bf; font-size: 11px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  .pax-panel-heading-icon { color: var(--pax-gold); font-size: 14px; }
  .pax-tax-card { margin-top: 10px; padding: 11px; border: 1px solid #202c41; border-radius: 8px; background: #070d1c; }
  .pax-shell .tax-slider-container { padding: 0; border: 0; border-radius: 0; color: var(--pax-text); background: transparent; font: inherit; }
  .pax-shell .tax-slider-container label { display: none; }
  .pax-shell .tax-slider-container input { width: 100%; height: 8px; accent-color: #f5a900; cursor: pointer; }
  .pax-shell .tax-slider-container p { display: none; }
  .pax-formula-line { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0; color: #9eabc0; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-formula-line.is-detail { display: none; }
  .pax-formula-line strong { color: #32d5a3; white-space: nowrap; }
  .pax-formula-line.is-forecast { padding-top: 5px; border-top: 1px solid #202c41; font-family: inherit; }
  .pax-tax-note { display: none; }
  .pax-action-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; text-align: left; }
  .pax-action-main { display: flex; align-items: center; gap: 8px; }
  .pax-action-icon { color: #f5b72f; font-size: 16px; }
  .pax-action-name { display: block; font-size: 11px; font-weight: 800; }
  .pax-action-caption { display: block; margin-top: 3px; color: var(--pax-muted); font-size: 10px; }
  .pax-action-cost { padding: 4px 5px; border-radius: 4px; color: #f4c253; background: #1a1b27; font-size: 9px; font-weight: 800; white-space: nowrap; }
  .pax-action-button:disabled, .pax-force-button:disabled { opacity: .38; cursor: not-allowed; }
  .pax-oi-tag { margin-left: auto; padding: 5px 7px; border: 1px solid #493361; border-radius: 5px; color: #c8a6ed; background: #1b1528; font-size: 9px; letter-spacing: 0; text-transform: none; }
  .pax-oi-card { padding: 10px; border: 1px solid #202c41; border-radius: 8px; background: #070d1c; }
  .pax-oi-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; color: var(--pax-muted); font-size: 10px; }
  .pax-oi-row strong { color: #d1b0ef; }
  .pax-oi-proposal { color: #bac5d6; font-size: 10px; line-height: 1.45; }
  .pax-oi-proposal strong { display: block; margin-top: 4px; color: #e4eaf3; }
  .pax-oi-controls { display: grid; gap: 8px; margin-top: 9px; }
  .pax-oi-controls label { display: grid; gap: 4px; color: #aab6c9; font-size: 10px; }
  .pax-oi-controls select, .pax-oi-controls input { width: 100%; min-height: 30px; padding: 5px 7px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-oi-controls button { min-height: 31px; padding: 6px 8px; border: 1px solid #5b4770; border-radius: 5px; color: #ead9fa; background: #21172e; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-oi-controls button:disabled { opacity: .45; cursor: not-allowed; }
  .pax-oi-vote { padding: 8px 0; border-top: 1px solid #202c41; }
  .pax-oi-vote > strong { display: block; margin-bottom: 6px; color: #e4eaf3; font-size: 10px; line-height: 1.4; }
  .pax-oi-vote-fields { display: grid; grid-template-columns: 1fr 80px; gap: 6px; }
  .pax-oi-note { color: #8f9cb2; font-size: 10px; line-height: 1.45; }
  .pax-event-log { min-height: 0; flex: 1; overflow: auto; padding: 8px 9px; border: 1px solid #202c41; border-radius: 6px; background: #070d1c; color: #a9b5c8; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pax-event-entry + .pax-event-entry { margin-top: 6px; }
  .pax-center { min-width: 0; min-height: 0; display: grid; grid-template-rows: 46px minmax(0, 1fr) auto 37px; padding: 0 14px; background: #050a19; }
  .pax-map-viewport { position: relative; min-width: 0; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #26334a; border-radius: 12px; background: #0d1527; box-shadow: 0 8px 24px #0005; }
  .pax-action-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 9px 0; }
  .pax-action-slots-heading { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; color: #aab6c9; font-size: 10px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  .pax-action-slots-heading small { color: #77849a; font-size: 9px; font-weight: 500; letter-spacing: 0; text-transform: none; }
  .pax-action-slot-wrap { min-width: 0; display: flex; align-items: center; gap: 6px; }
  .pax-action-slot { min-width: 0; min-height: 60px; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid #2d3b54; border-radius: 8px; color: #e2e8f0; background: #101a2c; text-align: left; cursor: pointer; }
  .pax-action-slot-wrap .pax-action-slot { flex: 1; }
  .pax-action-slot.is-active { border-color: #f5b72f; box-shadow: 0 0 0 1px #f5b72f44; }
  .pax-action-slot:disabled { opacity: .55; cursor: not-allowed; }
  .pax-action-slot-number { flex: 0 0 24px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; color: #f5c34f; background: #2a2417; font-size: 11px; font-weight: 900; }
  .pax-action-slot-copy { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .pax-action-slot-copy strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .pax-action-slot-copy small { overflow: hidden; color: #94a3b8; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .pax-action-slot-clear { flex: 0 0 auto; width: 25px; height: 25px; border: 1px solid #43516a; border-radius: 5px; color: #cbd5e1; background: #1b2639; cursor: pointer; }
  .pax-action-slot-clear:disabled { opacity: .35; cursor: not-allowed; }
  .pax-map-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #8491a7; font-size: 10px; }
  .pax-map-hint { color: #f2b938; }
  .pax-map-size { color: #68758d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .pax-inspector { overflow: auto; border-left: 1px solid var(--pax-border); }
  .pax-section-heading { min-height: 53px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid var(--pax-border); font-size: 13px; font-weight: 900; }
  .pax-heading-icon { color: #f2b938; font-size: 16px; }
  .pax-coordinates { margin-left: auto; padding: 4px 6px; border-radius: 4px; color: #9aa7bb; background: #1a2437; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .pax-inspector-content { padding: 16px; }
  .pax-inspector-empty { margin: 16px; padding: 24px 18px; border: 1px dashed #35415a; border-radius: 9px; color: var(--pax-muted); font-size: 12px; line-height: 1.5; text-align: center; }
  .pax-tile-card { max-width: 225px; min-height: 205px; margin: 0 auto; padding: 13px; border: 2px solid var(--nation-color); border-radius: 11px; background: #080e1d; box-shadow: inset 0 0 0 1px #ffffff08, 0 8px 25px #0004; }
  .pax-tile-card-top, .pax-tile-card-bottom { display: flex; justify-content: space-between; align-items: center; color: #dce5f4; }
  .pax-tile-defense, .pax-tile-type { padding: 4px 6px; border: 1px solid #26334a; border-radius: 4px; background: #111a2b; font-size: 10px; font-weight: 800; }
  .pax-tile-art { height: 90px; display: flex; align-items: center; justify-content: center; color: var(--tile-accent); font-size: 58px; line-height: 1; text-shadow: 0 4px 20px #0008; }
  .pax-tile-owner { width: fit-content; max-width: 100%; margin: 0 auto 8px; overflow: hidden; padding: 4px 9px; border-radius: 4px; color: #aebbd0; background: #202b3e; font-size: 9px; font-weight: 900; letter-spacing: .04em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .pax-tile-details { display: flex; justify-content: space-between; padding: 0 3px 8px; color: #b4c0d2; font-size: 10px; }
  .pax-tile-details span { display: flex; align-items: center; gap: 4px; }
  .pax-tile-details i { color: #6bb4f1; font-style: normal; }
  .pax-tile-card-bottom { min-height: 22px; color: #99a6ba; font-size: 9px; }
  .pax-status-dot { width: 13px; height: 13px; border: 2px solid #1b2938; border-radius: 50%; background: var(--status-color); box-shadow: 0 0 8px color-mix(in srgb, var(--status-color), transparent 45%); }
  .pax-development { margin-top: 30px; }
  .pax-development h3 { margin: 0 0 12px; color: #8b98ad; font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .pax-development p { color: #77849a; font-size: 11px; font-style: italic; line-height: 1.5; }
  .pax-feature-tag { width: fit-content; padding: 4px 7px; border-radius: 4px; color: #a9d9f7; background: #132638; font-size: 10px; }
  .pax-development button { width: 100%; padding: 8px; font-size: 11px; }
  .pax-tile-actions { display: grid; gap: 7px; margin-top: 10px; }
  .pax-tile-action-control { display: grid; grid-template-columns: minmax(76px, 92px) minmax(0, 1fr); align-items: end; gap: 6px; }
  .pax-tile-quantity { display: grid; gap: 4px; color: #97a5ba; font-size: 9px; }
  .pax-tile-quantity input { width: 100%; min-width: 0; padding: 7px 6px; border: 1px solid #35445e; border-radius: 6px; color: #e2e8f0; background: #0b1322; font: inherit; font-size: 11px; }
  .pax-tile-quantity input:disabled { opacity: .4; }
  .pax-tile-action { width: 100%; min-height: 47px; display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; padding: 7px 8px; border: 1px solid #35445e; border-radius: 7px; color: #e2e8f0; background: #17243a; text-align: left; cursor: pointer; transition: opacity .15s, border-color .15s, background .15s; }
  .pax-tile-action:not(:disabled):hover { border-color: #d99d2c; background: #202b3c; }
  .pax-tile-action.is-unavailable { opacity: .38; filter: saturate(.55); cursor: not-allowed; }
  .pax-tile-action-copy { min-width: 0; display: grid; grid-template-rows: auto auto; gap: 3px; }
  .pax-tile-action-copy strong { font-size: 10px; }
  .pax-tile-action-copy small { color: #97a5ba; font-size: 9px; }
  .pax-dialog { width: min(1200px, calc(100vw - 32px)); max-height: min(88vh, 820px); overflow: auto; margin: auto; padding: 0; border: 1px solid #334155; border-radius: 12px; background: #0d1426; color: var(--pax-text); }
  .pax-end-dialog { width: min(1100px, calc(100vw - 32px)); }
  .pax-dialog::backdrop { background: #020617c9; backdrop-filter: blur(3px); }
  .pax-dialog-heading { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--pax-border); font-weight: 900; }
  .pax-dialog-close { padding: 5px 9px; border: 1px solid #334155; border-radius: 5px; color: var(--pax-text); background: #172238; cursor: pointer; }
  .pax-scoreboard-wrap { padding: 12px; }
  .pax-scoreboard-status { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #263249; }
  .pax-scoreboard-status div { display: grid; gap: 4px; }
  .pax-scoreboard-status span, .pax-scoreboard-note { color: #93a1b5; font-size: 10px; }
  .pax-scoreboard-status strong { color: #f2bb3b; font-size: 15px; }
  .pax-scoreboard-clock { text-align: right; }
  .pax-global-table-scroll { overflow-x: auto; }
  .pax-global-table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
  .pax-global-table th, .pax-global-table td { padding: 9px 10px; border-bottom: 1px solid #263249; text-align: right; font-variant-numeric: tabular-nums; }
  .pax-global-table thead th { color: #93a1b5; background: #10192b; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .pax-global-table thead th:first-child, .pax-global-table tbody th { text-align: left; }
  .pax-global-table tbody tr { border-left: 3px solid var(--score-nation-color); }
  .pax-global-table tbody tr.is-local-player { background: #f2bb3b0d; }
  .pax-global-table tbody th { color: #e2e8f0; font-weight: 700; }
  .pax-global-table tbody td { color: #cbd5e1; }
  .pax-global-table .pax-score-total { color: #38bdf8; font-size: 13px; font-weight: 900; }
  .pax-score-rank { display: inline-grid; width: 20px; height: 20px; margin-right: 8px; place-items: center; border-radius: 50%; color: #cbd5e1; background: #263249; font-size: 10px; }
  .pax-scoreboard-note { margin: 10px 2px 0; }
  .pax-end-result { padding: 18px 16px 6px; text-align: center; }
  .pax-end-result h2 { margin: 0; color: #f5c451; font-size: 23px; }
  .pax-end-result p { margin: 8px 0 0; color: #cbd5e1; }
  .pax-end-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 12px 16px 18px; }
  .pax-end-actions button { min-height: 42px; padding: 9px 16px; border: 1px solid #39455d; border-radius: 6px; color: var(--pax-text); background: #1a263b; font: inherit; font-weight: 800; cursor: pointer; }
  .pax-end-actions button:first-child { border-color: #eab23e; color: #17120a; background: linear-gradient(180deg, #ffd66c, #efa91d); }
  .pax-end-actions button:disabled { opacity: .6; cursor: wait; }
  .pax-global-treaties { margin-top: 16px; padding-top: 12px; border-top: 1px solid #263249; }
  .pax-global-treaties h3, .pax-global-treaty-form h3 { margin: 0 0 9px; color: #e2e8f0; font-size: 12px; }
  .pax-global-treaty { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 9px; border: 1px solid #263249; border-radius: 6px; background: #10192b; font-size: 10px; }
  .pax-global-treaty + .pax-global-treaty { margin-top: 6px; }
  .pax-global-treaty strong { color: #e2e8f0; }
  .pax-global-treaty span, .pax-global-treaty small, .pax-global-empty, .pax-global-treaty-form p { color: #93a1b5; }
  .pax-global-treaty button, .pax-global-treaty-form button { padding: 5px 9px; border: 1px solid #42516b; border-radius: 5px; color: #e2e8f0; background: #1b2940; cursor: pointer; font: inherit; }
  .pax-global-treaty button:disabled { opacity: .5; cursor: not-allowed; }
  .pax-global-treaty-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #263249; }
  .pax-global-treaty-form h3, .pax-global-treaty-form p, .pax-global-treaty-form button, .pax-global-panel-status { grid-column: 1 / -1; }
  .pax-global-treaty-form label { display: grid; gap: 5px; color: #aab6c9; font-size: 10px; }
  .pax-global-treaty-form select { min-height: 32px; padding: 5px 7px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-global-treaty-form :disabled { opacity: .5; cursor: not-allowed; }
  .pax-global-treaty-form p, .pax-global-empty, .pax-global-panel-status { margin: 0; font-size: 10px; line-height: 1.45; }
  .pax-finance { display: grid; gap: 9px; }
  .pax-finance h3 { margin: 8px 0 0; color: #dce4f2; font-size: 11px; }
  .pax-finance form { display: grid; gap: 7px; padding: 8px; border: 1px solid #263249; border-radius: 6px; background: #070d1c; }
  .pax-finance label { display: grid; gap: 4px; color: #aab6c9; font-size: 10px; }
  .pax-finance input, .pax-finance select { width: 100%; min-height: 29px; padding: 4px 6px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #10192b; font: inherit; }
  .pax-finance button { min-height: 30px; padding: 6px 8px; border: 1px solid #39455d; border-radius: 5px; color: #e2e8f0; background: #1a263b; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
  .pax-finance button:disabled, .pax-finance input:disabled, .pax-finance select:disabled { opacity: .45; cursor: not-allowed; }
  .pax-finance-note, .pax-finance-debt small, .pax-finance-status { margin: 0; color: #93a1b5; font-size: 10px; line-height: 1.45; }
  .pax-finance-debt { margin-top: 7px; }
  .pax-finance-debt strong { color: #e2e8f0; font-size: 10px; }
  .pax-finance-status { color: #f2bb3b; }
  .pax-market-card { display: grid; gap: 8px; padding: 9px; border: 1px solid #263249; border-radius: 7px; background: #070d1c; }
  .pax-market-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .pax-market-actions form { padding: 0; border: 0; background: transparent; }
  .pax-market-actions input { text-align: center; }
  .pax-market-actions button { min-height: 28px; }
  .pax-quantity-controls { display: grid; grid-template-columns: 28px minmax(0, 1fr) 28px 42px; gap: 4px; }
  .pax-quantity-controls button { padding: 2px; }
  #finance-debt-content { display: grid; gap: 8px; }
  #finance-debt-content h3 { margin-top: 0; }
  @media (max-width: 1100px) {
    .pax-main { grid-template-columns: 240px minmax(0, 1fr) 260px; }
    .pax-topbar { grid-template-columns: 36px 62px minmax(150px, 190px) minmax(140px, 1fr) auto 98px; gap: 6px; padding-inline: 7px; }
    .pax-resource { gap: 4px; padding-inline: 6px; }
    .pax-center { padding-inline: 9px; }
  }
  @media (max-width: 820px) {
    .pax-shell { height: auto; min-height: 100dvh; grid-template-rows: auto minmax(70vh, 1fr); overflow: auto; }
    .pax-topbar { grid-template-columns: 36px 62px minmax(0, 1fr) 92px; }
    .pax-phase { display: none; }
    .pax-resources { grid-column: 1 / 5; grid-row: 2; justify-content: flex-start; min-height: 34px; }
    .pax-topbar { grid-template-rows: 40px 34px; }
    .pax-main { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(55vh, 1fr) auto auto; }
    .pax-center { grid-row: 1; min-height: 55vh; }
    .pax-sidebar { grid-row: 2; border-top: 1px solid var(--pax-border); border-right: 0; }
    .pax-inspector { grid-row: 3; border-top: 1px solid var(--pax-border); border-left: 0; }
    .pax-inspector-content { display: grid; grid-template-columns: minmax(190px, 240px) minmax(0, 1fr); gap: 20px; align-items: center; }
    .pax-development { margin-top: 0; }
  }
  @media (max-width: 520px) {
    .pax-topbar { grid-template-columns: 36px 58px minmax(0, 1fr) 90px; }
    .pax-brand { font-size: 13px; letter-spacing: 0; }
    .pax-brand { grid-column: 2; }
    .pax-round { grid-column: 3; }
    .pax-resources { grid-column: 1 / 5; overflow-x: auto; }
    .pax-global-panel-button { font-size: 10px; }
    .pax-center { grid-template-rows: 58px minmax(0, 1fr) auto 37px; padding-inline: 5px; }
    .pax-action-slots { gap: 6px; }
    .pax-action-slot { min-height: 54px; gap: 5px; padding: 6px; }
    .pax-inspector-content { grid-template-columns: minmax(0, 1fr); }
    .pax-development { margin-top: 8px; }
    .pax-map-size { font-size: 9px; }
  }
  /* Terminal geopolítico: superficies y estados compartidos por toda la interfaz. */
  .pax-shell {
    --pax-bg: #0f172a;
    --pax-panel: #111c2f;
    --pax-panel-raised: #1e293b;
    --pax-border: rgba(148, 163, 184, .18);
    --pax-muted: #94a3b8;
    --pax-text: #e2e8f0;
    --pax-gold: #fbbf24;
    --pax-purple: #c4b5fd;
    --pax-positive: #86efac;
    background: var(--pax-bg);
    letter-spacing: .01em;
  }
  .pax-shell button,
  .pax-shell input,
  .pax-shell select {
    transition: color .18s ease, background-color .18s ease, border-color .18s ease,
      box-shadow .18s ease, opacity .18s ease, transform .18s ease;
  }
  .pax-shell button:not(:disabled):hover {
    border-color: rgba(251, 191, 36, .72);
    box-shadow: 0 3px 14px rgba(2, 6, 23, .28);
  }
  .pax-shell button:not(:disabled):active { transform: translateY(1px); }
  [data-tooltip] { position: relative; }
  [data-tooltip]::after {
    position: absolute;
    z-index: 30;
    left: 50%;
    bottom: calc(100% + 8px);
    width: max-content;
    max-width: 230px;
    padding: 6px 8px;
    border: 1px solid rgba(148, 163, 184, .38);
    border-radius: 5px;
    color: #e2e8f0;
    background: #0f172a;
    box-shadow: 0 8px 20px rgba(2, 6, 23, .42);
    content: attr(data-tooltip);
    font: 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 3px);
    transition: opacity .15s ease, transform .15s ease;
    visibility: hidden;
  }
  [data-tooltip]:hover::after, [data-tooltip]:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
    visibility: visible;
  }
  .pax-shell [data-tooltip]::after { display: none; }
  .pax-tooltip-layer {
    position: fixed;
    z-index: 10000;
    max-width: min(280px, calc(100vw - 24px));
    padding: 7px 9px;
    border: 1px solid rgba(148, 163, 184, .48);
    border-radius: 6px;
    color: #f8fafc;
    background: #0b1324;
    box-shadow: 0 10px 28px rgba(2, 6, 23, .6);
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    opacity: 0;
    pointer-events: none;
    transition: opacity .12s ease;
  }
  .pax-tooltip-layer.is-visible { opacity: 1; }
  .pax-toasts {
    position: absolute;
    z-index: 5;
    top: 10px;
    left: 10px;
    right: 132px;
    display: grid;
    gap: 7px;
    pointer-events: none;
  }
  .pax-toast {
    width: fit-content;
    max-width: min(440px, 100%);
    padding: 8px 11px;
    border: 1px solid var(--toast-color);
    border-radius: 7px;
    color: #f8fafc;
    background: rgba(15, 23, 42, .94);
    box-shadow: 0 8px 24px rgba(2, 6, 23, .38);
    font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    opacity: 0;
    transform: translateY(-5px);
    animation: pax-toast-in .18s ease forwards;
  }
  .pax-toast.is-leaving { animation: pax-toast-out .22s ease forwards; }
  .pax-toast[data-type="success"] { --toast-color: #57d69a; }
  .pax-toast[data-type="info"] { --toast-color: #79a7f2; }
  .pax-toast[data-type="warning"] { --toast-color: #f5b62e; }
  .pax-toast[data-type="error"] { --toast-color: #f87171; }
  @keyframes pax-toast-in { to { opacity: 1; transform: translateY(0); } }
  @keyframes pax-toast-out { to { opacity: 0; transform: translateY(-5px); } }
  .pax-topbar { background: #0b1324; border-color: var(--pax-border); }
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button,
  .pax-menu-button { background: var(--pax-panel-raised); border-color: var(--pax-border); }
  .pax-round-value, .pax-resource, .pax-formula-line strong,
  .pax-finance-debt strong, .pax-scoreboard-status strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .pax-main, .pax-center { background: var(--pax-bg); }
  .pax-sidebar, .pax-inspector { background: var(--pax-panel); }
  .pax-nation, .pax-panel-section, .pax-section-heading { border-color: var(--pax-border); }
  .pax-nation { background: rgba(30, 41, 59, .42); }
  .pax-nation-name { color: #f8fafc; }
  .pax-human-tag, .pax-force-button { color: var(--pax-gold); border-color: rgba(251, 191, 36, .35); background: rgba(120, 83, 10, .2); }
  .pax-tabs { background: #0d1729; border-color: var(--pax-border); }
  .pax-tab { color: #a5b4fc; background: var(--pax-panel-raised); border-color: var(--pax-border); }
  .pax-tab[data-panel-tab="finance"] { color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"] { color: #cbd5e1; }
  .pax-tab.is-active { color: #0f172a; background: var(--pax-gold); border-color: var(--pax-gold); }
  .pax-panel-heading, .pax-info-heading { color: #cbd5e1; }
  .pax-tax-card, .pax-market-card, .pax-finance form, .pax-oi-card,
  .pax-event-log, .pax-action-slot, .pax-inspector-empty, .pax-tile-card {
    background: var(--pax-panel-raised);
    border-color: var(--pax-border);
    box-shadow: 0 5px 16px rgba(2, 6, 23, .16);
  }
  .pax-formula-line strong, .pax-timer, .pax-round-icon, .pax-resource-icon { color: var(--pax-gold); }
  .pax-resource:nth-child(3) .pax-resource-icon, .pax-oi-tag,
  .pax-oi-row strong { color: var(--pax-purple); }
  .pax-oi-tag { border-color: rgba(196, 181, 253, .3); background: rgba(124, 58, 237, .15); }
  .pax-oi-card { border-color: rgba(196, 181, 253, .22); }
  .pax-finance button[data-issue-bond],
  .pax-finance button[data-donate-world-bank],
  .pax-finance form button[type="submit"],
  .pax-start-button { color: #052e16; border-color: rgba(134, 239, 172, .65); background: #86efac; }
  .pax-finance button[data-issue-bond]:hover,
  .pax-finance button[data-donate-world-bank]:hover,
  .pax-finance form button[type="submit"]:hover,
  .pax-start-button:hover { background: #bbf7d0; border-color: #bbf7d0; }
  .pax-finance input, .pax-finance select, .pax-oi-controls select,
  .pax-oi-controls input, .pax-global-treaty-form select, .pax-tile-quantity input {
    background: #0f172a;
    border-color: var(--pax-border);
  }
  .pax-finance input:focus, .pax-finance select:focus, .pax-oi-controls select:focus,
  .pax-oi-controls input:focus, .pax-global-treaty-form select:focus {
    outline: none;
    border-color: rgba(251, 191, 36, .75);
    box-shadow: 0 0 0 3px rgba(251, 191, 36, .12);
  }
  .pax-finance input, .pax-finance-debt input, .pax-oi-controls input,
  .pax-global-table td, .pax-global-table th, .pax-round-value,
  .pax-resource, .pax-map-size { font-variant-numeric: tabular-nums; }
  .pax-finance input, .pax-finance-debt input, .pax-oi-controls input,
  .pax-global-table td, .pax-global-table th, .pax-round-value,
  .pax-resource, .pax-map-size { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .pax-action-slot:not(:disabled):hover { border-color: rgba(134, 239, 172, .7); background: #263a3a; }
  .pax-action-slot.is-active { border-color: var(--pax-gold); box-shadow: 0 0 0 1px rgba(251, 191, 36, .3); }
  .pax-event-log { color: #cbd5e1; }
  .pax-dialog, .pax-menu-card, .pax-start-card {
    background: var(--pax-panel-raised);
    border-color: var(--pax-border);
    box-shadow: 0 20px 55px rgba(2, 6, 23, .48);
  }
  /* Reference skin: keep the existing layout, but use a restrained terminal palette. */
  .pax-shell {
    --pax-bg: #101a2b;
    --pax-panel: rgba(15, 25, 42, .94);
    --pax-panel-raised: rgba(30, 41, 59, .92);
    --pax-border: rgba(148, 163, 184, .28);
    --pax-muted: #a7b3c7;
    --pax-text: #f1f5f9;
    --pax-gold: #f5b62e;
    --pax-blue: #79a7f2;
    --pax-purple: #a78bda;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    background:
      linear-gradient(135deg, rgba(15, 23, 42, .9), rgba(15, 23, 42, .68)),
      var(--pax-bg);
  }
  .pax-shell h1, .pax-shell h2, .pax-shell h3, .pax-shell button,
  .pax-shell input, .pax-shell select, .pax-shell label, .pax-shell strong,
  .pax-shell span, .pax-shell p { font-family: inherit; }
  .pax-topbar { background: rgba(10, 18, 32, .94); }
  .pax-brand { color: #f8fafc; font-size: 17px; letter-spacing: .12em; }
  .pax-round, .pax-phase, .pax-resources, .pax-global-panel-button,
  .pax-menu-button { background: rgba(30, 41, 59, .74); border-color: var(--pax-border); }
  .pax-label { color: #94a3b8; }
  .pax-nation { background: rgba(15, 25, 42, .72); }
  .pax-nation-name { font-size: 14px; letter-spacing: .02em; }
  .pax-human-tag { color: #dbeafe; border-color: rgba(96, 165, 250, .85); background: #3974c5; }
  .pax-tabs { padding: 6px 8px 5px; background: transparent; }
  .pax-tab {
    min-height: 28px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: var(--pax-blue);
    background: transparent;
    text-align: left;
  }
  .pax-tab span { margin-right: 4px; color: currentColor; }
  .pax-tab[data-panel-tab="finance"] { color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"] { color: #cbd5e1; }
  .pax-tab.is-active {
    color: #f8fafc;
    border-bottom-color: var(--pax-gold);
    background: transparent;
    box-shadow: none;
  }
  .pax-tab[data-panel-tab="finance"].is-active { border-bottom-color: var(--pax-purple); }
  .pax-tab[data-panel-tab="log"].is-active { border-bottom-color: #94a3b8; }
  .pax-panel-section { padding: 12px 10px; }
  .pax-panel-heading { color: #f8fafc; font-size: 12px; letter-spacing: .02em; }
  .pax-panel-heading-icon { color: var(--pax-gold); }
  .pax-section-help {
    width: 17px;
    height: 17px;
    display: inline-grid;
    flex: 0 0 auto;
    margin-left: auto;
    place-items: center;
    border: 1px solid rgba(148, 163, 184, .55);
    border-radius: 50%;
    color: #cbd5e1;
    background: rgba(15, 23, 42, .65);
    font-size: 10px;
    font-weight: 900;
    cursor: help;
  }
  .pax-section-help:hover, .pax-section-help:focus-visible {
    border-color: var(--pax-gold);
    color: var(--pax-gold);
    outline: none;
  }
  .pax-tax-card, .pax-market-card, .pax-finance form, .pax-oi-card,
  .pax-event-log, .pax-action-slot, .pax-inspector-empty, .pax-tile-card {
    background: rgba(30, 41, 59, .78);
    border-color: var(--pax-border);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(2, 6, 23, .22);
  }
  .pax-formula-line, .pax-finance-note, .pax-oi-note, .pax-tax-note {
    color: #c0cad8;
  }
  .pax-formula-line strong, .pax-timer { color: var(--pax-gold); }
  .pax-resource:nth-child(2) .pax-resource-icon { color: #d5a548; }
  .pax-resource:nth-child(3) .pax-resource-icon { color: var(--pax-purple); }
  .pax-resource:nth-child(4) .pax-resource-icon { color: var(--pax-blue); }
  .pax-global-panel-button span:first-child { color: var(--pax-blue); }
  .pax-finance button, .pax-global-treaty button, .pax-global-treaty-form button,
  .pax-development button, .pax-action-button {
    background: rgba(30, 41, 59, .95);
    border-color: rgba(148, 163, 184, .38);
  }
  .pax-finance button[data-issue-bond],
  .pax-finance button[data-donate-world-bank],
  .pax-finance form button[type="submit"] {
    color: #b9f6c9;
    border-color: #5da477;
    background: rgba(31, 78, 55, .72);
  }
  .pax-finance button[data-issue-bond]:hover,
  .pax-finance button[data-donate-world-bank]:hover,
  .pax-finance form button[type="submit"]:hover {
    color: #dcffe4;
    background: rgba(49, 112, 77, .92);
  }
  .pax-oi-tag, .pax-oi-card { color: var(--pax-purple); border-color: rgba(167, 139, 218, .48); }
  .pax-oi-tag { background: rgba(91, 63, 135, .28); }
  .pax-oi-controls button { color: #d7c6f4; border-color: rgba(167, 139, 218, .55); background: rgba(91, 63, 135, .35); }
  .pax-finance input, .pax-finance select, .pax-oi-controls select,
  .pax-oi-controls input, .pax-global-treaty-form select, .pax-tile-quantity input {
    color: #f1f5f9;
    background: rgba(15, 23, 42, .82);
    border-color: rgba(148, 163, 184, .38);
  }
  .pax-finance input:focus, .pax-finance select:focus, .pax-oi-controls select:focus,
  .pax-oi-controls input:focus, .pax-global-treaty-form select:focus {
    border-color: var(--pax-gold);
    box-shadow: 0 0 0 2px rgba(245, 182, 46, .16);
  }
  .pax-event-log { color: #d1d9e6; }
  .pax-dialog, .pax-menu-card, .pax-start-card {
    background: rgba(15, 25, 42, .98);
    border-color: var(--pax-border);
  }
  .pax-market-card {
    display: grid;
    gap: 18px;
    padding: 18px;
    border: 1px solid rgba(121, 167, 242, .5);
    background: rgba(22, 35, 57, .84);
  }
  .pax-market-card::before {
    content: "Compra: 3 Plata   |   Vende: 1 Plata / Material";
    color: #b7c4d8;
    font-size: 11px;
    letter-spacing: .02em;
  }
  .pax-market-quantity {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 38px 58px;
    align-items: center;
    gap: 7px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(148, 163, 184, .24);
  }
  .pax-market-quantity button, .pax-market-quantity output {
    min-height: 34px;
    display: grid;
    place-items: center;
    padding: 5px;
    border: 1px solid rgba(148, 163, 184, .4);
    border-radius: 6px;
    color: #e2e8f0;
    background: rgba(15, 23, 42, .75);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }
  .pax-market-quantity output {
    border-color: rgba(121, 167, 242, .45);
    font-size: 15px;
  }
  .pax-market-quantity input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .pax-market-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pax-market-actions button {
    min-height: 46px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 900;
  }
  .pax-market-actions button[data-market-action="BUY_MATERIALS"] {
    color: #061b12;
    border-color: #4fc98b;
    background: #35bd80;
  }
  .pax-market-actions button[data-market-action="SELL_MATERIALS"] {
    color: #241703;
    border-color: #e9aa31;
    background: #e9a719;
  }
  .pax-market-actions button:hover { filter: brightness(1.12); }
  .pax-bank-card {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid rgba(148, 163, 184, .28);
    border-radius: 8px;
    background: rgba(30, 41, 59, .66);
  }
  .pax-bank-card[hidden] { display: none; }
  .pax-bank-actions { grid-template-columns: 1fr 1fr; }
  .pax-bank-actions button { min-height: 36px; }
  .pax-repayment-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
  .pax-repayment-row input { min-width: 0; }
  .pax-finance-debt { display: grid; gap: 5px; margin: 0; }
  .pax-finance-debt small { color: #a7b3c7; }
  .pax-oi-card { display: grid; gap: 10px; }
  .pax-oi-tag { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;function O(a){return Number.isFinite(a)?Math.floor(a).toLocaleString("es-ES"):"—"}function D(a){return String(a).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}class Ii{constructor(t){this.container=t,this.map=null,this.inspector=null,this.globalPanel=null,this.taxSlider=null,this.gameState=null,this.playerId=null,this.player=null,this.events=[],this.localEvents=[],this.pendingMoveSource=null,this.activeActionSlot=0,this.startPending=!1,this.startError="",this.connectionError="",this.oiTargetSelection=!1,this.oiDraftBallot={},this.oiSessionId=null,this.oiRenderKey="",this.audioContext=null,this.displayedResourceValues=null,this.resourceAnimationFrame=null,this.lastAnimatedResolutionId=0,this.stageOverlayTimer=null,this.init()}init(){this.styleElement=document.createElement("style"),this.styleElement.textContent=Ri,document.head.appendChild(this.styleElement),this.container.innerHTML=`
      <div class="pax-shell">
        <section class="pax-start-menu" id="start-menu" aria-label="Menú inicial">
          <div class="pax-start-card">
            <div class="pax-start-brand">PAX</div>
            <h1>El mundo espera tus órdenes</h1>
            <p>Juega contra los demás países. Los países sin jugador serán controlados por bots. Cada nación comienza con 100 de plata.</p>
            <button class="pax-start-button" id="play-button" type="button" disabled>Jugar</button>
            <p class="pax-start-status" id="start-status" role="status">Conectando con la partida…</p>
          </div>
        </section>
        <section class="pax-menu-overlay" id="game-menu" aria-label="Menú de partida" hidden>
          <div class="pax-menu-card">
            <h2>Menú de partida</h2>
            <div class="pax-menu-actions">
              <button type="button" id="menu-resume">Reanudar</button>
              <button type="button" class="pax-menu-end" id="menu-end-game">Terminar partida y volver al menú principal</button>
            </div>
          </div>
        </section>
        <div class="pax-stage-overlay" id="stage-overlay" hidden aria-live="polite">
          <div class="pax-stage-overlay-card" id="stage-overlay-message"></div>
        </div>
        <header class="pax-topbar">
          <button class="pax-menu-button" id="menu-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="game-menu" title="Menú">☰</button>
          <div class="pax-brand">PAX</div>
          <div class="pax-round">
            <span class="pax-round-icon" aria-hidden="true">◷</span>
            <div><span class="pax-label">Ronda</span><span class="pax-round-value" id="round-value">1/${ht}</span></div>
            <span class="pax-timer" id="timer-value">60s</span>
            <button class="pax-force-button" id="force-phase-button" type="button" disabled title="La fase termina cuando todos los jugadores humanos confirman que están listos">⏩ Forzar</button>
          </div>
          <div class="pax-phase"><span class="pax-label">Estado:</span><strong id="phase-value">Inicio de ronda</strong></div>
          <div class="pax-resources" aria-label="Recursos nacionales">
            <span class="pax-resource" title="Plata"><i class="pax-resource-icon" data-tooltip="Plata" tabindex="0" aria-label="Plata">◉</i><span id="silver-value">—</span></span>
            <span class="pax-resource" title="Materiales"><i class="pax-resource-icon" data-tooltip="Materiales" tabindex="0" aria-label="Materiales">▣</i><span id="materials-value">—</span></span>
            <span class="pax-resource" title="Influencia"><i class="pax-resource-icon" data-tooltip="Influencia" tabindex="0" aria-label="Influencia">♧</i><span id="influence-value">—</span></span>
            <span class="pax-resource" title="Población"><i class="pax-resource-icon" data-tooltip="Población" tabindex="0" aria-label="Población">♟</i><span id="population-value">0</span></span>
          </div>
          <button class="pax-global-panel-button" id="global-panel-open" type="button" title="Ver información de todos los países y tratados"><span aria-hidden="true">◎</span><span>Panel<br>Global</span></button>
        </header>
        <main class="pax-main">
          <aside class="pax-sidebar">
            <section class="pax-nation">
              <span class="pax-nation-dot" id="nation-dot"></span>
              <strong class="pax-nation-name" id="nation-name">Nación Amarilla</strong>
              <span class="pax-human-tag" id="player-kind">Humano</span>
            </section>
            <nav class="pax-tabs" role="tablist" aria-label="Panel de nación">
              <button class="pax-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="economy-tab" data-panel-tab="economy"><span aria-hidden="true">▥</span> Economía</button>
              <button class="pax-tab" type="button" role="tab" aria-selected="false" aria-controls="finance-tab" data-panel-tab="finance"><span aria-hidden="true">▤</span> Banca &amp; Diplomacia</button>
              <button class="pax-tab" type="button" role="tab" aria-selected="false" aria-controls="log-tab" data-panel-tab="log"><span aria-hidden="true">≡</span> Log</button>
            </nav>
            <div class="pax-tab-panel" id="economy-tab" role="tabpanel">
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">％</span>Tasa impositiva (τ)<strong id="tax-value" style="margin-left:auto;color:#f2bb3b">20%</strong><span class="pax-section-help" data-tooltip="La tasa impositiva cambia el crecimiento demográfico y la recaudación." aria-label="Ayuda sobre la tasa impositiva" tabindex="0">?</span></div>
              <div id="tax-container"></div>
              <div class="pax-tax-card">
                <div class="pax-formula-line"><span>Crecimiento</span><strong id="growth-value">+5.00%</strong></div>
                <div class="pax-formula-line"><span>Recaudación esperada</span><strong id="forecast-revenue">—</strong></div>
                <p class="pax-tax-note">A menor impuesto, mayor crecimiento demográfico. A mayor impuesto, más recaudación inmediata.</p>
              </div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">¤</span>Mercado Global<span class="pax-section-help" data-tooltip="Compra o vende materiales al precio fijo del mercado neutral." aria-label="Ayuda sobre el Mercado Global" tabindex="0">?</span></div>
              <div id="finance-panel"></div>
            </section>
            </div>
            <div class="pax-tab-panel" id="finance-tab" role="tabpanel" hidden>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon">¤</span>Banco Mundial<span class="pax-section-help" data-tooltip="Administra bonos, deuda pendiente, pagos y el fondo común del Banco Mundial." aria-label="Ayuda sobre el Banco Mundial" tabindex="0">?</span></div>
              <div id="finance-debt-panel"></div>
            </section>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span class="pax-panel-heading-icon" style="color:#b684e8">♙</span>Organización Internacional (OI)<span class="pax-section-help" data-tooltip="La OI abre sesiones periódicas para proponer y votar resoluciones." aria-label="Ayuda sobre la Organización Internacional" tabindex="0">?</span><span class="pax-oi-tag" id="oi-session-badge">Próxima sesión: Ronda 5</span></div>
              <div class="pax-oi-card">
                <div class="pax-oi-row"><span>Próxima reunión:</span><strong id="next-vote">Después de ronda 5</strong></div>
                <div class="pax-oi-note" id="oi-status"></div>
                <div id="oi-content"></div>
              </div>
            </section>
            </div>
            <div class="pax-tab-panel log-tab-panel" id="log-tab" role="tabpanel" hidden>
            <section class="pax-panel-section">
              <div class="pax-panel-heading pax-info-heading"><span style="color:#8996aa">≡</span>Log<span class="pax-section-help" data-tooltip="Consulta eventos, advertencias y respuestas del sistema." aria-label="Ayuda sobre el Log" tabindex="0">?</span></div>
              <div class="pax-event-log" id="event-log" aria-live="polite"></div>
            </section>
            </div>
          </aside>
          <section class="pax-center">
            <div class="pax-map-legend" aria-hidden="true"></div>
            <div class="pax-map-viewport" id="map-container"><div class="pax-toasts" id="toast-container" aria-live="polite" aria-atomic="true"></div></div>
            <section class="pax-action-slots" id="action-slots" aria-label="Acciones de este turno"></section>
            <footer class="pax-map-footer">
              <span class="pax-map-hint">ⓘ Haz clic en una casilla para inspeccionarla; arrastra para desplazarte.</span>
              <span class="pax-map-size">Matriz ${k.GRID_WIDTH}×${k.GRID_HEIGHT} (${k.TOTAL_TILES} casillas)</span>
            </footer>
          </section>
          <aside class="pax-inspector" id="inspector-container"></aside>
        </main>
        <dialog class="pax-dialog" id="global-panel-dialog">
          <header class="pax-dialog-heading"><span>◎ Panel Global</span><button class="pax-dialog-close" type="button" id="global-panel-close">Cerrar</button></header>
          <div class="pax-scoreboard-wrap" id="global-panel-container"></div>
        </dialog>
        <dialog class="pax-dialog pax-end-dialog" id="game-summary-dialog" aria-labelledby="game-summary-title">
          <header class="pax-dialog-heading"><span>Resumen de la partida</span></header>
          <div class="pax-end-result" id="game-summary-content"></div>
          <div class="pax-scoreboard-wrap">
            <div class="pax-global-table-scroll">
              <table class="pax-global-table">
                <thead>
                  <tr>
                    <th>País</th><th>Control</th><th>Territorio</th><th>Población</th>
                    <th>Tropas</th><th>Ciudades</th><th>Fábricas</th><th>Impuesto</th>
                    <th>Plata</th><th>Materiales</th><th>Influencia</th><th>GDI</th>
                  </tr>
                </thead>
                <tbody id="game-summary-rankings"></tbody>
              </table>
            </div>
            <p class="pax-scoreboard-note">GDI: Plata + Materiales + Influencia + Población.</p>
          </div>
          <div class="pax-end-actions">
            <button id="game-summary-replay" type="button">Volver a jugar</button>
            <button id="game-summary-menu" type="button">Ir al menú principal</button>
          </div>
        </dialog>
      </div>
    `;const t=this.container.querySelector("#tax-container");this.inspector=new Ie(this.container.querySelector("#inspector-container")),this.map=new Ee(this.container.querySelector("#map-container"),e=>this.handleTileSelection(e)),this.toastContainer=document.createElement("div"),this.toastContainer.className="pax-toasts",this.toastContainer.id="toast-container",this.toastContainer.setAttribute("aria-live","polite"),this.toastContainer.setAttribute("aria-atomic","true"),this.container.querySelector("#map-container").appendChild(this.toastContainer),this.tooltipLayer=document.createElement("div"),this.tooltipLayer.className="pax-tooltip-layer",this.tooltipLayer.setAttribute("role","tooltip"),document.body.appendChild(this.tooltipLayer),this.globalPanel=new Ce(this.container.querySelector("#global-panel-container"),{onProposeTreaty:e=>{m.emit(S.PROPOSE_TREATY,{roomId:"room-1",treaty:e}),this.showToast("Propuesta diplomática enviada.","info")},onRespondToTreaty:({offerId:e,accepted:i})=>m.emit(S.RESPOND_TO_TREATY,{roomId:"room-1",offerId:e,accepted:i}),onCancelTreatyOffer:e=>m.emit(S.CANCEL_TREATY_OFFER,{roomId:"room-1",offerId:e})}),this.financePanel=new Le(this.container.querySelector("#finance-panel"),e=>{m.timeout(5e3).emit(S.FINANCIAL_ACTION,{roomId:"room-1",action:e},(i,o)=>{this.financePanel.setStatus(i?"El servidor no respondió; comprueba la conexión e inténtalo otra vez.":(o==null?void 0:o.message)||"No se pudo completar la operación financiera."),this.showToast(i||!(o!=null&&o.ok)?i||(o==null?void 0:o.message)||"No se pudo completar la operación financiera.":o.message,i||!(o!=null&&o.ok)?"error":["BUY_MATERIALS","SELL_MATERIALS","REPAY_BOND"].includes(e.type)?"success":"info")})}),this.container.querySelector("#finance-debt-panel").append(this.container.querySelector("#finance-debt-content")),this.taxSlider=new Oe(t,e=>{this.updateTaxMetrics(e),m.emit(S.SET_TAX_RATE,{roomId:"room-1",taxRate:e})}),this.updateTaxMetrics(this.taxSlider.currentValue),this.bindEvents(),this.addEvent("Esperando actividad de la partida."),this.joinGame()}bindEvents(){this.container.addEventListener("pointerover",o=>{var s,r;const n=(r=(s=o.target).closest)==null?void 0:r.call(s,"[data-tooltip]");n&&this.showTooltip(n)}),this.container.addEventListener("pointerout",o=>{var s,r;const n=(r=(s=o.target).closest)==null?void 0:r.call(s,"[data-tooltip]");n&&!n.contains(o.relatedTarget)&&this.hideTooltip()}),this.container.addEventListener("focusin",o=>{var n,s;(s=(n=o.target).matches)!=null&&s.call(n,"[data-tooltip]")&&this.showTooltip(o.target)}),this.container.addEventListener("focusout",o=>{var n,s;(s=(n=o.target).matches)!=null&&s.call(n,"[data-tooltip]")&&this.hideTooltip()}),this.tooltipPointerMove=o=>{var s;const n=document.elementFromPoint(o.clientX,o.clientY);(s=n==null?void 0:n.matches)!=null&&s.call(n,"[data-tooltip]")?n!==this.tooltipTarget&&this.showTooltip(n):this.tooltipTarget&&!this.tooltipTarget.matches(":focus")&&this.hideTooltip()},document.addEventListener("pointermove",this.tooltipPointerMove),this.tooltipViewportChange=()=>{this.tooltipTarget&&this.showTooltip(this.tooltipTarget)},window.addEventListener("resize",this.tooltipViewportChange),window.addEventListener("scroll",this.tooltipViewportChange,!0),this.container.querySelector(".pax-tabs").addEventListener("click",o=>{var r,c;const n=(c=(r=o.target).closest)==null?void 0:c.call(r,"[data-panel-tab]");if(!n)return;const s=n.dataset.panelTab;for(const p of this.container.querySelectorAll("[data-panel-tab]")){const l=p===n;p.classList.toggle("is-active",l),p.setAttribute("aria-selected",String(l)),p.tabIndex=l?0:-1}for(const p of this.container.querySelectorAll(".pax-tab-panel"))p.hidden=p.id!==`${s}-tab`}),this.container.addEventListener("click",o=>{var s,r;const n=(r=(s=o.target).closest)==null?void 0:r.call(s,"button");n&&!n.disabled&&this.playButtonClick()},!0),this.onConnect=()=>{this.startPending=!1,this.startError="",this.connectionError="",this.joinGame(),this.updateStartMenu()},this.onDisconnect=()=>{this.startPending=!1,this.startError="Se perdió la conexión con el servidor. Reconectando…",this.connectionError="",this.updateStartMenu()},this.onConnectError=()=>{this.connectionError="No se pudo conectar con el servidor. Comprueba que esté iniciado en la Terminal 1.",this.updateStartMenu()},this.onGameState=o=>this.updateGameState(o),m.on("connect",this.onConnect),m.on("disconnect",this.onDisconnect),m.on("connect_error",this.onConnectError),m.on(S.GAME_STATE_UPDATE,this.onGameState),this.onActionError=o=>{this.startPending=!1,this.startError=o,this.player&&this.confirmedPlannedActions&&(this.player.plannedActions=this.confirmedPlannedActions.map(n=>n?{...n}:null)),this.addEvent(`Acción no realizada: ${o}`),this.showToast(o,"error"),this.updateActionHighlights(),this.updateActionSlots(),this.updateStartMenu()},m.on(S.ACTION_ERROR,this.onActionError);const t=this.container.querySelector("#menu-toggle"),e=this.container.querySelector("#game-menu");t.addEventListener("click",()=>this.setGameMenuOpen(e.hidden)),this.container.querySelector("#menu-resume").addEventListener("click",()=>{this.setGameMenuOpen(!1)}),this.container.querySelector("#menu-end-game").addEventListener("click",()=>{var o;!m.connected||!((o=this.gameState)!=null&&o.gameStarted)||m.emit(S.END_GAME,{roomId:"room-1"})}),this.container.querySelector("#force-phase-button").addEventListener("click",()=>{var o,n;!m.connected||((o=this.gameState)==null?void 0:o.currentStage)!==y.PLANNING||m.emit(S.READY_PHASE_END,{roomId:"room-1",ready:!((n=this.player)!=null&&n.phaseReady)})}),this.container.querySelector("#action-slots").addEventListener("click",o=>{var c,p,l,h,u;const n=(p=(c=o.target).closest)==null?void 0:p.call(c,"[data-clear-slot], [data-action-slot]"),s=n!=null&&n.matches("[data-clear-slot]")?n:null;if(s){const d=Number(s.dataset.clearSlot);this.emitPlannedAction(d,null),((l=this.pendingMoveSource)==null?void 0:l.slot)===d&&(this.pendingMoveSource=null,this.updateActionSlots(),this.updateActionHighlights());return}const r=n!=null&&n.matches("[data-action-slot]")?n:null;!r||r.disabled||(this.activeActionSlot=Number(r.dataset.actionSlot),this.pendingMoveSource=null,this.inspector.setContext(this.player,((h=this.gameState)==null?void 0:h.currentPhase)||1,d=>this.handleInspectorAction(d),this.activeActionSlot,(u=this.gameState)==null?void 0:u.grid),this.updateActionSlots(),this.updateActionHighlights())}),this.container.querySelector("#play-button").addEventListener("click",()=>{!m.connected||!this.player||this.startPending||(this.startPending=!0,this.startError="",this.updateStartMenu(),m.timeout(5e3).emit(S.START_GAME,{roomId:"room-1"},(o,n)=>{this.startPending=!1,o?this.startError="El servidor no respondió. Comprueba la conexión e inténtalo otra vez.":n!=null&&n.ok?this.startError="":this.startError=(n==null?void 0:n.message)||"No se pudo iniciar la partida.",this.updateStartMenu(n==null?void 0:n.gameStarted)}))}),this.container.querySelector("#global-panel-open").addEventListener("click",()=>{this.container.querySelector("#global-panel-dialog").showModal()}),this.container.querySelector("#global-panel-close").addEventListener("click",()=>{this.container.querySelector("#global-panel-dialog").close()}),this.container.querySelector("#game-summary-replay").addEventListener("click",()=>{var n;if(!m.connected||!((n=this.gameState)!=null&&n.gameOver))return;const o=this.container.querySelector("#game-summary-replay");o.disabled=!0,m.timeout(5e3).emit(S.RESTART_GAME,{roomId:"room-1"},(s,r)=>{(s||!(r!=null&&r.ok))&&(o.disabled=!1,this.addEvent(`No se pudo iniciar otra partida: ${(r==null?void 0:r.message)||"el servidor no respondió."}`))})}),this.container.querySelector("#game-summary-menu").addEventListener("click",()=>{var o;!m.connected||!((o=this.gameState)!=null&&o.gameOver)||(this.container.querySelector("#game-summary-dialog").close(),m.emit(S.END_GAME,{roomId:"room-1"}))}),this.container.querySelector("#taxInput").addEventListener("input",o=>{this.container.querySelector("#tax-value").textContent=`${Math.round(Number(o.target.value)*100)}%`});const i=this.container.querySelector(".pax-oi-card");i.addEventListener("click",o=>{const n=o.target.closest("button");n&&(n.id==="oi-propose"&&(this.handleOIProposal(),this.showToast("Propuesta enviada a la OI.","info")),n.id==="oi-select-target"&&this.beginOITargetSelection(),n.id==="oi-submit-vote"&&this.submitOIVote())}),i.addEventListener("input",()=>this.captureOIDraft()),i.addEventListener("change",o=>{if(o.target.matches("[data-oi-choice]")){const n=o.target.dataset.oiChoice,s=this.oiDraftBallot[n]||{choice:"ABSTAIN"},r=i.querySelector(`[data-oi-wager="${CSS.escape(n)}"]`);o.target.value==="ABSTAIN"?(r.min="0",r.value="0"):(r.min="1",(s.choice==="ABSTAIN"||Number(r.value)<1)&&(r.value="1"))}this.captureOIDraft(),o.target.matches("#oi-resolution-type")&&(this.container.querySelector("#oi-select-target").hidden=o.target.value!==Y.DEMILITARIZED_ZONE)})}showToast(t,e="info"){if(!t||!this.toastContainer)return;const i=document.createElement("div");i.className="pax-toast",i.dataset.type=e,i.textContent=t,this.toastContainer.appendChild(i),window.setTimeout(()=>{i.classList.add("is-leaving"),window.setTimeout(()=>i.remove(),240)},3e3)}showTooltip(t){const e=t==null?void 0:t.dataset.tooltip;if(!e||!this.tooltipLayer)return;this.tooltipLayer.textContent=e,this.tooltipLayer.classList.remove("is-visible"),this.tooltipLayer.style.left="0px",this.tooltipLayer.style.top="0px",this.tooltipLayer.style.visibility="hidden";const i=t.getBoundingClientRect(),o=this.tooltipLayer.getBoundingClientRect(),n=8,s=12;let r=i.left+(i.width-o.width)/2;r=Math.max(s,Math.min(r,window.innerWidth-o.width-s));const p=i.top>=o.height+n+s?i.top-o.height-n:Math.min(window.innerHeight-o.height-s,i.bottom+n);this.tooltipLayer.style.left=`${r}px`,this.tooltipLayer.style.top=`${Math.max(s,p)}px`,this.tooltipLayer.style.visibility="visible",this.tooltipLayer.classList.add("is-visible"),this.tooltipTarget=t}hideTooltip(){this.tooltipLayer&&(this.tooltipLayer.classList.remove("is-visible"),this.tooltipTarget=null)}playButtonClick(){const t=window.AudioContext||window.webkitAudioContext;if(!t)return;this.audioContext||(this.audioContext=new t);const e=this.audioContext.currentTime,i=this.audioContext.createOscillator(),o=this.audioContext.createGain();i.type="triangle",i.frequency.setValueAtTime(820,e),i.frequency.exponentialRampToValueAtTime(480,e+.035),o.gain.setValueAtTime(.035,e),o.gain.exponentialRampToValueAtTime(.001,e+.04),i.connect(o),o.connect(this.audioContext.destination),i.start(e),i.stop(e+.04)}setGameMenuOpen(t){var r,c;const e=this.container.querySelector("#game-menu"),i=this.container.querySelector("#menu-toggle"),o=!!t;e.hidden=!o,i.setAttribute("aria-expanded",String(o));const n=((r=this.gameState)==null?void 0:r.players)||[],s=n.filter(p=>!p.isBot&&p.socketId).length;(c=this.gameState)!=null&&c.gameStarted&&n.length===4&&s===1&&m.connected&&m.emit(S.SET_GAME_PAUSED,{roomId:"room-1",paused:o})}updateTaxMetrics(t){var n,s,r,c,p,l,h,u;const e=t>0?1/(100*t):0;this.container.querySelector("#tax-value").textContent=`${Math.round(t*100)}%`,this.container.querySelector("#growth-value").textContent=`+${(e*100).toFixed(2)}%`;const i=((n=this.player)==null?void 0:n.plannedActions)||[];let o=0;for(const d of((r=(s=this.gameState)==null?void 0:s.grid)==null?void 0:r.flat())||[])d.ownerId===((c=this.player)==null?void 0:c.id)&&(d.type==="CAP"||d.type==="CIU")&&(o+=Math.floor((d.population||0)*(1+e)));for(const d of i){if((d==null?void 0:d.type)!=="BUILD_CITY")continue;const f=(h=(l=(p=this.gameState)==null?void 0:p.grid)==null?void 0:l[d.y])==null?void 0:h[d.x];f&&f.ownerId===((u=this.player)==null?void 0:u.id)&&f.type==="TR"&&!f.building&&(o+=Math.floor(50*(1+e)))}this.container.querySelector("#forecast-revenue").textContent=`${O(Math.floor(o*t))}¤`}updateDisabledTooltips(t){var o;const e=t===y.PLANNING,i=e?"Requisito de recursos no cumplido":"Acción bloqueada fuera de la planificación";for(const n of this.container.querySelectorAll("button:disabled, input:disabled, select:disabled"))n.id==="play-button"?n.dataset.tooltip="Esperando conexión con la partida":n.matches("[data-issue-bond]")?n.dataset.tooltip=e?"Ya tienes un bono pendiente":"Acción bloqueada fuera de la planificación":n.matches("[data-donate-world-bank]")?n.dataset.tooltip=e?"Requiere 15 Plata":"Acción bloqueada fuera de la planificación":n.matches("[data-market-action], [data-quantity-adjust], [data-quantity-max]")?n.dataset.tooltip=e?i:"Mercado suspendido durante la ronda de OI o la resolución":n.matches("[data-repay-bond], [data-bond-amount]")?n.dataset.tooltip=e?"Requiere saldo de Plata para pagar la deuda":"Pago bloqueado fuera de la planificación":n.matches("#oi-propose")?n.dataset.tooltip=e?"Requiere 2 de Influencia":"Propuesta bloqueada fuera de la reunión de la OI":n.matches("#oi-submit-vote")?n.dataset.tooltip="Solo puedes votar durante una sesión activa de la OI":n.matches("#force-phase-button")?n.dataset.tooltip="La planificación termina cuando todos los jugadores están listos":(o=n.dataset).tooltip||(o.tooltip="Acción no disponible en este momento")}updateGameState(t){var c,p,l,h,u,d;if(!t)return;this.gameState=t;const e=t.currentPhase||1,i=t.currentStage||this.getStageFromLegacyPhase(e);i!==y.PLANNING&&(this.pendingMoveSource=null),this.map.setDemilitarizedZones(t.activeDmzZones||[],!1),this.map.render(t.grid);const o=Array.isArray(t.players)?t.players:[];this.player=o.find(f=>f.boundPlayerId===this.playerId||f.socketId===m.id)||null,this.player&&(this.player.plannedActions=Array.from({length:H},(f,x)=>{var T;return((T=this.player.plannedActions)==null?void 0:T[x])??null})),this.confirmedPlannedActions=(((c=this.player)==null?void 0:c.plannedActions)||Array(H).fill(null)).map(f=>f?{...f}:null),t.gameStarted&&(this.startPending=!1),this.updateStartMenu(t.gameStarted),t.gameStarted||(this.container.querySelector("#game-menu").hidden=!0,this.container.querySelector("#menu-toggle").setAttribute("aria-expanded","false")),this.inspector.setContext(this.player,e,f=>this.handleInspectorAction(f),this.activeActionSlot,t.grid),this.updateActionSlots(),this.updateActionHighlights(),this.updateForcePhaseButton(o,e,t.gameStarted),this.globalPanel.update(t,(p=this.player)==null?void 0:p.id),this.financePanel.update({...t,currentStage:i},(l=this.player)==null?void 0:l.id),this.updateDisabledTooltips(i);const n=((h=t.oiSession)==null?void 0:h.phase)==="voting"?t.oiSession.meetingAfterRound:t.currentRound||1,s=this.container.querySelector("#round-value");s.textContent=`${n}/${ht}`,this.container.querySelector("#timer-value").textContent=`${t.timeRemaining??60}s${t.isPaused?" · Pausado":""}`,this.container.querySelector("#phase-value").textContent=Gt[i]||"En curso",this.updateStageOverlay(i);const r=Math.max(5,Math.ceil(n/5)*5);this.container.querySelector("#next-vote").textContent=((u=t.oiSession)==null?void 0:u.phase)==="voting"?`En curso · ronda ${n}`:`Ronda ${r}`,this.container.querySelector("#oi-session-badge").textContent=((d=t.oiSession)==null?void 0:d.phase)==="voting"?`Sesión activa · Ronda ${n}`:`Próxima sesión: Ronda ${r}`,this.updateOIPanel(t,n),this.updateNationPanel(),this.updateResources(i===y.ROUND_START||i===y.CLOSING),this.taxSlider.setEnabled(!!(this.player&&i===y.PLANNING&&!t.gameOver)),this.syncGameEventHistory(t.eventHistory),this.updateGameSummary(t),this.player&&Number.isFinite(this.player.taxRate)?(this.taxSlider.setValue(this.player.taxRate),this.updateTaxMetrics(this.player.taxRate)):this.updateTaxMetrics(this.taxSlider.currentValue),i===y.CLOSING&&t.actionResolutionId!==this.lastAnimatedResolutionId&&(this.lastAnimatedResolutionId=t.actionResolutionId,this.map.animateTroopMovements(t.lastActionResolutions||[]))}getStageFromLegacyPhase(t){return t===1?y.ROUND_START:t===2?y.PLANNING:t===3?y.RESOLVING:t===4||t===5?y.CLOSING:y.INTERNATIONAL_MEETING}updateStageOverlay(t){const e=this.container.querySelector("#stage-overlay"),i=this.container.querySelector("#stage-overlay-message");!e||!i||(this.stageOverlayTimer&&(clearTimeout(this.stageOverlayTimer),this.stageOverlayTimer=null),e.hidden=!0,t===y.RESOLVING&&(i.textContent=Gt[t],this.stageOverlayTimer=setTimeout(()=>{var o;((o=this.gameState)==null?void 0:o.currentStage)===y.RESOLVING&&(e.hidden=!1),this.stageOverlayTimer=null},pe.RESOLUTION_LOADING_THRESHOLD_MS)))}updateOIPanel(t,e){var d,f,x,T,I,j,z,g,N,R,U;const i=this.container.querySelector(".pax-oi-card"),o=i.querySelector("#oi-status"),n=i.querySelector("#oi-content"),s=t.oiSession,r=(s==null?void 0:s.id)||null;r!==this.oiSessionId&&(this.oiSessionId=r,this.oiDraftBallot={});const c=!!(this.player&&((d=s==null?void 0:s.votesSubmitted)!=null&&d.includes(this.player.id))),p=JSON.stringify({round:e,phase:t.currentPhase,playerId:(f=this.player)==null?void 0:f.id,influence:(T=(x=this.player)==null?void 0:x.resources)==null?void 0:T.INFLUENCE,proposals:t.oiProposals,session:s&&{id:s.id,phase:s.phase,proposals:s.proposals,votes:s.votes,results:s.results},votesSubmitted:s==null?void 0:s.votesSubmitted,policies:t.oiPolicies,zones:t.activeDmzZones,pacts:t.nonAggressionPacts});if(p===this.oiRenderKey){(s==null?void 0:s.phase)==="voting"&&(o.textContent=`Votación abierta · ${s.timeRemaining}s restantes · ${((j=(I=this.player)==null?void 0:I.resources)==null?void 0:j.INFLUENCE)||0} de Influencia disponible.`);return}if(this.oiRenderKey=p,(s==null?void 0:s.phase)==="voting"){o.textContent=`Votación abierta · ${s.timeRemaining}s restantes · ${((g=(z=this.player)==null?void 0:z.resources)==null?void 0:g.INFLUENCE)||0} de Influencia disponible.`,n.innerHTML=`
        <div class="pax-oi-controls">
          <p class="pax-oi-note">Reunión después de la ronda ${s.meetingAfterRound}. Votos registrados: ${((N=s.votesSubmitted)==null?void 0:N.length)||0}/${t.players.length}. La sesión dura 60 segundos; las papeletas se revelan al cerrar.</p>
          ${c?'<p class="pax-oi-note">Tu papeleta quedó registrada. Espera a que voten los demás o termine el plazo.</p>':`${s.proposals.map(w=>{const V=this.oiDraftBallot[w.id]||{choice:"ABSTAIN",wager:0};return`
                <div class="pax-oi-vote">
                  <strong>${D(w.name)}${w.target?` · casilla (${w.target.x}, ${w.target.y})`:""}</strong>
                  <div class="pax-oi-vote-fields">
                    <label>Voto
                      <select data-oi-choice="${D(w.id)}">
                        <option value="FOR" ${V.choice==="FOR"?"selected":""}>A favor</option>
                        <option value="AGAINST" ${V.choice==="AGAINST"?"selected":""}>En contra</option>
                        <option value="ABSTAIN" ${V.choice==="ABSTAIN"?"selected":""}>Abstención</option>
                      </select>
                    </label>
                    <label>Influencia
                      <input data-oi-wager="${D(w.id)}" type="number" min="${V.choice==="ABSTAIN"?0:1}" step="1" value="${V.wager}" />
                    </label>
                  </div>
                </div>
              `}).join("")}
            <button id="oi-submit-vote" type="button" ${this.player?"":"disabled"}>Registrar todos los votos</button>`}
        </div>
      `;return}const l=t.gameStarted&&!t.gameOver&&t.currentStage===y.PLANNING,h=(s==null?void 0:s.phase)==="complete"&&s.results?`
        <div class="pax-oi-controls">
          <p class="pax-oi-note">Resultados de la sesión anterior:</p>
          ${s.results.length?s.results.map(w=>`
              <div class="pax-oi-vote">
                <strong>${D(w.name)}</strong>
                <span class="pax-oi-note">${w.message}: a favor ${w.forInfluence} · en contra ${w.againstInfluence}.</span>
              </div>
            `).join(""):'<p class="pax-oi-note">No se presentaron resoluciones en la última sesión.</p>'}
        </div>
      `:"";o.textContent=l?"Puedes proponer resoluciones durante la planificación. Cada propuesta cuesta 2 de Influencia.":`Próxima sesión después de ronda ${Math.ceil(e/5)*5}.`,n.innerHTML=`
      <div class="pax-oi-controls">
        ${h}
        ${l?`
          <label>Resolución
            <select id="oi-resolution-type">
              <option value="${Y.ARMAMENT_LIMIT}">Límite de armamento · 10 tropas</option>
              <option value="${Y.INDUSTRY_LIMIT}">Límite de industria · 10 fábricas</option>
              <option value="${Y.DEMILITARIZED_ZONE}">Zona Desmilitarizada · elegir casilla</option>
              <option value="${Y.CONDITIONAL_SUBSIDY}">Subsidio condicionado · 25 de plata</option>
            </select>
          </label>
          <button id="oi-select-target" type="button" hidden>Elegir casilla para la ZDM</button>
          <button id="oi-propose" type="button" ${((U=(R=this.player)==null?void 0:R.resources)==null?void 0:U.INFLUENCE)>=2?"":"disabled"}>Proponer (cuesta 2 Influencia)</button>
          ${this.oiTargetSelection?'<p class="pax-oi-note">Haz clic en la casilla objetivo del mapa (el centro de una zona de 5×5).</p>':""}
        `:""}
        ${t.oiProposals.length?`<div class="pax-oi-note">Propuestas acumuladas: ${t.oiProposals.map(w=>`
            <div class="pax-oi-proposal">${D(w.name)} · ${D(w.proposerName)}${w.target?` · (${w.target.x}, ${w.target.y})`:""}</div>
          `).join("")}</div>`:'<p class="pax-oi-note">Aún no hay propuestas para la próxima sesión.</p>'}
        <p class="pax-oi-note">Los límites aprobados se mantienen activos. Las ZDM y los pactos duran hasta la siguiente sesión.</p>
      </div>
    `;const u=n.querySelector("#oi-select-target");u&&(u.hidden=n.querySelector("#oi-resolution-type").value!==Y.DEMILITARIZED_ZONE)}captureOIDraft(){var e,i;const t=this.container.querySelector(".pax-oi-card");for(const o of t.querySelectorAll("[data-oi-choice]")){const n=o.dataset.oiChoice;(e=this.oiDraftBallot)[n]||(e[n]={}),this.oiDraftBallot[n].choice=o.value}for(const o of t.querySelectorAll("[data-oi-wager]")){const n=o.dataset.oiWager;(i=this.oiDraftBallot)[n]||(i[n]={}),this.oiDraftBallot[n].wager=Number(o.value)}}handleOIProposal(){var e;const t=(e=this.container.querySelector("#oi-resolution-type"))==null?void 0:e.value;!t||t===Y.DEMILITARIZED_ZONE||!m.connected||m.emit(S.PROPOSE_OI_RESOLUTION,{roomId:"room-1",proposal:{type:t}})}beginOITargetSelection(){!m.connected||!this.container.querySelector("#oi-resolution-type")||(this.oiTargetSelection=!0,this.map.setTargetSelectionMode(!0),this.updateOIPanel(this.gameState,this.gameState.currentRound),this.container.querySelector("#oi-status").textContent="Selecciona la casilla central de la ZDM en el mapa.")}submitOIVote(){var i;const t=(i=this.gameState)==null?void 0:i.oiSession;if(!m.connected||(t==null?void 0:t.phase)!=="voting")return;this.captureOIDraft();const e=t.proposals.map(o=>{const n=this.oiDraftBallot[o.id]||{choice:"ABSTAIN",wager:0},s=n.choice==="ABSTAIN"?0:Math.max(1,Number.isInteger(n.wager)?n.wager:1);this.oiDraftBallot[o.id]={choice:n.choice,wager:s};const r=this.container.querySelector(`[data-oi-wager="${CSS.escape(o.id)}"]`);return r&&(r.value=String(s)),{proposalId:o.id,choice:n.choice,wager:s}});m.emit(S.SUBMIT_OI_VOTE,{roomId:"room-1",ballot:e})}updateForcePhaseButton(t,e,i){var l,h,u;const o=this.container.querySelector("#force-phase-button");if(!o)return;const n=t,s=n.filter(d=>d.phaseReady).length,r=n.length,c=!!(i&&!((l=this.gameState)!=null&&l.gameOver)&&this.player&&(((h=this.gameState)==null?void 0:h.currentStage)||this.getStageFromLegacyPhase(e))===y.PLANNING),p=!!((u=this.player)!=null&&u.phaseReady);o.disabled=!c,o.textContent=p?`↩ Quitar listo (${s}/${r})`:r>0?`⏩ Forzar (${s}/${r})`:"⏩ Forzar",o.title=p?"Retirar tu confirmación para que continúe la planificación":"Los bots ya están listos; la fase termina cuando todos los jugadores humanos confirman que están listos."}updateActionSlots(){var n,s,r,c,p,l;const t=this.container.querySelector("#action-slots");if(!t)return;const e=((n=this.player)==null?void 0:n.plannedActions)||Array(H).fill(null),i=!!(this.player&&!((s=this.gameState)!=null&&s.gameOver)&&(((r=this.gameState)==null?void 0:r.currentStage)||this.getStageFromLegacyPhase(((c=this.gameState)==null?void 0:c.currentPhase)||1))===y.PLANNING),o={BUILD_CITY:"Construir ciudad",BUILD_FACTORY:"Construir fábrica",RECRUIT_TROOP:"Reclutar tropa",MOVE_CAPITAL:"Trasladar capital",MOVE_TROOPS:"Mover tropas"};t.innerHTML=`
      <div class="pax-action-slots-heading">
        <span>Acciones del turno</span>
        <small>Se ejecutan cuando termina el tiempo</small>
      </div>
      ${Array.from({length:H},(h,u)=>{var T,I;const d=e[u];let f=d?`Casilla (${d.x}, ${d.y})`:"Vacío · selecciona para editar";(d==null?void 0:d.type)==="MOVE_TROOPS"?f=`(${d.x}, ${d.y}) → (${d.targetX}, ${d.targetY}) · ${d.troops} tropas`:(d==null?void 0:d.type)==="RECRUIT_TROOP"&&(f=`Casilla (${d.x}, ${d.y}) · ${d.count||1} tropas`),((T=this.pendingMoveSource)==null?void 0:T.slot)===u&&(f=`Origen marcado · ${this.pendingMoveSource.troops} tropas · selecciona destino`);const x=this.activeActionSlot===u;return`
        <div class="pax-action-slot-wrap">
          <button class="pax-action-slot ${x?"is-active":""}" type="button"
            data-action-slot="${u}" ${i?"":"disabled"}
            aria-pressed="${x}">
            <span class="pax-action-slot-number">${u+1}</span>
            <span class="pax-action-slot-copy">
              <strong>${d?o[d.type]||"Acción planificada":`Espacio ${u+1} · vacío`}</strong>
              <small>${f}</small>
            </span>
          </button>
          <button class="pax-action-slot-clear" type="button" data-clear-slot="${u}"
            title="Vaciar espacio ${u+1}" aria-label="Vaciar espacio ${u+1}"
            ${i&&(d||((I=this.pendingMoveSource)==null?void 0:I.slot)===u)?"":"disabled"}>×</button>
        </div>
      `}).join("")}
    `,this.updateTaxMetrics(((p=this.player)==null?void 0:p.taxRate)??((l=this.taxSlider)==null?void 0:l.currentValue)??0)}updateActionHighlights(t=null){var o;const e=[],i=((o=this.player)==null?void 0:o.plannedActions)||[];for(const n of i)(n==null?void 0:n.type)==="MOVE_TROOPS"&&(e.push({x:n.x,y:n.y,role:"source"}),e.push({x:n.targetX,y:n.targetY,role:"target"}));this.pendingMoveSource&&e.push({x:this.pendingMoveSource.x,y:this.pendingMoveSource.y,role:"source"}),t&&e.push({...t,role:"target"}),this.map.setActionHighlights(e)}emitPlannedAction(t,e){var i,o,n;if(this.player){if((i=this.player).plannedActions||(i.plannedActions=Array(H).fill(null)),this.player.plannedActions[t]=e?{...e}:null,e){const s=Array.from({length:H},(r,c)=>(t+c+1)%H).find(r=>!this.player.plannedActions[r]);s!=null&&(this.activeActionSlot=s)}this.inspector.setContext(this.player,((o=this.gameState)==null?void 0:o.currentPhase)||1,s=>this.handleInspectorAction(s),this.activeActionSlot,(n=this.gameState)==null?void 0:n.grid),this.updateActionSlots(),this.updateActionHighlights(),m.emit(S.PLAYER_ACTION,{roomId:"room-1",action:{type:"PLAN_ACTION",slot:t,plannedAction:e}})}}updateStartMenu(t=(e=>(e=this.gameState)==null?void 0:e.gameStarted)()){const i=this.container.querySelector("#start-menu");if(!i)return;i.hidden=!!(t&&m.connected);const o=this.container.querySelector("#play-button"),n=this.container.querySelector("#start-status");if(!(!o||!n)){if(t){this.startPending=!1,o.disabled=!0,n.textContent="Partida iniciada.";return}o.disabled=!m.connected||!this.player||this.startPending,n.textContent=m.connected?this.startError?this.startError:this.startPending?"Iniciando la partida…":this.player?`Listo: ${this.player.name}. Los otros países serán bots.`:"Asignando tu país…":this.connectionError||"No hay conexión con el servidor. Reconectando…"}}updateGameSummary(t){var s;const e=this.container.querySelector("#game-summary-dialog"),i=this.container.querySelector("#game-summary-replay");if(!e||!i)return;if(!t.gameOver){e.open&&e.close(),i.disabled=!1;return}const o=Yt(t),n=(s=o[0])==null?void 0:s.player;this.container.querySelector("#game-summary-content").innerHTML=`
      <h2 id="game-summary-title">Partida finalizada</h2>
      <p>Ronda ${t.currentRound} de ${ht}${n?` · País ganador: <strong>${D(n.name)}</strong>`:""}</p>
    `,this.container.querySelector("#game-summary-rankings").innerHTML=o.map((r,c)=>{var h;const{player:p}=r;return`
        <tr style="--score-nation-color:${/^#[0-9a-f]{6}$/i.test(p.color||"")?p.color:"#2563eb"}" class="${p.id===((h=this.player)==null?void 0:h.id)?"is-local-player":""}">
          <th><span class="pax-score-rank">${c+1}</span>${D(p.name||"País")}</th>
          <td>${p.isBot?"Bot":"Humano"}</td>
          <td>${O(r.ownedTiles.length)}</td>
          <td>${O(r.population)}</td>
          <td>${O(r.troops)}</td>
          <td>${O(r.cities)}</td>
          <td>${O(r.factories)}</td>
          <td>${O((p.taxRate||0)*100)}%</td>
          <td>${O(r.silver)}</td>
          <td>${O(r.materials)}</td>
          <td>${O(r.influence)}</td>
          <td class="pax-score-total">${O(r.total)}</td>
        </tr>
      `}).join(""),e.open||e.showModal()}updateNationPanel(){var o,n,s;const t=this.player?Z[this.player.nationId]:null,e=((o=this.player)==null?void 0:o.name)||(t==null?void 0:t.name)||"Esperando nación",i=((n=this.player)==null?void 0:n.color)||(t==null?void 0:t.color)||"#64748b";this.container.querySelector("#nation-name").textContent=e,this.container.querySelector("#nation-dot").style.setProperty("--nation-color",i),this.container.querySelector("#player-kind").textContent=(s=this.player)!=null&&s.boundPlayerId?"Humano":"IA"}handleInspectorAction(t){var e;if(!(((e=this.gameState)==null?void 0:e.currentStage)!==y.PLANNING||!this.player)){if(t.type==="MOVE_TROOPS"){this.pendingMoveSource={...t,slot:this.activeActionSlot},this.updateActionSlots(),this.updateActionHighlights();return}this.emitPlannedAction(this.activeActionSlot,t)}}handleTileSelection(t){var o,n,s,r;if(this.oiTargetSelection&&this.map.selectionFromUser&&t){const c=(o=this.container.querySelector("#oi-resolution-type"))==null?void 0:o.value;this.oiTargetSelection=!1,this.map.setTargetSelectionMode(!1),m.emit(S.PROPOSE_OI_RESOLUTION,{roomId:"room-1",proposal:{type:c,x:t.x,y:t.y}}),this.updateOIPanel(this.gameState,this.gameState.currentRound);return}if(this.inspector.render(t),!this.pendingMoveSource||!t)return;const e=this.pendingMoveSource;if(t.x===e.x&&t.y===e.y)return;this.updateActionHighlights({x:t.x,y:t.y});const i=(r=(s=(n=this.gameState)==null?void 0:n.grid)==null?void 0:s[e.y])==null?void 0:r[e.x];this.pendingMoveSource=null,this.updateActionSlots(),this.emitPlannedAction(e.slot,{type:"MOVE_TROOPS",x:e.x,y:e.y,targetX:t.x,targetY:t.y,troops:e.troops??(i==null?void 0:i.troops)})}updateResources(t=!1){var l,h,u,d;const e=(l=this.player)==null?void 0:l.resources,i=typeof e=="number"?e:(e==null?void 0:e.SILVER)??(e==null?void 0:e.BASIC),o=((h=this.player)==null?void 0:h.materials)??(e==null?void 0:e.MATERIALS),n=((u=this.player)==null?void 0:u.influence)??(e==null?void 0:e.INFLUENCE),r=(((d=this.gameState)==null?void 0:d.grid)||[]).flat().filter(f=>{var x;return f.ownerId===((x=this.player)==null?void 0:x.id)}).reduce((f,x)=>f+(x.population||0),0),c={silver:i,materials:o,influence:n,population:r};if(!t||!this.displayedResourceValues){this.displayedResourceValues=c,this.renderResourceValues(c);return}const p=this.displayedResourceValues;this.animateResourceValues(p,c)}renderResourceValues(t){this.container.querySelector("#silver-value").textContent=O(t.silver),this.container.querySelector("#materials-value").textContent=O(t.materials),this.container.querySelector("#influence-value").textContent=O(t.influence),this.container.querySelector("#population-value").textContent=O(t.population)}animateResourceValues(t,e){this.resourceAnimationFrame&&cancelAnimationFrame(this.resourceAnimationFrame);const i=performance.now(),o=1100,n=s=>{const r=Math.min(1,(s-i)/o),c=1-(1-r)**3,p=Object.fromEntries(Object.keys(e).map(l=>[l,t[l]+(e[l]-t[l])*c]));this.displayedResourceValues=p,this.renderResourceValues(p),r<1?this.resourceAnimationFrame=requestAnimationFrame(n):(this.resourceAnimationFrame=null,this.displayedResourceValues=e)};this.resourceAnimationFrame=requestAnimationFrame(n)}syncGameEventHistory(t=[]){var i;const e=((i=this.container.querySelector("#event-log"))==null?void 0:i.scrollTop)||0;this.events=[...this.localEvents,...t.slice().reverse().map(o=>o.message)],this.renderEventHistory(e)}addEvent(t){this.localEvents.unshift(t),this.events.unshift(t),this.renderEventHistory(0)}renderEventHistory(t){const e=this.container.querySelector("#event-log");e&&(e.innerHTML=this.events.map(i=>`<div class="pax-event-entry">› ${D(i)}</div>`).join(""),e.scrollTop=t)}joinGame(){m.connected&&(this.playerId=localStorage.getItem("pax_player_id"),this.playerId||(this.playerId=`player_${Math.random().toString(36).substring(2,9)}`,localStorage.setItem("pax_player_id",this.playerId)),m.emit(S.JOIN_GAME,{playerId:this.playerId,playerName:"Nación Alpha",roomId:"room-1"}))}destroy(){var t;m.off(S.GAME_STATE_UPDATE,this.onGameState),m.off("connect",this.onConnect),m.off("disconnect",this.onDisconnect),m.off("connect_error",this.onConnectError),m.off(S.ACTION_ERROR,this.onActionError),document.removeEventListener("pointermove",this.tooltipPointerMove),window.removeEventListener("resize",this.tooltipViewportChange),window.removeEventListener("scroll",this.tooltipViewportChange,!0),(t=this.tooltipLayer)==null||t.remove(),this.styleElement.remove(),this.container.innerHTML=""}}document.addEventListener("DOMContentLoaded",()=>{const a=document.getElementById("app");a&&new Ii(a)});
