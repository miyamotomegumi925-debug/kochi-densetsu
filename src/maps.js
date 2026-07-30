const KOCHI_CENTER = { lat: 33.5597, lng: 133.5311 };
const categoryColors = { 食:'#d99949',酒:'#9a6f76',職人:'#728b74',神社:'#a45d55',祭り:'#bd7049',絶景:'#678594',自然:'#668063',人:'#9a8067' };
const mapStyles = [
  { elementType:'geometry', stylers:[{color:'#d8cfb5'}] },
  { elementType:'labels.text.fill', stylers:[{color:'#3f4a40'}] },
  { elementType:'labels.text.stroke', stylers:[{color:'#e7dfc8'}] },
  { featureType:'poi', stylers:[{visibility:'off'}] },
  { featureType:'transit', stylers:[{visibility:'off'}] },
  { featureType:'road', elementType:'geometry', stylers:[{color:'#b3a98e'}] },
  { featureType:'road', elementType:'labels.icon', stylers:[{visibility:'off'}] },
  { featureType:'administrative.locality', elementType:'labels', stylers:[{visibility:'simplified'}] },
  { featureType:'water', elementType:'geometry', stylers:[{color:'#718896'}] },
  { featureType:'landscape.natural', elementType:'geometry', stylers:[{color:'#a6ad86'}] }
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pixelPin = category => {
  const color = categoryColors[category] || '#d6a34a';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" shape-rendering="crispEdges"><path fill="#111827" d="M6 2h16v3h4v18h-4v4h-5v7h-6v-7H6v-4H2V5h4z"/><path fill="${color}" d="M7 6h14v3h3v12h-4v4H8v-4H4V9h3z"/><rect fill="#fff1b6" x="10" y="10" width="8" height="8"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const loadGoogleMaps = apiKey => new Promise((resolve, reject) => {
  if (window.google?.maps) return resolve(window.google.maps);
  const callback = `initKochiMap_${Date.now()}`;
  window[callback] = () => { delete window[callback]; resolve(window.google.maps); };
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callback}&v=weekly`;
  script.async = true;
  script.onerror = () => reject(new Error('Google Mapsを読み込めませんでした'));
  document.head.append(script);
});

export async function initKochiMap(items) {
  const container = document.querySelector('#kochi-google-map');
  const fallback = document.querySelector('#map-fallback');
  const apiKey = window.KOCHI_CONFIG?.googleMapsApiKey;
  if (!container || !apiKey) return;
  try {
    const maps = await loadGoogleMaps(apiKey);
    const map = new maps.Map(container, {
      center:KOCHI_CENTER, zoom:8, minZoom:7, styles:mapStyles,
      mapTypeControl:false, streetViewControl:false, fullscreenControl:false,
      clickableIcons:false, gestureHandling:'cooperative'
    });
    fallback.hidden = true;
    const info = new maps.InfoWindow();
    items.filter(x => Number.isFinite(Number(x.latitude)) && Number.isFinite(Number(x.longitude))).forEach(item => {
      const marker = new maps.Marker({
        map, position:{lat:Number(item.latitude),lng:Number(item.longitude)},
        title:item.title || item.legend, icon:{url:pixelPin(item.category),scaledSize:new maps.Size(28,36)}
      });
      marker.addListener('click', () => {
        const title = item.title || item.legend;
        const summary = item.summary || item.why;
        const number = item.legend_no || 'NEW';
        const href = item.detail_url || '#zukan';
        info.setContent(`<article class="pixel-info"><small>LEGEND No.${escapeHtml(number)}</small><h3>${escapeHtml(title)}</h3><p>${escapeHtml(summary)}</p><a href="${escapeHtml(href)}">詳細を見る →</a></article>`);
        info.open({map,anchor:marker});
      });
    });
  } catch (error) {
    fallback.innerHTML = `<b>MAP LOAD ERROR</b><p>${escapeHtml(error.message)}</p>`;
  }
}
