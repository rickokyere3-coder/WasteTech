/* Phone helpers: drag-to-move zoomed map, bigger-map and whole-map buttons, follow the route,
   and hide the bottom tab bar while the keyboard is open. Desktop is unchanged. */
(function(){
  const svg=document.getElementById('map'); if(!svg) return;
  const wrap=svg.parentElement, main=wrap.parentElement;
  const sc=document.createElement('div'); sc.className='mapscroll'; wrap.insertBefore(sc,svg); sc.appendChild(svg);
  const icoBig='<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const icoSmall='<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  const icoFit='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg>';
  const icoZoom='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg>';
  const btns=document.createElement('div'); btns.className='mapbtns';
  btns.innerHTML='<button type="button" data-m="size" aria-label="Bigger map">'+icoBig+'</button>'+
    '<button type="button" data-m="fit" aria-label="Show the whole map">'+icoFit+'</button>';
  wrap.appendChild(btns);
  const phone=matchMedia('(max-width: 820px)');

  function centerOn(cx,cy,smooth){
    const vb=svg.viewBox&&svg.viewBox.baseVal; if(!vb||!vb.width||wrap.classList.contains('mapfit')) return;
    const k=svg.clientWidth/vb.width;
    sc.scrollTo({left:(cx-vb.x)*k-sc.clientWidth/2, top:(cy-vb.y)*k-sc.clientHeight/2, behavior:smooth?'smooth':'auto'});
  }
  function home(smooth){
    const r=svg.querySelector('polyline.route');
    if(r){ try{ const b=r.getBBox(); return centerOn(b.x+b.width/2,b.y+b.height/2,smooth); }catch(e){} }
    const n=[...svg.querySelectorAll('.node')].find(g=>/central|market/i.test(g.getAttribute('aria-label')||''));
    const c=n&&n.querySelector('circle');
    if(c) return centerOn(+c.getAttribute('cx'),+c.getAttribute('cy'),smooth);
    const vb=svg.viewBox.baseVal; centerOn(vb.x+vb.width/2,vb.y+vb.height/2,smooth);
  }

  // When a route appears or changes, bring it into view.
  let lastRoute='';
  new MutationObserver(()=>{
    if(!phone.matches) return;
    const r=svg.querySelector('polyline.route'), key=r?r.getAttribute('points'):'';
    if(key&&key!==lastRoute){ lastRoute=key; setTimeout(()=>home(true),30); }
    if(!key) lastRoute='';
  }).observe(svg,{childList:true,subtree:true});

  btns.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.m==='size'){
      const big=main.classList.toggle('mapbig');
      b.innerHTML=big?icoSmall:icoBig; b.setAttribute('aria-label',big?'Smaller map':'Bigger map');
    } else {
      const fit=wrap.classList.toggle('mapfit');
      b.innerHTML=fit?icoZoom:icoFit; b.setAttribute('aria-label',fit?'Zoom in':'Show the whole map');
    }
    setTimeout(()=>home(false),60);
  });

  requestAnimationFrame(()=>home(false));
  let rt; window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{ if(phone.matches) home(false); },150); });

  // Hide the bottom tab bar while typing so the keyboard leaves room for the chat.
  // Removal waits a moment so a tap on Send still lands before the layout moves.
  let tt;
  document.addEventListener('focusin',e=>{ if(phone.matches&&e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea')){ clearTimeout(tt); document.body.classList.add('typing'); } });
  document.addEventListener('focusout',()=>{ clearTimeout(tt); tt=setTimeout(()=>{ const a=document.activeElement; if(!a||!a.matches||!a.matches('input,textarea')) document.body.classList.remove('typing'); },350); });
})();
