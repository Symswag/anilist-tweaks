(function() {
    'use strict';

    /* ==========================================================================
       MODULE QUICK EDIT ANILIST ENTRY (Exécuté sur anilist.co via manifest)
       ========================================================================== */

    chrome.storage.sync.get({
        supabaseUrl: '',
        supabaseKey: '',
        tableName: 'anime_history',
        anilistUsername: '',
        spinnerDuration: 3,
        removeList: 'Close At Hand',
        anilistToken: ''
    }, function(config) {

        const ANILIST_TOKEN = config.anilistToken;

        if (!ANILIST_TOKEN) {
            console.warn("⚡ Quick Editor : Aucun token AniList configuré.");
            return;
        }

        let isFetching = false;
        let lastInjectedMediaId = null;

        async function updateMediaEntry(mediaId, payload) {
            const mutation = `
                mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int, $repeat: Int, $customLists: [String]) {
                    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw, repeat: $repeat, customLists: $customLists) {
                        id
                        status
                        progress
                        score(format: POINT_100)
                        repeat
                        customLists
                    }
                }
            `;

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${ANILIST_TOKEN}`
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: { mediaId: parseInt(mediaId, 10), ...payload }
                })
            });

            return await response.json();
        }

        function progressInputHandler(progInput, totalEpisodes, editorBox) {
            let val = parseInt(progInput.value, 10) || 0;
            if (val <= 0) {
                editorBox.querySelector('#qe-prog-minus').disabled = true;
            } else {
                editorBox.querySelector('#qe-prog-minus').disabled = false;
            }
            if (val >= totalEpisodes) {
                editorBox.querySelector('#qe-prog-plus').disabled = true;
            } else {
                editorBox.querySelector('#qe-prog-plus').disabled = false;
            }
        }

        function updateAniListStatusUI(statusKey) {
            const statusTextMap = {
                'CURRENT': 'Watching',
                'COMPLETED': 'Completed',
                'REPEATING': 'Repeating',
                'PAUSED': 'Paused',
                'DROPPED': 'Dropped',
                'PLANNING': 'Planning'
            };

            const newStatusText = statusTextMap[statusKey] || 'Add to List';

            // Ciblage précis du conteneur .actions .list .add d'AniList
            const statusAddBtn = document.querySelector('.actions .list .add');
            if (statusAddBtn) {
                statusAddBtn.textContent = newStatusText;
            }
        }

        let entryDataCache = null;
        let isExpanded = false; // Fermé par défaut

        async function injectQuickEditor() {
            if (!window.location.pathname.includes('/anime/')) {
                const existingEditor = document.getElementById('custom-quick-editor');
                if (existingEditor) existingEditor.remove();
                lastInjectedMediaId = null;
                return;
            }

            const match = window.location.pathname.match(/\/anime\/(\d+)/);
            if (!match) return;
            const mediaId = parseInt(match[1], 10);

            if (document.getElementById('custom-quick-editor') && lastInjectedMediaId === mediaId) {
                return;
            }

            const sidebar = document.querySelector('.page-content .sidebar');
            if (!sidebar || isFetching) return;

            isFetching = true;

            const style = document.createElement('style');
            style.textContent = `
                #custom-quick-editor input[type="number"]::-webkit-outer-spin-button,
                #custom-quick-editor input[type="number"]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                #custom-quick-editor input[type="number"] {
                    -moz-appearance: textfield;
                    appearance: textfield;
                }

                #qe-prog-minus:disabled, #qe-prog-plus:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);

            // Récupération de sectionOrder pour garantir l'ordre utilisateur AniList
            const query = `
                query ($mediaId: Int) {
                    Viewer {
                        id
                        mediaListOptions {
                            animeList {
                                customLists
                                sectionOrder
                            }
                        }
                    }
                    Media(id: $mediaId) {
                        id
                        episodes
                        mediaListEntry {
                            id
                            status
                            progress
                            score(format: POINT_100)
                            customLists
                        }
                    }
                }
            `;

            try {
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${ANILIST_TOKEN}`
                    },
                    body: JSON.stringify({ query, variables: { mediaId } })
                });

                const json = await res.json();
                
                const existingEditor = document.getElementById('custom-quick-editor');
                if (existingEditor) existingEditor.remove();

                const viewer = json?.data?.Viewer;
                const mediaData = json?.data?.Media;
                const entry = mediaData?.mediaListEntry;
                entryDataCache = entry; // Mise en cache des données de l'entrée pour une utilisation ultérieure

                const rawCustomLists = viewer?.mediaListOptions?.animeList?.customLists || [];
                const sectionOrder = viewer?.mediaListOptions?.animeList?.sectionOrder || [];

                // On trie les customLists selon l'ordre défini dans sectionOrder
                let userCustomListsNames = [];
                if (sectionOrder.length > 0) {
                    userCustomListsNames = sectionOrder.filter(listName => rawCustomLists.includes(listName));
                    // Ajout des listes qui ne seraient éventuellement pas dans sectionOrder
                    rawCustomLists.forEach(listName => {
                        if (!userCustomListsNames.includes(listName)) {
                            userCustomListsNames.push(listName);
                        }
                    });
                } else {
                    userCustomListsNames = rawCustomLists;
                }

                const totalEpisodes = mediaData?.episodes || '?';

                const statusVal = entry?.status || 'PLANNING';
                const progressVal = entry?.progress ?? 0;
                
                const score100 = entry?.score ?? 0;
                const score10Val = score100 > 0 ? Math.round(score100 / 10) : 0;

                const entryCustomLists = entry?.customLists || {};

                const editorBox = document.createElement('div');
                editorBox.id = 'custom-quick-editor';
                editorBox.style.cssText = `
                    background: rgb(21, 31, 46);
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    font-family: Overpass, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
                    border-top: 3px solid #3db4f2;
                `;

                let customListsHTML = '';
                if (userCustomListsNames.length > 0) {
                    customListsHTML = `
                        <div style="margin-top: 12px; margin-bottom: 12px; border-top: 1px solid #2e3c4e; padding-top: 10px;">
                            <label style="display: block; font-size: 1.1rem; color: #9fadbd; margin-bottom: 6px; font-weight: 600;">Listes Personnalisées</label>
                            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
                                ${userCustomListsNames.map(listName => {
                                    const isChecked = entryCustomLists[listName] === true;
                                    return `
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 1.2rem; color: #edf1f5; cursor: pointer;">
                                            <input type="checkbox" class="qe-custom-list-cb" data-list-name="${listName}" ${isChecked ? 'checked' : ''} style="accent-color: #3db4f2; cursor: pointer; width: 14px; height: 14px;">
                                            ${listName}
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                editorBox.innerHTML = `
                    <!-- Header Toujours Visible (Petit de base) -->
                    <div id="qe-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.3rem; font-weight: 700; color: #edf1f5;">⚡ Édition Rapide</span>
                        </div>
                        <span id="quick-edit-status-msg" style="font-size: 1.1rem; color: #3ecf8e; opacity: 0; transition: opacity 0.3s ease;">Enregistré !</span>
                        <span id="qe-toggle-arrow" style="font-size: 0.9rem; color: #9fadbd; transition: transform 0.2s ease;">▼</span>
                    </div>

                    <!-- Wrapper avec Grid pour l'animation fluide de la hauteur -->
                    <div id="qe-wrapper" style="display: grid; grid-template-rows: ${isExpanded ? '1fr' : '0fr'}; transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
                        <div id="qe-content" style="overflow: hidden;">
                            <div style="padding-top: 12px;"> <!-- Padding interne pour éviter les à-coups -->
                                
                            <!-- Statut -->
                                <div style="margin-bottom: 10px;">
                                    <label style="display: block; font-size: 1.1rem; color: #9fadbd; margin-bottom: 4px; font-weight: 600;">Statut</label>
                                    <select id="qe-status" style="width: 98%; background: #11161d; color: #edf1f5; border: 1px solid #2e3c4e; border-radius: 4px; padding: 6px 10px; font-size: 1.2rem; outline: none; cursor: pointer;">
                                        <option value="CURRENT" ${statusVal === 'CURRENT' ? 'selected' : ''}>En cours (Watching)</option>
                                        <option value="COMPLETED" ${statusVal === 'COMPLETED' ? 'selected' : ''}>Terminé (Completed)</option>
                                        <option value="REPEATING" ${statusVal === 'REPEATING' ? 'selected' : ''}>En rewatch (Repeating)</option>
                                        <option value="PAUSED" ${statusVal === 'PAUSED' ? 'selected' : ''}>En pause (Paused)</option>
                                        <option value="DROPPED" ${statusVal === 'DROPPED' ? 'selected' : ''}>Abandonné (Dropped)</option>
                                        <option value="PLANNING" ${statusVal === 'PLANNING' ? 'selected' : ''}>À voir (Planning)</option>
                                    </select>
                                </div>

                                <!-- Épisodes & Note -->
                                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                    <!-- Progression -->
                                    <div style="flex: 1;">
                                        <label style="display: block; font-size: 1.1rem; color: #9fadbd; margin-bottom: 4px; font-weight: 600;">Épisodes (/ ${totalEpisodes})</label>
                                        <div style="display: flex; align-items: center;">
                                            <button id="qe-prog-minus" style="background: #2e3c4e; color: #fff; border: none; border-radius: 4px 0 0 4px; padding: 6px 10px; cursor: pointer; font-weight: 700;">-</button>
                                            <input id="qe-progress" type="number" min="0" value="${progressVal}" style="width: 100%; text-align: center; background: #11161d; color: #edf1f5; border-top: 1px solid #2e3c4e; border-bottom: 1px solid #2e3c4e; border-left: none; border-right: none; padding: 6px 0; font-size: 1.2rem; outline: none;">
                                            <button id="qe-prog-plus" style="background: #2e3c4e; color: #fff; border: none; border-radius: 0 4px 4px 0; padding: 6px 10px; cursor: pointer; font-weight: 700;">+</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Note -->
                                <div style="flex: 1.2;">
                                    <label style="display: block; font-size: 1.1rem; color: #9fadbd; margin-bottom: 4px; font-weight: 600;">Note</label>
                                    <select id="qe-score" style="width: 98%; background: #11161d; color: #edf1f5; border: 1px solid #2e3c4e; border-radius: 4px; padding: 6px 6px; font-size: 1.2rem; outline: none; cursor: pointer;">
                                        <option value="0" ${score10Val === 0 ? 'selected' : ''}>Non noté</option>
                                        <option value="10" ${score10Val === 10 ? 'selected' : ''}>(10) Chef-d'œuvre</option>
                                        <option value="9" ${score10Val === 9 ? 'selected' : ''}>(9) Superbe</option>
                                        <option value="8" ${score10Val === 8 ? 'selected' : ''}>(8) Très bon</option>
                                        <option value="7" ${score10Val === 7 ? 'selected' : ''}>(7) Bon</option>
                                        <option value="6" ${score10Val === 6 ? 'selected' : ''}>(6) Bien</option>
                                        <option value="5" ${score10Val === 5 ? 'selected' : ''}>(5) Moyen</option>
                                        <option value="4" ${score10Val === 4 ? 'selected' : ''}>(4) Mauvais</option>
                                        <option value="3" ${score10Val === 3 ? 'selected' : ''}>(3) Très mauvais</option>
                                        <option value="2" ${score10Val === 2 ? 'selected' : ''}>(2) Horrible</option>
                                        <option value="1" ${score10Val === 1 ? 'selected' : ''}>(1) Atroce</option>
                                    </select>
                                </div>

                                <!-- Listes Personnalisées -->
                                ${customListsHTML}

                                <!-- Rewatch & Sauvegarde -->
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                                    <button id="qe-save-btn" style="width: 100%; background: #3db4f2; color: #ffffff; border: none; border-radius: 4px; padding: 8px 16px; font-size: 1.2rem; font-weight: 700; cursor: pointer; transition: background 0.2s ease;">
                                        Sauvegarder
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                sidebar.prepend(editorBox);
                lastInjectedMediaId = mediaId;

                editorBox.querySelector('#qe-status').addEventListener('change', () => {
                    const selectedStatus = editorBox.querySelector('#qe-status').value;
                    if (selectedStatus === 'REPEATING' && entryDataCache?.status === 'COMPLETED') {
                        // Si l'utilisateur passe de "Completed" à "Repeating", on remet le progress à 0
                        progInput.value = 0;
                        progressInputHandler(progInput, totalEpisodes, editorBox);
                    }
                    else if (selectedStatus === 'COMPLETED') {
                        // Si l'utilisateur passe à "Completed", on met le progress à totalEpisodes
                        progInput.value = totalEpisodes !== '?' ? totalEpisodes : progInput.value;
                        progressInputHandler(progInput, totalEpisodes, editorBox);
                    }
                });

                const progInput = editorBox.querySelector('#qe-progress');
                const statusMsg = editorBox.querySelector('#quick-edit-status-msg');

                editorBox.querySelector('#qe-prog-minus').addEventListener('click', () => {
                    const val = parseInt(progInput.value, 10) || 0;
                    if (val > 0) progInput.value = val - 1;

                    progressInputHandler(progInput, totalEpisodes, editorBox);
                });

                editorBox.querySelector('#qe-prog-plus').addEventListener('click', () => {
                    const val = parseInt(progInput.value, 10) || 0;
                    if (val < totalEpisodes) progInput.value = val + 1;
                    else if (totalEpisodes === '?') progInput.value = val + 1; // Si le total est inconnu, on permet d'incrémenter sans limite

                    progressInputHandler(progInput, totalEpisodes, editorBox);
                });

                editorBox.querySelector('#qe-save-btn').addEventListener('click', async () => {
                    const saveBtn = editorBox.querySelector('#qe-save-btn');
                    saveBtn.innerText = '...';
                    saveBtn.style.opacity = '0.7';

                    const checkedCustomLists = Array.from(editorBox.querySelectorAll('.qe-custom-list-cb:checked'))
                        .map(cb => cb.getAttribute('data-list-name'));

                    const selectedScore10 = parseInt(editorBox.querySelector('#qe-score').value, 10) || 0;
                    const progressVal = parseInt(progInput.value, 10) || 0;

                    let statusVal = editorBox.querySelector('#qe-status').value;
                    if (progressVal === totalEpisodes && totalEpisodes !== '?') {
                        statusVal = 'COMPLETED';
                    }                    

                    const payload = {
                        status: statusVal,
                        progress: progressVal,
                        scoreRaw: selectedScore10 * 10,
                        customLists: checkedCustomLists
                    };

                    const result = await updateMediaEntry(mediaId, payload);

                    saveBtn.innerText = 'Sauvegarder';
                    saveBtn.style.opacity = '1';

                    if (result?.data?.SaveMediaListEntry) {
                        const updatedEntry = result.data.SaveMediaListEntry;

                        statusMsg.style.opacity = '1';
                        setTimeout(() => { statusMsg.style.opacity = '0'; }, 2000);

                        // Mise à jour du bouton natif AniList
                        updateAniListStatusUI(updatedEntry.status);

                        // Mise à jour parfaite du cache avec les données retournées par l'API
                        entryDataCache = {
                            ...entryDataCache,
                            ...updatedEntry
                        };
                        console.log("Données de l'entrée mises à jour :", entryDataCache);
                    }else {
                        alert("Erreur lors de la mise à jour sur AniList.");
                    }
                });

                const qeHeader = editorBox.querySelector('#qe-header');
                const qeWrapper = editorBox.querySelector('#qe-wrapper');
                const qeArrow = editorBox.querySelector('#qe-toggle-arrow');

                qeHeader.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    qeWrapper.style.gridTemplateRows = isExpanded ? '1fr' : '0fr';
                    qeArrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                });

                progressInputHandler(progInput, totalEpisodes, editorBox);

            } catch (e) {
                console.error("Erreur lors de la récupération des données AniList :", e);
            } finally {
                isFetching = false;
            }
        }

        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                injectQuickEditor();
            }, 100);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        injectQuickEditor();
    });
})();