const supabaseUrl = 'https://cblxbanbssnflgyrzhah.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibHhiYW5ic3NuZmxneXJ6aGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0NDYsImV4cCI6MjA3OTIxNTQ0Nn0.36w4C_Y8TsTJ2ifORlE5vQu-yMHYCCD-Ebetz8CpQ9A';
const sbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const ADMIN_EMAIL = "zurabkostava1@gmail.com";
async function checkAdminSession() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
        document.body.classList.add('is-admin');
        return true;
    }
    return false;
}
const wrapper = document.getElementById('book-engine-wrapper');
const FORCED_SLUG = wrapper ? wrapper.getAttribute('data-force-slug') : null;
const urlParams = new URLSearchParams(window.location.search);
let CURRENT_BOOK_SLUG = FORCED_SLUG || (window.location.hash ? window.location.hash.substring(1) : null);
let currentBookId = null;
const DEFAULT_META = { title: "UNTITLED", subtitle: "Draft", coverImage: null };
const DEFAULT_CHAPTERS = [{ id: 'ch1', title: "Chapter 1", content: `<h2>Chapter 1</h2><p>Start writing...</p>` }];
const isKaPath = window.location.pathname.includes('/ka/');
const isKaParam = urlParams.get('lang') === 'ka';
let currentLanguage = (isKaPath || isKaParam) ? 'ka' : 'en';
let editorLanguage = currentLanguage;
let allPageData = [];
let chaptersData = [];
let bookMeta = {};
let quill;
let selectedChapterIndex = 0;
let paperToChapterMap = [];
let isEditingSettings = false;
let botExposureTimer = null;
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}
const debouncedRender = debounce(() => { if (CURRENT_BOOK_SLUG) renderBook(); }, 300);
document.addEventListener("DOMContentLoaded", async () => {
    const savedTheme = localStorage.getItem('book_theme');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if(themeBtn) themeBtn.innerHTML = '<span class="material-icons-outlined">dark_mode</span>';
    }
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            themeBtn.innerHTML = isLight
                ? '<span class="material-icons-outlined">dark_mode</span>'
                : '<span class="material-icons-outlined">light_mode</span>';
            localStorage.setItem('book_theme', isLight ? 'light' : 'dark');
        };
    }
    const btnMinus = document.getElementById('font-size-minus');
    const btnPlus = document.getElementById('font-size-plus');
    let currentFontSize = parseFloat(localStorage.getItem('user_font_size')) || 0.95;
    const MIN_FONT = 0.7;
    const MAX_FONT = 1.4;
    const STEP = 0.05;
    function updateFontSize(newSize) {
        if (newSize < MIN_FONT || newSize > MAX_FONT) return;
        currentFontSize = parseFloat(newSize.toFixed(2));
        const rootElement = document.getElementById('digital-library-root');
        if (rootElement) {
            rootElement.style.setProperty('--p-font-size', currentFontSize + 'rem');
        }
        if(btnMinus) btnMinus.onclick = () => updateFontSize(currentFontSize - STEP);
        if(btnPlus) btnPlus.onclick = () => updateFontSize(currentFontSize + STEP);
        localStorage.setItem('user_font_size', currentFontSize);
        debouncedRender();
    }
    document.documentElement.style.setProperty('--p-font-size', currentFontSize + 'rem');
    if(btnMinus) btnMinus.onclick = () => updateFontSize(currentFontSize - STEP);
    if(btnPlus) btnPlus.onclick = () => updateFontSize(currentFontSize + STEP);
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-closed');
    }
    if(toggleBtn) toggleBtn.onclick = toggleSidebar;
    if(openSidebarBtn) openSidebarBtn.onclick = toggleSidebar;
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-closed');
    }
    const langBtn = document.getElementById('lang-switcher-btn');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLanguage = currentLanguage === 'ka' ? 'en' : 'ka';
            langBtn.innerText = currentLanguage.toUpperCase();
            renderBook();
        };
    }
    window.onresize = debouncedRender;
    if (!FORCED_SLUG) {
        window.addEventListener('hashchange', () => window.location.reload());
    }
    await setupAdminAuth();
    if (!CURRENT_BOOK_SLUG) initLibraryMode();
    else initReaderMode();
});
async function setupAdminAuth() {
    const loginBtn = document.getElementById('admin-login-btn');
    if (!loginBtn) return;
    const isAdmin = await checkAdminSession();
    loginBtn.innerText = isAdmin ? "🔓" : "🔒";
    loginBtn.onclick = async () => {
        if (document.body.classList.contains('is-admin')) {
            if (confirm("Logout?")) {
                await sbClient.auth.signOut();
                document.body.classList.remove('is-admin');
                loginBtn.innerText = "🔒";
                window.location.reload();
            }
        } else {
            const password = prompt("Enter Master Password:");
            if (password !== null) {
                loginBtn.innerText = "⏳";
                const { data, error } = await sbClient.auth.signInWithPassword({
                    email: ADMIN_EMAIL,
                    password: password
                });
                if (error) {
                    alert("Access Denied: " + error.message);
                    loginBtn.innerText = "🔒";
                } else {
                    document.body.classList.add('is-admin');
                    loginBtn.innerText = "🔓";
                    window.location.reload();
                }
            }
        }
    };
}
async function initLibraryMode() {
    if (FORCED_SLUG) return;
    document.getElementById('library-view').classList.add('active');
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('lang-switcher-btn').style.display = 'none';
    const grid = document.getElementById('books-grid');
    const createBtn = document.getElementById('create-new-book-btn');
    grid.innerHTML = '<p style="color:#666;">Loading library...</p>';
    const { data, error } = await sbClient.from('book_projects').select('id, title, cover_image, slug').order('id', { ascending: false });
    if (error) { grid.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`; return; }
    grid.innerHTML = '';
    if (data.length === 0) grid.innerHTML = '<p style="color:#444;">No books found.</p>';
    data.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        const contentHtml = book.cover_image ? `<img src="${book.cover_image}" alt="${book.title}">` : `<div class="no-cover-placeholder">${book.title}</div>`;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-book-btn admin-only';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${book.title}"?`)) {
                card.style.opacity = '0.5';
                const { error: delErr } = await sbClient.from('book_projects').delete().eq('id', book.id);
                if (!delErr) card.remove();
                else alert("Delete failed");
            }
        };
        card.innerHTML = contentHtml;
        card.appendChild(deleteBtn);
        card.onclick = () => {
            if (book.slug) window.location.hash = book.slug;
            else alert("Slug missing.");
        };
        grid.appendChild(card);
    });
    createBtn.onclick = async () => {
        const title = prompt("Book Title:");
        if (!title) return;
        let slug = title.toLowerCase().trim().replace(/[\s\W-]+/g, '-');
        if (!slug) slug = "untitled";
        createBtn.innerText = "...";
        const { data: newBook, error: createError } = await sbClient.from('book_projects').insert([{ title: title, slug: slug, subtitle: "By Zurab Kostava", chapters: DEFAULT_CHAPTERS, cover_image: null }]).select().single();
        if (createError) {
            if (createError.code === '23505') alert("Name exists. Choose another.");
            else alert("Error: " + createError.message);
            createBtn.innerText = "+ New Book";
        } else {
            window.location.hash = newBook.slug;
        }
    };
}
async function initReaderMode() {
    const loader = document.getElementById('book-loader');
    const libView = document.getElementById('library-view');
    if(libView) libView.classList.remove('active');
    const libraryIcon = document.getElementById('go-to-library-icon');
    const langBtn = document.getElementById('lang-switcher-btn');
    if (langBtn) {
        langBtn.style.display = 'block';
        langBtn.innerText = currentLanguage.toUpperCase();
        langBtn.onclick = () => {
            if (FORCED_SLUG) {
                const origin = window.location.origin;
                let path = window.location.pathname;
                if (currentLanguage === 'en') {
                    if (!path.startsWith('/ka')) {
                        path = '/ka' + path;
                    }
                    path = path.replace('//', '/');
                    window.location.href = origin + path + '?lang=ka';
                } else {
                    path = path.replace('/ka', '');
                    if (path === '') path = '/';
                    path = path.replace('//', '/');
                    window.location.href = origin + path;
                }
            } else {
                currentLanguage = currentLanguage === 'ka' ? 'en' : 'ka';
                editorLanguage = currentLanguage;
                langBtn.innerText = currentLanguage.toUpperCase();
                document.body.classList.remove('loaded');
                if(loader) loader.classList.remove('hidden');
                updateStaticUI();
                renderBook().then(() => {
                    setTimeout(() => {
                        if(loader) loader.classList.add('hidden');
                        document.body.classList.add('loaded');
                    }, 300);
                });
            }
        };
    }
    if (FORCED_SLUG) { if (libraryIcon) libraryIcon.style.display = 'none'; }
    else { if (libraryIcon) { libraryIcon.style.display = 'block'; libraryIcon.onclick = () => { history.pushState("", document.title, window.location.pathname + window.location.search); window.location.reload(); }; } }
    const editBtn = document.getElementById('edit-mode-btn');
    if (editBtn) editBtn.style.display = '';
    initQuill();
    setupEditorEvents();
    const cachedData = localStorage.getItem('cached_book_' + CURRENT_BOOK_SLUG);
    let isCached = false;
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            applyBookData(parsed);
            updateStaticUI();
            isCached = true;
            document.fonts.ready.then(async () => {
                await renderBook();
                if(loader) loader.classList.add('hidden');
                document.body.classList.add('loaded');
            });
        } catch (e) { console.warn("Cache error", e); }
    }
    await loadBookData(CURRENT_BOOK_SLUG, isCached);
}
function applyBookData(data) {
    currentBookId = data.id;
    bookMeta = {
        title: data.title,
        subtitle: data.subtitle,
        coverImage: data.cover_image,
        title_en: data.title_en,
        subtitle_en: data.subtitle_en,
        seo_description: data.seo_description || "",
        seo_description_en: data.seo_description_en || "",
        genre_ka: data.genre_ka || "",
        genre_en: data.genre_en || "",
        published_year: data.published_year || ""
    };
    if (data.chapters && data.chapters[0] && data.chapters[0].meta_en) {
        if(!bookMeta.title_en) bookMeta.title_en = data.chapters[0].meta_en.title;
        if(!bookMeta.subtitle_en) bookMeta.subtitle_en = data.chapters[0].meta_en.subtitle;
    }
    chaptersData = data.chapters || DEFAULT_CHAPTERS;
}
async function loadBookData(slug, hasCacheRendered) {
    const loader = document.getElementById('book-loader');
    try {
        const { data, error } = await sbClient.from('book_projects').select('*').eq('slug', slug).single();
        if (error) throw error;
        const newDataString = JSON.stringify(data);
        const cachedString = localStorage.getItem('cached_book_' + slug);
        if (hasCacheRendered && newDataString === cachedString) {
            return;
        }
        localStorage.setItem('cached_book_' + slug, newDataString);
        applyBookData(data);
        updateStaticUI();
        if (!hasCacheRendered) {
            document.fonts.ready.then(async () => {
                await renderBook();
                if(loader) loader.classList.add('hidden');
                document.body.classList.add('loaded');
            });
        } else {
            console.log("🔄 New content found, updating...");
            await renderBook();
        }
    } catch (err) {
        console.error("Load Error:", err);
        if(loader) loader.classList.add('hidden');
        if (!hasCacheRendered) {
            if (FORCED_SLUG) alert("Book not found!");
            else {
                alert("Book not found.");
                history.pushState("", document.title, window.location.pathname + window.location.search);
                window.location.reload();
            }
        }
    }
}
async function uploadCoverToStorage(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `covers/${fileName}`;
    const { data, error } = await sbClient
        .storage
        .from('covers')
        .upload(fileName, file);
    if (error) {
        console.error("Upload Error:", error);
        alert("Cover upload failed: " + error.message);
        return null;
    }
    const { data: publicData } = sbClient
        .storage
        .from('covers')
        .getPublicUrl(fileName);
    return publicData.publicUrl;
}
async function saveToSupabase() {
    const saveBtn = document.getElementById('save-changes-btn');
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;
    if (!currentBookId) { alert("Error: No ID"); return; }
    try {
        const { error } = await sbClient.from('book_projects').update({ title: bookMeta.title, subtitle: bookMeta.subtitle, cover_image: bookMeta.coverImage, chapters: chaptersData }).eq('id', currentBookId);
        if (error) throw error;
        renderBook();
        document.getElementById('editor-modal').classList.remove('active');
    } catch (err) { alert("Save Failed"); console.error(err); }
    finally { saveBtn.innerText = "Save & Re-Paginate"; saveBtn.disabled = false; }
}
function updateStaticUI() {
    const siteTitleEl = document.getElementById('site-main-title');
    const siteSubEl = document.getElementById('site-sub-title');
    const sidebarHeader = document.getElementById('sidebar-main-title');
    const seoContainer = document.getElementById('seo-hidden-text');
    if (seoContainer) {
        if (currentLanguage === 'en') {
            seoContainer.innerText = bookMeta.seo_description_en || bookMeta.seo_description || "";
        } else {
            seoContainer.innerText = bookMeta.seo_description || "";
        }
    }
    const displayTitle = (currentLanguage === 'en') ? (bookMeta.title_en || bookMeta.title) : bookMeta.title;
    const displaySubtitle = (currentLanguage === 'en') ? (bookMeta.subtitle_en || bookMeta.subtitle) : bookMeta.subtitle;
    const sidebarTitleText = (currentLanguage === 'en') ? "CONTENTS" : "სარჩევი";
    const safeSetText = (el, text) => {
        if (el && el.innerText !== text) {
            el.innerText = text;
        }
    };
    safeSetText(siteTitleEl, displayTitle || "");
    safeSetText(siteSubEl, displaySubtitle || "");
    safeSetText(sidebarHeader, sidebarTitleText);
    generateSchemaMarkup();
    if (botExposureTimer) clearTimeout(botExposureTimer);
    botExposureTimer = setTimeout(() => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => exposeContentToBots());
        } else {
            exposeContentToBots();
        }
    }, 3000);
}
function exposeContentToBots() {
    const botContainer = document.getElementById('bot-full-content');
    if (!botContainer) return;
    let fullText = "";
    chaptersData.forEach(ch => {
        const rawContent = (currentLanguage === 'en')
            ? (ch.content_en || "")
            : (ch.content || "");
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawContent;
        const cleanText = tempDiv.textContent || "";
        const title = (currentLanguage === 'en') ? (ch.title_en || "") : (ch.title || "");
        fullText += `\n\n--- ${title} ---\n\n${cleanText}`;
    });
    botContainer.innerText = fullText;
}
async function renderBook() {
    const bookContainer = document.getElementById('book');
    bookContainer.innerHTML = '';
    paperToChapterMap = [];
    allPageData = [];
    const { pages, chapterStartMap } = await generateBookStructure();
    const isMobile = window.innerWidth <= 768;
    const totalPapers = isMobile ? pages.length : Math.ceil(pages.length / 2);
    for (let p = 0; p < totalPapers; p++) {
        const face = isMobile ? p : p * 2;
        let chIdx = 0;
        for (let c = 0; c < chapterStartMap.length; c++) {
            if (chapterStartMap[c] <= face) chIdx = c; else break;
        }
        paperToChapterMap.push(chIdx);
    }
    for (let i = 0; i < totalPapers; i++) {
        let front, back;
        if (isMobile) {
            front = pages[i];
            back = null;
        } else {
            front = pages[i * 2];
            back = pages[i * 2 + 1];
        }
        const frontNum = isMobile ? (i + 1) : (i * 2 + 1);
        const backNum = isMobile ? '' : (i * 2 + 2);
        let fClass = 'front'; if (front && front.isCover) fClass += ' hardcover-front';
        let bClass = 'back'; if (back && back.isCover) bClass += ' hardcover-back';
        const paperHTML = `
        <div class="${fClass}">
            <div class="page-content">${front ? front.html : ''}</div>
            ${(front && !front.isCover) ? `<span class="page-number">${frontNum}</span>` : ''}
        </div>
        <div class="${bClass}">
            <div class="page-content">${back ? back.html : ''}</div>
            ${(back && !back.isCover) ? `<span class="page-number">${backNum}</span>` : ''}
        </div>`;
        allPageData.push(paperHTML);
    }
    buildDynamicSidebar(totalPapers);
    initPhysics(totalPapers);
}
function getChapterContent(chapter, lang, useDraft = false) {
    if (useDraft) {
        if (lang === 'en') {
            return chapter.draft_content_en !== undefined ? chapter.draft_content_en : (chapter.content_en || "");
        } else {
            return chapter.draft_content !== undefined ? chapter.draft_content : (chapter.content || "");
        }
    } else {
        if (lang === 'en') {
            return chapter.content_en || "<p><i>(No English translation yet)</i></p>";
        }
        return chapter.content || "";
    }
}
function getChapterTitle(chapter, lang) {
    if (lang === 'en') {
        return chapter.title_en || chapter.title;
    }
    return chapter.title;
}
async function generateBookStructure() {
    const container = document.getElementById('measure-container');
    const bookScene = document.querySelector('.book-scene');
    const rect = bookScene.getBoundingClientRect();
    container.style.width = rect.width + 'px';
    container.style.height = rect.height + 'px';
    const style = getComputedStyle(container);
    const h = rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 15;
    let pages = [];
    let map = [0];
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    let displayTitle = bookMeta.title;
    let displaySubtitle = bookMeta.subtitle;
    if (currentLanguage === 'en') {
        displayTitle = bookMeta.title_en || (bookMeta.title + " (EN)");
        displaySubtitle = bookMeta.subtitle_en || bookMeta.subtitle;
    }
    let coverHTML = bookMeta.coverImage
        ? `<img src="${bookMeta.coverImage}" class="cover-img">`
        : `<div class="cover-design"><h1>${displayTitle}</h1><p>${displaySubtitle}</p></div>`;
    pages.push({ html: coverHTML, isCover: true });
    const preloaderDiv = document.createElement('div');
    preloaderDiv.style.position = 'absolute';
    preloaderDiv.style.visibility = 'hidden';
    preloaderDiv.style.width = container.style.width;
    document.body.appendChild(preloaderDiv);
    for (const ch of chaptersData) {
        const contentToRender = getChapterContent(ch, currentLanguage, isAdmin);
        if (!contentToRender || contentToRender.trim() === "" || contentToRender === "<p><br></p>") {
            continue;
        }
        const hyph = applyCustomGeorgianHyphenation(contentToRender);
        preloaderDiv.innerHTML = hyph;
        await waitForImages(preloaderDiv);
        const pgs = paginateContent(hyph, h, pages.length);
        const startPage = pages.length;
        if (pgs.length > 0) {
            const isMobile = window.innerWidth <= 768;
            const visualStartPage = isMobile ? startPage : Math.floor(startPage / 2);
            map.push(visualStartPage);
        }
        pgs.forEach(p => pages.push({ html: p, isCover: false }));
    }
    document.body.removeChild(preloaderDiv);
    return { pages, chapterStartMap: map };
}
function buildDynamicSidebar(totalPapers) {
    const sidebarList = document.getElementById('chapter-list-ui');
    sidebarList.innerHTML = '';
    const isMobile = window.innerWidth <= 768;
    const expandedStateKey = 'sidebar_expanded_' + CURRENT_BOOK_SLUG;
    let expandedTitles = [];
    try {
        expandedTitles = JSON.parse(localStorage.getItem(expandedStateKey)) || [];
    } catch (e) {
        expandedTitles = [];
    }
    const coverLi = document.createElement('li');
    coverLi.innerText = (currentLanguage === 'en') ? "Cover" : "გარეკანი";
    coverLi.className = "toc-h1 toc-cover";
    coverLi.setAttribute('data-virtual-id', -1);
    coverLi.onclick = () => {
        const event = new CustomEvent('book-nav', {
            detail: { pageIndex: 0, total: totalPapers, side: 'front' }
        });
        document.dispatchEvent(event);
        closeSidebarMobile();
    };
    sidebarList.appendChild(coverLi);
    allPageData.forEach((htmlString, paperIndex) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        const headings = tempDiv.querySelectorAll('h1, h2, h3');
        headings.forEach(heading => {
            if (heading.classList.contains('split-continuation')) return;
            const li = document.createElement('li');
            const fullText = heading.getAttribute('data-full-text');
            const labelText = fullText ? fullText : heading.innerText;
            const tagName = heading.tagName.toLowerCase();
            li.classList.add(`toc-${tagName}`);
            const isBack = isMobile ? false : (heading.closest('.back') !== null);
            const side = isBack ? 'back' : 'front';
            let virtualId = isMobile ? paperIndex : (paperIndex * 2) + (isBack ? 1 : 0);
            li.setAttribute('data-virtual-id', virtualId);
            const textSpan = document.createElement('span');
            textSpan.innerText = labelText;
            textSpan.title = labelText;
            li.appendChild(textSpan);
            if (tagName === 'h1') {
                const arrow = document.createElement('span');
                arrow.className = 'toc-arrow material-icons-outlined';
                arrow.innerText = 'expand_more';
                if (!expandedTitles.includes(labelText)) {
                    arrow.classList.add('collapsed');
                }
                arrow.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    arrow.classList.toggle('collapsed');
                    const isHidden = arrow.classList.contains('collapsed');
                    if (isHidden) {
                        expandedTitles = expandedTitles.filter(t => t !== labelText);
                    } else {
                        if (!expandedTitles.includes(labelText)) expandedTitles.push(labelText);
                    }
                    localStorage.setItem(expandedStateKey, JSON.stringify(expandedTitles));
                    let nextSibling = li.nextElementSibling;
                    while (nextSibling) {
                        if (nextSibling.classList.contains('toc-h1') || nextSibling.classList.contains('toc-cover')) {
                            break;
                        }
                        nextSibling.style.display = isHidden ? 'none' : '';
                        nextSibling = nextSibling.nextElementSibling;
                    }
                };
                li.appendChild(arrow);
            }
            li.onclick = () => {
                const event = new CustomEvent('book-nav', {
                    detail: { pageIndex: paperIndex, total: totalPapers, side: side }
                });
                document.dispatchEvent(event);
                closeSidebarMobile();
            };
            sidebarList.appendChild(li);
        });
    });
    const arrows = sidebarList.querySelectorAll('.toc-arrow.collapsed');
    arrows.forEach(arrow => {
        const li = arrow.parentElement;
        let nextSibling = li.nextElementSibling;
        while (nextSibling) {
            if (nextSibling.classList.contains('toc-h1') || nextSibling.classList.contains('toc-cover')) break;
            nextSibling.style.display = 'none';
            nextSibling = nextSibling.nextElementSibling;
        }
    });
}
function applyCustomGeorgianHyphenation(html) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = html; function traverse(node) { if (node.nodeType === 3) { const words = node.nodeValue.split(' '); const processedWords = words.map(word => hyphenateWord(word)); node.nodeValue = processedWords.join(' '); } else { for (let child of node.childNodes) traverse(child); } } traverse(tempDiv); return tempDiv.innerHTML; }
function hyphenateWord(word) { if (word.length < 5) return word; if (!/[ა-ჰ]/.test(word)) return word; const vowels = "აეიოუ"; const isV = (c) => vowels.includes(c); const isC = (c) => !vowels.includes(c) && c !== undefined; let result = ""; let chars = word.split(''); for (let i = 0; i < chars.length; i++) { result += chars[i]; if (i >= chars.length - 2) continue; if (i < 1) continue; let cur = chars[i], next = chars[i+1], after = chars[i+2], prev = chars[i-1]; if (isV(cur) && isV(next)) { result += '\u00AD'; continue; } if (isV(cur) && isC(next) && isV(after)) { result += '\u00AD'; continue; } if (isC(cur) && isC(next)) { if (isV(prev)) { result += '\u00AD'; continue; } } } return result; }
function paginateContent(htmlContent, maxContentHeight, startPageIndex = 0) {
    const measureContainer = document.getElementById('measure-container');
    measureContainer.innerHTML = '';
    const innerMeasurer = document.createElement('div');
    innerMeasurer.style.width = '100%';
    innerMeasurer.style.margin = '0';
    innerMeasurer.style.padding = '0';
    innerMeasurer.style.overflow = 'hidden';
    measureContainer.appendChild(innerMeasurer);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    let nodesQueue = Array.from(tempDiv.children);
    let pages = [];
    let currentPageContent = document.createElement('div');
    while (nodesQueue.length > 0) {
        let node = nodesQueue.shift();
        const imgElement = node.querySelector('img') || (node.tagName === 'IMG' ? node : null);
        if (imgElement) {
            if (currentPageContent.innerHTML.trim() !== '') {
                pages.push(currentPageContent.innerHTML);
                currentPageContent = document.createElement('div');
            }
            if (window.innerWidth > 768) {
                const currentTotalPages = startPageIndex + pages.length;
                if (currentTotalPages % 2 === 0) {
                    pages.push('<div class="spacer-page" style="width:100%;height:100%;"></div>');
                }
            }
            const imgSrc = imgElement.getAttribute('src');
            const fullPageImgHTML = `<div class="full-page-img-wrapper"><img src="${imgSrc}"></div>`;
            pages.push(fullPageImgHTML);
            continue;
        }
        innerMeasurer.appendChild(node.cloneNode(true));
        if (innerMeasurer.offsetHeight <= maxContentHeight) {
            currentPageContent.appendChild(node.cloneNode(true));
        } else {
            innerMeasurer.removeChild(innerMeasurer.lastChild);
            const { fittedNode, remainingNode } = splitNodeByWords(node, innerMeasurer, maxContentHeight);
            if (fittedNode) currentPageContent.appendChild(fittedNode);
            pages.push(currentPageContent.innerHTML);
            innerMeasurer.innerHTML = '';
            currentPageContent = document.createElement('div');
            if (remainingNode) nodesQueue.unshift(remainingNode);
        }
    }
    if (currentPageContent.innerHTML.trim() !== '') {
        pages.push(currentPageContent.innerHTML);
    }
    return pages;
}
function splitNodeByWords(originalNode, containerState, limit) {
    if (originalNode.tagName !== 'P' &&
        !originalNode.tagName.startsWith('H') &&
        originalNode.tagName !== 'BLOCKQUOTE') {
        return { fittedNode: null, remainingNode: originalNode };
    }
    const type = originalNode.tagName;
    const fullText = originalNode.innerText;
    const words = originalNode.innerHTML.split(' ');
    const tempNode = document.createElement(type);
    tempNode.className = originalNode.className;
    containerState.appendChild(tempNode);
    let low = 0;
    let high = words.length;
    let bestFitIndex = 0;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testStr = words.slice(0, mid).join(' ');
        tempNode.innerHTML = testStr;
        if (containerState.offsetHeight <= limit) {
            bestFitIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    containerState.removeChild(tempNode);
    if (bestFitIndex === 0) {
        return { fittedNode: null, remainingNode: originalNode };
    }
    const fittedNode = document.createElement(type);
    fittedNode.innerHTML = words.slice(0, bestFitIndex).join(' ');
    fittedNode.className = originalNode.className;
    fittedNode.setAttribute('data-full-text', fullText);
    let remainingNode = null;
    if (bestFitIndex < words.length) {
        remainingNode = document.createElement(type);
        remainingNode.innerHTML = words.slice(bestFitIndex).join(' ');
        remainingNode.className = originalNode.className;
        remainingNode.classList.add('split-continuation');
    }
    return { fittedNode, remainingNode };
}
function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.body.classList.add('sidebar-closed');
    }
}
function initPhysics(totalPapers) {
    const bookContainer = document.getElementById('book');
    const storageKey = 'book_cursor_' + CURRENT_BOOK_SLUG;
    const savedPage = localStorage.getItem(storageKey);
    let savedLocation = savedPage ? parseInt(savedPage) : null;
    let currentLocation = savedLocation || 1;
    if (currentLocation > totalPapers + 1) currentLocation = 1;
    const maxLocation = totalPapers + 1;
    let mobileShowBack = false;
    let isBusy = false;
    let touchStartX = 0;
    let touchStartY = 0;
    function renderVisiblePapers(loc) {
        const range = 2;
        const start = Math.max(0, loc - range - 1);
        const end = Math.min(totalPapers, loc + range);
        const existingPapers = Array.from(bookContainer.children);
        const existingIds = existingPapers.map(p => parseInt(p.getAttribute('data-index')));
        existingPapers.forEach(p => {
            const idx = parseInt(p.getAttribute('data-index'));
            if (idx < start || idx >= end) {
                p.remove();
            }
        });
        for (let i = start; i < end; i++) {
            if (!existingIds.includes(i)) {
                const paper = document.createElement('div');
                paper.classList.add('paper');
                paper.id = `p${i + 1}`;
                paper.setAttribute('data-index', i);
                paper.innerHTML = allPageData[i];
                if (i < currentLocation - 1) {
                    paper.classList.add('flipped');
                }
                const nextSibling = Array.from(bookContainer.children).find(p => parseInt(p.getAttribute('data-index')) > i);
                if (nextSibling) {
                    bookContainer.insertBefore(paper, nextSibling);
                } else {
                    bookContainer.appendChild(paper);
                }
                paper.onclick = (e) => {
                    if (window.innerWidth <= 768) return;
                    if (isBusy) return;
                    if ((i + 1) < currentLocation) prevDesk();
                    else nextDesk();
                };
            }
        }
    }
    function syncVisuals(instant = false, targetSide = 'front') {
        renderVisiblePapers(currentLocation);
        const papers = Array.from(bookContainer.children);
        papers.forEach(p => {
            const i = parseInt(p.getAttribute('data-index'));
            if (instant) p.style.transition = 'none';
            if (i < currentLocation - 1) {
                p.classList.add('flipped');
                p.style.zIndex = i;
                if (window.innerWidth <= 768) p.style.display = 'none';
            } else {
                p.classList.remove('flipped');
                p.style.zIndex = totalPapers - i;
                if (window.innerWidth <= 768) p.style.display = 'block';
            }
            p.classList.remove('mobile-view-back');
        });
        if (window.innerWidth <= 768) {
            mobileShowBack = (targetSide === 'back');
            if (mobileShowBack) {
                const currentPaper = papers.find(p => parseInt(p.getAttribute('data-index')) === currentLocation - 1);
                if (currentPaper) currentPaper.classList.add('mobile-view-back');
            }
        } else {
            mobileShowBack = false;
        }
        updateState();
        if (instant) {
            setTimeout(() => {
                papers.forEach(p => p.style.transition = '');
            }, 100);
        }
    }
    document.addEventListener('book-nav', (e) => {
        const { pageIndex, side } = e.detail;
        let targetLocation = pageIndex + 1;
        if (window.innerWidth > 768 && side === 'back') targetLocation += 1;
        currentLocation = targetLocation;
        syncVisuals(true, side);
    });
    bookContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    bookContainer.addEventListener('touchend', (e) => {
        if (window.innerWidth > 768) return;
        if (isBusy) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (Math.abs(diffY) > Math.abs(diffX)) return;
        if (Math.abs(diffX) > 50) {
            if (diffX < 0) nextMob(); else prevMob();
        } else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
            if (touchEndX > window.innerWidth / 2) nextMob(); else prevMob();
        }
    }, { passive: true });
    bookContainer.onclick = (e) => {
        if (window.innerWidth <= 768) return;
        if (isBusy) return;
        if (e.target === bookContainer) {
            if (currentLocation > 1) prevDesk();
        }
    };
    function nextMob() {
        lockInput(200);
        if (currentLocation > totalPapers) return;
        const p = Array.from(bookContainer.children).find(el => parseInt(el.getAttribute('data-index')) === currentLocation - 1);
        if (p) {
            p.classList.add('flipped');
            setTimeout(() => { syncVisuals(); }, 300);
        }
        currentLocation++;
        mobileShowBack = false;
        updateState();
    }
    function prevMob() {
        lockInput(200);
        if (currentLocation === 1) return;
        currentLocation--;
        syncVisuals();
        const p = Array.from(bookContainer.children).find(el => parseInt(el.getAttribute('data-index')) === currentLocation - 1);
        if (p) p.classList.remove('flipped');
        mobileShowBack = false;
    }
    function nextDesk() {
        if (currentLocation < maxLocation) {
            lockInput(300);
            renderVisiblePapers(currentLocation);
            const p = Array.from(bookContainer.children).find(el => parseInt(el.getAttribute('data-index')) === currentLocation - 1);
            if(p) {
                p.classList.add("moving", "flipped");
                p.style.zIndex = maxLocation + 1;
            }
            currentLocation++;
            updateState();
            setTimeout(() => {
                if(p) {
                    p.classList.remove("moving");
                    syncVisuals();
                }
            }, 400);
        }
    }
    function prevDesk() {
        if (currentLocation > 1) {
            lockInput(300);
            renderVisiblePapers(currentLocation - 1);
            const p = Array.from(bookContainer.children).find(el => parseInt(el.getAttribute('data-index')) === currentLocation - 2);
            if(p) {
                p.classList.add("moving");
                p.classList.remove("flipped");
                p.style.zIndex = maxLocation + 1;
            }
            currentLocation--;
            updateState();
            setTimeout(() => {
                if(p) {
                    p.classList.remove("moving");
                    syncVisuals();
                }
            }, 400);
        }
    }
    function updateState(forceMobileBack = false) {
        updateBookState(currentLocation);
        highlightActiveSidebarItem(currentLocation, forceMobileBack || mobileShowBack);
        if (CURRENT_BOOK_SLUG) localStorage.setItem(storageKey, currentLocation);
    }
    function lockInput(time) { isBusy = true; setTimeout(() => { isBusy = false; }, time); }
    syncVisuals(true, 'front');
}
function highlightActiveSidebarItem(currentLocation, isMobileBack) {
    const items = Array.from(document.querySelectorAll('#chapter-list-ui li'));
    items.forEach(item => item.classList.remove('active'));
    let visibleVirtualIds = [];
    const pIndex = currentLocation - 1;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        visibleVirtualIds.push(pIndex);
    } else {
        if (pIndex > 0) visibleVirtualIds.push(((pIndex - 1) * 2) + 1);
        visibleVirtualIds.push(pIndex * 2);
    }
    let activeItems = items.filter(item => {
        const vId = parseInt(item.getAttribute('data-virtual-id'));
        return visibleVirtualIds.includes(vId);
    });
    if (activeItems.length === 0) {
        const minVisibleId = Math.min(...visibleVirtualIds);
        let lastPassedItem = null;
        for (const item of items) {
            const vId = parseInt(item.getAttribute('data-virtual-id'));
            if (vId < minVisibleId) lastPassedItem = item; else break;
        }
        if (lastPassedItem) activeItems.push(lastPassedItem);
    }
    if (activeItems.length > 0) {
        const mainActive = activeItems[activeItems.length - 1];
        mainActive.classList.add('active');
        if (!mainActive.classList.contains('toc-h1') && !mainActive.classList.contains('toc-cover')) {
            let prev = mainActive.previousElementSibling;
            while (prev) {
                if (prev.classList.contains('toc-h1')) {
                    prev.classList.add('active');
                    break;
                }
                prev = prev.previousElementSibling;
            }
        }
        if (!isMobile) {
            mainActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}
function updateBookState(loc) {
    const book = document.getElementById('book');
    if (window.innerWidth > 768) { if (loc === 1) book.classList.add('closed'); else book.classList.remove('closed'); }
}
function initQuill() {
    if(!document.getElementById('editor-container')) return;
    quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote'],
                    [{ 'header': 1 }, { 'header': 2 }, { 'header': 3 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    ['image'],
                    ['clean']
                ],
                handlers: {
                    image: imageHandler
                }
            },
            history: { delay: 2000, maxStack: 500, userOnly: true }
        }
    });
}
function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const range = quill.getSelection();
        quill.insertText(range.index, 'Uploading image...', 'bold', true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const { data, error } = await sbClient
                .storage
                .from('covers')
                .upload(fileName, file);
            if (error) throw error;
            const { data: publicData } = sbClient
                .storage
                .from('covers')
                .getPublicUrl(fileName);
            const url = publicData.publicUrl;
            quill.deleteText(range.index, 16);
            quill.insertEmbed(range.index, 'image', url);
            quill.setSelection(range.index + 1);
        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Image upload failed!");
            quill.deleteText(range.index, 16);
        }
    };
}
function setupEditorEvents() {
    const modal = document.getElementById('editor-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsForm = document.getElementById('settings-form');
    const editBtn = document.getElementById('edit-mode-btn');
    const langTabs = document.querySelectorAll('.lang-tab');
    const loader = document.getElementById('editor-loading-overlay');
    const coverPreview = document.getElementById('cover-preview');
    const mobileToggleBtn = document.getElementById('mobile-expand-toggle');
    const modalBody = document.querySelector('.modal-body');
    const extractTitleFromHTML = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const headings = temp.querySelectorAll('h1, h2');
        for (let h of headings) {
            const text = h.textContent.replace(/\s+/g, ' ').trim();
            if (text.length > 0) {
                return text;
            }
        }
        return "Untitled";
    };
    if (mobileToggleBtn) {
        mobileToggleBtn.onclick = () => {
            modalBody.classList.toggle('expanded-mode');
            const icon = mobileToggleBtn.querySelector('.material-icons-outlined');
            icon.innerText = modalBody.classList.contains('expanded-mode') ? "expand_more" : "expand_less";
        };
    }
    const switchLanguageWithLoader = (targetLang, activeTabElement) => {
        if(loader) loader.classList.remove('hidden');
        setTimeout(() => {
            if (chaptersData[selectedChapterIndex]) {
                const currentContent = quill.root.innerHTML;
                const extractedTitle = extractTitleFromHTML(currentContent);
                if (editorLanguage === 'ka') {
                    chaptersData[selectedChapterIndex].draft_content = currentContent;
                    chaptersData[selectedChapterIndex].title = extractedTitle;
                } else {
                    chaptersData[selectedChapterIndex].draft_content_en = currentContent;
                    chaptersData[selectedChapterIndex].title_en = extractedTitle;
                }
            }
            langTabs.forEach(t => t.classList.remove('active'));
            if(activeTabElement) activeTabElement.classList.add('active');
            editorLanguage = targetLang;
            if (chaptersData[selectedChapterIndex]) {
                const newContent = getChapterContent(chaptersData[selectedChapterIndex], editorLanguage, true);
                quill.enable(false);
                quill.setText('');
                const delta = quill.clipboard.convert(newContent || "");
                quill.setContents(delta, 'silent');
                quill.history.clear();
                quill.enable(true);
            }
            renderChaptersList();
            if(loader) loader.classList.add('hidden');
        }, 50);
    };
    langTabs.forEach(tab => {
        tab.onclick = () => {
            const targetLang = tab.getAttribute('data-lang');
            if (editorLanguage === targetLang) return;
            switchLanguageWithLoader(targetLang, tab);
        };
    });
    if (editBtn) {
        editBtn.onclick = () => {
            modal.classList.add('active');
            if(loader) loader.classList.remove('hidden');
            setTimeout(() => {
                editorLanguage = 'en';
                langTabs.forEach(t => t.classList.remove('active'));
                const enTab = document.querySelector('.lang-tab[data-lang="en"]');
                if(enTab) enTab.classList.add('active');
                settingsForm.style.display = 'none';
                isEditingSettings = false;
                chaptersData.forEach(ch => {
                    const contentKa = ch.draft_content || ch.content || "";
                    const newTitleKa = extractTitleFromHTML(contentKa);
                    if (newTitleKa !== "Untitled") ch.title = newTitleKa;
                    const contentEn = ch.draft_content_en || ch.content_en || "";
                    const newTitleEn = extractTitleFromHTML(contentEn);
                    if (newTitleEn !== "Untitled") ch.title_en = newTitleEn;
                });
                renderChaptersList();
                loadChapter(selectedChapterIndex);
                if(loader) loader.classList.add('hidden');
            }, 50);
        };
    }
    document.getElementById('close-modal').onclick = () => modal.classList.remove('active');
    openSettingsBtn.onclick = () => {
        isEditingSettings = true;
        settingsForm.style.display = 'flex';
        document.getElementById('input-book-title').value = bookMeta.title || "";
        document.getElementById('input-book-subtitle').value = bookMeta.subtitle || "";
        document.getElementById('input-book-title-en').value = bookMeta.title_en || "";
        document.getElementById('input-book-subtitle-en').value = bookMeta.subtitle_en || "";
        document.getElementById('input-book-genre').value = bookMeta.genre_ka || "";
        document.getElementById('input-book-genre-en').value = bookMeta.genre_en || "";
        document.getElementById('input-book-year').value = bookMeta.published_year || "";
        const seoInput = document.getElementById('input-book-seo');
        const seoInputEn = document.getElementById('input-book-seo-en');
        if(seoInput) seoInput.value = bookMeta.seo_description || "";
        if(seoInputEn) seoInputEn.value = bookMeta.seo_description_en || "";
        if (bookMeta.coverImage) {
            coverPreview.style.backgroundImage = `url(${bookMeta.coverImage})`;
            coverPreview.innerText = "";
        } else {
            coverPreview.style.backgroundImage = "none";
            coverPreview.innerText = "No image selected";
        }
    };
    closeSettingsBtn.onclick = () => {
        isEditingSettings = false;
        settingsForm.style.display = 'none';
    };
    document.getElementById('input-cover-image').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            pendingCoverFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                coverPreview.style.backgroundImage = `url(${ev.target.result})`;
                coverPreview.innerText = "";
            };
            reader.readAsDataURL(file);
        }
    };
    document.getElementById('remove-cover-btn').onclick = () => {
        document.getElementById('input-cover-image').value = "";
        coverPreview.style.backgroundImage = "none";
        coverPreview.innerText = "Cover Removed";
        bookMeta.coverImage = null;
        pendingCoverFile = null;
    };
    const pushToDB = async (statusEl) => {
        if (!currentBookId) { alert("Error: No ID"); return; }
        try {
            if (isEditingSettings) {
                const tEn = document.getElementById('input-book-title-en');
                const sEn = document.getElementById('input-book-subtitle-en');
                bookMeta.genre_ka = document.getElementById('input-book-genre').value;
                bookMeta.genre_en = document.getElementById('input-book-genre-en').value;
                bookMeta.published_year = document.getElementById('input-book-year').value;
                const seoInput = document.getElementById('input-book-seo');
                const seoInputEn = document.getElementById('input-book-seo-en');
                if(seoInput) bookMeta.seo_description = seoInput.value;
                if(seoInputEn) bookMeta.seo_description_en = seoInputEn.value;
            }
            const { error } = await sbClient.from('book_projects').update({
                title: bookMeta.title,
                subtitle: bookMeta.subtitle,
                cover_image: bookMeta.coverImage,
                chapters: chaptersData,
                title_en: bookMeta.title_en,
                subtitle_en: bookMeta.subtitle_en,
                seo_description: bookMeta.seo_description,
                seo_description_en: bookMeta.seo_description_en,
                genre_ka: bookMeta.genre_ka,
                genre_en: bookMeta.genre_en,
                published_year: bookMeta.published_year
            }).eq('id', currentBookId);
            if (error) throw error;
            statusEl.innerText = "Saved!";
            setTimeout(() => statusEl.innerText = "", 2000);
        } catch (err) {
            console.error(err);
            alert("Save Failed");
        }
    };
    document.getElementById('save-draft-btn').onclick = async () => {
        const btn = document.getElementById('save-draft-btn');
        const status = document.getElementById('save-status');
        btn.innerText = "...";
        const currentHTML = quill.root.innerHTML;
        const extractedTitle = extractTitleFromHTML(currentHTML);
        if (editorLanguage === 'ka') {
            chaptersData[selectedChapterIndex].draft_content = currentHTML;
            chaptersData[selectedChapterIndex].title = extractedTitle;
        } else {
            chaptersData[selectedChapterIndex].draft_content_en = currentHTML;
            chaptersData[selectedChapterIndex].title_en = extractedTitle;
        }
        renderChaptersList();
        await pushToDB(status);
        btn.innerText = "Save Draft";
    };
    document.getElementById('publish-btn').onclick = async () => {
        if(!confirm("Publish changes?")) return;
        const btn = document.getElementById('publish-btn');
        const status = document.getElementById('save-status');
        btn.innerText = "Publishing...";
        const currentHTML = quill.root.innerHTML;
        const extractedTitle = extractTitleFromHTML(currentHTML);
        if (editorLanguage === 'ka') {
            chaptersData[selectedChapterIndex].draft_content = currentHTML;
            chaptersData[selectedChapterIndex].content = currentHTML;
            chaptersData[selectedChapterIndex].title = extractedTitle;
        } else {
            chaptersData[selectedChapterIndex].draft_content_en = currentHTML;
            chaptersData[selectedChapterIndex].content_en = currentHTML;
            chaptersData[selectedChapterIndex].title_en = extractedTitle;
        }
        renderChaptersList();
        await pushToDB(status);
        renderBook();
        btn.innerText = "Publish";
    };
    const addPageBtn = document.getElementById('add-page-btn');
    if (addPageBtn) {
        addPageBtn.onclick = () => {
            if (chaptersData[selectedChapterIndex]) {
                const currentVal = quill.root.innerHTML;
                if (editorLanguage === 'ka') chaptersData[selectedChapterIndex].draft_content = currentVal;
                else chaptersData[selectedChapterIndex].draft_content_en = currentVal;
            }
            chaptersData.push({
                id: Date.now(),
                title: "New Chapter (Draft)",
                content: "",
                content_en: "",
                draft_content: "<h1>New Chapter</h1><p>Write here...</p>",
                draft_content_en: "<h1>New Chapter</h1><p>Write here...</p>",
                title_en: "New Chapter (Draft)"
            });
            renderChaptersList();
            selectedChapterIndex = chaptersData.length - 1;
            loadChapter(selectedChapterIndex);
        };
    }
    const unpublishBtn = document.getElementById('unpublish-btn');
    if (unpublishBtn) {
        unpublishBtn.onclick = async () => {
            if(!confirm("დავმალოთ ეს თავი მკითხველისთვის? (გადავიდეს Draft-ში)")) return;
            const status = document.getElementById('save-status');
            unpublishBtn.innerText = "...";
            const currentHTML = quill.root.innerHTML;
            const extractedTitle = extractTitleFromHTML(currentHTML);
            if (editorLanguage === 'ka') {
                chaptersData[selectedChapterIndex].draft_content = currentHTML;
                chaptersData[selectedChapterIndex].content = "";
                chaptersData[selectedChapterIndex].title = extractedTitle;
            } else {
                chaptersData[selectedChapterIndex].draft_content_en = currentHTML;
                chaptersData[selectedChapterIndex].content_en = "";
                chaptersData[selectedChapterIndex].title_en = extractedTitle;
            }
            renderChaptersList();
            await pushToDB(status);
            renderBook();
            unpublishBtn.innerText = "Unpublish";
        };
    }
    document.getElementById('reset-book-btn').onclick = () => {
        if(confirm("Delete all chapters?")) {
            chaptersData = [{ id: 'ch1', title: "Chapter 1", content: `<h2>Chapter 1</h2><p>Start writing...</p>`, draft_content: `<h2>Chapter 1</h2><p>Start writing...</p>` }];
            renderChaptersList();
            selectedChapterIndex = 0;
            loadChapter(0);
        }
    };
}
function renderChaptersList() {
    const list = document.getElementById('editable-pages-list');
    list.innerHTML = '';
    chaptersData.forEach((ch, i) => {
        const li = document.createElement('li');
        const displayTitle = getChapterTitle(ch, editorLanguage);
        let statusColor = '#28a745';
        let tooltip = "Published";
        let pub, drf;
        if (editorLanguage === 'en') {
            pub = ch.content_en || "";
            drf = ch.draft_content_en || "";
        } else {
            pub = ch.content || "";
            drf = ch.draft_content || "";
        }
        if (pub.trim() === "") {
            statusColor = '#ffc107';
            tooltip = "Draft (Not Published)";
        } else if (pub !== drf) {
            statusColor = '#ffc107';
            tooltip = "Unpublished Changes";
        }
        const titleSpan = document.createElement('span');
        titleSpan.style.flexGrow = "1";
        titleSpan.style.display = "flex";
        titleSpan.style.alignItems = "center";
        titleSpan.style.gap = "10px";
        const dot = document.createElement('span');
        dot.style.width = "8px";
        dot.style.height = "8px";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = statusColor;
        dot.style.display = "inline-block";
        dot.style.boxShadow = `0 0 5px ${statusColor}40`;
        dot.title = tooltip;
        const textNode = document.createTextNode(displayTitle || "Untitled");
        titleSpan.appendChild(dot);
        titleSpan.appendChild(textNode);
        titleSpan.onclick = () => {
            isEditingSettings = false;
            document.getElementById('editor-container').style.display = 'block';
            if(document.getElementById('settings-form')) document.getElementById('settings-form').style.display = 'none';
            if (i !== selectedChapterIndex) {
                const currentVal = quill.root.innerHTML;
                if (editorLanguage === 'ka') chaptersData[selectedChapterIndex].draft_content = currentVal;
                else chaptersData[selectedChapterIndex].draft_content_en = currentVal;
            }
            selectedChapterIndex = i;
            loadChapter(i);
        };
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '&times;';
        delBtn.className = 'delete-chapter-btn';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(`Delete "${displayTitle}"?`)) {
                chaptersData.splice(i, 1);
                if (i === selectedChapterIndex) {
                    selectedChapterIndex = Math.max(0, i - 1);
                    loadChapter(selectedChapterIndex);
                } else if (i < selectedChapterIndex) selectedChapterIndex--;
                renderChaptersList();
                saveToSupabase();
            }
        };
        li.appendChild(titleSpan);
        li.appendChild(delBtn);
        if (i === selectedChapterIndex && !isEditingSettings) li.classList.add('selected');
        list.appendChild(li);
    });
}
function loadChapter(i) {
    if (!chaptersData[i]) return;
    selectedChapterIndex = i;
    const loader = document.getElementById('editor-loading-overlay');
    if(loader) loader.classList.remove('hidden');
    setTimeout(() => {
        const content = getChapterContent(chaptersData[i], editorLanguage, true);
        if (quill) {
            quill.enable(false);
            quill.setText('');
            const delta = quill.clipboard.convert(content || "");
            quill.setContents(delta, 'silent');
            quill.history.clear();
            quill.enable(true);
        }
        const lis = document.getElementById('editable-pages-list').querySelectorAll('li');
        lis.forEach(l => l.classList.remove('selected'));
        if (lis[i]) lis[i].classList.add('selected');
        document.getElementById('save-status').innerText = "";
        if(loader) loader.classList.add('hidden');
    }, 10);
}
function generateSchemaMarkup() {
    const isEnglish = currentLanguage === 'en';
    const description = isEnglish ? bookMeta.seo_description_en : bookMeta.seo_description;
    const bookTitle = isEnglish ? (bookMeta.title_en || bookMeta.title) : bookMeta.title;
    const authorName = isEnglish ? (bookMeta.subtitle_en || bookMeta.subtitle) : bookMeta.subtitle;
    const rawGenre = isEnglish ? (bookMeta.genre_en || bookMeta.genre_ka) : bookMeta.genre_ka;
    let genreList = "Literature";
    if (rawGenre && rawGenre.trim() !== "") {
        genreList = rawGenre.split(',').map(g => g.trim()).filter(g => g !== "");
    }
    const cleanAuthor = authorName ? authorName.replace(/^(by|ავტორი:?)\s+/i, '').trim() : "Zurab Kostava";
    if (!description || description.trim() === "") return;
    const schema = {
        "@context": "https://schema.org",
        "@type": "Book",
        "name": bookTitle,
        "description": description,
        "image": bookMeta.coverImage || "",
        "author": {
            "@type": "Person",
            "name": cleanAuthor
        },
        "genre": genreList,
        "datePublished": bookMeta.published_year || new Date().getFullYear().toString(),
        "inLanguage": isEnglish ? "en" : "ka",
        "url": window.location.href,
        "format": "EBook"
    };
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('type', 'application/ld+json');
    scriptTag.textContent = JSON.stringify(schema, null, 2);
    const oldSchema = document.getElementById('book-schema');
    if (oldSchema) oldSchema.remove();
    scriptTag.id = 'book-schema';
    document.head.appendChild(scriptTag);
}
function waitForImages(element) {
    const imgs = Array.from(element.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
        });
    }));
} 
