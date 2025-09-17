// frontend/welcome.js
const API_BASE = 'http://localhost:5003'; // news-service
let state = { q:'', page:1, pageSize:12, articles: [] };

const articlesList = document.getElementById('articlesList');
const preview = { title:document.getElementById('previewTitle'), meta:document.getElementById('previewMeta'),
  desc:document.getElementById('previewDesc'), img:document.getElementById('previewImage'), link:document.getElementById('previewLink') };

async function fetchNews(q='', page=1){
  const url = `${API_BASE}/news?q=${encodeURIComponent(q)}&page=${page}&pageSize=${state.pageSize}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('News fetch failed');
  return res.json();
}

function createArticleCard(a, idx){
  const el = document.createElement('div'); el.className='article';
  const img = document.createElement('img'); img.src = a.urlToImage || 'https://via.placeholder.com/320x180?text=No+image';
  const meta = document.createElement('div'); meta.className='meta';
  const h3 = document.createElement('h3'); h3.textContent = a.title;
  const p = document.createElement('p'); p.textContent = `${a.source.name} · ${new Date(a.publishedAt).toLocaleString()}`;
  meta.appendChild(h3); meta.appendChild(p);
  el.appendChild(img); el.appendChild(meta);
  el.addEventListener('click', ()=> showPreview(a));
  return el;
}

function renderArticles(arr, append=false){
  if(!append) articlesList.innerHTML='';
  arr.forEach((a, i)=> articlesList.appendChild(createArticleCard(a, i)));
  if(arr.length === 0) articlesList.innerHTML = '<p style="color:var(--muted)">No articles found.</p>';
}

function showPreview(a){
  preview.title.textContent = a.title;
  preview.meta.textContent = `${a.source.name} · ${new Date(a.publishedAt).toLocaleString()}`;
  preview.desc.textContent = a.description || a.content || '';
  preview.img.src = a.urlToImage || 'https://via.placeholder.com/800x400?text=No+image';
  preview.link.href = a.url;
}

async function loadInitial(){
  try {
    const data = await fetchNews('', 1);
    state.page = 1; state.articles = data.articles || [];
    renderArticles(state.articles, false);
    if (state.articles[0]) showPreview(state.articles[0]);
  } catch (e) { console.error(e); articlesList.innerHTML = '<p style="color:red">Failed to load news</p>'; }
}

document.getElementById('searchForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  state.q = q; state.page = 1;
  try {
    const data = await fetchNews(q, 1);
    state.articles = data.articles || [];
    renderArticles(state.articles, false);
    if (state.articles[0]) showPreview(state.articles[0]);
  } catch(err){ console.error(err); alert('Search failed'); }
});

document.getElementById('loadMoreBtn').addEventListener('click', async ()=>{
  state.page++;
  try {
    const data = await fetchNews(state.q, state.page);
    const more = data.articles || [];
    state.articles = state.articles.concat(more);
    renderArticles(more, true);
  } catch(e){ console.error(e); alert('Failed to load more'); }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  const ok = confirm("Are you sure you want to log out?");
  if (!ok) return;                 // ✅ stop if user clicks “Cancel”

  // Clear any stored token if you add one later
  // localStorage.removeItem('token');

  // Redirect to login page
  window.location.href = 'index.html';
});

// left nav quick filters
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.filter || '';
    document.getElementById('searchInput').value = cat;
    state.q = cat; state.page = 1;
    try{
      const data = await fetchNews(cat, 1);
      state.articles = data.articles || [];
      renderArticles(state.articles,false);
      if (state.articles[0]) showPreview(state.articles[0]);
    }catch(err){ console.error(err); }
  });
});

// initial load
loadInitial();