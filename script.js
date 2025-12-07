// ==========================================
// 1. CONFIGURATION & AUTH
// ==========================================
const supabaseUrl = 'https://cblxbanbssnflgyrzhah.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibHhiYW5ic3NuZmxneXJ6aGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0NDYsImV4cCI6MjA3OTIxNTQ0Nn0.36w4C_Y8TsTJ2ifORlE5vQu-yMHYCCD-Ebetz8CpQ9A';
const sbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const ADMIN_HASH = "0b9f062ccf19c24f2b8ac7aa6a7aa19f2df86d895f1228a1709bc9130774c419";
async function checkPasswordHash(inputPassword) {
    const msgBuffer = new TextEncoder().encode(inputPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('') === ADMIN_HASH;
}
// ==========================================
// 2. GLOBAL STATE
// ==========================================
// ==========================================
// 2. GLOBAL STATE
// ==========================================
const wrapper = document.getElementById('book-engine-wrapper');
const FORCED_SLUG = wrapper ? wrapper.getAttribute('data-force-slug') : null;
// URL áƒžáƒáƒ áƒáƒ›áƒ”áƒ¢áƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒ¬áƒáƒ™áƒ˜áƒ—áƒ®áƒ•áƒ
const urlParams = new URLSearchParams(window.location.search);
let CURRENT_BOOK_SLUG = FORCED_SLUG || (window.location.hash ? window.location.hash.substring(1) : null);
let currentBookId = null;
const DEFAULT_META = { title: "UNTITLED", subtitle: "Draft", coverImage: null };
const DEFAULT_CHAPTERS = [{ id: 'ch1', title: "Chapter 1", content: `<h2>Chapter 1</h2><p>Start writing...</p>` }];
// âœ… NEW: TranslatePress Logic (URL Path Detection)
// áƒ•áƒáƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ—, áƒáƒ áƒ˜áƒ¡ áƒ—áƒ£ áƒáƒ áƒ áƒ›áƒ˜áƒ¡áƒáƒ›áƒáƒ áƒ—áƒ¨áƒ˜ "/ka/" áƒáƒœ áƒžáƒáƒ áƒáƒ›áƒ”áƒ¢áƒ áƒ˜ "?lang=ka"
const isKaPath = window.location.pathname.includes('/ka/');
const isKaParam = urlParams.get('lang') === 'ka';
// áƒ—áƒ£ áƒ áƒáƒ›áƒ”áƒšáƒ˜áƒ›áƒ” áƒžáƒ˜áƒ áƒáƒ‘áƒ áƒ¡áƒ áƒ£áƒšáƒ“áƒ”áƒ‘áƒ -> áƒ¥áƒáƒ áƒ—áƒ£áƒšáƒ˜, áƒ—áƒ£ áƒáƒ áƒáƒ“áƒ -> áƒ˜áƒœáƒ’áƒšáƒ˜áƒ¡áƒ£áƒ áƒ˜ (Default)
let currentLanguage = (isKaPath || isKaParam) ? 'ka' : 'en';
let editorLanguage = currentLanguage; // áƒ”áƒ“áƒ˜áƒ¢áƒáƒ áƒ˜áƒª áƒáƒ› áƒ”áƒœáƒ˜áƒ— áƒ“áƒáƒ˜áƒ¬áƒ§áƒ”áƒ‘áƒ¡
let chaptersData = [];
let bookMeta = {};
let quill;
let selectedChapterIndex = 0;
let paperToChapterMap = [];
let isEditingSettings = false;
let pendingCoverFile = null;
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}
const debouncedRender = debounce(() => { if (CURRENT_BOOK_SLUG) renderBook(); }, 300);
document.addEventListener("DOMContentLoaded", async () => {
// âœ… THEME INIT
    const savedTheme = localStorage.getItem('book_theme');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if(themeBtn) themeBtn.innerHTML = '<span class="material-icons-outlined">dark_mode</span>';
    }
// âœ… THEME TOGGLE CLICK
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
// áƒ˜áƒ™áƒáƒœáƒ˜áƒ¡ áƒ¨áƒ”áƒªáƒ•áƒšáƒ (áƒ›áƒ–áƒ” <-> áƒ›áƒ—áƒ•áƒáƒ áƒ”)
            themeBtn.innerHTML = isLight
                ? '<span class="material-icons-outlined">dark_mode</span>'
                : '<span class="material-icons-outlined">light_mode</span>';
// áƒ¨áƒ”áƒœáƒáƒ®áƒ•áƒ
            localStorage.setItem('book_theme', isLight ? 'light' : 'dark');
// áƒ’áƒáƒ“áƒáƒ®áƒáƒ¢áƒ•áƒ (áƒ¤áƒ”áƒ áƒ”áƒ‘áƒ˜ áƒ¨áƒ”áƒ˜áƒªáƒ•áƒáƒšáƒ, áƒ›áƒáƒ’áƒ áƒáƒ› áƒ–áƒáƒ›áƒ”áƒ‘áƒ˜ áƒ˜áƒ’áƒ˜áƒ•áƒ”áƒ,
// áƒ—áƒ£áƒ›áƒªáƒ áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡ áƒ”áƒ áƒ—áƒ˜ áƒ áƒ”áƒœáƒ“áƒ”áƒ áƒ˜ áƒáƒ  áƒáƒ¬áƒ§áƒ”áƒœáƒ¡, áƒ—áƒ£ áƒ áƒáƒ›áƒ” áƒ’áƒšáƒ˜áƒ¢áƒ©áƒ˜ áƒ’áƒáƒ©áƒœáƒ“áƒ)
// renderBook(); // (áƒ¡áƒáƒ•áƒáƒ áƒáƒ£áƒ“áƒáƒ“ áƒáƒ  áƒ“áƒáƒ’áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒ, CSS áƒ—áƒáƒ•áƒ˜áƒ¡áƒ˜áƒ— áƒ˜áƒ–áƒáƒ›áƒ¡)
        };
    }
// ===========================================
// âœ… FONT SIZE CONTROL LOGIC (FIXED FOR SCOPE)
// ===========================================
    const btnMinus = document.getElementById('font-size-minus');
    const btnPlus = document.getElementById('font-size-plus');
// áƒ¡áƒáƒ¬áƒ§áƒ˜áƒ¡áƒ˜ áƒ–áƒáƒ›áƒ
    let currentFontSize = parseFloat(localStorage.getItem('user_font_size')) || 0.95;
    const MIN_FONT = 0.7;
    const MAX_FONT = 1.4;
    const STEP = 0.05;
// áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
    function updateFontSize(newSize) {
        if (newSize < MIN_FONT || newSize > MAX_FONT) return;
        currentFontSize = parseFloat(newSize.toFixed(2));
// âœ… FIX: áƒªáƒ•áƒšáƒáƒ“áƒ˜ áƒ•áƒáƒœáƒ˜áƒ­áƒáƒ— áƒžáƒ˜áƒ áƒ“áƒáƒžáƒ˜áƒ  áƒ©áƒ•áƒ”áƒœáƒ¡ áƒ›áƒ—áƒáƒ•áƒáƒ  áƒ™áƒáƒœáƒ¢áƒ”áƒ˜áƒœáƒ”áƒ áƒ¡ áƒ“áƒ áƒáƒ áƒ html-áƒ¡
        const rootElement = document.getElementById('digital-library-root');
        if (rootElement) {
            rootElement.style.setProperty('--p-font-size', currentFontSize + 'rem');
        }
        if(btnMinus) btnMinus.onclick = () => updateFontSize(currentFontSize - STEP);
        if(btnPlus) btnPlus.onclick = () => updateFontSize(currentFontSize + STEP);
        localStorage.setItem('user_font_size', currentFontSize);
        debouncedRender();
    }
// áƒ˜áƒœáƒ˜áƒªáƒ˜áƒáƒšáƒ˜áƒ–áƒáƒªáƒ˜áƒ (áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜áƒ¡ áƒ©áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ˜áƒ¡áƒáƒ¡ áƒ“áƒáƒ•áƒáƒ§áƒ”áƒœáƒáƒ— áƒ¨áƒ”áƒœáƒáƒ®áƒ£áƒšáƒ˜ áƒ–áƒáƒ›áƒ)
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
// âœ… NEW: Language Switcher Logic (Reader)
    const langBtn = document.getElementById('lang-switcher-btn');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLanguage = currentLanguage === 'ka' ? 'en' : 'ka';
            langBtn.innerText = currentLanguage.toUpperCase();
            renderBook(); // Re-render book in new language
        };
    }
    window.onresize = debouncedRender;
    if (!FORCED_SLUG) {
        window.addEventListener('hashchange', () => window.location.reload());
    }
    setupAdminAuth();
    if (!CURRENT_BOOK_SLUG) initLibraryMode();
    else initReaderMode();
});
function setupAdminAuth() {
    const loginBtn = document.getElementById('admin-login-btn');
    if (!loginBtn) return;
    if (sessionStorage.getItem('is_admin') === 'true') {
        document.body.classList.add('is-admin');
        loginBtn.innerText = "ðŸ”“";
    } else {
        loginBtn.innerText = "ðŸ”’";
    }
    loginBtn.onclick = async () => {
        if (document.body.classList.contains('is-admin')) {
            if (confirm("Logout?")) {
                sessionStorage.removeItem('is_admin');
                document.body.classList.remove('is-admin');
                loginBtn.innerText = "ðŸ”’";
                window.location.reload();
            }
            // ... (áƒ–áƒ”áƒ“áƒ áƒœáƒáƒ¬áƒ˜áƒšáƒ˜ áƒ˜áƒ’áƒ˜áƒ•áƒ”áƒ) ...
        } else {
            const input = prompt("Password:");
            if (input !== null) {
                const isValid = await checkPasswordHash(input);
                if (isValid) {
                    sessionStorage.setItem('is_admin', 'true');
                    document.body.classList.add('is-admin');
                    loginBtn.innerText = "ðŸ”“";
                    alert("Welcome back, Architect.");

                    // âœ… NEW: áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜áƒ¡ áƒ’áƒáƒ“áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ, áƒ áƒáƒ› Draft-áƒ”áƒ‘áƒ˜ áƒ’áƒáƒ›áƒáƒ©áƒœáƒ“áƒ”áƒ¡
                    window.location.reload();
                } else alert("Wrong password");
            }
        }
        // ...
    };
}
async function initLibraryMode() {
    if (FORCED_SLUG) return;
    document.getElementById('library-view').classList.add('active');
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('lang-switcher-btn').style.display = 'none'; // Hide switcher in library
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
// ==========================================
// 5. READER MODE (INSTANT CACHE LOAD)
// ==========================================
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
                const path = window.location.pathname;
                if (currentLanguage === 'en') {
                    let newPath = '/ka' + path; newPath = newPath.replace('//', '/');
                    window.location.href = origin + newPath + '?lang=ka';
                } else {
                    let newPath = path.replace('/ka', ''); if (newPath === '') newPath = '/';
                    window.location.href = origin + newPath;
                }
            } else {
                currentLanguage = currentLanguage === 'ka' ? 'en' : 'ka';
                editorLanguage = currentLanguage;
                langBtn.innerText = currentLanguage.toUpperCase();
// áƒ”áƒœáƒ˜áƒ¡ áƒ¨áƒ”áƒªáƒ•áƒšáƒ˜áƒ¡áƒáƒ¡: áƒ©áƒáƒ•áƒáƒ¥áƒ áƒáƒ— áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ˜ áƒ“áƒ áƒ•áƒáƒ©áƒ•áƒ”áƒœáƒáƒ— áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜
                document.body.classList.remove('loaded'); // áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ˜ áƒ˜áƒ›áƒáƒšáƒ”áƒ‘áƒ
                if(loader) loader.classList.remove('hidden'); // áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜ áƒ©áƒœáƒ“áƒ”áƒ‘áƒ
                updateStaticUI();
                setTimeout(() => {
                    renderBook();
                    setTimeout(() => {
// áƒ£áƒ™áƒáƒœ áƒ•áƒáƒ©áƒ”áƒœáƒ—
                        if(loader) loader.classList.add('hidden');
                        document.body.classList.add('loaded');
                    }, 300);
                }, 10);
            }
        };
    }
    if (FORCED_SLUG) { if (libraryIcon) libraryIcon.style.display = 'none'; }
    else { if (libraryIcon) { libraryIcon.style.display = 'block'; libraryIcon.onclick = () => { history.pushState("", document.title, window.location.pathname + window.location.search); window.location.reload(); }; } }
    const editBtn = document.getElementById('edit-mode-btn');
    if (editBtn) editBtn.style.display = '';
    initQuill();
    setupEditorEvents();
