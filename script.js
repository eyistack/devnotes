  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(registration => console.log('SW registered'))
        .catch(err => console.log('SW registration failed:', err));
    });
  }
  function generateAppleTouchIcon() {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#191919';
      ctx.fillRect(0, 0, 180, 180);
      ctx.drawImage(img, 0, 0, 180, 180);
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = canvas.toDataURL('image/png');
      document.head.appendChild(link);
    };
    img.src = 'icon.svg';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', generateAppleTouchIcon);
  } else {
    generateAppleTouchIcon();
  }


// ===== ESSENTIAL HELPERS & THEMES =====
function esc(s){
  if(s === null || s === undefined) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function timeAgo(dateStr){
  if(!dateStr) return "";
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if(sec < 60) return "just now";
  if(sec < 3600) return Math.floor(sec / 60) + "m ago";
  if(sec < 86400) return Math.floor(sec / 3600) + "h ago";
  if(sec < 2592000) return Math.floor(sec / 86400) + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

const THEMES = [
  {id: "dark", name: "Dark (Default)"},
  {id: "light", name: "Light"},
  {id: "nord", name: "Nord"},
  {id: "catppuccin", name: "Catppuccin"}
];

function selectTheme(themeId){
  const t = THEMES.find(x => x.id === themeId) || THEMES[0];
  applyTheme(t);
  localStorage.setItem("dn_theme", t.id);
}

function applyTheme(t){
  const id = typeof t === "object" ? t.id : (t || "dark");
  document.documentElement.setAttribute("data-theme", id);
  if(id === "light"){
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  const darkBtn = document.getElementById("darkBtn");
  if(darkBtn){
    darkBtn.innerHTML = I(id === "light" ? "moon" : "sun");
    darkBtn.title = id === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
  }
}

let toastTimer = null;
function showToast(msg, actionText, actionFn){
  let t = document.getElementById("appToast");
  if(!t){
    t = document.createElement("div");
    t.id = "appToast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  clearTimeout(toastTimer);
  let actionHtml = "";
  if(actionText && actionFn){
    window._toastAction = actionFn;
    actionHtml = "<button onclick=\"if(window._toastAction){window._toastAction();document.getElementById('appToast').classList.remove('show');}\">" + esc(actionText) + "</button>";
  }
  t.innerHTML = "<span>" + msg + "</span>" + actionHtml;
  t.classList.add("show");
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
  }, 3500);
}

function trashNoteWithUndo(id){
  const i = notes.findIndex(x => x.id === id);
  if(i > -1){
    const n = notes.splice(i, 1)[0];
    n.trashedAt = new Date().toISOString();
    trash.push(n);
    saveAll();
    renderSidebar();
    renderNotes();
    showToast(I("trash") + " Note moved to trash", "Undo", () => {
      const ti = trash.findIndex(x => x.id === id);
      if(ti > -1){
        const restored = trash.splice(ti, 1)[0];
        delete restored.trashedAt;
        notes.unshift(restored);
        saveAll();
        renderSidebar();
        renderNotes();
        showToast(I("check") + " Note restored");
      }
    });
  }
}

// ===== EDITOR TABS & LINE NUMBERS =====
let openTabs = [];
let activeTabId = null;
let tabContents = {};

function addTab(id, title){
  if(!id) return;
  if(!openTabs.includes(id)){
    openTabs.push(id);
  }
  activeTabId = id;
  renderTabs();
}

function renderTabs(){
  const bar = document.getElementById("tabsBar");
  if(!bar) return;
  if(!openTabs.length){
    bar.innerHTML = "";
    return;
  }
  bar.innerHTML = openTabs.map(tid => {
    const n = notes.find(x => x.id === tid);
    const title = n ? (n.title || "Untitled") : "Note";
    const isActive = tid === activeTabId || tid === editingId;
    return "<div class=\"tab-item " + (isActive ? "active" : "") + "\" onclick=\"switchTab('" + tid + "')\">" +
      "<span class=\"tab-title\">" + esc(title) + "</span>" +
      "<span class=\"tab-close\" onclick=\"closeTab(event, '" + tid + "')\">&times;</span>" +
    "</div>";
  }).join("");
}

function switchTab(id){
  if(editingId && editingId !== id){
    const curTa = document.getElementById("editorTextarea");
    if(curTa) tabContents[editingId] = curTa.value;
  }
  openEditor(id);
}

function closeTab(e, id){
  if(e) e.stopPropagation();
  const idx = openTabs.indexOf(id);
  if(idx > -1) openTabs.splice(idx, 1);
  if(activeTabId === id || editingId === id){
    if(openTabs.length){
      const nextId = openTabs[Math.max(0, idx - 1)];
      openEditor(nextId);
    } else {
      closeEditor();
    }
  } else {
    renderTabs();
  }
}

function isLineNumbersEnabled(){
  return localStorage.getItem("dn_line_numbers") !== "false";
}

let lineNumbersResizeObserver = null;

function setupLineNumbers(){
  const ta = document.getElementById("editorTextarea");
  let lineBox = document.getElementById("lineNumbers");
  
  if(!isLineNumbersEnabled()){
    if(lineBox) lineBox.remove();
    return;
  }
  
  const content = document.getElementById("editorContent");
  if(!content || !ta) return;
  
  if(!lineBox){
    lineBox = document.createElement("div");
    lineBox.id = "lineNumbers";
    lineBox.className = "line-numbers";
    ta.parentElement.insertBefore(lineBox, ta);
    
    // Wheel event over line numbers gutter scrolls textarea
    lineBox.addEventListener("wheel", (e) => {
      e.preventDefault();
      ta.scrollTop += e.deltaY;
    }, { passive: false });

    // Clicking line number jumps cursor to that line
    lineBox.addEventListener("click", (e) => {
      const row = e.target.closest(".ln-row");
      if(!row) return;
      const lineIdx = parseInt(row.dataset.line);
      if(isNaN(lineIdx)) return;
      const val = ta.value || "";
      const linesArr = val.split("\n");
      let charPos = 0;
      for(let j = 0; j < lineIdx && j < linesArr.length; j++){
        charPos += linesArr[j].length + 1;
      }
      ta.focus();
      ta.setSelectionRange(charPos, charPos);
    });
  }
  
  updateLineNumbers();
  ta.removeEventListener("scroll", syncLineScroll);
  ta.addEventListener("scroll", syncLineScroll);
  
  if(window.ResizeObserver && !lineNumbersResizeObserver){
    lineNumbersResizeObserver = new ResizeObserver(() => {
      if(isLineNumbersEnabled() && document.getElementById("lineNumbers")){
        updateLineNumbers();
      }
    });
    lineNumbersResizeObserver.observe(ta);
  }
}

function toggleLineNumbers(enabled){
  localStorage.setItem("dn_line_numbers", enabled ? "true" : "false");
  setupLineNumbers();
}

function syncLineScroll(){
  const ta = document.getElementById("editorTextarea");
  const lineBox = document.getElementById("lineNumbers");
  if(ta && lineBox){
    lineBox.scrollTop = ta.scrollTop;
  }
}

function updateLineNumbers(){
  const ta = document.getElementById("editorTextarea");
  const lineBox = document.getElementById("lineNumbers");
  if(!ta || !lineBox || !isLineNumbersEnabled()) return;
  
  let mirror = document.getElementById("lineMeasureMirror");
  if(!mirror){
    mirror = document.createElement("div");
    mirror.id = "lineMeasureMirror";
    mirror.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;box-sizing:border-box;overflow:hidden;";
    document.body.appendChild(mirror);
  }
  
  const taStyle = window.getComputedStyle(ta);
  const padLeft = parseFloat(taStyle.paddingLeft) || 0;
  const padRight = parseFloat(taStyle.paddingRight) || 0;
  const padTop = parseFloat(taStyle.paddingTop) || 0;
  const padBottom = parseFloat(taStyle.paddingBottom) || 0;
  
  const innerWidth = ta.clientWidth - padLeft - padRight;
  if(innerWidth <= 0) return;
  
  mirror.style.width = innerWidth + "px";
  mirror.style.fontFamily = taStyle.fontFamily;
  mirror.style.fontSize = taStyle.fontSize;
  mirror.style.fontWeight = taStyle.fontWeight;
  mirror.style.lineHeight = taStyle.lineHeight;
  mirror.style.letterSpacing = taStyle.letterSpacing;
  mirror.style.wordSpacing = taStyle.wordSpacing;
  mirror.style.tabSize = taStyle.tabSize;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";
  
  const baseLineHeight = parseFloat(taStyle.lineHeight) || (parseFloat(taStyle.fontSize) * 1.65);
  
  const val = ta.value || "";
  const lines = val.split("\n");
  
  let mirrorHtml = "";
  for(let i = 0; i < lines.length; i++){
    const raw = lines[i];
    const rowContent = raw ? esc(raw) : "&#8203;";
    mirrorHtml += `<div class="m-row" style="margin:0;padding:0;box-sizing:border-box;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;min-height:${baseLineHeight}px">${rowContent}</div>`;
  }
  mirror.innerHTML = mirrorHtml;
  
  const rows = mirror.children;
  let lineNumbersHtml = "";
  for(let i = 0; i < lines.length; i++){
    const rowHeight = rows[i] ? rows[i].getBoundingClientRect().height : baseLineHeight;
    lineNumbersHtml += `<div class="ln-row" data-line="${i}" style="height:${rowHeight}px;line-height:${baseLineHeight}px">${i + 1}</div>`;
  }
  
  const digits = String(lines.length).length;
  const gutterWidth = Math.max(46, digits * 8 + 18);
  lineBox.style.minWidth = gutterWidth + "px";
  lineBox.style.paddingTop = padTop + "px";
  lineBox.style.paddingBottom = padBottom + "px";
  lineBox.innerHTML = lineNumbersHtml;
  lineBox.scrollTop = ta.scrollTop;
}

function removeLineNumbers(){
  const lineBox = document.getElementById("lineNumbers");
  if(lineBox) lineBox.remove();
}

window.addEventListener("resize", () => {
  if(isLineNumbersEnabled() && document.getElementById("lineNumbers")){
    updateLineNumbers();
  }
});

function updateEditorStats(){
  const ta = document.getElementById("editorTextarea");
  const text = ta ? ta.value : "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const readMin = Math.max(1, Math.ceil(words / 200));
  
  const statsEl = document.getElementById("editorStats");
  if(statsEl){
    if(words === 0 && chars === 0){
      statsEl.textContent = "0 words";
    } else {
      statsEl.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${chars.toLocaleString()} chars · ~${readMin} min read`;
    }
  }
  
  const wEl = document.getElementById("editorWordCount");
  const cEl = document.getElementById("editorCharCount");
  const rEl = document.getElementById("editorReadTime");
  if(wEl) wEl.textContent = words + " words";
  if(cEl) cEl.textContent = chars + " chars";
  if(rEl) rEl.textContent = "~" + readMin + " min read";

  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  const goalEl = document.getElementById("wordGoalDisplay");
  if(goalEl){
    if(s.wordGoal && s.wordGoal > 0){
      const pct = Math.min(100, Math.round((words / s.wordGoal) * 100));
      goalEl.style.display = "inline-flex";
      goalEl.textContent = `Target: ${words}/${s.wordGoal} words (${pct}%)`;
    } else {
      goalEl.style.display = "none";
    }
  }
}

function renderEditorPreview(){
  const ta = document.getElementById("editorTextarea");
  const pv = document.querySelector(".editor-preview") || document.getElementById("editorPreview");
  if(!ta || !pv) return;
  pv.innerHTML = renderMarkdown(ta.value || "", editingId);
}

function syncScroll(el){
  if(!el) return;
  const ta = document.getElementById("editorTextarea");
  const pv = document.querySelector(".editor-preview") || document.getElementById("editorPreview");
  if(ta && pv && (editorMode === "split" || editorMode === "preview")){
    if(el === ta){
      const pct = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
      pv.scrollTop = pct * (pv.scrollHeight - pv.clientHeight);
    } else if(el === pv){
      const pct = pv.scrollTop / Math.max(1, pv.scrollHeight - pv.clientHeight);
      ta.scrollTop = pct * (ta.scrollHeight - ta.clientHeight);
    }
  }
  syncLineScroll();
}

// ===== PWA INSTALL LOGIC =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installPwaBtn');
  if (btn) btn.style.display = 'inline-block';
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('installPwaBtn');
  if (btn) btn.style.display = 'none';
});
async function installPWA() {
  if (deferredPrompt) {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      const btn = document.getElementById('installPwaBtn');
      if (btn) btn.style.display = 'none';
    }
  } else if (/iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) {
    showToast('Tap Share -> Add to Home Screen in Safari to install');
  }
}

// ===== SETTINGS & SHARE & DRAG HANDLERS =====
function showSettings(){
  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  const fsVal = s.fontSize || 12;
  const pfVal = s.previewFont || 13;
  const wgVal = s.wordGoal || 0;
  
  const fSlider = document.getElementById("fontSizeSlider");
  const fLabel = document.getElementById("fontSizeLabel");
  const pfSlider = document.getElementById("previewFontSlider");
  const pfLabel = document.getElementById("previewFontLabel");
  const wgInput = document.getElementById("wordGoalInput");
  
  if(fSlider) fSlider.value = fsVal;
  if(fLabel) fLabel.textContent = fsVal + "px";
  if(pfSlider) pfSlider.value = pfVal;
  if(pfLabel) pfLabel.textContent = pfVal + "px";
  if(wgInput) wgInput.value = wgVal;
  
  const lnToggle = document.getElementById("lineNumbersToggle");
  if(lnToggle) lnToggle.checked = (localStorage.getItem("dn_line_numbers") === "true");
  
  const curFont = localStorage.getItem("dn_font_choice") || "Inter";
  updateFontChoiceUI(curFont);
  
  const sm = document.getElementById("settingsModal");
  if(sm) sm.style.display = "flex";
}

function hideSettings(){
  const sm = document.getElementById("settingsModal");
  if(sm) sm.style.display = "none";
}

function updateFontSize(val){
  const label = document.getElementById("fontSizeLabel");
  if(label) label.textContent = val + "px";
  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  s.fontSize = parseInt(val);
  localStorage.setItem("dn_settings", JSON.stringify(s));
  applySettings();
}

function updatePreviewFont(val){
  const label = document.getElementById("previewFontLabel");
  if(label) label.textContent = val + "px";
  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  s.previewFont = parseInt(val);
  localStorage.setItem("dn_settings", JSON.stringify(s));
  applySettings();
}

function updateWordGoal(val){
  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  s.wordGoal = parseInt(val) || 0;
  localStorage.setItem("dn_settings", JSON.stringify(s));
}

function resetSettings(){
  localStorage.removeItem("dn_settings");
  localStorage.removeItem("dn_font_choice");
  localStorage.removeItem("dn_line_numbers");
  setFontChoice("Inter");
  applySettings();
  setupLineNumbers();
  showSettings();
  showToast(I("check") + " Settings reset to default");
}

function updateFontChoiceUI(font){
  const bInter = document.getElementById("fontBtnInter");
  const bGoogle = document.getElementById("fontBtnGoogleSans");
  const bMont = document.getElementById("fontBtnMontserrat");
  
  if(bInter) bInter.classList.remove("active");
  if(bGoogle) bGoogle.classList.remove("active");
  if(bMont) bMont.classList.remove("active");
  
  if(font === "Google Sans" && bGoogle) bGoogle.classList.add("active");
  else if(font === "Montserrat" && bMont) bMont.classList.add("active");
  else if(bInter) bInter.classList.add("active");
}

function setFontChoice(font){
  localStorage.setItem("dn_font_choice", font);
  
  let fontString = "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  let label = "Notion Default (Inter)";
  
  if(font === "Google Sans"){
    fontString = "'Google Sans', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
    label = "Google Sans";
  } else if(font === "Montserrat"){
    fontString = "'Montserrat', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
    label = "Montserrat";
  }
  
  document.documentElement.style.setProperty("--font-primary", fontString);
  document.documentElement.style.setProperty("--sans", fontString);
  
  // Update UI and show toast
  updateFontChoiceUI(font);
  showToast(I("type") + " Typography: " + label);
}

function applySettings(){
  const s = JSON.parse(localStorage.getItem("dn_settings") || "{}");
  const fs = s.fontSize || 14;
  const pf = s.previewFont || 14;
  document.querySelectorAll(".editor-textarea").forEach(el => el.style.fontSize = fs + "px");
  document.querySelectorAll(".editor-preview").forEach(el => el.style.fontSize = pf + "px");
  
  const font = localStorage.getItem("dn_font_choice") || "Inter";
  let fontString = "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  if(font === "Google Sans"){
    fontString = "'Google Sans', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  } else if(font === "Montserrat"){
    fontString = "'Montserrat', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  }
  document.documentElement.style.setProperty("--font-primary", fontString);
  document.documentElement.style.setProperty("--sans", fontString);
  if(typeof updateLineNumbers === "function") updateLineNumbers();
}

let currentShareNoteId = null;
const SHARE_API_URL = "https://devnotes-api.geekfolio.workers.dev";

function shareNote(){
  if(window._isLocked){
    showToast('⚠️ Please unlock the note first before sharing');
    return;
  }
  if(editingId) shareNoteById(editingId);
}

async function shareNoteById(id){
  currentShareNoteId = id;
  const n = notes.find(x => x.id === id);
  if(!n) return;

  if(n.isEncrypted){
    if(editingId !== id || window._isLocked || !document.getElementById('editorTextarea')?.value){
      alert('This note is encrypted. Please open and unlock it in the editor first before sharing.');
      return;
    }
  }

  const sm = document.getElementById("shareModal");
  const title = document.getElementById("shareModalTitle");
  const inp = document.getElementById("shareUrlInput");
  const msg = document.getElementById("shareModalMsg");
  
  if(title) title.innerHTML = I("share") + " Share: " + esc(n.title);
  if(sm) sm.style.display = "flex";

  // If already shared previously, show existing short URL first
  if(n.shareUrl){
    if(inp) inp.value = n.shareUrl;
    if(msg) msg.textContent = "Your short share link is active:";
  } else {
    if(inp) inp.value = "Generating short link...";
    if(msg) msg.textContent = "Connecting to DevNotes Share API...";
  }

  const shareContent = (n.isEncrypted && editingId === id) ? (document.getElementById('editorTextarea')?.value || '') : (n.content || '');

  try {
    const res = await fetch(`${SHARE_API_URL}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: n.shareId || undefined,
        title: n.title || "Untitled Note",
        content: shareContent,
        language: n.language || "markdown",
        tags: n.tags || [],
        createdAt: n.createdAt || new Date().toISOString()
      })
    });

    const data = await res.json();
    if(data && (data.url || data.id)){
      const finalUrl = data.url || `${SHARE_API_URL}/s/${data.id}`;
      n.shareUrl = finalUrl;
      n.shareId = data.id;
      saveAll();
      renderSidebar();
      renderNotes();
      if(inp) inp.value = finalUrl;
      if(msg) msg.textContent = "Short link created! Share it with anyone:";
      showToast(I("check") + " Short share link generated!");
    } else {
      throw new Error("Invalid API response");
    }
  } catch(err) {
    console.warn("Share API error, fallback to URL snapshot:", err);
    const sharePayload = btoa(unescape(encodeURIComponent(JSON.stringify({
      title: n.title,
      content: n.content,
      language: n.language,
      tags: n.tags,
      createdAt: n.createdAt
    }))));
    const fallbackUrl = window.location.origin + window.location.pathname + "#share=" + sharePayload;
    if(inp) inp.value = fallbackUrl;
    if(msg) msg.textContent = "Offline share link generated:";
  }
}

