"""Build editable Draw.io pages, matching PNG/SVG exports, and schema catalogue.
No database writes or application data. Run with Python + Pillow.
"""
from pathlib import Path
import json, re, math, heapq, html, zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[1]
REQUEST = ROOT.parent / "Request"
META = json.loads((BASE / "schema-metadata.json").read_text(encoding="utf-8"))
DATE = "2026-10-12"
FONT = "C:/Windows/Fonts/segoeui.ttf"
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
COLORS = {
    "core": ("#173B64", "#EFF5FD"),
    "auth": ("#126A67", "#EBF8F5"),
    "ops": ("#8C591C", "#FFF7E8"),
    "embedded": ("#72508D", "#F5EFFA"),
    "legacy": ("#626C79", "#F1F3F6"),
    "oracle": ("#733E4C", "#FBF0F3"),
}
INK, MUTED, BG = "#20354D", "#63738A", "#F7F9FC"

PAYLOAD = {
 "users": ["id: number", "name: string", "email: string", "phone: string", "affiliation: string", "role: USER | STAFF | ADMIN", "active: boolean"],
 "buildings": ["id: number", "name: string", "floors: number", "active?: boolean"],
 "rooms": ["id: number", "code: string", "name: string", "buildingId: number", "floor: number", "capacity: number", "type: string", "amenities: string[]", "status: AVAILABLE | MAINTENANCE | CLOSED", "reason: string", "scene: number", "active?: boolean", "imageUrl?: string", "inventory?: {id, name, total, damaged}[]", "hours?: {start, end, weekdays[], leadMinutes}"],
 "equipment": ["id: number", "name: string", "total: number", "remaining: number"],
 "bookings": ["id: number", "ref: string", "userId: number", "roomId: number", "start: string (ISO timestamp)", "end: string (ISO timestamp)", "purpose: string", "attendees: number", "participants: number[] (legacy; server rejects nonempty)", "equipment: {id, qty, issued?, returned?}[]", "status: BookingStatus", "createdAt: string", "decidedAt?: string", "decidedBy?: number", "checkedInAt?: string", "reason?: string", "participantEmails?: string[]", "approvalDeadline?: string", "slaReminderAt?: string", "slaEscalatedAt?: string", "archivedAt?: string"],
 "notices": ["id: number", "userId: number", "bookingId?: number", "subject: string", "content: string", "status: QUEUED | SENT | FAILED", "createdAt: string", "attempts: number", "readAt?: string"],
 "violations": ["id: number", "userId: number", "bookingId: number", "type: NO_SHOW | LATE_CANCEL", "at: string"],
 "penalties": ["id: number", "userId: number", "type: WARNING | SUSPENSION", "start: string", "end: string", "reason: string", "at: string", "actorId: number"],
 "closures": ["id: number", "roomId: number", "start: string", "end: string", "reason: string"],
 "inspections": ["id: number", "roomId: number", "at: string", "condition: string", "note: string", "actorId: number", "items?: {id, name, total, damaged}[] (room inventory snapshot)"],
 "messages": ["id: number", "userId: number", "question: string", "answer: string", "at: string"],
 "audit": ["id: number", "at: string", "actorId: number | null (system)", "text: string", "bookingId?: number"],
 "holidays": ['JSON string: "YYYY-MM-DD" (not an object)'],
 "assignments": ["userId: number", "roomIds: number[]", "start?: string", "end?: string"],
 "identities": ["subject: string (Google subject)", "userId: number"],
 "sessions": ["hash: string", "userId: number", "csrf: string", "expiresAt: string"],
 "attempts": ["key: string", "actorId: number (0 for auth rate counters)", "hash: string", "bookingId?: number", "at: string", "rejection?: {code, message}", "rateCount?: number", "rateUntil?: string"],
 "outbox": ["noticeId: number", "status: QUEUED | SENDING | SENT | FAILED", "attempts: number", "nextAt: string", "leaseUntil?: string", "leaseToken?: string", "sentAt?: string", "error?: string"],
 "flows": ["hash: string", "verifier: string", "state: string", "nonce: string", "expiresAt: string"],
 "credentials": ["userId: number", "passwordHash: string (Argon2id)", "updatedAt: string", "failedAttempts: number", "lockedUntil?: string"],
 "password_tokens": ["tokenHash: string", "kind: register | reset", "email: string", "name?: string", "passwordHash?: string", "userId?: number", "expiresAt: string"],
 "settings": ["contactEmail: string", "contactPhone: string", "faqs: {q, a, keys[]}[]", "workerAt?: string"],
}
KEYS = {t: "String(payload.id)" for t in PAYLOAD}
KEYS.update(holidays="date string", assignments="String(payload.userId)", identities="payload.subject",
 sessions="payload.hash", flows="payload.hash", attempts="actorId + ':' + request key",
 outbox="String(payload.noticeId)", credentials="String(payload.userId)",
 password_tokens="payload.tokenHash", settings="'site'", app_lock="id = 1")

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

class Page:
    def __init__(self, name, slug, width, height, title, subtitle, notes):
        self.name, self.slug, self.w, self.h = name, slug, width, height
        self.title, self.subtitle, self.notes = title, subtitle, notes
        self.nodes, self.edges, self.labels = {}, [], []
    def node(self, key, x, y, title, fields, kind="core", tag="", width=390, note="", size=18):
        h = 79 + 28 * len(fields) + (37 if note else 0)
        self.nodes[key] = dict(key=key, x=x, y=y, w=width, h=h, title=title, fields=fields,
                               kind=kind, tag=tag, note=note, size=size)
        return self.nodes[key]
    def edge(self, parent, child, label, kind="logical", points=None):
        self.edges.append(dict(source=parent, target=child, label=label, kind=kind, points=points))
    def anchor(self, key, side, ratio=0.5):
        n = self.nodes[key]; x,y,w,h = n["x"],n["y"],n["w"],n["h"]
        return {"L":(x,y+h*ratio),"R":(x+w,y+h*ratio),"T":(x+w*ratio,y),"B":(x+w*ratio,y+h)}[side]

def rect(n, pad=0):
    return (n["x"]-pad, n["y"]-pad, n["x"]+n["w"]+pad, n["y"]+n["h"]+pad)
def intersects(a,b):
    return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]
def clear_segment(a,b, boxes):
    if a[0] == b[0]:
        return not any(l<a[0]<r and max(min(a[1],b[1]),t)<min(max(a[1],b[1]),bot) for l,t,r,bot in boxes)
    return not any(t<a[1]<bot and max(min(a[0],b[0]),l)<min(max(a[0],b[0]),r) for l,t,r,bot in boxes)
def simplify(points):
    out=[]
    for p in points:
        if out and p==out[-1]: continue
        if len(out)>1 and ((out[-2][0]==out[-1][0]==p[0]) or (out[-2][1]==out[-1][1]==p[1])): out.pop()
        out.append(p)
    return out
