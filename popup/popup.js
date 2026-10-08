// --- LOGIQUE DE NAVIGATION ---
document.getElementById('btn-go-anilist').addEventListener('click', () => switchView('view-anilist'));
document.getElementById('btn-go-malsync').addEventListener('click', () => switchView('view-malsync'));
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => switchView(e.target.getAttribute('data-target')));
});

function switchView(viewId) {
    document.querySelectorAll('.menu-view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- INITIALISATION GLOBALE ---
document.addEventListener('DOMContentLoaded', () => {
    restoreAnilistOptions();
    restoreMalSyncOptions();
});

// ==========================================
// LOGIQUE ANILIST
// ==========================================
document.getElementById('saveAnilist').addEventListener('click', saveAnilistOptions);
const listsContainer = document.getElementById('listsContainer');

function saveAnilistOptions() {
    // 1. Récupération des règles de couleurs dynamiques depuis le conteneur
    const listRows = document.querySelectorAll('#listsContainer > div');
    const listsConfigArray = [];

    listRows.forEach(row => {
        const nameSelect = row.querySelector('.config-list-name');
        const colorInput = row.querySelector('.config-list-color');
        
        if (nameSelect && colorInput) {
            const name = nameSelect.value.trim();
            const color = colorInput.value;
            if (name && color) {
                listsConfigArray.push({ name: name, color: color });
            }
        }
    });

    // 2. Sécurisation de la valeur du Spinner (fallback à 3 si vide/invalide)
    const spinnerVal = parseInt(document.getElementById('spinnerDuration').value, 10);
    const spinnerDuration = isNaN(spinnerVal) ? 3 : spinnerVal;

    // 3. Sauvegarde dans chrome.storage.sync
    chrome.storage.sync.set({
        supabaseUrl: document.getElementById('supabaseUrl') ? document.getElementById('supabaseUrl').value : '',
        supabaseKey: document.getElementById('supabaseKey') ? document.getElementById('supabaseKey').value : '',
        tableName: document.getElementById('tableName') ? document.getElementById('tableName').value : 'anime_history',
        anilistUsername: document.getElementById('anilistUsername') ? document.getElementById('anilistUsername').value : '',
        notifList: document.getElementById('notifList') ? document.getElementById('notifList').value : '',
        removeList: document.getElementById('removeList') ? document.getElementById('removeList').value : '',
        spinnerDuration: spinnerDuration,
        listsConfig: JSON.stringify(listsConfigArray)
    }, function() {
        // Notification visuelle de succès
        const status = document.getElementById('status');
        if (status) {
            status.style.color = '#3ecf8e';
            status.textContent = 'Configuration sauvegardée !';
            setTimeout(() => { status.textContent = ''; }, 2000);
        }
    });
}

async function restoreAnilistOptions() {
    chrome.storage.sync.get({
        supabaseUrl: '', 
        supabaseKey: '', 
        tableName: 'anime_history', 
        anilistUsername: 'Symswag',
        anilistToken: '', 
        notifList: 'Not Yet', 
        listsConfig: '[{"name": "VF Supremacy", "color": "#00ffff"}]', 
        spinnerDuration: 3, 
        removeList: 'Close At Hand'
    }, async function(items) {
        // 1. Restauration des champs texte et numériques basiques
        if (document.getElementById('supabaseUrl')) document.getElementById('supabaseUrl').value = items.supabaseUrl;
        if (document.getElementById('supabaseKey')) document.getElementById('supabaseKey').value = items.supabaseKey;
        if (document.getElementById('tableName')) document.getElementById('tableName').value = items.tableName;
        if (document.getElementById('spinnerDuration')) document.getElementById('spinnerDuration').value = items.spinnerDuration;

        // 2. Vérification de la connexion AniList via le Token
        const statusEl = document.getElementById('anilistStatus');
        const authBtn = document.getElementById('anilistAuthBtn');

        if (items.anilistToken) {
            // Utilisateur connecté : mise à jour visuelle du bouton et statut
            if (statusEl) {
                statusEl.innerText = "Connecté ✓";
                statusEl.style.color = "#3ECF8E";
            }
            if (authBtn) authBtn.innerText = "Se déconnecter";

            // Récupération des données fraîches depuis AniList (pseudo + toutes les listes)
            const userData = await fetchAnilistUserData(items.anilistToken);

            if (userData) {
                // Mise à jour automatique du storage avec le bon pseudo
                chrome.storage.sync.set({ anilistUsername: userData.username });

                // Alimentation dynamique des menus déroulants et de la configuration
                populateUI(userData.username, userData.allLists, {
                    notifList: items.notifList,
                    removeList: items.removeList,
                    listsConfig: items.listsConfig
                });
                return;
            }
        }

        // 3. Fallback : Si non connecté ou token invalide
        if (statusEl) {
            statusEl.innerText = "Non connecté";
            statusEl.style.color = "";
        }
        if (authBtn) authBtn.innerText = "Se connecter à AniList";
        if (document.getElementById('anilistUsername')) {
            document.getElementById('anilistUsername').value = items.anilistUsername || '';
        }

        // Rendu par défaut des règles de couleur depuis le stockage local
        renderListConfigRows([], items.listsConfig);
    });
}

// ==========================================
// LOGIQUE MALSYNC
// ==========================================
const msDefaultSettings = { start: true, finish: true, rewatch_start: false, rewatch_finish: false, delay: 3, score: 10 };

function restoreMalSyncOptions() {
    chrome.storage.sync.get(msDefaultSettings, (settings) => {
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') element.checked = settings[key];
                else element.value = settings[key];
            }
        });
    });
}

