// node --test scripts/signed-out.test.mjs: the sign-in link and words a page shows when chassis-rs 4.2.0 answers one of its
// calls 401 (web/js/api/login-link.js), and that the two fetch helpers use them instead of leaving the page.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSignedOut, signedOutWords, loginHref, LOGIN_PATH } from "../web/js/api/login-link.js";
import { EN as EN_CORE } from "../web/js/i18n/en.js";
import { NL as NL_CORE } from "../web/js/i18n/nl.js";

/** The t() of one book, without the browser's i18n module. */
const words = (book) => (key) => {
  assert.ok(typeof book[key] === "string", `missing word ${key}`);
  return book[key];
};

test("the link is the kit's login page", () => {
  assert.equal(LOGIN_PATH, "/login");
});

test("the login comes back to this page: path and query in the kit's next", () => {
  assert.equal(loginHref({ pathname: "/recipe/edit", search: "?id=r1&x=a b" }), "/login?next=%2Frecipe%2Fedit%3Fid%3Dr1%26x%3Da%20b");
  assert.equal(loginHref({ pathname: "/", search: "" }), "/login?next=%2F");
});

test("the notice opens the login in the same tab", () => {
  const src = readFileSync(new URL("../web/js/api/signed-out.js", import.meta.url), "utf8");
  assert.match(src, /href: loginHref\(location\)/);
  assert.doesNotMatch(src, /_blank/);
});

test("only a 401 counts as signed out", () => {
  assert.equal(isSignedOut(401), true);
  for (const s of [200, 303, 403, 409, 500]) assert.equal(isSignedOut(s), false);
});

test("the notice speaks both languages, and differently", () => {
  const en = signedOutWords(words(EN_CORE));
  const nl = signedOutWords(words(NL_CORE));
  assert.equal(en.link, "Sign in");
  assert.equal(nl.link, "Aanmelden");
  assert.notEqual(en.note, nl.note);
  for (const key of ["api.signedOut", "api.dropped"]) assert.notEqual(words(EN_CORE)(key), words(NL_CORE)(key));
});

test("the fetch helpers show the notice and no longer open the login page themselves", () => {
  for (const file of ["web/js/api/http.js", "web/js/raw.js"]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(src, /signedOutNotice\(\)/, `${file} shows the notice`);
    assert.doesNotMatch(src, /location\.assign/, `${file} leaves the page alone`);
  }
});