// âœ… FINAL LOADING LOGIC
    const cachedData = localStorage.getItem('cached_book_' + CURRENT_BOOK_SLUG);
    let isCached = false;
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            applyBookData(parsed);
            updateStaticUI();
            isCached = true;
            document.fonts.ready.then(() => {
                renderBook();
// áƒáƒ¥ áƒ®áƒ“áƒ”áƒ‘áƒ áƒ¡áƒáƒ¡áƒ¬áƒáƒ£áƒšáƒ˜:
                setTimeout(() => {
                    renderBook();
// 1. áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜ áƒ¥áƒ áƒ”áƒ‘áƒ
                    if(loader) loader.classList.add('hidden');
// 2. áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ˜ áƒ©áƒœáƒ“áƒ”áƒ‘áƒ (áƒ áƒ‘áƒ˜áƒšáƒáƒ“)
                    document.body.classList.add('loaded');
                }, 150);
            });
        } catch (e) { console.warn("Cache error", e); }
    }
    await loadBookData(CURRENT_BOOK_SLUG, isCached);

}
// áƒ›áƒáƒœáƒáƒªáƒ”áƒ›áƒ”áƒ‘áƒ˜áƒ¡ áƒ›áƒ˜áƒœáƒ˜áƒ­áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ
// áƒ›áƒáƒœáƒáƒªáƒ”áƒ›áƒ”áƒ‘áƒ˜áƒ¡ áƒ›áƒ˜áƒœáƒ˜áƒ­áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ
function applyBookData(data) {
    currentBookId = data.id;
    bookMeta = {
        title: data.title,
        subtitle: data.subtitle,
        coverImage: data.cover_image,
        title_en: data.title_en,
        subtitle_en: data.subtitle_en
    };
// áƒ˜áƒœáƒ’áƒšáƒ˜áƒ¡áƒ£áƒ áƒ˜ áƒ›áƒ”áƒ¢áƒ áƒžáƒáƒ áƒáƒ–áƒ˜áƒ¢áƒ£áƒšáƒáƒ“ áƒáƒ›áƒáƒ•áƒ˜áƒ¦áƒáƒ— áƒ—áƒ£ áƒáƒ áƒ¡áƒ”áƒ‘áƒáƒ‘áƒ¡
    if (data.chapters && data.chapters[0] && data.chapters[0].meta_en) {
        bookMeta.title_en = data.chapters[0].meta_en.title || data.title;
        bookMeta.subtitle_en = data.chapters[0].meta_en.subtitle || data.subtitle;
    }
    chaptersData = data.chapters || DEFAULT_CHAPTERS;
// âŒ document.title áƒáƒ¥áƒ”áƒ“áƒáƒœ áƒáƒ›áƒáƒ¦áƒ”áƒ‘áƒ£áƒšáƒ˜áƒ!
}
async function loadBookData(slug, hasCacheRendered) {
    const loader = document.getElementById('book-loader');
    try {
        const { data, error } = await sbClient.from('book_projects').select('*').eq('slug', slug).single();
        if (error) throw error;
        const newDataString = JSON.stringify(data);
        const cachedString = localStorage.getItem('cached_book_' + slug);
// áƒ—áƒ£ áƒ¥áƒ”áƒ¨áƒ˜ áƒ’áƒ•áƒ¥áƒáƒœáƒ“áƒ áƒ“áƒ áƒ›áƒáƒœáƒáƒªáƒ”áƒ›áƒ˜ áƒ˜áƒ’áƒ˜áƒ•áƒ”áƒ -> áƒáƒ áƒáƒ¤áƒ”áƒ áƒ¡ áƒ•áƒáƒ™áƒ”áƒ—áƒ”áƒ‘áƒ— (áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜ áƒ£áƒ™áƒ•áƒ” áƒ’áƒáƒ¥áƒ áƒ initReaderMode-áƒ¨áƒ˜)
        if (hasCacheRendered && newDataString === cachedString) {
            return;
        }
        localStorage.setItem('cached_book_' + slug, newDataString);
        applyBookData(data);
        updateStaticUI();
        if (!hasCacheRendered) {
            setTimeout(() => {
                document.fonts.ready.then(() => {
                    renderBook();
                    setTimeout(() => {
                        renderBook();
                        if(loader) loader.classList.add('hidden');
                        document.body.classList.add('loaded'); // âœ… áƒ”áƒ¡ áƒ®áƒáƒ–áƒ˜ áƒ“áƒáƒáƒ›áƒáƒ¢áƒ”!
                    }, 150);
                });
            }, 10);
        } else {
// áƒ¡áƒªáƒ”áƒœáƒáƒ áƒ˜: áƒ¥áƒ”áƒ¨áƒ˜ áƒ˜áƒ§áƒ, áƒ›áƒáƒ’áƒ áƒáƒ› áƒ¡áƒ”áƒ áƒ•áƒ”áƒ áƒ–áƒ” áƒáƒ®áƒáƒšáƒ˜ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜áƒ
            console.log("ðŸ”„ New content found, updating...");
            renderBook();
// áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜ áƒáƒ¥ áƒ£áƒ™áƒ•áƒ” áƒ’áƒáƒ›áƒ¥áƒ áƒáƒšáƒ˜áƒ, áƒáƒ›áƒ˜áƒ¢áƒáƒ› áƒ®áƒ”áƒšáƒ¡ áƒáƒ  áƒ•áƒáƒ®áƒšáƒ”áƒ‘áƒ—
        }
    } catch (err) {
        console.error("Load Error:", err);
// áƒ“áƒáƒ–áƒ¦áƒ•áƒ”áƒ•áƒ: áƒ”áƒ áƒáƒ áƒ˜áƒ¡ áƒ“áƒ áƒáƒ¡ áƒ›áƒáƒ˜áƒœáƒª áƒ’áƒáƒ•áƒáƒ¥áƒ áƒáƒ— áƒšáƒáƒáƒ“áƒ”áƒ áƒ˜, áƒ áƒáƒ› áƒáƒ  áƒ’áƒáƒ˜áƒ­áƒ”áƒ“áƒáƒ¡
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

async function uploadCoverToStorage(file) {
    if (!file) return null;

    // áƒ¤áƒáƒ˜áƒšáƒ˜áƒ¡ áƒ£áƒœáƒ˜áƒ™áƒáƒšáƒ£áƒ áƒ˜ áƒ¡áƒáƒ®áƒ”áƒšáƒ˜ (áƒ“áƒ áƒ + áƒáƒ áƒ˜áƒ’áƒ˜áƒœáƒáƒšáƒ˜ áƒ¡áƒáƒ®áƒ”áƒšáƒ˜, áƒ áƒáƒ› áƒáƒ  áƒ›áƒáƒ®áƒ“áƒ”áƒ¡ áƒ“áƒ£áƒ‘áƒšáƒ˜áƒ áƒ”áƒ‘áƒ)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    // áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ Supabase Storage-áƒ¨áƒ˜
    const { data, error } = await sbClient
        .storage
        .from('covers') // áƒ“áƒáƒ áƒ¬áƒ›áƒ£áƒœáƒ“áƒ˜ áƒ áƒáƒ› bucket-áƒ¡ áƒ–áƒ£áƒ¡áƒ¢áƒáƒ“ 'covers' áƒ“áƒáƒáƒ áƒ¥áƒ•áƒ˜
        .upload(fileName, file);

    if (error) {
        console.error("Upload Error:", error);
        alert("Cover upload failed: " + error.message);
        return null;
    }

    // áƒ¡áƒáƒ¯áƒáƒ áƒ áƒšáƒ˜áƒœáƒ™áƒ˜áƒ¡ áƒ›áƒ˜áƒ¦áƒ”áƒ‘áƒ
    const { data: publicData } = sbClient
        .storage
        .from('covers')
        .getPublicUrl(fileName);

    return publicData.publicUrl;
}
// âœ… NEW: áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒ áƒ˜áƒœáƒ¢áƒ”áƒ áƒ¤áƒ”áƒ˜áƒ¡áƒ˜áƒ¡ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ (áƒ£áƒšáƒ¢áƒ áƒ áƒ¡áƒ¬áƒ áƒáƒ¤áƒ˜)
// âœ… NEW: Smart UI Update (Checks before writing to prevent blinking)
// âœ… NEW: Smart UI Update
function updateStaticUI() {
    const siteTitleEl = document.getElementById('site-main-title');
    const siteSubEl = document.getElementById('site-sub-title');
    const sidebarHeader = document.getElementById('sidebar-main-title');
// áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ”áƒ‘áƒ˜áƒ¡ áƒ›áƒáƒ›áƒ–áƒáƒ“áƒ”áƒ‘áƒ
    const displayTitle = (currentLanguage === 'en') ? (bookMeta.title_en || bookMeta.title) : bookMeta.title;
    const displaySubtitle = (currentLanguage === 'en') ? (bookMeta.subtitle_en || bookMeta.subtitle) : bookMeta.subtitle;
    const sidebarTitleText = (currentLanguage === 'en') ? "CONTENTS" : "áƒ¡áƒáƒ áƒ©áƒ”áƒ•áƒ˜";
// áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ: áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ›áƒáƒ¨áƒ˜áƒœ áƒ¬áƒ”áƒ áƒ¡, áƒ—áƒ£ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜ áƒ’áƒáƒœáƒ¡áƒ®áƒ•áƒáƒ•áƒ”áƒ‘áƒ£áƒšáƒ˜áƒ
    const safeSetText = (el, text) => {
        if (el && el.innerText !== text) {
            el.innerText = text;
        }
    };
// DOM-áƒ˜áƒ¡ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ“
    safeSetText(siteTitleEl, displayTitle || "");
    safeSetText(siteSubEl, displaySubtitle || "");
    safeSetText(sidebarHeader, sidebarTitleText);
// âŒ áƒ¬áƒáƒ¨áƒšáƒ˜áƒšáƒ˜áƒ: document.title-áƒ˜áƒ¡ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ
// áƒáƒ› áƒ®áƒáƒ–áƒ”áƒ‘áƒ¡ áƒ—áƒ£ áƒ¬áƒáƒ¨áƒšáƒ˜, áƒ‘áƒ áƒáƒ£áƒ–áƒ”áƒ áƒ˜áƒ¡ áƒ¢áƒáƒ‘áƒ–áƒ” áƒ“áƒáƒ áƒ©áƒ”áƒ‘áƒ áƒ˜áƒ¡, áƒ áƒáƒª SEO-áƒ¨áƒ˜ áƒ’áƒáƒ¥áƒ•áƒ¡ áƒ’áƒáƒ¬áƒ”áƒ áƒ˜áƒšáƒ˜
    /* if (document.title !== `${displayTitle} - Zurab Kostava`) {
    document.title = `${displayTitle} - Zurab Kostava`;
    }
    */
}
function renderBook() {
    const bookContainer = document.getElementById('book');
    bookContainer.innerHTML = '';
    paperToChapterMap = [];

    const { pages, chapterStartMap } = generateBookStructure();

    // âœ… áƒáƒ®áƒáƒšáƒ˜ áƒšáƒáƒ’áƒ˜áƒ™áƒ: áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” áƒ—áƒ˜áƒ—áƒ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒ—áƒ˜áƒ—áƒ áƒ¤áƒ£áƒ áƒªáƒ”áƒšáƒ–áƒ”
    const isMobile = window.innerWidth <= 768;

    // áƒ—áƒ£ áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ˜áƒ, áƒ¤áƒ£áƒ áƒªáƒšáƒ”áƒ‘áƒ˜áƒ¡ áƒ áƒáƒáƒ“áƒ”áƒœáƒáƒ‘áƒ = áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜áƒ¡ áƒ áƒáƒáƒ“áƒ”áƒœáƒáƒ‘áƒáƒ¡
    // áƒ—áƒ£ áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ˜áƒ, áƒ¤áƒ£áƒ áƒªáƒšáƒ”áƒ‘áƒ˜áƒ¡ áƒ áƒáƒáƒ“áƒ”áƒœáƒáƒ‘áƒ = áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜ / 2
    const totalPapers = isMobile ? pages.length : Math.ceil(pages.length / 2);

    // áƒžáƒ áƒáƒ’áƒ áƒ”áƒ¡ áƒ‘áƒáƒ áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡ (Map)
    for (let p = 0; p < totalPapers; p++) {
        // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” áƒ“áƒ áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ–áƒ” áƒ˜áƒœáƒ“áƒ”áƒ¥áƒ¡áƒáƒªáƒ˜áƒ áƒ’áƒáƒœáƒ¡áƒ®áƒ•áƒáƒ•áƒ”áƒ‘áƒ£áƒšáƒ˜áƒ
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
            // ðŸ“± áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ˜: áƒ§áƒ•áƒ”áƒšáƒ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒáƒ áƒ˜áƒ¡ "Front"
            front = pages[i];
            back = null; // áƒ£áƒ™áƒáƒœáƒ áƒ›áƒ®áƒáƒ áƒ” áƒáƒ  áƒ’áƒ•áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒ
        } else {
            // ðŸ’» áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ˜: áƒ¬áƒ§áƒ•áƒ˜áƒšáƒ”áƒ‘áƒ˜
            front = pages[i * 2];
            back = pages[i * 2 + 1];
        }

        const paper = document.createElement('div');
        paper.classList.add('paper');
        paper.id = `p${i + 1}`;

        let fClass = 'front'; if (front && front.isCover) fClass += ' hardcover-front';
        let bClass = 'back'; if (back && back.isCover) bClass += ' hardcover-back';

        // áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜áƒ¡ áƒœáƒáƒ›áƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒšáƒáƒ’áƒ˜áƒ™áƒ
        const frontNum = isMobile ? (i + 1) : (i * 2 + 1);
        const backNum = isMobile ? '' : (i * 2 + 2);

        paper.innerHTML = `
        <div class="${fClass}">
            <div class="page-content">${front ? front.html : ''}</div>
            ${(front && !front.isCover) ? `<span class="page-number">${frontNum}</span>` : ''}
        </div>
        <div class="${bClass}">
            <div class="page-content">${back ? back.html : ''}</div>
            ${(back && !back.isCover) ? `<span class="page-number">${backNum}</span>` : ''}
        </div>`;
        bookContainer.appendChild(paper);
    }

    buildDynamicSidebar(totalPapers);
    initPhysics(totalPapers);
}
// âœ… NEW: Helper to retrieve correct content based on language
// âœ… NEW: Helper to retrieve correct content
// useDraft = true (áƒ”áƒ“áƒ˜áƒ¢áƒáƒ áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡), false (áƒ›áƒ™áƒ˜áƒ—áƒ®áƒ•áƒ”áƒšáƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡)
function getChapterContent(chapter, lang, useDraft = false) {
    if (useDraft) {
        // áƒ”áƒ“áƒ˜áƒ¢áƒáƒ áƒ˜: áƒ¯áƒ”áƒ  áƒ•áƒáƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ— áƒ“áƒ áƒáƒ¤áƒ¢áƒ¡, áƒ—áƒ£ áƒáƒ  áƒáƒ áƒ˜áƒ¡ -> áƒ’áƒáƒ›áƒáƒ¥áƒ•áƒ”áƒ§áƒœáƒ”áƒ‘áƒ£áƒšáƒ¡
        if (lang === 'en') {
            return chapter.draft_content_en !== undefined ? chapter.draft_content_en : (chapter.content_en || "");
        } else {
            return chapter.draft_content !== undefined ? chapter.draft_content : (chapter.content || "");
        }
    } else {
        // áƒ›áƒ™áƒ˜áƒ—áƒ®áƒ•áƒ”áƒšáƒ˜: áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ’áƒáƒ›áƒáƒ¥áƒ•áƒ”áƒ§áƒœáƒ”áƒ‘áƒ£áƒšáƒ˜
        if (lang === 'en') {
            return chapter.content_en || "<p><i>(To be Continued)</i></p>";
        }
        return chapter.content || ""; // KA (Default)
    }
}
function getChapterTitle(chapter, lang) {
    if (lang === 'en') {
        return chapter.title_en || chapter.title;
    }
    return chapter.title;
}
function generateBookStructure() {
    const container = document.getElementById('measure-container');
    const bookScene = document.querySelector('.book-scene');
    const rect = bookScene.getBoundingClientRect();

    container.style.width = rect.width + 'px';
    container.style.height = rect.height + 'px';

    const style = getComputedStyle(container);
    const h = rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 15;

    let pages = [];
    let map = [0];

    // âœ… 1. áƒ•áƒáƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ—, áƒáƒ áƒ˜áƒ¡ áƒ—áƒ£ áƒáƒ áƒ áƒáƒ“áƒ›áƒ˜áƒœáƒ˜
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';

    // Cover Logic (áƒ˜áƒ’áƒ˜áƒ•áƒ” áƒ áƒ©áƒ”áƒ‘áƒ)
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

    // âœ… 2. áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ˜áƒ¡ áƒ’áƒ”áƒœáƒ”áƒ áƒáƒªáƒ˜áƒ
    chaptersData.forEach((ch) => {
        const contentToRender = getChapterContent(ch, currentLanguage, isAdmin);

        if (!contentToRender || contentToRender.trim() === "" || contentToRender === "<p><br></p>") {
            return;
        }

        const hyph = applyCustomGeorgianHyphenation(contentToRender);

        // âœ… CHANGE: áƒ’áƒáƒ“áƒáƒ•áƒªáƒ”áƒ›áƒ— áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜áƒ¡ áƒ áƒáƒáƒ“áƒ”áƒœáƒáƒ‘áƒáƒ¡ (pages.length)
        // áƒ”áƒ¡ áƒ¡áƒáƒ­áƒ˜áƒ áƒáƒ, áƒ áƒáƒ› áƒ’áƒáƒ•áƒ˜áƒ’áƒáƒ— áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ áƒ’áƒ•áƒ”áƒ áƒ“áƒ–áƒ” áƒ•áƒáƒ áƒ— áƒ—áƒ£ áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒáƒ–áƒ”
        const pgs = paginateContent(hyph, h, pages.length);

        pgs.forEach(p => pages.push({ html: p, isCover: false }));
    });

    return { pages, chapterStartMap: map };
}
function buildDynamicSidebar(totalPapers) {
    const sidebarList = document.getElementById('chapter-list-ui');
    sidebarList.innerHTML = '';
    const isMobile = window.innerWidth <= 768;

    // Cover
    const coverLi = document.createElement('li');
    coverLi.innerText = (currentLanguage === 'en') ? "Cover" : "áƒ’áƒáƒ áƒ”áƒ™áƒáƒœáƒ˜";
    coverLi.className = "toc-h1";
    coverLi.setAttribute('data-virtual-id', -1);

    coverLi.onclick = () => {
        const event = new CustomEvent('book-nav', {
            detail: {
                pageIndex: 0,
                total: totalPapers,
                side: 'front'
            }
        });
        document.dispatchEvent(event);
        closeSidebarMobile();
    };
    sidebarList.appendChild(coverLi);

    const papers = document.querySelectorAll('.paper');

    papers.forEach((paper, paperIndex) => {
        // áƒ•áƒ”áƒ«áƒ”áƒ‘áƒ— áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ”áƒ‘áƒ¡ áƒ áƒáƒ’áƒáƒ áƒª Front, áƒ˜áƒ¡áƒ” Back áƒ›áƒ®áƒáƒ áƒ”áƒ¡ (áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡)
        const headings = paper.querySelectorAll('h1, h2, h3');

        headings.forEach(heading => {
            if (heading.classList.contains('split-continuation')) return;

            const li = document.createElement('li');
            const fullText = heading.getAttribute('data-full-text');
            li.innerText = fullText ? fullText : heading.innerText;
            li.classList.add(`toc-${heading.tagName.toLowerCase()}`);

            // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” "Back" áƒáƒ  áƒáƒ áƒ¡áƒ”áƒ‘áƒáƒ‘áƒ¡, áƒ§áƒ•áƒ”áƒšáƒáƒ¤áƒ”áƒ áƒ˜ Front-áƒ˜áƒ
            const isBack = isMobile ? false : (heading.closest('.back') !== null);
            const side = isBack ? 'back' : 'front';

            // ID áƒ¡áƒ™áƒ áƒáƒšáƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
            let virtualId;
            if (isMobile) {
                virtualId = paperIndex; // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” áƒ›áƒáƒ áƒ¢áƒ˜áƒ•áƒ˜áƒ: 1 áƒ¤áƒ£áƒ áƒªáƒ”áƒšáƒ˜ = 1 ID
            } else {
                virtualId = (paperIndex * 2) + (isBack ? 1 : 0);
            }

            li.setAttribute('data-virtual-id', virtualId);

            // áƒ”áƒ¡ áƒ£áƒ‘áƒ áƒáƒšáƒáƒ“ áƒ•áƒ˜áƒ–áƒ£áƒáƒšáƒ£áƒ áƒ˜ áƒœáƒáƒ›áƒ áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡ (áƒ—áƒ£ áƒ“áƒáƒ’áƒ­áƒ˜áƒ áƒ“áƒ)
            li.setAttribute('data-target-page', paperIndex + 1);

            li.onclick = () => {
                const event = new CustomEvent('book-nav', {
                    detail: {
                        pageIndex: paperIndex,
                        total: totalPapers,
                        side: side
                    }
                });
                document.dispatchEvent(event);
                closeSidebarMobile();
            };
            sidebarList.appendChild(li);
        });
    });
}
// UTILS (Hyphenation and Pagination - UNCHANGED)
function applyCustomGeorgianHyphenation(html) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = html; function traverse(node) { if (node.nodeType === 3) { const words = node.nodeValue.split(' '); const processedWords = words.map(word => hyphenateWord(word)); node.nodeValue = processedWords.join(' '); } else { for (let child of node.childNodes) traverse(child); } } traverse(tempDiv); return tempDiv.innerHTML; }
function hyphenateWord(word) { if (word.length < 5) return word; if (!/[áƒ-áƒ°]/.test(word)) return word; const vowels = "áƒáƒ”áƒ˜áƒáƒ£"; const isV = (c) => vowels.includes(c); const isC = (c) => !vowels.includes(c) && c !== undefined; let result = ""; let chars = word.split(''); for (let i = 0; i < chars.length; i++) { result += chars[i]; if (i >= chars.length - 2) continue; if (i < 1) continue; let cur = chars[i], next = chars[i+1], after = chars[i+2], prev = chars[i-1]; if (isV(cur) && isV(next)) { result += '\u00AD'; continue; } if (isV(cur) && isC(next) && isV(after)) { result += '\u00AD'; continue; } if (isC(cur) && isC(next)) { if (isV(prev)) { result += '\u00AD'; continue; } } } return result; }
// ==========================================
// SMART PAGINATION (HANDLES FULL-PAGE IMAGES)
// ==========================================
// ==========================================
// SMART PAGINATION (AUTO-LEFT IMAGE)
// ==========================================
// startPageIndex - áƒ¡áƒ£áƒš áƒ áƒáƒ›áƒ“áƒ”áƒœáƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒáƒ¥áƒ•áƒ¡ áƒ¬áƒ˜áƒ’áƒœáƒ¡ áƒáƒ› áƒ—áƒáƒ•áƒáƒ›áƒ“áƒ”
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

        // 1. áƒ•áƒáƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ— áƒ¡áƒ£áƒ áƒáƒ—áƒ¡
        const imgElement = node.querySelector('img') || (node.tagName === 'IMG' ? node : null);

        if (imgElement) {
            // A. áƒ—áƒ£ áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ’áƒ•áƒ”áƒ áƒ“áƒ–áƒ” áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜áƒ, áƒ•áƒ®áƒ£áƒ áƒáƒ•áƒ— áƒáƒ› áƒ’áƒ•áƒ”áƒ áƒ“áƒ¡
            if (currentPageContent.innerHTML.trim() !== '') {
                pages.push(currentPageContent.innerHTML);
                currentPageContent = document.createElement('div');
            }

            // B. âœ… áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ áƒ›áƒ®áƒáƒ áƒ˜áƒ¡ áƒšáƒáƒ’áƒ˜áƒ™áƒ (áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ–áƒ”)
            if (window.innerWidth > 768) {
                // áƒ•áƒ˜áƒ—áƒ•áƒšáƒ˜áƒ— áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒáƒ‘áƒ¡áƒáƒšáƒ£áƒ¢áƒ£áƒ  áƒ˜áƒœáƒ“áƒ”áƒ¥áƒ¡áƒ¡
                // startPageIndex (áƒ¬áƒ˜áƒœáƒ áƒ—áƒáƒ•áƒ”áƒ‘áƒ˜áƒ¡ áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜) + pages.length (áƒáƒ› áƒ—áƒáƒ•áƒ˜áƒ¡ áƒ£áƒ™áƒ•áƒ” áƒ¨áƒ”áƒ¥áƒ›áƒœáƒ˜áƒšáƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜)
                const currentTotalPages = startPageIndex + pages.length;

                // 0 = áƒ’áƒáƒ áƒ”áƒ™áƒáƒœáƒ˜ (áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ/Front)
                // 1 = áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ (Back)
                // 2 = áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ (Front)
                // 3 = áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ (Back)
                // áƒ¬áƒ”áƒ¡áƒ˜: áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ¡ áƒ§áƒáƒ•áƒ”áƒšáƒ—áƒ•áƒ˜áƒ¡ áƒáƒ¥áƒ•áƒ— áƒ™áƒ”áƒœáƒ¢áƒ˜ (Odd) áƒ˜áƒœáƒ“áƒ”áƒ¥áƒ¡áƒ˜.
                // áƒ—áƒ£ currentTotalPages áƒáƒ áƒ˜áƒ¡ áƒšáƒ£áƒ¬áƒ˜ (áƒ›áƒáƒ’: 2), áƒ”áƒ¡áƒ” áƒ˜áƒ’áƒ˜ áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’áƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒ˜áƒ¥áƒœáƒ”áƒ‘áƒ 2 (áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ).
                // áƒ©áƒ•áƒ”áƒœ áƒ™áƒ˜ áƒ’áƒ•áƒ˜áƒœáƒ“áƒ áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ. áƒáƒ›áƒ˜áƒ¢áƒáƒ› áƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ— áƒ¡áƒžáƒ”áƒ˜áƒ¡áƒ”áƒ áƒ¡.

                if (currentTotalPages % 2 === 0) {
                    // áƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ— áƒªáƒáƒ áƒ˜áƒ”áƒš áƒ’áƒ•áƒ”áƒ áƒ“áƒ¡
                    pages.push('<div class="spacer-page" style="width:100%;height:100%;"></div>');
                }
            }

            // C. áƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ— áƒ¡áƒ£áƒ áƒáƒ—áƒ¡ (áƒáƒ®áƒšáƒ áƒ˜áƒ¡ áƒáƒ£áƒªáƒ˜áƒšáƒ”áƒ‘áƒšáƒáƒ“ áƒ›áƒáƒ áƒªáƒ®áƒœáƒ˜áƒ• áƒ›áƒáƒ®áƒ•áƒ“áƒ”áƒ‘áƒ)
            const imgSrc = imgElement.getAttribute('src');
            const fullPageImgHTML = `<div class="full-page-img-wrapper"><img src="${imgSrc}"></div>`;
            pages.push(fullPageImgHTML);

            continue;
        }

        // 2. áƒ©áƒ•áƒ”áƒ£áƒšáƒ”áƒ‘áƒ áƒ˜áƒ•áƒ˜ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜áƒ¡ áƒšáƒáƒ’áƒ˜áƒ™áƒ
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
// ==========================================
// OPTIMIZED SPLIT FUNCTION (BINARY SEARCH)
// ==========================================
function splitNodeByWords(originalNode, containerState, limit) {
    // 1. áƒ•áƒáƒšáƒ˜áƒ“áƒáƒªáƒ˜áƒ: áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ£áƒ  áƒ‘áƒšáƒáƒ™áƒ”áƒ‘áƒ¡ áƒ•áƒ­áƒ áƒ˜áƒ—
    if (originalNode.tagName !== 'P' &&
        !originalNode.tagName.startsWith('H') &&
        originalNode.tagName !== 'BLOCKQUOTE') {
        return { fittedNode: null, remainingNode: originalNode };
    }

    const type = originalNode.tagName;
    const fullText = originalNode.innerText; // áƒ˜áƒœáƒáƒ®áƒáƒ•áƒ¡ áƒ¡áƒ áƒ£áƒš áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ¡ TOC-áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
    const words = originalNode.innerHTML.split(' '); // áƒ¡áƒ˜áƒ¢áƒ§áƒ•áƒ”áƒ‘áƒ˜áƒ¡ áƒ›áƒáƒ¡áƒ˜áƒ•áƒ˜

    // áƒ“áƒ áƒáƒ”áƒ‘áƒ˜áƒ—áƒ˜ áƒœáƒáƒ£áƒ“áƒ˜ áƒ’áƒáƒ–áƒáƒ›áƒ•áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
    const tempNode = document.createElement(type);
    tempNode.className = originalNode.className;
    containerState.appendChild(tempNode);

    let low = 0;
    let high = words.length;
    let bestFitIndex = 0;

    // 2. áƒ‘áƒ˜áƒœáƒáƒ áƒ£áƒšáƒ˜ áƒ«áƒ”áƒ‘áƒœáƒ (Binary Search) - áƒáƒ©áƒ¥áƒáƒ áƒ”áƒ‘áƒ¡ áƒžáƒ áƒáƒªáƒ”áƒ¡áƒ¡
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testStr = words.slice(0, mid).join(' ');

        tempNode.innerHTML = testStr;

        // áƒ•áƒáƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ—, áƒ’áƒáƒ¡áƒªáƒ“áƒ áƒ—áƒ£ áƒáƒ áƒ áƒšáƒ˜áƒ›áƒ˜áƒ¢áƒ¡
        if (containerState.offsetHeight <= limit) {
            bestFitIndex = mid; // áƒ”áƒ¡ áƒ áƒáƒáƒ“áƒ”áƒœáƒáƒ‘áƒ áƒ”áƒ¢áƒ”áƒ•áƒ, áƒ•áƒªáƒáƒ“áƒáƒ— áƒ›áƒ”áƒ¢áƒ˜
            low = mid + 1;
        } else {
            high = mid - 1; // áƒáƒ  áƒ”áƒ¢áƒ”áƒ•áƒ, áƒ•áƒªáƒáƒ“áƒáƒ— áƒœáƒáƒ™áƒšáƒ”áƒ‘áƒ˜
        }
    }

    // áƒ•áƒ¨áƒšáƒ˜áƒ— áƒ“áƒ áƒáƒ”áƒ‘áƒ˜áƒ— áƒ”áƒšáƒ”áƒ›áƒ”áƒœáƒ¢áƒ¡
    containerState.removeChild(tempNode);

    // 3. áƒ—áƒ£ áƒáƒ áƒáƒ¤áƒ”áƒ áƒ˜ áƒáƒ  áƒ©áƒáƒ”áƒ¢áƒ˜áƒ (áƒ«áƒáƒšáƒ˜áƒáƒœ áƒ•áƒ˜áƒ¬áƒ áƒ áƒáƒ“áƒ’áƒ˜áƒšáƒ˜áƒ áƒáƒœ áƒ“áƒ˜áƒ“áƒ˜ áƒ¡áƒ˜áƒ¢áƒ§áƒ•áƒ)
    if (bestFitIndex === 0) {
        return { fittedNode: null, remainingNode: originalNode };
    }

    // 4. áƒ¨áƒ”áƒ“áƒ”áƒ’áƒ˜áƒ¡ áƒ¤áƒáƒ áƒ›áƒ˜áƒ áƒ”áƒ‘áƒ
    const fittedNode = document.createElement(type);
    fittedNode.innerHTML = words.slice(0, bestFitIndex).join(' ');
    fittedNode.className = originalNode.className;
    // áƒáƒ¢áƒ áƒ˜áƒ‘áƒ£áƒ¢áƒ˜ áƒ¡áƒáƒ áƒ©áƒ”áƒ•áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡ (áƒ›áƒ®áƒáƒšáƒáƒ“ áƒžáƒ˜áƒ áƒ•áƒ”áƒš áƒœáƒáƒ¬áƒ˜áƒšáƒ¡ áƒ¡áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒ)
    fittedNode.setAttribute('data-full-text', fullText);

    let remainingNode = null;
    if (bestFitIndex < words.length) {
        remainingNode = document.createElement(type);
        remainingNode.innerHTML = words.slice(bestFitIndex).join(' ');
        remainingNode.className = originalNode.className;
        remainingNode.classList.add('split-continuation'); // CSS-áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
    }

    return { fittedNode, remainingNode };
}
function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.add('collapsed');
        document.body.classList.add('sidebar-closed');
    }
}
// ==========================================
// 7. PHYSICS ENGINE (ANDROID TOUCH FIX)
// ==========================================
let lastLoggedChapter = -1;

