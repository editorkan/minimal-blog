const STORAGE_KEY = "minimal-blog-posts";
const SUBSCRIBERS_KEY = "minimal-blog-subscribers";
const ADMIN_KEY = "minimal-blog-admin";
const ADMIN_SESSION_KEY = "minimal-blog-admin-session";

const defaultPosts = [
  {
    id: "quiet-start",
    title: "시작",
    date: "2026.05.12",
    tags: ["기록"],
    body: [
      "무언가를 오래 남기기 위해 많은 형식이 필요하지는 않다.",
      "이곳에는 생각이 지나간 자리만 간단히 적어둔다.",
    ],
  },
  {
    id: "small-notes",
    title: "작은 기록",
    date: "2026.05.10",
    tags: ["기록"],
    body: [
      "기록은 완성된 글이 아니어도 된다.",
      "당시의 감각을 잃지 않을 정도면 충분하다.",
    ],
  },
  {
    id: "less-screen",
    title: "비워두기",
    date: "2026.05.08",
    tags: ["생각"],
    body: [
      "화면에 무언가를 더하는 일은 쉽다.",
      "덜어내고도 필요한 것이 남아 있는지 확인하는 일은 조금 더 어렵다.",
    ],
  },
];

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
const adminUsername = document.querySelector("#admin-username");
const adminPassword = document.querySelector("#admin-password");
const adminPasswordConfirm = document.querySelector("#admin-password-confirm");
const adminSubmit = document.querySelector("#admin-submit");
const adminStatus = document.querySelector("#admin-status");
const closeAdminButton = document.querySelector("#close-admin");
const logoutAdminButton = document.querySelector("#logout-admin");

let currentPostId = "";
let editingPostId = "";
let posts = loadPosts();
let subscribers = loadSubscribers();
let adminAccount = loadAdminAccount();
let isAdminLoggedIn =
  Boolean(adminAccount) && sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";

function loadPosts() {
  const savedPosts = localStorage.getItem(STORAGE_KEY);

  if (!savedPosts) {
    return defaultPosts;
  }

  try {
    const parsedPosts = JSON.parse(savedPosts);
    return Array.isArray(parsedPosts) ? parsedPosts : defaultPosts;
  } catch {
    return defaultPosts;
  }
}

function savePosts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function loadSubscribers() {
  const savedSubscribers = localStorage.getItem(SUBSCRIBERS_KEY);

  if (!savedSubscribers) {
    return [];
  }

  try {
    const parsedSubscribers = JSON.parse(savedSubscribers);
    return Array.isArray(parsedSubscribers) ? parsedSubscribers : [];
  } catch {
    return [];
  }
}

function saveSubscribers() {
  localStorage.setItem(SUBSCRIBERS_KEY, JSON.stringify(subscribers));
}

function loadAdminAccount() {
  const savedAccount = localStorage.getItem(ADMIN_KEY);

  if (!savedAccount) {
    return null;
  }

  try {
    const parsedAccount = JSON.parse(savedAccount);
    return parsedAccount?.username && parsedAccount?.salt && parsedAccount?.hash
      ? parsedAccount
      : null;
  } catch {
    return null;
  }
}

function saveAdminAccount(account) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(account));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function createSalt() {
  const salt = globalThis.crypto?.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(16))
    : new Uint8Array(
        Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)),
      );

  return [...salt].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function getPasswordHashAlgorithm() {
  return globalThis.crypto?.subtle ? "sha256" : "";
}

