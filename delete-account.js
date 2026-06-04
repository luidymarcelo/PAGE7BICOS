const SUPABASE_URL = "https://vyizwwtncgdfyihcoowf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aXp3d3RuY2dkZnlpaGNvb3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjA2MzYsImV4cCI6MjA4NzA5NjYzNn0.iygWBscC7UCa9N_7wXrDfSB9aTr2u9d7B2hJtOm2aKM";

const emailInput = document.getElementById("account-email");
const codeInput = document.getElementById("account-code");
const sendCodeButton = document.getElementById("send-code");
const verifyCodeButton = document.getElementById("verify-code");
const confirmDelete = document.getElementById("confirm-delete");
const deleteButton = document.getElementById("delete-account");
const statusBox = document.getElementById("form-status");

let verifiedSession = null;

function cleanEmail() {
  return emailInput.value.trim().toLowerCase();
}

function cleanCode() {
  return codeInput.value.replace(/\D/g, "");
}

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `form-status ${type}`.trim();
}

function setLoading(button, loadingText) {
  const previousText = button.textContent;
  button.textContent = loadingText;
  button.disabled = true;
  return () => {
    button.textContent = previousText;
    button.disabled = false;
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = body && typeof body === "object"
      ? body.msg || body.message || body.error_description || body.error
      : body;
    throw new Error(message || "Não foi possível concluir a solicitação.");
  }

  return body;
}

function updateDeleteState() {
  deleteButton.disabled = !verifiedSession || !confirmDelete.checked;
}

codeInput.addEventListener("input", () => {
  const digits = cleanCode().slice(0, 8);
  codeInput.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
});

emailInput.addEventListener("input", () => {
  verifiedSession = null;
  confirmDelete.checked = false;
  updateDeleteState();
});

confirmDelete.addEventListener("change", updateDeleteState);

sendCodeButton.addEventListener("click", async () => {
  const email = cleanEmail();
  if (!email || !email.includes("@")) {
    setStatus("Informe o e-mail cadastrado na 7bicos.", "error");
    return;
  }

  const done = setLoading(sendCodeButton, "Enviando...");
  setStatus("Enviando código para o e-mail informado...");
  try {
    await supabaseRequest("/auth/v1/otp", {
      method: "POST",
      body: JSON.stringify({
        email,
        create_user: false,
        should_create_user: false,
      }),
    });
    setStatus("Código enviado. Verifique sua caixa de entrada e digite os 8 dígitos.", "success");
    codeInput.focus();
  } catch (error) {
    setStatus(`Não foi possível enviar o código. ${error.message}`, "error");
  } finally {
    done();
  }
});

verifyCodeButton.addEventListener("click", async () => {
  const email = cleanEmail();
  const token = cleanCode();
  if (!email || !email.includes("@")) {
    setStatus("Informe o e-mail cadastrado na 7bicos.", "error");
    return;
  }
  if (token.length !== 8) {
    setStatus("Informe o código completo com 8 dígitos.", "error");
    return;
  }

  const done = setLoading(verifyCodeButton, "Validando...");
  setStatus("Validando código...");
  try {
    const session = await supabaseRequest("/auth/v1/verify", {
      method: "POST",
      body: JSON.stringify({
        email,
        token,
        type: "email",
      }),
    });
    verifiedSession = session;
    setStatus("E-mail validado. Confirme a exclusão permanente para continuar.", "success");
    updateDeleteState();
  } catch (error) {
    verifiedSession = null;
    updateDeleteState();
    setStatus(`Código inválido ou expirado. ${error.message}`, "error");
  } finally {
    done();
  }
});

deleteButton.addEventListener("click", async () => {
  if (!verifiedSession || !verifiedSession.access_token) {
    setStatus("Valide o código recebido por e-mail antes de excluir.", "error");
    return;
  }
  if (!confirmDelete.checked) {
    setStatus("Confirme que entende que a exclusão é permanente.", "error");
    return;
  }

  const done = setLoading(deleteButton, "Excluindo...");
  setStatus("Excluindo sua conta e dados vinculados...");
  try {
    await supabaseRequest("/functions/v1/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${verifiedSession.access_token}`,
      },
      body: "{}",
    });
    verifiedSession = null;
    emailInput.value = "";
    codeInput.value = "";
    confirmDelete.checked = false;
    setStatus("Conta excluída com sucesso. Seus dados vinculados foram removidos da 7bicos.", "success");
  } catch (error) {
    setStatus(`Não foi possível excluir agora. ${error.message}`, "error");
  } finally {
    done();
    updateDeleteState();
  }
});