function initPhysics(totalPapers) {
    const papers = Array.from(document.querySelectorAll('.paper'));
    const bookContainer = document.getElementById('book');

    // 1. áƒžáƒáƒ–áƒ˜áƒªáƒ˜áƒ˜áƒ¡ áƒáƒ¦áƒ“áƒ’áƒ”áƒœáƒ (LocalStorage)
    const storageKey = 'book_cursor_' + CURRENT_BOOK_SLUG;
    const savedPage = localStorage.getItem(storageKey);
    let savedLocation = savedPage ? parseInt(savedPage) : null;

    // 2. URL-áƒ˜áƒ¡ áƒ¨áƒ”áƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ (?ch=...)
    const urlParams = new URLSearchParams(window.location.search);
    const targetChParam = parseInt(urlParams.get('ch'));

    // 3. áƒžáƒ áƒ˜áƒáƒ áƒ˜áƒ¢áƒ”áƒ¢áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒáƒšáƒáƒ’áƒ”áƒ‘áƒ
    let currentLocation = 1;

    if (targetChParam && !isNaN(targetChParam) && paperToChapterMap.length > 0) {
        // áƒ—áƒ£ URL-áƒ¨áƒ˜ áƒ¬áƒ”áƒ áƒ˜áƒ áƒ—áƒáƒ•áƒ˜ (áƒ›áƒáƒ’: ?ch=2)

        // áƒ•áƒžáƒáƒ£áƒšáƒáƒ‘áƒ— áƒáƒ› áƒ—áƒáƒ•áƒ˜áƒ¡ áƒ˜áƒœáƒ“áƒ”áƒ¥áƒ¡áƒ¡ (URL áƒáƒ áƒ˜áƒ¡ 1-based, áƒ›áƒáƒ¡áƒ˜áƒ•áƒ˜ 0-based)
        const targetChIndex = targetChParam - 1;
        // áƒ•áƒžáƒáƒ£áƒšáƒáƒ‘áƒ— áƒáƒ› áƒ—áƒáƒ•áƒ˜áƒ¡ áƒžáƒ˜áƒ áƒ•áƒ”áƒš áƒ’áƒ•áƒ”áƒ áƒ“áƒ¡
        const targetPageIndex = paperToChapterMap.indexOf(targetChIndex);

        if (targetPageIndex !== -1) {
            const chapterStartPage = targetPageIndex + 1;

            // ðŸ§  SMART LOGIC:
            // áƒ—áƒ£ áƒ¨áƒ”áƒœáƒáƒ®áƒ£áƒšáƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒáƒ áƒ¡áƒ”áƒ‘áƒáƒ‘áƒ¡ áƒ“áƒ áƒ˜áƒ¡ áƒáƒ›áƒáƒ•áƒ” áƒ—áƒáƒ•áƒ¨áƒ˜áƒ,
            // áƒ›áƒáƒ¨áƒ˜áƒœ áƒ•áƒ˜áƒ§áƒ”áƒœáƒ”áƒ‘áƒ— áƒ¨áƒ”áƒœáƒáƒ®áƒ£áƒš áƒ’áƒ•áƒ”áƒ áƒ“áƒ¡ (áƒ–áƒ£áƒ¡áƒ¢ áƒžáƒáƒ–áƒ˜áƒªáƒ˜áƒáƒ¡).
            // áƒ—áƒ£ áƒ¡áƒ®áƒ•áƒ áƒ—áƒáƒ•áƒ¨áƒ˜áƒ, áƒ”áƒ¡áƒ” áƒ˜áƒ’áƒ˜ áƒšáƒ˜áƒœáƒ™áƒ˜áƒ— áƒ’áƒáƒ“áƒ›áƒáƒ®áƒ•áƒ”áƒ“áƒ˜ -> áƒ›áƒ˜áƒ•áƒ“áƒ˜áƒ•áƒáƒ áƒ— áƒ—áƒáƒ•áƒ˜áƒ¡ áƒ“áƒáƒ¡áƒáƒ¬áƒ§áƒ˜áƒ¡áƒ¨áƒ˜.

            if (savedLocation && paperToChapterMap[savedLocation - 1] === targetChIndex) {
                currentLocation = savedLocation; // áƒ–áƒ£áƒ¡áƒ¢áƒ˜ áƒžáƒáƒ–áƒ˜áƒªáƒ˜áƒ
            } else {
                currentLocation = chapterStartPage; // áƒ—áƒáƒ•áƒ˜áƒ¡ áƒ“áƒáƒ¡áƒáƒ¬áƒ§áƒ˜áƒ¡áƒ˜
            }
        } else {
            currentLocation = savedLocation || 1;
        }
    } else {
        // áƒ—áƒ£ URL áƒžáƒáƒ áƒáƒ›áƒ”áƒ¢áƒ áƒ˜ áƒáƒ  áƒáƒ áƒ˜áƒ¡ -> áƒ•áƒ˜áƒ§áƒ”áƒœáƒ”áƒ‘áƒ— Save-áƒ¡
        currentLocation = savedLocation || 1;
    }

    // áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ: áƒáƒ  áƒ’áƒáƒ•áƒªáƒ“áƒ”áƒ— áƒšáƒ˜áƒ›áƒ˜áƒ¢áƒ”áƒ‘áƒ¡
    if (currentLocation > totalPapers + 1) currentLocation = 1;
    const maxLocation = totalPapers + 1;
    let mobileShowBack = false;
    const animTime = 800;
// TOUCH VARIABLES
    let isBusy = false;
    let touchStartX = 0;
    let touchStartY = 0; // áƒ¡áƒ¥áƒ áƒáƒšáƒ˜áƒ¡ áƒ“áƒ”áƒ¢áƒ”áƒ¥áƒªáƒ˜áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
// 2. SYNC VISUALS
    function syncVisuals(instant = false, targetSide = 'front') {
        papers.forEach((p, i) => {
            if (instant) p.style.transition = 'none';
            if (i < currentLocation - 1) {
                p.classList.add('flipped');
// áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” áƒ’áƒáƒ“áƒáƒ¨áƒšáƒ˜áƒšáƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒ¡áƒ áƒ£áƒšáƒ˜áƒáƒ“ áƒ›áƒáƒ•áƒáƒ¨áƒáƒ áƒáƒ— DOM-áƒ˜áƒ“áƒáƒœ (display:none),
// áƒ áƒáƒ› áƒ®áƒ”áƒšáƒ¡ áƒáƒ  áƒ£áƒ¨áƒšáƒ˜áƒ“áƒ”áƒ¡ áƒ™áƒšáƒ˜áƒ™áƒ¡
                if (window.innerWidth <= 768) p.style.display = 'none';
            } else {
                p.classList.remove('flipped');
                if (window.innerWidth <= 768) p.style.display = 'block';
            }
            p.classList.remove('mobile-view-back'); // Reset back state
// Z-Index Fix
            p.style.zIndex = (i < currentLocation - 1) ? i : totalPapers - i;
        });
// Mobile Back State Logic
        if (window.innerWidth <= 768) {
            mobileShowBack = (targetSide === 'back');
            if (mobileShowBack) {
                const currentPaper = papers[currentLocation - 1];
                if (currentPaper) currentPaper.classList.add('mobile-view-back');
            }
        } else {
            mobileShowBack = false;
        }
        updateState();
        if (instant) {
            setTimeout(() => { papers.forEach(p => p.style.transition = ''); }, 100);
        }
    }
// âœ… SIDEBAR LISTENER
    document.addEventListener('book-nav', (e) => {
        const { pageIndex, side } = e.detail;
        let targetLocation = pageIndex + 1;
// Desktop Offset Fix
        if (window.innerWidth > 768 && side === 'back') {
            targetLocation += 1;
        }
        currentLocation = targetLocation;
        syncVisuals(true, side);
    });
// =========================================
// âœ… TOUCH & CLICK HANDLING (THE FIX)
// =========================================
// 1. DESKTOP CLICKS (áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ›áƒáƒ£áƒ¡áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡)
    papers.forEach((paper, index) => {
        paper.style.zIndex = totalPapers - index;
        paper.onclick = (e) => {
// áƒ—áƒ£ áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ˜áƒ, onclick-áƒ¡ áƒ•áƒáƒ˜áƒ’áƒœáƒáƒ áƒ”áƒ‘áƒ— (Touch-áƒ¡ áƒ•áƒ˜áƒ§áƒ”áƒœáƒ”áƒ‘áƒ—)
            if (window.innerWidth <= 768) return;
            if (isBusy) return;
            if (currentLocation <= totalPapers) {
                if (currentLocation === index + 1) nextDesk();
                else if (currentLocation === index + 2) prevDesk();
            }
        };
    });
// 2. MOBILE TOUCH (Swipe + Tap)
// áƒ›áƒ—áƒšáƒ˜áƒáƒœ áƒ™áƒáƒœáƒ¢áƒ”áƒ˜áƒœáƒ”áƒ áƒ¡ áƒ•áƒ£áƒ¡áƒ›áƒ”áƒœáƒ—
    bookContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    bookContainer.addEventListener('touchend', (e) => {
// áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ”
        if (window.innerWidth > 768) return;
        if (isBusy) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
// áƒ—áƒ£ áƒ›áƒáƒ›áƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ”áƒšáƒ˜ áƒ¡áƒ¥áƒ áƒáƒšáƒáƒ•áƒ¡ (áƒ•áƒ”áƒ áƒ¢áƒ˜áƒ™áƒáƒšáƒ£áƒ áƒáƒ“), áƒáƒ  áƒ’áƒáƒ“áƒáƒ•áƒ¤áƒ£áƒ áƒªáƒšáƒáƒ—
        if (Math.abs(diffY) > Math.abs(diffX)) return;
// SWIPE DETECTION (> 50px)
        if (Math.abs(diffX) > 50) {
            if (diffX < 0) nextMob(); // Swipe Left -> Next
            else prevMob(); // Swipe Right -> Prev
        }
// TAP DETECTION (áƒ—áƒ£ áƒ—áƒ˜áƒ—áƒ˜ áƒáƒ  áƒ’áƒáƒ£áƒ¡áƒ•áƒ˜áƒ, áƒ”áƒ¡áƒ” áƒ˜áƒ’áƒ˜ áƒ“áƒáƒáƒ™áƒšáƒ˜áƒ™áƒ)
        else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
            const width = window.innerWidth;
// áƒ”áƒ™áƒ áƒáƒœáƒ˜áƒ¡ áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ áƒ›áƒ®áƒáƒ áƒ” -> Next, áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ -> Prev
            if (touchEndX > width / 2) nextMob();
            else prevMob();
        }
    }, { passive: true });
