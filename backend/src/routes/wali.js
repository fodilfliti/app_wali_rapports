const express = require("express");
const {
  requireAuth,
  attachUser,
  requireRole,
  checkBlocked,
} = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { validateBody } = require("../middleware/validateBody");
const { waliRespondSchema, rapportCommentSchema } = require("../validation/schemas/adminCrud");
const { singleUpload, optionalSingleUpload, optionalMultiUpload } = require("../middleware/upload");
const {
  saveUploadedFile,
  multerFileInput,
  cleanupTempFile,
} = require("../services/uploadService");
const rapportService = require("../modules/rapports/rapportService");
const navigationService = require("../modules/rapports/navigationService");
const calendarEventService = require("../modules/rapports/calendarEventService");
const rapportViewService = require("../modules/rapports/rapportViewService");
const broadcastService = require("../modules/rapports/broadcastService");
const hubCountsService = require("../modules/rapports/hubCountsService");
const commentService = require("../modules/rapports/commentService");
const guideVideoService = require("../modules/guideVideos/guideVideoService");
const { generateRapportPdf } = require("../services/rapportPdfService");
const { generateRapportDocx } = require("../services/rapportDocxService");
const { generateRapportExcel } = require("../services/rapportExcelService");
const {
  contentDispositionAttachment,
} = require("../services/rapportExportFilename");

const waliRouter = express.Router();
waliRouter.use(
  requireAuth,
  attachUser,
  checkBlocked,
  requireRole(["WALI", "ADMIN"]),
);

