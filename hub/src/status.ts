// Optional live visitor count for the hero status pill. Runs only when the build was given
// HUB_ANALYTICS_ENDPOINT (rendered as data-analytics); otherwise the pill shows the release alone and no request is made.
// Expects a GET answering JSON { "visitors": number }. Any failure keeps the count hidden and logs nothing.
const pill = document.querySelector<HTMLElement>('[data-status]');
const endpoint = pill?.dataset.analytics ?? '';

if (pill && endpoint) {
  const out = pill.querySelector<HTMLElement>('[data-visitors]');
  const format = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  fetch(endpoint, { headers: { accept: 'application/json' }, signal: controller.signal, credentials: 'omit', cache: 'no-store' })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((body: { visitors?: unknown }) => {
      if (typeof body.visitors !== 'number' || !Number.isFinite(body.visitors) || body.visitors < 0 || !out) return;
      out.textContent = `${format.format(body.visitors)} visitors`;
      out.hidden = false;
    })
    .catch(() => { /* keep the count hidden */ })
    .finally(() => clearTimeout(timer));
}
