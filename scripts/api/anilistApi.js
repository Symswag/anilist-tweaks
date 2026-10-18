/* ==========================================================================
   ANILIST API MODULE (Exécuté via content_scripts)
   ========================================================================== */

(function () {
    'use strict';

    // Cache mémoire global pour les promesses (dédoublonnage des requêtes)
    const apiCache = new Map();

    const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
    const anilistUserId  = chrome.storage.sync.get('anilistUserId');

    /* ==========================================================================
        1. QUERIES GRAPHQL OPTIMISÉES & REGROUPÉES
        ========================================================================== */

    // Requête 1: Page média + statut utilisateur connecté + options Viewer + utilisateur secondaire
    const ANIME_PAGE_QUERY = `
    query isExpanded($mediaId: Int) {
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
            idMal
            episodes
            status
            title {
                userPreferred
                romaji
                english
            }
            coverImage {
                large
                medium
            }
            nextAiringEpisode {
                episode
                timeUntilAiring
                airingAt
            }
            season
            seasonYear
            mediaListEntry {
                id
                status
                progress
                repeat
                score(format: POINT_100)
                customLists
            }
        }
    }
    `;

    // Requête 2: Profil Utilisateur + Flux d'activités (Exécuté en un seul appel)
    const ACTIVITIES_QUERY = `
    query GetUserActivities($userId: Int) {
        Page(page: 1, perPage: 15) {
            activities(userId: $userId, type: MEDIA_LIST, sort: ID_DESC) {
                ... on ListActivity {
                    id
                    status
                    progress
                    createdAt
                    media {
                        id
                        title {
                        userPreferred
                        }
                    }
                }
            }
        }
    }
    `;

    // Requête 3: Utilisateur
    const USER_QUERY = `
    query GetUserActivities($userName: String) {
        User(name: $userName) {
            id
            name
            avatar {
                medium
            }
        }
    }
    `;

    // Requête 4: Collection complète d'un utilisateur
    const USER_COLLECTION_QUERY = `
    query GetUserCollection($userName: String) {
        MediaListCollection(userName: $userName, type: ANIME) {
            lists {
                name
                isCustomList
                entries {
                    mediaId
                    status
                    progress
                    score(format: POINT_100)
                    media {
                        id
                        idMal
                        status
                        episodes
                        title {
                            userPreferred
                        }
                        coverImage {
                            medium
                        }
                        nextAiringEpisode {
                            episode
                            timeUntilAiring
                        }
                    }
                }
            }
        }
    }
    `;

    /* ==========================================================================
        2. FONCTION CORE DU FETCH API
        ========================================================================== */

    /**
     * Exécute une requête GraphQL vers AniList avec gestion de cache et d'en-tête Auth.
     */
    async function executeGraphQL(query, variables = {}, cacheKey = null, token = null) {
        // 1. Si une clé de cache est fournie et qu'une promesse existe déjà, on la renvoie
        if (cacheKey && apiCache.has(cacheKey)) {
            return apiCache.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            // Si aucun token n'est passé explicitement, tenter de le lire depuis le chrome.storage
            let authToken = token;
            if (!authToken && typeof chrome !== 'undefined' && chrome.storage?.local) {
                const stored = await chrome.storage.sync.get(['anilistToken']);
                authToken = stored.anilistToken;
            }

            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(ANILIST_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ query, variables })
            });

            const json = await response.json();

            if (!response.ok || json.errors) {
                console.error('[AniList API Error]', json.errors || response.statusText);
                throw new Error(json.errors?.[0]?.message || `Erreur HTTP ${response.status}`);
            }

            return json.data;
            } catch (error) {
            // En cas d'erreur, supprimer du cache pour permettre une rétentative ultérieure
            if (cacheKey) apiCache.delete(cacheKey);
            throw error;
            }
        })();

        if (cacheKey) {
            apiCache.set(cacheKey, fetchPromise);
        }

        return fetchPromise;
    }

    /* ==========================================================================
        3. MÉTHODES PUBLIQUES
        ========================================================================== */

    /**
     * Récupère toutes les données nécessaires sur un média (Média + Entry + Viewer + MediaList optionnel)
     * @param {number|string} mediaId - L'ID AniList du média
     * @param {string|null} targetUserName - Pseudo optionnel d'un autre utilisateur
     */
    async function getAnimeData(mediaId, targetUserName = null) {
        const numericId = Number(mediaId);
        if (!numericId) return null;

        const cacheKey = `anime_${numericId}_${targetUserName || 'self'}`;

        try {
            const data = await executeGraphQL(ANIME_PAGE_QUERY, {
                mediaId: numericId,
                userName: targetUserName
            }, cacheKey);

            return {
                viewer: data.Viewer,
                media: data.Media,
                mediaList: data.Media.mediaListEntry
            };
        } catch (err) {
            console.error(`[AniList API] Erreur lors de la récupération de l'anime ${numericId}:`, err);
            return null;
        }
    }

    /**
     * Récupère les activités d'un utilisateur
     */
    async function getUserAndActivities() {
        if (!anilistUserId) return null;

        const cacheKey = `user_activities_${anilistUserId}`;

        try {
            const data = await executeGraphQL(ACTIVITIES_QUERY, { userId : anilistUserId }, cacheKey);
            return {
                activities: data.Page?.activities || []
            };
        } catch (err) {
            console.error(`[AniList API] Erreur activités pour ${userName}:`, err);
            return null;
        }
    }

    /**
     * Récupère l'intégralité de la collection d'un utilisateur.
     * @param {string} userName - Le pseudo AniList
     */
    async function getUserCollection(userName) {
        if (!userName) return null;

        const cacheKey = `collection_${userName}`;

        try {
            const data = await executeGraphQL(USER_COLLECTION_QUERY, { userName }, cacheKey);
            return data.MediaListCollection;
        } catch (err) {
            console.error(`[AniList API] Erreur collection pour ${userName}:`, err);
            return null;
        }
    }

    /**
     * Invalide tout ou partie du cache (ex: après une mutation GraphQL)
     * @param {string|null} key - Clé spécifique à supprimer, ou réinitialise tout si null
     */
    function clearCache(key = null) {
    if (key) {
        apiCache.delete(key);
    } else {
        apiCache.clear();
    }
    }

    /* ==========================================================================
        4. EXPOSITION AU SCOPE GLOBAL DU CONTENT SCRIPT
    ========================================================================== */

    window.anilistApi = {
        getAnimeData,
        getUserAndActivities,
        getUserCollection,
        clearCache
    };

    console.log("AnilistApi Loaded");

    // Rétrocompatibilité ou accès direct si souhaité
    // window.getAnimeData = getAnimeData;
})();