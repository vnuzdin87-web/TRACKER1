#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка DOCX из docs/SPEC.md.

Используется python-docx. Поддерживается подмножество Markdown,
которое реально встречается в SPEC.md: заголовки, абзацы, списки,
чек-листы, таблицы, код-блоки, цитаты, инлайн-форматирование.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "SPEC.md"
OUT = ROOT / "docs" / "ТЗ — Анонимный трекер оценок партнёра.docx"

ACCENT = RGBColor(0x1F, 0x38, 0x64)
ACCENT2 = RGBColor(0x25, 0x63, 0xEB)
MUTED = RGBColor(0x6B, 0x72, 0x80)
TEXT = RGBColor(0x1F, 0x29, 0x37)
CODE_COLOR = RGBColor(0x9C, 0x27, 0x27)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

CONTENT_WIDTH_CM = 16.5


# ---------------------------------------------------------------------------
# XML helpers
# ---------------------------------------------------------------------------

def _replace_child(parent, tag: str, child):
    existing = parent.find(qn(tag))
    if existing is not None:
        parent.remove(existing)
    parent.append(child)


def set_run_font(run, name: str):
    run.font.name = name
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(attr), name)


def set_run_shading(run, fill: str):
    rPr = run._element.get_or_add_rPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    rPr.append(shd)


def set_no_proof(run):
    rPr = run._element.get_or_add_rPr()
    rPr.append(OxmlElement("w:noProof"))


def set_cell_shading(cell, fill: str):
    tcPr = cell._tc.get_or_add_tcPr()
    _replace_child(tcPr, "w:shd", _shd(fill))


def _shd(fill: str):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    return shd


def set_table_borders(table, color="D1D5DB", sz=4, inside=True):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    for edge in ("insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        if inside:
            el.set(qn("w:val"), "single")
            el.set(qn("w:sz"), str(sz))
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), color)
        else:
            el.set(qn("w:val"), "nil")
        borders.append(el)
    _replace_child(tblPr, "w:tblBorders", borders)


def set_cover_table_borders(table, color="E5E7EB"):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        borders.append(el)
    el = OxmlElement("w:insideH")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), "4")
    el.set(qn("w:space"), "0")
    el.set(qn("w:color"), color)
    borders.append(el)
    _replace_child(tblPr, "w:tblBorders", borders)


def set_table_cell_margins(table, top=40, bottom=40, left=85, right=85):
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    _replace_child(tblPr, "w:tblCellMar", mar)


def set_table_fixed_layout(table, total_cm=CONTENT_WIDTH_CM):
    tblPr = table._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    _replace_child(tblPr, "w:tblLayout", layout)
    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:type"), "pct")
    tblW.set(qn("w:w"), "5000")
    _replace_child(tblPr, "w:tblW", tblW)


def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    trPr.append(el)


def set_cant_split(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    el.set(qn("w:val"), "true")
    trPr.append(el)


def set_par_border(paragraph, edge="bottom", color="D1D5DB", sz=6, space=2):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr")
        pPr.append(pBdr)
    el = OxmlElement(f"w:{edge}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(sz))
    el.set(qn("w:space"), str(space))
    el.set(qn("w:color"), color)
    pBdr.append(el)


def add_style_shading(style, fill: str):
    pPr = style.element.get_or_add_pPr()
    _replace_child(pPr, "w:shd", _shd(fill))


def add_style_border(style, edge: str, color: str, sz: int, space: int):
    pPr = style.element.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr")
        pPr.append(pBdr)
    el = OxmlElement(f"w:{edge}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(sz))
    el.set(qn("w:space"), str(space))
    el.set(qn("w:color"), color)
    pBdr.append(el)


def set_style_font(style, name: str, size=None, bold=None, italic=None, color=None):
    style.font.name = name
    rPr = style.element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(attr), name)
    if size is not None:
        style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if italic is not None:
        style.font.italic = italic
    if color is not None:
        style.font.color.rgb = color


def set_style_lang(style, lang="ru-RU"):
    rPr = style.element.get_or_add_rPr()
    el = OxmlElement("w:lang")
    el.set(qn("w:val"), lang)
    el.set(qn("w:eastAsia"), lang)
    el.set(qn("w:bidi"), "ar-SA")
    rPr.append(el)


def add_field(paragraph, instruction: str, placeholder: str = ""):
    r1 = paragraph.add_run()
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "begin")
    r1._r.append(fld)

    r2 = paragraph.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    r2._r.append(instr)

    r3 = paragraph.add_run()
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "separate")
    r3._r.append(fld)

    r4 = paragraph.add_run(placeholder)

    r5 = paragraph.add_run()
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "end")
    r5._r.append(fld)
    return [r1, r2, r3, r4, r5]


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

