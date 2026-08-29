class CossertInterpreter {
  constructor(io = {}) {
    this.output = io.output || ((text) => console.log(text));
    this.input = io.input || (async (promptText) => (typeof prompt === "function" ? prompt(promptText) : ""));
    this.maxSteps = 200000;
    this.reset();
  }

  reset() {
    this.vars = Object.create(null);
    this.lists = Object.create(null);
    this.functions = Object.create(null);
    this.steps = 0;
  }

  async run(source) {
    this.reset();
    const lines = this.prepare(source);

    if (!lines.length || lines[0].text !== "YO HOWSURDOIN 0.1") {
      throw new Error("Program must start with YO HOWSURDOIN 0.1");
    }
    if (!lines.some(line => line.text === "OKALFINEBYE")) {
      throw new Error("Program must end with OKALFINEBYE");
    }

    const main = this.extractFunctions(lines);
    await this.execBlock(main, -1);
  }

  prepare(source) {
    const raw = String(source).replace(/\r/g, "").split("\n");
    const lines = [];
    let inComment = false;

    for (let i = 0; i < raw.length; i++) {
      const original = raw[i];
      const trimmed = original.trim();

      if (inComment) {
        if (trimmed === "COMENT FINISH") inComment = false;
        continue;
      }

      if (trimmed === "IWANNACOMENT:") {
        inComment = true;
        continue;
      }

      if (!trimmed) continue;

      const prefix = (original.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ");
      lines.push({ text: trimmed, indent: prefix.length, line: i + 1 });
    }

    if (inComment) {
      throw new Error("IWANNACOMENT never reached COMENT FINISH");
    }
    return lines;
  }

  extractFunctions(lines) {
    const main = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.text.match(/^ELLO\s+"([^"]+)"\s+YOUR NOW DOIN\s*\{$/);

      if (!match) {
        main.push(line);
        continue;
      }

      const name = match[1];
      const body = [];
      i++;

      while (i < lines.length && lines[i].text !== "}") {
        body.push({
          text: lines[i].text,
          indent: Math.max(0, lines[i].indent - line.indent - 4),
          line: lines[i].line
        });
        i++;
      }

      if (i >= lines.length) {
        throw new Error(`Function "${name}" forgot its }`);
      }

      this.functions[name] = body;
    }

    return main;
  }

  tick(line) {
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw new Error("Cossert executed too many steps. Possible infinite chaos.");
    }
  }

  blockEnd(lines, start, parentIndent) {
    let i = start;
    while (i < lines.length && lines[i].indent > parentIndent) i++;
    return i;
  }

  async execBlock(lines, parentIndent = -1) {
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.indent <= parentIndent) break;
      this.tick(line);

      const t = line.text;
      let m;

      if (t === "YO HOWSURDOIN 0.1") {
        i++;
        continue;
      }

      if (t === "OKALFINEBYE") {
        return { signal: "end" };
      }

      m = t.match(/^HAV A LIST\s+"([^"]+)"\s+LIKE\s+(\[.*\])\s*:?$/);
      if (m) {
        this.lists[m[1]] = this.parseList(m[2]);
        i++;
        continue;
      }

      m = t.match(/^GET\s+"([^"]+)"\s+LETITB\s+(.+)$/);
      if (m) {
        this.vars[m[1]] = await this.evalExpr(m[2]);
        i++;
        continue;
      }

      m = t.match(/^"([^"]+)"\s+CHANGETO->\s+(.+)$/);
      if (m) {
        const name = m[1];
        if (!(name in this.vars)) throw new Error(`Variable "${name}" does not exist`);
        const valueText = m[2].trim();

        if (valueText === '"nothing"' || valueText === "'nothing'" || valueText === "nothing") {
          this.vars[name] = this.emptyFor(this.vars[name]);
        } else {
          this.vars[name] = await this.evalExpr(valueText);
        }
        i++;
        continue;
      }

      m = t.match(/^UREPLACEIT\{([^}]+)\}\[(.+)\]\s+W\/\s*(.+)$/);
      if (m) {
        const listName = m[1].trim();
        const list = this.lists[listName];
        if (!list) throw new Error(`List "${listName}" does not exist`);
        const idx = Math.trunc(Number(await this.evalExpr(m[2])));
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
          throw new Error(`UREPLACEIT index ${idx} is outside "${listName}"`);
        }
        list[idx] = await this.evalExpr(m[3]);
        i++;
        continue;
      }

      m = t.match(/^GETDATIN\{([^}]+)\}\s+W\/\s*(.+)$/);
      if (m) {
        const list = this.lists[m[1].trim()];
        if (!list) throw new Error(`List "${m[1].trim()}" does not exist`);
        list.push(await this.evalExpr(m[2]));
        i++;
        continue;
      }

      m = t.match(/^STANDIN ALINE\{([^}]+)\}$/);
      if (m) {
        let name = m[1].trim();
        let reverse = false;

        if (!this.lists[name]) {
          const candidate = name.split("").reverse().join("");
          if (this.lists[candidate]) {
            name = candidate;
            reverse = true;
          }
        }

        const list = this.lists[name];
        if (!list) throw new Error(`List "${name}" does not exist`);
        list.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
        if (reverse) list.reverse();
        i++;
        continue;
      }

      m = t.match(/^SPITOUT\((.*)\)$/);
      if (m) {
        this.output(String(await this.evalExpr(m[1])));
        i++;
        continue;
      }

      m = t.match(/^YO USER DILE\((.*)\):\s*([A-Za-z_][A-Za-z0-9_]*)$/);
      if (m) {
        const question = String(await this.evalExpr(m[1]));
        const raw = await this.input(question);
        const target = m[2];
        const old = this.vars[target];
        this.vars[target] = this.coerceInput(raw, old);
        i++;
        continue;
      }

      m = t.match(/^GOAROUND\s+(.+)\s+TIMES:$/);
      if (m) {
        const count = Math.max(0, Math.trunc(Number(await this.evalExpr(m[1])) || 0));
        const end = this.blockEnd(lines, i + 1, line.indent);
        const body = lines.slice(i + 1, end).map(x => ({...x, indent: x.indent - line.indent - 4}));

        for (let n = 0; n < count; n++) {
          const r = await this.execBlock(body, -1);
          if (r.signal === "break") break;
          if (r.signal === "end") return r;
          if (r.signal === "return") return r;
          // SKIPTIS becomes continue automatically.
        }

        i = end;
        continue;
      }

      m = t.match(/^HMM WATIF\((.*)\)$/);
      if (m) {
        const end = this.blockEnd(lines, i + 1, line.indent);
        if (this.truthy(await this.evalExpr(m[1]))) {
          const body = lines.slice(i + 1, end).map(x => ({...x, indent: x.indent - line.indent - 4}));
          const r = await this.execBlock(body, -1);
          if (r.signal) return r;
        }
        i = end;
        continue;
      }

      m = t.match(/^FINALANSER\((.*)\)$/);
      if (m) {
        return { signal: "return", value: await this.evalExpr(m[1]) };
      }

      if (t === "SKIPTIS") return { signal: "continue" };
      if (t === "FRGETABTIT") return { signal: "break" };

      // A function can also be called by itself.
      m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\(\)$/);
      if (m && this.functions[m[1]]) {
        await this.callFunction(m[1]);
        i++;
        continue;
      }

      if (t === "}") {
        i++;
        continue;
      }

      throw new Error(`Line ${line.line}: I DON'T KNOW WAT DIS MEANZ -> ${t}`);
    }

    return { signal: null };
  }

  async callFunction(name) {
    const body = this.functions[name];
    if (!body) throw new Error(`Function "${name}" does not exist`);
    const r = await this.execBlock(body, -1);
    return r.signal === "return" ? r.value : "";
  }

  async evalExpr(expr) {
    expr = expr.trim();

    if (expr.startsWith("NO NEVER")) return 0;

    const neg = expr.match(/^NO\{([\s\S]+)\}$/);
    if (neg) return this.truthy(await this.evalExpr(neg[1])) ? 0 : 1;

    let m = expr.match(/^TAKITOUT\{([^}]+)\}\[(.+)\]$/);
    if (m) {
      const name = m[1].trim();
      const list = this.lists[name];
      if (!list) throw new Error(`List "${name}" does not exist`);
      const idx = Math.trunc(Number(await this.evalExpr(m[2])));
      if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return "";
      const value = list[idx];
      list[idx] = this.emptyFor(value);
      return value;
    }

    m = expr.match(/^PICKARANDOM\(FROM\((.+?)\)TO\((.+?)\)W\/O\((.*?)\)\)$/);
    if (m) {
      const from = await this.evalExpr(m[1]);
      const to = await this.evalExpr(m[2]);
      const excluded = m[3].trim() ? await this.evalExpr(m[3]) : undefined;

      if (typeof from === "number" && typeof to === "number") {
        const lo = Math.ceil(Math.min(from, to));
        const hi = Math.floor(Math.max(from, to));
        const pool = [];
        for (let n = lo; n <= hi; n++) if (n !== excluded) pool.push(n);
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 0;
      }
      throw new Error("PICKARANDOM FROM/TO currently expects numbers");
    }

    m = expr.match(/^YO COMBINE\s+(.+?)\s+W\/\s*(.+)$/);
    if (m) {
      const left = await this.evalExpr(m[1]);
      const right = await this.evalExpr(m[2]);
      if (typeof left === "number" && typeof right === "number") return left + right;
      return String(left) + String(right);
    }

    m = expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\(\)$/);
    if (m && this.functions[m[1]]) {
      return await this.callFunction(m[1]);
    }

    if ((expr.startsWith('"') && expr.endsWith('"')) ||
        (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    if (/^-?\d+(?:\.\d+)?$/.test(expr)) return Number(expr);

    const cmp = this.splitComparison(expr);
    if (cmp) {
      const a = await this.evalExpr(cmp.left);
      const b = await this.evalExpr(cmp.right);

      if (cmp.op === "==") return a == b ? 1 : 0;
      if (cmp.op === "NO{=}") return a != b ? 1 : 0;
      if (cmp.op === ">") return a > b ? 1 : 0;
      if (cmp.op === "<") return a < b ? 1 : 0;
      if (cmp.op === ">=") return a >= b ? 1 : 0;
      if (cmp.op === "<=") return a <= b ? 1 : 0;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(expr) && expr in this.vars) {
      return this.vars[expr];
    }

    if (expr === "nothing") return "";

    throw new Error(`Cannot understand expression: ${expr}`);
  }

  splitComparison(expr) {
    for (const op of ["NO{=}", ">=", "<=", "==", ">", "<"]) {
      const idx = expr.indexOf(op);
      if (idx >= 0) {
        return {
          left: expr.slice(0, idx).trim(),
          op,
          right: expr.slice(idx + op.length).trim()
        };
      }
    }
    return null;
  }

  parseList(text) {
    try {
      return JSON.parse(text.replace(/'/g, '"'));
    } catch {
      throw new Error(`Bad list: ${text}`);
    }
  }

  truthy(value) {
    if (typeof value === "number") return value !== 0;
    return Boolean(value);
  }

  emptyFor(value) {
    if (typeof value === "number") return 0;
    if (typeof value === "string") return "";
    return "";
  }

  coerceInput(raw, oldValue) {
    if (typeof oldValue === "number") {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    return String(raw);
  }
}

if (typeof window !== "undefined") window.CossertInterpreter = CossertInterpreter;
if (typeof globalThis !== "undefined") globalThis.CossertInterpreter = CossertInterpreter;
if (typeof module !== "undefined" && module.exports) module.exports = { CossertInterpreter };
