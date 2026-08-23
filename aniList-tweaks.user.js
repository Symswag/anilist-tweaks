// ==UserScript==
// @name         AniList - Tweaks
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Ajoute des infos Supabase manquantes et des indicateurs de couleur pour les listes personnalisées
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

    // --- SUPABASE ---
    const SUPABASE_URL = 'SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY';
    const TABLE_NAME = 'anime_history';

    // --- ANILIST CUSTOM LISTS ---
    const ANILIST_USERNAME = "ANILIST_USERNAME";
    const LISTS_CONFIG = [
        // Tu peux ajouter d'autres listes ici :
        // { name: "Films", color: "#ff00ff" }
    ];

    // ==========================================
    // 🧠 VARIABLES D'ÉTAT
    // ==========================================
    // Page détaillée
    let lastPathname = location.pathname;
    let cachedCompletionDate = null;
    let hasFetchedForCurrentMedia = false;
    let isFetchingSingle = false;

    // Page Animelist
    let historyMapCache = null;
    let isFetchingMap = false;

    // Listes Personnalisées
    let customListsMapCache = null;
    let isFetchingCustomLists = false;

    // ==========================================
    // 🎨 STYLES CSS INJECTÉS
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- STYLES : DATES DE VISIONNAGE --- */
        .entry-card .title {
            overflow: visible !important;
        }

        .custom-watch-date-icon {
            position: absolute;
            bottom: 100%;
            margin-bottom: 8px;
            left: 10px;
            color: rgba(255, 255, 255, 0.95);
            z-index: 10;
            cursor: pointer;
            transition: color 0.2s, transform 0.2s;
            filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.9));
        }
        .custom-watch-date-icon:hover {
            color: #ffffff;
            transform: scale(1.1);
        }

        .custom-watch-date-icon::after {
            content: attr(label);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%) translateY(5px);
            background: #11161d;
            color: #9fadbd;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 1.2rem;
            font-weight: 600;
            font-family: Overpass, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, transform 0.2s;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            z-index: 9999;
        }
        .custom-watch-date-icon:hover::after {
            opacity: 1;
            visibility: visible;
            transform: translateX(-50%) translateY(-5px);
        }

        /* --- STYLES : POINTS DE LISTES PERSONNALISÉES --- */
        span.release-status.custom-list-dot {
            opacity: 1 !important;
            left: auto !important;
            top: -4px !important;
            width: 11px !important;
            height: 11px !important;
            border-radius: 50% !important;
            z-index: 50 !important;
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);


    // ==========================================
    // 🌐 REQUÊTES API
    // ==========================================

    // 1. SUPABASE : Page Détail (1 Anime)
    async function fetchSingleCompletionDate(mediaId) {
        if (isFetchingSingle || hasFetchedForCurrentMedia) return;
        isFetchingSingle = true;

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?media_id=eq.${mediaId}&select=completed_at`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const data = await res.json();

            if (data && data.length > 0) {
                cachedCompletionDate = new Date(data[0].completed_at);
            } else {
                cachedCompletionDate = null;
            }
        } catch (err) {
            console.error("❌ Erreur Supabase (Détail):", err);
            cachedCompletionDate = null;
        } finally {
            hasFetchedForCurrentMedia = true;
            isFetchingSingle = false;
            injectDetailBlocks();
        }
    }

    // 2. SUPABASE : Page Liste (Tous les Animes)
    async function fetchAllHistory() {
        if (historyMapCache) return historyMapCache;
        if (isFetchingMap) return null;
        isFetchingMap = true;

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=media_id,completed_at`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const data = await res.json();

            historyMapCache = new Map();
            if (data) {
                data.forEach(row => {
                    const dateObj = new Date(row.completed_at);
                    historyMapCache.set(row.media_id, dateObj);
                });
            }
        } catch (err) {
            console.error("❌ Erreur Supabase (Liste):", err);
        } finally {
            isFetchingMap = false;
        }
        return historyMapCache;
    }

    // 3. GRAPHQL : Listes Personnalisées AniList
    async function fetchCustomLists() {
        if (customListsMapCache) return customListsMapCache;
        if (isFetchingCustomLists) return null;
        isFetchingCustomLists = true;

        const query = `
        query {
          MediaListCollection(userName: "${ANILIST_USERNAME}", type: ANIME) {
            lists {
              name
              entries {
                mediaId
              }
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
                },
                body: JSON.stringify({ query })
            });

            const data = await res.json();
            const allLists = data.data.MediaListCollection.lists;

            customListsMapCache = new Map();

            LISTS_CONFIG.forEach(config => {
                const listData = allLists.find(list => list.name === config.name);
                if (listData) {
                    listData.entries.forEach(entry => {
                        const id = entry.mediaId;
                        if (!customListsMapCache.has(id)) {
                            customListsMapCache.set(id, []);
                        }
                        customListsMapCache.get(id).push(config);
                    });
                }
            });
        } catch (error) {
            console.error("❌ Erreur GraphQL (Custom Lists) :", error);
        } finally {
            isFetchingCustomLists = false;
        }

        return customListsMapCache;
    }


    // ==========================================
    // 🛠️ UTILITAIRES
    // ==========================================
    function dateGapToday(date) {
        if(!date) return;
        const dTargetClean = new Date(date);
        dTargetClean.setHours(0, 0, 0, 0);
        const dTodayClean = new Date();
        dTodayClean.setHours(0, 0, 0, 0);
        const diffTime = dTodayClean - dTargetClean;
        return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }


    // ==========================================
    // 🎨 INJECTIONS DOM
    // ==========================================

    // INJECTION 1 : Dates Supabase (Page de liste d'animes uniquement)
    async function processListCards() {
        const map = await fetchAllHistory();
        if (!map) return;

        const cards = document.querySelectorAll('.entry-card:not(.date-processed)');

        cards.forEach(card => {
            card.classList.add('date-processed');

            const titleDiv = card.querySelector('.title');
            if (!titleDiv) return;
            const titleLink = titleDiv.querySelector('a');
            if (!titleLink) return;
            const match = titleLink.getAttribute('href').match(/\/anime\/(\d+)/);
            if (!match) return;

            const mediaId = parseInt(match[1]);

            if (map.has(mediaId)) {
                const date = map.get(mediaId);
                const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const daysCount = dateGapToday(date);

                const iconDiv = document.createElement('div');
                iconDiv.className = 'custom-watch-date-icon';
                iconDiv.setAttribute('label', `Terminé le ${dateStr} (${daysCount}j)`);

                iconDiv.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-calendar-check-fill" viewBox="0 0 16 16">
                        <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2m-5.146-5.146-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708.708"/>
                    </svg>
                `;
                titleDiv.appendChild(iconDiv);
            }
        });
    }

    // INJECTION 2 : Blocs Détails (Page d'un anime)
    function injectDetailBlocks() {
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

        if (!hasFetchedForCurrentMedia) {
            fetchSingleCompletionDate(mediaId);
        }

        const relationsBlock = document.querySelector('.relations.small') || document.querySelector('.relations');
        if (!relationsBlock) return;

        // Blocs Genres (Intact)
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
                        title.style.fontSize = '1.4rem';
                        title.style.fontWeight = '700';
                        title.style.letterSpacing = '0.03em';
                        title.style.marginBottom = '12px';
                        title.style.color = 'var(--color-text-main)';
                        container.appendChild(title);

                        const tagsList = document.createElement('div');
                        tagsList.style.display = 'flex';
                        tagsList.style.flexWrap = 'wrap';
                        tagsList.style.gap = '8px';

                        cleanGenres.forEach(genre => {
                            const badge = document.createElement('a');
                            badge.href = genre.href;
                            badge.textContent = genre.name;
                            badge.style.display = 'inline-flex';
                            badge.style.alignItems = 'center';
                            badge.style.padding = '8px 16px';
                            badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)';
                            badge.style.color = 'var(--color-blue)';
                            badge.style.borderRadius = '6px';
                            badge.style.fontSize = '1.3rem';
                            badge.style.fontWeight = '600';
                            badge.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                            badge.style.textDecoration = 'none';

                            badge.addEventListener('mouseenter', () => {
                                badge.style.transform = 'translateY(-2px)';
                                badge.style.backgroundColor = 'var(--color-blue)';
                                badge.style.color = '#ffffff';
                                badge.style.boxShadow = '0 4px 12px rgba(61, 180, 242, 0.3)';
                            });
                            badge.addEventListener('mouseleave', () => {
                                badge.style.transform = 'translateY(0)';
                                badge.style.backgroundColor = 'rgba(61, 180, 242, 0.1)';
                                badge.style.color = 'var(--color-blue)';
                                badge.style.boxShadow = 'none';
                            });
                            tagsList.appendChild(badge);
                        });
                        container.appendChild(tagsList);
                        relationsBlock.parentNode.insertBefore(container, relationsBlock);
                    }
                }
            }
        }

        // Bloc Date (Intact)
        if (hasFetchedForCurrentMedia && !document.getElementById('custom-completion-date')) {
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
            dateContainer.appendChild(dateBadge);

            const genresBlock = document.getElementById('custom-quick-genres');
            if (genresBlock) {
                genresBlock.parentNode.insertBefore(dateContainer, genresBlock);
            } else {
                relationsBlock.parentNode.insertBefore(dateContainer, relationsBlock);
            }
        }
    }

    // INJECTION 3 : Points Listes Personnalisées (Seulement sur animelist)
    async function processCustomListIndicators() {
        const map = await fetchCustomLists();
        if (!map) return;

        const cards = document.querySelectorAll('.entry-card:not(.custom-lists-processed)');

        cards.forEach(card => {
            card.classList.add('custom-lists-processed');

            const link = card.querySelector('a[href*="/anime/"]');
            if (!link) return;

            const href = link.getAttribute('href');
            const match = href.match(/\/anime\/(\d+)/);

            if (match && match[1]) {
                const mediaId = parseInt(match[1], 10);

                if (map.has(mediaId)) {
                    const matchedLists = map.get(mediaId);

                    // Tableau qui va stocker toutes les ombres/bordures de la carte
                    let cardBoxShadows = [];

                    matchedLists.forEach((listConfig, index) => {
                        // --- 1. Création des POINTS ---
                        const dot = document.createElement('span');
                        dot.className = 'release-status custom-list-dot';
                        dot.title = listConfig.name;

                        // Décalage des points (-4px, puis 12px, 28px...)
                        const rightOffset = -4 + (index * 16);

                        dot.style.setProperty('background', listConfig.color, 'important');
                        dot.style.setProperty('box-shadow', `0 0 5px ${listConfig.color}`, 'important');
                        dot.style.setProperty('right', `${rightOffset}px`, 'important');

                        card.appendChild(dot);

                        // --- 2. Création des BORDURES MULTIPLES (via box-shadow) ---
                        // index 0 = 1px, index 1 = 2px, index 2 = 3px...
                        const borderThickness = index + 1;
                        const glowSpread = index; // Le halo s'étend de plus en plus

                        // On ajoute une "fausse bordure" très nette (0px de flou)
                        cardBoxShadows.push(`0 0 0 ${borderThickness}px ${listConfig.color}`);
                        // On ajoute un effet de halo (glow) autour (5px de flou)
                        cardBoxShadows.push(`0 0 5px ${glowSpread}px ${listConfig.color}`);
                    });

                    // --- 3. Application des styles sur la CARTE ---
                    // On fusionne toutes les ombres avec des virgules
                    const finalShadow = cardBoxShadows.join(', ');

                    // On ajoute une bordure transparente pour éviter que l'image ne se décale
                    card.style.setProperty('border', '1px solid transparent', 'important');
                    // On applique notre méga-ombre multicouches
                    card.style.setProperty('box-shadow', finalShadow, 'important');

                    // Optionnel : Arrondir très légèrement la carte pour que l'ombre épouse bien les bords
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
            // Page de détail d'un anime
            injectDetailBlocks();
        } else if (path.includes('/animelist')) {
            // Page de liste d'animes : On déclenche les deux fonctions ici !
            processListCards();
            processCustomListIndicators();
        }
    }

    const observer = new MutationObserver(() => {
        routeHandler();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('popstate', routeHandler);

    document.addEventListener('click', () => {
        setTimeout(routeHandler, 100);
    }, true);

    // Premier lancement
    routeHandler();
})();