def setup_styles(doc: Document):
    styles = doc.styles

    normal = styles["Normal"]
    set_style_font(normal, "Calibri", 10.5, color=TEXT)
    set_style_lang(normal)
    pf = normal.paragraph_format
    pf.line_spacing = 1.15
    pf.space_before = Pt(0)
    pf.space_after = Pt(5)
    pf.widow_control = True

    h1 = styles["Heading 1"]
    set_style_font(h1, "Calibri", 17, bold=True, color=ACCENT)
    set_style_lang(h1)
    pf = h1.paragraph_format
    pf.space_before = Pt(16)
    pf.space_after = Pt(8)
    pf.keep_with_next = True
    pf.line_spacing = 1.05
    add_style_border(h1, "bottom", "D1D5DB", 6, 3)

    h2 = styles["Heading 2"]
    set_style_font(h2, "Calibri", 13, bold=True, color=ACCENT)
    set_style_lang(h2)
    pf = h2.paragraph_format
    pf.space_before = Pt(12)
    pf.space_after = Pt(5)
    pf.keep_with_next = True
    pf.line_spacing = 1.05

    h3 = styles["Heading 3"]
    set_style_font(h3, "Calibri", 11, bold=True, color=RGBColor(0x2F, 0x55, 0x97))
    set_style_lang(h3)
    pf = h3.paragraph_format
    pf.space_before = Pt(10)
    pf.space_after = Pt(4)
    pf.keep_with_next = True
    pf.line_spacing = 1.05

    h4 = styles["Heading 4"]
    set_style_font(h4, "Calibri", 10.5, bold=True, italic=True, color=TEXT)
    set_style_lang(h4)
    pf = h4.paragraph_format
    pf.space_before = Pt(8)
    pf.space_after = Pt(3)
    pf.keep_with_next = True

    code = styles.add_style("Code Block", WD_STYLE_TYPE.PARAGRAPH)
    code.base_style = normal
    set_style_font(code, "Consolas", 8.5, color=RGBColor(0x11, 0x18, 0x27))
    pf = code.paragraph_format
    pf.left_indent = Cm(0.4)
    pf.right_indent = Cm(0.2)
    pf.space_before = Pt(4)
    pf.space_after = Pt(8)
    pf.line_spacing = 1.0
    pf.keep_together = True
    add_style_shading(code, "F6F8FA")
    add_style_border(code, "left", "2563EB", 18, 8)

    quote = styles.add_style("Quote Block", WD_STYLE_TYPE.PARAGRAPH)
    quote.base_style = normal
    set_style_font(quote, "Calibri", 9.5, italic=True, color=RGBColor(0x4B, 0x55, 0x63))
    pf = quote.paragraph_format
    pf.left_indent = Cm(0.6)
    pf.right_indent = Cm(0.3)
    pf.space_before = Pt(4)
    pf.space_after = Pt(8)
    add_style_shading(quote, "F9FAFB")
    add_style_border(quote, "left", "9CA3AF", 18, 8)

    for name, size, bold, before in (
        ("TOC 1", 10.5, True, 6),
        ("TOC 2", 10, False, 2),
        ("TOC 3", 9.5, False, 1),
    ):
        try:
            st = styles[name]
        except KeyError:
            st = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        set_style_font(st, "Calibri", size, bold=bold, color=TEXT)
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(1)
        st.paragraph_format.line_spacing = 1.05


# ---------------------------------------------------------------------------
# Inline markdown
# ---------------------------------------------------------------------------

TOKEN_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))")


def _add_run(paragraph, text, size, color, bold, italic):
    run = paragraph.add_run(text)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    run.bold = bold
    run.italic = italic
    return run


