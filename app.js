// ============================================================
//  SMART LIFE DOCS AI — app.js
//  Pure frontend: LocalStorage + Python backend (app.py)
//  Compatible with VS Code Live Server
// ============================================================

const API = 'http://127.0.0.1:5000/api';

// ============================================================
//  LOCAL STATE
// ============================================================
let currentUser = null;
let documents   = [];
let reminders   = [];
let currentDocId = null;

// ============================================================
//  INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('sld_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    bootApp();
  } else {
    document.getElementById('authOverlay').style.display = 'flex';
  }
  setDashGreeting();
});

function setDashGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('dashGreeting');
  if (el) el.textContent = `${g}! Here's your document overview.`;
}

// ============================================================
//  AUTH
// ============================================================
async function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill all fields.'; return; }

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; return; }
    currentUser = data.user;
    localStorage.setItem('sld_user', JSON.stringify(currentUser));
    bootApp();
  } catch (e) {
    errEl.textContent = 'Cannot connect to server. Make sure app.py is running!';
  }
}

async function handleRegister() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('regError');
  errEl.textContent = '';

  if (!name || !email || !password) { errEl.textContent = 'Please fill all fields.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed.'; return; }
    showToast('Account created! Please log in.', 'success');
    showLogin();
  } catch (e) {
    errEl.textContent = 'Cannot connect to server. Make sure app.py is running!';
  }
}

function handleLogout() {
  currentUser = null;
  documents   = [];
  reminders   = [];
  localStorage.removeItem('sld_user');
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authOverlay').style.display = 'flex';
  showLogin();
  showToast('Logged out successfully.', 'success');
}

function showLogin()    { document.getElementById('loginForm').style.display='block'; document.getElementById('registerForm').style.display='none'; }
function showRegister() { document.getElementById('registerForm').style.display='block'; document.getElementById('loginForm').style.display='none'; }

// ============================================================
//  BOOT APP
// ============================================================
function bootApp() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';

  // Set user info in UI
  document.getElementById('topbarUsername').textContent = currentUser.name;
  document.getElementById('topbarAvatar').textContent   = currentUser.name[0].toUpperCase();
  document.getElementById('profileName').textContent    = currentUser.name;
  document.getElementById('profileEmail').textContent   = currentUser.email;
  document.getElementById('profileAvatar').textContent  = currentUser.name[0].toUpperCase();
  document.getElementById('updateName').value           = currentUser.name;
  document.getElementById('updateEmail').value          = currentUser.email;
  document.getElementById('profileJoined').textContent  = new Date().toLocaleDateString();

  fetchDocuments();
  fetchReminders();
  showPage('dashboard');
}

// ============================================================
//  NAVIGATION
// ============================================================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  const navItem = document.querySelector(`.nav-item[onclick*="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'dashboard')  refreshDashboard();
  if (page === 'documents')  renderDocumentsPage();
  if (page === 'reminders')  renderRemindersPage();
  if (page === 'profile')    refreshProfile();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ============================================================
//  THEME
// ============================================================
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
}

// ============================================================
//  FETCH DOCUMENTS
// ============================================================
async function fetchDocuments() {
  try {
    const res  = await fetch(`${API}/documents?userId=${currentUser.id}`);
    const data = await res.json();
    documents  = data.documents || [];
    refreshDashboard();
    renderDocumentsPage();
  } catch (e) {
    // Offline fallback
    documents = JSON.parse(localStorage.getItem(`sld_docs_${currentUser.id}`) || '[]');
    refreshDashboard();
    renderDocumentsPage();
  }
}

async function fetchReminders() {
  try {
    const res  = await fetch(`${API}/reminders?userId=${currentUser.id}`);
    const data = await res.json();
    reminders  = data.reminders || [];
    updateReminderBadge();
  } catch (e) {
    reminders = JSON.parse(localStorage.getItem(`sld_rem_${currentUser.id}`) || '[]');
    updateReminderBadge();
  }
}

