/**
 * Quick smoke: XORAZM/XIVA/SOUTH-WEST cascade formats used in work-slots.
 * npx tsx scripts/smoke-territory-match-xiva.ts
 */
import {
  staffTerritoriesMatchAddress,
  territoryTokensMatch
} from "../src/modules/linkage/linkage.territory-match.pure";

const xiv = { zone: "SOUTH-WEST", region: "XORAZM VILOYATI", city: "XIVA" };

const cases: Array<[string, boolean, string[]]> = [
  ["full path", true, ["SOUTH-WEST / XORAZM VILOYATI / XIVA"]],
  ["oblast only", true, ["SOUTH-WEST / XORAZM VILOYATI"]],
  [
    "multi city paths",
    true,
    [
      "SOUTH-WEST / XORAZM VILOYATI / BERUNIY",
      "SOUTH-WEST / XORAZM VILOYATI / URGANCH",
      "SOUTH-WEST / XORAZM VILOYATI / XIVA",
      "SOUTH-WEST / XORAZM VILOYATI / XONQA"
    ]
  ],
  ["bare cities", true, ["BERUNIY", "URGANCH", "XIVA", "XONQA"]],
  ["comma path", true, ["SOUTH-WEST / XORAZM VILOYATI / BERUNIY, URGANCH, XIVA, XONQA"]],
  ["code in slot", true, ["SOUTH-WEST / XORAZM VILOYATI / XR_XIVA"]],
  ["reject URGANCH", false, ["SOUTH-WEST / XORAZM VILOYATI / URGANCH"]],
  ["reject TASHKENT", false, ["SOUTH-WEST / TASHKENT VILOYATI / XIVA"]],
  ["reject BUXORO oblast", false, ["SOUTH-WEST / BUXORO VILOYATI"]]
];

let fail = 0;
for (const [name, want, blobs] of cases) {
  const got = staffTerritoriesMatchAddress(blobs, xiv);
  const ok = got === want;
  if (!ok) fail += 1;
  console.log(ok ? "PASS" : "FAIL", name, { want, got });
}

const codeClient = staffTerritoriesMatchAddress(["SOUTH-WEST / XORAZM VILOYATI / XIVA"], {
  ...xiv,
  city: "XR_XIVA"
});
if (!codeClient) fail += 1;
console.log(codeClient ? "PASS" : "FAIL", "client city CODE XR_XIVA", { got: codeClient });

const oblastsDistinct = !territoryTokensMatch("XORAZM VILOYATI", "TASHKENT VILOYATI");
if (!oblastsDistinct) fail += 1;
console.log(oblastsDistinct ? "PASS" : "FAIL", "oblasts not aliased via VILOYATI");

if (fail > 0) {
  console.error(`FAIL count=${fail}`);
  process.exit(1);
}
console.log("ALL PASS");
