// ============================================
// Playwright Test Builder — Main Application
// ============================================

import { scanUrl, generateCode, saveTest, runTestSteps, browseSaveLocation, listSavedTests, loadSavedTest, getFrameworkStatus, getFrameworkScripts, runFramework } from './utils/api.js';
import {
  generateId,
  showToast,
  escapeHtml,
  highlightCode,
  getBestSelector,
  STEP_TYPE_INFO,
  parsePlaywrightScript,
  customConfirm,
  customPrompt,
} from './utils/helpers.js';

// ---- Application State ----
const state = {
  activeTags: [],
  steps: [],
  scannedElements: [],
  filteredElements: [],
  currentFilter: 'all',
  searchQuery: '',
  generatedCode: '',
  disableAuth: false,
  isDirty: false,
  isRawCode: false,
  codeManuallyEdited: false,
  insertIndex: null,
  settings: JSON.parse(localStorage.getItem('pw_builder_settings')) || {
    frameworkPath: localStorage.getItem('fwPath') || '',
    githubPat: localStorage.getItem('githubPat') || '',
    saveLocation: ''
  },
  fw: {
    connected: false,
    scripts: { setup: [], modules: [], legacy: [] },
  },
};

// ---- DOM References ----
const dom = {
  // Toolbar
  testNameInput: document.getElementById('test-name-input'),
  testTagsInput: document.getElementById('test-tags-input'),
  testTagsContainer: document.getElementById('test-tags-container'),
  disableAuthCheckbox: document.getElementById('disable-auth-checkbox'),
  envSelect: document.getElementById('env-select'),
  urlInput: document.getElementById('url-input'),
  scanBtn: document.getElementById('scan-btn'),
  saveBtn: document.getElementById('save-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  // Step Panel
  stepsContainer: document.getElementById('steps-container'),
  stepCount: document.getElementById('step-count'),
  addStepBtn: document.getElementById('add-step-btn'),
  emptySteps: document.getElementById('empty-steps'),
  // Code Panel
  codeContainer: document.getElementById('code-container'),
  codeBlock: document.getElementById('code-block'),
  codeOutput: document.getElementById('code-output'),
  emptyCode: document.getElementById('empty-code'),
  copyCodeBtn: document.getElementById('copy-code-btn'),
  reloadCodeBtn: document.getElementById('reload-code-btn'),
  downloadBtn: document.getElementById('download-btn'),
  fullViewBtn: document.getElementById('full-view-btn'),
  fullCodeModal: document.getElementById('full-code-modal'),
  fullCodeClose: document.getElementById('full-code-close'),
  fullCodeOutput: document.getElementById('full-code-output'),
  panels: document.getElementById('panels'),
  resizer1: document.getElementById('resizer-1'),
  resizer2: document.getElementById('resizer-2'),
  // Modal
  modal: document.getElementById('add-step-modal'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  modalAdd: document.getElementById('modal-add'),
  stepType: document.getElementById('step-type'),
  stepSelector: document.getElementById('step-selector'),
  stepValue: document.getElementById('step-value'),
  stepDescription: document.getElementById('step-description'),
  selectorGroup: document.getElementById('selector-group'),
  selectorChoicesWrapper: document.getElementById('selector-choices-wrapper'),
  selectorChoicesDropdown: document.getElementById('selector-choices-dropdown'),
  valueGroup: document.getElementById('value-group'),
  delayGroup: document.getElementById('delay-group'),
  stepDelay: document.getElementById('step-delay'),
  waitUntilGroup: document.getElementById('wait-until-group'),
  stepWaitUntil: document.getElementById('step-wait-until'),
  openModal: document.getElementById('open-modal'),
  openClose: document.getElementById('open-close'),
  openCancel: document.getElementById('open-cancel'),
  openConfirm: document.getElementById('open-confirm'),
  openFileSelect: document.getElementById('open-file-select'),
  // Live Runner
  runBtn: document.getElementById('run-btn'),
  runnerModal: document.getElementById('runner-modal'),
  runnerClose: document.getElementById('runner-close'),
  runnerLogs: document.getElementById('runner-logs'),
  runnerStartBtn: document.getElementById('runner-start-btn'),
  runnerStatTotal: document.getElementById('runner-stat-total'),
  runnerStatStatus: document.getElementById('runner-stat-status'),
  runnerStatDuration: document.getElementById('runner-stat-duration'),
  runnerPreviewPlaceholder: document.getElementById('runner-preview-placeholder'),
  runnerMockBrowser: document.getElementById('runner-mock-browser'),
  mockAddressBar: document.getElementById('mock-address-bar'),
  mockStatusTitle: document.getElementById('mock-status-title'),
  mockStatusDesc: document.getElementById('mock-status-desc'),
  mockProgressBar: document.getElementById('mock-progress-bar'),
  runnerScreenshotFrame: document.getElementById('runner-screenshot-frame'),
  runnerScreenshotImg: document.getElementById('runner-screenshot-img'),
  // Settings Modal
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsClose: document.getElementById('settings-close'),
  settingsCancel: document.getElementById('settings-cancel'),
  settingsSave: document.getElementById('settings-save'),
  frameworkPathInput: document.getElementById('framework-path-input'),
  frameworkPathBrowseBtn: document.getElementById('framework-path-browse-btn'),
  cxPhoneInput: document.getElementById('cx-phone-input'),
  pmPhoneInput: document.getElementById('pm-phone-input'),
  // Framework Run Modal
  fwRunModal: document.getElementById('fw-run-modal'),
  fwRunClose: document.getElementById('fw-run-close'),
  fwOpenRunnerBtn: document.getElementById('fw-open-runner-btn'),
  fwCopyLogsBtn: document.getElementById('fw-copy-logs-btn'),
  
  // Framework Panel
  fwStatusDot: document.getElementById('fw-status-dot'),
  fwStatusBadge: document.getElementById('fw-status-badge'),
  fwAuthBadge: document.getElementById('fw-auth-badge'),
  fwPathDisplay: document.getElementById('fw-path-display'),
  fwExplorerTree: document.getElementById('fw-explorer-tree'),
  fwNewFileBtn: document.getElementById('fw-new-file-btn'),
  fwNewFolderBtn: document.getElementById('fw-new-folder-btn'),
  fwRefreshTreeBtn: document.getElementById('fw-refresh-tree-btn'),
  fwModuleSelect: document.getElementById('fw-module-select'),
  fwRunAllBtn: document.getElementById('fw-run-all-btn'),
  fwRunSetupBtn: document.getElementById('fw-run-setup-btn'),
  fwRunModuleBtn: document.getElementById('fw-run-module-btn'),
  fwRunTagBtn: document.getElementById('fw-run-tag-btn'),
  fwStopBtn: document.getElementById('fw-stop-btn'),
  fwTerminal: document.getElementById('fw-terminal'),
  fwRunStatus: document.getElementById('fw-run-status'),
  fwOpenReportBtn: document.getElementById('fw-open-report-btn'),
};

// ---- Initialize ----
function init() {
  bindEvents();
  updateStepTypeFields();
  // Auto-connect framework if path was previously saved
  if (state.settings.frameworkPath) {
    checkFrameworkConnection();
  }
}

function bindEvents() {
  // Toolbar
  dom.scanBtn.addEventListener('click', handleScan);

  dom.saveBtn.addEventListener('click', handleSave);

  // Tags Pill Input
  if (dom.testTagsInput) {
    dom.testTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const val = dom.testTagsInput.value.trim();
        if (val) {
          const tag = val.startsWith('@') ? val : '@' + val;
          if (!state.activeTags.includes(tag)) {
            state.activeTags.push(tag);
            renderTags();
            autoGenerate();
            if (state.fw.connected) loadFrameworkTags();
          }
          dom.testTagsInput.value = '';
        }
      }
    });
    
    // Allow deleting last tag with backspace if input is empty
    dom.testTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && dom.testTagsInput.value === '' && state.activeTags.length > 0) {
        state.activeTags.pop();
        renderTags();
        autoGenerate();
        if (state.fw.connected) loadFrameworkTags();
      }
    });
  }

  // Step Builder
  dom.addStepBtn.addEventListener('click', () => {
    state.insertIndex = null;
    openModal();
  });



  // Code Panel
  dom.copyCodeBtn.addEventListener('click', handleCopyCode);
  dom.downloadBtn.addEventListener('click', handleDownload);
  dom.testNameInput.addEventListener('input', () => {
    state.isDirty = true;
    autoGenerate();
  });
  
  if (dom.disableAuthCheckbox) {
    dom.disableAuthCheckbox.addEventListener('change', () => {
      state.disableAuth = dom.disableAuthCheckbox.checked;
      state.isDirty = true;
      autoGenerate();
    });
  }

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalCancel.addEventListener('click', closeModal);
  dom.modalAdd.addEventListener('click', handleAddStep);
  dom.stepType.addEventListener('change', updateStepTypeFields);
  dom.selectorChoicesDropdown.addEventListener('change', () => {
    if (dom.selectorChoicesDropdown.value) {
      dom.stepSelector.value = dom.selectorChoicesDropdown.value;
    }
  });
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  dom.openClose.addEventListener('click', closeOpenModal);
  dom.openCancel.addEventListener('click', closeOpenModal);
  dom.openConfirm.addEventListener('click', handleOpenConfirm);
  dom.openModal.addEventListener('click', (e) => {
    if (e.target === dom.openModal) closeOpenModal();
  });

  // Runner Modal
  dom.runBtn.addEventListener('click', handleRunTest);
  dom.runnerClose.addEventListener('click', closeRunnerModal);
  dom.runnerStartBtn.addEventListener('click', handleRunExecution);
  dom.runnerModal.addEventListener('click', (e) => {
    if (e.target === dom.runnerModal) closeRunnerModal();
  });

  // Framework Run Modal
  dom.fwOpenRunnerBtn.addEventListener('click', () => {
    dom.fwRunModal.classList.remove('hidden');
  });
  dom.fwRunClose.addEventListener('click', () => {
    dom.fwRunModal.classList.add('hidden');
  });
  dom.fwRunModal.addEventListener('click', (e) => {
    if (e.target === dom.fwRunModal) {
      dom.fwRunModal.classList.add('hidden');
    }
  });

  // Settings Modal
  dom.settingsBtn.addEventListener('click', openSettingsModal);
  dom.settingsClose.addEventListener('click', closeSettingsModal);
  dom.settingsCancel.addEventListener('click', closeSettingsModal);
  dom.settingsSave.addEventListener('click', handleSaveSettings);
  dom.frameworkPathBrowseBtn.addEventListener('click', handleBrowseFrameworkPath);
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) closeSettingsModal();
  });

  // Full View Modal
  if (dom.fullViewBtn) {
    dom.fullViewBtn.addEventListener('click', () => {
      const code = state.isRawCode ? dom.codeOutput.textContent : state.generatedCode;
      dom.fullCodeOutput.innerHTML = highlightCode(code);
      dom.fullCodeModal.classList.remove('hidden');
    });
  }
  if (dom.fullCodeClose) {
    dom.fullCodeClose.addEventListener('click', () => {
      dom.fullCodeModal.classList.add('hidden');
    });
  }
  if (dom.fullCodeModal) {
    dom.fullCodeModal.addEventListener('click', (e) => {
      if (e.target === dom.fullCodeModal) dom.fullCodeModal.classList.add('hidden');
    });
  }
  if (dom.fullCodeOutput) {
    dom.fullCodeOutput.addEventListener('input', () => {
      state.isDirty = true;
      state.codeManuallyEdited = true;
      const newCode = dom.fullCodeOutput.innerText;
      if (state.isRawCode) {
        dom.codeOutput.innerHTML = highlightCode(newCode);
      } else {
        state.generatedCode = newCode;
        dom.codeOutput.innerHTML = highlightCode(newCode);
      }
    });
  }
  if (dom.codeOutput) {
    dom.codeOutput.addEventListener('input', () => {
      state.isDirty = true;
      state.codeManuallyEdited = true;
      const newCode = dom.codeOutput.innerText;
      if (state.isRawCode) {
        if (dom.fullCodeOutput) dom.fullCodeOutput.innerHTML = highlightCode(newCode);
      } else {
        state.generatedCode = newCode;
        if (dom.fullCodeOutput) dom.fullCodeOutput.innerHTML = highlightCode(newCode);
      }
    });
  }

  if (dom.reloadCodeBtn) {
    dom.reloadCodeBtn.addEventListener('click', async () => {
      // 1. Determine what to reload. If a file is active, reload it. Otherwise fallback to the Run dropdown.
      let targetFilename = state.fw.activeFilename;
      let targetLocation = state.settings.saveLocation;
      let isFromDropdown = false;
      let targetFolder = '';

      if (!targetFilename) {
        if (state.fw.selectedFilePath && state.fw.selectedFilePath.endsWith('.ts')) {
          // Parse the path, e.g., "tests/modules/jugl-fun-test.spec.ts"
          const pathParts = state.fw.selectedFilePath.split('/');
          targetFilename = pathParts.pop();
          if (pathParts[0] === 'tests') pathParts.shift();
          targetFolder = pathParts.join('/');
          isFromDropdown = true;
        } else {
          return showToast('No file is currently open to reload (select a file in the tree first)', 'warning');
        }
      }

      if (state.isDirty) {
        const confirmRefresh = await customConfirm('You have unsaved changes in the editor. Reloading will discard them. Continue?', 'Discard Changes?');
        if (!confirmRefresh) return;
      }

      const wasDirty = state.isDirty;
      state.isDirty = false;
      
      try {
        if (isFromDropdown) {
          // If we are bootstrapping from the dropdown, just use the existing load function
          await loadScriptIntoBuilder(targetFolder, targetFilename);
        } else {
          // Standard reload of the actively opened file from disk
          const { loadSavedTest } = await import('./utils/api.js');
          const data = await loadSavedTest(targetFilename, targetLocation);
          const parsed = parsePlaywrightScript(data.content);
          
          state.steps = parsed.steps;
          dom.testNameInput.value = parsed.testName || targetFilename.replace(/\.(spec|setup)\.ts$/, '');
          state.activeTags = parsed.tags ? parsed.tags.split(' ').filter(t => t) : [];
          renderTags();
          if (dom.testTagsInput) dom.testTagsInput.value = '';
          const navStep = state.steps.find(s => s.type === 'navigate');
          if (navStep) {
            let pathVal = navStep.value || navStep.selector;
            if (pathVal.startsWith('http')) {
              try { pathVal = new URL(pathVal).pathname + new URL(pathVal).search; } catch (e) {}
            }
            dom.urlInput.value = pathVal;
          }
          state.disableAuth = data.content.includes('storageState: { cookies: [], origins: [] }');
          if (dom.disableAuthCheckbox) dom.disableAuthCheckbox.checked = state.disableAuth;
          
          if (parsed.steps.length === 0 && data.content.trim().length > 0) {
            state.isRawCode = true;
            dom.stepsContainer.style.display = 'none';
            if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'none';
            dom.stepCount.textContent = 'Raw';
          } else {
            state.isRawCode = false;
            dom.stepsContainer.style.display = 'block';
            if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'block';
          }
          
          state.generatedCode = data.content;
          if (dom.codeOutput) dom.codeOutput.innerHTML = highlightCode(data.content);
          if (dom.fullCodeOutput) dom.fullCodeOutput.innerHTML = highlightCode(data.content);
          dom.emptyCode.classList.add('hidden');
          dom.codeBlock.classList.remove('hidden');
          renderSteps();
          if (wasDirty) showToast('Reloaded changes from disk (discarded local edits)', 'info');
          else showToast('Refreshed from disk', 'success');
        }
      } catch (err) {
        showToast('Failed to reload: ' + err.message, 'error');
      }
    });
  }

  // Initialize Resizers
  initResizer();

  checkFrameworkConnection();

  // Framework panel
  dom.fwRunAllBtn.addEventListener('click', () => runFrameworkTest('all'));
  dom.fwRunSetupBtn.addEventListener('click', () => runFrameworkTest('setup'));
  
  dom.fwRunModuleBtn.addEventListener('click', () => {
    if (!state.fw.selectedFile) return showToast('Select a file to run', 'error');
    runFrameworkTest('module', state.fw.selectedFile, state.fw.selectedFilePath);
  });
  dom.fwRunTagBtn.addEventListener('click', () => {
    const tagSelect = document.getElementById('fw-run-tag-select');
    const tag = tagSelect ? tagSelect.value : null;
    if (tag) {
      runFrameworkTest('tag', tag);
    } else {
      showToast('No tag selected', 'error');
    }
  });

  if (dom.fwStopBtn) {
    dom.fwStopBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/framework/stop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Test stopped', 'success');
        } else {
          showToast('Could not stop test: ' + data.message, 'error');
        }
      } catch (err) {
        showToast('Error stopping test', 'error');
      }
    });
  }

  dom.fwOpenReportBtn.addEventListener('click', () => {
    window.open('/api/framework/report/index.html', '_blank');
  });

  if (dom.fwCopyLogsBtn) {
    dom.fwCopyLogsBtn.addEventListener('click', async () => {
      const text = dom.fwTerminal.innerText;
      if (!text || text.includes('Terminal output will appear here')) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Logs copied to clipboard!', 'success');
      } catch (err) {
        showToast('Failed to copy logs', 'error');
      }
    });
  }




  // Listen to message events from proxy inspector iframe or inspector tab
  window.addEventListener('message', (e) => {
    if (e.data) {
      if (e.data.type === 'ADD_STEP_MANUAL') {
        const manualStep = e.data.step;
        const info = STEP_TYPE_INFO[manualStep.type] || { emoji: '❓', label: manualStep.type };
        
        const step = {
          id: generateId(),
          type: manualStep.type,
          selector: manualStep.selector,
          value: manualStep.value || '',
          description: manualStep.description || `Action on ${manualStep.selector}`,
          order: state.steps.length,
        };
        
        state.steps.push(step);
        showToast(`${info.emoji} ${info.label} step added manually`, 'success');
        renderSteps();
        autoGenerate();
      } else if (e.data.type === 'ELEMENT_CLICKED' || e.data.type === 'INPUT_CHANGED') {
        // Only trigger auto-add if the message comes from the embedded iframe or older behavior, 
        // but now the inspector tab handles these and sends ADD_STEP_MANUAL instead.
        // We'll keep this just in case they are still generated directly.
        const { bestSelector, tagName, value } = e.data.element;
        const typeMap = {
          button: 'click', input: 'fill', select: 'select',
          textarea: 'fill', a: 'click', h1: 'assertText',
          h2: 'assertText', h3: 'assertText', h4: 'assertText',
          h5: 'assertText', h6: 'assertText',
        };
        let type = typeMap[tagName] || 'click';
        if (value && type === 'click') type = 'fill';
        
        const info = STEP_TYPE_INFO[type] || { emoji: '❓', label: type };
        
        const step = {
          id: generateId(),
          type,
          selector: bestSelector,
          value: value || '',
          description: value ? `Fill "${value}" into ${tagName}` : `Click on ${tagName}`,
          order: state.steps.length,
        };
        
        state.steps.push(step);
        showToast(`${info.emoji} ${info.label} step added automatically`, 'success');
        renderSteps();
        autoGenerate();
      } else if (e.data.type === 'URL_CHANGED') {
        dom.urlInput.value = e.data.url;
        showToast(`Navigated to: ${e.data.url}`, 'info');
      }
    }
  });



  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!dom.modal.classList.contains('hidden')) {
        closeModal();
      }
      if (!dom.runnerModal.classList.contains('hidden')) {
        closeRunnerModal();
      }
      if (!dom.settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
      }
      if (!dom.openModal.classList.contains('hidden')) {
        closeOpenModal();
      }
    }
  });
}

