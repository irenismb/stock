(() => {
  "use strict";

  const CHAT_API_ENDPOINT = "";
  const USER_ID_KEY = "irenismb_user_id";

  const iconChat = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><path d="M8 9h8M8 13h5"></path></svg>';
  const iconSend = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>';

  const root = document.createElement("div");
  root.id = "catalogChatRoot";
  root.innerHTML = `
    <section class="catalog-chat-panel" id="catalogChatPanel" aria-label="Chat con Irenismb Stock Natura" aria-hidden="true">
      <header class="catalog-chat-header">
        <div class="catalog-chat-agent">
          <div class="catalog-chat-avatar">IN</div>
          <div class="catalog-chat-title">
            <strong>Irenismb Stock Natura</strong>
            <span><i class="catalog-chat-status-dot" aria-hidden="true"></i><span id="catalogChatStatus">Chat en preparación</span></span>
          </div>
        </div>
        <button class="catalog-chat-close" id="catalogChatClose" type="button" aria-label="Cerrar chat">✕</button>
      </header>

      <div class="catalog-chat-messages" id="catalogChatMessages" aria-live="polite">
        <div class="catalog-chat-day">Hoy</div>
        <div class="catalog-chat-message">
          Hola 👋 ¿En qué podemos ayudarte con nuestro catálogo?
          <span class="catalog-chat-time">Ahora</span>
        </div>
        <div class="catalog-chat-info" id="catalogChatInfo">
          El chat estará disponible en breve. La burbuja ya quedó instalada en el catálogo.
        </div>
      </div>

      <form class="catalog-chat-composer" id="catalogChatComposer">
        <textarea class="catalog-chat-input" id="catalogChatInput" rows="1" maxlength="700" placeholder="Escribe un mensaje..." disabled></textarea>
        <button class="catalog-chat-send" id="catalogChatSend" type="submit" aria-label="Enviar mensaje" disabled>${iconSend}</button>
      </form>
    </section>

    <button class="catalog-chat-launcher" id="catalogChatLauncher" type="button" aria-label="Abrir chat" aria-expanded="false">
      ${iconChat}
      <span class="catalog-chat-badge" id="catalogChatBadge" aria-label="Mensajes nuevos"></span>
    </button>
  `;

  document.body.appendChild(root);

  const panel = document.getElementById("catalogChatPanel");
  const launcher = document.getElementById("catalogChatLauncher");
  const closeButton = document.getElementById("catalogChatClose");
  const input = document.getElementById("catalogChatInput");
  const send = document.getElementById("catalogChatSend");
  const composer = document.getElementById("catalogChatComposer");
  const info = document.getElementById("catalogChatInfo");
  const status = document.getElementById("catalogChatStatus");

  function getBrowserId() {
    try {
      return localStorage.getItem(USER_ID_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setOpen(open) {
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.setAttribute("aria-label", open ? "Cerrar chat" : "Abrir chat");
    if (open && !input.disabled) setTimeout(() => input.focus(), 80);
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }

  launcher.addEventListener("click", () => {
    setOpen(!panel.classList.contains("is-open"));
  });

  closeButton.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel.classList.contains("is-open")) setOpen(false);
  });

  input.addEventListener("input", resizeInput);

  composer.addEventListener("submit", event => {
    event.preventDefault();
    if (!CHAT_API_ENDPOINT || !input.value.trim()) return;
  });

  if (CHAT_API_ENDPOINT) {
    input.disabled = false;
    send.disabled = false;
    status.textContent = "Disponible";
    info.hidden = true;
  }

  window.catalogChat = {
    endpoint: CHAT_API_ENDPOINT,
    browserId: getBrowserId,
    open: () => setOpen(true),
    close: () => setOpen(false)
  };
})();
