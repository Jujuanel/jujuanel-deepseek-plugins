// ==UserScript==
// @name         DeepSeek 侧边栏快捷键（⌘/Ctrl + B）
// @name:en      DeepSeek Sidebar Shortcut (⌘/Ctrl + B)
// @namespace    https://chat.deepseek.com/
// @version      1.1.0
// @description  用快捷键收起或展开 chat.deepseek.com 的侧边栏，默认 Command+B（macOS）/ Ctrl+B（Windows、Linux），可在油猴菜单中自定义。
// @description:en  Collapse or expand the sidebar of chat.deepseek.com with a shortcut. Defaults to Command+B (macOS) / Ctrl+B (Windows, Linux) and can be customized from the userscript manager menu.
// @author       Jujuanel
// @license      MIT
// @icon         https://cdn.deepseek.com/favicon.png
// @match        https://chat.deepseek.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
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

  const PROMPT_CLASS = 'ds-sidebar-shortcut-prompt';

  let shortcut = GM_getValue(STORAGE_KEY, DEFAULT_SHORTCUT);
  let recording = null;
  let menuIds = [];

  const style = document.createElement('style');
  style.textContent = `
    .${PROMPT_CLASS} {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 9999; padding: 12px 18px; border-radius: 8px;
      background: #1f2937; color: white; font: 14px sans-serif;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .2);
    }
  `;
  document.head.append(style);

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
      GM_registerMenuCommand(`恢复默认快捷键（${formatShortcut(DEFAULT_SHORTCUT)}）`, resetShortcut),
    ];
  }

  function showPrompt(text, duration) {
    document.querySelector(`.${PROMPT_CLASS}`)?.remove();
    const prompt = document.createElement('div');
    prompt.className = PROMPT_CLASS;
    prompt.textContent = text;
    document.body.append(prompt);
    if (duration) setTimeout(() => prompt.remove(), duration);
    return prompt;
  }

  function saveShortcut(value) {
    shortcut = value;
    GM_setValue(STORAGE_KEY, value);
    registerMenu();
    showPrompt(`侧边栏快捷键已设为 ${formatShortcut(value)}`, 2000);
  }

  function resetShortcut() {
    shortcut = DEFAULT_SHORTCUT;
    GM_deleteValue(STORAGE_KEY);
    registerMenu();
    showPrompt(`侧边栏快捷键已恢复为 ${formatShortcut(DEFAULT_SHORTCUT)}`, 2000);
  }

  function startRecording() {
    recording = showPrompt('请按下新的侧边栏快捷键（需包含 ⌘/Ctrl/Alt 等修饰键，Esc 取消）');
  }

  function finishRecording() {
    recording?.remove();
    recording = null;
  }

  function onRecordKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (MODIFIER_CODES.has(event.code)) return;

    if (event.code === 'Escape') {
      finishRecording();
      return;
    }

    const isFunctionKey = /^F\d{1,2}$/.test(event.code);
    if (!isFunctionKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      recording.textContent = '快捷键需包含 ⌘/Ctrl/Alt 等修饰键，请重新按下（Esc 取消）';
      return;
    }

    finishRecording();
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
