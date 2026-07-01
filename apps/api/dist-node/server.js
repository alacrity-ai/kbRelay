import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/@whatwg-node/fetch/dist/shouldSkipPonyfill.js
var require_shouldSkipPonyfill = __commonJS({
  "../../node_modules/@whatwg-node/fetch/dist/shouldSkipPonyfill.js"(exports, module) {
    function isNextJs() {
      return Object.keys(globalThis).some((key) => key.startsWith("__NEXT"));
    }
    module.exports = function shouldSkipPonyfill() {
      if (globalThis.Deno) {
        return true;
      }
      if (globalThis.Bun) {
        return true;
      }
      if (isNextJs()) {
        return true;
      }
      return false;
    };
  }
});

// ../../node_modules/urlpattern-polyfill/dist/urlpattern.cjs
var require_urlpattern = __commonJS({
  "../../node_modules/urlpattern-polyfill/dist/urlpattern.cjs"(exports, module) {
    "use strict";
    var U = Object.defineProperty;
    var Re = Object.getOwnPropertyDescriptor;
    var Ee = Object.getOwnPropertyNames;
    var Oe = Object.prototype.hasOwnProperty;
    var a = (e, t) => U(e, "name", { value: t, configurable: true });
    var ke = (e, t) => {
      for (var r in t) U(e, r, { get: t[r], enumerable: true });
    };
    var Te = (e, t, r, n) => {
      if (t && typeof t == "object" || typeof t == "function") for (let o of Ee(t)) !Oe.call(e, o) && o !== r && U(e, o, { get: () => t[o], enumerable: !(n = Re(t, o)) || n.enumerable });
      return e;
    };
    var Ae = (e) => Te(U({}, "__esModule", { value: true }), e);
    var He = {};
    ke(He, { URLPattern: () => M });
    module.exports = Ae(He);
    var P = class {
      type = 3;
      name = "";
      prefix = "";
      value = "";
      suffix = "";
      modifier = 3;
      constructor(t, r, n, o, l, f) {
        this.type = t, this.name = r, this.prefix = n, this.value = o, this.suffix = l, this.modifier = f;
      }
      hasCustomName() {
        return this.name !== "" && typeof this.name != "number";
      }
    };
    a(P, "Part");
    var ye = /[$_\p{ID_Start}]/u;
    var we = /[$_\u200C\u200D\p{ID_Continue}]/u;
    var F = ".*";
    function Ce(e, t) {
      return (t ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(e);
    }
    a(Ce, "isASCII");
    function W(e, t = false) {
      let r = [], n = 0;
      for (; n < e.length; ) {
        let o = e[n], l = a(function(f) {
          if (!t) throw new TypeError(f);
          r.push({ type: "INVALID_CHAR", index: n, value: e[n++] });
        }, "ErrorOrInvalid");
        if (o === "*") {
          r.push({ type: "ASTERISK", index: n, value: e[n++] });
          continue;
        }
        if (o === "+" || o === "?") {
          r.push({ type: "OTHER_MODIFIER", index: n, value: e[n++] });
          continue;
        }
        if (o === "\\") {
          r.push({ type: "ESCAPED_CHAR", index: n++, value: e[n++] });
          continue;
        }
        if (o === "{") {
          r.push({ type: "OPEN", index: n, value: e[n++] });
          continue;
        }
        if (o === "}") {
          r.push({ type: "CLOSE", index: n, value: e[n++] });
          continue;
        }
        if (o === ":") {
          let f = "", s = n + 1;
          for (; s < e.length; ) {
            let i = e.substr(s, 1);
            if (s === n + 1 && ye.test(i) || s !== n + 1 && we.test(i)) {
              f += e[s++];
              continue;
            }
            break;
          }
          if (!f) {
            l(`Missing parameter name at ${n}`);
            continue;
          }
          r.push({ type: "NAME", index: n, value: f }), n = s;
          continue;
        }
        if (o === "(") {
          let f = 1, s = "", i = n + 1, c = false;
          if (e[i] === "?") {
            l(`Pattern cannot start with "?" at ${i}`);
            continue;
          }
          for (; i < e.length; ) {
            if (!Ce(e[i], false)) {
              l(`Invalid character '${e[i]}' at ${i}.`), c = true;
              break;
            }
            if (e[i] === "\\") {
              s += e[i++] + e[i++];
              continue;
            }
            if (e[i] === ")") {
              if (f--, f === 0) {
                i++;
                break;
              }
            } else if (e[i] === "(" && (f++, e[i + 1] !== "?")) {
              l(`Capturing groups are not allowed at ${i}`), c = true;
              break;
            }
            s += e[i++];
          }
          if (c) continue;
          if (f) {
            l(`Unbalanced pattern at ${n}`);
            continue;
          }
          if (!s) {
            l(`Missing pattern at ${n}`);
            continue;
          }
          r.push({ type: "REGEX", index: n, value: s }), n = i;
          continue;
        }
        r.push({ type: "CHAR", index: n, value: e[n++] });
      }
      return r.push({ type: "END", index: n, value: "" }), r;
    }
    a(W, "lexer");
    function _(e, t = {}) {
      let r = W(e);
      t.delimiter ??= "/#?", t.prefixes ??= "./";
      let n = `[^${x(t.delimiter)}]+?`, o = [], l = 0, f = 0, s = "", i = /* @__PURE__ */ new Set(), c = a((u) => {
        if (f < r.length && r[f].type === u) return r[f++].value;
      }, "tryConsume"), h = a(() => c("OTHER_MODIFIER") ?? c("ASTERISK"), "tryConsumeModifier"), p = a((u) => {
        let d = c(u);
        if (d !== void 0) return d;
        let { type: g, index: y } = r[f];
        throw new TypeError(`Unexpected ${g} at ${y}, expected ${u}`);
      }, "mustConsume"), A = a(() => {
        let u = "", d;
        for (; d = c("CHAR") ?? c("ESCAPED_CHAR"); ) u += d;
        return u;
      }, "consumeText"), be = a((u) => u, "DefaultEncodePart"), N = t.encodePart || be, H = "", v = a((u) => {
        H += u;
      }, "appendToPendingFixedValue"), D = a(() => {
        H.length && (o.push(new P(3, "", "", N(H), "", 3)), H = "");
      }, "maybeAddPartFromPendingFixedValue"), Z = a((u, d, g, y, B) => {
        let m = 3;
        switch (B) {
          case "?":
            m = 1;
            break;
          case "*":
            m = 0;
            break;
          case "+":
            m = 2;
            break;
        }
        if (!d && !g && m === 3) {
          v(u);
          return;
        }
        if (D(), !d && !g) {
          if (!u) return;
          o.push(new P(3, "", "", N(u), "", m));
          return;
        }
        let S;
        g ? g === "*" ? S = F : S = g : S = n;
        let k = 2;
        S === n ? (k = 1, S = "") : S === F && (k = 0, S = "");
        let E;
        if (d ? E = d : g && (E = l++), i.has(E)) throw new TypeError(`Duplicate name '${E}'.`);
        i.add(E), o.push(new P(k, E, N(u), S, N(y), m));
      }, "addPart");
      for (; f < r.length; ) {
        let u = c("CHAR"), d = c("NAME"), g = c("REGEX");
        if (!d && !g && (g = c("ASTERISK")), d || g) {
          let m = u ?? "";
          t.prefixes.indexOf(m) === -1 && (v(m), m = ""), D();
          let S = h();
          Z(m, d, g, "", S);
          continue;
        }
        let y = u ?? c("ESCAPED_CHAR");
        if (y) {
          v(y);
          continue;
        }
        if (c("OPEN")) {
          let m = A(), S = c("NAME"), k = c("REGEX");
          !S && !k && (k = c("ASTERISK"));
          let E = A();
          p("CLOSE");
          let Pe = h();
          Z(m, S, k, E, Pe);
          continue;
        }
        D(), p("END");
      }
      return o;
    }
    a(_, "parse");
    function x(e) {
      return e.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
    }
    a(x, "escapeString");
    function q(e) {
      return e && e.ignoreCase ? "ui" : "u";
    }
    a(q, "flags");
    function J(e, t, r) {
      return z(_(e, r), t, r);
    }
    a(J, "stringToRegexp");
    function T(e) {
      switch (e) {
        case 0:
          return "*";
        case 1:
          return "?";
        case 2:
          return "+";
        case 3:
          return "";
      }
    }
    a(T, "modifierToString");
    function z(e, t, r = {}) {
      r.delimiter ??= "/#?", r.prefixes ??= "./", r.sensitive ??= false, r.strict ??= false, r.end ??= true, r.start ??= true, r.endsWith = "";
      let n = r.start ? "^" : "";
      for (let s of e) {
        if (s.type === 3) {
          s.modifier === 3 ? n += x(s.value) : n += `(?:${x(s.value)})${T(s.modifier)}`;
          continue;
        }
        t && t.push(s.name);
        let i = `[^${x(r.delimiter)}]+?`, c = s.value;
        if (s.type === 1 ? c = i : s.type === 0 && (c = F), !s.prefix.length && !s.suffix.length) {
          s.modifier === 3 || s.modifier === 1 ? n += `(${c})${T(s.modifier)}` : n += `((?:${c})${T(s.modifier)})`;
          continue;
        }
        if (s.modifier === 3 || s.modifier === 1) {
          n += `(?:${x(s.prefix)}(${c})${x(s.suffix)})`, n += T(s.modifier);
          continue;
        }
        n += `(?:${x(s.prefix)}`, n += `((?:${c})(?:`, n += x(s.suffix), n += x(s.prefix), n += `(?:${c}))*)${x(s.suffix)})`, s.modifier === 0 && (n += "?");
      }
      let o = `[${x(r.endsWith)}]|$`, l = `[${x(r.delimiter)}]`;
      if (r.end) return r.strict || (n += `${l}?`), r.endsWith.length ? n += `(?=${o})` : n += "$", new RegExp(n, q(r));
      r.strict || (n += `(?:${l}(?=${o}))?`);
      let f = false;
      if (e.length) {
        let s = e[e.length - 1];
        s.type === 3 && s.modifier === 3 && (f = r.delimiter.indexOf(s) > -1);
      }
      return f || (n += `(?=${l}|${o})`), new RegExp(n, q(r));
    }
    a(z, "partsToRegexp");
    var b = { delimiter: "", prefixes: "", sensitive: true, strict: true };
    var Q = { delimiter: ".", prefixes: "", sensitive: true, strict: true };
    var ee = { delimiter: "/", prefixes: "/", sensitive: true, strict: true };
    function te(e, t) {
      return e.length ? e[0] === "/" ? true : !t || e.length < 2 ? false : (e[0] == "\\" || e[0] == "{") && e[1] == "/" : false;
    }
    a(te, "isAbsolutePathname");
    function re(e, t) {
      return e.startsWith(t) ? e.substring(t.length, e.length) : e;
    }
    a(re, "maybeStripPrefix");
    function Le(e, t) {
      return e.endsWith(t) ? e.substr(0, e.length - t.length) : e;
    }
    a(Le, "maybeStripSuffix");
    function j(e) {
      return !e || e.length < 2 ? false : e[0] === "[" || (e[0] === "\\" || e[0] === "{") && e[1] === "[";
    }
    a(j, "treatAsIPv6Hostname");
    var ne = ["ftp", "file", "http", "https", "ws", "wss"];
    function $(e) {
      if (!e) return true;
      for (let t of ne) if (e.test(t)) return true;
      return false;
    }
    a($, "isSpecialScheme");
    function se(e, t) {
      if (e = re(e, "#"), t || e === "") return e;
      let r = new URL("https://example.com");
      return r.hash = e, r.hash ? r.hash.substring(1, r.hash.length) : "";
    }
    a(se, "canonicalizeHash");
    function ie(e, t) {
      if (e = re(e, "?"), t || e === "") return e;
      let r = new URL("https://example.com");
      return r.search = e, r.search ? r.search.substring(1, r.search.length) : "";
    }
    a(ie, "canonicalizeSearch");
    function ae(e, t) {
      return t || e === "" ? e : j(e) ? V(e) : G(e);
    }
    a(ae, "canonicalizeHostname");
    function oe(e, t) {
      if (t || e === "") return e;
      let r = new URL("https://example.com");
      return r.password = e, r.password;
    }
    a(oe, "canonicalizePassword");
    function ce(e, t) {
      if (t || e === "") return e;
      let r = new URL("https://example.com");
      return r.username = e, r.username;
    }
    a(ce, "canonicalizeUsername");
    function le(e, t, r) {
      if (r || e === "") return e;
      if (t && !ne.includes(t)) return new URL(`${t}:${e}`).pathname;
      let n = e[0] == "/";
      return e = new URL(n ? e : "/-" + e, "https://example.com").pathname, n || (e = e.substring(2, e.length)), e;
    }
    a(le, "canonicalizePathname");
    function fe(e, t, r) {
      return K(t) === e && (e = ""), r || e === "" ? e : Y(e);
    }
    a(fe, "canonicalizePort");
    function he(e, t) {
      return e = Le(e, ":"), t || e === "" ? e : w(e);
    }
    a(he, "canonicalizeProtocol");
    function K(e) {
      switch (e) {
        case "ws":
        case "http":
          return "80";
        case "wws":
        case "https":
          return "443";
        case "ftp":
          return "21";
        default:
          return "";
      }
    }
    a(K, "defaultPortForProtocol");
    function w(e) {
      if (e === "") return e;
      if (/^[-+.A-Za-z0-9]*$/.test(e)) return e.toLowerCase();
      throw new TypeError(`Invalid protocol '${e}'.`);
    }
    a(w, "protocolEncodeCallback");
    function ue(e) {
      if (e === "") return e;
      let t = new URL("https://example.com");
      return t.username = e, t.username;
    }
    a(ue, "usernameEncodeCallback");
    function de(e) {
      if (e === "") return e;
      let t = new URL("https://example.com");
      return t.password = e, t.password;
    }
    a(de, "passwordEncodeCallback");
    function G(e) {
      if (e === "") return e;
      if (/[\t\n\r #%/:<>?@[\]^\\|]/g.test(e)) throw new TypeError(`Invalid hostname '${e}'`);
      let t = new URL("https://example.com");
      return t.hostname = e, t.hostname;
    }
    a(G, "hostnameEncodeCallback");
    function V(e) {
      if (e === "") return e;
      if (/[^0-9a-fA-F[\]:]/g.test(e)) throw new TypeError(`Invalid IPv6 hostname '${e}'`);
      return e.toLowerCase();
    }
    a(V, "ipv6HostnameEncodeCallback");
    function Y(e) {
      if (e === "" || /^[0-9]*$/.test(e) && parseInt(e) <= 65535) return e;
      throw new TypeError(`Invalid port '${e}'.`);
    }
    a(Y, "portEncodeCallback");
    function pe(e) {
      if (e === "") return e;
      let t = new URL("https://example.com");
      return t.pathname = e[0] !== "/" ? "/-" + e : e, e[0] !== "/" ? t.pathname.substring(2, t.pathname.length) : t.pathname;
    }
    a(pe, "standardURLPathnameEncodeCallback");
    function ge(e) {
      return e === "" ? e : new URL(`data:${e}`).pathname;
    }
    a(ge, "pathURLPathnameEncodeCallback");
    function me(e) {
      if (e === "") return e;
      let t = new URL("https://example.com");
      return t.search = e, t.search.substring(1, t.search.length);
    }
    a(me, "searchEncodeCallback");
    function Se(e) {
      if (e === "") return e;
      let t = new URL("https://example.com");
      return t.hash = e, t.hash.substring(1, t.hash.length);
    }
    a(Se, "hashEncodeCallback");
    var C = class {
      #i;
      #n = [];
      #t = {};
      #e = 0;
      #s = 1;
      #l = 0;
      #o = 0;
      #d = 0;
      #p = 0;
      #g = false;
      constructor(t) {
        this.#i = t;
      }
      get result() {
        return this.#t;
      }
      parse() {
        for (this.#n = W(this.#i, true); this.#e < this.#n.length; this.#e += this.#s) {
          if (this.#s = 1, this.#n[this.#e].type === "END") {
            if (this.#o === 0) {
              this.#b(), this.#f() ? this.#r(9, 1) : this.#h() ? this.#r(8, 1) : this.#r(7, 0);
              continue;
            } else if (this.#o === 2) {
              this.#u(5);
              continue;
            }
            this.#r(10, 0);
            break;
          }
          if (this.#d > 0) if (this.#A()) this.#d -= 1;
          else continue;
          if (this.#T()) {
            this.#d += 1;
            continue;
          }
          switch (this.#o) {
            case 0:
              this.#P() && this.#u(1);
              break;
            case 1:
              if (this.#P()) {
                this.#C();
                let t = 7, r = 1;
                this.#E() ? (t = 2, r = 3) : this.#g && (t = 2), this.#r(t, r);
              }
              break;
            case 2:
              this.#S() ? this.#u(3) : (this.#x() || this.#h() || this.#f()) && this.#u(5);
              break;
            case 3:
              this.#O() ? this.#r(4, 1) : this.#S() && this.#r(5, 1);
              break;
            case 4:
              this.#S() && this.#r(5, 1);
              break;
            case 5:
              this.#y() ? this.#p += 1 : this.#w() && (this.#p -= 1), this.#k() && !this.#p ? this.#r(6, 1) : this.#x() ? this.#r(7, 0) : this.#h() ? this.#r(8, 1) : this.#f() && this.#r(9, 1);
              break;
            case 6:
              this.#x() ? this.#r(7, 0) : this.#h() ? this.#r(8, 1) : this.#f() && this.#r(9, 1);
              break;
            case 7:
              this.#h() ? this.#r(8, 1) : this.#f() && this.#r(9, 1);
              break;
            case 8:
              this.#f() && this.#r(9, 1);
              break;
            case 9:
              break;
            case 10:
              break;
          }
        }
        this.#t.hostname !== void 0 && this.#t.port === void 0 && (this.#t.port = "");
      }
      #r(t, r) {
        switch (this.#o) {
          case 0:
            break;
          case 1:
            this.#t.protocol = this.#c();
            break;
          case 2:
            break;
          case 3:
            this.#t.username = this.#c();
            break;
          case 4:
            this.#t.password = this.#c();
            break;
          case 5:
            this.#t.hostname = this.#c();
            break;
          case 6:
            this.#t.port = this.#c();
            break;
          case 7:
            this.#t.pathname = this.#c();
            break;
          case 8:
            this.#t.search = this.#c();
            break;
          case 9:
            this.#t.hash = this.#c();
            break;
          case 10:
            break;
        }
        this.#o !== 0 && t !== 10 && ([1, 2, 3, 4].includes(this.#o) && [6, 7, 8, 9].includes(t) && (this.#t.hostname ??= ""), [1, 2, 3, 4, 5, 6].includes(this.#o) && [8, 9].includes(t) && (this.#t.pathname ??= this.#g ? "/" : ""), [1, 2, 3, 4, 5, 6, 7].includes(this.#o) && t === 9 && (this.#t.search ??= "")), this.#R(t, r);
      }
      #R(t, r) {
        this.#o = t, this.#l = this.#e + r, this.#e += r, this.#s = 0;
      }
      #b() {
        this.#e = this.#l, this.#s = 0;
      }
      #u(t) {
        this.#b(), this.#o = t;
      }
      #m(t) {
        return t < 0 && (t = this.#n.length - t), t < this.#n.length ? this.#n[t] : this.#n[this.#n.length - 1];
      }
      #a(t, r) {
        let n = this.#m(t);
        return n.value === r && (n.type === "CHAR" || n.type === "ESCAPED_CHAR" || n.type === "INVALID_CHAR");
      }
      #P() {
        return this.#a(this.#e, ":");
      }
      #E() {
        return this.#a(this.#e + 1, "/") && this.#a(this.#e + 2, "/");
      }
      #S() {
        return this.#a(this.#e, "@");
      }
      #O() {
        return this.#a(this.#e, ":");
      }
      #k() {
        return this.#a(this.#e, ":");
      }
      #x() {
        return this.#a(this.#e, "/");
      }
      #h() {
        if (this.#a(this.#e, "?")) return true;
        if (this.#n[this.#e].value !== "?") return false;
        let t = this.#m(this.#e - 1);
        return t.type !== "NAME" && t.type !== "REGEX" && t.type !== "CLOSE" && t.type !== "ASTERISK";
      }
      #f() {
        return this.#a(this.#e, "#");
      }
      #T() {
        return this.#n[this.#e].type == "OPEN";
      }
      #A() {
        return this.#n[this.#e].type == "CLOSE";
      }
      #y() {
        return this.#a(this.#e, "[");
      }
      #w() {
        return this.#a(this.#e, "]");
      }
      #c() {
        let t = this.#n[this.#e], r = this.#m(this.#l).index;
        return this.#i.substring(r, t.index);
      }
      #C() {
        let t = {};
        Object.assign(t, b), t.encodePart = w;
        let r = J(this.#c(), void 0, t);
        this.#g = $(r);
      }
    };
    a(C, "Parser");
    var X = ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"];
    var O = "*";
    function xe(e, t) {
      if (typeof e != "string") throw new TypeError("parameter 1 is not of type 'string'.");
      let r = new URL(e, t);
      return { protocol: r.protocol.substring(0, r.protocol.length - 1), username: r.username, password: r.password, hostname: r.hostname, port: r.port, pathname: r.pathname, search: r.search !== "" ? r.search.substring(1, r.search.length) : void 0, hash: r.hash !== "" ? r.hash.substring(1, r.hash.length) : void 0 };
    }
    a(xe, "extractValues");
    function R(e, t) {
      return t ? I(e) : e;
    }
    a(R, "processBaseURLString");
    function L(e, t, r) {
      let n;
      if (typeof t.baseURL == "string") try {
        n = new URL(t.baseURL), t.protocol === void 0 && (e.protocol = R(n.protocol.substring(0, n.protocol.length - 1), r)), !r && t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.username === void 0 && (e.username = R(n.username, r)), !r && t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.username === void 0 && t.password === void 0 && (e.password = R(n.password, r)), t.protocol === void 0 && t.hostname === void 0 && (e.hostname = R(n.hostname, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && (e.port = R(n.port, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && (e.pathname = R(n.pathname, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && t.search === void 0 && (e.search = R(n.search.substring(1, n.search.length), r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && t.search === void 0 && t.hash === void 0 && (e.hash = R(n.hash.substring(1, n.hash.length), r));
      } catch {
        throw new TypeError(`invalid baseURL '${t.baseURL}'.`);
      }
      if (typeof t.protocol == "string" && (e.protocol = he(t.protocol, r)), typeof t.username == "string" && (e.username = ce(t.username, r)), typeof t.password == "string" && (e.password = oe(t.password, r)), typeof t.hostname == "string" && (e.hostname = ae(t.hostname, r)), typeof t.port == "string" && (e.port = fe(t.port, e.protocol, r)), typeof t.pathname == "string") {
        if (e.pathname = t.pathname, n && !te(e.pathname, r)) {
          let o = n.pathname.lastIndexOf("/");
          o >= 0 && (e.pathname = R(n.pathname.substring(0, o + 1), r) + e.pathname);
        }
        e.pathname = le(e.pathname, e.protocol, r);
      }
      return typeof t.search == "string" && (e.search = ie(t.search, r)), typeof t.hash == "string" && (e.hash = se(t.hash, r)), e;
    }
    a(L, "applyInit");
    function I(e) {
      return e.replace(/([+*?:{}()\\])/g, "\\$1");
    }
    a(I, "escapePatternString");
    function Ie(e) {
      return e.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
    }
    a(Ie, "escapeRegexpString");
    function Ne(e, t) {
      t.delimiter ??= "/#?", t.prefixes ??= "./", t.sensitive ??= false, t.strict ??= false, t.end ??= true, t.start ??= true, t.endsWith = "";
      let r = ".*", n = `[^${Ie(t.delimiter)}]+?`, o = /[$_\u200C\u200D\p{ID_Continue}]/u, l = "";
      for (let f = 0; f < e.length; ++f) {
        let s = e[f];
        if (s.type === 3) {
          if (s.modifier === 3) {
            l += I(s.value);
            continue;
          }
          l += `{${I(s.value)}}${T(s.modifier)}`;
          continue;
        }
        let i = s.hasCustomName(), c = !!s.suffix.length || !!s.prefix.length && (s.prefix.length !== 1 || !t.prefixes.includes(s.prefix)), h = f > 0 ? e[f - 1] : null, p = f < e.length - 1 ? e[f + 1] : null;
        if (!c && i && s.type === 1 && s.modifier === 3 && p && !p.prefix.length && !p.suffix.length) if (p.type === 3) {
          let A = p.value.length > 0 ? p.value[0] : "";
          c = o.test(A);
        } else c = !p.hasCustomName();
        if (!c && !s.prefix.length && h && h.type === 3) {
          let A = h.value[h.value.length - 1];
          c = t.prefixes.includes(A);
        }
        c && (l += "{"), l += I(s.prefix), i && (l += `:${s.name}`), s.type === 2 ? l += `(${s.value})` : s.type === 1 ? i || (l += `(${n})`) : s.type === 0 && (!i && (!h || h.type === 3 || h.modifier !== 3 || c || s.prefix !== "") ? l += "*" : l += `(${r})`), s.type === 1 && i && s.suffix.length && o.test(s.suffix[0]) && (l += "\\"), l += I(s.suffix), c && (l += "}"), s.modifier !== 3 && (l += T(s.modifier));
      }
      return l;
    }
    a(Ne, "partsToPattern");
    var M = class {
      #i;
      #n = {};
      #t = {};
      #e = {};
      #s = {};
      #l = false;
      constructor(t = {}, r, n) {
        try {
          let o;
          if (typeof r == "string" ? o = r : n = r, typeof t == "string") {
            let i = new C(t);
            if (i.parse(), t = i.result, o === void 0 && typeof t.protocol != "string") throw new TypeError("A base URL must be provided for a relative constructor string.");
            t.baseURL = o;
          } else {
            if (!t || typeof t != "object") throw new TypeError("parameter 1 is not of type 'string' and cannot convert to dictionary.");
            if (o) throw new TypeError("parameter 1 is not of type 'string'.");
          }
          typeof n > "u" && (n = { ignoreCase: false });
          let l = { ignoreCase: n.ignoreCase === true }, f = { pathname: O, protocol: O, username: O, password: O, hostname: O, port: O, search: O, hash: O };
          this.#i = L(f, t, true), K(this.#i.protocol) === this.#i.port && (this.#i.port = "");
          let s;
          for (s of X) {
            if (!(s in this.#i)) continue;
            let i = {}, c = this.#i[s];
            switch (this.#t[s] = [], s) {
              case "protocol":
                Object.assign(i, b), i.encodePart = w;
                break;
              case "username":
                Object.assign(i, b), i.encodePart = ue;
                break;
              case "password":
                Object.assign(i, b), i.encodePart = de;
                break;
              case "hostname":
                Object.assign(i, Q), j(c) ? i.encodePart = V : i.encodePart = G;
                break;
              case "port":
                Object.assign(i, b), i.encodePart = Y;
                break;
              case "pathname":
                $(this.#n.protocol) ? (Object.assign(i, ee, l), i.encodePart = pe) : (Object.assign(i, b, l), i.encodePart = ge);
                break;
              case "search":
                Object.assign(i, b, l), i.encodePart = me;
                break;
              case "hash":
                Object.assign(i, b, l), i.encodePart = Se;
                break;
            }
            try {
              this.#s[s] = _(c, i), this.#n[s] = z(this.#s[s], this.#t[s], i), this.#e[s] = Ne(this.#s[s], i), this.#l = this.#l || this.#s[s].some((h) => h.type === 2);
            } catch {
              throw new TypeError(`invalid ${s} pattern '${this.#i[s]}'.`);
            }
          }
        } catch (o) {
          throw new TypeError(`Failed to construct 'URLPattern': ${o.message}`);
        }
      }
      get [Symbol.toStringTag]() {
        return "URLPattern";
      }
      test(t = {}, r) {
        let n = { pathname: "", protocol: "", username: "", password: "", hostname: "", port: "", search: "", hash: "" };
        if (typeof t != "string" && r) throw new TypeError("parameter 1 is not of type 'string'.");
        if (typeof t > "u") return false;
        try {
          typeof t == "object" ? n = L(n, t, false) : n = L(n, xe(t, r), false);
        } catch {
          return false;
        }
        let o;
        for (o of X) if (!this.#n[o].exec(n[o])) return false;
        return true;
      }
      exec(t = {}, r) {
        let n = { pathname: "", protocol: "", username: "", password: "", hostname: "", port: "", search: "", hash: "" };
        if (typeof t != "string" && r) throw new TypeError("parameter 1 is not of type 'string'.");
        if (typeof t > "u") return;
        try {
          typeof t == "object" ? n = L(n, t, false) : n = L(n, xe(t, r), false);
        } catch {
          return null;
        }
        let o = {};
        r ? o.inputs = [t, r] : o.inputs = [t];
        let l;
        for (l of X) {
          let f = this.#n[l].exec(n[l]);
          if (!f) return null;
          let s = {};
          for (let [i, c] of this.#t[l].entries()) if (typeof c == "string" || typeof c == "number") {
            let h = f[i + 1];
            s[c] = h;
          }
          o[l] = { input: n[l] ?? "", groups: s };
        }
        return o;
      }
      static compareComponent(t, r, n) {
        let o = a((i, c) => {
          for (let h of ["type", "modifier", "prefix", "value", "suffix"]) {
            if (i[h] < c[h]) return -1;
            if (i[h] === c[h]) continue;
            return 1;
          }
          return 0;
        }, "comparePart"), l = new P(3, "", "", "", "", 3), f = new P(0, "", "", "", "", 3), s = a((i, c) => {
          let h = 0;
          for (; h < Math.min(i.length, c.length); ++h) {
            let p = o(i[h], c[h]);
            if (p) return p;
          }
          return i.length === c.length ? 0 : o(i[h] ?? l, c[h] ?? l);
        }, "comparePartList");
        return !r.#e[t] && !n.#e[t] ? 0 : r.#e[t] && !n.#e[t] ? s(r.#s[t], [f]) : !r.#e[t] && n.#e[t] ? s([f], n.#s[t]) : s(r.#s[t], n.#s[t]);
      }
      get protocol() {
        return this.#e.protocol;
      }
      get username() {
        return this.#e.username;
      }
      get password() {
        return this.#e.password;
      }
      get hostname() {
        return this.#e.hostname;
      }
      get port() {
        return this.#e.port;
      }
      get pathname() {
        return this.#e.pathname;
      }
      get search() {
        return this.#e.search;
      }
      get hash() {
        return this.#e.hash;
      }
      get hasRegExpGroups() {
        return this.#l;
      }
    };
    a(M, "URLPattern");
  }
});

// ../../node_modules/urlpattern-polyfill/index.cjs
var require_urlpattern_polyfill = __commonJS({
  "../../node_modules/urlpattern-polyfill/index.cjs"(exports, module) {
    var { URLPattern } = require_urlpattern();
    module.exports = { URLPattern };
    if (!globalThis.URLPattern) {
      globalThis.URLPattern = URLPattern;
    }
  }
});

// ../../node_modules/@whatwg-node/promise-helpers/cjs/index.js
var require_cjs = __commonJS({
  "../../node_modules/@whatwg-node/promise-helpers/cjs/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isPromise = isPromise2;
    exports.isActualPromise = isActualPromise2;
    exports.handleMaybePromise = handleMaybePromise2;
    exports.fakePromise = fakePromise2;
    exports.createDeferredPromise = createDeferredPromise2;
    exports.iterateAsync = iterateAsync2;
    exports.iterateAsyncVoid = iterateAsync2;
    exports.fakeRejectPromise = fakeRejectPromise2;
    exports.mapMaybePromise = mapMaybePromise;
    exports.mapAsyncIterator = mapAsyncIterator;
    exports.promiseLikeFinally = promiseLikeFinally2;
    exports.unfakePromise = unfakePromise2;
    var kFakePromise2 = /* @__PURE__ */ Symbol.for("@whatwg-node/promise-helpers/FakePromise");
    function isPromise2(value) {
      return value?.then != null;
    }
    function isActualPromise2(value) {
      const maybePromise = value;
      return maybePromise && maybePromise.then && maybePromise.catch && maybePromise.finally;
    }
    function handleMaybePromise2(inputFactory, outputSuccessFactory, outputErrorFactory, finallyFactory) {
      let result$ = fakePromise2().then(inputFactory).then(outputSuccessFactory, outputErrorFactory);
      if (finallyFactory) {
        result$ = result$.finally(finallyFactory);
      }
      return unfakePromise2(result$);
    }
    function fakePromise2(value) {
      if (value && isActualPromise2(value)) {
        return value;
      }
      if (isPromise2(value)) {
        return {
          then: (resolve, reject) => fakePromise2(value.then(resolve, reject)),
          catch: (reject) => fakePromise2(value.then((res) => res, reject)),
          finally: (cb) => fakePromise2(cb ? promiseLikeFinally2(value, cb) : value),
          [Symbol.toStringTag]: "Promise"
        };
      }
      return {
        then(resolve) {
          if (resolve) {
            try {
              return fakePromise2(resolve(value));
            } catch (err) {
              return fakeRejectPromise2(err);
            }
          }
          return this;
        },
        catch() {
          return this;
        },
        finally(cb) {
          if (cb) {
            try {
              return fakePromise2(cb()).then(() => value, () => value);
            } catch (err) {
              return fakeRejectPromise2(err);
            }
          }
          return this;
        },
        [Symbol.toStringTag]: "Promise",
        __fakePromiseValue: value,
        [kFakePromise2]: "resolved"
      };
    }
    function createDeferredPromise2() {
      if (Promise.withResolvers) {
        return Promise.withResolvers();
      }
      let resolveFn;
      let rejectFn;
      const promise = new Promise(function deferredPromiseExecutor(resolve, reject) {
        resolveFn = resolve;
        rejectFn = reject;
      });
      return {
        promise,
        get resolve() {
          return resolveFn;
        },
        get reject() {
          return rejectFn;
        }
      };
    }
    function iterateAsync2(iterable, callback, results) {
      if (iterable?.length === 0) {
        return;
      }
      const iterator = iterable[Symbol.iterator]();
      let index = 0;
      function iterate() {
        const { done: endOfIterator, value } = iterator.next();
        if (endOfIterator) {
          return;
        }
        let endedEarly = false;
        function endEarly() {
          endedEarly = true;
        }
        return handleMaybePromise2(function handleCallback() {
          return callback(value, endEarly, index++);
        }, function handleCallbackResult(result) {
          if (result) {
            results?.push(result);
          }
          if (endedEarly) {
            return;
          }
          return iterate();
        });
      }
      return iterate();
    }
    function fakeRejectPromise2(error) {
      return {
        then(_resolve, reject) {
          if (reject) {
            try {
              return fakePromise2(reject(error));
            } catch (err) {
              return fakeRejectPromise2(err);
            }
          }
          return this;
        },
        catch(reject) {
          if (reject) {
            try {
              return fakePromise2(reject(error));
            } catch (err) {
              return fakeRejectPromise2(err);
            }
          }
          return this;
        },
        finally(cb) {
          if (cb) {
            try {
              cb();
            } catch (err) {
              return fakeRejectPromise2(err);
            }
          }
          return this;
        },
        __fakeRejectError: error,
        [Symbol.toStringTag]: "Promise",
        [kFakePromise2]: "rejected"
      };
    }
    function mapMaybePromise(input, onSuccess, onError) {
      return handleMaybePromise2(() => input, onSuccess, onError);
    }
    function mapAsyncIterator(iterator, onNext, onError, onEnd) {
      if (Symbol.asyncIterator in iterator) {
        iterator = iterator[Symbol.asyncIterator]();
      }
      let $return;
      let abruptClose;
      let onEndWithValue;
      if (onEnd) {
        let onEndWithValueResult;
        onEndWithValue = (value) => {
          onEndWithValueResult ||= handleMaybePromise2(onEnd, () => value, () => value);
          return onEndWithValueResult;
        };
      }
      if (typeof iterator.return === "function") {
        $return = iterator.return;
        abruptClose = (error) => {
          const rethrow = () => {
            throw error;
          };
          return $return.call(iterator).then(rethrow, rethrow);
        };
      }
      function mapResult(result) {
        if (result.done) {
          return onEndWithValue ? onEndWithValue(result) : result;
        }
        return handleMaybePromise2(() => result.value, (value) => handleMaybePromise2(() => onNext(value), iteratorResult, abruptClose));
      }
      let mapReject;
      if (onError) {
        let onErrorResult;
        const reject = onError;
        mapReject = (error) => {
          onErrorResult ||= handleMaybePromise2(() => error, (error2) => handleMaybePromise2(() => reject(error2), iteratorResult, abruptClose));
          return onErrorResult;
        };
      }
      return {
        next() {
          return iterator.next().then(mapResult, mapReject);
        },
        return() {
          const res$ = $return ? $return.call(iterator).then(mapResult, mapReject) : fakePromise2({ value: void 0, done: true });
          return onEndWithValue ? res$.then(onEndWithValue) : res$;
        },
        throw(error) {
          if (typeof iterator.throw === "function") {
            return iterator.throw(error).then(mapResult, mapReject);
          }
          if (abruptClose) {
            return abruptClose(error);
          }
          return fakeRejectPromise2(error);
        },
        [Symbol.asyncIterator]() {
          return this;
        }
      };
    }
    function iteratorResult(value) {
      return { value, done: false };
    }
    function isFakePromise2(value) {
      return value?.[kFakePromise2] === "resolved";
    }
    function isFakeRejectPromise2(value) {
      return value?.[kFakePromise2] === "rejected";
    }
    function promiseLikeFinally2(value, onFinally) {
      if ("finally" in value) {
        return value.finally(onFinally);
      }
      return value.then((res) => {
        const finallyRes = onFinally();
        return isPromise2(finallyRes) ? finallyRes.then(() => res) : res;
      }, (err) => {
        const finallyRes = onFinally();
        if (isPromise2(finallyRes)) {
          return finallyRes.then(() => {
            throw err;
          });
        } else {
          throw err;
        }
      });
    }
    function unfakePromise2(promise) {
      if (isFakePromise2(promise)) {
        return promise.__fakePromiseValue;
      }
      if (isFakeRejectPromise2(promise)) {
        throw promise.__fakeRejectError;
      }
      return promise;
    }
  }
});

// ../../node_modules/@fastify/busboy/deps/streamsearch/sbmh.js
var require_sbmh = __commonJS({
  "../../node_modules/@fastify/busboy/deps/streamsearch/sbmh.js"(exports, module) {
    "use strict";
    var { EventEmitter } = __require("node:events");
    var { inherits } = __require("node:util");
    function SBMH(needle) {
      if (typeof needle === "string") {
        needle = Buffer.from(needle);
      }
      if (!Buffer.isBuffer(needle)) {
        throw new TypeError("The needle has to be a String or a Buffer.");
      }
      const needleLength = needle.length;
      const needleLastCharIndex = needleLength - 1;
      if (needleLength === 0) {
        throw new Error("The needle cannot be an empty String/Buffer.");
      }
      if (needleLength > 256) {
        throw new Error("The needle cannot have a length bigger than 256.");
      }
      this.maxMatches = Infinity;
      this.matches = 0;
      this._occ = new Uint8Array(256).fill(needleLength);
      this._lookbehind_size = 0;
      this._needle = needle;
      this._bufpos = 0;
      this._lookbehind = Buffer.alloc(needleLastCharIndex);
      for (var i = 0; i < needleLastCharIndex; ++i) {
        this._occ[needle[i]] = needleLastCharIndex - i;
      }
    }
    inherits(SBMH, EventEmitter);
    SBMH.prototype.reset = function() {
      this._lookbehind_size = 0;
      this.matches = 0;
      this._bufpos = 0;
    };
    SBMH.prototype.push = function(chunk, pos) {
      if (!Buffer.isBuffer(chunk)) {
        chunk = Buffer.from(chunk, "binary");
      }
      const chlen = chunk.length;
      this._bufpos = pos || 0;
      let r;
      while (r !== chlen && this.matches < this.maxMatches) {
        r = this._sbmh_feed(chunk);
      }
      return r;
    };
    SBMH.prototype._sbmh_feed = function(data) {
      const len = data.length;
      const needle = this._needle;
      const needleLength = needle.length;
      const needleLastCharIndex = needleLength - 1;
      const needleLastChar = needle[needleLastCharIndex];
      let pos = -this._lookbehind_size;
      let ch;
      if (pos < 0) {
        while (pos < 0 && pos <= len - needleLength) {
          ch = data[pos + needleLastCharIndex];
          if (ch === needleLastChar && this._sbmh_memcmp(data, pos, needleLastCharIndex)) {
            this._lookbehind_size = 0;
            ++this.matches;
            this.emit("info", true);
            return this._bufpos = pos + needleLength;
          }
          pos += this._occ[ch];
        }
        while (pos < 0 && !this._sbmh_memcmp(data, pos, len - pos)) {
          ++pos;
        }
        if (pos >= 0) {
          this.emit("info", false, this._lookbehind, 0, this._lookbehind_size);
          this._lookbehind_size = 0;
        } else {
          const bytesToCutOff = this._lookbehind_size + pos;
          if (bytesToCutOff > 0) {
            this.emit("info", false, this._lookbehind, 0, bytesToCutOff);
          }
          this._lookbehind_size -= bytesToCutOff;
          this._lookbehind.copy(this._lookbehind, 0, bytesToCutOff, this._lookbehind_size);
          data.copy(this._lookbehind, this._lookbehind_size);
          this._lookbehind_size += len;
          this._bufpos = len;
          return len;
        }
      }
      pos = data.indexOf(needle, pos + this._bufpos);
      if (pos !== -1) {
        ++this.matches;
        if (pos === 0) {
          this.emit("info", true);
        } else {
          this.emit("info", true, data, this._bufpos, pos);
        }
        return this._bufpos = pos + needleLength;
      }
      pos = len - needleLastCharIndex;
      if (pos < 0) {
        pos = 0;
      }
      while (pos !== len && (data[pos] !== needle[0] || Buffer.compare(
        data.subarray(pos + 1, len),
        needle.subarray(1, len - pos)
      ) !== 0)) {
        ++pos;
      }
      if (pos !== len) {
        data.copy(this._lookbehind, 0, pos, len);
        this._lookbehind_size = len - pos;
      }
      if (pos !== 0) {
        this.emit("info", false, data, this._bufpos, pos);
      }
      this._bufpos = len;
      return len;
    };
    SBMH.prototype._sbmh_lookup_char = function(data, pos) {
      return pos < 0 ? this._lookbehind[this._lookbehind_size + pos] : data[pos];
    };
    SBMH.prototype._sbmh_memcmp = function(data, pos, len) {
      for (var i = 0; i < len; ++i) {
        if (this._sbmh_lookup_char(data, pos + i) !== this._needle[i]) {
          return false;
        }
      }
      return true;
    };
    module.exports = SBMH;
  }
});

// ../../node_modules/@fastify/busboy/deps/dicer/lib/PartStream.js
var require_PartStream = __commonJS({
  "../../node_modules/@fastify/busboy/deps/dicer/lib/PartStream.js"(exports, module) {
    "use strict";
    var inherits = __require("node:util").inherits;
    var ReadableStream = __require("node:stream").Readable;
    function PartStream(opts) {
      ReadableStream.call(this, opts);
    }
    inherits(PartStream, ReadableStream);
    PartStream.prototype._read = function(n) {
    };
    module.exports = PartStream;
  }
});

// ../../node_modules/@fastify/busboy/lib/utils/getLimit.js
var require_getLimit = __commonJS({
  "../../node_modules/@fastify/busboy/lib/utils/getLimit.js"(exports, module) {
    "use strict";
    module.exports = function getLimit(limits, name2, defaultLimit) {
      if (!limits || limits[name2] === void 0 || limits[name2] === null) {
        return defaultLimit;
      }
      if (typeof limits[name2] !== "number" || isNaN(limits[name2])) {
        throw new TypeError("Limit " + name2 + " is not a valid number");
      }
      return limits[name2];
    };
  }
});

// ../../node_modules/@fastify/busboy/deps/dicer/lib/HeaderParser.js
var require_HeaderParser = __commonJS({
  "../../node_modules/@fastify/busboy/deps/dicer/lib/HeaderParser.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("node:events").EventEmitter;
    var inherits = __require("node:util").inherits;
    var getLimit = require_getLimit();
    var StreamSearch = require_sbmh();
    var B_DCRLF = Buffer.from("\r\n\r\n");
    var RE_CRLF = /\r\n/g;
    var RE_HDR = /^([^:]+):[ \t]?([\x00-\xFF]+)?$/;
    function HeaderParser(cfg) {
      EventEmitter.call(this);
      cfg = cfg || {};
      const self = this;
      this.nread = 0;
      this.maxed = false;
      this.npairs = 0;
      this.maxHeaderPairs = getLimit(cfg, "maxHeaderPairs", 2e3);
      this.maxHeaderSize = getLimit(cfg, "maxHeaderSize", 80 * 1024);
      this.buffer = "";
      this.header = {};
      this.finished = false;
      this.ss = new StreamSearch(B_DCRLF);
      this.ss.on("info", function(isMatch, data, start, end) {
        if (data && !self.maxed) {
          if (self.nread + end - start >= self.maxHeaderSize) {
            end = self.maxHeaderSize - self.nread + start;
            self.nread = self.maxHeaderSize;
            self.maxed = true;
          } else {
            self.nread += end - start;
          }
          self.buffer += data.toString("binary", start, end);
        }
        if (isMatch) {
          self._finish();
        }
      });
    }
    inherits(HeaderParser, EventEmitter);
    HeaderParser.prototype.push = function(data) {
      const r = this.ss.push(data);
      if (this.finished) {
        return r;
      }
    };
    HeaderParser.prototype.reset = function() {
      this.finished = false;
      this.buffer = "";
      this.header = {};
      this.ss.reset();
    };
    HeaderParser.prototype._finish = function() {
      if (this.buffer) {
        this._parseHeader();
      }
      this.ss.matches = this.ss.maxMatches;
      const header = this.header;
      this.header = {};
      this.buffer = "";
      this.finished = true;
      this.nread = this.npairs = 0;
      this.maxed = false;
      this.emit("header", header);
    };
    HeaderParser.prototype._parseHeader = function() {
      if (this.npairs === this.maxHeaderPairs) {
        return;
      }
      const lines = this.buffer.split(RE_CRLF);
      const len = lines.length;
      let m, h;
      for (var i = 0; i < len; ++i) {
        if (lines[i].length === 0) {
          continue;
        }
        if (lines[i][0] === "	" || lines[i][0] === " ") {
          if (h) {
            this.header[h][this.header[h].length - 1] += lines[i];
            continue;
          }
        }
        const posColon = lines[i].indexOf(":");
        if (posColon === -1 || posColon === 0) {
          return;
        }
        m = RE_HDR.exec(lines[i]);
        h = m[1].toLowerCase();
        this.header[h] = this.header[h] || [];
        this.header[h].push(m[2] || "");
        if (++this.npairs === this.maxHeaderPairs) {
          break;
        }
      }
    };
    module.exports = HeaderParser;
  }
});

// ../../node_modules/@fastify/busboy/deps/dicer/lib/Dicer.js
var require_Dicer = __commonJS({
  "../../node_modules/@fastify/busboy/deps/dicer/lib/Dicer.js"(exports, module) {
    "use strict";
    var WritableStream = __require("node:stream").Writable;
    var inherits = __require("node:util").inherits;
    var StreamSearch = require_sbmh();
    var PartStream = require_PartStream();
    var HeaderParser = require_HeaderParser();
    var DASH = 45;
    var B_ONEDASH = Buffer.from("-");
    var B_CRLF = Buffer.from("\r\n");
    var EMPTY_FN = function() {
    };
    function Dicer(cfg) {
      if (!(this instanceof Dicer)) {
        return new Dicer(cfg);
      }
      WritableStream.call(this, cfg);
      if (!cfg || !cfg.headerFirst && typeof cfg.boundary !== "string") {
        throw new TypeError("Boundary required");
      }
      if (typeof cfg.boundary === "string") {
        this.setBoundary(cfg.boundary);
      } else {
        this._bparser = void 0;
      }
      this._headerFirst = cfg.headerFirst;
      this._dashes = 0;
      this._parts = 0;
      this._finished = false;
      this._realFinish = false;
      this._isPreamble = true;
      this._justMatched = false;
      this._firstWrite = true;
      this._inHeader = true;
      this._part = void 0;
      this._cb = void 0;
      this._ignoreData = false;
      this._partOpts = { highWaterMark: cfg.partHwm };
      this._pause = false;
      const self = this;
      this._hparser = new HeaderParser(cfg);
      this._hparser.on("header", function(header) {
        self._inHeader = false;
        self._part.emit("header", header);
      });
    }
    inherits(Dicer, WritableStream);
    Dicer.prototype.emit = function(ev) {
      if (ev === "finish" && !this._realFinish) {
        if (!this._finished) {
          const self = this;
          process.nextTick(function() {
            self.emit("error", new Error("Unexpected end of multipart data"));
            if (self._part && !self._ignoreData) {
              const type = self._isPreamble ? "Preamble" : "Part";
              self._part.emit("error", new Error(type + " terminated early due to unexpected end of multipart data"));
              self._part.push(null);
              process.nextTick(function() {
                self._realFinish = true;
                self.emit("finish");
                self._realFinish = false;
              });
              return;
            }
            self._realFinish = true;
            self.emit("finish");
            self._realFinish = false;
          });
        }
      } else {
        WritableStream.prototype.emit.apply(this, arguments);
      }
    };
    Dicer.prototype._write = function(data, encoding, cb) {
      if (!this._hparser && !this._bparser) {
        return cb();
      }
      if (this._headerFirst && this._isPreamble) {
        if (!this._part) {
          this._part = new PartStream(this._partOpts);
          if (this.listenerCount("preamble") !== 0) {
            this.emit("preamble", this._part);
          } else {
            this._ignore();
          }
        }
        const r = this._hparser.push(data);
        if (!this._inHeader && r !== void 0 && r < data.length) {
          data = data.slice(r);
        } else {
          return cb();
        }
      }
      if (this._firstWrite) {
        this._bparser.push(B_CRLF);
        this._firstWrite = false;
      }
      this._bparser.push(data);
      if (this._pause) {
        this._cb = cb;
      } else {
        cb();
      }
    };
    Dicer.prototype.reset = function() {
      this._part = void 0;
      this._bparser = void 0;
      this._hparser = void 0;
    };
    Dicer.prototype.setBoundary = function(boundary) {
      const self = this;
      this._bparser = new StreamSearch("\r\n--" + boundary);
      this._bparser.on("info", function(isMatch, data, start, end) {
        self._oninfo(isMatch, data, start, end);
      });
    };
    Dicer.prototype._ignore = function() {
      if (this._part && !this._ignoreData) {
        this._ignoreData = true;
        this._part.on("error", EMPTY_FN);
        this._part.resume();
      }
    };
    Dicer.prototype._oninfo = function(isMatch, data, start, end) {
      let buf;
      const self = this;
      let i = 0;
      let r;
      let shouldWriteMore = true;
      if (!this._part && this._justMatched && data) {
        while (this._dashes < 2 && start + i < end) {
          if (data[start + i] === DASH) {
            ++i;
            ++this._dashes;
          } else {
            if (this._dashes) {
              buf = B_ONEDASH;
            }
            this._dashes = 0;
            break;
          }
        }
        if (this._dashes === 2) {
          if (start + i < end && this.listenerCount("trailer") !== 0) {
            this.emit("trailer", data.slice(start + i, end));
          }
          this.reset();
          this._finished = true;
          if (self._parts === 0) {
            self._realFinish = true;
            self.emit("finish");
            self._realFinish = false;
          }
        }
        if (this._dashes) {
          return;
        }
      }
      if (this._justMatched) {
        this._justMatched = false;
      }
      if (!this._part) {
        this._part = new PartStream(this._partOpts);
        this._part._read = function(n) {
          self._unpause();
        };
        if (this._isPreamble && this.listenerCount("preamble") !== 0) {
          this.emit("preamble", this._part);
        } else if (this._isPreamble !== true && this.listenerCount("part") !== 0) {
          this.emit("part", this._part);
        } else {
          this._ignore();
        }
        if (!this._isPreamble) {
          this._inHeader = true;
        }
      }
      if (data && start < end && !this._ignoreData) {
        if (this._isPreamble || !this._inHeader) {
          if (buf) {
            shouldWriteMore = this._part.push(buf);
          }
          shouldWriteMore = this._part.push(data.slice(start, end));
          if (!shouldWriteMore) {
            this._pause = true;
          }
        } else if (!this._isPreamble && this._inHeader) {
          if (buf) {
            this._hparser.push(buf);
          }
          r = this._hparser.push(data.slice(start, end));
          if (!this._inHeader && r !== void 0 && r < end) {
            this._oninfo(false, data, start + r, end);
          }
        }
      }
      if (isMatch) {
        this._hparser.reset();
        if (this._isPreamble) {
          this._isPreamble = false;
        } else {
          if (start !== end) {
            ++this._parts;
            this._part.on("end", function() {
              if (--self._parts === 0) {
                if (self._finished) {
                  self._realFinish = true;
                  self.emit("finish");
                  self._realFinish = false;
                } else {
                  self._unpause();
                }
              }
            });
          }
        }
        this._part.push(null);
        this._part = void 0;
        this._ignoreData = false;
        this._justMatched = true;
        this._dashes = 0;
      }
    };
    Dicer.prototype._unpause = function() {
      if (!this._pause) {
        return;
      }
      this._pause = false;
      if (this._cb) {
        const cb = this._cb;
        this._cb = void 0;
        cb();
      }
    };
    module.exports = Dicer;
  }
});

// ../../node_modules/@fastify/busboy/lib/utils/decodeText.js
var require_decodeText = __commonJS({
  "../../node_modules/@fastify/busboy/lib/utils/decodeText.js"(exports, module) {
    "use strict";
    var utf8Decoder = new TextDecoder("utf-8");
    var textDecoders = /* @__PURE__ */ new Map([
      ["utf-8", utf8Decoder],
      ["utf8", utf8Decoder]
    ]);
    function getDecoder(charset) {
      let lc;
      while (true) {
        switch (charset) {
          case "utf-8":
          case "utf8":
            return decoders.utf8;
          case "latin1":
          case "ascii":
          // TODO: Make these a separate, strict decoder?
          case "us-ascii":
          case "iso-8859-1":
          case "iso8859-1":
          case "iso88591":
          case "iso_8859-1":
          case "windows-1252":
          case "iso_8859-1:1987":
          case "cp1252":
          case "x-cp1252":
            return decoders.latin1;
          case "utf16le":
          case "utf-16le":
          case "ucs2":
          case "ucs-2":
            return decoders.utf16le;
          case "base64":
            return decoders.base64;
          default:
            if (lc === void 0) {
              lc = true;
              charset = charset.toLowerCase();
              continue;
            }
            return decoders.other.bind(charset);
        }
      }
    }
    var decoders = {
      utf8: (data, sourceEncoding) => {
        if (data.length === 0) {
          return "";
        }
        if (typeof data === "string") {
          data = Buffer.from(data, sourceEncoding);
        }
        return data.utf8Slice(0, data.length);
      },
      latin1: (data, sourceEncoding) => {
        if (data.length === 0) {
          return "";
        }
        if (typeof data === "string") {
          return data;
        }
        return data.latin1Slice(0, data.length);
      },
      utf16le: (data, sourceEncoding) => {
        if (data.length === 0) {
          return "";
        }
        if (typeof data === "string") {
          data = Buffer.from(data, sourceEncoding);
        }
        return data.ucs2Slice(0, data.length);
      },
      base64: (data, sourceEncoding) => {
        if (data.length === 0) {
          return "";
        }
        if (typeof data === "string") {
          data = Buffer.from(data, sourceEncoding);
        }
        return data.base64Slice(0, data.length);
      },
      other: (data, sourceEncoding) => {
        if (data.length === 0) {
          return "";
        }
        if (typeof data === "string") {
          data = Buffer.from(data, sourceEncoding);
        }
        if (textDecoders.has(exports.toString())) {
          try {
            return textDecoders.get(exports).decode(data);
          } catch {
          }
        }
        return typeof data === "string" ? data : data.toString();
      }
    };
    function decodeText(text, sourceEncoding, destEncoding) {
      if (text) {
        return getDecoder(destEncoding)(text, sourceEncoding);
      }
      return text;
    }
    module.exports = decodeText;
  }
});

// ../../node_modules/@fastify/busboy/lib/utils/parseParams.js
var require_parseParams = __commonJS({
  "../../node_modules/@fastify/busboy/lib/utils/parseParams.js"(exports, module) {
    "use strict";
    var decodeText = require_decodeText();
    var RE_ENCODED = /%[a-fA-F0-9][a-fA-F0-9]/g;
    var EncodedLookup = {
      "%00": "\0",
      "%01": "",
      "%02": "",
      "%03": "",
      "%04": "",
      "%05": "",
      "%06": "",
      "%07": "\x07",
      "%08": "\b",
      "%09": "	",
      "%0a": "\n",
      "%0A": "\n",
      "%0b": "\v",
      "%0B": "\v",
      "%0c": "\f",
      "%0C": "\f",
      "%0d": "\r",
      "%0D": "\r",
      "%0e": "",
      "%0E": "",
      "%0f": "",
      "%0F": "",
      "%10": "",
      "%11": "",
      "%12": "",
      "%13": "",
      "%14": "",
      "%15": "",
      "%16": "",
      "%17": "",
      "%18": "",
      "%19": "",
      "%1a": "",
      "%1A": "",
      "%1b": "\x1B",
      "%1B": "\x1B",
      "%1c": "",
      "%1C": "",
      "%1d": "",
      "%1D": "",
      "%1e": "",
      "%1E": "",
      "%1f": "",
      "%1F": "",
      "%20": " ",
      "%21": "!",
      "%22": '"',
      "%23": "#",
      "%24": "$",
      "%25": "%",
      "%26": "&",
      "%27": "'",
      "%28": "(",
      "%29": ")",
      "%2a": "*",
      "%2A": "*",
      "%2b": "+",
      "%2B": "+",
      "%2c": ",",
      "%2C": ",",
      "%2d": "-",
      "%2D": "-",
      "%2e": ".",
      "%2E": ".",
      "%2f": "/",
      "%2F": "/",
      "%30": "0",
      "%31": "1",
      "%32": "2",
      "%33": "3",
      "%34": "4",
      "%35": "5",
      "%36": "6",
      "%37": "7",
      "%38": "8",
      "%39": "9",
      "%3a": ":",
      "%3A": ":",
      "%3b": ";",
      "%3B": ";",
      "%3c": "<",
      "%3C": "<",
      "%3d": "=",
      "%3D": "=",
      "%3e": ">",
      "%3E": ">",
      "%3f": "?",
      "%3F": "?",
      "%40": "@",
      "%41": "A",
      "%42": "B",
      "%43": "C",
      "%44": "D",
      "%45": "E",
      "%46": "F",
      "%47": "G",
      "%48": "H",
      "%49": "I",
      "%4a": "J",
      "%4A": "J",
      "%4b": "K",
      "%4B": "K",
      "%4c": "L",
      "%4C": "L",
      "%4d": "M",
      "%4D": "M",
      "%4e": "N",
      "%4E": "N",
      "%4f": "O",
      "%4F": "O",
      "%50": "P",
      "%51": "Q",
      "%52": "R",
      "%53": "S",
      "%54": "T",
      "%55": "U",
      "%56": "V",
      "%57": "W",
      "%58": "X",
      "%59": "Y",
      "%5a": "Z",
      "%5A": "Z",
      "%5b": "[",
      "%5B": "[",
      "%5c": "\\",
      "%5C": "\\",
      "%5d": "]",
      "%5D": "]",
      "%5e": "^",
      "%5E": "^",
      "%5f": "_",
      "%5F": "_",
      "%60": "`",
      "%61": "a",
      "%62": "b",
      "%63": "c",
      "%64": "d",
      "%65": "e",
      "%66": "f",
      "%67": "g",
      "%68": "h",
      "%69": "i",
      "%6a": "j",
      "%6A": "j",
      "%6b": "k",
      "%6B": "k",
      "%6c": "l",
      "%6C": "l",
      "%6d": "m",
      "%6D": "m",
      "%6e": "n",
      "%6E": "n",
      "%6f": "o",
      "%6F": "o",
      "%70": "p",
      "%71": "q",
      "%72": "r",
      "%73": "s",
      "%74": "t",
      "%75": "u",
      "%76": "v",
      "%77": "w",
      "%78": "x",
      "%79": "y",
      "%7a": "z",
      "%7A": "z",
      "%7b": "{",
      "%7B": "{",
      "%7c": "|",
      "%7C": "|",
      "%7d": "}",
      "%7D": "}",
      "%7e": "~",
      "%7E": "~",
      "%7f": "\x7F",
      "%7F": "\x7F",
      "%80": "\x80",
      "%81": "\x81",
      "%82": "\x82",
      "%83": "\x83",
      "%84": "\x84",
      "%85": "\x85",
      "%86": "\x86",
      "%87": "\x87",
      "%88": "\x88",
      "%89": "\x89",
      "%8a": "\x8A",
      "%8A": "\x8A",
      "%8b": "\x8B",
      "%8B": "\x8B",
      "%8c": "\x8C",
      "%8C": "\x8C",
      "%8d": "\x8D",
      "%8D": "\x8D",
      "%8e": "\x8E",
      "%8E": "\x8E",
      "%8f": "\x8F",
      "%8F": "\x8F",
      "%90": "\x90",
      "%91": "\x91",
      "%92": "\x92",
      "%93": "\x93",
      "%94": "\x94",
      "%95": "\x95",
      "%96": "\x96",
      "%97": "\x97",
      "%98": "\x98",
      "%99": "\x99",
      "%9a": "\x9A",
      "%9A": "\x9A",
      "%9b": "\x9B",
      "%9B": "\x9B",
      "%9c": "\x9C",
      "%9C": "\x9C",
      "%9d": "\x9D",
      "%9D": "\x9D",
      "%9e": "\x9E",
      "%9E": "\x9E",
      "%9f": "\x9F",
      "%9F": "\x9F",
      "%a0": "\xA0",
      "%A0": "\xA0",
      "%a1": "\xA1",
      "%A1": "\xA1",
      "%a2": "\xA2",
      "%A2": "\xA2",
      "%a3": "\xA3",
      "%A3": "\xA3",
      "%a4": "\xA4",
      "%A4": "\xA4",
      "%a5": "\xA5",
      "%A5": "\xA5",
      "%a6": "\xA6",
      "%A6": "\xA6",
      "%a7": "\xA7",
      "%A7": "\xA7",
      "%a8": "\xA8",
      "%A8": "\xA8",
      "%a9": "\xA9",
      "%A9": "\xA9",
      "%aa": "\xAA",
      "%Aa": "\xAA",
      "%aA": "\xAA",
      "%AA": "\xAA",
      "%ab": "\xAB",
      "%Ab": "\xAB",
      "%aB": "\xAB",
      "%AB": "\xAB",
      "%ac": "\xAC",
      "%Ac": "\xAC",
      "%aC": "\xAC",
      "%AC": "\xAC",
      "%ad": "\xAD",
      "%Ad": "\xAD",
      "%aD": "\xAD",
      "%AD": "\xAD",
      "%ae": "\xAE",
      "%Ae": "\xAE",
      "%aE": "\xAE",
      "%AE": "\xAE",
      "%af": "\xAF",
      "%Af": "\xAF",
      "%aF": "\xAF",
      "%AF": "\xAF",
      "%b0": "\xB0",
      "%B0": "\xB0",
      "%b1": "\xB1",
      "%B1": "\xB1",
      "%b2": "\xB2",
      "%B2": "\xB2",
      "%b3": "\xB3",
      "%B3": "\xB3",
      "%b4": "\xB4",
      "%B4": "\xB4",
      "%b5": "\xB5",
      "%B5": "\xB5",
      "%b6": "\xB6",
      "%B6": "\xB6",
      "%b7": "\xB7",
      "%B7": "\xB7",
      "%b8": "\xB8",
      "%B8": "\xB8",
      "%b9": "\xB9",
      "%B9": "\xB9",
      "%ba": "\xBA",
      "%Ba": "\xBA",
      "%bA": "\xBA",
      "%BA": "\xBA",
      "%bb": "\xBB",
      "%Bb": "\xBB",
      "%bB": "\xBB",
      "%BB": "\xBB",
      "%bc": "\xBC",
      "%Bc": "\xBC",
      "%bC": "\xBC",
      "%BC": "\xBC",
      "%bd": "\xBD",
      "%Bd": "\xBD",
      "%bD": "\xBD",
      "%BD": "\xBD",
      "%be": "\xBE",
      "%Be": "\xBE",
      "%bE": "\xBE",
      "%BE": "\xBE",
      "%bf": "\xBF",
      "%Bf": "\xBF",
      "%bF": "\xBF",
      "%BF": "\xBF",
      "%c0": "\xC0",
      "%C0": "\xC0",
      "%c1": "\xC1",
      "%C1": "\xC1",
      "%c2": "\xC2",
      "%C2": "\xC2",
      "%c3": "\xC3",
      "%C3": "\xC3",
      "%c4": "\xC4",
      "%C4": "\xC4",
      "%c5": "\xC5",
      "%C5": "\xC5",
      "%c6": "\xC6",
      "%C6": "\xC6",
      "%c7": "\xC7",
      "%C7": "\xC7",
      "%c8": "\xC8",
      "%C8": "\xC8",
      "%c9": "\xC9",
      "%C9": "\xC9",
      "%ca": "\xCA",
      "%Ca": "\xCA",
      "%cA": "\xCA",
      "%CA": "\xCA",
      "%cb": "\xCB",
      "%Cb": "\xCB",
      "%cB": "\xCB",
      "%CB": "\xCB",
      "%cc": "\xCC",
      "%Cc": "\xCC",
      "%cC": "\xCC",
      "%CC": "\xCC",
      "%cd": "\xCD",
      "%Cd": "\xCD",
      "%cD": "\xCD",
      "%CD": "\xCD",
      "%ce": "\xCE",
      "%Ce": "\xCE",
      "%cE": "\xCE",
      "%CE": "\xCE",
      "%cf": "\xCF",
      "%Cf": "\xCF",
      "%cF": "\xCF",
      "%CF": "\xCF",
      "%d0": "\xD0",
      "%D0": "\xD0",
      "%d1": "\xD1",
      "%D1": "\xD1",
      "%d2": "\xD2",
      "%D2": "\xD2",
      "%d3": "\xD3",
      "%D3": "\xD3",
      "%d4": "\xD4",
      "%D4": "\xD4",
      "%d5": "\xD5",
      "%D5": "\xD5",
      "%d6": "\xD6",
      "%D6": "\xD6",
      "%d7": "\xD7",
      "%D7": "\xD7",
      "%d8": "\xD8",
      "%D8": "\xD8",
      "%d9": "\xD9",
      "%D9": "\xD9",
      "%da": "\xDA",
      "%Da": "\xDA",
      "%dA": "\xDA",
      "%DA": "\xDA",
      "%db": "\xDB",
      "%Db": "\xDB",
      "%dB": "\xDB",
      "%DB": "\xDB",
      "%dc": "\xDC",
      "%Dc": "\xDC",
      "%dC": "\xDC",
      "%DC": "\xDC",
      "%dd": "\xDD",
      "%Dd": "\xDD",
      "%dD": "\xDD",
      "%DD": "\xDD",
      "%de": "\xDE",
      "%De": "\xDE",
      "%dE": "\xDE",
      "%DE": "\xDE",
      "%df": "\xDF",
      "%Df": "\xDF",
      "%dF": "\xDF",
      "%DF": "\xDF",
      "%e0": "\xE0",
      "%E0": "\xE0",
      "%e1": "\xE1",
      "%E1": "\xE1",
      "%e2": "\xE2",
      "%E2": "\xE2",
      "%e3": "\xE3",
      "%E3": "\xE3",
      "%e4": "\xE4",
      "%E4": "\xE4",
      "%e5": "\xE5",
      "%E5": "\xE5",
      "%e6": "\xE6",
      "%E6": "\xE6",
      "%e7": "\xE7",
      "%E7": "\xE7",
      "%e8": "\xE8",
      "%E8": "\xE8",
      "%e9": "\xE9",
      "%E9": "\xE9",
      "%ea": "\xEA",
      "%Ea": "\xEA",
      "%eA": "\xEA",
      "%EA": "\xEA",
      "%eb": "\xEB",
      "%Eb": "\xEB",
      "%eB": "\xEB",
      "%EB": "\xEB",
      "%ec": "\xEC",
      "%Ec": "\xEC",
      "%eC": "\xEC",
      "%EC": "\xEC",
      "%ed": "\xED",
      "%Ed": "\xED",
      "%eD": "\xED",
      "%ED": "\xED",
      "%ee": "\xEE",
      "%Ee": "\xEE",
      "%eE": "\xEE",
      "%EE": "\xEE",
      "%ef": "\xEF",
      "%Ef": "\xEF",
      "%eF": "\xEF",
      "%EF": "\xEF",
      "%f0": "\xF0",
      "%F0": "\xF0",
      "%f1": "\xF1",
      "%F1": "\xF1",
      "%f2": "\xF2",
      "%F2": "\xF2",
      "%f3": "\xF3",
      "%F3": "\xF3",
      "%f4": "\xF4",
      "%F4": "\xF4",
      "%f5": "\xF5",
      "%F5": "\xF5",
      "%f6": "\xF6",
      "%F6": "\xF6",
      "%f7": "\xF7",
      "%F7": "\xF7",
      "%f8": "\xF8",
      "%F8": "\xF8",
      "%f9": "\xF9",
      "%F9": "\xF9",
      "%fa": "\xFA",
      "%Fa": "\xFA",
      "%fA": "\xFA",
      "%FA": "\xFA",
      "%fb": "\xFB",
      "%Fb": "\xFB",
      "%fB": "\xFB",
      "%FB": "\xFB",
      "%fc": "\xFC",
      "%Fc": "\xFC",
      "%fC": "\xFC",
      "%FC": "\xFC",
      "%fd": "\xFD",
      "%Fd": "\xFD",
      "%fD": "\xFD",
      "%FD": "\xFD",
      "%fe": "\xFE",
      "%Fe": "\xFE",
      "%fE": "\xFE",
      "%FE": "\xFE",
      "%ff": "\xFF",
      "%Ff": "\xFF",
      "%fF": "\xFF",
      "%FF": "\xFF"
    };
    function encodedReplacer(match) {
      return EncodedLookup[match];
    }
    var STATE_KEY = 0;
    var STATE_VALUE = 1;
    var STATE_CHARSET = 2;
    var STATE_LANG = 3;
    function parseParams(str) {
      const res = [];
      let state = STATE_KEY;
      let charset = "";
      let inquote = false;
      let escaping = false;
      let p = 0;
      let tmp = "";
      const len = str.length;
      for (var i = 0; i < len; ++i) {
        const char = str[i];
        if (char === "\\" && inquote) {
          if (escaping) {
            escaping = false;
          } else {
            escaping = true;
            continue;
          }
        } else if (char === '"') {
          if (!escaping) {
            if (inquote) {
              inquote = false;
              state = STATE_KEY;
              while (i + 1 < len && str[i + 1] !== ";") {
                ++i;
              }
            } else {
              inquote = true;
            }
            continue;
          } else {
            escaping = false;
          }
        } else {
          if (escaping && inquote) {
            tmp += "\\";
          }
          escaping = false;
          if ((state === STATE_CHARSET || state === STATE_LANG) && char === "'") {
            if (state === STATE_CHARSET) {
              state = STATE_LANG;
              charset = tmp.substring(1);
            } else {
              state = STATE_VALUE;
            }
            tmp = "";
            continue;
          } else if (state === STATE_KEY && (char === "*" || char === "=") && res.length) {
            state = char === "*" ? STATE_CHARSET : STATE_VALUE;
            res[p] = [tmp, void 0];
            tmp = "";
            continue;
          } else if (!inquote && char === ";") {
            state = STATE_KEY;
            if (charset) {
              if (tmp.length) {
                tmp = decodeText(
                  tmp.replace(RE_ENCODED, encodedReplacer),
                  "binary",
                  charset
                );
              }
              charset = "";
            } else if (tmp.length) {
              tmp = decodeText(tmp, "binary", "utf8");
            }
            if (res[p] === void 0) {
              res[p] = tmp;
            } else {
              res[p][1] = tmp;
            }
            tmp = "";
            ++p;
            continue;
          } else if (!inquote && (char === " " || char === "	")) {
            continue;
          }
        }
        tmp += char;
      }
      if (charset && tmp.length) {
        tmp = decodeText(
          tmp.replace(RE_ENCODED, encodedReplacer),
          "binary",
          charset
        );
      } else if (tmp) {
        tmp = decodeText(tmp, "binary", "utf8");
      }
      if (res[p] === void 0) {
        if (tmp) {
          res[p] = tmp;
        }
      } else {
        res[p][1] = tmp;
      }
      return res;
    }
    module.exports = parseParams;
  }
});

// ../../node_modules/@fastify/busboy/lib/utils/basename.js
var require_basename = __commonJS({
  "../../node_modules/@fastify/busboy/lib/utils/basename.js"(exports, module) {
    "use strict";
    module.exports = function basename(path) {
      if (typeof path !== "string") {
        return "";
      }
      for (var i = path.length - 1; i >= 0; --i) {
        switch (path.charCodeAt(i)) {
          case 47:
          // '/'
          case 92:
            path = path.slice(i + 1);
            return path === ".." || path === "." ? "" : path;
        }
      }
      return path === ".." || path === "." ? "" : path;
    };
  }
});

// ../../node_modules/@fastify/busboy/lib/types/multipart.js
var require_multipart = __commonJS({
  "../../node_modules/@fastify/busboy/lib/types/multipart.js"(exports, module) {
    "use strict";
    var { Readable } = __require("node:stream");
    var { inherits } = __require("node:util");
    var Dicer = require_Dicer();
    var parseParams = require_parseParams();
    var decodeText = require_decodeText();
    var basename = require_basename();
    var getLimit = require_getLimit();
    var RE_BOUNDARY = /^boundary$/i;
    var RE_FIELD = /^form-data$/i;
    var RE_CHARSET = /^charset$/i;
    var RE_FILENAME = /^filename$/i;
    var RE_NAME = /^name$/i;
    Multipart.detect = /^multipart\/form-data/i;
    function Multipart(boy, cfg) {
      let i;
      let len;
      const self = this;
      let boundary;
      const limits = cfg.limits;
      const isPartAFile = cfg.isPartAFile || ((fieldName, contentType, fileName) => contentType === "application/octet-stream" || fileName !== void 0);
      const parsedConType = cfg.parsedConType || [];
      const defCharset = cfg.defCharset || "utf8";
      const preservePath = cfg.preservePath;
      const fileOpts = { highWaterMark: cfg.fileHwm };
      for (i = 0, len = parsedConType.length; i < len; ++i) {
        if (Array.isArray(parsedConType[i]) && RE_BOUNDARY.test(parsedConType[i][0])) {
          boundary = parsedConType[i][1];
          break;
        }
      }
      function checkFinished() {
        if (nends === 0 && finished && !boy._done) {
          finished = false;
          self.end();
        }
      }
      if (typeof boundary !== "string") {
        throw new Error("Multipart: Boundary not found");
      }
      const fieldSizeLimit = getLimit(limits, "fieldSize", 1 * 1024 * 1024);
      const fileSizeLimit = getLimit(limits, "fileSize", Infinity);
      const filesLimit = getLimit(limits, "files", Infinity);
      const fieldsLimit = getLimit(limits, "fields", Infinity);
      const partsLimit = getLimit(limits, "parts", Infinity);
      const headerPairsLimit = getLimit(limits, "headerPairs", 2e3);
      const headerSizeLimit = getLimit(limits, "headerSize", 80 * 1024);
      let nfiles = 0;
      let nfields = 0;
      let nends = 0;
      let curFile;
      let curField;
      let finished = false;
      this._needDrain = false;
      this._pause = false;
      this._cb = void 0;
      this._nparts = 0;
      this._boy = boy;
      const parserCfg = {
        boundary,
        maxHeaderPairs: headerPairsLimit,
        maxHeaderSize: headerSizeLimit,
        partHwm: fileOpts.highWaterMark,
        highWaterMark: cfg.highWaterMark
      };
      this.parser = new Dicer(parserCfg);
      this.parser.on("drain", function() {
        self._needDrain = false;
        if (self._cb && !self._pause) {
          const cb = self._cb;
          self._cb = void 0;
          cb();
        }
      }).on("part", function onPart(part) {
        if (++self._nparts > partsLimit) {
          self.parser.removeListener("part", onPart);
          self.parser.on("part", skipPart);
          boy.hitPartsLimit = true;
          boy.emit("partsLimit");
          return skipPart(part);
        }
        if (curField) {
          const field = curField;
          field.emit("end");
          field.removeAllListeners("end");
        }
        part.on("header", function(header) {
          let contype;
          let fieldname;
          let parsed;
          let charset;
          let encoding;
          let filename;
          let nsize = 0;
          if (header["content-type"]) {
            parsed = parseParams(header["content-type"][0]);
            if (parsed[0]) {
              contype = parsed[0].toLowerCase();
              for (i = 0, len = parsed.length; i < len; ++i) {
                if (RE_CHARSET.test(parsed[i][0])) {
                  charset = parsed[i][1].toLowerCase();
                  break;
                }
              }
            }
          }
          if (contype === void 0) {
            contype = "text/plain";
          }
          if (charset === void 0) {
            charset = defCharset;
          }
          if (header["content-disposition"]) {
            parsed = parseParams(header["content-disposition"][0]);
            if (!RE_FIELD.test(parsed[0])) {
              return skipPart(part);
            }
            for (i = 0, len = parsed.length; i < len; ++i) {
              if (RE_NAME.test(parsed[i][0])) {
                fieldname = parsed[i][1];
              } else if (RE_FILENAME.test(parsed[i][0])) {
                filename = parsed[i][1];
                if (!preservePath) {
                  filename = basename(filename);
                }
              }
            }
          } else {
            return skipPart(part);
          }
          if (header["content-transfer-encoding"]) {
            encoding = header["content-transfer-encoding"][0].toLowerCase();
          } else {
            encoding = "7bit";
          }
          let onData, onEnd;
          if (isPartAFile(fieldname, contype, filename)) {
            if (nfiles === filesLimit) {
              if (!boy.hitFilesLimit) {
                boy.hitFilesLimit = true;
                boy.emit("filesLimit");
              }
              return skipPart(part);
            }
            ++nfiles;
            if (boy.listenerCount("file") === 0) {
              self.parser._ignore();
              return;
            }
            ++nends;
            const file = new FileStream(fileOpts);
            curFile = file;
            file.on("end", function() {
              --nends;
              self._pause = false;
              checkFinished();
              if (self._cb && !self._needDrain) {
                const cb = self._cb;
                self._cb = void 0;
                cb();
              }
            });
            file._read = function(n) {
              if (!self._pause) {
                return;
              }
              self._pause = false;
              if (self._cb && !self._needDrain) {
                const cb = self._cb;
                self._cb = void 0;
                cb();
              }
            };
            boy.emit("file", fieldname, file, filename, encoding, contype);
            onData = function(data) {
              if ((nsize += data.length) > fileSizeLimit) {
                const extralen = fileSizeLimit - nsize + data.length;
                if (extralen > 0) {
                  file.push(data.slice(0, extralen));
                }
                file.truncated = true;
                file.bytesRead = fileSizeLimit;
                part.removeAllListeners("data");
                file.emit("limit");
                return;
              } else if (!file.push(data)) {
                self._pause = true;
              }
              file.bytesRead = nsize;
            };
            onEnd = function() {
              curFile = void 0;
              file.push(null);
            };
          } else {
            if (nfields === fieldsLimit) {
              if (!boy.hitFieldsLimit) {
                boy.hitFieldsLimit = true;
                boy.emit("fieldsLimit");
              }
              return skipPart(part);
            }
            ++nfields;
            ++nends;
            let buffer = "";
            let truncated = false;
            curField = part;
            onData = function(data) {
              if ((nsize += data.length) > fieldSizeLimit) {
                const extralen = fieldSizeLimit - (nsize - data.length);
                buffer += data.toString("binary", 0, extralen);
                truncated = true;
                part.removeAllListeners("data");
              } else {
                buffer += data.toString("binary");
              }
            };
            onEnd = function() {
              curField = void 0;
              if (buffer.length) {
                buffer = decodeText(buffer, "binary", charset);
              }
              boy.emit("field", fieldname, buffer, false, truncated, encoding, contype);
              --nends;
              checkFinished();
            };
          }
          part._readableState.sync = false;
          part.on("data", onData);
          part.on("end", onEnd);
        }).on("error", function(err) {
          if (curFile) {
            curFile.emit("error", err);
          }
        });
      }).on("error", function(err) {
        boy.emit("error", err);
      }).on("finish", function() {
        finished = true;
        checkFinished();
      });
    }
    Multipart.prototype.write = function(chunk, cb) {
      const r = this.parser.write(chunk);
      if (r && !this._pause) {
        cb();
      } else {
        this._needDrain = !r;
        this._cb = cb;
      }
    };
    Multipart.prototype.end = function() {
      const self = this;
      if (self.parser.writable) {
        self.parser.end();
      } else if (!self._boy._done) {
        process.nextTick(function() {
          self._boy._done = true;
          self._boy.emit("finish");
        });
      }
    };
    function skipPart(part) {
      part.resume();
    }
    function FileStream(opts) {
      Readable.call(this, opts);
      this.bytesRead = 0;
      this.truncated = false;
    }
    inherits(FileStream, Readable);
    FileStream.prototype._read = function(n) {
    };
    module.exports = Multipart;
  }
});

// ../../node_modules/@fastify/busboy/lib/utils/Decoder.js
var require_Decoder = __commonJS({
  "../../node_modules/@fastify/busboy/lib/utils/Decoder.js"(exports, module) {
    "use strict";
    var RE_PLUS = /\+/g;
    var HEX = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    function Decoder() {
      this.buffer = void 0;
    }
    Decoder.prototype.write = function(str) {
      str = str.replace(RE_PLUS, " ");
      let res = "";
      let i = 0;
      let p = 0;
      const len = str.length;
      for (; i < len; ++i) {
        if (this.buffer !== void 0) {
          if (!HEX[str.charCodeAt(i)]) {
            res += "%" + this.buffer;
            this.buffer = void 0;
            --i;
          } else {
            this.buffer += str[i];
            ++p;
            if (this.buffer.length === 2) {
              res += String.fromCharCode(parseInt(this.buffer, 16));
              this.buffer = void 0;
            }
          }
        } else if (str[i] === "%") {
          if (i > p) {
            res += str.substring(p, i);
            p = i;
          }
          this.buffer = "";
          ++p;
        }
      }
      if (p < len && this.buffer === void 0) {
        res += str.substring(p);
      }
      return res;
    };
    Decoder.prototype.reset = function() {
      this.buffer = void 0;
    };
    module.exports = Decoder;
  }
});

// ../../node_modules/@fastify/busboy/lib/types/urlencoded.js
var require_urlencoded = __commonJS({
  "../../node_modules/@fastify/busboy/lib/types/urlencoded.js"(exports, module) {
    "use strict";
    var Decoder = require_Decoder();
    var decodeText = require_decodeText();
    var getLimit = require_getLimit();
    var RE_CHARSET = /^charset$/i;
    UrlEncoded.detect = /^application\/x-www-form-urlencoded/i;
    function UrlEncoded(boy, cfg) {
      const limits = cfg.limits;
      const parsedConType = cfg.parsedConType;
      this.boy = boy;
      this.fieldSizeLimit = getLimit(limits, "fieldSize", 1 * 1024 * 1024);
      this.fieldNameSizeLimit = getLimit(limits, "fieldNameSize", 100);
      this.fieldsLimit = getLimit(limits, "fields", Infinity);
      let charset;
      for (var i = 0, len = parsedConType.length; i < len; ++i) {
        if (Array.isArray(parsedConType[i]) && RE_CHARSET.test(parsedConType[i][0])) {
          charset = parsedConType[i][1].toLowerCase();
          break;
        }
      }
      if (charset === void 0) {
        charset = cfg.defCharset || "utf8";
      }
      this.decoder = new Decoder();
      this.charset = charset;
      this._fields = 0;
      this._state = "key";
      this._checkingBytes = true;
      this._bytesKey = 0;
      this._bytesVal = 0;
      this._key = "";
      this._val = "";
      this._keyTrunc = false;
      this._valTrunc = false;
      this._hitLimit = false;
    }
    UrlEncoded.prototype.write = function(data, cb) {
      if (this._fields === this.fieldsLimit) {
        if (!this.boy.hitFieldsLimit) {
          this.boy.hitFieldsLimit = true;
          this.boy.emit("fieldsLimit");
        }
        return cb();
      }
      let idxeq;
      let idxamp;
      let i;
      let p = 0;
      const len = data.length;
      while (p < len) {
        if (this._state === "key") {
          idxeq = idxamp = void 0;
          for (i = p; i < len; ++i) {
            if (!this._checkingBytes) {
              ++p;
            }
            if (data[i] === 61) {
              idxeq = i;
              break;
            } else if (data[i] === 38) {
              idxamp = i;
              break;
            }
            if (this._checkingBytes && this._bytesKey === this.fieldNameSizeLimit) {
              this._hitLimit = true;
              break;
            } else if (this._checkingBytes) {
              ++this._bytesKey;
            }
          }
          if (idxeq !== void 0) {
            if (idxeq > p) {
              this._key += this.decoder.write(data.toString("binary", p, idxeq));
            }
            this._state = "val";
            this._hitLimit = false;
            this._checkingBytes = true;
            this._val = "";
            this._bytesVal = 0;
            this._valTrunc = false;
            this.decoder.reset();
            p = idxeq + 1;
          } else if (idxamp !== void 0) {
            ++this._fields;
            let key;
            const keyTrunc = this._keyTrunc;
            if (idxamp > p) {
              key = this._key += this.decoder.write(data.toString("binary", p, idxamp));
            } else {
              key = this._key;
            }
            this._hitLimit = false;
            this._checkingBytes = true;
            this._key = "";
            this._bytesKey = 0;
            this._keyTrunc = false;
            this.decoder.reset();
            if (key.length) {
              this.boy.emit(
                "field",
                decodeText(key, "binary", this.charset),
                "",
                keyTrunc,
                false
              );
            }
            p = idxamp + 1;
            if (this._fields === this.fieldsLimit) {
              return cb();
            }
          } else if (this._hitLimit) {
            if (i > p) {
              this._key += this.decoder.write(data.toString("binary", p, i));
            }
            p = i;
            if ((this._bytesKey = this._key.length) === this.fieldNameSizeLimit) {
              this._checkingBytes = false;
              this._keyTrunc = true;
            }
          } else {
            if (p < len) {
              this._key += this.decoder.write(data.toString("binary", p));
            }
            p = len;
          }
        } else {
          idxamp = void 0;
          for (i = p; i < len; ++i) {
            if (!this._checkingBytes) {
              ++p;
            }
            if (data[i] === 38) {
              idxamp = i;
              break;
            }
            if (this._checkingBytes && this._bytesVal === this.fieldSizeLimit) {
              this._hitLimit = true;
              break;
            } else if (this._checkingBytes) {
              ++this._bytesVal;
            }
          }
          if (idxamp !== void 0) {
            ++this._fields;
            if (idxamp > p) {
              this._val += this.decoder.write(data.toString("binary", p, idxamp));
            }
            this.boy.emit(
              "field",
              decodeText(this._key, "binary", this.charset),
              decodeText(this._val, "binary", this.charset),
              this._keyTrunc,
              this._valTrunc
            );
            this._state = "key";
            this._hitLimit = false;
            this._checkingBytes = true;
            this._key = "";
            this._bytesKey = 0;
            this._keyTrunc = false;
            this.decoder.reset();
            p = idxamp + 1;
            if (this._fields === this.fieldsLimit) {
              return cb();
            }
          } else if (this._hitLimit) {
            if (i > p) {
              this._val += this.decoder.write(data.toString("binary", p, i));
            }
            p = i;
            if (this._val === "" && this.fieldSizeLimit === 0 || (this._bytesVal = this._val.length) === this.fieldSizeLimit) {
              this._checkingBytes = false;
              this._valTrunc = true;
            }
          } else {
            if (p < len) {
              this._val += this.decoder.write(data.toString("binary", p));
            }
            p = len;
          }
        }
      }
      cb();
    };
    UrlEncoded.prototype.end = function() {
      if (this.boy._done) {
        return;
      }
      if (this._state === "key" && this._key.length > 0) {
        this.boy.emit(
          "field",
          decodeText(this._key, "binary", this.charset),
          "",
          this._keyTrunc,
          false
        );
      } else if (this._state === "val") {
        this.boy.emit(
          "field",
          decodeText(this._key, "binary", this.charset),
          decodeText(this._val, "binary", this.charset),
          this._keyTrunc,
          this._valTrunc
        );
      }
      this.boy._done = true;
      this.boy.emit("finish");
    };
    module.exports = UrlEncoded;
  }
});

// ../../node_modules/@fastify/busboy/lib/main.js
var require_main = __commonJS({
  "../../node_modules/@fastify/busboy/lib/main.js"(exports, module) {
    "use strict";
    var WritableStream = __require("node:stream").Writable;
    var { inherits } = __require("node:util");
    var Dicer = require_Dicer();
    var MultipartParser = require_multipart();
    var UrlencodedParser = require_urlencoded();
    var parseParams = require_parseParams();
    function Busboy(opts) {
      if (!(this instanceof Busboy)) {
        return new Busboy(opts);
      }
      if (typeof opts !== "object") {
        throw new TypeError("Busboy expected an options-Object.");
      }
      if (typeof opts.headers !== "object") {
        throw new TypeError("Busboy expected an options-Object with headers-attribute.");
      }
      if (typeof opts.headers["content-type"] !== "string") {
        throw new TypeError("Missing Content-Type-header.");
      }
      const {
        headers,
        ...streamOptions
      } = opts;
      this.opts = {
        autoDestroy: false,
        ...streamOptions
      };
      WritableStream.call(this, this.opts);
      this._done = false;
      this._parser = this.getParserByHeaders(headers);
      this._finished = false;
    }
    inherits(Busboy, WritableStream);
    Busboy.prototype.emit = function(ev) {
      if (ev === "finish") {
        if (!this._done) {
          this._parser?.end();
          return;
        } else if (this._finished) {
          return;
        }
        this._finished = true;
      }
      WritableStream.prototype.emit.apply(this, arguments);
    };
    Busboy.prototype.getParserByHeaders = function(headers) {
      const parsed = parseParams(headers["content-type"]);
      const cfg = {
        defCharset: this.opts.defCharset,
        fileHwm: this.opts.fileHwm,
        headers,
        highWaterMark: this.opts.highWaterMark,
        isPartAFile: this.opts.isPartAFile,
        limits: this.opts.limits,
        parsedConType: parsed,
        preservePath: this.opts.preservePath
      };
      if (MultipartParser.detect.test(parsed[0])) {
        return new MultipartParser(this, cfg);
      }
      if (UrlencodedParser.detect.test(parsed[0])) {
        return new UrlencodedParser(this, cfg);
      }
      throw new Error("Unsupported Content-Type.");
    };
    Busboy.prototype._write = function(chunk, encoding, cb) {
      this._parser.write(chunk, cb);
    };
    module.exports = Busboy;
    module.exports.default = Busboy;
    module.exports.Busboy = Busboy;
    module.exports.Dicer = Dicer;
  }
});

// ../../node_modules/tslib/tslib.es6.mjs
var tslib_es6_exports = {};
__export(tslib_es6_exports, {
  __addDisposableResource: () => __addDisposableResource,
  __assign: () => __assign,
  __asyncDelegator: () => __asyncDelegator,
  __asyncGenerator: () => __asyncGenerator,
  __asyncValues: () => __asyncValues,
  __await: () => __await,
  __awaiter: () => __awaiter,
  __classPrivateFieldGet: () => __classPrivateFieldGet,
  __classPrivateFieldIn: () => __classPrivateFieldIn,
  __classPrivateFieldSet: () => __classPrivateFieldSet,
  __createBinding: () => __createBinding,
  __decorate: () => __decorate,
  __disposeResources: () => __disposeResources,
  __esDecorate: () => __esDecorate,
  __exportStar: () => __exportStar,
  __extends: () => __extends,
  __generator: () => __generator,
  __importDefault: () => __importDefault,
  __importStar: () => __importStar,
  __makeTemplateObject: () => __makeTemplateObject,
  __metadata: () => __metadata,
  __param: () => __param,
  __propKey: () => __propKey,
  __read: () => __read,
  __rest: () => __rest,
  __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
  __runInitializers: () => __runInitializers,
  __setFunctionName: () => __setFunctionName,
  __spread: () => __spread,
  __spreadArray: () => __spreadArray,
  __spreadArrays: () => __spreadArrays,
  __values: () => __values,
  default: () => tslib_es6_default
});
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access) context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) {
      if (kind === "field") initializers.unshift(_);
      else descriptor[key] = _;
    }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
}
function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
}
function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
}
function __setFunctionName(f, name2, prefix) {
  if (typeof name2 === "symbol") name2 = name2.description ? "[".concat(name2.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name2) : name2 });
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
    ar = ar.concat(__read(arguments[i]));
  return ar;
}
function __spreadArrays() {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) {
    Object.defineProperty(cooked, "raw", { value: raw });
  } else {
    cooked.raw = raw;
  }
  return cooked;
}
function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  }
  __setModuleDefault(result, mod);
  return result;
}
function __importDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env2, value, async) {
  if (value !== null && value !== void 0) {
    if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    env2.stack.push({ value, dispose, async });
  } else if (async) {
    env2.stack.push({ async: true });
  }
  return value;
}
function __disposeResources(env2) {
  function fail(e) {
    env2.error = env2.hasError ? new _SuppressedError(e, env2.error, "An error was suppressed during disposal.") : e;
    env2.hasError = true;
  }
  var r, s = 0;
  function next() {
    while (r = env2.stack.pop()) {
      try {
        if (!r.async && s === 1) return s = 0, env2.stack.push(r), Promise.resolve().then(next);
        if (r.dispose) {
          var result = r.dispose.call(r.value);
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
            fail(e);
            return next();
          });
        } else s |= 1;
      } catch (e) {
        fail(e);
      }
    }
    if (s === 1) return env2.hasError ? Promise.reject(env2.error) : Promise.resolve();
    if (env2.hasError) throw env2.error;
  }
  return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
}
var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
var init_tslib_es6 = __esm({
  "../../node_modules/tslib/tslib.es6.mjs"() {
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    __assign = function() {
      __assign = Object.assign || function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    __createBinding = Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    __setModuleDefault = Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    };
    ownKeys = function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    };
    _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    tslib_es6_default = {
      __extends,
      __assign,
      __rest,
      __decorate,
      __param,
      __esDecorate,
      __runInitializers,
      __propKey,
      __setFunctionName,
      __metadata,
      __awaiter,
      __generator,
      __createBinding,
      __exportStar,
      __values,
      __read,
      __spread,
      __spreadArrays,
      __spreadArray,
      __await,
      __asyncGenerator,
      __asyncDelegator,
      __asyncValues,
      __makeTemplateObject,
      __importStar,
      __importDefault,
      __classPrivateFieldGet,
      __classPrivateFieldSet,
      __classPrivateFieldIn,
      __addDisposableResource,
      __disposeResources,
      __rewriteRelativeImportExtension
    };
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/utils.js
var require_utils = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_ACCEPT_ENCODING = exports.fakePromise = void 0;
    exports.getHeadersObj = getHeadersObj;
    exports.defaultHeadersSerializer = defaultHeadersSerializer;
    exports.isArrayBufferView = isArrayBufferView;
    exports.isNodeReadable = isNodeReadable;
    exports.isIterable = isIterable;
    exports.shouldRedirect = shouldRedirect;
    exports.pipeThrough = pipeThrough;
    exports.endStream = endStream;
    exports.safeWrite = safeWrite2;
    exports.getSupportedFormats = getSupportedFormats;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var node_events_1 = __require("node:events");
    var node_zlib_1 = tslib_1.__importDefault(__require("node:zlib"));
    function isHeadersInstance(obj) {
      return obj?.forEach != null;
    }
    function getHeadersObj(headers) {
      if (headers == null || !isHeadersInstance(headers)) {
        return headers;
      }
      if (headers.headersInit && !headers._map && !isHeadersInstance(headers.headersInit)) {
        return headers.headersInit;
      }
      return Object.fromEntries(headers.entries());
    }
    function defaultHeadersSerializer(headers, onContentLength) {
      const headerArray = [];
      headers.forEach((value, key) => {
        if (onContentLength && key === "content-length") {
          onContentLength(value);
        }
        headerArray.push(`${key}: ${value}`);
      });
      return headerArray;
    }
    var promise_helpers_1 = require_cjs();
    Object.defineProperty(exports, "fakePromise", { enumerable: true, get: function() {
      return promise_helpers_1.fakePromise;
    } });
    function isArrayBufferView(obj) {
      return obj != null && obj.buffer != null && obj.byteLength != null && obj.byteOffset != null;
    }
    function isNodeReadable(obj) {
      return obj != null && obj.pipe != null;
    }
    function isIterable(value) {
      return value?.[Symbol.iterator] != null;
    }
    function shouldRedirect(status) {
      return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
    }
    function pipeThrough({ src, dest, signal, onError }) {
      if (onError) {
        dest.once("error", onError);
      }
      src.once("error", (e) => {
        dest.destroy(e);
      });
      dest.once("close", () => {
        if (!src.destroyed) {
          src.destroy();
        }
      });
      if (signal) {
        let cleanup = function() {
          signalRef.deref()?.removeEventListener("abort", onAbort);
          srcRef.deref()?.removeListener("end", cleanup);
          srcRef.deref()?.removeListener("error", cleanup);
          srcRef.deref()?.removeListener("close", cleanup);
        }, onAbort = function() {
          srcRef.deref()?.destroy(new AbortError());
          cleanup();
        };
        const srcRef = new WeakRef(src);
        const signalRef = new WeakRef(signal);
        signal.addEventListener("abort", onAbort, { once: true });
        src.once("end", cleanup);
        src.once("error", cleanup);
        src.once("close", cleanup);
      }
      src.pipe(dest, {
        end: true
        /* already default */
      });
    }
    function endStream(stream) {
      return stream.end(null, null, null);
    }
    function safeWrite2(chunk, stream) {
      const result = stream.write(chunk);
      if (!result) {
        return (0, node_events_1.once)(stream, "drain");
      }
    }
    var AbortError = class extends Error {
      constructor(message = "The operation was aborted", options = void 0) {
        super(message, options);
        this.name = "AbortError";
      }
    };
    exports.DEFAULT_ACCEPT_ENCODING = getSupportedFormats().join(", ");
    function getSupportedFormats() {
      const baseFormats = ["gzip", "deflate", "br"];
      if (!globalThis.process?.versions?.node?.startsWith("2")) {
        baseFormats.push("deflate-raw");
      }
      if (node_zlib_1.default.createZstdCompress != null) {
        baseFormats.push("zstd");
      }
      return baseFormats;
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/ReadableStream.js
var require_ReadableStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/ReadableStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillReadableStream = void 0;
    var node_buffer_1 = __require("node:buffer");
    var node_events_1 = __require("node:events");
    var node_stream_1 = __require("node:stream");
    var promises_1 = __require("node:stream/promises");
    var promise_helpers_1 = require_cjs();
    var utils_js_1 = require_utils();
    function createController(desiredSize, readable) {
      let chunks = [];
      let _closed = false;
      let flushed = false;
      return {
        desiredSize,
        enqueue(chunk) {
          const buf = typeof chunk === "string" ? node_buffer_1.Buffer.from(chunk) : chunk;
          if (!flushed) {
            chunks.push(buf);
          } else {
            readable.push(buf);
          }
        },
        close() {
          if (chunks.length > 0) {
            this._flush();
          }
          readable.push(null);
          _closed = true;
        },
        error(error) {
          if (chunks.length > 0) {
            this._flush();
          }
          readable.destroy(error);
        },
        get _closed() {
          return _closed;
        },
        _flush() {
          flushed = true;
          if (chunks.length > 0) {
            const concatenated = chunks.length > 1 ? node_buffer_1.Buffer.concat(chunks) : chunks[0];
            readable.push(concatenated);
            chunks = [];
          }
        }
      };
    }
    function isNodeReadable(obj) {
      return obj?.read != null;
    }
    function isReadableStream2(obj) {
      return obj?.getReader != null;
    }
    var PonyfillReadableStream = class _PonyfillReadableStream {
      readable;
      constructor(underlyingSource) {
        if (underlyingSource instanceof _PonyfillReadableStream && underlyingSource.readable != null) {
          this.readable = underlyingSource.readable;
        } else if (isNodeReadable(underlyingSource)) {
          this.readable = underlyingSource;
        } else if (isReadableStream2(underlyingSource)) {
          this.readable = node_stream_1.Readable.fromWeb(underlyingSource);
        } else {
          let started = false;
          let ongoing = false;
          const handleStart = (desiredSize) => {
            if (!started) {
              const controller = createController(desiredSize, this.readable);
              started = true;
              return (0, promise_helpers_1.handleMaybePromise)(() => underlyingSource?.start?.(controller), () => {
                controller._flush();
                if (controller._closed) {
                  return false;
                }
                return true;
              });
            }
            return true;
          };
          const readImpl = (desiredSize) => {
            return (0, promise_helpers_1.handleMaybePromise)(() => handleStart(desiredSize), (shouldContinue) => {
              if (!shouldContinue) {
                return;
              }
              const controller = createController(desiredSize, this.readable);
              return (0, promise_helpers_1.handleMaybePromise)(() => underlyingSource?.pull?.(controller), () => {
                controller._flush();
                ongoing = false;
              });
            });
          };
          this.readable = new node_stream_1.Readable({
            read(desiredSize) {
              if (ongoing) {
                return;
              }
              ongoing = true;
              return readImpl(desiredSize);
            },
            destroy(err, callback) {
              if (underlyingSource?.cancel) {
                try {
                  const res$ = underlyingSource.cancel(err);
                  if (res$?.then) {
                    return res$.then(() => {
                      callback(null);
                    }, (err2) => {
                      callback(err2);
                    });
                  }
                } catch (err2) {
                  callback(err2);
                  return;
                }
              }
              callback(null);
            }
          });
        }
      }
      cancel(reason) {
        this.readable.destroy(reason);
        return (0, node_events_1.once)(this.readable, "close");
      }
      locked = false;
      getReader(_options) {
        const iterator = this.readable[Symbol.asyncIterator]();
        this.locked = true;
        const thisReadable = this.readable;
        return {
          read() {
            return iterator.next();
          },
          releaseLock: () => {
            if (iterator.return) {
              const retResult$ = iterator.return();
              if (retResult$.then) {
                retResult$.then(() => {
                  this.locked = false;
                });
                return;
              }
            }
            this.locked = false;
          },
          cancel: (reason) => {
            if (iterator.return) {
              const retResult$ = iterator.return(reason);
              if (retResult$.then) {
                return retResult$.then(() => {
                  this.locked = false;
                });
              }
            }
            this.locked = false;
            return (0, utils_js_1.fakePromise)();
          },
          get closed() {
            return Promise.race([
              (0, node_events_1.once)(thisReadable, "end"),
              (0, node_events_1.once)(thisReadable, "error").then((err) => Promise.reject(err))
            ]);
          }
        };
      }
      [Symbol.asyncIterator](_options) {
        const iterator = this.readable[Symbol.asyncIterator]();
        const iterable = {
          [Symbol.asyncIterator]() {
            return this;
          },
          [Symbol.asyncDispose]: async () => {
            await iterator.return?.();
            if (!this.readable.destroyed) {
              this.readable.destroy();
            }
          },
          next: () => iterator.next(),
          return: () => {
            if (!this.readable.destroyed) {
              this.readable.destroy();
            }
            return iterator.return?.() || (0, utils_js_1.fakePromise)({ done: true, value: void 0 });
          },
          throw: (err) => {
            if (!this.readable.destroyed) {
              this.readable.destroy(err);
            }
            return iterator.throw?.(err) || (0, utils_js_1.fakePromise)({ done: true, value: void 0 });
          }
        };
        return iterable;
      }
      values(_options) {
        return this[Symbol.asyncIterator]();
      }
      tee() {
        throw new Error("Not implemented");
      }
      async pipeToWriter(writer) {
        try {
          for await (const chunk of this) {
            await writer.write(chunk);
          }
          await writer.close();
        } catch (err) {
          await writer.abort(err);
        }
      }
      pipeTo(destination) {
        if (isPonyfillWritableStream(destination)) {
          return (0, promises_1.pipeline)(this.readable, destination.writable, {
            end: true
          });
        } else {
          const writer = destination.getWriter();
          return this.pipeToWriter(writer);
        }
      }
      pipeThrough({ writable, readable }) {
        this.pipeTo(writable).catch((err) => {
          this.readable.destroy(err);
        });
        if (isPonyfillReadableStream(readable)) {
          readable.readable.once("error", (err) => this.readable.destroy(err));
          readable.readable.once("finish", () => this.readable.push(null));
          readable.readable.once("close", () => this.readable.push(null));
        }
        return readable;
      }
      static [Symbol.hasInstance](instance) {
        return isReadableStream2(instance);
      }
      static from(iterable) {
        return new _PonyfillReadableStream(node_stream_1.Readable.from(iterable));
      }
      [Symbol.toStringTag] = "ReadableStream";
    };
    exports.PonyfillReadableStream = PonyfillReadableStream;
    function isPonyfillReadableStream(obj) {
      return obj?.readable != null;
    }
    function isPonyfillWritableStream(obj) {
      return obj?.writable != null;
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/Blob.js
var require_Blob = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/Blob.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillBlob = void 0;
    exports.hasBufferMethod = hasBufferMethod;
    exports.hasArrayBufferMethod = hasArrayBufferMethod;
    exports.hasBytesMethod = hasBytesMethod;
    exports.hasTextMethod = hasTextMethod;
    exports.hasSizeProperty = hasSizeProperty;
    exports.hasStreamMethod = hasStreamMethod;
    exports.hasBlobSignature = hasBlobSignature;
    exports.isArrayBuffer = isArrayBuffer;
    var node_buffer_1 = __require("node:buffer");
    var ReadableStream_js_1 = require_ReadableStream();
    var utils_js_1 = require_utils();
    function getBlobPartAsBuffer(blobPart) {
      if (typeof blobPart === "string") {
        return node_buffer_1.Buffer.from(blobPart);
      } else if (node_buffer_1.Buffer.isBuffer(blobPart)) {
        return blobPart;
      } else if ((0, utils_js_1.isArrayBufferView)(blobPart)) {
        return node_buffer_1.Buffer.from(blobPart.buffer, blobPart.byteOffset, blobPart.byteLength);
      } else {
        return node_buffer_1.Buffer.from(blobPart);
      }
    }
    function hasBufferMethod(obj) {
      return obj != null && obj.buffer != null && typeof obj.buffer === "function";
    }
    function hasArrayBufferMethod(obj) {
      return obj != null && obj.arrayBuffer != null && typeof obj.arrayBuffer === "function";
    }
    function hasBytesMethod(obj) {
      return obj != null && obj.bytes != null && typeof obj.bytes === "function";
    }
    function hasTextMethod(obj) {
      return obj != null && obj.text != null && typeof obj.text === "function";
    }
    function hasSizeProperty(obj) {
      return obj != null && typeof obj.size === "number";
    }
    function hasStreamMethod(obj) {
      return obj != null && obj.stream != null && typeof obj.stream === "function";
    }
    function hasBlobSignature(obj) {
      return obj != null && obj[Symbol.toStringTag] === "Blob";
    }
    function isArrayBuffer(obj) {
      return obj != null && obj.byteLength != null && obj.slice != null;
    }
    var PonyfillBlob = class {
      blobParts;
      type;
      encoding;
      _size = null;
      constructor(blobParts = [], options) {
        this.blobParts = blobParts;
        this.type = options?.type || "application/octet-stream";
        this.encoding = options?.encoding || "utf8";
        this._size = options?.size || null;
        if (blobParts.length === 1 && hasBlobSignature(blobParts[0])) {
          return blobParts[0];
        }
      }
      _buffer = null;
      buffer() {
        if (this._buffer) {
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        if (this.blobParts.length === 1) {
          const blobPart = this.blobParts[0];
          if (hasBufferMethod(blobPart)) {
            return blobPart.buffer().then((buf) => {
              this._buffer = buf;
              return this._buffer;
            });
          }
          if (hasBytesMethod(blobPart)) {
            return blobPart.bytes().then((bytes) => {
              this._buffer = node_buffer_1.Buffer.from(bytes);
              return this._buffer;
            });
          }
          if (hasArrayBufferMethod(blobPart)) {
            return blobPart.arrayBuffer().then((arrayBuf) => {
              this._buffer = node_buffer_1.Buffer.from(arrayBuf, void 0, blobPart.size);
              return this._buffer;
            });
          }
          this._buffer = getBlobPartAsBuffer(blobPart);
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        const jobs = [];
        const bufferChunks = this.blobParts.map((blobPart, i) => {
          if (hasBufferMethod(blobPart)) {
            jobs.push(blobPart.buffer().then((buf) => {
              bufferChunks[i] = buf;
            }));
            return void 0;
          } else if (hasArrayBufferMethod(blobPart)) {
            jobs.push(blobPart.arrayBuffer().then((arrayBuf) => {
              bufferChunks[i] = node_buffer_1.Buffer.from(arrayBuf, void 0, blobPart.size);
            }));
            return void 0;
          } else if (hasBytesMethod(blobPart)) {
            jobs.push(blobPart.bytes().then((bytes) => {
              bufferChunks[i] = node_buffer_1.Buffer.from(bytes);
            }));
            return void 0;
          } else {
            return getBlobPartAsBuffer(blobPart);
          }
        });
        if (jobs.length > 0) {
          return Promise.all(jobs).then(() => node_buffer_1.Buffer.concat(bufferChunks, this._size || void 0));
        }
        return (0, utils_js_1.fakePromise)(node_buffer_1.Buffer.concat(bufferChunks, this._size || void 0));
      }
      arrayBuffer() {
        if (this._buffer) {
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        if (this.blobParts.length === 1) {
          if (isArrayBuffer(this.blobParts[0])) {
            return (0, utils_js_1.fakePromise)(this.blobParts[0]);
          }
          if (hasArrayBufferMethod(this.blobParts[0])) {
            return this.blobParts[0].arrayBuffer();
          }
        }
        return this.buffer();
      }
      bytes() {
        if (this._buffer) {
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        if (this.blobParts.length === 1) {
          if (node_buffer_1.Buffer.isBuffer(this.blobParts[0])) {
            this._buffer = this.blobParts[0];
            return (0, utils_js_1.fakePromise)(this._buffer);
          }
          if (this.blobParts[0] instanceof Uint8Array) {
            this._buffer = node_buffer_1.Buffer.from(this.blobParts[0]);
            return (0, utils_js_1.fakePromise)(this._buffer);
          }
          if (hasBytesMethod(this.blobParts[0])) {
            return this.blobParts[0].bytes();
          }
          if (hasBufferMethod(this.blobParts[0])) {
            return this.blobParts[0].buffer();
          }
        }
        return this.buffer();
      }
      _text = null;
      text() {
        if (this._text) {
          return (0, utils_js_1.fakePromise)(this._text);
        }
        if (this.blobParts.length === 1) {
          const blobPart = this.blobParts[0];
          if (typeof blobPart === "string") {
            this._text = blobPart;
            return (0, utils_js_1.fakePromise)(this._text);
          }
          if (hasTextMethod(blobPart)) {
            return blobPart.text().then((text) => {
              this._text = text;
              return this._text;
            });
          }
          const buf = getBlobPartAsBuffer(blobPart);
          this._text = buf.toString(this.encoding);
          return (0, utils_js_1.fakePromise)(this._text);
        }
        return this.buffer().then((buf) => {
          this._text = buf.toString(this.encoding);
          return this._text;
        });
      }
      _json = null;
      json() {
        if (this._json) {
          return (0, utils_js_1.fakePromise)(this._json);
        }
        return this.text().then((text) => {
          this._json = JSON.parse(text);
          return this._json;
        });
      }
      _formData = null;
      formData() {
        if (this._formData) {
          return (0, utils_js_1.fakePromise)(this._formData);
        }
        throw new Error("Not implemented");
      }
      get size() {
        if (this._size == null) {
          this._size = 0;
          for (const blobPart of this.blobParts) {
            if (typeof blobPart === "string") {
              this._size += node_buffer_1.Buffer.byteLength(blobPart);
            } else if (hasSizeProperty(blobPart)) {
              this._size += blobPart.size;
            } else if ((0, utils_js_1.isArrayBufferView)(blobPart)) {
              this._size += blobPart.byteLength;
            }
          }
        }
        return this._size;
      }
      stream() {
        if (this.blobParts.length === 1) {
          const blobPart = this.blobParts[0];
          if (hasStreamMethod(blobPart)) {
            return blobPart.stream();
          }
          const buf = getBlobPartAsBuffer(blobPart);
          return new ReadableStream_js_1.PonyfillReadableStream({
            start: (controller) => {
              controller.enqueue(buf);
              controller.close();
            }
          });
        }
        if (this._buffer != null) {
          return new ReadableStream_js_1.PonyfillReadableStream({
            start: (controller) => {
              controller.enqueue(this._buffer);
              controller.close();
            }
          });
        }
        let blobPartIterator;
        return new ReadableStream_js_1.PonyfillReadableStream({
          start: (controller) => {
            if (this.blobParts.length === 0) {
              controller.close();
              return;
            }
            blobPartIterator = this.blobParts[Symbol.iterator]();
          },
          pull: (controller) => {
            const { value: blobPart, done } = blobPartIterator.next();
            if (done) {
              controller.close();
              return;
            }
            if (blobPart) {
              if (hasBufferMethod(blobPart)) {
                return blobPart.buffer().then((buf2) => {
                  controller.enqueue(buf2);
                });
              }
              if (hasBytesMethod(blobPart)) {
                return blobPart.bytes().then((bytes) => {
                  const buf2 = node_buffer_1.Buffer.from(bytes);
                  controller.enqueue(buf2);
                });
              }
              if (hasArrayBufferMethod(blobPart)) {
                return blobPart.arrayBuffer().then((arrayBuffer) => {
                  const buf2 = node_buffer_1.Buffer.from(arrayBuffer, void 0, blobPart.size);
                  controller.enqueue(buf2);
                });
              }
              const buf = getBlobPartAsBuffer(blobPart);
              controller.enqueue(buf);
            }
          }
        });
      }
      slice() {
        throw new Error("Not implemented");
      }
    };
    exports.PonyfillBlob = PonyfillBlob;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/File.js
var require_File = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/File.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillFile = void 0;
    var Blob_js_1 = require_Blob();
    var PonyfillFile = class extends Blob_js_1.PonyfillBlob {
      name;
      lastModified;
      constructor(fileBits, name2, options) {
        super(fileBits, options);
        this.name = name2;
        this.lastModified = options?.lastModified || Date.now();
      }
      webkitRelativePath = "";
    };
    exports.PonyfillFile = PonyfillFile;
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/SupressedError.js
var require_SupressedError = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/SupressedError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillSuppressedError = void 0;
    var PonyfillSuppressedError2 = class extends Error {
      error;
      suppressed;
      // eslint-disable-next-line n/handle-callback-err
      constructor(error, suppressed, message) {
        super(message);
        this.error = error;
        this.suppressed = suppressed;
        this.name = "SuppressedError";
        Error.captureStackTrace(this, this.constructor);
      }
    };
    exports.PonyfillSuppressedError = PonyfillSuppressedError2;
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/symbols.js
var require_symbols = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/symbols.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DisposableSymbols = void 0;
    exports.patchSymbols = patchSymbols;
    exports.DisposableSymbols = {
      get dispose() {
        return Symbol.dispose || /* @__PURE__ */ Symbol.for("dispose");
      },
      get asyncDispose() {
        return Symbol.asyncDispose || /* @__PURE__ */ Symbol.for("asyncDispose");
      }
    };
    function patchSymbols() {
      Symbol.dispose ||= /* @__PURE__ */ Symbol.for("dispose");
      Symbol.asyncDispose ||= /* @__PURE__ */ Symbol.for("asyncDispose");
    }
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/utils.js
var require_utils2 = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isSyncDisposable = isSyncDisposable2;
    exports.isAsyncDisposable = isAsyncDisposable2;
    var symbols_js_1 = require_symbols();
    function isSyncDisposable2(obj) {
      return obj?.[symbols_js_1.DisposableSymbols.dispose] != null;
    }
    function isAsyncDisposable2(obj) {
      return obj?.[symbols_js_1.DisposableSymbols.asyncDispose] != null;
    }
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/AsyncDisposableStack.js
var require_AsyncDisposableStack = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/AsyncDisposableStack.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillAsyncDisposableStack = void 0;
    var promise_helpers_1 = require_cjs();
    var SupressedError_js_1 = require_SupressedError();
    var symbols_js_1 = require_symbols();
    var utils_js_1 = require_utils2();
    var SuppressedError5 = globalThis.SuppressedError || SupressedError_js_1.PonyfillSuppressedError;
    var PonyfillAsyncDisposableStack2 = class _PonyfillAsyncDisposableStack {
      callbacks = [];
      get disposed() {
        return this.callbacks.length === 0;
      }
      use(value) {
        if ((0, utils_js_1.isAsyncDisposable)(value)) {
          this.callbacks.push(() => value[symbols_js_1.DisposableSymbols.asyncDispose]());
        } else if ((0, utils_js_1.isSyncDisposable)(value)) {
          this.callbacks.push(() => value[symbols_js_1.DisposableSymbols.dispose]());
        }
        return value;
      }
      adopt(value, onDisposeAsync) {
        if (onDisposeAsync) {
          this.callbacks.push(() => onDisposeAsync(value));
        }
        return value;
      }
      defer(onDisposeAsync) {
        if (onDisposeAsync) {
          this.callbacks.push(onDisposeAsync);
        }
      }
      move() {
        const stack = new _PonyfillAsyncDisposableStack();
        stack.callbacks = this.callbacks;
        this.callbacks = [];
        return stack;
      }
      disposeAsync() {
        return this[symbols_js_1.DisposableSymbols.asyncDispose]();
      }
      _error;
      _iterateCallbacks() {
        const cb = this.callbacks.pop();
        if (cb) {
          return (0, promise_helpers_1.handleMaybePromise)(cb, () => this._iterateCallbacks(), (error) => {
            this._error = this._error ? new SuppressedError5(error, this._error) : error;
            return this._iterateCallbacks();
          });
        }
      }
      [symbols_js_1.DisposableSymbols.asyncDispose]() {
        const res$ = this._iterateCallbacks();
        if (res$?.then) {
          return res$.then(() => {
            if (this._error) {
              const error = this._error;
              this._error = void 0;
              throw error;
            }
          });
        }
        if (this._error) {
          const error = this._error;
          this._error = void 0;
          throw error;
        }
        return void 0;
      }
      [Symbol.toStringTag] = "AsyncDisposableStack";
    };
    exports.PonyfillAsyncDisposableStack = PonyfillAsyncDisposableStack2;
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/DisposableStack.js
var require_DisposableStack = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/DisposableStack.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillDisposableStack = void 0;
    var SupressedError_js_1 = require_SupressedError();
    var symbols_js_1 = require_symbols();
    var utils_js_1 = require_utils2();
    var SuppressedError5 = globalThis.SuppressedError || SupressedError_js_1.PonyfillSuppressedError;
    var PonyfillDisposableStack2 = class _PonyfillDisposableStack {
      callbacks = [];
      get disposed() {
        return this.callbacks.length === 0;
      }
      use(value) {
        if ((0, utils_js_1.isSyncDisposable)(value)) {
          this.callbacks.push(() => value[symbols_js_1.DisposableSymbols.dispose]());
        }
        return value;
      }
      adopt(value, onDispose) {
        if (onDispose) {
          this.callbacks.push(() => onDispose(value));
        }
        return value;
      }
      defer(onDispose) {
        if (onDispose) {
          this.callbacks.push(onDispose);
        }
      }
      move() {
        const stack = new _PonyfillDisposableStack();
        stack.callbacks = this.callbacks;
        this.callbacks = [];
        return stack;
      }
      dispose() {
        return this[symbols_js_1.DisposableSymbols.dispose]();
      }
      _error;
      _iterateCallbacks() {
        const cb = this.callbacks.pop();
        if (cb) {
          try {
            cb();
          } catch (error) {
            this._error = this._error ? new SuppressedError5(error, this._error) : error;
          }
          return this._iterateCallbacks();
        }
      }
      [symbols_js_1.DisposableSymbols.dispose]() {
        this._iterateCallbacks();
        if (this._error) {
          const error = this._error;
          this._error = void 0;
          throw error;
        }
      }
      [Symbol.toStringTag] = "DisposableStack";
    };
    exports.PonyfillDisposableStack = PonyfillDisposableStack2;
  }
});

// ../../node_modules/@whatwg-node/disposablestack/cjs/index.js
var require_cjs2 = __commonJS({
  "../../node_modules/@whatwg-node/disposablestack/cjs/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SuppressedError = exports.AsyncDisposableStack = exports.DisposableStack = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var AsyncDisposableStack_js_1 = require_AsyncDisposableStack();
    var DisposableStack_js_1 = require_DisposableStack();
    var SupressedError_js_1 = require_SupressedError();
    exports.DisposableStack = globalThis.DisposableStack || DisposableStack_js_1.PonyfillDisposableStack;
    exports.AsyncDisposableStack = globalThis.AsyncDisposableStack || AsyncDisposableStack_js_1.PonyfillAsyncDisposableStack;
    exports.SuppressedError = globalThis.SuppressedError || SupressedError_js_1.PonyfillSuppressedError;
    tslib_1.__exportStar(require_symbols(), exports);
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/IteratorObject.js
var require_IteratorObject = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/IteratorObject.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillIteratorObject = void 0;
    var node_util_1 = __require("node:util");
    var disposablestack_1 = require_cjs2();
    var utils_js_1 = require_utils();
    var PonyfillIteratorObject = class {
      iterableIterator;
      [Symbol.toStringTag] = "IteratorObject";
      constructor(iterableIterator, className) {
        this.iterableIterator = iterableIterator;
        this[Symbol.toStringTag] = className;
      }
      *map(callbackfn) {
        let index = 0;
        for (const value of this.iterableIterator) {
          yield callbackfn(value, index++);
        }
        return void 0;
      }
      *filter(callbackfn) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (callbackfn(value, index++)) {
            yield value;
          }
        }
        return void 0;
      }
      reduce(callbackfn, initialValue) {
        let index = 0;
        let accumulator = initialValue;
        for (const value of this.iterableIterator) {
          accumulator = callbackfn(accumulator, value, index++);
        }
        return accumulator;
      }
      forEach(callbackfn) {
        let index = 0;
        for (const value of this.iterableIterator) {
          callbackfn(value, index++);
        }
      }
      *take(limit) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (index >= limit) {
            break;
          }
          yield value;
          index++;
        }
        return void 0;
      }
      *drop(count) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (index >= count) {
            yield value;
          }
          index++;
        }
        return void 0;
      }
      *flatMap(callback) {
        let index = 0;
        for (const value of this.iterableIterator) {
          const iteratorOrIterable = callback(value, index++);
          if ((0, utils_js_1.isIterable)(iteratorOrIterable)) {
            for (const innerValue of iteratorOrIterable) {
              yield innerValue;
            }
          } else {
            for (const innerValue of {
              [Symbol.iterator]: () => iteratorOrIterable
            }) {
              yield innerValue;
            }
          }
        }
        return void 0;
      }
      some(predicate) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (predicate(value, index++)) {
            return true;
          }
        }
        return false;
      }
      every(predicate) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (!predicate(value, index++)) {
            return false;
          }
        }
        return true;
      }
      find(predicate) {
        let index = 0;
        for (const value of this.iterableIterator) {
          if (predicate(value, index++)) {
            return value;
          }
        }
        return void 0;
      }
      toArray() {
        return Array.from(this.iterableIterator);
      }
      [disposablestack_1.DisposableSymbols.dispose]() {
        this.iterableIterator.return?.();
      }
      next(...[value]) {
        return this.iterableIterator.next(value);
      }
      [Symbol.iterator]() {
        return this;
      }
      [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
        const record = {};
        this.forEach((value, key) => {
          const inspectedValue = (0, node_util_1.inspect)(value);
          record[key] = inspectedValue.includes(",") ? inspectedValue.split(",").map((el) => el.trim()) : inspectedValue;
        });
        return `${this[Symbol.toStringTag]} ${(0, node_util_1.inspect)(record)}`;
      }
    };
    exports.PonyfillIteratorObject = PonyfillIteratorObject;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/FormData.js
var require_FormData = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/FormData.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillFormData = void 0;
    exports.getStreamFromFormData = getStreamFromFormData;
    var node_buffer_1 = __require("node:buffer");
    var IteratorObject_js_1 = require_IteratorObject();
    var ReadableStream_js_1 = require_ReadableStream();
    var PonyfillFormData = class {
      map = /* @__PURE__ */ new Map();
      append(name2, value, fileName) {
        let values = this.map.get(name2);
        if (!values) {
          values = [];
          this.map.set(name2, values);
        }
        const entry = isBlob(value) ? getNormalizedFile(name2, value, fileName) : value;
        values.push(entry);
      }
      delete(name2) {
        this.map.delete(name2);
      }
      get(name2) {
        const values = this.map.get(name2);
        return values ? values[0] : null;
      }
      getAll(name2) {
        return this.map.get(name2) || [];
      }
      has(name2) {
        return this.map.has(name2);
      }
      set(name2, value, fileName) {
        const entry = isBlob(value) ? getNormalizedFile(name2, value, fileName) : value;
        this.map.set(name2, [entry]);
      }
      [Symbol.iterator]() {
        return this._entries();
      }
      *_entries() {
        for (const [key, values] of this.map) {
          for (const value of values) {
            yield [key, value];
          }
        }
      }
      entries() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._entries(), "FormDataIterator");
      }
      _keys() {
        return this.map.keys();
      }
      keys() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._keys(), "FormDataIterator");
      }
      *_values() {
        for (const values of this.map.values()) {
          for (const value of values) {
            yield value;
          }
        }
      }
      values() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._values(), "FormDataIterator");
      }
      forEach(callback) {
        for (const [key, value] of this) {
          callback(value, key, this);
        }
      }
    };
    exports.PonyfillFormData = PonyfillFormData;
    function getStreamFromFormData(formData, boundary = "---") {
      let entriesIterator;
      let sentInitialHeader = false;
      let currentAsyncIterator;
      let hasBefore = false;
      function handleNextEntry(controller) {
        const { done, value } = entriesIterator.next();
        if (done) {
          controller.enqueue(node_buffer_1.Buffer.from(`\r
--${boundary}--\r
`));
          return controller.close();
        }
        if (hasBefore) {
          controller.enqueue(node_buffer_1.Buffer.from(`\r
--${boundary}\r
`));
        }
        if (value) {
          const [key, blobOrString] = value;
          if (typeof blobOrString === "string") {
            controller.enqueue(node_buffer_1.Buffer.from(`Content-Disposition: form-data; name="${key}"\r
\r
`));
            controller.enqueue(node_buffer_1.Buffer.from(blobOrString));
          } else {
            let filenamePart = "";
            if (blobOrString.name) {
              filenamePart = `; filename="${blobOrString.name}"`;
            }
            controller.enqueue(node_buffer_1.Buffer.from(`Content-Disposition: form-data; name="${key}"${filenamePart}\r
`));
            controller.enqueue(node_buffer_1.Buffer.from(`Content-Type: ${blobOrString.type || "application/octet-stream"}\r
\r
`));
            const entryStream = blobOrString.stream();
            currentAsyncIterator = entryStream[Symbol.asyncIterator]();
          }
          hasBefore = true;
        }
      }
      return new ReadableStream_js_1.PonyfillReadableStream({
        start: () => {
          entriesIterator = formData.entries();
        },
        pull: (controller) => {
          if (!sentInitialHeader) {
            sentInitialHeader = true;
            return controller.enqueue(node_buffer_1.Buffer.from(`--${boundary}\r
`));
          }
          if (currentAsyncIterator) {
            return currentAsyncIterator.next().then(({ done, value }) => {
              if (done) {
                currentAsyncIterator = void 0;
              }
              if (value) {
                return controller.enqueue(value);
              } else {
                return handleNextEntry(controller);
              }
            });
          }
          return handleNextEntry(controller);
        },
        cancel: (err) => {
          entriesIterator?.return?.(err);
          currentAsyncIterator?.return?.(err);
        }
      });
    }
    function getNormalizedFile(name2, blob, fileName) {
      Object.defineProperty(blob, "name", {
        configurable: true,
        enumerable: true,
        value: fileName || blob.name || name2
      });
      return blob;
    }
    function isBlob(value) {
      return value?.arrayBuffer != null;
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/Body.js
var require_Body = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/Body.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillBody = void 0;
    var node_buffer_1 = __require("node:buffer");
    var node_stream_1 = __require("node:stream");
    var busboy_1 = require_main();
    var promise_helpers_1 = require_cjs();
    var Blob_js_1 = require_Blob();
    var File_js_1 = require_File();
    var FormData_js_1 = require_FormData();
    var ReadableStream_js_1 = require_ReadableStream();
    var utils_js_1 = require_utils();
    var BodyInitType;
    (function(BodyInitType2) {
      BodyInitType2["ReadableStream"] = "ReadableStream";
      BodyInitType2["Blob"] = "Blob";
      BodyInitType2["FormData"] = "FormData";
      BodyInitType2["String"] = "String";
      BodyInitType2["Readable"] = "Readable";
      BodyInitType2["Buffer"] = "Buffer";
      BodyInitType2["AsyncIterable"] = "AsyncIterable";
    })(BodyInitType || (BodyInitType = {}));
    var PonyfillBody = class {
      bodyInit;
      options;
      bodyUsed = false;
      contentType = null;
      contentLength = null;
      constructor(bodyInit, options = {}) {
        this.bodyInit = bodyInit;
        this.options = options;
        const { bodyFactory, contentType, contentLength, bodyType, buffer } = processBodyInit(bodyInit);
        this._bodyFactory = bodyFactory;
        this.contentType = contentType;
        this.contentLength = contentLength;
        this.bodyType = bodyType;
        this._buffer = buffer;
        this._signal = options.signal;
      }
      bodyType;
      _bodyFactory = () => null;
      _generatedBody = null;
      _buffer;
      _signal;
      generateBody() {
        if (this._generatedBody?.readable?.destroyed && this._buffer) {
          this._generatedBody.readable = node_stream_1.Readable.from(this._buffer);
        }
        if (this._generatedBody) {
          return this._generatedBody;
        }
        const body = this._bodyFactory();
        this._generatedBody = body;
        return body;
      }
      handleContentLengthHeader(forceSet = false) {
        const contentTypeInHeaders = this.headers.get("content-type");
        if (!contentTypeInHeaders) {
          if (this.contentType) {
            this.headers.set("content-type", this.contentType);
          }
        } else {
          this.contentType = contentTypeInHeaders;
        }
        const contentLengthInHeaders = this.headers.get("content-length");
        if (forceSet && this.bodyInit == null && !contentLengthInHeaders) {
          this.contentLength = 0;
          this.headers.set("content-length", "0");
        }
        if (!contentLengthInHeaders) {
          if (this.contentLength) {
            this.headers.set("content-length", this.contentLength.toString());
          }
        } else {
          this.contentLength = parseInt(contentLengthInHeaders, 10);
        }
      }
      get body() {
        const _body = this.generateBody();
        if (_body != null) {
          const ponyfillReadableStream = _body;
          const readable = _body.readable;
          return new Proxy(_body.readable, {
            get(_, prop) {
              if (prop in ponyfillReadableStream) {
                const ponyfillReadableStreamProp = ponyfillReadableStream[prop];
                if (typeof ponyfillReadableStreamProp === "function") {
                  return ponyfillReadableStreamProp.bind(ponyfillReadableStream);
                }
                return ponyfillReadableStreamProp;
              }
              if (prop in readable) {
                const readableProp = readable[prop];
                if (typeof readableProp === "function") {
                  return readableProp.bind(readable);
                }
                return readableProp;
              }
            }
          });
        }
        return null;
      }
      _chunks = null;
      _doCollectChunksFromReadableJob() {
        if (this.bodyType === BodyInitType.AsyncIterable) {
          if (Array.fromAsync) {
            return (0, promise_helpers_1.handleMaybePromise)(() => Array.fromAsync(this.bodyInit), (chunks3) => {
              this._chunks = chunks3;
              return this._chunks;
            });
          }
          const iterator = this.bodyInit[Symbol.asyncIterator]();
          const chunks2 = [];
          const collectValue = () => (0, promise_helpers_1.handleMaybePromise)(() => iterator.next(), ({ value, done }) => {
            if (value) {
              chunks2.push(value);
            }
            if (!done) {
              return collectValue();
            }
            this._chunks = chunks2;
            return this._chunks;
          });
          return collectValue();
        }
        const _body = this.generateBody();
        if (!_body) {
          this._chunks = [];
          return (0, utils_js_1.fakePromise)(this._chunks);
        }
        if (_body.readable.destroyed) {
          return (0, utils_js_1.fakePromise)(this._chunks = []);
        }
        const chunks = [];
        return new Promise((resolve, reject) => {
          _body.readable.on("data", (chunk) => {
            chunks.push(chunk);
          });
          _body.readable.once("error", reject);
          _body.readable.once("end", () => {
            resolve(this._chunks = chunks);
          });
        });
      }
      _collectChunksFromReadable() {
        if (this._chunks) {
          return (0, utils_js_1.fakePromise)(this._chunks);
        }
        this._chunks ||= this._doCollectChunksFromReadableJob();
        return this._chunks;
      }
      _blob = null;
      blob() {
        if (this._blob) {
          return (0, utils_js_1.fakePromise)(this._blob);
        }
        if (this.bodyType === BodyInitType.String) {
          this._text = this.bodyInit;
          this._blob = new Blob_js_1.PonyfillBlob([this._text], {
            type: this.contentType || "text/plain;charset=UTF-8",
            size: this.contentLength
          });
        }
        if (this.bodyType === BodyInitType.Blob) {
          this._blob = this.bodyInit;
          return (0, utils_js_1.fakePromise)(this._blob);
        }
        if (this._buffer) {
          this._blob = new Blob_js_1.PonyfillBlob([this._buffer], {
            type: this.contentType || "",
            size: this.contentLength
          });
          return (0, utils_js_1.fakePromise)(this._blob);
        }
        return (0, utils_js_1.fakePromise)((0, promise_helpers_1.handleMaybePromise)(() => this._collectChunksFromReadable(), (chunks) => {
          this._blob = new Blob_js_1.PonyfillBlob(chunks, {
            type: this.contentType || "",
            size: this.contentLength
          });
          return this._blob;
        }));
      }
      _formData = null;
      formData(opts) {
        if (this._formData) {
          return (0, utils_js_1.fakePromise)(this._formData);
        }
        if (this.bodyType === BodyInitType.FormData) {
          this._formData = this.bodyInit;
          return (0, utils_js_1.fakePromise)(this._formData);
        }
        this._formData = new FormData_js_1.PonyfillFormData();
        const _body = this.generateBody();
        if (_body == null) {
          return (0, utils_js_1.fakePromise)(this._formData);
        }
        const formDataLimits = {
          ...this.options.formDataLimits,
          ...opts?.formDataLimits
        };
        return new Promise((resolve, reject) => {
          const stream = this.body?.readable;
          if (!stream) {
            return reject(new Error("No stream available"));
          }
          let currFile = null;
          const bb = new busboy_1.Busboy({
            headers: {
              "content-length": typeof this.contentLength === "number" ? this.contentLength.toString() : this.contentLength || "",
              "content-type": this.contentType || ""
            },
            limits: formDataLimits,
            defCharset: "utf-8"
          });
          if (this._signal) {
            (0, node_stream_1.addAbortSignal)(this._signal, bb);
          }
          let completed = false;
          const complete = (err) => {
            if (completed)
              return;
            completed = true;
            stream.unpipe(bb);
            bb.destroy();
            if (currFile) {
              currFile.destroy();
              currFile = null;
            }
            if (err) {
              reject(err);
            } else {
              resolve(this._formData);
            }
          };
          stream.on("error", complete);
          bb.on("field", (name2, value, fieldnameTruncated, valueTruncated) => {
            if (fieldnameTruncated) {
              return complete(new Error(`Field name size exceeded: ${formDataLimits?.fieldNameSize} bytes`));
            }
            if (valueTruncated) {
              return complete(new Error(`Field value size exceeded: ${formDataLimits?.fieldSize} bytes`));
            }
            this._formData.set(name2, value);
          });
          bb.on("file", (name2, fileStream, filename, _transferEncoding, mimeType) => {
            currFile = fileStream;
            const chunks = [];
            fileStream.on("data", (chunk) => {
              chunks.push(chunk);
            });
            fileStream.on("error", complete);
            fileStream.on("limit", () => {
              complete(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
            });
            fileStream.on("close", () => {
              if (fileStream.truncated) {
                complete(new Error(`File size limit exceeded: ${formDataLimits?.fileSize} bytes`));
              }
              currFile = null;
              const file = new File_js_1.PonyfillFile(chunks, filename, { type: mimeType });
              this._formData.set(name2, file);
            });
          });
          bb.on("fieldsLimit", () => {
            complete(new Error(`Fields limit exceeded: ${formDataLimits?.fields}`));
          });
          bb.on("filesLimit", () => {
            complete(new Error(`Files limit exceeded: ${formDataLimits?.files}`));
          });
          bb.on("partsLimit", () => {
            complete(new Error(`Parts limit exceeded: ${formDataLimits?.parts}`));
          });
          bb.on("end", complete);
          bb.on("finish", complete);
          bb.on("close", complete);
          bb.on("error", complete);
          stream.pipe(bb);
        });
      }
      buffer() {
        if (this._buffer) {
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        if (this._text) {
          this._buffer = node_buffer_1.Buffer.from(this._text, "utf-8");
          return (0, utils_js_1.fakePromise)(this._buffer);
        }
        if (this.bodyType === BodyInitType.String) {
          return this.text().then((text) => {
            this._text = text;
            this._buffer = node_buffer_1.Buffer.from(text, "utf-8");
            return this._buffer;
          });
        }
        if (this.bodyType === BodyInitType.Blob) {
          if ((0, Blob_js_1.hasBufferMethod)(this.bodyInit)) {
            return this.bodyInit.buffer().then((buf) => {
              this._buffer = buf;
              return this._buffer;
            });
          }
          if ((0, Blob_js_1.hasBytesMethod)(this.bodyInit)) {
            return this.bodyInit.bytes().then((bytes) => {
              this._buffer = node_buffer_1.Buffer.from(bytes);
              return this._buffer;
            });
          }
          if ((0, Blob_js_1.hasArrayBufferMethod)(this.bodyInit)) {
            return this.bodyInit.arrayBuffer().then((buf) => {
              this._buffer = node_buffer_1.Buffer.from(buf, void 0, buf.byteLength);
              return this._buffer;
            });
          }
        }
        return (0, utils_js_1.fakePromise)((0, promise_helpers_1.handleMaybePromise)(() => this._collectChunksFromReadable(), (chunks) => {
          if (chunks.length === 1) {
            this._buffer = chunks[0];
            return this._buffer;
          }
          this._buffer = node_buffer_1.Buffer.concat(chunks);
          return this._buffer;
        }));
      }
      bytes() {
        return this.buffer();
      }
      arrayBuffer() {
        return this.buffer();
      }
      _json = null;
      json() {
        if (this._json) {
          return (0, utils_js_1.fakePromise)(this._json);
        }
        return this.text().then((text) => {
          try {
            this._json = JSON.parse(text);
          } catch (e) {
            if (e instanceof SyntaxError) {
              e.message += `, "${text}" is not valid JSON`;
            }
            throw e;
          }
          return this._json;
        });
      }
      _text = null;
      text() {
        if (this._text) {
          return (0, utils_js_1.fakePromise)(this._text);
        }
        if (this.bodyType === BodyInitType.String) {
          this._text = this.bodyInit;
          return (0, utils_js_1.fakePromise)(this._text);
        }
        return this.buffer().then((buffer) => {
          this._text = buffer.toString("utf-8");
          return this._text;
        });
      }
    };
    exports.PonyfillBody = PonyfillBody;
    function processBodyInit(bodyInit) {
      if (bodyInit == null) {
        return {
          bodyFactory: () => null,
          contentType: null,
          contentLength: null
        };
      }
      if (typeof bodyInit === "string") {
        const contentLength = node_buffer_1.Buffer.byteLength(bodyInit);
        return {
          bodyType: BodyInitType.String,
          contentType: "text/plain;charset=UTF-8",
          contentLength,
          bodyFactory() {
            const readable = node_stream_1.Readable.from(node_buffer_1.Buffer.from(bodyInit, "utf-8"));
            return new ReadableStream_js_1.PonyfillReadableStream(readable);
          }
        };
      }
      if (node_buffer_1.Buffer.isBuffer(bodyInit)) {
        const buffer = bodyInit;
        return {
          bodyType: BodyInitType.Buffer,
          contentType: null,
          contentLength: bodyInit.length,
          buffer: bodyInit,
          bodyFactory() {
            const readable = node_stream_1.Readable.from(buffer);
            const body = new ReadableStream_js_1.PonyfillReadableStream(readable);
            return body;
          }
        };
      }
      if ((0, utils_js_1.isArrayBufferView)(bodyInit)) {
        const buffer = node_buffer_1.Buffer.from(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength);
        return {
          bodyType: BodyInitType.Buffer,
          contentLength: bodyInit.byteLength,
          contentType: null,
          buffer,
          bodyFactory() {
            const readable = node_stream_1.Readable.from(buffer);
            const body = new ReadableStream_js_1.PonyfillReadableStream(readable);
            return body;
          }
        };
      }
      if (bodyInit instanceof ReadableStream_js_1.PonyfillReadableStream && bodyInit.readable != null) {
        const readableStream = bodyInit;
        return {
          bodyType: BodyInitType.ReadableStream,
          bodyFactory: () => readableStream,
          contentType: null,
          contentLength: null
        };
      }
      if (isBlob(bodyInit)) {
        const blob = bodyInit;
        return {
          bodyType: BodyInitType.Blob,
          contentType: bodyInit.type,
          contentLength: bodyInit.size,
          bodyFactory() {
            return blob.stream();
          }
        };
      }
      if (bodyInit instanceof ArrayBuffer) {
        const contentLength = bodyInit.byteLength;
        const buffer = node_buffer_1.Buffer.from(bodyInit, void 0, bodyInit.byteLength);
        return {
          bodyType: BodyInitType.Buffer,
          contentType: null,
          contentLength,
          buffer,
          bodyFactory() {
            const readable = node_stream_1.Readable.from(buffer);
            const body = new ReadableStream_js_1.PonyfillReadableStream(readable);
            return body;
          }
        };
      }
      if (bodyInit instanceof node_stream_1.Readable) {
        return {
          bodyType: BodyInitType.Readable,
          contentType: null,
          contentLength: null,
          bodyFactory() {
            const body = new ReadableStream_js_1.PonyfillReadableStream(bodyInit);
            return body;
          }
        };
      }
      if (isURLSearchParams(bodyInit)) {
        const contentType = "application/x-www-form-urlencoded;charset=UTF-8";
        return {
          bodyType: BodyInitType.String,
          contentType,
          contentLength: null,
          bodyFactory() {
            const body = new ReadableStream_js_1.PonyfillReadableStream(node_stream_1.Readable.from(bodyInit.toString()));
            return body;
          }
        };
      }
      if (isFormData(bodyInit)) {
        const boundary = Math.random().toString(36).substr(2);
        const contentType = `multipart/form-data; boundary=${boundary}`;
        return {
          bodyType: BodyInitType.FormData,
          contentType,
          contentLength: null,
          bodyFactory() {
            return (0, FormData_js_1.getStreamFromFormData)(bodyInit, boundary);
          }
        };
      }
      if (isReadableStream2(bodyInit)) {
        return {
          contentType: null,
          contentLength: null,
          bodyFactory() {
            return new ReadableStream_js_1.PonyfillReadableStream(bodyInit);
          }
        };
      }
      if (bodyInit[Symbol.iterator] || bodyInit[Symbol.asyncIterator]) {
        return {
          contentType: null,
          contentLength: null,
          bodyType: BodyInitType.AsyncIterable,
          bodyFactory() {
            const readable = node_stream_1.Readable.from(bodyInit);
            return new ReadableStream_js_1.PonyfillReadableStream(readable);
          }
        };
      }
      throw new Error("Unknown body type");
    }
    function isFormData(value) {
      return value?.forEach != null;
    }
    function isBlob(value) {
      return value?.stream != null && typeof value.stream === "function";
    }
    function isURLSearchParams(value) {
      return value?.sort != null;
    }
    function isReadableStream2(value) {
      return value?.getReader != null;
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/Headers.js
var require_Headers = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/Headers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillHeaders = void 0;
    exports.isHeadersLike = isHeadersLike;
    var node_util_1 = __require("node:util");
    var IteratorObject_js_1 = require_IteratorObject();
    function isHeadersLike(headers) {
      return headers?.get && headers?.forEach;
    }
    var PonyfillHeaders = class {
      headersInit;
      _map;
      objectNormalizedKeysOfHeadersInit = [];
      objectOriginalKeysOfHeadersInit = [];
      _setCookies;
      constructor(headersInit) {
        this.headersInit = headersInit;
      }
      // perf: we don't need to build `this.map` for Requests, as we can access the headers directly
      _get(key) {
        const normalized = key.toLowerCase();
        if (normalized === "set-cookie" && this._setCookies?.length) {
          return this._setCookies.join(", ");
        }
        if (this._map) {
          return this._map.get(normalized) || null;
        }
        if (this.headersInit == null) {
          return null;
        }
        if (Array.isArray(this.headersInit)) {
          const found = this.headersInit.filter(([headerKey]) => headerKey.toLowerCase() === normalized);
          if (found.length === 0) {
            return null;
          }
          if (found.length === 1) {
            return found[0][1];
          }
          return found.map(([, value]) => value).join(", ");
        } else if (isHeadersLike(this.headersInit)) {
          return this.headersInit.get(normalized);
        } else {
          const initValue = this.headersInit[key] || this.headersInit[normalized];
          if (initValue != null) {
            return initValue;
          }
          if (!this.objectNormalizedKeysOfHeadersInit.length) {
            Object.keys(this.headersInit).forEach((k) => {
              this.objectOriginalKeysOfHeadersInit.push(k);
              this.objectNormalizedKeysOfHeadersInit.push(k.toLowerCase());
            });
          }
          const index = this.objectNormalizedKeysOfHeadersInit.indexOf(normalized);
          if (index === -1) {
            return null;
          }
          const originalKey = this.objectOriginalKeysOfHeadersInit[index];
          return this.headersInit[originalKey];
        }
      }
      // perf: Build the map of headers lazily, only when we need to access all headers or write to it.
      // I could do a getter here, but I'm too lazy to type `getter`.
      getMap() {
        if (!this._map) {
          this._setCookies ||= [];
          if (this.headersInit != null) {
            if (Array.isArray(this.headersInit)) {
              this._map = /* @__PURE__ */ new Map();
              for (const [key, value] of this.headersInit) {
                const normalizedKey = key.toLowerCase();
                if (normalizedKey === "set-cookie") {
                  if (Array.isArray(value)) {
                    this._setCookies.push(...value);
                  } else if (value != null) {
                    this._setCookies.push(value);
                  }
                  continue;
                }
                this._map.set(normalizedKey, value);
              }
            } else if (isHeadersLike(this.headersInit)) {
              this._map = /* @__PURE__ */ new Map();
              this.headersInit.forEach((value, key) => {
                if (key === "set-cookie") {
                  this._setCookies ||= [];
                  if (Array.isArray(value)) {
                    this._setCookies.push(...value);
                  } else if (value != null) {
                    this._setCookies.push(value);
                  }
                  return;
                }
                this._map.set(key, value);
              });
            } else {
              this._map = /* @__PURE__ */ new Map();
              for (const initKey in this.headersInit) {
                const initValue = this.headersInit[initKey];
                if (initValue != null) {
                  const normalizedKey = initKey.toLowerCase();
                  if (normalizedKey === "set-cookie") {
                    this._setCookies ||= [];
                    if (Array.isArray(initValue)) {
                      this._setCookies.push(...initValue);
                      continue;
                    }
                    this._setCookies.push(initValue);
                    continue;
                  }
                  this._map.set(normalizedKey, initValue);
                }
              }
            }
          } else {
            this._map = /* @__PURE__ */ new Map();
          }
        }
        return this._map;
      }
      append(name2, value) {
        const key = name2.toLowerCase();
        if (key === "set-cookie") {
          this._setCookies ||= [];
          this._setCookies.push(value);
          return;
        }
        const existingValue = this.getMap().get(key);
        const finalValue = existingValue ? `${existingValue}, ${value}` : value;
        this.getMap().set(key, finalValue);
      }
      get(name2) {
        const value = this._get(name2);
        if (value == null) {
          return null;
        }
        return value.toString();
      }
      has(name2) {
        const key = name2.toLowerCase();
        if (key === "set-cookie") {
          return !!this._setCookies?.length;
        }
        return !!this._get(name2);
      }
      set(name2, value) {
        const key = name2.toLowerCase();
        if (key === "set-cookie") {
          this._setCookies = [value];
          return;
        }
        if (!this._map && this.headersInit != null) {
          if (Array.isArray(this.headersInit)) {
            const found = this.headersInit.find(([headerKey]) => headerKey.toLowerCase() === key);
            if (found) {
              found[1] = value;
            } else {
              this.headersInit.push([key, value]);
            }
            return;
          } else if (isHeadersLike(this.headersInit)) {
            this.headersInit.set(key, value);
            return;
          } else {
            this.headersInit[key] = value;
            return;
          }
        }
        this.getMap().set(key, value);
      }
      delete(name2) {
        const key = name2.toLowerCase();
        if (key === "set-cookie") {
          this._setCookies = [];
          return;
        }
        this.getMap().delete(key);
      }
      forEach(callback) {
        this._setCookies?.forEach((setCookie) => {
          callback(setCookie, "set-cookie", this);
        });
        if (!this._map) {
          if (this.headersInit) {
            if (Array.isArray(this.headersInit)) {
              this.headersInit.forEach(([key, value]) => {
                callback(value, key, this);
              });
              return;
            }
            if (isHeadersLike(this.headersInit)) {
              this.headersInit.forEach(callback);
              return;
            }
            Object.entries(this.headersInit).forEach(([key, value]) => {
              if (value != null) {
                callback(value, key, this);
              }
            });
          }
          return;
        }
        this.getMap().forEach((value, key) => {
          callback(value, key, this);
        });
      }
      *_keys() {
        if (this._setCookies?.length) {
          yield "set-cookie";
        }
        if (!this._map) {
          if (this.headersInit) {
            if (Array.isArray(this.headersInit)) {
              yield* this.headersInit.map(([key]) => key)[Symbol.iterator]();
              return;
            }
            if (isHeadersLike(this.headersInit)) {
              yield* this.headersInit.keys();
              return;
            }
            yield* Object.keys(this.headersInit)[Symbol.iterator]();
            return;
          }
        }
        yield* this.getMap().keys();
      }
      keys() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._keys(), "HeadersIterator");
      }
      *_values() {
        if (this._setCookies?.length) {
          yield* this._setCookies;
        }
        if (!this._map) {
          if (this.headersInit) {
            if (Array.isArray(this.headersInit)) {
              yield* this.headersInit.map(([, value]) => value)[Symbol.iterator]();
              return;
            }
            if (isHeadersLike(this.headersInit)) {
              yield* this.headersInit.values();
              return;
            }
            yield* Object.values(this.headersInit)[Symbol.iterator]();
            return;
          }
        }
        yield* this.getMap().values();
      }
      values() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._values(), "HeadersIterator");
      }
      *_entries() {
        if (this._setCookies?.length) {
          yield* this._setCookies.map((cookie) => ["set-cookie", cookie]);
        }
        if (!this._map) {
          if (this.headersInit) {
            if (Array.isArray(this.headersInit)) {
              yield* this.headersInit;
              return;
            }
            if (isHeadersLike(this.headersInit)) {
              yield* this.headersInit.entries();
              return;
            }
            yield* Object.entries(this.headersInit);
            return;
          }
        }
        yield* this.getMap().entries();
      }
      entries() {
        return new IteratorObject_js_1.PonyfillIteratorObject(this._entries(), "HeadersIterator");
      }
      getSetCookie() {
        if (!this._setCookies) {
          this.getMap();
        }
        return this._setCookies;
      }
      [Symbol.iterator]() {
        return this.entries();
      }
      [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
        const record = {};
        this.forEach((value, key) => {
          if (key === "set-cookie") {
            record["set-cookie"] = this._setCookies || [];
          } else {
            record[key] = value?.includes(",") ? value.split(",").map((el) => el.trim()) : value;
          }
        });
        return `Headers ${(0, node_util_1.inspect)(record)}`;
      }
    };
    exports.PonyfillHeaders = PonyfillHeaders;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/Response.js
var require_Response = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/Response.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillResponse = void 0;
    var node_http_1 = __require("node:http");
    var Body_js_1 = require_Body();
    var Headers_js_1 = require_Headers();
    var JSON_CONTENT_TYPE = "application/json; charset=utf-8";
    var PonyfillResponse = class _PonyfillResponse extends Body_js_1.PonyfillBody {
      headers;
      constructor(body, init) {
        super(body || null, init);
        this.headers = init?.headers && (0, Headers_js_1.isHeadersLike)(init.headers) ? init.headers : new Headers_js_1.PonyfillHeaders(init?.headers);
        this.status = init?.status || 200;
        this.statusText = init?.statusText || node_http_1.STATUS_CODES[this.status] || "OK";
        this.url = init?.url || "";
        this.redirected = init?.redirected || false;
        this.type = init?.type || "default";
        this.handleContentLengthHeader();
      }
      get ok() {
        return this.status >= 200 && this.status < 300;
      }
      status;
      statusText;
      url;
      redirected;
      type;
      clone() {
        return this;
      }
      static error() {
        return new _PonyfillResponse(null, {
          status: 500,
          statusText: "Internal Server Error"
        });
      }
      static redirect(url, status = 302) {
        if (status < 300 || status > 399) {
          throw new RangeError("Invalid status code");
        }
        return new _PonyfillResponse(null, {
          headers: {
            location: url
          },
          status
        });
      }
      static json(data, init) {
        const bodyInit = JSON.stringify(data);
        if (!init) {
          init = {
            headers: {
              "content-type": JSON_CONTENT_TYPE,
              "content-length": Buffer.byteLength(bodyInit).toString()
            }
          };
        } else if (!init.headers) {
          init.headers = {
            "content-type": JSON_CONTENT_TYPE,
            "content-length": Buffer.byteLength(bodyInit).toString()
          };
        } else if ((0, Headers_js_1.isHeadersLike)(init.headers)) {
          if (!init.headers.has("content-type")) {
            init.headers.set("content-type", JSON_CONTENT_TYPE);
          }
          if (!init.headers.has("content-length")) {
            init.headers.set("content-length", Buffer.byteLength(bodyInit).toString());
          }
        } else if (Array.isArray(init.headers)) {
          let contentTypeExists = false;
          let contentLengthExists = false;
          for (const [key] of init.headers) {
            if (contentLengthExists && contentTypeExists) {
              break;
            }
            if (!contentTypeExists && key.toLowerCase() === "content-type") {
              contentTypeExists = true;
            } else if (!contentLengthExists && key.toLowerCase() === "content-length") {
              contentLengthExists = true;
            }
          }
          if (!contentTypeExists) {
            init.headers.push(["content-type", JSON_CONTENT_TYPE]);
          }
          if (!contentLengthExists) {
            init.headers.push(["content-length", Buffer.byteLength(bodyInit).toString()]);
          }
        } else if (typeof init.headers === "object") {
          if (init.headers?.["content-type"] == null) {
            init.headers["content-type"] = JSON_CONTENT_TYPE;
          }
          if (init.headers?.["content-length"] == null) {
            init.headers["content-length"] = Buffer.byteLength(bodyInit).toString();
          }
        }
        return new _PonyfillResponse(bodyInit, init);
      }
      [Symbol.toStringTag] = "Response";
    };
    exports.PonyfillResponse = PonyfillResponse;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/fetchCurl.js
var require_fetchCurl = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/fetchCurl.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fetchCurl = fetchCurl;
    var node_stream_1 = __require("node:stream");
    var node_tls_1 = __require("node:tls");
    var promise_helpers_1 = require_cjs();
    var Response_js_1 = require_Response();
    var utils_js_1 = require_utils();
    function fetchCurl(fetchRequest) {
      const { Curl, CurlFeature, CurlPause, CurlProgressFunc } = globalThis["libcurl"];
      const curlHandle = new Curl();
      curlHandle.enable(CurlFeature.NoDataParsing);
      curlHandle.setOpt("URL", fetchRequest.url);
      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
        curlHandle.setOpt("SSL_VERIFYPEER", false);
      }
      if (process.env.NODE_EXTRA_CA_CERTS) {
        curlHandle.setOpt("CAINFO", process.env.NODE_EXTRA_CA_CERTS);
      } else {
        curlHandle.setOpt("CAINFO_BLOB", node_tls_1.rootCertificates.join("\n"));
      }
      curlHandle.enable(CurlFeature.StreamResponse);
      let signal;
      if (fetchRequest._signal === null) {
        signal = void 0;
      } else if (fetchRequest._signal) {
        signal = fetchRequest._signal;
      }
      curlHandle.setStreamProgressCallback(function() {
        return signal?.aborted ? process.env.DEBUG ? CurlProgressFunc.Continue : 1 : 0;
      });
      if (fetchRequest["bodyType"] === "String") {
        curlHandle.setOpt("POSTFIELDS", fetchRequest["bodyInit"]);
      } else {
        const nodeReadable = fetchRequest.body != null ? (0, utils_js_1.isNodeReadable)(fetchRequest.body) ? fetchRequest.body : node_stream_1.Readable.from(fetchRequest.body) : null;
        if (nodeReadable) {
          curlHandle.setOpt("UPLOAD", true);
          curlHandle.setUploadStream(nodeReadable);
        }
      }
      if (process.env.DEBUG) {
        curlHandle.setOpt("VERBOSE", true);
      }
      curlHandle.setOpt("TRANSFER_ENCODING", false);
      curlHandle.setOpt("HTTP_TRANSFER_DECODING", true);
      curlHandle.setOpt("FOLLOWLOCATION", fetchRequest.redirect === "follow");
      curlHandle.setOpt("MAXREDIRS", 20);
      curlHandle.setOpt("ACCEPT_ENCODING", "");
      curlHandle.setOpt("CUSTOMREQUEST", fetchRequest.method);
      const headersSerializer = fetchRequest.headersSerializer || utils_js_1.defaultHeadersSerializer;
      let size;
      const curlHeaders = headersSerializer(fetchRequest.headers, (value) => {
        size = Number(value);
      });
      if (size != null) {
        curlHandle.setOpt("INFILESIZE", size);
      }
      curlHandle.setOpt("HTTPHEADER", curlHeaders);
      curlHandle.enable(CurlFeature.NoHeaderParsing);
      const deferredPromise = (0, promise_helpers_1.createDeferredPromise)();
      let streamResolved;
      function onAbort() {
        if (curlHandle.isOpen) {
          try {
            curlHandle.pause(CurlPause.Recv);
          } catch (e) {
            deferredPromise.reject(e);
          }
        }
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      curlHandle.once("end", function endListener() {
        try {
          curlHandle.close();
        } catch (e) {
          deferredPromise.reject(e);
        }
        signal?.removeEventListener("abort", onAbort);
      });
      curlHandle.once("error", function errorListener(error) {
        if (streamResolved && !streamResolved.closed && !streamResolved.destroyed) {
          streamResolved.destroy(error);
        } else {
          if (error.message === "Operation was aborted by an application callback") {
            error.message = "The operation was aborted.";
          }
          deferredPromise.reject(error);
        }
        try {
          curlHandle.close();
        } catch (e) {
          deferredPromise.reject(e);
        }
      });
      curlHandle.once("stream", function streamListener(stream, status, headersBuf) {
        const outputStream = stream.pipe(new node_stream_1.PassThrough(), {
          end: true
        });
        const headersFlat = headersBuf.toString("utf8").split(/\r?\n|\r/g).filter((headerFilter) => {
          if (headerFilter && !headerFilter.startsWith("HTTP/")) {
            if (fetchRequest.redirect === "error" && headerFilter.toLowerCase().includes("location") && (0, utils_js_1.shouldRedirect)(status)) {
              if (!stream.destroyed) {
                stream.resume();
              }
              outputStream.destroy();
              deferredPromise.reject(new Error("redirect is not allowed"));
            }
            return true;
          }
          return false;
        });
        const headersInit = headersFlat.map((headerFlat) => headerFlat.split(/:\s(.+)/).slice(0, 2));
        const ponyfillResponse = new Response_js_1.PonyfillResponse(outputStream, {
          status,
          headers: headersInit,
          url: curlHandle.getInfo(Curl.info.REDIRECT_URL)?.toString() || fetchRequest.url,
          redirected: Number(curlHandle.getInfo(Curl.info.REDIRECT_COUNT)) > 0
        });
        deferredPromise.resolve(ponyfillResponse);
        streamResolved = outputStream;
      });
      setImmediate(() => {
        curlHandle.perform();
      });
      return deferredPromise.promise;
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/URL.js
var require_URL = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/URL.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillURL = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var node_buffer_1 = tslib_1.__importDefault(__require("node:buffer"));
    var node_crypto_1 = __require("node:crypto");
    var NativeURL = globalThis.URL;
    var URL2 = class extends NativeURL {
      // This part is only needed to handle `PonyfillBlob` objects
      static blobRegistry = /* @__PURE__ */ new Map();
      static createObjectURL(blob) {
        const blobUrl = `blob:whatwgnode:${(0, node_crypto_1.randomUUID)()}`;
        this.blobRegistry.set(blobUrl, blob);
        return blobUrl;
      }
      static revokeObjectURL(url) {
        if (!this.blobRegistry.has(url)) {
          NativeURL.revokeObjectURL(url);
        } else {
          this.blobRegistry.delete(url);
        }
      }
      static getBlobFromURL(url) {
        return this.blobRegistry.get(url) || node_buffer_1.default?.resolveObjectURL?.(url);
      }
    };
    exports.PonyfillURL = URL2;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/Request.js
var require_Request = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/Request.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillRequest = void 0;
    var node_http_1 = __require("node:http");
    var node_https_1 = __require("node:https");
    var Body_js_1 = require_Body();
    var Headers_js_1 = require_Headers();
    var URL_js_1 = require_URL();
    function isRequest(input) {
      return input[Symbol.toStringTag] === "Request";
    }
    function isURL(obj) {
      return obj?.href != null;
    }
    var PonyfillRequest = class extends Body_js_1.PonyfillBody {
      constructor(input, options) {
        let _url;
        let _parsedUrl;
        let bodyInit = null;
        let requestInit;
        if (typeof input === "string") {
          _url = input;
        } else if (isURL(input)) {
          _parsedUrl = input;
        } else if (isRequest(input)) {
          if (input._parsedUrl) {
            _parsedUrl = input._parsedUrl;
          } else if (input._url) {
            _url = input._url;
          } else {
            _url = input.url;
          }
          bodyInit = input.body;
          requestInit = input;
        }
        if (options != null) {
          bodyInit = options.body || null;
          requestInit = options;
        }
        super(bodyInit, requestInit);
        this._url = _url;
        this._parsedUrl = _parsedUrl;
        this.cache = requestInit?.cache || "default";
        this.credentials = requestInit?.credentials || "same-origin";
        this.headers = requestInit?.headers && (0, Headers_js_1.isHeadersLike)(requestInit.headers) ? requestInit.headers : new Headers_js_1.PonyfillHeaders(requestInit?.headers);
        this.integrity = requestInit?.integrity || "";
        this.keepalive = requestInit?.keepalive != null ? requestInit?.keepalive : false;
        this.method = requestInit?.method?.toUpperCase() || "GET";
        this.mode = requestInit?.mode || "cors";
        this.redirect = requestInit?.redirect || "follow";
        this.referrer = requestInit?.referrer || "about:client";
        this.referrerPolicy = requestInit?.referrerPolicy || "no-referrer";
        this.headersSerializer = requestInit?.headersSerializer;
        this.duplex = requestInit?.duplex || "half";
        this.destination = "document";
        this.priority = "auto";
        if (this.method !== "GET" && this.method !== "HEAD") {
          this.handleContentLengthHeader(true);
        }
        if (requestInit?.agent != null) {
          const protocol = _parsedUrl?.protocol || _url || this.url;
          if (requestInit.agent === false) {
            this.agent = false;
          } else if (protocol.startsWith("http:") && requestInit.agent instanceof node_http_1.Agent) {
            this.agent = requestInit.agent;
          } else if (protocol.startsWith("https:") && requestInit.agent instanceof node_https_1.Agent) {
            this.agent = requestInit.agent;
          }
        }
      }
      headersSerializer;
      cache;
      credentials;
      destination;
      headers;
      integrity;
      keepalive;
      method;
      mode;
      priority;
      redirect;
      referrer;
      referrerPolicy;
      _url;
      get signal() {
        this._signal ||= new AbortController().signal;
        return this._signal;
      }
      get url() {
        if (this._url == null) {
          if (this._parsedUrl) {
            this._url = this._parsedUrl.toString();
          } else {
            throw new TypeError("Invalid URL");
          }
        }
        return this._url;
      }
      _parsedUrl;
      get parsedUrl() {
        if (this._parsedUrl == null) {
          if (this._url != null) {
            this._parsedUrl = new URL_js_1.PonyfillURL(this._url, "http://localhost");
          } else {
            throw new TypeError("Invalid URL");
          }
        }
        return this._parsedUrl;
      }
      duplex;
      agent;
      clone() {
        return this;
      }
      [Symbol.toStringTag] = "Request";
    };
    exports.PonyfillRequest = PonyfillRequest;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/fetchNodeHttp.js
var require_fetchNodeHttp = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/fetchNodeHttp.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fetchNodeHttp = fetchNodeHttp;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var node_http_1 = __require("node:http");
    var node_https_1 = __require("node:https");
    var node_stream_1 = __require("node:stream");
    var node_zlib_1 = tslib_1.__importDefault(__require("node:zlib"));
    var promise_helpers_1 = require_cjs();
    var Request_js_1 = require_Request();
    var Response_js_1 = require_Response();
    var URL_js_1 = require_URL();
    var utils_js_1 = require_utils();
    function getRequestFnForProtocol(url) {
      if (url.startsWith("http:")) {
        return node_http_1.request;
      } else if (url.startsWith("https:")) {
        return node_https_1.request;
      }
      throw new Error(`Unsupported protocol: ${url.split(":")[0] || url}`);
    }
    function fetchNodeHttp(fetchRequest) {
      return new Promise((resolve, reject) => {
        try {
          const requestFn = getRequestFnForProtocol(fetchRequest.parsedUrl?.protocol || fetchRequest.url);
          const headersSerializer = fetchRequest.headersSerializer || utils_js_1.getHeadersObj;
          const nodeHeaders = headersSerializer(fetchRequest.headers);
          nodeHeaders["accept-encoding"] ||= utils_js_1.DEFAULT_ACCEPT_ENCODING;
          if (nodeHeaders["user-agent"] == null && nodeHeaders["User-Agent"] == null) {
            nodeHeaders["user-agent"] = "node";
          }
          let signal;
          if (fetchRequest._signal == null) {
            signal = void 0;
          } else if (fetchRequest._signal) {
            signal = fetchRequest._signal;
          }
          let nodeRequest;
          if (fetchRequest.parsedUrl) {
            nodeRequest = requestFn(fetchRequest.parsedUrl, {
              method: fetchRequest.method,
              headers: nodeHeaders,
              signal,
              agent: fetchRequest.agent
            });
          } else {
            nodeRequest = requestFn(fetchRequest.url, {
              method: fetchRequest.method,
              headers: nodeHeaders,
              signal,
              agent: fetchRequest.agent
            });
          }
          nodeRequest.once("error", reject);
          nodeRequest.once("response", (nodeResponse) => {
            let outputStream;
            const contentEncoding = nodeResponse.headers["content-encoding"];
            switch (contentEncoding) {
              case "x-gzip":
              case "gzip":
                outputStream = node_zlib_1.default.createGunzip();
                break;
              case "x-deflate":
              case "deflate":
                outputStream = node_zlib_1.default.createInflate();
                break;
              case "x-deflate-raw":
              case "deflate-raw":
                outputStream = node_zlib_1.default.createInflateRaw();
                break;
              case "br":
                outputStream = node_zlib_1.default.createBrotliDecompress();
                break;
              case "zstd":
                if (node_zlib_1.default.createZstdDecompress != null) {
                  outputStream = node_zlib_1.default.createZstdDecompress();
                }
                break;
            }
            if (nodeResponse.headers.location && (0, utils_js_1.shouldRedirect)(nodeResponse.statusCode)) {
              if (fetchRequest.redirect === "error") {
                const redirectError = new Error("Redirects are not allowed");
                reject(redirectError);
                nodeResponse.resume();
                return;
              }
              if (fetchRequest.redirect === "follow") {
                const redirectedUrl = new URL_js_1.PonyfillURL(nodeResponse.headers.location, fetchRequest.parsedUrl || fetchRequest.url);
                const redirectResponse$ = fetchNodeHttp(new Request_js_1.PonyfillRequest(redirectedUrl, fetchRequest));
                resolve(redirectResponse$.then((redirectResponse) => {
                  redirectResponse.redirected = true;
                  return redirectResponse;
                }));
                nodeResponse.resume();
                return;
              }
            }
            outputStream ||= new node_stream_1.PassThrough();
            (0, utils_js_1.pipeThrough)({
              src: nodeResponse,
              dest: outputStream,
              signal,
              onError: (e) => {
                if (!nodeResponse.destroyed) {
                  nodeResponse.destroy(e);
                }
                if (!outputStream.destroyed) {
                  outputStream.destroy(e);
                }
                reject(e);
              }
            });
            const statusCode = nodeResponse.statusCode || 200;
            let statusText = nodeResponse.statusMessage || node_http_1.STATUS_CODES[statusCode];
            if (statusText == null) {
              statusText = "";
            }
            const ponyfillResponse = new Response_js_1.PonyfillResponse(outputStream || nodeResponse, {
              status: statusCode,
              statusText,
              headers: nodeResponse.headers,
              url: fetchRequest.url,
              signal
            });
            resolve(ponyfillResponse);
          });
          if (fetchRequest["_buffer"] != null) {
            (0, promise_helpers_1.handleMaybePromise)(() => (0, utils_js_1.safeWrite)(fetchRequest["_buffer"], nodeRequest), () => (0, utils_js_1.endStream)(nodeRequest), reject);
          } else if (fetchRequest["bodyType"] === "String") {
            (0, promise_helpers_1.handleMaybePromise)(() => (0, utils_js_1.safeWrite)(fetchRequest["bodyInit"], nodeRequest), () => (0, utils_js_1.endStream)(nodeRequest), reject);
          } else {
            const nodeReadable = fetchRequest.body != null ? (0, utils_js_1.isNodeReadable)(fetchRequest.body) ? fetchRequest.body : node_stream_1.Readable.from(fetchRequest.body) : null;
            if (nodeReadable) {
              nodeReadable.pipe(nodeRequest);
            } else {
              (0, utils_js_1.endStream)(nodeRequest);
            }
          }
        } catch (e) {
          reject(e);
        }
      });
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/fetch.js
var require_fetch = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/fetch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fetchPonyfill = fetchPonyfill;
    var node_buffer_1 = __require("node:buffer");
    var node_fs_1 = __require("node:fs");
    var node_url_1 = __require("node:url");
    var fetchCurl_js_1 = require_fetchCurl();
    var fetchNodeHttp_js_1 = require_fetchNodeHttp();
    var Request_js_1 = require_Request();
    var Response_js_1 = require_Response();
    var URL_js_1 = require_URL();
    var utils_js_1 = require_utils();
    var BASE64_SUFFIX = ";base64";
    async function getResponseForFile(url) {
      const path = (0, node_url_1.fileURLToPath)(url);
      try {
        await node_fs_1.promises.access(path, node_fs_1.promises.constants.R_OK);
        const stats = await node_fs_1.promises.stat(path, {
          bigint: true
        });
        const readable = (0, node_fs_1.createReadStream)(path);
        return new Response_js_1.PonyfillResponse(readable, {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/octet-stream",
            "last-modified": stats.mtime.toUTCString()
          }
        });
      } catch (err) {
        if (err.code === "ENOENT") {
          return new Response_js_1.PonyfillResponse(null, {
            status: 404,
            statusText: "Not Found"
          });
        } else if (err.code === "EACCES") {
          return new Response_js_1.PonyfillResponse(null, {
            status: 403,
            statusText: "Forbidden"
          });
        }
        throw err;
      }
    }
    function getResponseForDataUri(url) {
      const [mimeType = "text/plain", ...datas] = url.substring(5).split(",");
      const data = decodeURIComponent(datas.join(","));
      if (mimeType.endsWith(BASE64_SUFFIX)) {
        const buffer = node_buffer_1.Buffer.from(data, "base64url");
        const realMimeType = mimeType.slice(0, -BASE64_SUFFIX.length);
        return new Response_js_1.PonyfillResponse(buffer, {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": realMimeType
          }
        });
      }
      return new Response_js_1.PonyfillResponse(data, {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": mimeType
        }
      });
    }
    function getResponseForBlob(url) {
      const blob = URL_js_1.PonyfillURL.getBlobFromURL(url);
      if (!blob) {
        throw new TypeError("Invalid Blob URL");
      }
      return new Response_js_1.PonyfillResponse(blob, {
        status: 200,
        headers: {
          "content-type": blob.type,
          "content-length": blob.size.toString()
        }
      });
    }
    function isURL(obj) {
      return obj != null && obj.href != null;
    }
    function fetchPonyfill(info, init) {
      if (typeof info === "string" || isURL(info)) {
        const ponyfillRequest = new Request_js_1.PonyfillRequest(info, init);
        return fetchPonyfill(ponyfillRequest);
      }
      const fetchRequest = info;
      if (fetchRequest.url.startsWith("data:")) {
        const response = getResponseForDataUri(fetchRequest.url);
        return (0, utils_js_1.fakePromise)(response);
      }
      if (fetchRequest.url.startsWith("file:")) {
        const response = getResponseForFile(fetchRequest.url);
        return response;
      }
      if (fetchRequest.url.startsWith("blob:")) {
        const response = getResponseForBlob(fetchRequest.url);
        return (0, utils_js_1.fakePromise)(response);
      }
      if (globalThis.libcurl && !fetchRequest.agent) {
        return (0, fetchCurl_js_1.fetchCurl)(fetchRequest);
      }
      return (0, fetchNodeHttp_js_1.fetchNodeHttp)(fetchRequest);
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/TextEncoderDecoder.js
var require_TextEncoderDecoder = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/TextEncoderDecoder.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillTextDecoder = exports.PonyfillTextEncoder = void 0;
    exports.PonyfillBtoa = PonyfillBtoa;
    var node_buffer_1 = __require("node:buffer");
    var utils_js_1 = require_utils();
    var PonyfillTextEncoder = class {
      encoding;
      constructor(encoding = "utf-8") {
        this.encoding = encoding;
      }
      encode(input) {
        return node_buffer_1.Buffer.from(input, this.encoding);
      }
      encodeInto(source, destination) {
        const buffer = this.encode(source);
        const copied = buffer.copy(destination);
        return {
          read: copied,
          written: copied
        };
      }
    };
    exports.PonyfillTextEncoder = PonyfillTextEncoder;
    var PonyfillTextDecoder = class {
      encoding;
      fatal = false;
      ignoreBOM = false;
      constructor(encoding = "utf-8", options) {
        this.encoding = encoding;
        if (options) {
          this.fatal = options.fatal || false;
          this.ignoreBOM = options.ignoreBOM || false;
        }
      }
      decode(input) {
        if (node_buffer_1.Buffer.isBuffer(input)) {
          return input.toString(this.encoding);
        }
        if ((0, utils_js_1.isArrayBufferView)(input)) {
          return node_buffer_1.Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString(this.encoding);
        }
        return node_buffer_1.Buffer.from(input).toString(this.encoding);
      }
    };
    exports.PonyfillTextDecoder = PonyfillTextDecoder;
    function PonyfillBtoa(input) {
      return node_buffer_1.Buffer.from(input, "binary").toString("base64");
    }
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/URLSearchParams.js
var require_URLSearchParams = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/URLSearchParams.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillURLSearchParams = void 0;
    exports.PonyfillURLSearchParams = globalThis.URLSearchParams;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/WritableStream.js
var require_WritableStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/WritableStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillWritableStream = void 0;
    var node_events_1 = __require("node:events");
    var node_stream_1 = __require("node:stream");
    var promise_helpers_1 = require_cjs();
    var utils_js_1 = require_utils();
    var PonyfillWritableStream = class {
      writable;
      constructor(underlyingSink) {
        if (underlyingSink instanceof node_stream_1.Writable) {
          this.writable = underlyingSink;
        } else if (underlyingSink) {
          const writable = new node_stream_1.Writable({
            write(chunk, _encoding, callback) {
              try {
                const result = underlyingSink.write?.(chunk, controller);
                if (result instanceof Promise) {
                  result.then(() => {
                    callback();
                  }, (err) => {
                    callback(err);
                  });
                } else {
                  callback();
                }
              } catch (err) {
                callback(err);
              }
            },
            final(callback) {
              const result = underlyingSink.close?.();
              if (result instanceof Promise) {
                result.then(() => {
                  callback();
                }, (err) => {
                  callback(err);
                });
              } else {
                callback();
              }
            }
          });
          this.writable = writable;
          const abortCtrl = new AbortController();
          const controller = {
            signal: abortCtrl.signal,
            error(e) {
              writable.destroy(e);
            }
          };
          writable.once("error", (err) => abortCtrl.abort(err));
          writable.once("close", () => abortCtrl.abort());
        } else {
          this.writable = new node_stream_1.Writable();
        }
      }
      getWriter() {
        const writable = this.writable;
        return {
          get closed() {
            return (0, node_events_1.once)(writable, "close");
          },
          get desiredSize() {
            return writable.writableLength;
          },
          get ready() {
            return (0, node_events_1.once)(writable, "drain");
          },
          releaseLock() {
          },
          write(chunk) {
            const promise = (0, utils_js_1.fakePromise)();
            if (chunk == null) {
              return promise;
            }
            return promise.then(() => (0, utils_js_1.safeWrite)(chunk, writable));
          },
          close() {
            if (!writable.errored && writable.closed) {
              return (0, utils_js_1.fakePromise)();
            }
            if (writable.errored) {
              return (0, promise_helpers_1.fakeRejectPromise)(writable.errored);
            }
            return (0, utils_js_1.fakePromise)().then(() => (0, utils_js_1.endStream)(writable));
          },
          abort(reason) {
            writable.destroy(reason);
            return (0, node_events_1.once)(writable, "close");
          }
        };
      }
      close() {
        if (!this.writable.errored && this.writable.closed) {
          return (0, utils_js_1.fakePromise)();
        }
        if (this.writable.errored) {
          return (0, promise_helpers_1.fakeRejectPromise)(this.writable.errored);
        }
        return (0, utils_js_1.fakePromise)().then(() => (0, utils_js_1.endStream)(this.writable));
      }
      abort(reason) {
        this.writable.destroy(reason);
        return (0, node_events_1.once)(this.writable, "close");
      }
      locked = false;
    };
    exports.PonyfillWritableStream = PonyfillWritableStream;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/TransformStream.js
var require_TransformStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/TransformStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillTransformStream = void 0;
    var node_stream_1 = __require("node:stream");
    var ReadableStream_js_1 = require_ReadableStream();
    var utils_js_1 = require_utils();
    var WritableStream_js_1 = require_WritableStream();
    var PonyfillTransformStream = class {
      transform;
      writable;
      readable;
      constructor(transformer) {
        if (transformer instanceof node_stream_1.Transform) {
          this.transform = transformer;
        } else if (transformer) {
          const controller = {
            enqueue(chunk) {
              transform.push(chunk);
            },
            error(reason) {
              transform.destroy(reason);
            },
            terminate() {
              (0, utils_js_1.endStream)(transform);
            },
            get desiredSize() {
              return transform.writableLength;
            }
          };
          const transform = new node_stream_1.Transform({
            read() {
            },
            write(chunk, _encoding, callback) {
              try {
                const result = transformer.transform?.(chunk, controller);
                if (result instanceof Promise) {
                  result.then(() => {
                    callback();
                  }, (err) => {
                    callback(err);
                  });
                } else {
                  callback();
                }
              } catch (err) {
                callback(err);
              }
            },
            final(callback) {
              try {
                const result = transformer.flush?.(controller);
                if (result instanceof Promise) {
                  result.then(() => {
                    callback();
                  }, (err) => {
                    callback(err);
                  });
                } else {
                  callback();
                }
              } catch (err) {
                callback(err);
              }
            }
          });
          this.transform = transform;
        } else {
          this.transform = new node_stream_1.Transform();
        }
        this.writable = new WritableStream_js_1.PonyfillWritableStream(this.transform);
        this.readable = new ReadableStream_js_1.PonyfillReadableStream(this.transform);
      }
    };
    exports.PonyfillTransformStream = PonyfillTransformStream;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/CompressionStream.js
var require_CompressionStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/CompressionStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillCompressionStream = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var node_zlib_1 = tslib_1.__importDefault(__require("node:zlib"));
    var TransformStream_js_1 = require_TransformStream();
    var utils_js_1 = require_utils();
    var PonyfillCompressionStream = class extends TransformStream_js_1.PonyfillTransformStream {
      static supportedFormats = (0, utils_js_1.getSupportedFormats)();
      constructor(compressionFormat) {
        switch (compressionFormat) {
          case "x-gzip":
          case "gzip":
            super(node_zlib_1.default.createGzip());
            break;
          case "x-deflate":
          case "deflate":
            super(node_zlib_1.default.createDeflate());
            break;
          case "deflate-raw":
            super(node_zlib_1.default.createDeflateRaw());
            break;
          case "br":
            super(node_zlib_1.default.createBrotliCompress());
            break;
          case "zstd":
            super(node_zlib_1.default.createZstdCompress());
            break;
          default:
            throw new Error(`Unsupported compression format: ${compressionFormat}`);
        }
      }
    };
    exports.PonyfillCompressionStream = PonyfillCompressionStream;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/DecompressionStream.js
var require_DecompressionStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/DecompressionStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillDecompressionStream = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var node_zlib_1 = tslib_1.__importDefault(__require("node:zlib"));
    var TransformStream_js_1 = require_TransformStream();
    var utils_js_1 = require_utils();
    var PonyfillDecompressionStream = class extends TransformStream_js_1.PonyfillTransformStream {
      static supportedFormats = (0, utils_js_1.getSupportedFormats)();
      constructor(compressionFormat) {
        switch (compressionFormat) {
          case "x-gzip":
          case "gzip":
            super(node_zlib_1.default.createGunzip());
            break;
          case "x-deflate":
          case "deflate":
            super(node_zlib_1.default.createInflate());
            break;
          case "deflate-raw":
            super(node_zlib_1.default.createInflateRaw());
            break;
          case "br":
            super(node_zlib_1.default.createBrotliDecompress());
            break;
          case "zstd":
            super(node_zlib_1.default.createZstdDecompress());
            break;
          default:
            throw new TypeError(`Unsupported compression format: '${compressionFormat}'`);
        }
      }
    };
    exports.PonyfillDecompressionStream = PonyfillDecompressionStream;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/TextEncoderDecoderStream.js
var require_TextEncoderDecoderStream = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/TextEncoderDecoderStream.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PonyfillTextEncoderStream = exports.PonyfillTextDecoderStream = void 0;
    var TextEncoderDecoder_js_1 = require_TextEncoderDecoder();
    var TransformStream_js_1 = require_TransformStream();
    var PonyfillTextDecoderStream = class extends TransformStream_js_1.PonyfillTransformStream {
      textDecoder;
      constructor(encoding, options) {
        super({
          transform: (chunk, controller) => controller.enqueue(this.textDecoder.decode(chunk, { stream: true }))
        });
        this.textDecoder = new TextEncoderDecoder_js_1.PonyfillTextDecoder(encoding, options);
      }
      get encoding() {
        return this.textDecoder.encoding;
      }
      get fatal() {
        return this.textDecoder.fatal;
      }
      get ignoreBOM() {
        return this.textDecoder.ignoreBOM;
      }
    };
    exports.PonyfillTextDecoderStream = PonyfillTextDecoderStream;
    var PonyfillTextEncoderStream = class extends TransformStream_js_1.PonyfillTransformStream {
      textEncoder;
      constructor(encoding) {
        super({
          transform: (chunk, controller) => controller.enqueue(this.textEncoder.encode(chunk))
        });
        this.textEncoder = new TextEncoderDecoder_js_1.PonyfillTextEncoder(encoding);
      }
      get encoding() {
        return this.textEncoder.encoding;
      }
      encode(input) {
        return this.textEncoder.encode(input);
      }
    };
    exports.PonyfillTextEncoderStream = PonyfillTextEncoderStream;
  }
});

// ../../node_modules/@whatwg-node/node-fetch/cjs/index.js
var require_cjs3 = __commonJS({
  "../../node_modules/@whatwg-node/node-fetch/cjs/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TextEncoderStream = exports.TextDecoderStream = exports.IteratorObject = exports.DecompressionStream = exports.CompressionStream = exports.TransformStream = exports.WritableStream = exports.URLSearchParams = exports.URL = exports.btoa = exports.TextDecoder = exports.TextEncoder = exports.Blob = exports.FormData = exports.File = exports.ReadableStream = exports.Response = exports.Request = exports.Body = exports.Headers = exports.fetch = void 0;
    var fetch_js_1 = require_fetch();
    Object.defineProperty(exports, "fetch", { enumerable: true, get: function() {
      return fetch_js_1.fetchPonyfill;
    } });
    var Headers_js_1 = require_Headers();
    Object.defineProperty(exports, "Headers", { enumerable: true, get: function() {
      return Headers_js_1.PonyfillHeaders;
    } });
    var Body_js_1 = require_Body();
    Object.defineProperty(exports, "Body", { enumerable: true, get: function() {
      return Body_js_1.PonyfillBody;
    } });
    var Request_js_1 = require_Request();
    Object.defineProperty(exports, "Request", { enumerable: true, get: function() {
      return Request_js_1.PonyfillRequest;
    } });
    var Response_js_1 = require_Response();
    Object.defineProperty(exports, "Response", { enumerable: true, get: function() {
      return Response_js_1.PonyfillResponse;
    } });
    var ReadableStream_js_1 = require_ReadableStream();
    Object.defineProperty(exports, "ReadableStream", { enumerable: true, get: function() {
      return ReadableStream_js_1.PonyfillReadableStream;
    } });
    var File_js_1 = require_File();
    Object.defineProperty(exports, "File", { enumerable: true, get: function() {
      return File_js_1.PonyfillFile;
    } });
    var FormData_js_1 = require_FormData();
    Object.defineProperty(exports, "FormData", { enumerable: true, get: function() {
      return FormData_js_1.PonyfillFormData;
    } });
    var Blob_js_1 = require_Blob();
    Object.defineProperty(exports, "Blob", { enumerable: true, get: function() {
      return Blob_js_1.PonyfillBlob;
    } });
    var TextEncoderDecoder_js_1 = require_TextEncoderDecoder();
    Object.defineProperty(exports, "TextEncoder", { enumerable: true, get: function() {
      return TextEncoderDecoder_js_1.PonyfillTextEncoder;
    } });
    Object.defineProperty(exports, "TextDecoder", { enumerable: true, get: function() {
      return TextEncoderDecoder_js_1.PonyfillTextDecoder;
    } });
    Object.defineProperty(exports, "btoa", { enumerable: true, get: function() {
      return TextEncoderDecoder_js_1.PonyfillBtoa;
    } });
    var URL_js_1 = require_URL();
    Object.defineProperty(exports, "URL", { enumerable: true, get: function() {
      return URL_js_1.PonyfillURL;
    } });
    var URLSearchParams_js_1 = require_URLSearchParams();
    Object.defineProperty(exports, "URLSearchParams", { enumerable: true, get: function() {
      return URLSearchParams_js_1.PonyfillURLSearchParams;
    } });
    var WritableStream_js_1 = require_WritableStream();
    Object.defineProperty(exports, "WritableStream", { enumerable: true, get: function() {
      return WritableStream_js_1.PonyfillWritableStream;
    } });
    var TransformStream_js_1 = require_TransformStream();
    Object.defineProperty(exports, "TransformStream", { enumerable: true, get: function() {
      return TransformStream_js_1.PonyfillTransformStream;
    } });
    var CompressionStream_js_1 = require_CompressionStream();
    Object.defineProperty(exports, "CompressionStream", { enumerable: true, get: function() {
      return CompressionStream_js_1.PonyfillCompressionStream;
    } });
    var DecompressionStream_js_1 = require_DecompressionStream();
    Object.defineProperty(exports, "DecompressionStream", { enumerable: true, get: function() {
      return DecompressionStream_js_1.PonyfillDecompressionStream;
    } });
    var IteratorObject_js_1 = require_IteratorObject();
    Object.defineProperty(exports, "IteratorObject", { enumerable: true, get: function() {
      return IteratorObject_js_1.PonyfillIteratorObject;
    } });
    var TextEncoderDecoderStream_js_1 = require_TextEncoderDecoderStream();
    Object.defineProperty(exports, "TextDecoderStream", { enumerable: true, get: function() {
      return TextEncoderDecoderStream_js_1.PonyfillTextDecoderStream;
    } });
    Object.defineProperty(exports, "TextEncoderStream", { enumerable: true, get: function() {
      return TextEncoderDecoderStream_js_1.PonyfillTextEncoderStream;
    } });
  }
});

// ../../node_modules/@whatwg-node/fetch/dist/create-node-ponyfill.js
var require_create_node_ponyfill = __commonJS({
  "../../node_modules/@whatwg-node/fetch/dist/create-node-ponyfill.js"(exports, module) {
    var shouldSkipPonyfill = require_shouldSkipPonyfill();
    var newNodeFetch;
    module.exports = function createNodePonyfill(opts = {}) {
      const ponyfills = {};
      ponyfills.URLPattern = globalThis.URLPattern;
      if (!ponyfills.URLPattern) {
        const urlPatternModule = require_urlpattern_polyfill();
        ponyfills.URLPattern = urlPatternModule.URLPattern;
      }
      if (opts.skipPonyfill || shouldSkipPonyfill()) {
        return {
          fetch: globalThis.fetch,
          Headers: globalThis.Headers,
          Request: globalThis.Request,
          Response: globalThis.Response,
          FormData: globalThis.FormData,
          ReadableStream: globalThis.ReadableStream,
          WritableStream: globalThis.WritableStream,
          TransformStream: globalThis.TransformStream,
          CompressionStream: globalThis.CompressionStream,
          DecompressionStream: globalThis.DecompressionStream,
          TextDecoderStream: globalThis.TextDecoderStream,
          TextEncoderStream: globalThis.TextEncoderStream,
          Blob: globalThis.Blob,
          File: globalThis.File,
          crypto: globalThis.crypto,
          btoa: globalThis.btoa,
          TextEncoder: globalThis.TextEncoder,
          TextDecoder: globalThis.TextDecoder,
          URLPattern: ponyfills.URLPattern,
          URL: globalThis.URL,
          URLSearchParams: globalThis.URLSearchParams
        };
      }
      newNodeFetch ||= require_cjs3();
      ponyfills.fetch = newNodeFetch.fetch;
      ponyfills.Request = newNodeFetch.Request;
      ponyfills.Response = newNodeFetch.Response;
      ponyfills.Headers = newNodeFetch.Headers;
      ponyfills.FormData = newNodeFetch.FormData;
      ponyfills.ReadableStream = newNodeFetch.ReadableStream;
      ponyfills.URL = newNodeFetch.URL;
      ponyfills.URLSearchParams = newNodeFetch.URLSearchParams;
      ponyfills.WritableStream = newNodeFetch.WritableStream;
      ponyfills.TransformStream = newNodeFetch.TransformStream;
      ponyfills.CompressionStream = newNodeFetch.CompressionStream;
      ponyfills.DecompressionStream = newNodeFetch.DecompressionStream;
      ponyfills.TextDecoderStream = newNodeFetch.TextDecoderStream;
      ponyfills.TextEncoderStream = newNodeFetch.TextEncoderStream;
      ponyfills.Blob = newNodeFetch.Blob;
      ponyfills.File = newNodeFetch.File;
      ponyfills.crypto = globalThis.crypto;
      ponyfills.btoa = newNodeFetch.btoa;
      ponyfills.TextEncoder = newNodeFetch.TextEncoder;
      ponyfills.TextDecoder = newNodeFetch.TextDecoder;
      if (opts.formDataLimits) {
        ponyfills.Body = class Body extends newNodeFetch.Body {
          constructor(body, userOpts) {
            super(body, {
              formDataLimits: opts.formDataLimits,
              ...userOpts
            });
          }
        };
        ponyfills.Request = class Request extends newNodeFetch.Request {
          constructor(input, userOpts) {
            super(input, {
              formDataLimits: opts.formDataLimits,
              ...userOpts
            });
          }
        };
        ponyfills.Response = class Response extends newNodeFetch.Response {
          constructor(body, userOpts) {
            super(body, {
              formDataLimits: opts.formDataLimits,
              ...userOpts
            });
          }
        };
      }
      if (!ponyfills.crypto) {
        const cryptoModule = __require("crypto");
        ponyfills.crypto = cryptoModule.webcrypto;
      }
      return ponyfills;
    };
  }
});

// ../../node_modules/@whatwg-node/fetch/dist/node-ponyfill.js
var require_node_ponyfill = __commonJS({
  "../../node_modules/@whatwg-node/fetch/dist/node-ponyfill.js"(exports, module) {
    var createNodePonyfill = require_create_node_ponyfill();
    var shouldSkipPonyfill = require_shouldSkipPonyfill();
    var ponyfills = createNodePonyfill();
    if (!shouldSkipPonyfill()) {
      try {
        const nodelibcurlName = "node-libcurl";
        globalThis.libcurl = globalThis.libcurl || __require(nodelibcurlName);
      } catch (e) {
      }
    }
    module.exports.fetch = ponyfills.fetch;
    module.exports.Headers = ponyfills.Headers;
    module.exports.Request = ponyfills.Request;
    module.exports.Response = ponyfills.Response;
    module.exports.FormData = ponyfills.FormData;
    module.exports.ReadableStream = ponyfills.ReadableStream;
    module.exports.WritableStream = ponyfills.WritableStream;
    module.exports.TransformStream = ponyfills.TransformStream;
    module.exports.CompressionStream = ponyfills.CompressionStream;
    module.exports.DecompressionStream = ponyfills.DecompressionStream;
    module.exports.TextDecoderStream = ponyfills.TextDecoderStream;
    module.exports.TextEncoderStream = ponyfills.TextEncoderStream;
    module.exports.Blob = ponyfills.Blob;
    module.exports.File = ponyfills.File;
    module.exports.crypto = ponyfills.crypto;
    module.exports.btoa = ponyfills.btoa;
    module.exports.TextEncoder = ponyfills.TextEncoder;
    module.exports.TextDecoder = ponyfills.TextDecoder;
    module.exports.URLPattern = ponyfills.URLPattern;
    module.exports.URL = ponyfills.URL;
    module.exports.URLSearchParams = ponyfills.URLSearchParams;
    exports.createFetch = createNodePonyfill;
  }
});

// src/runtime/node/index.ts
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

// ../../node_modules/@whatwg-node/promise-helpers/esm/index.js
var kFakePromise = /* @__PURE__ */ Symbol.for("@whatwg-node/promise-helpers/FakePromise");
function isPromise(value) {
  return value?.then != null;
}
function isActualPromise(value) {
  const maybePromise = value;
  return maybePromise && maybePromise.then && maybePromise.catch && maybePromise.finally;
}
function handleMaybePromise(inputFactory, outputSuccessFactory, outputErrorFactory, finallyFactory) {
  let result$ = fakePromise().then(inputFactory).then(outputSuccessFactory, outputErrorFactory);
  if (finallyFactory) {
    result$ = result$.finally(finallyFactory);
  }
  return unfakePromise(result$);
}
function fakePromise(value) {
  if (value && isActualPromise(value)) {
    return value;
  }
  if (isPromise(value)) {
    return {
      then: (resolve, reject) => fakePromise(value.then(resolve, reject)),
      catch: (reject) => fakePromise(value.then((res) => res, reject)),
      finally: (cb) => fakePromise(cb ? promiseLikeFinally(value, cb) : value),
      [Symbol.toStringTag]: "Promise"
    };
  }
  return {
    then(resolve) {
      if (resolve) {
        try {
          return fakePromise(resolve(value));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    catch() {
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          return fakePromise(cb()).then(() => value, () => value);
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    [Symbol.toStringTag]: "Promise",
    __fakePromiseValue: value,
    [kFakePromise]: "resolved"
  };
}
function createDeferredPromise() {
  if (Promise.withResolvers) {
    return Promise.withResolvers();
  }
  let resolveFn;
  let rejectFn;
  const promise = new Promise(function deferredPromiseExecutor(resolve, reject) {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    get resolve() {
      return resolveFn;
    },
    get reject() {
      return rejectFn;
    }
  };
}
function iterateAsync(iterable, callback, results) {
  if (iterable?.length === 0) {
    return;
  }
  const iterator = iterable[Symbol.iterator]();
  let index = 0;
  function iterate() {
    const { done: endOfIterator, value } = iterator.next();
    if (endOfIterator) {
      return;
    }
    let endedEarly = false;
    function endEarly() {
      endedEarly = true;
    }
    return handleMaybePromise(function handleCallback() {
      return callback(value, endEarly, index++);
    }, function handleCallbackResult(result) {
      if (result) {
        results?.push(result);
      }
      if (endedEarly) {
        return;
      }
      return iterate();
    });
  }
  return iterate();
}
function fakeRejectPromise(error) {
  return {
    then(_resolve, reject) {
      if (reject) {
        try {
          return fakePromise(reject(error));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    catch(reject) {
      if (reject) {
        try {
          return fakePromise(reject(error));
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    finally(cb) {
      if (cb) {
        try {
          cb();
        } catch (err) {
          return fakeRejectPromise(err);
        }
      }
      return this;
    },
    __fakeRejectError: error,
    [Symbol.toStringTag]: "Promise",
    [kFakePromise]: "rejected"
  };
}
function isFakePromise(value) {
  return value?.[kFakePromise] === "resolved";
}
function isFakeRejectPromise(value) {
  return value?.[kFakePromise] === "rejected";
}
function promiseLikeFinally(value, onFinally) {
  if ("finally" in value) {
    return value.finally(onFinally);
  }
  return value.then((res) => {
    const finallyRes = onFinally();
    return isPromise(finallyRes) ? finallyRes.then(() => res) : res;
  }, (err) => {
    const finallyRes = onFinally();
    if (isPromise(finallyRes)) {
      return finallyRes.then(() => {
        throw err;
      });
    } else {
      throw err;
    }
  });
}
function unfakePromise(promise) {
  if (isFakePromise(promise)) {
    return promise.__fakePromiseValue;
  }
  if (isFakeRejectPromise(promise)) {
    throw promise.__fakeRejectError;
  }
  return promise;
}

// ../../node_modules/@envelop/instrumentation/esm/instrumentation.js
function chain(first, next) {
  const merged = { ...next, ...first };
  for (const key of Object.keys(merged)) {
    if (key in first && key in next) {
      merged[key] = (payload, wrapped) => first[key](payload, () => next[key](payload, wrapped));
    }
  }
  return merged;
}
var getInstrumented = (payload) => ({
  /**
   * Wraps the `wrapped` function with the given `instrument` wrapper.
   * @returns The wrapped function, or `undefined` if the instrument is `undefined`.
   */
  fn(instrument, wrapped) {
    if (!instrument) {
      return wrapped;
    }
    return (...args) => {
      let result;
      instrument(payload, () => {
        result = wrapped(...args);
      });
      return result;
    };
  },
  /**
   * Wraps the `wrapped` function with the given `instrument` wrapper.
   * @returns The wrapped function, or `undefined` if the instrument is `undefined`.
   */
  asyncFn(instrument, wrapped) {
    if (!instrument) {
      return wrapped;
    }
    return (...args) => {
      let result;
      return handleMaybePromise(() => instrument(payload, () => {
        result = wrapped(...args);
        return isPromise(result) ? result.then(() => void 0) : void 0;
      }), () => {
        return result;
      });
    };
  }
});

// ../../node_modules/@whatwg-node/disposablestack/esm/SupressedError.js
var PonyfillSuppressedError = class extends Error {
  error;
  suppressed;
  // eslint-disable-next-line n/handle-callback-err
  constructor(error, suppressed, message) {
    super(message);
    this.error = error;
    this.suppressed = suppressed;
    this.name = "SuppressedError";
    Error.captureStackTrace(this, this.constructor);
  }
};

// ../../node_modules/@whatwg-node/disposablestack/esm/symbols.js
var DisposableSymbols = {
  get dispose() {
    return Symbol.dispose || /* @__PURE__ */ Symbol.for("dispose");
  },
  get asyncDispose() {
    return Symbol.asyncDispose || /* @__PURE__ */ Symbol.for("asyncDispose");
  }
};

// ../../node_modules/@whatwg-node/disposablestack/esm/utils.js
function isSyncDisposable(obj) {
  return obj?.[DisposableSymbols.dispose] != null;
}
function isAsyncDisposable(obj) {
  return obj?.[DisposableSymbols.asyncDispose] != null;
}

// ../../node_modules/@whatwg-node/disposablestack/esm/AsyncDisposableStack.js
var SuppressedError2 = globalThis.SuppressedError || PonyfillSuppressedError;
var PonyfillAsyncDisposableStack = class _PonyfillAsyncDisposableStack {
  callbacks = [];
  get disposed() {
    return this.callbacks.length === 0;
  }
  use(value) {
    if (isAsyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.asyncDispose]());
    } else if (isSyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.dispose]());
    }
    return value;
  }
  adopt(value, onDisposeAsync) {
    if (onDisposeAsync) {
      this.callbacks.push(() => onDisposeAsync(value));
    }
    return value;
  }
  defer(onDisposeAsync) {
    if (onDisposeAsync) {
      this.callbacks.push(onDisposeAsync);
    }
  }
  move() {
    const stack = new _PonyfillAsyncDisposableStack();
    stack.callbacks = this.callbacks;
    this.callbacks = [];
    return stack;
  }
  disposeAsync() {
    return this[DisposableSymbols.asyncDispose]();
  }
  _error;
  _iterateCallbacks() {
    const cb = this.callbacks.pop();
    if (cb) {
      return handleMaybePromise(cb, () => this._iterateCallbacks(), (error) => {
        this._error = this._error ? new SuppressedError2(error, this._error) : error;
        return this._iterateCallbacks();
      });
    }
  }
  [DisposableSymbols.asyncDispose]() {
    const res$ = this._iterateCallbacks();
    if (res$?.then) {
      return res$.then(() => {
        if (this._error) {
          const error = this._error;
          this._error = void 0;
          throw error;
        }
      });
    }
    if (this._error) {
      const error = this._error;
      this._error = void 0;
      throw error;
    }
    return void 0;
  }
  [Symbol.toStringTag] = "AsyncDisposableStack";
};

// ../../node_modules/@whatwg-node/disposablestack/esm/DisposableStack.js
var SuppressedError3 = globalThis.SuppressedError || PonyfillSuppressedError;
var PonyfillDisposableStack = class _PonyfillDisposableStack {
  callbacks = [];
  get disposed() {
    return this.callbacks.length === 0;
  }
  use(value) {
    if (isSyncDisposable(value)) {
      this.callbacks.push(() => value[DisposableSymbols.dispose]());
    }
    return value;
  }
  adopt(value, onDispose) {
    if (onDispose) {
      this.callbacks.push(() => onDispose(value));
    }
    return value;
  }
  defer(onDispose) {
    if (onDispose) {
      this.callbacks.push(onDispose);
    }
  }
  move() {
    const stack = new _PonyfillDisposableStack();
    stack.callbacks = this.callbacks;
    this.callbacks = [];
    return stack;
  }
  dispose() {
    return this[DisposableSymbols.dispose]();
  }
  _error;
  _iterateCallbacks() {
    const cb = this.callbacks.pop();
    if (cb) {
      try {
        cb();
      } catch (error) {
        this._error = this._error ? new SuppressedError3(error, this._error) : error;
      }
      return this._iterateCallbacks();
    }
  }
  [DisposableSymbols.dispose]() {
    this._iterateCallbacks();
    if (this._error) {
      const error = this._error;
      this._error = void 0;
      throw error;
    }
  }
  [Symbol.toStringTag] = "DisposableStack";
};

// ../../node_modules/@whatwg-node/disposablestack/esm/index.js
var DisposableStack = globalThis.DisposableStack || PonyfillDisposableStack;
var AsyncDisposableStack = globalThis.AsyncDisposableStack || PonyfillAsyncDisposableStack;
var SuppressedError4 = globalThis.SuppressedError || PonyfillSuppressedError;

// ../../node_modules/@whatwg-node/server/esm/createServerAdapter.js
var DefaultFetchAPI = __toESM(require_node_ponyfill(), 1);

// ../../node_modules/@whatwg-node/server/esm/utils.js
function isAsyncIterable(body) {
  return body != null && typeof body === "object" && typeof body[Symbol.asyncIterator] === "function";
}
function getPort(nodeRequest) {
  if (nodeRequest.socket?.localPort) {
    return nodeRequest.socket?.localPort;
  }
  const hostInHeader = nodeRequest.headers?.[":authority"] || nodeRequest.headers?.host;
  const portInHeader = hostInHeader?.split(":")?.[1];
  if (portInHeader) {
    return portInHeader;
  }
  return 80;
}
function getHostnameWithPort(nodeRequest) {
  if (nodeRequest.headers?.[":authority"]) {
    return nodeRequest.headers?.[":authority"];
  }
  if (nodeRequest.headers?.host) {
    return nodeRequest.headers?.host;
  }
  const port = getPort(nodeRequest);
  if (nodeRequest.hostname) {
    return nodeRequest.hostname + ":" + port;
  }
  const localIp = nodeRequest.socket?.localAddress;
  if (localIp && !localIp?.includes("::") && !localIp?.includes("ffff")) {
    return `${localIp}:${port}`;
  }
  return "localhost";
}
function buildFullUrl(nodeRequest) {
  const hostnameWithPort = getHostnameWithPort(nodeRequest);
  const protocol = nodeRequest.protocol || (nodeRequest.socket?.encrypted ? "https" : "http");
  const endpoint = nodeRequest.originalUrl || nodeRequest.url || "/graphql";
  return `${protocol}://${hostnameWithPort}${endpoint}`;
}
function isRequestBody(body) {
  const stringTag = body[Symbol.toStringTag];
  if (typeof body === "string" || stringTag === "Uint8Array" || stringTag === "Blob" || stringTag === "FormData" || stringTag === "URLSearchParams" || isAsyncIterable(body)) {
    return true;
  }
  return false;
}
function normalizeNodeRequest(nodeRequest, fetchAPI, nodeResponse, __useCustomAbortCtrl) {
  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest;
  let fullUrl = buildFullUrl(rawRequest);
  if (nodeRequest.query) {
    const url = new fetchAPI.URL(fullUrl);
    for (const key in nodeRequest.query) {
      url.searchParams.set(key, nodeRequest.query[key]);
    }
    fullUrl = url.toString();
  }
  let normalizedHeaders = nodeRequest.headers;
  if (nodeRequest.headers?.[":method"]) {
    normalizedHeaders = {};
    for (const key in nodeRequest.headers) {
      if (!key.startsWith(":")) {
        normalizedHeaders[key] = nodeRequest.headers[key];
      }
    }
  }
  const controller = __useCustomAbortCtrl ? createCustomAbortControllerSignal() : new AbortController();
  if (nodeResponse?.once) {
    const closeEventListener = () => {
      if (!controller.signal.aborted) {
        Object.defineProperty(rawRequest, "aborted", { value: true });
        controller.abort(nodeResponse.errored ?? void 0);
      }
    };
    nodeResponse.once("error", closeEventListener);
    nodeResponse.once("close", closeEventListener);
    nodeResponse.once("finish", () => {
      nodeResponse.removeListener("close", closeEventListener);
    });
  }
  if (nodeRequest.method === "GET" || nodeRequest.method === "HEAD") {
    return new fetchAPI.Request(fullUrl, {
      method: nodeRequest.method,
      headers: normalizedHeaders,
      signal: controller.signal
    });
  }
  const maybeParsedBody = nodeRequest.body;
  if (maybeParsedBody != null && Object.keys(maybeParsedBody).length > 0) {
    if (isRequestBody(maybeParsedBody)) {
      return new fetchAPI.Request(fullUrl, {
        method: nodeRequest.method || "GET",
        headers: normalizedHeaders,
        body: maybeParsedBody,
        signal: controller.signal
      });
    }
    const request = new fetchAPI.Request(fullUrl, {
      method: nodeRequest.method || "GET",
      headers: normalizedHeaders,
      signal: controller.signal
    });
    if (!request.headers.get("content-type")?.includes("json")) {
      request.headers.set("content-type", "application/json; charset=utf-8");
    }
    return new Proxy(request, {
      get(_target, prop, receiver) {
        switch (prop) {
          case "json":
            return () => fakePromise(maybeParsedBody);
          case "text":
            return () => fakePromise(JSON.stringify(maybeParsedBody));
          default: {
            const val = Reflect.get(request, prop, request);
            if (typeof val === "function") {
              return function requestMethodWrapper(...args) {
                return val.apply(this === receiver ? request : this, args);
              };
            }
            return val;
          }
        }
      }
    });
  }
  return new fetchAPI.Request(fullUrl, {
    method: nodeRequest.method,
    headers: normalizedHeaders,
    signal: controller.signal,
    // @ts-expect-error - AsyncIterable is supported as body
    body: rawRequest,
    duplex: "half"
  });
}
function isReadable(stream) {
  return stream.read != null;
}
function isNodeRequest(request) {
  return isReadable(request);
}
function isServerResponse(stream) {
  return stream != null && stream.setHeader != null && stream.end != null && stream.once != null && stream.write != null;
}
function isReadableStream(stream) {
  return stream != null && stream.getReader != null;
}
function isFetchEvent(event) {
  return event != null && event.request != null && event.respondWith != null;
}
function configureSocket(rawRequest) {
  rawRequest?.socket?.setTimeout?.(0);
  rawRequest?.socket?.setNoDelay?.(true);
  rawRequest?.socket?.setKeepAlive?.(true);
}
function endResponse(serverResponse) {
  serverResponse.end(null, null, null);
}
function sendAsyncIterable(serverResponse, asyncIterable) {
  let closed = false;
  const closeEventListener = () => {
    closed = true;
  };
  serverResponse.once("error", closeEventListener);
  serverResponse.once("close", closeEventListener);
  serverResponse.once("finish", () => {
    serverResponse.removeListener("close", closeEventListener);
    serverResponse.removeListener("error", closeEventListener);
  });
  const iterator = asyncIterable[Symbol.asyncIterator]();
  return pumpToWritable(() => iterator.next(), serverResponse, () => closed);
}
function endDest(dest) {
  dest.end(null, null, null);
}
function pumpToWritable(source, dest, isClosed) {
  const pump = () => handleMaybePromise(source, (sourceResult) => {
    if (isClosed?.() || sourceResult.done) {
      return endDest(dest);
    }
    return handleMaybePromise(() => safeWrite(sourceResult.value, dest), () => isClosed?.() ? endDest(dest) : pump());
  });
  return pump();
}
function safeWrite(chunk, destination) {
  const result = destination.write(chunk);
  if (!result) {
    return new Promise((resolve) => destination.once("drain", resolve));
  }
}
var isNode1x = globalThis.process?.versions?.node?.startsWith("1");
function sendNodeResponse(fetchResponse, serverResponse, nodeRequest, __useSingleWriteHead) {
  if (serverResponse.closed || serverResponse.destroyed || serverResponse.writableEnded) {
    return;
  }
  if (!fetchResponse) {
    serverResponse.statusCode = 404;
    endResponse(serverResponse);
    return;
  }
  if (__useSingleWriteHead && // @ts-expect-error - headersInit is a private property
  fetchResponse.headers?.headersInit && // @ts-expect-error - headersInit is a private property
  !Array.isArray(fetchResponse.headers.headersInit) && // @ts-expect-error - headersInit is a private property
  !fetchResponse.headers.headersInit.get && // @ts-expect-error - map is a private property
  !fetchResponse.headers._map && // @ts-expect-error - _setCookies is a private property
  !fetchResponse.headers._setCookies?.length) {
    serverResponse.writeHead(
      fetchResponse.status,
      fetchResponse.statusText,
      // @ts-expect-error - headersInit is a private property
      fetchResponse.headers.headersInit
    );
  } else {
    if (serverResponse.setHeaders && !isNode1x) {
      serverResponse.setHeaders(fetchResponse.headers);
    } else {
      let setCookiesSet = false;
      fetchResponse.headers.forEach((value, key) => {
        if (key === "set-cookie") {
          if (setCookiesSet) {
            return;
          }
          setCookiesSet = true;
          const setCookies = fetchResponse.headers.getSetCookie?.();
          if (setCookies) {
            serverResponse.setHeader("set-cookie", setCookies);
            return;
          }
        }
        serverResponse.setHeader(key, value);
      });
    }
    serverResponse.writeHead(fetchResponse.status, fetchResponse.statusText);
  }
  if (fetchResponse["bodyType"] === "String") {
    const bodyString = (
      // @ts-expect-error - bodyInit is a private property
      fetchResponse["bodyInit"]
    );
    return handleMaybePromise(() => safeWrite(bodyString, serverResponse), () => endResponse(serverResponse));
  }
  const bufOfRes = (
    // @ts-expect-error - _buffer is a private property
    fetchResponse._buffer
  );
  if (bufOfRes) {
    return handleMaybePromise(() => safeWrite(bufOfRes, serverResponse), () => endResponse(serverResponse));
  }
  const fetchBody = fetchResponse.body;
  if (fetchBody == null) {
    endResponse(serverResponse);
    return;
  }
  if (
    // @ts-expect-error - Uint8Array is a valid body type
    fetchBody[Symbol.toStringTag] === "Uint8Array"
  ) {
    return handleMaybePromise(() => safeWrite(fetchBody, serverResponse), () => endResponse(serverResponse));
  }
  configureSocket(nodeRequest);
  if (isReadable(fetchBody)) {
    serverResponse.once("close", () => {
      fetchBody.destroy();
    });
    fetchBody.pipe(serverResponse, {
      end: true
    });
    return;
  }
  if (isReadableStream(fetchBody)) {
    return sendReadableStream(nodeRequest, serverResponse, fetchBody);
  }
  if (isAsyncIterable(fetchBody)) {
    return sendAsyncIterable(serverResponse, fetchBody);
  }
}
function sendReadableStream(nodeRequest, serverResponse, readableStream) {
  const reader = readableStream.getReader();
  nodeRequest?.once?.("error", (err) => {
    reader.cancel(err);
  });
  return pumpToWritable(() => reader.read(), serverResponse);
}
function isRequestInit(val) {
  return val != null && typeof val === "object" && ("body" in val || "cache" in val || "credentials" in val || "headers" in val || "integrity" in val || "keepalive" in val || "method" in val || "mode" in val || "redirect" in val || "referrer" in val || "referrerPolicy" in val || "signal" in val || "window" in val);
}
function completeAssign(...args) {
  const [target, ...sources] = args.filter((arg) => arg != null && typeof arg === "object");
  sources.forEach((source) => {
    const descriptors = Object.getOwnPropertyNames(source).reduce((descriptors2, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor) {
        descriptors2[key] = Object.getOwnPropertyDescriptor(source, key);
      }
      return descriptors2;
    }, {});
    Object.getOwnPropertySymbols(source).forEach((sym) => {
      const descriptor = Object.getOwnPropertyDescriptor(source, sym);
      if (descriptor?.enumerable) {
        descriptors[sym] = descriptor;
      }
    });
    Object.defineProperties(target, descriptors);
  });
  return target;
}
function handleErrorFromRequestHandler(error, ResponseCtor) {
  return new ResponseCtor(error.stack || error.message || error.toString(), {
    status: error.status || 500
  });
}
function isolateObject(originalCtx, waitUntilFn) {
  if (originalCtx == null) {
    if (waitUntilFn == null) {
      return {};
    }
    return {
      waitUntil: waitUntilFn
    };
  }
  return completeAssign(Object.create(originalCtx), {
    waitUntil: waitUntilFn
  }, originalCtx);
}
function handleAbortSignalAndPromiseResponse(response$, abortSignal) {
  if (abortSignal?.aborted) {
    throw abortSignal.reason;
  }
  if (isPromise(response$) && abortSignal) {
    let abortSignalFetchErrorHandler = function() {
      deferred$.reject(abortSignal.reason);
    };
    const deferred$ = createDeferredPromise();
    abortSignal.addEventListener("abort", abortSignalFetchErrorHandler, { once: true });
    response$.then(function fetchSuccessHandler(res) {
      deferred$.resolve(res);
    }).catch(function fetchErrorHandler(err) {
      deferred$.reject(err);
    }).finally(() => {
      abortSignal.removeEventListener("abort", abortSignalFetchErrorHandler);
    });
    return deferred$.promise;
  }
  return response$;
}
var terminateEvents = ["SIGINT", "exit", "SIGTERM"];
var disposableStacks = /* @__PURE__ */ new Set();
var eventListenerRegistered = false;
function ensureEventListenerForDisposableStacks() {
  if (eventListenerRegistered) {
    return;
  }
  eventListenerRegistered = true;
  for (const event of terminateEvents) {
    globalThis.process.once(event, function terminateHandler() {
      return Promise.allSettled([...disposableStacks].map((stack) => !stack.disposed && stack.disposeAsync()));
    });
  }
}
function ensureDisposableStackRegisteredForTerminateEvents(disposableStack) {
  if (globalThis.process) {
    ensureEventListenerForDisposableStacks();
    if (!disposableStacks.has(disposableStack)) {
      disposableStacks.add(disposableStack);
      disposableStack.defer(() => {
        disposableStacks.delete(disposableStack);
      });
    }
  }
}
var CustomAbortControllerSignal = class extends EventTarget {
  aborted = false;
  _onabort = null;
  _reason;
  constructor() {
    super();
    const nodeEvents = globalThis.process?.getBuiltinModule?.("node:events");
    if (nodeEvents?.kMaxEventTargetListeners) {
      this[nodeEvents.kMaxEventTargetListeners] = 0;
    }
  }
  throwIfAborted() {
    if (this._nativeCtrl?.signal?.throwIfAborted) {
      return this._nativeCtrl.signal.throwIfAborted();
    }
    if (this.aborted) {
      throw this._reason;
    }
  }
  _nativeCtrl;
  ensureNativeCtrl() {
    if (!this._nativeCtrl) {
      const isAborted2 = this.aborted;
      this._nativeCtrl = new AbortController();
      if (isAborted2) {
        this._nativeCtrl.abort(this._reason);
      }
    }
    return this._nativeCtrl;
  }
  abort(reason) {
    if (this._nativeCtrl?.abort) {
      return this._nativeCtrl?.abort(reason);
    }
    this._reason = reason || new DOMException("This operation was aborted", "AbortError");
    this.aborted = true;
    this.dispatchEvent(new Event("abort"));
  }
  get signal() {
    if (this._nativeCtrl?.signal) {
      return this._nativeCtrl.signal;
    }
    return this;
  }
  get reason() {
    if (this._nativeCtrl?.signal) {
      return this._nativeCtrl.signal.reason;
    }
    return this._reason;
  }
  get onabort() {
    if (this._onabort) {
      return this._onabort;
    }
    return this._onabort;
  }
  set onabort(value) {
    if (this._nativeCtrl?.signal) {
      this._nativeCtrl.signal.onabort = value;
      return;
    }
    if (this._onabort) {
      this.removeEventListener("abort", this._onabort);
    }
    this._onabort = value;
    if (value) {
      this.addEventListener("abort", value);
    }
  }
};
function createCustomAbortControllerSignal() {
  if (globalThis.Bun || globalThis.Deno) {
    return new AbortController();
  }
  return new Proxy(new CustomAbortControllerSignal(), {
    get(target, prop, receiver) {
      if (prop.toString().includes("kDependantSignals")) {
        const nativeCtrl = target.ensureNativeCtrl();
        return Reflect.get(nativeCtrl.signal, prop, nativeCtrl.signal);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (prop.toString().includes("kDependantSignals")) {
        const nativeCtrl = target.ensureNativeCtrl();
        return Reflect.set(nativeCtrl.signal, prop, value, nativeCtrl.signal);
      }
      return Reflect.set(target, prop, value, receiver);
    },
    getPrototypeOf() {
      return AbortSignal.prototype;
    }
  });
}

// ../../node_modules/@whatwg-node/server/esm/uwebsockets.js
function isUWSResponse(res) {
  return !!res.onData;
}
function getRequestFromUWSRequest({ req, res, fetchAPI, controller }) {
  const method = req.getMethod();
  let duplex;
  const chunks = [];
  const pushFns = [
    (chunk) => {
      chunks.push(chunk);
    }
  ];
  const push = (chunk) => {
    for (const pushFn of pushFns) {
      pushFn(chunk);
    }
  };
  let stopped = false;
  const stopFns = [
    () => {
      stopped = true;
    }
  ];
  const stop = () => {
    for (const stopFn of stopFns) {
      stopFn();
    }
  };
  res.onData(function(ab, isLast) {
    push(Buffer.from(Buffer.from(ab, 0, ab.byteLength)));
    if (isLast) {
      stop();
    }
  });
  let getReadableStream;
  if (method !== "get" && method !== "head") {
    duplex = "half";
    controller.signal.addEventListener("abort", () => {
      stop();
    }, { once: true });
    let readableStream;
    getReadableStream = () => {
      if (!readableStream) {
        readableStream = new fetchAPI.ReadableStream({
          start(streamCtrl) {
            for (const chunk of chunks) {
              streamCtrl.enqueue(chunk);
            }
            if (stopped) {
              streamCtrl.close();
              return;
            }
            pushFns.push((chunk) => {
              streamCtrl.enqueue(chunk);
            });
            stopFns.push(() => {
              if (controller.signal.reason) {
                streamCtrl.error(controller.signal.reason);
                return;
              }
              if (streamCtrl.desiredSize) {
                streamCtrl.close();
              }
            });
          }
        });
      }
      return readableStream;
    };
  }
  const headers = new fetchAPI.Headers();
  req.forEach((key, value) => {
    headers.append(key, value);
  });
  let url = `http://localhost${req.getUrl()}`;
  const query = req.getQuery();
  if (query) {
    url += `?${query}`;
  }
  let buffer;
  function getBody() {
    if (!getReadableStream) {
      return null;
    }
    if (stopped) {
      return getBufferFromChunks();
    }
    return getReadableStream();
  }
  const request = new fetchAPI.Request(url, {
    method,
    headers,
    get body() {
      return getBody();
    },
    signal: controller.signal,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - not in the TS types yet
    duplex
  });
  function getBufferFromChunks() {
    if (!buffer) {
      buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
    }
    return buffer;
  }
  function collectBuffer() {
    if (stopped) {
      return fakePromise(getBufferFromChunks());
    }
    return new Promise((resolve, reject) => {
      try {
        stopFns.push(() => {
          resolve(getBufferFromChunks());
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  Object.defineProperties(request, {
    body: {
      get() {
        return getBody();
      },
      configurable: true,
      enumerable: true
    },
    json: {
      value() {
        return collectBuffer().then((b) => b.toString("utf8")).then((t) => JSON.parse(t));
      },
      configurable: true,
      enumerable: true
    },
    text: {
      value() {
        return collectBuffer().then((b) => b.toString("utf8"));
      },
      configurable: true,
      enumerable: true
    },
    arrayBuffer: {
      value() {
        return collectBuffer();
      },
      configurable: true,
      enumerable: true
    }
  });
  return request;
}
function createWritableFromUWS(uwsResponse, fetchAPI) {
  return new fetchAPI.WritableStream({
    write(chunk) {
      uwsResponse.cork(() => {
        uwsResponse.write(chunk);
      });
    },
    close() {
      uwsResponse.cork(() => {
        uwsResponse.end();
      });
    }
  });
}
function sendResponseToUwsOpts(uwsResponse, fetchResponse, controller, fetchAPI) {
  if (!fetchResponse) {
    uwsResponse.writeStatus("404 Not Found");
    uwsResponse.end();
    return;
  }
  const bufferOfRes = fetchResponse._buffer;
  const strBody = fetchResponse["bodyType"] === "String" ? fetchResponse.bodyInit : void 0;
  if (controller.signal.aborted) {
    return;
  }
  uwsResponse.cork(() => {
    uwsResponse.writeStatus(`${fetchResponse.status} ${fetchResponse.statusText}`);
    let isSetCookieHandled = false;
    for (const [key, value] of fetchResponse.headers) {
      if (key !== "content-length" && key !== "transfer-encoding") {
        if (key === "set-cookie") {
          if (isSetCookieHandled) {
            continue;
          }
          isSetCookieHandled = true;
          const setCookies = fetchResponse.headers.getSetCookie?.();
          if (setCookies) {
            for (const setCookie of setCookies) {
              uwsResponse.writeHeader(key, setCookie);
            }
            continue;
          }
        }
        uwsResponse.writeHeader(key, value);
      }
    }
    if (strBody) {
      uwsResponse.end(strBody);
    } else if (bufferOfRes) {
      uwsResponse.end(bufferOfRes);
    } else if (!fetchResponse.body) {
      uwsResponse.end();
    }
  });
  if (strBody || bufferOfRes || !fetchResponse.body) {
    return;
  }
  controller.signal.addEventListener("abort", () => {
    if (!fetchResponse.body?.locked) {
      fetchResponse.body?.cancel(controller.signal.reason);
    }
  }, { once: true });
  return fetchResponse.body.pipeTo(createWritableFromUWS(uwsResponse, fetchAPI), {
    signal: controller.signal
  }).catch((err) => {
    if (controller.signal.aborted) {
      return;
    }
    throw err;
  });
}

// ../../node_modules/@whatwg-node/server/esm/createServerAdapter.js
function isRequestAccessible(serverContext) {
  try {
    return !!serverContext?.request;
  } catch {
    return false;
  }
}
var EMPTY_OBJECT = {};
function createServerAdapter(serverAdapterBaseObject, options) {
  const useSingleWriteHead = options?.__useSingleWriteHead == null ? true : options.__useSingleWriteHead;
  const fetchAPI = {
    ...DefaultFetchAPI,
    ...options?.fetchAPI
  };
  const useCustomAbortCtrl = options?.__useCustomAbortCtrl == null ? fetchAPI.Request !== globalThis.Request : options.__useCustomAbortCtrl;
  const givenHandleRequest = typeof serverAdapterBaseObject === "function" ? serverAdapterBaseObject : serverAdapterBaseObject.handle;
  const onRequestHooks = [];
  const onResponseHooks = [];
  let instrumentation;
  const waitUntilPromises = /* @__PURE__ */ new Set();
  let _disposableStack;
  function ensureDisposableStack() {
    if (!_disposableStack) {
      _disposableStack = new AsyncDisposableStack();
      if (options?.disposeOnProcessTerminate) {
        ensureDisposableStackRegisteredForTerminateEvents(_disposableStack);
      }
      _disposableStack.defer(() => {
        if (waitUntilPromises.size > 0) {
          return Promise.allSettled(waitUntilPromises).then(() => {
            waitUntilPromises.clear();
          }, () => {
            waitUntilPromises.clear();
          });
        }
      });
    }
    return _disposableStack;
  }
  function waitUntil(maybePromise) {
    if (isPromise(maybePromise)) {
      ensureDisposableStack();
      waitUntilPromises.add(maybePromise);
      maybePromise.then(() => {
        waitUntilPromises.delete(maybePromise);
      }, (err) => {
        console.error(`Unexpected error while waiting: ${err.message || err}`);
        waitUntilPromises.delete(maybePromise);
      });
    }
  }
  if (options?.plugins != null) {
    for (const plugin of options.plugins) {
      if (plugin.instrumentation) {
        instrumentation = instrumentation ? chain(instrumentation, plugin.instrumentation) : plugin.instrumentation;
      }
      if (plugin.onRequest) {
        onRequestHooks.push(plugin.onRequest);
      }
      if (plugin.onResponse) {
        onResponseHooks.push(plugin.onResponse);
      }
      const disposeFn = plugin[DisposableSymbols.dispose];
      if (disposeFn) {
        ensureDisposableStack().defer(disposeFn);
      }
      const asyncDisposeFn = plugin[DisposableSymbols.asyncDispose];
      if (asyncDisposeFn) {
        ensureDisposableStack().defer(asyncDisposeFn);
      }
      if (plugin.onDispose) {
        ensureDisposableStack().defer(plugin.onDispose);
      }
    }
  }
  let handleRequest = onRequestHooks.length > 0 || onResponseHooks.length > 0 ? function handleRequest2(request, serverContext) {
    let requestHandler = givenHandleRequest;
    let response;
    if (onRequestHooks.length === 0) {
      return handleEarlyResponse();
    }
    let url = request["parsedUrl"] || new Proxy(EMPTY_OBJECT, {
      get(_target, prop, _receiver) {
        url = new fetchAPI.URL(request.url, "http://localhost");
        return Reflect.get(url, prop, url);
      }
    });
    function handleResponse(response2) {
      if (onResponseHooks.length === 0) {
        return response2;
      }
      return handleMaybePromise(() => iterateAsync(onResponseHooks, (onResponseHook) => onResponseHook({
        request,
        response: response2,
        serverContext,
        setResponse(newResponse) {
          response2 = newResponse;
        },
        fetchAPI
      })), () => response2);
    }
    function handleEarlyResponse() {
      if (!response) {
        return handleMaybePromise(() => requestHandler(request, serverContext), handleResponse);
      }
      return handleResponse(response);
    }
    return handleMaybePromise(() => iterateAsync(onRequestHooks, (onRequestHook, stopEarly) => onRequestHook({
      request,
      setRequest(newRequest) {
        request = newRequest;
      },
      serverContext,
      fetchAPI,
      url,
      requestHandler,
      setRequestHandler(newRequestHandler) {
        requestHandler = newRequestHandler;
      },
      endResponse(newResponse) {
        response = newResponse;
        if (newResponse) {
          stopEarly();
        }
      }
    })), handleEarlyResponse);
  } : givenHandleRequest;
  if (instrumentation?.request) {
    const originalRequestHandler = handleRequest;
    handleRequest = (request, initialContext) => {
      return getInstrumented({ request }).asyncFn(instrumentation.request, originalRequestHandler)(request, initialContext);
    };
  }
  function handleNodeRequest(nodeRequest, ...ctx) {
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    if (!serverContext.waitUntil) {
      serverContext.waitUntil = waitUntil;
    }
    const request = normalizeNodeRequest(nodeRequest, fetchAPI, void 0, useCustomAbortCtrl);
    return handleRequest(request, serverContext);
  }
  function handleNodeRequestAndResponse(nodeRequest, nodeResponseOrContainer, ...ctx) {
    const nodeResponse = nodeResponseOrContainer.raw || nodeResponseOrContainer;
    const serverContext = ctx.length > 1 ? completeAssign(...ctx) : ctx[0] || {};
    if (!serverContext.waitUntil) {
      serverContext.waitUntil = waitUntil;
    }
    const request = normalizeNodeRequest(nodeRequest, fetchAPI, nodeResponse, useCustomAbortCtrl);
    return handleRequest(request, serverContext);
  }
  function requestListener(nodeRequest, nodeResponse, ...ctx) {
    const defaultServerContext = {
      req: nodeRequest,
      res: nodeResponse,
      waitUntil
    };
    return unfakePromise(fakePromise().then(() => handleNodeRequestAndResponse(nodeRequest, nodeResponse, defaultServerContext, ...ctx)).catch((err) => handleErrorFromRequestHandler(err, fetchAPI.Response)).then((response) => sendNodeResponse(response, nodeResponse, nodeRequest, useSingleWriteHead)).catch((err) => console.error(`Unexpected error while handling request: ${err.message || err}`)));
  }
  function handleUWS(res, req, ...ctx) {
    const defaultServerContext = {
      res,
      req,
      waitUntil
    };
    const filteredCtxParts = ctx.filter((partCtx) => partCtx != null);
    const serverContext = filteredCtxParts.length > 0 ? completeAssign(defaultServerContext, ...ctx) : defaultServerContext;
    const controller = useCustomAbortCtrl ? createCustomAbortControllerSignal() : new AbortController();
    const originalResEnd = res.end.bind(res);
    let resEnded = false;
    res.end = function(data) {
      resEnded = true;
      return originalResEnd(data);
    };
    const originalOnAborted = res.onAborted.bind(res);
    originalOnAborted(function() {
      controller.abort();
    });
    res.onAborted = function(cb) {
      controller.signal.addEventListener("abort", cb, { once: true });
    };
    const request = getRequestFromUWSRequest({
      req,
      res,
      fetchAPI,
      controller
    });
    return handleMaybePromise(() => handleMaybePromise(() => handleRequest(request, serverContext), (response) => response, (err) => handleErrorFromRequestHandler(err, fetchAPI.Response)), (response) => {
      if (!controller.signal.aborted && !resEnded) {
        return handleMaybePromise(() => sendResponseToUwsOpts(res, response, controller, fetchAPI), (r) => r, (err) => {
          console.error(`Unexpected error while handling request: ${err.message || err}`);
        });
      }
    });
  }
  function handleEvent(event, ...ctx) {
    if (!event.respondWith || !event.request) {
      throw new TypeError(`Expected FetchEvent, got ${event}`);
    }
    const filteredCtxParts = ctx.filter((partCtx) => partCtx != null);
    const serverContext = filteredCtxParts.length > 0 ? completeAssign({}, event, ...filteredCtxParts) : isolateObject(event);
    const response$ = handleRequest(event.request, serverContext);
    event.respondWith(response$);
  }
  function handleRequestWithWaitUntil(request, ...ctx) {
    const filteredCtxParts = ctx.filter((partCtx) => partCtx != null);
    const serverContext = filteredCtxParts.length > 1 ? completeAssign({}, ...filteredCtxParts) : isolateObject(filteredCtxParts[0], filteredCtxParts[0] == null || filteredCtxParts[0].waitUntil == null ? waitUntil : void 0);
    return handleRequest(request, serverContext);
  }
  const fetchFn = (input, ...maybeCtx) => {
    if (typeof input === "string" || "href" in input) {
      const [initOrCtx, ...restOfCtx] = maybeCtx;
      if (isRequestInit(initOrCtx)) {
        const request2 = new fetchAPI.Request(input, initOrCtx);
        const res$2 = handleRequestWithWaitUntil(request2, ...restOfCtx);
        const signal = initOrCtx.signal;
        if (signal) {
          return handleAbortSignalAndPromiseResponse(res$2, signal);
        }
        return res$2;
      }
      const request = new fetchAPI.Request(input);
      return handleRequestWithWaitUntil(request, ...maybeCtx);
    }
    const res$ = handleRequestWithWaitUntil(input, ...maybeCtx);
    return handleAbortSignalAndPromiseResponse(res$, input.signal);
  };
  const genericRequestHandler = (input, ...maybeCtx) => {
    const [initOrCtxOrRes, ...restOfCtx] = maybeCtx;
    if (isNodeRequest(input)) {
      if (!isServerResponse(initOrCtxOrRes)) {
        throw new TypeError(`Expected ServerResponse, got ${initOrCtxOrRes}`);
      }
      return requestListener(input, initOrCtxOrRes, ...restOfCtx);
    }
    if (isUWSResponse(input)) {
      return handleUWS(input, initOrCtxOrRes, ...restOfCtx);
    }
    if (isServerResponse(initOrCtxOrRes)) {
      throw new TypeError("Got Node response without Node request");
    }
    if (isRequestAccessible(input)) {
      if (isFetchEvent(input)) {
        return handleEvent(input, ...maybeCtx);
      }
      return handleRequestWithWaitUntil(input.request, input, ...maybeCtx);
    }
    return fetchFn(input, ...maybeCtx);
  };
  const adapterObj = {
    handleRequest: handleRequestWithWaitUntil,
    fetch: fetchFn,
    handleNodeRequest,
    handleNodeRequestAndResponse,
    requestListener,
    handleEvent,
    handleUWS,
    handle: genericRequestHandler,
    get disposableStack() {
      return ensureDisposableStack();
    },
    [DisposableSymbols.asyncDispose]() {
      if (_disposableStack && !_disposableStack.disposed) {
        return _disposableStack.disposeAsync();
      }
      return fakePromise();
    },
    dispose() {
      if (_disposableStack && !_disposableStack.disposed) {
        return _disposableStack.disposeAsync();
      }
      return fakePromise();
    },
    waitUntil
  };
  const serverAdapter = new Proxy(genericRequestHandler, {
    // It should have all the attributes of the handler function and the server instance
    has: (_, prop) => {
      return prop in adapterObj || prop in genericRequestHandler || serverAdapterBaseObject && prop in serverAdapterBaseObject;
    },
    get: (_, prop) => {
      if (globalThis.Deno || prop === Symbol.asyncDispose || prop === Symbol.dispose) {
        const adapterProp2 = Reflect.get(adapterObj, prop, adapterObj);
        if (adapterProp2) {
          return adapterProp2;
        }
      }
      const adapterProp = adapterObj[prop];
      if (adapterProp) {
        if (adapterProp.bind) {
          return adapterProp.bind(adapterObj);
        }
        return adapterProp;
      }
      const handleProp = genericRequestHandler[prop];
      if (handleProp) {
        if (handleProp.bind) {
          return handleProp.bind(genericRequestHandler);
        }
        return handleProp;
      }
      if (serverAdapterBaseObject) {
        const serverAdapterBaseObjectProp = serverAdapterBaseObject[prop];
        if (serverAdapterBaseObjectProp) {
          if (serverAdapterBaseObjectProp.bind) {
            return function(...args) {
              const returnedVal = serverAdapterBaseObject[prop](...args);
              if (returnedVal === serverAdapterBaseObject) {
                return serverAdapter;
              }
              return returnedVal;
            };
          }
          return serverAdapterBaseObjectProp;
        }
      }
    },
    apply(_, __, args) {
      return genericRequestHandler(...args);
    }
  });
  return serverAdapter;
}

// src/http.ts
function getCorsHeaders(request, allowedOrigins) {
  const origin = request.headers.get("Origin") ?? "";
  const allowlist = allowedOrigins.split(",").map((s) => s.trim());
  const allow = allowlist.includes(origin) ? origin : allowlist[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    Vary: "Origin"
  };
}
function jsonResponse(status, body, corsHeaders, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extra
    }
  });
}
function errorResponse(status, error, corsHeaders, details) {
  return jsonResponse(status, { error, ...details ? { details } : {} }, corsHeaders);
}
var HttpError = class extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
};

// ../../node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../../packages/shared/src/accounts.ts
var emailSchema = external_exports.string().trim().min(3).max(254).email("must be a valid email address").transform((s) => s.toLowerCase());
var passwordSchema = external_exports.string().min(8, "password must be at least 8 characters").max(200);
var registerInput = external_exports.object({
  email: emailSchema,
  password: passwordSchema,
  name: external_exports.string().trim().min(1, "name is required").max(80),
  tenantName: external_exports.string().trim().min(1, "workspace name is required").max(80)
});
var loginInput = external_exports.object({
  email: emailSchema,
  password: external_exports.string().min(1, "password is required").max(200)
});
var forgotPasswordInput = external_exports.object({
  email: emailSchema
});
var resetPasswordInput = external_exports.object({
  token: external_exports.string().min(1, "token is required"),
  password: passwordSchema
});
var createTokenInput = external_exports.object({
  label: external_exports.string().trim().min(1, "label is required").max(80)
});

// ../../packages/shared/src/auth.ts
var patchMeInput = external_exports.object({
  color: external_exports.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be a #rrggbb hex")
});

// ../../packages/shared/src/board.ts
var name = external_exports.string().trim().min(1).max(120);
var color = external_exports.string().trim().max(32).nullable().optional();
var longText = external_exports.string().max(2e4).nullable().optional();
var position = external_exports.number().finite().optional();
var idRef = external_exports.string().min(1).max(64);
var code = external_exports.string().trim().regex(/^[A-Za-z0-9]{2,6}$/, "code must be 2\u20136 letters or digits").transform((s) => s.toUpperCase());
var createProjectInput = external_exports.object({
  name,
  code,
  description: longText,
  color
});
var patchProjectInput = external_exports.object({
  name: name.optional(),
  code: code.optional(),
  description: longText,
  color,
  status: external_exports.enum(["active", "archived"]).optional()
});
var createColumnInput = external_exports.object({
  name,
  color,
  position
});
var patchColumnInput = external_exports.object({
  name: name.optional(),
  color,
  position
});
var createCardInput = external_exports.object({
  summary: name,
  description: longText,
  acceptanceCriteria: longText,
  columnId: idRef.optional(),
  // defaults to the first column server-side
  assigneeUserId: idRef.nullable().optional(),
  position
});
var patchCardInput = external_exports.object({
  summary: name.optional(),
  description: longText,
  acceptanceCriteria: longText,
  columnId: idRef.optional(),
  assigneeUserId: idRef.nullable().optional(),
  position
});
var DEFAULT_COLUMNS = [
  { name: "Todo", color: "#64748b" },
  { name: "In Progress", color: "#2563eb" },
  { name: "In Review", color: "#d97706" },
  { name: "Done", color: "#16a34a" }
];

// ../../packages/shared/src/colors.ts
var USER_PALETTE = [
  "#3b82f6",
  // blue
  "#dc2626",
  // red
  "#16a34a",
  // green
  "#d97706",
  // amber
  "#7c3aed",
  // violet
  "#0891b2",
  // cyan
  "#db2777",
  // pink
  "#65a30d"
  // lime
];
function colorForUser(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) >>> 0;
  return USER_PALETTE[h % USER_PALETTE.length];
}

// ../../packages/shared/src/events.ts
function classifyRedaction(e, userId) {
  if (e.kind === "system") return { allowed: false, alreadyRedacted: false, error: "not_comment" };
  if (e.authorUserId !== userId) return { allowed: false, alreadyRedacted: false, error: "not_author" };
  return { allowed: true, alreadyRedacted: e.deletedAt != null, error: null };
}
var handoffMeta = external_exports.object({
  summary: external_exports.string().max(2e3).optional(),
  evidence: external_exports.array(external_exports.string().max(500)).max(50).optional(),
  verify: external_exports.array(external_exports.string().max(500)).max(50).optional(),
  spunOff: external_exports.array(external_exports.string().max(120)).max(50).optional()
}).strict();
var createCommentInput = external_exports.object({
  type: external_exports.enum(["note", "handoff"]).optional(),
  body: external_exports.string().trim().min(1).max(2e4),
  meta: handoffMeta.optional()
  // only meaningful for a handoff
});

// ../../packages/shared/src/mentions.ts
var HANDLE_RE = /(?:^|[^\w@])@([a-z0-9](?:[a-z0-9_-]{0,30}))/gi;
function parseHandles(text) {
  if (!text) return [];
  const out = /* @__PURE__ */ new Set();
  for (const m of text.matchAll(HANDLE_RE)) out.add(m[1].toLowerCase());
  return [...out];
}
function resolveMentionRecipients(text, users, authorId) {
  const handles = parseHandles(text);
  if (handles.length === 0) return [];
  const byHandle = /* @__PURE__ */ new Map();
  for (const u of users) if (u.handle) byHandle.set(u.handle.toLowerCase(), u.id);
  const out = /* @__PURE__ */ new Set();
  for (const h of handles) {
    const id = byHandle.get(h);
    if (id && id !== authorId) out.add(id);
  }
  return [...out];
}
function diffRecipients(wanted, existing) {
  const w = new Set(wanted);
  const e = new Set(existing);
  return {
    add: [...w].filter((id) => !e.has(id)),
    remove: [...e].filter((id) => !w.has(id))
  };
}
var mentionsStatus = external_exports.enum(["unread", "read", "all"]);
var markMentionsReadInput = external_exports.object({
  mentionIds: external_exports.array(external_exports.string().min(1).max(64)).max(500).optional(),
  all: external_exports.boolean().optional()
}).refine((v) => v.all === true || Array.isArray(v.mentionIds) && v.mentionIds.length > 0, {
  message: "Provide a non-empty mentionIds array or all:true"
});

// ../../packages/shared/src/team.ts
var membershipRoleSchema = external_exports.enum(["admin", "member"]);
var inviteInput = external_exports.object({
  email: emailSchema,
  role: membershipRoleSchema
});
var acceptInviteInput = external_exports.object({
  token: external_exports.string().min(1, "token is required"),
  // Required only when the invite creates a brand-new user (enforced server-side).
  name: external_exports.string().trim().min(1).max(80).optional(),
  password: external_exports.string().min(8).max(200).optional()
});
var setMemberRoleInput = external_exports.object({ role: membershipRoleSchema });
var setProjectAccessInput = external_exports.object({ projectIds: external_exports.array(external_exports.string()) });

// src/validate.ts
async function parseJson(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      details[issue.path.join(".") || "_"] = issue.message;
    }
    throw new HttpError(400, "Validation failed", details);
  }
  return result.data;
}

// src/db/repos/users.ts
async function getTenant(env2, tenantId) {
  return env2.db.prepare("SELECT id, name, slug FROM tenants WHERE id = ?").bind(tenantId).first();
}
async function listUsers(env2, tenantId) {
  const rs = await env2.db.prepare(
    "SELECT id, name, kind, role, color, handle FROM users WHERE tenant_id = ? ORDER BY name ASC"
  ).bind(tenantId).all();
  return (rs.results ?? []).map(toUserDto);
}
async function updateUserColor(env2, tenantId, userId, color2) {
  await env2.db.prepare("UPDATE users SET color = ? WHERE id = ? AND tenant_id = ?").bind(color2, userId, tenantId).run();
}
function toUserDto(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    role: row.role ?? null,
    color: row.color ?? colorForUser(row.id),
    handle: row.handle ?? null
  };
}
async function mentionableUsers(env2, tenantId, projectId) {
  const rs = await env2.db.prepare(
    `SELECT u.id AS id, u.handle AS handle
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
      WHERE m.role = 'admin'
         OR EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = ? AND pa.user_id = u.id)`
  ).bind(tenantId, projectId).all();
  return rs.results ?? [];
}

// src/routes/me.ts
async function handleMe(ctx) {
  const { env: env2, cors, auth } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const tenant = await getTenant(env2, auth.tenantId);
  if (!tenant) return errorResponse(404, "Tenant not found", cors);
  const body = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: auth.userId, name: auth.userName, kind: auth.userKind, role: auth.role, color: auth.color }
  };
  return jsonResponse(200, body, cors);
}
async function handlePatchMe(ctx) {
  const { env: env2, cors, auth, request } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const input = await parseJson(request, patchMeInput);
  await updateUserColor(env2, auth.tenantId, auth.userId, input.color);
  const tenant = await getTenant(env2, auth.tenantId);
  if (!tenant) return errorResponse(404, "Tenant not found", cors);
  const body = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: auth.userId, name: auth.userName, kind: auth.userKind, role: auth.role, color: input.color }
  };
  return jsonResponse(200, body, cors);
}

// src/auth/tenant-scope.ts
function tenantScope(auth) {
  if (!auth) throw new HttpError(401, "Authentication required");
  return { tenantId: auth.tenantId, userId: auth.userId };
}

// src/db/ids.ts
function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

// src/db/repos/mentions.ts
async function reconcileMentionStmts(env2, opts, users) {
  const wanted = resolveMentionRecipients(opts.text, users, opts.authorId);
  const existingRs = await env2.db.prepare(
    `SELECT recipient_user_id FROM card_mentions
      WHERE tenant_id = ? AND card_id = ? AND source_kind = ? AND source_id = ?`
  ).bind(opts.tenantId, opts.cardId, opts.sourceKind, opts.sourceId).all();
  const existing = (existingRs.results ?? []).map((r) => r.recipient_user_id);
  const { add, remove } = diffRecipients(wanted, existing);
  const stmts = [];
  const now = Date.now();
  for (const recipientId of add) {
    stmts.push(
      env2.db.prepare(
        `INSERT INTO card_mentions
           (id, tenant_id, card_id, recipient_user_id, author_user_id, source_kind, source_id, created_at, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).bind(
        newId("men"),
        opts.tenantId,
        opts.cardId,
        recipientId,
        opts.authorId,
        opts.sourceKind,
        opts.sourceId,
        now
      )
    );
  }
  if (remove.length > 0) {
    const placeholders = remove.map(() => "?").join(", ");
    stmts.push(
      env2.db.prepare(
        `DELETE FROM card_mentions
          WHERE tenant_id = ? AND card_id = ? AND source_kind = ? AND source_id = ?
            AND recipient_user_id IN (${placeholders})`
      ).bind(opts.tenantId, opts.cardId, opts.sourceKind, opts.sourceId, ...remove)
    );
  }
  return stmts;
}
function deleteMentionsForCardStmt(env2, tenantId, cardId) {
  return env2.db.prepare("DELETE FROM card_mentions WHERE tenant_id = ? AND card_id = ?").bind(
    tenantId,
    cardId
  );
}
function deleteMentionsForCommentStmt(env2, tenantId, cardId, commentId) {
  return env2.db.prepare(
    `DELETE FROM card_mentions
      WHERE tenant_id = ? AND card_id = ? AND source_kind = 'comment' AND source_id = ?`
  ).bind(tenantId, cardId, commentId);
}
function toMentionDto(r) {
  const kind = r.source_kind;
  return {
    id: r.id,
    cardId: r.card_id,
    cardKey: r.project_code && r.card_seq != null ? `${r.project_code}-${r.card_seq}` : null,
    cardSummary: r.card_summary,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectName: r.project_name,
    source: { kind, commentId: kind === "comment" ? r.source_id : null },
    excerpt: r.excerpt ?? "",
    authorUserId: r.author_user_id,
    createdAt: r.created_at,
    readAt: r.read_at
  };
}
async function unreadMentionCount(env2, tenantId, userId) {
  const r = await env2.db.prepare(
    "SELECT COUNT(*) AS n FROM card_mentions WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL"
  ).bind(tenantId, userId).first();
  return r?.n ?? 0;
}
async function listMentions(env2, tenantId, userId, status, isAdmin = false) {
  const where = ["m.tenant_id = ?", "m.recipient_user_id = ?"];
  if (status === "unread") where.push("m.read_at IS NULL");
  else if (status === "read") where.push("m.read_at IS NOT NULL");
  if (!isAdmin) {
    where.push(
      "EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = p.id AND pa.user_id = m.recipient_user_id)"
    );
  }
  const limit = status === "unread" ? "" : " LIMIT 100";
  const rs = await env2.db.prepare(
    `SELECT m.id, m.card_id, m.author_user_id, m.source_kind, m.source_id, m.created_at, m.read_at,
            c.summary AS card_summary, c.seq AS card_seq,
            p.id AS project_id, p.code AS project_code, p.name AS project_name,
            CASE m.source_kind
              WHEN 'summary'             THEN c.summary
              WHEN 'description'         THEN c.description
              WHEN 'acceptance_criteria' THEN c.acceptance_criteria
              WHEN 'comment'             THEN (SELECT e.body FROM card_events e WHERE e.id = m.source_id)
            END AS excerpt
       FROM card_mentions m
       JOIN cards c    ON c.id = m.card_id
       JOIN projects p ON p.id = c.project_id
      WHERE ${where.join(" AND ")}
      ORDER BY (m.read_at IS NULL) DESC, m.created_at DESC${limit}`
  ).bind(tenantId, userId).all();
  return {
    mentions: (rs.results ?? []).map(toMentionDto),
    unreadCount: await unreadMentionCount(env2, tenantId, userId)
  };
}
async function markMentionsRead(env2, tenantId, userId, input) {
  const now = Date.now();
  if (input.all) {
    await env2.db.prepare(
      "UPDATE card_mentions SET read_at = ? WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL"
    ).bind(now, tenantId, userId).run();
  } else if (input.mentionIds && input.mentionIds.length > 0) {
    const placeholders = input.mentionIds.map(() => "?").join(", ");
    await env2.db.prepare(
      `UPDATE card_mentions SET read_at = ?
        WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL AND id IN (${placeholders})`
    ).bind(now, tenantId, userId, ...input.mentionIds).run();
  }
  return unreadMentionCount(env2, tenantId, userId);
}

// src/routes/mentions.ts
async function handleListMentions(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const parsed = mentionsStatus.safeParse(ctx.url.searchParams.get("status") ?? "unread");
  const status = parsed.success ? parsed.data : "unread";
  const body = await listMentions(ctx.env, tenantId, userId, status, ctx.auth?.role === "admin");
  return jsonResponse(200, body, ctx.cors);
}
async function handleMarkMentionsRead(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, markMentionsReadInput);
  const unreadCount = await markMentionsRead(ctx.env, tenantId, userId, input);
  return jsonResponse(200, { unreadCount }, ctx.cors);
}

// src/routes/users.ts
async function handleListUsers(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const users = await listUsers(ctx.env, tenantId);
  return jsonResponse(200, { users }, ctx.cors);
}

// src/rank.ts
var RANK_STEP = 1e3;

// src/auth/authenticate.ts
async function authenticate(request, env2) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env2.db.prepare(
    `SELECT t.id       AS token_id,
            t.tenant_id AS tenant_id,
            u.id        AS user_id,
            u.name      AS user_name,
            u.kind      AS user_kind,
            COALESCE(m.role, u.role) AS user_role,
            u.color     AS user_color
       FROM api_tokens t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN memberships m ON m.tenant_id = t.tenant_id AND m.user_id = u.id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL`
  ).bind(tokenHash).first();
  if (!row) return null;
  try {
    await env2.db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").bind(Date.now(), row.token_id).run();
  } catch {
  }
  return {
    tokenId: row.token_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    userName: row.user_name,
    userKind: row.user_kind,
    role: row.user_role ?? null,
    color: row.user_color ?? colorForUser(row.user_id)
  };
}
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/lib/password.ts
var ALGO = "pbkdf2-sha256";
var ITERATIONS = 1e5;
var SALT_BYTES = 32;
var KEY_BYTES = 32;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(password, salt, ITERATIONS, KEY_BYTES);
  return `${ALGO}$${ITERATIONS}$${b64encode(salt)}$${b64encode(derived)}`;
}
async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== ALGO) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  let salt;
  let expected;
  try {
    salt = b64decode(parts[2]);
    expected = b64decode(parts[3]);
  } catch {
    return false;
  }
  const actual = await pbkdf2(password, salt, iterations, expected.length);
  return timingSafeEqual(actual, expected);
}
var PASSWORD_ALGO = ALGO;
var bs = (x) => x;
async function pbkdf2(password, salt, iterations, length) {
  const key = await crypto.subtle.importKey(
    "raw",
    bs(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bs(salt), iterations },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function b64encode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// src/db/repos/auth.ts
var RESET_TTL_MS = 60 * 60 * 1e3;
async function loadSessionContext(env2, tenantId, userId) {
  const row = await env2.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.kind AS kind, u.color AS color, m.role AS role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.user_id = ?`
  ).bind(tenantId, userId).first();
  if (!row) return null;
  return {
    tenantId,
    userId: row.id,
    userName: row.name,
    userKind: row.kind,
    role: row.role ?? null,
    color: row.color ?? colorForUser(row.id),
    tokenId: null
  };
}
async function getAuthUser(env2, tenantId, userId) {
  const row = await env2.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.email AS email, u.kind AS kind,
            u.role AS legacy_role, u.color AS color, u.handle AS handle, m.role AS role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.user_id = ?`
  ).bind(tenantId, userId).first();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    kind: row.kind,
    role: row.role ?? "member",
    legacyRole: row.legacy_role ?? null,
    color: row.color ?? colorForUser(row.id),
    handle: row.handle ?? null
  };
}
async function registerTenant(env2, input) {
  const existing = await env2.db.prepare("SELECT 1 AS ok FROM users WHERE email = ?").bind(input.email).first();
  if (existing) throw new HttpError(409, "That email is already registered");
  const now = Date.now();
  const tenantId = newId("t");
  const userId = newId("u");
  const agentId = newId("u");
  const slug = await uniqueTenantSlug(env2, input.tenantName);
  const passwordHash = await hashPassword(input.password);
  const humanHandle = await uniqueHandle(env2, tenantId, deriveHandle(input.name));
  const agentHandle = await uniqueHandle(env2, tenantId, "assistant", [humanHandle]);
  await env2.db.batch([
    env2.db.prepare("INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)").bind(
      tenantId,
      input.tenantName,
      slug,
      now
    ),
    // Owner (human). Legacy role 'owner' mirrors the seed; membership role 'admin' governs.
    env2.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, email, password_hash, password_algo, email_verified_at, created_at)
       VALUES (?, ?, ?, 'human', 'owner', NULL, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, tenantId, input.name, humanHandle, input.email, passwordHash, PASSWORD_ALGO, now, now),
    // Starter agent so the tenant is agent-ready from minute one.
    env2.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, created_at)
       VALUES (?, ?, 'Assistant', 'agent', NULL, NULL, ?, ?)`
    ).bind(agentId, tenantId, agentHandle, now),
    env2.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'admin', ?)`
    ).bind(newId("m"), tenantId, userId, now),
    env2.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`
    ).bind(newId("m"), tenantId, agentId, now)
  ]);
  return { tenantId, userId };
}
async function loginUser(env2, email, password) {
  const user = await env2.db.prepare(
    "SELECT id, tenant_id, password_hash FROM users WHERE email = ?"
  ).bind(email).first();
  if (!user || !user.password_hash) return null;
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;
  const tenantId = await pickActiveTenant(env2, user.id, user.tenant_id);
  if (!tenantId) return null;
  return { tenantId, userId: user.id };
}
async function pickActiveTenant(env2, userId, originTenantId) {
  const rs = await env2.db.prepare(
    "SELECT tenant_id FROM memberships WHERE user_id = ? ORDER BY created_at ASC"
  ).bind(userId).all();
  const tenantIds = (rs.results ?? []).map((r) => r.tenant_id);
  if (tenantIds.length === 0) return null;
  if (originTenantId && tenantIds.includes(originTenantId)) return originTenantId;
  return tenantIds[0];
}
async function getUserByEmail(env2, email) {
  return env2.db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
}
async function issuePasswordResetToken(env2, userId) {
  const cleartext = randomToken();
  const tokenHash = await sha256Hex(cleartext);
  const now = Date.now();
  await env2.db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(newId("prt"), userId, tokenHash, now + RESET_TTL_MS, now).run();
  return cleartext;
}
async function consumePasswordResetToken(env2, cleartext, newPassword) {
  const tokenHash = await sha256Hex(cleartext);
  const row = await env2.db.prepare(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?"
  ).bind(tokenHash).first();
  if (!row || row.used_at || row.expires_at < Date.now()) return false;
  const now = Date.now();
  const passwordHash = await hashPassword(newPassword);
  await env2.db.batch([
    env2.db.prepare(
      "UPDATE users SET password_hash = ?, password_algo = ? WHERE id = ?"
    ).bind(passwordHash, PASSWORD_ALGO, row.user_id),
    env2.db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").bind(now, row.id)
  ]);
  return true;
}
async function listTokens(env2, tenantId, userId) {
  const rs = await env2.db.prepare(
    `SELECT id, label, created_at, last_used_at
       FROM api_tokens
      WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC`
  ).bind(tenantId, userId).all();
  return (rs.results ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at
  }));
}
async function createToken(env2, tenantId, userId, label) {
  const secret = randomToken();
  const tokenHash = await sha256Hex(secret);
  const id = newId("tok");
  const now = Date.now();
  await env2.db.prepare(
    `INSERT INTO api_tokens (id, tenant_id, user_id, token_hash, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, tenantId, userId, tokenHash, label, now).run();
  return {
    token: { id, label, createdAt: now, lastUsedAt: null },
    secret
  };
}
async function revokeToken(env2, tenantId, userId, tokenId) {
  const res = await env2.db.prepare(
    `UPDATE api_tokens SET revoked_at = ?
      WHERE id = ? AND tenant_id = ? AND user_id = ? AND revoked_at IS NULL`
  ).bind(Date.now(), tokenId, tenantId, userId).run();
  return (res.meta?.changes ?? 0) > 0;
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function slugify(input) {
  const s = input.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s || "workspace";
}
async function uniqueTenantSlug(env2, name2) {
  const base = slugify(name2);
  let attempt = base;
  for (let n = 2; n < 100; n++) {
    const clash = await env2.db.prepare("SELECT 1 AS ok FROM tenants WHERE slug = ?").bind(attempt).first();
    if (!clash) return attempt;
    attempt = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
function deriveHandle(name2) {
  const first = name2.toLowerCase().replace(/[^a-z0-9\s-]+/g, "").trim().split(/\s+/)[0];
  const cleaned = (first ?? "").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return cleaned || "user";
}
async function uniqueHandle(env2, tenantId, base, taken = []) {
  let attempt = base;
  for (let n = 2; n < 100; n++) {
    const clash = taken.includes(attempt) || await env2.db.prepare("SELECT 1 AS ok FROM users WHERE tenant_id = ? AND handle = ?").bind(tenantId, attempt).first();
    if (!clash) return attempt;
    attempt = `${base}${n}`;
  }
  return `${base}${crypto.randomUUID().slice(0, 4)}`;
}

// src/db/repos/team.ts
var INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function grantProjectAccessStmt(env2, tenantId, projectId, userId) {
  return env2.db.prepare(
    `INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
     VALUES (?, ?, ?, ?)`
  ).bind(tenantId, projectId, userId, Date.now());
}
async function replaceMemberProjectAccess(env2, tenantId, userId, projectIds) {
  const member = await env2.db.prepare(
    "SELECT 1 AS ok FROM memberships WHERE tenant_id = ? AND user_id = ?"
  ).bind(tenantId, userId).first();
  if (!member) throw new HttpError(404, "Member not found");
  let valid = [];
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => "?").join(", ");
    const rs = await env2.db.prepare(
      `SELECT id FROM projects WHERE tenant_id = ? AND id IN (${placeholders})`
    ).bind(tenantId, ...projectIds).all();
    valid = (rs.results ?? []).map((r) => r.id);
  }
  const now = Date.now();
  const stmts = [
    env2.db.prepare("DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?").bind(
      tenantId,
      userId
    ),
    ...valid.map(
      (pid) => env2.db.prepare(
        `INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(tenantId, pid, userId, now)
    )
  ];
  await env2.db.batch(stmts);
}
async function listTeam(env2, tenantId) {
  const membersRs = await env2.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.email AS email, u.kind AS kind, m.role AS role
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? ORDER BY u.name ASC`
  ).bind(tenantId).all();
  const accessRs = await env2.db.prepare(
    "SELECT project_id, user_id FROM project_access WHERE tenant_id = ?"
  ).bind(tenantId).all();
  const byUser = /* @__PURE__ */ new Map();
  for (const row of accessRs.results ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.project_id);
    byUser.set(row.user_id, list);
  }
  const members = (membersRs.results ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    kind: m.kind,
    role: m.role,
    projectIds: byUser.get(m.id) ?? []
  }));
  const now = Date.now();
  const invitesRs = await env2.db.prepare(
    `SELECT id, email, role, created_at, expires_at FROM invites
      WHERE tenant_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC`
  ).bind(tenantId, now).all();
  const invites = (invitesRs.results ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    createdAt: i.created_at,
    expiresAt: i.expires_at
  }));
  return { members, invites };
}
async function inviteMember(env2, tenantId, invitedByUserId, email, role) {
  const already = await env2.db.prepare(
    `SELECT 1 AS ok FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND u.email = ?`
  ).bind(tenantId, email).first();
  if (already) throw new HttpError(409, "That email is already a member of this workspace");
  const cleartext = randomToken();
  const tokenHash = await sha256Hex(cleartext);
  const id = newId("inv");
  const now = Date.now();
  await env2.db.batch([
    // Supersede any still-pending invite for the same email (one live invite per email).
    env2.db.prepare(
      `UPDATE invites SET revoked_at = ?
        WHERE tenant_id = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL`
    ).bind(now, tenantId, email),
    env2.db.prepare(
      `INSERT INTO invites (id, tenant_id, email, role, token_hash, invited_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, tenantId, email, role, tokenHash, invitedByUserId, now + INVITE_TTL_MS, now)
  ]);
  return { inviteId: id, cleartext };
}
async function revokeInvite(env2, tenantId, inviteId) {
  const res = await env2.db.prepare(
    `UPDATE invites SET revoked_at = ?
      WHERE id = ? AND tenant_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`
  ).bind(Date.now(), inviteId, tenantId).run();
  return (res.meta?.changes ?? 0) > 0;
}
async function acceptInvite(env2, cleartext, newUser) {
  const tokenHash = await sha256Hex(cleartext);
  const invite = await env2.db.prepare(
    `SELECT id, tenant_id, email, role, expires_at, accepted_at, revoked_at
       FROM invites WHERE token_hash = ?`
  ).bind(tokenHash).first();
  if (!invite || invite.accepted_at || invite.revoked_at || invite.expires_at < Date.now()) {
    return null;
  }
  const now = Date.now();
  const existing = await env2.db.prepare("SELECT id FROM users WHERE email = ?").bind(invite.email).first();
  if (existing) {
    const hasMembership = await env2.db.prepare(
      "SELECT 1 AS ok FROM memberships WHERE tenant_id = ? AND user_id = ?"
    ).bind(invite.tenant_id, existing.id).first();
    const stmts = [];
    if (!hasMembership) {
      stmts.push(
        env2.db.prepare(
          "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(newId("m"), invite.tenant_id, existing.id, invite.role, now)
      );
    }
    stmts.push(
      env2.db.prepare("UPDATE invites SET accepted_at = ?, accepted_user_id = ? WHERE id = ?").bind(
        now,
        existing.id,
        invite.id
      )
    );
    await env2.db.batch(stmts);
    return { tenantId: invite.tenant_id, userId: existing.id };
  }
  if (!newUser.password) throw new HttpError(400, "A password is required to accept this invite");
  const userId = newId("u");
  const name2 = newUser.name?.trim() || invite.email.split("@")[0];
  const handle = await uniqueHandle(env2, invite.tenant_id, deriveHandle(name2));
  const passwordHash = await hashPassword(newUser.password);
  await env2.db.batch([
    env2.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, email, password_hash, password_algo, email_verified_at, created_at)
       VALUES (?, ?, ?, 'human', NULL, NULL, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, invite.tenant_id, name2, handle, invite.email, passwordHash, PASSWORD_ALGO, now, now),
    env2.db.prepare(
      "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(newId("m"), invite.tenant_id, userId, invite.role, now),
    env2.db.prepare("UPDATE invites SET accepted_at = ?, accepted_user_id = ? WHERE id = ?").bind(
      now,
      userId,
      invite.id
    )
  ]);
  return { tenantId: invite.tenant_id, userId };
}
async function adminCount(env2, tenantId) {
  const r = await env2.db.prepare(
    "SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ? AND role = 'admin'"
  ).bind(tenantId).first();
  return r?.n ?? 0;
}
async function memberRole(env2, tenantId, userId) {
  const r = await env2.db.prepare("SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId).first();
  return r?.role ?? null;
}
async function setMemberRole(env2, tenantId, userId, role) {
  const current = await memberRole(env2, tenantId, userId);
  if (!current) throw new HttpError(404, "Member not found");
  if (current === "admin" && role !== "admin" && await adminCount(env2, tenantId) <= 1) {
    throw new HttpError(409, "You can't demote the last admin");
  }
  await env2.db.prepare("UPDATE memberships SET role = ? WHERE tenant_id = ? AND user_id = ?").bind(role, tenantId, userId).run();
}
async function removeMember(env2, tenantId, userId) {
  const current = await memberRole(env2, tenantId, userId);
  if (!current) throw new HttpError(404, "Member not found");
  if (current === "admin" && await adminCount(env2, tenantId) <= 1) {
    throw new HttpError(409, "You can't remove the last admin");
  }
  await env2.db.batch([
    env2.db.prepare("DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId),
    env2.db.prepare("DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId)
  ]);
}

// src/db/repos/projects.ts
function toDto(r) {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    color: r.color,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
async function assertCodeFree(env2, tenantId, code2, exceptId) {
  const row = await env2.db.prepare(
    `SELECT 1 AS x FROM projects WHERE tenant_id = ? AND code = ?${exceptId ? " AND id != ?" : ""}`
  ).bind(...exceptId ? [tenantId, code2, exceptId] : [tenantId, code2]).first();
  if (row) throw new HttpError(409, `Project code "${code2}" is already in use`);
}
async function projectCode(env2, tenantId, projectId) {
  const row = await env2.db.prepare("SELECT code FROM projects WHERE id = ? AND tenant_id = ?").bind(projectId, tenantId).first();
  return row?.code ?? null;
}
async function nextCardSeq(env2, tenantId, projectId) {
  const row = await env2.db.prepare(
    "UPDATE projects SET card_seq = card_seq + 1 WHERE id = ? AND tenant_id = ? RETURNING card_seq"
  ).bind(projectId, tenantId).first();
  if (!row) throw new HttpError(404, "Project not found");
  return row.card_seq;
}
async function listProjects(env2, tenantId, status, access) {
  const memberScoped = access && !access.isAdmin;
  let sql;
  let binds;
  if (memberScoped) {
    sql = `SELECT p.* FROM projects p
         JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = ?
        WHERE p.tenant_id = ?${status ? " AND p.status = ?" : ""}
        ORDER BY p.created_at DESC`;
    binds = status ? [access.userId, tenantId, status] : [access.userId, tenantId];
  } else {
    sql = `SELECT * FROM projects WHERE tenant_id = ?${status ? " AND status = ?" : ""} ORDER BY created_at DESC`;
    binds = status ? [tenantId, status] : [tenantId];
  }
  const rs = await env2.db.prepare(sql).bind(...binds).all();
  return (rs.results ?? []).map(toDto);
}
async function getProject(env2, tenantId, id) {
  const row = await env2.db.prepare("SELECT * FROM projects WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return row ? toDto(row) : null;
}
async function createProject(env2, tenantId, userId, input) {
  const id = newId("prj");
  const now = Date.now();
  await assertCodeFree(env2, tenantId, input.code);
  const stmts = [
    env2.db.prepare(
      `INSERT INTO projects (id, tenant_id, name, code, description, color, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).bind(id, tenantId, input.name, input.code, input.description ?? null, input.color ?? null, userId, now, now),
    ...DEFAULT_COLUMNS.map(
      (c, i) => env2.db.prepare(
        `INSERT INTO columns (id, tenant_id, project_id, name, color, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(newId("col"), tenantId, id, c.name, c.color, RANK_STEP * (i + 1), now)
    ),
    // RBAC: the creator is auto-granted access to their new project (admins
    // bypass, but the grant is harmless and keeps the row set consistent).
    grantProjectAccessStmt(env2, tenantId, id, userId)
  ];
  await env2.db.batch(stmts);
  const created = await getProject(env2, tenantId, id);
  if (!created) throw new HttpError(500, "Project insert did not return row");
  return created;
}
async function patchProject(env2, tenantId, id, input) {
  const existing = await getProject(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Project not found");
  if (input.code !== void 0 && input.code !== existing.code) {
    await assertCodeFree(env2, tenantId, input.code, id);
  }
  const next = {
    name: input.name ?? existing.name,
    code: input.code === void 0 ? existing.code : input.code,
    description: input.description === void 0 ? existing.description : input.description,
    color: input.color === void 0 ? existing.color : input.color,
    status: input.status ?? existing.status
  };
  await env2.db.prepare(
    `UPDATE projects SET name = ?, code = ?, description = ?, color = ?, status = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`
  ).bind(next.name, next.code, next.description, next.color, next.status, Date.now(), id, tenantId).run();
  const updated = await getProject(env2, tenantId, id);
  if (!updated) throw new HttpError(500, "Project update did not return row");
  return updated;
}
async function deleteProject(env2, tenantId, id) {
  const existing = await getProject(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Project not found");
  await env2.db.batch([
    env2.db.prepare(
      `DELETE FROM card_events WHERE tenant_id = ?
         AND card_id IN (SELECT id FROM cards WHERE project_id = ? AND tenant_id = ?)`
    ).bind(tenantId, id, tenantId),
    env2.db.prepare("DELETE FROM cards WHERE project_id = ? AND tenant_id = ?").bind(id, tenantId),
    env2.db.prepare("DELETE FROM columns WHERE project_id = ? AND tenant_id = ?").bind(id, tenantId),
    env2.db.prepare("DELETE FROM project_access WHERE project_id = ? AND tenant_id = ?").bind(id, tenantId),
    env2.db.prepare("DELETE FROM projects WHERE id = ? AND tenant_id = ?").bind(id, tenantId)
  ]);
}

// src/db/repos/columns.ts
function toDto2(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    color: r.color,
    position: r.position,
    createdAt: r.created_at
  };
}
async function listColumns(env2, tenantId, projectId) {
  const rs = await env2.db.prepare(
    "SELECT * FROM columns WHERE tenant_id = ? AND project_id = ? ORDER BY position ASC"
  ).bind(tenantId, projectId).all();
  return (rs.results ?? []).map(toDto2);
}
async function getColumnRow(env2, tenantId, id) {
  return env2.db.prepare("SELECT * FROM columns WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
}
async function createColumn(env2, tenantId, projectId, input) {
  let position2 = input.position;
  if (position2 === void 0) {
    const max = await env2.db.prepare(
      "SELECT MAX(position) AS m FROM columns WHERE tenant_id = ? AND project_id = ?"
    ).bind(tenantId, projectId).first();
    position2 = (max?.m ?? 0) + RANK_STEP;
  }
  const id = newId("col");
  await env2.db.prepare(
    `INSERT INTO columns (id, tenant_id, project_id, name, color, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tenantId, projectId, input.name, input.color ?? null, position2, Date.now()).run();
  const row = await getColumnRow(env2, tenantId, id);
  if (!row) throw new HttpError(500, "Column insert did not return row");
  return toDto2(row);
}
async function patchColumn(env2, tenantId, id, input) {
  const existing = await getColumnRow(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Column not found");
  const next = {
    name: input.name ?? existing.name,
    color: input.color === void 0 ? existing.color : input.color,
    position: input.position ?? existing.position
  };
  await env2.db.prepare("UPDATE columns SET name = ?, color = ?, position = ? WHERE id = ? AND tenant_id = ?").bind(next.name, next.color, next.position, id, tenantId).run();
  const row = await getColumnRow(env2, tenantId, id);
  if (!row) throw new HttpError(500, "Column update did not return row");
  return toDto2(row);
}
async function deleteColumn(env2, tenantId, id) {
  const existing = await getColumnRow(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Column not found");
  const count = await env2.db.prepare(
    "SELECT COUNT(*) AS n FROM cards WHERE column_id = ? AND tenant_id = ?"
  ).bind(id, tenantId).first();
  if ((count?.n ?? 0) > 0) {
    throw new HttpError(409, "Column is not empty \u2014 move or delete its cards first");
  }
  await env2.db.prepare("DELETE FROM columns WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
}
async function columnInProject(env2, tenantId, projectId, columnId) {
  const row = await env2.db.prepare(
    "SELECT 1 AS ok FROM columns WHERE id = ? AND tenant_id = ? AND project_id = ?"
  ).bind(columnId, tenantId, projectId).first();
  return Boolean(row);
}
async function firstColumnId(env2, tenantId, projectId) {
  const row = await env2.db.prepare(
    "SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? ORDER BY position ASC LIMIT 1"
  ).bind(tenantId, projectId).first();
  return row?.id ?? null;
}

// src/routes/projects.ts
async function handleListProjects(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const statusParam = ctx.url.searchParams.get("status") ?? void 0;
  const status = statusParam === "active" || statusParam === "archived" ? statusParam : void 0;
  const projects = await listProjects(ctx.env, tenantId, status, {
    userId,
    isAdmin: ctx.auth?.role === "admin"
  });
  return jsonResponse(200, { projects }, ctx.cors);
}
async function handleCreateProject(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, createProjectInput);
  const project = await createProject(ctx.env, tenantId, userId, input);
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(201, { project, columns }, ctx.cors);
}
async function handleGetProject(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id);
  if (!project) throw new HttpError(404, "Project not found");
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(200, { project, columns }, ctx.cors);
}
async function handlePatchProject(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchProjectInput);
  const project = await patchProject(ctx.env, tenantId, ctx.params.id, input);
  return jsonResponse(200, { project }, ctx.cors);
}
async function handleDeleteProject(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  await deleteProject(ctx.env, tenantId, ctx.params.id);
  return jsonResponse(200, { ok: true }, ctx.cors);
}

// src/routes/columns.ts
async function handleListColumns(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id);
  if (!project) throw new HttpError(404, "Project not found");
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(200, { columns }, ctx.cors);
}
async function handleCreateColumn(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id);
  if (!project) throw new HttpError(404, "Project not found");
  const input = await parseJson(ctx.request, createColumnInput);
  const column = await createColumn(ctx.env, tenantId, project.id, input);
  return jsonResponse(201, { column }, ctx.cors);
}
async function handlePatchColumn(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchColumnInput);
  const column = await patchColumn(ctx.env, tenantId, ctx.params.id, input);
  return jsonResponse(200, { column }, ctx.cors);
}
async function handleDeleteColumn(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  await deleteColumn(ctx.env, tenantId, ctx.params.id);
  return jsonResponse(200, { ok: true }, ctx.cors);
}

// src/auth/access.ts
async function resolveProjectId(env2, tenantId, scope, params) {
  const id = params[scope.param];
  if (!id) return null;
  if (scope.kind === "project") return id;
  const table = scope.kind === "card" ? "cards" : "columns";
  const row = await env2.db.prepare(`SELECT project_id FROM ${table} WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first();
  return row?.project_id ?? null;
}
async function callerHasProjectAccess(env2, auth, projectId) {
  if (auth.role === "admin") {
    const p = await env2.db.prepare("SELECT 1 AS ok FROM projects WHERE id = ? AND tenant_id = ?").bind(projectId, auth.tenantId).first();
    return Boolean(p);
  }
  const row = await env2.db.prepare(
    "SELECT 1 AS ok FROM project_access WHERE project_id = ? AND user_id = ? AND tenant_id = ?"
  ).bind(projectId, auth.userId, auth.tenantId).first();
  return Boolean(row);
}
async function enforceProjectAccess(env2, auth, scope, params) {
  const projectId = await resolveProjectId(env2, auth.tenantId, scope, params);
  if (!projectId) throw new HttpError(404, "Not found");
  if (!await callerHasProjectAccess(env2, auth, projectId)) throw new HttpError(404, "Not found");
}
async function userIsAdmin(env2, tenantId, userId) {
  const m = await env2.db.prepare("SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(tenantId, userId).first();
  return m?.role === "admin";
}
async function userHasProjectAccess(env2, tenantId, projectId, userId) {
  if (await userIsAdmin(env2, tenantId, userId)) return true;
  const row = await env2.db.prepare(
    "SELECT 1 AS ok FROM project_access WHERE project_id = ? AND user_id = ?"
  ).bind(projectId, userId).first();
  return Boolean(row);
}
function requireAdmin(auth) {
  if (!auth) throw new HttpError(401, "Authentication required");
  if (auth.role !== "admin") throw new HttpError(403, "Admin access required");
  return auth;
}

// src/db/repos/card_events.ts
function toDto3(r) {
  const redacted = r.deleted_at != null;
  let meta = null;
  if (!redacted && r.meta_json) {
    try {
      meta = JSON.parse(r.meta_json);
    } catch {
      meta = null;
    }
  }
  return {
    id: r.id,
    cardId: r.card_id,
    authorUserId: r.author_user_id,
    kind: r.kind,
    eventType: r.event_type ?? null,
    // Redacted comments carry no content — belt-and-suspenders even though the
    // DB row is nulled on redaction.
    body: redacted ? null : r.body,
    meta,
    createdAt: r.created_at,
    deletedAt: r.deleted_at ?? null,
    deletedBy: r.deleted_by ?? null
  };
}
function insertEventStmt(env2, e) {
  return env2.db.prepare(
    `INSERT INTO card_events
       (id, tenant_id, card_id, author_user_id, kind, event_type, body, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId("evt"),
    e.tenantId,
    e.cardId,
    e.authorUserId,
    e.kind,
    e.eventType ?? null,
    e.body ?? null,
    e.meta ? JSON.stringify(e.meta) : null,
    Date.now()
  );
}
async function listTimeline(env2, tenantId, cardId) {
  const rs = await env2.db.prepare(
    "SELECT * FROM card_events WHERE card_id = ? AND tenant_id = ? ORDER BY created_at ASC, id ASC"
  ).bind(cardId, tenantId).all();
  return (rs.results ?? []).map(toDto3);
}
async function addComment(env2, tenantId, cardId, userId, input) {
  const id = newId("evt");
  const kind = input.type ?? "note";
  const meta = kind === "handoff" && input.meta ? JSON.stringify(input.meta) : null;
  const card = await env2.db.prepare("SELECT project_id FROM cards WHERE id = ? AND tenant_id = ?").bind(cardId, tenantId).first();
  const users = card ? await mentionableUsers(env2, tenantId, card.project_id) : [];
  const mentionStmts = await reconcileMentionStmts(
    env2,
    { tenantId, cardId, authorId: userId, sourceKind: "comment", sourceId: id, text: input.body },
    users
  );
  await env2.db.batch([
    env2.db.prepare(
      `INSERT INTO card_events
         (id, tenant_id, card_id, author_user_id, kind, event_type, body, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).bind(id, tenantId, cardId, userId, kind, input.body, meta, Date.now()),
    ...mentionStmts
  ]);
  const row = await env2.db.prepare("SELECT * FROM card_events WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  if (!row) throw new Error("Comment insert did not return row");
  return toDto3(row);
}
async function redactComment(env2, tenantId, cardId, commentId, userId) {
  const row = await env2.db.prepare(
    "SELECT * FROM card_events WHERE id = ? AND card_id = ? AND tenant_id = ?"
  ).bind(commentId, cardId, tenantId).first();
  if (!row) throw new HttpError(404, "Comment not found");
  const verdict = classifyRedaction(
    { kind: row.kind, authorUserId: row.author_user_id, deletedAt: row.deleted_at },
    userId
  );
  if (verdict.error === "not_comment") throw new HttpError(400, "System events cannot be redacted");
  if (verdict.error === "not_author") throw new HttpError(403, "You can only redact your own comment");
  if (verdict.alreadyRedacted) return toDto3(row);
  await env2.db.batch([
    env2.db.prepare(
      `UPDATE card_events SET body = NULL, meta_json = NULL, deleted_at = ?, deleted_by = ?
        WHERE id = ? AND tenant_id = ?`
    ).bind(Date.now(), userId, commentId, tenantId),
    // The comment's @-mentions no longer point at live text — retract them.
    deleteMentionsForCommentStmt(env2, tenantId, cardId, commentId)
  ]);
  const updated = await env2.db.prepare("SELECT * FROM card_events WHERE id = ? AND tenant_id = ?").bind(commentId, tenantId).first();
  if (!updated) throw new HttpError(500, "Redaction did not return row");
  return toDto3(updated);
}

// src/db/repos/cards.ts
async function columnName(env2, tenantId, id) {
  const r = await env2.db.prepare("SELECT name FROM columns WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return r?.name ?? null;
}
function toDto4(r, code2) {
  return {
    id: r.id,
    projectId: r.project_id,
    columnId: r.column_id,
    key: code2 && r.seq != null ? `${code2}-${r.seq}` : null,
    seq: r.seq,
    summary: r.summary,
    description: r.description,
    acceptanceCriteria: r.acceptance_criteria,
    color: r.color,
    position: r.position,
    assigneeUserId: r.assignee_user_id,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
async function listCards(env2, tenantId, projectId, filters = {}) {
  const clauses = ["tenant_id = ?", "project_id = ?"];
  const binds = [tenantId, projectId];
  if (filters.columnId) {
    clauses.push("column_id = ?");
    binds.push(filters.columnId);
  }
  if (filters.assignee) {
    clauses.push("assignee_user_id = ?");
    binds.push(filters.assignee);
  }
  if (filters.q) {
    clauses.push("(summary LIKE ? OR description LIKE ?)");
    const like = `%${filters.q}%`;
    binds.push(like, like);
  }
  const [rs, code2] = await Promise.all([
    env2.db.prepare(`SELECT * FROM cards WHERE ${clauses.join(" AND ")} ORDER BY position ASC`).bind(...binds).all(),
    projectCode(env2, tenantId, projectId)
  ]);
  return (rs.results ?? []).map((r) => toDto4(r, code2));
}
async function getCardRow(env2, tenantId, id) {
  return env2.db.prepare("SELECT * FROM cards WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
}
async function getCard(env2, tenantId, id) {
  const row = await getCardRow(env2, tenantId, id);
  if (!row) return null;
  return toDto4(row, await projectCode(env2, tenantId, row.project_id));
}
async function createCard(env2, tenantId, projectId, userId, input) {
  let columnId = input.columnId;
  if (columnId) {
    if (!await columnInProject(env2, tenantId, projectId, columnId)) {
      throw new HttpError(400, "columnId does not belong to this project");
    }
  } else {
    const first = await firstColumnId(env2, tenantId, projectId);
    if (!first) throw new HttpError(409, "Project has no columns to place the card in");
    columnId = first;
  }
  if (input.assigneeUserId && !await userHasProjectAccess(env2, tenantId, projectId, input.assigneeUserId)) {
    throw new HttpError(400, "assignee has no access to this project");
  }
  let position2 = input.position;
  if (position2 === void 0) {
    const max = await env2.db.prepare(
      "SELECT MAX(position) AS m FROM cards WHERE tenant_id = ? AND column_id = ?"
    ).bind(tenantId, columnId).first();
    position2 = (max?.m ?? 0) + RANK_STEP;
  }
  const seq = await nextCardSeq(env2, tenantId, projectId);
  const id = newId("card");
  const now = Date.now();
  const users = await mentionableUsers(env2, tenantId, projectId);
  const mentionStmts = (await Promise.all([
    reconcileMentionStmts(env2, { tenantId, cardId: id, authorId: userId, sourceKind: "summary", sourceId: "summary", text: input.summary }, users),
    reconcileMentionStmts(env2, { tenantId, cardId: id, authorId: userId, sourceKind: "description", sourceId: "description", text: input.description }, users),
    reconcileMentionStmts(env2, { tenantId, cardId: id, authorId: userId, sourceKind: "acceptance_criteria", sourceId: "acceptance_criteria", text: input.acceptanceCriteria }, users)
  ])).flat();
  await env2.db.batch([
    env2.db.prepare(
      `INSERT INTO cards
         (id, tenant_id, project_id, column_id, seq, summary, description, acceptance_criteria,
          color, position, assignee_user_id, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      projectId,
      columnId,
      seq,
      input.summary,
      input.description ?? null,
      input.acceptanceCriteria ?? null,
      null,
      // card color removed (v0.2.0)
      position2,
      input.assigneeUserId ?? null,
      userId,
      userId,
      now,
      now
    ),
    insertEventStmt(env2, {
      tenantId,
      cardId: id,
      authorUserId: userId,
      kind: "system",
      eventType: "created",
      meta: { columnId }
    }),
    ...mentionStmts
  ]);
  const row = await getCardRow(env2, tenantId, id);
  if (!row) throw new HttpError(500, "Card insert did not return row");
  return toDto4(row, await projectCode(env2, tenantId, projectId));
}
async function patchCard(env2, tenantId, id, userId, input) {
  const existing = await getCardRow(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Card not found");
  if (input.columnId && input.columnId !== existing.column_id) {
    if (!await columnInProject(env2, tenantId, existing.project_id, input.columnId)) {
      throw new HttpError(400, "columnId does not belong to this card's project");
    }
  }
  if (input.assigneeUserId !== void 0 && input.assigneeUserId !== null && !await userHasProjectAccess(env2, tenantId, existing.project_id, input.assigneeUserId)) {
    throw new HttpError(400, "assignee has no access to this project");
  }
  const next = {
    summary: input.summary ?? existing.summary,
    description: input.description === void 0 ? existing.description : input.description,
    acceptance_criteria: input.acceptanceCriteria === void 0 ? existing.acceptance_criteria : input.acceptanceCriteria,
    color: existing.color,
    // card color is no longer settable (v0.2.0)
    column_id: input.columnId ?? existing.column_id,
    position: input.position ?? existing.position,
    assignee_user_id: input.assigneeUserId === void 0 ? existing.assignee_user_id : input.assigneeUserId
  };
  const events = [];
  const ev = (eventType, meta) => ({
    tenantId,
    cardId: id,
    authorUserId: userId,
    kind: "system",
    eventType,
    meta
  });
  if (next.column_id !== existing.column_id) {
    const [fromName, toName] = await Promise.all([
      columnName(env2, tenantId, existing.column_id),
      columnName(env2, tenantId, next.column_id)
    ]);
    events.push(ev("moved", {
      from: { id: existing.column_id, name: fromName },
      to: { id: next.column_id, name: toName }
    }));
  }
  if (next.assignee_user_id !== existing.assignee_user_id) {
    events.push(ev("assigned", { from: existing.assignee_user_id, to: next.assignee_user_id }));
  }
  const editedFields = [];
  if (next.summary !== existing.summary) editedFields.push("summary");
  if (next.description !== existing.description) editedFields.push("description");
  if (next.acceptance_criteria !== existing.acceptance_criteria) editedFields.push("acceptanceCriteria");
  if (editedFields.length) events.push(ev("edited", { fields: editedFields }));
  const updateStmt = env2.db.prepare(
    `UPDATE cards SET summary = ?, description = ?, acceptance_criteria = ?, color = ?,
        column_id = ?, position = ?, assignee_user_id = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`
  ).bind(
    next.summary,
    next.description,
    next.acceptance_criteria,
    next.color,
    next.column_id,
    next.position,
    next.assignee_user_id,
    userId,
    Date.now(),
    id,
    tenantId
  );
  const mentionStmts = [];
  const touchesText = input.summary !== void 0 || input.description !== void 0 || input.acceptanceCriteria !== void 0;
  if (touchesText) {
    const users = await mentionableUsers(env2, tenantId, existing.project_id);
    const reconcilers = [];
    const rc = (sourceKind, text) => reconcileMentionStmts(env2, { tenantId, cardId: id, authorId: userId, sourceKind, sourceId: sourceKind, text }, users);
    if (input.summary !== void 0) reconcilers.push(rc("summary", next.summary));
    if (input.description !== void 0) reconcilers.push(rc("description", next.description));
    if (input.acceptanceCriteria !== void 0) reconcilers.push(rc("acceptance_criteria", next.acceptance_criteria));
    mentionStmts.push(...(await Promise.all(reconcilers)).flat());
  }
  await env2.db.batch([updateStmt, ...events.map((e) => insertEventStmt(env2, e)), ...mentionStmts]);
  const row = await getCardRow(env2, tenantId, id);
  if (!row) throw new HttpError(500, "Card update did not return row");
  return toDto4(row, await projectCode(env2, tenantId, existing.project_id));
}
async function deleteCard(env2, tenantId, id) {
  const existing = await getCardRow(env2, tenantId, id);
  if (!existing) throw new HttpError(404, "Card not found");
  await env2.db.batch([
    env2.db.prepare("DELETE FROM card_events WHERE card_id = ? AND tenant_id = ?").bind(id, tenantId),
    deleteMentionsForCardStmt(env2, tenantId, id),
    env2.db.prepare("DELETE FROM cards WHERE id = ? AND tenant_id = ?").bind(id, tenantId)
  ]);
}

// src/routes/cards.ts
async function handleListCards(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id);
  if (!project) throw new HttpError(404, "Project not found");
  const cards = await listCards(ctx.env, tenantId, project.id, {
    columnId: ctx.url.searchParams.get("column") ?? void 0,
    assignee: ctx.url.searchParams.get("assignee") ?? void 0,
    q: ctx.url.searchParams.get("q") ?? void 0
  });
  return jsonResponse(200, { cards }, ctx.cors);
}
async function handleCreateCard(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id);
  if (!project) throw new HttpError(404, "Project not found");
  const input = await parseJson(ctx.request, createCardInput);
  const card = await createCard(ctx.env, tenantId, project.id, userId, input);
  return jsonResponse(201, { card }, ctx.cors);
}
async function handleGetCard(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id);
  if (!card) throw new HttpError(404, "Card not found");
  return jsonResponse(200, { card }, ctx.cors);
}
async function handlePatchCard(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchCardInput);
  const card = await patchCard(ctx.env, tenantId, ctx.params.id, userId, input);
  return jsonResponse(200, { card }, ctx.cors);
}
async function handleDeleteCard(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  await deleteCard(ctx.env, tenantId, ctx.params.id);
  return jsonResponse(200, { ok: true }, ctx.cors);
}
async function handleListTimeline(ctx) {
  const { tenantId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id);
  if (!card) throw new HttpError(404, "Card not found");
  const events = await listTimeline(ctx.env, tenantId, card.id);
  return jsonResponse(200, { events }, ctx.cors);
}
async function handleAddComment(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id);
  if (!card) throw new HttpError(404, "Card not found");
  const input = await parseJson(ctx.request, createCommentInput);
  const event = await addComment(ctx.env, tenantId, card.id, userId, input);
  return jsonResponse(201, { event }, ctx.cors);
}
async function handleRedactComment(ctx) {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id);
  if (!card) throw new HttpError(404, "Card not found");
  const event = await redactComment(ctx.env, tenantId, card.id, ctx.params.commentId, userId);
  return jsonResponse(200, { event }, ctx.cors);
}

// src/lib/jwt.ts
async function signSession(secret, claims, ttlSeconds) {
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const now = Math.floor(Date.now() / 1e3);
  const payload = { ...claims, iat: now, exp: now + ttlSeconds };
  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, bs2(enc.encode(signingInput)));
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}
async function verifySession(secret, token) {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const enc = new TextEncoder();
  const key = await importHmacKey(secret);
  let ok;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      key,
      bs2(b64urlDecode(sigB64)),
      bs2(enc.encode(`${headerB64}.${payloadB64}`))
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1e3)) return null;
  if (typeof payload.uid !== "string" || typeof payload.tid !== "string") return null;
  return payload;
}
var bs2 = (x) => x;
async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    bs2(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const fixed = pad ? padded + "=".repeat(4 - pad) : padded;
  const bin = atob(fixed);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// src/lib/cookies.ts
var SESSION_COOKIE = "kbrelay_session";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
function isSecureContext(env2) {
  return !env2.PUBLIC_BASE_URL?.startsWith("http://");
}
function buildSetCookie(env2, token, ttlSeconds = SESSION_TTL_SECONDS) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${ttlSeconds}`
  ];
  if (isSecureContext(env2)) parts.push("Secure");
  return parts.join("; ");
}
function buildClearCookie(env2) {
  const parts = [`${SESSION_COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (isSecureContext(env2)) parts.push("Secure");
  return parts.join("; ");
}
function readSessionCookie(request) {
  const header = request.headers.get("cookie") ?? "";
  if (!header) return null;
  for (const entry of header.split(";")) {
    const trimmed = entry.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

// src/services/mailgun.ts
async function sendMailgun(env2, msg) {
  if (!env2.MAILGUN_API_KEY || !env2.MAILGUN_DOMAIN) {
    console.log(`[mailgun] short-circuit (unconfigured) to=${msg.to} subject=${msg.subject}`);
    return { ok: true };
  }
  const baseUrl = (env2.MAILGUN_BASE_URL ?? "https://api.mailgun.net").replace(/\/$/, "");
  const url = `${baseUrl}/v3/${env2.MAILGUN_DOMAIN}/messages`;
  const auth = btoa(`api:${env2.MAILGUN_API_KEY}`);
  const from = msg.from ?? env2.MAILGUN_FROM ?? `kbRelay <noreply@${env2.MAILGUN_DOMAIN}>`;
  const form = new FormData();
  form.append("from", from);
  form.append("to", msg.to);
  form.append("subject", msg.subject);
  form.append("text", msg.text);
  form.append("html", msg.html);
  for (const tag of msg.tags ?? []) form.append("o:tag", tag);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Basic ${auth}` },
      body: form
    });
    if (!res.ok) {
      const body2 = await res.json().catch(() => ({ message: "Unknown error" }));
      return { ok: false, error: body2.message ?? `Mailgun returned ${res.status}` };
    }
    const body = await res.json();
    return { ok: true, providerMessageId: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// src/email/templates.ts
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => {
    const m = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return m[ch] ?? ch;
  });
}
var SHELL_HTML = (title, body) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:24px;background:#0f1115;color:#e6e8ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #2a2f3a;border-radius:12px;padding:32px;">
      <p style="margin:0 0 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8a93a6;">kbRelay</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:650;letter-spacing:-0.01em;color:#f4f6fa;">${escapeHtml(title)}</h1>
      ${body}
      <hr style="border:0;border-top:1px solid #2a2f3a;margin:28px 0 14px;" />
      <p style="margin:0;font-size:12px;color:#6c7486;">Sent by kbRelay \xB7 kbrelay.lalalimited.com</p>
    </div>
  </body>
</html>`;
function ctaButton(href, label) {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#4f7cff;color:#fff;padding:12px 20px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}
function welcomeEmail(args) {
  const subject = "Welcome to kbRelay";
  const text = `Welcome, ${args.name}.

Your workspace "${args.tenantName}" is ready. kbRelay is a kanban board where you and your agents relay work to each other.

Sign in: ${args.signInUrl}

\u2014 kbRelay`;
  const html = SHELL_HTML(
    `Welcome, ${escapeHtml(args.name)}`,
    `<p style="margin:0 0 12px;line-height:1.6;">Your workspace <strong>${escapeHtml(args.tenantName)}</strong> is ready.</p>
     <p style="margin:0 0 12px;line-height:1.6;">kbRelay is a kanban board where you and your agents relay work to each other.</p>
     ${ctaButton(args.signInUrl, "Open your board")}`
  );
  return { subject, text, html };
}
function inviteEmail(args) {
  const subject = `${args.inviterName} invited you to ${args.tenantName} on kbRelay`;
  const text = `${args.inviterName} invited you to join "${args.tenantName}" on kbRelay as ${args.role}.

Accept the invite: ${args.acceptUrl}

The link expires in 7 days.`;
  const html = SHELL_HTML(
    `Invitation to ${escapeHtml(args.tenantName)}`,
    `<p style="margin:0 0 12px;line-height:1.6;"><strong>${escapeHtml(args.inviterName)}</strong> invited you to join <strong>${escapeHtml(args.tenantName)}</strong> on kbRelay as <em>${escapeHtml(args.role)}</em>.</p>
     ${ctaButton(args.acceptUrl, "Accept invite")}
     <p style="margin:0 0 12px;line-height:1.6;color:#8a93a6;">The link expires in 7 days.</p>`
  );
  return { subject, text, html };
}
function passwordResetEmail(args) {
  const subject = "Reset your kbRelay password";
  const text = `A password reset was requested for this email.

Open this link within the next hour to choose a new password:

  ${args.resetUrl}

If you didn't ask for this, you can ignore this message.`;
  const html = SHELL_HTML(
    "Reset your password",
    `<p style="margin:0 0 12px;line-height:1.6;">A password reset was requested for this email. Click below within the next hour to choose a new one.</p>
     ${ctaButton(args.resetUrl, "Reset password")}
     <p style="margin:0 0 12px;line-height:1.6;color:#8a93a6;">If you didn't ask for this, you can ignore this message.</p>`
  );
  return { subject, text, html };
}

// src/routes/auth.ts
async function mintSessionCookie(env2, userId, tenantId) {
  if (!env2.JWT_SECRET) throw new HttpError(503, "Sessions are not configured (no JWT_SECRET)");
  const token = await signSession(env2.JWT_SECRET, { uid: userId, tid: tenantId }, SESSION_TTL_SECONDS);
  return buildSetCookie(env2, token);
}
async function authMeBody(env2, tenantId, userId) {
  const [user, tenant] = await Promise.all([
    getAuthUser(env2, tenantId, userId),
    getTenant(env2, tenantId)
  ]);
  if (!user || !tenant) throw new HttpError(500, "Account state inconsistent");
  return { user, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
}
async function handleRegister(ctx) {
  const { env: env2, cors, request, waitUntil } = ctx;
  const input = await parseJson(request, registerInput);
  const { tenantId, userId } = await registerTenant(env2, input);
  const cookie = await mintSessionCookie(env2, userId, tenantId);
  const body = await authMeBody(env2, tenantId, userId);
  const baseUrl = env2.PUBLIC_BASE_URL.replace(/\/$/, "");
  const welcome = welcomeEmail({
    name: input.name,
    tenantName: input.tenantName,
    signInUrl: `${baseUrl}/auth/sign-in`
  });
  waitUntil(
    sendMailgun(env2, { to: input.email, ...welcome, tags: ["welcome"] }).then((r) => {
      if (!r.ok) console.warn(`[auth] welcome mail failed: ${r.error}`);
    })
  );
  return jsonResponse(201, body, cors, { "Set-Cookie": cookie });
}
async function handleLogin(ctx) {
  const { env: env2, cors, request } = ctx;
  const input = await parseJson(request, loginInput);
  const result = await loginUser(env2, input.email, input.password);
  if (!result) return errorResponse(401, "Invalid email or password", cors);
  const cookie = await mintSessionCookie(env2, result.userId, result.tenantId);
  const body = await authMeBody(env2, result.tenantId, result.userId);
  return jsonResponse(200, body, cors, { "Set-Cookie": cookie });
}
function handleLogout(ctx) {
  const { env: env2, cors } = ctx;
  return jsonResponse(200, { ok: true }, cors, { "Set-Cookie": buildClearCookie(env2) });
}
async function handleForgotPassword(ctx) {
  const { env: env2, cors, request, waitUntil } = ctx;
  const input = await parseJson(request, forgotPasswordInput);
  const user = await getUserByEmail(env2, input.email);
  if (user) {
    const cleartext = await issuePasswordResetToken(env2, user.id);
    const baseUrl = env2.PUBLIC_BASE_URL.replace(/\/$/, "");
    const reset = passwordResetEmail({ resetUrl: `${baseUrl}/auth/reset/${cleartext}` });
    waitUntil(
      sendMailgun(env2, { to: input.email, ...reset, tags: ["password-reset"] }).then((r) => {
        if (!r.ok) console.warn(`[auth] reset mail failed: ${r.error}`);
      })
    );
  }
  return jsonResponse(200, { ok: true }, cors);
}
async function handleResetPassword(ctx) {
  const { env: env2, cors, request } = ctx;
  const input = await parseJson(request, resetPasswordInput);
  const ok = await consumePasswordResetToken(env2, input.token, input.password);
  if (!ok) return errorResponse(400, "That reset link is invalid or has expired", cors);
  return jsonResponse(200, { ok: true }, cors);
}
async function handleAcceptInvite(ctx) {
  const { env: env2, cors, request } = ctx;
  const input = await parseJson(request, acceptInviteInput);
  const result = await acceptInvite(env2, input.token, { name: input.name, password: input.password });
  if (!result) return errorResponse(400, "That invite is invalid, expired, or already used", cors);
  const cookie = await mintSessionCookie(env2, result.userId, result.tenantId);
  const body = await authMeBody(env2, result.tenantId, result.userId);
  return jsonResponse(200, body, cors, { "Set-Cookie": cookie });
}
async function handleAuthMe(ctx) {
  const { env: env2, cors, auth } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const body = await authMeBody(env2, auth.tenantId, auth.userId);
  return jsonResponse(200, body, cors);
}

// src/routes/tokens.ts
async function handleListTokens(ctx) {
  const { env: env2, cors, auth } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const tokens = await listTokens(env2, auth.tenantId, auth.userId);
  return jsonResponse(200, { tokens }, cors);
}
async function handleCreateToken(ctx) {
  const { env: env2, cors, auth, request } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const input = await parseJson(request, createTokenInput);
  const created = await createToken(env2, auth.tenantId, auth.userId, input.label);
  return jsonResponse(201, created, cors);
}
async function handleDeleteToken(ctx) {
  const { env: env2, cors, auth, params } = ctx;
  if (!auth) return errorResponse(401, "Authentication required", cors);
  const ok = await revokeToken(env2, auth.tenantId, auth.userId, params.id);
  if (!ok) return errorResponse(404, "Token not found", cors);
  return jsonResponse(200, { ok: true }, cors);
}

// src/routes/team.ts
async function handleGetTeam(ctx) {
  const { env: env2, cors, auth } = ctx;
  requireAdmin(auth);
  return jsonResponse(200, await listTeam(env2, auth.tenantId), cors);
}
async function handleInvite(ctx) {
  const { env: env2, cors, auth, request, waitUntil } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, inviteInput);
  const { cleartext } = await inviteMember(env2, auth.tenantId, auth.userId, input.email, input.role);
  const tenant = await getTenant(env2, auth.tenantId);
  const baseUrl = env2.PUBLIC_BASE_URL.replace(/\/$/, "");
  const mail = inviteEmail({
    inviterName: auth.userName,
    tenantName: tenant?.name ?? "a workspace",
    role: input.role,
    acceptUrl: `${baseUrl}/auth/accept-invite/${cleartext}`
  });
  waitUntil(
    sendMailgun(env2, { to: input.email, ...mail, tags: ["invite"] }).then((r) => {
      if (!r.ok) console.warn(`[team] invite mail failed: ${r.error}`);
    })
  );
  return jsonResponse(201, { ok: true }, cors);
}
async function handleRevokeInvite(ctx) {
  const { env: env2, cors, auth, params } = ctx;
  requireAdmin(auth);
  const ok = await revokeInvite(env2, auth.tenantId, params.id);
  if (!ok) return errorResponse(404, "Invite not found", cors);
  return jsonResponse(200, { ok: true }, cors);
}
async function handleSetMemberRole(ctx) {
  const { env: env2, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, setMemberRoleInput);
  await setMemberRole(env2, auth.tenantId, params.userId, input.role);
  return jsonResponse(200, { ok: true }, cors);
}
async function handleRemoveMember(ctx) {
  const { env: env2, cors, auth, params } = ctx;
  requireAdmin(auth);
  await removeMember(env2, auth.tenantId, params.userId);
  return jsonResponse(200, { ok: true }, cors);
}
async function handleSetMemberProjects(ctx) {
  const { env: env2, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, setProjectAccessInput);
  await replaceMemberProjectAccess(env2, auth.tenantId, params.userId, input.projectIds);
  return jsonResponse(200, { ok: true }, cors);
}

// src/openapi.ts
var OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "kbRelay API",
    version: "0.0.0",
    description: "Multi-tenant kanban board API. All /api/v1 routes require a bearer token (Authorization: Bearer <token>) that resolves to a user within a tenant. Every response is scoped to that tenant."
  },
  servers: [{ url: "https://kbrelay.lalalimited.com" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "kbrelay_session" }
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          kind: { type: "string", enum: ["human", "agent"] },
          role: { type: ["string", "null"], enum: ["read", "runner", "owner", "admin", "member", null] },
          color: { type: "string", description: "The user's color; a card is shown in its assignee's color." },
          handle: { type: ["string", "null"], description: 'Unique-per-tenant @-mention handle, e.g. "leif".' }
        }
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          code: { type: ["string", "null"], description: 'Ticket-key prefix, e.g. "OBL".' },
          description: { type: ["string", "null"] },
          color: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "archived"] },
          createdBy: { type: "string" },
          createdAt: { type: "integer" },
          updatedAt: { type: "integer" }
        }
      },
      Column: {
        type: "object",
        properties: {
          id: { type: "string" },
          projectId: { type: "string" },
          name: { type: "string" },
          color: { type: ["string", "null"] },
          position: { type: "number" },
          createdAt: { type: "integer" }
        }
      },
      Card: {
        type: "object",
        properties: {
          id: { type: "string" },
          projectId: { type: "string" },
          columnId: { type: "string" },
          key: { type: ["string", "null"], description: 'Human ticket key, e.g. "OBL-1" (project code + "-" + seq).' },
          seq: { type: ["integer", "null"], description: "Per-project sequence number behind the key." },
          summary: { type: "string", description: "Descriptive text (was `title` before v0.7.0)." },
          description: { type: ["string", "null"] },
          acceptanceCriteria: { type: ["string", "null"] },
          color: { type: ["string", "null"] },
          position: { type: "number" },
          assigneeUserId: { type: ["string", "null"] },
          createdBy: { type: "string" },
          updatedBy: { type: "string" },
          createdAt: { type: "integer" },
          updatedAt: { type: "integer" }
        }
      },
      CardEvent: {
        type: "object",
        description: "A timeline entry: an auto-emitted system event or a user comment. System events (created/moved/assigned/edited) are the durable who-did-what-when history; comments are a note or a structured handoff.",
        properties: {
          id: { type: "string" },
          cardId: { type: "string" },
          authorUserId: { type: ["string", "null"] },
          kind: { type: "string", enum: ["system", "note", "handoff"] },
          eventType: { type: ["string", "null"], enum: ["created", "moved", "assigned", "edited", null] },
          body: { type: ["string", "null"], description: "Null for system events and redacted comments." },
          meta: { type: ["object", "null"] },
          createdAt: { type: "integer" },
          deletedAt: { type: ["integer", "null"], description: "Redaction tombstone: when the comment was soft-deleted (null = live)." },
          deletedBy: { type: ["string", "null"], description: "Who redacted the comment." }
        }
      },
      Mention: {
        type: "object",
        description: "A place the caller is @-mentioned. A mention is a live projection of the text: editing the handle out retracts it. `excerpt` is the current field/comment text, derived at read time.",
        properties: {
          id: { type: "string" },
          cardId: { type: "string" },
          cardKey: { type: ["string", "null"], description: 'e.g. "OBL-2".' },
          cardSummary: { type: "string" },
          projectId: { type: "string" },
          projectCode: { type: ["string", "null"] },
          projectName: { type: "string" },
          source: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["summary", "description", "acceptance_criteria", "comment"] },
              commentId: { type: ["string", "null"], description: "Set only for `comment` sources." }
            }
          },
          excerpt: { type: "string", description: "Live text of the field/comment holding the mention." },
          authorUserId: { type: "string", description: "Who wrote the mention." },
          createdAt: { type: "integer" },
          readAt: { type: ["integer", "null"], description: "Null = unread." }
        }
      }
    }
  },
  paths: {
    "/api/v1/auth/register": {
      post: {
        summary: "Self-register: create a tenant + owner user, and log in",
        description: "Public. Creates a new tenant, its owner (admin) user, and a starter agent user, then sets the session cookie. Returns { user, tenant }.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name", "tenantName"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                  tenantName: { type: "string", description: "Workspace name." }
                }
              }
            }
          }
        },
        responses: { 201: { description: "created + logged in" }, 409: { description: "email in use" } }
      }
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Log in with email + password (sets session cookie)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string" }, password: { type: "string" } }
              }
            }
          }
        },
        responses: { 200: { description: "ok" }, 401: { description: "invalid credentials" } }
      }
    },
    "/api/v1/auth/logout": {
      post: { summary: "Clear the session cookie", security: [], responses: { 200: { description: "ok" } } }
    },
    "/api/v1/auth/forgot-password": {
      post: {
        summary: "Request a password-reset email (always 200 \u2014 no enumeration)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email"], properties: { email: { type: "string" } } }
            }
          }
        },
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/auth/reset-password": {
      post: {
        summary: "Consume a reset token and set a new password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: { token: { type: "string" }, password: { type: "string", minLength: 8 } }
              }
            }
          }
        },
        responses: { 200: { description: "ok" }, 400: { description: "invalid or expired token" } }
      }
    },
    "/api/v1/auth/me": {
      get: {
        summary: "The signed-in user + active tenant + role (token or cookie)",
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/auth/accept-invite": {
      post: {
        summary: "Accept a team invite (public) \u2014 creates/attaches the user and logs in",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string" },
                  name: { type: "string", description: "Required for a brand-new user." },
                  password: { type: "string", minLength: 8, description: "Required for a brand-new user." }
                }
              }
            }
          }
        },
        responses: { 200: { description: "ok" }, 400: { description: "invalid/expired/used" } }
      }
    },
    "/api/v1/team": {
      get: { summary: "Team members + their project access + pending invites (admin)", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/team/invites": {
      post: {
        summary: "Invite someone by email (admin) \u2014 emails an accept link",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "role"],
                properties: { email: { type: "string" }, role: { type: "string", enum: ["admin", "member"] } }
              }
            }
          }
        },
        responses: { 201: { description: "invited" }, 409: { description: "already a member" } }
      }
    },
    "/api/v1/team/invites/{id}": {
      delete: { summary: "Revoke a pending invite (admin)", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/team/members/{userId}": {
      patch: {
        summary: "Change a member's role (admin) \u2014 can't demote the last admin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["admin", "member"] } } }
            }
          }
        },
        responses: { 200: { description: "ok" }, 409: { description: "last admin" } }
      },
      delete: { summary: "Remove a member (admin) \u2014 can't remove the last admin", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/team/members/{userId}/projects": {
      put: {
        summary: "Replace a member's project-access set (admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["projectIds"], properties: { projectIds: { type: "array", items: { type: "string" } } } }
            }
          }
        },
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/me/tokens": {
      get: { summary: "List your API tokens (never the secret)", responses: { 200: { description: "ok" } } },
      post: {
        summary: "Mint an API token \u2014 returns the plaintext secret ONCE",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["label"], properties: { label: { type: "string" } } }
            }
          }
        },
        responses: { 201: { description: "created" } }
      }
    },
    "/api/v1/me/tokens/{id}": {
      delete: { summary: "Revoke one of your API tokens", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/me": {
      get: { summary: "Whoami for the current token", responses: { 200: { description: "ok" } } },
      patch: {
        summary: "Set your own color (token is tied to a user)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["color"],
                properties: { color: { type: "string", description: "#rrggbb hex" } }
              }
            }
          }
        },
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/users": {
      get: { summary: "List tenant users", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/me/mentions": {
      get: {
        summary: "List your @-mentions (unread by default). Side-effect-free.",
        description: "Every place you are @-mentioned, tenant-wide, unread first. Listing never marks anything read \u2014 acknowledge explicitly via POST /me/mentions/read. Intended agent loop: list \u2192 act on each card \u2192 ack.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["unread", "read", "all"] } }
        ],
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/me/mentions/read": {
      post: {
        summary: "Acknowledge (mark read) your mentions",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Provide mentionIds or all:true.",
                properties: {
                  mentionIds: { type: "array", items: { type: "string" } },
                  all: { type: "boolean" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/projects": {
      get: {
        summary: "List projects",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "archived"] } }
        ],
        responses: { 200: { description: "ok" } }
      },
      post: {
        summary: "Create a project (seeds default columns)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "code"],
                properties: {
                  name: { type: "string" },
                  code: { type: "string", description: "Ticket-key prefix, 2\u20136 alphanumerics (uppercased), unique per tenant." },
                  description: { type: ["string", "null"] },
                  color: { type: ["string", "null"] }
                }
              }
            }
          }
        },
        responses: { 201: { description: "created" } }
      }
    },
    "/api/v1/projects/{id}": {
      get: { summary: "Get a project + its columns", responses: { 200: { description: "ok" } } },
      patch: { summary: "Update / archive a project", responses: { 200: { description: "ok" } } },
      delete: { summary: "Delete a project (cascades)", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/projects/{id}/columns": {
      get: { summary: "List a project's columns", responses: { 200: { description: "ok" } } },
      post: { summary: "Add a column", responses: { 201: { description: "created" } } }
    },
    "/api/v1/columns/{id}": {
      patch: { summary: "Rename / recolor / reorder a column", responses: { 200: { description: "ok" } } },
      delete: { summary: "Delete an empty column", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/projects/{id}/cards": {
      get: {
        summary: "List cards in a project",
        parameters: [
          { name: "column", in: "query", schema: { type: "string" } },
          { name: "assignee", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: { description: "ok" } }
      },
      post: { summary: "Create a card", responses: { 201: { description: "created" } } }
    },
    "/api/v1/cards/{id}": {
      get: { summary: "Get a card", responses: { 200: { description: "ok" } } },
      patch: {
        summary: "Edit and/or move a card (columnId + position)",
        responses: { 200: { description: "ok" } }
      },
      delete: { summary: "Delete a card", responses: { 200: { description: "ok" } } }
    },
    "/api/v1/cards/{id}/timeline": {
      get: {
        summary: "Card timeline \u2014 system events + comments, chronological",
        responses: { 200: { description: "ok" } }
      }
    },
    "/api/v1/cards/{id}/comments": {
      post: {
        summary: "Post a note or handoff to the card timeline",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["body"],
                properties: {
                  type: { type: "string", enum: ["note", "handoff"], default: "note" },
                  body: { type: "string" },
                  meta: {
                    type: "object",
                    description: "Handoff slots (ignored for a note).",
                    properties: {
                      summary: { type: "string" },
                      evidence: { type: "array", items: { type: "string" } },
                      verify: { type: "array", items: { type: "string" } },
                      spunOff: { type: "array", items: { type: "string" } }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: "created" } }
      }
    },
    "/api/v1/cards/{id}/comments/{commentId}": {
      delete: {
        summary: "Redact (soft-delete) a comment \u2014 author-only",
        description: "Redacts a comment's content (leaked secret / PII / wrong card), leaving a tombstone in place. Author-only (403 otherwise); system events cannot be redacted (400); idempotent. The comment's @-mentions are retracted.",
        responses: { 200: { description: "redacted" } }
      }
    }
  }
};
function handleOpenApi(ctx) {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    status: 200,
    headers: { ...ctx.cors, "content-type": "application/json; charset=utf-8" }
  });
}

// src/router.ts
var routes = [
  // ── Public ──
  { method: "GET", pattern: "/api/openapi.json", public: true, handler: handleOpenApi },
  // ── Human auth (v0.10.0) — public entrypoints ──
  { method: "POST", pattern: "/api/v1/auth/register", public: true, handler: handleRegister },
  { method: "POST", pattern: "/api/v1/auth/login", public: true, handler: handleLogin },
  { method: "POST", pattern: "/api/v1/auth/logout", public: true, handler: handleLogout },
  { method: "POST", pattern: "/api/v1/auth/forgot-password", public: true, handler: handleForgotPassword },
  { method: "POST", pattern: "/api/v1/auth/reset-password", public: true, handler: handleResetPassword },
  { method: "GET", pattern: "/api/v1/auth/me", handler: handleAuthMe },
  // ── Self-service API keys (v0.10.0) ──
  { method: "GET", pattern: "/api/v1/me/tokens", handler: handleListTokens },
  { method: "POST", pattern: "/api/v1/me/tokens", handler: handleCreateToken },
  { method: "DELETE", pattern: "/api/v1/me/tokens/:id", handler: handleDeleteToken },
  // ── Identity ──
  { method: "GET", pattern: "/api/v1/me", handler: handleMe },
  { method: "PATCH", pattern: "/api/v1/me", handler: handlePatchMe },
  { method: "GET", pattern: "/api/v1/users", handler: handleListUsers },
  // ── Mentions / notifications (v0.8.0) ──
  { method: "GET", pattern: "/api/v1/me/mentions", handler: handleListMentions },
  { method: "POST", pattern: "/api/v1/me/mentions/read", handler: handleMarkMentionsRead },
  // ── Team management & RBAC (v0.11.0) — admin-gated in-handler ──
  { method: "POST", pattern: "/api/v1/auth/accept-invite", public: true, handler: handleAcceptInvite },
  { method: "GET", pattern: "/api/v1/team", handler: handleGetTeam },
  { method: "POST", pattern: "/api/v1/team/invites", handler: handleInvite },
  { method: "DELETE", pattern: "/api/v1/team/invites/:id", handler: handleRevokeInvite },
  { method: "PATCH", pattern: "/api/v1/team/members/:userId", handler: handleSetMemberRole },
  { method: "DELETE", pattern: "/api/v1/team/members/:userId", handler: handleRemoveMember },
  { method: "PUT", pattern: "/api/v1/team/members/:userId/projects", handler: handleSetMemberProjects },
  // ── Projects ── (list filters in-handler; create auto-grants the creator)
  { method: "GET", pattern: "/api/v1/projects", handler: handleListProjects },
  { method: "POST", pattern: "/api/v1/projects", handler: handleCreateProject },
  { method: "GET", pattern: "/api/v1/projects/:id", access: { kind: "project", param: "id" }, handler: handleGetProject },
  { method: "PATCH", pattern: "/api/v1/projects/:id", access: { kind: "project", param: "id" }, handler: handlePatchProject },
  { method: "DELETE", pattern: "/api/v1/projects/:id", access: { kind: "project", param: "id" }, handler: handleDeleteProject },
  // ── Columns ──
  { method: "GET", pattern: "/api/v1/projects/:id/columns", access: { kind: "project", param: "id" }, handler: handleListColumns },
  { method: "POST", pattern: "/api/v1/projects/:id/columns", access: { kind: "project", param: "id" }, handler: handleCreateColumn },
  { method: "PATCH", pattern: "/api/v1/columns/:id", access: { kind: "column", param: "id" }, handler: handlePatchColumn },
  { method: "DELETE", pattern: "/api/v1/columns/:id", access: { kind: "column", param: "id" }, handler: handleDeleteColumn },
  // ── Cards ──
  { method: "GET", pattern: "/api/v1/projects/:id/cards", access: { kind: "project", param: "id" }, handler: handleListCards },
  { method: "POST", pattern: "/api/v1/projects/:id/cards", access: { kind: "project", param: "id" }, handler: handleCreateCard },
  { method: "GET", pattern: "/api/v1/cards/:id", access: { kind: "card", param: "id" }, handler: handleGetCard },
  { method: "PATCH", pattern: "/api/v1/cards/:id", access: { kind: "card", param: "id" }, handler: handlePatchCard },
  { method: "DELETE", pattern: "/api/v1/cards/:id", access: { kind: "card", param: "id" }, handler: handleDeleteCard },
  // ── Card timeline (v0.3.0) ──
  { method: "GET", pattern: "/api/v1/cards/:id/timeline", access: { kind: "card", param: "id" }, handler: handleListTimeline },
  { method: "POST", pattern: "/api/v1/cards/:id/comments", access: { kind: "card", param: "id" }, handler: handleAddComment },
  { method: "DELETE", pattern: "/api/v1/cards/:id/comments/:commentId", access: { kind: "card", param: "id" }, handler: handleRedactComment }
];

// src/auth/session.ts
async function authenticateSession(request, env2) {
  const cookie = readSessionCookie(request);
  if (!cookie) return null;
  if (!env2.JWT_SECRET) return null;
  const claims = await verifySession(env2.JWT_SECRET, cookie);
  if (!claims) return null;
  return loadSessionContext(env2, claims.tid, claims.uid);
}

// src/runtime/shared/dispatch.ts
async function dispatch(request, env2, waitUntil) {
  const cors = getCorsHeaders(request, env2.ALLOWED_ORIGINS);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse(200, { ok: true, service: "kbrelay", ts: Date.now() }, cors);
    }
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const params = matchPath(r.pattern, url.pathname);
      if (!params) continue;
      let auth = null;
      if (!r.public) {
        auth = await authenticate(request, env2) ?? await authenticateSession(request, env2);
        if (!auth) return errorResponse(401, "Missing or invalid credentials", cors);
        if (r.access) await enforceProjectAccess(env2, auth, r.access, params);
      }
      return await r.handler({ request, env: env2, url, params, cors, auth, waitUntil });
    }
    return errorResponse(404, "Not found", cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.status, err.message, cors, err.details);
    }
    console.error("Unhandled error:", err instanceof Error ? err.stack ?? err.message : err);
    return errorResponse(500, "Internal error", cors);
  }
}
function matchPath(pattern, pathname) {
  const pSeg = pattern.split("/").filter(Boolean);
  const uSeg = pathname.split("/").filter(Boolean);
  if (pSeg.length !== uSeg.length) return null;
  const params = {};
  for (let i = 0; i < pSeg.length; i++) {
    const p = pSeg[i];
    const u = uSeg[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(u);
    } else if (p !== u) {
      return null;
    }
  }
  return params;
}

// src/runtime/node/libsql-db.ts
import { createClient } from "@libsql/client";
var LibsqlStatement = class _LibsqlStatement {
  constructor(client, sql, args = []) {
    this.client = client;
    this.sql = sql;
    this.args = args;
  }
  client;
  sql;
  args;
  bind(...args) {
    return new _LibsqlStatement(this.client, this.sql, args);
  }
  async first() {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return rs.rows[0] ?? null;
  }
  async all() {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: rs.rows };
  }
  async run() {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { success: true, meta: { changes: Number(rs.rowsAffected ?? 0) } };
  }
  /** For batch: the raw libsql statement (used only by this adapter's batch). */
  toInStatement() {
    return { sql: this.sql, args: this.args };
  }
};
function createLibsqlDb(url) {
  const client = createClient({ url });
  const db = {
    prepare: (sql) => new LibsqlStatement(client, sql),
    // 'write' opens a write transaction so the group is atomic (D1 batch parity).
    batch: (stmts) => client.batch(
      stmts.map((s) => s.toInStatement()),
      "write"
    )
  };
  return { db, client };
}

// src/runtime/node/bindings.ts
function buildNodeBindings(proc = process.env) {
  const url = proc.DATABASE_URL ?? "file:./kbrelay.db";
  const { db } = createLibsqlDb(url);
  const publicBaseUrl = proc.PUBLIC_BASE_URL ?? "http://localhost:8080";
  return {
    env: {
      db,
      // Same-origin in self-host (Node serves the SPA too), so CORS is moot;
      // default the allowlist to the public base URL.
      ALLOWED_ORIGINS: proc.ALLOWED_ORIGINS ?? publicBaseUrl,
      PUBLIC_BASE_URL: publicBaseUrl,
      JWT_SECRET: proc.JWT_SECRET,
      MAILGUN_API_KEY: proc.MAILGUN_API_KEY,
      MAILGUN_DOMAIN: proc.MAILGUN_DOMAIN,
      MAILGUN_BASE_URL: proc.MAILGUN_BASE_URL,
      MAILGUN_FROM: proc.MAILGUN_FROM
    }
  };
}

// src/runtime/node/index.ts
var { env } = buildNodeBindings(process.env);
var PORT = Number(process.env.PORT ?? 8080);
var SPA_DIR = process.env.SPA_DIR ?? join(process.cwd(), "web");
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8"
};
async function readSpaFile(relPath) {
  const clean = normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  const full = join(SPA_DIR, clean);
  if (!full.startsWith(SPA_DIR)) return null;
  try {
    const body = await readFile(full);
    return { body, type: MIME[extname(full)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
async function serveStatic(pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const hit = await readSpaFile(rel) ?? (extname(rel) ? null : await readSpaFile("index.html"));
  if (!hit) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(hit.body), { headers: { "content-type": hit.type } });
}
var adapter = createServerAdapter(async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/api/health" || url.pathname.startsWith("/api/")) {
    return dispatch(request, env, (p) => void Promise.resolve(p).catch(() => {
    }));
  }
  return serveStatic(url.pathname);
});
var server = createServer(adapter);
server.listen(PORT, () => {
  console.log(`[kbrelay] self-host listening on :${PORT} (db=${process.env.DATABASE_URL ?? "file:./kbrelay.db"})`);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[kbrelay] ${sig} \u2014 shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5e3).unref();
  });
}
