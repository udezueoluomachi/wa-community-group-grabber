// --- PHONE NUMBER PARSER ---
// Robust regex for international phone numbers (Nigerian +234, international, etc.)
const PHONE_REGEX = /\+?\d{1,4}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,4}[\s\-.]?\d{0,9}/g;

function extractPhones(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX);
  if (!matches) return [];
  // Filter: must have at least 10 digits total
  return matches.filter(m => m.replace(/\D/g, '').length >= 10);
}

function normalizePhone(phone) {
  // Remove all non-digits except leading +
  return phone.replace(/[^\d+]/g, '');
}

function generateWaLink(phone) {
  const normalized = normalizePhone(phone);
  // Remove leading + for wa.me format
  const digits = normalized.replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

function cleanName(text, phoneToRemove) {
  if (!text) return '';
  let name = text;
  // Remove the phone number from name if present
  if (phoneToRemove) {
    name = name.replace(phoneToRemove, '');
  }
  // Remove "~" prefix
  name = name.replace(/^~\s*/, '');
  // Remove "Loading About…" and similar
  name = name.replace(/Loading About…/gi, '');
  name = name.replace(/\n/g, ' ');
  // Clean up multiple spaces
  name = name.replace(/\s+/g, ' ').trim();
  // If name is just phone number pattern, return empty
  if (/^\+?\d[\d\s\-+.]+$/.test(name)) return '';
  return name;
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
let rawScrapedData = []; // Raw data collected during scraping
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
  rawScrapedData = [];
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
  
  // Process and count unique phones
  const processed = processAllData();
  countSpan.innerText = processed.length;
  
  if (processed.length > 0) {
    actionButtons.style.display = 'flex';
  }
}

function parseVisibleItems(container) {
  const nodes = container.querySelectorAll('div[role="listitem"], div[role="button"], span, div');
  
  nodes.forEach(node => {
    // Filter noise
    if (node.children.length > 6) return; 
    const text = node.innerText;
    if (!text || text.length < 3 || text.length > 500) return;
    if (text.includes("View all") || text.includes("Group info") || text.includes("created group")) return;
    
    // Save all text that might contain useful data
    const lines = text.split('\n').filter(l => l.trim());
    const hasPhone = extractPhones(text).length > 0;
    
    // Save if looks like contact (has phone or at least 2 lines)
    if (hasPhone || lines.length >= 2) {
      rawScrapedData.push({
        raw: text,
        lines: lines
      });
      
      // Update count with unique phones found so far
      const tempProcessed = processAllData();
      countSpan.innerText = tempProcessed.length;
    }
  });
}

// --- 5. POST-PROCESSING (THE MAGIC!) ---

function processAllData() {
  const phoneMap = new Map(); // phone -> contact data
  
  for (const entry of rawScrapedData) {
    const text = entry.raw;
    const phones = extractPhones(text);
    
    if (phones.length > 0) {
      for (const phone of phones) {
        const normalized = normalizePhone(phone);
        
        // Skip if too short
        if (normalized.replace(/\D/g, '').length < 10) continue;
        
        // Get or create entry
        const existing = phoneMap.get(normalized);
        
        if (!existing) {
          // New phone number - extract all info
          const role = detectRole(text);
          const nameCandidate = findBestName(entry.lines, phone);
          const about = findAbout(entry.lines, phone, nameCandidate);
          
          phoneMap.set(normalized, {
            name: nameCandidate,
            phone: phone.trim(),
            about: about,
            role: role,
            dmLink: generateWaLink(phone)
          });
        } else {
          // Phone exists - merge/improve data
          if (!existing.name || existing.name === '') {
            const nameCandidate = findBestName(entry.lines, phone);
            if (nameCandidate) existing.name = nameCandidate;
          }
          if (detectRole(text) === 'admin') {
            existing.role = 'admin';
          }
          if (!existing.about || existing.about === '' || existing.about === 'Loading About…') {
            const about = findAbout(entry.lines, phone, existing.name);
            if (about) existing.about = about;
          }
        }
      }
    }
  }
  
  // Convert to array and sort
  const result = Array.from(phoneMap.values());
  
  // Sort: admins first, then by name
  result.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (a.name || '').localeCompare(b.name || '');
  });
  
  return result;
}

function findBestName(lines, phoneToExclude) {
  for (const line of lines) {
    const cleaned = cleanName(line, phoneToExclude);
    if (cleaned && cleaned.length > 1) {
      // Skip if it's a known non-name pattern
      if (cleaned.toLowerCase() === 'group admin') continue;
      if (cleaned.toLowerCase().includes('loading')) continue;
      return cleaned;
    }
  }
  return '';
}

function findAbout(lines, phoneToExclude, nameToExclude) {
  for (const line of lines) {
    let cleaned = cleanName(line, phoneToExclude);
    // Skip the name
    if (nameToExclude && cleaned === nameToExclude) continue;
    // Skip common noise
    if (!cleaned) continue;
    if (cleaned.toLowerCase() === 'group admin') continue;
    if (cleaned.toLowerCase().includes('loading')) continue;
    if (/^\+?\d[\d\s\-+.]+$/.test(cleaned)) continue;
    if (cleaned.length > 2) {
      return cleaned;
    }
  }
  return '';
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


// --- 6. EXPORT ---

function download(type) {
  const data = processAllData();
  let content = "";
  let filename = `wa_phones_${Date.now()}.${type}`;
  let mime = "";

  if (type === 'json') {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
  } else {
      // CSV with proper headers
      const headers = ["Name", "Phone", "About", "Role", "DM Link"];
      const rows = data.map(row => {
          const n = (row.name || "").replace(/"/g, '""');
          const p = (row.phone || "").replace(/"/g, '""');
          const a = (row.about || "").replace(/"/g, '""');
          const r = (row.role || "").replace(/"/g, '""');
          const d = (row.dmLink || "").replace(/"/g, '""');
          return `"${n}","${p}","${a}","${r}","${d}"`;
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