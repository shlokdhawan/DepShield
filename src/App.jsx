import { useState, useEffect, useRef } from "react";

// ─── GLOBAL STYLES ──────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #F7F7F7;
    --bg1:     color-mix(in srgb, #F7F7F7 85%, #EEEEEE);
    --bg2:     #EEEEEE;
    --bg3:     color-mix(in srgb, #EEEEEE 85%, #929AAB);
    --surface: rgba(57, 62, 70, 0.04);
    --border:  rgba(57, 62, 70, 0.15);
    --border2: rgba(57, 62, 70, 0.25);
    
    /* Premium accents */
    --primary:   #393E46; 
    --primary2:  #929AAB;
    --primary-bg:rgba(57, 62, 70, 0.15);
    
    /* Semantic Colors - left vibrant for alerts/graphs where needed, but toned down slightly */
    --cyan:    #929AAB; 
    --green:   #10b981; 
    --red:     #ef4444; 
    --amber:   #f59e0b; 
    --orange:  #f97316;
    --yellow:  #eab308;
    --teal:    #14b8a6;
    
    --text:    #393E46; 
    --text2:   rgba(57, 62, 70, 0.7); 
    --text3:   rgba(57, 62, 70, 0.45);
    
    --mono:    'JetBrains Mono', monospace;
    --ui:      'Inter', sans-serif;
    --head:    'Inter', sans-serif;
    
    --shadow-sm: 0 1px 2px 0 rgba(57, 62, 70, 0.1);
    --shadow-md: 0 4px 6px -1px rgba(57, 62, 70, 0.2), 0 2px 4px -1px rgba(57, 62, 70, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(57, 62, 70, 0.3), 0 4px 6px -2px rgba(57, 62, 70, 0.2);
    --shadow-glow: 0 0 20px rgba(57, 62, 70, 0.15);
    --nav-bg: rgba(247, 247, 247, 0.8);
  }

  :root[data-theme='dark'] {
    --bg:      #27374D;
    --bg1:     color-mix(in srgb, #27374D 85%, #526D82);
    --bg2:     #526D82;
    --bg3:     color-mix(in srgb, #526D82 85%, #9DB2BF);
    --surface: rgba(221, 230, 237, 0.04);
    --border:  rgba(221, 230, 237, 0.1);
    --border2: rgba(221, 230, 237, 0.2);
    --primary:   #9DB2BF; 
    --primary2:  #526D82;
    --primary-bg:rgba(157, 178, 191, 0.15);
    --cyan:    #9DB2BF; 
    --text:    #DDE6ED; 
    --text2:   #9DB2BF; 
    --text3:   color-mix(in srgb, #DDE6ED 55%, #526D82);
    --shadow-sm: 0 1px 2px 0 rgba(15, 20, 30, 0.3);
    --shadow-md: 0 4px 6px -1px rgba(15, 20, 30, 0.4), 0 2px 4px -1px rgba(15, 20, 30, 0.2);
    --shadow-lg: 0 10px 15px -3px rgba(15, 20, 30, 0.5), 0 4px 6px -2px rgba(15, 20, 30, 0.3);
    --shadow-glow: 0 0 20px rgba(157, 178, 191, 0.15);
    --nav-bg: rgba(15, 17, 21, 0.8);
  }

  html, body, #root { height: 100%; width: 100%; min-width: 100%; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--ui);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    letter-spacing: -0.01em;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 9999px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text3); }

  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes slide-right {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes blink { 50% { opacity: 0; } }

  @keyframes shimmer-move {
    from { transform: translateX(-150%); }
    to   { transform: translateX(300%); }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 15px rgba(57, 62, 70, 0.15), 0 0 30px rgba(57, 62, 70, 0.05); }
    50%       { box-shadow: 0 0 25px rgba(57, 62, 70, 0.25), 0 0 50px rgba(57, 62, 70, 0.1); }
  }

  .fade-up { animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease;
  }
  
  .card-hoverable:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--border2);
  }

  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(145deg, rgba(57, 62, 70,0.03) 0%, transparent 50%);
    pointer-events: none;
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    cursor: pointer; border: none; border-radius: 8px;
    font-family: var(--ui); font-size: 13px; font-weight: 500;
    padding: 8px 16px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); white-space: nowrap;
    letter-spacing: 0.01em;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:not(:disabled):hover { transform: translateY(-1px); }
  .btn:not(:disabled):active { transform: translateY(0); filter: brightness(0.95); }

  .btn-ghost { background: transparent; border: 1px solid transparent; color: var(--text2); }
  .btn-ghost:hover { background: var(--surface) !important; color: var(--text) !important; border-color: var(--border); }

  .btn-cyan {
    background: var(--primary);
    border: 1px solid var(--primary2);
    color: white;
    box-shadow: 0 2px 4px rgba(57, 62, 70, 0.2);
  }
  .btn-cyan:not(:disabled):hover {
    background: var(--primary2);
    box-shadow: 0 4px 8px rgba(57, 62, 70, 0.3);
  }

  .btn-green {
    background: var(--green);
    border: 1px solid #059669; /* Emerald 600 */
    color: white;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  }

  .spinner {
    width: 16px; height: 16px; flex-shrink: 0;
    border: 2px solid rgba(57, 62, 70,0.1);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  table { border-collapse: separate; border-spacing: 0; width: 100%; }
  th {
    text-align: left; padding: 12px 16px;
    color: var(--text3); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border); cursor: pointer;
    user-select: none; white-space: nowrap; background: var(--bg1);
    position: sticky; top: 0; z-index: 10;
  }
  th:hover { color: var(--text); }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
  tbody tr { transition: background 0.15s ease; }
  tbody tr:hover { background: rgba(57, 62, 70, 0.02); }
  tbody tr:last-child td { border-bottom: none; }

  input[type="text"], input[type="password"] {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text);
    font-family: var(--ui);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
  }
  input[type="text"]:focus, input[type="password"]:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-bg), inset 0 1px 2px rgba(0,0,0,0.1);
  }
  input::placeholder { color: var(--text3); }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    border-radius: 6px; padding: 2px 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .section-title {
    font-family: var(--head);
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.02em;
  }

  .label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--text3);
  }

  .divider { height: 1px; background: var(--border); width: 100%; }