def route(page, edge):
    a,b = page.nodes[edge["source"]],page.nodes[edge["target"]]
    dx = b["x"]+b["w"]/2-a["x"]-a["w"]/2
    dy = b["y"]+b["h"]/2-a["y"]-a["h"]/2
    if abs(dx)>abs(dy)*0.75: sides=("R","L") if dx>0 else ("L","R")
    else: sides=("B","T") if dy>0 else ("T","B")
    start,end = page.anchor(edge["source"],sides[0]),page.anchor(edge["target"],sides[1])
    def outside(p,side):
        vx,vy={"L":(-24,0),"R":(24,0),"T":(0,-24),"B":(0,24)}[side]
        return p[0]+vx,p[1]+vy
    s,t=outside(start,sides[0]),outside(end,sides[1])
    boxes=[rect(n,10) for n in page.nodes.values()]
    xs=sorted({30,page.w-30,s[0],t[0],*[v for n in page.nodes.values() for v in (n["x"]-30,n["x"]+n["w"]+30)]})
    ys=sorted({180,page.h-180,s[1],t[1],*[v for n in page.nodes.values() for v in (n["y"]-30,n["y"]+n["h"]+30)]})
    si,ti=(xs.index(s[0]),ys.index(s[1])),(xs.index(t[0]),ys.index(t[1]))
    q=[(0,0,si[0],si[1],-1)]; cost={(si[0],si[1],-1):0}; prev={}; goal=None
    while q:
        _,g,i,j,d = heapq.heappop(q)
        state=(i,j,d)
        if g != cost.get(state): continue
        if (i,j)==ti: goal=state; break
        for di,dj,nd in [(1,0,0),(-1,0,0),(0,1,1),(0,-1,1)]:
            ni,nj=i+di,j+dj
            if not(0<=ni<len(xs) and 0<=nj<len(ys)):continue
            p1,p2=(xs[i],ys[j]),(xs[ni],ys[nj])
            if not clear_segment(p1,p2,boxes):continue
            distance=abs(p1[0]-p2[0])+abs(p1[1]-p2[1])
            ng=g+distance+(45 if d>=0 and d!=nd else 0)
            ns=(ni,nj,nd)
            if ng<cost.get(ns,float("inf")):
                cost[ns]=ng;prev[ns]=state
                heuristic=abs(xs[ni]-t[0])+abs(ys[nj]-t[1])
                heapq.heappush(q,(ng+heuristic,ng,ni,nj,nd))
    if goal is None: raise ValueError("Cannot route "+str(edge))
    path=[]
    while True:
        path.append((xs[goal[0]],ys[goal[1]]))
        if goal not in prev: break
        goal=prev[goal]
    return simplify([start]+list(reversed(path))+[end])

def place_labels(page):
    obstacles=[rect(n,4) for n in page.nodes.values()]
    def valid(box):
        return box[0]>=20 and box[2]<=page.w-20 and box[1]>=180 and box[3]<page.h-140 and not any(intersects(box,b) for b in obstacles+page.labels)
    for e in page.edges:
        if not e["points"]:e["points"]=route(page,e)
        f=font(16,True); length=f.getlength(e["label"]); w=length+20;h=30
        candidates=[]
        for a,b in zip(e["points"],e["points"][1:]):
            distance=abs(a[0]-b[0])+abs(a[1]-b[1])
            for r in [0.5,0.3,0.7]:
                x=a[0]+r*(b[0]-a[0]);y=a[1]+r*(b[1]-a[1])
                # Offset vertical labels into the surrounding corridor.
                x += w/2+7 if a[0]==b[0] else 0
                candidates.append((distance,x,y))
                if a[1]==b[1]:
                    candidates.extend([(distance-1,x,y-34),(distance-2,x,y+34)])
                else:
                    candidates.extend([(distance-1,x-w-14,y),(distance-2,x,y-34),(distance-3,x,y+34)])
        candidates.sort(reverse=True)
        selected=None
        for _,x,y in candidates:
            box=(x-w/2,y-h/2,x+w/2,y+h/2)
            if valid(box):
                selected=(x,y,box);break
        if selected is None:
            # Numerical multiplicities remain in the editable edge; label shorter export.
            short=e["label"].split(" / ")[0];e["export_label"]=short
            w=f.getlength(short)+20
            for _,x,y in candidates:
                box=(x-w/2,y-h/2,x+w/2,y+h/2)
                if valid(box):
                    selected=(x,y,box);break
        if selected is None: raise ValueError("No space for edge label "+str(e))
        e["label_pos"]=selected[:2];page.labels.append(selected[2])