waliRouter.get(
  "/office-users",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({
        officeUsers: await navigationService.listOfficeUsersForWali(),
      });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/hub-counts",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await hubCountsService.getWaliHubCounts(req.user));
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/office-users/:userId/services",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(
        await navigationService.getServiceTreeForUser(
          req.params.userId,
          "OFFICE_USER",
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/office-users/:userId/services/:serviceId/content",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(
        await workspaceService.getServiceContentHub(
          req.params.serviceId,
          req.user,
          {
            waliForOfficeUserId: req.params.userId,
          },
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

const workspaceService = require("../modules/rapports/workspaceService");

waliRouter.get(
  "/rapports/:id/view",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const versionId = req.query.versionId
        ? req.query.versionId
        : null;
      res.json(
        await workspaceService.getRapportView(
          req.params.id,
          showHidden,
          req.user,
          versionId,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(
        await rapportService.listRapports(req.query, {
          inboxOnly: true,
          enrichForWaliUserId: req.user?.id,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/versions",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const versions = await rapportService.listRapportVersions(req.params.id);
      res.json({ versions });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/versions/:versionId",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const version = await rapportService.getRapportVersion(
        req.params.id,
        req.params.versionId,
      );
      res.json({ version });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      await rapportService.markUnderReview(req.params.id, req.user);
      await rapportViewService.recordView(req.params.id, req.user);
      const rapport = await rapportService.getRapportDetail(req.params.id);
      const views = await rapportViewService.listViewsForRapport(req.params.id);
      await rapportService.markRapportNotificationsRead(req.params.id, req.user.id);
      res.json({ rapport, views });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.post(
  "/rapports/:id/respond",
  requirePermission("rapports.inbox.respond", "manage"),
  validateBody(waliRespondSchema),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const rapport = await rapportService.waliRespond(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/calendar",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await calendarEventService.listForWaliCalendar(req.query));
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/views",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({
        views: await rapportViewService.listViewsForRapport(req.params.id),
      });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/export.pdf",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const locale = req.query.locale === "fr" ? "fr" : "ar";
      const versionId = req.query.versionId || null;
      const { buffer, filename } = await generateRapportPdf(req.params.id, {
        locale,
        showHidden,
        versionId: versionId || null,
        actor: req.user,
        req,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        contentDispositionAttachment(filename),
      );
      res.send(buffer);
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/export.xlsx",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const locale = req.query.locale === "fr" ? "fr" : "ar";
      const rowFilter = req.query.rowFilter;
      const versionId = req.query.versionId || null;
      const { buffer, filename } = await generateRapportExcel(req.params.id, {
        locale,
        showHidden,
        rowFilter,
        versionId: versionId || null,
        actor: req.user,
        req,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        contentDispositionAttachment(filename),
      );
      res.send(buffer);
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/export.docx",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToWali(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const locale = req.query.locale === "fr" ? "fr" : "ar";
      const versionId = req.query.versionId || null;
      const { buffer, filename } = await generateRapportDocx(req.params.id, {
        locale,
        showHidden,
        versionId: versionId || null,
        actor: req.user,
        req,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        contentDispositionAttachment(filename),
      );
      res.send(buffer);
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.get(
  "/broadcasts",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({ broadcasts: await broadcastService.listForWali() });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/broadcasts/:id",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({
        broadcast: await broadcastService.getBroadcastDetail(
          req.params.id,
          req.user,
        ),
      });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.post(
  "/uploads",
  requirePermission("rapports.inbox.respond", "manage"),
  singleUpload("file"),
  async (req, res, next) => {
    try {
      const input = multerFileInput(req.file);
      if (!input?.sourcePath && !input?.buffer) {
        return res.status(400).json({ error: "File required" });
      }
      const file = await saveUploadedFile({
        ...input,
        rapportId: null,
        actor: req.user,
        req,
        startedAt: req.uploadStartedAt,
      });
      res.status(201).json({ file });
    } catch (e) {
      const input = multerFileInput(req.file);
      if (input?.sourcePath) await cleanupTempFile(input.sourcePath);
      if (e.status === 413) return res.status(413).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.post(
  "/broadcasts",
  requirePermission("rapports.inbox.respond", "manage"),
  optionalSingleUpload("file"),
  async (req, res, next) => {
    try {
      let body = {};
      try {
        body = req.body.payload ? JSON.parse(req.body.payload) : req.body;
      } catch {
        body = req.body;
      }
      const broadcast = await broadcastService.createBroadcast(
        {
          fileInput: multerFileInput(req.file),
          body,
        },
        req.user,
        req,
      );
      res.status(201).json({ broadcast });
    } catch (e) {
      const input = multerFileInput(req.file);
      if (input?.sourcePath) await cleanupTempFile(input.sourcePath);
      if (e.status === 413) return res.status(413).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.post(
  "/broadcasts/:id/comments",
  requirePermission("rapports.inbox.respond", "manage"),
  async (req, res, next) => {
    try {
      const broadcast = await broadcastService.addComment(
        req.params.id,
        req.body?.body_text,
        req.user,
      );
      res.json({ broadcast });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.post(
  "/broadcasts/:id/remind",
  requirePermission("rapports.inbox.respond", "manage"),
  async (req, res, next) => {
    try {
      res.json(
        await broadcastService.notifyUnreadRecipients(req.params.id, req.user),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

waliRouter.get(
  "/office-users-for-share",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      const users = await broadcastService.listOfficeUsers();
      res.json({ users });
    } catch (e) {
      next(e);
    }
  },
);

const instructionService = require("../modules/rapports/instructionService");
const { multiUpload } = require("../middleware/upload");

waliRouter.get(
  "/instructions",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await instructionService.listForWali(req.query));
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.get(
  "/instructions/:id",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({
        instruction: await instructionService.getInstruction(req.params.id, { asWali: true }),
      });
    } catch (e) {
      next(e);
    }
  },
);

waliRouter.delete(
  "/instructions/:id",
  requirePermission("rapports.inbox.respond", "manage"),
  async (req, res, next) => {
    try {
      res.json(await instructionService.deleteInstruction(req.params.id, req.user, req));
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

waliRouter.post(
  "/instructions",
  requirePermission("rapports.inbox.respond", "manage"),
  optionalMultiUpload("files", 10),
  async (req, res, next) => {
    try {
      let body = {};
      try {
        body = req.body.payload ? JSON.parse(req.body.payload) : req.body;
      } catch {
        body = req.body;
      }
      const instruction = await instructionService.createInstruction(
        { files: req.files || [], body },
        req.user,
        req,
      );
      res.status(201).json({ instruction });
    } catch (e) {
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.get(
  "/rapports/:id/comments",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(
        await commentService.listComments(req.params.id, req.user, req.query, {
          asWali: true,
        }),
      );
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.post(
  "/rapports/:id/comments",
  requirePermission("rapports.inbox.respond", "manage"),
  validateBody(rapportCommentSchema),
  async (req, res, next) => {
    try {
      const comment = await commentService.createComment(
        req.params.id,
        req.validatedBody.body_text,
        req.user,
        req,
        { asWali: true },
      );
      res.status(201).json({ comment });
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

waliRouter.get("/guide-videos", async (req, res, next) => {
  try {
    res.json(await guideVideoService.listGuideVideos(req.query, req.user.role));
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    if (e.status === 403) return res.status(403).json({ error: e.message });
    next(e);
  }
});

module.exports = { waliRouter };