document.getElementById('view-malsync').addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT') saveMalSyncValue(e.target);
});

document.querySelectorAll('.al-arrow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        const direction = btn.getAttribute('data-dir');
        const input = document.getElementById(targetId);

        if (input) {
            let val = parseInt(input.value, 10) || 0;
            const min = input.hasAttribute('min') ? parseInt(input.getAttribute('min'), 10) : -Infinity;
            const max = input.hasAttribute('max') ? parseInt(input.getAttribute('max'), 10) : Infinity;

            if (direction === 'up' && val < max) val++;
            if (direction === 'down' && val > min) val--;

            input.value = val;
            saveMalSyncValue(input);
        }
    });
});

document.querySelectorAll('.ms-arrow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        const direction = btn.getAttribute('data-dir');
        const input = document.getElementById(targetId);
        
        if (input) {
            let val = parseInt(input.value, 10) || 0;
            const min = input.hasAttribute('min') ? parseInt(input.getAttribute('min'), 10) : -Infinity;
            const max = input.hasAttribute('max') ? parseInt(input.getAttribute('max'), 10) : Infinity;

            if (direction === 'up' && val < max) val++;
            if (direction === 'down' && val > min) val--;

            input.value = val;
            saveMalSyncValue(input);
        }
    });
});

function saveMalSyncValue(input) {
    const id = input.id;
    let value = input.type === 'checkbox' ? input.checked : parseInt(input.value, 10);
    
    if (id === 'score') {
        if (value > 10) value = 10;
        if (value < 1) value = 1;
        input.value = value;
    }
    if (id === 'delay') {
        if (value < 0) value = 0;
        input.value = value;
    }
    chrome.storage.sync.set({ [id]: value });
}

const ANILIST_CLIENT_ID = '53105'; // Remplace par ton Client ID AniList

// Au chargement, on vérifie si un token existe déjà
chrome.storage.sync.get({ anilistToken: '' }, function(items) {
    const statusEl = document.getElementById('anilistStatus');
    const authBtn = document.getElementById('anilistAuthBtn');
    
    if (items.anilistToken) {
        statusEl.innerText = "Connecté ✓";
        statusEl.style.color = "#3ECF8E";
        authBtn.innerText = "Se déconnecter";
    }
});

