import { dbSelect, dbInsert, dbInsertReturning, dbUpdate, dbDelete, signInAdmin, refreshAdminSession, uploadLegendImage } from './supabase.js?v=20260801-3';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session = JSON.parse(sessionStorage.getItem('kochi-admin-session') || 'null');
let submissions = [];
let legends = [];
let settings = {};
let promotionSource = null;
let editingLegend = null;

const coordinateRow = $('#legend-form').querySelectorAll(':scope > div')[1];
coordinateRow.insertAdjacentHTML('afterend', '<label class="map-verified-label"><input name="map_verified" type="checkbox"> この緯度・経度は現地を特定できる正確な位置として確認済み（地図に表示する）</label><small class="location-warning">未確認、概算位置、場所を公開すべきでない場合はチェックしないでください。</small>');
$('#legend-form').querySelector('input[name="title"]').insertAdjacentHTML('afterend', '<label class="image-upload-label">伝説の写真<input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small>JPEG・PNG・WebP、5MBまで</small></label>');
$('#legend-form .image-upload-label').insertAdjacentHTML('afterend', '<div id="legend-image-preview" class="legend-image-preview" hidden><img alt="引き継ぐ伝説の写真"><p></p></div>');
$('[data-tab="featured"]').textContent = '今日・新しい伝説';

function showLegendImagePreview(imageUrl, message = '') {
  const preview = $('#legend-image-preview');
  const image = preview.querySelector('img');
  const text = preview.querySelector('p');
  preview.hidden = !imageUrl;
  image.src = imageUrl || '';
  text.textContent = imageUrl ? message : '';
}

async function persistLegendImage(legendId, imageUrl, token) {
  if (!legendId || !imageUrl) return;
  const updated = await dbUpdate('legends', legendId, {
    image_url:imageUrl,
    updated_at:new Date().toISOString()
  }, token);
  if (updated?.[0]?.image_url !== imageUrl) throw new Error('図鑑へ画像URLを保存できませんでした');
}

