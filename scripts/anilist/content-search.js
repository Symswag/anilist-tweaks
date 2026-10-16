(function() {
    'use strict';

    /* ==========================================================================
       MODULE SEARCH BUTTONS HUB (Exécuté uniquement sur anilist.co via manifest)
       ========================================================================== */

    const SEARCH_CONFIG = [
        {
            order: 0,
            name: 'MyAnimeList',
            color: '#2e51a2',
            domain: 'https://myanimelist.net',
            getUrl: async ({ id, type }) => {
                if (!id) return null;
                const idMal = await fetchAnilistData(id, 'idMal');
                if (!idMal) return null;
                const mediaType = type === 'manga' ? 'manga' : 'anime';
                return {
                    url: `https://myanimelist.net/${mediaType}/${idMal}`,
                    isDirect: true
                };
            }
        },
        {
            order: 3,
            name: 'Anime News Network',
            color: '#0055a5',
            domain: 'https://www.animenewsnetwork.com',
            getUrl: ({ title }) => {
                if (!title) return null;
                return {
                    url: `https://www.animenewsnetwork.com/encyclopedia/search/name?q=${encodeURIComponent(title)}`,
                    isDirect: false
                };
            }
        },
        {
            order: 2,
            name: 'Nautiljon',
            color: '#ecb044',
            domain: 'https://www.nautiljon.com',
            getUrl: ({ title }) => {
                if (!title) return null;
                return {
                    url: `https://www.nautiljon.com/search.php?q=${encodeURIComponent(title)}`,
                    isDirect: false
                };
            }
        },
        {
            order: 1,
            name: 'Fandom Wiki',
            color: '#fa005a',
            domain: 'https://www.fandom.com',
            getUrl: ({ title }) => {
                if (!title) return null;
                return {
                    url: `https://www.google.com/search?q=${encodeURIComponent(title + ' wiki')}`,
                    isDirect: false
                };
            }
        }
    ];

    let currentMediaId = null;
    let waitForElements = null;

    /**
     * Extrait l'ID et le type de média (anime/manga) depuis l'URL
     */
    function getMediaInfoFromUrl() {
        const match = window.location.pathname.match(/\/(anime|manga)\/(\d+)/);
        if (!match) return null;
        return {
            type: match[1],
            id: parseInt(match[2], 10)
        };
    }

    /**
     * Récupère le titre anglais dans le DOM AniList avec un fallback sur le titre principal
     */
    function getAnilistTitleFromDOM() {
        const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type, .data-set .type'));
        const englishHeader = typeElements.find(el => el.textContent.trim() === 'English');
        if (englishHeader && englishHeader.nextElementSibling) {
            return englishHeader.nextElementSibling.textContent.trim();
        }
        const mainHeader = document.querySelector('h1');
        return mainHeader ? mainHeader.textContent.trim() : '';
    }

    /**
     * Exécute une requête GraphQL vers AniList pour récupérer un champ spécifique
     */
    async function fetchAnilistData(anilistId, field) {
        const query = `
            query ($id: Int) {
                Media(id: $id) {
                    ${field}
                }
            }
        `;

        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { id: anilistId }
                })
            });

            const data = await response.json();
            return data?.data?.Media?.[field] ?? null;
        } catch (error) {
            console.error('[Search Hub] Erreur API AniList :', error);
            return null;
        }
    }

    /**
     * Construit l'élément bouton DOM pour un site donné
     */
    function createLinkButton(site, { url, isDirect }) {
        const iconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.domain)}&size=16`;
        const defaultBg = isDirect ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
        const hoverBg = isDirect ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.1)';
        const statusIcon = isDirect ? '🔗' : '🔍';

        const btn = document.createElement('a');
        btn.href = url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: ${defaultBg};
            padding: 8px 12px;
            border-radius: 4px;
            color: #edf1f5;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            border-left: 4px solid ${site.color};
            transition: background 0.2s;
        `;

        btn.onmouseover = () => btn.style.background = hoverBg;
        btn.onmouseout = () => btn.style.background = defaultBg;

        btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${iconUrl}" width="16" height="16" style="display: block; border-radius: 2px;" alt="" />
                <span>Search on ${site.name}</span>
            </div>
            <span style="font-size: 11px; opacity: 0.6;">${statusIcon}</span>
        `;

        return btn;
    }

    async function buildSearchHub(sidebar, rankingsBox) {
        if (document.getElementById('fr-search-links-hub')) return;

        const mediaInfo = getMediaInfoFromUrl();
        const titleText = getAnilistTitleFromDOM();

        const container = document.createElement('div');
        container.id = 'fr-search-links-hub';
        container.style.cssText = `
            background: rgb(21, 31, 46);
            border-radius: 4px;
            padding: 12px;
            margin-top: 16px;
            margin-bottom: 16px;
            font-family: Overpass, -apple-system, BlinkMacSystemFont, Segoe UI, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        `;

        const title = document.createElement('h3');
        title.innerText = 'Search External Links';
        title.style.cssText = `
            color: rgb(159, 173, 189);
            font-size: 1.2rem;
            font-weight: 500;
            margin-bottom: 10px;
            margin-top: 0;
        `;
        container.appendChild(title);

        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const context = {
            id: mediaInfo?.id,
            type: mediaInfo?.type,
            title: titleText,
            sidebar
        };

        const sortedConfig = SEARCH_CONFIG.toSorted((a, b) => a.order - b.order);

        const buttonPromises = sortedConfig.map(async site => {
            if (typeof site.getUrl !== 'function') return null;
            const result = await site.getUrl(context);
            if (!result || !result.url) return null;
            return createLinkButton(site, result);
        });

        const buttons = await Promise.all(buttonPromises);
        buttons.filter(Boolean).forEach(btn => listContainer.appendChild(btn));

        container.appendChild(listContainer);

        const streamingContainer = document.getElementById('fr-streaming-platforms');
        if (streamingContainer) {
            streamingContainer.after(container);
        } else {
            sidebar.insertBefore(container, rankingsBox);
        }
    }

    function init(forceReset = false) {
        const mediaInfo = getMediaInfoFromUrl();
        if (!mediaInfo) return;

        if (forceReset) {
            currentMediaId = null;
        }

        if (mediaInfo.id === currentMediaId) return;
        currentMediaId = mediaInfo.id;

        if (waitForElements) clearInterval(waitForElements);

        const oldContainer = document.getElementById('fr-search-links-hub');
        if (oldContainer) oldContainer.remove();

        waitForElements = setInterval(() => {
            const sidebar = document.querySelector('.page-content .sidebar');
            const rankingsBox = document.querySelector('.page-content .sidebar .rankings');

            if (sidebar && rankingsBox) {
                clearInterval(waitForElements);
                setTimeout(() => {
                    buildSearchHub(sidebar, rankingsBox);
                }, 200);
            }
        }, 300);
    }

    // Navigation SPA
    init(false);
    window.addEventListener('popstate', () => init(true));

    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            if (window.location.pathname.includes('/anime/') || window.location.pathname.includes('/manga/')) {
                init(true);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();