def physical():
    p=Page("01 PostgreSQL - Physical schema","postgres-schema",2240,1770,
      "KKU SPACE / PostgreSQL schema","23 tables | 51 columns | 4 enforced foreign keys | schema: kku_private | verified "+DATE,
      ["Solid arrows = database FK. JSONB relationships are on the logical ER pages.",
       "PK = primary key; FK = foreign key; NN = NOT NULL; GEN = stored generated column.",
       "All 23 tables have RLS. Gray tables retain legacy password data; current login uses Google."])
    cols=defaultdict(list)
    for c in META["columns"]:cols[c["table_name"]].append(c)
    def add(t,x,y,w=390):
        fields=[]
        for c in cols[t]:
            typ="timestamptz" if c["data_type"]=="timestamp with time zone" else c["data_type"]
            flag="PK" if c["column_name"] in ("key","id") else "FK" if c["column_name"] in ("user_key","room_key","building_key") else "NN"
            if c["is_generated"]=="ALWAYS":flag+=" GEN"
            fields.append(f'{flag:<6} {c["column_name"]}: {typ}')
        kind="legacy" if t in ("credentials","password_tokens") else "auth" if t in ("identities","sessions","flows") else "ops" if t in ("attempts","outbox","holidays","settings","app_lock") else "core"
        note="LEGACY / password login inactive" if kind=="legacy" else "key = "+KEYS[t] if t!="app_lock" else "Singleton write lock / id = 1"
        return p.node(t,x,y,t,fields,kind,"PHYSICAL TABLE | ALL COLUMNS NN",w,note,17)
    add("users",70,230);add("bookings",620,230,430);add("rooms",1240,230,420);add("buildings",1810,230,360);add("credentials",70,480)
    for parent,child,label,pts in [
      ("users","bookings","1 : 0..* / user_key",[p.anchor("users","R",.4),(540,p.anchor("users","R",.4)[1]),(540,320),(620,320)]),
      ("rooms","bookings","1 : 0..* / room_key",[p.anchor("rooms","L",.35),(1150,p.anchor("rooms","L",.35)[1]),(1150,365),p.anchor("bookings","R",(365-230)/p.nodes["bookings"]["h"])]),
      ("buildings","rooms","1 : 0..* / building_key",[p.anchor("buildings","L",.5),(1730,p.anchor("buildings","L",.5)[1]),(1730,p.anchor("rooms","R",.5)[1]),p.anchor("rooms","R",.5)]),
      ("users","credentials","1 : 0..1 / key",[p.anchor("users","B"),p.anchor("credentials","T")])]:
        p.edge(parent,child,label,"fk",simplify(pts))
    others=[t["table"] for t in META["rls"] if t["table"] not in p.nodes]
    for i,t in enumerate(others):add(t,70+(i%5)*440,730+(i//5)*220,390)
    return p

def business():
    p=Page("02 Business - Logical ER","business-er",2240,1840,
      "KKU SPACE / Business ER","Current application model | JSONB properties, not additional SQL columns | "+DATE,
      ["Solid = DB foreign key; dashed = application / JSONB reference; purple = embedded JSON array.",
       "Rooms.inventory and inspections.items are fixed-stock snapshots. Booking equipment refers to loan stock.",
       "Secondary actor references (decidedBy / actorId) are listed in SCHEMA.md. Reports are computed, not stored tables."])
    p.node("buildings",70,230,"buildings",["id: number -> key","name: string","floors: number","active?: boolean"],tag="JSONB ENTITY")
    p.node("rooms",720,230,"rooms",["id: number -> key","buildingId: number","code / name: string","floor / capacity: number","type / status: string","amenities: string[]","inventory?: item[]","hours?: operating hours"],tag="JSONB ENTITY",note="Inventory is embedded; no room_equipment table.")
    p.node("equipment",1780,230,"equipment",["id: number -> key","name: string","total: number","remaining: number"],tag="JSONB ENTITY")
    p.node("assignments",1350,230,"assignments",["userId: number -> key","roomIds: number[]","start?: string","end?: string"],tag="JSONB ACCESS MAPPING",note="One row per staff user; roomIds is an array.")
    p.node("users",70,650,"users",["id: number -> key","name / email: string","phone / affiliation: string","role: USER | STAFF | ADMIN","active: boolean"],tag="JSONB ENTITY",note="STAFF is a role; there is no staff SQL table.")
    p.node("bookings",720,650,"bookings",["id / ref","userId / roomId","start / end","purpose / attendees","status / createdAt","decidedBy? / decidedAt?","participantEmails?: string[]","equipment: loanItem[]","SLA / archive timestamps?"],tag="JSONB + INDEXED SQL COLUMNS")
    p.node("loan",1350,650,"booking equipment[]",["id: number -> equipment.id","qty: number","issued?: number","returned?: number"],"embedded","EMBEDDED / NOT A TABLE",note="Stored inside bookings.payload.equipment.")
    p.node("closures",1780,650,"closures",["id: number -> key","roomId: number","start / end: string","reason: string"],tag="JSONB ENTITY")
    p.node("messages",70,970,"messages",["id: number -> key","userId: number","question / answer","at: string"],tag="JSONB ENTITY")
    p.node("penalties",70,1240,"penalties",["id: number -> key","userId: number","type: WARNING | SUSPENSION","start / end: string","actorId / reason / at"],tag="JSONB ENTITY")
    p.node("notices",720,1150,"notices",["id: number -> key","userId: number","bookingId?: number","subject / content","status / attempts","createdAt / readAt?"],tag="JSONB ENTITY")
    p.node("violations",1350,1150,"violations",["id: number -> key","userId: number","bookingId: number","type: NO_SHOW | LATE_CANCEL","at: string"],tag="JSONB ENTITY")
    p.node("inspections",1780,1150,"inspections",["id: number -> key","roomId: number","actorId: number","condition / note / at","items?: inventory snapshot[]"],tag="JSONB ENTITY")
    p.node("audit",720,1500,"audit",["id / at / text","actorId: number | null","bookingId?: number"],tag="JSONB ENTITY")
    for a,b,lab,k in [
     ("buildings","rooms","1 : 0..* / buildingId","fk"),("users","bookings","1 : 0..* / userId","fk"),
     ("rooms","bookings","1 : 0..* / roomId","fk"),("bookings","loan","1 : 0..* / contains","embedded"),
     ("equipment","loan","1 : 0..* / id","logical"),("users","assignments","1 : 0..1 / userId","logical"),
     ("rooms","assignments","0..* : 0..* / roomIds[]","logical"),("rooms","closures","1 : 0..* / roomId","logical"),
     ("rooms","inspections","1 : 0..* / roomId","logical"),("users","messages","1 : 0..* / userId","logical"),
     ("users","penalties","1 : 0..* / userId","logical"),("users","notices","1 : 0..* / userId","logical"),
     ("bookings","notices","0..1 : 0..* / bookingId?","logical"),("bookings","violations","1 : 0..* / bookingId","logical"),
     ("users","violations","1 : 0..* / userId","logical"),("bookings","audit","0..1 : 0..* / bookingId?","logical")]:
        p.edge(a,b,lab,k)
    return p

def auth():
    p=Page("03 Google auth - Runtime","google-auth-er",2100,1460,
      "KKU SPACE / Google identity & runtime","Google OAuth -> identities -> users -> sessions | custom server auth | "+DATE,
      ["Dashed = application reference in JSONB; solid = enforced FK. Supabase Auth tables are not used by this app.",
       "flows are pre-login OAuth state / nonce / PKCE records. attempts also stores actorId = 0 rate counters.",
       "Gray = retained legacy password tables. Their presence does not mean self-registration is enabled."])
    p.node("users",820,250,"users",["id: number -> key","email / role / active"],"core","APPLICATION ACCOUNT",400)
    p.node("identities",70,250,"identities",["subject: string -> key","userId: number"],"auth","GOOGLE IDENTITY",420,note="Google subject maps to application user.")
    p.node("sessions",1570,250,"sessions",PAYLOAD["sessions"],"auth","SERVER SESSION",420)
    p.node("flows",70,600,"flows",PAYLOAD["flows"],"auth","PRE-LOGIN OAUTH FLOW",420)
    p.node("attempts",820,600,"attempts",["key / actorId / hash","bookingId? / at","rejection?: {code, message}","rateCount? / rateUntil?"],"ops","IDEMPOTENCY + RATE COUNTERS",420,note="actorId = 0 for unauthenticated rate limits.")
    p.node("notices",1570,600,"notices",["id: number -> key","userId: number","bookingId?: number","status / subject / content"],"core","USER NOTIFICATION",420)
    p.node("outbox",1570,1000,"outbox",["noticeId: number -> key","status / attempts / nextAt","leaseUntil? / leaseToken?","sentAt? / error?"],"ops","DELIVERY JOB",420)
    p.node("credentials",70,1000,"credentials",PAYLOAD["credentials"],"legacy","LEGACY / INACTIVE LOGIN",420)
    p.node("password_tokens",820,1000,"password_tokens",["tokenHash: string -> key","kind: register | reset","email / userId?","name? / passwordHash?","expiresAt: string"],"legacy","LEGACY / INACTIVE LOGIN",420)
    for a,b,label,kind in [
     ("users","identities","1 : 0..* / userId","logical"),("users","sessions","1 : 0..* / userId","logical"),
     ("users","attempts","0..1 : 0..* / actorId","logical"),("users","notices","1 : 0..* / userId","logical"),
     ("notices","outbox","1 : 0..1 / noticeId","logical"),("users","credentials","1 : 0..1 / key = userId","fk"),
     ("users","password_tokens","0..1 : 0..* / userId?","logical")]:p.edge(a,b,label,kind)
    return p

def balanced(text,start):
    depth=0;quoted=False;i=start
    while i<len(text):
        c=text[i]
        if c=="'":
            if quoted and i+1<len(text) and text[i+1]=="'":i+=2;continue
            quoted=not quoted
        if not quoted:
            if c=="(":depth+=1
            if c==")":
                depth-=1
                if depth==0:return text[start+1:i],i+1
        i+=1
    raise ValueError("Unclosed SQL parentheses")
def split_sql(body):
    out=[];start=0;depth=0;quoted=False
    for i,c in enumerate(body):
        if c=="'":quoted=not quoted
        if not quoted:
            if c=="(":depth+=1
            elif c==")":depth-=1
            elif c=="," and depth==0:out.append(body[start:i].strip());start=i+1
    out.append(body[start:].strip());return out
def parse_column(decl):
    m=re.match(r"(\w+)\s+(NUMBER(?:\([^)]*\))?|VARCHAR2\([^)]*\)|CLOB|DATE|TIMESTAMP(?:\(\d+\))?(?:\s+WITH\s+LOCAL\s+TIME\s+ZONE)?)",decl,re.I)
    if not m:return None
    return dict(name=m[1].lower(),type=re.sub(r"\s+"," ",m[2].upper()),nullable=not bool(re.search(r"NOT\s+NULL|PRIMARY\s+KEY",decl,re.I)),declaration=re.sub(r"\s+"," ",decl))

def oracle_metadata():
    tables={};fks=[];pk={};base_names=[]
    paths=[REQUEST/"SAfordata.ddl",REQUEST/"SAfordata_claude.sql",REQUEST/"SAfordata_business_security.sql"]
    for path in paths:
        text=re.sub(r"/\*.*?\*/|--[^\n]*","",path.read_text(encoding="utf-8"),flags=re.S)
        for m in re.finditer(r"\bCREATE\s+TABLE\s+(\w+)\s*\(",text,re.I):
            name=m[1].lower()
            # The migration journal is created inside an EXECUTE IMMEDIATE string.
            if name=="kku_schema_migration":
                body="name VARCHAR2(100) PRIMARY KEY,status VARCHAR2(10) NOT NULL,applied_at TIMESTAMP"
            else:body,_=balanced(text,m.end()-1)
            columns=[]
            for decl in split_sql(body):
                c=parse_column(decl)
                if c:
                    columns.append(c)
                    if re.search(r"PRIMARY\s+KEY",decl,re.I):pk[name]=[c["name"]]
                    ref=re.search(r"REFERENCES\s+(\w+)\s*\(([^)]+)\)",decl,re.I)
                    if ref:fks.append(dict(child=name,columns=[c["name"]],parent=ref[1].lower(),references=[ref[2].strip().lower()],optional=c["nullable"]))
                else:
                    pm=re.search(r"PRIMARY\s+KEY\s*\(([^)]+)\)",decl,re.I)
                    if pm:pk[name]=[x.strip().lower() for x in pm[1].split(",")]
                    fm=re.search(r"FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)",decl,re.I)
                    if fm:fks.append(dict(child=name,columns=[x.strip().lower() for x in fm[1].split(",")],parent=fm[2].lower(),references=[x.strip().lower() for x in fm[3].split(",")],optional=False))
            tables[name]=columns
            if path.suffix==".ddl":base_names.append(name)
        for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+(ADD|MODIFY)\s*\(",text,re.I):
            name,operation=m[1].lower(),m[2].upper()
            body,_=balanced(text,m.end()-1)
            for decl in split_sql(body):
                c=parse_column(decl)
                if not c:
                    if operation=="MODIFY":
                        cm=re.match(r"(\w+)\s+",decl)
                        if cm and re.search(r"NOT\s+NULL",decl,re.I):
                            existing=next(x for x in tables[name] if x["name"]==cm[1].lower())
                            existing["nullable"]=False
                    continue
                if operation=="ADD":tables[name].append(c)
                else:
                    existing=next(x for x in tables[name] if x["name"]==c["name"])
                    if re.search("NOT NULL",decl,re.I):existing["nullable"]=False
                    existing["type"]=c["type"]
        for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+\w+\s+PRIMARY\s+KEY\s*\(([^)]+)\)",text,re.I):
            pk[m[1].lower()]=[x.strip().lower() for x in m[2].split(",")]
        for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)",text,re.I):
            fks.append(dict(child=m[1].lower(),columns=[x.strip().lower() for x in m[2].split(",")],parent=m[3].lower(),references=[x.strip().lower() for x in m[4].split(",")]))
        for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)",text,re.I):
            tables[m[1].lower()]=[c for c in tables[m[1].lower()] if c["name"]!=m[2].lower()]
        for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+RENAME\s+COLUMN\s+(\w+)\s+TO\s+(\w+)",text,re.I):
            for c in tables[m[1].lower()]:
                if c["name"]==m[2].lower():c["name"]=m[3].lower()
            for fk in fks:
                if fk["child"]==m[1].lower():fk["columns"]=[m[3].lower() if c==m[2].lower() else c for c in fk["columns"]]
                if fk["parent"]==m[1].lower():fk["references"]=[m[3].lower() if c==m[2].lower() else c for c in fk["references"]]
            pk[m[1].lower()]=[m[3].lower() if c==m[2].lower() else c for c in pk[m[1].lower()]]
    for fk in fks:
        names={c["name"]:c for c in tables[fk["child"]]}
        if not all(col in names for col in fk["columns"]):raise ValueError(("Missing FK column",fk,list(names)))
        fk["optional"]=any(names[col]["nullable"] for col in fk["columns"])
    return dict(tables=tables,fks=fks,pk=pk,base_names=base_names)

