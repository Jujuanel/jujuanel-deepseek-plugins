// ==UserScript==
// @name         DeepSeek 双击会话标题重命名
// @name:en      DeepSeek Double Click to Rename
// @namespace    https://chat.deepseek.com/
// @version      1.0.0
// @description  双击侧栏会话标题，直接进入网页原生标题编辑框。
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

  const TITLE_SELECTOR = 'a[href^="/a/chat/s/"] > .c08e6e93';
  let busy = false;

  const style = document.createElement('style');
  style.textContent = `
    html[data-ds-double-click-renaming] .ds-dropdown-menu { visibility: hidden !important; }
  `;
  document.head.append(style);

  function waitFor(find, message) {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(message));
      }, 4000);
      function check() {
        const result = find();
        if (!result) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(result);
      }
      observer.observe(document.body, { childList: true, subtree: true });
      check();
    });
  }

  async function renameSession(row) {
    if (busy) return;
    if (document.querySelector('.ds-modal-wrapper, .ds-dropdown-menu, input.ds-input__input')) {
      window.alert('请先关闭已打开的菜单、弹窗或标题编辑框。');
      return;
    }
    const menuButton = row.querySelector('[role="button"]');
    const container = row.parentElement;
    if (!menuButton) {
      window.alert('找不到会话菜单，DeepSeek 网页结构可能已改变。');
      return;
    }
    busy = true;
    document.documentElement.setAttribute('data-ds-double-click-renaming', '');
    try {
      menuButton.click();
      const renameOption = await waitFor(() =>
        [...document.querySelectorAll('.ds-dropdown-menu-option')].find(option =>
          /^(Rename|重命名)$/.test(option.querySelector('.ds-dropdown-menu-option__label')?.textContent.trim())
        ), '找不到原生 Rename 菜单，DeepSeek 网页结构可能已改变。');
      renameOption.click();
      const input = await waitFor(() =>
        container.querySelector(':scope > .ds-input > input.ds-input__input'),
      '找不到原生标题编辑框，DeepSeek 网页结构可能已改变。');
      input.focus();
      input.select();
    } catch (error) {
      console.error('[DeepSeek Double Click Rename]', error);
      // 恢复原生菜单的可见性后再显示错误。
      document.documentElement.removeAttribute('data-ds-double-click-renaming');
      window.alert(`无法进入标题编辑：${error.message}`);
    } finally {
      document.documentElement.removeAttribute('data-ds-double-click-renaming');
      busy = false;
    }
  }

  // 事件委托兼容新会话、置顶、滚动加载及 SPA 导航。
  document.addEventListener('dblclick', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const title = event.target.closest?.(TITLE_SELECTOR);
    if (!title) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renameSession(title.parentElement);
  }, true);
})();