def add_inline(paragraph, text: str, size=10.5, color=TEXT, bold=False, italic=False):
    pos = 0
    for match in TOKEN_RE.finditer(text):
        if match.start() > pos:
            _add_run(paragraph, text[pos:match.start()], size, color, bold, italic)
        token = match.group(0)
        if token.startswith("**"):
            add_inline(paragraph, token[2:-2], size, color, True, italic)
        elif token.startswith("`"):
            run = _add_run(paragraph, token[1:-1], (size - 1.5) if size else 9, CODE_COLOR, bold, italic)
            set_run_font(run, "Consolas")
            set_run_shading(run, "F3F4F6")
            set_no_proof(run)
        elif token.startswith("*"):
            add_inline(paragraph, token[1:-1], size, color, bold, True)
        elif token.startswith("["):
            link = re.match(r"\[([^\]]+)\]\(([^)]+)\)", token)
            if link:
                label, url = link.group(1), link.group(2)
                run = _add_run(paragraph, label, size, ACCENT2, bold, italic)
                run.underline = True
                _add_run(paragraph, f" ({url})", (size - 1) if size else 8.5, MUTED, bold, italic)
        pos = match.end()
    if pos < len(text):
        _add_run(paragraph, text[pos:], size, color, bold, italic)


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------

def clean_heading(text: str) -> str:
    text = re.sub(r"[`*]", "", text)
    return text.strip()


def add_heading(doc: Document, text: str, md_level: int):
    level = min(max(md_level - 1, 1), 4)
    p = doc.add_paragraph(style=f"Heading {level}")
    p.add_run(clean_heading(text))


def add_paragraph(doc: Document, text: str):
    p = doc.add_paragraph()
    add_inline(p, text)


def add_quote(doc: Document, text: str):
    p = doc.add_paragraph(style="Quote Block")
    add_inline(p, text, size=9.5, color=RGBColor(0x4B, 0x55, 0x63), italic=True)


def add_bullet(doc: Document, text: str, level: int):
    style = "List Bullet" if level == 0 else "List Bullet 2"
    try:
        p = doc.add_paragraph(style=style)
    except KeyError:
        p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.12
    add_inline(p, text)


def add_checkbox(doc: Document, text: str, level: int):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.75 + 0.45 * level)
    pf.first_line_indent = Cm(-0.45)
    pf.space_after = Pt(2)
    pf.line_spacing = 1.12
    box = p.add_run("\u2610")
    set_run_font(box, "Segoe UI Symbol")
    box.font.size = Pt(10.5)
    p.add_run("  ")
    add_inline(p, text)


def add_numbered(doc: Document, number: str, text: str, level: int):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.8 + 0.45 * level)
    pf.first_line_indent = Cm(-0.55)
    pf.space_after = Pt(2)
    pf.line_spacing = 1.12
    p.add_run(f"{number}. ")
    add_inline(p, text)


def add_code(doc: Document, lines: list[str]):
    if not lines:
        lines = [""]
    p = doc.add_paragraph(style="Code Block")
    for idx, line in enumerate(lines):
        run = p.add_run(line)
        set_run_font(run, "Consolas")
        set_no_proof(run)
        if idx < len(lines) - 1:
            run.add_break()


def split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    cells = re.split(r"(?<!\\)\|", line)
    return [c.strip().replace("\\|", "|") for c in cells]


def compute_widths(rows: list[list[str]], total_cm: float) -> list[float]:
    ncols = max(len(r) for r in rows)
    maxlen = [6] * ncols
    for row in rows:
        for i, cell in enumerate(row):
            clean = re.sub(r"[`*]", "", cell)
            maxlen[i] = max(maxlen[i], min(len(clean), 60))
    total_weight = sum(maxlen)
    widths = [max(1.7, total_cm * w / total_weight) for w in maxlen]
    scale = total_cm / sum(widths)
    return [w * scale for w in widths]


