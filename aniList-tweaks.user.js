// ==UserScript==
// @name         AniList - Tweaks & Custom Indicators
// @namespace    http://tampermonkey.net/
// @version      5.0.1
// @description  Supabase infos, Points/Bordures de listes, et Système de notifications Anti-Spam
// @author       Symswag
// @match        https://anilist.co/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=anilist.co
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 🔧 CONFIGURATION GÉNÉRALE
    // ==========================================
    
    const SUPABASE_URL = 'https://skyhgrptdxggbxzuxmay.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_oI0jegev2Vx-coWpXmUw7Q_hBs-RWsw';
    const TABLE_NAME = 'anime_history';

    const ANILIST_USERNAME = "Symswag";
    const NOTIFICATION_LIST_NAME = "Not Yet"; // Nom exact de la liste pour les notifications
    const LISTS_CONFIG = [
        { name: "VF Supremacy", color: "#00ffff" },
    ];

    // ==========================================
    // 🧠 VARIABLES D'ÉTAT
    // ==========================================
    let lastPathname = location.pathname;
    let cachedCompletionDate = null;
    let hasFetchedForCurrentMedia = false;
    let isFetchingSingle = false;

    let historyMapCache = null;
    let isFetchingMap = false;

    let customListsMapCache = null;
    let fullListsDataCache = null; // Pour les notifications
    let isFetchingCustomLists = false;
    let hasProcessedNotifications = false; // Anti-spam par session

    // File d'attente des notifications
    let notificationQueue = [];
    let activeToasts = 0;
    const MAX_TOASTS = 3;

    // ==========================================
    // 🎨 STYLES CSS INJECTÉS
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- DATES DE VISIONNAGE --- */
        .entry-card .title { overflow: visible !important; }
        .custom-watch-date-icon { position: absolute; bottom: 100%; margin-bottom: 5px; left: 5px; color: rgba(255, 255, 255, 0.95); z-index: 10; cursor: pointer; transition: color 0.2s, transform 0.2s; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.9)); width: 28px; height: 28px; display:flex; justify-content: center; align-items: center; background-color: rgba(255, 255, 255, 0.4); backdrop-filter: blur(8px); border-radius: 5px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }
        .custom-watch-date-icon:hover { color: #ffffff; transform: scale(1.1); }
        .custom-watch-date-icon::after { content: attr(label); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(5px); background: #11161d; color: #9fadbd; padding: 8px 12px; border-radius: 4px; font-size: 1.2rem; font-weight: 600; font-family: Overpass, sans-serif; white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.4); z-index: 9999; }
        .custom-watch-date-icon:hover::after { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(-5px); }

        /* --- POINTS DE LISTES PERSONNALISÉES --- */
        span.release-status.custom-list-dot { opacity: 1 !important; left: auto !important; top: -4px !important; width: 11px !important; height: 11px !important; border-radius: 50% !important; z-index: 50 !important; pointer-events: auto !important; }

        /* --- SYSTÈME DE NOTIFICATIONS --- */
        #custom-toast-container { position: fixed; bottom: 30px; right: 30px; z-index: 10000; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
        .custom-toast { display: flex; background: rgb(var(--color-foreground)); padding: 12px; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 340px; text-decoration: none !important; color: inherit; position: relative; pointer-events: auto; transition: transform 0.2s; }
        .custom-toast:hover { transform: translateY(-3px); }
        .custom-toast.green { border-left: 5px solid rgb(var(--color-green)); }
        .custom-toast.orange { border-left: 5px solid rgb(var(--color-orange)); }
        .toast-cover { width: 48px; height: 68px; object-fit: cover; border-radius: 4px; margin-right: 12px; }
        .toast-content { display: flex; flex-direction: column; justify-content: center; flex: 1; padding-right: 15px; }
        .toast-title { font-size: 1.2rem; font-weight: 700; color: rgb(var(--color-text)); margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
        .toast-msg { font-size: 1.1rem; color: rgb(var(--color-text-lighter)); font-weight: 600; }
        .custom-toast.green .toast-msg { color: rgb(var(--color-green)); }
        .custom-toast.orange .toast-msg { color: rgb(var(--color-orange)); }
        .toast-close { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: bold; color: rgb(var(--color-text-lighter)); background: rgba(0,0,0,0.1); border-radius: 50%; cursor: pointer; transition: background 0.2s, color 0.2s; }
        .toast-close:hover { color: rgb(var(--color-red)); background: rgba(0,0,0,0.2); }
    `;
    document.head.appendChild(style);

    // ==========================================
    // 🌐 REQUÊTES API
    // ==========================================

    async function fetchSingleCompletionDate(mediaId) {
        if (isFetchingSingle || hasFetchedForCurrentMedia) return;
        isFetchingSingle = true;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?media_id=eq.${mediaId}&select=completed_at`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            const data = await res.json();
            cachedCompletionDate = (data && data.length > 0) ? new Date(data[0].completed_at) : null;
        } catch (err) {
            console.error("❌ Erreur Supabase (Détail):", err);
            cachedCompletionDate = null;
        } finally {
            hasFetchedForCurrentMedia = true;
            isFetchingSingle = false;
            injectDetailBlocks();
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
        } catch (err) { console.error("❌ Erreur Supabase (Liste):", err); } 
        finally { isFetchingMap = false; }
        return historyMapCache;
    }

    // NOUVELLE REQUÊTE : Plus riche pour récupérer statuts, épisodes et images
    async function fetchCustomLists() {
        if (customListsMapCache) return { map: customListsMapCache, fullData: fullListsDataCache };
        if (isFetchingCustomLists) return null;
        isFetchingCustomLists = true;

        const query = `
        query {
          MediaListCollection(userName: "${ANILIST_USERNAME}", type: ANIME) {
            lists {
              name
              entries {
                mediaId
                media {
                  id
                  status
                  episodes
                  title { userPreferred }
                  coverImage { medium }
                  nextAiringEpisode { episode timeUntilAiring }
                }
              }
            }
          }
        }
        `;

        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await res.json();
            fullListsDataCache = data.data.MediaListCollection.lists;
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
        } catch (error) {
            console.error("❌ Erreur GraphQL (Custom Lists) :", error);
        } finally {
            isFetchingCustomLists = false;
        }
        
        return { map: customListsMapCache, fullData: fullListsDataCache };
    }

    // ==========================================
    // 🔔 SYSTÈME DE NOTIFICATIONS
    // ==========================================

    function processNotifications(allLists) {
        if (hasProcessedNotifications) return;
        hasProcessedNotifications = true;

        const notYetList = allLists.find(l => l.name === NOTIFICATION_LIST_NAME);
        if (!notYetList) return;

        // On récupère la mémoire des notifications déjà fermées
        let dismissed = JSON.parse(localStorage.getItem('anilist_notifs_dismissed') || '{}');

        notYetList.entries.forEach(entry => {
            const media = entry.media;
            const id = media.id;
            let type = null;
            let msg = '';

            // Règle Verte : Complètement terminé
            if (media.status === 'FINISHED') {
                type = 'GREEN';
                msg = `Est complètement sorti !`;
            } 
            // Règle Orange : En cours + C'est le dernier épisode + Sort dans moins de 24h (86400s)
            else if (media.status === 'RELEASING' && media.nextAiringEpisode) {
                if (media.nextAiringEpisode.episode === media.episodes && media.nextAiringEpisode.timeUntilAiring <= 86400) {
                    type = 'ORANGE';
                    const h = Math.floor(media.nextAiringEpisode.timeUntilAiring / 3600);
                    const m = Math.floor((media.nextAiringEpisode.timeUntilAiring % 3600) / 60);
                    msg = `Dernier épisode dans ${h}h ${m}min !`;
                }
            }

            if (type) {
                // Vérification anti-spam
                const pastStatus = dismissed[id];
                if (pastStatus === 'GREEN') return; // Déjà vu en vert, on ignore
                if (pastStatus === 'ORANGE' && type === 'ORANGE') return; // Déjà vu en orange, on ignore (jusqu'à ce qu'il passe vert)

                notificationQueue.push({ 
                    id: id, 
                    title: media.title.userPreferred, 
                    cover: media.coverImage.medium, 
                    type: type, 
                    msg: msg 
                });
            }
        });

        displayNextToasts();
    }

    function displayNextToasts() {
        let container = document.getElementById('custom-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'custom-toast-container';
            document.body.appendChild(container);
        }

        while(activeToasts < MAX_TOASTS && notificationQueue.length > 0) {
            const notif = notificationQueue.shift();
            activeToasts++;

            const toast = document.createElement('a');
            toast.href = `/anime/${notif.id}`;
            toast.className = `custom-toast ${notif.type.toLowerCase()}`;
            
            toast.innerHTML = `
                <img class="toast-cover" src="${notif.cover}" />
                <div class="toast-content">
                    <div class="toast-title">${notif.title}</div>
                    <div class="toast-msg">${notif.msg}</div>
                </div>
                <div class="toast-close" title="Fermer">×</div>
            `;

            // Gestion de la fermeture + Sauvegarde Anti-Spam
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                let dismissed = JSON.parse(localStorage.getItem('anilist_notifs_dismissed') || '{}');
                dismissed[notif.id] = notif.type;
                localStorage.setItem('anilist_notifs_dismissed', JSON.stringify(dismissed));

                toast.style.transition = 'opacity 0.3s, transform 0.3s';
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(50px)';
                
                setTimeout(() => {
                    toast.remove();
                    activeToasts--;
                    displayNextToasts(); // Appelle le suivant dans la file !
                }, 300);
            });

            container.appendChild(toast);
            
            // Animation d'apparition
            toast.animate([
                { opacity: 0, transform: 'translateX(50px)' },
                { opacity: 1, transform: 'translateX(0)' }
            ], { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' });
        }
    }


    // ==========================================
    // 🛠️ UTILITAIRES & INJECTIONS DOM
    // ==========================================

    function dateGapToday(date) {
        if(!date) return;
        const dTargetClean = new Date(date); dTargetClean.setHours(0, 0, 0, 0);
        const dTodayClean = new Date(); dTodayClean.setHours(0, 0, 0, 0);
        return Math.round((dTodayClean - dTargetClean) / (1000 * 60 * 60 * 24));
    }

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
                iconDiv.className = 'custom-watch-date-icon';
                iconDiv.setAttribute('label', `Terminé le ${dateStr} (${daysCount}j)`);
                iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-calendar-check-fill" viewBox="0 0 16 16"><path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2m-5.146-5.146-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708.708"/></svg>`;

                if (daysCount <= 30)
                {
                    iconDiv.style.color = "#00FF00";
                }
                else if (daysCount <= 100)
                {
                    iconDiv.style.color = "#FF8000";
                }
                else
                {
                    iconDiv.style.color = "#FF0032";
                }

                titleDiv.appendChild(iconDiv);
            }
        });
    }

    function injectDetailBlocks() {
        // [Ton code d'injection des blocs Genres et Dates Supabase pour la page Détail reste intact...]
        if (location.pathname !== lastPathname) {
            const oldGenres = document.getElementById('custom-quick-genres');
            const oldDate = document.getElementById('custom-completion-date');
            if (oldGenres) oldGenres.remove();
            if (oldDate) oldDate.remove();
            lastPathname = location.pathname;
            hasFetchedForCurrentMedia = false;
            cachedCompletionDate = null;
        }

        const match = location.pathname.match(/\/anime\/(\d+)/);
        if (!match) return;
        const mediaId = match[1];

        if (!hasFetchedForCurrentMedia) fetchSingleCompletionDate(mediaId);

        const relationsBlock = document.querySelector('.relations.small') || document.querySelector('.relations');
        if (!relationsBlock) return;

        // INJECTION GENRES
        if (!document.getElementById('custom-quick-genres')) {
            const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type'));
            const genresHeader = typeElements.find(el => el.textContent.trim() === 'Genres');

            if (genresHeader) {
                const valueContainer = genresHeader.nextElementSibling;
                if (valueContainer && valueContainer.classList.contains('value')) {
                    const genreLinks = Array.from(valueContainer.querySelectorAll('a'));
                    if (genreLinks.length > 0) {
                        const cleanGenres = genreLinks.map(link => ({ name: link.textContent.trim(), href: link.getAttribute('href') })).filter(g => g.name !== "");
                        const container = document.createElement('div');
                        container.id = 'custom-quick-genres';
                        container.style.marginBottom = '25px';

                        const title = document.createElement('h2');
                        title.textContent = 'Genres';
                        title.style.fontSize = '1.4rem'; title.style.fontWeight = '700'; title.style.letterSpacing = '0.03em'; title.style.marginBottom = '12px'; title.style.color = 'var(--color-text-main)';
                        container.appendChild(title);

                        const tagsList = document.createElement('div');
                        tagsList.style.display = 'flex'; tagsList.style.flexWrap = 'wrap'; tagsList.style.gap = '8px';

                        cleanGenres.forEach(genre => {
                            const badge = document.createElement('a');
                            badge.href = genre.href; badge.textContent = genre.name;
                            badge.style.display = 'inline-flex'; badge.style.alignItems = 'center'; badge.style.padding = '8px 16px';
                            badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)'; badge.style.color = 'var(--color-blue)';
                            badge.style.borderRadius = '6px'; badge.style.fontSize = '1.3rem'; badge.style.fontWeight = '600';
                            badge.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'; badge.style.textDecoration = 'none';
                            badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateY(-2px)'; badge.style.backgroundColor = 'var(--color-blue)'; badge.style.color = '#ffffff'; badge.style.boxShadow = '0 4px 12px rgba(61, 180, 242, 0.3)'; });
                            badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateY(0)'; badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)'; badge.style.color = 'var(--color-blue)'; badge.style.boxShadow = 'none'; });
                            tagsList.appendChild(badge);
                        });
                        container.appendChild(tagsList);
                        relationsBlock.parentNode.insertBefore(container, relationsBlock);
                    }
                }
            }
        }

        // INJECTION DATE
        if (hasFetchedForCurrentMedia && !document.getElementById('custom-completion-date')) {
            const dateContainer = document.createElement('div');
            dateContainer.id = 'custom-completion-date';
            dateContainer.style.marginBottom = '25px';

            const dateTitle = document.createElement('h2');
            dateTitle.textContent = 'Visionnage';
            dateTitle.style.fontSize = '1.4rem'; dateTitle.style.fontWeight = '700'; dateTitle.style.letterSpacing = '0.03em'; dateTitle.style.marginBottom = '12px'; dateTitle.style.color = 'var(--color-text-main)';
            dateContainer.appendChild(dateTitle);

            const dateBadge = document.createElement('div');
            dateBadge.style.display = 'inline-flex'; dateBadge.style.alignItems = 'center'; dateBadge.style.padding = '8px 16px'; dateBadge.style.borderRadius = '6px'; dateBadge.style.fontSize = '1.3rem'; dateBadge.style.fontWeight = '600';

            if (cachedCompletionDate) {
                const cachedCompletionDateStr = cachedCompletionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                const daysCount = dateGapToday(cachedCompletionDate);
                dateBadge.innerHTML = `<svg style="width: 16px; height: 16px; margin-right: 8px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Terminé le ${cachedCompletionDateStr} (${daysCount}j)`;
                dateBadge.style.backgroundColor = 'rgba(62, 207, 142, 0.1)'; dateBadge.style.color = '#3ECF8E';
            } else {
                dateBadge.innerHTML = `<svg style="width: 16px; height: 16px; margin-right: 8px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg> Date pas encore enregistrée`;
                dateBadge.style.backgroundColor = 'rgba(225, 51, 51, 0.1)'; dateBadge.style.color = '#e13333';
            }
            dateContainer.appendChild(dateBadge);

            const genresBlock = document.getElementById('custom-quick-genres');
            if (genresBlock) { genresBlock.parentNode.insertBefore(dateContainer, genresBlock); } 
            else { relationsBlock.parentNode.insertBefore(dateContainer, relationsBlock); }
        }
    }

    async function processCustomListIndicators() {
        const fetchResult = await fetchCustomLists();
        if (!fetchResult) return;
        
        const map = fetchResult.map;
        const allListsData = fetchResult.fullData;
        
        // Lancer les notifications si pas encore fait
        if (!hasProcessedNotifications && allListsData) {
            processNotifications(allListsData);
        }

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
                        const dot = document.createElement('span');
                        dot.className = 'release-status custom-list-dot';
                        dot.title = listConfig.name;
                        
                        const rightOffset = -4 + (index * 16);
                        dot.style.setProperty('background', listConfig.color, 'important');
                        dot.style.setProperty('box-shadow', `0 0 5px ${listConfig.color}`, 'important');
                        dot.style.setProperty('right', `${rightOffset}px`, 'important');
                        
                        card.appendChild(dot);

                        const borderThickness = index + 1; 
                        const glowSpread = index;
                        cardBoxShadows.push(`0 0 0 ${borderThickness}px ${listConfig.color}`);
                        cardBoxShadows.push(`0 0 5px ${glowSpread}px ${listConfig.color}`);
                    });

                    const finalShadow = cardBoxShadows.join(', ');
                    card.style.setProperty('border', '1px solid transparent', 'important');
                    card.style.setProperty('box-shadow', finalShadow, 'important');
                    card.style.setProperty('border-radius', '4px', 'important');
                }
            }
        });
    }

    // ==========================================
    // 🔄 ROUTEUR & DÉTECTION SPA
    // ==========================================
    function routeHandler() {
        const path = location.pathname;
        if (path.match(/\/anime\/(\d+)/)) {
            injectDetailBlocks();
        } else if (path.includes('/animelist')) {
            processListCards();
            processCustomListIndicators(); // Déclenche aussi les notifications
        }
    }

    const observer = new MutationObserver(() => { routeHandler(); });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('popstate', routeHandler);
    document.addEventListener('click', () => { setTimeout(routeHandler, 100); }, true);

    routeHandler();
})();