(function () {
  const btnSelectFiles = document.getElementById('btn-select-files');
  const btnSelectFolders = document.getElementById('btn-select-folders');
  const btnRun = document.getElementById('btn-run');
  const btnCancel = document.getElementById('btn-cancel');
  const selectedPathWrap = document.getElementById('selected-path-wrap');
  const selectedPathEl = document.getElementById('selected-path');
  const clearPathBtn = document.getElementById('clear-path');
  const assetsDirInput = document.getElementById('assets-dir');
  const assetsClearBtn = document.getElementById('assets-clear');
  const namingModeSelect = document.getElementById('naming-mode');
  const namingDropdown = document.getElementById('naming-dropdown');
  const namingPrefixInput = document.getElementById('naming-prefix');
  const namingStartInput = document.getElementById('naming-start');
  const backupEnabledCheckbox = document.getElementById('backup-enabled');
  const deleteOldCheckbox = document.getElementById('delete-old');
  const summaryEl = document.getElementById('summary');
  const detailsEl = document.getElementById('details');
  const emptyStateEl = document.getElementById('empty-state');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const namingPrefixField = document.querySelector('.naming-prefix');
  const namingStartField = document.querySelector('.naming-start');
  const namingPrefixLabel = document.getElementById('naming-prefix-label');

  let selectedPaths = [];
  let cancelToken = { cancelled: false };

  function setSelectedPaths(list) {
    selectedPaths = Array.isArray(list) ? list : [];
    if (!selectedPaths.length) {
      selectedPathEl.textContent = '';
      if (selectedPathWrap) {
        selectedPathWrap.classList.add('hidden');
      }
    } else if (selectedPaths.length === 1) {
      selectedPathEl.textContent = selectedPaths[0];
      if (selectedPathWrap) {
        selectedPathWrap.classList.remove('hidden');
      }
    } else {
      selectedPathEl.textContent = `${selectedPaths.length} 个目标已选择`;
      if (selectedPathWrap) {
        selectedPathWrap.classList.remove('hidden');
      }
    }
  }

  async function handleSelect(mode) {
    try {
      const list = await window.PackMD.selectTargets(mode);
      setSelectedPaths(list);
    } catch (e) {
      utools.showNotification('选择路径失败: ' + e.message);
    }
  }

  function renderResult(result) {
    const { summary, files } = result || {};

    if (!summary) {
      if (emptyStateEl) {
        emptyStateEl.style.display = 'grid';
      }
      summaryEl.textContent = '';
      detailsEl.innerHTML = '';
      return;
    }

    if (emptyStateEl) {
      emptyStateEl.style.display = 'none';
    }
    const isSingle = (files || []).length === 1;
    summaryEl.classList.toggle('summary-single', isSingle);
    summaryEl.innerHTML = `
      <div class="summary-item">
        <span class="label">处理文件数</span>
        <span class="value">${summary.totalFiles}</span>
      </div>
      <div class="summary-item">
        <span class="label">发现图片</span>
        <span class="value">${summary.totalImagesFound}</span>
      </div>
      <div class="summary-item">
        <span class="label">复制图片</span>
        <span class="value good">${summary.totalCopied}</span>
      </div>
      <div class="summary-item">
        <span class="label">复用已存在</span>
        <span class="value">${summary.totalReused}</span>
      </div>
      <div class="summary-item">
        <span class="label">跳过外部</span>
        <span class="value">${summary.totalSkippedExternal}</span>
      </div>
      <div class="summary-item">
        <span class="label">跳过缺失</span>
        <span class="value bad">${summary.totalSkippedMissing}</span>
      </div>
      <div class="summary-item">
        <span class="label">冲突处理</span>
        <span class="value">${summary.totalNameConflicts}</span>
      </div>
      <div class="summary-item">
        <span class="label">错误条数</span>
        <span class="value ${summary.totalErrors ? 'bad' : 'good'}">
          ${summary.totalErrors}
        </span>
      </div>
    `;

    detailsEl.innerHTML = '';
    (files || []).forEach((f) => {
      const div = document.createElement('div');
      div.className = 'file-result';
      const errors = (f.errors || []).filter(Boolean);
      const isSuccess = errors.length === 0 && f.skippedMissing === 0;
      const statusText = isSuccess ? '成功' : '失败';
      const statusClass = isSuccess ? 'ok' : 'bad';
      div.innerHTML = `
        <div class="file-head">
          <div class="file-path" title="${f.filePath}">${f.filePath}</div>
          <span class="file-status ${statusClass}">${statusText}</span>
          <div class="file-kpi">
            <span>图片 ${f.imagesFound}</span>
            <span>复制 ${f.copied}</span>
            <span>复用 ${f.reused}</span>
          </div>
        </div>
        <div class="file-stats">
          <span>跳过外部 ${f.skippedExternal}</span>
          <span>跳过缺失 ${f.skippedMissing}</span>
          <span>冲突处理 ${f.nameConflicts}</span>
        </div>
        ${
          errors.length
            ? `<div class="file-errors">错误：
                <ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>
               </div>`
            : ''
        }
      `;
      detailsEl.appendChild(div);
    });
  }

  function updateNamingVisibility() {
    const mode = namingModeSelect.value;
    const needPrefix = ['prefix', 'fixed'].includes(mode);
    if (namingPrefixLabel) {
      namingPrefixLabel.textContent = mode === 'fixed' ? '固定名称' : '前缀';
    }
    const needStart = false; // 序号自动从1递增，不展示
    if (namingPrefixField) {
      namingPrefixField.classList.toggle('hidden', !needPrefix);
    }
    if (namingStartField) {
      namingStartField.classList.toggle('hidden', !needStart);
    }
  }

  function isValidAssetsDirName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') return false;
    // 禁止包含路径分隔符和常见非法文件名字符
    return !/[<>:"/\\|?*\x00-\x1F]/.test(trimmed);
  }

  function isValidPrefix(prefix) {
    if (!prefix) return true; // 允许留空，后端会用默认 img
    const trimmed = prefix.trim();
    if (!trimmed) return true;
    // 允许中文、英文、数字、下划线、短横线、点和空格
    return /^[\u4e00-\u9fa5A-Za-z0-9_\-\.\s]+$/.test(trimmed);
  }

  function syncNamingDropdown() {
    if (!namingDropdown || !namingModeSelect) return;
    const value = namingModeSelect.value;
    const labelEl = namingDropdown.querySelector('.dropdown-value');
    const items = namingDropdown.querySelectorAll('.dropdown-item');
    let activeLabel = '';
    items.forEach((item) => {
      const isActive = item.dataset.value === value;
      item.classList.toggle('active', isActive);
      if (isActive) {
        activeLabel = item.textContent.trim();
      }
    });
    if (!activeLabel && namingModeSelect.selectedIndex >= 0) {
      activeLabel = namingModeSelect.options[namingModeSelect.selectedIndex].text;
    }
    if (labelEl && activeLabel) {
      labelEl.textContent = activeLabel;
    }
  }

  function closeNamingDropdown() {
    if (!namingDropdown) return;
    namingDropdown.classList.remove('open');
    const trigger = namingDropdown.querySelector('.dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function setupNamingDropdown() {
    if (!namingDropdown || !namingModeSelect) return;
    const trigger = namingDropdown.querySelector('.dropdown-trigger');
    const panel = namingDropdown.querySelector('.dropdown-panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = namingDropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      } else if (e.key === 'Escape') {
        closeNamingDropdown();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        namingDropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        const firstItem = panel.querySelector('.dropdown-item');
        if (firstItem) firstItem.focus();
      }
    });

    panel.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item) return;
      const value = item.dataset.value;
      if (value) {
        namingModeSelect.value = value;
        namingModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        syncNamingDropdown();
      }
      closeNamingDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!namingDropdown.contains(e.target)) {
        closeNamingDropdown();
      }
    });
  }

  function runPack() {
    if (!selectedPaths.length) {
      utools.showNotification('请先选择一个或多个 Markdown 文件 / 文件夹');
      return;
    }
    const rawAssetsDir = assetsDirInput.value.trim();
    const assetsDirName = rawAssetsDir || 'assets';
    if (!isValidAssetsDirName(assetsDirName)) {
      utools.showNotification('资源目录名不合法，请避免使用路径分隔符或特殊字符');
      assetsDirInput.focus();
      return;
    }
    const namingMode = namingModeSelect.value || 'original';
    const namingPrefixRaw = namingPrefixInput.value;
    if (!isValidPrefix(namingPrefixRaw)) {
      utools.showNotification(
        '前缀/固定名称包含不允许的字符，只能使用中文、英文、数字及常见符号(_ - . 空格)'
      );
      namingPrefixInput.focus();
      return;
    }
    const namingPrefix = namingPrefixRaw.trim();
    const namingStart = 1; // 自动从1递增
    const backupEnabled = !!backupEnabledCheckbox.checked;
    const deleteOld = !!deleteOldCheckbox && !!deleteOldCheckbox.checked;

    if (window.utools && utools.dbStorage) {
      try {
        // 仅记住“命名方式 / 是否备份 / 是否删除旧文件”，不记住资源目录名和前缀
        utools.dbStorage.setItem('packmd-config', {
          namingMode,
          backupEnabled,
          deleteOld
        });
      } catch (e) {
        // ignore persist error
      }
    }

    btnRun.disabled = true;
    btnRun.textContent = '处理中...';
    cancelToken = { cancelled: false };
    updateProgress(0, selectedPaths.length);

    window.PackMD.runPackAsync(
      selectedPaths,
      {
        assetsDirName,
        namingMode,
        namingPrefix,
        namingStart,
        backupEnabled,
        deleteOld
      },
      (p) => updateProgress(p.done, p.total),
      cancelToken
    )
      .then((result) => {
        renderResult(result);
        if (result.cancelled) {
          utools.showNotification('已取消');
        }
      })
      .catch((e) => {
        utools.showNotification('处理失败: ' + e.message);
      })
      .finally(() => {
        btnRun.disabled = false;
        btnRun.textContent = '开始处理';
      });
  }

  function updateProgress(done, total) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = total ? `${done}/${total}` : '待开始';
  }

  function cancelRun() {
    cancelToken.cancelled = true;
  }

  function loadPersisted() {
    try {
      const saved = utools.dbStorage.getItem('packmd-config');
      if (!saved) return;
      if (saved.namingMode) {
        namingModeSelect.value = saved.namingMode;
      }
      if (typeof saved.backupEnabled === 'boolean') {
        backupEnabledCheckbox.checked = saved.backupEnabled;
      }
      if (typeof saved.deleteOld === 'boolean' && deleteOldCheckbox) {
        deleteOldCheckbox.checked = saved.deleteOld;
      }
      updateNamingVisibility();
      syncNamingDropdown();
    } catch (e) {
      // ignore
    }
  }

  function setupDragDrop() {
    const root = document.body;
    ['dragover', 'dragenter'].forEach((evt) => {
      root.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    root.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files || []).map((f) => f.path);
      const mdOnly = files.filter((p) => p && p.toLowerCase().endsWith('.md'));
      setSelectedPaths(mdOnly.length ? mdOnly : files);
    });
  }

  function hydrateSelectionFromAction(action) {
    const payload = action && action.payload;
    if (!payload) return;
    if (typeof payload === 'string') {
      setSelectedPaths([payload]);
      return;
    }
    if (Array.isArray(payload)) {
      const list = payload.filter(Boolean);
      if (list.length) setSelectedPaths(list);
      return;
    }
    if (payload.data && Array.isArray(payload.data)) {
      const list = payload.data.filter(Boolean);
      if (list.length) setSelectedPaths(list);
    }
  }

  btnSelectFiles.addEventListener('click', () => handleSelect('files'));
  btnSelectFolders.addEventListener('click', () => handleSelect('folders'));
  btnRun.addEventListener('click', runPack);
  btnCancel.addEventListener('click', cancelRun);
  namingModeSelect.addEventListener('change', () => {
    updateNamingVisibility();
    syncNamingDropdown();
  });
  if (clearPathBtn) {
    clearPathBtn.addEventListener('click', () => setSelectedPaths([]));
  }
  if (assetsClearBtn && assetsDirInput) {
    assetsClearBtn.addEventListener('click', () => {
      assetsDirInput.value = '';
      assetsDirInput.focus();
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'packmd-enter') return;
    hydrateSelectionFromAction(msg.payload);
  });

  setSelectedPaths([]);
  loadPersisted();
  setupDragDrop();
  updateNamingVisibility();
  setupNamingDropdown();
  syncNamingDropdown();
})();
