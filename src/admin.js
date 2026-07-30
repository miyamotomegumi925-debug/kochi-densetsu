import { dbSelect, dbInsert, dbUpdate, dbDelete, signInAdmin, refreshAdminSession, uploadLegendImage } from './supabase.js?v=20260730-6';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session = JSON.parse(sessionStorage.getItem('kochi-admin-session') || 'null');
let submissions = [];
let legends = [];
let settings = {};

const coordinateRow = $('#legend-form').querySelectorAll(':scope > div')[1];
coordinateRow.insertAdjacentHTML('afterend', '<label class="map-verified-label"><input name="map_verified" type="checkbox"> この緯度・経度は現地を特定できる正確な位置として確認済み（地図に表示する）</label><small class="location-warning">未確認、概算位置、場所を公開すべきでない場合はチェックしないでください。</small>');
$('#legend-form').querySelector('input[name="title"]').insertAdjacentHTML('afterend', '<label class="image-upload-label">伝説の写真<input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small>JPEG・PNG・WebP、5MBまで</small></label>');

async function ensureSession() {
  if (!session?.access_token) throw new Error('ログインが必要です');
  const expiresSoon = !session.expires_at || session.expires_at * 1000 < Date.now() + 60000;
  if (expiresSoon) {
    if (!session.refresh_token) throw new Error('再ログインが必要です');
    session = await refreshAdminSession(session.refresh_token);
    sessionStorage.setItem('kochi-admin-session', JSON.stringify(session));
  }
  return session.access_token;
}

async function withSession(operation) {
  try {
    return await operation(await ensureSession());
  } catch (error) {
    if (!/JWT expired|PGRST303|token.*expired/i.test(error.message) || !session?.refresh_token) throw error;
    session = await refreshAdminSession(session.refresh_token);
    sessionStorage.setItem('kochi-admin-session', JSON.stringify(session));
    return operation(session.access_token);
  }
}

async function loadDashboard() {
  try {
    [submissions, legends, settings] = await withSession(token => Promise.all([
      dbSelect('submissions', 'select=*&order=created_at.desc', token),
      dbSelect('legends', 'select=*&order=sort_order.asc,created_at.desc', token),
      dbSelect('site_settings', 'select=*', token).then(rows => Object.fromEntries(rows.map(row => [row.key, row.value])))
    ]));
    $('#pending-count').textContent = submissions.filter(x => x.status === 'pending').length;
    $('#approved-count').textContent = submissions.filter(x => x.status === 'approved').length;
    $('#legend-count').textContent = legends.length;
    renderSubmissions();
    renderLegends();
    renderSettings();
  } catch (error) {
    if (/JWT|token|401/i.test(error.message)) logout();
    else alert(`読み込みエラー: ${error.message}`);
  }
}