// 3. DESKTOP REVERSE CLICK (Container)
    bookContainer.onclick = (e) => {
        if (window.innerWidth <= 768) return; // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” onclick áƒáƒ  áƒ’áƒ•áƒ˜áƒœáƒ“áƒ
        if (isBusy) return;
        if (currentLocation > totalPapers) {
            const rect = bookContainer.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width / 2) {
                prevDesk();
            }
        }
    };
// áƒ¨áƒ”áƒœáƒ¡ script.js-áƒ¨áƒ˜ áƒ˜áƒžáƒáƒ•áƒ” áƒ“áƒ áƒ©áƒáƒáƒœáƒáƒªáƒ•áƒšáƒ” áƒ”áƒ¡ áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ”áƒ‘áƒ˜:

    function nextMob() {
        lockInput(200);
        if (currentLocation > totalPapers) return;

        // Mobile "Back" áƒšáƒáƒ’áƒ˜áƒ™áƒ (áƒ—áƒ£ áƒ£áƒ™áƒáƒœáƒ áƒ›áƒ®áƒáƒ áƒ”áƒ¡ áƒáƒ©áƒ•áƒ”áƒœáƒ”áƒ‘áƒ“áƒ)
        if (!mobileShowBack) {
            // áƒ©áƒ•áƒ”áƒœ áƒ’áƒáƒ•áƒ—áƒ˜áƒ¨áƒ”áƒ— Back áƒ›áƒ®áƒáƒ áƒ” áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ” CSS-áƒ˜áƒ—,
            // áƒáƒ›áƒ˜áƒ¢áƒáƒ› áƒáƒ¥ áƒžáƒ˜áƒ áƒ“áƒáƒžáƒ˜áƒ  áƒ’áƒáƒ“áƒáƒ•áƒ“áƒ˜áƒ•áƒáƒ áƒ— áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’áƒ–áƒ”

            // áƒ«áƒ•áƒ”áƒšáƒ˜ áƒ™áƒáƒ“áƒ˜: papers[currentLocation - 1].style.display = 'none';  <-- áƒ”áƒ¡ áƒ¬áƒáƒ•áƒ¨áƒáƒšáƒ”áƒ—!

            papers[currentLocation - 1].classList.add('flipped'); // áƒ”áƒ¡ áƒ’áƒáƒ£áƒ¨áƒ•áƒ”áƒ‘áƒ¡ CSS áƒáƒœáƒ˜áƒ›áƒáƒªáƒ˜áƒáƒ¡ (áƒ›áƒáƒ áƒªáƒ®áƒœáƒ˜áƒ• áƒ’áƒáƒªáƒ£áƒ áƒ”áƒ‘áƒáƒ¡)

            currentLocation++;
            mobileShowBack = false;
            reZ(); // Z-index-áƒ”áƒ‘áƒ˜áƒ¡ áƒ’áƒáƒ“áƒáƒšáƒáƒ’áƒ”áƒ‘áƒ
            updateState();
        }
        // áƒ¨áƒ”áƒœáƒ˜áƒ¨áƒ•áƒœáƒ: áƒ áƒáƒ“áƒ’áƒáƒœ CSS-áƒ¨áƒ˜ .back áƒ’áƒáƒ•áƒ—áƒ˜áƒ¨áƒ”áƒ—, else áƒ‘áƒšáƒáƒ™áƒ˜ áƒ¤áƒáƒ¥áƒ¢áƒáƒ‘áƒ áƒ˜áƒ•áƒáƒ“ áƒáƒ¦áƒáƒ  áƒ’áƒ•áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒ,
        // áƒ›áƒáƒ’áƒ áƒáƒ› áƒ¡áƒ¢áƒ áƒ£áƒ¥áƒ¢áƒ£áƒ áƒ áƒ“áƒáƒ•áƒ¢áƒáƒ•áƒáƒ— áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡.
    }

    function prevMob() {
        lockInput(200);
        if (currentLocation === 1) return; // áƒ“áƒáƒ¡áƒáƒ¬áƒ§áƒ˜áƒ¡áƒ˜áƒ

        currentLocation--;
        const p = papers[currentLocation - 1];

        // áƒ«áƒ•áƒ”áƒšáƒ˜ áƒ™áƒáƒ“áƒ˜: p.style.display = 'block'; <-- áƒ”áƒ¡ áƒ¬áƒáƒ•áƒ¨áƒáƒšáƒ”áƒ—!

        // áƒ›áƒªáƒ˜áƒ áƒ” áƒ“áƒáƒ§áƒáƒ•áƒœáƒ”áƒ‘áƒ áƒáƒ¦áƒáƒ  áƒ’áƒ•áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒ, áƒ áƒáƒ“áƒ’áƒáƒœ áƒ”áƒšáƒ”áƒ›áƒ”áƒœáƒ¢áƒ˜ áƒ¡áƒ£áƒš DOM-áƒ¨áƒ˜áƒ
        p.classList.remove('flipped'); // áƒ”áƒ¡ áƒ“áƒáƒáƒ‘áƒ áƒ£áƒœáƒ”áƒ‘áƒ¡ áƒ’áƒ•áƒ”áƒ áƒ“áƒ¡ áƒ”áƒ™áƒ áƒáƒœáƒ–áƒ” (áƒ›áƒáƒ áƒ¯áƒ•áƒœáƒ˜áƒ“áƒáƒœ áƒ¨áƒ”áƒ›áƒáƒªáƒ£áƒ áƒ“áƒ”áƒ‘áƒ)

        mobileShowBack = false;
        reZ();
        updateState();
    }
    function nextDesk() {
        if (currentLocation < maxLocation) {
            lockInput(300);
            const p = papers[currentLocation - 1];
            p.classList.add("moving", "flipped");
            p.style.zIndex = maxLocation + 1;
            currentLocation++;
            updateState();
            setTimeout(() => { p.classList.remove("moving"); reZ(); }, animTime/2);
        }
    }
    function prevDesk() {
        if (currentLocation > 1) {
            lockInput(300);
            const p = papers[currentLocation - 2];
            p.classList.add("moving");
            p.classList.remove("flipped");
            p.style.zIndex = maxLocation + 1;
            currentLocation--;
            updateState();
            setTimeout(() => { p.classList.remove("moving"); reZ(); }, animTime/2);
        }
    }
    function reZ() {
        papers.forEach((p, i) => {
            if (window.innerWidth <= 768) {
                // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ˜: áƒ’áƒ•áƒ”áƒ áƒ“áƒ”áƒ‘áƒ˜ áƒ“áƒáƒšáƒáƒ’áƒ”áƒ‘áƒ£áƒšáƒ˜áƒ "áƒ“áƒáƒ¡áƒ¢áƒáƒ“".
                // áƒžáƒ˜áƒ áƒ•áƒ”áƒšáƒ˜ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ (Cover) áƒ¡áƒ£áƒš áƒ–áƒ”áƒ›áƒáƒ— (áƒ“áƒ˜áƒ“áƒ˜ Z), áƒ‘áƒáƒšáƒ áƒ¡áƒ£áƒš áƒ¥áƒ•áƒ”áƒ›áƒáƒ—.
                // áƒ áƒáƒªáƒ Flipped áƒ®áƒ“áƒ”áƒ‘áƒ, áƒ˜áƒ¡ áƒ’áƒáƒ“áƒ˜áƒ¡ áƒ”áƒ™áƒ áƒáƒœáƒ˜áƒ“áƒáƒœ, áƒáƒ›áƒ˜áƒ¢áƒáƒ› Z áƒáƒ¦áƒáƒ  áƒáƒ áƒ˜áƒ¡ áƒ™áƒ áƒ˜áƒ¢áƒ˜áƒ™áƒ£áƒšáƒ˜,
                // áƒ›áƒáƒ’áƒ áƒáƒ› áƒ¡áƒ¯áƒáƒ‘áƒ¡ áƒ›áƒáƒ¦áƒáƒšáƒ˜ áƒ“áƒáƒ áƒ©áƒ”áƒ¡ áƒ áƒáƒ› áƒáƒœáƒ˜áƒ›áƒáƒªáƒ˜áƒ˜áƒ¡áƒáƒ¡ áƒ–áƒ”áƒ›áƒáƒ“áƒáƒœ áƒ’áƒáƒ“áƒáƒ˜áƒáƒ áƒáƒ¡.
                p.style.zIndex = totalPapers - i;
            } else {
                // áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ˜ (áƒ¨áƒ”áƒœáƒ˜ áƒ«áƒ•áƒ”áƒšáƒ˜ áƒšáƒáƒ’áƒ˜áƒ™áƒ)
                p.style.zIndex = (i < currentLocation - 1) ? i : totalPapers - i;
            }
        });
    }
    function updateState(forceMobileBack = false) {
        updateBookState(currentLocation);
        highlightActiveSidebarItem(currentLocation, forceMobileBack || mobileShowBack);

        if (CURRENT_BOOK_SLUG) {
            localStorage.setItem(storageKey, currentLocation);
        }

        // âœ… NEW: URL-áƒ˜áƒ¡ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ áƒ—áƒáƒ•áƒ”áƒ‘áƒ˜áƒ¡ áƒ›áƒ˜áƒ®áƒ”áƒ“áƒ•áƒ˜áƒ—
        if (paperToChapterMap.length > 0) {
            // áƒ•áƒ’áƒ”áƒ‘áƒ£áƒšáƒáƒ‘áƒ— áƒ áƒáƒ›áƒ”áƒš áƒ—áƒáƒ•áƒ¨áƒ˜áƒ áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜
            // currentLocation - 1 áƒ áƒáƒ“áƒ’áƒáƒœ áƒ›áƒáƒ¡áƒ˜áƒ•áƒ˜ 0-áƒ“áƒáƒœ áƒ˜áƒ¬áƒ§áƒ”áƒ‘áƒ
            const currentChIndex = paperToChapterMap[currentLocation - 1];

            // áƒ—áƒ£ áƒ—áƒáƒ•áƒ˜ áƒ¨áƒ”áƒ˜áƒªáƒ•áƒáƒšáƒ (áƒáƒœ áƒžáƒ˜áƒ áƒ•áƒ”áƒšáƒ˜ áƒ©áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒáƒ)
            if (currentChIndex !== undefined && currentChIndex !== lastLoggedChapter) {
                lastLoggedChapter = currentChIndex;

                // URL-áƒ˜áƒ¡ áƒ¨áƒ”áƒ¥áƒ›áƒœáƒ: ?ch=1, ?ch=2... (áƒáƒ“áƒáƒ›áƒ˜áƒáƒœáƒ£áƒ áƒ˜ áƒ˜áƒœáƒ“áƒ”áƒ¥áƒ¡áƒ˜áƒ—, áƒáƒœáƒ£ +1)
                const url = new URL(window.location);
                url.searchParams.set('ch', currentChIndex + 1);

                // URL-áƒ˜áƒ¡ áƒ¨áƒ”áƒªáƒ•áƒšáƒ áƒ˜áƒ¡áƒ”, áƒ áƒáƒ› áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒáƒ  áƒ’áƒáƒ“áƒáƒ˜áƒ¢áƒ•áƒ˜áƒ áƒ—áƒáƒ¡
                // replaceState-áƒ¡ áƒ•áƒ˜áƒ§áƒ”áƒœáƒ”áƒ‘áƒ—, áƒ áƒáƒ› Back áƒ¦áƒ˜áƒšáƒáƒ™áƒ›áƒ áƒáƒ  áƒ’áƒáƒ­áƒ”áƒ“áƒáƒ¡ áƒ›áƒ™áƒ˜áƒ—áƒ®áƒ•áƒ”áƒšáƒ˜ áƒ£áƒ¡áƒáƒ¡áƒ áƒ£áƒšáƒ áƒ˜áƒ¡áƒ¢áƒáƒ áƒ˜áƒáƒ¨áƒ˜
                window.history.replaceState({}, '', url);
            }
        }
    }
    function lockInput(time) { isBusy = true; setTimeout(() => { isBusy = false; }, time); }
    function unlockInput() { isBusy = false; } // áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ”
