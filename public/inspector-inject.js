(function() {
  function notifyParent(data) {
    if (typeof window.notifyBuilder === 'function') {
      window.notifyBuilder(data);
    } else {
      console.log("INSPECTOR_EVENT:" + JSON.stringify(data));
    }
  }

  function injectStyles() {
    if (document.getElementById('pw-visual-inspector-styles')) return;
    const style = document.createElement('style');
    style.id = 'pw-visual-inspector-styles';
    style.textContent = `
      .pw-visual-highlight {
        outline: 2px solid #8b5cf6 !important;
        outline-offset: -2px !important;
        background: rgba(139, 92, 246, 0.1) !important;
        transition: all 0.1s ease !important;
        cursor: crosshair !important;
      }
      .pw-visual-tooltip {
        position: fixed !important;
        background: rgba(30, 30, 46, 0.95) !important;
        backdrop-filter: blur(4px) !important;
        color: #f8fafc !important;
        padding: 6px 10px !important;
        border-radius: 8px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        border: 1px solid rgba(99, 115, 164, 0.3) !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
    `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
  }

  let tooltip = null;
  let activeElement = null;

  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.className = 'pw-visual-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }

  // Infer the Playwright action type for an element
  function inferActionType(el) {
    if (!el) return 'click';
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();

    // Real input types
    if (tag === 'input') {
      if (type === 'checkbox' || type === 'radio') return 'check';
      if (type === 'file') return 'upload';
      if (type === 'submit' || type === 'button' || type === 'reset') return 'click';
      return 'fill'; // text, email, password, etc.
    }
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'fill';

    // Rich text / content editable
    if (el.isContentEditable || el.hasAttribute('contenteditable') ||
        el.getAttribute('role') === 'textbox' || el.hasAttribute('data-lexical-editor')) {
      return 'fill';
    }

    return 'click';
  }

  // Action emoji for tooltip
  function actionEmoji(action) {
    return { fill: '✏️', check: '☑️', select: '🔽', upload: '📎', click: '🖱️' }[action] || '🖱️';
  }

  function findInteractiveParent(el) {
    if (!el) return el;

    // 1. Rich text editors — always fill targets
    let check = el;
    while (check && check !== document.body && check !== document.documentElement) {
      if (check.isContentEditable || check.hasAttribute('contenteditable') ||
          check.getAttribute('role') === 'textbox' || check.hasAttribute('data-lexical-editor')) {
        return check;
      }
      check = check.parentElement;
    }

    // 2. Real form inputs — return immediately
    const interactiveTags = ['input', 'select', 'textarea'];
    if (el.tagName && interactiveTags.includes(el.tagName.toLowerCase())) {
      return el;
    }

    // 3. Checkbox/radio hidden inside styled wrappers: <label> or <div> containing a real input
    let current = el;
    for (let i = 0; i < 4; i++) {
      if (!current || current === document.body) break;
      const realInput = current.querySelector('input[type="checkbox"], input[type="radio"]');
      if (realInput) return realInput; // Capture the actual input, not the wrapper
      current = current.parentElement;
    }

    // 4. List item context: if clicking text inside a list item / option, capture the list item
    current = el;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body || current === document.documentElement) break;
      const tag = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      if (tag === 'li' || role === 'listitem' || role === 'option' || role === 'menuitem' ||
          role === 'row' || role === 'treeitem') {
        return current;
      }
      current = current.parentElement;
    }

    // 5. Standard clickable elements
    current = el;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body || current === document.documentElement) break;
      const tag = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      if (tag === 'button' || tag === 'a' ||
          role === 'button' || role === 'link' || role === 'tab' || role === 'switch' ||
          current.classList.contains('btn') || current.classList.contains('button')) {
        return current;
      }
      const style = window.getComputedStyle(current);
      if (style.cursor === 'pointer' && (tag === 'div' || tag === 'span')) {
        return current;
      }
      current = current.parentElement;
    }

    return el;
  }

  // Parses a simple Playwright locator chain into an array of DOM elements
  function findPlaywrightMatches(cleanStr) {
      let parts = cleanStr.split(/\)\.(?=(?:locator|getBy|first|last|nth|filter))/);
      
      let currentSet = [document];

      for (let part of parts) {
         let cmd = part;
         if (!cmd.endsWith(')') && cmd.includes('(')) cmd += ')';
         if (cmd.startsWith('page.')) cmd = cmd.replace('page.', '');

         let nextSet = [];
         
         if (cmd.startsWith("locator(")) {
             let inner = cmd.match(/locator\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     if (inner[2].startsWith('//')) {
                         let root = parent === document ? document : parent;
                         let query = document.evaluate(inner[2], root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                         for (let i = 0; i < query.snapshotLength; i++) {
                             let n = query.snapshotItem(i);
                             if (parent === document || parent.contains(n)) nextSet.push(n);
                         }
                     } else {
                         try { nextSet.push(...Array.from(parent.querySelectorAll(inner[2]))); } catch(e){}
                     }
                 }
             }
         } else if (cmd.startsWith("getByTestId(")) {
             let inner = cmd.match(/getByTestId\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     nextSet.push(...Array.from(parent.querySelectorAll(`[data-testid="${inner[2]}"], [data-test-id="${inner[2]}"]`)));
                 }
             }
         } else if (cmd.startsWith("getByRole(")) {
             let roleMatch = cmd.match(/getByRole\((['"])(.*?)\1/);
             let nameMatch = cmd.match(/name:\s*(['"])(.*?)\1/);
             let role = roleMatch ? roleMatch[2] : '';
             let name = nameMatch ? nameMatch[2].toLowerCase() : '';
             let tagMap = { 'button': 'button, input[type="button"], input[type="submit"], [role="button"]', 'link': 'a, [role="link"]', 'textbox': 'input[type="text"], textarea, [role="textbox"]', 'checkbox': 'input[type="checkbox"], [role="checkbox"]', 'combobox': 'select, [role="combobox"]' };
             let tags = tagMap[role] || `[role="${role}"]`;
             for (let parent of currentSet) {
                 let candidates = [];
                 try { candidates = Array.from(parent.querySelectorAll(tags)); } catch(e) { candidates = Array.from(parent.querySelectorAll('*')); }
                 if (name) {
                     nextSet.push(...candidates.filter(el => {
                         let elName = (el.getAttribute('aria-label') || el.textContent || el.value || el.name || el.id || '').toLowerCase();
                         return elName.includes(name);
                     }));
                 } else {
                     nextSet.push(...candidates);
                 }
             }
         } else if (cmd.startsWith("getByText(")) {
             let textMatch = cmd.match(/getByText\((['"])(.*?)\1/);
             let exactMatch = cmd.includes("exact: true");
             if (textMatch && textMatch[2]) {
                 let text = textMatch[2];
                 for (let parent of currentSet) {
                     let all = Array.from(parent.querySelectorAll('*'));
                     let matching = all.filter(el => {
                         let elText = (el.textContent || '').replace(/\s+/g, ' ').trim();
                         if (exactMatch) return elText === text;
                         return elText.toLowerCase().includes(text.toLowerCase());
                     });
                     // Keep only deepest matching elements
                     let deepest = matching.filter(el => {
                         for (let child of el.children) {
                             if (matching.includes(child)) return false;
                         }
                         return true;
                     });
                     nextSet.push(...deepest);
                 }
             }
         } else if (cmd.startsWith("getByPlaceholder(")) {
             let inner = cmd.match(/getByPlaceholder\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     nextSet.push(...Array.from(parent.querySelectorAll(`[placeholder*="${inner[2].replace(/"/g, '\\"')}"]`)));
                 }
             }
         } else if (cmd.startsWith("getByLabel(")) {
             let inner = cmd.match(/getByLabel\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     nextSet.push(...Array.from(parent.querySelectorAll(`[aria-label*="${inner[2].replace(/"/g, '\\"')}"]`)));
                 }
             }
         } else if (cmd.startsWith("getByAltText(")) {
             let inner = cmd.match(/getByAltText\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     nextSet.push(...Array.from(parent.querySelectorAll(`[alt*="${inner[2].replace(/"/g, '\\"')}"]`)));
                 }
             }
         } else if (cmd.startsWith("getByTitle(")) {
             let inner = cmd.match(/getByTitle\((['"])(.*?)\1\)/);
             if (inner && inner[2]) {
                 for (let parent of currentSet) {
                     nextSet.push(...Array.from(parent.querySelectorAll(`[title*="${inner[2].replace(/"/g, '\\"')}"]`)));
                 }
             }
         } else if (cmd.startsWith("nth(")) {
             let inner = cmd.match(/nth\((\d+)\)/);
             if (inner && inner[1]) {
                 let idx = parseInt(inner[1]);
                 if (currentSet[idx]) nextSet.push(currentSet[idx]);
             }
         } else if (cmd.startsWith("first(")) {
             if (currentSet.length > 0) nextSet.push(currentSet[0]);
         } else if (cmd.startsWith("last(")) {
             if (currentSet.length > 0) nextSet.push(currentSet[currentSet.length - 1]);
         }
         
         currentSet = nextSet;
         if (currentSet.length === 0) break;
      }
      
      // Remove duplicates
      return Array.from(new Set(currentSet));
  }

  function getCandidateBases(el) {
      let bases = [];
      const text = (el.textContent || '').trim();
      const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
      const placeholder = el.getAttribute('placeholder');
      const role = el.getAttribute('role') || (el.tagName.toLowerCase() === 'button' ? 'button' : el.tagName.toLowerCase() === 'a' ? 'link' : '');
      const ariaLabel = el.getAttribute('aria-label');
      const altText = el.getAttribute('alt');
      const title = el.getAttribute('title');
      
      // 1. getByTestId
      if (dataTestId) bases.push(`getByTestId('${dataTestId.replace(/'/g, "\\'")}')`);
      
      // 2. getByLabel
      let labelText = ariaLabel;
      if (!labelText && el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) labelText = (labelEl.textContent || '').trim();
      }
      if (labelText) bases.push(`getByLabel('${labelText.replace(/'/g, "\\'")}')`);
      
      // 3. getByPlaceholder
      if (placeholder) bases.push(`getByPlaceholder('${placeholder.replace(/'/g, "\\'")}')`);
      
      // 4. getByAltText
      if (altText) bases.push(`getByAltText('${altText.replace(/'/g, "\\'")}')`);
      
      // 5. getByTitle
      if (title) bases.push(`getByTitle('${title.replace(/'/g, "\\'")}')`);
      
      // 6. getByRole
      if (role) {
          let nameAttr = labelText;
          if (!nameAttr && text.length > 0 && text.length < 50) {
              // Do NOT use text content as a name for input-like elements, 
              // because their text content is dynamic user state (what they typed), not a static label.
              if (role !== 'textbox' && role !== 'searchbox' && role !== 'combobox' && role !== 'spinbutton') {
                  nameAttr = text;
              }
          }
          
          // Avoid using highly dynamic text for roles
          const hasTimeOrDate = /\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/i.test(nameAttr) || /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(nameAttr);
          
          if (nameAttr && !hasTimeOrDate) {
              bases.push(`getByRole('${role}', { name: '${nameAttr.replace(/'/g, "\\'")}' })`);
          }
          // Always push the generic role as a fallback
          bases.push(`getByRole('${role}')`);
      }

      // 7. getByText
      if (text && text.length > 0 && text.length < 50) {
          const hasTimeOrDate = /\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/i.test(text) || /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text);
          if (!hasTimeOrDate) {
              bases.push(`getByText('${text.replace(/'/g, "\\'")}', { exact: true })`);
              bases.push(`getByText('${text.replace(/'/g, "\\'")}')`);
          }
      }
      
      // 8. locator(#id)
      const isDynamicId = (id) => {
          if (!id) return false;
          if (id.includes(':r')) return true;
          if (/^(headlessui|radix|mui|downshift|chakra)-/.test(id)) return true;
          // Random hash suffix containing numbers and letters/underscores (e.g. _r_2n_)
          if (/[_-][a-zA-Z0-9_]*\d[a-zA-Z0-9_]*$/.test(id) && /[_-][a-zA-Z0-9_]{3,}$/.test(id)) return true; 
          return false;
      };

      if (el.id && el.id !== 'root' && el.id !== 'app' && el.id !== '__next' && !isDynamicId(el.id)) {
          bases.push(`locator('#${CSS.escape(el.id)}')`);
      }

      // Always add a generic CSS class/tag base as the absolute last resort base
      let genericCss = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
          let firstClass = el.className.split(' ').find(c => c && !c.includes(':') && !c.includes('[') && c !== 'pw-visual-highlight');
          if (firstClass) {
              try {
                  // Make sure the class is valid CSS before appending
                  document.querySelector(`${genericCss}.${CSS.escape(firstClass)}`);
                  genericCss += '.' + CSS.escape(firstClass);
              } catch(e) {}
          }
      }
      bases.push(`locator('${genericCss}')`);
      
      return bases;
  }

  function generateVerifiedLocator(targetEl) {
      let fallbacks = new Set();
      let primary = null;
      
      const addFallback = (sel) => {
          if (!primary) primary = sel;
          else if (sel !== primary) fallbacks.add(sel);
      };

      let bases = getCandidateBases(targetEl);
      
      // 1. Check if direct base is unique globally
      for (let base of bases) {
          let full = `page.${base}`;
          let matches = findPlaywrightMatches(full);
          if (matches.length === 1 && (matches[0] === targetEl || targetEl.contains(matches[0]))) addFallback(full);
      }

      // 2. Semantic Anchoring! Traverse up looking for a stable parent context
      let parent = targetEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
          let anchorBases = getCandidateBases(parent);
          
          for (let aBase of anchorBases) {
              // only use stable anchors like TestId, ID, or very specific Roles
              if (!aBase.includes('getByTestId') && !aBase.includes("locator('#") && !(aBase.includes('getByRole') && aBase.includes('name:'))) {
                  continue;
              }
              
              for (let base of bases) {
                  let full = `page.${aBase}.${base}`;
                  let matches = findPlaywrightMatches(full);
                  if (matches.length === 1 && (matches[0] === targetEl || targetEl.contains(matches[0]))) addFallback(full);
              }
          }
          parent = parent.parentElement;
      }

      // 3. Fallback: Robust XPath
      let tagName = targetEl.tagName.toLowerCase();
      let text = (targetEl.textContent || '').trim();
      if (text && text.length < 40) {
          let xpath = `//${tagName}[normalize-space(text())='${text.replace(/'/g, "\\'")}']`;
          let matches = findPlaywrightMatches(`page.locator("${xpath}")`);
          if (matches.length === 1 && (matches[0] === targetEl || targetEl.contains(matches[0]))) addFallback(`page.locator("${xpath}")`);
      }
      
      // 4. Fallback: Semantic Anchoring + .nth()
      parent = targetEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
          let anchorBases = getCandidateBases(parent);
          for (let aBase of anchorBases) {
              if (!aBase.includes('getByTestId') && !aBase.includes("locator('#") && !(aBase.includes('getByRole') && aBase.includes('name:'))) {
                  continue;
              }
              for (let base of bases) {
                  let fullBase = `page.${aBase}.${base}`;
                  let baseMatches = findPlaywrightMatches(fullBase);
                  let idx = baseMatches.findIndex(m => m === targetEl || targetEl.contains(m));
                  if (idx !== -1) {
                      addFallback(`${fullBase}.nth(${idx})`);
                  }
              }
          }
          parent = parent.parentElement;
      }

      for (let base of bases) {
          let baseMatches = findPlaywrightMatches(`page.${base}`);
          let idx = baseMatches.findIndex(m => m === targetEl || targetEl.contains(m));
          if (idx !== -1) {
              addFallback(`page.${base}.nth(${idx})`);
          }
      }

      // 6. Last resort: Short CSS Path (only if anchored by ID/TestID within 2 levels)
      const isDynamicIdFallback = (id) => {
          if (!id) return false;
          if (id.includes(':r')) return true;
          if (/^(headlessui|radix|mui|downshift|chakra)-/.test(id)) return true;
          if (/[_-][a-zA-Z0-9_]*\d[a-zA-Z0-9_]*$/.test(id) && /[_-][a-zA-Z0-9_]{3,}$/.test(id)) return true; 
          return false;
      };

      let pathSegments = [];
      let current = targetEl;
      let depth = 0;
      let foundAnchor = false;
      
      while (current && current !== document.documentElement && current !== document.body && depth < 2) {
        let tag = current.tagName.toLowerCase();
        let p = current.parentElement;
        if (!p) break;
        
        let siblings = Array.from(p.children).filter(c => c.tagName === current.tagName);
        let segment = tag;
        if (siblings.length > 1) {
            segment += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
        
        pathSegments.unshift(segment);
        current = p;
        depth++;
        
        if (current.id && current.id !== 'root' && current.id !== 'app' && current.id !== '__next' && !isDynamicIdFallback(current.id)) {
          pathSegments.unshift('#' + CSS.escape(current.id));
          foundAnchor = true;
          break;
        } else if (current.getAttribute('data-testid')) {
          pathSegments.unshift('[data-testid="' + CSS.escape(current.getAttribute('data-testid')) + '"]');
          foundAnchor = true;
          break;
        }
      }
      
      if (foundAnchor) {
        addFallback(`page.locator('${pathSegments.join(' > ')}')`);
      }

      return {
          primary: primary,
          fallbacks: Array.from(fallbacks).slice(0, 5)
      };
  }

  function extractElementData(el, event) {
      const { primary: bestSelector, fallbacks } = generateVerifiedLocator(el);
      
      return { 
          tagName: el.tagName.toLowerCase(), 
          id: el.id || '', 
          bestSelector: bestSelector, 
          fallbacks: fallbacks,
          text: (el.textContent || '').trim(), 
          placeholder: el.getAttribute('placeholder') || '', 
          altText: el.getAttribute('alt') || '', 
          title: el.getAttribute('title') || '', 
          selectors: { best: bestSelector }, 
          type: el.type || '',
          value: el.value || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          labelText: (() => {
            if (el.id) {
              const lbl = document.querySelector(`label[for="${el.id}"]`);
              if (lbl) return (lbl.textContent || '').trim();
            }
            return '';
          })(),
          isContentEditable: el.isContentEditable || el.hasAttribute('contenteditable') || el.getAttribute('role') === 'textbox' || el.hasAttribute('data-lexical-editor') || false
      };
  }

  let isCapturingPaused = false;

  function init() {
    injectStyles();

    // Inject recording toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'pw-inspector-toolbar';
    toolbar.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:9999999; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:8px 16px; display:flex; align-items:center; gap:16px; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";';
    toolbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <div id="pw-recording-dot" style="width:10px; height:10px; border-radius:50%; background:#ef4444; box-shadow:0 0 0 2px rgba(239, 68, 68, 0.2);"></div>
        <span id="pw-recording-text" style="font-size:14px; font-weight:600; color:#111827;">Recording</span>
      </div>
      <button id="pw-pause-btn" style="background:#f3f4f6; border:1px solid #d1d5db; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:13px; font-weight:500; color:#374151; transition:all 0.1s;">Pause (Esc)</button>
    `;
    document.body.appendChild(toolbar);

    const pauseBtn = document.getElementById('pw-pause-btn');
    const recDot = document.getElementById('pw-recording-dot');
    const recText = document.getElementById('pw-recording-text');

    function toggleRecording() {
      isCapturingPaused = !isCapturingPaused;
      if (isCapturingPaused) {
        recDot.style.background = '#9ca3af';
        recDot.style.boxShadow = 'none';
        recText.innerText = 'Paused';
        recText.style.color = '#6b7280';
        pauseBtn.innerText = 'Resume (Esc)';
        pauseBtn.style.background = '#10b981';
        pauseBtn.style.color = '#fff';
        pauseBtn.style.borderColor = '#059669';
        if (tooltip) tooltip.style.display = 'none';
        if (activeElement) activeElement.classList.remove('pw-visual-highlight');
      } else {
        recDot.style.background = '#ef4444';
        recDot.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        recText.innerText = 'Recording';
        recText.style.color = '#111827';
        pauseBtn.innerText = 'Pause (Esc)';
        pauseBtn.style.background = '#f3f4f6';
        pauseBtn.style.color = '#374151';
        pauseBtn.style.borderColor = '#d1d5db';
      }
    }

    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleRecording();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        toggleRecording();
      }
    }, true);

    // Inspect mouse movements
    document.addEventListener('mouseover', function(e) {
      if (isCapturingPaused) return;
      let el = e.target;
      if (!el || el === document.body || el === document.documentElement || el.closest('.pw-visual-tooltip') || el.closest('#pw-inspector-toolbar')) return;

      el = findInteractiveParent(el);

      if (activeElement) activeElement.classList.remove('pw-visual-highlight');
      activeElement = el;
      el.classList.add('pw-visual-highlight');

      createTooltip();
      const tagName = el.tagName.toLowerCase();
      const idText = el.id ? '#' + el.id : '';
      const textSnippet = (el.textContent || '').trim().substring(0, 20);
      const action = inferActionType(el);
      const emoji = actionEmoji(action);
      tooltip.innerHTML = 
        '<span style="color:#a78bfa">&lt;' + tagName + idText + '&gt;</span>' +
        ' <span style="background:rgba(139,92,246,0.2);padding:1px 6px;border-radius:4px;color:#c4b5fd;font-size:10px;">' + emoji + ' ' + action + '</span>' +
        (textSnippet ? ' • "' + textSnippet + '"' : '');
      tooltip.style.display = 'flex';

      const rect = el.getBoundingClientRect();
      let left = rect.left;
      if (left + 200 > window.innerWidth) left = window.innerWidth - 220;
      let top = rect.bottom + 8;
      if (rect.bottom + 50 > window.innerHeight) top = rect.top - 32;

      tooltip.style.left = Math.max(8, left) + 'px';
      tooltip.style.top = Math.max(8, top) + 'px';
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (isCapturingPaused) return;
      if (activeElement === e.target) {
        e.target.classList.remove('pw-visual-highlight');
        activeElement = null;
      }
      if (tooltip) tooltip.style.display = 'none';
    }, true);

    // Catch clicks
    document.addEventListener('click', function(e) {
      if (isCapturingPaused) return;
      let el = e.target;
      if (!el || el === document.body || el === document.documentElement || el.closest('#pw-inspector-toolbar')) return;

      el = findInteractiveParent(el);

      // Filter out unwanted background clicks
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const style = window.getComputedStyle(el);
      const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'label', 'summary'].includes(tag) ||
                            ['button', 'link', 'checkbox', 'menuitem', 'option', 'radio', 'switch', 'tab', 'treeitem', 'textbox'].includes(role) ||
                            el.isContentEditable || el.hasAttribute('contenteditable') ||
                            style.cursor === 'pointer' ||
                            el.onclick != null || el.hasAttribute('ng-click') || el.hasAttribute('@click');
      
      if (!isInteractive && tag !== 'svg' && tag !== 'path' && tag !== 'img') {
        // Ignore generic clicks on divs/spans that aren't styled as buttons
        return;
      }

      // Verify before sending
      const elementData = extractElementData(el, e);

      notifyParent({
        type: 'ELEMENT_CLICKED',
        element: elementData
      });
    }, true);

    // Catch input
    ['blur', 'change'].forEach(function(eventType) {
      document.addEventListener(eventType, function(e) {
        if (isCapturingPaused) return;
        let el = e.target;
        if (!el || el.closest('#pw-inspector-toolbar')) return;

        el = findInteractiveParent(el);

        const isContentEditable = el.isContentEditable || el.hasAttribute('contenteditable') || el.getAttribute('role') === 'textbox' || el.hasAttribute('data-lexical-editor');
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT' && !isContentEditable) return;

        let value = el.value;
        if (value === undefined && isContentEditable) value = el.innerText || el.textContent || '';
        if (!value && el.type !== 'file') return;
        if (el._lastValue === value) return;
        el._lastValue = value;

        const elementData = extractElementData(el, e);
        notifyParent({
          type: 'INPUT_CHANGED',
          element: {
            ...elementData,
            value: value
          }
        });
      }, true);
    });

    let lastUrl = window.location.href;
    setInterval(function() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        notifyParent({
          type: 'URL_CHANGED',
          url: lastUrl
        });
      }
    }, 500);

    window.highlightPlaywrightSelector = function(selectorStr) {
      let elements = [];
      try {
        let cleanStr = selectorStr.replace(/^await\s+/, '').trim();
        cleanStr = cleanStr.replace(/\.[a-zA-Z_]+\(.*?\)$/, '');
        elements = findPlaywrightMatches(cleanStr);
      } catch(e) {
        console.error('Verify parsing error:', e);
      }

      document.querySelectorAll('.pw-verify-highlight').forEach(el => el.classList.remove('pw-verify-highlight'));

      if (elements.length > 0) {
        if (elements.length > 1) {
          notifyParent({ type: 'VERIFY_RESULT', success: false, error: 'Strict mode violation: matched ' + elements.length + ' elements' });
        } else {
          let el = elements[0];
          el.classList.add('pw-verify-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          if (!document.getElementById('pw-verify-style')) {
            let style = document.createElement('style');
            style.id = 'pw-verify-style';
            style.textContent = '.pw-verify-highlight { outline: 4px solid #ef4444 !important; outline-offset: 2px !important; background: rgba(239,68,68,0.2) !important; transition: all 0.3s; }';
            document.head.appendChild(style);
          }
          setTimeout(() => el.classList.remove('pw-verify-highlight'), 3000);
          notifyParent({ type: 'VERIFY_RESULT', success: true });
        }
      } else {
        notifyParent({ type: 'VERIFY_RESULT', success: false, error: '0 elements found' });
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();