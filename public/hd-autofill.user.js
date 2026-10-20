// ==UserScript==
// @name         GWA → Home Depot Autofill (beta)
// @namespace    https://portal.ghsbarrie.ca/
// @version      0.1.0
// @description  Fills the Home Depot SAP form from the GWA portal "Copy all" text. Best-effort: plain text fields fill by label; dropdowns / lookup fields may still need to be done by hand.
// @match        https://samex.homedepot.com/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://portal.ghsbarrie.ca/hd-autofill.user.js
// @updateURL    https://portal.ghsbarrie.ca/hd-autofill.user.js
// ==/UserScript==

/*
 * How it works
 * ------------
 * The Home Depot form is SAP CRM WebClient, rendered inside several nested frames
 * with computer-generated field IDs that change every render. So we DON'T target
 * IDs — we match each value to a field by the LABEL next to it, the same labels
 * the GWA "Copy to Home Depot" sheet uses.
 *
 * Flow: in the portal, click "Copy all" → come to the HD form → paste into this
 * panel → "Fill form". It fills the plain text boxes it can find; anything it
 * can't (dropdowns, lookup/search fields) you finish by hand, and the portal's
 * per-field Copy buttons are always there as the backup.
 *
 * This runs in every samex.homedepot.com frame (Tampermonkey injects into all of
 * them). The visible panel is built only in the TOP samex frame; filling then
 * recurses into the nested same-origin frames from there.
 */