// ðŸš€ INITIAL LAUNCH
    syncVisuals(true, 'front');
}
function highlightActiveSidebarItem(currentLocation, isMobileBack) {
    const items = Array.from(document.querySelectorAll('#chapter-list-ui li'));
    items.forEach(item => item.classList.remove('active'));

    let visibleVirtualIds = [];
    const pIndex = currentLocation - 1;
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // áƒ›áƒáƒ‘áƒ˜áƒšáƒ£áƒ áƒ–áƒ”: áƒ áƒáƒ›áƒ”áƒšáƒ˜ áƒ¤áƒ£áƒ áƒªáƒ”áƒšáƒ˜áƒªáƒáƒ, áƒ˜áƒ¡ ID-áƒ
        visibleVirtualIds.push(pIndex);
    } else {
        // áƒ“áƒ”áƒ¡áƒ™áƒ¢áƒáƒžáƒ–áƒ”: áƒ«áƒ•áƒ”áƒšáƒ˜ áƒšáƒáƒ’áƒ˜áƒ™áƒ (áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ áƒ“áƒ áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜)
        if (pIndex > 0) visibleVirtualIds.push(((pIndex - 1) * 2) + 1); // áƒ›áƒáƒ áƒªáƒ®áƒ”áƒœáƒ
        visibleVirtualIds.push(pIndex * 2); // áƒ›áƒáƒ áƒ¯áƒ•áƒ”áƒœáƒ
    }

    const activeOnScreen = items.filter(item => {
        const vId = parseInt(item.getAttribute('data-virtual-id'));
        return visibleVirtualIds.includes(vId);
    });

    if (activeOnScreen.length > 0) {
        activeOnScreen.forEach(i => i.classList.add('active'));
        // áƒ¡áƒáƒ áƒ©áƒ”áƒ•áƒ˜áƒ¡ áƒ¡áƒ¥áƒ áƒáƒšáƒ˜
        if (!isMobile) activeOnScreen[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        // áƒ—áƒ£ áƒ–áƒ£áƒ¡áƒ¢áƒáƒ“ áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ–áƒ” áƒáƒ  áƒ•áƒáƒ áƒ—, áƒ•áƒ˜áƒžáƒáƒ•áƒáƒ— áƒ‘áƒáƒšáƒ áƒ’áƒáƒ•áƒšáƒ˜áƒšáƒ˜ áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜
        const minVisibleId = Math.min(...visibleVirtualIds);
        let lastPassedItem = null;
        for (const item of items) {
            const vId = parseInt(item.getAttribute('data-virtual-id'));
            if (vId < minVisibleId) lastPassedItem = item; else break;
        }
        if (lastPassedItem) {
            lastPassedItem.classList.add('active');
            if (!isMobile) lastPassedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}
function updateBookState(loc) {
    const book = document.getElementById('book');
    if (window.innerWidth > 768) { if (loc === 1) book.classList.add('closed'); else book.classList.remove('closed'); }
}
// ==========================================
// 8. EDITOR LOGIC (MULTILINGUAL)
// ==========================================
// ==========================================
// 8. EDITOR LOGIC (ENHANCED TOOLBAR)
// ==========================================
// ==========================================
// 8. EDITOR LOGIC (WITH IMAGE UPLOAD)
// ==========================================
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
                    ['image'], // âœ… áƒ¡áƒ£áƒ áƒáƒ—áƒ˜áƒ¡ áƒ¦áƒ˜áƒšáƒáƒ™áƒ˜ áƒ“áƒáƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ—
                    ['clean']
                ],
                handlers: {
                    // âœ… áƒ©áƒ•áƒ”áƒœáƒ˜ áƒ¡áƒžáƒ”áƒªáƒ˜áƒáƒšáƒ£áƒ áƒ˜ áƒ°áƒ”áƒœáƒ“áƒšáƒ”áƒ áƒ˜ áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡
                    image: imageHandler
                }
            },
            history: { delay: 2000, maxStack: 500, userOnly: true }
        }
    });
}

