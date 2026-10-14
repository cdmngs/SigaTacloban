export function mount(main, page) {
  if (page === "403") {
    main.innerHTML = `<section class="forbidden-page"><div class="forbidden-brand"><img class="brand-icon" src="assets/img/logo.png" width="52" height="52" alt="SigaTacloban"></div><span class="forbidden-code">403</span><h1>This area is outside your role</h1><p>Your current BFP access profile does not include this page. Contact an administrator if you need access.</p><a class="button button-primary" href="dashboard.html">Back to dashboard <span aria-hidden="true">→</span></a></section>`;
    return;
  }
  main.innerHTML = `<section class="forbidden-page"><div class="forbidden-brand"><img class="brand-icon" src="assets/img/logo.png" width="52" height="52" alt="SigaTacloban"></div><span class="forbidden-code">404</span><h1>Page not found</h1><p>The page you are looking for is unavailable.</p><a class="button button-primary" href="dashboard.html">Back to dashboard <span aria-hidden="true">→</span></a></section>`;
}