// ============================================================
//  DASHBOARD REFRESH
// ============================================================
function refreshDashboard() {
  document.getElementById('statDocs').textContent      = documents.length;
  const active  = reminders.filter(r => r.status !== 'done');
  const done    = reminders.filter(r => r.status === 'done');
  const now     = new Date();
  const dueSoon = reminders.filter(r => {
    if (r.status === 'done') return false;
    const d = new Date(r.reminderDate);
    return (d - now) < 3 * 24 * 60 * 60 * 1000 && d >= now;
  });
  document.getElementById('statReminders').textContent = active.length;
  document.getElementById('statDue').textContent       = dueSoon.length;
  document.getElementById('statDone').textContent      = done.length;

  renderCategoryGrid();
  renderRecentDocs();
  renderDashReminders();
}

function renderCategoryGrid() {
  const cats = {
    'Bill': { icon: '💡' }, 'Medical': { icon: '🏥' },
    'Insurance': { icon: '🛡️' }, 'Certificate': { icon: '🎓' },
    'Government ID': { icon: '🪪' }, 'Other': { icon: '📁' }
  };
  const counts = {};
  for (const c in cats) counts[c] = 0;
  documents.forEach(d => { if (counts[d.category] !== undefined) counts[d.category]++; else counts['Other']++; });

  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = Object.entries(cats).map(([cat, meta]) => `
    <div class="cat-card" onclick="filterToCategory('${cat}')">
      <div class="cat-icon">${meta.icon}</div>
      <div class="cat-count">${counts[cat]}</div>
      <div class="cat-label">${cat}</div>
    </div>
  `).join('');
}

function renderRecentDocs() {
  const sorted = [...documents].sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)).slice(0, 5);
  const list   = document.getElementById('recentDocsList');
  list.innerHTML = sorted.length ? sorted.map(doc => `
    <div class="doc-item" onclick="openDocDetail('${doc.id}')">
      <div class="doc-item-icon">${getCategoryIcon(doc.category)}</div>
      <div class="doc-item-info">
        <div class="doc-item-title">${doc.title}</div>
        <div class="doc-item-sub">${formatDate(doc.uploadDate)}</div>
      </div>
      <span class="doc-item-badge badge-${doc.category}">${doc.category}</span>
    </div>
  `).join('') : '<p style="color:var(--text2);font-size:0.9rem">No documents yet.</p>';
}

function renderDashReminders() {
  const upcoming = reminders.filter(r => r.status !== 'done')
    .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate)).slice(0, 5);
  const list = document.getElementById('dashReminderList');
  list.innerHTML = upcoming.length ? upcoming.map(r => buildReminderHTML(r)).join('') :
    '<p style="color:var(--text2);font-size:0.9rem">No upcoming reminders.</p>';
}

// ============================================================
//  DOCUMENTS PAGE
// ============================================================
function renderDocumentsPage() {
  const grid   = document.getElementById('docsGrid');
  const noMsg  = document.getElementById('noDocsMsg');
  let filtered = applyDocFilters();

  if (!filtered.length) { grid.innerHTML = ''; noMsg.style.display = 'flex'; return; }
  noMsg.style.display = 'none';

  grid.innerHTML = filtered.map(doc => `
    <div class="doc-card" onclick="openDocDetail('${doc.id}')">
      <div class="doc-card-icon">${getCategoryIcon(doc.category)}</div>
      <div class="doc-card-title">${doc.title}</div>
      <div class="doc-card-date">${formatDate(doc.uploadDate)}</div>
      <div class="doc-card-footer">
        <span class="doc-item-badge badge-${doc.category}">${doc.category}</span>
        <span style="font-size:0.8rem;color:var(--text2)">${doc.fileType || 'DOC'}</span>
      </div>
    </div>
  `).join('');
}

