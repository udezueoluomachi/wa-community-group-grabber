// --- 1. UI INJECTION ---
const panelHTML = `
  <div id="wa-scraper-header">
    <div style="display:flex; align-items:center; gap:8px;">
      <img src="${chrome.runtime.getURL('logo.png')}" style="width:20px; height:20px; border-radius:50%;">
      <span>Group Scraper</span>
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
      Found: <span id="scraper-count">0</span> members
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
let scrapedData = new Map(); 
let scrollInterval = null;
let hoverEl = null;
let containerEl = null;

// --- 2. EVENT LISTENERS ---

// Toggle Panel
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
  
  // Clean UI
  actionButtons.style.display = 'none';
  scrapedData.clear();
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
  
  // Find Scroll Parent
  containerEl = findScrollParent(target);
  if (!containerEl) {
    // Try one more time, maybe the user clicked the text inside the list item
    // Walk up until we find a large container
    let p = target.parentElement;
    while(p && p !== document.body && p.scrollHeight <= p.clientHeight) {
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

    // Parse
    parseVisibleItems(containerEl);

    // Scroll
    containerEl.scrollTop += 400;

    // End Detection
    if (Math.abs(containerEl.scrollTop - lastScrollTop) < 2) {
      sameHeightCount++;
      if (sameHeightCount > 5) { // 3 seconds at bottom
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
  
  if (scrapedData.size > 0) {
    actionButtons.style.display = 'flex';
  }
}

function parseVisibleItems(container) {
  const nodes = container.querySelectorAll('div[role="listitem"], div[role="button"], span, div');
  
  nodes.forEach(node => {
    // Filter noise
    if (node.children.length > 6) return; 
    const text = node.innerText;
    if (!text || text.length < 3 || text.length > 300) return;
    if (text.includes("View all") || text.includes("Group info") || text.includes("created group")) return;
    
    const lines = text.split('\n').filter(l => l.trim());
    const hasPhone = /\+?\d[\d\s-]{7,}/.test(text);
    
    // Save if looks like contact
    if (hasPhone || lines.length >= 2) {
      if (!scrapedData.has(text)) {
        scrapedData.set(text, {
          raw: text,
          name: lines[0],
          info: lines.slice(1).join(" ")
        });
        countSpan.innerText = scrapedData.size;
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
  const data = Array.from(scrapedData.values());
  let content = "";
  let filename = `wa_members_${Date.now()}.${type}`;
  let mime = "";

  if (type === 'json') {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
  } else {
      const headers = ["Name", "Info/Phone", "Raw Data"];
      const rows = data.map(row => {
          const n = (row.name || "").replace(/"/g, '""');
          const i = (row.info || "").replace(/"/g, '""');
          const r = (row.raw || "").replace(/"/g, '""').replace(/\n/g, " ");
          return `"${n}","${i}","${r}"`;
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
}