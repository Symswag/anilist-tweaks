(function() {
    'use strict';

    /* ==========================================================================
       4. MODULE STREAMING HUB (Exécuté uniquement sur anilist.co via manifest)
       ========================================================================== */

    /**
     * Génère la configuration standard d'un site de streaming
     */
    function createStreamingSite({ name, color, domain, searchUrl, keywords = [] }) {
        return {
            name,
            color,
            domain,
            getUrl: ({ title, findDirectLink }) => {
                const directLink = findDirectLink(keywords);
                if (directLink) {
                    return { url: directLink, isDirect: true };
                }
                if (!title || !searchUrl) return null;
                return {
                    url: `${searchUrl}${encodeURIComponent(title)}`,
                    isDirect: false
                };
            }
        };
    }

    const STREAMING_CONFIG = [
        {
            name: 'WatchHentai',
            color: '#fcb900',
            domain: 'https://watchhentai.net',
            shouldDisplay: ({ genres }) => genres.includes('Hentai'),
            getUrl: ({ nativeTitle, title }) => {
                const query = nativeTitle || title;
                if (!query) return null;
                return {
                    url: `https://watchhentai.net/?s=${encodeURIComponent(query)}`,
                    isDirect: false
                };
            }
        },
        createStreamingSite({
            name: 'Crunchyroll',
            color: '#ff6600',
            domain: 'https://www.crunchyroll.com',
            searchUrl: 'https://www.crunchyroll.com/fr/search?q=',
            keywords: ['crunchyroll']
        }),
        createStreamingSite({
            name: 'ADN',
            color: '#00aae4',
            domain: 'https://animationdigitalnetwork.com',
            searchUrl: 'https://animationdigitalnetwork.com/video?search=',
            keywords: ['adn', 'animationdigitalnetwork']
        }),
        createStreamingSite({
            name: 'Netflix',
            color: '#e50914',
            domain: 'https://www.netflix.com',
            searchUrl: 'https://www.netflix.com/search?q=',
            keywords: ['netflix']
        }),
        createStreamingSite({
            name: 'Disney+',
            color: '#00FF00',
            domain: 'https://www.disneyplus.com',
            searchUrl: 'https://www.disneyplus.com/search?q=',
            keywords: ['disney', 'disneyplus']
        }),
        createStreamingSite({
            name: 'VoirAnime',
            color: '#ffffff',
            domain: 'https://voir-anime.to',
            searchUrl: 'https://voir-anime.to/?post_type=wp-manga&s='
        }),
        createStreamingSite({
            name: 'Anime-sama',
            color: '#000000',
            domain: 'https://anime-sama.to',
            searchUrl: 'https://anime-sama.to/catalogue/?search='
        }),
        createStreamingSite({
            name: 'FRAnime',
            color: '#ea1d2e',
            domain: 'https://franime.fr',
            searchUrl: 'https://franime.fr/recherche?search='
        })
    ];

    let currentAnimeId = null;
    let waitForElements = null;

    /**
     * Extrait l'ID de l'anime depuis l'URL
     */
    function getAnimeIdFromUrl() {
        const match = window.location.pathname.match(/\/anime\/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Extrait la valeur associée à un libellé dans la sidebar DOM (ex: 'Native')
     */
    function getSidebarDataValue(label) {
        const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type, .data-set .type'));
        const header = typeElements.find(el => el.textContent.trim() === label);
        return header && header.nextElementSibling ? header.nextElementSibling.textContent.trim() : '';
    }

    /**
     * Récupère la liste des genres de l'œuvre affichée
     */
    function getGenresFromDOM() {
        const typeElements = Array.from(document.querySelectorAll('.data-set.data-list .type, .data-set .type'));
        const genreHeader = typeElements.find(el => el.textContent.trim() === 'Genres');
        if (!genreHeader || !genreHeader.nextElementSibling) return [];
        return Array.from(genreHeader.nextElementSibling.querySelectorAll('a'))
            .map(el => el.textContent.trim());
    }

    /**
     * Récupère le titre principal de l'anime
     */
    function getAnimeTitleFromDOM() {
        return getSidebarDataValue("English") || getSidebarDataValue("Romaji");
    }

    /**
     * Extrait les liens externes de la sidebar
     */
    function getSidebarLinks(sidebar) {
        if (!sidebar) return [];
        return Array.from(sidebar.querySelectorAll('a'))
            .map(el => el.href.toLowerCase())
            .filter(url => !url.includes('anilist.co/'));
    }

    /**
     * Construit le bouton HTML pour une plateforme donnée
     */
    function createLinkButton(site, { url, isDirect }) {
        const iconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.domain)}&size=16`;
        const defaultBg = isDirect ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
        const hoverBg = isDirect ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.1)';
        const labelText = isDirect ? `Watch on ${site.name}` : `Search on ${site.name}`;
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
                <span>${labelText}</span>
            </div>
            <span style="font-size: 11px; opacity: 0.6;">${statusIcon}</span>
        `;

        return btn;
    }

    function buildHub(sidebar, rankingsBox) {
        if (document.getElementById('fr-streaming-platforms')) return;

        const sidebarLinks = getSidebarLinks(sidebar);

        const context = {
            title: getAnimeTitleFromDOM(),
            nativeTitle: getSidebarDataValue('Native'),
            genres: getGenresFromDOM(),
            sidebarLinks,
            findDirectLink: (keywords) => {
                if (!keywords || keywords.length === 0) return null;
                return sidebarLinks.find(url => keywords.some(kw => url.includes(kw.toLowerCase()))) || null;
            }
        };

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
            if (typeof site.shouldDisplay === 'function' && !site.shouldDisplay(context)) {
                return;
            }

            if (typeof site.getUrl !== 'function') return;
            
            const result = site.getUrl(context);
            if (!result || !result.url) return;
            
            const btn = createLinkButton(site, result);
            listContainer.appendChild(btn);
        });

        container.appendChild(listContainer);
        sidebar.insertBefore(container, rankingsBox);
    }

    function init(forceReset = false) {
        const animeId = getAnimeIdFromUrl();
        if (!animeId) return;

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
                setTimeout(() => {
                    buildHub(sidebar, rankingsBox);
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
            if (window.location.pathname.includes('/anime/')) {
                init(true);
            } else {
                const oldContainer = document.getElementById('fr-streaming-platforms');
                if (oldContainer) oldContainer.remove();
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();