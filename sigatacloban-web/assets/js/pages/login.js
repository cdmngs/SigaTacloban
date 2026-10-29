import { getRoleLabel } from "../core/auth.js";
import { login } from "../api/auth.js";
import { iconSvg } from "../ui/icons.js";

const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function mapIllustration() {
  return `<div class="login-map-wrap" aria-hidden="true"><div class="login-map-card"><svg viewBox="0 0 620 300" class="login-map-art"><defs><pattern id="mapGrid" width="40" height="28" patternUnits="userSpaceOnUse"><path d="M40 0H0V28" fill="none" stroke="#fff" stroke-opacity=".36" stroke-width="1"/></pattern><filter id="soft"><feGaussianBlur stdDeviation="11"/></filter></defs><path d="M0 30 530 0 620 248 78 300Z" fill="#FBF7F3"/><path d="M0 30 530 0 620 248 78 300Z" fill="url(#mapGrid)"/><g fill="none" stroke="#fff" stroke-opacity=".7"><path d="M-20 75Q170 22 350 91T640 78M-20 120Q170 69 350 138T650 124M-10 170Q180 117 355 187T650 172M0 222Q177 167 366 235T650 218"/><path d="M180 0 325 300M355-10 437 300" stroke-width="8" stroke-opacity=".45"/></g><ellipse cx="235" cy="102" rx="104" ry="48" fill="#D62828" opacity=".55" filter="url(#soft)"/><ellipse cx="385" cy="153" rx="96" ry="52" fill="#F77F00" opacity=".65" filter="url(#soft)"/><ellipse cx="194" cy="210" rx="75" ry="44" fill="#F4C430" opacity=".6" filter="url(#soft)"/><circle cx="435" cy="84" r="58" fill="#2E9E5B" opacity=".12" stroke="#2E9E5B" stroke-width="2"/><g fill="#941B0C" stroke="#fff" stroke-width="2"><path d="M191 115c-3-6-10-12-10-18a10 10 0 1 1 20 0c0 6-7 12-10 18Z"/><path d="M307 165c-3-6-10-12-10-18a10 10 0 1 1 20 0c0 6-7 12-10 18Z"/><path d="M442 192c-3-6-10-12-10-18a10 10 0 1 1 20 0c0 6-7 12-10 18Z"/></g><text x="105" y="178" font-size="9" fill="#6E5B52" letter-spacing="2">SAGKAHAN</text><text x="321" y="211" font-size="9" fill="#6E5B52" letter-spacing="2">POBLACION</text></svg></div></div>`;
}

export function mount(main) {
  const storedEmail = localStorage.getItem("sigatacloban-remembered-email") || "";
  const savedEmail = storedEmail;
  main.innerHTML = `
    <main class="login-page">
      <section class="login-visual">
        <div class="login-brand"><span class="brand-lockup"><img class="brand-icon" src="assets/img/logo.png" alt="SigaTacloban" width="42" height="42"><span class="brand-type"><strong>SigaTacloban</strong></span></span></div>
        <div class="login-message"><span class="decision-pill"><span aria-hidden="true">${iconSvg("shield", 12)}</span> BFP DECISION SUPPORT</span><h1>Anticipate risk.<br><em>Act with confidence.</em></h1><p>Machine learning-powered fire risk intelligence for a safer<br class="login-desktop-break"> <span class="login-city">Tacloban&nbsp;City.</span></p></div>
        ${mapIllustration()}<div class="authorized-note"><span aria-hidden="true">${iconSvg("lock", 12)}</span> Authorized BFP personnel only</div>
      </section>
      <section class="login-panel"><form class="login-form" novalidate>
        <span class="eyebrow">SECURE ACCESS PORTAL</span><h2>Welcome back</h2><p class="login-subtitle">Sign in with your official BFP account.</p>
        <label class="form-label" for="email">Email address</label><div class="input-wrap"><span aria-hidden="true">${iconSvg("user", 16)}</span><input id="email" name="email" type="email" aria-describedby="email-error" aria-invalid="false" placeholder="name@bfp.gov.ph" autocomplete="username" value="${htmlEscape(savedEmail)}"></div><small class="field-error" id="email-error" data-error="email" role="alert" hidden></small>
        <label class="form-label" for="password">Password</label><div class="input-wrap"><span aria-hidden="true">${iconSvg("lock", 16)}</span><input id="password" name="password" type="password" aria-describedby="password-error" aria-invalid="false" placeholder="Enter your password" autocomplete="current-password"><button type="button" class="password-toggle" aria-label="Show password" aria-pressed="false">${iconSvg("eye", 20)}</button></div><small class="field-error" id="password-error" data-error="password" role="alert" hidden></small>
        <div class="login-options"><label class="checkbox-label"><input type="checkbox" name="remember" ${savedEmail ? "checked" : ""}><span>Remember me</span></label><button type="button" class="text-action forgot-password">Forgot password?</button></div>
        <small class="auth-error" role="alert" hidden></small><button class="button button-primary login-submit" type="submit">Sign in securely ${iconSvg("arrow", 17)}</button>
        <div class="signing-role"><span aria-hidden="true">${iconSvg("shield", 16)}</span><div><small>Signing in as</small><b class="role-preview">Verified after sign in</b><p>Your role determines the tools and data you can access.</p></div></div>
        <p class="login-support">Need help? Contact <b>BFP Tacloban IT Support</b></p>
      </form></section>
    </main><div class="toast-stack" role="status" aria-live="polite" aria-atomic="true"></div>`;

  const form = main.querySelector(".login-form");
  const emailInput = main.querySelector("#email");
  const passwordInput = main.querySelector("#password");
  const sessionError = sessionStorage.getItem("sigatacloban-session-error");
  if (sessionError) {
    main.querySelector(".auth-error").textContent = sessionError;
    main.querySelector(".auth-error").hidden = false;
    sessionStorage.removeItem("sigatacloban-session-error");
  }
  const setError = (field, message) => {
    const element = main.querySelector(`[data-error="${field}"]`);
    const input = main.querySelector(`#${field}`);
    element.textContent = message;
    element.hidden = !message;
    input.setAttribute("aria-invalid", String(Boolean(message)));
    element.previousElementSibling?.classList.toggle("has-error", Boolean(message));
  };
  emailInput.addEventListener("input", () => setError("email", ""));
  passwordInput.addEventListener("input", () => setError("password", ""));
  main.querySelector(".password-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const visible = passwordInput.type === "password";
    passwordInput.type = visible ? "text" : "password";
    button.innerHTML = iconSvg(visible ? "eyeOff" : "eye", 20);
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(visible));
  });
  main.querySelector(".forgot-password").addEventListener("click", () => {
    main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: "Contact BFP Tacloban IT Support to reset your account password.", type: "info" } }));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("email", "");
    setError("password", "");
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("email", "Enter a valid email address."); emailInput.focus(); return; }
    if (!password) { setError("password", "Enter your password."); passwordInput.focus(); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Signing in…";
    const authError = main.querySelector(".auth-error");
    authError.hidden = true;
    try {
      const result = await login({ email, password });
      if (form.elements.remember.checked) localStorage.setItem("sigatacloban-remembered-email", email);
      else localStorage.removeItem("sigatacloban-remembered-email");
      main.querySelector(".role-preview").textContent = getRoleLabel(result.user.role);
      window.location.assign("dashboard.html");
    } catch (error) {
      submit.disabled = false;
      submit.innerHTML = `Sign in securely ${iconSvg("arrow", 17)}`;
      authError.textContent = error.message || "Sign in failed. Check your connection and try again.";
      authError.hidden = false;
    }
  });
}
