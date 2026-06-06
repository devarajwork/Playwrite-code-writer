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
} from './utils/helpers.js';

// ---- Application State ----
const state = {
  activeTags: [],
  steps: [],
  scannedElements: [],
  filteredElements: [],
  generatedCode: '',
  currentFilter: 'all',
  searchQuery: '',
  dragSourceIndex: null,
  editingStepId: null,
  settings: JSON.parse(localStorage.getItem('pw_builder_settings')) || {
    saveLocation: 'generated-tests',
    frameworkPath: '',
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
  downloadBtn: document.getElementById('download-btn'),
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
  // Interactive Inspector
  // Settings Modal
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsClose: document.getElementById('settings-close'),
  settingsCancel: document.getElementById('settings-cancel'),
  settingsSave: document.getElementById('settings-save'),
  saveLocationInput: document.getElementById('save-location-input'),
  saveLocationBrowseBtn: document.getElementById('save-location-browse-btn'),
  frameworkPathInput: document.getElementById('framework-path-input'),
  frameworkPathBrowseBtn: document.getElementById('framework-path-browse-btn'),
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
  dom.scanBtn.addEventListener('click', () => {
    const url = dom.urlInput.value.trim();
    if (url) {
      window.open(`/api/proxy?url=${encodeURIComponent(url)}`, '_blank');
    } else {
      showToast('Please enter and scan a URL first', 'error');
    }
  });
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
  dom.addStepBtn.addEventListener('click', () => openModal());



  // Code Panel
  dom.copyCodeBtn.addEventListener('click', handleCopyCode);
  dom.downloadBtn.addEventListener('click', handleDownload);

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
  dom.saveLocationBrowseBtn.addEventListener('click', handleBrowseSaveLocation);
  dom.frameworkPathBrowseBtn.addEventListener('click', handleBrowseFrameworkPath);
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) closeSettingsModal();
  });



  // Framework panel
  const fwRunTagSelect = document.getElementById('fw-run-tag-select');
  const fwRunTagBtn = document.getElementById('fw-run-tag-btn');
  
  dom.fwRunAllBtn.addEventListener('click', () => handleFrameworkRun('all'));
  dom.fwRunSetupBtn.addEventListener('click', () => handleFrameworkRun('setup'));
  
  if (fwRunTagBtn && fwRunTagSelect) {
    fwRunTagBtn.addEventListener('click', () => {
      const tag = fwRunTagSelect.value.trim();
      if (!tag) { showToast('Select a tag first', 'error'); return; }
      handleFrameworkRun('tag', tag);
    });
  }

  dom.fwRunModuleBtn.addEventListener('click', () => {
    const selectedOption = dom.fwModuleSelect.options[dom.fwModuleSelect.selectedIndex];
    const mod = dom.fwModuleSelect.value;
    const modPath = selectedOption ? selectedOption.dataset.filepath : '';
    if (!mod) { showToast('Select a module first', 'error'); return; }
    handleFrameworkRun('module', mod, modPath);
  });
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



  // Listen to message events from proxy inspector iframe
  window.addEventListener('message', (e) => {
    if (e.data) {
      if (e.data.type === 'ELEMENT_CLICKED') {
        const { bestSelector, tagName, selectors } = e.data.element;
        openModalWithSelector(bestSelector, tagName, selectors);
      } else if (e.data.type === 'INPUT_CHANGED') {
        const { bestSelector, tagName, value, selectors } = e.data.element;
        openModalWithSelectorAndValue(bestSelector, tagName, value, selectors);
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
  const url = dom.urlInput.value.trim();
  if (!url) {
    showToast('Please enter a URL to scan', 'error');
    return;
  }

  try {
    dom.scannerLoading.classList.remove('hidden');
    dom.scanBtn.disabled = true;
    dom.scanBtn.textContent = 'Scanning...';

    const result = await scanUrl(url);

    state.scannedElements = result.elements;
    state.filteredElements = result.elements;
    state.currentFilter = 'all';
    state.searchQuery = '';
    dom.elementSearch.value = '';

    // Reset active filter tag
    dom.filterTags.querySelectorAll('.tag').forEach((t) => t.classList.remove('tag--active'));
    dom.filterTags.querySelector('[data-filter="all"]').classList.add('tag--active');

    // No embedded iframe loading

    // Auto-add navigation step if there are no steps yet
    if (state.steps.length === 0) {
      state.steps.push({
        id: generateId(),
        type: 'navigate',
        selector: '',
        value: url,
        description: `Navigate to ${url}`,
        order: 0,
      });
      renderSteps();
      autoGenerate();
    }

    renderElements();
    showToast(`Found ${result.elementCount} elements! Click "Open Visual Inspector" to click-to-add steps.`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to scan URL', 'error');
  } finally {
    dom.scannerLoading.classList.add('hidden');
    dom.scanBtn.disabled = false;
    dom.scanBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      Scan Elements
    `;
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

// ============================================
// STEP BUILDER
// ============================================
function openModal(editStep = null) {
  state.editingStepId = editStep ? editStep.id : null;

  dom.modal.classList.remove('hidden');
  renderSelectorChoices(null);

  if (editStep) {
    dom.stepType.value = editStep.type;
    dom.stepSelector.value = editStep.selector;
    dom.stepValue.value = editStep.value;
    dom.stepDescription.value = editStep.description;
    dom.modalAdd.textContent = 'Update Step';
  } else {
    dom.stepType.value = 'click';
    dom.stepSelector.value = '';
    dom.stepValue.value = '';
    dom.stepDescription.value = '';
    dom.modalAdd.textContent = 'Add Step';
  }

  updateStepTypeFields();
  dom.stepSelector.focus();
}

function openModalWithSelector(selector, tagName, selectors = null) {
  dom.modal.classList.remove('hidden');
  state.editingStepId = null;

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

  // Update placeholder
  if (info.valuePlaceholder) {
    dom.stepValue.placeholder = info.valuePlaceholder;
  }
}

function handleAddStep() {
  const type = dom.stepType.value;
  const selector = dom.stepSelector.value.trim();
  const value = dom.stepValue.value.trim();
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
      description,
      order: state.steps.length,
    };
    state.steps.push(step);
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
        <span class="step-card__number">${index + 1}</span>
        <span class="step-card__type step-card__type--${step.type}">${info.emoji} ${info.label}</span>
        <div class="step-card__actions">
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
  renderCode(code);
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
      return `await page.goto(${val ? safeVal : safeSel});`;
    case 'click':
      return `await ${selectorExpr}.click();`;
    case 'dblclick':
      return `await ${selectorExpr}.dblclick();`;
    case 'fill':
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
  if (state.isRawCode) {
    codeToSave = dom.codeOutput.textContent;
  }

  const testName = dom.testNameInput.value.trim() || 'untitled-test';
  const filename = testName.replace(/\s+/g, '-').toLowerCase();

  try {
    const result = await saveTest(filename, codeToSave, state.settings.saveLocation);
    showToast(`Saved as ${result.filename}`, 'success');
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
    
    // Find if there's a navigate step to update URL input
    const navStep = state.steps.find(s => s.type === 'navigate');
    if (navStep) dom.urlInput.value = navStep.value || navStep.selector;
    
    renderSteps();
    autoGenerate();
    closeOpenModal();
    showToast(`Loaded ${file}`, 'success');
  } catch(err) {
    showToast(err.message, 'error');
  }
}

// ============================================
// SETTINGS HANDLERS
// ============================================
function openSettingsModal() {
  dom.saveLocationInput.value = state.settings.saveLocation || 'generated-tests';
  dom.frameworkPathInput.value = state.settings.frameworkPath || '';
  dom.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  dom.settingsModal.classList.add('hidden');
}

function handleSaveSettings() {
  const saveLocation = dom.saveLocationInput.value.trim();
  if (!saveLocation) {
    showToast('Save location is required', 'error');
    return;
  }
  state.settings.saveLocation = saveLocation;
  state.settings.frameworkPath = dom.frameworkPathInput.value.trim();
  localStorage.setItem('pw_builder_settings', JSON.stringify(state.settings));
  closeSettingsModal();
  showToast('Settings saved successfully', 'success');
  // Re-connect to framework if path changed
  if (state.settings.frameworkPath) {
    checkFrameworkConnection();
  }
}

async function handleBrowseSaveLocation() {
  dom.saveLocationBrowseBtn.disabled = true;
  dom.saveLocationBrowseBtn.textContent = 'Selecting...';

  try {
    const result = await browseSaveLocation();
    if (!result.cancelled && result.path) {
      dom.saveLocationInput.value = result.path;
      showToast('Directory selected successfully', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Failed to select directory', 'error');
  } finally {
    dom.saveLocationBrowseBtn.disabled = false;
    dom.saveLocationBrowseBtn.textContent = 'Browse...';
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
  state.generatedCode = '';
  renderSteps();
  dom.emptyCode.classList.remove('hidden');
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
    const response = await runTestSteps(state.steps);
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

function switchRightTab(tab) {
  const isCode = tab === 'code';
  dom.rightViewCode.style.display = isCode ? 'flex' : 'none';
  dom.rightViewFramework.style.display = isCode ? 'none' : 'flex';

  // Update tab styles
  dom.tabCode.style.borderBottom = isCode ? '2px solid var(--accent-primary)' : '2px solid transparent';
  dom.tabCode.style.color = isCode ? 'var(--text-primary)' : 'var(--text-muted)';
  dom.tabFramework.style.borderBottom = isCode ? '2px solid transparent' : '2px solid var(--accent-primary)';
  dom.tabFramework.style.color = isCode ? 'var(--text-muted)' : 'var(--text-primary)';

  // Load scripts when switching to framework tab
  if (!isCode && state.settings.frameworkPath) {
    loadFrameworkScripts();
  }
}

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

  const tagSelect = document.getElementById('fw-run-tag-select');
  if (!tagSelect) return;

  try {
    const { getFrameworkTags } = await import('./utils/api.js');
    const backendTags = await getFrameworkTags(path);
    
    // Combine with currently active unsaved tags
    const allTags = new Set([...backendTags, ...state.activeTags]);
    const tags = Array.from(allTags).sort();
    
    if (tags && tags.length > 0) {
      tagSelect.innerHTML = `<option value="">Select a tag (${tags.length} found)...</option>` + 
        tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    } else {
      tagSelect.innerHTML = '<option value="">No tags found</option>';
    }
  } catch (err) {
    console.error('Failed to load tags:', err);
    tagSelect.innerHTML = '<option value="">Error loading tags</option>';
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
            <button class="vscode-tree-btn vscode-tree-new-file" title="New File"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></button>
            <button class="vscode-tree-btn vscode-tree-new-folder" title="New Folder"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></button>
            ${node.path !== 'tests' ? `
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
      <div class="vscode-tree-item" data-type="file" data-path="${escapeHtml(node.path)}">
        <div class="vscode-tree-item-left" style="padding-left:16px;">
          <span class="vscode-tree-icon" style="color:#d25c27;font-size:10px;font-weight:bold;">TS</span>
          <span style="color:#a8c7fa;">${escapeHtml(node.name)}</span>
        </div>
        <div class="vscode-tree-actions">
          <button class="vscode-tree-btn vscode-tree-edit" title="Edit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="vscode-tree-btn vscode-tree-rename" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="vscode-tree-btn vscode-tree-delete" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </div>
    `;
  }
}

function updateModuleSelect(node) {
  let files = [];
  function gatherFiles(n) {
    if (n.type === 'file' && (n.name.endsWith('.spec.ts') || n.name.endsWith('.setup.ts'))) {
      files.push(n.path);
    }
    if (n.children) {
      n.children.forEach(gatherFiles);
    }
  }
  gatherFiles(node);
  
  if (files.length > 0) {
    dom.fwModuleSelect.innerHTML = files.map(f => `<option value="${escapeHtml(f)}" data-filepath="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
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
    const name = prompt('New Folder Name:');
    if (!name) return;
    try {
      const { createFrameworkFolder } = await import('./utils/api.js');
      await createFrameworkFolder(state.settings.frameworkPath, `tests/${name}`);
      loadFrameworkTree();
    } catch (e) { showToast(e.message, 'error'); }
  };

  dom.fwNewFileBtn.onclick = async () => {
    const name = prompt('New File Name (e.g. my-test.spec.ts):');
    if (!name) return;
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

    // Edit file
    const editBtn = el.querySelector('.vscode-tree-edit');
    if (editBtn) {
      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = el.dataset.path; 
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
        const name = prompt(`New File Name in '${path}' (e.g. my-test.spec.ts):`);
        if (!name) return;
        try {
          const { createFrameworkFile } = await import('./utils/api.js');
          await createFrameworkFile(state.settings.frameworkPath, `${path}/${name}`, '// New Playwright Test\n');
          loadFrameworkTree();
        } catch (e) { showToast(e.message, 'error'); }
      });
    }
    
    // New Folder inside folder
    const newFolderBtn = el.querySelector('.vscode-tree-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = el.dataset.path;
        const name = prompt(`New Folder Name in '${path}':`);
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
        const newName = prompt(`Rename '${oldName}' to:`, oldName);
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
        if (confirm(`Are you sure you want to delete '${path}'? This cannot be undone.`)) {
          try {
            const { deleteFrameworkItem } = await import('./utils/api.js');
            await deleteFrameworkItem(state.settings.frameworkPath, path);
            loadFrameworkTree();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    }
  });
}

async function loadScriptIntoBuilder(folder, filename) {
  const path = state.settings.frameworkPath;
  if (!path) return;

  try {
    const subDir = folder ? `${path}\\tests\\${folder}` : `${path}\\tests`;
    const { loadSavedTest: load } = await import('./utils/api.js');
    const data = await load(filename, subDir);
    const parsed = parsePlaywrightScript(data.content);

    state.steps = parsed.steps;
    dom.testNameInput.value = parsed.testName;

    const navStep = state.steps.find(s => s.type === 'navigate');
    if (navStep) dom.urlInput.value = navStep.value || navStep.selector;

    if (parsed.steps.length === 0 && data.content.trim().length > 0) {
      // It's a hand-written or legacy script that can't be parsed into steps
      state.isRawCode = true;
      state.generatedCode = data.content;
      dom.codeOutput.innerHTML = highlightCode(data.content);
      dom.emptyCode.classList.add('hidden');
      dom.codeBlock.classList.remove('hidden');
      
      // Update steps panel to show a message
      dom.stepsContainer.innerHTML = '<div class="fw-empty" style="text-align:center;padding:20px;color:var(--text-muted);">This is a hand-written script.<br><br>It contains custom logic (loops, try/catch, etc.) and cannot be edited using the visual step builder.<br><br>You can view the code in the Code Preview tab.</div>';
      dom.emptySteps.classList.add('hidden');
      dom.stepCount.textContent = 'Raw';
    } else {
      state.isRawCode = false;
      renderSteps();
      autoGenerate();
    }

    // Switch to right panel to see code if it's raw, otherwise left panel
    switchRightTab('code');
    showToast(`✅ Loaded "${filename}" into builder`, 'success');
  } catch (err) {
    showToast('Failed to load script: ' + err.message, 'error');
  }
}

function handleNewModuleTest() {
  // Clear builder and configure save location to modules folder
  state.steps = [];
  state.generatedCode = '';
  dom.testNameInput.value = 'New Module Test';
  renderSteps();
  dom.emptyCode.classList.remove('hidden');
  dom.codeBlock.classList.add('hidden');

  // Point save location to modules folder
  if (state.settings.frameworkPath) {
    state.settings.saveLocation = `${state.settings.frameworkPath}\\tests\\modules`;
    localStorage.setItem('pw_builder_settings', JSON.stringify(state.settings));
  }

  // Switch to code tab so they can build
  switchRightTab('code');
  showToast('New module test ready — add steps and click Save', 'info');
}

async function handleFrameworkRun(script, moduleName = '', modulePath = '') {
  const path = state.settings.frameworkPath;
  if (!path) {
    showToast('Framework path not configured. Go to ⚙️ Settings.', 'error');
    return;
  }
  if (!state.fw.connected) {
    showToast('Framework not connected. Check Settings → Framework Path.', 'error');
    return;
  }

  const headedToggle = document.getElementById('fw-headed-toggle');
  const headed = headedToggle ? headedToggle.checked : true;

  // Reset terminal
  dom.fwTerminal.innerHTML = '';
  dom.fwRunStatus.textContent = 'Running...';
  dom.fwRunStatus.style.color = 'var(--accent-primary)';
  dom.fwOpenReportBtn.classList.add('hidden');

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

  try {
    console.log('Running framework with headed:', headed);
    const response = await runFramework(path, script, moduleName, modulePath, headed);
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.substring(6));
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
          } else if (event.type === 'error') {
            appendLine('Error: ' + event.message, 'fw-line-error');
          }
        } catch {}
      }
    }
  } catch (err) {
    appendLine('Error: ' + err.message, 'fw-line-error');
    dom.fwRunStatus.textContent = '❌ Error';
    dom.fwRunStatus.style.color = 'var(--color-danger)';
  } finally {
    dom.fwRunAllBtn.disabled = false;
    dom.fwRunSetupBtn.disabled = false;
    dom.fwRunModuleBtn.disabled = false;
    // Refresh auth status after setup run
    if (script === 'setup') checkFrameworkConnection();
  }
}