def oracle_pages(om):
    p=Page("04 Oracle - Core ER","oracle-core-er",2640,2900,
      "KKU SPACE / Oracle core ER","18 original entities + revised columns | SQL source model; not verified on a live Oracle instance",
      ["Solid arrows = Oracle FK definitions. Only relationship keys and selected fields appear on this page.",
       "TS = TIMESTAMP; TS LTZ = TIMESTAMP WITH LOCAL TIME ZONE. Full column catalogue is in SCHEMA.md.",
       "Source: SAfordata.ddl + SAfordata_claude.sql + SAfordata_business_security.sql. No active Oracle backend."])
    pos={"affiliation":(70,240),"room_type":(1350,240),"building":(2030,240),
      "users":(70,700),"booking":(710,700),"room":(1350,700),"floor":(2030,700),
      "staff":(70,1250),"booking_participant":(710,1250),"booking_equipment":(1350,1250),"equipment":(2030,1250),
      "room_assignment":(70,1790),"booking_log":(710,1790),"notification":(1350,1790),"room_equipment":(2030,1790),
      "report":(70,2330),"penalty":(710,2330),"holiday":(2030,2330)}
    for name,(x,y) in pos.items():
        keys=set(om["pk"][name])|{c for fk in om["fks"] if fk["child"]==name for c in fk["columns"]}
        selected=[c for c in om["tables"][name] if c["name"] in keys]
        selected += [c for c in om["tables"][name] if c["name"] not in keys][:max(0,7-len(selected))]
        fields=[]
        for c in selected:
            flag="PK" if c["name"] in om["pk"][name] else "FK" if c["name"] in keys else "  "
            typ=c["type"].replace("TIMESTAMP WITH LOCAL TIME ZONE","TS LTZ").replace("TIMESTAMP","TS")
            fields.append(flag+" "+c["name"]+": "+typ+(" ?" if c["nullable"] else ""))
        p.node(name,x,y,name,fields,"oracle","ORACLE TABLE / SELECTED COLUMNS",500,note=str(len(om["tables"][name]))+" total columns; see catalogue.",size=16)
    for fk in om["fks"]:
        if fk["child"] not in pos or fk["parent"] not in pos:continue
        child=fk["child"];unique=om["pk"][child]==fk["columns"] or child=="staff" and fk["columns"]==["users_user_id"]
        p.edge(fk["parent"],child,("0..1" if fk["optional"] else "1")+" : "+("0..1" if unique else "0..*"),"fk")
    q=Page("05 Oracle - Extensions ER","oracle-extensions-er",2640,2580,
      "KKU SPACE / Oracle extensions ER","12 added tables | 30 total Oracle tables including migration journal | SQL source model only",
      ["Outlined CORE REF cards point to original tables on page 04; they are not additional tables.",
       "Oracle notification stores delivery queue fields itself. PostgreSQL uses separate notices and outbox tables.",
       "Legacy login_credential remains in the Oracle design. Current application uses PostgreSQL + Google login."])
    refs={"users":(70,240),"room":(2030,240),"booking":(710,240),"booking_equipment":(1350,240)}
    for name,(x,y) in refs.items():q.node(name,x,y,name,["PK "+", ".join(om["pk"][name])],"core","CORE REF / PAGE 04",500)
    pos2={"login_identity":(70,720),"command_attempt":(710,720),"stock_movement":(1350,720),"room_closure":(2030,720),
      "login_session":(70,1270),"booking_violation":(710,1270),"help_message":(1350,1270),"room_inspection":(2030,1270),
      "login_credential":(70,1870),"help_faq":(710,1870),"kku_app_lock":(1350,1870),"kku_schema_migration":(2030,1870)}
    for name,(x,y) in pos2.items():
        fcols={c for fk in om["fks"] if fk["child"]==name for c in fk["columns"]}
        fields=[]
        for c in om["tables"][name]:
            flag="PK" if c["name"] in om["pk"][name] else "FK" if c["name"] in fcols else "  "
            typ=c["type"].replace("TIMESTAMP","TS")
            fields.append(flag+" "+c["name"]+": "+typ+(" ?" if c["nullable"] else ""))
        q.node(name,x,y,name,fields,"legacy" if name=="login_credential" else "oracle","ADDED ORACLE TABLE",500,size=16)
    for fk in om["fks"]:
        if fk["child"] not in pos2:continue
        if fk["parent"] not in q.nodes:raise ValueError(fk)
        unique=om["pk"][fk["child"]]==fk["columns"]
        q.edge(fk["parent"],fk["child"],("0..1" if fk["optional"] else "1")+" : "+("0..1" if unique else "0..*"),"fk")
    return [p,q]

