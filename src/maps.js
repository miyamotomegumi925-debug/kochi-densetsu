const bounds = { west:132.35, east:134.45, south:32.65, north:34.05 };
const categorySymbols = { 食:'箸',酒:'酉',職人:'手',神社:'社',祭り:'火',絶景:'山',自然:'樹',人:'人' };
const areaFocus = {
  東部:{ x:82, y:45, zoom:2.2 },
  中央部:{ x:53, y:48, zoom:2 },
  西部:{ x:30, y:55, zoom:2 },
  四万十:{ x:16, y:68, zoom:2.3 }
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = value => Math.max(4, Math.min(96, value));

function positionFor(item) {
  const longitude = Number(item.longitude);
  const latitude = Number(item.latitude);
  return {
    x:clamp(((longitude - bounds.west) / (bounds.east - bounds.west)) * 100),
    y:clamp(((bounds.north - latitude) / (bounds.north - bounds.south)) * 100)
  };
}

export function initKochiMap(items) {
  const pins = document.querySelector('#custom-map-pins');
  const popup = document.querySelector('#map-popup');
  const empty = document.querySelector('#map-empty');
  const viewport = document.querySelector('#map-viewport');
  if (!pins || !popup) return;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  const applyZoom = () => {
    viewport.style.transform = `translate3d(${panX}px,${panY}px,0) scale(${zoom})`;
    document.querySelector('#map-zoom-out').disabled = zoom <= 1;
    document.querySelector('#map-zoom-in').disabled = zoom >= 3;
    document.querySelector('#map-zoom-reset').textContent = `${zoom.toFixed(1).replace('.0','')}×`;
  };
  const setZoom = value => {
    zoom = Math.max(1, Math.min(3, Math.round(value * 2) / 2));
    if (zoom === 1) { panX = 0; panY = 0; }
    applyZoom();
  };
  document.querySelector('#map-zoom-in').onclick = () => setZoom(zoom + .5);
  document.querySelector('#map-zoom-out').onclick = () => setZoom(zoom - .5);
  document.querySelector('#map-zoom-reset').onclick = () => {
    viewport.style.transformOrigin = '50% 50%';
    panX = 0; panY = 0;
    setZoom(1);
  };
  viewport.parentElement.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? .5 : -.5));
  }, { passive:false });
  let dragging = false;
  let dragged = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startPanX = 0;
  let startPanY = 0;
  const shell = viewport.parentElement;
  shell.addEventListener('pointerdown', event => {
    if (zoom <= 1 || event.target.closest('.map-zoom-controls,.map-popup')) return;
    dragging = true; dragged = false;
    dragStartX = event.clientX; dragStartY = event.clientY;
    startPanX = panX; startPanY = panY;
    shell.setPointerCapture(event.pointerId);
    shell.classList.add('is-dragging');
  });
  shell.addEventListener('pointermove', event => {
    if (!dragging) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
    const limitX = shell.clientWidth * (zoom - 1) * .55;
    const limitY = shell.clientHeight * (zoom - 1) * .55;
    panX = Math.max(-limitX, Math.min(limitX, startPanX + dx));
    panY = Math.max(-limitY, Math.min(limitY, startPanY + dy));
    applyZoom();
  });
  const finishDrag = event => {
    if (!dragging) return;
    dragging = false;
    shell.classList.remove('is-dragging');
    if (shell.hasPointerCapture(event.pointerId)) shell.releasePointerCapture(event.pointerId);
  };
  shell.addEventListener('pointerup', finishDrag);
  shell.addEventListener('pointercancel', finishDrag);
  shell.addEventListener('click', event => {
    if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; }
  }, true);
  let pinchDistance = 0;
  viewport.parentElement.addEventListener('touchstart', event => {
    if (event.touches.length === 2) pinchDistance = Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);
  }, { passive:true });
  viewport.parentElement.addEventListener('touchmove', event => {
    if (event.touches.length !== 2 || !pinchDistance) return;
    event.preventDefault();
    const distance = Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);
    if (Math.abs(distance-pinchDistance) > 24) {
      setZoom(zoom + (distance > pinchDistance ? .5 : -.5));
      pinchDistance = distance;
    }
  }, { passive:false });
  applyZoom();
  const mapped = items.filter(item =>
    item.map_verified === true &&
    Number.isFinite(Number(item.latitude)) &&
    Number.isFinite(Number(item.longitude))
  );

  const render = (area, focusArea = false) => {
    const visible = area ? mapped.filter(item => item.area === area || (!item.area && area === '中央部')) : mapped;
    if (focusArea && areaFocus[area]) {
      const focus = areaFocus[area];
      panX = 0; panY = 0;
      viewport.style.transformOrigin = `${focus.x}% ${focus.y}%`;
      setZoom(focus.zoom);
    }
    empty.hidden = visible.length > 0;
    popup.hidden = true;
    pins.innerHTML = visible.map((item,index) => {
      const point = positionFor(item);
      const title = item.title || item.legend;
      return `<button class="pixel-map-pin category-${escapeHtml(item.category || 'other')}" type="button" style="left:${point.x}%;top:${point.y}%" data-map-index="${index}" aria-label="${escapeHtml(title)}"><span>${escapeHtml(categorySymbols[item.category] || '伝')}</span></button>`;
    }).join('');
    pins.onclick = event => {
      const button = event.target.closest('[data-map-index]');
      if (!button) return;
      const item = visible[Number(button.dataset.mapIndex)];
      const title = item.title || item.legend;
      const summary = item.summary || item.why;
      const href = item.detail_url || '#zukan';
      popup.innerHTML = `<button class="map-popup-close" type="button" aria-label="閉じる">×</button>${item.image_url ? `<img class="map-popup-image" src="${escapeHtml(item.image_url)}" alt="">` : ''}<small>LEGEND No.${escapeHtml(item.legend_no || 'NEW')}</small><h3>${escapeHtml(title)}</h3><p>📍 ${escapeHtml(item.place)}</p><p>${escapeHtml(summary)}</p><a href="${escapeHtml(href)}">詳細を見る →</a>`;
      popup.hidden = false;
      popup.querySelector('.map-popup-close').onclick = () => { popup.hidden = true; };
    };
  };

  render('中央部');
  document.addEventListener('kochi-area-change', event => render(event.detail.area, true));
}
