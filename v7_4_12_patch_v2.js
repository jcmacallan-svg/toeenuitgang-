/* v7.4.12 PATCH v2
   - Safe DOM-only improvements (no dependency on app.js internals)
   - Fills ID surname field (#idSurname) when ID card is shown
*/

(function(){
  'use strict';

  function $(sel){ return document.querySelector(sel); }

  function splitName(full){
    const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first:'', last:'' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts.slice(0,-1).join(' '), last: parts[parts.length-1] };
  }

  function applySurname(){
    const wrap = $('#idCardWrap');
    if (!wrap || wrap.hidden) return;

    const elName = $('#idName');
    const elSurname = $('#idSurname');
    if (!elName || !elSurname) return;

    // If #idName already contains a full name, split it.
    const current = elName.textContent || '';
    const { first, last } = splitName(current);

    // If surname is empty, fill it.
    if (!elSurname.textContent || !elSurname.textContent.trim()){
      elSurname.textContent = last;
    }

    // If first name is empty but we have it, replace #idName to be "Name" only.
    // (This matches the UI labels in your HTML: Name + Surname)
    if (first && last){
      elName.textContent = first;
    }
  }

  function boot(){
    // Run once now
    applySurname();

    // Observe ID card visibility changes
    const wrap = $('#idCardWrap');
    if (!wrap) return;

    const obs = new MutationObserver(() => applySurname());
    obs.observe(wrap, { attributes:true, attributeFilter:['hidden'], childList:true, subtree:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.info('Applying v7.4.12 patch v2 (alignment CSS + ID surname helper)');
})();