function hideShareModal(){
  const sm = document.getElementById("shareModal");
  if(sm) sm.style.display = "none";
}

function getSharePayloadForCurrent(){
  if(!currentShareNoteId) return null;
  return notes.find(x => x.id === currentShareNoteId) || null;
}

function shareViaNativeApp(){
  const n = getSharePayloadForCurrent();
  if(!n) return;
  const inp = document.getElementById("shareUrlInput");
  const url = inp ? inp.value : window.location.href;
  
  if(navigator.share){
    navigator.share({
      title: n.title || 'DevNotes Note',
      text: n.content ? (n.title + '\n\n' + n.content.slice(0, 200) + (n.content.length > 200 ? '...' : '')) : n.title,
      url: url
    }).then(() => {
      showToast(I("check") + " Shared successfully!");
    }).catch(err => {
      if(err.name !== 'AbortError') {
        copyShareUrl();
      }
    });
  } else {
    copyShareUrl();
  }
}

function copyNoteMarkdownText(){
  const n = getSharePayloadForCurrent();
  if(!n) return;
  let fullText = (n.title ? '# ' + n.title + '\n\n' : '') + (n.content || '');
  if(n.tags && n.tags.length > 0){
    fullText += '\n\nTags: ' + n.tags.map(t => '#' + t).join(' ');
  }
  navigator.clipboard.writeText(fullText).then(() => {
    showToast(I("check") + " Note text copied to clipboard!");
  }).catch(() => {
    showToast(I("check") + " Note copied!");
  });
}

function shareToWhatsApp(){
  const n = getSharePayloadForCurrent();
  if(!n) return;
  const inp = document.getElementById("shareUrlInput");
  const url = inp ? inp.value : '';
  const snippet = n.content ? n.content.slice(0, 160).replace(/[\r\n]+/g, ' ') + (n.content.length > 160 ? '...' : '') : '';
  const text = `*${n.title || 'Note'}*\n${snippet}\n\n👉 View note: ${url}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function shareToTwitter(){
  const n = getSharePayloadForCurrent();
  if(!n) return;
  const inp = document.getElementById("shareUrlInput");
  const url = inp ? inp.value : '';
  const text = `Check out "${n.title || 'Note'}" on DevNotes:`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function copyShareUrl(){
  const inp = document.getElementById("shareUrlInput");
  if(!inp) return;
  inp.select();
  navigator.clipboard.writeText(inp.value).then(() => {
    showToast(I("check") + " Short share link copied to clipboard!");
  }).catch(() => {
    showToast(I("check") + " Link copied!");
  });
}

function openShareUrl(){
  const inp = document.getElementById("shareUrlInput");
  if(inp && inp.value){
    window.open(inp.value, "_blank");
  }
}

async function updateCurrentShare(){
  if(currentShareNoteId){
    const n = notes.find(x => x.id === currentShareNoteId);
    if(n){
      delete n.shareUrl;
    }
    await shareNoteById(currentShareNoteId);
    showToast(I("check") + " Share link refreshed with latest content!");
  }
}

function deleteCurrentShare(){
  if(currentShareNoteId){
    const n = notes.find(x => x.id === currentShareNoteId);
    if(n){
      delete n.shareUrl;
      delete n.shareId;
      saveAll();
      renderSidebar();
      renderNotes();
    }
  }
  hideShareModal();
  showToast(I("trash") + " Share link removed");
}

// ===== SHARED NOTE RECEIVER & VIEWER =====
let currentSharedPayload = null;

function checkShareLink(){
  let payloadStr = '';
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  
  if(hash.startsWith('#share=')){
    payloadStr = hash.substring(7);
  } else if(params.get('share')){
    payloadStr = params.get('share');
  }
  
  if(payloadStr){
    try {
      const jsonStr = decodeURIComponent(escape(atob(payloadStr)));
      const data = JSON.parse(jsonStr);
      if(data && (data.title !== undefined || data.content !== undefined)){
        openSharedNoteView(data);
      }
    } catch(err) {
      console.error('Failed to parse shared note link:', err);
      showToast('⚠️ Could not open shared note link (invalid or corrupted URL)');
    }
  }
}

function openSharedNoteView(data){
  currentSharedPayload = data;
  const modal = document.getElementById('sharedNoteModal');
  const titleEl = document.getElementById('sharedNoteTitle');
  const iconEl = document.getElementById('sharedNoteIcon');
  const langEl = document.getElementById('sharedNoteLang');
  const dateEl = document.getElementById('sharedNoteDate');
  const previewEl = document.getElementById('sharedNotePreview');
  const tagsEl = document.getElementById('sharedNoteTags');

  if(titleEl) titleEl.textContent = data.title || 'Untitled Note';
  const langId = data.language || 'markdown';
  const iconChar = LICON[langId] || (langId === 'general' ? '📝' : '📄');
  if(iconEl) iconEl.textContent = iconChar;
  
  const matchedLang = LANGS.find(l => l.id === langId);
  if(langEl) langEl.textContent = matchedLang ? matchedLang.name : (langId === 'markdown' ? '📄 Markdown' : langId);
  
  if(dateEl){
    if(data.createdAt){
      try {
        const d = new Date(data.createdAt);
        dateEl.textContent = 'Shared Note · ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } catch(e){
        dateEl.textContent = 'Shared Note snapshot';
      }
    } else {
      dateEl.textContent = 'Shared Note snapshot';
    }
  }

  if(tagsEl){
    if(Array.isArray(data.tags) && data.tags.length > 0){
      tagsEl.innerHTML = data.tags.map(t => `<span class="tag">🏷️ ${esc(t)}</span>`).join('');
      tagsEl.style.display = 'flex';
    } else {
      tagsEl.style.display = 'none';
      tagsEl.innerHTML = '';
    }
  }

  if(previewEl){
    previewEl.innerHTML = renderMarkdown(data.content || '', null);
  }

  if(modal) modal.style.display = 'flex';
}

function closeSharedNoteView(){
  const modal = document.getElementById('sharedNoteModal');
  if(modal) modal.style.display = 'none';
  if(window.location.hash.startsWith('#share=')){
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch(e){}
  }
}

function copySharedNoteContent(){
  if(!currentSharedPayload) return;
  const text = currentSharedPayload.content || '';
  navigator.clipboard.writeText(text).then(() => {
    showToast(I('check') + ' Shared note content copied to clipboard!');
  }).catch(() => {
    showToast(I('check') + ' Content copied');
  });
}

function importSharedNoteToMyNotes(){
  if(!currentSharedPayload) return;
  const newNote = {
    id: gid(),
    title: currentSharedPayload.title || 'Shared Note',
    content: currentSharedPayload.content || '',
    language: currentSharedPayload.language || 'markdown',
    tags: Array.isArray(currentSharedPayload.tags) ? [...currentSharedPayload.tags] : [],
    folderId: null,
    isPinned: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  notes.unshift(newNote);
  saveAll();
  renderSidebar();
  renderNotes();
  closeSharedNoteView();
  openEditor(newNote.id);
  showToast(I('check') + ' Note imported and saved to your DevNotes!');
}

function onNoteDragStart(e, id){
  e.dataTransfer.setData("text/plain", id);
  e.currentTarget.classList.add("dragging");
}

function onNoteDragEnd(e){
  e.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".folder-item").forEach(f => f.classList.remove("drag-over"));
}

function copyText(str){
  navigator.clipboard.writeText(str).then(() => {
    showToast(I("check") + " Copied to clipboard");
  }).catch(() => {
    showToast(I("check") + " Copied");
  });
}

function runCode(btn, id, lang){
  runEnhancedCode(btn, id, lang || "js");
}

function saveCurrentNote(){
  saveNote();
}



const I=n=>'<svg class="ic" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const EMO={'📝':'file-text','👁️':'eye','🔒':'lock','📌':'pin','📍':'pin','💔':'heart','❤️':'heart','🤍':'heart','📋':'copy','📁':'folder','📂':'folder-open','📄':'download','🔗':'share','🗑️':'trash','📊':'bar-chart','💾':'archive','📥':'upload','📅':'calendar','🐛':'bug','👀':'eye','📔':'book-open','⚡':'zap','🎯':'target','✅':'check','⚠️':'info','❌':'x','🙏':'heart','💡':'zap','🔥':'flame','🏷️':'hash','📖':'book-open','🎨':'palette','🔤':'type','🔠':'type','📏':'ruler','🔀':'git-compare','⏰':'timer','🌐':'external-link','✏️':'edit','＋':'plus','✕':'x','▶':'play','⏸':'pause','⏳':'timer'};

// ===== DATA =====
const NOTE_TYPES = [
  {
    group: 'Notes & Docs',
    items: [
      { id: 'markdown', name: '📄 Markdown Note', icon: '📄' },
      { id: 'general', name: '📝 Plain Note', icon: '📝' }
    ]
  },
  {
    group: 'Code & Snippets',
    items: [
      { id: 'javascript', name: '🟨 JavaScript', icon: '🟨' },
      { id: 'typescript', name: '🔷 TypeScript', icon: '🔷' },
      { id: 'python', name: '🐍 Python', icon: '🐍' },
      { id: 'html', name: '🌐 HTML / CSS', icon: '🌐' },
      { id: 'react', name: '⚛️ React / JSX', icon: '⚛️' },
      { id: 'nodejs', name: '🟩 Node.js', icon: '🟩' },
      { id: 'sql', name: '🗄️ SQL', icon: '🗄️' },
      { id: 'json', name: '📦 JSON', icon: '📦' },
      { id: 'bash', name: '🖥️ Bash / Shell', icon: '🖥️' },
      { id: 'rust', name: '🦀 Rust', icon: '🦀' },
      { id: 'go', name: '🐹 Go', icon: '🐹' },
      { id: 'cpp', name: '🔵 C++', icon: '🔵' },
      { id: 'csharp', name: '💜 C#', icon: '💜' },
      { id: 'java', name: '☕ Java', icon: '☕' },
      { id: 'docker', name: '🐳 Dockerfile', icon: '🐳' },
      { id: 'ruby', name: '💎 Ruby', icon: '💎' },
      { id: 'php', name: '🐘 PHP', icon: '🐘' },
      { id: 'swift', name: '🍎 Swift', icon: '🍎' },
      { id: 'kotlin', name: '🟣 Kotlin', icon: '🟣' }
    ]
  }
];
const LANGS = NOTE_TYPES.flatMap(g => g.items);
const LICON = {};
LANGS.forEach(l => { LICON[l.id] = l.icon || l.name.split(' ')[0]; });

const TEMPLATES=[
  {name:'Meeting Notes',icon:'📅',content:`# Meeting Notes\n\n**Date:** ${new Date().toLocaleDateString()}\n**Attendees:** \n\n## Agenda\n- \n\n## Discussion\n\n\n## Action Items\n- [ ] \n- [ ] \n`},
  {name:'Bug Report',icon:'🐛',content:`# Bug Report\n\n**Title:** \n**Severity:** Low / Medium / High / Critical\n\n## Description\n\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n\n## Actual Behavior\n\n\n## Environment\n- OS: \n- Browser: \n- Version: \n`},
  {name:'Code Review',icon:'👀',content:`# Code Review\n\n**PR/MR:** \n**Author:** \n**Reviewer:** \n\n## Summary\n\n\n## Changes\n- \n\n## Feedback\n\n### ✅ Good\n- \n\n### ⚠️ Suggestions\n- \n\n### ❌ Issues\n- \n`},
  {name:'Daily Journal',icon:'📔',content:`# ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}\n\n## 🎯 Goals for Today\n- [ ] \n- [ ] \n- [ ] \n\n## 📝 Notes\n\n\n## 💡 Ideas\n\n\n## 🙏 Gratitude\n- \n`},
  {name:'Project Plan',icon:'📊',content:`# Project: [Name]\n\n## Overview\n\n\n## Goals\n- \n\n## Milestones\n\n### Phase 1: \n- [ ] Task 1\n- [ ] Task 2\n\n### Phase 2:\n- [ ] Task 1\n- [ ] Task 2\n\n## Resources\n- \n\n## Notes\n\n`},
  {name:'Quick Note',icon:'⚡',content:`# Quick Note\n\n`},
];

let notes=[],folders=[],trash=[];
let currentFilter='all',currentFolderId=null,currentTagFilter='',searchQuery='';
let advFilters={text:'',folder:'',from:'',to:'',code:''};
let editingId=null,editorPinned=false,editorFav=false,editorTags=[],editorMode='edit';
let expandedFolders={},bulkMode=false,selectedNotes=new Set();
let folderModalMode='create',folderModalId=null,deleteFolderId=null,restoreNoteId=null;
let autoSaveTimer=null;

