document.addEventListener('DOMContentLoaded', async () => {
  const presetsContainer = document.getElementById('presets');
  const customColorInput = document.getElementById('custom-color');
  const btnAdd = document.getElementById('btn-add');
  const btnReset = document.getElementById('btn-reset');
  const btnResetAll = document.getElementById('btn-reset-all');
  const heightSlider = document.getElementById('footer-height');
  const heightValueEl = document.getElementById('height-value');

  // Custom context menu elements
  const contextMenu = document.getElementById('context-menu');
  let colorToDelete = null;
  let swatchToDelete = null;

  // Drag state
  let dragSrcEl = null;

  const defaultColors = [
    { name: "Dark Red", value: "#9d2206" },
    { name: "Orange", value: "#d35400" },
    { name: "Yellow", value: "#f39c12" },
    { name: "Green", value: "#27ae60" },
    { name: "Light Blue", value: "#2496c6" },
    { name: "Pinkish", value: "#832561" },
    { name: "Blue", value: "#1857a4" },
    { name: "Purple", value: "#5c19ae" },
    { name: "Midnight", value: "#2c3e50" },
    { name: "White", value: "#cccccc" },
  ];

  // --- Helper: Highlight the active swatch ---
  const highlightActiveSwatch = (color) => {
    presetsContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    if (color) {
      const target = [...presetsContainer.querySelectorAll('.swatch')].find(
        s => s.dataset.color === color
      );
      if (target) target.classList.add('active');
    }
  };

  // --- Helper: Apply color to the current window ---
  const applyColorToWindow = async (color) => {
    const currentWindow = await chrome.windows.getCurrent();
    const winId = currentWindow.id;

    const data = await chrome.storage.local.get(winId.toString());
    const existingLabel = data[winId] ? data[winId].label : "";

    const newData = { color: color, label: existingLabel };
    await chrome.storage.local.set({ [winId]: newData });

    const tabs = await chrome.tabs.query({ windowId: winId });
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "UPDATE_FOOTER", data: newData }).catch(() => {});
    });

    highlightActiveSwatch(color);
  };

  // --- Helper: Save current swatch order to storage ---
  const saveSwatchOrder = async () => {
    const swatches = [...presetsContainer.querySelectorAll('.swatch')];
    const data = await chrome.storage.local.get('savedColors');
    const currentColors = data.savedColors || [];

    const newOrder = swatches.map(s => {
      const hex = s.dataset.color;
      return currentColors.find(c => c.value === hex) || { name: "Custom Color", value: hex };
    }).filter(Boolean);

    await chrome.storage.local.set({ savedColors: newOrder });
  };

  // --- Context Menu (Delete) Logic ---
  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });

  contextMenu.addEventListener('click', async (e) => {
    e.stopPropagation();

    if (colorToDelete && swatchToDelete) {
      const data = await chrome.storage.local.get('savedColors');
      let currentColors = data.savedColors || [];

      currentColors = currentColors.filter(c => c.value !== colorToDelete);
      await chrome.storage.local.set({ savedColors: currentColors });

      swatchToDelete.remove();

      colorToDelete = null;
      swatchToDelete = null;
    }

    contextMenu.style.display = 'none';
  });

  // --- Helper: Create a color swatch UI ---
  const createSwatch = (colorObj) => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = colorObj.value;
    swatch.dataset.color = colorObj.value;
    swatch.title = colorObj.name;
    swatch.setAttribute('draggable', 'true');

    // Left-click applies the color
    swatch.addEventListener('click', () => applyColorToWindow(colorObj.value));

    // Right-click opens our custom menu
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      colorToDelete = colorObj.value;
      swatchToDelete = swatch;

      contextMenu.style.display = 'block';

      let xPos = e.pageX;
      let yPos = e.pageY;

      const menuWidth = contextMenu.offsetWidth;
      const popupWidth = document.body.clientWidth;
      if (xPos + menuWidth > popupWidth) {
        xPos = popupWidth - menuWidth - 5;
      }

      contextMenu.style.left = `${xPos}px`;
      contextMenu.style.top = `${yPos}px`;
    });

    // --- Drag-and-drop reorder ---
    swatch.addEventListener('dragstart', (e) => {
      dragSrcEl = swatch;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => { swatch.style.opacity = '0.4'; }, 0);
    });

    swatch.addEventListener('dragend', () => {
      swatch.style.opacity = '1';
      presetsContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('drag-over'));
      saveSwatchOrder();
    });

    swatch.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    swatch.addEventListener('dragenter', () => {
      if (dragSrcEl !== swatch) swatch.classList.add('drag-over');
    });

    swatch.addEventListener('dragleave', () => {
      swatch.classList.remove('drag-over');
    });

    swatch.addEventListener('drop', (e) => {
      e.stopPropagation();
      e.preventDefault();
      swatch.classList.remove('drag-over');

      if (dragSrcEl && dragSrcEl !== swatch) {
        const swatches = [...presetsContainer.querySelectorAll('.swatch')];
        const srcIdx = swatches.indexOf(dragSrcEl);
        const dstIdx = swatches.indexOf(swatch);

        if (srcIdx < dstIdx) {
          presetsContainer.insertBefore(dragSrcEl, swatch.nextSibling);
        } else {
          presetsContainer.insertBefore(dragSrcEl, swatch);
        }
      }
    });

    presetsContainer.appendChild(swatch);
  };

  // --- Initialization: Load colors ---
  const storageData = await chrome.storage.local.get('savedColors');
  let savedColors = storageData.savedColors;

  if (!savedColors) {
    savedColors = defaultColors;
    await chrome.storage.local.set({ savedColors: savedColors });
  }

  savedColors.forEach(colorObj => createSwatch(colorObj));

  // --- Initialization: Highlight active color for current window ---
  const currentWindow = await chrome.windows.getCurrent();
  const winData = await chrome.storage.local.get(currentWindow.id.toString());
  const windowConfig = winData[currentWindow.id];
  if (windowConfig && windowConfig.color) {
    highlightActiveSwatch(windowConfig.color);
  }

  // --- Initialization: Load height ---
  const heightData = await chrome.storage.local.get('footerHeight');
  const initialHeight = heightData.footerHeight || 25;
  heightSlider.value = initialHeight;
  heightValueEl.textContent = initialHeight;

  // --- Event Listeners ---
  btnAdd.addEventListener('click', async () => {
    const newColorHex = customColorInput.value;
    const newColorObj = { name: "Custom Color", value: newColorHex };

    const data = await chrome.storage.local.get('savedColors');
    const currentColors = data.savedColors || [];

    const colorExists = currentColors.some(c => c.value === newColorHex);

    if (!colorExists) {
      currentColors.push(newColorObj);
      await chrome.storage.local.set({ savedColors: currentColors });
      createSwatch(newColorObj);
    }

    applyColorToWindow(newColorHex);
  });

  btnReset.addEventListener('click', () => applyColorToWindow(null));

  btnResetAll.addEventListener('click', async () => {
    const allTabs = await chrome.tabs.query({});
    allTabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "UPDATE_FOOTER", data: { color: null, label: "" } }).catch(() => {});
    });

    const allData = await chrome.storage.local.get(null);
    const windowKeys = Object.keys(allData).filter(k => !isNaN(parseInt(k)));
    if (windowKeys.length > 0) {
      await chrome.storage.local.remove(windowKeys);
    }

    highlightActiveSwatch(null);
  });

  heightSlider.addEventListener('input', async () => {
    const h = parseInt(heightSlider.value);
    heightValueEl.textContent = h;
    await chrome.storage.local.set({ footerHeight: h });

    const allTabs = await chrome.tabs.query({});
    allTabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "UPDATE_HEIGHT", height: h }).catch(() => {});
    });
  });
});