// ============================================
// SCAN HANDLER
// ============================================
async function handleScan() {
  const path = dom.urlInput.value.trim() || '/';
  const envUrl = dom.envSelect ? dom.envSelect.value.replace(/\/$/, '') : 'https://web-dev.jugl.com';
  
  let fullUrl = path.startsWith('http') ? path : `${envUrl}${path.startsWith('/') ? path : '/' + path}`;

  // Open the visual inspector in a new window/tab
  window.open(`/inspector.html?url=${encodeURIComponent(fullUrl)}`, '_blank', 'width=1200,height=800');

  let stepValue = path;
  if (path.startsWith('http')) {
    try { stepValue = new URL(path).pathname + new URL(path).search; } catch (e) {}
  } else if (!path.startsWith('/')) {
    stepValue = '/' + path;
  }

  // Auto-add navigation step if there are no steps yet
  if (state.steps.length === 0) {
    state.steps.push({
      id: generateId(),
      type: 'navigate',
      selector: '',
      value: stepValue,
      description: `Navigate to ${stepValue}`,
      order: 0,
    });
    renderSteps();
    autoGenerate();
  }
}

// ============================================
// ELEMENT RENDERING
// ============================================
function renderElements() {
  const elements = state.filteredElements;
  dom.elementCount.textContent = elements.length;

  if (elements.length === 0) {
    dom.emptyScanner.classList.remove('hidden');
    dom.emptyScanner.querySelector('.empty-state__text').textContent =
      state.scannedElements.length > 0 ? 'No matching elements' : 'No elements scanned';
    // Clear any existing element cards
    const existingCards = dom.elementsContainer.querySelectorAll('.element-card');
    existingCards.forEach((c) => c.remove());
    return;
  }

  dom.emptyScanner.classList.add('hidden');

  // Build element cards
  const fragment = document.createDocumentFragment();

  elements.forEach((el, index) => {
    const card = document.createElement('div');
    card.className = 'element-card';
    card.style.animationDelay = `${Math.min(index * 30, 500)}ms`;

    // Header with tag + text + ID
    const displayText = el.text || el.ariaLabel || el.placeholder || el.name || el.id || el.className || '(no label)';

    let headerHtml = `<div class="element-card__header">`;
    headerHtml += `<span class="element-card__tag element-card__tag--${el.tagName}">&lt;${el.tagName}&gt;</span>`;
    headerHtml += `<span class="element-card__text" title="${escapeHtml(displayText)}">${escapeHtml(displayText)}</span>`;
    if (el.id) {
      headerHtml += `<span class="element-card__id" title="id: ${escapeHtml(el.id)}">#${escapeHtml(el.id)}</span>`;
    }
    headerHtml += `</div>`;

    // Selectors
    let selectorsHtml = `<div class="element-card__selectors">`;
    const sels = el.selectors;
    const selectorEntries = [
      { label: 'testid', value: sels.byTestId },
      { label: 'role', value: sels.byRole },
      { label: 'label', value: sels.byLabel },
      { label: 'placeholder', value: sels.byPlaceholder },
      { label: 'text', value: sels.byText },
      { label: 'id', value: sels.byId },
      { label: 'css', value: sels.css },
    ];

    selectorEntries.forEach(({ label, value }) => {
      if (value) {
        selectorsHtml += `
          <span class="selector-chip" data-selector="${escapeHtml(value)}" title="Click to copy: ${escapeHtml(value)}">
            <span class="selector-chip__label">${label}:</span>
            <span class="selector-chip__value">${escapeHtml(value)}</span>
          </span>`;
      }
    });
    selectorsHtml += `</div>`;

    // Actions
    const bestSelector = getBestSelector(el.selectors);
    let actionsHtml = `<div class="element-card__actions">`;
    actionsHtml += `<button class="btn--use" data-index="${index}" data-selector="${escapeHtml(bestSelector)}" data-tag="${el.tagName}" data-text="${escapeHtml(displayText)}">+ Use in Step</button>`;
    actionsHtml += `</div>`;

    card.innerHTML = headerHtml + selectorsHtml + actionsHtml;
    fragment.appendChild(card);
  });

  // Replace content
  const existingCards = dom.elementsContainer.querySelectorAll('.element-card');
  existingCards.forEach((c) => c.remove());
  dom.elementsContainer.appendChild(fragment);

  // Bind click handlers for selector chips and "Use in Step" buttons
  dom.elementsContainer.querySelectorAll('.selector-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.selector;
      navigator.clipboard.writeText(value).then(() => {
        showToast('Selector copied to clipboard', 'success');
      });
    });
  });

  dom.elementsContainer.querySelectorAll('.btn--use').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const el = elements[idx];
      const selector = btn.dataset.selector;
      const tagName = btn.dataset.tag;
      if (el && el.selectors) {
        openModalWithSelector(selector, tagName, el.selectors);
      } else {
        openModalWithSelector(selector, tagName);
      }
    });
  });
}

