import json
import re
import zipfile
import xml.etree.ElementTree as ET

SOURCE = r"C:\Users\lenovo\Downloads\Expesne Tracker sheet.xlsx"


def local(tag):
    return tag.rsplit("}", 1)[-1]


with zipfile.ZipFile(SOURCE) as z:
    wb_root = ET.fromstring(z.read("xl/workbook.xml"))
    rel_root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rels = {r.attrib["Id"]: r.attrib["Target"] for r in rel_root}
    sheets = []
    for node in wb_root.iter():
        if local(node.tag) == "sheet":
            rid = next(v for k, v in node.attrib.items() if k.endswith("}id"))
            target = rels[rid].lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            sheets.append((node.attrib["name"], target))

    result = {"sheets": {}, "charts": {}}
    for sheet_name, target in sheets:
        root = ET.fromstring(z.read(target))
        vals = []
        for node in root.iter():
            if local(node.tag) != "dataValidation":
                continue
            entry = dict(node.attrib)
            for child in node.iter():
                lname = local(child.tag)
                if lname in {"formula1", "formula2"}:
                    text = "".join(child.itertext()).strip()
                    if text:
                        entry[lname] = text
            vals.append(entry)
        protected = []
        for node in root.iter():
            if local(node.tag) == "sheetProtection":
                protected.append(dict(node.attrib))
        result["sheets"][sheet_name] = {"target": target, "data_validations": vals, "sheet_protection": protected}

    for name in z.namelist():
        if not name.startswith("xl/charts/chart") or not name.endswith(".xml"):
            continue
        root = ET.fromstring(z.read(name))
        chart_types = []
        refs = []
        titles = []
        for node in root.iter():
            lname = local(node.tag)
            if lname.endswith("Chart") and lname not in {"chart", "chartSpace"}:
                chart_types.append(lname)
            if lname == "f" and node.text:
                refs.append(node.text)
            if lname == "t" and node.text:
                titles.append(node.text)
        result["charts"][name] = {"types": sorted(set(chart_types)), "refs": refs, "text": titles}

print(json.dumps(result, indent=2, ensure_ascii=False))
