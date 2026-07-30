const bounds = { west:132.35, east:134.45, south:32.65, north:34.05 };
const categorySymbols = { 食:'箸',酒:'酉',職人:'手',神社:'社',祭り:'火',絶景:'山',自然:'樹',人:'人' };
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
  const applyZoom = () => {
    viewport.style.transform = `scale(${zoom})`;
    document.querySelector('#map-zoom-out').disabled = zoom <= 1;
    document.querySelector('#map-zoom-in').disabled = zoom >= 3;
    document.querySelector('#map-zoom-reset').textContent = `${zoom.toFixed(1).replace('.0','')}×`;
  };
  const setZoom = value => { zoom = Math.max(1, Math.min(3, Math.round(value * 2) / 2)); applyZoom(); };
  document.querySelector('#map-zoom-in').onclick = () => setZoom(zoom + .5);
  document.querySelector('#map-zoom-out').onclick = () => setZoom(zoom - .5);
  document.querySelector('#map-zoom-reset').onclick = () => setZoom(1);
  viewport.parentElement.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? .5 : -.5));
  }, { passive:false });
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

  const render = area => {
    const visible = area ? mapped.filter(item => item.area === area || (!item.area && area === '中央部')) : mapped;
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
      popup.innerHTML = `<button class="map-popup-close" type="button" aria-label="閉じる">×</button><small>LEGEND No.${escapeHtml(item.legend_no || 'NEW')}</small><h3>${escapeHtml(title)}</h3><p>📍 ${escapeHtml(item.place)}</p><p>${escapeHtml(summary)}</p><a href="${escapeHtml(href)}">詳細を見る →</a>`;
      popup.hidden = false;
      popup.querySelector('.map-popup-close').onclick = () => { popup.hidden = true; };
    };
  };

  render('中央部');
  document.addEventListener('kochi-area-change', event => render(event.detail.area));
}