function handleSearch() {
  state.searchQuery = dom.elementSearch.value.toLowerCase().trim();
  applyFilters();
}

function handleFilterTag(e) {
  const tag = e.target.closest('.tag');
  if (!tag) return;

  state.currentFilter = tag.dataset.filter;

  // Update active state
  dom.filterTags.querySelectorAll('.tag').forEach((t) => t.classList.remove('tag--active'));
  tag.classList.add('tag--active');

  applyFilters();
}

function applyFilters() {
  let filtered = state.scannedElements;

  // Type filter
  if (state.currentFilter !== 'all') {
    if (state.currentFilter === 'heading') {
      filtered = filtered.filter((el) => /^h[1-6]$/.test(el.tagName));
    } else if (state.currentFilter === 'other') {
      filtered = filtered.filter(
        (el) =>
          !['button', 'input', 'a', 'select', 'textarea'].includes(el.tagName) &&
          !/^h[1-6]$/.test(el.tagName)
      );
    } else {
      filtered = filtered.filter((el) => el.tagName === state.currentFilter);
    }
  }

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery;
    filtered = filtered.filter((el) => {
      return (
        el.id.toLowerCase().includes(q) ||
        el.text.toLowerCase().includes(q) ||
        el.ariaLabel.toLowerCase().includes(q) ||
        el.placeholder.toLowerCase().includes(q) ||
        el.className.toLowerCase().includes(q) ||
        el.dataTestId.toLowerCase().includes(q) ||
        el.name.toLowerCase().includes(q) ||
        el.tagName.toLowerCase().includes(q)
      );
    });
  }

  state.filteredElements = filtered;
  renderElements();
}

