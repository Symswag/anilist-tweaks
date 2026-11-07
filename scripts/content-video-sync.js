(function() {
    'use strict';

    // =========================================================================
    // 3. MODULE ANILIST DATE (Exécuté sur <all_urls> et iframes)
    // =========================================================================

    // On récupère la configuration depuis le popup de l'extension
    chrome.storage.sync.get({
        supabaseUrl: '',
        supabaseKey: '',
        tableName: 'anime_history',
        anilistUsername: 'Symswag',
        spinnerDuration: 3,
        removeList: 'Close At Hand', // Liste par défaut
        anilistToken: '',
    }, function(config) {
        
        const SUPABASE_URL = config.supabaseUrl;
        const SUPABASE_ANON_KEY = config.supabaseKey;
        const TABLE_NAME = config.tableName;
        const TARGET_USERNAME = config.anilistUsername;
        const REMOVE_LIST = config.removeList;
        const ANILIST_TOKEN = config.anilistToken;
        
        // Si les identifiants Supabase ne sont pas configurés, on stoppe tout
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

        const spinnerDuration = config.spinnerDuration || 3;
        const TRIGGER_PERCENTAGE = 91;
        const PROGRESS_COLOR = "#00FFFF";
        const FINISH_COLOR = "#3ECF8E";

        const SUPPORTED_SITES = [
            { name: 'Crunchyroll', domain: 'crunchyroll.com', videoSelector: 'video' },
            { name: 'ADN', domain: 'animationdigitalnetwork.com', videoSelector: 'video' },
            { name: 'Voir-anime', domain: 'voir-anime.to', videoSelector: 'video', isIframe: true },
            { name: 'Anime-Sama', domain: 'anime-sama.to', videoSelector: 'video', isIframe: true },
        ];

        const style = document.createElement('style');
        style.innerHTML = `
            #ad-countdown-overlay { position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-radius: 50%; background: rgba(14, 15, 18, 0.95); display: flex; align-items: center; justify-content: center; z-index: 2147483647; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.6); opacity: 0; visibility: hidden; transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s; transform: scale(0.8); pointer-events: none; }
            #ad-countdown-overlay.ad-show { opacity: 1; visibility: visible; transform: scale(1); }
            .ad-spinner { position: absolute; width: 100%; height: 100%; transform: rotate(-90deg); }
            .ad-spinner-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 4; }
            .ad-spinner-progress { fill: none; stroke: #00ffff; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 126; stroke-dashoffset: 0; transition: stroke-dashoffset 3s linear; }
            #ad-countdown-number { color: #00ffff; font-size: 18px; font-weight: bold; font-family: "Segoe UI", Roboto, sans-serif; z-index: 2; background: transparent !important; box-shadow: none !important; border: none !important; }
        `;
        document.head.appendChild(style);

        function showSpinnerAndSync(videoElement) {
            let cd = document.getElementById('ad-countdown-overlay');
            if (!cd) {
                cd = document.createElement('div');
                cd.id = 'ad-countdown-overlay';
                cd.innerHTML = `
                    <svg class="ad-spinner" viewBox="0 0 50 50">
                        <circle class="ad-spinner-bg" cx="25" cy="25" r="20"></circle>
                        <circle class="ad-spinner-progress" cx="25" cy="25" r="20"></circle>
                    </svg>
                    <span id="ad-countdown-number">${spinnerDuration}</span>
                `;

                let videoWrapper = videoElement.closest('[data-testid="vilos-player"]') || videoElement.parentNode;
                if (videoWrapper.tagName === 'BODY' || videoWrapper.tagName === 'HTML') {
                    videoWrapper = document.body;
                }
                videoWrapper.appendChild(cd);
            }

            const progressCircle = cd.querySelector('.ad-spinner-progress');
            const countdownSpan = cd.querySelector('#ad-countdown-number');
            const totalLength = 2 * Math.PI * 20;
            let timeLeft = spinnerDuration;

            countdownSpan.innerText = timeLeft;
            countdownSpan.style.color = PROGRESS_COLOR;
            progressCircle.style.stroke = PROGRESS_COLOR;

            progressCircle.style.strokeDasharray = totalLength;

            progressCircle.style.transition = 'none';
            progressCircle.style.strokeDashoffset = 0;

            void progressCircle.getBoundingClientRect();

            progressCircle.style.transition = `stroke-dashoffset ${spinnerDuration}s linear`;
            progressCircle.style.strokeDashoffset = totalLength;

            cd.classList.add('ad-show');

            const interval = setInterval(() => {
                timeLeft--;
                if (timeLeft >= 0) {
                    countdownSpan.innerText = timeLeft;
                }

                if (timeLeft <= 0) {
                    clearInterval(interval);
                    countdownSpan.innerText = "✓";
                    countdownSpan.style.color = FINISH_COLOR;
                    
                    progressCircle.style.transition = 'stroke-dashoffset 0.5s linear, stroke 0.5s linear';
                    progressCircle.style.strokeDashoffset = 0;
                    progressCircle.style.stroke = FINISH_COLOR;

                    syncAniListToSupabase();

                    setTimeout(() => {
                        cd.classList.remove('ad-show');
                    }, 2000);
                }
            }, 1000);
        }

        // Fonction pour retirer automatiquement l'anime de la liste
        async function removeFromCloseAtHandList(mediaId) {
            if (!REMOVE_LIST || !ANILIST_TOKEN) {
                if (!ANILIST_TOKEN) console.warn("⚠️ Token AniList manquant pour exécuter la mutation.");
                return;
            }

            try {
                // 1. On récupère les listes personnalisées actuelles de l'anime pour l'utilisateur
                const data = await window.anilistApi.getAnimeData(mediaId);
                const customLists = data?.mediaList?.customLists;

                if (customLists) {
                    // Si l'anime est coché dans la liste cible
                    if (customLists[REMOVE_LIST] === true) {
                        const activeCustomLists = Object.keys(customLists).filter(listName => customLists[listName] === true && listName !== REMOVE_LIST);

                        // 2. On envoie la mutation GraphQL avec l'en-tête d'authentification
                        const mutation = `
                            mutation ($mediaId: Int, $customLists: [String]) {
                                SaveMediaListEntry(mediaId: $mediaId, customLists: $customLists) {
                                    id
                                    customLists
                                }
                            }
                        `;

                        const mutRes = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json', 
                                'Accept': 'application/json',
                                'Authorization': `Bearer ${ANILIST_TOKEN}`
                            },
                            body: JSON.stringify({
                                query: mutation,
                                variables: {
                                    mediaId: mediaId,
                                    customLists: activeCustomLists
                                }
                            })
                        });

                        if (mutRes.ok) {
                            console.log(`✅ Retiré de la liste "${REMOVE_LIST}" avec succès.`);
                        } else {
                            console.error("❌ Erreur lors de la mutation AniList :", await mutRes.text());
                        }
                    }
                }
            } catch (err) {
                console.error(`Erreur lors du retrait de la liste ${REMOVE_LIST}:`, err);
            }
        }

        async function syncAniListToSupabase() {
            try {
                const userQuery = `query ($name: String) { User(name: $name) { id } }`;
                const userRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: userQuery, variables: { name: TARGET_USERNAME } })
                });
                const userData = await userRes.json();
                const userId = userData.data.User.id;

                const activityQuery = `
                    query ($userId: Int) {
                      Page(page: 1, perPage: 15) {
                        activities(userId: $userId, type: MEDIA_LIST, sort: ID_DESC) {
                          ... on ListActivity { status createdAt media { id } }
                        }
                      }
                    }
                `;
                const activityRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: activityQuery, variables: { userId: userId } })
                });
                const activityData = await activityRes.json();
                const activities = activityData.data.Page.activities;

                const filteredActivities = activities.filter(act =>
                    act.status === 'completed' || act.status === 'rewatched'
                );

                if (filteredActivities.length === 0) return;

                const mediaIds = filteredActivities.map(act => act.media.id).join(',');
                let existingData = [];

                const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?media_id=in.(${mediaIds})&select=media_id,completed_at`, {
                    method: 'GET',
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                });

                if (checkRes.ok) existingData = await checkRes.json();

                const existingDatesMap = {};
                existingData.forEach(row => {
                    existingDatesMap[row.media_id] = new Date(row.completed_at).getTime();
                });

                const supabasePayload = [];
                for (const act of filteredActivities) {
                    const newDateObj = new Date(act.createdAt * 1000);
                    const newTime = newDateObj.getTime();
                    const existingTime = existingDatesMap[act.media.id];

                    if (!existingTime || newTime > existingTime) {
                        supabasePayload.push({
                            media_id: act.media.id,
                            completed_at: newDateObj.toISOString()
                        });

                        // On tente d'enlever l'anime de la liste "Close At Hand"
                        await removeFromCloseAtHandList(act.media.id);
                    }
                }

                if (supabasePayload.length === 0) return;

                const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(supabasePayload)
                });

                if (!supabaseRes.ok) throw new Error('Erreur Supabase');

            } catch (error) {
                console.error("❌ Erreur de synchronisation :", error);
            }
        }

        function initVideoWatcher(siteConfig) {
            let hasTriggeredForThisEpisode = false;
            
            const observer = new MutationObserver(() => {
                const video = document.querySelector(siteConfig.videoSelector);

                if (video && !video.dataset.syncAttached) {
                    video.dataset.syncAttached = "true";

                    video.addEventListener('loadeddata', () => {
                        hasTriggeredForThisEpisode = false;
                    });

                    video.addEventListener('timeupdate', () => {
                        if (hasTriggeredForThisEpisode || !video.duration) return;
                        
                        const progress = (video.currentTime / video.duration) * 100;

                        if (progress >= TRIGGER_PERCENTAGE) {
                            hasTriggeredForThisEpisode = true;
                            showSpinnerAndSync(video);
                        }
                    });
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        const currentDomain = window.location.hostname;
        let matchedSite = SUPPORTED_SITES.find(site => currentDomain.includes(site.domain));

        if (!matchedSite && window !== window.top) {
            const currentReferrer = document.referrer;
            matchedSite = SUPPORTED_SITES.find(site => site.isIframe && currentReferrer.includes(site.domain));
        }

        if (matchedSite) {
            initVideoWatcher(matchedSite);
        }

        function createSyncButton() {
            try {
                const parsedUrl = new URL(window.location.href);

                if (parsedUrl.origin === 'https://anilist.co' && parsedUrl.pathname.startsWith('/user/' + TARGET_USERNAME)) {
                    // Évite la création de boutons en double si la fonction ré-exécute
                    if (document.getElementById('custom-supabase-sync-btn')) return;

                    // Inscription des keyframes pour l'animation de rotation (spinner)
                    if (!document.getElementById('sync-btn-styles')) {
                        const styleNode = document.createElement('style');
                        styleNode.id = 'sync-btn-styles';
                        styleNode.textContent = `
                            @keyframes spinSync { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        `;
                        document.head.appendChild(styleNode);
                    }

                    const btn = document.createElement('button');
                    btn.id = 'custom-supabase-sync-btn';

                    // Style moderne accordé au thème sombre AniList
                    btn.style.cssText = `
                        position: fixed;
                        bottom: 24px;
                        right: 24px;
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 18px;
                        background: #151f2e;
                        color: #3db4f2;
                        border: 1px solid #3db4f2;
                        border-radius: 8px;
                        font-size: 1.2rem;
                        font-weight: 600;
                        font-family: Overpass, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
                        cursor: pointer;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        user-select: none;
                    `;

                    // SVG des différentes icônes d'état
                    const syncIcon = `<svg id="sync-icon" style="width: 16px; height: 16px; fill: currentColor; transition: transform 0.3s ease;" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
                    const checkIcon = `<svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
                    const errorIcon = `<svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

                    const setBtnContent = (iconSvg, text) => {
                        btn.innerHTML = `${iconSvg}<span>${text}</span>`;
                    };

                    setBtnContent(syncIcon, 'Sync to Supabase');

                    // Effets au survol (Hover / Leave)
                    btn.addEventListener('mouseenter', () => {
                        if (!btn.disabled) {
                            btn.style.background = '#3db4f2';
                            btn.style.color = '#ffffff';
                            btn.style.transform = 'translateY(-2px)';
                            btn.style.boxShadow = '0 6px 20px rgba(61, 180, 242, 0.4)';
                        }
                    });

                    btn.addEventListener('mouseleave', () => {
                        if (!btn.disabled) {
                            resetBtnStyle();
                        }
                    });

                    // Gestion du Clic Async avec Animations & Confirmation
                    btn.addEventListener('click', async () => {
                        if (btn.disabled) return;

                        // 1. État : Chargement / Synchronisation
                        btn.disabled = true;
                        btn.style.cursor = 'wait';
                        btn.style.transform = 'translateY(0)';
                        setBtnContent(syncIcon, 'Synchronisation...');

                        const iconEl = btn.querySelector('#sync-icon');
                        if (iconEl) iconEl.style.animation = 'spinSync 1s linear infinite';

                        try {
                            // Attente de l'exécution de ta fonction de synchronisation
                            await syncAniListToSupabase();

                            // 2. État : Confirmation de Succès
                            btn.style.background = 'rgba(62, 207, 142, 0.2)';
                            btn.style.color = '#3ecf8e';
                            btn.style.borderColor = '#3ecf8e';
                            btn.style.boxShadow = '0 0 15px rgba(62, 207, 142, 0.3)';
                            setBtnContent(checkIcon, 'Synchro réussie !');

                            // Retour à l'état initial après 2,5 secondes
                            setTimeout(() => { resetBtnState(); }, 2500);

                        } catch (err) {
                            console.error("❌ Erreur lors de la synchronisation Supabase :", err);

                            // 3. État : Erreur
                            btn.style.background = 'rgba(229, 82, 82, 0.2)';
                            btn.style.color = '#e55252';
                            btn.style.borderColor = '#e55252';
                            btn.style.boxShadow = '0 0 15px rgba(229, 82, 82, 0.3)';
                            setBtnContent(errorIcon, 'Erreur de synchro');

                            // Retour à l'état initial après 3 secondes
                            setTimeout(() => { resetBtnState(); }, 3000);
                        }
                    });

                    function resetBtnStyle() {
                        btn.style.background = '#151f2e';
                        btn.style.color = '#3db4f2';
                        btn.style.borderColor = '#3db4f2';
                        btn.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.4)';
                        btn.style.transform = 'translateY(0)';
                    }

                    function resetBtnState() {
                        btn.disabled = false;
                        btn.style.cursor = 'pointer';
                        resetBtnStyle();
                        setBtnContent(syncIcon, 'Sync to Supabase');
                    }

                    document.body.appendChild(btn);
                }
                else {
                    const existingBtn = document.getElementById('custom-supabase-sync-btn');
                    if (existingBtn) existingBtn.remove();
                }
            } catch (error) {
                console.error("❌ Erreur lors du parsing de l'URL :", error);
            }
        }

        // On crée le bouton de synchronisation sur la page AniList
        createSyncButton();

        const createButtonObserver = new MutationObserver(() => {
            createSyncButton();
        });

        createButtonObserver.observe(document.body, { childList: true, subtree: true });
    });

})();