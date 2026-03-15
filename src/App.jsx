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

  @keyframes breathe {
    0%, 100% { stroke-width: 1.5; filter: drop-shadow(0 0 4px currentColor); }
    50%       { stroke-width: 3.5; filter: drop-shadow(0 0 12px currentColor); }
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


function GaugeArc({ value, size = 100 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  const c = value >= 75 ? "var(--teal)" : value >= 55 ? "var(--amber)" : value >= 35 ? "var(--orange)" : "var(--red)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg2)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: value > 50 ? `drop-shadow(0 0 4px ${c}88)` : 'none', transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={c} fontSize={size / 4} fontFamily="JetBrains Mono" fontWeight="700">
          <CountUp n={value} />
        </text>
      </svg>
      <div className="label" style={{ fontSize: 10, opacity: 0.8 }}>Security Score</div>
    </div>
  );
}

// ─── GRAPH ────────────────────────────────────────────────────────────────────
function Graph({ deps, onPick }) {
  const [pos, setPos] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hov, setHov] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState(null); // null = show all
  const dragStart = useRef(null);
  const posR = useRef([]), velR = useRef([]), raf = useRef(null);

  const W = 1200, H = 700;
  const n = deps.length;

  // Uniform node radius based on count — keeps all nodes same size for clarity
  const R = n > 300 ? 8 : n > 150 ? 11 : n > 60 ? 14 : n > 25 ? 17 : 20;
  // Minimum gap between node edges
  const gap = R * 0.8;
  // Minimum center-to-center distance
  const minDist = (R * 2) + gap;

  useEffect(() => {
    if (!n) return;

    // ── Hemisphere / dome placement ──
    // Fibonacci sphere → project top hemisphere onto 2D ellipse
    // This distributes points evenly over a dome shape
    const cx = W / 2, cy = H / 2;
    const radiusX = W / 2 - R - 20; // fill horizontal
    const radiusY = H / 2 - R - 20; // fill vertical

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const initPos = new Array(n);

    for (let i = 0; i < n; i++) {
      // Fibonacci sphere: distribute points on unit sphere
      const theta = 2 * Math.PI * i / goldenRatio; // azimuthal angle
      const phi = Math.acos(1 - (i + 0.5) / n);    // polar angle (0 to π)

      // Only use top hemisphere (phi from 0 to π/2) for dome effect
      const phiHemi = phi * 0.5; // compress to hemisphere

      // Project 3D sphere point to 2D
      // x = sin(phi)*cos(theta), y = sin(phi)*sin(theta), z = cos(phi) [unused]
      const px = Math.sin(phiHemi) * Math.cos(theta);
      const py = Math.sin(phiHemi) * Math.sin(theta);

      initPos[i] = {
        x: cx + px * radiusX,
        y: cy + py * radiusY,
      };
    }

    posR.current = initPos;
    velR.current = deps.map(() => ({ vx: 0, vy: 0 }));

    // ── Force simulation — only repulsion + boundary, no gravity pulling to center ──
    const repStr = minDist * minDist * 1.5;
    const totalFrames = Math.min(250, 80 + n);

    let frame = 0;
    const run = () => {
      const p = posR.current, v = velR.current;
      const cooling = Math.max(0.15, 1 - frame / totalFrames);

      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0;

        // Repulsion between nodes
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2) || 0.5;
          if (d < minDist * 3) { // only nearby nodes for performance
            const force = repStr / Math.max(d2, minDist * minDist * 0.1);
            fx += (dx / d) * force;
            fy += (dy / d) * force;
          }
        }

        // Very gentle pull toward center to prevent drift
        fx += (cx - p[i].x) * 0.001;
        fy += (cy - p[i].y) * 0.001;

        // Elliptical boundary force — keep nodes inside the dome
        const ex = (p[i].x - cx) / radiusX;
        const ey = (p[i].y - cy) / radiusY;
        const ed = ex * ex + ey * ey;
        if (ed > 0.85) {
          const pushBack = (ed - 0.85) * 8;
          fx -= ex * pushBack * radiusX;
          fy -= ey * pushBack * radiusY;
        }

        v[i].vx = (v[i].vx * 0.6 + fx * cooling);
        v[i].vy = (v[i].vy * 0.6 + fy * cooling);

        const spd = Math.sqrt(v[i].vx ** 2 + v[i].vy ** 2);
        if (spd > 4) { v[i].vx *= 4 / spd; v[i].vy *= 4 / spd; }

        p[i].x += v[i].vx;
        p[i].y += v[i].vy;

        // Hard clamp
        p[i].x = Math.max(R + 5, Math.min(W - R - 5, p[i].x));
        p[i].y = Math.max(R + 5, Math.min(H - R - 5, p[i].y));
      }

      frame++;
      if (frame % 2 === 0) setPos(p.map(pt => ({ ...pt })));
      if (frame < totalFrames) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    return () => cancelAnimationFrame(raf.current);
  }, [deps]);

  // Scroll-zoom
  const onWheel = e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001))); };
  // Drag-pan
  const onMD = e => { setDragging(true); dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; };
  const onMM = e => { if (dragging && dragStart.current) setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); };
  const onMU = () => setDragging(false);

  const hovDep = hov !== null ? deps.find(d => d.id === hov) : null;
  const hovIdx = hov !== null ? deps.findIndex(d => d.id === hov) : -1;

  // How many chars fit inside the node circle
  const maxChars = Math.max(0, Math.floor((R * 2 - 4) / 5));

  // Which nodes match the current search + severity filter
  const isMatch = (d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchSev = !sevFilter || d.sev === sevFilter;
    return matchSearch && matchSev;
  };
  const matchCount = deps.filter(isMatch).length;

  return (
    <div>
      {/* Toolbar row 1: zoom + search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.min(z + 0.2, 3))} style={{ padding: "6px 14px", fontSize: 12 }}>＋ Zoom In</button>
        <button className="btn btn-ghost" onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))} style={{ padding: "6px 14px", fontSize: 12 }}>－ Zoom Out</button>
        <button className="btn btn-ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ padding: "6px 14px", fontSize: 12 }}>↺ Reset</button>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{Math.round(zoom * 100)}%</span>
        <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--text3)", pointerEvents: "none" }}>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search package..."
            style={{ padding: "7px 12px 7px 30px", fontSize: 12, width: 200, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text)", fontFamily: "var(--mono)", outline: "none" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 6, background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 14, padding: 2 }}>✕</button>}
        </div>
      </div>
      {/* Toolbar row 2: severity filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setSevFilter(null)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, border: !sevFilter ? "1.5px solid var(--primary)" : "1px solid var(--border)", background: !sevFilter ? "var(--primary-bg)" : "transparent", color: !sevFilter ? "var(--text)" : "var(--text3)", fontSize: 12, cursor: "pointer", fontWeight: !sevFilter ? 600 : 400, fontFamily: "var(--ui)", transition: "all 0.15s" }}>
          All <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>({n})</span>
        </button>
        {[["var(--red)", "CRITICAL", "Critical"], ["var(--orange)", "HIGH", "High"], ["var(--yellow)", "MEDIUM", "Medium"], ["var(--amber)", "LOW", "Low"], ["var(--teal)", "SAFE", "Safe"]].map(([c, sev, label]) => {
          const cnt = deps.filter(d => d.sev === sev).length;
          const active = sevFilter === sev;
          return (
            <button key={sev} onClick={() => setSevFilter(active ? null : sev)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: active ? `1.5px solid ${c}` : "1px solid var(--border)", background: active ? `color-mix(in srgb, ${c} 12%, transparent)` : "transparent", color: active ? c : "var(--text3)", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400, fontFamily: "var(--ui)", transition: "all 0.15s" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: active ? `0 0 6px ${c}` : `0 0 3px ${c}44`, flexShrink: 0 }} />
              {label} <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>({cnt})</span>
            </button>
          );
        })}
        {(search || sevFilter) && <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)", marginLeft: 8 }}>{matchCount} of {n} shown</span>}
      </div>
      <div style={{ border: "1px solid var(--border2)", borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.35)", boxShadow: "inset 0 1px 0 rgba(57,62,70,0.04)" }}
        onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", cursor: dragging ? "grabbing" : "grab", display: "block" }} onClick={() => setHov(null)}>
          <defs>
            <radialGradient id="gbg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#0f1729" />
              <stop offset="100%" stopColor="#060b18" />
            </radialGradient>
            {/* Clip each node's text to its circle */}
            {deps.map((d, i) => pos[i] ? (
              <clipPath key={`cp${d.id}`} id={`clip-${d.id}`}>
                <circle cx={pos[i].x} cy={pos[i].y} r={R - 2} />
              </clipPath>
            ) : null)}
          </defs>
          <rect width={W} height={H} fill="url(#gbg)" />
          {/* Subtle grid */}
          {[...Array(8)].map((_, i) => <line key={`h${i}`} x1={0} y1={(i / 7) * H} x2={W} y2={(i / 7) * H} stroke="rgba(57,62,70,0.018)" strokeWidth={0.5} />)}
          {[...Array(13)].map((_, i) => <line key={`v${i}`} x1={(i / 12) * W} y1={0} x2={(i / 12) * W} y2={H} stroke="rgba(57,62,70,0.018)" strokeWidth={0.5} />)}
          {/* Dome outline (decorative ellipse) */}
          <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 15} ry={H / 2 - 15} fill="none" stroke="rgba(57,62,70,0.03)" strokeWidth={1} strokeDasharray="6 8" />
          <ellipse cx={W / 2} cy={H / 2} rx={W / 3} ry={H / 3} fill="none" stroke="rgba(57,62,70,0.02)" strokeWidth={0.5} strokeDasharray="4 8" />

          <g transform={`translate(${W / 2 * (1 - zoom) + pan.x * 0.5},${H / 2 * (1 - zoom) + pan.y * 0.5}) scale(${zoom})`}>
            {/* Edges — subtle connectors between neighboring nodes */}
            {deps.map((d, i) => {
              if (!pos[i]) return null;
              const next = deps[i + 1];
              if (!next) return null;
              const ni = i + 1;
              if (!pos[ni]) return null;
              const isActive = hov === d.id || hov === next.id;
              return <line key={`e${d.id}`} x1={pos[i].x} y1={pos[i].y} x2={pos[ni].x} y2={pos[ni].y}
                stroke={isActive ? "rgba(100,160,220,0.25)" : "rgba(57,62,70,0.02)"}
                strokeWidth={isActive ? 1.2 : 0.4}
                style={{ transition: "stroke 0.2s, stroke-width 0.2s" }} />;
            })}
            {/* Nodes */}
            {deps.map((d, i) => {
              if (!pos[i]) return null;
              const { x, y } = pos[i], isH = hov === d.id;
              const matched = isMatch(d);
              const cr = isH ? R + 3 : R;
              const isSearchHit = search && d.name.toLowerCase().includes(search.toLowerCase());
              return (
                <g key={d.id} onClick={e => { e.stopPropagation(); onPick(d); }}
                  onMouseEnter={() => setHov(d.id)} onMouseLeave={() => setHov(null)}
                  style={{ cursor: "pointer", opacity: matched ? 1 : 0.12, transition: "opacity 0.25s ease" }}>
                  {isH && <circle cx={x} cy={y} r={R + 12} fill="none" stroke={d.col} strokeWidth={1} strokeOpacity={0.25} />}
                  {isH && <circle cx={x} cy={y} r={R + 7} fill="none" stroke={d.col} strokeWidth={1} strokeOpacity={0.12} />}
                  <circle cx={x} cy={y} r={cr}
                    fill={`color-mix(in srgb, ${d.col} 18%, transparent)`}
                    stroke={d.col} strokeWidth={isH ? 2.5 : isSearchHit ? 2 : 1.5}
                    style={{
                      color: d.col,
                      filter: isH ? `drop-shadow(0 0 14px ${d.col})` : isSearchHit ? `drop-shadow(0 0 8px ${d.col})` : `drop-shadow(0 0 3px color-mix(in srgb, ${d.col} 40%, transparent))`,
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                      ...(isSearchHit && !isH ? { animation: "breathe 2s ease-in-out infinite" } : {})
                    }} />
                  {/* Label — clipped to stay inside the circle */}
                  {maxChars >= 2 && (
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={d.col}
                      fontSize={Math.max(5, Math.min(8, R * 0.7))} fontFamily="JetBrains Mono" fontWeight="700"
                      clipPath={`url(#clip-${d.id})`}
                      style={{ pointerEvents: "none" }}>
                      {d.name.length > maxChars ? d.name.slice(0, maxChars) : d.name}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Hover tooltip */}
            {hov !== null && hovIdx >= 0 && pos[hovIdx] && (() => {
              const { x, y } = pos[hovIdx], dep = hovDep;
              const nameLen = dep.name.length;
              const tw = Math.max(160, Math.min(280, nameLen * 8.5 + 28)), th = 74;
              const tx = x + R + 10 + tw > W ? x - tw - R - 5 : x + R + 8;
              const tyRaw = y - th / 2;
              const ty = Math.max(4, Math.min(H - th - 4, tyRaw));
              const displayName = dep.name.length > 28 ? dep.name.slice(0, 26) + "…" : dep.name;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={tx} y={ty} width={tw} height={th} rx={9} fill="var(--bg2)" stroke={dep.col} strokeWidth={1.5} style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.6))" }} />
                  <text x={tx + 12} y={ty + 20} fill={dep.col} fontSize={13} fontFamily="JetBrains Mono" fontWeight="700">{displayName}</text>
                  <text x={tx + 12} y={ty + 38} fill="var(--text2)" fontSize={11} fontFamily="Inter">v{dep.version}</text>
                  <text x={tx + 12} y={ty + 55} fill="var(--text2)" fontSize={11} fontFamily="JetBrains Mono">CVSS {dep.score.toFixed(1)} · {dep.sev}</text>
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
  const [inputTab, setInputTab] = useState("url"); // url | file
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState([]);
  const [url, setUrl] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [sel, setSel] = useState(null);
  const [filt, setFilt] = useState("All");
  const [sCol, setSCol] = useState("score");
  const [sDir, setSDir] = useState("desc");

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "graph", label: "Dependency Graph", icon: "⬡" },
    { id: "vulns", label: "Vulnerabilities", icon: "⚑" },
    { id: "fixes", label: "Fix Plan", icon: "✦" },
  ];

  const API = "http://localhost:5000";

  const runPipeline = async (backendPromise) => {
    setPhase("pipeline"); setStep(-1); setDone([]);
    // Run through steps 1 to 7
    for (let i = 0; i < PIPE.length - 1; i++) {
      await new Promise(r => setTimeout(r, 120)); setStep(i);
      await new Promise(r => setTimeout(r, 600));
      setDone(p => [...p, i]);
    }
    // Final step: wait for BOTH the timing and the backend to be ready
    setStep(PIPE.length - 1);
    await Promise.all([
      new Promise(r => setTimeout(r, 800)),
      backendPromise
    ]);
    setDone(p => [...p, PIPE.length - 1]);
    await new Promise(r => setTimeout(r, 400));
  };

  const startURLScan = async () => {
    if (!url.trim()) return;
    setScanError("");
    const fetchPromise = fetch(`${API}/api/scan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: url }),
    }).then(r => r.json()).catch(err => ({ error: err.message }));

    await runPipeline(fetchPromise);
    const result = await fetchPromise;

    if (result.error) { setScanError(result.error); setPhase("input"); return; }
    if (Array.isArray(result)) { setScanResult(result); setPhase("main"); setTab("dashboard"); }
    else { setScanError("Unexpected response from server."); setPhase("input"); }
  };

  const startFileScan = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      let content;
      try { content = JSON.parse(e.target.result); } catch (_) { setScanError("Invalid JSON file"); return; }
      setScanError("");
      
      const fetchPromise = fetch(`${API}/api/scan-file`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content }),
      }).then(r => r.json()).catch(err => ({ error: err.message }));

      await runPipeline(fetchPromise);
      const result = await fetchPromise;

      if (result.error) { setScanError(result.error); setPhase("input"); return; }
      if (Array.isArray(result)) { setScanResult(result); setPhase("main"); setTab("dashboard"); }
      else { setScanError("Unexpected response from server."); setPhase("input"); }
    };
    reader.readAsText(file);
  };

  // Use real scan data when available, fallback to mock DEPS
  const activeDeps = scanResult || DEPS;
  const total = activeDeps.length || 1;
  const crit = activeDeps.filter(d => d.sev === "CRITICAL").length;
  const high = activeDeps.filter(d => d.sev === "HIGH").length;
  const med = activeDeps.filter(d => d.sev === "MEDIUM").length;
  const low = activeDeps.filter(d => d.sev === "LOW").length;

  const upg = activeDeps.filter(d => d.version !== d.fixv && d.sev !== "SAFE").length;
  const aband = activeDeps.filter(d => d.maint === "Abandoned").length;

  // New Scoring: 100 is perfect, subtract for vulnerabilities
  // Every critical is -15, high is -8, med is -3, low is -1. Max penalty balanced by total deps.
  const penalty = (crit * 20 + high * 10 + med * 4 + low * 1);
  const risk = Math.max(0, 100 - penalty); 

  const grade = risk >= 90 ? "A" : risk >= 75 ? "B" : risk >= 55 ? "C" : risk >= 35 ? "D" : "F";
  const gc = risk >= 75 ? "var(--teal)" : risk >= 55 ? "var(--amber)" : risk >= 35 ? "var(--orange)" : "var(--red)";

  const rows = [...activeDeps]
    .filter(d => filt === "All" || d.sev === filt)
    .sort((a, b) => { let av = a[sCol], bv = b[sCol]; if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); } return sDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });

  const doSort = c => { if (sCol === c) setSDir(d => d === "asc" ? "desc" : "asc"); else { setSCol(c); setSDir("desc"); } };


  const fixes = activeDeps.filter(d => d.sev !== "SAFE" && d.fix).sort((a, b) => b.score - a.score);

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

  const goHome = () => {
    setPhase("input");
    setScanResult(null);
    setScanError("");
    setTab("dashboard");
    setSel(null);
    setUrl("");
  };

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
        <div onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 48, flexShrink: 0, cursor: "pointer" }}>
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
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>{url || "scanned project"}</span>
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
              {/* Tab Switcher */}
              <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
                {[{ id: "url", label: "🔗 GitHub URL" }, { id: "file", label: "📦 Upload File" }].map(t => (
                  <button key={t.id} onClick={() => setInputTab(t.id)}
                    style={{ flex: 1, background: inputTab === t.id ? "var(--bg)" : "transparent", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", color: inputTab === t.id ? "var(--text)" : "var(--text3)", fontWeight: 600, fontSize: 13, fontFamily: "var(--ui)", transition: "all 0.2s", boxShadow: inputTab === t.id ? "var(--shadow-sm)" : "none" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {scanError && <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "var(--red)", fontSize: 13 }}>{scanError}</div>}

              {inputTab === "url" ? (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="label" style={{ display: "block", marginBottom: 10 }}>GitHub Repository URL</label>
                    <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
                  </div>
                  <button onClick={startURLScan} style={{
                    width: "100%", background: "linear-gradient(135deg,rgba(57, 62, 70, 0.15),rgba(57, 62, 70, 0.15))",
                    border: "1px solid rgba(57, 62, 70, 0.3)", borderRadius: 11, padding: "15px",
                    color: "var(--primary)", fontSize: 14, fontFamily: "var(--ui)", fontWeight: 600, cursor: "pointer",
                    animation: "glow-pulse 2.5s ease-in-out infinite", transition: "all 0.2s", letterSpacing: "0.02em",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10
                  }}>
                    <span style={{ fontSize: 16 }}>✦</span> Analyze Dependencies
                  </button>
                </div>
              ) : (
                <label onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(57, 62, 70, 0.4)"; e.currentTarget.style.background = "var(--primary-bg)"; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "transparent"; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "transparent"; const file = e.dataTransfer.files[0]; if (file) startFileScan(file); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px dashed var(--border2)", borderRadius: 12, padding: "40px 20px", cursor: "pointer", gap: 10, transition: "all 0.2s", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, background: "var(--primary-bg)", border: "1px solid rgba(57, 62, 70, 0.15)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📦</div>
                  <div>
                    <div style={{ color: "var(--text2)", fontSize: 14, fontWeight: 600 }}>Drop your manifest file here</div>
                    <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>package.json · package-lock.json</div>
                  </div>
                  <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 4 }}>or click to browse</div>
                  <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => { const file = e.target.files[0]; if (file) startFileScan(file); }} />
                </label>
              )}
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
                  <Stat label="Total Scanned" val={activeDeps.length} color="var(--primary)" sub="npm packages" />
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
                      {activeDeps.filter(d => d.sev === "CRITICAL").map(d => (
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
                        const cnt = activeDeps.filter(d => d.sev === s).length, pct = activeDeps.length ? (cnt / activeDeps.length) * 100 : 0, c = SEV[s];
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
                    <span className="tag" style={{ background: "rgba(240,165,0,0.1)", color: "var(--amber)", border: "1px solid rgba(240,165,0,0.25)" }}>{activeDeps.filter(d => d.maint !== "Active").length} found</span>
                  </div>
                  <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 10 }}>
                    {activeDeps.filter(d => d.maint !== "Active").map(d => (
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
                  <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 5 }}>Force-directed visualization — click any node to inspect · {activeDeps.length} packages mapped</p>
                </div>
                <Graph deps={activeDeps} onPick={setSel} />
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


          </div>
        )}
      </main>

      {/* DETAIL PANEL */}
      {sel && <Panel dep={sel} onClose={() => setSel(null)} />}
    </>
  );
}
