"""Parse src/integrations/supabase/types.ts (public schema) into JSON."""
import json, re, sys

src = open(sys.argv[1], encoding="utf-8").read()


def block(text, start):
    """Return the {...} body starting at index of '{'."""
    depth = 0
    for i in range(start, len(text)):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1 : i], i
    raise ValueError("unbalanced")


def entries(body):
    """Top-level `name: {` / `name: value` entries of a block body."""
    out, i = [], 0
    pat = re.compile(r"\s*([A-Za-z_][A-Za-z0-9_]*|\"[^\"]+\")\??\s*:\s*")
    while i < len(body):
        m = pat.match(body, i)
        if not m:
            i += 1
            continue
        name = m.group(1).strip('"')
        j = m.end()
        if body[j] == "{":
            inner, end = block(body, j)
            out.append((name, inner))
            i = end + 1
        else:
            # value until newline at depth 0 (handles multi-line unions starting with |)
            k = j
            while True:
                nl = body.find("\n", k)
                if nl == -1:
                    nl = len(body)
                    break
                nxt = body[nl + 1 :].lstrip(" ")
                if nxt.startswith("|"):
                    k = nl + 1
                    continue
                break
            out.append((name, body[j:nl].strip()))
            i = nl + 1
    return out


pub_start = src.index("    public: {")
public, _ = block(src, src.index("{", pub_start))
sections = dict(entries(public))


def fields(body):
    res = {}
    for name, val in entries(body):
        res[name] = val
    return res


def rels(body):
    out = []
    for m in re.finditer(
        r'foreignKeyName: "([^"]+)"\s*columns: \[([^\]]*)\]\s*isOneToOne: (\w+)\s*referencedRelation: "([^"]+)"\s*referencedColumns: \[([^\]]*)\]',
        body,
    ):
        cols = re.findall(r'"([^"]+)"', m.group(2))
        rcols = re.findall(r'"([^"]+)"', m.group(5))
        out.append(dict(name=m.group(1), columns=cols, ref=m.group(4), refcols=rcols))
    return out


def relations(section):
    out = {}
    for name, body in entries(section):
        parts = dict(entries(body))
        rel_body = body[body.index("Relationships:") :] if "Relationships:" in body else ""
        out[name] = dict(
            row=fields(parts.get("Row", "")),
            insert=fields(parts.get("Insert", "")),
            rels=rels(rel_body),
        )
    return out


enums = {}
for name, val in entries(sections["Enums"]):
    enums[name] = re.findall(r'"([^"]*)"', val)

funcs = {}
for name, body in entries(sections["Functions"]):
    funcs[name] = body.strip()

print(
    json.dumps(
        dict(tables=relations(sections["Tables"]), views=relations(sections["Views"]), enums=enums, functions=funcs),
        ensure_ascii=False,
        indent=1,
    )
)
