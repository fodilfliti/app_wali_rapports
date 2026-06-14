const { BorderStyle } = require("docx");
const { pdfTextOpts } = require("./exportFonts");

const LABELS = {
  ar: {
    sectionTitle: "رد الوالي",
    decision: "القرار",
    note: "الملاحظات",
    decision_accepted: "مقبول",
    decision_viewed: "مطالعة دون تعليق",
    decision_changes_requested: "طلب تعديل",
    followUp_none: "قبول فقط",
    followUp_pending: "قبول — إجراء لاحق مطلوب",
    followUp_completed: "قبول — تم التنفيذ",
  },
  fr: {
    sectionTitle: "Réponse du wali",
    decision: "Décision",
    note: "Observations",
    decision_accepted: "Accepté",
    decision_viewed: "Lu sans commentaire",
    decision_changes_requested: "Modifications demandées",
    followUp_none: "Acceptation simple",
    followUp_pending: "Accepté — action à faire",
    followUp_completed: "Accepté — traité",
  },
};

const MANUAL_NOTE_LINES = 2;
const BOX_BORDER_RADIUS_PT = 8;
const BOX_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const LINE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };

function labelsFor(locale) {
  return LABELS[locale === "fr" ? "fr" : "ar"];
}

function waliDecisionExportLabel(decision, followUpStatus, locale) {
  const L = labelsFor(locale);
  if (decision === "accepted") {
    if (followUpStatus === "pending") return L.followUp_pending;
    if (followUpStatus === "completed") return L.followUp_completed;
    return L.followUp_none;
  }
  if (decision === "viewed") return L.decision_viewed;
  return L.decision_changes_requested;
}

function waliResponseNoteText(bodyText) {
  const text = String(bodyText || "").trim();
  if (!text || text === "—") return "";
  return text;
}

function getLatestWaliResponse(waliResponses) {
  if (!waliResponses?.length) return null;
  return waliResponses[0];
}

function drawWaliResponseSectionPdf(doc, waliResponse, locale, fontName, boldFontName, opts = {}) {
  const L = labelsFor(locale);
  const margin = opts.margin ?? 40;
  const ensureSpace = opts.ensureSpace;
  const textAlign = locale === "ar" ? "right" : "left";
  const pageWidth = doc.page.width - 2 * margin;
  const lineHeight = 22;
  const boxPadding = 12;
  const note = waliResponse ? waliResponseNoteText(waliResponse.body_text) : "";
  let headerHeight = 20;
  if (waliResponse) headerHeight += 16;
  if (note) headerHeight += 16;
  const boxInnerHeight =
    headerHeight + MANUAL_NOTE_LINES * lineHeight + boxPadding * 2 + 8;

  ensureSpace(doc, boxInnerHeight + 48, fontName);
  doc.moveDown(1.4);

  const boxTop = doc.y;
  doc
    .lineWidth(1)
    .strokeColor("#0f172a")
    .roundedRect(margin, boxTop, pageWidth, boxInnerHeight, BOX_BORDER_RADIUS_PT)
    .stroke();

  let contentY = boxTop + boxPadding;
  doc
    .font(boldFontName || fontName)
    .fontSize(12)
    .fillColor("#0f172a")
    .text(
      L.sectionTitle,
      margin + boxPadding,
      contentY,
      pdfTextOpts(locale, { width: pageWidth - boxPadding * 2, align: textAlign }),
    );
  contentY += 18;

  if (waliResponse) {
    doc.font(fontName).fontSize(10);
    doc.text(
      `${L.decision}: ${waliDecisionExportLabel(waliResponse.decision, waliResponse.follow_up_status, locale)}`,
      margin + boxPadding,
      contentY,
      pdfTextOpts(locale, { width: pageWidth - boxPadding * 2, align: textAlign }),
    );
    contentY += 15;

    if (note) {
      doc.text(
        `${L.note}: ${note}`,
        margin + boxPadding,
        contentY,
        pdfTextOpts(locale, { width: pageWidth - boxPadding * 2, align: textAlign }),
      );
      contentY += 15;
    }
  }

  doc.strokeColor("#CBD5E1").lineWidth(0.5);
  const firstLineY = contentY + 10;
  for (let i = 1; i <= MANUAL_NOTE_LINES; i += 1) {
    const y = firstLineY + i * lineHeight;
    doc
      .moveTo(margin + boxPadding, y)
      .lineTo(margin + pageWidth - boxPadding, y)
      .stroke();
  }

  doc.y = boxTop + boxInnerHeight + 14;
  doc.x = margin;
  doc.fillColor("#0f172a");
  doc.strokeColor("#0f172a");
}

function waliResponseDocxBlocks(waliResponse, locale, helpers) {
  const {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    spacingPara,
  } = helpers;

  const L = labelsFor(locale);
  const rtl = locale === "ar";
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const innerChildren = [
    new Paragraph({
      bidirectional: rtl,
      alignment: align,
      spacing: { before: 80, after: 100 },
      children: [new TextRun({ text: L.sectionTitle, bold: true, size: 24 })],
    }),
  ];

  if (waliResponse) {
    const decisionLine = `${L.decision}: ${waliDecisionExportLabel(
      waliResponse.decision,
      waliResponse.follow_up_status,
      locale,
    )}`;
    innerChildren.push(
      new Paragraph({
        bidirectional: rtl,
        alignment: align,
        spacing: { after: 80 },
        children: [new TextRun({ text: decisionLine, size: 22 })],
      }),
    );

    const note = waliResponseNoteText(waliResponse.body_text);
    if (note) {
      innerChildren.push(
        new Paragraph({
          bidirectional: rtl,
          alignment: align,
          spacing: { after: 120 },
          children: [new TextRun({ text: `${L.note}: ${note}`, size: 22 })],
        }),
      );
    }
  }

  for (let i = 0; i < MANUAL_NOTE_LINES; i += 1) {
    innerChildren.push(
      new Paragraph({
        bidirectional: rtl,
        alignment: align,
        spacing: { before: 280, after: 0 },
        border: { bottom: LINE_BORDER },
        children: [new TextRun({ text: " ", size: 24 })],
      }),
    );
  }

  innerChildren.push(spacingPara(locale, { after: 120 }));

  return [
    spacingPara(locale, { before: 640, after: 200 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: {
                top: 160,
                bottom: 160,
                left: 180,
                right: 180,
              },
              borders: {
                top: BOX_BORDER,
                bottom: BOX_BORDER,
                left: BOX_BORDER,
                right: BOX_BORDER,
              },
              children: innerChildren,
            }),
          ],
        }),
      ],
    }),
  ];
}

module.exports = {
  MANUAL_NOTE_LINES,
  BOX_BORDER_RADIUS_PT,
  getLatestWaliResponse,
  drawWaliResponseSectionPdf,
  waliResponseDocxBlocks,
  waliDecisionExportLabel,
  waliResponseNoteText,
};
