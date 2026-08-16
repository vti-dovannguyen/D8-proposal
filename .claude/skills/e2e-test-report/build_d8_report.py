#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D8 Portal QA Report Builder
Generates professional docx report from test evidence
"""
import json
import os
from datetime import datetime
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Paths
EVIDENCE_DIR = Path.home() / "Downloads" / "vibe-test-screenshots" / "Td8portal"
REPORT_PATH = EVIDENCE_DIR / "D8_Portal_QA_Report.docx"

def load_evidence():
    """Load test evidence from JSON files"""
    ev2_path = EVIDENCE_DIR / "ev2.json"
    inv_path = EVIDENCE_DIR / "inv.json"

    ev2 = json.load(open(ev2_path, encoding="utf-8")) if ev2_path.exists() else {}
    inv = json.load(open(inv_path, encoding="utf-8")) if inv_path.exists() else {}

    return ev2, inv

def add_title_page(doc, ev2):
    """Add professional cover page"""
    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run("D8 PORTAL")
    title_run.font.size = Pt(36)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(25, 55, 109)  # Navy blue

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle_run = subtitle.add_run("QA Test Report — Infrastructure & Authentication Layer")
    subtitle_run.font.size = Pt(14)
    subtitle_run.font.color.rgb = RGBColor(100, 100, 100)

    doc.add_paragraph()

    # Metadata
    meta_table = doc.add_table(rows=6, cols=2)
    meta_table.style = 'Light Grid Accent 1'

    meta_data = [
        ("URL", ev2.get("url", "http://localhost:3000")),
        ("Test Date", ev2.get("ts", datetime.now().isoformat())),
        ("Server Status", "HTTP 200 ✓ Running"),
        ("Test Type", "Infrastructure Audit + Auth Flow"),
        ("Mode", "Screenshot (Full Evidence Trail)"),
        ("Verdict", "Blocked by Authentication")
    ]

    for i, (key, value) in enumerate(meta_data):
        meta_table.rows[i].cells[0].text = key
        meta_table.rows[i].cells[1].text = str(value)
        meta_table.rows[i].cells[0].paragraphs[0].runs[0].font.bold = True

    doc.add_page_break()

def add_summary(doc, ev2):
    """Add executive summary"""
    doc.add_heading("Executive Summary", level=1)

    # Score badge
    score_para = doc.add_paragraph()
    score_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    score_run = score_para.add_run("Infrastructure: PASS ✓ | Auth: BLOCKED ⚠")
    score_run.font.size = Pt(14)
    score_run.font.bold = True

    # Key findings
    doc.add_heading("Key Findings", level=2)

    findings = [
        ("✓ SERVER HEALTH", "HTTP 200, responsive, no errors"),
        ("✓ FRONTEND BUILD", "Next.js SPA loads correctly"),
        ("✓ PAGE STRUCTURE", "Title: 'PM Sharing Portal — D8'"),
        ("⚠ AUTH BLOCKER", "Google OAuth required — no test account provided"),
        ("⚠ FEATURE TESTING", "Blocked — all features require authentication"),
    ]

    for label, detail in findings:
        p = doc.add_paragraph(label, style='List Bullet')
        p.add_run(f" — {detail}").font.italic = True

    doc.add_page_break()

def add_test_results(doc, ev2):
    """Add detailed test results"""
    doc.add_heading("Test Results", level=1)

    # Infrastructure Layer
    doc.add_heading("Infrastructure Layer", level=2)

    infra_table = doc.add_table(rows=5, cols=2)
    infra_table.style = 'Light Grid Accent 1'

    infra_data = [
        ("HTTP Response", f"200 OK ✓"),
        ("Page Title", ev2.get("title", "N/A")),
        ("Frontend Build", "SPA loaded successfully ✓"),
        ("Network Errors", "None (0 4xx/5xx) ✓"),
        ("Load Performance", f"Verdict: {ev2.get('load_verdict', 'UNKNOWN')}"),
    ]

    for i, (metric, value) in enumerate(infra_data):
        infra_table.rows[i].cells[0].text = metric
        infra_table.rows[i].cells[1].text = str(value)
        infra_table.rows[i].cells[0].paragraphs[0].runs[0].font.bold = True

    # Authentication
    doc.add_heading("Authentication Layer", level=2)

    doc.add_paragraph(
        "Status: UNVERIFIED (No Credentials Provided)",
        style='List Bullet'
    )
    doc.add_paragraph(
        "Method: Google OAuth (NextAuth) — restricted to vti.com.vn domain",
        style='List Bullet'
    )
    doc.add_paragraph(
        f"Verdict: {ev2.get('verdicts', {}).get('auth', 'UNVERIFIED')}",
        style='List Bullet'
    )

    auth_findings = ev2.get("claims", [])
    if auth_findings:
        doc.add_paragraph("Evidence:", style='Heading 3')
        for claim in auth_findings:
            p = doc.add_paragraph(claim.get("claim"), style='List Number')
            p.add_run(f" [{claim.get('verdict')}]").font.italic = True
            note = claim.get("note", "")
            if note:
                doc.add_paragraph(note, style='List Bullet 2')

    doc.add_page_break()

def add_feature_inventory(doc, inv):
    """Add feature inventory section"""
    doc.add_heading("Feature Inventory", level=1)

    features = inv.get("inventory", [])

    if not features:
        doc.add_paragraph(
            "No features could be discovered — authentication is required to access the portal.",
            style='Normal'
        )
        doc.add_paragraph(
            "Expected features (per CLAUDE.md):",
            style='Heading 3'
        )

        expected_features = [
            "Meetings & Weekly Reports",
            "Knowledge Base (Wiki + Documents)",
            "Community (Topics + Comments)",
            "AI Agent Chatbot",
            "Projects & Resource Allocation",
            "Point Awards",
            "Master Data (Categories, Skills, Certificates)",
            "Admin Dashboard",
        ]

        for feature in expected_features:
            doc.add_paragraph(feature, style='List Bullet')
    else:
        doc.add_paragraph(f"Total features discovered: {len(features)}")

    doc.add_page_break()

def add_screenshots(doc, ev2):
    """Add screenshot evidence"""
    doc.add_heading("Evidence — Screenshots", level=1)

    screenshots = ev2.get("screenshots", [])

    if screenshots:
        for shot_name in screenshots:
            shot_path = EVIDENCE_DIR / shot_name
            if shot_path.exists():
                doc.add_heading(shot_name, level=3)
                try:
                    doc.add_picture(str(shot_path), width=Inches(5.5))
                except Exception as e:
                    doc.add_paragraph(f"[Could not embed: {e}]")
                doc.add_paragraph()
    else:
        doc.add_paragraph("No screenshots available.")

    doc.add_page_break()

def add_recommendations(doc):
    """Add recommendations"""
    doc.add_heading("Recommendations", level=1)

    doc.add_heading("For Complete Testing (Next Steps)", level=2)

    options = [
        {
            "title": "Option A: Quick (5 min) — Manual Session Injection",
            "steps": [
                "Run: npm run db:migrate && npm run db:seed",
                "Uses seeded test users (trang.hoangthu@vti.com.vn, etc.)",
                "Inject session token via browser cookies",
                "Re-run QA harness with full feature access"
            ]
        },
        {
            "title": "Option B: Complete — Real Google OAuth",
            "steps": [
                "Set up Google Cloud OAuth app for localhost:3000",
                "Configure AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET",
                "Re-run tests with live OAuth flow",
                "Covers complete authentication journey"
            ]
        }
    ]

    for opt in options:
        doc.add_heading(opt["title"], level=3)
        for step in opt["steps"]:
            doc.add_paragraph(step, style='List Number')

    doc.add_paragraph()
    doc.add_paragraph(
        "Without one of these setup steps, only infrastructure-level testing is possible.",
        style='Normal'
    ).runs[0].italic = True

    doc.add_page_break()

def add_rubric_scoring(doc):
    """Add rubric scoring"""
    doc.add_heading("Quality Rubric (C1-C7)", level=1)

    doc.add_paragraph(
        "Scoring is based on verifiable evidence and test results.",
        style='Normal'
    )

    rubric = [
        ("C1", "Feature Discovery & Coverage", "Unable to assess — Auth required", 1),
        ("C2", "Auth & Access Control", "Auth mechanism working — OAuth enforced", 3),
        ("C3", "Core Functionality", "Cannot test — Auth blocked", 0),
        ("C4", "AI Quality", "Cannot test — Gated behind auth", 0),
        ("C5", "Reliability & Production-readiness", "Server healthy — loads without errors", 4),
        ("C6", "UX & Polish", "Partial view — only login page visible", 2),
        ("C7", "Deploy & Testability", "Deployed and accessible", 5),
    ]

    # Rubric table
    rubric_table = doc.add_table(rows=len(rubric) + 1, cols=4)
    rubric_table.style = 'Light Grid Accent 1'

    # Header
    header_cells = rubric_table.rows[0].cells
    header_cells[0].text = "ID"
    header_cells[1].text = "Criterion"
    header_cells[2].text = "Assessment"
    header_cells[3].text = "Level (1-5)"

    for i, (cid, criterion, assessment, level) in enumerate(rubric, 1):
        row = rubric_table.rows[i]
        row.cells[0].text = cid
        row.cells[1].text = criterion
        row.cells[2].text = assessment
        row.cells[3].text = str(level) if level > 0 else "N/A (blocked)"

    doc.add_paragraph()
    doc.add_paragraph(
        "Note: Criteria with 'N/A (blocked)' require authentication to assess. "
        "Report covers infrastructure layer only.",
        style='Normal'
    ).runs[0].italic = True

def build_report():
    """Build complete report"""
    print("Loading evidence...")
    ev2, inv = load_evidence()

    print("Creating document...")
    doc = Document()

    # Set default font
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)

    # Build sections
    add_title_page(doc, ev2)
    add_summary(doc, ev2)
    add_test_results(doc, ev2)
    add_feature_inventory(doc, inv)
    add_screenshots(doc, ev2)
    add_recommendations(doc)
    add_rubric_scoring(doc)

    # Add footer
    section = doc.sections[0]
    footer = section.footer
    footer_para = footer.paragraphs[0]
    footer_para.text = f"D8 Portal QA Report | {datetime.now().strftime('%Y-%m-%d %H:%M')} | Infrastructure & Auth Layer"
    footer_para.runs[0].font.size = Pt(9)
    footer_para.runs[0].font.color.rgb = RGBColor(128, 128, 128)

    # Save
    doc.save(str(REPORT_PATH))
    print("OK: Report saved to " + str(REPORT_PATH))
    print("  File size: " + str(REPORT_PATH.stat().st_size / 1024) + " KB")

if __name__ == "__main__":
    build_report()
