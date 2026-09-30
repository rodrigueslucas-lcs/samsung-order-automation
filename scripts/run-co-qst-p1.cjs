const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../governance/smb-qst-architecture.json");
const { testTitles } = require("../utils/qstS1Implementation");
const { getCoQstConfig } = require("../config/markets/co");

const listOnly = process.argv.includes("--list");
const config = getCoQstConfig();
const root = path.resolve("tests/markets/co/qst/base-store");
const official = architecture.markets.CO.cases.filter((item) => item.store === "BS");
if (official.length !== 29) throw new Error(`CO Base Store inventory drift: expected 29 official IDs, found ${official.length}.`);
const ids = official.map(({id}) => id).sort();
const requested = String(process.env.CO_QST_TARGET_IDS || "").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean);
const unknown = requested.filter(id=>!ids.includes(id));
if (unknown.length) throw new Error(`Unknown CO_QST_TARGET_IDS: ${unknown.join(", ")}.`);
const executionIds = requested.length ? requested : ids;
function specs(dir){ if(!fs.existsSync(dir)) return []; return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?specs(path.join(dir,e.name)):e.name.endsWith(".spec.js")?[path.join(dir,e.name)]:[]); }
const titles=specs(root).flatMap(file=>testTitles(fs.readFileSync(file,"utf8")));
const represented=new Set(titles.map(t=>t.match(/SAM-\d+/)?.[0]).filter(id=>ids.includes(id)));
const executable=new Set(titles.filter(t=>!/@not-run\b/i.test(t)).map(t=>t.match(/SAM-\d+/)?.[0]).filter(id=>ids.includes(id)));
console.log(`[co-qst] Official CO ${config.environment} Base Store P1 scope: ${ids.length} TCs.`);
if(requested.length) console.log(`[co-qst] Targeted execution: ${executionIds.join(", ")}.`);
console.log(`[co-qst] Represented: ${represented.size}/${ids.length}. Executable: ${executable.size}/${ids.length}.`);
const missing=ids.filter(id=>!represented.has(id));
if(missing.length){ console.error(`[co-qst] Missing canonical implementations: ${missing.join(", ")}`); process.exit(1); }
const cli=path.resolve("node_modules/@playwright/test/cli.js");
const args=[cli,"test","tests/markets/co/qst/base-store","--project=chromium","--workers=1","--retries=0","--grep",`(?:${executionIds.join("|")})\\b`];
if(listOnly) args.push("--list","--reporter=list");
else if(process.env.MX_QST_HEADLESS!=="1") args.splice(4,0,"--headed");
const result=spawnSync(process.execPath,args,{stdio:"inherit",env:{...process.env,CO_STOREFRONT_URL:config.baseUrl.href,TEST_ENV:config.environmentLabel,TEST_MARKET:"CO",TEST_STORE:"BASE_STORE",TEST_SUITE:"P1/QST"}});
process.exit(result.status ?? 1);