function applyDocFilters() {
  const search   = document.getElementById('docSearch')?.value.toLowerCase() || '';
  const category = document.getElementById('docFilter')?.value || 'all';
  const sort     = document.getElementById('docSort')?.value || 'newest';

  let filtered = documents.filter(d => {
    const matchSearch   = d.title.toLowerCase().includes(search) || (d.extractedText || '').toLowerCase().includes(search);
    const matchCategory = category === 'all' || d.category === category;
    return matchSearch && matchCategory;
  });

  if (sort === 'newest') filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
  else if (sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title));

  return filtered;
}

function filterDocuments() { renderDocumentsPage(); }
function filterToCategory(cat) {
  showPage('documents');
  document.getElementById('docFilter').value = cat;
  filterDocuments();
}
function searchDocuments() {
  const q = document.getElementById('globalSearch').value;
  document.getElementById('docSearch').value = q;
  showPage('documents');
  filterDocuments();
}

// ============================================================
//  DOCUMENT DETAIL
// ============================================================
function openDocDetail(id) {
  currentDocId = id;
  const doc = documents.find(d => d.id === id);
  if (!doc) return;

  document.getElementById('detailTitle').textContent = doc.title;
  document.getElementById('page-detail').classList.add('active');
  document.querySelectorAll('.page').forEach(p => { if (p.id !== 'page-detail') p.classList.remove('active'); });

  // Preview
  const prev = document.getElementById('detailPreview');
  if (doc.fileType === 'image' && doc.fileData) {
    prev.innerHTML = `<img src="${doc.fileData}" alt="Preview"/>`;
  } else {
    prev.innerHTML = getCategoryIcon(doc.category);
    prev.style.fontSize = '3.5rem';
  }

  // Meta
  document.getElementById('detailMeta').innerHTML = `
    <div class="meta-row"><span class="meta-key">Category</span><span class="meta-val"><span class="doc-item-badge badge-${doc.category}">${doc.category}</span></span></div>
    <div class="meta-row"><span class="meta-key">File Type</span><span class="meta-val">${doc.fileType || '-'}</span></div>
    <div class="meta-row"><span class="meta-key">Uploaded</span><span class="meta-val">${formatDate(doc.uploadDate)}</span></div>
  `;

  // Fields
  const fields = doc.extractedFields || {};
  const fd     = document.getElementById('detailFields');
  fd.innerHTML = Object.keys(fields).length ? Object.entries(fields).map(([k, v]) =>
    `<div class="field-badge"><span class="field-key">${k}</span><span class="field-val">${v}</span></div>`
  ).join('') : '<p style="color:var(--text2);font-size:0.88rem">No fields extracted.</p>';

  // OCR
  document.getElementById('detailOCR').textContent = doc.extractedText || 'No text extracted.';

  // Related reminders
  const rel = reminders.filter(r => r.documentId === id);
  document.getElementById('detailReminders').innerHTML = rel.length ?
    rel.map(r => buildReminderHTML(r)).join('') :
    '<p style="color:var(--text2);font-size:0.88rem">No reminders linked.</p>';
}