// ===== STORAGE =====
function load(){
  try{notes=JSON.parse(localStorage.getItem('dn_notes')||'[]')}catch{notes=[]}
  try{folders=JSON.parse(localStorage.getItem('dn_folders')||'[]')}catch{folders=[]}
  try{trash=JSON.parse(localStorage.getItem('dn_trash')||'[]')}catch{trash=[]}
  try{expandedFolders=JSON.parse(localStorage.getItem('dn_expanded')||'{}')}catch{expandedFolders={}}
  
  if(!notes.length && !folders.length && !trash.length){
    // Seed initial welcome note
    const welcomeId=gid();
    notes=[{
      id:welcomeId,
      title:'Welcome to DevNotes 🚀',
      content: "# Welcome to DevNotes! 🚀\n\nDevNotes is your lightning-fast markdown notepad and code runner.\n\n## ✨ Core Features\n- **Markdown Support**: Fast rendering with headings, tables, blockquotes, and tasks.\n- **Interactive Tasks**: Check off items right here in preview!\n  - [x] Try out DevNotes\n  - [x] Check markdown & live split mode\n  - [ ] Write your first note\n- **Live Code Execution**: Run JavaScript right inside your notes:\n\n```js\nconst fruits = ['Apple', 'Banana', 'Cherry'];\nconsole.log('Total items:', fruits.length);\nfruits.map((f, i) => console.log((i + 1) + '. ' + f));\n```\n\n- **Wiki-links**: Connect your ideas with `[[Note Name]]`\n- **Security**: AES-256 client-side note encryption 🔒\n- **Auto-Save**: Everything saves in background automatically\n",
      language:'javascript',
      folderId:null,
      tags:['welcome','tips'],
      isPinned:true,
      isFavorite:true,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    }];
  }
  
  // Clean old trash (30 days)
  const cutoff=Date.now()-30*24*60*60*1000;
  trash=trash.filter(n=>new Date(n.trashedAt).getTime()>cutoff);
  saveAll();
}
function saveAll(){
  localStorage.setItem('dn_notes',JSON.stringify(notes));
  localStorage.setItem('dn_folders',JSON.stringify(folders));
  localStorage.setItem('dn_trash',JSON.stringify(trash));
  localStorage.setItem('dn_expanded',JSON.stringify(expandedFolders));
}
function syncSharedNoteToCloudflare(n){
  if(!n) return;
  const shareId = n.shareId || (n.shareUrl ? n.shareUrl.split('/s/')[1] : null);
  if(!shareId || n.isEncrypted) return;
  
  fetch(`${SHARE_API_URL}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: shareId,
      title: n.title || 'Untitled Note',
      content: n.content || '',
      language: n.language || 'markdown',
      tags: n.tags || [],
      createdAt: n.createdAt || new Date().toISOString()
    })
  }).catch(err => console.warn('Background share sync failed:', err));
}
function gid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,6)}

// ===== INIT =====
function init(){
  load();buildLangSelect();renderSidebar();renderNotes();buildTemplates();
  const savedTheme=localStorage.getItem('dn_theme')||'dark';
  const t=THEMES.find(x=>x.id===savedTheme)||THEMES[0];
  applyTheme(t);

  applySettings();
  
  // Restore sidebar collapsed preference on desktop
  const savedCollapsed = localStorage.getItem('dn_sidebar_collapsed') === '1';
  if(savedCollapsed && innerWidth > 768){
    document.getElementById('sidebar').classList.add('collapsed');
  }
  updateSidebarCollapseState();

  checkMobile();window.addEventListener('resize',checkMobile);
  setupDropZone();

  // Check if opened via #share= link
  checkShareLink();
  window.addEventListener('hashchange', checkShareLink);

  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key==='b'&&!e.shiftKey){e.preventDefault();toggleSidebarCollapse(e)}
    if((e.metaKey||e.ctrlKey)&&e.key==='n'&&!e.shiftKey){e.preventDefault();openEditor()}
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openCommandPalette()}
    if(e.key==='Escape')closeAllModals();
  });
}
function checkMobile(){
  const menuBtn = document.getElementById('menuBtn');
  if(menuBtn) menuBtn.style.display = 'flex';
  if(innerWidth > 768){
    closeMobileSidebar();
  }
  updateSidebarCollapseState();
}
function toggleSidebar(e){
  if(e && e.stopPropagation) e.stopPropagation();
  if(innerWidth <= 768){
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('mobileOverlay').classList.toggle('show');
  } else {
    toggleSidebarCollapse(e);
  }
}
function closeSidebar(){
  if(innerWidth <= 768){
    closeMobileSidebar();
  }
}
function closeMobileSidebar(){
  const sb = document.getElementById('sidebar');
  const mo = document.getElementById('mobileOverlay');
  if(sb) sb.classList.remove('open');
  if(mo) mo.classList.remove('show');
}
function toggleSidebarCollapse(e){
  if(e && e.stopPropagation) e.stopPropagation();
  if(innerWidth <= 768){
    toggleSidebar();
    return;
  }
  const sb = document.getElementById('sidebar');
  if(!sb) return;
  sb.classList.toggle('collapsed');
  const isCollapsed = sb.classList.contains('collapsed');
  localStorage.setItem('dn_sidebar_collapsed', isCollapsed ? '1' : '0');
  updateSidebarCollapseState();
  showToast(isCollapsed ? I('panel-left') + ' Sidebar collapsed' : I('panel-left-close') + ' Sidebar expanded');
}
function expandSidebar(){
  const sb = document.getElementById('sidebar');
  if(sb && sb.classList.contains('collapsed')){
    sb.classList.remove('collapsed');
    localStorage.setItem('dn_sidebar_collapsed', '0');
    updateSidebarCollapseState();
  }
}
function updateSidebarCollapseState(){
  const sb = document.getElementById('sidebar');
  if(!sb) return;
  const isCollapsed = sb.classList.contains('collapsed') && innerWidth > 768;
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  if(collapseBtn){
    collapseBtn.innerHTML = `<svg class="ic"><use href="#${isCollapsed ? 'i-panel-left-open' : 'i-panel-left-close'}"/></svg>`;
    collapseBtn.title = isCollapsed ? 'Expand Sidebar (Cmd/Ctrl+B)' : 'Collapse Sidebar (Cmd/Ctrl+B)';
  }
  const topMenuBtn = document.getElementById('menuBtn');
  if(topMenuBtn){
    topMenuBtn.innerHTML = `<svg class="ic"><use href="#${isCollapsed ? 'i-panel-left' : 'i-panel-left'}"/></svg>`;
    topMenuBtn.title = innerWidth <= 768 ? 'Toggle Sidebar' : (isCollapsed ? 'Expand Sidebar (Cmd/Ctrl+B)' : 'Collapse Sidebar (Cmd/Ctrl+B)');
  }
}
function toggleDark(){
  const currentTheme=localStorage.getItem('dn_theme')||'dark';
  if(currentTheme==='light'){
    selectTheme('dark');
    showToast(I('moon') + ' Switched to Dark mode');
  } else {
    selectTheme('light');
    showToast(I('sun') + ' Switched to Light mode');
  }
}
function closeAllModals(){
  ['folderModal','deleteFolderModal','templatesModal','importModal','advSearchModal','bulkMoveModal','restoreModal','encryptModal','emptyTrashModal','settingsModal','diffModal','shareModal','sharedNoteModal','cmdPaletteModal','shortcutsModal'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
  if(typeof closeGraphView==='function') closeGraphView();
  document.getElementById('deleteModal').style.display='none';
  closeEditor();
}
function goHome(){closeStats();closeEditor();exitBulkMode();currentFilter='all';currentFolderId=null;currentTagFilter='';advFilters={text:'',folder:'',from:'',to:'',code:''};renderSidebar();renderNotes();closeSidebar()}

// ===== STATISTICS =====
function openStats(){
  closeEditor();exitBulkMode();currentFilter='stats';currentFolderId=null;currentTagFilter='';
  document.getElementById('statsWrap').classList.add('open');
  renderStats();renderSidebar();closeSidebar();
}
function closeStats(){
  document.getElementById('statsWrap').classList.remove('open');
  if(currentFilter==='stats'){currentFilter='all';renderSidebar()}
}
function wordCount(text){return text&&text.trim()?text.trim().split(/\s+/).length:0}
function renderStats(){
  const totalNotes=notes.length;
  const totalWords=notes.reduce((s,n)=>s+wordCount(n.content),0);
  const totalChars=notes.reduce((s,n)=>s+(n.content||'').length,0);
  const withCode=notes.filter(n=>(n.content||'').includes('```')).length;
  const favs=notes.filter(n=>n.isFavorite).length;
  const pins=notes.filter(n=>n.isPinned).length;
  const folderCount=folders.length;
  const tagSet=new Set();notes.forEach(n=>(n.tags||[]).forEach(t=>tagSet.add(t)));
  const avgWords=totalNotes?Math.round(totalWords/totalNotes):0;

  const now=new Date();
  const weekAgo=new Date(now);weekAgo.setDate(weekAgo.getDate()-7);
  const createdWeek=notes.filter(n=>new Date(n.createdAt)>=weekAgo).length;
  const updatedWeek=notes.filter(n=>new Date(n.updatedAt)>=weekAgo).length;

  const langMap={};
  notes.forEach(n=>{const k=n.language||'general';langMap[k]=(langMap[k]||0)+1});
  const langSorted=Object.entries(langMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const langMax=langSorted.length?langSorted[0][1]:1;

  const folderMap={'(Root)':notes.filter(n=>!n.folderId).length};
  folders.forEach(f=>{folderMap[f.name]=notes.filter(n=>n.folderId===f.id).length});
  const folderSorted=Object.entries(folderMap).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const folderMax=folderSorted.length?folderSorted[0][1]:1;

  const dayKeys=[];
  for(let i=13;i>=0;i--){
    const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);
    dayKeys.push(d.toISOString().slice(0,10));
  }
  const activeDays=new Set();
  notes.forEach(n=>{
    if(n.createdAt)activeDays.add(n.createdAt.slice(0,10));
    if(n.updatedAt)activeDays.add(n.updatedAt.slice(0,10));
  });
  let streak=0;
  const todayKey=dayKeys[dayKeys.length-1];
  const yest=new Date(now);yest.setDate(yest.getDate()-1);
  const yestKey=yest.toISOString().slice(0,10);
  let cursor=activeDays.has(todayKey)?todayKey:activeDays.has(yestKey)?yestKey:null;
  if(cursor){
    let d=new Date(cursor+'T12:00:00');
    while(activeDays.has(d.toISOString().slice(0,10))){streak++;d.setDate(d.getDate()-1)}
  }

  let longest=null;
  notes.forEach(n=>{const w=wordCount(n.content);if(!longest||w>longest.w)longest={title:n.title,w}});

  const body=document.getElementById('statsBody');
  body.innerHTML=`
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${totalNotes}</div><div class="stat-label">Total Notes</div></div>
      <div class="stat-card"><div class="stat-val">${totalWords.toLocaleString()}</div><div class="stat-label">Total Words</div></div>
      <div class="stat-card"><div class="stat-val">${avgWords}</div><div class="stat-label">Avg Words/Note</div></div>
      <div class="stat-card"><div class="stat-val">${totalChars.toLocaleString()}</div><div class="stat-label">Characters</div></div>
      <div class="stat-card"><div class="stat-val">${withCode}</div><div class="stat-label">With Code</div></div>
      <div class="stat-card"><div class="stat-val">${favs}</div><div class="stat-label">Favorites</div></div>
      <div class="stat-card"><div class="stat-val">${pins}</div><div class="stat-label">Pinned</div></div>
      <div class="stat-card"><div class="stat-val">${folderCount}</div><div class="stat-label">Folders</div></div>
      <div class="stat-card"><div class="stat-val">${tagSet.size}</div><div class="stat-label">Tags</div></div>
      <div class="stat-card"><div class="stat-val">${streak}</div><div class="stat-label">Day Streak ${I('flame')}</div></div>
      <div class="stat-card"><div class="stat-val">${createdWeek}</div><div class="stat-label">Created (7d)</div></div>
      <div class="stat-card"><div class="stat-val">${updatedWeek}</div><div class="stat-label">Updated (7d)</div></div>
    </div>
    <div class="stats-section">
      <h3>${I('calendar')} Last 14 Days Activity</h3>
      <div class="streak-row">
        ${dayKeys.map(k=>{
          const d=new Date(k+'T12:00:00');
          const label=d.toLocaleDateString('en',{weekday:'narrow'});
          const active=activeDays.has(k);
          const isToday=k===todayKey;
          return `<div class="streak-day ${active?'active':''} ${isToday?'today':''}" title="${k}">${label}</div>`;
        }).join('')}
      </div>
      <p style="margin-top:8px;font-size:11px;color:var(--text3)">Purple = wrote/edited notes that day · Yellow ring = today</p>
    </div>
    <div class="stats-section">
      <h3>${I('hash')} By Language / Type</h3>
      ${langSorted.length?langSorted.map(([id,c])=>{
        const name=(LANGS.find(l=>l.id===id)||{name:id}).name;
        const pct=Math.round(c/langMax*100);
        return `<div class="stats-bar-row"><span class="label">${esc(name)}</span><div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div><span class="val">${c}</span></div>`;
      }).join(''):'<p style="font-size:11px;color:var(--text3)">No notes yet</p>'}
    </div>
    <div class="stats-section">
      <h3>${I('folder')} By Folder</h3>
      ${folderSorted.length?folderSorted.map(([name,c])=>{
        const pct=Math.round(c/folderMax*100);
        return `<div class="stats-bar-row"><span class="label">${esc(name)}</span><div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div><span class="val">${c}</span></div>`;
      }).join(''):'<p style="font-size:11px;color:var(--text3)">No notes yet</p>'}
    </div>
    ${longest?`<div class="stats-section"><h3>${I('book-open')} Longest Note</h3><p style="font-size:12px"><b>${esc(longest.title)}</b> — ${longest.w} words</p></div>`:''}
    <div class="stats-section">
      <h3>${I('trash')} Trash</h3>
      <p style="font-size:12px;color:var(--text2)">${trash.length} note(s) in trash · auto-deleted after 30 days</p>
    </div>
  `;
}

// ===== SIDEBAR & SELECTORS =====
function buildLangSelectHtml(){
  return NOTE_TYPES.map(g => `<optgroup label="${esc(g.group)}">` + g.items.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('') + `</optgroup>`).join('');
}
function buildLangSelect(){
  const el = document.getElementById('editorLang');
  if(el && el.tagName === 'SELECT') el.innerHTML = buildLangSelectHtml();
}

function buildFolderSelect(excludeId=null){
  const opts=[`<option value="">📂 No Folder</option>`];
  function addFolder(f,depth=0){
    if(f.id===excludeId)return;
    opts.push(`<option value="${f.id}">${'　'.repeat(depth)}📁 ${esc(f.name)}</option>`);
    folders.filter(c=>c.parentId===f.id).forEach(c=>addFolder(c,depth+1));
  }
  folders.filter(f=>!f.parentId).forEach(f=>addFolder(f));
  return opts.join('');
}

function renderSidebar(){
  document.getElementById('cnt-all').textContent=notes.length;
  document.getElementById('cnt-fav').textContent=notes.filter(n=>n.isFavorite).length;
  document.getElementById('cnt-pin').textContent=notes.filter(n=>n.isPinned).length;
  document.getElementById('cnt-trash').textContent=trash.length;
  document.querySelectorAll('.sb[data-filter]').forEach(b=>b.classList.toggle('active',currentFilter===b.dataset.filter&&!currentFolderId&&!currentTagFilter));
  const statsBtn=document.querySelector('.sb[data-filter="stats"]');
  if(statsBtn)statsBtn.classList.toggle('active',currentFilter==='stats');
  
  const fList=document.getElementById('folders-list');
  if(!folders.length){fList.innerHTML='<div style="padding:3px 10px;font-size:11px;color:var(--text3);font-style:italic">No folders</div>'}
  else{
    let html='';
    function renderFolder(f,depth=0){
      const isOpen=expandedFolders[f.id];
      const isActive=currentFolderId===f.id;
      const children=folders.filter(c=>c.parentId===f.id);
      const cnt=countNotesInFolder(f.id);
      html+=`<div class="folder-item ${isActive?'active':''}" style="--depth:${depth*12}px" onclick="setFilter('folder:${f.id}')">
        <span class="f-toggle ${isOpen?'open':''}" onclick="event.stopPropagation();toggleFolderExp('${f.id}')">${children.length?`<svg class="ic"><use href="#i-chevron-right"/></svg>`:''}</span>
        <span class="f-icon">${I(isOpen?'folder-open':'folder')}</span>
        <span class="f-name">${esc(f.name)}</span>
        <span class="f-cnt">${cnt}</span>
        <span class="f-actions">
          <button onclick="event.stopPropagation();showFolderModal('subfolder','${f.id}')" title="Add subfolder">${I('plus')}</button>
          <button onclick="event.stopPropagation();showFolderModal('rename','${f.id}')" title="Rename">${I('edit')}</button>
          <button onclick="event.stopPropagation();showDelFolderModal('${f.id}')" title="Delete">${I('trash')}</button>
        </span>
      </div>`;
      if(isOpen)children.forEach(c=>renderFolder(c,depth+1));
    }
    folders.filter(f=>!f.parentId).forEach(f=>renderFolder(f));
    fList.innerHTML=html;
  }
  
  const allTags=new Set();notes.forEach(n=>(n.tags||[]).forEach(t=>allTags.add(t)));
  const tSec=document.getElementById('tags-section'),tList=document.getElementById('tags-list');
  if(allTags.size){
    tSec.style.display='';
    tList.innerHTML=[...allTags].sort().map(t=>`<span class="tag" style="cursor:pointer;${currentTagFilter===t?'border-color:var(--text);color:var(--text);font-weight:700;':''}" onclick="setFilter('tag:${t}')">#${t}</span>`).join('');
  }else tSec.style.display='none';
  
  updateBreadcrumb();
}

function countNotesInFolder(fid){
  let count=notes.filter(n=>n.folderId===fid).length;
  folders.filter(f=>f.parentId===fid).forEach(f=>count+=countNotesInFolder(f.id));
  return count;
}

function toggleFolderExp(fid){expandedFolders[fid]=!expandedFolders[fid];saveAll();renderSidebar()}

function updateBreadcrumb(){
  const bc=document.getElementById('breadcrumb');
  if(currentFilter==='trash')bc.innerHTML=`<span onclick="goHome()">All</span><span style="margin:0 4px">›</span><span class="current">${I('trash')} Trash</span>`;
  else if(currentFilter==='stats')bc.innerHTML=`<span onclick="goHome()">All</span><span style="margin:0 4px">›</span><span class="current">${I('bar-chart')} Statistics</span>`;
  else if(currentFilter==='favorites')bc.innerHTML=`<span onclick="goHome()">All</span><span style="margin:0 4px">›</span><span class="current">${I('heart')} Favorites</span>`;
  else if(currentFilter==='pinned')bc.innerHTML=`<span onclick="goHome()">All</span><span style="margin:0 4px">›</span><span class="current">${I('pin')} Pinned</span>`;
  else if(currentFolderId){
    const parts=['<span onclick="goHome()">All</span>'];
    let f=folders.find(x=>x.id===currentFolderId);
    const chain=[];
    while(f){chain.unshift(f);f=folders.find(x=>x.id===f.parentId)}
    chain.forEach((fo,i)=>{
      parts.push('<span style="margin:0 4px">›</span>');
      if(i===chain.length-1)parts.push(`<span class="current">${I('folder')} ${esc(fo.name)}</span>`);
      else parts.push(`<span onclick="setFilter('folder:${fo.id}')">${I('folder')} ${esc(fo.name)}</span>`);
    });
    bc.innerHTML=parts.join('');
  }else if(currentTagFilter)bc.innerHTML=`<span onclick="goHome()">All</span><span style="margin:0 4px">›</span><span class="current">#${esc(currentTagFilter)}</span>`;
  else bc.innerHTML=`<span class="current">All Notes</span>`;
}

function setFilter(f){
  closeEditor();exitBulkMode();closeStats();
  if(f.startsWith('tag:')){currentTagFilter=f.slice(4);currentFilter='all';currentFolderId=null}
  else if(f.startsWith('folder:')){currentFolderId=f.slice(7);currentFilter='folder';currentTagFilter=''}
  else{currentFilter=f;currentFolderId=null;currentTagFilter=''}
  advFilters={text:'',folder:'',from:'',to:'',code:''};
  renderSidebar();renderNotes();closeSidebar();
}

// ===== FOLDERS MODAL =====
function showFolderModal(mode='create',id=null){
  folderModalMode=mode;folderModalId=id;
  const title=document.getElementById('folderModalTitle');
  const inp=document.getElementById('folderNameInput');
  const parentSel=document.getElementById('folderParentSelect');
  if(mode==='rename'){
    const f=folders.find(x=>x.id===id);
    title.innerHTML=I('edit')+' Rename Folder';
    inp.value=f?f.name:'';
    parentSel.innerHTML=buildFolderSelect(id);
    parentSel.value=f?f.parentId||'':'';
  }else if(mode==='subfolder'){
    title.innerHTML=I('folder-plus')+' New Subfolder';
    inp.value='';
    parentSel.innerHTML=buildFolderSelect();
    parentSel.value=id||'';
  }else{
    title.innerHTML=I('folder-plus')+' New Folder';
    inp.value='';
    parentSel.innerHTML=buildFolderSelect();
    parentSel.value='';
  }
  document.getElementById('folderModal').style.display='flex';
  setTimeout(()=>inp.focus(),100);
}
function hideFolderModal(){document.getElementById('folderModal').style.display='none'}
function saveFolderModal(){
  const name=document.getElementById('folderNameInput').value.trim();
  if(!name)return;
  const parentId=document.getElementById('folderParentSelect').value||null;
  if(folderModalMode==='rename'){
    const f=folders.find(x=>x.id===folderModalId);
    if(f){f.name=name;f.parentId=parentId}
  }else{
    folders.push({id:gid(),name,parentId,createdAt:new Date().toISOString()});
  }
  saveAll();renderSidebar();hideFolderModal();
}
function showDelFolderModal(fid){deleteFolderId=fid;document.getElementById('deleteFolderMsg').textContent=`Notes will move to parent folder.`;document.getElementById('deleteFolderModal').style.display='flex'}
function hideDeleteFolderModal(){document.getElementById('deleteFolderModal').style.display='none'}
function confirmDeleteFolder(){
  if(deleteFolderId){
    const f=folders.find(x=>x.id===deleteFolderId);
    const parentId=f?f.parentId:null;
    notes.filter(n=>n.folderId===deleteFolderId).forEach(n=>n.folderId=parentId);
    folders.filter(c=>c.parentId===deleteFolderId).forEach(c=>c.parentId=parentId);
    folders=folders.filter(x=>x.id!==deleteFolderId);
    if(currentFolderId===deleteFolderId)goHome();
    saveAll();renderSidebar();renderNotes();
  }
  hideDeleteFolderModal();
}

// ===== SEARCH =====
function onSearch(){searchQuery=document.getElementById('searchInput').value.toLowerCase();renderNotes()}

// ===== ADVANCED SEARCH =====
function showAdvancedSearch(){
  document.getElementById('advSearchFolder').innerHTML='<option value="">All Folders</option>'+buildFolderSelect().replace('<option value="">📂 No Folder</option>','');
  document.getElementById('advSearchText').value=advFilters.text;
  document.getElementById('advSearchFolder').value=advFilters.folder;
  document.getElementById('advSearchFrom').value=advFilters.from;
  document.getElementById('advSearchTo').value=advFilters.to;
  document.getElementById('advSearchCode').value=advFilters.code;
  document.getElementById('advSearchModal').style.display='flex';
}
function hideAdvancedSearch(){document.getElementById('advSearchModal').style.display='none'}
function clearAdvSearch(){advFilters={text:'',folder:'',from:'',to:'',code:''};hideAdvancedSearch();renderNotes()}
function applyAdvSearch(){
  advFilters.text=document.getElementById('advSearchText').value.toLowerCase();
  advFilters.folder=document.getElementById('advSearchFolder').value;
  advFilters.from=document.getElementById('advSearchFrom').value;
  advFilters.to=document.getElementById('advSearchTo').value;
  advFilters.code=document.getElementById('advSearchCode').value;
  hideAdvancedSearch();renderNotes();
}

// ===== NOTES RENDERING =====
function getNotesInFolder(fid){
  let ids=[fid];
  function collect(pid){folders.filter(f=>f.parentId===pid).forEach(f=>{ids.push(f.id);collect(f.id)})}
  collect(fid);
  return notes.filter(n=>ids.includes(n.folderId));
}

function getFilteredNotes(){
  let list;
  if(currentFilter==='trash')return [...trash];
  if(currentFilter==='favorites')list=notes.filter(n=>n.isFavorite);
  else if(currentFilter==='pinned')list=notes.filter(n=>n.isPinned);
  else if(currentFolderId)list=getNotesInFolder(currentFolderId);
  else list=[...notes];
  
  if(currentTagFilter)list=list.filter(n=>(n.tags||[]).includes(currentTagFilter));
  if(searchQuery)list=list.filter(n=>n.title.toLowerCase().includes(searchQuery)||n.content.toLowerCase().includes(searchQuery));
  
  if(advFilters.text)list=list.filter(n=>n.title.toLowerCase().includes(advFilters.text)||n.content.toLowerCase().includes(advFilters.text));
  if(advFilters.folder)list=list.filter(n=>n.folderId===advFilters.folder);
  if(advFilters.from)list=list.filter(n=>new Date(n.createdAt)>=new Date(advFilters.from));
  if(advFilters.to)list=list.filter(n=>new Date(n.createdAt)<=new Date(advFilters.to+'T23:59:59'));
  if(advFilters.code==='yes')list=list.filter(n=>n.content.includes('```'));
  if(advFilters.code==='no')list=list.filter(n=>!n.content.includes('```'));
  
  const sort=document.getElementById('sortSelect').value;
  if(sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title));
  else if(sort==='created')list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  else list.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  list.sort((a,b)=>(b.isPinned?1:0)-(a.isPinned?1:0));
  return list;
}