def edge_color(e):
    return "#476D9B" if e["kind"]=="fk" else "#84619D" if e["kind"]=="embedded" else "#6B849C"
def draw_page(page):
    scale=2
    img=Image.new("RGB",(page.w*scale,page.h*scale),BG);d=ImageDraw.Draw(img)
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 %s %s">'%(page.w,page.h,page.w,page.h),
         '<rect width="100%" height="100%" fill="'+BG+'"/>']
    def rectangle(box,fill,outline=None,width=1):
        d.rectangle(tuple(round(v*scale) for v in box),fill=fill,outline=outline,width=width*scale)
        svg.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>'%(box[0],box[1],box[2]-box[0],box[3]-box[1],fill,outline or "none",width))
    def text(x,y,value,size=18,fill=INK,bold=False):
        d.text((round(x*scale),round(y*scale)),value,font=font(size*scale,bold),fill=fill)
        svg.append('<text x="%s" y="%s" font-family="Segoe UI,Arial,sans-serif" font-size="%s" font-weight="%s" fill="%s">%s</text>'%(x,y+size,size,700 if bold else 400,fill,html.escape(value)))
    text(70,40,page.title,38,bold=True);text(70,103,page.subtitle,20,fill=MUTED)
    text(70,145,"SOLID: FK   |   DASHED: JSON / APPLICATION   |   PURPLE: EMBEDDED   |   GRAY: LEGACY",16,fill=MUTED)
    # Connectors are painted before cards; routing checks prevent lines through cards.
    for e in page.edges:
        pts=e["points"];color=edge_color(e)
        dashed=e["kind"]!="fk"
        for a,b in zip(pts,pts[1:]):
            ax,ay=a;bx,by=b;length=math.hypot(bx-ax,by-ay)
            if dashed and length:
                for start in range(0,int(length),15):
                    end=min(start+8,length)
                    d.line((int((ax+(bx-ax)*start/length)*scale),int((ay+(by-ay)*start/length)*scale),int((ax+(bx-ax)*end/length)*scale),int((ay+(by-ay)*end/length)*scale)),fill=color,width=2*scale)
            else:d.line(tuple(v*scale for v in (*a,*b)),fill=color,width=2*scale)
        svg.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="2" %s/>'%(" ".join(f"{x},{y}" for x,y in pts),color,'stroke-dasharray="8 7"' if dashed else ""))
        a,b=pts[-2:];ang=math.atan2(b[1]-a[1],b[0]-a[0])
        arrow=[(b[0]-12*math.cos(ang-.5),b[1]-12*math.sin(ang-.5)),b,(b[0]-12*math.cos(ang+.5),b[1]-12*math.sin(ang+.5))]
        d.line(tuple(v*scale for p in arrow for v in p),fill=color,width=2*scale)
        svg.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="2"/>'%(" ".join(f"{x},{y}" for x,y in arrow),color))
    for n in page.nodes.values():
        x,y,w,h=n["x"],n["y"],n["w"],n["h"];header,fill=COLORS[n["kind"]]
        rectangle((x+3,y+5,x+w+3,y+h+5),"#E5EAF1")
        rectangle((x,y,x+w,y+h),fill,header,1)
        rectangle((x,y,x+w,y+45),header)
        text(x+18,y+8,n["title"],23,"#FFFFFF",True)
        text(x+18,y+53,n["tag"],12,header,True)
        for i,line in enumerate(n["fields"]):text(x+18,y+79+i*28,line,n["size"])
        if n["note"]:text(x+18,y+h-29,n["note"],13,fill=MUTED)
    for e in page.edges:
        x,y=e["label_pos"];value=e.get("export_label",e["label"]);w=font(16,True).getlength(value)+20
        rectangle((x-w/2,y-15,x+w/2,y+15),"#FFFFFF","#DCE4ED")
        text(x-w/2+10,y-11,value,16,edge_color(e),True)
    for i,note in enumerate(page.notes):text(70,page.h-122+i*31,note,17,fill=MUTED)
    text(page.w-180,page.h-30,page.name[:2]+" / 05",13,fill=MUTED)
    img.save(BASE/(page.slug+".png"),optimize=True)
    svg.append("</svg>");(BASE/(page.slug+".svg")).write_text("\n".join(svg),encoding="utf-8")

