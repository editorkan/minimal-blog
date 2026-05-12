const config = window.BLOG_CONFIG ?? {};
const supabaseUrl = config.SUPABASE_URL;
const supabaseAnonKey = config.SUPABASE_ANON_KEY;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabaseClient = isConfigured
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const postsElement = document.querySelector("#posts");
const articleElement = document.querySelector("#article");
const pageElement = document.querySelector(".page");
const searchElement = document.querySelector("#search");
const statsElement = document.querySelector("#stats");
const newPostButton = document.querySelector("#new-post");
const editorElement = document.querySelector("#editor");
const editorForm = document.querySelector("#editor-form");
const editorTitle = document.querySelector("#editor-title");
const editorBody = document.querySelector("#editor-body");
const cancelEditButton = document.querySelector("#cancel-edit");
const subscribeForm = document.querySelector("#subscribe-form");
const subscriberEmail = document.querySelector("#subscriber-email");
const subscribeStatus = document.querySelector("#subscribe-status");
const adminPanel = document.querySelector("#admin-panel");
const adminForm = document.querySelector("#admin-form");
const adminTitle = document.querySelector("#admin-title");
const adminEmail = document.querySelector("#admin-username");
const adminPassword = document.querySelector("#admin-password");
const adminSubmit = document.querySelector("#admin-submit");
const adminStatus = document.querySelector("#admin-status");
const closeAdminButton = document.querySelector("#close-admin");
const logoutAdminButton = document.querySelector("#logout-admin");

let currentPostId = "";
let editingPostId = "";
let posts = [];
let session = null;
let isAdmin = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSetupError() {
  postsElement.innerHTML = "";
  statsElement.textContent = "0";
  articleElement.innerHTML = `
    <div class="article-body">
      <p>Supabase 설정이 필요합니다.</p>
      <p><code>config.js</code>에 프로젝트 URL과 anon key를 입력하세요.</p>
    </div>
  `;
}

function getHashPostId() {
  try {
    const value = decodeURIComponent(window.location.hash.slice(1));
    return value === "admin" ? "" : value;
  } catch {
    window.location.hash = "";
    return "";
  }
}

function handleHashRoute() {
  let hash = "";

  try {
    hash = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    window.location.hash = "";
    return;
  }

  if (hash === "admin") {
    openAdminPanel();
    return;
  }

  selectPost(hash, false);
}

function normalizePost(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    rawBody: row.body,
    date: new Date(row.published_at ?? row.created_at).toISOString().slice(0, 10),
    publishedAt: row.published_at,
  };
}

async function loadPosts() {
  if (!isConfigured) {
    renderSetupError();
    return;
  }

  const { data, error } = await supabaseClient
    .from("posts")
    .select("id,title,body,created_at,published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    articleElement.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    return;
  }

  posts = data.map(normalizePost);
  render();
}

function getFilteredPosts() {
  const query = searchElement.value.trim().toLowerCase();

  return posts.filter((post) => {
    const searchableText = [post.id, post.title, post.date, post.rawBody]
      .join(" ")
      .toLowerCase();

    return !query || searchableText.includes(query);
  });
}

function renderPostList(activeId, filteredPosts) {
  if (filteredPosts.length === 0) {
    postsElement.innerHTML = `<p class="empty-state">글이 없습니다.</p>`;
    statsElement.textContent = "0";
    return;
  }

  postsElement.innerHTML = filteredPosts
    .map(
      (post) => `
        <button class="post-button" type="button" data-post-id="${escapeHtml(post.id)}" aria-current="${post.id === activeId}">
          <span>${escapeHtml(post.date)}</span>
          <strong>${escapeHtml(post.title)}</strong>
        </button>
      `,
    )
    .join("");
  statsElement.textContent = `${filteredPosts.length} / ${posts.length}`;
}

