// --- PHONE NUMBER PARSER ---
// Robust regex for international phone numbers
const PHONE_REGEX = /\+?\d{1,4}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,4}[\s\-.]?\d{0,9}/g;

function extractPhones(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX);
  if (!matches) return [];
  // Filter: must have at least 10 digits total
  return matches.filter(m => m.replace(/\D/g, '').length >= 10);
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, '');
}

function generateWaLink(phone) {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

function detectRole(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('group admin') || lower.includes('admin')) return 'admin';
  return 'member';
}

// --- 1. UI INJECTION ---
const panelHTML = `
  <div id="wa-scraper-header">
    <div style="display:flex; align-items:center; gap:8px;">
      <img src="${chrome.runtime.getURL('logo.png')}" style="width:20px; height:20px; border-radius:50%;">
      <span>Phone Grabber</span>
    </div>
    <span id="wa-scraper-close">&times;</span>
  </div>
  <div id="wa-scraper-body">
    <button id="btn-select" class="scraper-btn">Select List</button>
    <button id="btn-stop" class="scraper-btn">Stop & Save</button>
    
    <div id="action-buttons" style="display:none; gap:5px;">
        <button id="btn-download-csv" class="scraper-btn" style="background-color:#28a745;">Download CSV</button>
        <button id="btn-download-json" class="scraper-btn" style="background-color:#17a2b8;">Download JSON</button>
    </div>

    <div class="scraper-stat">
      Found: <span id="scraper-count">0</span> phone numbers
    </div>
    <div id="scraper-status" style="font-size:11px; text-align:center; color:#888; margin-top:5px;">
      Ready
    </div>
  </div>
`;

// Create Panel
const panel = document.createElement('div');
panel.id = 'wa-scraper-panel';
panel.innerHTML = panelHTML;
document.body.appendChild(panel);

// UI References
const btnSelect = document.getElementById('btn-select');
const btnStop = document.getElementById('btn-stop');
const actionButtons = document.getElementById('action-buttons');
const btnCsv = document.getElementById('btn-download-csv');
const btnJson = document.getElementById('btn-download-json');
const countSpan = document.getElementById('scraper-count');
const statusDiv = document.getElementById('scraper-status');
const closeBtn = document.getElementById('wa-scraper-close');

// State
let isPanelOpen = false;
let isSelecting = false;
let isScraping = false;
let phoneMap = new Map(); // normalized phone -> { phone, role, dmLink }
let scrollInterval = null;
let hoverEl = null;
let containerEl = null;

// --- 2. EVENT LISTENERS ---

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "toggle_panel") {
    isPanelOpen = !isPanelOpen;
    panel.style.display = isPanelOpen ? 'block' : 'none';
  }
});

closeBtn.addEventListener('click', () => {
  panel.style.display = 'none';
  isPanelOpen = false;
});

btnSelect.addEventListener('click', () => {
  isSelecting = true;
  statusDiv.innerText = "Hover over list & click";
  document.body.style.cursor = "crosshair";

  actionButtons.style.display = 'none';
  phoneMap.clear();
  countSpan.innerText = "0";

  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('click', onSelect, true);
});

btnStop.addEventListener('click', stopScraping);
btnCsv.addEventListener('click', () => download('csv'));
btnJson.addEventListener('click', () => download('json'));

// --- 3. SELECTION LOGIC ---

function onHover(e) {
  if (!isSelecting) return;
  e.stopPropagation();
  if (hoverEl && hoverEl !== e.target) hoverEl.classList.remove('scraper-hover');
  hoverEl = e.target;
  hoverEl.classList.add('scraper-hover');
}

function onSelect(e) {
  if (!isSelecting) return;
  e.preventDefault();
  e.stopPropagation();

  isSelecting = false;
  document.body.style.cursor = "default";
  document.removeEventListener('mouseover', onHover, true);
  document.removeEventListener('click', onSelect, true);

  if (hoverEl) hoverEl.classList.remove('scraper-hover');

  startScraping(e.target);
}

// --- 4. SCRAPING ENGINE ---

function startScraping(target) {
  isScraping = true;

  containerEl = findScrollParent(target);
  if (!containerEl) {
    let p = target.parentElement;
    while (p && p !== document.body && p.scrollHeight <= p.clientHeight) {
      p = p.parentElement;
    }
    if (p && p !== document.body) containerEl = p;
  }

  if (!containerEl) {
    statusDiv.innerText = "Error: Not scrollable. Click the list itself.";
    return;
  }

  containerEl.classList.add('scraper-target');

  btnSelect.style.display = 'none';
  btnStop.style.display = 'block';
  statusDiv.innerText = "Scraping... (Auto-scrolling)";

  let lastScrollTop = -1;
  let sameHeightCount = 0;

  scrollInterval = setInterval(() => {
    if (!isScraping) return;

    parseVisibleItems(containerEl);
    containerEl.scrollTop += 400;

    if (Math.abs(containerEl.scrollTop - lastScrollTop) < 2) {
      sameHeightCount++;
      if (sameHeightCount > 5) {
        stopScraping();
        statusDiv.innerText = "Finished! Download below.";
      }
    } else {
      lastScrollTop = containerEl.scrollTop;
      sameHeightCount = 0;
    }

  }, 600);
}

function stopScraping() {
  isScraping = false;
  clearInterval(scrollInterval);

  if (containerEl) containerEl.classList.remove('scraper-target');

  btnStop.style.display = 'none';
  btnSelect.style.display = 'block';

  countSpan.innerText = phoneMap.size;

  if (phoneMap.size > 0) {
    actionButtons.style.display = 'flex';
  }
}

function parseVisibleItems(container) {
  const nodes = container.querySelectorAll('div[role="listitem"], div[role="button"], span, div');

  nodes.forEach(node => {
    if (node.children.length > 6) return;
    const text = node.innerText;
    if (!text || text.length < 3 || text.length > 500) return;
    if (text.includes("View all") || text.includes("Group info") || text.includes("created group")) return;

    // Extract ALL phone numbers from this text block
    const phones = extractPhones(text);
    const role = detectRole(text);

    for (const phone of phones) {
      const normalized = normalizePhone(phone);

      // Add or update (upgrade to admin if detected)
      if (!phoneMap.has(normalized)) {
        phoneMap.set(normalized, {
          phone: phone.trim(),
          role: role,
          dmLink: generateWaLink(phone)
        });
        countSpan.innerText = phoneMap.size;
      } else if (role === 'admin') {
        // Upgrade to admin if we see this number with admin role
        phoneMap.get(normalized).role = 'admin';
      }
    }
  });
}

function findScrollParent(el) {
  let curr = el;
  while (curr && curr !== document.body) {
    const style = window.getComputedStyle(curr);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

// --- 5. EXPORT ---

function download(type) {
  const data = Array.from(phoneMap.values());

  // Sort: admins first
  data.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return 0;
  });

  let content = "";
  let filename = `wa_phones_${Date.now()}.${type}`;
  let mime = "";

  if (type === 'json') {
    content = JSON.stringify(data, null, 2);
    mime = "application/json";
  } else {
    const headers = ["Phone", "Role", "DM Link"];
    const rows = data.map(row => {
      const p = (row.phone || "").replace(/"/g, '""');
      const r = (row.role || "").replace(/"/g, '""');
      const d = (row.dmLink || "").replace(/"/g, '""');
      return `"${p}","${r}","${d}"`;
    });
    content = headers.join(",") + "\n" + rows.join("\n");
    mime = "text/csv";
  }

  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}