def add_table(doc: Document, lines: list[str]):
    if not lines:
        return

    rows: list[list[str]] = []
    has_header = False
    for line in lines:
        cells = split_row(line)
        if cells and all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            has_header = True
            continue
        rows.append(cells)
    if not rows:
        return

    ncols = max(len(r) for r in rows)
    for row in rows:
        row += [""] * (ncols - len(row))

    if has_header:
        header, body = rows[0], rows[1:]
    else:
        header, body = None, rows

    table = doc.add_table(rows=1, cols=ncols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    table.autofit = False
    table.allow_autofit = False
    set_table_borders(table)
    set_table_cell_margins(table)

    if header is None:
        table._tbl.remove(table.rows[0]._tr)
    else:
        hdr = table.rows[0]
        set_repeat_header(hdr)
        set_cant_split(hdr)
        for i, txt in enumerate(header):
            cell = hdr.cells[i]
            cell.text = ""
            set_cell_shading(cell, "1F3864")
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            add_inline(p, txt, size=9, color=WHITE, bold=True)

    for r_idx, row in enumerate(body):
        tr = table.add_row()
        set_cant_split(tr)
        for i, txt in enumerate(row):
            cell = tr.cells[i]
            cell.text = ""
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            if r_idx % 2 == 1:
                set_cell_shading(cell, "F8FAFC")
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            add_inline(p, txt, size=9)

    widths = compute_widths(rows, CONTENT_WIDTH_CM)
    set_table_fixed_layout(table)
    for i, width in enumerate(widths):
        table.columns[i].width = Cm(width)
        for cell in table.columns[i].cells:
            cell.width = Cm(width)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(0)
    spacer.paragraph_format.space_after = Pt(2)
    spacer.paragraph_format.line_spacing = 1.0
    spacer.add_run("").font.size = Pt(2)


# ---------------------------------------------------------------------------
# Cover / TOC / header / footer
# ---------------------------------------------------------------------------

RU_MONTHS = (
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)


def ru_date(value: str) -> str:
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", value)
    if not m:
        return value
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{day} {RU_MONTHS[month - 1]} {year} г."


def build_cover(doc: Document, project: str, subtitle: str, meta: dict[str, str]):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(130)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run("ТЕХНИЧЕСКОЕ ЗАДАНИЕ")
    run.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = MUTED
    rPr = run._element.get_or_add_rPr()
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:val"), "50")
    rPr.append(spacing)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(project)
    run.bold = True
    run.font.size = Pt(27)
    run.font.color.rgb = ACCENT

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(18)
    p.paragraph_format.line_spacing = 1.2
    run = p.add_run(subtitle)
    run.font.size = Pt(12.5)
    run.font.color.rgb = MUTED

    line = doc.add_paragraph()
    line.paragraph_format.space_before = Pt(0)
    line.paragraph_format.space_after = Pt(18)
    set_par_border(line, "bottom", "2563EB", 14, 1)
    line.add_run("").font.size = Pt(2)

    rows = [
        ("Версия", meta.get("Версия", "1.0")),
        ("Дата", ru_date(meta.get("Дата", ""))),
        ("Статус", meta.get("Статус", "")),
        ("Источник", meta.get("Источник", "")),
        ("Формат", meta.get("Формат", "")),
    ]
    table = doc.add_table(rows=0, cols=2)
    table.autofit = False
    table.allow_autofit = False
    set_cover_table_borders(table)
    set_table_cell_margins(table, top=70, bottom=70, left=0, right=100)
    for label, value in rows:
        tr = table.add_row()
        left, right = tr.cells
        left.width = Cm(4.0)
        right.width = Cm(12.5)
        for cell in (left, right):
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
        lp = left.paragraphs[0]
        run = lp.add_run(label)
        run.font.size = Pt(9.5)
        run.font.color.rgb = MUTED
        rp = right.paragraphs[0]
        run = rp.add_run(value)
        run.font.size = Pt(10.5)
        run.font.color.rgb = TEXT

    note = doc.add_paragraph()
    note.paragraph_format.space_before = Pt(120)
    note.paragraph_format.space_after = Pt(0)
    note.paragraph_format.line_spacing = 1.2
    run = note.add_run("Учебный проект · 2026")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED

    note2 = doc.add_paragraph()
    note2.paragraph_format.space_before = Pt(2)
    note2.paragraph_format.space_after = Pt(0)
    run = note2.add_run("По мотивам заказа FL.ru №5514303")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED

    doc.add_page_break()


def build_toc(doc: Document):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(12)
    run = p.add_run("Содержание")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = ACCENT
    set_par_border(p, "bottom", "D1D5DB", 6, 3)

    toc_p = doc.add_paragraph()
    toc_p.paragraph_format.space_before = Pt(4)
    toc_p.paragraph_format.space_after = Pt(6)
    runs = add_field(
        toc_p,
        ' TOC \\o "1-3" \\h \\z \\u ',
        "Оглавление будет обновлено при открытии документа.",
    )
    for run in runs:
        run.font.size = Pt(10.5)

    note = doc.add_paragraph()
    note.paragraph_format.space_before = Pt(8)
    run = note.add_run("Если номера страниц не отобразились, щёлкните по оглавлению и нажмите F9.")
    run.font.size = Pt(8.5)
    run.italic = True
    run.font.color.rgb = MUTED

    doc.add_page_break()


def setup_section(doc: Document, project: str, version: str):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.0)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(1.0)
    section.different_first_page_header_footer = True

    header = section.header
    hp = header.paragraphs[0]
    hp.paragraph_format.tab_stops.add_tab_stop(Cm(CONTENT_WIDTH_CM), WD_TAB_ALIGNMENT.RIGHT)
    run = hp.add_run(project)
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    hp.add_run("\t")
    run = hp.add_run(f"ТЗ · версия {version}")
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    set_par_border(hp, "bottom", "D1D5DB", 4, 4)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = fp.add_run("Стр. ")
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    field_runs = add_field(fp, " PAGE ", "1")
    run = fp.add_run(" из ")
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    field_runs += add_field(fp, " NUMPAGES ", "1")
    for run in field_runs:
        run.font.size = Pt(8.5)
        run.font.color.rgb = MUTED


