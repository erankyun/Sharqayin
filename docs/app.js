/* Sharqayin specimen interactions: weight, instances, repertoire and playground. */

(() => {
  'use strict';

  const font = window.VF_SITE_FONT;
  if (!font) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.documentElement;
  const weightAxis = font.axes.find((axis) => axis.tag === 'wght') || font.axes[0];
  const minWeight = weightAxis.min;
  const maxWeight = weightAxis.max;
  const initialWeight = Math.max(minWeight, Math.min(maxWeight, weightAxis.default));
  const groupInfo = [
    { key: 'all', label: 'All symbols' },
    { key: 'uppercase', label: 'Uppercase' },
    { key: 'lowercase', label: 'Lowercase' },
    { key: 'figures', label: 'Digits' },
    { key: 'punctuation', label: 'Punctuation' },
    { key: 'space', label: 'Space' },
  ];
  const groupOrder = { uppercase: 0, lowercase: 1, figures: 2, punctuation: 3, space: 4 };
  const fullSample = $('#playground-text').innerHTML;
  const state = {
    weight: initialWeight,
    group: 'all',
    motionFrame: 0,
    motionKind: null,
    toastTimer: 0,
    visibleCharacters: [],
  };

  const els = {
    theme: $('#theme-toggle'),
    heroWeight: $('#hero-weight'),
    heroWeightOutput: $('#hero-weight-output'),
    motionButton: $('#weight-motion'),
    motionLabel: $('#motion-label'),
    instanceGrid: $('#instance-grid'),
    symbolTabs: $('#symbol-tabs'),
    symbolGrid: $('#symbol-grid'),
    symbolTotal: $('#symbol-total'),
    copySymbolSet: $('#copy-symbol-set'),
    playground: $('#playground-text'),
    playWeight: $('#play-weight'),
    playWeightOutput: $('#play-weight-output'),
    playSize: $('#play-size'),
    playSizeOutput: $('#play-size-output'),
    playLeading: $('#play-leading'),
    playLeadingOutput: $('#play-leading-output'),
    playTracking: $('#play-tracking'),
    playTrackingOutput: $('#play-tracking-output'),
    resetText: $('#reset-text'),
    toast: $('#toast'),
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, digits = 0) {
    const rounded = Number(Number(value).toFixed(digits));
    return String(rounded);
  }

  function fontSettings(weight) {
    return font.axes.map((axis) => {
      const value = axis.tag === weightAxis.tag ? weight : axis.default;
      return `"${String(axis.tag).replace(/[^A-Za-z0-9]/g, '')}" ${value}`;
    }).join(', ');
  }

  function applyFixedWeights() {
    $$('.vf-fixed[data-weight]').forEach((element) => {
      element.style.fontVariationSettings = fontSettings(Number(element.dataset.weight));
    });
  }

  function paintRange(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', `${clamp(progress, 0, 100)}%`);
  }

  function updateWeight(value) {
    state.weight = clamp(Number(value), minWeight, maxWeight);
    const visibleValue = String(Math.round(state.weight));
    root.style.setProperty('--vf', fontSettings(state.weight));
    els.heroWeight.value = visibleValue;
    els.playWeight.value = visibleValue;
    els.heroWeightOutput.value = visibleValue;
    els.heroWeightOutput.textContent = visibleValue;
    els.playWeightOutput.value = visibleValue;
    els.playWeightOutput.textContent = visibleValue;
    paintRange(els.heroWeight);
    paintRange(els.playWeight);

    $$('button.instance-card[data-weight]').forEach((card) => {
      const active = Math.abs(Number(card.dataset.weight) - state.weight) < 0.01;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function makeInstanceCards() {
    els.instanceGrid.textContent = '';
    font.instances.forEach((instance, index) => {
      const weight = Number(instance.coords[weightAxis.tag] ?? initialWeight);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'instance-card';
      card.dataset.weight = String(weight);
      card.setAttribute('aria-pressed', 'false');

      const serial = document.createElement('span');
      serial.className = 'instance-index';
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const coordinate = document.createElement('span');
      coordinate.textContent = `${weightAxis.tag} ${Math.round(weight)}`;
      serial.append(number, coordinate);

      const glyph = document.createElement('span');
      glyph.className = 'instance-glyph vf-fixed';
      glyph.lang = 'hy';
      glyph.textContent = 'Շարք';
      glyph.style.fontVariationSettings = fontSettings(weight);

      const foot = document.createElement('span');
      foot.className = 'instance-foot';
      const name = document.createElement('span');
      name.className = 'instance-name';
      name.textContent = instance.name;
      foot.append(name);

      card.append(serial, glyph, foot);
      card.addEventListener('click', () => animateWeight(weight));
      els.instanceGrid.append(card);
    });
  }

  function readableName(character) {
    return String(character.name || '')
      .replace(/^ARMENIAN /, '')
      .replace(/^CAPITAL LETTER /, 'CAPITAL ')
      .replace(/^SMALL LETTER /, 'SMALL ');
  }

  function makeSymbolTabs() {
    els.symbolTabs.textContent = '';
    groupInfo.forEach((group) => {
      const count = group.key === 'all'
        ? font.characters.length
        : font.characters.filter((character) => character.group === group.key).length;
      if (!count) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'symbol-tab';
      button.dataset.group = group.key;
      button.setAttribute('aria-pressed', group.key === state.group ? 'true' : 'false');
      const label = document.createElement('span');
      label.textContent = group.label;
      const total = document.createElement('span');
      total.className = 'symbol-tab-count';
      total.textContent = String(count);
      button.append(label, total);
      button.addEventListener('click', () => {
        state.group = group.key;
        renderSymbols();
      });
      els.symbolTabs.append(button);
    });
  }

  function copyText(text) {
    const fallbackCopy = () => {
      const temporary = document.createElement('textarea');
      temporary.value = text;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      temporary.remove();
      return copied;
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => showToast(text.length > 1 ? 'Character set copied.' : `Copied ${text || 'space'}.`),
        () => showToast(fallbackCopy() ? 'Copied to clipboard.' : 'Clipboard access is unavailable here.')
      );
      return;
    }
    showToast(fallbackCopy() ? (text.length > 1 ? 'Character set copied.' : `Copied ${text || 'space'}.`) : 'Clipboard access is unavailable here.');
  }

  function renderSymbols() {
    const characters = font.characters
      .filter((character) => state.group === 'all' || character.group === state.group)
      .sort((a, b) => (groupOrder[a.group] - groupOrder[b.group]) || a.codepoint - b.codepoint);

    state.visibleCharacters = characters;
    els.symbolGrid.textContent = '';
    els.symbolTotal.textContent = `${characters.length} ${characters.length === 1 ? 'symbol' : 'symbols'}`;
    $$('.symbol-tab', els.symbolTabs).forEach((tab) => {
      tab.setAttribute('aria-pressed', tab.dataset.group === state.group ? 'true' : 'false');
    });

    characters.forEach((character) => {
      const codepoint = Number(character.codepoint);
      const value = String.fromCodePoint(codepoint);
      const isSpace = codepoint === 0x20;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'symbol-card';
      button.title = `Copy ${character.name}, U+${codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
      const visibleGlyph = isSpace ? '␠' : value;
      const hexLabel = `U+${codepoint.toString(16).toUpperCase().padStart(4, '0')}`;
      button.setAttribute('aria-description', `Copy ${visibleGlyph}`);

      const glyph = document.createElement('span');
      glyph.className = `symbol-glyph vf-live${isSpace ? ' is-space' : ''}`;
      glyph.lang = isSpace ? 'en' : 'hy';
      glyph.textContent = isSpace ? '' : value;

      const detail = document.createElement('span');
      detail.className = 'symbol-details';
      const name = document.createElement('span');
      name.className = 'symbol-name';
      name.textContent = isSpace ? 'SPACE' : readableName(character);
      const hex = document.createElement('span');
      hex.className = 'symbol-code';
      hex.textContent = hexLabel;
      detail.append(name, hex);

      button.append(glyph, detail);
      button.addEventListener('click', () => copyText(value));
      els.symbolGrid.append(button);
    });
  }

  function paintAllRanges() {
    $$('.weight-range').forEach(paintRange);
  }

  function stopMotion() {
    if (state.motionFrame) cancelAnimationFrame(state.motionFrame);
    state.motionFrame = 0;
    state.motionKind = null;
    els.motionButton.setAttribute('aria-pressed', 'false');
    els.motionLabel.textContent = 'Animate';
    $('.motion-icon', els.motionButton).textContent = '▶';
  }

  function animateWeight(target) {
    stopMotion();
    state.motionKind = 'tween';
    const from = state.weight;
    const to = clamp(Number(target), minWeight, maxWeight);
    const started = performance.now();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;

    const frame = (now) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      updateWeight(from + (to - from) * eased);
      if (progress < 1) {
        state.motionFrame = requestAnimationFrame(frame);
      } else {
        state.motionFrame = 0;
        state.motionKind = null;
      }
    };

    state.motionFrame = requestAnimationFrame(frame);
  }

  function toggleSweep() {
    if (state.motionKind === 'sweep') {
      stopMotion();
      return;
    }

    if (state.motionFrame) cancelAnimationFrame(state.motionFrame);
    state.motionFrame = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateWeight(state.weight >= maxWeight ? minWeight : maxWeight);
      return;
    }

    state.motionKind = 'sweep';
    els.motionButton.setAttribute('aria-pressed', 'true');
    els.motionLabel.textContent = 'Stop';
    $('.motion-icon', els.motionButton).textContent = 'Ⅱ';
    const range = maxWeight - minWeight;
    const startRatio = clamp((state.weight - minWeight) / range, 0, 1);
    const phase = Math.acos(1 - 2 * startRatio);
    const started = performance.now();
    const angularSpeed = (2 * Math.PI) / 6000;

    const frame = (now) => {
      if (state.motionKind !== 'sweep') return;
      const position = phase + (now - started) * angularSpeed;
      updateWeight(minWeight + range * (0.5 - 0.5 * Math.cos(position)));
      state.motionFrame = requestAnimationFrame(frame);
    };
    state.motionFrame = requestAnimationFrame(frame);
  }

  function updatePlayground() {
    const size = Number(els.playSize.value);
    const leading = Number(els.playLeading.value);
    const tracking = Number(els.playTracking.value);
    els.playground.style.setProperty('--play-size', `${size}px`);
    els.playground.style.setProperty('--play-leading', leading.toFixed(2));
    els.playground.style.setProperty('--play-tracking', `${tracking.toFixed(2)}em`);
    els.playSizeOutput.textContent = `${size} px`;
    els.playLeadingOutput.textContent = leading.toFixed(2);
    els.playTrackingOutput.textContent = `${tracking > 0 ? '+' : ''}${tracking.toFixed(2)} em`;
    paintRange(els.playSize);
    paintRange(els.playLeading);
    paintRange(els.playTracking);
  }

  function syncThemeButton() {
    const dark = root.dataset.theme === 'dark';
    els.theme.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    els.theme.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2400);
  }

  function setupEditableText() {
    els.playground.addEventListener('paste', (event) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      event.preventDefault();
      document.execCommand('insertText', false, clipboard.getData('text/plain'));
    });
    els.playground.addEventListener('input', () => {
      els.playground.classList.toggle('is-empty', !els.playground.textContent.trim());
    });
  }

  function init() {
    els.heroWeight.min = String(minWeight);
    els.heroWeight.max = String(maxWeight);
    els.heroWeight.value = String(initialWeight);
    els.playWeight.min = String(minWeight);
    els.playWeight.max = String(maxWeight);
    els.playWeight.value = String(initialWeight);

    makeInstanceCards();
    makeSymbolTabs();
    renderSymbols();
    applyFixedWeights();
    updateWeight(initialWeight);
    updatePlayground();
    paintAllRanges();
    syncThemeButton();
    setupEditableText();

    els.heroWeight.addEventListener('input', () => {
      stopMotion();
      updateWeight(els.heroWeight.value);
    });
    els.playWeight.addEventListener('input', () => {
      stopMotion();
      updateWeight(els.playWeight.value);
    });
    els.motionButton.addEventListener('click', toggleSweep);

    [els.playSize, els.playLeading, els.playTracking].forEach((input) => {
      input.addEventListener('input', updatePlayground);
    });

    els.resetText.addEventListener('click', () => {
      els.playground.innerHTML = fullSample;
      els.playground.classList.remove('is-empty');
      showToast('Sample text restored.');
    });

    els.copySymbolSet.addEventListener('click', () => {
      const text = state.visibleCharacters.map((character) => String.fromCodePoint(character.codepoint)).join('');
      copyText(text);
    });

    els.theme.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('sharqayin-theme', root.dataset.theme);
      } catch (error) {
        /* Local file and private browsing modes may disable storage. */
      }
      syncThemeButton();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.motionKind === 'sweep') stopMotion();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.motionKind === 'sweep') stopMotion();
    });
  }

  init();
})();