(function () {
  'use strict';

  // Only the top samex frame builds the UI. If we can't read window.parent, the
  // parent is the cross-origin Salesforce wrapper → we're the top samex frame.
  let isTopSamex = false;
  try {
    void window.parent.location.href;
    isTopSamex = window.parent === window.self;
  } catch (e) {
    isTopSamex = true;
  }
  if (!isTopSamex) return;
  if (window.__gwaAutofillLoaded) return;
  window.__gwaAutofillLoaded = true;

  // --- matching helpers ----------------------------------------------------
  const norm = (s) =>
    (s || '')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s:*]+$/g, '')
      .toLowerCase();

  function parsePairs(text) {
    return text
      .split(/\r?\n/)
      .map((line) => {
        const i = line.indexOf(':');
        if (i < 0) return null;
        const label = line.slice(0, i).trim();
        const value = line.slice(i + 1).trim();
        if (!label || !value) return null;
        return { label, value, key: norm(label) };
      })
      .filter(Boolean);
  }

  function ownLabel(el) {
    const al = el.getAttribute('aria-label') || el.title || el.placeholder;
    if (al) return al;
    if (el.labels && el.labels[0]) return el.labels[0].textContent;
    return '';
  }

  // The label text sitting beside a field in a table layout (SAP renders the
  // label in the cell(s) before the input).
  function nearbyLabel(el) {
    const td = el.closest('td, th');
    if (!td) return '';
    let prev = td.previousElementSibling;
    let hop = 0;
    while (prev && hop < 3) {
      const t = prev.textContent && prev.textContent.trim();
      if (t && !prev.querySelector('input, select, textarea')) return t;
      prev = prev.previousElementSibling;
      hop += 1;
    }
    return '';
  }

  function settable(doc) {
    return [...doc.querySelectorAll('input, select, textarea')].filter((el) => {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'button', 'submit', 'image', 'checkbox', 'radio', 'file', 'password'].includes(type)) return false;
      if (el.disabled || el.readOnly) return false;
      if (el.tagName !== 'SELECT' && !el.offsetParent) return false; // must be visible
      return true;
    });
  }

  function setValue(el, value) {
    if (el.tagName === 'SELECT') {
      const want = value.toLowerCase();
      const opt = [...el.options].find(
        (o) => o.text.trim().toLowerCase() === want || o.value.toLowerCase() === want || o.text.trim().toLowerCase().includes(want),
      );
      if (!opt) return false;
      el.value = opt.value;
    } else {
      // Use the native value setter so frameworks that track the setter still see
      // the change, then fall back to a plain assignment.
      try {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      } catch (e) {
        el.value = value;
      }
    }
    ['input', 'change', 'keyup', 'blur'].forEach((t) => {
      try {
        el.dispatchEvent(new Event(t, { bubbles: true }));
      } catch (e) {
        /* ignore */
      }
    });
    return true;
  }

  function fillDoc(doc, pairs, filled) {
    let n = 0;
    const indexed = settable(doc).map((el) => ({
      el,
      keys: [norm(ownLabel(el)), norm(nearbyLabel(el))].filter(Boolean),
    }));
    for (const p of pairs) {
      // Prefer exact label matches (can be more than one, e.g. two "City" boxes);
      // otherwise fall back to the first partial match.
      let targets = indexed.filter((x) => !filled.has(x.el) && x.keys.includes(p.key));
      if (targets.length === 0) {
        const c = indexed.find(
          (x) => !filled.has(x.el) && x.keys.some((k) => k && (k.includes(p.key) || p.key.includes(k))),
        );
        if (c) targets = [c];
      }
      for (const t of targets) {
        if (setValue(t.el, p.value)) {
          filled.add(t.el);
          n += 1;
        }
      }
    }
    return n;
  }

  function fillAll(doc, pairs, filled) {
    let n = 0;
    try {
      n += fillDoc(doc, pairs, filled);
    } catch (e) {
      /* ignore */
    }
    for (const fr of doc.querySelectorAll('iframe, frame')) {
      try {
        if (fr.contentDocument) n += fillAll(fr.contentDocument, pairs, filled);
      } catch (e) {
        /* cross-origin frame — skip */
      }
    }
    return n;
  }

  // --- UI ------------------------------------------------------------------
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;z-index:2147483647;right:12px;bottom:12px;width:280px;font:13px/1.4 Arial,sans-serif;color:#111;background:#fff;border:2px solid #f96302;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);overflow:hidden';
  panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:6px;background:#f96302;color:#fff;padding:7px 10px;font-weight:bold">' +
    '<span style="flex:1">GWA → HD autofill</span>' +
    '<span id="gwa-min" style="cursor:pointer;padding:0 6px">–</span></div>' +
    '<div id="gwa-body" style="padding:10px">' +
    '<div style="color:#555;margin-bottom:6px">Click <b>Copy all</b> in the GWA portal, then paste below and press Fill.</div>' +
    '<textarea id="gwa-text" placeholder="Paste the Copy-all text here…" style="width:100%;height:84px;box-sizing:border-box;border:1px solid #ccc;border-radius:6px;padding:6px;resize:vertical"></textarea>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
    '<button id="gwa-fill" style="background:#f96302;color:#fff;border:0;border-radius:6px;padding:7px 12px;font-weight:bold;cursor:pointer">Fill form</button>' +
    '<span id="gwa-status" style="color:#555"></span></div></div>';

  function mount() {
    if (!document.body) return setTimeout(mount, 300);
    document.body.appendChild(panel);
    const body = panel.querySelector('#gwa-body');
    const ta = panel.querySelector('#gwa-text');
    const status = panel.querySelector('#gwa-status');
    panel.querySelector('#gwa-min').onclick = () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    };
    panel.querySelector('#gwa-fill').onclick = async () => {
      let text = ta.value.trim();
      if (!text) {
        try {
          const clip = await navigator.clipboard.readText();
          if (clip && clip.includes(':')) {
            text = clip.trim();
            ta.value = text;
          }
        } catch (e) {
          /* clipboard blocked in frame — rely on paste */
        }
      }
      const pairs = parsePairs(text);
      if (pairs.length === 0) {
        status.textContent = 'Paste the Copy-all text first.';
        status.style.color = '#c00';
        return;
      }
      const n = fillAll(document, pairs, new WeakSet());
      status.style.color = n > 0 ? '#107a10' : '#c00';
      status.textContent = n > 0 ? `Filled ${n} field${n === 1 ? '' : 's'}.` : 'No matching fields found on this page.';
    };
  }
  mount();
})();