function renderSubmissions() {
  const filter = $('#submission-filter').value;
  const rows = filter === 'all' ? submissions : submissions.filter(x => x.status === filter);
  $('#admin-submissions').innerHTML = rows.length ? rows.map(x => `<article class="admin-card submission-card ${x.status === 'approved' ? 'is-published' : ''}"><div class="admin-card-head"><span class="status ${x.status}">${x.status === 'approved' ? '● 公開中' : x.status === 'pending' ? '未確認' : '非公開'}</span><time>${new Date(x.created_at).toLocaleString('ja-JP')}</time></div><h3>${esc(x.legend)}</h3><p>📍 ${esc(x.place)} ／ BY ${esc(x.author || '名もなき冒険者')}</p><dl><dt>なぜ伝説？</dt><dd>${esc(x.why)}</dd><dt>会いかた</dt><dd>${esc(x.access)}</dd></dl>${x.youtube ? `<a href="${esc(x.youtube)}" target="_blank" rel="noopener">YouTube ↗</a>` : ''}<div class="admin-actions">${x.status === 'approved' ? '<span class="published-note">✓ 公開サイトに掲載中</span>' : `<button data-action="approved" data-id="${x.id}">公開する</button>`}<button data-action="rejected" data-id="${x.id}" ${x.status === 'rejected' ? 'disabled' : ''}>非公開</button><button data-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">対象の投稿はありません。</p>';
}

function renderSettings() {
  const published = legends.filter(x => x.status === 'published');
  const today = settings.home_featured?.today_legend_id || '';
  const selectedNew = settings.home_featured?.new_legend_ids || [];
  $('#today-legend-select').innerHTML = '<option value="">選択してください</option>' + published.map(x => `<option value="${x.id}" ${x.id === today ? 'selected' : ''}>No.${esc(x.legend_no || '---')} ${esc(x.title)}</option>`).join('');
  $('#new-legend-options').innerHTML = published.length ? published.map(x => `<label><input type="checkbox" name="new_legend_ids" value="${x.id}" ${selectedNew.includes(x.id) ? 'checked' : ''}> No.${esc(x.legend_no || '---')} ${esc(x.title)}</label>`).join('') : '<p>先に伝説図鑑を公開してください。</p>';
  const seasonal = settings.seasonal || {};
  const form = $('#seasonal-form');
  ['season','label','title','description','link'].forEach(name => { if (seasonal[name] != null) form.elements[name].value = seasonal[name]; });
  form.elements.enabled.checked = seasonal.enabled !== false;
}

function renderLegends() {
  $('#admin-legends').innerHTML = legends.length ? legends.map(x => `<article class="admin-card"><div class="admin-card-head"><span class="status ${x.status}">${x.status}</span><span>${esc(x.category)} / ${esc(x.area)}</span></div><h3>${esc(x.title)}</h3><p>📍 ${esc(x.place)}</p><p class="map-status ${x.map_verified ? 'verified' : 'hidden'}">${x.map_verified ? '◆ 正確な位置を確認済み・地図表示対象' : '◇ 位置未確認・地図には表示しません'}</p><p>${esc(x.summary)}</p><div class="admin-actions"><button data-legend-action="${x.status === 'published' ? 'draft' : 'published'}" data-id="${x.id}">${x.status === 'published' ? '下書きへ' : '公開する'}</button><button data-legend-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">図鑑はまだ登録されていません。</p>';
}

async function authenticate(email, password) {
  const result = await signInAdmin(email, password);
  session = result;
  sessionStorage.setItem('kochi-admin-session', JSON.stringify(session));
  $('#login-panel').hidden = true;
  $('#dashboard').hidden = false;
  await loadDashboard();
}

function logout() {
  session = null;
  sessionStorage.removeItem('kochi-admin-session');
  $('#dashboard').hidden = true;
  $('#login-panel').hidden = false;
}

$('#admin-login').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  $('#login-error').textContent = '';
  try { await authenticate(data.get('email'), data.get('password')); }
  catch { $('#login-error').textContent = 'ログインできません。管理者のメールアドレスとパスワードを確認してください。'; }
};
$('#logout').onclick = logout;
$('#submission-filter').onchange = renderSubmissions;
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === button));
  $('#tab-submissions').hidden = button.dataset.tab !== 'submissions';
  $('#tab-legends').hidden = button.dataset.tab !== 'legends';
  $('#tab-featured').hidden = button.dataset.tab !== 'featured';
  $('#tab-seasonal').hidden = button.dataset.tab !== 'seasonal';
});
$('#admin-submissions').onclick = async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'delete' && !confirm('この投稿を削除しますか？')) return;
  await withSession(token => button.dataset.action === 'delete'
    ? dbDelete('submissions', button.dataset.id, token)
    : dbUpdate('submissions', button.dataset.id, { status: button.dataset.action, updated_at: new Date().toISOString() }, token));
  await loadDashboard();
};
$('#legend-form').onsubmit = async event => {
  event.preventDefault(); const formData = new FormData(event.currentTarget); const image = formData.get('image'); formData.delete('image'); const data = Object.fromEntries(formData);
  data.latitude = data.latitude ? Number(data.latitude) : null;
  data.longitude = data.longitude ? Number(data.longitude) : null;
  data.map_verified = event.currentTarget.elements.map_verified.checked;
  if (data.map_verified && (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))) {
    $('#legend-status').textContent = 'エラー：地図表示には緯度と経度の両方が必要です。';
    return;
  }
  $('#legend-status').textContent = '登録中…';
  try {
    await withSession(async token => {
      if (image?.size) {
        if (image.size > 5 * 1024 * 1024) throw new Error('画像は5MB以下にしてください');
        if (!['image/jpeg','image/png','image/webp'].includes(image.type)) throw new Error('JPEG・PNG・WebP画像を選択してください');
        data.image_url = await uploadLegendImage(image, token);
      }
      await dbInsert('legends', data, token);
    });
    event.currentTarget.reset(); $('#legend-status').textContent = '✓ 登録しました'; await loadDashboard();
  }
  catch (error) { $('#legend-status').textContent = `エラー: ${error.message}`; }
};

async function saveSetting(key, value) {
  await withSession(async token => {
    const existing = await dbSelect('site_settings', `select=key&key=eq.${encodeURIComponent(key)}`, token);
    if (existing.length) await dbUpdate('site_settings', key, { value, updated_at:new Date().toISOString() }, token, 'key');
    else await dbInsert('site_settings', { key, value }, token);
  });
}

$('#featured-form').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const selected = data.getAll('new_legend_ids').slice(0, 3);
  $('#featured-status').textContent = '保存中…';
  try {
    await saveSetting('home_featured', { today_legend_id:data.get('today_legend_id') || null, new_legend_ids:selected });
    $('#featured-status').textContent = '✓ トップ掲載を保存しました';
    await loadDashboard();
  } catch (error) { $('#featured-status').textContent = `エラー: ${error.message}`; }
};

$('#seasonal-form').onsubmit = async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  data.enabled = event.currentTarget.elements.enabled.checked;
  $('#seasonal-status').textContent = '保存中…';
  try {
    await saveSetting('seasonal', data);
    $('#seasonal-status').textContent = '✓ SEASONALを保存しました';
    await loadDashboard();
  } catch (error) { $('#seasonal-status').textContent = `エラー: ${error.message}`; }
};
$('#admin-legends').onclick = async event => {
  const button = event.target.closest('[data-legend-action]'); if (!button) return;
  if (button.dataset.legendAction === 'delete' && !confirm('この伝説を削除しますか？')) return;
  await withSession(token => button.dataset.legendAction === 'delete'
    ? dbDelete('legends', button.dataset.id, token)
    : dbUpdate('legends', button.dataset.id, { status: button.dataset.legendAction, updated_at: new Date().toISOString() }, token));
  await loadDashboard();
};

if (session?.access_token) { $('#login-panel').hidden = true; $('#dashboard').hidden = false; loadDashboard(); }
