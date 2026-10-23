import re, glob, subprocess, sys
DB = sys.argv[1]
NORM = {"text":"text","varchar":"text","character":"text","uuid":"uuid","jsonb":"jsonb","json":"json","timestamptz":"timestamptz","timestamp":"timestamp","bigint":"int8","int8":"int8","bigserial":"int8","integer":"int4","int":"int4","int4":"int4","serial":"int4","smallint":"int2","numeric":"numeric","decimal":"numeric","boolean":"bool","bool":"bool","date":"date","real":"float4","double":"float8","time":"time"}
decl = {}
for f in sorted(glob.glob("supabase/migrations/*.sql")):
    sql = open(f, encoding="utf-8", errors="ignore").read()
    for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\((.*?)\n\s*\)\s*;', sql, re.I | re.S):
        t = m.group(1)
        for line in m.group(2).split("\n"):
            lm = re.match(r'\s*"?([a-zA-Z_]\w*)"?\s+([a-zA-Z]+)(\s+with(?:out)? time zone)?(\[\])?', line)
            if not lm or lm.group(1).lower() in ("constraint","primary","unique","foreign","check","exclude"): continue
            typ = lm.group(2).lower()
            if typ == "timestamp" and lm.group(3) and "with time" in lm.group(3).lower() and "without" not in lm.group(3).lower(): typ = "timestamptz"
            if typ not in NORM: continue
            decl[(t, lm.group(1))] = NORM[typ] + ("[]" if lm.group(4) else "")
out = subprocess.run(["psql", DB, "-At", "-F", "|", "-c", "select table_name, column_name, case when data_type='ARRAY' then substr(udt_name,2)||'[]' else udt_name end from information_schema.columns where table_schema='public'"], capture_output=True, text=True).stdout
live = {(a, b): c for a, b, c in (l.split("|") for l in out.splitlines())}
for k, v in sorted(decl.items()):
    lv = live.get(k)
    if lv and lv != v and not (v == "timestamp" and lv == "timestamptz"):
        print(f"{k[0]}.{k[1]}: migration={v} db={lv}")
