"""Extract the public room catalog without saving cookies or personal bookings."""
import argparse
import base64
from datetime import datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen
from zoneinfo import ZoneInfo


class Calendar(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rooms = []
        self.parts = None
        self.title = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "th" and "rv-col-head" in attrs.get("class", "").split():
            self.parts = []
            self.title = attrs.get("title", "")

    def handle_data(self, data):
        if self.parts is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "th" and self.parts is not None:
            text = " ".join(" ".join(self.parts).split())
            match = re.fullmatch(r"(.+?)\s*\((\d+)\)", text)
            if not match:
                raise ValueError(f"Unrecognized room header: {text}")
            details = [x.strip() for x in self.title.split("·") if x.strip()]
            if not details:
                raise ValueError(f"Missing room type: {text}")
            self.rooms.append(dict(name=match[1], capacity=int(match[2]),
                                   type=details[0], amenities=details[1:]))
            self.parts = None


def extract(html, building_id, source):
    parser = Calendar()
    parser.feed(html)
    if not parser.rooms:
        raise ValueError("Calendar contains no room headers")
    result = []
    for room in parser.rooms:
        name = room["name"]
        numeric = re.match(r"([69]\d{3}[A-Z]?(?:-\d+)?)\b", name)
        explicit = re.search(r"ชั้น\s*(\d+)", name)
        if numeric:
            code = numeric[1]
            floor = int(code[1])
            evidence = "inferred-from-room-code"
            assert code[0] == ("9" if building_id == 1 else "6"), name
        elif explicit:
            floor = int(explicit[1])
            code = "SC09-AUDIO-LAB" if building_id == 1 else "SC06-MEETING-F3"
            evidence = "explicit-in-room-name"
        elif name == "ห้องประชุมวิทยวิภาส 3" and building_id == 1:
            code, floor, evidence = "SC09-MEETING-3", 3, "official-admissions-document"
        else:
            raise ValueError(f"Room needs a verified floor/code mapping: {name}")
        assert floor > 0 and room["capacity"] > 0
        result.append(dict(code=code, **room, externalBuildingId=building_id,
                           floor=floor, floorEvidence=evidence, source=source,
                           **({"floorSource": "https://app.gs.kku.ac.th/images/img/admissions/2023-2/3801236.pdf"}
                              if evidence == "official-admissions-document" else {})))
    assert len({r["code"] for r in result}) == len(result), "Duplicate room codes"
    return result


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--har", type=Path, help="Use saved HAR responses only")
    args.add_argument("--html", action="append", default=[], metavar="BUILDING_ID=PATH")
    args.add_argument("--date", default=datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat())
    args.add_argument("--output", type=Path, default=Path("docs/data/computing-rooms-2026-10-15.json"))
    opts = args.parse_args()
    datetime.strptime(opts.date, "%Y-%m-%d")
    pages = {}
    if opts.har:
        for entry in json.loads(opts.har.read_text())["log"]["entries"]:
            url = urlsplit(entry["request"]["url"])
            query = parse_qs(url.query)
            bid = query.get("buildingId", [None])[0]
            if url.hostname != "me.computing.kku.ac.th" or url.path != "/calendar" or bid not in ("1", "2"):
                continue
            content = entry["response"]["content"]
            text = content.get("text", "")
            if content.get("encoding") == "base64":
                text = base64.b64decode(text).decode("utf-8")
            if entry["response"]["status"] == 200 and text:
                pages[int(bid)] = (text, entry["request"]["url"])
    for item in opts.html:
        bid, path = item.split("=", 1)
        bid = int(bid)
        if bid not in (1, 2):
            raise ValueError("Unknown building ID")
        pages[bid] = (Path(path).read_text(), f"https://me.computing.kku.ac.th/calendar?view=day&date={opts.date}&buildingId={bid}")
    if not opts.har and not opts.html:
        for bid in (1, 2):
            url = f"https://me.computing.kku.ac.th/calendar?view=day&date={opts.date}&buildingId={bid}"
            with urlopen(url, timeout=30) as response:
                pages[bid] = (response.read().decode("utf-8"), url)
    if not pages:
        raise ValueError("No building-specific calendar responses found")
    rooms, buildings = [], []
    for bid, (html, source) in sorted(pages.items()):
        extracted = extract(html, bid, source)
        rooms.extend(extracted)
        buildings.append(dict(externalId=bid,
                              name=("อาคารวิทยวิภาส (SC.09)" if bid == 1 else "อาคาร SC.06") + " · วิทยาลัยการคอมพิวเตอร์",
                              floors=max(r["floor"] for r in extracted)))
    assert len({r["code"] for r in rooms}) == len(rooms)
    catalog = dict(checkedAt=opts.date, source="https://me.computing.kku.ac.th/calendar",
                   notes="ความจุ ประเภท และอุปกรณ์มาจากหัวตาราง ชั้นของห้องรหัสตัวเลขอนุมานจากหลักที่สองของรหัสและต้องยืนยันหน้างาน จำนวนชั้นอาคารคือชั้นสูงสุดในชุดข้อมูล ไม่ยืนยันจำนวนชั้นจริงทั้งหมด รหัสห้องที่ไม่มีเลขเป็นรหัสภายใน ไม่ได้นำเข้ารายการจองหรือเวลาทำการ",
                   buildings=buildings, rooms=rooms)
    opts.output.parent.mkdir(parents=True, exist_ok=True)
    opts.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(rooms)} rooms across {len(buildings)} buildings to {opts.output}")


if __name__ == "__main__":
    main()