def drawio(pages):
    file=ET.Element("mxfile",host="app.diagrams.net",modified=DATE+"T00:00:00.000Z",agent="Project schema generator",version="24.7.17",type="device")
    for i,p in enumerate(pages):
        diagram=ET.SubElement(file,"diagram",id=p.slug,name=p.name)
        model=ET.SubElement(diagram,"mxGraphModel",dx="1422",dy="794",grid="1",gridSize="10",guides="1",tooltips="1",connect="1",arrows="1",fold="1",page="1",pageScale="1",pageWidth=str(p.w),pageHeight=str(p.h),math="0",shadow="0",background=BG)
        root=ET.SubElement(model,"root");ET.SubElement(root,"mxCell",id="0");ET.SubElement(root,"mxCell",id="1",parent="0")
        def cell(key,value,style,x,y,w,h,parent="1"):
            c=ET.SubElement(root,"mxCell",id=key,value=value,style=style,vertex="1",parent=parent)
            ET.SubElement(c,"mxGeometry",x=str(x),y=str(y),width=str(w),height=str(h),**{"as":"geometry"})
            return c
        cell("title",p.title,"text;html=0;align=left;fontSize=38;fontStyle=1;fontColor="+INK+";fontFamily=Segoe UI;",70,36,p.w-140,55)
        cell("subtitle",p.subtitle,"text;html=0;align=left;fontSize=20;fontColor="+MUTED+";fontFamily=Segoe UI;",70,96,p.w-140,40)
        cell("legend","Solid: database FK  |  Dashed: JSON/application  |  Purple: embedded array  |  Gray: legacy","text;html=0;align=left;fontSize=16;fontColor="+MUTED+";",70,140,p.w-140,30)
        for n in p.nodes.values():
            key=n["key"];header,fill=COLORS[n["kind"]]
            group=cell(key,"","group;",n["x"],n["y"],n["w"],n["h"])
            group.set("connectable","1")
            cell(key+"-body","","rounded=0;fillColor="+fill+";strokeColor="+header+";",0,0,n["w"],n["h"],key)
            cell(key+"-head",n["title"],"rounded=0;html=0;align=left;spacingLeft=18;fontSize=23;fontStyle=1;fontColor=#FFFFFF;fillColor="+header+";strokeColor="+header+";fontFamily=Segoe UI;",0,0,n["w"],45,key)
            cell(key+"-tag",n["tag"],"text;html=0;align=left;spacingLeft=0;fontSize=12;fontStyle=1;fontColor="+header+";",18,50,n["w"]-36,22,key)
            for j,value in enumerate(n["fields"]):
                cell(key+"-field-"+str(j),value,"text;html=0;align=left;spacingLeft=0;fontSize="+str(n["size"])+";fontColor="+INK+";fontFamily=Segoe UI;",18,75+j*28,n["w"]-36,28,key)
            if n["note"]:cell(key+"-note",n["note"],"text;html=0;align=left;fontSize=13;fontColor="+MUTED+";",18,n["h"]-31,n["w"]-36,27,key)
        for j,e in enumerate(p.edges):
            sn,tn=p.nodes[e["source"]],p.nodes[e["target"]];start,end=e["points"][0],e["points"][-1]
            style="edgeStyle=none;rounded=0;html=0;endArrow=open;endFill=0;strokeWidth=2;strokeColor="+edge_color(e)+";"+("dashed=1;dashPattern=8 7;" if e["kind"]!="fk" else "")
            style+=f'exitX={(start[0]-sn["x"])/sn["w"]};exitY={(start[1]-sn["y"])/sn["h"]};exitPerimeter=0;entryX={(end[0]-tn["x"])/tn["w"]};entryY={(end[1]-tn["y"])/tn["h"]};entryPerimeter=0;'
            edge=ET.SubElement(root,"mxCell",id="edge-"+str(j),value="",style=style,edge="1",parent="1",source=e["source"],target=e["target"])
            g=ET.SubElement(edge,"mxGeometry",relative="1",**{"as":"geometry"})
            arr=ET.SubElement(g,"Array",**{"as":"points"})
            for x,y in e["points"][1:-1]:ET.SubElement(arr,"mxPoint",x=str(x),y=str(y))
            # Keep each relation label editable and moveable as part of the page.
            x,y=e["label_pos"];value=e.get("export_label",e["label"]);w=font(16,True).getlength(value)+20
            cell("relation-label-"+str(j),value,"rounded=0;html=0;fillColor=#FFFFFF;strokeColor=#DCE4ED;fontSize=16;fontStyle=1;fontColor="+edge_color(e)+";fontFamily=Segoe UI;",x-w/2,y-15,w,30)
        for j,note in enumerate(p.notes):cell("footer-"+str(j),note,"text;html=0;align=left;fontSize=17;fontColor="+MUTED+";",70,p.h-130+j*31,p.w-140,35)
    ET.indent(file)
    ET.ElementTree(file).write(BASE/"kku-space-er.drawio",encoding="utf-8",xml_declaration=True)

