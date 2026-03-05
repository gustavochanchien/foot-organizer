// --- YIQ Contrast Helper ---
function getContrastColor(hexColor) {
  if (!hexColor) return '#000000';
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

// --- Shadow DOM Setup ---
let footerContainer, labelInput;
let isTyping = false;
let typingTimer;

function injectFooter() {
  if (document.getElementById('peacock-host')) return;

  const host = document.createElement('div');
  host.id = 'peacock-host';
  host.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 100%; z-index: 2147483647; pointer-events: none;';

  const shadow = host.attachShadow({ mode: 'closed' });

  const styleBlock = document.createElement('style');
  styleBlock.textContent = `
    input::placeholder {
      color: var(--peacock-text-color, #888);
      opacity: 0.75;
    }
  `;
  shadow.appendChild(styleBlock);
  
  footerContainer = document.createElement('div');
  footerContainer.style.cssText = 'width: 100%; height: 25px; display: none; align-items: center; justify-content: flex-start; padding-left: 15px; box-sizing: border-box; pointer-events: auto; font-family: system-ui, sans-serif; box-shadow: 0 -4px 12px rgba(0,0,0,0.35), 0 -1px 3px rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.15); transition: background-color 0.2s;';

  labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'Add a title...';
  labelInput.style.cssText = 'background: transparent; border: none; outline: none; text-align: left; font-weight: bold; width: 80%; font-size: 13px; transition: color 0.2s;';

  // --- Smart Typing & Auto-Save Logic ---
  labelInput.addEventListener('focus', () => isTyping = true);
  labelInput.addEventListener('blur', () => isTyping = false);

  labelInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: "SAVE_LABEL", label: labelInput.value });
    }, 500); 
  });

  footerContainer.appendChild(labelInput);
  shadow.appendChild(footerContainer);

  // --- THE FIX: Attach to <html> (documentElement) instead of <body> ---
  // This escapes any CSS transforms applied to the body tag by the website.
  document.documentElement.appendChild(host);
}

// --- Helper to forcefully push content up ---
function setPushUpPadding(enable) {
  let styleEl = document.getElementById('peacock-push-style');
  if (enable) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'peacock-push-style';
      styleEl.textContent = `
        /* 1. Push up normal scrolling websites */
        html, body { 
            padding-bottom: 25px !important; 
        }
        
        /* 2. Shrink fullscreen SPAs so they don't hide under the footer */
        .h-svh, .h-dvh, .h-screen { 
            max-height: calc(100vh - 25px) !important; 
        }
      `;
      document.head.appendChild(styleEl);
    }
  } else {
    if (styleEl) styleEl.remove();
  }
}

function renderFooter(data) {
  if (!footerContainer) injectFooter();
  
  if (!data || !data.color) {
    footerContainer.style.display = 'none';
    setPushUpPadding(false); 
    return;
  }

  footerContainer.style.display = 'flex';
  footerContainer.style.backgroundColor = data.color;
  
  if (!isTyping) {
    labelInput.value = data.label || "";
  }
  
  setPushUpPadding(true);

  const textColor = getContrastColor(data.color);
  labelInput.style.color = textColor;
  labelInput.style.setProperty('--peacock-text-color', textColor);
}

// --- Initialization & Listeners ---

injectFooter();

chrome.runtime.sendMessage({ action: "INIT_TAB" }, (response) => {
  if (response && response.data) renderFooter(response.data);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "UPDATE_FOOTER") renderFooter(msg.data);
});