function initResizer() {
  const { resizer1, resizer2, panels } = dom;
  if(!resizer1 || !resizer2 || !panels) return;

  let isResizing = null;
  let startX, startW1, startW2, startW3;

  const startResize = (e, index) => {
    isResizing = index;
    startX = e.clientX;
    const style = window.getComputedStyle(panels);
    const cols = style.gridTemplateColumns.split(' ');
    // cols format e.g. "300px 5px 300px 5px 360px"
    startW1 = parseFloat(cols[0]) || 300;
    startW2 = parseFloat(cols[2]) || 300;
    startW3 = parseFloat(cols[4]) || 360;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    if(index === 1) resizer1.classList.add('active');
    if(index === 2) resizer2.classList.add('active');
  };

  resizer1.addEventListener('mousedown', (e) => startResize(e, 1));
  resizer2.addEventListener('mousedown', (e) => {
    if (e.target === resizer2) startResize(e, 2);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    
    if (isResizing === 1) {
      let newW1 = startW1 + dx;
      let newW2 = startW2 - dx;
      if (newW1 < 150) { newW2 -= (150 - newW1); newW1 = 150; }
      if (newW2 < 150) { newW1 -= (150 - newW2); newW2 = 150; }
      panels.style.setProperty('--panel-w1', `${newW1}px`);
      panels.style.setProperty('--panel-w2', `${newW2}px`);
    } else if (isResizing === 2) {
      let newW2 = startW2 + dx;
      let newW3 = startW3 - dx;
      if (newW2 < 150) { newW3 -= (150 - newW2); newW2 = 150; }
      if (newW3 < 150) { newW2 -= (150 - newW3); newW3 = 150; }
      panels.style.setProperty('--panel-w2', `${newW2}px`);
      panels.style.setProperty('--panel-w3', `${newW3}px`);
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = null;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
    resizer1.classList.remove('active');
    resizer2.classList.remove('active');
  });
}

// ============================================
// STEP PANEL LOGICLDER
// ============================================
function openModal(editStep = null) {
  state.editingStepId = editStep ? editStep.id : null;

  dom.modal.classList.remove('hidden');
  renderSelectorChoices(null);

  if (editStep) {
    dom.stepType.value = editStep.type;
    dom.stepSelector.value = editStep.selector;
    dom.stepValue.value = editStep.value;
    if (dom.stepDelay) dom.stepDelay.value = editStep.delay !== undefined ? editStep.delay : '';
    if (dom.stepWaitUntil) dom.stepWaitUntil.value = editStep.waitUntil || '';
    dom.stepDescription.value = editStep.description;
    dom.modalAdd.textContent = 'Update Step';
  } else {
    dom.stepType.value = 'click';
    dom.stepSelector.value = '';
    dom.stepValue.value = '';
    if (dom.stepDelay) dom.stepDelay.value = '';
    if (dom.stepWaitUntil) dom.stepWaitUntil.value = '';
    dom.stepDescription.value = '';
    dom.modalAdd.textContent = 'Add Step';
  }

  updateStepTypeFields();
  dom.stepSelector.focus();
}

function openModalWithSelector(selector, tagName, selectors = null) {
  dom.modal.classList.remove('hidden');
  state.editingStepId = null;
  state.insertIndex = null;

  // Auto-select step type based on element tag
  const typeMap = {
    button: 'click',
    input: 'fill',
    select: 'select',
    textarea: 'fill',
    a: 'click',
    h1: 'assertText',
    h2: 'assertText',
    h3: 'assertText',
    h4: 'assertText',
    h5: 'assertText',
    h6: 'assertText',
  };

  dom.stepType.value = typeMap[tagName] || 'click';
  dom.stepSelector.value = selector;
  dom.stepValue.value = '';
  if (dom.stepDelay) dom.stepDelay.value = '';
  if (dom.stepWaitUntil) dom.stepWaitUntil.value = '';
  dom.stepDescription.value = '';
  dom.modalAdd.textContent = 'Add Step';

  updateStepTypeFields();
  renderSelectorChoices(selectors, selector);
}

function closeModal() {
  dom.modal.classList.add('hidden');
  state.editingStepId = null;
}

function updateStepTypeFields() {
  const type = dom.stepType.value;
  const info = STEP_TYPE_INFO[type];

  if (!info) return;

  // Show/hide selector field
  dom.selectorGroup.classList.toggle('hidden', !info.needsSelector);

  // Show/hide value field
  dom.valueGroup.classList.toggle('hidden', !info.needsValue);

  // Show/hide wait-until field
  if (dom.waitUntilGroup) {
    dom.waitUntilGroup.classList.toggle('hidden', type !== 'navigate');
  }

  // Show/hide delay field
  if (dom.delayGroup) {
    dom.delayGroup.classList.toggle('hidden', type !== 'fill');
  }

  // Update placeholder
  if (info.valuePlaceholder) {
    dom.stepValue.placeholder = info.valuePlaceholder;
  }
}

function handleAddStep() {
  const type = dom.stepType.value;
  const selector = dom.stepSelector.value.trim();
  let value = dom.stepValue.value.trim();
  const delayVal = dom.stepDelay ? parseInt(dom.stepDelay.value.trim(), 10) : NaN;
  const delay = isNaN(delayVal) ? undefined : delayVal;
  const waitUntil = dom.stepWaitUntil ? dom.stepWaitUntil.value : '';
  
  // Strip absolute URLs for navigation steps
  if (type === 'navigate' && value.startsWith('http')) {
    try { value = new URL(value).pathname + new URL(value).search; } catch (e) {}
  }
  const description = dom.stepDescription.value.trim();
  const info = STEP_TYPE_INFO[type];

  // Validation
  if (info.needsSelector && !selector) {
    showToast('Selector is required for this step type', 'error');
    dom.stepSelector.focus();
    return;
  }

  if (info.needsValue && !value && type !== 'waitForSelector' && type !== 'screenshot') {
    showToast('Value is required for this step type', 'error');
    dom.stepValue.focus();
    return;
  }

  if (state.editingStepId) {
    // Update existing step
    const step = state.steps.find((s) => s.id === state.editingStepId);
    if (step) {
      step.type = type;
      step.selector = selector;
      step.value = value;
      if (type === 'fill') step.delay = delay;
      else delete step.delay;
      step.waitUntil = waitUntil;
      step.description = description;
    }
    showToast('Step updated', 'success');
  } else {
    // Add new step
    const step = {
      id: generateId(),
      type,
      selector,
      value,
      delay: type === 'fill' ? delay : undefined,
      waitUntil,
      description,
      order: state.steps.length,
    };
    
    if (state.insertIndex !== null) {
      state.steps.splice(state.insertIndex, 0, step);
      state.insertIndex = null;
    } else {
      state.steps.push(step);
    }
    
    // Update order
    state.steps.forEach((s, i) => s.order = i);
    
    showToast(`${info.emoji} ${info.label} step added`, 'success');
  }

  closeModal();
  renderSteps();
  autoGenerate();
}

function deleteStep(id) {
  state.steps = state.steps.filter((s) => s.id !== id);
  // Re-order
  state.steps.forEach((s, i) => (s.order = i));
  renderSteps();
  autoGenerate();
  showToast('Step removed', 'info');
}

function renderSteps() {
  dom.stepCount.textContent = state.steps.length;

  if (state.steps.length === 0) {
    dom.emptySteps.classList.remove('hidden');
    const existingCards = dom.stepsContainer.querySelectorAll('.step-card');
    existingCards.forEach((c) => c.remove());
    return;
  }

  dom.emptySteps.classList.add('hidden');

  const fragment = document.createDocumentFragment();

  state.steps.forEach((step, index) => {
    const info = STEP_TYPE_INFO[step.type] || { emoji: '❓', label: step.type };
    const card = document.createElement('div');
    card.className = 'step-card';
    card.draggable = true;
    card.dataset.index = index;

    let html = `
      <div class="step-card__header">
        <div class="step-card__handle" title="Drag to reorder">
          <span class="step-card__handle-dot"></span>
          <span class="step-card__handle-dot"></span>
          <span class="step-card__handle-dot"></span>
        </div>
        <input type="number" class="step-card__order-input" data-id="${step.id}" value="${index + 1}" min="1" max="${state.steps.length}" style="width: 46px; text-align: center; border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary); border-radius: 4px; padding: 2px; font-size: var(--text-sm);" title="Edit order number" />
        <span class="step-card__type step-card__type--${step.type}">${info.emoji} ${info.label}</span>
        <div class="step-card__actions">
          <button class="btn btn--danger-small btn--insert-step" data-index="${index}" title="Insert step below" style="background:var(--accent-primary);">➕</button>
          <button class="btn btn--danger-small btn--edit-step" data-id="${step.id}" title="Edit step">✏️</button>
          <button class="btn btn--danger-small btn--delete-step" data-id="${step.id}" title="Delete step">🗑️</button>
        </div>
      </div>
    `;

    // Body with details
    html += `<div class="step-card__body">`;
    if (step.selector) {
      html += `
        <div class="step-card__detail">
          <span class="step-card__label">Selector</span>
          <span class="step-card__value" title="${escapeHtml(step.selector)}">${escapeHtml(step.selector)}</span>
        </div>`;
    }
    if (step.value) {
      html += `
        <div class="step-card__detail">
          <span class="step-card__label">Value</span>
          <span class="step-card__value" title="${escapeHtml(step.value)}">${escapeHtml(step.value)}</span>
        </div>`;
    }
    html += `</div>`;

    if (step.description) {
      html += `<div class="step-card__description">${escapeHtml(step.description)}</div>`;
    }

    card.innerHTML = html;

    // Drag events
    card.addEventListener('dragstart', (e) => {
      state.dragSourceIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.step-card').forEach((c) => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      const targetIndex = parseInt(card.dataset.index, 10);
      if (state.dragSourceIndex === null || state.dragSourceIndex === targetIndex) return;

      // Reorder
      const [moved] = state.steps.splice(state.dragSourceIndex, 1);
      state.steps.splice(targetIndex, 0, moved);
      state.steps.forEach((s, i) => (s.order = i));

      state.dragSourceIndex = null;
      renderSteps();
      autoGenerate();
      showToast('Steps reordered', 'info');
    });

    fragment.appendChild(card);
  });

  // Replace content
  const existingCards = dom.stepsContainer.querySelectorAll('.step-card');
  existingCards.forEach((c) => c.remove());
  dom.stepsContainer.appendChild(fragment);

  // Bind edit/delete buttons
  dom.stepsContainer.querySelectorAll('.btn--edit-step').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const step = state.steps.find((s) => s.id === btn.dataset.id);
      if (step) openModal(step);
    });
  });

  dom.stepsContainer.querySelectorAll('.btn--delete-step').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteStep(btn.dataset.id);
    });
  });
  
  dom.stepsContainer.querySelectorAll('.btn--insert-step').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      state.insertIndex = idx + 1;
      openModal();
    });
  });

  dom.stepsContainer.querySelectorAll('.step-card__order-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const stepId = input.dataset.id;
      let newOrder = parseInt(input.value, 10);
      if (isNaN(newOrder) || newOrder < 1) newOrder = 1;
      if (newOrder > state.steps.length) newOrder = state.steps.length;
      
      const oldIndex = state.steps.findIndex(s => s.id === stepId);
      if (oldIndex !== -1 && oldIndex !== newOrder - 1) {
        const [moved] = state.steps.splice(oldIndex, 1);
        state.steps.splice(newOrder - 1, 0, moved);
        state.steps.forEach((s, i) => s.order = i);
        renderSteps();
        autoGenerate();
        showToast('Step order updated', 'info');
      } else {
        input.value = oldIndex + 1;
      }
    });
  });
}

// ============================================
// CODE GENERATION
// ============================================
async function handleGenerate() {
  if (state.steps.length === 0) {
    showToast('Add at least one test step first', 'error');
    return;
  }

  const rawName = dom.testNameInput.value.trim() || 'Untitled Test';
  const tags = state.activeTags.length > 0 ? state.activeTags.join(' ') : '';
  const fullName = tags ? `${rawName} ${tags}` : rawName;
  const baseURL = dom.urlInput.value.trim();

  try {
    const result = await generateCode(fullName, '', state.steps, baseURL);
    state.generatedCode = result.code;
    renderCode(result.code);
    showToast('Code generated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to generate code', 'error');
  }
}

function autoGenerate() {
  // Live preview — generate code client-side for instant feedback
  if (state.steps.length === 0) {
    state.generatedCode = '';
    dom.emptyCode.classList.remove('hidden');
    dom.codeBlock.classList.add('hidden');
    return;
  }

  // Client-side generation for live preview
  const rawName = dom.testNameInput.value.trim() || 'Untitled Test';
  const tags = state.activeTags.length > 0 ? state.activeTags.join(' ') : '';
  const fullName = tags ? `${rawName} ${tags}` : rawName;
  
  const code = clientSideGenerate(fullName, state.steps);
  state.generatedCode = code;
  state.codeManuallyEdited = false;
  renderCode(code);
  state.isDirty = true;
}

function renderTags() {
  if (!dom.testTagsContainer) return;
  dom.testTagsContainer.innerHTML = '';
  
  state.activeTags.forEach((tag, index) => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `
      <span>${escapeHtml(tag)}</span>
      <button title="Remove tag" data-index="${index}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;
    pill.querySelector('button').addEventListener('click', () => {
      state.activeTags.splice(index, 1);
      renderTags();
      autoGenerate();
      if (state.fw.connected) loadFrameworkTags();
    });
    dom.testTagsContainer.appendChild(pill);
  });
}

function clientSideGenerate(testName, steps) {
  const lines = [];
  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');

  if (state.disableAuth) {
    lines.push(`// Override global storage state to run completely unauthenticated for this file`);
    lines.push(`test.use({ storageState: { cookies: [], origins: [] } });`);
    lines.push('');
  }

  lines.push(`test('${testName}', async ({ page }) => {`);

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of sortedSteps) {
    if (step.description) {
      lines.push(`  // ${step.description}`);
    }
    lines.push(`  ${generateStepLine(step)}`);
    lines.push('');
  }

  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

function generateStepLine(step) {
  const { type, selector: sel, value: val } = step;

  const isLocator = sel.startsWith('page.');
  const safeSel = sel ? JSON.stringify(sel) : '""';
  const safeVal = val ? JSON.stringify(val) : '""';
  const selectorExpr = isLocator ? sel : `page.locator(${safeSel})`;

  switch (type) {
    case 'navigate':
      return `await page.goto(${val ? safeVal : safeSel}${step.waitUntil ? `, { waitUntil: '${step.waitUntil}' }` : ''});`;
    case 'click':
      return `await ${selectorExpr}.click();`;
    case 'dblclick':
      return `await ${selectorExpr}.dblclick();`;
    case 'fill':
      if (step.delay !== undefined && step.delay > 0) {
        return `await ${selectorExpr}.pressSequentially(${safeVal}, { delay: ${step.delay} });`;
      }
      return `await ${selectorExpr}.fill(${safeVal});`;
    case 'select':
      return `await ${selectorExpr}.selectOption(${safeVal});`;
    case 'check':
      return `await ${selectorExpr}.check();`;
    case 'uncheck':
      return `await ${selectorExpr}.uncheck();`;
    case 'hover':
      return `await ${selectorExpr}.hover();`;
    case 'press':
      return `await ${selectorExpr}.press(${safeVal});`;
    case 'scrollTo':
      return `await ${selectorExpr}.scrollIntoViewIfNeeded();`;
    case 'waitForSelector':
      return isLocator
        ? `await ${sel}.waitFor({ state: 'visible'${val ? `, timeout: ${val}` : ''} });`
        : `await page.waitForSelector(${safeSel}${val ? `, { timeout: ${val} }` : ''});`;
    case 'waitForTimeout':
      return `await page.waitForTimeout(${val || 1000});`;
    case 'assertVisible':
      return `await expect(${selectorExpr}).toBeVisible();`;
    case 'assertText':
      return `await expect(${selectorExpr}).toContainText(${safeVal});`;
    case 'assertValue':
      return `await expect(${selectorExpr}).toHaveValue(${safeVal});`;
    case 'assertUrl':
      return `await expect(page).toHaveURL(${safeVal});`;
    case 'screenshot':
      return `await page.screenshot({ path: ${val ? safeVal : '"screenshot.png"'}, fullPage: true });`;
    default:
      return `// Unknown: ${type}`;
  }
}

