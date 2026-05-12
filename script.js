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
const editorSurface = document.querySelector("#editor-surface");
const editorToolbar = document.querySelector(".editor-toolbar");
const editorImage = document.querySelector("#editor-image");
const editorVideo = document.querySelector("#editor-video");
const editorStatus = document.querySelector("#editor-status");
const cancelEditButton = document.querySelector("#cancel-edit");
const editorSaveButton = editorForm.querySelector('button[type="submit"]');
const editorToolbarButtons = [...editorToolbar.querySelectorAll("button")];
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
let editorRange = null;
let activeMediaUploads = 0;
let mediaUploadToken = 0;
let isSavingPost = false;
const mediaBucket = "post-media";
const maxMediaBytes = 100 * 1024 * 1024;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isSafeUrl(value, options = {}) {
  try {
    const url = new URL(String(value), window.location.origin);
    const allowedProtocols = options.media
      ? ["http:", "https:"]
      : ["http:", "https:", "mailto:"];

    if (!allowedProtocols.includes(url.protocol)) {
      return false;
    }

    if (!options.media) {
      return true;
    }

    const allowedMediaOrigins = [
      window.location.origin,
      supabaseUrl ? new URL(supabaseUrl).origin : "",
    ].filter(Boolean);

    return allowedMediaOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

function renderInlineStyle(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

function renderInline(value) {
  const source = String(value ?? "");
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let output = "";
  let lastIndex = 0;
  let match = linkPattern.exec(source);

  while (match) {
    output += renderInlineStyle(source.slice(lastIndex, match.index));

    const [, label, url] = match;
    output += isSafeUrl(url)
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${renderInlineStyle(label)}</a>`
      : renderInlineStyle(label);

    lastIndex = linkPattern.lastIndex;
    match = linkPattern.exec(source);
  }

  output += renderInlineStyle(source.slice(lastIndex));
  return output;
}

function renderMediaBlock(block) {
  const image = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);

  if (image && isSafeUrl(image[2], { media: true })) {
    const alt = image[1].trim();

    return `
      <figure>
        <img src="${escapeHtml(image[2])}" alt="${escapeHtml(alt)}" loading="lazy" />
        ${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}
      </figure>
    `;
  }

  const video = block.match(/^@\[video(?::([^\]]+))?\]\(([^)\s]+)\)$/);

  if (video && isSafeUrl(video[2], { media: true })) {
    const caption = video[1]?.trim() ?? "";

    return `
      <figure>
        <video src="${escapeHtml(video[2])}" controls preload="metadata"></video>
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>
    `;
  }

  return "";
}

function renderPostBody(rawBody) {
  return String(rawBody ?? "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const media = renderMediaBlock(block);

      if (media) {
        return media;
      }

      if (/^#{2,3}\s+/.test(block)) {
        return `<h3>${renderInline(block.replace(/^#{2,3}\s+/, ""))}</h3>`;
      }

      if (block.split("\n").every((line) => line.trim().startsWith(">"))) {
        const quote = block
          .split("\n")
          .map((line) => line.replace(/^\s*>\s?/, ""))
          .join("\n");

        return `<blockquote>${quote
          .split("\n")
          .map((line) => `<p>${renderInline(line)}</p>`)
          .join("")}</blockquote>`;
      }

      return `<p>${block
        .split("\n")
        .map((line) => renderInline(line))
        .join("<br>")}</p>`;
    })
    .join("");
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

function getDecodedHash() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    window.location.hash = "";
    return "";
  }
}

function hasAdminQuery() {
  try {
    return new URLSearchParams(window.location.search).has("admin");
  } catch {
    return false;
  }
}

function isAdminRoute() {
  return getDecodedHash() === "admin" || hasAdminQuery();
}

function getHashPostId() {
  const value = getDecodedHash();

  return isAdminRoute() ? "" : value;
}

function handleRoute() {
  if (isAdminRoute()) {
    openAdminPanel();
    return;
  }

  selectPost(getHashPostId(), false);
}

function clearAdminRoute() {
  if (!isAdminRoute()) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("admin");
  url.hash = currentPostId ? encodeURIComponent(currentPostId) : "";
  window.history.replaceState(null, "", url.toString());
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
    htmlBody: renderPostBody(row.body),
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
      ${post.htmlBody}
    </div>
    <div class="article-footer">
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

  mediaUploadToken += 1;
  activeMediaUploads = 0;
  isSavingPost = false;
  editingPostId = post?.id ?? "";
  editorTitle.value = post?.title ?? "";
  setEditorContent(post?.rawBody ?? "");
  setEditorStatus("");
  updateEditorState();
  editorElement.hidden = false;
  editorTitle.focus();
}

function closeEditor() {
  mediaUploadToken += 1;
  activeMediaUploads = 0;
  isSavingPost = false;
  editorRange = null;
  editingPostId = "";
  editorForm.reset();
  editorSurface.innerHTML = "";
  setEditorStatus("");
  updateEditorState();
  editorElement.hidden = true;
}

function setEditorStatus(message) {
  editorStatus.textContent = message;
}

function updateEditorState() {
  const isUploading = activeMediaUploads > 0;
  const shouldDisableControls = isSavingPost || isUploading;

  editorSaveButton.disabled = shouldDisableControls;
  editorSaveButton.textContent = isSavingPost
    ? "저장 중"
    : isUploading
      ? "업로드 중"
      : "저장";
  cancelEditButton.disabled = isSavingPost;
  editorTitle.disabled = isSavingPost;
  editorSurface.contentEditable = shouldDisableControls ? "false" : "true";
  editorToolbarButtons.forEach((button) => {
    button.disabled = shouldDisableControls;
  });
}

function setEditorContent(rawBody) {
  editorBody.value = rawBody;
  editorSurface.innerHTML = renderPostBody(rawBody);

  if (!editorSurface.textContent.trim() && !editorSurface.querySelector("img, video")) {
    editorSurface.innerHTML = "";
  }
}

function syncEditorBody() {
  editorBody.value = serializeEditorContent();
  return editorBody.value;
}

function editorContainsNode(node) {
  if (!node) {
    return false;
  }

  return node === editorSurface || editorSurface.contains(node);
}

function rememberEditorSelection() {
  const selection = window.getSelection();

  if (!selection?.rangeCount || !editorContainsNode(selection.anchorNode)) {
    return;
  }

  editorRange = selection.getRangeAt(0).cloneRange();
}

function focusEditorEnd() {
  editorSurface.focus();

  const range = document.createRange();
  range.selectNodeContents(editorSurface);
  range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  editorRange = range.cloneRange();
}

function restoreEditorSelection() {
  editorSurface.focus();

  const selection = window.getSelection();
  selection.removeAllRanges();

  if (editorRange && editorContainsNode(editorRange.commonAncestorContainer)) {
    selection.addRange(editorRange);
  } else {
    focusEditorEnd();
  }
}

function normalizeEditorContent() {
  editorSurface.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") ?? "";

    if (!isSafeUrl(href)) {
      link.replaceWith(document.createTextNode(link.textContent));
      return;
    }

    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  editorSurface.querySelectorAll("script, style, iframe, object, embed").forEach((node) => {
    node.remove();
  });
}

function applyCommand(command, value = null) {
  restoreEditorSelection();
  document.execCommand(command, false, value);
  normalizeEditorContent();
  rememberEditorSelection();
  syncEditorBody();
}

function insertHtmlAtSelection(html) {
  restoreEditorSelection();
  document.execCommand("insertHTML", false, html);
  normalizeEditorContent();
  rememberEditorSelection();
  syncEditorBody();
}

function getPlainEditorText(node) {
  return (node.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

function serializeInlineNodes(nodes) {
  return [...nodes]
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue.replace(/\u00a0/g, " ");
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const tag = node.tagName.toLowerCase();

      if (tag === "br") {
        return "\n";
      }

      const text = serializeInlineNodes(node.childNodes);

      if (!text.trim()) {
        return "";
      }

      if (tag === "strong" || tag === "b") {
        return `**${text}**`;
      }

      if (tag === "em" || tag === "i") {
        return `*${text}*`;
      }

      if (tag === "a") {
        const href = node.getAttribute("href") ?? "";

        return isSafeUrl(href) ? `[${text}](${href})` : text;
      }

      return text;
    })
    .join("");
}

function serializeMediaNode(node) {
  const image = node.matches?.("img") ? node : node.querySelector?.("img");

  if (image) {
    const src = image.getAttribute("src") ?? "";
    const alt = image.getAttribute("alt") ?? "";

    return isSafeUrl(src, { media: true }) ? `![${alt}](${src})` : "";
  }

  const video = node.matches?.("video") ? node : node.querySelector?.("video");

  if (video) {
    const src = video.getAttribute("src") ?? "";
    const caption = node.querySelector?.("figcaption")?.textContent.trim() ?? "";
    const label = caption ? `:${caption}` : "";

    return isSafeUrl(src, { media: true }) ? `@[video${label}](${src})` : "";
  }

  return "";
}

function serializeBlock(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tag = node.tagName.toLowerCase();

  if (tag === "figure" || tag === "img" || tag === "video") {
    return serializeMediaNode(node);
  }

  if (tag === "h1" || tag === "h2" || tag === "h3") {
    return `## ${serializeInlineNodes(node.childNodes).trim()}`;
  }

  if (tag === "blockquote") {
    const lines = [...node.childNodes]
      .map((child) => serializeBlock(child))
      .join("\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line) => `> ${line}`).join("\n");
  }

  if (tag === "ul" || tag === "ol") {
    return [...node.children]
      .map((child) => serializeInlineNodes(child.childNodes).trim())
      .filter(Boolean)
      .join("\n");
  }

  return serializeInlineNodes(node.childNodes).trim();
}

function serializeEditorContent() {
  normalizeEditorContent();

  const blocks = [...editorSurface.childNodes]
    .map((node) => serializeBlock(node))
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0 && getPlainEditorText(editorSurface)) {
    blocks.push(getPlainEditorText(editorSurface));
  }

  return blocks.join("\n\n");
}

function insertDefaultText(text) {
  restoreEditorSelection();

  const selection = window.getSelection();

  if (!selection.isCollapsed) {
    return;
  }

  const marker = `editor-default-${Date.now()}-${Math.random()}`;
  document.execCommand(
    "insertHTML",
    false,
    `<span data-editor-marker="${marker}">${escapeHtml(text)}</span>`,
  );

  const inserted = editorSurface.querySelector(`[data-editor-marker="${marker}"]`);

  if (!inserted) {
    rememberEditorSelection();
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(inserted);
  selection.removeAllRanges();
  selection.addRange(range);
  editorRange = range.cloneRange();
}

function insertEditorMedia(type, url) {
  const html =
    type === "image"
      ? `<figure><img src="${escapeHtml(url)}" alt="" loading="lazy"></figure>`
      : `<figure><video src="${escapeHtml(url)}" controls preload="metadata"></video></figure>`;

  insertHtmlAtSelection(html);
  syncEditorBody();
}

function applyEditorFormat(format) {
  if (!requireAdmin()) {
    return;
  }

  if (format === "heading") {
    insertDefaultText("소제목");
    applyCommand("formatBlock", "h3");
    return;
  }

  if (format === "bold") {
    insertDefaultText("강조");
    applyCommand("bold");
    return;
  }

  if (format === "italic") {
    insertDefaultText("기울임");
    applyCommand("italic");
    return;
  }

  if (format === "quote") {
    insertDefaultText("인용");
    applyCommand("formatBlock", "blockquote");
    return;
  }

  if (format === "link") {
    const url = window.prompt("URL");

    if (!url || !isSafeUrl(url)) {
      setEditorStatus("올바른 URL을 입력하세요.");
      return;
    }

    insertDefaultText("링크");
    applyCommand("createLink", url);
    setEditorStatus("");
  }
}

function getSafeFileName(file) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  return extension ? `${id}.${extension}` : id;
}

function getUploadErrorMessage(error) {
  const message = error?.message ?? "알 수 없는 오류";

  if (/mime|type/i.test(message)) {
    return `업로드 실패: 허용되지 않은 파일 형식입니다. (${message})`;
  }

  if (/row-level security|policy|permission|not authorized|unauthorized/i.test(message)) {
    return `업로드 실패: 관리자 업로드 권한을 확인하세요. (${message})`;
  }

  if (/bucket|not found/i.test(message)) {
    return `업로드 실패: post-media 버킷을 찾을 수 없습니다. (${message})`;
  }

  return `업로드 실패: ${message}`;
}

async function uploadEditorMedia(file, type) {
  if (!requireAdmin() || !file || !isConfigured) {
    return;
  }

  if (activeMediaUploads > 0 || isSavingPost) {
    setEditorStatus("현재 작업이 끝난 뒤 다시 시도하세요.");
    return;
  }

  if (!file.type.startsWith(`${type}/`)) {
    setEditorStatus("파일 형식이 맞지 않습니다.");
    return;
  }

  if (file.size > maxMediaBytes) {
    setEditorStatus("100MB 이하 파일만 첨부할 수 있습니다.");
    return;
  }

  const uploadToken = mediaUploadToken;

  activeMediaUploads += 1;
  setEditorStatus(type === "image" ? "이미지 업로드 중..." : "영상 업로드 중...");
  updateEditorState();

  const path = `${session.user.id}/${getSafeFileName(file)}`;
  let uploadError = null;

  try {
    const { error } = await supabaseClient.storage
      .from(mediaBucket)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

    uploadError = error;
  } catch (error) {
    uploadError = error;
  }

  activeMediaUploads = Math.max(0, activeMediaUploads - 1);
  updateEditorState();

  if (uploadToken !== mediaUploadToken || editorElement.hidden) {
    return;
  }

  if (uploadError) {
    setEditorStatus(getUploadErrorMessage(uploadError));
    return;
  }

  const { data } = supabaseClient.storage.from(mediaBucket).getPublicUrl(path);

  insertEditorMedia(type, data.publicUrl);
  setEditorStatus(type === "image" ? "이미지가 첨부되었습니다." : "영상이 첨부되었습니다.");
}

async function saveEditedPost(event) {
  event.preventDefault();

  if (!requireAdmin()) {
    return;
  }

  if (isSavingPost) {
    return;
  }

  if (activeMediaUploads > 0) {
    setEditorStatus("첨부 업로드가 끝난 뒤 저장하세요.");
    return;
  }

  const title = editorTitle.value.trim();
  const body = syncEditorBody().trim();

  if (!title) {
    setEditorStatus("제목을 입력하세요.");
    editorTitle.focus();
    return;
  }

  if (!body) {
    setEditorStatus("본문을 입력하세요.");
    editorSurface.focus();
    return;
  }

  isSavingPost = true;
  setEditorStatus("저장 중...");
  updateEditorState();

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
  let result = null;
  let saveError = null;

  try {
    result = await query;
    saveError = result.error;
  } catch (error) {
    saveError = error;
  }

  if (saveError) {
    isSavingPost = false;
    updateEditorState();
    setEditorStatus(`저장 실패: ${saveError.message ?? "알 수 없는 오류"}`);
    return;
  }

  closeEditor();
  searchElement.value = "";
  currentPostId = result.data.id;
  await loadPosts();
  selectPost(result.data.id);

  if (isNewPost) {
    const notification = await notifySubscribers(result.data.id);

    if (!notification.ok) {
      window.alert("글은 저장됐지만 이메일 발송은 실패했습니다.");
    }
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
    return { ok: false };
  }

  const { error } = await supabaseClient.functions.invoke("notify-subscribers", {
    body: {
      post_id: postId,
      site_url: `${window.location.origin}${window.location.pathname}`,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  return { ok: !error };
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
  clearAdminRoute();
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

editorTitle.addEventListener("input", () => {
  if (!isSavingPost && activeMediaUploads === 0) {
    setEditorStatus("");
  }
});

editorSurface.addEventListener("input", () => {
  rememberEditorSelection();
  syncEditorBody();

  if (!isSavingPost && activeMediaUploads === 0) {
    setEditorStatus("");
  }
});

editorSurface.addEventListener("paste", (event) => {
  event.preventDefault();
  restoreEditorSelection();
  document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") ?? "");
  normalizeEditorContent();
  rememberEditorSelection();
  syncEditorBody();
});

["keyup", "mouseup", "focus", "blur"].forEach((eventName) => {
  editorSurface.addEventListener(eventName, () => {
    rememberEditorSelection();
    syncEditorBody();
  });
});

editorToolbar.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");

  if (!button || button.disabled) {
    return;
  }

  rememberEditorSelection();
  event.preventDefault();
});

editorToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-format]");
  const fileButton = event.target.closest("[data-file-input]");

  if (fileButton) {
    document.querySelector(`#${fileButton.dataset.fileInput}`)?.click();
    return;
  }

  if (!button) {
    return;
  }

  applyEditorFormat(button.dataset.format);
});

editorImage.addEventListener("change", () => {
  const file = editorImage.files?.[0];
  editorImage.value = "";
  void uploadEditorMedia(file, "image");
});

editorVideo.addEventListener("change", () => {
  const file = editorVideo.files?.[0];
  editorVideo.value = "";
  void uploadEditorMedia(file, "video");
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
  handleRoute();
});

window.addEventListener("pageshow", () => {
  handleRoute();
});

if (isConfigured) {
  supabaseClient.auth.onAuthStateChange(() => {
    void refreshSession();
  });
}

handleRoute();
void refreshSession();
void loadPosts().then(() => {
  handleRoute();
});