# ---------------------------------------------------------------------------
# Parse and build
# ---------------------------------------------------------------------------

def parse_meta(lines: list[str]) -> dict[str, str]:
    meta = {}
    for line in lines:
        m = re.match(r"^\*\*(.+?):\*\*\s*(.*)$", line.strip())
        if m:
            meta[m.group(1).strip()] = m.group(2).strip()
    return meta


def build(src: Path = SRC, out: Path = OUT):
    text = src.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")

    body_start = next(
        (i for i, line in enumerate(lines) if re.match(r"^##\s+0\.", line)),
        0,
    )
    head = lines[:body_start]

    title = "Техническое задание"
    for line in head:
        if line.startswith("# "):
            title = line[2:].strip()
            break

    project = "Анонимный трекер оценок партнёра"
    for line in head:
        m = re.match(r"^##\s+«(.+)»\s*$", line)
        if m:
            project = m.group(1).strip()
            break

    subtitle = "Веб-приложение для централизованного анонимного сбора оценок и приватной админ-аналитики"
    meta = parse_meta(head)
    version = meta.get("Версия", "2.0")

    doc = Document()
    setup_styles(doc)
    setup_section(doc, project, version)

    core = doc.core_properties
    core.title = f"{title} — {project}"
    core.subject = subtitle
    core.author = "Tracker Project"
    core.last_modified_by = "Tracker Project"
    core.category = "Техническое задание"
    core.comments = "Учебный проект по мотивам заказа FL.ru №5514303"
    core.language = "ru-RU"

    # Автообновление полей (оглавление, номера страниц) при открытии.
    settings = doc.settings.element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)

    build_cover(doc, project, subtitle, meta)
    build_toc(doc)

    table_buf: list[str] = []
    code_buf: list[str] = []
    in_code = False

    def flush_table():
        nonlocal table_buf
        if table_buf:
            add_table(doc, table_buf)
            table_buf = []

    i = body_start
    while i < len(lines):
        line = lines[i]

        if in_code:
            if line.strip().startswith("```"):
                add_code(doc, code_buf)
                code_buf = []
                in_code = False
            else:
                code_buf.append(line)
            i += 1
            continue

        if line.strip().startswith("```"):
            flush_table()
            in_code = True
            code_buf = []
            i += 1
            continue

        if line.startswith("|"):
            table_buf.append(line)
            i += 1
            continue
        flush_table()

        if not line.strip():
            i += 1
            continue

        if line.strip() in ("---", "***", "___"):
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            add_heading(doc, m.group(2), len(m.group(1)))
            i += 1
            continue

        if line.startswith("> "):
            add_quote(doc, line[2:].strip())
            i += 1
            continue

        m = re.match(r"^(\s*)-\s+\[ \]\s+(.*)$", line)
        if m:
            add_checkbox(doc, m.group(2), len(m.group(1)) // 2)
            i += 1
            continue

        m = re.match(r"^(\s*)-\s+(.*)$", line)
        if m:
            add_bullet(doc, m.group(2), len(m.group(1)) // 2)
            i += 1
            continue

        m = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if m:
            add_numbered(doc, m.group(2), m.group(3), len(m.group(1)) // 2)
            i += 1
            continue

        add_paragraph(doc, line.strip())
        i += 1

    if in_code and code_buf:
        add_code(doc, code_buf)

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    return out


if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    result = build(source, target)
    print(f"OK: {result}")
    print(f"size: {result.stat().st_size} bytes")
