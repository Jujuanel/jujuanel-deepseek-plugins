// ==UserScript==
// @name         DeepSeek 会话一键删除（⌘/Ctrl + D）
// @name:en      DeepSeek Quick Delete (⌘/Ctrl + D)
// @namespace    https://chat.deepseek.com/
// @version      1.2.0
// @description  在侧栏会话左侧显示原生删除图标，点击或按快捷键（默认 ⌘/Ctrl + D）删除会话。默认弹出网页原生确认框，可在油猴菜单中关闭确认，并设置快捷键和删除当前会话后打开的页面。
// @description:en  Show a delete icon beside each chat in the sidebar; click it or press a shortcut (default ⌘/Ctrl + D) to delete a chat. The site's native confirmation dialog appears by default; from the userscript manager menu you can turn confirmation off, change the shortcut, and choose the page opened after deleting the current chat.
// @author       Jujuanel
// @license      MIT
// @icon         https://cdn.deepseek.com/favicon.png
// @match        https://chat.deepseek.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const ROW_SELECTOR = 'a[href^="/a/chat/s/"]';
  const BUTTON_CLASS = 'ds-quick-delete';
  // DeepSeek 原生 Delete 菜单图标（2026-09-30）。
  const DELETE_PATH = 'M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z';
  const IS_APPLE = /mac|iphone|ipad|ipod/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  );

  const DEFAULT_SHORTCUT = {
    code: 'KeyD',
    key: 'd',
    metaKey: IS_APPLE,
    ctrlKey: !IS_APPLE,
    altKey: false,
    shiftKey: false,
  };

  const MODIFIER_CODES = new Set([
    'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  ]);

  // 删除当前会话后打开的页面：侧栏中的上一个会话、下一个会话或新会话；相邻会话不存在时打开新会话。
  const AFTER_DELETE_OPTIONS = {
    previous: '上一个会话',
    next: '下一个会话',
    new: '新会话',
  };

  const DIALOG_CLASS = 'ds-quick-delete-dialog';
  const NATIVE_DIALOG_SELECTOR = `.ds-modal-wrapper:not(.${DIALOG_CLASS}) [role="dialog"]`;
  const NATIVE_CONFIRM_SELECTOR = `${NATIVE_DIALOG_SELECTOR} .ds-button--error`;

  let shortcut = GM_getValue('shortcut', DEFAULT_SHORTCUT);
  let afterDelete = GM_getValue('afterDelete', 'new');
  let confirmDelete = GM_getValue('confirmDelete', true);
  let recording = false;
  let menuIds = [];
  let busy = false;
  let scheduled = false;

  // 设置弹窗复用网页原生弹窗的结构与类名，样式、配色和字体随网页的浅色、深色主题变化；无遮罩的提示加上阴影与页面区分。
  const style = document.createElement('style');
  style.textContent = `
    ${ROW_SELECTOR}:has(> .${BUTTON_CLASS}) { justify-content: flex-start; }
    ${ROW_SELECTOR} > .${BUTTON_CLASS} ~ div:not(.ds-focus-ring):not(:has([role="button"])) {
      flex: 1; min-width: 0;
    }
    .${BUTTON_CLASS} {
      display: inline-flex; align-items: center; justify-content: center;
      flex: 0 0 24px; width: 24px; height: 24px; margin: -3px 6px -3px -4px;
      padding: 0; border: 0; border-radius: 6px; background: transparent;
      color: inherit; opacity: .65; cursor: pointer;
    }
    .${BUTTON_CLASS}:hover, .${BUTTON_CLASS}:focus-visible {
      opacity: 1; color: var(--dsw-alias-status-error-primary, #e5484d);
      background: var(--dsw-alias-bg-hover, rgba(128,128,128,.12));
    }
    html[data-ds-quick-deleting] .ds-dropdown-menu,
    html[data-ds-quick-deleting="silent"] .ds-modal-wrapper { visibility: hidden !important; }
    .${DIALOG_CLASS}--notice .ds-modal-content {
      box-shadow: 0 0 1px 0 rgba(0, 0, 0, .2), 0 0 4px 0 rgba(0, 0, 0, .02), 0 12px 32px 0 rgba(0, 0, 0, .08);
    }
    .ds-quick-delete-error {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 9999; padding: 12px 18px; border-radius: 8px;
      background: #b42318; color: white; font: 14px sans-serif;
    }
  `;
  document.head.append(style);

  function enhanceRows() {
    for (const row of document.querySelectorAll(ROW_SELECTOR)) {
      if (row.querySelector(`.${BUTTON_CLASS}`) || !row.querySelector('[role="button"]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.title = '删除此会话';
      button.setAttribute('aria-label', '删除此会话');
      button.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="${DELETE_PATH}" fill="currentColor"/></svg>`;
      row.prepend(button);
    }
  }

  // 只在 DOM 更新后合并扫描，支持新会话、分页加载和 SPA 导航。
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceRows();
    });
  }).observe(document.body, { childList: true, subtree: true });
  enhanceRows();

  // timeout 为 null 时一直等待，用于等待用户在原生确认框中操作。
  function waitFor(find, message, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(check);
      const timer = timeout === null ? null : setTimeout(() => {
        observer.disconnect();
        reject(new Error(message));
      }, timeout);
      function check() {
        const result = find();
        if (!result) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(result);
      }
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      check();
    });
  }

  // 等待用户在原生确认框中操作：点击确认删除时返回 true，取消或关闭时返回 false。
  async function waitForUserConfirm() {
    let confirmed = false;
    const onClick = event => {
      if (event.target.closest?.(NATIVE_CONFIRM_SELECTOR)) confirmed = true;
    };
    document.addEventListener('click', onClick, true);
    try {
      await waitFor(() => !document.querySelector(NATIVE_DIALOG_SELECTOR), null, null);
    } finally {
      document.removeEventListener('click', onClick, true);
    }
    return confirmed;
  }

  function reportError(error) {
    console.error('[DeepSeek Quick Delete]', error);
    const toast = document.createElement('div');
    toast.className = 'ds-quick-delete-error';
    toast.setAttribute('role', 'alert');
    toast.textContent = `删除未完成：${error.message}`;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function findRow(href) {
    return [...document.querySelectorAll(ROW_SELECTOR)].find(link => link.getAttribute('href') === href);
  }

  function neighborHref(row) {
    if (afterDelete === 'new') return null;
    const rows = [...document.querySelectorAll(ROW_SELECTOR)];
    const index = rows.indexOf(row);
    const neighbor = rows[afterDelete === 'previous' ? index - 1 : index + 1];
    return neighbor ? neighbor.getAttribute('href') : null;
  }

  async function deleteSession(row) {
    if (busy) return;
    if (document.querySelector('.ds-modal-overlay, .ds-dropdown-menu')) {
      reportError(new Error('请先关闭已打开的弹窗或菜单。'));
      return;
    }
    const menuButton = row.querySelector('[role="button"]');
    if (!menuButton || !row.isConnected) {
      reportError(new Error('找不到会话菜单，请刷新页面。'));
      return;
    }
    const href = row.getAttribute('href');
    const isCurrent = row.pathname === location.pathname;
    const nextHref = isCurrent ? neighborHref(row) : null;
    busy = true;
    document.documentElement.setAttribute('data-ds-quick-deleting', confirmDelete ? 'confirm' : 'silent');
    try {
      menuButton.click();
      const deleteOption = await waitFor(() =>
        [...document.querySelectorAll('.ds-dropdown-menu-option--error')].find(option =>
          option.querySelector('svg path')?.getAttribute('d') === DELETE_PATH
        ), '找不到原生 Delete 菜单，网页结构可能已改变。');
      deleteOption.click();
      const confirmButton = await waitFor(() =>
        [...document.querySelectorAll(NATIVE_CONFIRM_SELECTOR)].find(button =>
          /^(Delete chat|删除对话|删除会话)$/i.test(button.textContent.trim())
        ), '找不到原生删除按钮，网页结构可能已改变。');
      if (confirmDelete) {
        if (!(await waitForUserConfirm())) return;
      } else {
        confirmButton.click();
      }
      await waitFor(() => !findRow(href), '会话仍在侧栏中，请检查网络或网站提示。', 10000);
      if (nextHref) {
        // 网站删除当前会话后会跳到新会话页，等跳转完成再打开相邻会话。
        await waitFor(() => location.pathname !== href, '删除后网页没有离开当前会话。');
        const nextRow = findRow(nextHref);
        if (nextRow) nextRow.click();
      }
    } catch (error) {
      reportError(error);
    } finally {
      document.documentElement.removeAttribute('data-ds-quick-deleting');
      busy = false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.(`.${BUTTON_CLASS}`);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteSession(button.closest(ROW_SELECTOR));
  }, true);

  function keyName(code, key) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F\d{1,2}$/.test(code)) return code;
    const names = {
      Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
      BracketLeft: '[', BracketRight: ']', Backslash: '\\', Slash: '/',
      Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Minus: '-',
      Equal: '=', Backquote: '`',
    };
    return names[code] || (key || code).toUpperCase();
  }

  function formatShortcut(value) {
    const parts = [];
    if (IS_APPLE) {
      if (value.ctrlKey) parts.push('⌃');
      if (value.altKey) parts.push('⌥');
      if (value.shiftKey) parts.push('⇧');
      if (value.metaKey) parts.push('⌘');
      return parts.join('') + keyName(value.code, value.key);
    }
    if (value.ctrlKey) parts.push('Ctrl');
    if (value.altKey) parts.push('Alt');
    if (value.shiftKey) parts.push('Shift');
    if (value.metaKey) parts.push('Win');
    parts.push(keyName(value.code, value.key));
    return parts.join('+');
  }

  function matchesShortcut(event) {
    const sameKey =
      event.code === shortcut.code ||
      (/^[a-z]$/.test(shortcut.key) && (event.key || '').toLowerCase() === shortcut.key);
    return (
      sameKey &&
      event.metaKey === shortcut.metaKey &&
      event.ctrlKey === shortcut.ctrlKey &&
      event.altKey === shortcut.altKey &&
      event.shiftKey === shortcut.shiftKey
    );
  }

  function registerMenu() {
    menuIds.forEach(id => GM_unregisterMenuCommand(id));
    menuIds = [
      GM_registerMenuCommand(`设置快捷键（当前：${formatShortcut(shortcut)}）`, startRecording),
      GM_registerMenuCommand(`删除当前会话后打开（当前：${AFTER_DELETE_OPTIONS[afterDelete]}）`, chooseAfterDelete),
      GM_registerMenuCommand(`删除前确认（当前：${confirmDelete ? '开启' : '关闭'}）`, toggleConfirmDelete),
    ];
  }

  let dialog = null;

  function createButton(label, primary, onClick) {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.className = `ds-button ${primary ? 'ds-button--primary ds-button--filled' : 'ds-button--outlinedNeutral ds-button--outlined'} ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width`;
    button.innerHTML = `<div class="ds-button__background"></div>${primary ? '' : '<div class="ds-button__border"></div>'}<span class="ds-button__content"></span>`;
    button.querySelector('.ds-button__content').textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  // modal 为 true 时显示原生的模糊遮罩，点击遮罩触发 onDismiss；为 false 时仅显示弹窗，不拦截页面操作。
  function openDialog({ title, message, buttons = [], modal = true, onDismiss }) {
    closeDialog();
    const wrapper = document.createElement('div');
    wrapper.className = `ds-theme ds-modal-wrapper ${DIALOG_CLASS}${modal ? '' : ` ${DIALOG_CLASS}--notice`}`;
    wrapper.style.zIndex = '1026';
    wrapper.innerHTML = `
      <div class="ds-modal" aria-modal="${modal}">
        <div class="ds-modal-content ds-elevated ds-modal-content--dialog" role="dialog">
          <div class="ds-modal-content__header-wrapper"><div class="ds-modal-content__title"></div></div>
          <div class="ds-modal-content__main"></div>
        </div>
      </div>`;
    wrapper.querySelector('.ds-modal-content__title').textContent = title;
    const main = wrapper.querySelector('.ds-modal-content__main');
    main.textContent = message;
    if (buttons.length) {
      const footer = document.createElement('div');
      footer.className = 'ds-modal-content__footer';
      const group = document.createElement('div');
      group.className = 'ds-modal-content__button-group';
      group.append(...buttons.map(({ label, primary, onClick }) => createButton(label, primary, onClick)));
      footer.append(group);
      wrapper.querySelector('.ds-modal-content').append(footer);
    } else {
      main.classList.add('ds-modal-content__main--pad-bottom');
    }
    const elements = [wrapper];
    if (modal) {
      const overlay = document.createElement('div');
      overlay.className = 'ds-modal-overlay';
      overlay.style.zIndex = '1025';
      overlay.addEventListener('click', onDismiss);
      elements.unshift(overlay);
    }
    document.body.append(...elements);
    dialog = { elements, main };
    return dialog;
  }

  function closeDialog() {
    dialog?.elements.forEach((el) => el.remove());
    dialog = null;
  }

  function showNotice(title, message) {
    const notice = openDialog({ title, message, modal: false });
    setTimeout(() => {
      if (dialog === notice) closeDialog();
    }, 1500);
  }

  function saveShortcut(value) {
    shortcut = value;
    GM_setValue('shortcut', value);
    registerMenu();
    recording = false;
    showNotice('设置删除快捷键', `删除快捷键已设为 ${formatShortcut(value)}`);
  }

  function startRecording() {
    recording = true;
    openDialog({
      title: '设置删除快捷键',
      message: `当前为 ${formatShortcut(shortcut)}。请按下新的组合键，需包含 ⌘/Ctrl/Alt 等修饰键，按 Esc 取消。`,
      buttons: [{ label: '取消', onClick: cancelRecording }],
      onDismiss: cancelRecording,
    });
  }

  function cancelRecording() {
    recording = false;
    closeDialog();
  }

  function toggleConfirmDelete() {
    confirmDelete = !confirmDelete;
    GM_setValue('confirmDelete', confirmDelete);
    registerMenu();
    showNotice('删除前确认', confirmDelete ? '已开启，删除前弹出网页原生确认框' : '已关闭，删除时不再确认');
  }

  function chooseAfterDelete() {
    openDialog({
      title: '删除当前会话后打开',
      message: '选择删除当前会话后要打开的页面。',
      buttons: Object.entries(AFTER_DELETE_OPTIONS).map(([value, label]) => ({
        label,
        primary: value === afterDelete,
        onClick: () => {
          afterDelete = value;
          GM_setValue('afterDelete', value);
          registerMenu();
          showNotice('删除当前会话后打开', `已设为打开${label}`);
        },
      })),
      onDismiss: closeDialog,
    });
  }

  function onRecordKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (MODIFIER_CODES.has(event.code)) return;

    if (event.code === 'Escape') {
      cancelRecording();
      return;
    }

    const isFunctionKey = /^F\d{1,2}$/.test(event.code);
    if (!isFunctionKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      dialog.main.textContent = '快捷键需包含 ⌘/Ctrl/Alt 等修饰键，请重新按下，按 Esc 取消。';
      return;
    }

    saveShortcut({
      code: event.code,
      key: (event.key || '').toLowerCase(),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
    });
  }

  window.addEventListener('keydown', event => {
    if (recording) {
      onRecordKeyDown(event);
      return;
    }
    if (dialog && event.code === 'Escape') {
      closeDialog();
      return;
    }
    if (event.isComposing || !matchesShortcut(event)) return;
    const row = [...document.querySelectorAll(ROW_SELECTOR)].find(link => link.pathname === location.pathname);
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) deleteSession(row);
  }, true);

  registerMenu();
})();
