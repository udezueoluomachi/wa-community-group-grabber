# WA Community & Group Grabber 🚀

<p align="center">
  <img src="logo.png" alt="WA Group Grabber Logo" width="200">
</p>

> **The ultimate tool for scraping member data from WhatsApp Web groups and communities.**  
> *Export names, phone numbers, "About" status, and admin roles directly to CSV or JSON.*

![Version](https://img.shields.io/badge/version-2.0-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🌟 Why this tool?

Most WhatsApp scrapers are broken, require complex Python setups, or get your account flagged. **Group Grabber** is different. It runs **inside your browser** as a Chrome Extension, interacting with the page just like a human user would.

### Key Features
*   **🖱️ Point & Click:** No coding needed. Just click the list you want to scrape.
*   **🧠 Smart Detection:** Even if you click the wrong element (like a single name), the tool automatically "climbs" the code to find the full scrollable list.
*   **📜 Auto-Scroll:** It scrolls the list for you, loading all members automatically.
*   **🧹 Data Cleaning:**
    *   Removes "Loading..." and "Typing..." noise.
    *   Detects **Group Admins** and separates them.
    *   Uses Phone Numbers as unique IDs to prevent duplicates.
*   **💾 Multiple Formats:** Download as **CSV** (Excel-ready) or **JSON** (Developer-ready).
*   **🛡️ Safe:** Runs locally in your browser. No data is sent to external servers.

---

## 🛠️ Installation

This tool is not on the Chrome Web Store (to protect it from being taken down). You must install it manually in **Developer Mode**. It takes less than a minute!

### Step 1: Get the Code
Clone this repository or download the ZIP file.

```bash
git clone https://github.com/udezueoluomachi/wa-community-group-grabber.git
```
*(Or click "Code" -> "Download ZIP" on GitHub and unzip it to a folder).*

### Step 2: Open Chrome Extensions
1.  Open Google Chrome (or Edge/Brave).
2.  Type `chrome://extensions/` in the address bar and hit Enter.
3.  **Critical Step:** Toggle **Developer mode** on in the top-right corner.

### Step 3: Load the Extension
1.  Click the **"Load unpacked"** button (top-left).
2.  Select the folder where you downloaded the code (the folder containing `manifest.json`).
3.  You should now see **"WhatsApp Group Scraper (Panel)"** in your list!

---

## 🚀 How to Use

### 1. Open WhatsApp Web
Go to [web.whatsapp.com](https://web.whatsapp.com) and log in.

### 2. Open Group Info
*   Click on the specific Group or Community you want to scrape.
*   **Important:** Click the **Group Name** at the top header to open the **Group Info sidebar** on the right.
*   *(Optional)* If the list is short, click "View all" to open the full member modal.

### 3. Activate the Panel
*   Click the **Extension Icon** (🧩 puzzle piece) in your browser toolbar.
*   Click **"WhatsApp Group Scraper"**.
*   A white **Control Panel** will appear in the bottom-right corner of the page.

### 4. Select the List
*   Click the blue **"Select List"** button on the panel.
*   Move your mouse over the member list. You will see a **Blue Highlighter** following your mouse.
*   **Click anywhere on the member list.**
    *   *Note: Thanks to our "Smart Parent Detection", you don't need to be perfect. Even if you click a single user's name, the tool will auto-detect the scrollable container.*

### 5. Watch & Export
*   The border will turn **Green** and the list will start scrolling automatically.
*   Sit back and wait. The "Found" counter will increase.
*   Once it hits the bottom, the tool will stop and show "Finished!".
*   Click **Download CSV** or **Download JSON**.

---

## 📂 Output Data Structure

### JSON Example
```json
[
  {
    "phone": "+234 916 194 6231",
    "role": "admin",
    "dmLink": "https://wa.me/2349161946231"
  },
  {
    "phone": "+234 816 804 9268",
    "role": "member",
    "dmLink": "https://wa.me/2348168049268"
  }
]
```

### CSV Columns
| Column | Description |
|--------|-------------|
| **Phone** | The phone number (e.g., `+234 916 194 6231`) |
| **Role** | `admin` or `member` |
| **DM Link** | Direct message link (e.g., `https://wa.me/2349161946231`) |

### Key Features
*   🔢 **Phone numbers as unique IDs** - No duplicates!
*   📱 **wa.me links** - Click to open DM directly
*   👑 **Admin detection** - Automatically identifies group admins

---

## 🤝 Contributing

This project is built with standard web technologies (HTML/CSS/JS). We welcome contributions!

1.  Fork the repo.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

**Areas for improvement:**
*   Parsing logic for different languages (currently optimized for English/International).
*   Support for "Community" sub-group structures.

---

## ⚠️ Disclaimer

This tool is for **educational and administrative purposes only** (e.g., managing your own communities). 
*   Do not use this for spamming.
*   Respect WhatsApp's Terms of Service.
*   The developers are not responsible for any account bans or restrictions resulting from misuse.

---

**Happy Scraping!** 🕵️‍♂️
