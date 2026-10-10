(function() {
    'use strict';

    /* ==========================================================================
       6. MODULE SEARCH BUTTONS HUB (Exécuté uniquement sur anilist.co via manifest)
       ========================================================================== */

    const SEARCH_CONFIG = [
        {
            name: 'MyAnimeList',
            color: '#2e51a2',
            domain: 'https://myanimelist.net',
            keywords: ['myanimelist', 'mal'],
        },
        {
            name: 'Anime News Network',
            color: '#0055a5',
            domain: 'https://www.animenewsnetwork.com',
            baseUrl: 'https://www.animenewsnetwork.com/encyclopedia/search/name?q='
        },
        {
            name: 'Nautiljon',
            color: '#ecb044',
            domain: 'https://www.nautiljon.com',
            baseUrl: 'https://www.nautiljon.com/search.php?q='
        },
        {
            name: 'Fandom Wiki (Google)',
            color: '#fa005a',
            domain: 'https://www.fandom.com',
            baseUrl: 'https://www.google.com/search?q=',
            suffix: ' wiki'
        }
    ];

    let currentAnimeId = null;
    let waitForElements = null;

    function init(forceReset = false) {
        const match = window.location.pathname.match(/\/anime\/(\d+)/) || window.location.pathname.match(/\/manga\/(\d+)/);
        if (!match) return;

        const animeId = parseInt(match[1]);

        if (forceReset) {
            currentAnimeId = null;
        }

        if (animeId === currentAnimeId) return;
        currentAnimeId = animeId;

        if (waitForElements) clearInterval(waitForElements);

        const oldContainer = document.getElementById('fr-search-links-hub');
        if (oldContainer) oldContainer.remove();

        waitForElements = setInterval(() => {
            const sidebar = document.querySelector('.page-content .sidebar');
            const rankingsBox = document.querySelector('.page-content .sidebar .rankings');

            if (sidebar && rankingsBox) {
                clearInterval(waitForElements);

                let animeTitle = "";
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle && metaTitle.content) {
                    animeTitle = metaTitle.content.trim();
                } else {
                    animeTitle = document.title.replace(' · AniList', '').trim();
                }

                setTimeout(() => {
                    buildSearchHub(sidebar, rankingsBox, animeTitle);
                }, 200);
            }
        }, 300);
    }

    function buildSearchHub(sidebar, rankingsBox, animeTitle) {
        if (document.getElementById('fr-search-links-hub')) return;

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

        SEARCH_CONFIG.forEach(site => {
            let finalUrl;
            let isDirectLink = false;
            const iconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.domain)}&size=16`;

            if (site.keywords) {
                const allLinksInSidebar = Array.from(sidebar.querySelectorAll('a'))
                    .map(el => el.href.toLowerCase())
                    .filter(url => !url.includes('anilist.co/'));
                
                const foundLink = allLinksInSidebar.find(url => site.keywords.some(keyword => url.includes(keyword)));
                if (foundLink) {
                    finalUrl = foundLink;
                    isDirectLink = true;
                }
            }
            else if (site.baseUrl) {
                const queryText = animeTitle + (site.suffix || '');
                finalUrl = site.baseUrl + encodeURIComponent(queryText);
            }

            if (finalUrl) {
                const defaultBg = isDirectLink ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
                const hoverBg = isDirectLink ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.1)';
                
                const btn = document.createElement('a');
                btn.href = finalUrl;
                btn.target = '_blank';
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

                const statusIcon = isDirectLink ? '🔗' : '🔍';

                btn.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${iconUrl}" width="16" height="16" style="display: block; border-radius: 2px;" alt="" />
                        <span>Search on ${site.name}</span>
                    </div>
                    <span style="font-size: 11px; opacity: 0.6;">${statusIcon}</span>
                `;

                listContainer.appendChild(btn);
            }
        });

        container.appendChild(listContainer);

        // Insertion dans la sidebar
        const streamingContainer = document.getElementById('fr-streaming-platforms');
        if (streamingContainer) {
            streamingContainer.after(container);
        } else {
            sidebar.insertBefore(container, rankingsBox);
        }
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