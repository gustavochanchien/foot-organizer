document.addEventListener('DOMContentLoaded', async () => {
  const presetsContainer = document.getElementById('presets');
  const customColorInput = document.getElementById('custom-color');
  const btnAdd = document.getElementById('btn-add');
  const btnReset = document.getElementById('btn-reset');
  
  // Custom context menu elements
  const contextMenu = document.getElementById('context-menu');
  let colorToDelete = null;
  let swatchToDelete = null;

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
  };

  // --- Context Menu (Delete) Logic ---
  
  // 1. Hide the menu if the user clicks anywhere else
  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });

  // 2. Actually delete the color when the custom menu is clicked
  contextMenu.addEventListener('click', async (e) => {
    e.stopPropagation(); // Stop the document click listener from firing
    
    if (colorToDelete && swatchToDelete) {
      const data = await chrome.storage.local.get('savedColors');
      let currentColors = data.savedColors || [];
      
      currentColors = currentColors.filter(c => c.value !== colorToDelete);
      await chrome.storage.local.set({ savedColors: currentColors });
      
      swatchToDelete.remove();
      
      // Clear targets
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
    swatch.title = colorObj.name; 
    
    // Left-click applies the color
    swatch.addEventListener('click', () => applyColorToWindow(colorObj.value));

    // Right-click opens our custom menu
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault(); 
      
      // Save which color the user is targeting
      colorToDelete = colorObj.value;
      swatchToDelete = swatch;
      
      // Show the menu
      contextMenu.style.display = 'block';
      
      // Position the menu exactly where the mouse clicked
      let xPos = e.pageX;
      let yPos = e.pageY;
      
      // Prevent the menu from clipping off the right side of the popup
      const menuWidth = contextMenu.offsetWidth;
      const popupWidth = document.body.clientWidth;
      if (xPos + menuWidth > popupWidth) {
        xPos = popupWidth - menuWidth - 5; 
      }
      
      contextMenu.style.left = `${xPos}px`;
      contextMenu.style.top = `${yPos}px`;
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
});