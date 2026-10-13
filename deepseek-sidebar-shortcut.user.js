// ==UserScript==
// @name         DeepSeek 侧边栏快捷键
// @name:en      DeepSeek Sidebar Shortcut
// @namespace    https://chat.deepseek.com/
// @version      1.2.3
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

  // 复用网页原生弹窗的结构与类名，样式、配色和字体随网页的浅色、深色主题变化；无遮罩的提示加上阴影与页面区分。
  const style = document.createElement('style');
  style.textContent = `
    .${DIALOG_CLASS}--notice .ds-modal-content {
      box-shadow: 0 0 1px 0 rgba(0, 0, 0, .2), 0 0 4px 0 rgba(0, 0, 0, .02), 0 12px 32px 0 rgba(0, 0, 0, .08);
    }
  `;
  document.head.append(style);

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
    GM_setValue(STORAGE_KEY, value);
    registerMenu();
    recording = false;
    showNotice('设置侧边栏快捷键', `侧边栏快捷键已设为 ${formatShortcut(value)}`);
  }

  function startRecording() {
    recording = true;
    openDialog({
      title: '设置侧边栏快捷键',
      message: `当前为 ${formatShortcut(shortcut)}。请按下新的组合键，需包含 ⌘/Ctrl/Alt 等修饰键，按 Esc 取消。`,
      buttons: [{ label: '取消', onClick: cancelRecording }],
      onDismiss: cancelRecording,
    });
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