function renderNotes(){
  const list=getFilteredNotes();
  const grid=document.getElementById('notesGrid');
  const empty=document.getElementById('emptyState');
  document.getElementById('notesArea').classList.toggle('bulk-mode',bulkMode);
  
  const trashBar=document.getElementById('trashBar');
  if(trashBar){trashBar.style.display=(currentFilter==='trash'&&trash.length)?'flex':'none';document.getElementById('trashCountLabel').textContent=trash.length}
  
  if(!list.length){
    grid.innerHTML='';empty.style.display='flex';
    const isTrash=currentFilter==='trash';
    document.getElementById('emptyTitle').textContent=isTrash?'Trash is empty':'No notes';
    document.getElementById('emptyMsg').textContent=isTrash?'Deleted notes appear here':'Create a new note to get started';
    const emptyBtn = document.querySelector('#emptyState .empty-btn');
    if(emptyBtn) emptyBtn.style.display = isTrash ? 'none' : '';
    return;
  }
  empty.style.display='none';
  const isTrash=currentFilter==='trash';
  
  grid.innerHTML=list.map(n=>{
    const icon=LICON[n.language]||'📝';
    const lang=LANGS.find(l=>l.id===n.language);
    const ln=lang?lang.name.split(' ').slice(1).join(' '):'';
    const pv=n.isEncrypted?'':n.content.split('\n').filter(l=>l.trim()).slice(0,3).join('\n');
    const isSelected=selectedNotes.has(n.id);
    const fo=n.folderId?folders.find(f=>f.id===n.folderId):null;
    
    if(isTrash){
      return `<div class="note-card" onclick="showRestoreModal('${n.id}')">
        <div class="note-card-header"><span class="note-card-lang">${icon}</span><span class="note-card-title">${esc(n.title)}</span></div>
        <div class="note-card-preview">${esc(pv)||'<i style="color:var(--text3)">Empty</i>'}</div>
        <div class="note-card-footer"><span>Deleted ${timeAgo(n.trashedAt)}</span></div>
      </div>`;
    }
    
    return `<div class="note-card ${n.isPinned?'pinned':''} ${isSelected?'selected':''}" onclick="${bulkMode?`toggleSelect('${n.id}')`:`openEditor('${n.id}')`}" oncontextmenu="event.preventDefault();showNoteCtx(event,'${n.id}')" draggable="true" ondragstart="onNoteDragStart(event,'${n.id}')" ondragend="onNoteDragEnd(event)">
      <div class="select-check">${isSelected?'✓':''}</div>
      ${n.isPinned?`<div class="pin-badge">${I('pin')}</div>`:''}
      ${n.isEncrypted?`<div class="encrypted-badge">${I('lock')} Encrypted</div>`:''}
      <div class="note-card-header">
        <span class="note-card-lang">${icon}</span>
        <span class="note-card-title">${esc(n.title)}</span>
        <div class="note-card-actions">
          <button onclick="event.stopPropagation();duplicateNoteById('${n.id}')" title="Duplicate">${I('copy')}</button>
          <button class="${n.isPinned?'pin-on':''}" onclick="event.stopPropagation();togglePin('${n.id}')" title="${n.isPinned?'Unpin':'Pin'}">${I('pin')}</button>
          <button class="${n.isFavorite?'fav-on':''}" onclick="event.stopPropagation();toggleFav('${n.id}')" title="${n.isFavorite?'Unfavorite':'Favorite'}">${I('heart')}</button>
          <button onclick="event.stopPropagation();trashNoteById('${n.id}')" title="Delete">${I('trash')}</button>
        </div>
      </div>
      <div class="note-card-preview">${n.isEncrypted?`<i style="color:var(--text3)">${I('lock')} Content encrypted — unlock to view</i>`:(esc(pv)||'<i style="color:var(--text3)">Empty</i>')}</div>
      ${(n.tags||[]).length?'<div class="note-card-tags">'+n.tags.slice(0,3).map(t=>'<span class="tag">#'+esc(t)+'</span>').join('')+'</div>':''}
      <div class="note-card-footer">
        <span>${timeAgo(n.updatedAt)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${fo?'<span class="note-card-badge" style="display:inline-flex;align-items:center;gap:3px">'+I('folder')+esc(fo.name)+'</span>':''}
          ${n.shareUrl?'<span class="note-card-badge" style="color:var(--text2);display:inline-flex;align-items:center;gap:3px" title="Share link active">'+I('share')+'Shared</span>':''}
          <span class="note-card-badge">${ln}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  
  updateBulkBar();
}

// ===== BULK MODE =====
function toggleBulkMode(){bulkMode=!bulkMode;selectedNotes.clear();document.getElementById('bulkModeBtn').classList.toggle('active',bulkMode);renderNotes()}
function exitBulkMode(){bulkMode=false;selectedNotes.clear();document.getElementById('bulkModeBtn').classList.remove('active');document.getElementById('bulkBar').classList.remove('show');renderNotes()}
function toggleSelect(id){if(selectedNotes.has(id))selectedNotes.delete(id);else selectedNotes.add(id);renderNotes()}
function updateBulkBar(){
  document.getElementById('bulkCount').textContent=selectedNotes.size;
  document.getElementById('bulkBar').classList.toggle('show',bulkMode&&selectedNotes.size>0);
}
function bulkMoveToFolder(){
  document.getElementById('bulkMoveFolder').innerHTML=buildFolderSelect();
  document.getElementById('bulkMoveModal').style.display='flex';
}
function hideBulkMove(){document.getElementById('bulkMoveModal').style.display='none'}
function confirmBulkMove(){
  const fid=document.getElementById('bulkMoveFolder').value||null;
  if(window._moveOneMode&&window._moveOneId){
    const n=notes.find(x=>x.id===window._moveOneId);
    if(n)n.folderId=fid;
    window._moveOneMode=false;window._moveOneId=null;
  }else{
    selectedNotes.forEach(id=>{const n=notes.find(x=>x.id===id);if(n)n.folderId=fid});
    exitBulkMode();
  }
  saveAll();hideBulkMove();renderSidebar();renderNotes();
}
function bulkTrash(){
  selectedNotes.forEach(id=>{
    const i=notes.findIndex(x=>x.id===id);
    if(i>-1){const n=notes.splice(i,1)[0];n.trashedAt=new Date().toISOString();trash.push(n)}
  });
  saveAll();exitBulkMode();renderSidebar();renderNotes();
}

// ===== TRASH =====
function showRestoreModal(id){restoreNoteId=id;const n=trash.find(x=>x.id===id);document.getElementById('restoreMsg').textContent=`"${n?n.title:'Note'}" - restore or delete forever?`;document.getElementById('restoreModal').style.display='flex'}
function hideRestoreModal(){document.getElementById('restoreModal').style.display='none';restoreNoteId=null}
function confirmRestore(){
  if(restoreNoteId){
    const i=trash.findIndex(x=>x.id===restoreNoteId);
    if(i>-1){const n=trash.splice(i,1)[0];delete n.trashedAt;notes.push(n);saveAll();renderSidebar();renderNotes()}
  }
  hideRestoreModal();
}
function permanentDelete(){
  if(restoreNoteId){trash=trash.filter(x=>x.id!==restoreNoteId);saveAll();renderSidebar();renderNotes()}
  hideRestoreModal();
}
function showEmptyTrashModal(){document.getElementById('emptyTrashModal').style.display='flex'}
function hideEmptyTrashModal(){document.getElementById('emptyTrashModal').style.display='none'}
function confirmEmptyTrash(){trash=[];saveAll();renderSidebar();renderNotes();hideEmptyTrashModal()}

// ===== QUICK ACTIONS =====
function togglePin(id){const n=notes.find(x=>x.id===id);if(n){n.isPinned=!n.isPinned;n.updatedAt=new Date().toISOString();saveAll();renderSidebar();renderNotes()}}
function toggleFav(id){const n=notes.find(x=>x.id===id);if(n){n.isFavorite=!n.isFavorite;n.updatedAt=new Date().toISOString();saveAll();renderSidebar();renderNotes()}}
function duplicateNoteById(id){
  const n=notes.find(x=>x.id===id);
  if(n){const dup={...n,id:gid(),title:'Copy of '+n.title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),isPinned:false};notes.push(dup);saveAll();renderSidebar();renderNotes()}
}
function trashNoteById(id){trashNoteWithUndo(id)}

// ===== CONTEXT MENU =====
function hideCtx(){document.getElementById('ctxMenu').classList.remove('show')}
document.addEventListener('click',hideCtx);
document.addEventListener('scroll',hideCtx,true);

function showCtxAt(e,items){
  const menu=document.getElementById('ctxMenu');
  const itemsEl=document.getElementById('ctxItems');
  itemsEl.innerHTML=items.map(it=>{
    if(it==='---')return'<div class="ctx-divider"></div>';
    return`<button class="ctx-item ${it.danger?'danger':''}" onclick="hideCtx();${it.action}">${I(EMO[it.icon]||'info')} ${it.label}</button>`;
  }).join('');
  menu.classList.add('show');
  const mw=menu.offsetWidth,mh=menu.offsetHeight;
  let x=e.clientX,y=e.clientY;
  if(x+mw>innerWidth)x=innerWidth-mw-8;
  if(y+mh>innerHeight)y=innerHeight-mh-8;
  if(x<4)x=4;if(y<4)y=4;
  menu.style.left=x+'px';menu.style.top=y+'px';
}

function showNoteCtx(e,id){
  e.stopPropagation();
  const n=notes.find(x=>x.id===id);
  if(!n)return;
  const items=[
    {icon:'📝',label:'Open',action:`openEditor('${id}')`},
  ];
  if(!n.isEncrypted){
    items.push({icon:'👁️',label:'Quick Preview',action:`quickPreview('${id}')`});
  }else{
    items.push({icon:'🔒',label:'Encrypted (unlock to preview)',action:'',danger:false});
  }
  items.push('---');
  items.push({icon:n.isPinned?'📌':'📍',label:n.isPinned?'Unpin':'Pin to Top',action:`togglePin('${id}')`});
  items.push({icon:n.isFavorite?'💔':'❤️',label:n.isFavorite?'Remove Favorite':'Add to Favorites',action:`toggleFav('${id}')`});
  items.push({icon:'📋',label:'Duplicate',action:`duplicateNoteById('${id}')`});
  items.push('---');
  items.push({icon:'📁',label:'Move to Folder',action:`showMoveOne('${id}')`});
  items.push({icon:'📄',label:'Export as .md',action:`exportNoteByIdMd('${id}')`});
  if(!n.isEncrypted){
    if(n.shareUrl){
      items.push({icon:'🔗',label:'View Share Link',action:`shareNoteById('${id}')`});
      items.push({icon:'🗑️',label:'Disable Share Link',action:`deleteShareById('${id}')`,danger:true});
    }else{
      items.push({icon:'🔗',label:'Share via Link',action:`shareNoteById('${id}')`});
    }
  }
  items.push('---');
  items.push({icon:'🗑️',label:'Move to Trash',action:`trashNoteById('${id}')`,danger:true});
  showCtxAt(e,items);
}

document.getElementById('notesArea').addEventListener('contextmenu',function(e){
  if(e.target.closest('.note-card'))return;
  e.preventDefault();
  const items=[
    {icon:'📝',label:'New Note',action:'openEditor()'},
    {icon:'📝',label:'From Template',action:'showTemplates()'},
    {icon:'📁',label:'New Folder',action:'showFolderModal()'},
    '---',
    {icon:'📊',label:'Statistics',action:'openStats()'},
    {icon:'💾',label:'Export All (JSON)',action:'exportAllJSON()'},
    {icon:'📥',label:'Import Notes',action:'showImportModal()'},
  ];
  showCtxAt(e,items);
});

function quickPreview(id){
  const n=notes.find(x=>x.id===id);
  if(!n||n.isEncrypted)return;
  const html=renderMarkdown(n.content, id);
  const modal=document.createElement('div');
  modal.className='modal-bg';
  modal.onclick=e=>{if(e.target===modal)modal.remove()};
  modal.innerHTML=`<div class="modal" style="max-width:600px;max-height:85vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h3 style="font-size:16px">${esc(n.title)}</h3>
      <div style="display:flex;gap:4px">
        <button class="btn-primary" onclick="this.closest('.modal-bg').remove();openEditor('${id}')">${I('edit')} Edit</button>
        <button class="btn-secondary" onclick="this.closest('.modal-bg').remove()">${I('x')}</button>
      </div>
    </div>
    <div class="preview" style="font-size:13px">${html}</div>
  </div>`;
  document.body.appendChild(modal);
}

function showMoveOne(id){
  window._moveOneId=id;
  document.getElementById('bulkMoveFolder').innerHTML=buildFolderSelect();
  const n=notes.find(x=>x.id===id);
  if(n)document.getElementById('bulkMoveFolder').value=n.folderId||'';
  document.getElementById('bulkMoveModal').style.display='flex';
  window._moveOneMode=true;
}

function exportNoteByIdMd(id){
  const n=notes.find(x=>x.id===id);
  if(!n)return;
  if(n.isEncrypted){alert('Unlock the note first to export.');return}
  download(n.title.replace(/[^a-z0-9]/gi,'_')+'.md',n.content,'text/markdown');
}

// ===== AUTO-SAVE ENGINE =====
function triggerAutoSave(){
  if(!document.getElementById('editorWrap').classList.contains('open')) return;
  if(window._isLocked) return;
  
  const badge=document.getElementById('autoSaveBadge');
  if(badge) badge.innerHTML='<span style="opacity:0.7">Saving...</span>';
  
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(()=>{
    performAutoSave();
  }, 700);
}

async function performAutoSave(){
  if(window._isLocked) return;
  const titleInp=document.getElementById('editorTitle');
  if(!titleInp) return;
  let title=titleInp.value.trim();
  const ta=document.getElementById('editorTextarea');
  const plainContent=ta?ta.value:(window._backup||'');
  const language=document.getElementById('editorLang').value;
  const folderId=document.getElementById('editorFolder').value||null;
  const now=new Date().toISOString();

  if(!title && !plainContent.trim()) return; // Don't auto-save empty placeholder note
  if(!title) title='Untitled';

  if(editingId){
    const n=notes.find(x=>x.id===editingId);
    if(n){
      if(n.isEncrypted){
        if(window._isLocked){
          // Note is locked, preserve ciphertext
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }else if(window._activeNotePassword){
          // Note is unlocked with active password -> re-encrypt content before saving to storage
          try{
            const encrypted=await encryptText(plainContent,window._activeNotePassword);
            n.content=encrypted;
            window._encryptedContent=encrypted;
          }catch(e){
            console.error('Auto-save encryption error:',e);
          }
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }else{
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }
      }else{
        Object.assign(n,{title,content:plainContent,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
      }
    }
  }else{
    // New draft note auto-save: assign ID so subsequent edits update the same note
    editingId=gid();
    notes.unshift({id:editingId,title,content:plainContent,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,createdAt:now,updatedAt:now});
    document.getElementById('delBtn').style.display='';
    document.getElementById('dupBtn').style.display='';
    document.getElementById('exportBtn').style.display='';
    document.getElementById('pdfBtn').style.display='';
    document.getElementById('copyMdBtn').style.display='';
    document.getElementById('shareBtn').style.display='';
    document.getElementById('lockBtn').style.display='';
    document.getElementById('editorLabel').textContent='Edit Note';
    addTab(editingId, title);
  }
  
  saveAll();
  renderSidebar();
  renderNotes();
  const badge=document.getElementById('autoSaveBadge');
  if(badge) badge.innerHTML='<span style="color:var(--green)">✓ Auto-saved</span>';
  
  if(editingId){
    const curr = notes.find(x=>x.id===editingId);
    if(curr) syncSharedNoteToCloudflare(curr);
  }
}

// ===== EDITOR =====
function openEditor(id){
  if(currentFilter==='trash')return;
  closeStats();
  editingId=id||null;
  const wrap=document.getElementById('editorWrap');
  const titleEl=document.getElementById('editorTitle');
  let textEl=document.getElementById('editorTextarea');
  const langEl=document.getElementById('editorLang');
  const folderEl=document.getElementById('editorFolder');
  const label=document.getElementById('editorLabel');
  const autoSaveBadge=document.getElementById('autoSaveBadge');
  if(autoSaveBadge) autoSaveBadge.innerHTML='';
  
  folderEl.innerHTML=buildFolderSelect();
  buildLangSelect();
  
  if(!textEl){
    textEl=document.createElement('textarea');
    textEl.className='editor-textarea';textEl.id='editorTextarea';textEl.spellcheck=false;
    textEl.placeholder="Start writing... Use [[Note Name]] to link notes!";
    textEl.addEventListener('input',onEditorInput);
    document.getElementById('editorContent').appendChild(textEl);
  }
  
  document.getElementById('encryptedOverlay').style.display='none';
  document.getElementById('decryptError').style.display='none';
  document.getElementById('decryptPassword').value='';
  window._isLocked=false;
  window._isEncrypted=false;
  window._activeNotePassword=null;
  window._encryptedContent=null;

  if(id){
    const n=notes.find(x=>x.id===id);if(!n)return;
    titleEl.value=n.title;
    if(langEl) langEl.value=n.language||'markdown';
    folderEl.value=n.folderId||'';
    editorPinned=n.isPinned;editorFav=n.isFavorite;editorTags=[...(n.tags||[])];
    label.textContent='Edit Note';
    document.getElementById('delBtn').style.display='';
    document.getElementById('dupBtn').style.display='';
    document.getElementById('exportBtn').style.display='';
    document.getElementById('pdfBtn').style.display='';
    document.getElementById('copyMdBtn').style.display='';
    document.getElementById('shareBtn').style.display='';
    document.getElementById('lockBtn').style.display='';
    
    if(n.isEncrypted){
      window._isLocked=true;
      window._isEncrypted=true;
      window._encryptedContent=n.content;
      textEl.value='';
      document.getElementById('encryptedOverlay').style.display='flex';
      document.getElementById('lockBtn').innerHTML=I('lock');
      document.getElementById('lockBtn').title='Encrypted - Click to remove encryption';
    }else{
      textEl.value=n.content||'';
      document.getElementById('lockBtn').innerHTML=I('unlock');
      document.getElementById('lockBtn').title='Encrypt this note';
    }
  }else{
    titleEl.value='';textEl.value='';
    if(langEl) langEl.value='markdown';
    folderEl.value=currentFolderId||'';
    editorPinned=false;editorFav=false;editorTags=[];
    label.textContent='New Note';
    document.getElementById('delBtn').style.display='none';
    document.getElementById('dupBtn').style.display='none';
    document.getElementById('exportBtn').style.display='none';
    document.getElementById('pdfBtn').style.display='none';
    document.getElementById('copyMdBtn').style.display='none';
    document.getElementById('shareBtn').style.display='none';
    document.getElementById('lockBtn').style.display='none';
  }
  window._backup=textEl.value;
  updateEditorIcon();updateEditorPinFav();renderEditorTags();onEditorInput();setMode('edit');updateBacklinks();
  wrap.classList.add('open');
  if(id){const n=notes.find(x=>x.id===id);if(n)addTab(id,n.title)}else{renderTabs()}
  setTimeout(()=>{
    if(!window._isLocked)titleEl.focus();else document.getElementById('decryptPassword').focus();
    setupLineNumbers();
    updateEditorStats();
  },120);
  textEl.addEventListener('keydown',editorKeys);
  titleEl.oninput=()=>triggerAutoSave();
}
function editorKeys(e){
  if((e.metaKey||e.ctrlKey)&&e.key==='b'&&!e.shiftKey){e.preventDefault();toggleSidebarCollapse(e)}
  if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();saveNote()}
  if(e.key==='Tab'){e.preventDefault();const t=e.target,s=t.selectionStart;t.value=t.value.slice(0,s)+'  '+t.value.slice(t.selectionEnd);t.selectionStart=t.selectionEnd=s+2;onEditorInput()}
}
function closeEditor(){
  clearTimeout(autoSaveTimer);
  document.getElementById('editorWrap').classList.remove('open');
  editingId=null;activeTabId=null;openTabs=[];tabContents={};
  window._isLocked=false;
  window._isEncrypted=false;
  window._activeNotePassword=null;
  window._encryptedContent=null;
  document.getElementById('tabsBar').innerHTML='';
  removeLineNumbers();
  const t=document.getElementById('editorTextarea');if(t)t.removeEventListener('keydown',editorKeys);
}
function updateEditorIcon(){document.getElementById('editorLangIcon').textContent=LICON[document.getElementById('editorLang').value]||'📝'}
function toggleEditorPin(){editorPinned=!editorPinned;updateEditorPinFav();triggerAutoSave()}
function toggleEditorFav(){editorFav=!editorFav;updateEditorPinFav();triggerAutoSave()}
function updateEditorPinFav(){
  const pb=document.getElementById('pinBtn');pb.style.background=editorPinned?'var(--brand-light)':'';pb.classList.toggle('pin-on',editorPinned);
  const fb=document.getElementById('favBtn');fb.style.background=editorFav?'var(--red-light)':'';fb.classList.toggle('fav-on',editorFav);
}
function renderEditorTags(){
  const wrap=document.getElementById('tagsWrap'),inp=document.getElementById('tagInput');
  wrap.querySelectorAll('.tag').forEach(t=>t.remove());
  editorTags.forEach(t=>{const s=document.createElement('span');s.className='tag';s.innerHTML=`#${esc(t)}<span class="remove" onclick="removeTag('${esc(t)}')">&times;</span>`;wrap.insertBefore(s,inp)});
}
function onTagKey(e){if(e.key==='Enter'){e.preventDefault();const v=e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');if(v&&!editorTags.includes(v)){editorTags.push(v);renderEditorTags();triggerAutoSave()}e.target.value=''}}
function removeTag(t){editorTags=editorTags.filter(x=>x!==t);renderEditorTags();triggerAutoSave()}

function setMode(m){
  editorMode=m;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  const content=document.getElementById('editorContent');
  let ta=document.getElementById('editorTextarea');
  if(!ta){ta=document.createElement('textarea');ta.className='editor-textarea';ta.id='editorTextarea';ta.spellcheck=false;ta.value=window._backup||'';ta.placeholder="Start writing... Use [[Note Name]] to link notes!";ta.addEventListener('input',onEditorInput);ta.addEventListener('keydown',editorKeys)}
  window._backup=ta.value;
  const text=ta.value;
  if(ta.parentNode)ta.parentNode.removeChild(ta);
  content.innerHTML='';
  if(m==='edit'){content.appendChild(ta);setTimeout(setupLineNumbers,10)}
  else if(m==='preview'){removeLineNumbers();const d=document.createElement('div');d.className='editor-preview preview';d.innerHTML=renderMarkdown(text, editingId);content.appendChild(d)}
  else{const dv=document.createElement('div');dv.className='split-divider';const pv=document.createElement('div');pv.className='editor-preview preview';pv.innerHTML=renderMarkdown(text, editingId);content.appendChild(ta);content.appendChild(dv);content.appendChild(pv);setTimeout(setupLineNumbers,10)}
}
function onEditorInput(){
  updateLineNumbers();
  updateEditorStats();
  updateTocDock();
  updateZenStats();
  if(editorMode==='split'||editorMode==='preview')renderEditorPreview();
  if(editorMode==='preview')syncScroll(document.getElementById('editorTextarea'));
  updateBacklinks();
  triggerAutoSave();
}
function insertMd(b,a){
  const ta=document.getElementById('editorTextarea');if(!ta)return;
  const s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.slice(s,e);
  const bb=b.replace(/\\n/g,'\n'),aa=a.replace(/\\n/g,'\n');
  ta.value=ta.value.slice(0,s)+bb+sel+aa+ta.value.slice(e);
  ta.selectionStart=s+bb.length;ta.selectionEnd=s+bb.length+sel.length;
  ta.focus();onEditorInput();
}
function insertObsidianCodeBlock(){
  const ta = document.getElementById('editorTextarea');
  if(!ta) return;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const val = ta.value;
  const sel = val.slice(s, e);
  
  if(sel){
    const before = val.slice(0, s);
    const after = val.slice(e);
    const needsPrefixNl = before.length > 0 && !before.endsWith('\n');
    const needsSuffixNl = after.length > 0 && !after.startsWith('\n');
    
    const formatted = (needsPrefixNl ? '\n' : '') + '```\n' + sel + '\n```' + (needsSuffixNl ? '\n' : '');
    ta.value = before + formatted + after;
    const newStart = s + (needsPrefixNl ? 1 : 0) + 4;
    ta.selectionStart = newStart;
    ta.selectionEnd = newStart + sel.length;
  } else {
    const before = val.slice(0, s);
    const after = val.slice(e);
    const needsPrefixNl = before.length > 0 && !before.endsWith('\n');
    const needsSuffixNl = after.length > 0 && !after.startsWith('\n');
    
    const block = (needsPrefixNl ? '\n' : '') + '```\n\n```' + (needsSuffixNl ? '\n' : '');
    ta.value = before + block + after;
    const cursorPos = s + (needsPrefixNl ? 1 : 0) + 4;
    ta.selectionStart = cursorPos;
    ta.selectionEnd = cursorPos;
  }
  ta.focus();
  onEditorInput();
}
function insertCodeBlock(){
  insertObsidianCodeBlock();
}

function toggleBacklinks(){document.getElementById('backlinksPanel').classList.toggle('show')}
function updateBacklinks(){
  const panel=document.getElementById('backlinksList');
  const title=(document.getElementById('editorTitle')?.value || '').trim();
  if(!title){panel.innerHTML='<div style="font-size:11px;color:var(--text3)">Save note first</div>';return}
  const links=notes.filter(n=>n.id!==editingId&&n.content.includes(`[[${title}]]`));
  if(!links.length)panel.innerHTML='<div style="font-size:11px;color:var(--text3)">No backlinks</div>';
  else panel.innerHTML=links.map(n=>`<div class="backlink-item" onclick="openEditor('${n.id}')">${esc(n.title)}</div>`).join('');
}

async function saveNote(){
  clearTimeout(autoSaveTimer);
  let title=(document.getElementById('editorTitle')?.value || '').trim();
  const ta=document.getElementById('editorTextarea');
  const plainContent=ta?ta.value:(window._backup||'');
  if(!title && !plainContent.trim()){
    document.getElementById('editorTitle').style.boxShadow='0 0 0 2px var(--red)';
    setTimeout(()=>document.getElementById('editorTitle').style.boxShadow='',2000);
    return;
  }
  if(!title) title='Untitled note';
  const language=document.getElementById('editorLang')?.value || 'general';
  const folderId=document.getElementById('editorFolder')?.value || null;
  const now=new Date().toISOString();
  if(editingId){
    const n=notes.find(x=>x.id===editingId);
    if(n){
      if(n.isEncrypted){
        if(window._isLocked){
          // Note is locked in editor, preserve stored ciphertext
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }else if(window._activeNotePassword){
          // Unlocked with password, re-encrypt content before saving
          try{
            const encrypted=await encryptText(plainContent,window._activeNotePassword);
            n.content=encrypted;
            window._encryptedContent=encrypted;
          }catch(e){
            console.error('Save encryption error:',e);
          }
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }else{
          Object.assign(n,{title,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
        }
      }else{
        Object.assign(n,{title,content:plainContent,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,updatedAt:now});
      }
    }
  }else{
    notes.unshift({id:gid(),title,content:plainContent,language,folderId,tags:[...editorTags],isPinned:editorPinned,isFavorite:editorFav,createdAt:now,updatedAt:now});
  }
  saveAll();renderSidebar();renderNotes();closeEditor();
  showToast(I('check') + ' Note saved successfully');
  
  if(editingId){
    const savedNote = notes.find(x=>x.id===editingId);
    if(savedNote) syncSharedNoteToCloudflare(savedNote);
  }
}
function showDeleteConfirm(){document.getElementById('deleteModal').style.display='flex'}
function hideDeleteConfirm(){document.getElementById('deleteModal').style.display='none'}
function confirmDelete(){
  if(editingId){
    const i=notes.findIndex(x=>x.id===editingId);
    if(i>-1){const n=notes.splice(i,1)[0];n.trashedAt=new Date().toISOString();trash.push(n);saveAll();renderSidebar();renderNotes()}
  }
  hideDeleteConfirm();closeEditor();
}
function duplicateNote(){
  if(!editingId)return;
  const n=notes.find(x=>x.id===editingId);
  if(n){
    if(n.isEncrypted && window._isLocked){
      showToast('⚠️ Please unlock the note first before duplicating');
      return;
    }
    const ta=document.getElementById('editorTextarea');
    const content=ta?ta.value:(window._backup||'');
    const dup={...n,id:gid(),title:'Copy of '+n.title,content:content,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),isPinned:false};
    if(n.isEncrypted && window._activeNotePassword){
      encryptText(content,window._activeNotePassword).then(enc=>{
        dup.content=enc;
        notes.push(dup);saveAll();renderSidebar();renderNotes();openEditor(dup.id);
      }).catch(()=>{
        notes.push(dup);saveAll();renderSidebar();renderNotes();openEditor(dup.id);
      });
    }else{
      notes.push(dup);saveAll();renderSidebar();renderNotes();openEditor(dup.id);
    }
  }
}
function exportNoteMd(){
  if(window._isLocked){showToast('⚠️ Please unlock the note first');return;}
  const title=document.getElementById('editorTitle').value||'note';
  const ta=document.getElementById('editorTextarea');
  const content=ta?ta.value:(window._backup||'');
  download(title.replace(/[^a-z0-9]/gi,'_')+'.md',content,'text/markdown');
}
function copyEditorMarkdown(){
  if(window._isLocked){showToast('⚠️ Please unlock the note first');return;}
  const title=(document.getElementById('editorTitle')?.value||'').trim();
  const ta=document.getElementById('editorTextarea');
  const content=ta?ta.value:(window._backup||'');
  const full=(title?'# '+title+'\n\n':'')+content;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(full).then(()=>showToast(I('check')+' Note copied to clipboard')).catch(()=>showToast(I('check')+' Note copied'));
  }else{
    const el=document.createElement('textarea');el.value=full;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);
    showToast(I('check')+' Note copied to clipboard');
  }
}
function exportNotePdf(){
  if(window._isLocked){showToast('⚠️ Please unlock the note first');return;}
  const title=document.getElementById('editorTitle').value||'Note';
  const ta=document.getElementById('editorTextarea');
  const content=ta?ta.value:(window._backup||'');
  const tags=editorTags.length?'<p style="margin-bottom:12px">'+editorTags.map(t=>'<span style="background:#f3f4f6;color:#18181b;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;margin-right:4px;border:1px solid #e5e7eb">#'+esc(t)+'</span>').join('')+'</p>':'';
  const htmlContent=renderMarkdown(content);
  const win=window.open('','_blank');
  if(!win){alert('Please allow popups to export PDF');return}
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>
  body{font-family:'Inter',ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 30px;color:#1d1d1f;font-size:14px;line-height:1.7;-webkit-font-smoothing:antialiased;letter-spacing:-0.011em}
  h1{font-size:26px;font-weight:700;margin:0 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:10px}
  h2{font-size:20px;font-weight:600;margin:22px 0 8px}
  h3{font-size:16px;font-weight:600;margin:16px 0 6px}
  p{margin-bottom:10px}
  ul,ol{padding-left:24px;margin-bottom:10px}
  li{margin-bottom:4px}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'Source Code Pro',Menlo,Consolas,monospace;font-size:12px}
  pre{background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;margin-bottom:12px;overflow-x:auto;font-family:'Source Code Pro',Menlo,Consolas,monospace;font-size:12px;line-height:1.5}
  pre code{background:none;padding:0;color:inherit}
  blockquote{border-left:3px solid #18181b;padding-left:14px;margin-bottom:10px;color:#4b5563;font-style:italic}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left;font-size:12px}
  th{background:#f9fafb;font-weight:600}
  hr{border:none;border-top:1px solid #e5e7eb;margin:18px 0}
  a{color:#18181b;font-weight:600;text-decoration:underline}
  img{max-width:100%;border-radius:6px}
  .meta{font-size:11px;color:#9ca3af;margin-bottom:16px}
  .note-link{background:#f3f4f6;padding:1px 6px;border-radius:4px;color:#18181b;border:1px solid #e5e7eb;text-decoration:none;font-weight:500}
  .run-btn,.code-output,.code-output-label{display:none}
  @media print{body{padding:20px}pre{white-space:pre-wrap}}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">Exported from DevNotes · ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
${tags}
${htmlContent}
</body></html>`);
  win.document.close();
  setTimeout(()=>{win.print()},400);
}

// ===== ENCRYPTION =====
async function deriveKey(password,salt){
  const enc=new TextEncoder();
  const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptText(text,password){
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password,salt);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(text));
  return JSON.stringify({v:1,salt:btoa(String.fromCharCode(...salt)),iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(encrypted)))});
}
function isEncryptedPayload(str){
  if(typeof str !== 'string') return false;
  const trimmed = str.trim();
  if(!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try{
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed.salt === 'string' && typeof parsed.iv === 'string' && typeof parsed.data === 'string';
  }catch(e){
    return false;
  }
}
async function decryptText(encryptedJson,password){
  if(!isEncryptedPayload(encryptedJson)){
    // Note was stored in plain text due to earlier auto-save bug: return content directly for self-healing
    return encryptedJson || '';
  }
  const{salt,iv,data}=JSON.parse(encryptedJson);
  const saltArr=new Uint8Array(atob(salt).split('').map(c=>c.charCodeAt(0)));
  const ivArr=new Uint8Array(atob(iv).split('').map(c=>c.charCodeAt(0)));
  const dataArr=new Uint8Array(atob(data).split('').map(c=>c.charCodeAt(0)));
  const key=await deriveKey(password,saltArr);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:ivArr},key,dataArr);
  return new TextDecoder().decode(decrypted);
}
function toggleEncryption(){
  if(!editingId)return;
  const n=notes.find(x=>x.id===editingId);
  if(!n)return;
  if(n.isEncrypted){
    if(window._isLocked){
      alert('Please unlock the note with your password first before removing encryption.');
      return;
    }
    if(confirm('Remove encryption from this note? It will be saved as plain text.')){
      n.isEncrypted=false;
      n.content=document.getElementById('editorTextarea').value;
      n.updatedAt=new Date().toISOString();
      saveAll();
      document.getElementById('lockBtn').innerHTML=I('unlock');
      document.getElementById('lockBtn').title='Encrypt this note';
      window._activeNotePassword=null;
      window._isLocked=false;
      window._isEncrypted=false;
      renderNotes();
      showToast(I('unlock') + ' Encryption removed from note');
    }
  }else{
    showEncryptModal();
  }
}
function showEncryptModal(){
  document.getElementById('encryptPassword').value='';
  document.getElementById('encryptPasswordConfirm').value='';
  document.getElementById('encryptError').style.display='none';
  document.getElementById('encryptModalTitle').innerHTML=I('lock')+' Encrypt Note';
  document.getElementById('encryptModalMsg').innerHTML='Enter a password to protect this note.<br><strong>If you forget it, the note cannot be recovered!</strong>';
  document.getElementById('encryptModal').style.display='flex';
  setTimeout(()=>document.getElementById('encryptPassword').focus(),100);
}
function hideEncryptModal(){document.getElementById('encryptModal').style.display='none'}
async function confirmEncrypt(){
  const pw=document.getElementById('encryptPassword').value;
  const pw2=document.getElementById('encryptPasswordConfirm').value;
  const errEl=document.getElementById('encryptError');
  if(!pw||pw.length<4){errEl.textContent='Password must be at least 4 characters';errEl.style.display='block';return}
  if(pw!==pw2){errEl.textContent='Passwords do not match';errEl.style.display='block';return}
  const ta=document.getElementById('editorTextarea');
  const content=ta?ta.value:'';
  if(!content.trim()){errEl.textContent='Cannot encrypt empty note';errEl.style.display='block';return}
  try{
    const encrypted=await encryptText(content,pw);
    const n=notes.find(x=>x.id===editingId);
    if(n){
      n.content=encrypted;
      n.isEncrypted=true;
      n.updatedAt=new Date().toISOString();
      window._activeNotePassword=pw;
      window._isLocked=false;
      window._isEncrypted=false;
      window._encryptedContent=encrypted;
      saveAll();
      document.getElementById('lockBtn').innerHTML=I('lock');
      document.getElementById('lockBtn').title='Encrypted - Click to remove encryption';
      renderNotes();
      hideEncryptModal();
      showToast(I('lock') + ' Note encrypted successfully! Keep your password safe.');
    }
  }catch(e){errEl.textContent='Encryption failed: '+e.message;errEl.style.display='block'}
}
async function attemptDecrypt(){
  const pw=document.getElementById('decryptPassword').value;
  const errEl=document.getElementById('decryptError');
  if(!pw){errEl.textContent='Enter password';errEl.style.display='block';return}
  try{
    const decrypted=await decryptText(window._encryptedContent,pw);
    window._activeNotePassword=pw;
    window._isLocked=false;
    window._isEncrypted=false;
    const ta=document.getElementById('editorTextarea');
    if(ta)ta.value=decrypted;
    window._backup=decrypted;
    document.getElementById('encryptedOverlay').style.display='none';
    document.getElementById('decryptPassword').value='';
    errEl.style.display='none';
    
    // If note was stored in plaintext due to earlier bug, re-encrypt it now
    if(!isEncryptedPayload(window._encryptedContent)&&editingId){
      const n=notes.find(x=>x.id===editingId);
      if(n&&n.isEncrypted){
        const reEncrypted=await encryptText(decrypted,pw);
        n.content=reEncrypted;
        window._encryptedContent=reEncrypted;
        saveAll();
      }
    }
    
    onEditorInput();
    setMode('edit');
    document.getElementById('editorTitle').focus();
    showToast(I('unlock') + ' Note unlocked successfully');
  }catch(e){
    errEl.textContent='Incorrect password. Please try again.';
    errEl.style.display='block';
    document.getElementById('decryptPassword').value='';
    document.getElementById('decryptPassword').focus();
  }
}

// ===== TEMPLATES =====
function buildTemplates(){
  document.getElementById('templatesGrid').innerHTML=TEMPLATES.map((t,i)=>`<div class="template-card" onclick="useTemplate(${i})"><div class="t-icon">${I(EMO[t.icon]||'file-text')}</div><div class="t-name">${t.name}</div></div>`).join('');
}
function showTemplates(){document.getElementById('templatesModal').style.display='flex'}
function hideTemplates(){document.getElementById('templatesModal').style.display='none'}
function useTemplate(i){
  hideTemplates();
  openEditor();
  setTimeout(()=>{
    const t=TEMPLATES[i];
    document.getElementById('editorTitle').value=t.name;
    const ta=document.getElementById('editorTextarea');
    if(ta)ta.value=t.content;
    onEditorInput();
  },150);
}

// ===== IMPORT/EXPORT =====
function exportAllJSON(){
  const data={notes,folders,trash,exportedAt:new Date().toISOString()};
  download('devnotes-backup-'+new Date().toISOString().split('T')[0]+'.json',JSON.stringify(data,null,2),'application/json');
}
function showImportModal(){document.getElementById('importModal').style.display='flex';document.getElementById('importStatus').textContent=''}
function hideImportModal(){document.getElementById('importModal').style.display='none'}
function setupDropZone(){
  const dz=document.getElementById('dropZone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover')});
  dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');handleFiles(e.dataTransfer.files)});
}
function handleFiles(files){
  let imported=0;
  Array.from(files).forEach(f=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const content=e.target.result;
      if(f.name.endsWith('.json')){
        try{
          const data=JSON.parse(content);
          if(data.notes)data.notes.forEach(n=>{n.id=gid();notes.push(n);imported++});
          if(data.folders)data.folders.forEach(fo=>{if(!folders.find(x=>x.name===fo.name)){fo.id=gid();folders.push(fo)}});
        }catch{}
      }else{
        notes.push({id:gid(),title:f.name.replace(/\.(md|txt)$/,''),content,language:'markdown',folderId:null,tags:[],isPinned:false,isFavorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
        imported++;
      }
      document.getElementById('importStatus').textContent=`Imported ${imported} note(s)`;
      saveAll();renderSidebar();renderNotes();
    };
    reader.readAsText(f);
  });
}
function download(filename,content,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=filename;a.click();
}

// ===== MARKDOWN & INTERACTIVE TASKS =====
let cbc=0;
function renderMarkdown(text, noteId=null){
  if(!text)return'<p style="color:var(--text3)">Start writing...</p>';
  cbc=0;let h=text;
  h=h.replace(/\r\n/g, '\n');
  h=h.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  
  // 1. Pre-extract Code Blocks so their lines never get wrapped in <p> tags
  const codeBlocks = [];
  h=h.replace(/```([a-zA-Z0-9_+#.-]*)\n([\s\S]*?)```/g,(_,l,c)=>{
    cbc++;
    const id='cb-'+cbc;
    const lang = (l || '').toLowerCase();
    const canRun = ['javascript','js','ts','jsx','tsx','node','json','html','htm','svg','python','py'].includes(lang);
    const ph = `__CODE_BLOCK_${codeBlocks.length}__`;
    const label = l ? esc(l) : 'code';
    
    const blockHtml = `<div class="code-box">` +
      `<div class="code-box-header">` +
        `<span class="code-box-lang">${label}</span>` +
        `<div class="code-box-actions">` +
          (canRun ? `<button class="run-btn" onclick="runCode(this,'${id}','${lang}')">▶ Run</button>` : '') +
          `<button class="code-copy-btn" onclick="copyCodeBlock(this,'${id}')" title="Copy code to clipboard"><svg class="ic"><use href="#i-copy"/></svg> <span>Copy</span></button>` +
        `</div>` +
      `</div>` +
      `<pre><code id="${id}">${c.trim()}</code></pre>` +
    `</div>`;
    codeBlocks.push(blockHtml);
    return `\n${ph}\n`;
  });

  const headings=[];
  h.replace(/^(#{1,3}) (.+)$/gm,(m,hashes,title)=>{headings.push({level:hashes.length,title,id:'h-'+headings.length})});
  let toc='';
  if(headings.length>2){
    toc='<div class="toc"><div class="toc-title">📖 Contents</div>'+headings.map(x=>`<a class="toc-item h${x.level}" onclick="document.getElementById('${x.id}').scrollIntoView({behavior:'smooth'})">${x.title}</a>`).join('')+'</div>';
  }
  let hi=0;
  h=h.replace(/^(#{1,3}) (.+)$/gm,(m,hashes,title)=>{const id='h-'+hi++;const tag='h'+hashes.length;return`<${tag} id="${id}">${title}</${tag}>`});
  
  h=h.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  
  h=h.replace(/\[\[([^\]]+)\]\]/g,(m,name)=>{
    const note=notes.find(n=>n.title.toLowerCase()===name.toLowerCase());
    if(note)return`<a class="note-link" onclick="openEditor('${note.id}')">${esc(name)}</a>`;
    return`<span class="note-link broken" title="Note not found">${esc(name)}</span>`;
  });
  
  h=h.replace(/\*\*\*(.+?)\*\*\*/g,'<b><i>$1</i></b>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  h=h.replace(/\*(.+?)\*/g,'<i>$1</i>');
  h=h.replace(/~~(.+?)~~/g,'<del>$1</del>');
  h=h.replace(/^---$/gm,'<hr>');
  h=h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  h=h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1">');
  h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  
  // Interactive Task Checkboxes
  let taskCounter=0;
  h=h.replace(/^- \[x\] (.+)$/gm, (m, label) => {
    const idx = taskCounter++;
    return `<div><input type="checkbox" checked onchange="togglePreviewTask(event, ${idx}, '${noteId||''}')"> <span style="text-decoration:line-through;opacity:0.75">${label}</span></div>`;
  });
  h=h.replace(/^- \[ \] (.+)$/gm, (m, label) => {
    const idx = taskCounter++;
    return `<div><input type="checkbox" onchange="togglePreviewTask(event, ${idx}, '${noteId||''}')"> <span>${label}</span></div>`;
  });
  
  h=h.replace(/^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm,(_,hd,bd)=>{const ths=hd.split('|').map(x=>`<th>${x.trim()}</th>`).join('');const rows=bd.trim().split('\n').map(r=>`<tr>${r.replace(/^\||\|$/g,'').split('|').map(c=>`<td>${c.trim()}</td>`).join('')}</tr>`).join('');return`<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`});
  h=h.replace(/^((?:- (?!\[).+\n?)+)/gm,m=>`<ul>${m.trim().split('\n').map(l=>`<li>${l.replace(/^- /,'')}</li>`).join('')}</ul>\n`);
  h=h.replace(/^((?:\d+\. .+\n?)+)/gm,m=>{
    const lines = m.trim().split('\n');
    const firstMatch = lines[0].match(/^(\d+)\.\s*/);
    const startNum = firstMatch ? firstMatch[1] : '1';
    const startAttr = startNum !== '1' ? ` start="${startNum}"` : '';
    const lis = lines.map(l=>{
      const numMatch = l.match(/^(\d+)\.\s+(.*)$/);
      if(numMatch){
        return `<li value="${numMatch[1]}">${numMatch[2]}</li>`;
      }
      return `<li>${l}</li>`;
    }).join('');
    return `<ol${startAttr}>${lis}</ol>\n`;
  });
  h=h.replace(/^(?!<[a-z/]|__CODE_BLOCK_)(.+)$/gm,'<p>$1</p>');
  h=h.replace(/<p>\s*<\/p>/g,'');

  // Restore Code Blocks intact without extra paragraph margins
  codeBlocks.forEach((codeHtml, idx) => {
    h = h.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
  });

  return toc+h;
}

function copyCodeBlock(btn, id){
  const el = document.getElementById(id);
  if(!el) return;
  const text = el.textContent;
  const finish = () => {
    btn.classList.add('copied');
    const span = btn.querySelector('span');
    const orig = span ? span.textContent : 'Copy';
    if(span) span.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      if(span) span.textContent = orig;
    }, 2000);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(finish).catch(() => {
      fallbackCopy(text);
      finish();
    });
  } else {
    fallbackCopy(text);
    finish();
  }
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
}

// Toggle Task in Preview
function togglePreviewTask(e, taskIndex, targetNoteId){
  let rawContent = '';
  let noteObj = null;
  const isCurrentlyEditing = (editingId && (!targetNoteId || targetNoteId === editingId));

  if(isCurrentlyEditing){
    const ta = document.getElementById('editorTextarea');
    rawContent = ta ? ta.value : (window._backup || '');
  } else if(targetNoteId){
    noteObj = notes.find(n => n.id === targetNoteId);
    if(noteObj) rawContent = noteObj.content;
  }

  if(!rawContent) return;

  let currentIdx = 0;
  const updatedContent = rawContent.replace(/^(- [(?: |x)] .*)$/gm, (line) => {
    if(currentIdx === taskIndex){
      if(line.startsWith('- [x]')){
        line = '- [ ]' + line.slice(5);
      } else if(line.startsWith('- [ ]')){
        line = '- [x]' + line.slice(5);
      }
    }
    currentIdx++;
    return line;
  });

  if(isCurrentlyEditing){
    const ta = document.getElementById('editorTextarea');
    if(ta) ta.value = updatedContent;
    window._backup = updatedContent;
    onEditorInput();
  } else if(noteObj){
    noteObj.content = updatedContent;
    noteObj.updatedAt = new Date().toISOString();
    saveAll();
    renderNotes();
  }
}

// ===== ENHANCED CODE PLAYGROUND =====
function runEnhancedCode(btn, id, lang){
  const el = document.getElementById(id);
  if(!el) return;
  const pre = btn.closest('.code-box') || btn.closest('pre');
  if(!pre) return;
  
  let next = pre.nextElementSibling;
  while(next && (next.classList.contains('code-output') || next.classList.contains('html-sandbox'))){
    const toRemove = next;
    next = next.nextElementSibling;
    toRemove.remove();
  }
  
  const rawCode = el.textContent.trim();
  const startTime = performance.now();
  
  if(lang === 'html' || lang === 'htm' || lang === 'svg'){
    const wrap = document.createElement('div');
    wrap.className = 'html-sandbox';
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-modals';
    wrap.appendChild(iframe);
    pre.after(wrap);
    
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:12px;font-family:sans-serif;color:#111;background:#fff}</style></head><body>' + rawCode + '</body></html>');
    doc.close();
    return;
  }
  
  if(lang === 'json'){
    const out = document.createElement('div');
    out.className = 'code-output';
    try {
      const parsed = JSON.parse(rawCode);
      const formatted = JSON.stringify(parsed, null, 2);
      el.textContent = formatted;
      const duration = (performance.now() - startTime).toFixed(1);
      out.innerHTML = '<div class="code-output-header"><span>✓ Valid JSON (formatted in place)</span><div class="code-output-actions"><span style="color:var(--green)">⏱ ' + duration + 'ms</span><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div></div><pre style="background:none;padding:0;margin:0;color:#c9d1d9">' + esc(formatted) + '</pre>';
    } catch(e) {
      out.className = 'code-output error';
      out.innerHTML = '<div class="code-output-header"><span>❌ Invalid JSON</span><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div>' + esc(e.message);
    }
    pre.after(out);
    return;
  }
  
  if(lang === 'py' || lang === 'python'){
    const out = document.createElement('div');
    out.className = 'code-output';
    const logs = [];
    try {
      const pyLines = rawCode.split('\n');
      const pyScope = {
        math: Math,
        len: (x) => (x ? (x.length !== undefined ? x.length : Object.keys(x).length) : 0),
        sum: (arr) => (Array.isArray(arr) ? arr.reduce((a,b)=>a+b,0) : 0),
        range: (start, stop, step) => {
          if(stop === undefined){ stop = start; start = 0; }
          step = step || 1;
          const r = [];
          for(let i=start; i<stop; i+=step) r.push(i);
          return r;
        },
        str: String, int: parseInt, float: parseFloat, bool: Boolean,
        print: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
      };
      
      let jsCode = '';
      for(let line of pyLines){
        let trimmed = line.trim();
        if(!trimmed || trimmed.startsWith('#')) continue;
        if(trimmed.startsWith('print(')){
          jsCode += line + ';\n';
        } else if(trimmed.startsWith('def ')){
          jsCode += line.replace(/def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\):/, 'function $1($2){') + '\n';
        } else if(trimmed.startsWith('for ') && trimmed.includes(' in ')){
          jsCode += line.replace(/for\s+([a-zA-Z0-9_]+)\s+in\s+(.+):/, 'for(let $1 of $2){') + '\n';
        } else if(trimmed.startsWith('if ') && trimmed.endsWith(':')){
          jsCode += line.replace(/if\s+(.+):/, 'if($1){') + '\n';
        } else if(trimmed.startsWith('else:')){
          jsCode += line.replace('else:', 'else{') + '\n';
        } else {
          if(line.includes('=') && !line.includes('==') && !line.includes('>=') && !line.includes('<=')){
            jsCode += 'let ' + line + ';\n';
          } else {
            jsCode += line + ';\n';
          }
        }
      }
      
      const fn = new Function('py', 'with(py){\n' + jsCode + '\n}');
      fn(pyScope);
      
      const duration = (performance.now() - startTime).toFixed(1);
      out.innerHTML = '<div class="code-output-header"><span>Python Output</span><div class="code-output-actions"><span style="color:var(--blue)">⏱ ' + duration + 'ms</span><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div></div>' + (logs.length ? esc(logs.join('\n')) : 'Program executed successfully (no output)');
    } catch(e) {
      out.className = 'code-output error';
      out.innerHTML = '<div class="code-output-header"><span>Python Error</span><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div>' + esc(e.message);
    }
    pre.after(out);
    return;
  }
  
  // Default: JavaScript / TypeScript Execution
  const out = document.createElement('div');
  out.className = 'code-output';
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')),
    info: (...args) => logs.push('ℹ ' + args.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')),
    warn: (...args) => logs.push('⚠️ ' + args.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')),
    error: (...args) => logs.push('❌ ' + args.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')),
    table: (obj) => logs.push(typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj))
  };
  
  try {
    const fn = new Function('console', rawCode);
    const result = fn(fakeConsole);
    const duration = (performance.now() - startTime).toFixed(1);
    
    let content = '';
    if(logs.length){
      content = esc(logs.join('\n'));
    } else if(result !== undefined){
      content = 'Result: ' + esc(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    } else {
      content = 'Program executed successfully (no console output)';
    }
    
    out.innerHTML = '<div class="code-output-header"><span>JavaScript Console</span><div class="code-output-actions"><span style="color:var(--green)">⏱ ' + duration + 'ms</span><button class="code-output-btn" onclick="copyText(\'' + esc(logs.join('\n') || String(result || '')) + '\')">Copy</button><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div></div>' + content;
  } catch(e) {
    out.className = 'code-output error';
    out.innerHTML = '<div class="code-output-header"><span>Runtime Error</span><button class="code-output-btn" onclick="this.closest(\'.code-output\').remove()">Clear</button></div>' + esc(e.toString());
  }
  
  pre.after(out);
}

// ===== ZEN MODE =====
function toggleZenMode(){
  const wrap = document.getElementById('editorWrap');
  wrap.classList.toggle('zen-mode');
  const isZen = wrap.classList.contains('zen-mode');
  
  const headerBtn = document.getElementById('zenHeaderBtn');
  const toolbarBtn = document.getElementById('zenToolbarBtn');
  if(headerBtn) headerBtn.innerHTML = I(isZen ? 'minimize' : 'maximize');
  if(toolbarBtn) toolbarBtn.innerHTML = I(isZen ? 'minimize' : 'maximize') + (isZen ? ' Exit' : ' Zen');
  
  if(isZen) updateZenStats();
}

function updateZenStats(){
  const ta = document.getElementById('editorTextarea');
  const text = ta ? ta.value : '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.ceil(words / 200));
  const title = (document.getElementById('editorTitle')?.value || 'Untitled Note').trim();
  
  const zTitle = document.getElementById('zenTitle');
  const zStats = document.getElementById('zenStats');
  if(zTitle) zTitle.textContent = title || 'Untitled Note';
  if(zStats) zStats.textContent = words + ' words · ~' + readMin + ' min read';
}

// ===== TABLE OF CONTENTS DOCK =====
function toggleTocDock(){
  const dock = document.getElementById('tocDock');
  if(!dock) return;
  dock.classList.toggle('collapsed');
  const isOpen = !dock.classList.contains('collapsed');
  if(isOpen) updateTocDock();
}

function updateTocDock(){
  const dock = document.getElementById('tocDock');
  if(!dock || dock.classList.contains('collapsed')) return;
  
  const ta = document.getElementById('editorTextarea');
  const text = ta ? ta.value : '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const readMin = Math.max(1, Math.ceil(words / 200));
  
  const timeEl = document.getElementById('tocReadingTime');
  const wordEl = document.getElementById('tocWordCount');
  if(timeEl) timeEl.textContent = '⏱ ~' + readMin + ' min read';
  if(wordEl) wordEl.textContent = words + ' words · ' + chars + ' chars';
  
  const listEl = document.getElementById('tocItemsList');
  if(!listEl) return;
  const lines = text.split('\n');
  const headings = [];
  
  lines.forEach((line, idx) => {
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if(m){
      headings.push({ level: m[1].length, title: m[2].trim(), lineIdx: idx });
    }
  });
  
  if(!headings.length){
    listEl.innerHTML = '<div style="padding:12px 8px;font-size:11px;color:var(--text3);font-style:italic">No headings in note (use # Heading)</div>';
    return;
  }
  
  listEl.innerHTML = headings.map(h => '<button class="toc-dock-item h' + h.level + '" onclick="jumpToHeadingLine(' + h.lineIdx + ')">' + esc(h.title) + '</button>').join('');
}

function jumpToHeadingLine(lineIdx){
  const ta = document.getElementById('editorTextarea');
  if(!ta) return;
  const lines = ta.value.split('\n');
  let pos = 0;
  for(let i=0; i<lineIdx && i<lines.length; i++){
    pos += lines[i].length + 1;
  }
  ta.focus();
  ta.setSelectionRange(pos, pos + (lines[lineIdx] ? lines[lineIdx].length : 0));
  const lineHeight = 19;
  ta.scrollTop = lineIdx * lineHeight - 60;
}

// ===== COMMAND PALETTE =====
let cmdSelectedIndex = 0;
let cmdItems = [];

function openCommandPalette(){
  const modal = document.getElementById('cmdPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  modal.style.display = 'flex';
  input.value = '';
  cmdSelectedIndex = 0;
  renderCommandPalette();
  input.focus();
}

function closeCommandPalette(){
  document.getElementById('cmdPaletteModal').style.display = 'none';
}

function onCmdPaletteInput(){
  cmdSelectedIndex = 0;
  renderCommandPalette();
}

function renderCommandPalette(){
  const query = (document.getElementById('cmdPaletteInput').value || '').toLowerCase().trim();
  const list = document.getElementById('cmdPaletteList');
  cmdItems = [];
  
  const actions = [
    { type: 'action', title: 'New Note', desc: 'Create a new blank note', icon: 'plus', shortcut: '⌘N', action: () => { closeCommandPalette(); openEditor(); } },
    { type: 'action', title: 'Mind Map / Graph View', desc: 'Interactive visual connections graph', icon: 'network', shortcut: '⌘G', action: () => { closeCommandPalette(); openGraphView(); } },
    { type: 'action', title: 'Toggle Zen Focus Mode', desc: 'Distraction-free fullscreen writing', icon: 'maximize', shortcut: '⌘⇧Z', action: () => { closeCommandPalette(); if(!editingId) openEditor(); toggleZenMode(); } },
    { type: 'action', title: 'Notion Font (Inter)', desc: 'Set typography to Notion default Inter font', icon: 'type', shortcut: '', action: () => {
      setFontChoice('Inter');
      closeCommandPalette();
    }},
    { type: 'action', title: 'Toggle Outline / Table of Contents', desc: 'Open side dock with heading links and reading time', icon: 'layers', shortcut: '⌘⇧T', action: () => { closeCommandPalette(); if(!editingId) openEditor(); toggleTocDock(); } },
    { type: 'action', title: 'Toggle Dark / Light Theme', desc: 'Switch interface contrast theme', icon: 'sun', shortcut: '⌘⇧D', action: () => { closeCommandPalette(); toggleDark(); } },
    { type: 'action', title: 'Open Statistics', desc: 'View word counts, daily streak & activity heatmap', icon: 'bar-chart', shortcut: '', action: () => { closeCommandPalette(); openStats(); } },
    { type: 'action', title: 'New Folder', desc: 'Create a folder to organize notes', icon: 'folder-plus', shortcut: '', action: () => { closeCommandPalette(); showFolderModal(); } },
    { type: 'action', title: 'Export All Notes (JSON)', desc: 'Backup full vault locally', icon: 'archive', shortcut: '', action: () => { closeCommandPalette(); exportAllJSON(); } },
    { type: 'action', title: 'Keyboard Shortcuts Cheat Sheet', desc: 'View all keyboard shortcuts', icon: 'keyboard', shortcut: '?', action: () => { closeCommandPalette(); showShortcutsModal(); } },
    { type: 'action', title: 'Settings', desc: 'Change font size, typography & word goals', icon: 'settings', shortcut: '', action: () => { closeCommandPalette(); showSettings(); } }
  ];
  
  const filteredActions = actions.filter(a => !query || a.title.toLowerCase().includes(query) || a.desc.toLowerCase().includes(query));
  
  const activeNotes = notes.filter(n => !n.isTrash);
  const filteredNotes = activeNotes.filter(n => !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query) || (n.tags||[]).some(t=>t.toLowerCase().includes(query))).slice(0, 15);
  
  let outHtml = '';
  
  if(filteredActions.length){
    outHtml += '<div class="cmd-group-title">Commands & Actions</div>';
    filteredActions.forEach(a => {
      const idx = cmdItems.length;
      cmdItems.push(a);
      const isSel = idx === cmdSelectedIndex;
      outHtml += '<div class="cmd-item ' + (isSel ? 'selected' : '') + '" onclick="executeCmdItem(' + idx + ')">' +
        '<div class="cmd-item-left">' +
          '<svg class="ic" style="width:14px;height:14px;color:var(--text3)"><use href="#i-' + a.icon + '"/></svg>' +
          '<div>' +
            '<div class="cmd-item-title">' + esc(a.title) + '</div>' +
            '<div class="cmd-item-desc">' + esc(a.desc) + '</div>' +
          '</div>' +
        '</div>' +
        (a.shortcut ? '<span class="cmd-badge">' + a.shortcut + '</span>' : '') +
      '</div>';
    });
  }
  
  if(filteredNotes.length){
    outHtml += '<div class="cmd-group-title">Notes (' + filteredNotes.length + ')</div>';
    filteredNotes.forEach(n => {
      const idx = cmdItems.length;
      cmdItems.push({ type: 'note', id: n.id, title: n.title, action: () => { closeCommandPalette(); openEditor(n.id); } });
      const isSel = idx === cmdSelectedIndex;
      const snippet = (n.content || '').replace(/[#*_~]/g, '').trim().slice(0, 60);
      outHtml += '<div class="cmd-item ' + (isSel ? 'selected' : '') + '" onclick="executeCmdItem(' + idx + ')">' +
        '<div class="cmd-item-left">' +
          '<svg class="ic" style="width:14px;height:14px;color:var(--text3)"><use href="#i-file-text"/></svg>' +
          '<div style="min-width:0">' +
            '<div class="cmd-item-title">' + esc(n.title || 'Untitled') + '</div>' +
            '<div class="cmd-item-desc">' + esc(snippet || 'Empty note') + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="cmd-badge">' + timeAgo(n.updatedAt) + '</span>' +
      '</div>';
    });
  }
  
  if(!filteredActions.length && !filteredNotes.length){
    outHtml = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No matching commands or notes found</div>';
  }
  
  list.innerHTML = outHtml;
}

function onCmdPaletteKeyDown(e){
  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(cmdItems.length){
      cmdSelectedIndex = (cmdSelectedIndex + 1) % cmdItems.length;
      renderCommandPalette();
    }
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    if(cmdItems.length){
      cmdSelectedIndex = (cmdSelectedIndex - 1 + cmdItems.length) % cmdItems.length;
      renderCommandPalette();
    }
  } else if(e.key === 'Enter'){
    e.preventDefault();
    if(cmdItems[cmdSelectedIndex]){
      executeCmdItem(cmdSelectedIndex);
    }
  } else if(e.key === 'Escape'){
    closeCommandPalette();
  }
}

function executeCmdItem(idx){
  if(cmdItems[idx] && typeof cmdItems[idx].action === 'function'){
    cmdItems[idx].action();
  }
}

// ===== MIND MAP / GRAPH VIEW SIMULATION =====
let graphNodes = [];
let graphLinks = [];
let graphAnimId = null;
let graphZoomLevel = 1;
let graphPanX = 0;
let graphPanY = 0;
let graphDraggedNode = null;
let graphHoveredNode = null;
let graphSearchQuery = '';

function openGraphView(){
  document.getElementById('graphModal').style.display = 'flex';
  initGraphSimulation();
}

function closeGraphView(){
  document.getElementById('graphModal').style.display = 'none';
  if(graphAnimId) cancelAnimationFrame(graphAnimId);
}

function graphZoom(factor){
  graphZoomLevel = Math.max(0.3, Math.min(3, graphZoomLevel * factor));
}

function graphResetView(){
  graphZoomLevel = 1;
  const canvas = document.getElementById('graphCanvas');
  if(canvas){
    graphPanX = canvas.width / 2;
    graphPanY = canvas.height / 2;
  }
}

function onGraphSearch(val){
  graphSearchQuery = (val || '').toLowerCase().trim();
}

function initGraphSimulation(){
  const canvas = document.getElementById('graphCanvas');
  const wrap = document.getElementById('graphCanvasWrap');
  if(!canvas || !wrap) return;
  
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  graphPanX = canvas.width / 2;
  graphPanY = canvas.height / 2;
  
  const activeNotes = notes.filter(n => !n.isTrash);
  document.getElementById('graphNodeCount').textContent = activeNotes.length + ' notes';
  
  graphNodes = activeNotes.map((n, i) => {
    const angle = (i / Math.max(1, activeNotes.length)) * Math.PI * 2;
    const dist = 120 + Math.random() * 150;
    const words = (n.content || '').split(/\s+/).filter(Boolean).length;
    const radius = Math.min(22, Math.max(8, 7 + Math.sqrt(words) * 0.8));
    
    return {
      id: n.id,
      title: n.title || 'Untitled',
      content: n.content || '',
      folderId: n.folderId,
      tags: n.tags || [],
      words,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      radius,
      color: n.isPinned ? '#eab308' : (n.isFavorite ? '#ef4444' : '#3b82f6')
    };
  });
  
  graphLinks = [];
  const nodeMap = new Map();
  graphNodes.forEach(gn => nodeMap.set(gn.title.toLowerCase(), gn));
  
  graphNodes.forEach(nodeA => {
    const wikilinkMatches = nodeA.content.match(/\[\[([^\]]+)\]\]/g) || [];
    wikilinkMatches.forEach(m => {
      const targetTitle = m.slice(2, -2).trim().toLowerCase();
      const nodeB = nodeMap.get(targetTitle);
      if(nodeB && nodeB.id !== nodeA.id){
        graphLinks.push({ source: nodeA, target: nodeB, strength: 1, type: 'wikilink' });
      }
    });
    
    graphNodes.forEach(nodeB => {
      if(nodeA.id >= nodeB.id) return;
      const sharedTag = (nodeA.tags || []).some(t => (nodeB.tags || []).includes(t));
      if(sharedTag){
        graphLinks.push({ source: nodeA, target: nodeB, strength: 0.3, type: 'tag' });
      }
    });
  });
  
  let isPanning = false;
  let startX = 0, startY = 0;
  
  canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - graphPanX) / graphZoomLevel;
    const my = (e.clientY - rect.top - graphPanY) / graphZoomLevel;
    
    let clickedNode = null;
    for(let n of graphNodes){
      const dx = n.x - mx;
      const dy = n.y - my;
      if(dx*dx + dy*dy <= (n.radius + 6)*(n.radius + 6)){
        clickedNode = n;
        break;
      }
    }
    
    if(clickedNode){
      graphDraggedNode = clickedNode;
    } else {
      isPanning = true;
      startX = e.clientX - graphPanX;
      startY = e.clientY - graphPanY;
    }
  };
  
  window.onmousemove = (e) => {
    if(document.getElementById('graphModal').style.display !== 'flex') return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - graphPanX) / graphZoomLevel;
    const my = (e.clientY - rect.top - graphPanY) / graphZoomLevel;
    
    if(graphDraggedNode){
      graphDraggedNode.x = mx;
      graphDraggedNode.y = my;
      graphDraggedNode.vx = 0;
      graphDraggedNode.vy = 0;
    } else if(isPanning){
      graphPanX = e.clientX - startX;
      graphPanY = e.clientY - startY;
    } else {
      let hovered = null;
      for(let n of graphNodes){
        const dx = n.x - mx;
        const dy = n.y - my;
        if(dx*dx + dy*dy <= (n.radius + 4)*(n.radius + 4)){
          hovered = n;
          break;
        }
      }
      graphHoveredNode = hovered;
      const tt = document.getElementById('graphTooltip');
      if(hovered){
        tt.style.display = 'block';
        tt.style.left = (e.clientX - rect.left + 14) + 'px';
        tt.style.top = (e.clientY - rect.top + 14) + 'px';
        tt.innerHTML = '<div style="font-weight:700;color:var(--text);margin-bottom:2px">' + esc(hovered.title) + '</div>' +
          '<div style="color:var(--text3);font-size:10px">' + hovered.words + ' words ' + (hovered.tags.length ? '· ' + hovered.tags.map(t=>'#'+t).join(' ') : '') + '</div>' +
          '<div style="font-size:10px;color:var(--text2);margin-top:4px">' + esc(hovered.content.slice(0, 60) || 'Click to open note') + '...</div>';
        canvas.style.cursor = 'pointer';
      } else {
        tt.style.display = 'none';
        canvas.style.cursor = isPanning ? 'grabbing' : 'default';
      }
    }
  };
  
  window.onmouseup = (e) => {
    if(graphDraggedNode){
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - graphPanX) / graphZoomLevel;
      const my = (e.clientY - rect.top - graphPanY) / graphZoomLevel;
      const dx = graphDraggedNode.x - mx;
      const dy = graphDraggedNode.y - my;
      
      if(dx*dx + dy*dy < 25){
        const noteId = graphDraggedNode.id;
        closeGraphView();
        openEditor(noteId);
      }
      graphDraggedNode = null;
    }
    isPanning = false;
  };
  
  canvas.onwheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    graphZoom(zoomFactor);
  };
  
  runGraphLoop();
}

function runGraphLoop(){
  const canvas = document.getElementById('graphCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const kRepulse = 1800;
  const kSpring = 0.04;
  const damping = 0.88;
  const centerGravity = 0.015;
  
  for(let i=0; i<graphNodes.length; i++){
    const na = graphNodes[i];
    for(let j=i+1; j<graphNodes.length; j++){
      const nb = graphNodes[j];
      let dx = nb.x - na.x;
      let dy = nb.y - na.y;
      let dist = Math.sqrt(dx*dx + dy*dy) || 1;
      if(dist < 350){
        let force = kRepulse / (dist * dist);
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        na.vx -= fx;
        na.vy -= fy;
        nb.vx += fx;
        nb.vy += fy;
      }
    }
  }
  
  for(let link of graphLinks){
    const na = link.source;
    const nb = link.target;
    let dx = nb.x - na.x;
    let dy = nb.y - na.y;
    let dist = Math.sqrt(dx*dx + dy*dy) || 1;
    let force = (dist - 90) * kSpring * link.strength;
    let fx = (dx / dist) * force;
    let fy = (dy / dist) * force;
    na.vx -= fx;
    na.vy -= fy;
    nb.vx -= fx;
    nb.vy -= fy;
  }
  
  for(let n of graphNodes){
    if(n !== graphDraggedNode){
      n.vx -= n.x * centerGravity;
      n.vy -= n.y * centerGravity;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
    }
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(graphPanX, graphPanY);
  ctx.scale(graphZoomLevel, graphZoomLevel);
  
  for(let link of graphLinks){
    const na = link.source;
    const nb = link.target;
    const isHovered = (graphHoveredNode && (graphHoveredNode.id === na.id || graphHoveredNode.id === nb.id));
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.6)' : (link.type === 'wikilink' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)');
    ctx.lineWidth = isHovered ? 2 : (link.type === 'wikilink' ? 1.5 : 1);
    if(link.type === 'tag') ctx.setLineDash([4, 4]);
    else ctx.setLineDash([]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  
  for(let n of graphNodes){
    const matchesSearch = !graphSearchQuery || n.title.toLowerCase().includes(graphSearchQuery) || (n.tags||[]).some(t=>t.toLowerCase().includes(graphSearchQuery));
    const isHovered = (graphHoveredNode && graphHoveredNode.id === n.id);
    const alpha = matchesSearch ? (isHovered ? 1 : 0.85) : 0.2;
    
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? '#ffffff' : n.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.globalAlpha = matchesSearch ? (isHovered ? 1 : 0.75) : 0.15;
    ctx.font = (isHovered ? 'bold 11px' : '10px') + ' var(--font-primary), monospace';
    ctx.fillStyle = '#f4f4f5';
    ctx.textAlign = 'center';
    ctx.fillText(n.title.length > 20 ? n.title.slice(0,18)+'…' : n.title, n.x, n.y + n.radius + 12);
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
  
  if(document.getElementById('graphModal').style.display === 'flex'){
    graphAnimId = requestAnimationFrame(runGraphLoop);
  }
}

// ===== KEYBOARD SHORTCUTS MODAL =====
function showShortcutsModal(){
  document.getElementById('shortcutsModal').style.display = 'flex';
}

function hideShortcutsModal(){
  document.getElementById('shortcutsModal').style.display = 'none';
}

// ===== GLOBAL KEYBOARD SHORTCUTS SYSTEM =====
window.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmd = isMac ? e.metaKey : e.ctrlKey;
  const target = e.target;
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  
  // 1. Command Palette: Cmd/Ctrl + K
  if(cmd && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    if(document.getElementById('cmdPaletteModal').style.display === 'flex'){
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
    return;
  }
  
  // 2. Mind Map / Graph: Cmd/Ctrl + G
  if(cmd && e.key.toLowerCase() === 'g'){
    e.preventDefault();
    if(document.getElementById('graphModal').style.display === 'flex'){
      closeGraphView();
    } else {
      openGraphView();
    }
    return;
  }
  
  // 3. New Note: Cmd/Ctrl + N
  if(cmd && e.key.toLowerCase() === 'n' && !e.shiftKey){
    e.preventDefault();
    openEditor();
    return;
  }
  
  // 4. Save Note: Cmd/Ctrl + S
  if(cmd && e.key.toLowerCase() === 's'){
    e.preventDefault();
    saveCurrentNote();
    showToast(I('check') + ' Note saved');
    return;
  }
  
  // 5. Zen Mode: Cmd/Ctrl + Shift + Z
  if(cmd && e.shiftKey && e.key.toLowerCase() === 'z'){
    e.preventDefault();
    if(!editingId) openEditor();
    toggleZenMode();
    return;
  }
  
  // 6. Table of Contents: Cmd/Ctrl + Shift + T
  if(cmd && e.shiftKey && e.key.toLowerCase() === 't'){
    e.preventDefault();
    if(!editingId) openEditor();
    toggleTocDock();
    return;
  }
  
  // 7. Toggle Dark/Light: Cmd/Ctrl + Shift + D
  if(cmd && e.shiftKey && e.key.toLowerCase() === 'd'){
    e.preventDefault();
    toggleDark();
    return;
  }
  
  // 8. Toggle Sidebar: Cmd/Ctrl + B or Cmd/Ctrl + \
  if((cmd && (e.key === 'b' || e.key === 'B') && !isInput) || (cmd && e.key === '\\')){
    e.preventDefault();
    toggleSidebar();
    return;
  }
  
  // 9. Shortcuts modal: '?' when not in an input
  if(e.key === '?' && !isInput && !cmd){
    e.preventDefault();
    showShortcutsModal();
    return;
  }
  
  // 10. Escape key closes active overlays
  if(e.key === 'Escape'){
    if(document.getElementById('cmdPaletteModal').style.display === 'flex'){
      closeCommandPalette();
      return;
    }
    if(document.getElementById('graphModal').style.display === 'flex'){
      closeGraphView();
      return;
    }
    if(document.getElementById('shortcutsModal').style.display === 'flex'){
      hideShortcutsModal();
      return;
    }
    const wrap = document.getElementById('editorWrap');
    if(wrap && wrap.classList.contains('zen-mode')){
      toggleZenMode();
      return;
    }
    hideSettings();
    hideTemplates();
    hideFolderModal();
    hideAdvancedSearch();
  }
});

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