function renderCode(code) {
  dom.emptyCode.classList.add('hidden');
  dom.codeBlock.classList.remove('hidden');
  dom.codeOutput.innerHTML = highlightCode(code);
}

// ============================================
// SAVE & EXPORT
// ============================================
async function handleSave() {
  if (!state.generatedCode) {
    showToast('Generate code first', 'error');
    return;
  }

  let codeToSave = state.generatedCode;
  if (state.isRawCode || state.codeManuallyEdited) {
    codeToSave = dom.codeOutput.innerText.replace(/\u00A0/g, ' ');
  }

  let filename;
  if (state.fw.activeFilename) {
    filename = state.fw.activeFilename;
  } else {
    const testName = dom.testNameInput.value.trim() || 'untitled-test';
    filename = testName.replace(/\s+/g, '-').toLowerCase() + '.spec.ts';
  }

  try {
    const result = await saveTest(filename, codeToSave, state.settings.saveLocation);
    showToast(`Saved as ${result.filename}`, 'success');
    state.isDirty = false;
    // Refresh tags if connected
    if (state.fw.connected) {
      loadFrameworkTags();
    }
  } catch (err) {
    showToast(err.message || 'Failed to save', 'error');
  }
}

async function handleOpenClick() {
  dom.openModal.classList.remove('hidden');
  dom.openFileSelect.innerHTML = '<option value="">Loading files...</option>';
  try {
    const data = await listSavedTests(state.settings.saveLocation);
    if (!data.files || data.files.length === 0) {
      dom.openFileSelect.innerHTML = '<option value="">No tests found in location</option>';
      return;
    }
    dom.openFileSelect.innerHTML = data.files.map(f => `<option value="${f}">${f}</option>`).join('');
  } catch (err) {
    dom.openFileSelect.innerHTML = `<option value="">Error loading files</option>`;
    showToast(err.message, 'error');
  }
}

function closeOpenModal() {
  dom.openModal.classList.add('hidden');
}

async function handleOpenConfirm() {
  const file = dom.openFileSelect.value;
  if (!file) return;
  try {
    const data = await loadSavedTest(file, state.settings.saveLocation);
    const parsed = parsePlaywrightScript(data.content);
    
    state.steps = parsed.steps;
    dom.testNameInput.value = parsed.testName;
    state.activeTags = parsed.tags ? parsed.tags.split(' ').filter(t => t) : [];
    renderTags();
    if (dom.testTagsInput) {
      dom.testTagsInput.value = '';
    }
    
    const navStep = state.steps.find(s => s.type === 'navigate');
    if (navStep) {
      let pathVal = navStep.value || navStep.selector;
      if (pathVal.startsWith('http')) {
        try { pathVal = new URL(pathVal).pathname + new URL(pathVal).search; } catch (e) {}
      }
      dom.urlInput.value = pathVal;
    }
    
    state.disableAuth = data.content.includes('storageState: { cookies: [], origins: [] }');
    if (dom.disableAuthCheckbox) {
      dom.disableAuthCheckbox.checked = state.disableAuth;
    }
    
    renderSteps();
    autoGenerate();
    closeOpenModal();
    showToast(`Loaded ${file}`, 'success');
  } catch(err) {
    showToast(err.message, 'error');
  }
}

