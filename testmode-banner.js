// ═══════════════════════════════════════════════════════════════════════════
// BREAK · testmode-banner.js · v50 (S6 — modo testing operativo)
// ───────────────────────────────────────────────────────────────────────────
// Banner naranja persistente cuando config.test_mode_activo='true'.
// Se importa en TODOS los módulos con:
//   <script src="testmode-banner.js"></script>
//
// Comportamiento:
//   - Lee config al cargar y cada 60s (polling)
//   - Si activo → inserta banner fixed top de 32px + padding-top al body
//   - Si desactivado → remueve banner + restaura padding original del body
//   - Idempotente: si se importa 2 veces no se inicializa 2 veces
//   - Falla silencioso ante errores de red (no rompe el módulo host)
//
// API expuesta a módulos host (v50):
//   - window._testModeActivo  → boolean (default false durante el primer fetch)
//   - evento 'testmode:change' en window con detail={ activo: boolean }
//     dispatcheado SOLO cuando cambia el estado (no en cada poll).
//
// Default seguro: si un módulo lee window._testModeActivo antes del primer
// check, recibe `false` (modo normal) — evita que data real entre por error
// a tablas con test_mode=true durante el gap inicial de hasta 60s.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Idempotencia ─────────────────────────────────────────────────────────
  if (window._testModeBannerLoaded) return;
  window._testModeBannerLoaded = true;

  // ── API expuesta — default seguro (v50) ──────────────────────────────────
  // Inicializamos en false ANTES del primer fetch. Los módulos que consulten
  // _testModeActivo durante el gap inicial reciben modo normal (más seguro).
  if (typeof window._testModeActivo !== 'boolean') {
    window._testModeActivo = false;
  }

  // ── Constantes ───────────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://oiuualqixcccfhtpcist.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdXVhbHFpeGNjY2ZodHBjaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzUxNjEsImV4cCI6MjA4OTQ1MTE2MX0.ms4MHVhKDTKfID0WGi05EFPySf350SA66uNi4wPfsOo';
  const POLL_INTERVAL_MS = 60_000; // 60s — modo test no cambia tan seguido
  const BANNER_HEIGHT_PX = 32;

  // ── Estado interno ───────────────────────────────────────────────────────
  let _bannerEl = null;
  let _bodyPaddingOriginal = null;
  let _pollTimer = null;
  let _activoActual = null; // tri-state: null=desconocido, true, false

  // ── Fetch a config ───────────────────────────────────────────────────────
  async function checkTestMode() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/config?clave=eq.test_mode_activo&select=valor`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (!res.ok) return;
      const rows = await res.json();
      const activo = (rows && rows[0] && rows[0].valor === 'true');

      // Solo actuar si cambió (evita parpadeo y trabajo innecesario)
      if (activo === _activoActual) return;
      _activoActual = activo;

      // v50 — Sincronizar API expuesta + notificar a módulos host
      window._testModeActivo = activo;
      try {
        window.dispatchEvent(new CustomEvent('testmode:change', { detail: { activo } }));
      } catch (e) {
        // Algunos navegadores muy viejos no soportan CustomEvent — silencioso
      }

      if (activo) showBanner();
      else hideBanner();
    } catch (e) {
      // Silent — no romper el módulo host por errores de red
      // (el banner puede ser stale unos segundos, no es crítico)
    }
  }

  // ── Mostrar banner ───────────────────────────────────────────────────────
  function showBanner() {
    if (_bannerEl) return;

    _bannerEl = document.createElement('div');
    _bannerEl.id = 'break-testmode-banner';
    _bannerEl.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'right: 0',
      'height: ' + BANNER_HEIGHT_PX + 'px',
      'background: #ff9800',
      'color: #1a1a1a',
      'font-family: ui-monospace, SFMono-Regular, Menlo, monospace',
      'font-size: 12px',
      'font-weight: 600',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'letter-spacing: 0.05em',
      'z-index: 999999',
      'box-shadow: 0 2px 4px rgba(0,0,0,0.25)',
      'pointer-events: none',
      'user-select: none',
    ].join(';');
    _bannerEl.textContent = '⚠ MODO TESTING ACTIVO — las escrituras se marcan como datos de prueba';

    if (document.body) {
      document.body.insertBefore(_bannerEl, document.body.firstChild);

      // Empujar contenido para no taparlo
      _bodyPaddingOriginal = document.body.style.paddingTop || '';
      const currentPadding = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      document.body.style.paddingTop = (currentPadding + BANNER_HEIGHT_PX) + 'px';
    }
  }

  // ── Ocultar banner ───────────────────────────────────────────────────────
  function hideBanner() {
    if (!_bannerEl) return;
    try { _bannerEl.remove(); } catch (e) {}
    _bannerEl = null;

    // Restaurar padding original del body
    if (document.body && _bodyPaddingOriginal !== null) {
      document.body.style.paddingTop = _bodyPaddingOriginal;
      _bodyPaddingOriginal = null;
    }
  }

  // ── Init: primer check + polling ─────────────────────────────────────────
  function init() {
    checkTestMode();
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(checkTestMode, POLL_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
