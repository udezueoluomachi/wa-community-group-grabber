document.addEventListener('DOMContentLoaded', () => {
  const btnSelect = document.getElementById('btn-select');
  const btnStop = document.getElementById('btn-stop');
  const btnCsv = document.getElementById('btn-csv');
  const btnJson = document.getElementById('btn-json');
  const statusText = document.getElementById('status-text');
  const countSpan = document.getElementById('count');

  let scrapedData = [];

  btnSelect.addEventListener('click', () => {
    window.close(); // Close popup so user can click on the page
    sendMessage({ action: 'enter_selection_mode' });
  });

  btnStop.addEventListener('click', () => {
    sendMessage({ action: 'stop' }, handleStop);
  });

  btnCsv.addEventListener('click', () => download(scrapedData, 'csv'));
  btnJson.addEventListener('click', () => download(scrapedData, 'json'));

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'update') {
      statusText.innerText = "Scraping...";
      countSpan.innerText = req.count;
      scrapedData = req.data;
      btnSelect.style.display = 'none';
      btnStop.style.display = 'block';
    }
    if (req.action === 'finished') {
      handleStop({ data: req.data, count: req.count });
    }
  });

  function handleStop(response) {
    statusText.innerText = "Done";
    countSpan.innerText = response.count || 0;
    scrapedData = response.data || [];
    
    btnSelect.style.display = 'block';
    btnStop.style.display = 'none';
    
    if (scrapedData.length > 0) {
        btnCsv.style.display = 'block';
        btnJson.style.display = 'block';
    }
  }

  function sendMessage(msg, cb) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, msg, cb);
    });
  }

  function download(data, type) {
    let content = "";
    let filename = "members." + type;
    
    if (type === 'json') {
        content = JSON.stringify(data, null, 2);
        content = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);
    } else {
        const headers = ["Raw Text", "Likely Name", "Likely Info/Phone"];
        const csvContent = data.map(row => {
            return `"${(row.raw||"").replace(/"/g, '""')}", "${(row.name||"").replace(/"/g, '""')}", "${(row.info||"").replace(/"/g, '""')}"`;
        }).join("\n");
        content = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers.join(",") + "\n" + csvContent);
    }
    
    const link = document.createElement("a");
    link.setAttribute("href", content);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
  }
});
