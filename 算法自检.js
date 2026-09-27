/* 从 HTML 中抽取 ==LOGIC_START/END== 之间的算法代码，独立跑正确性验证 */
/* 用法： node 算法自检.js [目标HTML]     默认 身份标识生成器.html */
const fs = require("fs");
const path = require("path");

const DEFAULT = fs.existsSync(path.join(__dirname, "index-pro.html")) ? "index-pro.html" : "身份标识生成器.html";
const target = process.argv[2] || DEFAULT;
const html = fs.readFileSync(path.isAbsolute(target) ? target : path.join(__dirname, target), "utf8");
let s = html.indexOf("// ==LOGIC_START==");
let e = html.indexOf("// ==LOGIC_END==");
if (s < 0 || e < 0) {   /* 极简版使用 LITE_ 前缀标记 */
  s = html.indexOf("// ==LITE_LOGIC_START==");
  e = html.indexOf("// ==LITE_LOGIC_END==");
}
if (s < 0 || e < 0) { console.error("未找到逻辑代码标记"); process.exit(1); }
const code = html.slice(s, e);

const names = ["genIdCard","genPassport","genHKMPermit","genTwnPermit","genUSCI","genPrPermit",
  "validateIdCard","validatePassport","validateHKM","validateTWN","validateUSCI","validatePrResident",
  "matchAll","idCheckDigit","orgCheckDigit","usciCheckDigit","REGIONS","USCI_DEPT","COUNTRY_MAP","PR_COUNTRY_MAP","PR_PROVS"];
const api = new Function(code + "\nreturn {" + names.join(",") + "};")();

let pass = 0, fail = 0;
const problems = [];
function t(name, cond, extra) {
  if (cond) { pass++; } else { fail++; problems.push(name + (extra ? "  → " + extra : "")); }
}
function L(n) { return "（" + n + "）"; }

console.log("=== 1. 已知真实 / 权威样例 ===");
// GB 11643-1999 附录示范号码（110105 北京市朝阳区 / 1949-12-31 / 男）
const knownID = ["11010519491231002X"];
knownID.forEach(n => {
  const r = api.validateIdCard(n);
  t("身份证样例 " + n, r.ok, "level=" + r.level + " " + r.summary);
  console.log("  " + n + "  → " + r.level + " / " + r.summary);
});

// 真实在册企业统一社会信用代码
["91440300708461136T", "91110108551385082Q", "91350100M000100Y43"].forEach(n => {
  const r = api.validateUSCI(n);
  t("统一代码样例 " + n, r.ok, "level=" + r.level + " " + r.summary);
  console.log("  " + n + "  → " + r.level + " / " + r.summary);
  r.items.forEach(i2 => { if (!i2.ok || i2.level !== "pass") console.log("        " + i2.level + " | " + i2.label + " | " + i2.detail); });
});

// 国家移民管理局《新版外国人永久居留身份证适配性改造要点》表 1 官方样例
// 932682198501010017：1985-01-01 出生沙特男性，江苏（32）申领；911124198108030024：加拿大（124）女性，北京（11）申领
["932682198501010017", "911124198108030024"].forEach(n => {
  const r = api.validatePrResident(n);
  t("永居证官方样例 " + n, r.ok && r.level === "pass", "level=" + r.level + " " + r.summary);
  console.log("  " + n + "  → " + r.level + " / " + r.summary);
  r.items.forEach(i2 => { if (!i2.ok || i2.level !== "pass") console.log("        " + i2.level + " | " + i2.label + " | " + i2.detail); });
});
// 旧版 15 位（3 位拉丁字母国籍 + 12 位数字）宽松判定
const oldPR = api.validatePrResident("CAN110019810803");
t("永居证旧版 15 位宽松判定", oldPR.ok && oldPR.level === "warn", "level=" + oldPR.level + " " + oldPR.summary);
console.log("  CAN110019810803  → " + oldPR.level + " / " + oldPR.summary);

