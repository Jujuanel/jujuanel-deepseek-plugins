// ==UserScript==
// @name         DeepSeek 会话一键删除（⌘D）
// @name:en      DeepSeek Quick Delete (Command+D)
// @namespace    https://chat.deepseek.com/
// @version      1.0.0
// @description  在侧栏会话左侧显示原生删除图标；点击或 Command+D 直接删除会话，无需确认。
// @author       Jujuanel
// @license      MIT
// @icon         https://cdn.deepseek.com/favicon.png
// @match        https://chat.deepseek.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const ROW_SELECTOR = 'a[href^="/a/chat/s/"]';
  const BUTTON_CLASS = 'ds-quick-delete';
  // DeepSeek 原生 Delete 菜单图标（2026-09-30）。
  const DELETE_PATH = 'M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z';
  let busy = false;
  let scheduled = false;

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
    html[data-ds-quick-deleting] .ds-modal-wrapper { visibility: hidden !important; }
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
      button.title = '直接删除此会话（无需确认）';
      button.setAttribute('aria-label', '直接删除此会话');
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

  function waitFor(find, message, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => {
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

  function reportError(error) {
    console.error('[DeepSeek Quick Delete]', error);
    const toast = document.createElement('div');
    toast.className = 'ds-quick-delete-error';
    toast.setAttribute('role', 'alert');
    toast.textContent = `删除未完成：${error.message}`;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  async function deleteSession(row) {
    if (busy) return;
    if (document.querySelector('.ds-modal-wrapper, .ds-dropdown-menu')) {
      reportError(new Error('请先关闭已打开的弹窗或菜单。'));
      return;
    }
    const menuButton = row.querySelector('[role="button"]');
    if (!menuButton || !row.isConnected) {
      reportError(new Error('找不到会话菜单，请刷新页面。'));
      return;
    }
    const href = row.getAttribute('href');
    busy = true;
    document.documentElement.setAttribute('data-ds-quick-deleting', '');
    try {
      menuButton.click();
      const deleteOption = await waitFor(() =>
        [...document.querySelectorAll('.ds-dropdown-menu-option--error')].find(option =>
          option.querySelector('svg path')?.getAttribute('d') === DELETE_PATH
        ), '找不到原生 Delete 菜单，网页结构可能已改变。');
      deleteOption.click();
      const confirmButton = await waitFor(() =>
        [...document.querySelectorAll('.ds-modal-wrapper [role="dialog"] .ds-button--error')].find(button =>
          /^(Delete chat|删除对话|删除会话)$/i.test(button.textContent.trim())
        ), '找不到原生删除按钮，网页结构可能已改变。');
      confirmButton.click();
      await waitFor(() =>
        ![...document.querySelectorAll(ROW_SELECTOR)].some(link => link.getAttribute('href') === href),
      '会话仍在侧栏中，请检查网络或网站提示。', 10000);
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

  window.addEventListener('keydown', event => {
    if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return;
    if (event.code !== 'KeyD' && event.key.toLowerCase() !== 'd') return;
    const row = [...document.querySelectorAll(ROW_SELECTOR)].find(link => link.pathname === location.pathname);
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) deleteSession(row);
  }, true);
})();
