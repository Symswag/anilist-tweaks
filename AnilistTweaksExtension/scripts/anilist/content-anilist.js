(function() {
    'use strict';

    // =========================================================================
    // 2. MODULE ANILIST TWEAKS (Exécuté uniquement sur anilist.co via manifest)
    // =========================================================================
    
    chrome.storage.sync.get({
        supabaseUrl: '', supabaseKey: '', tableName: 'anime_history',
        anilistUsername: 'Symswag', notifList: 'Not Yet', listsConfig: '[{"name": "VF Supremacy", "color": "#00ffff"}]'
    }, function(config) {
        
        const SUPABASE_URL = config.supabaseUrl;
        const SUPABASE_ANON_KEY = config.supabaseKey;
        const TABLE_NAME = config.tableName;
        const ANILIST_USERNAME = config.anilistUsername;
        const NOTIFICATION_LIST_NAME = config.notifList;
        let LISTS_CONFIG = [];
        try { LISTS_CONFIG = JSON.parse(config.listsConfig); } catch(e) { console.error(e); }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
        
        initAnilistScript(SUPABASE_URL, SUPABASE_ANON_KEY, TABLE_NAME, ANILIST_USERNAME, NOTIFICATION_LIST_NAME, LISTS_CONFIG);
    });

    function initAnilistScript(SUPABASE_URL, SUPABASE_ANON_KEY, TABLE_NAME, ANILIST_USERNAME, NOTIFICATION_LIST_NAME, LISTS_CONFIG) {
        let lastPathname = location.pathname;
        let cachedCompletionDate = null;
        let hasFetchedForCurrentMedia = false;
        let isFetchingSingle = false;

        let historyMapCache = null;
        let isFetchingMap = false;

        let customListsMapCache = null;
        let fullListsDataCache = null; 
        let customListsPromise = null; 
        
        let notificationQueue = [];
        let activeToasts = 0;
        const MAX_TOASTS = 5;

        let cachedRewatchCount = 0;
        let hasFetchedAnilistData = false;
        let isFetchingAnilistData = false;

        const style = document.createElement('style');
        style.innerHTML = `
            .entry-card .title { overflow: visible !important; z-index: 60 !important; }
            .entry-card .score { z-index: 61 !important; }
            .entry-card .progress { z-index: 61 !important; }
            
            .custom-watch-date-icon { position: absolute; bottom: 100%; margin-bottom: 5px; left: 5px; color: rgba(255, 255, 255, 0.95); z-index: 50 !important; cursor: pointer; transition: color 0.2s, transform 0.2s; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.9)); width: 28px; height: 28px; display:flex; justify-content: center; align-items: center; background-color: rgba(255, 255, 255, 0.4); backdrop-filter: blur(8px); border-radius: 5px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }
            .custom-watch-date-icon:hover { color: #ffffff; transform: scale(1.1); z-index: 100 !important; }
            .custom-watch-date-icon::after { content: attr(label); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(5px); background: #11161d; color: #9fadbd; padding: 8px 12px; border-radius: 4px; font-size: 1.2rem; font-weight: 600; font-family: Overpass, sans-serif; white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.4); z-index: 9999; }
            .custom-watch-date-icon:hover::after { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(-5px); }
            .custom-watch-date-icon.cyan { color: #00ffff; background-color: rgba(0, 255, 255, 0.3); }
            .custom-watch-date-icon.cyan:hover { background-color: rgba(0, 255, 255, 0.4); }
            .custom-watch-date-icon.green { color: #00ff00; background-color: rgba(0, 255, 0, 0.3); }
            .custom-watch-date-icon.green:hover { background-color: rgba(0, 255, 0, 0.4); }
            .custom-watch-date-icon.yellow { color: #ffff00; background-color: rgba(255, 255, 0, 0.3); }
            .custom-watch-date-icon.yellow:hover { background-color: rgba(255, 255, 0, 0.4); }
            .custom-watch-date-icon.orange { color: #ff8000; background-color: rgba(255, 128, 0, 0.3); }
            .custom-watch-date-icon.orange:hover { background-color: rgba(255, 128, 0, 0.4); }
            .custom-watch-date-icon.red { color: #FF0032; background-color: rgba(255, 0, 50, 0.3); }
            .custom-watch-date-icon.red:hover { background-color: rgba(255, 0, 50, 0.4); }
            .custom-watch-date-icon.black { color: #000000; background-color: rgba(0, 0, 0, 0.2); }
            .custom-watch-date-icon.black:hover { background-color: rgba(0, 0, 0, 0.3); }
            
            span.release-status.custom-list-dot { opacity: 1 !important; left: auto !important; top: -4px !important; width: 11px !important; height: 11px !important; border-radius: 50% !important; z-index: 50 !important; pointer-events: auto !important; }
            #custom-toast-container { position: fixed; bottom: 30px; right: 30px; z-index: 10000; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
            .custom-toast { display: flex; background: rgb(var(--color-foreground)); padding: 12px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 340px; text-decoration: none !important; color: inherit; position: relative; pointer-events: auto; transition: transform 0.2s; }
            .custom-toast:hover { transform: translateY(-3px); }
            .custom-toast.green { border-left: 5px solid rgb(var(--color-green)); }
            .custom-toast.yellow { border-left: 5px solid rgb(var(--color-yellow)); }
            .custom-toast.orange { border-left: 5px solid rgb(var(--color-orange)); }
            .custom-toast.red { border-left: 5px solid rgb(var(--color-red)); }
            .toast-cover { width: 48px; height: 68px; object-fit: cover; border-radius: 4px; margin-right: 12px; }
            .toast-content { display: flex; flex-direction: column; justify-content: center; flex: 1; padding-right: 15px; }
            .toast-title { font-size: 1.2rem; font-weight: 700; color: rgb(var(--color-text)); margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
            .toast-msg { font-size: 1.1rem; color: rgb(var(--color-text-lighter)); font-weight: 600; transition: color 0.3s; }
            .custom-toast.green .toast-msg { color: rgb(var(--color-green)); }
            .custom-toast.yellow .toast-msg { color: rgb(var(--color-yellow)); }
            .custom-toast.orange .toast-msg { color: rgb(var(--color-orange)); }
            .custom-toast.red .toast-msg { color: rgb(var(--color-red)); }
            .toast-close { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: bold; color: rgb(var(--color-text-lighter)); background: rgba(0,0,0,0.1); border-radius: 50%; cursor: pointer; transition: background 0.2s, color 0.2s; }
            .toast-close:hover { color: rgb(var(--color-red)); background: rgba(0,0,0,0.2); }

            /* --- STYLE GLASSMORPHISM ET POSITIONNEMENT --- */
            .entry-card .hover-icon.repeat,
            .entry-card .hover-icon.notes {
                position: absolute !important;
                top: 5px !important;
                left: 5px !important; /* Position par défaut (1er) */
                z-index: 20 !important;
                
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
                width: 28px !important;
                height: 28px !important;
                padding: 0 !important;
                margin: 0 !important;
                
                background-color: rgba(255, 255, 255, 0.4) !important;
                backdrop-filter: blur(8px) !important;
                border-radius: 5px !important;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
                filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.9)) !important;
                transition: color 0.2s, transform 0.2s, background-color 0.2s, left 0.2s !important;
            }

            /* LA NOUVELLE MAGIE : Si la carte contient 'notes', on décale 'repeat' à la 2ème place */
            .entry-card:has(.hover-icon.notes) .hover-icon.repeat {
                left: 38px !important; 
            }

            /* Couleurs distinctes pour les icônes */
            .entry-card .hover-icon.repeat {
                color: rgb(194, 83, 214) !important; /* Rose/Violet */
                background-color: rgba(156, 39, 176, 0.3) !important;
            }
            .entry-card .hover-icon.notes {
                color: rgb(61, 180, 242) !important; /* Bleu */
                background-color: rgba(61, 180, 242, 0.3) !important;
            }

            /* Ajustement parfait des SVG au centre du carré */
            .entry-card .hover-icon.repeat svg,
            .entry-card .hover-icon.notes svg {
                width: 16px !important;
                height: 16px !important;
                margin: 0 !important;
                fill: currentColor !important;
                position: static !important;
                transform: none !important;
            }

            /* Effet de zoom et d'éclaircissement au survol */
            .entry-card .hover-icon.repeat:hover {
                transform: scale(1.1) !important;
                background-color: rgba(156, 39, 176, 0.5) !important;
            }

            .entry-card .hover-icon.notes:hover {
                transform: scale(1.1) !important;
                background-color: rgba(61, 180, 242, 0.5) !important;
            }

            /* --- RE-STYLAGE ET ANIMATION DU TOOLTIP NATIF D'ANILIST --- */
            .hover-icon-tooltip {
                background: #11161d !important;
                color: #9fadbd !important;
                padding: 10px 10px 6px 10px !important; /* Un peu plus de padding en bas qu'en haut */
                border-radius: 4px !important;
                font-size: 1.2rem !important;
                font-weight: 600 !important;
                font-family: Overpass, sans-serif !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.4) !important;
                border: none !important;
                white-space: nowrap !important;
                z-index: 9999 !important;
                
                /* Centrage vertical absolu */
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-sizing: border-box !important;

                /* Moteur d'animation (axe X) */
                transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease !important;
            }

            /* État inactif */
            .hover-icon-tooltip[style*="visibility: hidden"] {
                opacity: 0 !important;
                transform: translateX(-10px) !important; 
                visibility: hidden !important; 
            }

            /* État actif */
            .hover-icon-tooltip[style*="visibility: visible"] {
                opacity: 1 !important;
                transform: translateX(0px) !important; 
                visibility: visible !important;
            }
        `;
        document.head.appendChild(style);

        // ==========================================
        // APPELS RESEAU (API SUPABASE ET ANILIST)
        // ==========================================

        async function fetchSingleCompletionDate(mediaId) {
            if (isFetchingSingle || hasFetchedForCurrentMedia) return;
            isFetchingSingle = true;
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?media_id=eq.${mediaId}&select=completed_at`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
                const data = await res.json();
                cachedCompletionDate = (data && data.length > 0) ? new Date(data[0].completed_at) : null;
            } catch (err) {
                cachedCompletionDate = null;
            } finally {
                hasFetchedForCurrentMedia = true;
                isFetchingSingle = false;
                injectDetailBlocks();
            }
        }

        async function fetchAnilistEntryData(mediaId) {
            if (isFetchingAnilistData || hasFetchedAnilistData) return;
            isFetchingAnilistData = true;
            try {
                const query = `
                query ($mediaId: Int, $userName: String) {
                  MediaList(mediaId: $mediaId, userName: $userName) { repeat }
                }`;
                const variables = { mediaId: parseInt(mediaId), userName: ANILIST_USERNAME };
                
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables })
                });
                const data = await res.json();
                if (data && data.data && data.data.MediaList) {
                    cachedRewatchCount = data.data.MediaList.repeat || 0;
                } else {
                    cachedRewatchCount = 0;
                }
            } catch (err) {
                cachedRewatchCount = 0;
            } finally {
                hasFetchedAnilistData = true;
                isFetchingAnilistData = false;
                injectDetailBlocks(); // Relance l'injection une fois la donnée reçue
            }
        }

        async function fetchAllHistory() {
            if (historyMapCache) return historyMapCache;
            if (isFetchingMap) return null;
            isFetchingMap = true;
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=media_id,completed_at`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
                const data = await res.json();
                historyMapCache = new Map();
                if (data) { data.forEach(row => historyMapCache.set(row.media_id, new Date(row.completed_at))); }
            } catch (err) {} 
            finally { isFetchingMap = false; }
            return historyMapCache;
        }

        async function fetchCustomLists() {
            if (customListsMapCache) return { map: customListsMapCache, fullData: fullListsDataCache };
            if (customListsPromise) return customListsPromise;

            customListsPromise = (async () => {
                const query = `
                query {
                  MediaListCollection(userName: "${ANILIST_USERNAME}", type: ANIME) {
                    lists {
                      name
                      entries {
                        mediaId
                        media { id status episodes title { userPreferred } coverImage { medium } nextAiringEpisode { episode timeUntilAiring } }
                      }
                    }
                  }
                }
                `;

                try {
                    const res = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ query }) });
                    const data = await res.json();
                    fullListsDataCache = data.data.MediaListCollection.lists;
                    
                    fullListsDataCache.forEach(list => {
                        list.entries.forEach(entry => {
                            if (entry.media.nextAiringEpisode && !entry.media.nextAiringEpisode.absoluteTime) {
                                entry.media.nextAiringEpisode.absoluteTime = Date.now() + (entry.media.nextAiringEpisode.timeUntilAiring * 1000);
                            }
                        });
                    });

                    customListsMapCache = new Map();

                    LISTS_CONFIG.forEach(config => {
                        const listData = fullListsDataCache.find(list => list.name === config.name);
                        if (listData) {
                            listData.entries.forEach(entry => {
                                if (!customListsMapCache.has(entry.mediaId)) customListsMapCache.set(entry.mediaId, []);
                                customListsMapCache.get(entry.mediaId).push(config);
                            });
                        }
                    });
                } catch (error) {} 
                
                customListsPromise = null;
                return { map: customListsMapCache, fullData: fullListsDataCache };
            })();
            
            return customListsPromise;
        }

        // ==========================================
        // SYSTEME DE NOTIFICATIONS (TOASTS) GLOBAL
        // ==========================================

        function processNotifications(allLists) {
            const notYetList = allLists.find(l => l.name === NOTIFICATION_LIST_NAME);
            if (!notYetList) return;

            let dismissed = JSON.parse(localStorage.getItem('anilist_notifs_dismissed') || '{}');
            const todayStr = new Date().toDateString();

            // --- NOUVEAUTÉ : GARBAGE COLLECTOR ---
            // On récupère tous les IDs valides actuellement dans la liste
            const validIds = new Set(notYetList.entries.map(entry => entry.media.id));
            let dismissedChanged = false;

            // On supprime les vieux IDs de la mémoire locale s'ils ne sont plus dans la liste "Not Yet"
            Object.keys(dismissed).forEach(key => {
                if (!validIds.has(parseInt(key, 10))) {
                    delete dismissed[key];
                    dismissedChanged = true;
                }
            });

            // Sauvegarde uniquement si on a nettoyé quelque chose
            if (dismissedChanged) {
                localStorage.setItem('anilist_notifs_dismissed', JSON.stringify(dismissed));
            }
            // -------------------------------------

            notYetList.entries.forEach(entry => {
                const media = entry.media;
                const id = media.id;
                let type = null;
                let msg = '';

                let t = 0;
                if (media.nextAiringEpisode && media.nextAiringEpisode.absoluteTime) {
                    t = Math.floor((media.nextAiringEpisode.absoluteTime - Date.now()) / 1000);
                    if (t < 0) t = 0;
                }

                const d = Math.floor(t / 86400);
                const h = Math.floor((t % 86400) / 3600);
                const m = Math.floor((t % 3600) / 60);
                const timeStr = `${d > 0 ? d + 'j ' : ''}${h}h ${m}min`;

                if (media.status === 'FINISHED') {
                    type = 'GREEN'; 
                    msg = `Est complètement sorti !`;
                } else if (media.status === 'RELEASING' && media.nextAiringEpisode && media.nextAiringEpisode.episode === media.episodes) {
                    if (t <= 21600) {
                        type = 'YELLOW';
                        msg = `Dernier épisode dans ${timeStr} !`;
                    } else if (t <= 86400) {
                        type = 'ORANGE';
                        msg = `Dernier épisode dans ${timeStr} !`;
                    } else if (t <= 259200) {
                        type = 'RED';
                        msg = `Dernier épisode dans ${timeStr} !`;
                    }
                }

                if (type) {
                    const pastData = dismissed[id];
                    
                    if (pastData) {
                        const pastType = typeof pastData === 'string' ? pastData : pastData.type;
                        const pastDate = typeof pastData === 'string' ? '' : new Date(pastData.timestamp).toDateString();

                        if (pastDate === todayStr) {
                            if (pastType === 'GREEN') return; 
                            if (pastType === 'YELLOW' && type === 'YELLOW') return; 
                            if (pastType === 'ORANGE' && type === 'ORANGE') return; 
                            if (pastType === 'RED' && type === 'RED') return;
                        }
                    }

                    const inQueue = notificationQueue.find(n => n.id === id);
                    const onScreenEl = document.querySelector(`.custom-toast[href="/anime/${id}"]`);

                    if (onScreenEl) {
                        const msgEl = onScreenEl.querySelector('.toast-msg');
                        if (msgEl && msgEl.innerText !== msg) {
                            msgEl.innerText = msg;
                            onScreenEl.className = `custom-toast ${type.toLowerCase()}`;
                        }
                    } else if (inQueue) {
                        inQueue.msg = msg;
                        inQueue.type = type;
                    } else {
                        notificationQueue.push({ id: id, title: media.title.userPreferred, cover: media.coverImage.medium, type: type, msg: msg });
                    }
                }
            });
            
            displayNextToasts();
        }

        function closeToastElement(toastEl) {
            if (toastEl.dataset.closing) return;
            toastEl.dataset.closing = "true"; 
            toastEl.style.transition = 'opacity 0.3s, transform 0.3s';
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateX(50px)';
            setTimeout(() => { 
                toastEl.remove(); 
                activeToasts--; 
                displayNextToasts(); 
            }, 300);
        }

        function displayNextToasts() {
            let container = document.getElementById('custom-toast-container');
            if (!container) {
                container = document.createElement('div'); container.id = 'custom-toast-container'; document.body.appendChild(container);
            }

            while(activeToasts < MAX_TOASTS && notificationQueue.length > 0) {
                const notif = notificationQueue.shift();
                
                const dismissed = JSON.parse(localStorage.getItem('anilist_notifs_dismissed') || '{}');
                const pastData = dismissed[notif.id];
                if (pastData && new Date(pastData.timestamp).toDateString() === new Date().toDateString() && pastData.type === notif.type) {
                    continue; 
                }

                activeToasts++;

                const toast = document.createElement('a');
                toast.href = `/anime/${notif.id}`; toast.className = `custom-toast ${notif.type.toLowerCase()}`;
                toast.dataset.type = notif.type; 
                toast.innerHTML = `<img class="toast-cover" src="${notif.cover}" /><div class="toast-content"><div class="toast-title">${notif.title}</div><div class="toast-msg">${notif.msg}</div></div><div class="toast-close" title="Fermer">×</div>`;

                toast.querySelector('.toast-close').addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    
                    let currentDismissed = JSON.parse(localStorage.getItem('anilist_notifs_dismissed') || '{}');
                    currentDismissed[notif.id] = { type: notif.type, timestamp: Date.now() };
                    localStorage.setItem('anilist_notifs_dismissed', JSON.stringify(currentDismissed));
                    
                    closeToastElement(toast);
                });

                container.appendChild(toast);
                toast.animate([{ opacity: 0, transform: 'translateX(50px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' });
            }
        }

        window.addEventListener('storage', (e) => {
            if (e.key === 'anilist_notifs_dismissed') {
                const dismissed = JSON.parse(e.newValue || '{}');
                const todayStr = new Date().toDateString();

                const activeToastEls = document.querySelectorAll('.custom-toast');
                activeToastEls.forEach(toastEl => {
                    const match = toastEl.getAttribute('href').match(/\/anime\/(\d+)/);
                    if (match && match[1]) {
                        const id = parseInt(match[1], 10);
                        const pastData = dismissed[id];
                        
                        if (pastData) {
                            const pastType = pastData.type;
                            const pastDate = new Date(pastData.timestamp).toDateString();
                            
                            if (pastDate === todayStr && toastEl.dataset.type === pastType) {
                                closeToastElement(toastEl);
                            }
                        }
                    }
                });

                notificationQueue = notificationQueue.filter(notif => {
                    const pastData = dismissed[notif.id];
                    if (pastData) {
                        const pastDate = new Date(pastData.timestamp).toDateString();
                        if (pastDate === todayStr && pastData.type === notif.type) {
                            return false; 
                        }
                    }
                    return true;
                });
            }
        });

        async function initGlobalNotifications() {
            const fetchResult = await fetchCustomLists();
            if (fetchResult && fetchResult.fullData) {
                processNotifications(fetchResult.fullData);
            }
        }

        function dateGapToday(date) {
            if(!date) return;
            const dTargetClean = new Date(date); dTargetClean.setHours(0, 0, 0, 0);
            const dTodayClean = new Date(); dTodayClean.setHours(0, 0, 0, 0);
            return Math.round((dTodayClean - dTargetClean) / (1000 * 60 * 60 * 24));
        }

        // ==========================================
        // MODIFICATIONS DOM (INJECTIONS VISUELLES)
        // ==========================================

        async function processListCards() {
            const map = await fetchAllHistory();
            if (!map) return;
            const cards = document.querySelectorAll('.entry-card:not(.date-processed)');
            cards.forEach(card => {
                card.classList.add('date-processed');
                const titleDiv = card.querySelector('.title');
                if (!titleDiv) return;
                const link = titleDiv.querySelector('a');
                if (!link) return;
                const match = link.getAttribute('href').match(/\/anime\/(\d+)/);
                if (!match) return;

                const mediaId = parseInt(match[1]);
                if (map.has(mediaId)) {
                    const date = map.get(mediaId);
                    const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const daysCount = dateGapToday(date);
                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'custom-watch-date-icon'; iconDiv.setAttribute('label', `Terminé le ${dateStr} (${daysCount}j)`);
                    iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-calendar-check-fill" viewBox="0 0 16 16"><path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2m-5.146-5.146-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708.708"/></svg>`;

                    if (daysCount <= 30) iconDiv.classList.add('cyan');
                    else if (daysCount <= 90) iconDiv.classList.add('green');
                    else if (daysCount <= 180) iconDiv.classList.add('yellow');
                    else if (daysCount <= 270) iconDiv.classList.add('orange');
                    else if (daysCount <= 365) iconDiv.classList.add('red');
                    else iconDiv.classList.add('black');

                    titleDiv.appendChild(iconDiv);
                }
            });
        }

        function injectDetailBlocks() {
            if (location.pathname !== lastPathname) {
                const oldGenres = document.getElementById('custom-quick-genres');
                const oldDate = document.getElementById('custom-completion-date');
                if (oldGenres) oldGenres.remove(); if (oldDate) oldDate.remove();
                
                // On réinitialise tout au changement de page
                lastPathname = location.pathname; 
                hasFetchedForCurrentMedia = false; 
                cachedCompletionDate = null;
                hasFetchedAnilistData = false;
                cachedRewatchCount = 0;
            }

            const match = location.pathname.match(/\/anime\/(\d+)/);
            if (!match) return;
            const mediaId = match[1];

            // On lance les deux requêtes en parallèle si ce n'est pas déjà fait
            if (!hasFetchedForCurrentMedia) fetchSingleCompletionDate(mediaId);
            if (!hasFetchedAnilistData) fetchAnilistEntryData(mediaId);

            const relationsBlock = document.querySelector('.relations.small') || document.querySelector('.relations');
            if (!relationsBlock) return;

            // --- 1. SECTION GENRES ---
            if (!document.getElementById('custom-quick-genres')) {
                const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type'));
                const genresHeader = typeElements.find(el => el.textContent.trim() === 'Genres');
                if (genresHeader) {
                    const valueContainer = genresHeader.nextElementSibling;
                    if (valueContainer && valueContainer.classList.contains('value')) {
                        const genreLinks = Array.from(valueContainer.querySelectorAll('a'));
                        if (genreLinks.length > 0) {
                            const cleanGenres = genreLinks.map(link => ({ name: link.textContent.trim(), href: link.getAttribute('href') })).filter(g => g.name !== "");
                            const container = document.createElement('div'); container.id = 'custom-quick-genres'; container.style.marginBottom = '25px';
                            const title = document.createElement('h2'); title.textContent = 'Genres'; title.style.fontSize = '1.4rem'; title.style.fontWeight = '700'; title.style.letterSpacing = '0.03em'; title.style.marginBottom = '12px'; title.style.color = 'var(--color-text-main)';
                            container.appendChild(title);
                            const tagsList = document.createElement('div'); tagsList.style.display = 'flex'; tagsList.style.flexWrap = 'wrap'; tagsList.style.gap = '8px';

                            cleanGenres.forEach(genre => {
                                const badge = document.createElement('a'); badge.href = genre.href; badge.textContent = genre.name;
                                badge.style.display = 'inline-flex'; badge.style.alignItems = 'center'; badge.style.padding = '8px 16px'; badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)'; badge.style.color = 'var(--color-blue)'; badge.style.borderRadius = '6px'; badge.style.fontSize = '1.3rem'; badge.style.fontWeight = '600'; badge.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'; badge.style.textDecoration = 'none';
                                badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateY(-2px)'; badge.style.backgroundColor = 'var(--color-blue)'; badge.style.color = '#ffffff'; badge.style.boxShadow = '0 4px 12px rgba(61, 180, 242, 0.3)'; });
                                badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateY(0)'; badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)'; badge.style.color = 'var(--color-blue)'; badge.style.boxShadow = 'none'; });
                                tagsList.appendChild(badge);
                            });
                            container.appendChild(tagsList); relationsBlock.parentNode.insertBefore(container, relationsBlock);
                        }
                    }
                }
            }

            // --- 2. SECTION VISIONNAGE (DATE & REWATCH) ---
            // On s'assure que les 2 appels réseau sont terminés avant de créer le bloc
            if (hasFetchedForCurrentMedia && hasFetchedAnilistData && !document.getElementById('custom-completion-date')) {
                const dateContainer = document.createElement('div'); 
                dateContainer.id = 'custom-completion-date'; 
                dateContainer.style.marginBottom = '25px';
                
                const dateTitle = document.createElement('h2'); 
                dateTitle.textContent = 'Visionnage'; 
                dateTitle.style.fontSize = '1.4rem'; 
                dateTitle.style.fontWeight = '700'; 
                dateTitle.style.letterSpacing = '0.03em'; 
                dateTitle.style.marginBottom = '12px'; 
                dateTitle.style.color = 'var(--color-text-main)';
                dateContainer.appendChild(dateTitle);

                const badgeWrapper = document.createElement('div');
                badgeWrapper.style.display = 'flex';
                badgeWrapper.style.gap = '10px';
                badgeWrapper.style.flexWrap = 'wrap';

                // Badge 1 : Date
                const dateBadge = document.createElement('div'); 
                dateBadge.style.display = 'inline-flex'; 
                dateBadge.style.alignItems = 'center'; 
                dateBadge.style.padding = '8px 16px'; 
                dateBadge.style.borderRadius = '6px'; 
                dateBadge.style.fontSize = '1.3rem'; 
                dateBadge.style.fontWeight = '600';

                if (cachedCompletionDate) {
                    const cachedCompletionDateStr = cachedCompletionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    const daysCount = dateGapToday(cachedCompletionDate);
                    dateBadge.innerHTML = `<svg style="width: 16px; height: 16px; margin-right: 8px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Terminé le ${cachedCompletionDateStr} (${daysCount}j)`;
                    dateBadge.style.backgroundColor = 'rgba(62, 207, 142, 0.1)'; 
                    dateBadge.style.color = '#3ECF8E';
                } else {
                    dateBadge.innerHTML = `<svg style="width: 16px; height: 16px; margin-right: 8px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg> Date pas encore enregistrée`;
                    dateBadge.style.backgroundColor = 'rgba(225, 51, 51, 0.1)'; 
                    dateBadge.style.color = '#e13333';
                }
                badgeWrapper.appendChild(dateBadge);

                // Badge 2 : Rewatch (Utilisation de la variable GraphQL)
                if (cachedRewatchCount > 0) {
                    const rewatchBadge = document.createElement('div');
                    rewatchBadge.style.display = 'inline-flex';
                    rewatchBadge.style.alignItems = 'center';
                    rewatchBadge.style.padding = '8px 16px';
                    rewatchBadge.style.borderRadius = '6px';
                    rewatchBadge.style.fontSize = '1.3rem';
                    rewatchBadge.style.fontWeight = '600';
                    rewatchBadge.style.backgroundColor = 'rgba(156, 39, 176, 0.1)'; 
                    rewatchBadge.style.color = '#c253d6'; 
                    
                    rewatchBadge.innerHTML = `<svg style="width: 16px; height: 16px; margin-right: 8px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> ${cachedRewatchCount} Rewatch${cachedRewatchCount > 1 ? 's' : ''}`;
                    
                    badgeWrapper.appendChild(rewatchBadge);
                }

                dateContainer.appendChild(badgeWrapper);

                const genresBlock = document.getElementById('custom-quick-genres');
                if (genresBlock) { 
                    genresBlock.parentNode.insertBefore(dateContainer, genresBlock); 
                } else { 
                    relationsBlock.parentNode.insertBefore(dateContainer, relationsBlock); 
                }
            }
        }

        async function processCustomListIndicators() {
            const fetchResult = await fetchCustomLists();
            if (!fetchResult) return;
            
            const map = fetchResult.map; 

            const cards = document.querySelectorAll('.entry-card:not(.custom-lists-processed)');
            cards.forEach(card => {
                card.classList.add('custom-lists-processed');
                const link = card.querySelector('a[href*="/anime/"]');
                if (!link) return;
                const match = link.getAttribute('href').match(/\/anime\/(\d+)/);
                
                if (match && match[1]) {
                    const mediaId = parseInt(match[1], 10);
                    if (map.has(mediaId)) {
                        const matchedLists = map.get(mediaId);
                        let cardBoxShadows = [];
                        
                        matchedLists.forEach((listConfig, index) => {
                            const dot = document.createElement('span'); dot.className = 'release-status custom-list-dot'; dot.title = listConfig.name;
                            const rightOffset = -4 + (index * 16);
                            dot.style.setProperty('background', listConfig.color, 'important'); dot.style.setProperty('box-shadow', `0 0 5px ${listConfig.color}`, 'important'); dot.style.setProperty('right', `${rightOffset}px`, 'important');
                            card.appendChild(dot);
                            cardBoxShadows.push(`0 0 0 ${index + 1}px ${listConfig.color}`); cardBoxShadows.push(`0 0 5px ${index}px ${listConfig.color}`);
                        });

                        card.style.setProperty('border', '1px solid transparent', 'important');
                        card.style.setProperty('box-shadow', cardBoxShadows.join(', '), 'important');
                        card.style.setProperty('border-radius', '4px', 'important');
                    }
                }
            });
        }

        // ==========================================
        // GESTIONNAIRE D'EVENEMENTS ET ROUTAGE
        // ==========================================

        function routeHandler() {
            const path = location.pathname;
            if (path.match(/\/anime\/(\d+)/)) { 
                injectDetailBlocks(); 
            } else if (path.includes('/animelist')) { 
                processListCards(); 
                processCustomListIndicators(); 
            }
            
            initGlobalNotifications(); 
        }

        const observer = new MutationObserver(() => { routeHandler(); });
        observer.observe(document.body, { childList: true, subtree: true });
        
        window.addEventListener('popstate', routeHandler);
        document.addEventListener('click', () => { setTimeout(routeHandler, 100); }, true);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                initGlobalNotifications();
            }
        });

        routeHandler();            

        setInterval(() => {
            customListsMapCache = null; 
            initGlobalNotifications();
        }, 7200000);
    }
})();