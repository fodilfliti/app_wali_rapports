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
const rapportService = require("../modules/rapports/rapportService");
const navigationService = require("../modules/rapports/navigationService");
const calendarEventService = require("../modules/rapports/calendarEventService");
const rapportViewService = require("../modules/rapports/rapportViewService");
const hubCountsService = require("../modules/rapports/hubCountsService");
const instructionService = require("../modules/rapports/instructionService");
const broadcastService = require("../modules/rapports/broadcastService");
const commentService = require("../modules/rapports/commentService");
const guideVideoService = require("../modules/guideVideos/guideVideoService");
const workspaceService = require("../modules/rapports/workspaceService");
const { generateRapportPdf } = require("../services/rapportPdfService");
const { generateRapportDocx } = require("../services/rapportDocxService");
const { generateRapportExcel } = require("../services/rapportExcelService");
const {
  contentDispositionAttachment,
} = require("../services/rapportExportFilename");

const chefRouter = express.Router();
chefRouter.use(
  requireAuth,
  attachUser,
  checkBlocked,
  requireRole(["CHEF_CABINET", "ADMIN"]),
);

chefRouter.get(
  "/hub-counts",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await hubCountsService.getChefHubCounts(req.user));
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get(
  "/office-users",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json({
        officeUsers: await navigationService.listOfficeUsersForChef(),
      });
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get(
  "/office-users/:userId/services",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(
        await navigationService.getServiceTreeForUser(
          req.params.userId,
          "OFFICE_USER",
          { forChef: true },
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get(
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
            forChef: true,
          },
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      const discussionList =
        req.query.unread_discussion === "1" ||
        req.query.unread_discussion === "true" ||
        req.query.has_discussion === "1" ||
        req.query.has_discussion === "true";
      if (discussionList) {
        const result = await rapportService.listRapports(req.query, {
          inboxOnly: false,
          discussionUserId: req.user.id,
          enrichForOfficeUserId: req.user.id,
        });
        return res.json(result);
      }
      const statusGroup = String(req.query.status_group || "")
        .trim()
        .toLowerCase();
      const hasStatusGroup = statusGroup && statusGroup !== "all";
      const hasScopeFilter =
        (req.query.service_id != null && String(req.query.service_id).trim() !== "") ||
        (req.query.rapport_type_id != null &&
          String(req.query.rapport_type_id).trim() !== "");
      // Prefer DB filter for chef primary queue when no status / status_group /
      // service or type scope (hub type pages must keep service + type filters).
      if (!req.query.status && !hasStatusGroup && !hasScopeFilter) {
        const { Op } = require("sequelize");
        const { Rapport } = require("../db");
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
        const where = {
          status: {
            [Op.in]: [
              "pending_chef",
              "submitted",
              "under_review",
              "changes_requested",
              "acknowledged",
            ],
          },
          hidden_at: null,
        };
        if (req.query.search) {
          where.title = {
            [Op.iLike]: `%${String(req.query.search).trim()}%`,
          };
        }
        const sortField =
          String(req.query.sort || "").trim().toLowerCase() === "updated_at"
            ? "updated_at"
            : "created_at";
        const { rows, count } = await Rapport.findAndCountAll({
          where,
          order: [
            [
              Rapport.sequelize.literal(
                `CASE WHEN status = 'pending_chef' THEN 0 ELSE 1 END`,
              ),
              "ASC",
            ],
            [sortField, "DESC"],
          ],
          offset: (page - 1) * pageSize,
          limit: pageSize,
          include: [
            {
              association: "service",
              attributes: ["id", "slug", "name_ar", "name_fr"],
            },
            {
              association: "rapportType",
              attributes: [
                "id",
                "slug",
                "name_ar",
                "name_fr",
                "layout_kind",
                "versioning_mode",
                "content_kind",
              ],
            },
            {
              association: "createdByUser",
              attributes: ["id", "name", "username"],
            },
          ],
        });
        const plain = rows.map((r) => (r.toJSON ? r.toJSON() : r));
        const rapports = await rapportService.enrichOfficeRapportList(
          plain,
          req.user.id,
        );
        return res.json({
          rapports,
          total: count,
          page,
          pageSize,
        });
      }
      const result = await rapportService.listRapports(req.query, {
        inboxOnly: false,
        chefInbox: true,
        enrichForOfficeUserId: req.user.id,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const rapport = await rapportService.getRapportDetail(req.params.id);
      await rapportService.markRapportNotificationsRead(req.params.id, req.user.id);
      res.json({ rapport });
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.post(
  "/rapports/:id/respond",
  requirePermission("rapports.inbox.respond", "manage"),
  validateBody(waliRespondSchema),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const rapport = await rapportService.chefRespond(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.post(
  "/rapports/:id/delete-decision",
  requirePermission("rapports.inbox.respond", "manage"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const result = await rapportService.chefDeleteDecision(
        req.params.id,
        req.body || {},
        req.user,
        req,
      );
      res.json(result);
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/view",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const versionId = req.query.versionId ? req.query.versionId : null;
      res.json(
        await workspaceService.getRapportView(
          req.params.id,
          showHidden,
          req.user,
          versionId,
        ),
      );
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/versions",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      res.json({ versions: await rapportService.listRapportVersions(req.params.id) });
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/versions/:versionId",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const version = await rapportService.getRapportVersion(
        req.params.id,
        req.params.versionId,
      );
      res.json({ version });
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/calendar",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await calendarEventService.listForWaliCalendar(req.query, { forChef: true }));
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/export.pdf",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
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
      res.setHeader("Content-Disposition", contentDispositionAttachment(filename));
      res.send(buffer);
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/export.xlsx",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const locale = req.query.locale === "fr" ? "fr" : "ar";
      const { buffer, filename } = await generateRapportExcel(req.params.id, {
        locale,
        showHidden,
        actor: req.user,
        req,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", contentDispositionAttachment(filename));
      res.send(buffer);
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

chefRouter.get(
  "/rapports/:id/export.docx",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      await rapportService.assertVisibleToChef(req.params.id);
      const showHidden = req.query.showHidden === "1";
      const locale = req.query.locale === "fr" ? "fr" : "ar";
      const { buffer, filename } = await generateRapportDocx(req.params.id, {
        locale,
        showHidden,
        actor: req.user,
        req,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader("Content-Disposition", contentDispositionAttachment(filename));
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

chefRouter.get("/instructions", async (req, res, next) => {
  try {
    res.json(await instructionService.listForChef(req.query));
  } catch (e) {
    next(e);
  }
});

chefRouter.get("/instructions/:id", async (req, res, next) => {
  try {
    res.json({
      instruction: await instructionService.getInstruction(req.params.id, {
        asChef: true,
      }),
    });
  } catch (e) {
    next(e);
  }
});

chefRouter.get("/broadcasts", async (req, res, next) => {
  try {
    const broadcasts = await broadcastService.listForOfficeUser(req.user.id);
    res.json({ broadcasts });
  } catch (e) {
    next(e);
  }
});

chefRouter.get("/broadcasts/:id", async (req, res, next) => {
  try {
    const broadcast = await broadcastService.getBroadcastDetail(req.params.id, req.user);
    res.json({ broadcast });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

chefRouter.post("/broadcasts/:id/read", async (req, res, next) => {
  try {
    const broadcast = await broadcastService.markBroadcastRead(req.params.id, req.user);
    res.json({ broadcast });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

chefRouter.post("/broadcasts/:id/comments", async (req, res, next) => {
  try {
    const broadcast = await broadcastService.addComment(
      req.params.id,
      req.body?.body_text,
      req.user,
    );
    res.json({ broadcast });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

chefRouter.get(
  "/rapports/:id/comments",
  requirePermission("rapports.inbox.view", "view"),
  async (req, res, next) => {
    try {
      res.json(await commentService.listComments(req.params.id, req.user, req.query));
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

chefRouter.post(
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
      );
      res.status(201).json({ comment });
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

chefRouter.get("/guide-videos", async (req, res, next) => {
  try {
    res.json(await guideVideoService.listGuideVideos(req.query, req.user.role));
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    if (e.status === 403) return res.status(403).json({ error: e.message });
    next(e);
  }
});

module.exports = { chefRouter };