async function deleteCurrentDoc() {
  if (!currentDocId) return;
  if (!confirm('Delete this document?')) return;
  try {
    await fetch(`${API}/documents/${currentDocId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
  } catch (e) { /* offline */ }
  documents = documents.filter(d => d.id !== currentDocId);
  saveDocsLocal();
  currentDocId = null;
  showToast('Document deleted.', 'success');
  showPage('documents');
}

// ============================================================
//  UPLOAD DOCUMENT
// ============================================================
let selectedFile = null;

function handleFileSelect(e) {
  selectedFile = e.target.files[0];
  showFilePreview(selectedFile);
}

function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) { selectedFile = file; showFilePreview(file); }
}

function showFilePreview(file) {
  const area = document.getElementById('filePreviewArea');
  document.getElementById('previewFileName').textContent = file.name;
  document.getElementById('previewFileSize').textContent = formatFileSize(file.size);
  const icon = document.getElementById('previewIcon');
  if (file.type.includes('pdf')) icon.className = 'fa-solid fa-file-pdf';
  else if (file.type.includes('image')) icon.className = 'fa-solid fa-file-image';
  else icon.className = 'fa-solid fa-file';
  document.getElementById('docTitle').value = file.name.replace(/\.[^/.]+$/, '');
  area.style.display = 'block';
  document.getElementById('ocrResult').style.display = 'none';
}

function removeFile() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('filePreviewArea').style.display = 'none';
  document.getElementById('ocrResult').style.display = 'none';
}

async function uploadDocument() {
  if (!selectedFile) { showToast('Please select a file first.', 'error'); return; }
  const title    = document.getElementById('docTitle').value.trim() || selectedFile.name;
  const category = document.getElementById('docCategory').value;

  // Show progress
  const pw = document.getElementById('progressWrap');
  const pb = document.getElementById('progressBar');
  const pt = document.getElementById('progressText');
  pw.style.display = 'block';
  animateProgress(pb, pt);

  // Read file as base64
  const fileData = await readFileAsBase64(selectedFile);
  const fileType = selectedFile.type.includes('pdf') ? 'pdf' : 'image';

  // Try backend first
  let savedDoc = null;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title);
    formData.append('category', category);
    formData.append('userId', currentUser.id);

    const res  = await fetch(`${API}/documents/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) savedDoc = data.document;
  } catch (e) { /* offline fallback */ }

  // Offline: do OCR simulation locally
  if (!savedDoc) {
    const detectedCategory = category === 'auto' ? classifyLocally(title) : category;
    const fakeOCR = generateFakeOCR(detectedCategory, title);
    const fields  = extractFieldsLocally(fakeOCR, detectedCategory);
    savedDoc = {
      id: 'doc_' + Date.now(),
      userId: currentUser.id,
      title,
      fileType,
      fileData: fileType === 'image' ? fileData : null,
      category: detectedCategory,
      extractedText: fakeOCR,
      extractedFields: fields,
      uploadDate: new Date().toISOString()
    };
    // Auto-create reminders
    createAutoReminders(savedDoc);
  }

  documents.unshift(savedDoc);
  saveDocsLocal();
  pb.style.width = '100%';
  pt.textContent = 'Done!';
  setTimeout(() => { pw.style.display = 'none'; pb.style.width = '0%'; }, 800);

  // Show OCR result
  showOCRResult(savedDoc);
  refreshDashboard();
  showToast('Document uploaded & processed!', 'success');
}

function animateProgress(bar, text) {
  let pct = 0;
  const steps = ['Reading file...', 'Running OCR...', 'Extracting fields...', 'Classifying...', 'Saving...'];
  let step = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 18 + 5;
    if (pct >= 90) { pct = 90; clearInterval(iv); }
    bar.style.width = pct + '%';
    if (step < steps.length) { text.textContent = steps[step++]; }
  }, 300);
}

function showOCRResult(doc) {
  const res = document.getElementById('ocrResult');
  res.style.display = 'block';

  const fields = doc.extractedFields || {};
  document.getElementById('extractedFields').innerHTML = Object.entries(fields).map(([k, v]) =>
    `<div class="field-badge"><span class="field-key">${k}</span><span class="field-val">${v}</span></div>`
  ).join('') || '<p style="color:var(--text2)">No specific fields extracted.</p>';

  document.getElementById('ocrTextContent').textContent = doc.extractedText || 'No text extracted.';
}

// ============================================================
//  LOCAL OCR SIMULATION (when backend offline)
// ============================================================
function classifyLocally(title) {
  const t = title.toLowerCase();
  if (/bill|electricity|water|gas|phone|internet|utility/.test(t)) return 'Bill';
  if (/prescription|medicine|medical|hospital|doctor|health|report/.test(t)) return 'Medical';
  if (/insurance|policy|premium|renewal|coverage/.test(t)) return 'Insurance';
  if (/certificate|degree|diploma|marksheet|admit/.test(t)) return 'Certificate';
  if (/aadhaar|pan|passport|voter|license|id/.test(t)) return 'Government ID';
  return 'Other';
}