// Gestion du clic sur le bouton de connexion
document.getElementById('anilistAuthBtn').addEventListener('click', function() {
    chrome.storage.sync.get({ anilistToken: '' }, function(items) {
        if (items.anilistToken) {
            // Déconnexion : supprime le token
            chrome.storage.sync.set({ anilistToken: '' }, function() {
                document.getElementById('anilistStatus').innerText = "Non connecté";
                document.getElementById('anilistStatus').style.color = "";
                document.getElementById('anilistAuthBtn').innerText = "Se connecter à AniList";
            });
        } else {
            // Connexion automatique via fenêtre WebAuthFlow
            const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;

            chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true
            }, function(redirectUrl) {
                if (chrome.runtime.lastError || !redirectUrl) {
                    console.error("Erreur de connexion :", chrome.runtime.lastError);
                    return;
                }

                // Extraire le token depuis l'URL de redirection (#access_token=...)
                const matches = redirectUrl.match(/access_token=([^&]+)/);
                if (matches && matches[1]) {
                    const token = matches[1];
                    
                    // Sauvegarde automatique du token
                    chrome.storage.sync.set({ anilistToken: token }, function() {
                        document.getElementById('anilistStatus').innerText = "Connecté ✓";
                        document.getElementById('anilistStatus').style.color = "#3ECF8E";
                        document.getElementById('anilistAuthBtn').innerText = "Se déconnecter";
                    });
                }
            });
        }
    });
});