function submissionImageSyncControl(submission) {
  if (!submission.promoted_legend_id || !submission.image_url) return '';
  const linkedLegend = legends.find(legend => legend.id === submission.promoted_legend_id);
  if (linkedLegend?.image_url === submission.image_url) return '<span class="published-note">✓ 写真引継ぎ済み</span>';
  return `<button data-action="sync-image" data-id="${submission.id}">写真を図鑑へ再反映</button>`;
}

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
  $('#admin-submissions').innerHTML = rows.length ? rows.map(x => `<article class="admin-card submission-card ${x.status === 'approved' ? 'is-published' : ''}">${x.image_url ? `<img class="admin-submission-image" src="${esc(x.image_url)}" alt="">` : ''}<div class="admin-card-head"><span class="status ${x.status}">${x.status === 'approved' ? '● 公開中' : x.status === 'pending' ? '未確認' : '非公開'}</span><time>${new Date(x.created_at).toLocaleString('ja-JP')}</time></div><h3>${esc(x.legend)}</h3><p>📍 ${esc(x.place)} ／ BY ${esc(x.author || '名もなき冒険者')}</p><dl><dt>なぜ伝説？</dt><dd>${esc(x.why)}</dd><dt>会いかた</dt><dd>${esc(x.access)}</dd></dl>${x.youtube ? `<a href="${esc(x.youtube)}" target="_blank" rel="noopener">YouTube ↗</a>` : ''}<div class="admin-actions">${x.promoted_legend_id ? '<span class="promoted-note">★ 図鑑へ移行済み</span>' : `<button data-action="promote" data-id="${x.id}">図鑑へ移行</button>`}${submissionImageSyncControl(x)}${x.status === 'approved' ? '<span class="published-note">✓ 公開中</span>' : `<button data-action="approved" data-id="${x.id}">公開する</button>`}<button data-action="rejected" data-id="${x.id}" ${x.status === 'rejected' ? 'disabled' : ''}>非公開</button><button data-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">対象の投稿はありません。</p>';
}

function renderSettings() {
  const today = settings.home_featured?.today_legend_id || '';
  const selectedNew = settings.home_featured?.new_legend_ids || [];
  const optionLabel = legend => `No.${esc(legend.legend_no || '---')} ${esc(legend.title)}［${legend.status === 'published' ? '公開中' : '下書き・選択すると公開'}］`;
  $('#today-legend-select').innerHTML = '<option value="">選択してください</option>' + legends.map(x => `<option value="${x.id}" ${x.id === today ? 'selected' : ''}>${optionLabel(x)}</option>`).join('');
  const options = '<option value="">掲載しない</option>' + legends.map(x => `<option value="${x.id}">${optionLabel(x)}</option>`).join('');
  $('#new-legend-options').innerHTML = legends.length
    ? [0,1,2].map(index => `<label>あたらしい伝説 ${index + 1}<select name="new_legend_ids" data-featured-slot="${index}">${options}</select></label>`).join('')
    : '<p>先に伝説図鑑を登録してください。</p>';
  document.querySelectorAll('[data-featured-slot]').forEach(select => {
    select.value = selectedNew[Number(select.dataset.featuredSlot)] || '';
  });
  const seasonal = settings.seasonal || {};
  const form = $('#seasonal-form');
  ['season','label','title','description','link'].forEach(name => { if (seasonal[name] != null) form.elements[name].value = seasonal[name]; });
  form.elements.enabled.checked = seasonal.enabled !== false;
  const analytics = settings.analytics || {};
  const analyticsForm = $('#analytics-form');
  analyticsForm.elements.measurement_id.value = analytics.measurement_id || '';
  analyticsForm.elements.enabled.checked = analytics.enabled !== false;
}

function renderLegends() {
  $('#admin-legends').innerHTML = legends.length ? legends.map(x => `<article class="admin-card">${x.image_url ? `<img class="admin-submission-image" src="${esc(x.image_url)}" alt="">` : ''}<div class="admin-card-head"><span class="status ${x.status}">${x.status}</span><span>${esc(x.category)} / ${esc(x.area)}</span></div><h3>${esc(x.title)}</h3><p>📍 ${esc(x.place)}</p><p class="map-status ${x.map_verified ? 'verified' : 'hidden'}">${x.map_verified ? '◆ 正確な位置を確認済み・地図表示対象' : '◇ 位置未確認・地図には表示しません'}</p><p>${esc(x.summary)}</p><div class="admin-actions">${x.status === 'draft' ? `<button data-legend-action="edit" data-id="${x.id}">編集する</button>` : ''}<button data-legend-action="${x.status === 'published' ? 'draft' : 'published'}" data-id="${x.id}">${x.status === 'published' ? '下書きへ' : '公開する'}</button><button data-legend-action="delete" data-id="${x.id}" class="danger">削除</button></div></article>`).join('') : '<p class="admin-empty">図鑑はまだ登録されていません。</p>';
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
function activateTab(name) {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  ['submissions','legends','featured','seasonal','analytics'].forEach(tab => { $(`#tab-${tab}`).hidden = tab !== name; });
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => activateTab(button.dataset.tab));
$('#admin-submissions').onclick = async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'sync-image') {
    const source = submissions.find(item => item.id === button.dataset.id);
    if (!source?.promoted_legend_id || !source.image_url) return;
    button.disabled = true;
    try {
      await withSession(token => persistLegendImage(source.promoted_legend_id, source.image_url, token));
      await loadDashboard();
    } catch (error) {
      alert(`画像を再反映できませんでした: ${error.message}`);
      button.disabled = false;
    }
    return;
  }
  if (button.dataset.action === 'promote') {
    const source = submissions.find(item => item.id === button.dataset.id);
    if (!source || source.promoted_legend_id) return;
    promotionSource = source;
    editingLegend = null;
    const form = $('#legend-form');
    form.reset();
    form.elements.title.value = source.legend;
    form.elements.place.value = source.place;
    form.elements.summary.value = source.why;
    form.elements.why.value = source.why;
    form.elements.access.value = source.access;
    form.elements.youtube.value = source.youtube || '';
    form.elements.status.value = 'draft';
    showLegendImagePreview(source.image_url, '★ 投稿画像を図鑑へ引き継ぎます。別の写真を選ぶと差し替えられます。');
    $('#legend-status').textContent = source.image_url
      ? '★ 投稿内容と画像を引き継ぎました。カテゴリーとエリアを選び、内容を確認して登録してください。'
      : '★ 投稿内容を引き継ぎました。カテゴリーとエリアを選び、内容を確認して登録してください。';
    activateTab('legends');
    form.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  if (button.dataset.action === 'delete' && !confirm('この投稿を削除しますか？')) return;
  await withSession(token => button.dataset.action === 'delete'
    ? dbDelete('submissions', button.dataset.id, token)
    : dbUpdate('submissions', button.dataset.id, { status: button.dataset.action, updated_at: new Date().toISOString() }, token));
  await loadDashboard();
};
$('#legend-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;
  const formData = new FormData(form); const image = formData.get('image'); formData.delete('image'); const data = Object.fromEntries(formData);
  data.latitude = data.latitude ? Number(data.latitude) : null;
  data.longitude = data.longitude ? Number(data.longitude) : null;
  data.map_verified = form.elements.map_verified.checked;
  if (data.map_verified && (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))) {
    $('#legend-status').textContent = 'エラー：地図表示には緯度と経度の両方が必要です。';
    return;
  }
  const duplicate = legends.some(item => item.id !== editingLegend?.id && item.title.trim() === data.title.trim() && item.place.trim() === data.place.trim());
  if (duplicate) {
    if (promotionSource) {
      const existing = legends.find(item => item.title.trim() === data.title.trim() && item.place.trim() === data.place.trim());
      const inheritedExistingImage = !existing.image_url && Boolean(promotionSource.image_url);
      try {
        await withSession(token => Promise.all([
          dbUpdate('submissions', promotionSource.id, {
            promoted_legend_id:existing.id,
            status:'approved',
            updated_at:new Date().toISOString()
          }, token),
          inheritedExistingImage
            ? persistLegendImage(existing.id, promotionSource.image_url, token)
            : Promise.resolve()
        ]));
        form.reset();
        showLegendImagePreview(null);
        promotionSource = null;
        $('#legend-status').textContent = inheritedExistingImage
          ? '✓ 登録済みの伝説図鑑と投稿を紐付け、投稿画像も引き継ぎました。'
          : '✓ すでに登録済みの伝説図鑑と投稿を紐付けました。';
        await loadDashboard();
      } catch (error) {
        $('#legend-status').textContent = `紐付けできませんでした: ${error.message}`;
      }
      return;
    }
    $('#legend-status').textContent = 'このタイトルと場所の伝説はすでに登録されています。';
    return;
  }
  submitButton.disabled = true;
  const wasEditing = Boolean(editingLegend);
  const wasPromotion = Boolean(promotionSource);
  $('#legend-status').textContent = wasEditing ? '更新中…' : '登録中…';
  try {
    await withSession(async token => {
      if (image?.size) {
        if (image.size > 5 * 1024 * 1024) throw new Error('画像は5MB以下にしてください');
        if (!['image/jpeg','image/png','image/webp'].includes(image.type)) throw new Error('JPEG・PNG・WebP画像を選択してください');
        data.image_url = await uploadLegendImage(image, token);
      } else if (promotionSource?.image_url) {
        data.image_url = promotionSource.image_url;
      } else if (editingLegend?.image_url) {
        data.image_url = editingLegend.image_url;
      }
      if (editingLegend) {
        await dbUpdate('legends', editingLegend.id, { ...data, updated_at:new Date().toISOString() }, token);
      } else {
        const inserted = await dbInsertReturning('legends', data, token);
        if (inserted?.[0]?.id && data.image_url) {
          await persistLegendImage(inserted[0].id, data.image_url, token);
        }
        if (promotionSource && inserted?.[0]?.id) {
          await dbUpdate('submissions', promotionSource.id, {
            promoted_legend_id:inserted[0].id,
            status:'approved',
            updated_at:new Date().toISOString()
          }, token);
        }
      }
    });
    form.reset();
    showLegendImagePreview(null);
    submitButton.textContent = '▶ 図鑑に登録';
    $('#legend-status').textContent = wasEditing ? '✓ 下書きを更新しました。フォームをクリアしました。' : wasPromotion ? '✓ 投稿を伝説図鑑へ移行しました。フォームをクリアしました。' : '✓ 登録しました。フォームをクリアしました。';
    promotionSource = null;
    editingLegend = null;
    await loadDashboard();
  }
  catch (error) { $('#legend-status').textContent = `登録できませんでした: ${error.message}`; }
  finally { submitButton.disabled = false; }
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
  const todayId = data.get('today_legend_id') || null;
  const selected = data.getAll('new_legend_ids').filter(Boolean).slice(0, 3);
  if (new Set(selected).size !== selected.length) {
    $('#featured-status').textContent = '同じ伝説を複数の欄には設定できません。';
    return;
  }
  $('#featured-status').textContent = '保存中…';
  try {
    const featuredIds = [...new Set([todayId, ...selected].filter(Boolean))];
    await withSession(token => Promise.all(featuredIds.map(id => {
      const legend = legends.find(item => item.id === id);
      return legend?.status === 'draft'
        ? dbUpdate('legends', id, { status:'published', updated_at:new Date().toISOString() }, token)
        : Promise.resolve();
    })));
    await saveSetting('home_featured', { today_legend_id:todayId, new_legend_ids:selected });
    $('#featured-status').textContent = '✓ トップ掲載を保存しました。選択した下書きは公開中に変更しました。';
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

$('#analytics-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const measurementId = form.elements.measurement_id.value.trim().toUpperCase();
  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) {
    $('#analytics-status').textContent = 'G-から始まる測定IDを入力してください。';
    return;
  }
  $('#analytics-status').textContent = '保存中…';
  try {
    await saveSetting('analytics', { measurement_id:measurementId, enabled:form.elements.enabled.checked });
    $('#analytics-status').textContent = measurementId && form.elements.enabled.checked
      ? '✓ アクセス解析を有効にしました。公開サイトへの次回アクセスから計測します。'
      : '✓ アクセス解析を停止しました。';
    await loadDashboard();
  } catch (error) { $('#analytics-status').textContent = `エラー: ${error.message}`; }
};
$('#admin-legends').onclick = async event => {
  const button = event.target.closest('[data-legend-action]'); if (!button) return;
  if (button.dataset.legendAction === 'edit') {
    const legend = legends.find(item => item.id === button.dataset.id && item.status === 'draft');
    if (!legend) return;
    editingLegend = legend;
    promotionSource = null;
    const form = $('#legend-form');
    form.reset();
    ['title','legend_no','category','area','season','place','summary','why','access','detail_url','youtube','status'].forEach(name => {
      if (form.elements[name]) form.elements[name].value = legend[name] ?? '';
    });
    form.elements.latitude.value = legend.latitude ?? '';
    form.elements.longitude.value = legend.longitude ?? '';
    form.elements.map_verified.checked = legend.map_verified === true;
    showLegendImagePreview(legend.image_url, '現在の図鑑写真です。別の写真を選ぶと差し替えられます。');
    form.querySelector('[type="submit"]').textContent = '▶ 下書きを更新';
    $('#legend-status').textContent = '✎ 下書きを編集中です。変更後に「下書きを更新」を押してください。写真を選び直さない場合は現在の写真を維持します。';
    form.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  if (button.dataset.legendAction === 'delete' && !confirm('この伝説を削除しますか？')) return;
  await withSession(token => button.dataset.legendAction === 'delete'
    ? dbDelete('legends', button.dataset.id, token)
    : dbUpdate('legends', button.dataset.id, { status: button.dataset.legendAction, updated_at: new Date().toISOString() }, token));
  await loadDashboard();
};

if (session?.access_token) { $('#login-panel').hidden = true; $('#dashboard').hidden = false; loadDashboard(); }