// ============================================
// SETTINGS LOGIC
// ============================================
function openSettingsModal() {
  dom.frameworkPathInput.value = state.settings.frameworkPath || '';
  dom.settingsModal.classList.remove('hidden');
  
  // Load env variables if framework path is set
  if (state.settings.frameworkPath) {
    try {
      fetch(`/api/framework/env?path=${encodeURIComponent(state.settings.frameworkPath)}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            if (dom.cxPhoneInput) dom.cxPhoneInput.value = data.cxPhone || '';
            if (dom.pmPhoneInput) dom.pmPhoneInput.value = data.pmPhone || '';
          }
        });
    } catch (e) {
      console.error('Failed to load env vars', e);
    }
  }
}

function closeSettingsModal() {
  dom.settingsModal.classList.add('hidden');
}

async function handleSaveSettings() {
  if (dom.frameworkPathInput) {
    const fwPath = dom.frameworkPathInput.value.trim();
    state.settings.frameworkPath = fwPath;
    localStorage.setItem('fwPath', fwPath);
  }

  localStorage.setItem('pw_builder_settings', JSON.stringify(state.settings));

  // Save env variables if framework path is set
  if (state.settings.frameworkPath) {
    try {
      await fetch('/api/framework/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: state.settings.frameworkPath,
          cxPhone: dom.cxPhoneInput ? dom.cxPhoneInput.value.trim() : '',
          pmPhone: dom.pmPhoneInput ? dom.pmPhoneInput.value.trim() : ''
        })
      });
    } catch (e) {
      console.error('Failed to save env vars', e);
    }
  }

  showToast('Settings saved!', 'success');
  closeSettingsModal();
  
  if (state.settings.frameworkPath) {
    checkFrameworkConnection();
  }
}

async function handleBrowseFrameworkPath() {
  dom.frameworkPathBrowseBtn.disabled = true;
  dom.frameworkPathBrowseBtn.textContent = 'Selecting...';

  try {
    const result = await browseSaveLocation();
    if (!result.cancelled && result.path) {
      dom.frameworkPathInput.value = result.path;
      showToast('Framework directory selected', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Failed to select directory', 'error');
  } finally {
    dom.frameworkPathBrowseBtn.disabled = false;
    dom.frameworkPathBrowseBtn.textContent = 'Browse...';
  }
}

function handleCopyCode() {
  if (!state.generatedCode) {
    showToast('No code to copy', 'error');
    return;
  }

  navigator.clipboard.writeText(state.generatedCode).then(() => {
    showToast('Code copied to clipboard!', 'success');
    dom.copyCodeBtn.classList.add('copied');
    setTimeout(() => dom.copyCodeBtn.classList.remove('copied'), 1500);
  });
}

function handleDownload() {
  if (!state.generatedCode) {
    showToast('No code to download', 'error');
    return;
  }

  const testName = dom.testNameInput.value.trim() || 'untitled-test';
  const filename = testName.replace(/\s+/g, '-').toLowerCase() + '.spec.ts';

  const blob = new Blob([state.generatedCode], { type: 'text/typescript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename}`, 'success');
}

function handleClear() {
  if (state.steps.length === 0 && state.activeTags.length === 0) return;

  state.steps = [];
  state.activeTags = [];
  renderTags();
  
  state.disableAuth = false;
  if (dom.disableAuthCheckbox) dom.disableAuthCheckbox.checked = false;
  
  state.generatedCode = '';
  renderSteps();
  dom.emptyCode.classList.add('hidden');
  dom.codeBlock.classList.add('hidden');
  showToast('All steps cleared', 'info');
}

// ============================================
// LIVE TEST RUNNER HANDLERS
// ============================================
function handleRunTest() {
  if (state.steps.length === 0) {
    showToast('Add at least one test step first', 'error');
    return;
  }
  dom.runnerModal.classList.remove('hidden');
  handleRunExecution();
}

function closeRunnerModal() {
  dom.runnerModal.classList.add('hidden');
}

async function handleRunExecution() {
  // Disable the toolbar Run Test button and show spinning state
  dom.runBtn.disabled = true;
  const originalRunBtnContent = dom.runBtn.innerHTML;
  dom.runBtn.innerHTML = `
    <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10"/><path d="M4 12a8 8 0 0 1 8-8"/></svg>
    Running...
  `;

  // Set running state indicator on the screenshot placeholder
  const placeholderIcon = dom.runnerPreviewPlaceholder.querySelector('.runner-screenshot-placeholder__icon');
  const placeholderText = dom.runnerPreviewPlaceholder.querySelector('span:not(.runner-screenshot-placeholder__icon)');
  
  // Clear screenshot
  dom.runnerScreenshotImg.src = '';
  dom.runnerScreenshotFrame.classList.add('hidden');
  
  // Show mock browser loader immediately, and hide the static text placeholder!
  dom.runnerPreviewPlaceholder.classList.add('hidden');
  dom.runnerMockBrowser.classList.remove('hidden');

  // Initialize mock browser status
  const targetUrl = dom.urlInput.value.trim() || 'https://web-dev.jugl.com/';
  dom.mockAddressBar.textContent = targetUrl;
  dom.mockStatusTitle.textContent = 'Launching Headless Browser...';
  dom.mockStatusDesc.textContent = 'Initializing secure Chromium engine';
  dom.mockProgressBar.style.width = '20%';

  // Set initial status stats
  dom.runnerStatTotal.textContent = state.steps.length;
  dom.runnerStatStatus.textContent = 'Running...';
  dom.runnerStatStatus.style.color = 'var(--accent-primary)';
  dom.runnerStatDuration.textContent = '0ms';
  dom.runnerStartBtn.disabled = true;
  dom.runnerStartBtn.textContent = 'Running...';

  // Render initial steps list in pending/running states
  dom.runnerLogs.innerHTML = '';
  state.steps.forEach((step, idx) => {
    const info = STEP_TYPE_INFO[step.type] || { emoji: '❓', label: step.type };
    const row = document.createElement('div');
    row.className = 'runner-step-row runner-step-row--pending';
    row.id = `runner-step-row-${step.id}`;

    row.innerHTML = `
      <div class="runner-step-row__status">⏳</div>
      <div class="runner-step-row__details">
        <span class="runner-step-row__title">${escapeHtml(step.description || `${info.emoji} ${info.label}`)}</span>
        <span class="runner-step-row__selector" style="font-size: var(--text-xs); color: var(--text-muted); font-family: var(--font-mono)">${escapeHtml(step.selector || '')}</span>
      </div>
      <div class="runner-step-row__meta">pending</div>
    `;
    dom.runnerLogs.appendChild(row);
  });

  let accumulatedDuration = 0;
  const executedStepIds = new Set();

  try {
    const envUrl = dom.envSelect ? dom.envSelect.value.replace(/\/$/, '') : undefined;
    const liveWorkspaceSelect = document.getElementById('live-runner-workspace');
    let workspaceVal = liveWorkspaceSelect ? liveWorkspaceSelect.value : 'auto';
    
    if (workspaceVal === 'auto' || workspaceVal === 'all') {
      if (state.settings && state.settings.saveLocation) {
        const loc = state.settings.saveLocation.toLowerCase();
        if (loc.includes('/pm/') || loc.includes('\\pm\\') || loc.endsWith('/pm') || loc.endsWith('\\pm')) {
          workspaceVal = 'pm';
        } else {
          workspaceVal = 'cx';
        }
      } else {
        workspaceVal = 'cx';
      }
    }

    const response = await runTestSteps(state.steps, envUrl, state.disableAuth, state.settings.frameworkPath, workspaceVal);
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save last partial line back to buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          try {
            const event = JSON.parse(jsonStr);
            
            if (event.type === 'step_start') {
              const row = document.getElementById(`runner-step-row-${event.id}`);
              if (row) {
                row.className = 'runner-step-row runner-step-row--running';
                const statusIcon = row.querySelector('.runner-step-row__status');
                statusIcon.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>';
                const meta = row.querySelector('.runner-step-row__meta');
                meta.textContent = 'running';
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }

              // Update mock browser loader status on step start
              const step = state.steps.find(s => s.id === event.id);
              if (step) {
                const info = STEP_TYPE_INFO[step.type] || { emoji: '❓', label: step.type };
                if (step.type === 'navigate') {
                  dom.mockStatusTitle.textContent = 'Navigating...';
                  dom.mockStatusDesc.textContent = `Loading ${step.value || step.selector}`;
                  dom.mockProgressBar.style.width = '50%';
                } else {
                  dom.mockStatusTitle.textContent = `Running Step: ${info.label}...`;
                  dom.mockStatusDesc.textContent = step.description || `${step.type} ${step.selector || ''}`;
                  dom.mockProgressBar.style.width = '75%';
                }
              }
            } else if (event.type === 'step_end') {
              executedStepIds.add(event.id);
              const row = document.getElementById(`runner-step-row-${event.id}`);
              if (row) {
                row.className = `runner-step-row ${event.success ? 'runner-step-row--success' : 'runner-step-row--error'}`;
                const statusIcon = row.querySelector('.runner-step-row__status');
                statusIcon.innerHTML = event.success ? '✓' : '✗';
                
                const meta = row.querySelector('.runner-step-row__meta');
                meta.textContent = `${event.duration}ms`;

                accumulatedDuration += event.duration;
                dom.runnerStatDuration.textContent = `${accumulatedDuration}ms`;

                if (!event.success && event.error) {
                  const details = row.querySelector('.runner-step-row__details');
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'runner-step-row__error';
                  errorDiv.textContent = event.error;
                  details.appendChild(errorDiv);
                }

                // If intermediate screenshot is captured, show it instantly
                if (event.screenshot) {
                  dom.runnerMockBrowser.classList.add('hidden');
                  dom.runnerPreviewPlaceholder.classList.add('hidden');
                  dom.runnerScreenshotImg.src = `data:image/png;base64,${event.screenshot}`;
                  dom.runnerScreenshotFrame.classList.remove('hidden');
                }
              }
            } else if (event.type === 'complete') {
              dom.runnerMockBrowser.classList.add('hidden');
              dom.runnerStatStatus.textContent = event.success ? 'Passed' : 'Failed';
              dom.runnerStatStatus.style.color = event.success ? 'var(--color-success)' : 'var(--color-danger)';
              
              if (event.success) {
                showToast('Test executed successfully!', 'success');
              } else {
                showToast('Test execution failed.', 'error');
              }
            } else if (event.type === 'error') {
              dom.runnerMockBrowser.classList.add('hidden');
              dom.runnerStatStatus.textContent = 'Error';
              dom.runnerStatStatus.style.color = 'var(--color-danger)';
              showToast(event.message || 'Run execution error', 'error');
            } else if (event.type === 'log') {
              const row = document.createElement('div');
              row.className = 'runner-step-row';
              row.style.background = 'var(--bg-panel)';
              row.innerHTML = `
                <div class="runner-step-row__status" style="opacity: 0.5">ℹ️</div>
                <div class="runner-step-row__details">
                  <span class="runner-step-row__title" style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(event.message)}</span>
                </div>
                <div class="runner-step-row__meta"></div>
              `;
              dom.runnerLogs.prepend(row);
            }
          } catch (err) {
            console.error('Failed to parse SSE event:', jsonStr, err);
          }
        }
      }
    }

    // Process any leftover buffered data at the end
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.substring(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'step_end') {
            executedStepIds.add(event.id);
            const row = document.getElementById(`runner-step-row-${event.id}`);
            if (row) {
              row.className = `runner-step-row ${event.success ? 'runner-step-row--success' : 'runner-step-row--error'}`;
              const statusIcon = row.querySelector('.runner-step-row__status');
              statusIcon.innerHTML = event.success ? '✓' : '✗';
              const meta = row.querySelector('.runner-step-row__meta');
              meta.textContent = `${event.duration}ms`;
              accumulatedDuration += event.duration;
              dom.runnerStatDuration.textContent = `${accumulatedDuration}ms`;
              if (!event.success && event.error) {
                const details = row.querySelector('.runner-step-row__details');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'runner-step-row__error';
                errorDiv.textContent = event.error;
                details.appendChild(errorDiv);
              }
              if (event.screenshot) {
                dom.runnerMockBrowser.classList.add('hidden');
                dom.runnerPreviewPlaceholder.classList.add('hidden');
                dom.runnerScreenshotImg.src = `data:image/png;base64,${event.screenshot}`;
                dom.runnerScreenshotFrame.classList.remove('hidden');
              }
            }
          } else if (event.type === 'complete') {
            dom.runnerMockBrowser.classList.add('hidden');
            dom.runnerStatStatus.textContent = event.success ? 'Passed' : 'Failed';
            dom.runnerStatStatus.style.color = event.success ? 'var(--color-success)' : 'var(--color-danger)';
            if (event.success) {
              showToast('Test executed successfully!', 'success');
            } else {
              showToast('Test execution failed.', 'error');
            }
          }
        } catch (err) {
          // Ignore
        }
      }
    }

    // Mark any unexecuted steps as skipped
    state.steps.forEach((step) => {
      if (!executedStepIds.has(step.id)) {
        const row = document.getElementById(`runner-step-row-${step.id}`);
        if (row) {
          row.className = 'runner-step-row runner-step-row--pending';
          const statusIcon = row.querySelector('.runner-step-row__status');
          statusIcon.textContent = '—';
          const meta = row.querySelector('.runner-step-row__meta');
          meta.textContent = 'skipped';
        }
      }
    });

  } catch (err) {
    dom.runnerMockBrowser.classList.add('hidden');
    dom.runnerStatStatus.textContent = 'Error';
    dom.runnerStatStatus.style.color = 'var(--color-danger)';
    showToast(err.message || 'Run execution failed', 'error');
  } finally {
    // Hide mock browser just in case
    dom.runnerMockBrowser.classList.add('hidden');

    // Restore the main toolbar button
    dom.runBtn.disabled = false;
    dom.runBtn.innerHTML = originalRunBtnContent;

    // Restore the placeholder icons/text
    if (placeholderIcon) {
      placeholderIcon.textContent = '📸';
    }
    if (placeholderText) {
      placeholderText.textContent = 'Visual viewport screenshot will load when execution finishes';
    }
    if (!dom.runnerScreenshotImg.src.startsWith('data:')) {
      dom.runnerPreviewPlaceholder.classList.remove('hidden');
      dom.runnerScreenshotFrame.classList.add('hidden');
    }

    // Enable Re-run button
    dom.runnerStartBtn.disabled = false;
    dom.runnerStartBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Re-run
    `;
  }
}

// switchInspectorTab removed (visual click is now tab-less and opened externally)

function openModalWithSelectorAndValue(selector, tagName, value, selectors = null) {
  dom.modal.classList.remove('hidden');
  state.editingStepId = null;

  const typeMap = {
    button: 'click',
    input: 'fill',
    select: 'select',
    textarea: 'fill',
    a: 'click',
  };

  dom.stepType.value = typeMap[tagName] || 'fill';
  dom.stepSelector.value = selector;
  dom.stepValue.value = value;
  dom.stepDescription.value = `Fill "${value}" into ${tagName}`;
  dom.modalAdd.textContent = 'Add Step';

  updateStepTypeFields();
  renderSelectorChoices(selectors, selector);
}

function renderSelectorChoices(selectors, currentSelector = '') {
  dom.selectorChoicesDropdown.innerHTML = '';
  
  if (!selectors) {
    dom.selectorChoicesWrapper.classList.add('hidden');
    return;
  }

  const selectorEntries = [
    { label: 'testid', value: selectors.byTestId },
    { label: 'role', value: selectors.byRole },
    { label: 'label', value: selectors.byLabel },
    { label: 'placeholder', value: selectors.byPlaceholder },
    { label: 'text', value: selectors.byText },
    { label: 'id', value: selectors.byId },
    { label: 'css', value: selectors.css },
    { label: 'xpath', value: selectors.xpath },
  ];

  const validEntries = selectorEntries.filter(e => e.value);

  if (validEntries.length === 0) {
    dom.selectorChoicesWrapper.classList.add('hidden');
    return;
  }

  dom.selectorChoicesWrapper.classList.remove('hidden');

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Choose a captured selector style --';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dom.selectorChoicesDropdown.appendChild(defaultOption);

  validEntries.forEach(({ label, value }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${label.toUpperCase()}: ${value}`;
    if (value === currentSelector) {
      option.selected = true;
      defaultOption.selected = false;
    }
    dom.selectorChoicesDropdown.appendChild(option);
  });
}