function renderArticle(post) {
  const currentIndex = posts.findIndex((item) => item.id === post.id);
  const previousPost = posts[currentIndex + 1];
  const nextPost = posts[currentIndex - 1];

  articleElement.innerHTML = `
    <div class="article-meta">
      <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>
    </div>
    <h2>${escapeHtml(post.title)}</h2>
    <div class="article-body">
      ${post.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
    <div class="article-footer">
      <a class="article-link" href="#${encodeURIComponent(post.id)}">링크</a>
      ${
        isAdmin
          ? `
            <button class="nav-button" type="button" data-edit-id="${escapeHtml(post.id)}">수정</button>
            <button class="nav-button" type="button" data-delete-id="${escapeHtml(post.id)}">삭제</button>
          `
          : ""
      }
      <button class="nav-button" type="button" data-nav-id="${escapeHtml(previousPost?.id ?? "")}" ${previousPost ? "" : "disabled"}>이전</button>
      <button class="nav-button" type="button" data-nav-id="${escapeHtml(nextPost?.id ?? "")}" ${nextPost ? "" : "disabled"}>다음</button>
    </div>
  `;
}

function render() {
  const filteredPosts = getFilteredPosts();

  if (filteredPosts.length === 0) {
    renderPostList(currentPostId, filteredPosts);
    articleElement.innerHTML = "";
    return;
  }

  const post =
    filteredPosts.find((item) => item.id === currentPostId) ?? filteredPosts[0];

  currentPostId = post.id;
  renderPostList(post.id, filteredPosts);
  renderArticle(post);
}

function selectPost(postId, shouldUpdateHash = true) {
  const fallbackId = posts[0]?.id ?? "";
  currentPostId = posts.some((item) => item.id === postId) ? postId : fallbackId;

  if (!currentPostId) {
    render();
    return;
  }

  if (shouldUpdateHash) {
    const nextHash = `#${encodeURIComponent(currentPostId)}`;

    if (window.location.hash === nextHash) {
      render();
    } else {
      window.location.hash = nextHash;
    }

    return;
  }

  render();
}

function openEditor(post = null) {
  if (!requireAdmin()) {
    return;
  }

  editingPostId = post?.id ?? "";
  editorTitle.value = post?.title ?? "";
  editorBody.value = post?.rawBody ?? "";
  editorElement.hidden = false;
  editorTitle.focus();
}

function closeEditor() {
  editingPostId = "";
  editorForm.reset();
  editorElement.hidden = true;
}

async function saveEditedPost(event) {
  event.preventDefault();

  if (!requireAdmin()) {
    return;
  }

  const title = editorTitle.value.trim();
  const body = editorBody.value.trim();

  if (!title || !body) {
    return;
  }

  const payload = {
    title,
    body,
    published_at: new Date().toISOString(),
  };
  const isNewPost = !editingPostId;
  const query = isNewPost
    ? supabaseClient.from("posts").insert(payload).select("id").single()
    : supabaseClient
        .from("posts")
        .update(payload)
        .eq("id", editingPostId)
        .select("id")
        .single();
  const { data, error } = await query;

  if (error) {
    window.alert(error.message);
    return;
  }

  closeEditor();
  searchElement.value = "";
  currentPostId = data.id;
  await loadPosts();
  selectPost(data.id);

  if (isNewPost) {
    await notifySubscribers(data.id);
  }
}

async function subscribeByEmail(event) {
  event.preventDefault();

  const email = subscriberEmail.value.trim().toLowerCase();

  if (!email || !isConfigured) {
    return;
  }

  const { error } = await supabaseClient.from("subscribers").insert({ email });

  if (error && error.code !== "23505") {
    subscribeStatus.textContent = "구독에 실패했습니다.";
    return;
  }

  subscriberEmail.value = "";
  subscribeStatus.textContent = "구독되었습니다.";
}

