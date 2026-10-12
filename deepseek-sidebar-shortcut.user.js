// ==UserScript==
// @name         DeepSeek 侧边栏快捷键（⌘/Ctrl + B）
// @name:en      DeepSeek Sidebar Shortcut (⌘/Ctrl + B)
// @namespace    https://chat.deepseek.com/
// @version      1.2.0
// @description  用快捷键收起或展开 chat.deepseek.com 的侧边栏，默认 Command+B（macOS）/ Ctrl+B（Windows、Linux），可在油猴菜单中自定义。
// @description:en  Collapse or expand the sidebar of chat.deepseek.com with a shortcut. Defaults to Command+B (macOS) / Ctrl+B (Windows, Linux) and can be customized from the userscript manager menu.
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

  const IS_APPLE = /mac|iphone|ipad|ipod/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  );

  const TOGGLE_ICON_PATH = 'M9.67272 0.522841';

  const BUTTON_SELECTOR = '.ds-button, [role="button"]';

  const STORAGE_KEY = 'shortcut';

  const DEFAULT_SHORTCUT = {
    code: 'KeyB',
    key: 'b',
    metaKey: IS_APPLE,
    ctrlKey: !IS_APPLE,
    altKey: false,
    shiftKey: false,
  };

  const MODIFIER_CODES = new Set([
    'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  ]);

  let shortcut = GM_getValue(STORAGE_KEY, DEFAULT_SHORTCUT);
  let recording = false;
  let menuIds = [];

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
    menuIds.forEach((id) => GM_unregisterMenuCommand(id));
    menuIds = [
      GM_registerMenuCommand(`设置快捷键（当前：${formatShortcut(shortcut)}）`, startRecording),
    ];
  }

  const DIALOG_CLASS = 'ds-sidebar-shortcut-dialog';

  // 复用网页原生弹窗的结构与类名，样式、配色和字体随网页的浅色、深色主题变化；仅改为贴顶显示。
  const style = document.createElement('style');
  style.textContent = `
    .${DIALOG_CLASS}.ds-modal-wrapper .ds-modal { margin: 40px auto auto; }
  `;
  document.head.append(style);

  let dialog = null;

  function openDialog(title, message) {
    closeDialog();
    const overlay = document.createElement('div');
    overlay.className = 'ds-modal-overlay';
    overlay.style.zIndex = '1025';
    const wrapper = document.createElement('div');
    wrapper.className = `ds-theme ds-modal-wrapper ${DIALOG_CLASS}`;
    wrapper.style.zIndex = '1026';
    wrapper.innerHTML = `
      <div class="ds-modal" aria-modal="true">
        <div class="ds-modal-content ds-elevated ds-modal-content--dialog" role="dialog">
          <div class="ds-modal-content__header-wrapper"><div class="ds-modal-content__title"></div></div>
          <div class="ds-modal-content__main"></div>
          <div class="ds-modal-content__footer">
            <div class="ds-modal-content__button-group">
              <div role="button" tabindex="0" class="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width">
                <div class="ds-button__background"></div><div class="ds-button__border"></div><span class="ds-button__content">取消</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    wrapper.querySelector('.ds-modal-content__title').textContent = title;
    const main = wrapper.querySelector('.ds-modal-content__main');
    main.textContent = message;
    const footer = wrapper.querySelector('.ds-modal-content__footer');
    footer.querySelector('[role="button"]').addEventListener('click', cancelRecording);
    overlay.addEventListener('click', cancelRecording);
    document.body.append(overlay, wrapper);
    dialog = { overlay, wrapper, main, footer };
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.overlay.remove();
    dialog.wrapper.remove();
    dialog = null;
  }

  function saveShortcut(value) {
    shortcut = value;
    GM_setValue(STORAGE_KEY, value);
    registerMenu();
    recording = false;
    const current = dialog;
    current.main.textContent = `侧边栏快捷键已设为 ${formatShortcut(value)}`;
    current.footer.remove();
    setTimeout(() => {
      if (dialog === current) closeDialog();
    }, 1500);
  }

  function startRecording() {
    recording = true;
    openDialog(
      '设置侧边栏快捷键',
      `当前为 ${formatShortcut(shortcut)}。请按下新的组合键，需包含 ⌘/Ctrl/Alt 等修饰键，按 Esc 取消。`
    );
  }

  function cancelRecording() {
    recording = false;
    closeDialog();
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

  function onKeyDown(event) {
    if (recording) {
      onRecordKeyDown(event);
      return;
    }
    if (!matchesShortcut(event)) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.repeat) return;

    toggleSidebar();
  }

  window.addEventListener('keydown', onKeyDown, true);
  registerMenu();
})();