function generateFakeOCR(category, title) {
  const today = new Date();
  const due   = new Date(today.getTime() + 15 * 86400000);
  const texts = {
    'Bill': `ELECTRICITY BILL\nAccount No: 987654321\nCustomer Name: ${currentUser.name}\nBilling Period: ${formatDate(today)}\nUnits Consumed: 320 kWh\nAmount Due: ₹2,450\nDue Date: ${formatDate(due)}\nPlease pay before due date to avoid late fees.`,
    'Medical': `PRESCRIPTION\nPatient: ${currentUser.name}\nDate: ${formatDate(today)}\nDr. Rajesh Kumar\nMBBS, MD\nCity Hospital\n\nMedicine 1: Paracetamol 500mg - 1 tablet twice daily\nMedicine 2: Azithromycin 250mg - 1 tablet daily for 5 days\nMedicine 3: Cetirizine 10mg - 1 tablet at night\n\nNext Visit: ${formatDate(due)}`,
    'Insurance': `INSURANCE POLICY DOCUMENT\nPolicy Number: INS-2025-78432\nInsured: ${currentUser.name}\nPremium Amount: ₹18,500/year\nPolicy Start: ${formatDate(today)}\nRenewal Date: ${formatDate(new Date(today.getTime() + 365*86400000))}\nCoverage: Health - ₹5,00,000\nContact: 1800-XXX-XXXX`,
    'Certificate': `CERTIFICATE OF COMPLETION\nThis is to certify that\n${currentUser.name}\nhas successfully completed\nAdvanced Web Development Course\nIssue Date: ${formatDate(today)}\nExpiry Date: ${formatDate(new Date(today.getTime() + 180*86400000))}\nCertificate No: CERT-2025-0042`,
    'Government ID': `GOVERNMENT OF INDIA\nDocument: Aadhaar Card\nName: ${currentUser.name}\nDate of Issue: ${formatDate(today)}\nValid Until: Lifetime\nDocument Number: XXXX XXXX XXXX`,
    'Other': `DOCUMENT\nTitle: ${title}\nDate: ${formatDate(today)}\nIssued to: ${currentUser.name}\nReference: REF-${Date.now()}`
  };
  return texts[category] || texts['Other'];
}

function extractFieldsLocally(text, category) {
  const fields = {};
  const today  = new Date();

  // Generic date extraction using regex
  const dateMatch = text.match(/Due Date[:\s]+([^\n]+)/i);
  if (dateMatch) fields['Due Date'] = dateMatch[1].trim();

  const amtMatch = text.match(/Amount[:\s]+([^\n]+)/i) || text.match(/Premium[:\s]+([^\n]+)/i);
  if (amtMatch) fields['Amount'] = amtMatch[1].trim();

  const numMatch = text.match(/(?:Policy|Account|Certificate|Document)\s*(?:No|Number)[:\s]+([^\n]+)/i);
  if (numMatch) fields['Reference No'] = numMatch[1].trim();

  if (category === 'Medical') {
    const medMatch = text.match(/Medicine 1[:\s]+([^\n]+)/i);
    if (medMatch) fields['Primary Medicine'] = medMatch[1].trim();
    const nextMatch = text.match(/Next Visit[:\s]+([^\n]+)/i);
    if (nextMatch) fields['Next Visit'] = nextMatch[1].trim();
    const docMatch  = text.match(/Dr\.\s*([^\n]+)/i);
    if (docMatch) fields['Doctor'] = docMatch[1].trim();
  }
  if (category === 'Insurance') {
    const renewMatch = text.match(/Renewal Date[:\s]+([^\n]+)/i);
    if (renewMatch) fields['Renewal Date'] = renewMatch[1].trim();
  }
  if (category === 'Certificate') {
    const expMatch = text.match(/Expiry Date[:\s]+([^\n]+)/i);
    if (expMatch) fields['Expiry Date'] = expMatch[1].trim();
  }

  fields['Category'] = category;
  fields['Processed'] = formatDate(today);
  return fields;
}