async function hashPassword(
  password,
  salt,
  algorithm = getPasswordHashAlgorithm(),
) {
  const data = new TextEncoder().encode(`${salt}:${password}`);

  if (algorithm !== "sha256") {
    throw new Error("Web Crypto is unavailable.");
  }

  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

function getFilteredPosts() {
  const query = searchElement.value.trim().toLowerCase();

  return posts.filter((post) => {
    const searchableText = [
      post.id,
      post.title,
      post.date,
      post.tags.join(" "),
      post.body.join(" "),
    ]
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
      <time datetime="${escapeHtml(post.date.replaceAll(".", "-"))}">${escapeHtml(post.date)}</time>
    </div>
    <h2>${escapeHtml(post.title)}</h2>
    <div class="article-body">
      ${post.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
    <div class="article-footer">
      <a class="article-link" href="#${encodeURIComponent(post.id)}">링크</a>
      ${
        isAdminLoggedIn
          ? `
            <button class="nav-button" type="button" data-edit-id="${escapeHtml(post.id)}">
              수정
            </button>
            <button class="nav-button" type="button" data-delete-id="${escapeHtml(post.id)}">
              삭제
            </button>
          `
          : ""
      }
      <button class="nav-button" type="button" data-nav-id="${escapeHtml(previousPost?.id ?? "")}" ${previousPost ? "" : "disabled"}>
        이전
      </button>
      <button class="nav-button" type="button" data-nav-id="${escapeHtml(nextPost?.id ?? "")}" ${nextPost ? "" : "disabled"}>
        다음
      </button>
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

function getHashPostId() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    window.location.hash = "";
    return "";
  }
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function createPostId() {
  return `post-${Date.now().toString(36)}`;
}

function openEditor(post = null) {
  if (!requireAdmin()) {
    return;
  }

  editingPostId = post?.id ?? "";
  editorTitle.value = post?.title ?? "";
  editorBody.value = post?.body.join("\n\n") ?? "";
  editorElement.hidden = false;
  editorTitle.focus();
}

function closeEditor() {
  editingPostId = "";
  editorForm.reset();
  editorElement.hidden = true;
}

function saveEditedPost(event) {
  event.preventDefault();

  if (!requireAdmin()) {
    return;
  }

  const title = editorTitle.value.trim();
  const body = editorBody.value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!title || body.length === 0) {
    return;
  }

  const existingPost = posts.find((post) => post.id === editingPostId);
  const isNewPost = !existingPost;
  const post = {
    id: existingPost?.id ?? createPostId(),
    title,
    date: existingPost?.date ?? today(),
    tags: [],
    body,
  };

  posts = existingPost
    ? posts.map((item) => (item.id === existingPost.id ? post : item))
    : [post, ...posts];

  savePosts();
  closeEditor();
  searchElement.value = "";
  selectPost(post.id);

  if (isNewPost) {
    notifySubscribers(post);
  }
}

function subscribeByEmail(event) {
  event.preventDefault();

  const email = subscriberEmail.value.trim().toLowerCase();

  if (!email) {
    return;
  }

  if (!subscribers.includes(email)) {
    subscribers = [...subscribers, email];
    saveSubscribers();
  }

  subscriberEmail.value = "";
  subscribeStatus.textContent = "구독되었습니다.";
}

function notifySubscribers(post) {
  if (subscribers.length === 0) {
    return;
  }

  const postUrl = `${window.location.href.split("#")[0]}#${encodeURIComponent(post.id)}`;
  const subject = encodeURIComponent(`[블로그] ${post.title}`);
  const body = encodeURIComponent(`${post.title}\n\n${post.body[0] ?? ""}\n\n${postUrl}`);
  const bcc = encodeURIComponent(subscribers.join(","));
  const mailtoUrl = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;

  window.location.href = mailtoUrl;
}

function deletePost(postId) {
  if (!requireAdmin()) {
    return;
  }

  if (!window.confirm("삭제할까요?")) {
    return;
  }

  posts = posts.filter((post) => post.id !== postId);
  savePosts();
  currentPostId = posts[0]?.id ?? "";

  if (currentPostId) {
    window.location.hash = encodeURIComponent(currentPostId);
  } else {
    window.location.hash = "";
    render();
  }
}

function updateAdminControls() {
  newPostButton.hidden = !isAdminLoggedIn;

  if (!isAdminLoggedIn) {
    closeEditor();
  }
}

function updateAdminPanel() {
  const hasAccount = Boolean(adminAccount);

  adminTitle.textContent = isAdminLoggedIn
    ? `로그인됨: ${adminAccount.username}`
    : hasAccount
      ? "로그인"
      : "계정 생성";
  adminSubmit.textContent = hasAccount ? "로그인" : "생성";
  adminForm.hidden = isAdminLoggedIn;
  logoutAdminButton.hidden = !isAdminLoggedIn;
  adminUsername.value = "";
  adminPassword.value = "";
  adminPasswordConfirm.value = "";
  adminPasswordConfirm.hidden = hasAccount || isAdminLoggedIn;
  adminPasswordConfirm.required = !hasAccount && !isAdminLoggedIn;
  adminUsername.autocomplete = hasAccount ? "username" : "new-username";
  adminPassword.autocomplete = hasAccount ? "current-password" : "new-password";
}

function openAdminPanel(message = "") {
  updateAdminPanel();
  adminStatus.textContent = message;
  adminPanel.hidden = false;
  pageElement.inert = true;

  if (!isAdminLoggedIn) {
    adminUsername.focus();
  } else {
    logoutAdminButton.focus();
  }
}

function closeAdminPanel() {
  adminPanel.hidden = true;
  pageElement.inert = false;
  adminStatus.textContent = "";
}

function requireAdmin() {
  if (isAdminLoggedIn) {
    return true;
  }

  openAdminPanel("로그인이 필요합니다.");
  return false;
}

async function handleAdminSubmit(event) {
  event.preventDefault();

  const username = adminUsername.value.trim();
  const password = adminPassword.value;
  const passwordConfirm = adminPasswordConfirm.value;

  if (!username || !password) {
    return;
  }

  if (!adminAccount) {
    if (password !== passwordConfirm) {
      adminStatus.textContent = "비밀번호가 일치하지 않습니다.";
      return;
    }

    const salt = createSalt();
    const algorithm = getPasswordHashAlgorithm();

    if (!algorithm) {
      adminStatus.textContent = "이 브라우저에서는 보안 해시를 사용할 수 없습니다.";
      return;
    }

    const hash = await hashPassword(password, salt, algorithm);

    adminAccount = { username, salt, hash, algorithm };
    saveAdminAccount(adminAccount);
    isAdminLoggedIn = true;
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    updateAdminControls();
    updateAdminPanel();
    render();
    adminStatus.textContent = "계정이 생성되었습니다.";
    window.setTimeout(closeAdminPanel, 450);
    return;
  }

  let hash = "";

  try {
    hash = await hashPassword(password, adminAccount.salt, adminAccount.algorithm);
  } catch {
    adminStatus.textContent = "이 브라우저에서는 로그인할 수 없습니다.";
    return;
  }
  const isValid =
    username === adminAccount.username && hash === adminAccount.hash;

  if (!isValid) {
    adminStatus.textContent = "아이디 또는 비밀번호가 맞지 않습니다.";
    return;
  }

  isAdminLoggedIn = true;
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  updateAdminControls();
  updateAdminPanel();
  render();
  adminStatus.textContent = "로그인되었습니다.";
  window.setTimeout(closeAdminPanel, 450);
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
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
    deletePost(deleteButton.dataset.deleteId);
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

editorForm.addEventListener("submit", saveEditedPost);

subscribeForm.addEventListener("submit", subscribeByEmail);

adminForm.addEventListener("submit", (event) => {
  void handleAdminSubmit(event);
});

logoutAdminButton.addEventListener("click", logoutAdmin);

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
  selectPost(getHashPostId(), false);
});

updateAdminControls();
selectPost(getHashPostId(), false);