def catalogue(om):
    tick=chr(96)
    def code(s):return tick+str(s).replace("|",r"\|")+tick
    lines=["# ER Diagram และ Schema — KKU SPACE","","ตรวจ PostgreSQL/Supabase จริงเมื่อ "+DATE+" โดยอ่านเฉพาะ metadata ไม่อ่านข้อมูลผู้ใช้และไม่แก้ฐานข้อมูล",
      "","## ไฟล์และหน้า Draw.io","",
      "| หน้า | เนื้อหา | ภาพ |","| --- | --- | --- |"]
    for p in PAGES:lines.append(f"| {p.name} | {p.subtitle} | [{p.slug}.png]({p.slug}.png) / [SVG]({p.slug}.svg) |")
    lines += ["","เปิด [kku-space-er.drawio](kku-space-er.drawio) ใน https://app.diagrams.net แล้วเลือก File → Open From → Device แต่ละตาราง ฟิลด์ และเส้นเป็นวัตถุที่แก้ไขได้",
      "","PNG ความละเอียด 2 เท่าของพื้นที่วาด; SVG ซูม/พิมพ์ได้โดยไม่แตก และ ZIP รวมไฟล์สำหรับส่งต่อ",
      "","## หลักการอ่าน","",
      "- เส้นทึบ = Foreign Key ที่ฐานข้อมูลบังคับจริง; ลูกศรชี้จากตารางแม่ไปตารางลูก",
      "- เส้นประ = ความสัมพันธ์จาก JSONB/ตรรกะแอป ไม่ใช่ FK ของ PostgreSQL",
      "- รูปแบบ 1 : 0..* หมายถึงรายการแม่หนึ่งรายการมีรายการลูกได้ศูนย์ถึงหลายรายการ; 0..1 คือไม่บังคับหรือมีได้สูงสุดหนึ่งรายการ",
      "- กล่องสีม่วง = array/object ที่ฝังใน JSONB ไม่ใช่ตาราง SQL; สีเทา = โครงสร้างรหัสผ่านเดิม",
      "- หน้า logical แสดงฟิลด์ของ payload; หน้า physical แสดงคอลัมน์ SQL จริงทั้งหมด",
      "","## PostgreSQL ปัจจุบัน","",
      "Schema "+code("kku_private")+": 23 ตาราง, 51 คอลัมน์, 4 Foreign Keys; RLS เปิดครบทุกตาราง (ยืนยันจาก metadata ของฐานข้อมูลจริง)",
      "","Login ที่เปิดใช้ในโค้ดปัจจุบันคือ Google OAuth ผ่าน NestJS และ session ของแอปเอง ไม่ใช้ตาราง Supabase Auth; "+code("credentials")+" และ "+code("password_tokens")+" ยังอยู่เพื่อรองรับข้อมูลเดิม แต่เส้นทางสมัคร/เข้าสู่ระบบด้วยรหัสผ่านถูกปิด",
      "","### Foreign Keys ที่บังคับจริง","","| ตารางลูก / คอลัมน์ | ตารางแม่ / คอลัมน์ |","| --- | --- |"]
    for fk in META["constraints"]:
        if fk["type"]=="f":lines.append("| "+code(fk["table_name"])+" | "+code(fk["definition"])+" |")
    lines += ["","### ตารางและคอลัมน์ทั้งหมด","",
      "ทุกคอลัมน์เป็น NOT NULL ทุกตารางยกเว้น app_lock มี "+code("key text PRIMARY KEY")+" และ "+code("payload jsonb NOT NULL")+". ID ตัวเลขใน payload ถูกแปลงเป็นข้อความสำหรับ key",
      "","| ตาราง | ความหมายของ PK | คอลัมน์ SQL |","| --- | --- | --- |"]
    cols=defaultdict(list)
    for c in META["columns"]:cols[c["table_name"]].append(c)
    for t in sorted(cols):
        desc=[c["column_name"]+" "+c["data_type"]+(" GENERATED STORED" if c["is_generated"]=="ALWAYS" else "") for c in cols[t]]
        lines.append("| "+code(t)+" | "+code(KEYS[t])+" | "+"; ".join(code(s) for s in desc)+" |")
    lines += ["","### JSONB data dictionary","",
      "? หมายถึง property ที่ optional ใน TypeScript ไม่ใช่คอลัมน์ SQL ที่ nullable; properties ใน object ย่อยใช้รูปแบบเดียวกัน",
      "","BookingStatus = PENDING, APPROVED, REJECTED, CANCELLED, CHECKED_IN, COMPLETED, NO_SHOW",
      "","| ตาราง | properties ใน payload |","| --- | --- |"]
    for t,fields in PAYLOAD.items():lines.append("| "+code(t)+" | "+"<br>".join(code(s) for s in fields)+" |")
    lines += ["","### ความสัมพันธ์ JSONB ที่ควรทราบ","",
      "| อ้างอิงจาก | ไปยัง | การเก็บจริง |","| --- | --- | --- |",
      "| bookings.decidedBy? | users.id | ผู้พิจารณา; ไม่ใช่ FK |",
      "| bookings.equipment[].id | equipment.id | รายการยืมฝังใน booking; qty / issued / returned |",
      "| bookings.participantEmails[] | อีเมลผู้ร่วมใช้งาน | string array; ไม่บังคับเป็นผู้ใช้ในระบบ |",
      "| bookings.participants[] | users.id เดิม | field compatibility; server ไม่รับรายการ ID ที่ไม่ว่าง |",
      "| notices.userId / bookingId? | users.id / bookings.id | ผู้รับและการจองที่เกี่ยวข้อง |",
      "| violations.userId / bookingId | users.id / bookings.id | บันทึกความผิด |",
      "| penalties.userId / actorId | users.id | ผู้ถูกลงโทษและผู้พิจารณา |",
      "| closures.roomId | rooms.id | ปิดห้องเป็นช่วงเวลา |",
      "| inspections.roomId / actorId | rooms.id / users.id | ตรวจห้อง; items เป็น snapshot ของ room.inventory |",
      "| messages.userId | users.id | คำถาม/ความช่วยเหลือ |",
      "| audit.actorId / bookingId? | users.id / bookings.id | actorId เป็น null ได้เมื่อเป็นเหตุการณ์ระบบ |",
      "| assignments.userId / roomIds[] | users.id / rooms.id | หนึ่งแถวต่อ STAFF; array ห้องที่ได้รับมอบหมาย |",
      "| identities.userId / sessions.userId | users.id | บัญชี Google และ session; ไม่มี FK |",
      "| attempts.actorId / bookingId? | users.id / bookings.id | actorId=0 สำหรับ counter ก่อน login จึงไม่ใช่ user ทุกแถว |",
      "| outbox.noticeId | notices.id | หนึ่งแถวคิวต่อแจ้งเตือนหนึ่งรายการ |",
      "| password_tokens.userId? | users.id | optional สำหรับระบบรหัสผ่านเดิม |",
      "","ไม่มีตาราง staff, floor, room_type, booking_equipment, booking_participant, room_equipment, help_faq หรือ report แยกใน PostgreSQL ปัจจุบัน: บทบาท/ชั้น/ชนิดห้องเป็นฟิลด์ รายการอุปกรณ์และ FAQ เป็น JSON arrays และรายงานคำนวณจากข้อมูล",
      "","### Constraints และ indexes","",
      "- rooms.building_key เป็น generated stored column จาก payload.buildingId",
      "- Unique email/code แบบไม่สนตัวพิมพ์ใหญ่เล็ก และ unique (bookingId,type) ของ violations",
      "- การจอง 30 นาทีถึง 4 ชั่วโมง; GiST exclusion constraint กันช่วงเวลาทับซ้อนสำหรับ PENDING / APPROVED / CHECKED_IN",
      "- Trigger ป้องกันเปลี่ยนเจ้าของ ห้อง และเวลาการจอง พร้อมตรวจการเปลี่ยนสถานะ",
      "- app_lock.id=1 ใช้ล็อกการเขียนข้าม API/worker; settings.key='site' เป็น singleton",
      "- payload ของ holidays เป็น JSON string; ตาราง JSONB อื่นเป็น object",
      "","รายละเอียดยืนยันจาก [schema-metadata.json](schema-metadata.json) ซึ่งมี columns, constraints, indexes และ RLS; source triggers อยู่ใน migration",
      "","## Oracle เดิมและ SQL ที่ปรับปรุง","",
      f"โมเดลจากไฟล์ SQL มี {len(om['tables'])} ตาราง ({len(om['base_names'])} เดิม + {len(om['tables'])-len(om['base_names'])} เพิ่ม รวม migration journal), {len(om['fks'])} Foreign Keys",
      "","เป็น schema ตาม source ที่แนะนำหลังใช้ SAfordata_claude.sql และ SAfordata_business_security.sql ไม่ใช่ metadata ของ Oracle ที่ติดตั้งจริง ยังไม่ได้ยืนยันการรัน migration บน Oracle และแอปปัจจุบันไม่มี Oracle adapter",
      "","หน้า 04 แสดงตารางเดิมพร้อม key/field หลังปรับปรุง; หน้า 05 แสดงตารางเพิ่มพร้อม reference กลับไปหน้า 04 ด้านล่างเป็น catalogue คอลัมน์ทั้งหมดหลังการปรับปรุง",
      "","### Oracle columns","","| ตาราง | Primary Key | คอลัมน์ (เครื่องหมาย ? = nullable) |","| --- | --- | --- |"]
    for name,columns in sorted(om["tables"].items()):
        lines.append("| "+code(name)+" | "+code(", ".join(om["pk"][name]))+" | "+"<br>".join(code(c["name"]+" "+c["type"]+(" ?" if c["nullable"] else "")) for c in columns)+" |")
    lines += ["","### Oracle Foreign Keys","","| ตารางลูก / คอลัมน์ | ตารางแม่ / คอลัมน์ | nullable |","| --- | --- | --- | --- |"]
    for fk in om["fks"]:
        lines.append("| "+code(fk["child"]+"."+",".join(fk["columns"]))+" | "+code(fk["parent"]+"."+",".join(fk["references"]))+" | "+("yes" if fk["optional"] else "no")+" |")
    lines += ["","### แหล่งข้อมูล","",
      "- [TypeScript business contracts](../../packages/contracts/src/index.ts)",
      "- [Server persistence types](../../apps/backend/src/infrastructure/store.ts)",
      "- [PostgreSQL adapter และ key mapping](../../apps/backend/src/infrastructure/postgres-store.ts)",
      "- [PostgreSQL migrations](../../supabase/migrations/)",
      "- [Google-only login](../MOBILE_UI_GOOGLE_LOGIN.md)",
      "- [SQL security](../SQL_SECURITY.md)",
      "- [Oracle DDL](../../../Request/SAfordata.ddl)",
      "- [Oracle base migration](../../../Request/SAfordata_claude.sql)",
      "- [Oracle extension migration](../../../Request/SAfordata_business_security.sql)",
      "","สร้างซ้ำ: รัน "+code("python docs/diagrams/generate_diagrams.py")+" จาก repository โดยติดตั้ง Pillow และมี fonts Segoe UI (Windows) ใช้ metadata snapshot ที่เก็บไว้ ไม่เชื่อมต่อฐานข้อมูล",
    ]
    (BASE/"SCHEMA.md").write_text("\n".join(lines)+"\n",encoding="utf-8")