function createAutoReminders(doc) {
  const fields = doc.extractedFields || {};
  const dateFields = ['Due Date', 'Renewal Date', 'Expiry Date', 'Next Visit'];
  dateFields.forEach(key => {
    if (fields[key]) {
      // Try to parse date
      const parsed = tryParseDate(fields[key]);
      if (parsed) {
        const reminder = {
          id: 'rem_' + Date.now() + Math.random(),
          userId: currentUser.id,
          documentId: doc.id,
          title: `${key}: ${doc.title}`,
          reminderDate: parsed.toISOString(),
          status: 'pending',
          type: doc.category.toLowerCase()
        };
        reminders.unshift(reminder);
      }
    }
  });
  saveRemindersLocal();
  updateReminderBadge();
}

function tryParseDate(str) {
  // Try to parse common date formats
  const d = new Date(str);
  if (!isNaN(d)) return d;
  // DD/MM/YYYY
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  return null;
}

// ============================================================
//  REMINDERS PAGE
// ============================================================
function renderRemindersPage() {
  const list   = document.getElementById('reminderFullList');
  const active = document.querySelector('.tab.active');
  const filter = active ? active.getAttribute('data-filter') || 'all' : 'all';
  renderFilteredReminders(filter);
  updateReminderBadge();
}

function filterReminders(type, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.setAttribute('data-filter', type);
  renderFilteredReminders(type);
}

function renderFilteredReminders(type) {
  let filtered = reminders;
  if (type === 'pending') filtered = reminders.filter(r => r.status !== 'done');
  if (type === 'done')    filtered = reminders.filter(r => r.status === 'done');
  filtered = filtered.sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));

  const list = document.getElementById('reminderFullList');
  list.innerHTML = filtered.length ? filtered.map(r => buildReminderHTML(r)).join('') :
    '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No reminders here.</p></div>';
}