// Fonction pour récupérer le profil complet et TOUTES les listes AniList (par défaut + custom)
async function fetchAnilistUserData(token) {
    const query = `
        query {
            Viewer {
                name
                mediaListOptions {
                    animeList {
                        sectionOrder
                        customLists
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
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query })
        });

        const data = await res.json();
        if (data && data.data && data.data.Viewer) {
            const viewer = data.data.Viewer;
            const username = viewer.name;
            
            // Récupère l'ensemble des noms de sections/listes (custom & standards)
            const customLists = viewer.mediaListOptions.animeList.customLists || [];
            const sectionOrder = viewer.mediaListOptions.animeList.sectionOrder || [];
            
            // Fusion unique de toutes les listes
            const allLists = Array.from(new Set([...sectionOrder, ...customLists]));

            return { username, allLists };
        }
    } catch (err) {
        console.error("Erreur AniList API:", err);
    }
    return null;
}

// Remplissage dynamique des éléments du DOM
function populateUI(username, lists, savedConfig) {
    // 1. Pseudo
    document.getElementById('anilistUsername').value = username || '';

    // 2. Menus déroulants (Notif & Removal)
    const notifSelect = document.getElementById('notifList');
    const removeSelect = document.getElementById('removeList');

    notifSelect.innerHTML = '';
    removeSelect.innerHTML = '';

    lists.forEach(listName => {
        const opt1 = document.createElement('option');
        opt1.value = listName; opt1.textContent = listName;
        notifSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = listName; opt2.textContent = listName;
        removeSelect.appendChild(opt2);
    });

    // Restaure les valeurs sauvegardées
    if (savedConfig.notifList) notifSelect.value = savedConfig.notifList;
    if (savedConfig.removeList) removeSelect.value = savedConfig.removeList;

    // 3. Configuration des Couleurs de Listes
    renderListConfigRows(lists, savedConfig.listsConfig);
}

// Génération des lignes de configuration des couleurs de liste
function renderListConfigRows(availableLists, currentConfigJson) {
    const container = document.getElementById('listsContainer');
    container.innerHTML = '';

    let config = [];
    try { config = JSON.parse(currentConfigJson || '[]'); } catch(e) {}

    config.forEach((item, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';

        // Select avec la liste des noms
        const select = document.createElement('select');
        select.className = 'config-list-name';
        availableLists.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l; opt.textContent = l;
            if (l === item.name) opt.selected = true;
            select.appendChild(opt);
        });

        // Input couleur natif (masqué mais fonctionnel)
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'config-list-color';
        colorInput.value = item.color || '#00ffff';
        colorInput.style.position = 'absolute';
        colorInput.style.opacity = '0';
        colorInput.style.width = '0';
        colorInput.style.height = '0';
        colorInput.style.pointerEvents = 'none';

        // Bouton/Pastille personnalisée (déclencheur tactile)
        const colorPickerBtn = document.createElement('button');
        colorPickerBtn.type = 'button';
        colorPickerBtn.className = 'custom-color-picker-btn';
        colorPickerBtn.style.backgroundColor = colorInput.value;
        colorPickerBtn.style.width = '32px';
        colorPickerBtn.style.height = '32px';
        colorPickerBtn.style.borderRadius = '6px';
        colorPickerBtn.style.border = '2px solid rgba(255, 255, 255, 0.2)';
        colorPickerBtn.style.cursor = 'pointer';
        colorPickerBtn.style.flexShrink = '0';

        const hexaInput = document.createElement('input');
        hexaInput.type = 'text';
        hexaInput.className = 'config-list-color';
        hexaInput.value = item.color || '#00ffff';
        hexaInput.style.width = '65px';
        hexaInput.style.padding = '4px 6px';
        hexaInput.style.borderRadius = '4px';
        hexaInput.style.border = '1px solid #333';
        hexaInput.style.background = '#1a1d24';
        hexaInput.style.color = '#fff';
        hexaInput.style.fontSize = '12px';

        // Événement Tactile/Clic pour forcer l'ouverture du sélecteur
        colorPickerBtn.addEventListener('click', () => {
            colorInput.showPicker ? colorInput.showPicker() : colorInput.click();
        });

        // Mise à jour de la couleur de la pastille en temps réel
        colorInput.addEventListener('input', (e) => {
            colorPickerBtn.style.backgroundColor = e.target.value;
            hexaInput.value = e.target.value;
        });

        hexaInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (/^#([0-9A-Fa-f]{6})$/.test(val)) {
                colorInput.value = val;
                colorPickerBtn.style.backgroundColor = val;
            }
        });

        // Bouton supprimer (Supprimer la règle)
        const delBtn = document.createElement('button');
        delBtn.textContent = '❌';
        delBtn.className = 'config-list-delete';
        delBtn.type = 'button';
        delBtn.onclick = () => { row.remove(); saveAnilistOptions(); };

        row.appendChild(select);
        row.appendChild(colorInput);
        row.appendChild(colorPickerBtn);
        row.appendChild(hexaInput);
        row.appendChild(delBtn);
        container.appendChild(row);
    });
}

// Bouton pour ajouter une nouvelle règle de couleur
document.getElementById('addList').addEventListener('click', () => {
    chrome.storage.sync.get({ anilistToken: '' }, async (items) => {
        if (!items.anilistToken) return;
        const userData = await fetchAnilistUserData(items.anilistToken);
        if (userData) {
            renderListConfigRows(userData.allLists, JSON.stringify([
                ...getCurrentListsConfigFromDOM(),
                { name: userData.allLists[0] || '', color: '#00ffff' }
            ]));
        }
    });
});

// Extraction du JSON depuis le DOM pour la sauvegarde
function getCurrentListsConfigFromDOM() {
    const rows = document.querySelectorAll('#listsContainer > div');
    const config = [];
    rows.forEach(r => {
        const name = r.querySelector('.config-list-name').value;
        const color = r.querySelector('.config-list-color').value;
        if (name) config.push({ name, color });
    });
    console.log("Current Lists Config from DOM:", config);
    return config;
}

// Chargement initial au démarrage du Popup
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get({
        anilistToken: '',
        anilistUsername: '',
        notifList: '',
        removeList: '',
        listsConfig: '[]',
        spinnerDuration: 3
    }, async (saved) => {
        document.getElementById('spinnerDuration').value = saved.spinnerDuration;

        if (saved.anilistToken) {
            const userData = await fetchAnilistUserData(saved.anilistToken);
            if (userData) {
                // Sauvegarde le pseudo au passage
                chrome.storage.sync.set({ anilistUsername: userData.username });
                populateUI(userData.username, userData.allLists, saved);
            }
        }
    });
});

document.getElementById('supabaseUrl').addEventListener('input', saveAnilistOptions);
document.getElementById('supabaseKey').addEventListener('input', saveAnilistOptions);
document.getElementById('tableName').addEventListener('input', saveAnilistOptions);