console.log("\n=== 2. 已知错误样例必须判负 ===");
[
  ["身份证 校验位错误", "idcard", "11010119491231002Y"],
  ["身份证 长度 17", "idcard", "1101011949123100"],
  ["身份证 月份 13", "idcard", "11010119491331002X"],
  ["身份证 2 月 30 日", "idcard", "11010119490230002X"],
  ["身份证 年份 1900", "idcard", "11010119001231002X"],
  ["身份证 年份 2100", "idcard", "11010121001231002X"],
  ["身份证 含字母 I", "idcard", "11010119491231002I"],
  ["港澳通行证 前缀 A", "hkm", "A12345678"],
  ["港澳通行证 10 位", "hkm", "H123456789"],
  ["港澳通行证 含字母", "hkm", "H1234567A"],
  ["港澳台胞证 7 位", "twn", "1234567"],
  ["台胞证 9 位", "twn", "123456789"],
  ["台胞证 8 位含字母", "twn", "1234567A"],
  ["台胞证 13 位后缀错", "twn", "1234567890(12"],
  ["统一代码 长度 17", "usci", "91440300708461136"],
  ["统一代码 校验位错", "usci", "91440300708461136X"],
  ["统一代码 含字母 O", "usci", "91440300708461O36T"],
  ["统一代码 部门码无效 0", "usci", "01440300708461136T"],
  ["统一代码 部门/类别组合无效 94", "usci", "94440300708461136T"],
  ["统一代码 第2位无效 99", "usci", "9944030070846113XT"],
  ["统一代码 组织机构码校验位错", "usci", "91310115077567433M"],
  ["统一代码 含字母 S", "usci", "91S40300708461136T"],
  ["永居证 首位非 9", "pr", "832682198501010017"],
  ["永居证 校验位错误", "pr", "932682198501010018"],
  ["永居证 申领地代码无效 96", "pr", "996682198501010017"],
  ["永居证 月份 13", "pr", "932682198513010017"],
  ["永居证 2 月 30 日", "pr", "932682198502300017"],
  ["永居证 长度 17", "pr", "93268219850101001"],
  ["永居证 含字母", "pr", "9326821985010100X7"],
  ["永居证 顺序码 000", "pr", "91112419810803000" + api.idCheckDigit("91112419810803000")]
].forEach(([name, type, num]) => {
  const r = api["validate" + ({ idcard: "IdCard", passport: "Passport", hkm: "HKM", twn: "TWN", usci: "USCI", pr: "PrResident" }[type])](num);
  t(name + " 应判负", !r.ok, "实际 ok=" + r.ok + " level=" + r.level);
  console.log("  " + (r.ok ? "!! 误判通过" : "OK 判负") + "  " + name + " [" + num + "] → " + r.summary);
});

console.log("\n=== 3. 大规模生成 + 自校验 ===");
const N = 20000;
function bulk(label, gen, validator) {
  let ok = 0; const bad = [];
  for (let i = 0; i < N; i++) {
    const g = gen(i);
    const r = validator(g.number);
    if (r.ok) ok++; else if (bad.length < 3) bad.push(g.number + " :: " + r.summary + " :: " + r.items.filter(x => !x.ok).map(x => x.label).join(","));
  }
  t(label + " 随机 " + N + " 条全部合规", ok === N, ok + "/" + N + " 失败样例: " + bad.join(" | "));
  console.log("  " + label.padEnd(34) + " " + ok + " / " + N + (bad.length ? "\n      " + bad.join("\n      ") : ""));
}

