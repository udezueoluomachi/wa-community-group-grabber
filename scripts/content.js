let isSelecting = false;
let isScraping = false;
let hoverElement = null;
let scrollInterval = null;
let scrapedSet = new Map();

// --- Highlighter Styles ---
const styleId = "scraper-highlight-style";
if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .scraper-hover { outline: 4px solid #007bff !important; cursor: crosshair !important; background-color: rgba(0, 123, 255, 0.1) !important; }
      .scraper-active { outline: 4px solid #28a745 !important; }
    `;
    document.head.appendChild(style);
}

chrome.runtime.onMessage.addListener((req, sender, sendResp) => {
    if (req.action === 'enter_selection_mode') {
        isSelecting = true;
        document.addEventListener('mouseover', onHover);
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
        // Show a little toast
        showToast("HOVER over the list, then CLICK to start.");
    }
    if (req.action === 'stop') {
        stopScraping();
        sendResp({ count: scrapedSet.size, data: Array.from(scrapedSet.values()) });
    }
});

function onHover(e) {
    if (!isSelecting) return;
    if (hoverElement) hoverElement.classList.remove('scraper-hover');
    hoverElement = e.target;
    hoverElement.classList.add('scraper-hover');
}

function onClick(e) {
    if (!isSelecting) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Lock selection
    isSelecting = false;
    document.removeEventListener('mouseover', onHover);
    document.removeEventListener('click', onClick);
    if (hoverElement) hoverElement.classList.remove('scraper-hover');
    
    const target = e.target;
    target.classList.add('scraper-active');
    
    showToast("Scraping started... Please wait.");
    startScraping(target);
}

function onKey(e) {
    if (e.key === "Escape" && isSelecting) {
        isSelecting = false;
        if (hoverElement) hoverElement.classList.remove('scraper-hover');
        document.removeEventListener('mouseover', onHover);
        document.removeEventListener('click', onClick);
        showToast("Selection cancelled.");
    }
}

function startScraping(element) {
    isScraping = true;
    scrapedSet.clear();
    
    // Find the scrollable container. 
    // Often the user clicks the LIST item, not the container.
    // We walk up 5 levels to find the one with scrollbar.
    let container = element;
    let foundScroll = false;
    
    for (let i = 0; i < 5; i++) {
        const style = window.getComputedStyle(container);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && container.scrollHeight > container.clientHeight) {
            foundScroll = true;
            break;
        }
        if (container.parentElement) container = container.parentElement;
    }
    
    if (!foundScroll) {
        // Fallback: Use the element clicked if we can't find a better parent
        console.warn("Could not find exact scroll parent, using clicked element.");
        container = element;
    }

    console.log("Scraping Container:", container);

    let lastScrollTop = -1;
    let stuckCount = 0;

    scrollInterval = setInterval(() => {
        if (!isScraping) return;

        // 1. Extract Data from children
        // We grab any block-level element with text.
        const nodes = container.querySelectorAll('div, span, li');
        
        nodes.forEach(node => {
            // Must have some text
            if (!node.innerText || node.children.length > 5) return; // ignore massive containers
            
            const text = node.innerText.trim();
            const lines = text.split('\n').filter(t => t.trim().length > 0);
            
            // Filter junk
            if (lines.length === 0) return;
            if (text.length > 200) return; // Too long to be a contact card
            if (text.includes("View all") || text.includes("Group info")) return;

            // Simple classifier
            // If it looks like a phone number or has 2 distinct lines (Name / About)
            const hasPhone = /\+?\d[\d\s-]{7,}/.test(text);
            
            if ((lines.length >= 2 || hasPhone) && !scrapedSet.has(text)) {
                 scrapedSet.set(text, {
                     raw: text.replace(/\n/g, ' | '),
                     name: lines[0],
                     info: lines.slice(1).join(' | ')
                 });
            }
        });

        // Update popup
        chrome.runtime.sendMessage({ 
            action: 'update', 
            count: scrapedSet.size, 
            data: Array.from(scrapedSet.values()) 
        });

        // 2. Scroll
        container.scrollTop += 300;

        // 3. End check
        if (Math.abs(container.scrollTop - lastScrollTop) < 2) {
            stuckCount++;
            if (stuckCount > 6) { // 3 seconds stuck
                stopScraping();
                chrome.runtime.sendMessage({ 
                    action: 'finished', 
                    count: scrapedSet.size, 
                    data: Array.from(scrapedSet.values()) 
                });
                container.classList.remove('scraper-active');
                showToast("Finished! Check extension popup.");
            }
        } else {
            lastScrollTop = container.scrollTop;
            stuckCount = 0;
        }

    }, 500);
}

function stopScraping() {
    isScraping = false;
    if (scrollInterval) clearInterval(scrollInterval);
}

function showToast(msg) {
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.cssText = `
        position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
        border-radius: 5px; z-index: 999999; font-family: sans-serif; font-weight: bold;
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}