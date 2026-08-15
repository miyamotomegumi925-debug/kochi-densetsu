import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SITE = 'https://miyamotomegumi925-debug.github.io/kochi-densetsu';
const legends = JSON.parse(await readFile('data/legends.json', 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
const pathFor = legend => `${String(legend.legend_no).padStart(3,'0')}-${legend.slug}`;
const urlFor = legend => `${SITE}/legends/${pathFor(legend)}/`;
const descriptionFor = legend => `${legend.place}の「${legend.title}」を紹介。${legend.summary} 高知の人・文化・食・風景・祭りを伝説として集める冒険メディア「コウチの伝説」の記録です。`.slice(0,120);
const section = (id,title,body) => `<section aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2><p>${esc(body || 'この伝説の詳しい情報は現在調査中です。')}</p></section>`;

function renderPage(legend) {
  const number = String(legend.legend_no).padStart(3,'0');
  const url = urlFor(legend);
  const image = legend.image_url || `${SITE}/kochi-title-screen.png`;
  const related = legends.filter(item => item.area === legend.area && item.id !== legend.id).slice(0,3);
  const breadcrumb = {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'コウチの伝説',item:`${SITE}/`},{'@type':'ListItem',position:2,name:`${legend.area}エリア`,item:`${SITE}/#map`},{'@type':'ListItem',position:3,name:legend.title,item:url}]};
  const article = {'@context':'https://schema.org','@type':'Article',headline:`【${legend.place}】${legend.title}`,description:descriptionFor(legend),inLanguage:'ja',image,mainEntityOfPage:url,publisher:{'@type':'Organization',name:'コウチの伝説'},about:{'@type':'Thing',name:legend.title}};
  const relatedHtml = related.map(item => `<a href="../${pathFor(item)}/">No.${esc(item.legend_no)} ${esc(item.title)}</a>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071b42">
<title>【${esc(legend.place)}】${esc(legend.title)}｜${esc(legend.category)}・${esc(legend.area)} - コウチの伝説</title><meta name="description" content="${esc(descriptionFor(legend))}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:locale" content="ja_JP"><meta property="og:site_name" content="コウチの伝説"><meta property="og:title" content="【${esc(legend.place)}】${esc(legend.title)}｜コウチの伝説"><meta property="og:description" content="${esc(descriptionFor(legend))}"><meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../../src/legend-article.css?v=20260815-2"><link rel="stylesheet" href="../../src/legend-pages.css?v=20260815-2"><script type="application/ld+json">${safeJson(breadcrumb)}</script><script type="application/ld+json">${safeJson(article)}</script></head><body>
<nav class="article-nav" aria-label="記事ナビゲーション"><a href="../../index.html">コウチの伝説</a><small>LEGENDS OF KOCHI / QUEST LOG</small></nav><nav class="legend-breadcrumb" aria-label="パンくずリスト"><ol><li><a href="../../index.html">トップ</a></li><li><a href="../../index.html#map">${esc(legend.area)}エリア</a></li><li aria-current="page">${esc(legend.title)}</li></ol></nav>
<main><article class="legend-article" data-legend-page data-legend-id="${number}" data-legend-record-id="${esc(legend.id)}" data-legend-area="${esc(legend.area)}"><header class="legend-article-header">${legend.image_url ? `<img class="legend-hero-image" src="${esc(legend.image_url)}" alt="${esc(legend.title)}" width="960" height="540">` : ''}<p class="legend-number">LEGEND No.${number} / ${esc(legend.category)} / ${esc(legend.area)}</p><h1>【${esc(legend.place)}】${esc(legend.title)}</h1><p class="legend-lead">${esc(legend.summary)}</p><p id="article-discovery-status" class="article-status" role="status" aria-live="polite">DISCOVERED ✓ 発見済み</p></header>
${section('overview-title','この伝説の概要',legend.summary)}${section('reason-title','なぜ伝説なのか',legend.why)}${section('season-title','旬・出会える時期',legend.season)}${section('access-title','会える場所・アクセス',legend.access || `${legend.place}。詳しい行き方や営業情報は、訪問前に最新情報をご確認ください。`)}
${legend.youtube ? `<p><a class="share-button secondary" href="${esc(legend.youtube)}" target="_blank" rel="noopener noreferrer">▶ YouTubeで見る</a></p>` : ''}<section aria-labelledby="summary-title"><h2 id="summary-title">まとめ｜この伝説を次の冒険者へ</h2><p>${esc(legend.title)}は、${esc(legend.place)}で出会える高知の伝説です。</p><a id="share-on-x" class="share-button" href="https://twitter.com/intent/tweet" target="_blank" rel="noopener">この伝説を発見した！ Xでシェア</a></section>
<section aria-labelledby="next-title"><h2 id="next-title">同じエリアの伝説</h2><div class="related-links">${relatedHtml}<a href="../../index.html#zukan">伝説図鑑へ戻る</a><a href="../../index.html">トップページへ戻る</a></div></section></article></main><footer class="article-footer">© 2026 LEGENDS OF KOCHI</footer><script src="../../src/legend-page.js?v=20260815-3" defer></script></body></html>`;
}

await mkdir('legends',{recursive:true});
for (const legend of legends) { const dir=join('legends',pathFor(legend)); await mkdir(dir,{recursive:true}); await writeFile(join(dir,'index.html'),renderPage(legend),'utf8'); }
const entries = legends.flatMap(legend => [[legend.id,`./legends/${pathFor(legend)}/`],[legend.title,`./legends/${pathFor(legend)}/`]]);
await writeFile('src/legend-pages.js',`window.KOCHI_LEGEND_PAGES=${JSON.stringify(Object.fromEntries(entries))};\n`,'utf8');
const urls=[`${SITE}/`,`${SITE}/legends/001-shimanto-aonori/`,...legends.map(urlFor)];
await writeFile('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map(url=>`  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`,'utf8');
console.log(`Generated ${legends.length} legend pages.`);
