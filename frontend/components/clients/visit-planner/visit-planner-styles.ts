/**
 * Vizit-planner sahifasi uslublari. Barcha klasslar `vp-` prefiksi bilan —
 * loyiha global stillariga (`.btn`, `.modal` va h.k.) ta'sir qilmaslik uchun.
 * Dizayn zipdagi sahifaga mos, lekin `.vp-app` viewport (100vw/100vh) o'rniga
 * ota-konteynerni to'ldiradi (dashboard ichida ishlashi uchun).
 */
export const VISIT_PLANNER_CSS = `
.vp-app{position:absolute;inset:0;overflow:hidden;background:linear-gradient(135deg,#0f172a,#111827);
  --vp-line:#e2e8f0;--vp-muted:#64748b;--vp-text:#0f172a;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--vp-text)}
.vp-app *{box-sizing:border-box}
.vp-app button{cursor:pointer;border:none;font:inherit}
.vp-app input,.vp-app select{font:inherit}
.vp-map{position:absolute;inset:0;width:100%;height:100%;background:#dbeafe;z-index:0}
.vp-map.vp-map-draw{cursor:crosshair}
.vp-glass{background:rgba(255,255,255,.94);border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 70px rgba(15,23,42,.22);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.vp-topbar{position:absolute;z-index:20;left:14px;right:14px;top:12px;display:flex;align-items:center;gap:10px;pointer-events:none}
.vp-topbar-row{flex:1;min-width:0;display:flex;align-items:center;gap:8px;pointer-events:auto}
.vp-search-compact{flex:0 1 240px;min-width:160px;max-width:300px;padding:7px 10px;border-radius:14px}
.vp-search-compact input{font-size:12.5px}
.vp-top-stats{display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:thin}
.vp-stat-compact{padding:5px 9px;border-radius:10px}
.vp-stat-compact b{font-size:13px}
.vp-stat-compact span{font-size:9.5px}
.vp-brand{pointer-events:auto;display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:18px;min-width:270px}
.vp-logo{width:38px;height:38px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#06b6d4);display:grid;place-items:center;color:#fff;font-weight:900;box-shadow:0 14px 30px rgba(37,99,235,.32)}
.vp-brand h1{font-size:14px;line-height:1.1;margin:0;font-weight:900;letter-spacing:-.02em}
.vp-brand p{font-size:11.5px;margin:3px 0 0;color:var(--vp-muted)}
.vp-searchbox{pointer-events:auto;flex:1;display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:16px;max-width:520px}
.vp-searchbox svg{flex:0 0 auto;color:#64748b}
.vp-searchbox input{border:0;outline:0;background:transparent;width:100%;font-size:13.5px;color:var(--vp-text)}
.vp-actions{pointer-events:auto;display:flex;align-items:center;gap:8px;margin-left:auto}
.vp-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;padding:9px 12px;background:#fff;color:#0f172a;border:1px solid var(--vp-line);box-shadow:0 8px 20px rgba(15,23,42,.08);font-weight:800;font-size:12.5px;transition:.18s ease;white-space:nowrap}
.vp-btn:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(15,23,42,.13)}
.vp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.vp-btn.vp-primary{background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border-color:transparent}
.vp-btn.vp-danger{background:#fff1f2;color:#be123c;border-color:#fecdd3}
.vp-btn.vp-green{background:#ecfdf5;color:#047857;border-color:#bbf7d0}
.vp-btn.vp-active{background:#0f172a;color:#fff;border-color:#0f172a}
.vp-filterbar{position:absolute;z-index:18;left:14px;right:14px;top:58px;display:flex;align-items:center;flex-wrap:nowrap;gap:8px;padding:7px 11px;border-radius:16px;pointer-events:auto;overflow-x:auto;scrollbar-width:thin}
.vp-filterbar.vp-geo-expanded{align-items:stretch}
.vp-fb-stats{display:flex;align-items:center;flex-wrap:wrap;gap:7px;flex:0 0 auto;padding-top:2px}
.vp-fb-sep{width:1px;align-self:stretch;min-height:30px;background:var(--vp-line);flex:0 0 auto}
.vp-fb-sep-geo{display:none}
.vp-geo-bar{flex:1 1 280px;min-width:220px;display:flex;flex-direction:column;gap:8px}
.vp-geo-toggle{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:12px;border:1px solid var(--vp-line);background:#fff;font-size:12.5px;font-weight:800;color:#0f172a;text-align:left}
.vp-geo-toggle:hover{background:#f8fafc}
.vp-geo-toggle-label{color:#64748b;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.vp-geo-toggle-value{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vp-geo-chevron{margin-left:auto;transition:transform .2s ease;color:#64748b}
.vp-geo-chevron.vp-open{transform:rotate(180deg)}
.vp-geo-panel{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;border:1px solid var(--vp-line);background:rgba(248,250,252,.95)}
.vp-geo-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
.vp-geo-label-inline{flex:1 1 180px;margin:0}
.vp-geo-label-inline span{display:block;margin-bottom:4px}
.vp-geo-actions-row{flex-direction:row;flex-wrap:wrap}
.vp-geo-actions-row .vp-btn{flex:0 1 auto}
.vp-fb-filters{display:flex;align-items:center;flex-wrap:nowrap;gap:7px;flex:1 1 auto;min-width:0}
.vp-filterbar.vp-geo-expanded .vp-fb-filters{flex-basis:100%}
.vp-fb-field{width:168px;flex:0 0 auto;min-width:148px}
.vp-fb-chips{flex:0 0 auto;display:flex;align-items:center;gap:5px}
.vp-filterbar select.vp-fb-status{width:128px;flex:0 0 auto}
.vp-native{width:100%;border:1px solid var(--vp-line);background:#fff;border-radius:12px;padding:8px 11px;outline:none;color:#0f172a;font-size:13px;height:36px}
.vp-chips{display:flex;flex-wrap:wrap;gap:6px}
.vp-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border:1px solid var(--vp-line);border-radius:999px;background:#fff;font-size:11.5px;font-weight:800;color:#334155;transition:.14s ease}
.vp-chip.vp-active{background:#0f172a;color:#fff;border-color:#0f172a}
.vp-stat{display:flex;align-items:baseline;gap:6px;border:1px solid var(--vp-line);background:linear-gradient(135deg,#fff,#f8fafc);border-radius:12px;padding:6px 11px;white-space:nowrap}
.vp-stat b{font-size:15px;font-weight:900;letter-spacing:-.02em}
.vp-stat span{font-size:10.5px;color:var(--vp-muted);font-weight:800}
.vp-tools{position:absolute;z-index:18;right:14px;top:118px;display:flex;flex-direction:column;gap:8px;pointer-events:auto}
.vp-geo-title{font-size:13px;font-weight:900;letter-spacing:-.02em;margin:0 0 6px}
.vp-geo-hint{font-size:11px;line-height:1.45;color:var(--vp-muted);margin:0 0 10px}
.vp-geo-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.vp-geo-tab{padding:6px 10px;border-radius:10px;border:1px solid var(--vp-line);background:#fff;font-size:11px;font-weight:800;color:#475569}
.vp-geo-tab.vp-active{background:#0f172a;color:#fff;border-color:#0f172a}
.vp-geo-label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:#475569;margin-bottom:10px}
.vp-geo-warn{font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px;margin:0 0 10px}
.vp-geo-status{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid var(--vp-line);margin-bottom:10px}
.vp-geo-status b{display:block;font-size:12.5px}
.vp-geo-status span{display:block;font-size:10.5px;color:var(--vp-muted);margin-top:2px}
.vp-geo-badge{font-size:11px;font-weight:900;color:#047857;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:4px 8px;white-space:nowrap}
.vp-geo-actions{display:flex;flex-direction:column;gap:6px}
.vp-geo-draw-hint{font-size:11px;color:#2563eb;margin:8px 0 0;line-height:1.4}
.vp-geo-draw-hint-muted{color:#64748b}
.vp-geo-draw-btn{min-width:140px}
.vp-geo-settings-head{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 8px;border-bottom:1px solid var(--vp-line)}
.vp-geo-settings-head b{display:block;font-size:14px;color:#0f172a}
.vp-geo-settings-head span{display:block;font-size:12px;color:var(--vp-muted);margin-top:2px}
.vp-geo-bar-settings .vp-geo-panel{padding:12px 14px 14px}
.vp-geo-color-swatch{width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.15);flex-shrink:0}
.vp-geo-color-row{display:flex;align-items:center;gap:6px}
.vp-geo-color-input{width:36px;height:28px;padding:0;border:1px solid var(--vp-line);border-radius:8px;cursor:pointer;background:#fff}
.vp-geo-color-reset{padding:4px 8px!important;font-size:10px!important;min-height:28px}
.vp-geo-settings-wrap{position:relative;height:calc(100vh - 4rem);min-height:520px}
.vp-geo-settings-full{height:calc(100vh - 4rem);min-height:520px}
.vp-geo-settings-full .vp-app{position:relative;height:100%;min-height:520px;border-radius:12px;overflow:hidden}
.vp-filterbar-geo{top:52px;align-items:center;padding:10px 12px}
.vp-topbar-compact{top:8px;left:auto;right:14px;width:auto;justify-content:flex-end}
.vp-topbar-compact .vp-actions-left{margin-left:0}
.vp-geo-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;width:100%}
.vp-geo-toolbar-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:1;min-width:0}
.vp-geo-toolbar-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex-shrink:0}
.vp-geo-tabs-inline{margin:0}
.vp-geo-toolbar-field{min-width:140px;max-width:220px;flex:1 1 140px}
.vp-geo-toolbar-field .vp-native{width:100%;min-height:34px}
.vp-geo-toolbar-color{display:flex;align-items:center}
.vp-geo-toolbar-status{font-size:11px;font-weight:800;color:#64748b;white-space:nowrap;padding:0 4px}
.vp-geo-settings-full .vp-tools{top:108px;right:14px}
.vp-tool{width:42px;height:42px;border-radius:14px;background:rgba(255,255,255,.96);border:1px solid var(--vp-line);box-shadow:0 12px 30px rgba(15,23,42,.16);display:grid;place-items:center;color:#0f172a;font-size:18px;font-weight:800;transition:.16s ease}
.vp-tool:hover,.vp-tool.vp-active{background:#0f172a;color:#fff;transform:translateY(-1px)}
.vp-hint{position:absolute;z-index:19;left:50%;top:112px;transform:translateX(-50%);background:rgba(15,23,42,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:9px 14px;font-size:12.5px;font-weight:800;box-shadow:0 12px 30px rgba(15,23,42,.16);max-width:min(92vw,720px);text-align:center}
.vp-hint-warn{background:rgba(180,83,9,.92)}
.vp-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:16;pointer-events:none}
.vp-canvas.vp-active{pointer-events:auto;cursor:crosshair}
.vp-sheet{position:absolute;z-index:25;left:14px;right:14px;bottom:12px;border-radius:22px;transform:translateY(135%);transition:.28s cubic-bezier(.2,.8,.2,1);pointer-events:auto;overflow:hidden}
.vp-sheet.vp-open{transform:translateY(0)}
.vp-sheet-inner{display:grid;grid-template-columns:230px 1fr auto;gap:11px;align-items:center;padding:12px}
.vp-summary{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#ecfeff);border:1px solid #bfdbfe}
.vp-summary-icon{width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;display:grid;place-items:center;font-weight:900}
.vp-summary b{font-size:20px;line-height:1;letter-spacing:-.04em}
.vp-summary span{display:block;font-size:11.5px;color:#475569;font-weight:800;margin-top:2px}
.vp-assign-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:9px}
.vp-assign{background:#fff;border:1px solid var(--vp-line);border-radius:16px;padding:10px;text-align:left;transition:.16s ease;min-height:60px}
.vp-assign:hover{border-color:#2563eb;box-shadow:0 10px 24px rgba(37,99,235,.13);transform:translateY(-1px)}
.vp-assign small{display:flex;align-items:center;gap:6px;color:#64748b;font-weight:900;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
.vp-assign b{display:block;margin-top:4px;font-size:12.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vp-sheet-actions{display:flex;align-items:center;gap:8px}
.vp-info{position:absolute;z-index:30;width:312px;border-radius:20px;overflow:hidden;pointer-events:auto}
.vp-info-cover{background:linear-gradient(135deg,#2563eb,#06b6d4);padding:13px;color:#fff;position:relative}
.vp-info-cover h3{margin:0;font-size:15px;font-weight:900;letter-spacing:-.02em;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vp-info-cover p{margin:4px 0 0;font-size:11.5px;opacity:.9}
.vp-close-x{position:absolute;right:9px;top:9px;width:28px;height:28px;border-radius:11px;background:rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;font-size:16px}
.vp-info-body{padding:12px;background:#fff}
.vp-info-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:12px}
.vp-info-row:last-of-type{border-bottom:0}
.vp-info-row span{color:#64748b;font-weight:800}
.vp-info-row b{text-align:right;font-weight:900;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vp-info-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}
.vp-toast{position:absolute;z-index:70;right:14px;bottom:118px;background:#0f172a;color:#fff;border-radius:16px;padding:11px 14px;box-shadow:0 24px 70px rgba(15,23,42,.22);font-size:12.5px;font-weight:800;max-width:340px}
.vp-marker{position:relative;width:34px;height:34px;margin-left:-17px;margin-top:-34px;border-radius:50%;display:grid;place-items:center;filter:drop-shadow(0 10px 12px rgba(15,23,42,.28));transition:transform .16s ease}
.vp-marker:hover{transform:scale(1.08)}
.vp-marker__dot{position:absolute;inset:2px;border-radius:50%;border:3px solid #fff}
.vp-marker__badge{position:relative;z-index:2;color:#fff;font-size:12px;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.25)}
.vp-marker__check{position:absolute;z-index:4;right:-7px;top:-7px;width:20px;height:20px;border-radius:50%;background:#22c55e;color:#fff;border:3px solid #fff;display:none;align-items:center;justify-content:center;font-size:11px;font-weight:900}
.vp-marker.vp-is-selected{animation:vpPulse 1.35s infinite}
.vp-marker.vp-is-selected .vp-marker__dot{background:#2563eb !important;border-color:#fff;box-shadow:0 0 0 7px rgba(37,99,235,.22)}
.vp-marker.vp-is-selected .vp-marker__check{display:flex}
.vp-marker.vp-is-dim{opacity:.35;filter:grayscale(.2)}
@keyframes vpPulse{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.vp-mobile{display:none}
@media (max-width:1180px){.vp-sheet-inner{grid-template-columns:200px 1fr}.vp-sheet-actions{grid-column:1/-1;justify-content:flex-end}}
@media (max-width:900px){
  .vp-topbar{flex-wrap:wrap}
  .vp-topbar-row{width:100%;flex-wrap:wrap}
  .vp-search-compact{flex:1 1 100%;max-width:none}
  .vp-top-stats{width:100%}
  .vp-actions{width:100%;overflow:auto;padding-bottom:2px}
  .vp-mobile{display:inline-flex}
  .vp-filterbar{top:auto;left:10px;right:10px;bottom:118px;flex-direction:column;align-items:stretch;flex-wrap:wrap}
  .vp-fb-filters{display:none;flex-wrap:wrap}
  .vp-filterbar.vp-open .vp-fb-filters{display:flex}
  .vp-fb-field,.vp-filterbar select.vp-fb-status{width:100%;min-width:0}
  .vp-tools{right:10px;top:auto;bottom:200px}
}
`;
