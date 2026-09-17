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
document.getElementById('addList').addEventListener('click', () => createListRow('', '#00ffff'));
const listsContainer = document.getElementById('listsContainer');

function createListRow(name, color) {
    const row = document.createElement('div');
    row.className = 'list-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.className = 'list-name'; nameInput.placeholder = 'Nom (ex: VF)'; nameInput.value = name;

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color'; colorPicker.value = color;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn'; removeBtn.innerHTML = '✖'; removeBtn.title = 'Supprimer';
    removeBtn.addEventListener('click', () => row.remove());

    row.appendChild(nameInput); row.appendChild(colorPicker); row.appendChild(removeBtn);
    listsContainer.appendChild(row);
}

function saveAnilistOptions() {
    const listRows = document.querySelectorAll('.list-row');
    const listsConfigArray = [];
    listRows.forEach(row => {
        const name = row.querySelector('.list-name').value.trim();
        const color = row.querySelector('input[type="color"]').value;
        if (name && color) listsConfigArray.push({ name: name, color: color });
    });

    chrome.storage.sync.set({
        supabaseUrl: document.getElementById('supabaseUrl').value,
        supabaseKey: document.getElementById('supabaseKey').value,
        tableName: document.getElementById('tableName').value,
        anilistUsername: document.getElementById('anilistUsername').value,
        notifList: document.getElementById('notifList').value,
        listsConfig: JSON.stringify(listsConfigArray)
    }, function() {
        const status = document.getElementById('status');
        status.style.color = '#3ecf8e'; status.textContent = 'Configuration sauvegardée !';
        setTimeout(() => { status.textContent = ''; }, 2000);
    });
}

function restoreAnilistOptions() {
    chrome.storage.sync.get({
        supabaseUrl: '', supabaseKey: '', tableName: 'anime_history', anilistUsername: 'Symswag',
        notifList: 'Not Yet', listsConfig: '[{"name": "VF Supremacy", "color": "#00ffff"}]'
    }, function(items) {
        document.getElementById('supabaseUrl').value = items.supabaseUrl;
        document.getElementById('supabaseKey').value = items.supabaseKey;
        document.getElementById('tableName').value = items.tableName;
        document.getElementById('anilistUsername').value = items.anilistUsername;
        document.getElementById('notifList').value = items.notifList;
        listsContainer.innerHTML = '';
        try {
            const parsedLists = JSON.parse(items.listsConfig);
            if (parsedLists.length === 0) createListRow('', '#00ffff');
            else parsedLists.forEach(list => createListRow(list.name, list.color));
        } catch (e) { createListRow('VF Supremacy', '#00ffff'); }
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