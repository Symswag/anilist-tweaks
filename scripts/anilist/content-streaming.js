(function() {
    'use strict';

    /* ==========================================================================
       4. MODULE STREAMING HUB (Exécuté uniquement sur anilist.co via manifest)
       ========================================================================== */
    const STREAMING_CONFIG = [
        {
            name: 'WatchHentai',
            color: '#fcb900',
            keywords: [],
            domain: 'https://watchhentai.net',
            searchUrl: 'https://watchhentai.net/?s=',
            activationCondition: () => {
                const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type, .data-set .type'));
                const genreHeader = typeElements.find(el => el.textContent.trim() === 'Genres');
                if (genreHeader && genreHeader.nextElementSibling){
                    const genreLinks = Array.from(genreHeader.nextElementSibling.querySelectorAll('a'));
                    if (genreLinks.length > 0) if (genreLinks.map(link => ({ name: link.textContent.trim()})).filter(g => g.name === "Hentai").length > 0) return true;
                }
                return false;
            },
            animeTitle: () => {
                const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type, .data-set .type'));
                const nativeHeader = typeElements.find(el => el.textContent.trim() === 'Native');
                if (nativeHeader && nativeHeader.nextElementSibling){
                    const nativeTitle = nativeHeader.nextElementSibling.textContent.trim();
                    console.log(nativeTitle);
                    return nativeTitle;
                }
                return '';
            }
        },
        {
            name: 'Crunchyroll',
            color: '#ff6600',
            keywords: ['crunchyroll'],
            domain: 'https://www.crunchyroll.com',
            searchUrl: 'https://www.crunchyroll.com/fr/search?q='
        },
        {
            name: 'ADN',
            color: '#00aae4',
            keywords: ['adn', 'animationdigitalnetwork'],
            domain: 'https://animationdigitalnetwork.com',
            searchUrl: 'https://animationdigitalnetwork.com/video?search='
        },
        {
            name: 'Netflix',
            color: '#e50914',
            keywords: ['netflix'],
            domain: 'https://www.netflix.com',
            searchUrl: 'https://www.netflix.com/search?q='
        },
        {
            name: 'Disney+',
            color: '#00FF00',
            keywords: ['disney', 'disneyplus'],
            domain: 'https://www.disneyplus.com',
            searchUrl: 'https://www.disneyplus.com/search?q='
        },
        {
            name: 'VoirAnime',
            color: '#ffffff',
            keywords: [],
            domain: 'https://voir-anime.to',
            searchUrl: 'https://voir-anime.to/?post_type=wp-manga&s='
        },
        {
            name: 'Anime-sama',
            color: '#000000',
            keywords: [],
            domain: 'https://anime-sama.to',
            searchUrl: 'https://anime-sama.to/catalogue/?search='
        },
        {
            name: 'FRAnime',
            color: '#ea1d2e',
            keywords: [],
            domain: 'https://franime.fr',
            searchUrl: 'https://franime.fr/recherche?search='
        }
    ];

    let currentAnimeId = null;
    let waitForElements = null;

    function init(forceReset = false) {
        const match = window.location.pathname.match(/\/anime\/(\d+)/);
        if (!match) return;

        const animeId = parseInt(match[1]);

        if (forceReset) {
            currentAnimeId = null;
        }

        if (animeId === currentAnimeId) return;
        currentAnimeId = animeId;

        if (waitForElements) clearInterval(waitForElements);

        const oldContainer = document.getElementById('fr-streaming-platforms');
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
                    buildHub(sidebar, rankingsBox, animeTitle);
                }, 200);
            }
        }, 300);
    }

    function buildHub(sidebar, rankingsBox, animeTitle) {
        if (document.getElementById('fr-streaming-platforms')) return;

        const encodedTitle = encodeURIComponent(animeTitle);
        
        const allLinksInSidebar = Array.from(sidebar.querySelectorAll('a'))
            .map(el => el.href.toLowerCase())
            .filter(url => !url.includes('anilist.co/'));

        const container = document.createElement('div');
        container.id = 'fr-streaming-platforms';
        container.style.cssText = `
            background: rgb(21, 31, 46);
            border-radius: 4px;
            padding: 12px;
            margin-top: 16px;
            margin-bottom: 16px;
            font-family: Overpass, -apple-system, BlinkMacSystemFont, Segoe UI, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        `;

        const title = document.createElement('h3');
        title.innerText = 'Where to watch?';
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

        STREAMING_CONFIG.forEach(site => {
            if (typeof site.activationCondition === 'function' && !site.activationCondition()) return;
            let finalUrl = '';
            let isDirectLink = false;
            const iconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.domain)}&size=16`;

            const directLinkFound = allLinksInSidebar.find(url =>
                site.keywords.some(keyword => url.includes(keyword))
            );

            if (typeof site.animeTitle === 'function'){
                finalUrl = site.searchUrl + encodeURIComponent(site.animeTitle());
            } else if (directLinkFound) {
                finalUrl = directLinkFound;
                isDirectLink = true;
            } else if (site.searchUrl) {
                finalUrl = site.searchUrl + encodedTitle;
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

                const labelText = isDirectLink ? `Watch on ${site.name}` : `Search on ${site.name}`;
                const statusIcon = isDirectLink ? '🔗' : '🔍';

                btn.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${iconUrl}" width="16" height="16" style="display: block; border-radius: 2px;" alt="" />
                        <span>${labelText}</span>
                    </div>
                    <span style="font-size: 11px; opacity: 0.6;">${statusIcon}</span>
                `;

                listContainer.appendChild(btn);
            }
        });

        container.appendChild(listContainer);
        sidebar.insertBefore(container, rankingsBox);
    }

    // Gestion de la navigation SPA Vue.js
    init(false);
    window.addEventListener('popstate', () => init(true));

    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            if (window.location.pathname.includes('/anime/')) {
                init(true);
            }
            else {
                const oldContainer = document.getElementById('fr-streaming-platforms');
                if (oldContainer) oldContainer.remove();
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();