// ---- Start ----
init();

// ============================================
// FRAMEWORK MANAGER
// ============================================

async function checkFrameworkConnection() {
  const path = state.settings.frameworkPath;
  if (!path) return;

  try {
    const status = await getFrameworkStatus(path);
    state.fw.connected = status.connected;

    if (status.connected) {
      dom.fwStatusDot.style.background = 'var(--color-success)';
      dom.fwStatusBadge.textContent = '✅ Connected';
      dom.fwStatusBadge.style.color = 'var(--color-success)';
      dom.fwStatusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
      dom.fwStatusBadge.style.background = 'rgba(16,185,129,0.1)';
      dom.fwPathDisplay.textContent = status.path;

      if (status.hasAuth) {
        dom.fwAuthBadge.classList.remove('hidden');
      } else {
        dom.fwAuthBadge.classList.add('hidden');
      }

      await loadFrameworkTree();
      await loadFrameworkTags();
    } else {
      dom.fwStatusDot.style.background = 'var(--color-danger)';
      dom.fwStatusBadge.textContent = '❌ Not Connected';
      dom.fwStatusBadge.style.color = 'var(--color-danger)';
      dom.fwPathDisplay.textContent = status.error || 'Path not found or not a Playwright project';
    }
  } catch (err) {
    dom.fwStatusBadge.textContent = '❌ Error';
    dom.fwPathDisplay.textContent = err.message;
  }
}

async function loadFrameworkTree() {
  const path = state.settings.frameworkPath;
  if (!path) return;

  try {
    const { getFrameworkTree } = await import('./utils/api.js');
    const tree = await getFrameworkTree(path);
    state.fw.tree = tree;

    dom.fwExplorerTree.innerHTML = renderTree(tree);
    bindTreeEvents();

    // Re-populate module select for runner
    updateModuleSelect(tree);

  } catch (err) {
    showToast('Failed to load framework tree: ' + err.message, 'error');
    dom.fwExplorerTree.innerHTML = `<div class="fw-empty">Failed to load tree</div>`;
  }
}

