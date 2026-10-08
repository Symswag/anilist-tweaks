(function() {
    'use strict';

    /* ==========================================================================
       6. MODULE SEARCH BUTTONS (Exécuté uniquement sur anilist.co via manifest)
       ========================================================================== */

    function injectButtons() {
        const h1 = document.querySelector('h1');

        // On vérifie si le h1 existe et si nos boutons ne sont pas déjà présents
        if (h1 && !document.querySelector('.custom-search-links')) {

            // Récupération du titre pur (premier nœud de texte)
            const animeTitle = h1.childNodes[0].textContent.trim();
            if (!animeTitle) return;

            // Création d'un conteneur global pour nos boutons
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-search-links';
            wrapper.style.float = 'right';
            wrapper.style.display = 'flex';
            wrapper.style.gap = '5px'; // Espace entre les deux icônes
            wrapper.style.marginLeft = '5px';
            wrapper.style.userSelect = 'none';

            // --- CONFIGURATION DES BOUTONS ---
            const buttons = [
                {
                    title: 'Rechercher sur ANN',
                    url: `https://www.animenewsnetwork.com/encyclopedia/search/name?q=${encodeURIComponent(animeTitle)}`,
                    icon: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.animenewsnetwork.com&size=16'
                },
                {
                    title: 'Rechercher sur Nautiljon',
                    url: `https://www.nautiljon.com/search.php?q=${encodeURIComponent(animeTitle)}`,
                    icon: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.nautiljon.com&size=16'
                },
                {
                    title: 'Rechercher Wiki (Google)',
                    url: `https://www.google.com/search?q=${encodeURIComponent(animeTitle + " wiki")}`,
                    icon: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.fandom.com&size=16'
                }
            ];

            // Création et ajout de chaque bouton au wrapper
            buttons.forEach(btn => {
                const link = document.createElement('a');
                link.href = btn.url;
                link.target = '_blank';
                link.title = btn.title;
                link.style.display = 'flex';
                link.style.alignItems = 'center';

                const img = document.createElement('img');
                img.src = btn.icon;
                img.width = '16';
                img.height = '16';
                img.style.display = 'block';

                link.appendChild(img);
                wrapper.appendChild(link);
            });

            // Insertion du wrapper dans le h1
            h1.appendChild(wrapper);
        }
    }

    // --- GESTION DE LA NAVIGATION (Optimisée) ---
    let lastUrl = location.href;

    function checkAndInject() {
        // On s'assure d'être sur une page anime avant de faire quoi que ce soit
        if (!window.location.href.includes('/anime/')) return;

        // Si l'URL a changé, on nettoie pour forcer ta fonction à recréer les boutons
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            const oldWrapper = document.querySelector('.custom-search-links');
            if (oldWrapper) oldWrapper.remove();
        }

        // On utilise un try/catch pour éviter qu'une erreur bloque la page si le
        // texte du h1 n'est pas encore complètement généré par le site.
        try {
            injectButtons();
        } catch (e) {
            // Silence en cas d'erreur de chargement (le MutationObserver relancera de toute façon)
        }
    }

    // Le MutationObserver surveille les changements invisibles dans le code de la page.
    const observer = new MutationObserver(() => {
        checkAndInject();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Lancement initial
    checkAndInject();
})();