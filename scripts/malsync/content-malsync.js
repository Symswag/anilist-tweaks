(function() {
    'use strict';

    // =========================================================================
    // 1. MODULE MALSYNC AUTO (Exécuté sur <all_urls>)
    // =========================================================================
    let msConfig = { start: true, finish: true, rewatch_start: false, rewatch_finish: false, delay: 3, score: 10 };
    let currentUrl = null;
    let actedThisEpisode = { start: false, finish: false, rewatch_start: false, rewatch_finish: false };
    let pendingTimeouts = {};

    function updateMsConfig() {
        chrome.storage.sync.get(msConfig, (items) => {
            Object.keys(msConfig).forEach(key => {
                if (items[key] !== undefined) msConfig[key] = items[key];
            });
        });
    }
    updateMsConfig();
    chrome.storage.onChanged.addListener(() => updateMsConfig());

    function triggerClick(actionKey, flashClass, searchText, isFinish = false) {
        if (pendingTimeouts[actionKey]) return;
        pendingTimeouts[actionKey] = setTimeout(() => {
            const flashes = document.querySelectorAll('.flash');
            const currentFlash = Array.from(flashes).find(f => f.classList.contains(flashClass) && (f.textContent || '').includes(searchText));

            if (currentFlash) {
                const currentYesBtn = currentFlash.querySelector('button.Yes');
                if (currentYesBtn) {
                    if (isFinish) {
                        const selectEl = currentFlash.querySelector('select#finish_score');
                        if (selectEl) {
                            let targetScore = parseInt(msConfig.score, 10);
                            if (targetScore <= 10) targetScore = targetScore * 10;
                            const optionExists = Array.from(selectEl.options).some(opt => parseInt(opt.value) === targetScore);
                            if (optionExists) {
                                selectEl.value = targetScore;
                                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                    currentYesBtn.click();
                    actedThisEpisode[actionKey] = true;
                }
            }
            delete pendingTimeouts[actionKey];
        }, msConfig.delay * 1000);
    }

    function checkMalSyncButtons() {
        const flashes = document.querySelectorAll('.flash');
        if (flashes.length === 0) return;

        flashes.forEach(flash => {
            const textContent = flash.textContent || '';
            if (msConfig.start && !actedThisEpisode.start && flash.classList.contains('type-add') && textContent.includes('Commencer le visionnage')) {
                triggerClick('start', 'type-add', 'Commencer le visionnage', false);
            }
            else if (msConfig.finish && !actedThisEpisode.finish && flash.classList.contains('type-complete') && textContent.includes('Marquer comme terminé')) {
                triggerClick('finish', 'type-complete', 'Marquer comme terminé', true);
            }
            else if (msConfig.rewatch_start && !actedThisEpisode.rewatch_start && flash.classList.contains('type-add') && textContent.includes('Revoir cet anime')) {
                triggerClick('rewatch_start', 'type-add', 'Revoir cet anime', false);
            }
            else if (msConfig.rewatch_finish && !actedThisEpisode.rewatch_finish && flash.classList.contains('type-complete') && textContent.includes('Terminer le re-visionnage')) {
                triggerClick('rewatch_finish', 'type-complete', 'Terminer le re-visionnage', true);
            }
        });
    }

    setInterval(() => {
        const url = window.location.href;
        if (url !== currentUrl) {
            currentUrl = url;
            actedThisEpisode = { start: false, finish: false, rewatch_start: false, rewatch_finish: false };
            Object.keys(pendingTimeouts).forEach(key => clearTimeout(pendingTimeouts[key]));
            pendingTimeouts = {};
        }
        checkMalSyncButtons();
    }, 1000);
})();