bulk("身份证 全随机", () => api.genIdCard({}), api.validateIdCard);
bulk("身份证 男", () => api.genIdCard({ sex: "M" }), api.validateIdCard);
bulk("身份证 女", () => api.genIdCard({ sex: "F" }), api.validateIdCard);
bulk("身份证 1901-01-01 边界", () => api.genIdCard({ birth: { y: 1901, m: 1, d: 1 } }), api.validateIdCard);
bulk("身份证 2099-12-31 边界", () => api.genIdCard({ birth: { y: 2099, m: 12, d: 31 } }), api.validateIdCard);
bulk("身份证 2000 闰年 2/29", () => api.genIdCard({ birth: { y: 2000, m: 2, d: 29 } }), api.validateIdCard);
bulk("护照 通用 3 位国籍码", () => api.genPassport({ mode: "intl", country: "CHN", length: 9, tailSet: "num" }), api.validatePassport);
bulk("护照 通用 12 位字母数字", () => api.genPassport({ mode: "intl", country: "USA", length: 12, tailSet: "alnum" }), api.validatePassport);
bulk("护照 通用 4 位最短", () => api.genPassport({ mode: "intl", country: "JPN", length: 4, tailSet: "num" }), api.validatePassport);
["E", "EX", "G", "PE", "SE", "DE", "P", "S", "D"].forEach(k => {
  bulk("护照 中国 " + k, () => api.genPassport({ mode: "cn", kind: k }), api.validatePassport);
});
bulk("港澳通行证 9/11 随机", () => api.genHKMPermit({}), api.validateHKM);
bulk("港澳通行证 H 9 位", () => api.genHKMPermit({ prefix: "H", length: 9 }), api.validateHKM);
bulk("港澳通行证 M 11 位", () => api.genHKMPermit({ prefix: "M", length: 11 }), api.validateHKM);
["8", "10", "13", "14"].forEach(f => {
  bulk("台胞证 " + f + " 位", () => api.genTwnPermit({ format: f }), api.validateTWN);
});
bulk("台胞证 混合格式", () => api.genTwnPermit({}), api.validateTWN);
bulk("永居证 全随机", () => api.genPrPermit({}), api.validatePrResident);
bulk("永居证 男", () => api.genPrPermit({ sex: "M" }), api.validatePrResident);
bulk("永居证 女", () => api.genPrPermit({ sex: "F" }), api.validatePrResident);
bulk("永居证 无国籍 000", () => api.genPrPermit({ cc: "000" }), api.validatePrResident);
bulk("永居证 1901-01-01 边界", () => api.genPrPermit({ birth: { y: 1901, m: 1, d: 1 } }), api.validatePrResident);
bulk("永居证 2099-12-31 边界", () => api.genPrPermit({ birth: { y: 2099, m: 12, d: 31 } }), api.validatePrResident);
bulk("永居证 2000 闰年 2/29", () => api.genPrPermit({ birth: { y: 2000, m: 2, d: 29 } }), api.validatePrResident);
Object.keys(api.USCI_DEPT).forEach(k => {
  bulk("统一代码 部门 " + k, () => api.genUSCI({ dept: k, subject: "org" }), api.validateUSCI);
});
Object.keys(api.USCI_DEPT).forEach(k => {
  bulk("统一代码 部门 " + k + " 扩展主体码", () => api.genUSCI({ dept: k, subject: "loose" }), api.validateUSCI);
});

console.log("\n=== 4. 结构特征抽查（各取一条）===");
const samples = [
  ["身份证", api.genIdCard({}).number],
  ["护照-通用", api.genPassport({ mode: "intl", country: "CHN" }).number],
  ["护照-中国E", api.genPassport({ mode: "cn", kind: "E" }).number],
  ["护照-中国EA", api.genPassport({ mode: "cn", kind: "EX" }).number],
  ["港澳9", api.genHKMPermit({ prefix: "H", length: 9 }).number],
  ["港澳11", api.genHKMPermit({ prefix: "M", length: 11 }).number],
  ["台胞8", api.genTwnPermit({ format: "8" }).number],
  ["台胞10", api.genTwnPermit({ format: "10" }).number],
  ["台胞13", api.genTwnPermit({ format: "13" }).number],
  ["台胞14", api.genTwnPermit({ format: "14" }).number],
  ["永居证", api.genPrPermit({ prov: "32", cc: "682", sex: "M", birth: { y: 1985, m: 1, d: 1 } }).number],
  ["统一码", api.genUSCI({ dept: "9", cat: "1", region: "350100", subject: "org" }).number]
];
samples.forEach(([k, v]) => console.log("  " + k.padEnd(12) + v + L(v.length)));

console.log("\n=== 5. 交叉校验：生成号码的类型匹配 ===");
let mism = 0;
for (let i = 0; i < 3000; i++) {
  const g = api.genIdCard({});
  const m = api.matchAll(g.number);
  if (!m.length || m[0].type !== "idcard") { mism++; if (mism < 3) console.log("  身份证匹配异常:", g.number, m.map(x => x.type)); }
}
t("身份证 matchAll 优先命中 idcard", mism === 0, mism + " 例异常");

let mism2 = 0;
for (let i = 0; i < 3000; i++) {
  const g = api.genUSCI({ dept: "9", cat: "1", subject: "org" });
  const m = api.matchAll(g.number);
  if (!m.length || m[0].type !== "usci") { mism2++; if (mism2 < 3) console.log("  统一代码匹配异常:", g.number, m.map(x => x.type)); }
}
t("统一代码 matchAll 优先命中 usci", mism2 === 0, mism2 + " 例异常");