def verify(pages,om):
    physical_names=set(pages[0].nodes)
    assert physical_names=={r["table"] for r in META["rls"]}
    assert sum(len(n["fields"]) for n in pages[0].nodes.values())==len(META["columns"])==51
    assert len(pages[0].edges)==len([c for c in META["constraints"] if c["type"]=="f"])==4
    assert len(om["base_names"])==18 and len(om["tables"])==30
    for p in pages:
        for key,n in p.nodes.items():
            assert n["y"]+n["h"]<p.h-140,(p.name,key,"footer collision")
            f=font(n["size"])
            assert all(f.getlength(s)<=n["w"]-36 for s in n["fields"]),(p.name,key,"field too wide")
            assert font(13).getlength(n["note"])<=n["w"]-36,(p.name,key,"note too wide")
        nodes=list(p.nodes.values())
        for i,a in enumerate(nodes):
            for b in nodes[i+1:]:assert not intersects(rect(a),rect(b)),(p.name,a["key"],b["key"],"overlap")
        for e in p.edges:
            assert e["source"] in p.nodes and e["target"] in p.nodes
            for a,b in zip(e["points"],e["points"][1:]):
                assert a[0]==b[0] or a[1]==b[1],(p.name,e["label"],"non-orthogonal")
                assert clear_segment(a,b,[rect(n) for n in p.nodes.values()]),(p.name,e["label"],"line through table")
        for box in p.labels:assert box[0]>=20 and box[2]<=p.w-20,(p.name,"label outside canvas")
    tree=ET.parse(BASE/"kku-space-er.drawio")
    assert len(tree.findall("diagram"))==5
    for diagram in tree.findall("diagram"):
        cells=diagram.findall("./mxGraphModel/root/mxCell")
        ids=[c.attrib["id"] for c in cells];assert len(ids)==len(set(ids))
        for c in cells:
            if c.get("edge")=="1":assert c.get("source") in ids and c.get("target") in ids
    for p in pages:
        with Image.open(BASE/(p.slug+".png")) as im:assert im.size==(2*p.w,2*p.h)
        ET.parse(BASE/(p.slug+".svg"))
    print(json.dumps({"pages":len(pages),"postgres_tables":len(physical_names),"postgres_columns":51,
      "postgres_fks":4,"oracle_tables":len(om["tables"]),"oracle_fks":len(om["fks"]),
      "validation":"XML, endpoints, full physical coverage, image sizes, text fit, card/line overlap passed"},indent=2))

if __name__=="__main__":
    om=oracle_metadata()
    (BASE/"oracle-schema-metadata.json").write_text(json.dumps(om,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    PAGES=[physical(),business(),auth(),*oracle_pages(om)]
    for p in PAGES:place_labels(p)
    drawio(PAGES)
    for p in PAGES:draw_page(p)
    catalogue(om)
    verify(PAGES,om)
    with zipfile.ZipFile(BASE/"kku-space-diagrams.zip","w",zipfile.ZIP_DEFLATED) as z:
        for path in sorted(BASE.iterdir()):
            if path.suffix in (".png",".svg",".drawio",".md",".json",".py"):z.write(path,path.name)