function buildReminderHTML(r) {
  const now     = new Date();
  const rd      = new Date(r.reminderDate);
  const overdue = r.status !== 'done' && rd < now;
  return `
    <div class="reminder-item ${r.status === 'done' ? 'done' : ''} ${overdue ? 'overdue' : ''}">
      <div class="reminder-dot dot-${r.type || 'general'}"></div>
      <div class="reminder-info">
        <div class="reminder-title">${r.title}${overdue ? ' <span style="color:#ff5050;font-size:0.75rem">● Overdue</span>' : ''}</div>
        <div class="reminder-date">${formatDateTime(r.reminderDate)}</div>
      </div>
      <div class="reminder-actions">
        ${r.status !== 'done' ? `<button class="r-btn done-btn" onclick="markReminderDone('${r.id}')"><i class="fa-solid fa-check"></i></button>` : ''}
        <button class="r-btn" onclick="openEditReminder('${r.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="r-btn delete-btn" onclick="deleteReminder('${r.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
}

function openAddReminder() {
  document.getElementById('reminderModalTitle').textContent = 'Add Reminder';
  document.getElementById('reminderTitle').value  = '';
  document.getElementById('reminderDate').value   = '';
  document.getElementById('reminderType').value   = 'general';
  document.getElementById('reminderEditId').value = '';
  document.getElementById('reminderDocId').value  = '';
  document.getElementById('reminderModal').classList.add('open');
}
function openAddReminderFromDoc() {
  openAddReminder();
  document.getElementById('reminderDocId').value = currentDocId || '';
}
function openEditReminder(id) {
  const r = reminders.find(r => r.id === id);
  if (!r) return;
  document.getElementById('reminderModalTitle').textContent = 'Edit Reminder';
  document.getElementById('reminderTitle').value  = r.title;
  document.getElementById('reminderDate').value   = r.reminderDate ? r.reminderDate.slice(0,16) : '';
  document.getElementById('reminderType').value   = r.type || 'general';
  document.getElementById('reminderEditId').value = r.id;
  document.getElementById('reminderDocId').value  = r.documentId || '';
  document.getElementById('reminderModal').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function saveReminder() {
  const title  = document.getElementById('reminderTitle').value.trim();
  const date   = document.getElementById('reminderDate').value;
  const type   = document.getElementById('reminderType').value;
  const editId = document.getElementById('reminderEditId').value;
  const docId  = document.getElementById('reminderDocId').value;

  if (!title || !date) { showToast('Please fill title and date.', 'error'); return; }

  if (editId) {
    // Edit
    const idx = reminders.findIndex(r => r.id === editId);
    if (idx !== -1) {
      reminders[idx] = { ...reminders[idx], title, reminderDate: new Date(date).toISOString(), type };
    }
    try {
      await fetch(`${API}/reminders/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, reminderDate: date, type, userId: currentUser.id })
      });
    } catch (e) { /* offline */ }
    showToast('Reminder updated!', 'success');
  } else {
    // Add
    const r = {
      id: 'rem_' + Date.now(),
      userId: currentUser.id,
      documentId: docId || null,
      title, type, status: 'pending',
      reminderDate: new Date(date).toISOString()
    };
    reminders.unshift(r);
    try {
      await fetch(`${API}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r })
      });
    } catch (e) { /* offline */ }
    showToast('Reminder added!', 'success');
  }
  saveRemindersLocal();
  updateReminderBadge();
  closeModal('reminderModal');
  renderRemindersPage();
  refreshDashboard();
}

async function markReminderDone(id) {
  const idx = reminders.findIndex(r => r.id === id);
  if (idx !== -1) reminders[idx].status = 'done';
  try {
    await fetch(`${API}/reminders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', userId: currentUser.id })
    });
  } catch (e) { /* offline */ }
  saveRemindersLocal();
  updateReminderBadge();
  renderRemindersPage();
  renderDashReminders();
  showToast('Reminder marked as done!', 'success');
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  reminders = reminders.filter(r => r.id !== id);
  try {
    await fetch(`${API}/reminders/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
  } catch (e) { /* offline */ }
  saveRemindersLocal();
  updateReminderBadge();
  renderRemindersPage();
  refreshDashboard();
  showToast('Reminder deleted.', 'success');
}

function updateReminderBadge() {
  const count  = reminders.filter(r => r.status !== 'done').length;
  const badge  = document.getElementById('reminderBadge');
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

// ============================================================
//  PROFILE
// ============================================================
function refreshProfile() {
  document.getElementById('pDocs').textContent      = documents.length;
  document.getElementById('pReminders').textContent = reminders.filter(r => r.status !== 'done').length;
  document.getElementById('pDone').textContent      = reminders.filter(r => r.status === 'done').length;
}

async function updateProfile() {
  const name = document.getElementById('updateName').value.trim();
  if (!name) { showToast('Name cannot be empty.', 'error'); return; }
  currentUser.name = name;
  localStorage.setItem('sld_user', JSON.stringify(currentUser));
  document.getElementById('topbarUsername').textContent = name;
  document.getElementById('topbarAvatar').textContent   = name[0].toUpperCase();
  document.getElementById('profileName').textContent    = name;
  document.getElementById('profileAvatar').textContent  = name[0].toUpperCase();
  try {
    await fetch(`${API}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, name })
    });
  } catch (e) { /* offline */ }
  showToast('Profile updated!', 'success');
}

// ============================================================
//  LOCAL STORAGE HELPERS
// ============================================================
function saveDocsLocal() {
  localStorage.setItem(`sld_docs_${currentUser.id}`, JSON.stringify(documents));
}
function saveRemindersLocal() {
  localStorage.setItem(`sld_rem_${currentUser.id}`, JSON.stringify(reminders));
}

// ============================================================
//  UTILITIES
// ============================================================
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
function getCategoryIcon(cat) {
  const icons = { 'Bill':'💡', 'Medical':'🏥', 'Insurance':'🛡️', 'Certificate':'🎓', 'Government ID':'🪪', 'Other':'📁' };
  return icons[cat] || '📄';
}
function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