async function notifySubscribers(postId) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    return;
  }

  await supabaseClient.functions.invoke("notify-subscribers", {
    body: { post_id: postId, site_url: window.location.href.split("#")[0] },
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deletePost(postId) {
  if (!requireAdmin()) {
    return;
  }

  if (!window.confirm("삭제할까요?")) {
    return;
  }

  const { error } = await supabaseClient.from("posts").delete().eq("id", postId);

  if (error) {
    window.alert(error.message);
    return;
  }

  currentPostId = "";
  await loadPosts();
}

function updateAdminControls() {
  newPostButton.hidden = !isAdmin;

  if (!isAdmin) {
    closeEditor();
  }
}

function updateAdminPanel() {
  adminTitle.textContent = isAdmin
    ? `로그인됨: ${session.user.email}`
    : "관리자 로그인";
  adminSubmit.textContent = "로그인";
  adminForm.hidden = isAdmin;
  logoutAdminButton.hidden = !isAdmin;
  adminEmail.value = "";
  adminPassword.value = "";
}

function openAdminPanel(message = "") {
  updateAdminPanel();
  adminStatus.textContent = message;
  adminPanel.hidden = false;
  pageElement.inert = true;

  if (isAdmin) {
    logoutAdminButton.focus();
  } else {
    adminEmail.focus();
  }
}

function closeAdminPanel() {
  adminPanel.hidden = true;
  pageElement.inert = false;
  adminStatus.textContent = "";
}

function requireAdmin() {
  if (isAdmin) {
    return true;
  }

  openAdminPanel("로그인이 필요합니다.");
  return false;
}

async function refreshSession() {
  if (!isConfigured) {
    updateAdminControls();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  session = data.session;

  if (!session) {
    isAdmin = false;
    updateAdminControls();
    render();
    return;
  }

  const { data: adminRow } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  isAdmin = Boolean(adminRow);
  updateAdminControls();
  render();
}

async function handleAdminSubmit(event) {
  event.preventDefault();

  const email = adminEmail.value.trim();
  const password = adminPassword.value;

  if (!email || !password || !isConfigured) {
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    adminStatus.textContent = "로그인에 실패했습니다.";
    return;
  }

  session = data.session;
  await refreshSession();

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    session = null;
    adminStatus.textContent = "관리자 권한이 없습니다.";
    updateAdminControls();
    return;
  }

  updateAdminPanel();
  adminStatus.textContent = "로그인되었습니다.";
  window.setTimeout(closeAdminPanel, 450);
}

async function logoutAdmin() {
  await supabaseClient.auth.signOut();
  session = null;
  isAdmin = false;
  updateAdminControls();
  updateAdminPanel();
  render();
  adminStatus.textContent = "로그아웃되었습니다.";
}

postsElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-post-id]");

  if (!button) {
    return;
  }

  selectPost(button.dataset.postId);
});

searchElement.addEventListener("input", () => {
  render();
});

articleElement.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");
  const navButton = event.target.closest("[data-nav-id]");

  if (editButton) {
    const post = posts.find((item) => item.id === editButton.dataset.editId);

    if (post) {
      openEditor(post);
    }

    return;
  }

  if (deleteButton) {
    void deletePost(deleteButton.dataset.deleteId);
    return;
  }

  if (navButton?.dataset.navId) {
    selectPost(navButton.dataset.navId);
  }
});

newPostButton.addEventListener("click", () => {
  openEditor();
});

cancelEditButton.addEventListener("click", () => {
  closeEditor();
});

editorForm.addEventListener("submit", (event) => {
  void saveEditedPost(event);
});

subscribeForm.addEventListener("submit", (event) => {
  void subscribeByEmail(event);
});

adminForm.addEventListener("submit", (event) => {
  void handleAdminSubmit(event);
});

logoutAdminButton.addEventListener("click", () => {
  void logoutAdmin();
});

closeAdminButton.addEventListener("click", closeAdminPanel);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "r") {
    event.preventDefault();

    if (adminPanel.hidden) {
      openAdminPanel();
    } else {
      closeAdminPanel();
    }
  }

  if (event.key === "Escape" && !adminPanel.hidden) {
    closeAdminPanel();
  }
});

window.addEventListener("hashchange", () => {
  handleHashRoute();
});

if (isConfigured) {
  supabaseClient.auth.onAuthStateChange(() => {
    void refreshSession();
  });
}

void refreshSession();
void loadPosts().then(() => {
  handleHashRoute();
});
