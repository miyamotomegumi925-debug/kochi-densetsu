const PROGRESS_STORAGE_KEY = 'kochi-densetsu-progress';
const VALID_AREAS = ['東部', '中央部', '西部', '四万十'];
const ARTICLE_SETTINGS_URL = 'https://klyjygzrdqbvndbrcsvn.supabase.co';
const ARTICLE_SETTINGS_KEY = 'sb_publishable_14CEjkdZKIMziSsPdQzrDg_UQnzeYer';

const uniqueStrings = value => [...new Set((Array.isArray(value) ? value : []).map(String).map(item => item.trim()).filter(Boolean))];

function getAdventurerLevel(discoveredCount) {
  if (discoveredCount >= 20) return 5;
  if (discoveredCount >= 10) return 4;
  if (discoveredCount >= 6) return 3;
  if (discoveredCount >= 3) return 2;
  return 1;
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || 'null');
    const source = Array.isArray(parsed) ? { discoveredLegends: parsed } : (parsed && typeof parsed === 'object' ? parsed : {});
    const discoveredLegends = uniqueStrings(source.discoveredLegends ?? source.legends ?? source.discovered);
    const discoveredAreas = uniqueStrings(source.discoveredAreas ?? source.areas).filter(area => VALID_AREAS.includes(area));
    return { discoveredLegends, discoveredAreas, level: getAdventurerLevel(discoveredLegends.length) };
  } catch {
    return { discoveredLegends: [], discoveredAreas: [], level: 1 };
  }
}

function recordCurrentLegend() {
  const article = document.querySelector('[data-legend-page]');
  if (!article) return;
  const id = String(article.dataset.legendId || '').trim();
  const area = String(article.dataset.legendArea || '').trim();
  const progress = loadProgress();
  const isNew = id && !progress.discoveredLegends.includes(id);
  if (isNew) progress.discoveredLegends.push(id);
  if (VALID_AREAS.includes(area) && !progress.discoveredAreas.includes(area)) progress.discoveredAreas.push(area);
  progress.level = getAdventurerLevel(progress.discoveredLegends.length);
  try { localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress)); } catch {}

  const status = document.querySelector('#article-discovery-status');
  if (status) status.textContent = isNew ? 'LEGEND DISCOVERED！ この伝説を発見しました' : 'DISCOVERED ✓ 発見済み';
}

const shareLink = document.querySelector('#share-on-x');
if (shareLink) {
  const text = '四万十川の青のりの伝説を発見した！｜コウチの伝説';
  shareLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
}

recordCurrentLegend();

async function loadManagedArticleContent() {
  const article = document.querySelector('[data-legend-page]');
  const recordId = article?.dataset.legendRecordId;
  if (!recordId) return;
  try {
    const key = `legend_article_${recordId}`;
    const response = await fetch(`${ARTICLE_SETTINGS_URL}/rest/v1/site_settings?select=value&key=eq.${encodeURIComponent(key)}`, {
      headers:{ apikey:ARTICLE_SETTINGS_KEY, Authorization:`Bearer ${ARTICLE_SETTINGS_KEY}` }
    });
    if (!response.ok) return;
    const rows = await response.json();
    const content = rows[0]?.value;
    if (!content || typeof content !== 'object') return;
    const targets = {
      heading:article.querySelector('h1'),
      lead:article.querySelector('.legend-lead'),
      overview_heading:article.querySelector('#overview-title'),
      overview_body:article.querySelector('#overview-title + p'),
      reason_heading:article.querySelector('#reason-title'),
      reason_body:article.querySelector('#reason-title + p'),
      season_heading:article.querySelector('#season-title'),
      season_body:article.querySelector('#season-title + p'),
      access_heading:article.querySelector('#access-title'),
      access_body:article.querySelector('#access-title + p'),
      summary_heading:article.querySelector('#summary-title'),
      summary_body:article.querySelector('#summary-title + p')
    };
    Object.entries(targets).forEach(([name, element]) => {
      if (element && Object.hasOwn(content, name)) element.textContent = content[name] || '';
    });
  } catch (error) {
    console.warn('個別ページの編集内容を読み込めませんでした。', error);
  }
}

loadManagedArticleContent();