`;

// ─── DATA ────────────────────────────────────────────────────────────────────
const DEPS = [
  { id: 1, name: "log4j", version: "2.14.1", latest: "2.17.2", sev: "CRITICAL", score: 10.0, cves: ["CVE-2021-44228", "CVE-2021-45046"], vulns: 2, desc: "Log4Shell — Remote Code Execution via JNDI injection in log messages. Allows unauthenticated attackers to execute arbitrary code on the server.", updated: "2021-11-15", maint: "Active", origin: ["react-ecommerce-app", "spring-boot", "log4j"], fix: "mvn versions:use-latest-releases -Dincludes=org.apache.logging.log4j:*", fixv: "2.17.2", alts: [{ name: "logback", cmd: "mvn dependency:exclude log4j" }, { name: "slf4j", cmd: "mvn add slf4j-simple" }], effort: "Hard", sz: 28, col: "var(--red)" },
  { id: 2, name: "axios", version: "0.21.0", latest: "1.6.2", sev: "CRITICAL", score: 8.8, cves: ["CVE-2021-3749"], vulns: 1, desc: "Server-Side Request Forgery (SSRF) — allows attackers to send forged requests to internal resources via unsafe redirect following.", updated: "2021-08-31", maint: "Active", origin: ["react-ecommerce-app", "axios"], fix: "npm install axios@1.6.2", fixv: "1.6.2", alts: [{ name: "fetch API", cmd: "// Use native fetch (built-in)" }, { name: "ky", cmd: "npm install ky" }], effort: "Easy", sz: 30, col: "var(--red)" },
  { id: 3, name: "lodash", version: "4.17.15", latest: "4.17.21", sev: "CRITICAL", score: 7.4, cves: ["CVE-2020-8203"], vulns: 1, desc: "Prototype Pollution in zipObjectDeep — attacker can add/modify Object.prototype properties, leading to application takeover.", updated: "2020-04-27", maint: "Inactive", origin: ["react-ecommerce-app", "webpack", "lodash"], fix: "npm install lodash@4.17.21", fixv: "4.17.21", alts: [{ name: "lodash-es", cmd: "npm install lodash-es" }, { name: "remeda", cmd: "npm install remeda" }], effort: "Easy", sz: 26, col: "var(--red)" },
  { id: 4, name: "express", version: "4.17.0", latest: "4.18.2", sev: "HIGH", score: 7.5, cves: ["CVE-2022-24999"], vulns: 1, desc: "Open Redirect via the qs module allows attackers to redirect users to malicious external sites with crafted query strings.", updated: "2022-11-26", maint: "Active", origin: ["react-ecommerce-app", "express"], fix: "npm install express@4.18.2", fixv: "4.18.2", alts: [{ name: "fastify", cmd: "npm install fastify" }, { name: "koa", cmd: "npm install koa" }], effort: "Medium", sz: 24, col: "var(--orange)" },
  { id: 5, name: "minimist", version: "1.2.5", latest: "1.2.8", sev: "HIGH", score: 7.3, cves: ["CVE-2021-44906"], vulns: 1, desc: "Prototype Pollution via __proto__ keys in CLI argument parsing. Attacker-controlled input can corrupt the global Object prototype.", updated: "2022-03-17", maint: "Active", origin: ["react-ecommerce-app", "webpack-cli", "minimist"], fix: "npm install minimist@1.2.8", fixv: "1.2.8", alts: [{ name: "yargs", cmd: "npm install yargs" }, { name: "commander", cmd: "npm install commander" }], effort: "Easy", sz: 14, col: "var(--orange)" },
  { id: 6, name: "node-fetch", version: "2.6.0", latest: "3.3.2", sev: "HIGH", score: 8.2, cves: ["CVE-2022-0235"], vulns: 1, desc: "Sensitive information exposure via URL redirection to arbitrary protocol handlers, leaking credentials in the Referer header.", updated: "2022-01-24", maint: "Active", origin: ["react-ecommerce-app", "node-fetch"], fix: "npm install node-fetch@3.3.2", fixv: "3.3.2", alts: [{ name: "got", cmd: "npm install got" }, { name: "undici", cmd: "npm install undici" }], effort: "Medium", sz: 18, col: "var(--orange)" },
  { id: 7, name: "tar", version: "4.4.8", latest: "6.2.0", sev: "HIGH", score: 7.5, cves: ["CVE-2021-37701", "CVE-2021-37712"], vulns: 2, desc: "Arbitrary file creation/overwrite via symlink attack during extraction — path traversal can overwrite system files.", updated: "2021-08-31", maint: "Active", origin: ["react-ecommerce-app", "npm", "tar"], fix: "npm install tar@6.2.0", fixv: "6.2.0", alts: [{ name: "archiver", cmd: "npm install archiver" }], effort: "Medium", sz: 16, col: "var(--orange)" },
  { id: 8, name: "path-parse", version: "1.0.6", latest: "1.0.7", sev: "HIGH", score: 7.5, cves: ["CVE-2021-23343"], vulns: 1, desc: "ReDoS in posix.parse() via crafted input containing excessive slashes causes catastrophic regex backtracking and server hang.", updated: "2021-05-04", maint: "Inactive", origin: ["react-ecommerce-app", "resolve", "path-parse"], fix: "npm install path-parse@1.0.7", fixv: "1.0.7", alts: [{ name: "path (built-in)", cmd: "// Use Node.js built-in path" }], effort: "Easy", sz: 12, col: "var(--orange)" },
  { id: 9, name: "moment", version: "2.24.0", latest: "2.30.1", sev: "MEDIUM", score: 5.3, cves: ["CVE-2022-24785"], vulns: 1, desc: "Path Traversal when parsing user-supplied locale strings. Maintainers consider this library legacy and recommend modern alternatives.", updated: "2022-04-04", maint: "Inactive", origin: ["react-ecommerce-app", "moment"], fix: "npm install moment@2.30.1", fixv: "2.30.1", alts: [{ name: "date-fns", cmd: "npm install date-fns" }, { name: "dayjs", cmd: "npm install dayjs" }], effort: "Medium", sz: 20, col: "var(--yellow)" },
  { id: 10, name: "serialize-javascript", version: "2.1.1", latest: "6.0.1", sev: "MEDIUM", score: 5.6, cves: ["CVE-2020-7660"], vulns: 1, desc: "RCE if untrusted input is passed to serialize() — regex injection via string properties containing special characters.", updated: "2020-05-11", maint: "Active", origin: ["react-ecommerce-app", "webpack", "serialize-javascript"], fix: "npm install serialize-javascript@6.0.1", fixv: "6.0.1", alts: [{ name: "json-stringify-safe", cmd: "npm install json-stringify-safe" }], effort: "Easy", sz: 11, col: "var(--yellow)" },
  { id: 11, name: "yargs-parser", version: "13.0.0", latest: "21.1.1", sev: "MEDIUM", score: 5.3, cves: ["CVE-2020-7608"], vulns: 1, desc: "Prototype Pollution via __proto__ key injection in argument parsing, potentially altering global application behavior.", updated: "2020-03-16", maint: "Active", origin: ["react-ecommerce-app", "jest", "yargs-parser"], fix: "npm install yargs-parser@21.1.1", fixv: "21.1.1", alts: [{ name: "minimist (patched)", cmd: "npm install minimist@1.2.8" }], effort: "Easy", sz: 13, col: "var(--yellow)" },
  { id: 12, name: "dot-prop", version: "4.2.0", latest: "6.0.1", sev: "MEDIUM", score: 6.5, cves: ["CVE-2020-8116"], vulns: 1, desc: "Prototype Pollution via crafted path strings passed to get(), set(), or has() — attacker injects into Object.prototype.", updated: "2020-01-28", maint: "Active", origin: ["react-ecommerce-app", "configstore", "dot-prop"], fix: "npm install dot-prop@6.0.1", fixv: "6.0.1", alts: [{ name: "object-path", cmd: "npm install object-path" }], effort: "Easy", sz: 10, col: "var(--yellow)" },
  { id: 13, name: "acorn", version: "5.7.3", latest: "8.11.3", sev: "MEDIUM", score: 5.3, cves: ["CVE-2020-7598"], vulns: 1, desc: "ReDoS via crafted JavaScript input causes the parser to hang — catastrophic backtracking in the parsing regex.", updated: "2020-03-01", maint: "Active", origin: ["react-ecommerce-app", "webpack", "acorn"], fix: "npm install acorn@8.11.3", fixv: "8.11.3", alts: [{ name: "@babel/parser", cmd: "npm install @babel/parser" }], effort: "Hard", sz: 15, col: "var(--yellow)" },
  { id: 14, name: "handlebars", version: "4.0.14", latest: "4.7.8", sev: "MEDIUM", score: 5.6, cves: ["CVE-2021-23369", "CVE-2019-19919"], vulns: 2, desc: "RCE via prototype pollution in template compilation. Allows attackers to run arbitrary JavaScript via crafted template strings.", updated: "2021-04-12", maint: "Active", origin: ["react-ecommerce-app", "nodemailer", "handlebars"], fix: "npm install handlebars@4.7.8", fixv: "4.7.8", alts: [{ name: "mustache", cmd: "npm install mustache" }, { name: "eta", cmd: "npm install eta" }], effort: "Medium", sz: 17, col: "var(--yellow)" },
  { id: 15, name: "marked", version: "0.3.9", latest: "10.0.0", sev: "MEDIUM", score: 6.1, cves: ["CVE-2022-21681", "CVE-2022-21680"], vulns: 2, desc: "ReDoS in multiple regex patterns. Susceptible to XSS when rendering user-supplied markdown without sanitization.", updated: "2022-01-04", maint: "Active", origin: ["react-ecommerce-app", "marked"], fix: "npm install marked@10.0.0", fixv: "10.0.0", alts: [{ name: "dompurify + marked", cmd: "npm install dompurify marked" }, { name: "remark", cmd: "npm install remark" }], effort: "Medium", sz: 14, col: "var(--yellow)" },
  { id: 16, name: "ini", version: "1.3.5", latest: "4.1.1", sev: "LOW", score: 3.5, cves: ["CVE-2020-7788"], vulns: 1, desc: "Prototype Pollution — decode() pollutes Object.prototype when parsing __proto__ keys in INI files.", updated: "2020-12-08", maint: "Active", origin: ["react-ecommerce-app", "npm-config", "ini"], fix: "npm install ini@4.1.1", fixv: "4.1.1", alts: [], effort: "Easy", sz: 9, col: "var(--amber)" },
  { id: 17, name: "y18n", version: "4.0.0", latest: "5.0.8", sev: "LOW", score: 3.7, cves: ["CVE-2020-7774"], vulns: 1, desc: "Prototype Pollution via crafted locale string key path in i18n library.", updated: "2020-11-16", maint: "Active", origin: ["react-ecommerce-app", "yargs", "y18n"], fix: "npm install y18n@5.0.8", fixv: "5.0.8", alts: [], effort: "Easy", sz: 8, col: "var(--amber)" },
  { id: 18, name: "browserslist", version: "4.8.3", latest: "4.22.2", sev: "LOW", score: 2.9, cves: ["CVE-2021-23364"], vulns: 1, desc: "ReDoS via specially crafted browserslist query strings in configuration parsing.", updated: "2021-04-28", maint: "Active", origin: ["react-ecommerce-app", "babel", "browserslist"], fix: "npm install browserslist@4.22.2", fixv: "4.22.2", alts: [], effort: "Easy", sz: 10, col: "var(--amber)" },
  { id: 19, name: "ws", version: "7.4.5", latest: "8.16.0", sev: "LOW", score: 3.1, cves: ["CVE-2021-32640"], vulns: 1, desc: "ReDoS — crafted Sec-Websocket-Protocol headers can hang the WebSocket server indefinitely.", updated: "2021-05-03", maint: "Active", origin: ["react-ecommerce-app", "webpack-dev-server", "ws"], fix: "npm install ws@8.16.0", fixv: "8.16.0", alts: [], effort: "Easy", sz: 12, col: "var(--amber)" },
  { id: 20, name: "glob-parent", version: "3.1.0", latest: "6.0.2", sev: "LOW", score: 2.4, cves: ["CVE-2020-28469"], vulns: 1, desc: "ReDoS via crafted path input with excessive slashes causing catastrophic backtracking in the path parsing regex.", updated: "2021-01-07", maint: "Active", origin: ["react-ecommerce-app", "webpack", "glob-parent"], fix: "npm install glob-parent@6.0.2", fixv: "6.0.2", alts: [], effort: "Easy", sz: 9, col: "var(--amber)" },
  { id: 21, name: "trim-newlines", version: "3.0.0", latest: "5.0.0", sev: "LOW", score: 2.2, cves: ["CVE-2021-33623"], vulns: 1, desc: "ReDoS via crafted strings with many newline characters passed to the trim function.", updated: "2021-06-01", maint: "Abandoned", origin: ["react-ecommerce-app", "meow", "trim-newlines"], fix: "npm install trim-newlines@5.0.0", fixv: "5.0.0", alts: [], effort: "Easy", sz: 7, col: "var(--amber)" },
  { id: 22, name: "trim", version: "0.0.1", latest: "1.0.1", sev: "LOW", score: 2.5, cves: ["CVE-2020-7753"], vulns: 1, desc: "ReDoS vulnerability in the trim function via specially crafted input string.", updated: "2020-10-05", maint: "Abandoned", origin: ["react-ecommerce-app", "remark", "trim"], fix: "npm install trim@1.0.1", fixv: "1.0.1", alts: [], effort: "Easy", sz: 7, col: "var(--amber)" },
  { id: 23, name: "is-svg", version: "4.2.1", latest: "4.3.2", sev: "LOW", score: 2.3, cves: ["CVE-2021-29059"], vulns: 1, desc: "ReDoS in the SVG detection regex pattern, triggerable with adversarial input strings.", updated: "2021-07-15", maint: "Inactive", origin: ["react-ecommerce-app", "svgo", "is-svg"], fix: "npm install is-svg@4.3.2", fixv: "4.3.2", alts: [], effort: "Easy", sz: 6, col: "var(--amber)" },
  { id: 24, name: "react", version: "18.2.0", latest: "18.2.0", sev: "SAFE", score: 0, cves: [], vulns: 0, desc: "No known vulnerabilities. Core UI library for building user interfaces — actively maintained by Meta.", updated: "2023-06-14", maint: "Active", origin: ["react-ecommerce-app", "react"], fix: "", fixv: "18.2.0", alts: [], effort: "Easy", sz: 32, col: "var(--teal)" },
  { id: 25, name: "react-dom", version: "18.2.0", latest: "18.2.0", sev: "SAFE", score: 0, cves: [], vulns: 0, desc: "No known vulnerabilities. DOM rendering layer for React.", updated: "2023-06-14", maint: "Active", origin: ["react-ecommerce-app", "react-dom"], fix: "", fixv: "18.2.0", alts: [], effort: "Easy", sz: 28, col: "var(--teal)" },
  { id: 26, name: "typescript", version: "5.2.2", latest: "5.3.3", sev: "SAFE", score: 0, cves: [], vulns: 0, desc: "No known vulnerabilities. TypeScript adds static typing to JavaScript.", updated: "2023-11-20", maint: "Active", origin: ["react-ecommerce-app", "typescript"], fix: "", fixv: "5.3.3", alts: [], effort: "Easy", sz: 22, col: "var(--teal)" },
  { id: 27, name: "vite", version: "5.0.0", latest: "5.0.10", sev: "SAFE", score: 0, cves: [], vulns: 0, desc: "No known vulnerabilities. Modern frontend build tool.", updated: "2023-11-16", maint: "Active", origin: ["react-ecommerce-app", "vite"], fix: "", fixv: "5.0.10", alts: [], effort: "Easy", sz: 20, col: "var(--teal)" },
  { id: 28, name: "eslint", version: "8.55.0", latest: "8.55.0", sev: "SAFE", score: 0, cves: [], vulns: 0, desc: "No known vulnerabilities. Pluggable JavaScript linting utility.", updated: "2023-12-01", maint: "Active", origin: ["react-ecommerce-app", "eslint"], fix: "", fixv: "8.55.0", alts: [], effort: "Easy", sz: 18, col: "var(--teal)" },
];

const PIPE = [
  { icon: "⬡", label: "Repo Cloner", desc: "Downloading codebase from remote" },
  { icon: "⬡", label: "Manifest Scanner", desc: "Reading package.json / requirements.txt" },
  { icon: "⬡", label: "Dependency Tree Builder", desc: "Mapping direct + transitive dependencies" },
  { icon: "⬡", label: "Vulnerability Checker", desc: "Cross-referencing NVD + OSV databases" },
  { icon: "⬡", label: "Graph Engine", desc: "Constructing visual dependency map" },
  { icon: "⬡", label: "Risk Scoring Engine", desc: "Scoring by Severity, Depth, Age & Maintainer Health" },
  { icon: "⬡", label: "Origin Tracer", desc: "Tracing how vulnerable libs entered the project" },
  { icon: "⬡", label: "Priority Ranker", desc: "Ranking remediation by impact" },
];

const SEV = {
  CRITICAL: { color: "var(--red)", border: "rgba(239, 68, 68, 0.3)", bg: "rgba(239, 68, 68, 0.1)" },
  HIGH: { color: "var(--orange)", border: "rgba(249, 115, 22, 0.3)", bg: "rgba(249, 115, 22, 0.1)" },
  MEDIUM: { color: "var(--yellow)", border: "rgba(234, 179, 8, 0.3)", bg: "rgba(234, 179, 8, 0.1)" },
  LOW: { color: "var(--amber)", border: "rgba(245, 158, 11, 0.3)", bg: "rgba(245, 158, 11, 0.1)" },
  SAFE: { color: "var(--teal)", border: "rgba(20, 184, 166, 0.3)", bg: "rgba(20, 184, 166, 0.1)" },
};

// ─── REUSABLE ─────────────────────────────────────────────────────────────────
function Chip({ sev }) {
  const s = SEV[sev] || SEV.SAFE;
  return <span className="tag" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{sev}</span>;
}

function Bar({ score }) {
  const pct = (score / 10) * 100;
  const c = score >= 8 ? "var(--red)" : score >= 6 ? "var(--orange)" : score >= 4 ? "var(--yellow)" : score >= 2 ? "var(--amber)" : "var(--teal)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(57, 62, 70,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 99, boxShadow: score >= 6 ? `0 0 6px ${c}` : 'none', transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </div>
      <span style={{ color: c, fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)", minWidth: 26 }}>{score.toFixed(1)}</span>
    </div>
  );
}

function Copy({ text, size = "sm" }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{ padding: size === "sm" ? "4px 10px" : "6px 14px", fontSize: 12, color: ok ? "var(--green)" : undefined, borderColor: ok ? "rgba(16, 185, 129, 0.3)" : undefined }}>
      {ok ? "✓ Copied" : "Copy"}
    </button>
  );
}

function CountUp({ n, duration = 1400 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let t0 = null;
    const f = ts => { if (!t0) t0 = ts; const p = Math.min((ts - t0) / duration, 1); setV(Math.floor(p * n)); if (p < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, [n]);
  return <>{v}</>;
}

function Typewriter({ text, speed = 12 }) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut(""); if (!text) return;
    let i = 0;
    const iv = setInterval(() => { setOut(text.slice(0, i + 1)); i++; if (i >= text.length) clearInterval(iv); }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{out}{out.length < text.length && <span style={{ animation: "blink 0.9s step-end infinite", color: "var(--primary)" }}>▋</span>}</span>;
}

function GaugeArc({ value, size = 100 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  const c = value > 70 ? "var(--red)" : value > 50 ? "var(--orange)" : value > 30 ? "var(--amber)" : "var(--teal)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg2)" strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={7}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: value > 50 ? `drop-shadow(0 0 4px ${c}88)` : 'none', transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={c} fontSize={size / 4.5} fontFamily="JetBrains Mono" fontWeight="700">{value}</text>
    </svg>
  );
}

// ─── GRAPH ────────────────────────────────────────────────────────────────────
function Graph({ deps, onPick }) {
  const [pos, setPos] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [hov, setHov] = useState(null);
  const posR = useRef([]), velR = useRef([]), raf = useRef(null);
  const W = 800, H = 500;

  useEffect(() => {
    const n = deps.length;
    posR.current = deps.map((_, i) => {
      const a = (i / n) * 2 * Math.PI, r = 140 + Math.random() * 90;
      return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
    });
    velR.current = deps.map(() => ({ vx: 0, vy: 0 }));
    let frame = 0;
    const run = () => {
      const p = posR.current, v = velR.current;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = 1600 / (d * d); v[i].vx += (dx / d) * f; v[i].vy += (dy / d) * f; v[j].vx -= (dx / d) * f; v[j].vy -= (dy / d) * f;
        }
        v[i].vx += (W / 2 - p[i].x) * 0.007; v[i].vy += (H / 2 - p[i].y) * 0.007;
        v[i].vx *= 0.84; v[i].vy *= 0.84;
        p[i].x = Math.max(24, Math.min(W - 24, p[i].x + v[i].vx)); p[i].y = Math.max(24, Math.min(H - 24, p[i].y + v[i].vy));
      }
      frame++;
      if (frame % 2 === 0) setPos(p.map(x => ({ ...x })));
      if (frame < 160) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const hovDep = hov !== null ? deps.find(d => d.id === hov) : null;
  const hovIdx = hov !== null ? deps.findIndex(d => d.id === hov) : -1;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.min(z + 0.2, 2.2))} style={{ padding: "6px 14px", fontSize: 12 }}>＋ Zoom In</button>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} style={{ padding: "6px 14px", fontSize: 12 }}>－ Zoom Out</button>
        <button className="btn btn-ghost" onClick={() => setZoom(1)} style={{ padding: "6px 14px", fontSize: 12 }}>↺ Reset</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {[["var(--red)", "Critical"], ["var(--orange)", "High"], ["var(--yellow)", "Medium"], ["var(--amber)", "Low"], ["var(--teal)", "Safe"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}66`, flexShrink: 0 }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ border: "1px solid var(--border2)", borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.35)", boxShadow: "inset 0 1px 0 rgba(57, 62, 70,0.04)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", cursor: "grab", display: "block" }} onClick={() => setHov(null)}>
          <defs>
            <radialGradient id="gbg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#0f1729" />
              <stop offset="100%" stopColor="#060b18" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#gbg)" />
          {[...Array(6)].map((_, i) => <line key={`h${i}`} x1={0} y1={(i / 5) * H} x2={W} y2={(i / 5) * H} stroke="rgba(57, 62, 70,0.02)" strokeWidth={1} />)}
          {[...Array(9)].map((_, i) => <line key={`v${i}`} x1={(i / 8) * W} y1={0} x2={(i / 8) * W} y2={H} stroke="rgba(57, 62, 70,0.02)" strokeWidth={1} />)}
          <g transform={`translate(${W / 2 * (1 - zoom)},${H / 2 * (1 - zoom)}) scale(${zoom})`}>
            {deps.map((d, i) => {
              if (!pos[i]) return null;
              return deps.slice(i + 1, i + 3).map(t => {
                const ti = deps.indexOf(t); if (!pos[ti]) return null;
                return <line key={`${d.id}-${t.id}`} x1={pos[i].x} y1={pos[i].y} x2={pos[ti].x} y2={pos[ti].y} stroke={hov === d.id || hov === t.id ? "rgba(57, 62, 70, 0.4)" : "rgba(57, 62, 70,0.03)"} strokeWidth={hov === d.id || hov === t.id ? 1.5 : 1} style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }} />;
              });
            })}
            {deps.map((d, i) => {
              if (!pos[i]) return null;
              const { x, y } = pos[i], r = Math.max(7, Math.min(19, d.sz / 2)), isH = hov === d.id;
              return (
                <g key={d.id} onClick={e => { e.stopPropagation(); onPick(d); }}
                  onMouseEnter={() => setHov(d.id)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
                  {isH && <circle cx={x} cy={y} r={r + 9} fill="none" stroke={d.col} strokeWidth={1} strokeOpacity={0.25} />}
                  {isH && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={d.col} strokeWidth={1} strokeOpacity={0.15} />}
                  <circle cx={x} cy={y} r={isH ? r + 2 : r} fill={`color-mix(in srgb, ${d.col} 15%, transparent)`} stroke={d.col} strokeWidth={isH ? 2 : 1.5} style={{ filter: isH ? `drop-shadow(0 0 10px ${d.col})` : `drop-shadow(0 0 3px color-mix(in srgb, ${d.col} 40%, transparent))`, transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                  {r > 9 && <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={d.col} fontSize={Math.max(6, r * 0.52)} fontFamily="JetBrains Mono" fontWeight="700" style={{ pointerEvents: "none" }}>{d.name.slice(0, 7)}</text>}
                </g>
              );
            })}
            {hov !== null && hovIdx >= 0 && pos[hovIdx] && (() => {
              const { x, y } = pos[hovIdx], dep = hovDep;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={x + 14} y={y - 34} width={150} height={64} rx={8} fill="var(--bg2)" stroke={dep.col} strokeWidth={1.5} style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.5))" }} />
                  <text x={x + 22} y={y - 15} fill={dep.col} fontSize={13} fontFamily="JetBrains Mono" fontWeight="700">{dep.name}</text>
                  <text x={x + 22} y={y + 2} fill="var(--text2)" fontSize={11} fontFamily="Inter">v{dep.version}</text>
                  <text x={x + 22} y={y + 17} fill="var(--text2)" fontSize={11} fontFamily="JetBrains Mono">CVSS {dep.score.toFixed(1)}</text>
                </g>
              );
            })()}
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─── SIDE PANEL ───────────────────────────────────────────────────────────────
function Panel({ dep, onClose }) {
  const [pr, setPr] = useState(false);
  if (!dep) return null;
  const gc = dep.score >= 8 ? "var(--red)" : dep.score >= 6 ? "var(--orange)" : dep.score >= 4 ? "var(--yellow)" : "var(--teal)";
  const pct = dep.score / 10;
  const diff = `diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -12,4 +12,4 @@\n   "dependencies": {\n-    "${dep.name}": "^${dep.version}",\n+    "${dep.name}": "^${dep.fixv}",\n   }`;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(5px)", zIndex: 98 }} />
      <aside style={{ position: "fixed", top: 0, right: 0, width: 480, height: "100vh", zIndex: 99, background: "var(--bg)", borderLeft: "1px solid var(--border)", overflowY: "auto", animation: "slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "-10px 0 30px rgba(0,0,0,0.5)" }}>
        {/* Top bar */}
        <div style={{ padding: "24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg1)" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--head)", color: "var(--text)", letterSpacing: "-0.02em" }}>{dep.name}</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4, fontFamily: "var(--mono)" }}>v{dep.version}&nbsp;&nbsp;→&nbsp;&nbsp;<span style={{ color: "var(--green)" }}>v{dep.fixv}</span></div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip sev={dep.sev} />
              <span className="tag" style={{ background: "rgba(57, 62, 70,0.03)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                {dep.maint === "Active" ? "🟢" : dep.maint === "Abandoned" ? "🔴" : "🟡"} {dep.maint}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "6px", fontSize: 18, flexShrink: 0, width: 32, height: 32 }}>✕</button>
        </div>

        <div style={{ padding: "24px" }}>
          {/* CVEs */}
          {dep.cves.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p className="label" style={{ marginBottom: 10 }}>CVE IDs</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {dep.cves.map(c => <span key={c} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--red)", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontFamily: "var(--mono)" }}>{c}</span>)}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 28 }}>
            <p className="label" style={{ marginBottom: 10 }}>Vulnerability Details</p>
            <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>{dep.desc}</div>
          </div>

          {/* CVSS Gauge */}
          <div style={{ marginBottom: 28, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", gap: 24, boxShadow: "var(--shadow-sm)" }}>
            <svg width={120} height={64} viewBox="0 0 200 108">
              <path d="M 20 98 A 80 80 0 0 1 180 98" fill="none" stroke="var(--bg3)" strokeWidth={14} strokeLinecap="round" />
              <path d="M 20 98 A 80 80 0 0 1 180 98" fill="none" stroke={gc} strokeWidth={14} strokeLinecap="round"
                strokeDasharray={`${pct * 251.3} 251.3`} style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${gc} 60%, transparent))`, transition: "stroke-dasharray 1s ease" }} />
              <text x={100} y={78} textAnchor="middle" fill={gc} fontSize={32} fontFamily="JetBrains Mono" fontWeight="700">{dep.score.toFixed(1)}</text>
            </svg>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: gc, fontFamily: "var(--head)" }}>{dep.sev}</div>
              <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>CVSS Base Score</div>
              <div style={{ color: "var(--text2)", fontSize: 12, marginTop: 6 }}>{dep.vulns} CVE{dep.vulns !== 1 ? "s" : ""} — {dep.updated}</div>
            </div>
          </div>

          {/* Origin trace */}
          <div style={{ marginBottom: 28 }}>
            <p className="label" style={{ marginBottom: 10 }}>Origin Trace</p>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              {dep.origin.map((part, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    background: i === dep.origin.length - 1 ? "rgba(239, 68, 68, 0.1)" : "var(--primary-bg)",
                    border: `1px solid ${i === dep.origin.length - 1 ? "rgba(239, 68, 68, 0.25)" : "rgba(57, 62, 70, 0.2)"}`,
                    color: i === dep.origin.length - 1 ? "var(--red)" : "var(--primary)",
                    borderRadius: 8, padding: "6px 12px", fontSize: 13, fontFamily: "var(--mono)"
                  }}>{part}</span>
                  {i < dep.origin.length - 1 && <span style={{ color: "var(--text3)", fontSize: 16 }}>›</span>}
                </span>
              ))}
              {dep.sev !== "SAFE" && <span style={{ color: "var(--red)", fontSize: 11, fontWeight: 600, marginLeft: 4 }}>VULN</span>}
            </div>
          </div>

          {/* Fix command */}
          {dep.fix && (
            <div style={{ marginBottom: 28 }}>
              <p className="label" style={{ marginBottom: 10 }}>Recommended Fix</p>
              <div style={{ background: "var(--bg1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "var(--shadow-sm)" }}>
                <code style={{ color: "var(--green)", fontSize: 13, wordBreak: "break-all", fontFamily: "var(--mono)" }}>{dep.fix}</code>
                <Copy text={dep.fix} />
              </div>
            </div>
          )}

          {/* Alternatives */}
          {dep.alts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p className="label" style={{ marginBottom: 10 }}>Safe Alternatives</p>
              {dep.alts.map((a, i) => (
                <div key={i} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ color: "var(--cyan)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{a.name}</div>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <code style={{ color: "var(--text2)", fontSize: 12, wordBreak: "break-all", fontFamily: "var(--mono)" }}>{a.cmd}</code>
                    <Copy text={a.cmd} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Generate PR */}
          {dep.fix && (
            <div>
              <button className="btn btn-cyan" onClick={() => setPr(v => !v)} style={{ width: "100%", padding: "14px", fontSize: 14, boxShadow: "var(--shadow-md)" }}>
                {pr ? "▲ Hide PR Diff" : "✦ Generate Pull Request"}
              </button>
              {pr && (
                <div style={{ marginTop: 16, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-sm)", animation: "fade-up 0.2s" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg2)" }}>
                    <span style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--mono)" }}>patch.diff</span>
                    <Copy text={diff} />
                  </div>
                  <pre style={{ padding: 16, margin: 0, fontSize: 13, color: "var(--text2)", overflowX: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "var(--mono)" }}>{diff}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("light");
  const [phase, setPhase] = useState("input"); // input | pipeline | main
  const [tab, setTab] = useState("dashboard");
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState([]);
  const [url, setUrl] = useState("https://github.com/demo/react-ecommerce-app");
  const [sel, setSel] = useState(null);
  const [filt, setFilt] = useState("All");
  const [sCol, setSCol] = useState("score");
  const [sDir, setSDir] = useState("desc");
  const [key, setKey] = useState("");
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("");
  const [aLoad, setALoad] = useState(false);
  const [aErr, setAErr] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "graph", label: "Dependency Graph", icon: "⬡" },
    { id: "vulns", label: "Vulnerabilities", icon: "⚑" },
    { id: "fixes", label: "Fix Plan", icon: "✦" },
    { id: "ai", label: "AI Insights", icon: "◈" },
  ];

  const scan = async () => {
    setPhase("pipeline"); setStep(-1); setDone([]);
    for (let i = 0; i < PIPE.length; i++) {
      await new Promise(r => setTimeout(r, 150)); setStep(i);
      await new Promise(r => setTimeout(r, 660));
      setDone(p => [...p, i]);
    }
    await new Promise(r => setTimeout(r, 300));
    setPhase("main"); setTab("dashboard");
  };

  const crit = DEPS.filter(d => d.sev === "CRITICAL").length;
  const upg = DEPS.filter(d => d.version !== d.fixv && d.sev !== "SAFE").length;
  const aband = DEPS.filter(d => d.maint === "Abandoned").length;
  const risk = Math.min(98, Math.round((crit * 15 + DEPS.filter(d => d.sev === "HIGH").length * 8 + DEPS.filter(d => d.sev === "MEDIUM").length * 4) / DEPS.length * 10));
  const grade = risk > 70 ? "D" : risk > 50 ? "C" : risk > 30 ? "B" : "A";
  const gc = risk > 70 ? "var(--red)" : risk > 50 ? "var(--orange)" : risk > 30 ? "var(--amber)" : "var(--teal)";

  const rows = [...DEPS]
    .filter(d => filt === "All" || d.sev === filt)
    .sort((a, b) => { let av = a[sCol], bv = b[sCol]; if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); } return sDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });

  const doSort = c => { if (sCol === c) setSDir(d => d === "asc" ? "desc" : "asc"); else { setSCol(c); setSDir("desc"); } };

  const ask = async q => {
    if (!key.trim()) { setAErr("Please enter your Gemini API key."); return; }
    if (!q.trim()) return;
    setALoad(true); setResp(""); setAErr("");
    const vd = DEPS.filter(d => d.sev !== "SAFE").map(d => ({ name: d.name, version: d.version, severity: d.sev, score: d.score, cves: d.cves }));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `You are a senior application security expert. The developer scanned their project: ${JSON.stringify(vd)}.\n\nUser question: "${q}"\n\nGive clear, concise, actionable advice. Use bullet points where helpful.` }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1000 } })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      setResp(d.candidates[0].content.parts[0].text);
    } catch (e) { setAErr("Error: " + e.message); }
    finally { setALoad(false); }
  };

  const fixes = DEPS.filter(d => d.sev !== "SAFE" && d.fix).sort((a, b) => b.score - a.score);

  // ── helpers ──
  const Stat = ({ label, val, color, sub }) => (
    <div className="card card-hoverable fade-up" style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="label" style={{ marginBottom: 12 }}>{label}</p>
          <div style={{ fontFamily: "var(--head)", fontSize: 40, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 20px color-mix(in srgb, ${color} 30%, transparent)` }}>
            {phase === "main" ? <CountUp n={val} /> : val}
          </div>
          {sub && <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 8 }}>{sub}</p>}
        </div>
        <div style={{ width: 4, height: 48, background: color, borderRadius: 99, opacity: 0.8, marginTop: 4, boxShadow: `0 0 12px ${color}` }} />
      </div>
    </div>
  );

  return (
    <>
      <style>{G}</style>

      {/* ── NAV ── */}
      <header style={{
        background: "var(--nav-bg)", borderBottom: "1px solid var(--border)",
        padding: "0 32px", display: "flex", alignItems: "center", height: 64,
        position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)",
        boxShadow: "var(--shadow-sm)", transition: "background 0.3s ease"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 48, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, background: "var(--primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--bg)", boxShadow: "var(--shadow-md)" }}>✦</div>
          <span style={{ fontFamily: "var(--head)", fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>DepShield</span>
        </div>

        {phase === "main" && TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: "transparent", border: "none", cursor: "pointer", padding: "0 16px",
              height: "100%", display: "flex", alignItems: "center", gap: 7,
              color: tab === t.id ? "var(--text)" : "var(--text3)",
              borderBottom: tab === t.id ? "2px solid var(--cyan)" : "2px solid transparent",
              fontSize: 13, fontFamily: "var(--ui)", fontWeight: tab === t.id ? 600 : 400,
              transition: "all 0.18s", whiteSpace: "nowrap"
            }}>
            <span style={{ color: tab === t.id ? "var(--cyan)" : "var(--text3)", fontSize: 11, transition: "color 0.18s" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {phase === "main" && (
            <>
              <div style={{ width: 1, height: 20, background: "var(--border)", marginRight: 4 }} />
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>react-ecommerce-app</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "var(--green)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite" }} />
                Scan complete
              </span>
            </>
          )}
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 15, marginLeft: 8 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main style={{ minHeight: "calc(100vh - 58px)" }}>

        {/* ── INPUT SCREEN ── */}
        {phase === "input" && (
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 48px" }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 48 }} className="fade-up">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--primary-bg)", border: "1px solid rgba(57, 62, 70, 0.2)", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "var(--primary)", marginBottom: 24, fontWeight: 500 }}>
                <span style={{ animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
                Powered by Gemini 2.0 Flash + NVD Database
              </div>
              <h1 style={{ fontFamily: "var(--head)", fontSize: 44, fontWeight: 800, color: "var(--text)", lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 16 }}>
                Dependency Risk<br /><span style={{ background: "linear-gradient(135deg,var(--primary),var(--text2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Analyzer</span>
              </h1>
              <p style={{ color: "var(--text2)", fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
                Detect vulnerabilities, abandoned packages, and prototype pollution in your open-source dependencies — before attackers do.
              </p>
            </div>

            <div className="card fade-up" style={{ padding: 32 }}>
              <div style={{ marginBottom: 26 }}>
                <label className="label" style={{ display: "block", marginBottom: 10 }}>GitHub Repository URL</label>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ color: "var(--text3)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>OR UPLOAD MANIFEST</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <label onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(57, 62, 70, 0.4)"; e.currentTarget.style.background = "var(--primary-bg)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "transparent"; }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px dashed var(--border2)", borderRadius: 12, padding: "28px 20px", cursor: "pointer", gap: 10, marginBottom: 28, transition: "all 0.2s", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, background: "var(--primary-bg)", border: "1px solid rgba(57, 62, 70, 0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>
                <div>
                  <div style={{ color: "var(--text2)", fontSize: 13, fontWeight: 500 }}>Drop your manifest file here</div>
                  <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 3 }}>package.json · requirements.txt · pom.xml</div>
                </div>
                <input type="file" accept=".json,.txt,.xml" style={{ display: "none" }} onChange={() => { }} />
              </label>

              <button onClick={scan} style={{
                width: "100%", background: "linear-gradient(135deg,rgba(57, 62, 70, 0.15),rgba(57, 62, 70, 0.15))",
                border: "1px solid rgba(57, 62, 70, 0.3)", borderRadius: 11, padding: "15px",
                color: "var(--primary)", fontSize: 14, fontFamily: "var(--ui)", fontWeight: 600, cursor: "pointer",
                animation: "glow-pulse 2.5s ease-in-out infinite", transition: "all 0.2s", letterSpacing: "0.02em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10
              }}>
                <span style={{ fontSize: 16 }}>✦</span> Analyze Dependencies
              </button>

              <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 24 }}>
                {[["28", "Dependencies"], ["23", "Vulnerabilities"], ["5", "Safe packages"]].map(([n, l]) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{n}</div>
                    <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PIPELINE ── */}
        {phase === "pipeline" && (
          <div style={{ maxWidth: 580, margin: "0 auto", padding: "72px 24px 48px" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }} className="fade-up">
              <div style={{ display: "inline-flex", width: 52, height: 52, background: "var(--primary-bg)", border: "1px solid rgba(57, 62, 70, 0.2)", borderRadius: 14, alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>✦</div>
              <h2 style={{ fontFamily: "var(--head)", fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Scanning Repository</h2>
              <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 8, fontFamily: "var(--mono)" }}>{url}</p>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              {PIPE.map((s, i) => {
                const isDone = done.includes(i), isAct = step === i && !isDone;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 20px", borderBottom: i < PIPE.length - 1 ? "1px solid var(--border)" : "none", opacity: step < i && !isDone ? 0.22 : 1, transition: "opacity 0.35s,background 0.2s", background: isAct ? "var(--primary-bg)" : "transparent" }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s",
                      background: isDone ? "rgba(16, 185, 129, 0.1)" : isAct ? "var(--primary-bg)" : "rgba(57, 62, 70,0.04)",
                      border: `1px solid ${isDone ? "rgba(16, 185, 129, 0.2)" : isAct ? "rgba(57, 62, 70, 0.3)" : "var(--border)"}`
                    }}>
                      {isDone ? <span style={{ color: "var(--green)", fontSize: 14, fontWeight: 700 }}>✓</span> : isAct ? <span className="spinner" /> : <span style={{ color: "var(--text3)", fontSize: 12, fontWeight: 600 }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "var(--green)" : isAct ? "var(--primary)" : "var(--text2)", transition: "color 0.3s" }}>{s.label}</div>
                      <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>{s.desc}</div>
                    </div>
                    {isAct && (
                      <div style={{ width: 64, height: 3, background: "rgba(57, 62, 70,0.05)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ width: "50%", height: "100%", background: "var(--primary)", borderRadius: 99, animation: "shimmer-move 1.1s linear infinite", boxShadow: "0 0 8px var(--primary)" }} />
                      </div>
                    )}
                    {isDone && <span style={{ color: "var(--green)", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>Done</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MAIN VIEWS ── */}
        {phase === "main" && (
          <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 28px 60px" }}>

            {/* ── DASHBOARD ── */}
            {tab === "dashboard" && (
              <div className="fade-up">
                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr) 100px 86px", gap: 14, marginBottom: 24 }}>
                  <Stat label="Total Scanned" val={28} color="var(--primary)" sub="npm packages" />
                  <Stat label="Critical Vulns" val={crit} color="var(--red)" sub="Immediate action" />
                  <Stat label="Need Upgrade" val={upg} color="var(--orange)" sub="Outdated versions" />
                  <Stat label="Abandoned Libs" val={aband} color="var(--amber)" sub="No maintainer" />
                  <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <GaugeArc value={risk} size={76} />
                  </div>
                  <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 0" }}>
                    <div style={{ fontFamily: "var(--head)", fontSize: 44, fontWeight: 800, color: gc, lineHeight: 1, textShadow: `0 0 24px ${gc}55` }}>{grade}</div>
                    <div className="label" style={{ marginTop: 6 }}>Grade</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, marginBottom: 20 }}>
                  {/* Critical list */}
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 8px var(--red)", flexShrink: 0 }} />
                        Critical Vulnerabilities
                      </h3>
                      <Chip sev="CRITICAL" />
                    </div>
                    <div>
                      {DEPS.filter(d => d.sev === "CRITICAL").map(d => (
                        <div key={d.id} onClick={() => setSel(d)} className="card-hoverable" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name} <span style={{ color: "var(--text3)", fontWeight: 400 }}>v{d.version}</span></div>
                            <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 3, fontFamily: "var(--mono)" }}>{d.cves.join(" · ")}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)", fontFamily: "var(--head)", lineHeight: 1 }}>{d.score}</div>
                            <div style={{ color: "var(--text3)", fontSize: 10, marginTop: 2 }}>CVSS</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Severity breakdown */}
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Severity Breakdown</h3>
                    </div>
                    <div style={{ padding: "20px" }}>
                      {["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"].map(s => {
                        const cnt = DEPS.filter(d => d.sev === s).length, pct = (cnt / 28) * 100, c = SEV[s];
                        return (
                          <div key={s} style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <Chip sev={s} />
                              <span style={{ color: "var(--text2)", fontSize: 12, fontWeight: 500 }}>{cnt}</span>
                            </div>
                            <div style={{ background: "rgba(57, 62, 70,0.04)", borderRadius: 99, height: 5, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: c.color, borderRadius: 99, boxShadow: `0 0 6px ${c.color}66`, transition: "width 1.2s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Abandoned */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Abandoned &amp; Inactive Libraries</h3>
                    <span className="tag" style={{ background: "rgba(240,165,0,0.1)", color: "var(--amber)", border: "1px solid rgba(240,165,0,0.25)" }}>{DEPS.filter(d => d.maint !== "Active").length} found</span>
                  </div>
                  <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 10 }}>
                    {DEPS.filter(d => d.maint !== "Active").map(d => (
                      <div key={d.id} onClick={() => setSel(d)} className="card"
                        style={{ padding: "14px 16px", cursor: "pointer", border: `1px solid ${d.maint === "Abandoned" ? "rgba(240,165,0,0.25)" : "var(--border)"}`, transition: "all 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = d.maint === "Abandoned" ? "rgba(240,165,0,0.45)" : "var(--border2)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = d.maint === "Abandoned" ? "rgba(240,165,0,0.25)" : "var(--border)"}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                          <span className="tag" style={{ fontSize: 10, padding: "2px 7px", background: d.maint === "Abandoned" ? "rgba(240,165,0,0.1)" : "rgba(57, 62, 70,0.05)", color: d.maint === "Abandoned" ? "var(--amber)" : "var(--text3)", border: `1px solid ${d.maint === "Abandoned" ? "rgba(240,165,0,0.25)" : "var(--border)"}` }}>{d.maint}</span>
                        </div>
                        <div style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--mono)", marginBottom: 8 }}>v{d.version}</div>
                        <Chip sev={d.sev} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── GRAPH ── */}
            {tab === "graph" && (
              <div className="fade-up">
                <div style={{ marginBottom: 22 }}>
                  <h2 className="section-title">Dependency Graph</h2>
                  <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 5 }}>Force-directed visualization — click any node to inspect · {DEPS.length} packages mapped</p>
                </div>
                <Graph deps={DEPS} onPick={setSel} />
              </div>
            )}

            {/* ── VULNS ── */}
            {tab === "vulns" && (
              <div className="fade-up">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 className="section-title">Vulnerability Report</h2>
                    <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 5 }}>Click column headers to sort · Click a row to inspect</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["All", "CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"].map(f => {
                      const c = SEV[f], active = filt === f;
                      return (
                        <button key={f} className="btn" onClick={() => setFilt(f)}
                          style={{ padding: "6px 13px", fontSize: 11, fontWeight: 600, background: active ? (c ? c.bg : "var(--primary-bg)") : "rgba(57, 62, 70,0.04)", border: `1px solid ${active ? (c ? c.border : "rgba(57, 62, 70, 0.35)") : "var(--border)"}`, color: active ? (c ? c.color : "var(--primary)") : "var(--text3)" }}>
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          {[["name", "Library"], ["version", "Version"], ["latest", "Latest"], ["sev", "Severity"], ["score", "Danger"], ["vulns", "CVEs"], ["updated", "Updated"], ["maint", "Maintainer"]].map(([c, l]) => (
                            <th key={c} onClick={() => doSort(c)}>{l} <span style={{ opacity: 0.4 }}>{sCol === c ? (sDir === "asc" ? "↑" : "↓") : "↕"}</span></th>
                          ))}
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(d => (
                          <tr key={d.id} onClick={() => setSel(d)} style={{ cursor: "pointer" }}>
                            <td><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                            <td><code style={{ color: "var(--text3)", fontSize: 12, fontFamily: "var(--mono)" }}>{d.version}</code></td>
                            <td><code style={{ color: d.version !== d.latest ? "var(--green)" : "var(--text3)", fontSize: 12, fontFamily: "var(--mono)" }}>{d.latest}</code></td>
                            <td><Chip sev={d.sev} /></td>
                            <td style={{ minWidth: 130 }}><Bar score={d.score} /></td>
                            <td><span style={{ color: d.vulns > 0 ? "#f07070" : "var(--green)", fontWeight: 600 }}>{d.vulns}</span></td>
                            <td style={{ color: "var(--text3)", fontSize: 12 }}>{d.updated}</td>
                            <td>
                              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: d.maint === "Active" ? "var(--green)" : d.maint === "Abandoned" ? "var(--amber)" : "var(--text3)", flexShrink: 0 }} />
                                <span style={{ color: d.maint === "Active" ? "var(--green)" : d.maint === "Abandoned" ? "var(--amber)" : "var(--text3)" }}>{d.maint}</span>
                              </span>
                            </td>
                            <td>
                              {d.fix
                                ? <button className="btn btn-cyan" onClick={e => { e.stopPropagation(); setSel(d); }} style={{ padding: "4px 11px", fontSize: 12 }}>Inspect →</button>
                                : <span style={{ color: "var(--green)", fontSize: 12, fontWeight: 600 }}>✓ Safe</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── FIXES ── */}
            {tab === "fixes" && (
              <div className="fade-up">
                <div style={{ marginBottom: 24 }}>
                  <h2 className="section-title">Fix Recommendations</h2>
                  <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 5 }}>Prioritized by CVSS score — address these in order for maximum security impact</p>
                </div>
                {fixes.map((d, i) => {
                  const eff = d.effort === "Easy" ? "var(--green)" : d.effort === "Medium" ? "var(--yellow)" : "#f03d3d";
                  return (
                    <div key={d.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${SEV[d.sev]?.color || "var(--border)"}`, overflow: "visible" }}>
                      <div style={{ padding: "18px 22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ fontFamily: "var(--head)", fontSize: 26, fontWeight: 800, color: "var(--text3)", minWidth: 32, lineHeight: 1 }}>#{i + 1}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{d.name}</div>
                              <div style={{ fontSize: 13, marginTop: 3, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                                <span style={{ color: "#f07070" }}>{d.version}</span>
                                <span style={{ margin: "0 8px", color: "var(--text3)" }}>→</span>
                                <span style={{ color: "var(--green)" }}>{d.fixv}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Chip sev={d.sev} />
                            <span className="tag" style={{ background: `rgba(0,0,0,0.2)`, color: eff, border: `1px solid ${eff}44` }}>{d.effort}</span>
                            <span style={{ fontFamily: "var(--head)", fontSize: 20, fontWeight: 800, color: SEV[d.sev]?.color, lineHeight: 1 }}>{d.score.toFixed(1)}</span>
                          </div>
                        </div>

                        <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.65, marginBottom: 14 }}>{d.desc}</p>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--bg2)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: 12, padding: "11px 14px" }}>
                          <code style={{ flex: 1, color: "var(--green)", fontSize: 13, fontFamily: "var(--mono)", wordBreak: "break-all" }}>{d.fix}</code>
                          <Copy text={d.fix} size="md" />
                        </div>

                        {d.cves.length > 0 && (
                          <div style={{ marginTop: 11, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {d.cves.map(c => <span key={c} style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--red)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontFamily: "var(--mono)" }}>{c}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── AI INSIGHTS ── */}
            {tab === "ai" && (
              <div className="fade-up" style={{ maxWidth: 820 }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 className="section-title">AI Security Insights</h2>
                  <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 5 }}>Gemini 2.0 Flash analyzes your scan results and provides expert remediation guidance</p>
                </div>

                {/* API key */}
                <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                  <label className="label" style={{ display: "block", marginBottom: 10 }}>Gemini API Key</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="AIza... — paste your key" />
                    <span style={{ color: key ? "var(--green)" : "var(--text3)", fontSize: 12, whiteSpace: "nowrap", fontWeight: 500 }}>
                      {key ? "✓ Set" : "Not set"}
                    </span>
                  </div>
                </div>

                {/* Quick prompts */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {["What's most critical?", "Explain Log4Shell", "Give me a fix plan"].map(p => (
                    <button key={p} className="btn btn-ghost" onClick={() => { setQ(p); ask(p); }}
                      style={{ fontSize: 12, color: "var(--primary)", borderColor: "rgba(57, 62, 70, 0.25)", background: "var(--primary-bg)" }}>
                      ✧ {p}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask(q)}
                      placeholder="Ask a security question, e.g. 'What should I patch first?'" />
                    <button className="btn btn-cyan" onClick={() => ask(q)} disabled={aLoad} style={{ padding: "11px 20px", flexShrink: 0 }}>
                      {aLoad ? <span className="spinner" /> : "Ask →"}
                    </button>
                  </div>
                </div>

                {/* Response */}
                {(resp || aErr || aLoad) && (
                  <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,rgba(57, 62, 70, 0.2),var(--primary-bg))", border: "1px solid rgba(57, 62, 70, 0.2)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>AI Security Expert</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Gemini 2.0 Flash</div>
                        </div>
                      </div>
                      {resp && <button className="btn btn-ghost" onClick={() => { setResp(""); setQ(""); setAErr(""); }} style={{ fontSize: 12 }}>New question →</button>}
                    </div>
                    {aLoad && <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text2)", padding: "12px 0" }}><span className="spinner" /><span style={{ fontSize: 13 }}>Analyzing vulnerability data…</span></div>}
                    {aErr && <div style={{ color: "var(--red)", fontSize: 13, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 9, padding: "13px 16px" }}>{aErr}</div>}
                    {resp && <div style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}><Typewriter text={resp} speed={11} /></div>}
                  </div>
                )}

                {!resp && !aLoad && !aErr && (
                  <div style={{ textAlign: "center", padding: "52px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.3 }}>✦</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Add your API key and ask a question to get started</div>
                    <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>Free key available at aistudio.google.com</div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* DETAIL PANEL */}
      {sel && <Panel dep={sel} onClose={() => setSel(null)} />}
    </>
  );
}