let mism3 = 0;
for (let i = 0; i < 3000; i++) {
  const g = api.genPrPermit({});
  const m = api.matchAll(g.number);
  if (!m.length || m[0].type !== "pr") { mism3++; if (mism3 < 3) console.log("  永居证匹配异常:", g.number, m.map(x => x.type)); }
}
t("永居证 matchAll 优先命中 pr", mism3 === 0, mism3 + " 例异常");
// 公民身份证号码不得被误判为永居证，反之亦然
let cross = 0;
for (let i = 0; i < 3000; i++) {
  const a = api.genIdCard({}).number, b = api.genPrPermit({}).number;
  if (api.validatePrResident(a).ok) cross++;
  if (api.validateIdCard(b).ok) cross++;
}
t("身份证 ↔ 永居证 互不误判", cross === 0, cross + " 例交叉误判");

console.log("\n=== 6. 校验位函数一致性 ===");
let c1 = 0;
for (let i = 0; i < 20000; i++) { const g = api.genIdCard({}); if (g.number[17] !== api.idCheckDigit(g.number.slice(0, 17))) c1++; }
t("idCheckDigit 与生成结果一致", c1 === 0);

let c2 = 0;
for (let i = 0; i < 20000; i++) {
  const g = api.genUSCI({ subject: "org" });
  if (g.number[17] !== api.usciCheckDigit(g.number.slice(0, 17))) c2++;
}
t("usciCheckDigit 与生成结果一致", c2 === 0);

// 组织机构代码 9-17 段自校验
let c3 = 0;
for (let i = 0; i < 20000; i++) {
  const g = api.genUSCI({ subject: "org" });
  const subj = g.number.slice(8, 17);
  if (subj[8] !== api.orgCheckDigit(subj.slice(0, 8))) c3++;
}
t("orgCheckDigit 与 9-17 位一致", c3 === 0);

console.log("\n=== 7. 行政区划码收录情况 / 全文语法自检 ===");
const r440300 = api.validateUSCI("91440300708461136T");
t("440300 深圳市 已收录（地市级）", r440300.level === "pass", "level=" + r440300.level);
const r350100 = api.validateUSCI("91350100M000100Y43");
t("350100 福州市 已收录（地市级）", r350100.items.find(x => x.label.indexOf("行政区划") >= 0).level === "pass",
  r350100.items.find(x => x.label.indexOf("行政区划") >= 0).detail);
console.log("  440300 → " + r440300.level + " / " + r440300.summary);
console.log("  350100 → " + r350100.level + " / " + r350100.summary);
// 生成的区划码必须全部可识别
let regionMiss = 0;
for (let i = 0; i < 30000; i++) {
  const g = api.genIdCard({});
  if (!api.validateIdCard(g.number).items.find(x => x.label.indexOf("行政区划") >= 0).ok) regionMiss++;
}
t("身份证随机区划码 100% 可识别", regionMiss === 0, regionMiss + " 例未识别");
let regionMiss2 = 0;
for (let i = 0; i < 30000; i++) {
  const g = api.genUSCI({ subject: "org" });
  if (api.validateUSCI(g.number).items.find(x => x.label.indexOf("行政区划") >= 0).level !== "pass") regionMiss2++;
}
t("统一代码随机区划码 100% 精确命中", regionMiss2 === 0, regionMiss2 + " 例降级为提示");

// 整页 <script> 语法自检
const allScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
let syntaxOk = true, syntaxErr = "";
try { new Function(allScripts); } catch (err) { syntaxOk = false; syntaxErr = err.message; }
t("HTML 内联脚本语法可编译", syntaxOk, syntaxErr);
console.log("  内联脚本长度 " + allScripts.length + " 字符 → " + (syntaxOk ? "语法 OK" : "语法错误: " + syntaxErr));

// 标签配对粗检
const openDiv = (html.match(/<div/g) || []).length, closeDiv = (html.match(/<\/div>/g) || []).length;
t("<div> 标签配对", openDiv === closeDiv, openDiv + " vs " + closeDiv);
const openSec = (html.match(/<section/g) || []).length, closeSec = (html.match(/<\/section>/g) || []).length;
t("<section> 标签配对", openSec === closeSec, openSec + " vs " + closeSec);

console.log("\n=========================================");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
if (problems.length) { console.log("失败明细："); problems.forEach(p => console.log("  ✗ " + p)); }
process.exit(fail ? 1 : 0);
