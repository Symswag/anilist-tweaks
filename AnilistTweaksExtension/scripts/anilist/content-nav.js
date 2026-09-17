(function() {
    'use strict';

    // Récupération dynamique du nom d'utilisateur depuis la configuration de l'extension
    chrome.storage.sync.get({
        anilistUsername: 'Symswag'
    }, function(config) {
        
        const username = config.anilistUsername;
        
        const defaultUrl = `/user/${username}/`;
        const favUrl = `/user/${username}/favorites`;
        const favClass = "custom-favorites-link";
        const dropdownClass = "custom-dropdown-wrap";

        const primaryLink = {
            text: "All",
            url: `/user/${username}/animelist`,
            listName: "all",
            desc: "All animes"
        };

        const primaryLinks = [
            {
                text: "Close at Hand", url: `/user/${username}/animelist/Close%20at%20Hand`, listName: "Close at Hand", desc: "Animes currently close at hand",
                svg: `<svg viewBox="0 0 512 512" style="width:18px;height:18px;"><path fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200zm61.8-104.2l-84.2-61.1c-3.6-2.6-5.8-6.8-5.8-11.2V148c0-8.8 7.2-16 16-16h24c8.8 0 16 7.2 16 16v108l64.2 46.6c7.1 5.2 8.7 15.2 3.5 22.3l-15.3 21.1c-5.2 7.1-15.2 8.7-22.3 3.6z"/></svg>`
            },
            {
                text: "Soon™", url: `/user/${username}/animelist/Soon%20%E2%84%A2`, listName: "Soon™", desc: "Coming soon to your screen",
                svg: `<svg viewBox="0 0 512 512" style="width:18px;height:18px;"><path fill="currentColor" d="M505.1 19.1C505.1 19.1 505.1 19.1 505.1 19.1c-12.2-12.2-32.2-12.2-44.4 0l-102 102c-35.3-7.5-72.7 1-101.4 24l-146 116.8c-14.3 11.4-17.7 31.7-8 47.1l33.3 52.4-83.3 83.3c-12.5 12.5-12.5 32.8 0 45.3l33.9 33.9c12.5 12.5 32.8 12.5 45.3 0l83.3-83.3 52.4 33.3c15.4 9.8 35.7 6.3 47.1-8l116.8-146c23-28.7 31.5-66.1 24-101.4l102-102c12.3-12.2 12.3-32.2 0-44.4z"/></svg>`
            },
            {
                text: "VF Supremacy", url: `/user/${username}/animelist/VF%20Supremacy`, listName: "VF Supremacy", desc: "French dub master race",
                svg: `<svg viewBox="0 0 576 512" style="width:18px;height:18px;"><path fill="currentColor" d="M528 448H48c-26.5 0-48 21.5-48 48v16h576v-16c0-26.5-21.5-48-48-48zm-2-320c-28.9 0-52.2 23.3-52.2 52.2 0 6.4 1.2 12.5 3.3 18.2L399.7 274.6l-85.4-170.9c12.2-10 19.7-25.3 19.7-42.5C334 27.3 306.7 0 273.1 0c-33.6 0-60.9 27.3-60.9 61.2 0 17.2 7.5 32.5 19.7 42.5l-85.4 170.9L68.9 198.4c2.1-5.7 3.3-11.8 3.3-18.2 0-28.9-23.3-52.2-52.2-52.2C8.9 128 0 151.3 0 180.2c0 86.2 63.1 157.4 145.4 170.3L208 416h136l62.6-65.5C488.9 337.6 552 266.4 552 180.2c0-28.9-8.9-52.2-26-52.2z"/></svg>`
            },
            {
                text: "Waiting VF", url: `/user/${username}/animelist/Waiting%20VF`, listName: "Waiting VF", desc: "Waiting for French audio tracks",
                svg: `<svg viewBox="0 0 384 512" style="width:18px;height:18px;"><path fill="currentColor" d="M360 0H24C10.7 0 0 10.7 0 24v16c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24zm-8 333.1c-13.8-13.2-30.8-24.8-51.2-34c-26.6-12-57.9-19.1-92.8-19.1s-66.2 7.1-92.8 19.1c-20.4 9.3-37.4 20.8-51.2 34C25.4 351.7 0 385.5 0 424v16c0 39.8 32.2 72 72 72h240c39.8 0 72-32.2 72-72v-16c0-38.5-25.4-72.3-64-90.9zM192 256c70.7 0 128-43 128-96H64c0 53 57.3 96 128 96z"/></svg>`
            },
            {
                text: "Not Yet", url: `/user/${username}/animelist/Not%20Yet`, listName: "Not Yet", desc: "Not ready to watch this just yet",
                svg: `<svg viewBox="0 0 448 512" style="width:18px;height:18px;"><path fill="currentColor" d="M400 224h-24v-72C376 68.4 307.6 0 224 0S72 68.4 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zm-104 0H152v-72c0-39.7 32.3-72 72-72s72 32.3 72 72v72z"/></svg>`
            },
            {
                text: "Zzz Mode", url: `/user/${username}/animelist/Zzz%20Mode`, listName: "Zzz Mode", desc: "On hold or put to sleep for now",
                svg: `<svg viewBox="0 0 512 512" style="width:18px;height:18px;"><path fill="currentColor" d="M283.211 512c78.962 0 151.079-35.925 198.857-94.792 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 9.686-5.512 7.25-20.197-3.756-22.23A258.156 258.156 0 0 0 283.211 0c-141.309 0-256 114.511-256 256 0 141.309 114.511 256 256 256z"/></svg>`
            }
        ];

        const footerLinks = [
            { text: "Watching", url: `/user/${username}/animelist/Watching`, listName: "Watching", svg: `<svg viewBox="0 0 576 512" style="width:12px;height:12px;margin-right:8px;"><path fill="currentColor" d="M288 32c-144.81 0-267.2 92.1-313.39 219.88a32.13 32.13 0 0 0 0 24.24C20.81 403.9 143.19 496 288 496s267.2-92.1 313.39-219.88a32.13 32.13 0 0 0 0-24.24C555.19 124.1 432.81 32 288 32zm0 384c-70.69 0-128-57.31-128-128s57.31-128 128-128 128 57.31 128 128-57.31 128-128 128zm0-208a80 80 0 1 0 80 80 80 80 0 0 0-80-80z"/></svg>` },
            { text: "Rewatching", url: `/user/${username}/animelist/Rewatching`, listName: "Rewatching", svg: `<svg viewBox="0 0 512 512" style="width:12px;height:12px;margin-right:8px;"><path fill="currentColor" d="M370.72 133.28C339.46 102.01 298.25 80 256 80V24c0-21.4-25.9-32-41-17L119 103c-9.4 9.4-9.4 24.6 0 34l96 96c15.1 15.1 41 4.5 41-17v-56c27.1 0 53.4 13.5 73.4 33.5 40 40 40 104.9 0 144.9-40 40-104.9 40-144.9 0-20-20-33.5-46.3-33.5-73.4H96c0 42.3 22 83.5 53.3 114.8 62.5 62.5 163.8 62.5 226.3 0 62.5-62.5 62.5-163.8 0-226.3z"/></svg>` },
            { text: "Completed", url: `/user/${username}/animelist/Completed`, listName: "Completed", svg: `<svg viewBox="0 0 512 512" style="width:12px;height:12px;margin-right:8px;"><path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/></svg>` },
            { text: "Planning", url: `/user/${username}/animelist/Planning`, listName: "Planning", svg: `<svg viewBox="0 0 448 512" style="width:12px;height:12px;margin-right:8px;"><path fill="currentColor" d="M400 64h-48V12c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v52H160V12c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v52H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM352 416H96c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h256c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16z"/></svg>` }
        ];

        function navigateSmartly(e, linkObj) {
            e.preventDefault();
            const currentPath = window.location.pathname;

            if (currentPath.startsWith(`/user/${username}/animelist`) && linkObj.url.includes(`/user/${username}/animelist`)) {
                fallbackPush(defaultUrl);
                setTimeout(() => { fallbackPush(linkObj.url); }, 100);
            }
            else {
                fallbackPush(linkObj.url);
            }
        }

        function fallbackPush(url, notFound = false) {
            const app = document.getElementById('app');
            if (app && app.__vue__ && app.__vue__.$router && !notFound) {
                app.__vue__.$router.push(url);
            } else {
                window.location.replace(url);
            }
        }

        function buildNavigation() {
            const linksContainer = document.querySelector('.links');
            if (!linksContainer) return;

            const mangaLink = linksContainer.querySelector(`a[href="/user/${username}/mangalist"]`);
            if (!mangaLink) return;

            mangaLink.style.display = 'none';

            let favoritesLink = document.querySelector(`.${favClass}`);
            if (!favoritesLink) {
                favoritesLink = mangaLink.cloneNode(true);
                favoritesLink.style.display = '';
                favoritesLink.setAttribute('href', favUrl);
                favoritesLink.className = `${favClass} link`;
                favoritesLink.innerHTML = `favorites`;
                favoritesLink.addEventListener('click', (e) => navigateSmartly(e, { url: favUrl }));
                mangaLink.parentNode.insertBefore(favoritesLink, mangaLink.nextSibling);
            }

            if (window.location.pathname === favUrl) {
                favoritesLink.classList.add('router-link-active', 'router-link-exact-active');
            } else {
                favoritesLink.classList.remove('router-link-active', 'router-link-exact-active');
            }

            let customDropdown = document.querySelector(`.${dropdownClass}`);
            if (!customDropdown) {
                const browseWrap = linksContainer.querySelector('.browse-wrap');
                if (browseWrap) {
                    customDropdown = browseWrap.cloneNode(true);
                    customDropdown.className = `${dropdownClass} browse-wrap`;
                    customDropdown.style.position = "";

                    const mainLink = customDropdown.querySelector('.link');
                    mainLink.setAttribute('href', primaryLink.url);
                    mainLink.innerText = "lists";
                    mainLink.addEventListener('click', (e) => navigateSmartly(e, primaryLink));

                    const dropdownMenu = customDropdown.querySelector('.dropdown');
                    if (dropdownMenu) {
                        dropdownMenu.style.width = "360px";
                        dropdownMenu.style.borderRadius = "6px";
                        dropdownMenu.innerHTML = `
                            <div class="primary-links" style="padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: stretch;"></div>
                            <div class="footer" style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 10px; row-gap: 14px; padding: 16px 27px; background: rgb(var(--color-background-200)) !important; border-top: none !important;"></div>
                        `;

                        const upperContainer = dropdownMenu.querySelector('.primary-links');
                        const footerContainer = dropdownMenu.querySelector('.footer');
                        footerContainer.style.borderRadius = "0px 0px 6px 6px";


                        primaryLinks.forEach(link => {
                            const card = document.createElement('a');
                            card.setAttribute('href', link.url);
                            card.style.display = "flex";
                            card.style.alignItems = "center";
                            card.style.gap = "10px";
                            card.style.padding = "8px 10px";
                            card.style.borderRadius = "6px";
                            card.style.textDecoration = "none";
                            card.style.color = "inherit";
                            card.style.transition = "background .2s ease, color .2s ease";
                            card.style.cursor = "pointer";
                            card.style.height = "100%";
                            card.style.boxSizing = "border-box";

                            card.innerHTML = `
                                <div class="menu-icon" style="display: flex; align-items: center; justify-content: center; color: var(--color-text-caption, #8ba0b2); transition: color .2s ease; flex-shrink: 0;">
                                    ${link.svg}
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0;">
                                    <span class="menu-title" style="font-size: 1.25rem; font-weight: 700; transition: color .2s ease; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${link.text}</span>
                                    <span style="font-size: 1.05rem; color: var(--color-text-caption, #8ba0b2); font-weight: 500; line-height: 1.2;">${link.desc}</span>
                                </div>
                            `;

                            card.addEventListener('mouseenter', () => {
                                card.style.background = "var(--color-background-blue-dark, #3db4f2)";
                                card.style.color = "#ffffff";
                                card.querySelector('.menu-icon').style.color = "#ffffff";
                            });
                            card.addEventListener('mouseleave', () => {
                                card.style.background = "transparent";
                                card.style.color = "inherit";
                                card.querySelector('.menu-icon').style.color = "var(--color-text-caption, #8ba0b2)";
                            });

                            card.addEventListener('click', (e) => navigateSmartly(e, link));
                            upperContainer.appendChild(card);
                        });

                        footerLinks.forEach(link => {
                            const footBtn = document.createElement('a');
                            footBtn.setAttribute('href', link.url);
                            footBtn.style.display = "flex";
                            footBtn.style.alignItems = "center";
                            footBtn.style.padding = "2px 4px";
                            footBtn.style.fontSize = "1.2rem";
                            footBtn.style.fontWeight = "700";
                            footBtn.style.color = "var(--color-text-caption, #8ba0b2)";
                            footBtn.style.textDecoration = "none";
                            footBtn.style.transition = "color .2s ease";
                            footBtn.style.cursor = "pointer";

                            footBtn.innerHTML = `${link.svg} <span>${link.text}</span>`;

                            footBtn.addEventListener('mouseenter', () => footBtn.style.color = "var(--color-blue, #3db4f2)");
                            footBtn.addEventListener('mouseleave', () => footBtn.style.color = "var(--color-text-caption, #8ba0b2)");
                            footBtn.addEventListener('click', (e) => navigateSmartly(e, link));

                            footerContainer.appendChild(footBtn);
                        });
                    }

                    favoritesLink.parentNode.insertBefore(customDropdown, favoritesLink.nextSibling);
                }
            }

            if (customDropdown) {
                const mainDropdownLink = customDropdown.querySelector('.link');
                const currentPath = window.location.pathname + window.location.search;
                const allLinksCombined = [...primaryLinks, ...footerLinks];
                const isCurrentInDropdown = allLinksCombined.some(link => decodeURIComponent(currentPath).includes(decodeURIComponent(link.url)));

                if (mainDropdownLink) {
                    if (isCurrentInDropdown) {
                        mainDropdownLink.classList.add('router-link-active', 'router-link-exact-active');
                    } else {
                        mainDropdownLink.classList.remove('router-link-active', 'router-link-exact-active');
                    }
                }
            }
        }

        const observer = new MutationObserver(() => {
            buildNavigation();
        });

        window.addEventListener('DOMContentLoaded', () => {
            buildNavigation();
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    });
})();