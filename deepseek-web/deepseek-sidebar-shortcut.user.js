// ==UserScript==
// @name         DeepSeek 侧边栏快捷键（⌘/Ctrl + B）
// @name:en      DeepSeek Sidebar Shortcut (⌘/Ctrl + B)
// @namespace    https://chat.deepseek.com/
// @version      1.0.0
// @description  Command+B（macOS）/ Ctrl+B（Windows、Linux）收起或展开 chat.deepseek.com 的侧边栏。
// @description:en  Command+B (macOS) / Ctrl+B (Windows, Linux) to collapse or expand the sidebar of chat.deepseek.com.
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

  const IS_APPLE = /mac|iphone|ipad|ipod/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  );

  const TOGGLE_ICON_PATH = 'M9.67272 0.522841';

  const BUTTON_SELECTOR = '.ds-button, [role="button"]';

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
  }

  function hasToggleIcon(el) {
    return Array.from(el.querySelectorAll('svg path')).some((path) =>
      (path.getAttribute('d') || '').startsWith(TOGGLE_ICON_PATH)
    );
  }

  function toggleSidebar() {
    const matches = Array.from(document.querySelectorAll(BUTTON_SELECTOR)).filter(
      (el) => isVisible(el) && hasToggleIcon(el)
    );
    matches.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const button = matches[0];
    if (!button) {
      console.warn('[DeepSeek Sidebar Shortcut] 没有找到边栏折叠按钮。');
      return;
    }
    button.click();
  }

  function onKeyDown(event) {
    const isB = event.code === 'KeyB' || (event.key || '').toLowerCase() === 'b';
    if (!isB || event.altKey || event.shiftKey) return;
    if (IS_APPLE ? !event.metaKey : !event.ctrlKey) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.repeat) return;

    toggleSidebar();
  }

  window.addEventListener('keydown', onKeyDown, true);
})();