async function loadFrameworkTags() {
  const path = state.settings.frameworkPath;
  if (!path) return;

  try {
    const { getFrameworkTags } = await import('./utils/api.js');
    const backendTags = await getFrameworkTags(path);
    
    // Combine with currently active unsaved tags
    const allTags = new Set([...backendTags, ...state.activeTags]);
    const tags = Array.from(allTags).sort();
    
    state.fw.tags = tags;
    
    const tagSelect = document.getElementById('fw-run-tag-select');
    if (tagSelect) {
      if (tags.length === 0) {
        tagSelect.innerHTML = '<option value="">No tags found</option>';
      } else {
        tagSelect.innerHTML = tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load tags:', err);
  }
}

function renderTree(node) {
  if (!node) return '';

  if (node.type === 'folder') {
    const childrenHtml = node.children ? node.children.map(renderTree).join('') : '';
    // SVG chevron
    const chevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    
    return `
      <div class="vscode-tree-folder" data-path="${escapeHtml(node.path)}">
        <div class="vscode-tree-item" data-type="folder" data-path="${escapeHtml(node.path)}">
          <div class="vscode-tree-item-left">
            <span class="vscode-chevron">${chevronSvg}</span>
            <span>${escapeHtml(node.name)}</span>
          </div>
          <div class="vscode-tree-actions">
            <button class="vscode-tree-btn vscode-tree-run" title="Run Tests"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
            <button class="vscode-tree-btn vscode-tree-new-file" title="New File"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></button>
            <button class="vscode-tree-btn vscode-tree-new-folder" title="New Folder"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></button>
            ${node.path !== 'tests' && !node.path.replace(/\\/g, '/').includes('/setup') ? `
            <button class="vscode-tree-btn vscode-tree-rename" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="vscode-tree-btn vscode-tree-delete" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            ` : ''}
          </div>
        </div>
        <div class="vscode-tree-children">
          ${childrenHtml}
        </div>
      </div>
    `;
  } else {
    // File
    return `
      <div class="vscode-tree-item" data-type="file" data-path="${escapeHtml(node.path)}" style="cursor:pointer;">
        <div class="vscode-tree-item-left" style="padding-left:16px;">
          <span class="vscode-tree-icon" style="color:#d25c27;font-size:10px;font-weight:bold;">TS</span>
          <span style="color:#a8c7fa;">${escapeHtml(node.name)}</span>
        </div>
        <div class="vscode-tree-actions">
          <button class="vscode-tree-btn vscode-tree-run" title="Run Tests"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
          ${!node.path.replace(/\\/g, '/').includes('/setup') ? `
          <button class="vscode-tree-btn vscode-tree-rename" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="vscode-tree-btn vscode-tree-delete" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

function updateModuleSelect(node) {
  let folders = [];
  let files = [];
  
  function gatherItems(n) {
    if (n.type === 'folder') {
      if (n.path !== 'tests') folders.push(n.path);
    } else if (n.type === 'file' && (n.name.endsWith('.spec.ts') || n.name.endsWith('.setup.ts'))) {
      files.push(n.path);
    }
    if (n.children) {
      n.children.forEach(gatherItems);
    }
  }
  gatherItems(node);
  
  if (files.length > 0 || folders.length > 0) {
    let html = '';
    
    if (folders.length > 0) {
      html += '<optgroup label="Folders">';
      html += folders.map(f => `<option value="${escapeHtml(f)}" data-filepath="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
      html += '</optgroup>';
    }
    
    if (files.length > 0) {
      html += '<optgroup label="Files">';
      html += files.map(f => `<option value="${escapeHtml(f)}" data-filepath="${escapeHtml(f)}">📄 ${escapeHtml(f)}</option>`).join('');
      html += '</optgroup>';
    }
    
    dom.fwModuleSelect.innerHTML = html;
    
    dom.fwModuleSelect.onchange = () => {
      state.fw.selectedFile = dom.fwModuleSelect.value;
      const opt = dom.fwModuleSelect.options[dom.fwModuleSelect.selectedIndex];
      state.fw.selectedFilePath = opt ? opt.dataset.filepath : dom.fwModuleSelect.value;
    };
    
    // Trigger initial select state
    dom.fwModuleSelect.onchange();
  } else {
    dom.fwModuleSelect.innerHTML = '<option value="">No tests found</option>';
  }
}

function bindTreeEvents() {
  const treeContainer = dom.fwExplorerTree;

  // Global tree button listeners
  dom.fwRefreshTreeBtn.onclick = () => {
    loadFrameworkTree();
    loadFrameworkTags();
  };
  
  dom.fwNewFolderBtn.onclick = async () => {
    const name = await customPrompt('New Folder Name:', '', 'Create Folder');
    if (!name) return;
    try {
      const { createFrameworkFolder } = await import('./utils/api.js');
      await createFrameworkFolder(state.settings.frameworkPath, `tests/${name}`);
      loadFrameworkTree();
    } catch (e) { showToast(e.message, 'error'); }
  };

  dom.fwNewFileBtn.onclick = async () => {
    let name = await customPrompt('New File Name (without extension):', '', 'Create File');
    if (!name) return;
    if (!name.endsWith('.spec.ts')) name += '.spec.ts';
    try {
      const { createFrameworkFile } = await import('./utils/api.js');
      await createFrameworkFile(state.settings.frameworkPath, `tests/${name}`, '// New Playwright Test\n');
      loadFrameworkTree();
      loadFrameworkTags();
    } catch (e) { showToast(e.message, 'error'); }
  };

  // Node listeners
  treeContainer.querySelectorAll('.vscode-tree-item').forEach(el => {
    // Expand/Collapse folders
    if (el.dataset.type === 'folder') {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.vscode-tree-btn')) return; // Ignore if clicking action buttons
        const chevron = el.querySelector('.vscode-chevron');
        if (chevron) chevron.classList.toggle('collapsed');
        const children = el.nextElementSibling;
        if (children && children.classList.contains('vscode-tree-children')) {
          children.classList.toggle('collapsed');
        }
      });
    }

    // Edit file (by clicking the file row itself)
    if (el.dataset.type === 'file') {
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.vscode-tree-btn')) return; // Ignore if clicking action buttons
        
        const path = el.dataset.path; 
        if (path.replace(/\\/g, '/').includes('/setup')) {
          showToast('Editing setup files from the UI is disabled.', 'warning');
          return;
        }

        // Show confirmation if there is an existing test in the editor
        if (state.isDirty) {
          const confirmSwitch = await customConfirm('A test is currently open in the editor with unsaved changes. Any unsaved changes will be lost. Do you want to open this script anyway?', 'Discard Unsaved Changes?');
          if (!confirmSwitch) return;
        }

        const parts = path.split('/');
        const filename = parts.pop();
        const folder = parts.slice(1).join('/'); 
        loadScriptIntoBuilder(folder, filename);
      });
    }

    // New File inside folder
    const newFileBtn = el.querySelector('.vscode-tree-new-file');
    if (newFileBtn) {
      newFileBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = el.dataset.path;
        let name = await customPrompt(`New File Name in '${path}' (without extension):`, '', 'Create File');
        if (!name) return;
        if (!name.endsWith('.spec.ts')) name += '.spec.ts';
        try {
          const { createFrameworkFile } = await import('./utils/api.js');
          await createFrameworkFile(state.settings.frameworkPath, `${path}/${name}`, '// New Playwright Test\n');
          loadFrameworkTree();
        } catch (e) { showToast(e.message, 'error'); }
      });
    }

    // Run Folder listener removed from here
    
    // New Folder inside folder
    const newFolderBtn = el.querySelector('.vscode-tree-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = el.dataset.path;
        const name = await customPrompt(`New Folder Name in '${path}':`, '', 'Create Folder');
        if (!name) return;
        try {
          const { createFrameworkFolder } = await import('./utils/api.js');
          await createFrameworkFolder(state.settings.frameworkPath, `${path}/${name}`);
          loadFrameworkTree();
        } catch (e) { showToast(e.message, 'error'); }
      });
    }

    // Rename
    const renameBtn = el.querySelector('.vscode-tree-rename');
    if (renameBtn) {
      renameBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const oldPath = el.dataset.path;
        const oldName = oldPath.split('/').pop();
        const newName = await customPrompt(`Rename '${oldName}' to:`, oldName, 'Rename File/Folder');
        if (!newName || newName === oldName) return;
        
        const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newName;
        try {
          const { renameFrameworkItem } = await import('./utils/api.js');
          await renameFrameworkItem(state.settings.frameworkPath, oldPath, newPath);
          loadFrameworkTree();
        } catch (err) { showToast(err.message, 'error'); }
      });
    }

    // Delete
    const deleteBtn = el.querySelector('.vscode-tree-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = el.dataset.path;
        if (await customConfirm(`Are you sure you want to delete '${path}'? This cannot be undone.`, 'Delete Confirmation')) {
          try {
            const { deleteFrameworkItem } = await import('./utils/api.js');
            await deleteFrameworkItem(state.settings.frameworkPath, path);
            loadFrameworkTree();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    }

    // Run Tree Item
    const runTreeBtn = el.querySelector('.vscode-tree-run');
    if (runTreeBtn) {
      runTreeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const path = el.dataset.path;
        dom.fwRunModal.classList.remove('hidden');
        runFrameworkTest('module', '', path);
      });
    }
  });
}

async function loadScriptIntoBuilder(folder, filename) {
  const path = state.settings.frameworkPath;
  if (!path) return;

  try {
    const subDir = folder ? `${path}\\tests\\${folder}` : `${path}\\tests`;
    
    // Update save location to match the opened file's folder so it overwrites correctly
    state.settings.saveLocation = subDir;
    if (dom.reloadCodeBtn) dom.reloadCodeBtn.classList.remove('hidden');
    localStorage.setItem('pw_builder_settings', JSON.stringify(state.settings));

    const { loadSavedTest: load } = await import('./utils/api.js');
    const data = await load(filename, subDir);
    const parsed = parsePlaywrightScript(data.content);

    state.steps = parsed.steps;
    
    // Set the Test Name input to the filename instead of the parsed test name
    const baseName = filename.replace(/\.(spec|setup)\.ts$/, '');
    dom.testNameInput.value = baseName;

    const navStep = state.steps.find(s => s.type === 'navigate');
    if (navStep) dom.urlInput.value = navStep.value || navStep.selector;

    state.activeTags = parsed.tags ? parsed.tags.split(' ').filter(t => t) : [];
    renderTags();
    if (dom.testTagsInput) dom.testTagsInput.value = '';

    state.disableAuth = data.content.includes('storageState: { cookies: [], origins: [] }');
    if (dom.disableAuthCheckbox) dom.disableAuthCheckbox.checked = state.disableAuth;

    renderSteps();
    
    // Override isDirty since we just cleanly loaded the file
    state.isDirty = false;
    state.fw.activeFilename = filename;

    if (parsed.steps.length === 0 && data.content.trim().length > 0) {
      // It's a hand-written or legacy script that can't be parsed into steps
      state.isRawCode = true;
      dom.stepsContainer.style.display = 'none';
      if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'none';
      dom.stepCount.textContent = 'Raw';
    } else {
      state.isRawCode = false;
      dom.stepsContainer.style.display = 'block';
      if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'block';
    }
    
    // Always show exactly what's on disk, do NOT autoGenerate!
    state.generatedCode = data.content;
    if (dom.codeOutput) dom.codeOutput.innerHTML = highlightCode(data.content);
    if (dom.fullCodeOutput) dom.fullCodeOutput.innerHTML = highlightCode(data.content);
    dom.emptyCode.classList.add('hidden');
    dom.codeBlock.classList.remove('hidden');

    showToast(`✅ Loaded "${filename}" into builder`, 'success');
  } catch (err) {
    showToast('Failed to load script: ' + err.message, 'error');
  }
}

async function runFrameworkTest(scriptType, moduleName = '', modulePath = '') {
  if (!state.settings.frameworkPath) return showToast('Set framework path first', 'error');
  if (state.isDirty) {
    await handleSave();
  }
  if (state.fw.eventSource) {
    state.fw.eventSource.close();
  }

  dom.fwTerminal.innerHTML = '';
  dom.fwRunStatus.textContent = 'Running...';
  dom.fwRunStatus.style.color = 'var(--text-primary)';
  dom.fwOpenReportBtn.classList.add('hidden');
  if (dom.fwStopBtn) dom.fwStopBtn.classList.remove('hidden');

  const headedToggle = document.getElementById('fw-headed-toggle');
  const headed = headedToggle ? headedToggle.checked : true;
  
  const envUrl = dom.envSelect ? dom.envSelect.value : '';
  let envName = 'dev';
  if (envUrl.includes('staging')) envName = 'staging';
  if (envUrl === 'https://web.jugl.com') envName = 'prod';

  const workspaceSelect = document.getElementById('workspace-select');
  const workspaceVal = workspaceSelect ? workspaceSelect.value : 'all';

  const params = new URLSearchParams({ 
    path: state.settings.frameworkPath, 
    script: scriptType, 
    module: moduleName, 
    headed: headed.toString(), 
    env: envName,
    workspace: workspaceVal
  });
  if (modulePath) params.append('modulePath', modulePath);
  state.fw.eventSource = new EventSource(`/api/framework/run?${params.toString()}`);
  
  function appendTerminalLine(text, className) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    dom.fwTerminal.appendChild(el);
    dom.fwTerminal.scrollTop = dom.fwTerminal.scrollHeight;
  }

  // Disable buttons
  dom.fwRunAllBtn.disabled = true;
  dom.fwRunSetupBtn.disabled = true;
  dom.fwRunModuleBtn.disabled = true;

  function appendLine(text, cls = 'fw-line-stdout') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    dom.fwTerminal.appendChild(line);
    dom.fwTerminal.scrollTop = dom.fwTerminal.scrollHeight;
  }

  state.fw.eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (event.type === 'start') {
        appendLine(`$ ${event.command}`, 'fw-line-info');
      } else if (event.type === 'stdout') {
        const text = event.line;
        const cls = text.includes('passed') || text.includes('✓') ? 'fw-line-success'
                  : text.includes('failed') || text.includes('✗') ? 'fw-line-error'
                  : 'fw-line-stdout';
        appendLine(text, cls);
      } else if (event.type === 'stderr') {
        appendLine(event.line, 'fw-line-stderr');
      } else if (event.type === 'complete') {
        const success = event.success;
        appendLine(success ? '✅ Tests passed!' : `❌ Tests failed (exit ${event.exitCode})`,
          success ? 'fw-line-success' : 'fw-line-error');
        dom.fwRunStatus.textContent = success ? '✅ Passed' : '❌ Failed';
        dom.fwRunStatus.style.color = success ? 'var(--color-success)' : 'var(--color-danger)';
        dom.fwOpenReportBtn.classList.remove('hidden');
        if (dom.fwStopBtn) dom.fwStopBtn.classList.add('hidden');
        
        dom.fwRunAllBtn.disabled = false;
        dom.fwRunSetupBtn.disabled = false;
        dom.fwRunModuleBtn.disabled = false;
        if (scriptType === 'setup') checkFrameworkConnection();
        state.fw.eventSource.close();
      } else if (event.type === 'error') {
        appendLine('Error: ' + event.message, 'fw-line-error');
        dom.fwRunStatus.textContent = '❌ Error';
        dom.fwRunStatus.style.color = 'var(--color-danger)';
        if (dom.fwStopBtn) dom.fwStopBtn.classList.add('hidden');
      }
    } catch (err) {
      console.error('Failed to parse SSE', err);
    }
  };

  state.fw.eventSource.onerror = () => {
    appendLine('\n[Connection closed or errored]', 'fw-line-error');
    if (dom.fwRunStatus.textContent === 'Running...') {
      dom.fwRunStatus.textContent = 'Disconnected';
    }
    state.fw.eventSource.close();
    state.fw.eventSource = null;
    if (dom.fwStopBtn) dom.fwStopBtn.classList.add('hidden');
    
    dom.fwRunAllBtn.disabled = false;
    dom.fwRunSetupBtn.disabled = false;
    dom.fwRunModuleBtn.disabled = false;
  };
}

// ---- Auto Refresh ----
setInterval(async () => {
  if (!state.fw.activeFilename || !state.settings.saveLocation || state.isDirty) return;
  
  try {
    const { loadSavedTest } = await import('./utils/api.js');
    const data = await loadSavedTest(state.fw.activeFilename, state.settings.saveLocation);
    
    // If code on disk changed while we had no unsaved changes, auto-update
    if (data.content && data.content !== state.generatedCode) {
      console.log('Auto-refreshing file from disk:', state.fw.activeFilename);
      const parsed = parsePlaywrightScript(data.content);
      state.steps = parsed.steps;
      
      const baseName = state.fw.activeFilename.replace(/\.(spec|setup)\.ts$/, '');
      if (!state.isDirty) dom.testNameInput.value = parsed.testName || baseName;
      
      state.activeTags = parsed.tags ? parsed.tags.split(' ').filter(t => t) : [];
      renderTags();
      const navStep = state.steps.find(s => s.type === 'navigate');
      if (navStep) dom.urlInput.value = navStep.value || navStep.selector;
      state.disableAuth = data.content.includes('storageState: { cookies: [], origins: [] }');
      if (dom.disableAuthCheckbox) dom.disableAuthCheckbox.checked = state.disableAuth;
      
      if (parsed.steps.length === 0 && data.content.trim().length > 0) {
        state.isRawCode = true;
        dom.stepsContainer.style.display = 'none';
        if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'none';
        dom.stepCount.textContent = 'Raw';
      } else {
        state.isRawCode = false;
        dom.stepsContainer.style.display = 'block';
        if (dom.addStepBtn) dom.addStepBtn.closest('.panel__footer').style.display = 'block';
      }
      
      state.generatedCode = data.content;
      if (dom.codeOutput) dom.codeOutput.innerHTML = highlightCode(data.content);
      if (dom.fullCodeOutput) dom.fullCodeOutput.innerHTML = highlightCode(data.content);
      dom.emptyCode.classList.add('hidden');
      dom.codeBlock.classList.remove('hidden');
      renderSteps();
      
      showToast('Auto-refreshed from external changes', 'info');
    }
  } catch (err) {
    // Ignore errors for background polling
  }
}, 3000);

// Clear auth directory when environment changes
if (dom.envSelect) {
  dom.envSelect.addEventListener('change', async () => {
    if (!state.settings.frameworkPath) return;
    try {
      await fetch('/api/framework/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameworkPath: state.settings.frameworkPath })
      });
      showToast('Environment switched. Auth tokens cleared to trigger fresh login on next run.', 'info');
    } catch (e) {
      console.error('Failed to clear auth:', e);
    }
  });
}