// âœ… NEW: áƒ¡áƒ£áƒ áƒáƒ—áƒ˜áƒ¡ áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ˜áƒ¡ áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ (Supabase)
function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        // áƒ¨áƒ”áƒœáƒáƒ®áƒ•áƒ˜áƒ¡ áƒ“áƒ˜áƒáƒžáƒáƒ–áƒáƒœáƒ˜ (áƒ¡áƒáƒ“ áƒ˜áƒ“áƒ’áƒ áƒ™áƒ£áƒ áƒ¡áƒáƒ áƒ˜)
        const range = quill.getSelection();

        // áƒ•áƒáƒ©áƒ•áƒ”áƒœáƒáƒ— áƒ›áƒáƒ›áƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ”áƒšáƒ¡ áƒ áƒáƒ› áƒ˜áƒ¢áƒ•áƒ˜áƒ áƒ—áƒ”áƒ‘áƒ (Placeholder)
        quill.insertText(range.index, 'Uploading image...', 'bold', true);

        try {
            // 1. áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ Supabase-áƒ¨áƒ˜ (áƒ•áƒ˜áƒ§áƒ”áƒœáƒ”áƒ‘áƒ— áƒ˜áƒ’áƒ˜áƒ•áƒ” bucket-áƒ¡: covers)
            // áƒáƒœ áƒ¨áƒ”áƒ’áƒ˜áƒ«áƒšáƒ˜áƒ áƒ¨áƒ”áƒ¥áƒ›áƒœáƒ áƒáƒ®áƒáƒšáƒ˜ bucket 'content-images', áƒ›áƒáƒ’áƒ áƒáƒ› covers-áƒ˜áƒª áƒ˜áƒ›áƒ£áƒ¨áƒáƒ•áƒ”áƒ‘áƒ¡
            const fileExt = file.name.split('.').pop();
            const fileName = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

            const { data, error } = await sbClient
                .storage
                .from('covers') // áƒáƒ¥ áƒ˜áƒœáƒáƒ®áƒ”áƒ‘áƒ
                .upload(fileName, file);

            if (error) throw error;

            // 2. áƒšáƒ˜áƒœáƒ™áƒ˜áƒ¡ áƒ›áƒ˜áƒ¦áƒ”áƒ‘áƒ
            const { data: publicData } = sbClient
                .storage
                .from('covers')
                .getPublicUrl(fileName);

            const url = publicData.publicUrl;

            // 3. áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜áƒ¡ ("Uploading...") áƒ¬áƒáƒ¨áƒšáƒ áƒ“áƒ áƒ¡áƒ£áƒ áƒáƒ—áƒ˜áƒ¡ áƒ©áƒáƒ¡áƒ›áƒ
            quill.deleteText(range.index, 16); // "Uploading image..." áƒ¡áƒ˜áƒ’áƒ áƒ«áƒ”
            quill.insertEmbed(range.index, 'image', url);

            // áƒ™áƒ£áƒ áƒ¡áƒáƒ áƒ˜áƒ¡ áƒ’áƒáƒ“áƒáƒ¢áƒáƒœáƒ áƒ¡áƒ£áƒ áƒáƒ—áƒ˜áƒ¡ áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’
            quill.setSelection(range.index + 1);

        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Image upload failed!");
            quill.deleteText(range.index, 16); // áƒ¬áƒáƒ áƒ£áƒ›áƒáƒ¢áƒ”áƒ‘áƒšáƒáƒ‘áƒ˜áƒ¡áƒáƒ¡ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜ áƒ¬áƒáƒ•áƒ¨áƒáƒšáƒáƒ—
        }
    };
}
function setupEditorEvents() {
    const modal = document.getElementById('editor-modal');
    // áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ˜áƒ¡ áƒ¨áƒ”áƒ›áƒáƒ¬áƒ›áƒ”áƒ‘áƒ: áƒ—áƒ£ áƒ›áƒáƒ“áƒáƒšáƒ˜ áƒáƒ  áƒáƒ áƒ˜áƒ¡, áƒ’áƒáƒ•áƒ©áƒ”áƒ áƒ“áƒ”áƒ—, áƒ áƒáƒ› áƒ”áƒ áƒáƒ áƒ˜ áƒáƒ  áƒáƒ›áƒáƒáƒ’áƒ“áƒáƒ¡
    if (!modal) {
        console.warn("Editor modal not found inside DOM.");
        return;
    }

    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsForm = document.getElementById('settings-form');
    const editBtn = document.getElementById('edit-mode-btn');
    const langTabs = document.querySelectorAll('.lang-tab');
    const loader = document.getElementById('editor-loading-overlay');
    const coverPreview = document.getElementById('cover-preview');
    const mobileToggleBtn = document.getElementById('mobile-expand-toggle');
    const modalBody = document.querySelector('.modal-body');

    // âœ… NEW: áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜áƒ¡ áƒáƒ›áƒáƒ¡áƒáƒ¦áƒ”áƒ‘áƒáƒ“
    // âœ… NEW: áƒ“áƒáƒ›áƒ®áƒ›áƒáƒ áƒ” áƒ¤áƒ£áƒœáƒ¥áƒªáƒ˜áƒ áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜áƒ¡ áƒáƒ›áƒáƒ¡áƒáƒ¦áƒ”áƒ‘áƒáƒ“ (Fixed for Images & Empty Tags)
    const extractTitleFromHTML = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // 1. áƒ•áƒ”áƒ«áƒ”áƒ‘áƒ— áƒ§áƒ•áƒ”áƒšáƒ H1-áƒ¡
        const h1Elements = temp.querySelectorAll('h1');

        // 2. áƒ’áƒáƒ“áƒáƒ•áƒ£áƒ§áƒ•áƒ”áƒ— áƒ“áƒ áƒ•áƒ˜áƒžáƒáƒ•áƒáƒ— áƒžáƒ˜áƒ áƒ•áƒ”áƒšáƒ˜ H1, áƒ áƒáƒ›áƒ”áƒšáƒ¡áƒáƒª áƒ áƒ”áƒáƒšáƒ£áƒ áƒáƒ“ áƒáƒ¥áƒ•áƒ¡ áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ˜
        // (áƒ”áƒ¡ áƒáƒ’áƒ•áƒáƒ áƒ”áƒ‘áƒ¡ áƒžáƒ áƒáƒ‘áƒšáƒ”áƒ›áƒáƒ¡, áƒ—áƒ£ áƒ¤áƒáƒ¢áƒáƒ¡ áƒ¬áƒ˜áƒœ áƒáƒœ áƒ¨áƒ”áƒ›áƒ“áƒ”áƒ’ áƒªáƒáƒ áƒ˜áƒ”áƒšáƒ˜ H1 áƒ¢áƒ”áƒ’áƒ˜ áƒ“áƒáƒ áƒ©áƒ)
        for (const h1 of h1Elements) {
            if (h1.innerText.trim() !== "") {
                return h1.innerText.replace(/[\n\r]+/g, ' ').trim();
            }
        }

        // 3. áƒ—áƒ£ H1 áƒ•áƒ”áƒ  áƒ•áƒ˜áƒžáƒáƒ•áƒ”áƒ—, áƒ•áƒªáƒáƒ“áƒáƒ— H2 (áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡)
        const h2 = temp.querySelector('h2');
        if (h2 && h2.innerText.trim() !== "") {
            return h2.innerText.replace(/[\n\r]+/g, ' ').trim();
        }

        return "Untitled";
    };

    // --- 1. LANGUAGE TABS ---
    if (mobileToggleBtn && modalBody) {
        mobileToggleBtn.onclick = () => {
            modalBody.classList.toggle('expanded-mode');
            const icon = mobileToggleBtn.querySelector('.material-icons-outlined');
            if(icon) icon.innerText = modalBody.classList.contains('expanded-mode') ? "expand_more" : "expand_less";
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
                quill.root.innerHTML = getChapterContent(chaptersData[selectedChapterIndex], editorLanguage, true);
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

    // --- 2. OPEN EDITOR ---
    if (editBtn) {
        editBtn.onclick = () => {
            modal.classList.add('active');
            if(loader) loader.classList.remove('hidden');

            setTimeout(() => {
                editorLanguage = 'en';
                langTabs.forEach(t => t.classList.remove('active'));
                const enTab = document.querySelector('.lang-tab[data-lang="en"]');
                if(enTab) enTab.classList.add('active');

                if(settingsForm) settingsForm.style.display = 'none';
                isEditingSettings = false;

                renderChaptersList();
                loadChapter(selectedChapterIndex);

                if(loader) loader.classList.add('hidden');
            }, 50);
        };
    }

    const closeModalBtn = document.getElementById('close-modal');
    if(closeModalBtn) closeModalBtn.onclick = () => modal.classList.remove('active');

    // --- SETTINGS LOGIC ---
    if (openSettingsBtn) {
        openSettingsBtn.onclick = () => {
            isEditingSettings = true;
            if(settingsForm) settingsForm.style.display = 'flex';

            const tKa = document.getElementById('input-book-title');
            const sKa = document.getElementById('input-book-subtitle');
            const tEn = document.getElementById('input-book-title-en');
            const sEn = document.getElementById('input-book-subtitle-en');

            if(tKa) tKa.value = bookMeta.title || "";
            if(sKa) sKa.value = bookMeta.subtitle || "";
            if(tEn) tEn.value = bookMeta.title_en || "";
            if(sEn) sEn.value = bookMeta.subtitle_en || "";

            if (coverPreview) {
                if (bookMeta.coverImage) {
                    coverPreview.style.backgroundImage = `url(${bookMeta.coverImage})`;
                    coverPreview.innerText = "";
                } else {
                    coverPreview.style.backgroundImage = "none";
                    coverPreview.innerText = "No image selected";
                }
            }
        };
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.onclick = () => {
            isEditingSettings = false;
            if(settingsForm) settingsForm.style.display = 'none';
        };
    }

    // IMAGE HANDLERS
    const inputCover = document.getElementById('input-cover-image');
    if (inputCover) {
        inputCover.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                pendingCoverFile = file;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if(coverPreview) {
                        coverPreview.style.backgroundImage = `url(${ev.target.result})`;
                        coverPreview.innerText = "";
                    }
                };
                reader.readAsDataURL(file);
            }
        };
    }

    const removeCoverBtn = document.getElementById('remove-cover-btn');
    if (removeCoverBtn) {
        removeCoverBtn.onclick = () => {
            if(inputCover) inputCover.value = "";
            if(coverPreview) {
                coverPreview.style.backgroundImage = "none";
                coverPreview.innerText = "Cover Removed";
            }
            bookMeta.coverImage = null;
            pendingCoverFile = null;
        };
    }

    // --- 6. SAVE LOGIC (SAFE VERSION) ---
    const pushToDB = async (statusEl) => {
        if (!currentBookId) { alert("Error: No ID"); return; }
        try {
            if (isEditingSettings) {
                const tKa = document.getElementById('input-book-title');
                const sKa = document.getElementById('input-book-subtitle');
                const tEn = document.getElementById('input-book-title-en');
                const sEn = document.getElementById('input-book-subtitle-en');

                if(tKa) bookMeta.title = tKa.value;
                if(sKa) bookMeta.subtitle = sKa.value;
                if(tEn) bookMeta.title_en = tEn.value;
                if(sEn) bookMeta.subtitle_en = sEn.value;

                if (pendingCoverFile) {
                    const uploadedUrl = await uploadCoverToStorage(pendingCoverFile);
                    if (uploadedUrl) { bookMeta.coverImage = uploadedUrl; pendingCoverFile = null; }
                }
            }

            const { error } = await sbClient.from('book_projects').update({
                title: bookMeta.title, subtitle: bookMeta.subtitle, cover_image: bookMeta.coverImage,
                chapters: chaptersData, title_en: bookMeta.title_en, subtitle_en: bookMeta.subtitle_en
            }).eq('id', currentBookId);

            if (error) throw error;
            if(statusEl) {
                statusEl.innerText = "Saved!";
                setTimeout(() => statusEl.innerText = "", 2000);
            }
        } catch (err) {
            console.error(err);
            alert("Save Failed");
        }
    };

    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) {
        saveDraftBtn.onclick = async () => {
            const status = document.getElementById('save-status');
            saveDraftBtn.innerText = "...";
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
            saveDraftBtn.innerText = "Save Draft";
        };
    }
    // C. UNPUBLISH BUTTON (Revert to Draft)
    const unpublishBtn = document.getElementById('unpublish-btn');
    if (unpublishBtn) {
        unpublishBtn.onclick = async () => {
            // áƒ£áƒ¡áƒáƒ¤áƒ áƒ—áƒ®áƒáƒ”áƒ‘áƒ˜áƒ¡ áƒ¨áƒ”áƒ™áƒ˜áƒ—áƒ®áƒ•áƒ
            if(!confirm("áƒ“áƒáƒ•áƒ›áƒáƒšáƒáƒ— áƒ”áƒ¡ áƒ—áƒáƒ•áƒ˜ áƒ›áƒ™áƒ˜áƒ—áƒ®áƒ•áƒ”áƒšáƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡? (áƒ’áƒáƒ“áƒáƒ•áƒ˜áƒ“áƒ”áƒ¡ Draft-áƒ¨áƒ˜)")) return;

            const status = document.getElementById('save-status');
            unpublishBtn.innerText = "...";

            // 1. áƒ•áƒ˜áƒ¦áƒ”áƒ‘áƒ— áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ¡ (áƒ áƒáƒ› áƒáƒ  áƒ“áƒáƒ˜áƒ™áƒáƒ áƒ’áƒáƒ¡ áƒ“áƒ áƒ“áƒ áƒáƒ¤áƒ¢áƒ¨áƒ˜ áƒ¨áƒ”áƒœáƒáƒ®áƒ£áƒšáƒ˜ áƒ˜áƒ§áƒáƒ¡)
            const currentHTML = quill.root.innerHTML;
            const extractedTitle = extractTitleFromHTML(currentHTML);

            // 2. áƒ•áƒáƒ¡áƒ£áƒ¤áƒ—áƒáƒ•áƒ”áƒ‘áƒ— CONTENT-áƒ¡ (áƒ¡áƒáƒ¯áƒáƒ áƒáƒ¡), áƒ›áƒáƒ’áƒ áƒáƒ› áƒ•áƒ¢áƒáƒ•áƒ”áƒ‘áƒ— DRAFT-áƒ¡
            if (editorLanguage === 'ka') {
                chaptersData[selectedChapterIndex].draft_content = currentHTML; // áƒ“áƒ áƒáƒ¤áƒ¢áƒ˜ áƒ’áƒáƒœáƒáƒ®áƒšáƒ“áƒ”áƒ¡
                chaptersData[selectedChapterIndex].content = ""; // áƒ¡áƒáƒ¯áƒáƒ áƒ áƒ’áƒáƒ¡áƒ£áƒ¤áƒ—áƒáƒ•áƒ“áƒ”áƒ¡
                chaptersData[selectedChapterIndex].title = extractedTitle;
            } else {
                chaptersData[selectedChapterIndex].draft_content_en = currentHTML;
                chaptersData[selectedChapterIndex].content_en = ""; // áƒ¡áƒáƒ¯áƒáƒ áƒ áƒ’áƒáƒ¡áƒ£áƒ¤áƒ—áƒáƒ•áƒ“áƒ”áƒ¡
                chaptersData[selectedChapterIndex].title_en = extractedTitle;
            }

            // 3. áƒ¡áƒ˜áƒ˜áƒ¡ áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ (áƒ‘áƒ£áƒ áƒ—áƒ£áƒšáƒ áƒ’áƒáƒ§áƒ•áƒ˜áƒ—áƒšáƒ“áƒ”áƒ‘áƒ)
            renderChaptersList();

            // 4. áƒ‘áƒáƒ–áƒáƒ¨áƒ˜ áƒ’áƒáƒ¨áƒ•áƒ”áƒ‘áƒ
            await pushToDB(status);

            // 5. áƒ¬áƒ˜áƒ’áƒœáƒ˜áƒ¡ áƒ’áƒáƒ“áƒáƒ®áƒáƒ¢áƒ•áƒ (áƒ áƒáƒ› áƒáƒ“áƒ›áƒ˜áƒœáƒ›áƒ áƒœáƒáƒ®áƒáƒ¡ áƒ¨áƒ”áƒ“áƒ”áƒ’áƒ˜ - áƒ—áƒáƒ•áƒ˜ áƒ’áƒáƒ¥áƒ áƒ”áƒ‘áƒ view-áƒ“áƒáƒœ áƒ—áƒ£ admin=false)
            renderBook();

            unpublishBtn.innerText = "Unpublish";
        };
    }

    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        publishBtn.onclick = async () => {
            if(!confirm("Publish changes?")) return;
            const status = document.getElementById('save-status');
            publishBtn.innerText = "Publishing...";
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
            publishBtn.innerText = "Publish";
        };
    }

    const addPageBtn = document.getElementById('add-page-btn');
    if (addPageBtn) {
        addPageBtn.onclick = () => {
            // 1. âœ… áƒ¡áƒáƒœáƒáƒ› áƒáƒ®áƒáƒšáƒ¡ áƒ“áƒáƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ—, áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ¨áƒ”áƒ•áƒ˜áƒœáƒáƒ®áƒáƒ— DRAFT-áƒ¨áƒ˜
            if (chaptersData[selectedChapterIndex]) {
                const currentVal = quill.root.innerHTML;
                if (editorLanguage === 'ka') chaptersData[selectedChapterIndex].draft_content = currentVal;
                else chaptersData[selectedChapterIndex].draft_content_en = currentVal;
            }

            // 2. áƒ•áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ— áƒáƒ®áƒáƒš áƒ—áƒáƒ•áƒ¡
            chaptersData.push({
                id: Date.now(),
                title: "New Chapter (Draft)",
                content: "", // áƒ’áƒáƒ›áƒáƒ¥áƒ•áƒ”áƒ§áƒœáƒ”áƒ‘áƒ£áƒšáƒ˜ áƒªáƒáƒ áƒ˜áƒ”áƒšáƒ˜áƒ!
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

    const resetBookBtn = document.getElementById('reset-book-btn');
    if (resetBookBtn) {
        resetBookBtn.onclick = () => {
            if(confirm("Delete all chapters?")) {
                chaptersData = [{ id: 'ch1', title: "Chapter 1", content: `<h2>Chapter 1</h2><p>Start writing...</p>`, draft_content: `<h2>Chapter 1</h2><p>Start writing...</p>` }];
                renderChaptersList();
                selectedChapterIndex = 0;
                loadChapter(0);
            }
        };
    }
}
function renderChaptersList() {
    const list = document.getElementById('editable-pages-list');
    list.innerHTML = '';

    chaptersData.forEach((ch, i) => {
        const li = document.createElement('li');

        // áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜
        const displayTitle = getChapterTitle(ch, editorLanguage);

        // áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜áƒ¡ áƒ“áƒáƒ“áƒ’áƒ”áƒœáƒ
        let statusColor = '#28a745'; // áƒ›áƒ¬áƒ•áƒáƒœáƒ” (Published)
        let tooltip = "Published";

        // áƒ•áƒ˜áƒ¦áƒ”áƒ‘áƒ— áƒ¢áƒ”áƒ¥áƒ¡áƒ¢áƒ”áƒ‘áƒ¡ áƒ”áƒœáƒ˜áƒ¡ áƒ›áƒ˜áƒ®áƒ”áƒ“áƒ•áƒ˜áƒ—
        let pub, drf;
        if (editorLanguage === 'en') {
            pub = ch.content_en || "";
            drf = ch.draft_content_en || "";
        } else {
            pub = ch.content || "";
            drf = ch.draft_content || "";
        }

        // áƒšáƒáƒ’áƒ˜áƒ™áƒ: áƒ§áƒ•áƒ˜áƒ—áƒ”áƒšáƒ˜ áƒ—áƒ£ áƒ’áƒáƒ›áƒáƒ¥áƒ•áƒ”áƒ§áƒœáƒ”áƒ‘áƒ£áƒšáƒ˜ áƒªáƒáƒ áƒ˜áƒ”áƒšáƒ˜áƒ áƒáƒœ áƒ’áƒáƒœáƒ¡áƒ®áƒ•áƒáƒ•áƒ“áƒ”áƒ‘áƒ áƒ“áƒ áƒáƒ¤áƒ¢áƒ˜áƒ¡áƒ’áƒáƒœ
        if (pub.trim() === "") {
            statusColor = '#ffc107'; // áƒ§áƒ•áƒ˜áƒ—áƒ”áƒšáƒ˜
            tooltip = "Draft (Not Published)";
        } else if (pub !== drf) {
            statusColor = '#ffc107'; // áƒ§áƒ•áƒ˜áƒ—áƒ”áƒšáƒ˜
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

        // âœ… CLICK EVENT - áƒáƒ¥ áƒ˜áƒ§áƒ áƒ¨áƒ”áƒªáƒ“áƒáƒ›áƒ!
        titleSpan.onclick = () => {
            isEditingSettings = false;
            document.getElementById('editor-container').style.display = 'block';
            if(document.getElementById('settings-form')) document.getElementById('settings-form').style.display = 'none';

            // áƒ”áƒœáƒ˜áƒ¡/áƒ—áƒáƒ•áƒ˜áƒ¡ áƒ¨áƒ”áƒªáƒ•áƒšáƒ˜áƒ¡áƒáƒ¡ áƒ™áƒáƒœáƒ¢áƒ”áƒœáƒ¢áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ®áƒ¡áƒáƒ•áƒ áƒ”áƒ‘áƒ DRAFT-áƒ¨áƒ˜!
            if (i !== selectedChapterIndex) {
                const currentVal = quill.root.innerHTML;
                // áƒáƒ“áƒ áƒ” áƒáƒ¥ áƒ”áƒ¬áƒ”áƒ áƒ .content = ... áƒ áƒáƒª áƒ¨áƒ”áƒªáƒ“áƒáƒ›áƒ áƒ˜áƒ§áƒ
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

    // âœ… áƒ©áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ: áƒ”áƒ“áƒ˜áƒ¢áƒáƒ áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡ áƒ›áƒ”áƒ¡áƒáƒ›áƒ” áƒáƒ áƒ’áƒ£áƒ›áƒ”áƒœáƒ¢áƒ˜ áƒáƒ áƒ˜áƒ¡ true (Draft)
    const content = getChapterContent(chaptersData[i], editorLanguage, true);

    if(quill) {
        // Quill-áƒ¨áƒ˜ áƒ©áƒáƒ¡áƒ›áƒ˜áƒ¡áƒáƒ¡ áƒªáƒáƒ¢áƒ áƒ¡áƒ˜áƒ¤áƒ áƒ—áƒ®áƒ˜áƒšáƒ”áƒ áƒ¡áƒáƒ­áƒ˜áƒ áƒ, null áƒ áƒáƒ› áƒáƒ  áƒ©áƒáƒ¯áƒ“áƒ”áƒ¡
        quill.root.innerHTML = content || "";
    }

    // áƒ›áƒáƒœáƒ˜áƒ¨áƒ•áƒœáƒ áƒ¡áƒ˜áƒáƒ¨áƒ˜
    const lis = document.getElementById('editable-pages-list').querySelectorAll('li');
    lis.forEach(l => l.classList.remove('selected'));
    if(lis[i]) lis[i].classList.add('selected');

    // áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜áƒ¡ áƒ’áƒáƒ¡áƒ£áƒ¤áƒ—áƒáƒ•áƒ”áƒ‘áƒ
    document.getElementById('save-status').innerText = "";
}