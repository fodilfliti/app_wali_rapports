const express = require("express");
const {
  requireAuth,
  attachUser,
  requireRole,
  checkBlocked,
} = require("../middleware/auth");
const { validateBody } = require("../middleware/validateBody");
const {
  rapportCreateSchema,
  rapportPatchSchema,
} = require("../validation/schemas/adminCrud");
const rapportService = require("../modules/rapports/rapportService");
const navigationService = require("../modules/rapports/navigationService");
const hubCountsService = require("../modules/rapports/hubCountsService");

const officeRouter = express.Router();
officeRouter.use(
  requireAuth,
  attachUser,
  checkBlocked,
  requireRole(["OFFICE_USER", "ADMIN"]),
);

officeRouter.get("/services/tree", async (req, res, next) => {
  try {
    res.json(await navigationService.getOfficeServiceTree(req.user));
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/hub-counts", async (req, res, next) => {
  try {
    res.json(await hubCountsService.getOfficeHubCounts(req.user.id));
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/rapports/:id/versions", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "view");
    const versions = await rapportService.listRapportVersions(req.params.id);
    res.json({ versions });
  } catch (e) {
    next(e);
  }
});

officeRouter.get(
  "/rapports/:id/versions/:versionId",
  async (req, res, next) => {
    try {
      await assertRapportAccess(req.user, req.params.id, "view");
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

officeRouter.get("/notifications", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "1";
    const rows = await rapportService.listNotifications(
      req.user.id,
      unreadOnly,
    );
    res.json({ notifications: rows });
  } catch (e) {
    next(e);
  }
});

officeRouter.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const n = await rapportService.markNotificationRead(
      req.params.id,
      req.user.id,
    );
    res.json({ notification: n });
  } catch (e) {
    next(e);
  }
});

const workspaceService = require("../modules/rapports/workspaceService");
const officeSchemaService = require("../modules/rapports/officeSchemaService");
const calendarEventService = require("../modules/rapports/calendarEventService");
const broadcastService = require("../modules/rapports/broadcastService");
const guideVideoService = require("../modules/guideVideos/guideVideoService");
const {
  saveUploadedBuffer,
  enrichDataJsonWithFiles,
} = require("../services/uploadService");
const { generateRapportPdf } = require("../services/rapportPdfService");
const { generateRapportDocx } = require("../services/rapportDocxService");
const { generateRapportExcel } = require("../services/rapportExcelService");
const {
  contentDispositionAttachment,
} = require("../services/rapportExportFilename");
const { singleUpload } = require("../middleware/upload");
const {
  assertRapportAccess,
  resolveAccessLevel,
} = require("../modules/rapports/serviceAccessService");
const documentTemplateService = require("../modules/rapports/documentTemplateService");
const {
  tableSchemaCreateSchema,
  tableSchemaPatchSchema,
  rapportTypeCreateSchema,
  rapportTypePatchSchema,
  documentTemplateCreateSchema,
  documentTemplatePatchSchema,
  applyDocumentTemplateSchema,
} = require("../validation/schemas/schemaConfig");

officeRouter.get(
  "/services/:serviceId/document-templates",
  async (req, res, next) => {
    try {
      const templates = await documentTemplateService.listForService(
        req.params.serviceId,
        req.user,
        {
          rapportTypeId: req.query.rapport_type_id || null,
          contentKind: req.query.content_kind || null,
        },
      );
      res.json({ templates });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.get(
  "/services/:serviceId/document-templates/for-create",
  async (req, res, next) => {
    try {
      const rapportTypeId = req.query.rapport_type_id;
      if (!rapportTypeId)
        return res.status(400).json({ error: "rapportTypeIdRequired" });
      const templates = await documentTemplateService.listForRapportCreate(
        req.params.serviceId,
        req.user,
        rapportTypeId,
      );
      res.json({ templates });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.post(
  "/services/:serviceId/document-templates",
  validateBody(documentTemplateCreateSchema),
  async (req, res, next) => {
    try {
      const template = await documentTemplateService.createForService(
        req.params.serviceId,
        req.validatedBody,
        req.user,
        req,
      );
      res.status(201).json({ template });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.patch(
  "/document-templates/:id",
  validateBody(documentTemplatePatchSchema),
  async (req, res, next) => {
    try {
      const template = await documentTemplateService.updateTemplate(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ template });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

officeRouter.delete("/document-templates/:id", async (req, res, next) => {
  try {
    await documentTemplateService.deleteTemplate(req.params.id, req.user, req);
    res.json({ ok: true });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 404) return res.status(404).json({ error: "Not found" });
    next(e);
  }
});

officeRouter.post(
  "/rapports/:id/document/apply-template",
  validateBody(applyDocumentTemplateSchema),
  async (req, res, next) => {
    try {
      const rapport = await documentTemplateService.applyTemplateToRapport(
        req.params.id,
        req.validatedBody.template_id,
        req.validatedBody.mode || "replace",
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.get("/services/:serviceId/schemas", async (req, res, next) => {
  try {
    const data = await officeSchemaService.listSchemasForOfficeService(
      req.params.serviceId,
      req.user,
    );
    res.json(data);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.post(
  "/services/:serviceId/schemas",
  validateBody(tableSchemaCreateSchema),
  async (req, res, next) => {
    try {
      const schema = await officeSchemaService.createSchemaForOfficeService(
        req.params.serviceId,
        req.validatedBody,
        req.user,
        req,
      );
      res.status(201).json({ schema });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.patch(
  "/schemas/:id",
  validateBody(tableSchemaPatchSchema),
  async (req, res, next) => {
    try {
      const schema = await officeSchemaService.updateSchemaForOffice(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ schema });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.post(
  "/services/:serviceId/schemas/duplicate",
  async (req, res, next) => {
    try {
      const { source_schema_id, slug } = req.body || {};
      if (!source_schema_id) {
        return res.status(400).json({ error: "sourceSchemaIdRequired" });
      }
      const schema = await officeSchemaService.duplicateSchemaToService(
        req.params.serviceId,
        source_schema_id,
        slug,
        req.user,
        req,
      );
      res.status(201).json({ schema });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.get(
  "/services/:serviceId/rapport-types",
  async (req, res, next) => {
    try {
      const { service, rapportTypes } =
        await officeSchemaService.listRapportTypesForOffice(
          req.params.serviceId,
          req.user,
        );
      res.json({ service, rapportTypes });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.post(
  "/services/:serviceId/rapport-types",
  validateBody(rapportTypeCreateSchema),
  async (req, res, next) => {
    try {
      const rapportType = await officeSchemaService.createRapportTypeForOffice(
        req.params.serviceId,
        req.validatedBody,
        req.user,
        req,
      );
      res.status(201).json({ rapportType });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.patch(
  "/rapport-types/:id",
  validateBody(rapportTypePatchSchema),
  async (req, res, next) => {
    try {
      const rapportType = await officeSchemaService.updateRapportTypeForOffice(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ rapportType });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.post("/rapport-types/:id/hide", async (req, res, next) => {
  try {
    const rapportType = await officeSchemaService.hideRapportTypeForOffice(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapportType });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 404) return res.status(404).json({ error: "Not found" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.post("/rapport-types/:id/restore", async (req, res, next) => {
  try {
    const rapportType = await officeSchemaService.restoreRapportTypeForOffice(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapportType });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 404) return res.status(404).json({ error: "Not found" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/services/:serviceId/content", async (req, res, next) => {
  try {
    res.json(
      await workspaceService.getServiceContentHub(
        req.params.serviceId,
        req.user,
        {
          includeHiddenTypes:
            req.query.include_hidden === "1" ||
            req.query.include_hidden === "true",
          hiddenTypesOnly:
            req.query.hidden_only === "1" || req.query.hidden_only === "true",
        },
      ),
    );
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.get(
  "/services/:serviceId/table-workspace",
  async (req, res, next) => {
    try {
      res.json(
        await workspaceService.getServiceWorkspace(
          req.params.serviceId,
          req.user,
          req,
          req.query.rapport_type_id || null,
          req.query.rapport_id || null,
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.patch("/rapports/:id/table-data", async (req, res, next) => {
  try {
    const rapport = await workspaceService.saveTableData(
      req.params.id,
      req.body || {},
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.get("/services/:serviceId/documents", async (req, res, next) => {
  try {
    const contentKind = req.query.content_kind || "document_compose";
    res.json(
      await workspaceService.getDocumentList(
        req.params.serviceId,
        contentKind,
        req.user,
        req.query.rapport_type_id || null,
        req.query,
      ),
    );
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.post("/services/:serviceId/documents", async (req, res, next) => {
  try {
    const rapport = await workspaceService.createDocument(
      req.params.serviceId,
      req.body?.rapport_type_id,
      req.user,
      req,
      {
        template_id: req.body?.template_id || null,
        skip_default: !!req.body?.skip_default,
      },
    );
    res.status(201).json({ rapport });
  } catch (e) {
    next(e);
  }
});

officeRouter.patch("/rapports/:id/document", async (req, res, next) => {
  try {
    const rapport = await workspaceService.saveDocumentBlocks(
      req.params.id,
      req.body || {},
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.get(
  "/services/:serviceId/commune-workspace",
  async (req, res, next) => {
    try {
      res.json(
        await workspaceService.getCommuneListWorkspace(
          req.params.serviceId,
          req.user,
          req,
          req.query.rapport_type_id || null,
          req.query.rapport_id || null,
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.get(
  "/services/:serviceId/commune-bulk-workspace",
  async (req, res, next) => {
    try {
      res.json(
        await workspaceService.getCommuneBulkWorkspace(
          req.params.serviceId,
          req.user,
          req,
          req.query.rapport_type_id || null,
          req.query.rapport_id || null,
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.patch(
  "/rapports/:id/commune-bulk-data",
  async (req, res, next) => {
    try {
      const rapport = await workspaceService.saveBulkCommuneData(
        req.params.id,
        req.body || {},
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.get(
  "/rapports/:id/communes/:municipalityCode",
  async (req, res, next) => {
    try {
      res.json(
        await workspaceService.getCommuneRows(
          req.params.id,
          req.params.municipalityCode,
          req.user,
        ),
      );
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.patch("/rapports/:id/commune-data", async (req, res, next) => {
  try {
    const rapport = await workspaceService.saveCommuneData(
      req.params.id,
      req.body?.municipality_code,
      req.body || {},
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.patch(
  "/rapports/:id/included-entities",
  validateBody(
    require("../validation/schemas/adminCrud").includedEntitiesSchema,
  ),
  async (req, res, next) => {
    try {
      const rapport = await workspaceService.saveIncludedEntities(
        req.params.id,
        req.validatedBody.keys,
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      if (e.status === 404) return res.status(404).json({ error: "Not found" });
      next(e);
    }
  },
);

officeRouter.get("/services", async (req, res, next) => {
  try {
    const services = await rapportService.listServices();
    res.json({ services });
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/rapports", async (req, res, next) => {
  try {
    const discussionList =
      req.query.unread_discussion === "1" ||
      req.query.unread_discussion === "true" ||
      req.query.has_discussion === "1" ||
      req.query.has_discussion === "true";
    res.json(
      await rapportService.listRapports(req.query, {
        enrichForOfficeUserId: req.user.id,
        discussionUserId: discussionList ? req.user.id : undefined,
        forOfficeUserId: discussionList ? req.user.id : undefined,
      }),
    );
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/rapports/:id/table-snapshot", async (req, res, next) => {
  try {
    const snapshot = await workspaceService.getRapportTableSnapshot(
      req.params.id,
      req.user,
    );
    res.json({ snapshot });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/rapports/:id", async (req, res, next) => {
  try {
    const rapport = await rapportService.getRapportDetail(req.params.id);
    const accessLevel = await resolveAccessLevel(req.user, rapport.service_id);
    if (accessLevel === "none")
      return res.status(403).json({ error: "Forbidden" });
    const commentService = require("../modules/rapports/commentService");
    await commentService.markCommentNotificationsRead(req.params.id, req.user.id);
    res.json({ rapport, accessLevel });
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/rapports/:id/comments", async (req, res, next) => {
  try {
    const commentService = require("../modules/rapports/commentService");
    res.json(await commentService.listComments(req.params.id, req.user, req.query));
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.post(
  "/rapports/:id/comments",
  validateBody(require("../validation/schemas/adminCrud").rapportCommentSchema),
  async (req, res, next) => {
    try {
      const commentService = require("../modules/rapports/commentService");
      const comment = await commentService.createComment(
        req.params.id,
        req.validatedBody.body_text,
        req.user,
        req,
      );
      res.status(201).json({ comment });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.post(
  "/rapports/:id/mark-notifications-read",
  async (req, res, next) => {
    try {
      await assertRapportAccess(req.user, req.params.id, "view");
      await rapportService.markRapportNotificationsRead(
        req.params.id,
        req.user.id,
      );
      res.json({ ok: true });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.post(
  "/rapports",
  validateBody(rapportCreateSchema),
  async (req, res, next) => {
    try {
      const rapport = await rapportService.createRapport(
        req.validatedBody,
        req.user,
        req,
      );
      res.status(201).json({ rapport });
    } catch (e) {
      next(e);
    }
  },
);

officeRouter.patch(
  "/rapports/:id",
  validateBody(rapportPatchSchema),
  async (req, res, next) => {
    try {
      await assertRapportAccess(req.user, req.params.id, "manage");
      const rapport = await rapportService.updateRapportDraft(
        req.params.id,
        req.validatedBody,
        req.user,
        req,
      );
      res.json({ rapport });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      next(e);
    }
  },
);

officeRouter.post("/rapports/:id/submit", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "manage");
    const rapport = await rapportService.submitRapport(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.post("/rapports/:id/return-to-draft", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "manage");
    const rapport = await rapportService.returnRapportToDraft(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 404) return res.status(404).json({ error: "Not found" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.post("/rapports/:id/finish", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "manage");
    const rapport = await rapportService.hideRapport(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.post("/rapports/:id/restore", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "manage");
    const rapport = await rapportService.restoreRapport(
      req.params.id,
      req.user,
      req,
    );
    res.json({ rapport });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.post(
  "/rapports/:id/uploads",
  singleUpload("file"),
  async (req, res, next) => {
    try {
      await assertRapportAccess(req.user, req.params.id, "manage");
      if (!req.file?.buffer)
        return res.status(400).json({ error: "File required" });
      const file = await saveUploadedBuffer({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        rapportId: Number(req.params.id),
        actor: req.user,
        req,
      });
      res.status(201).json({ file });
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
      if (e.status === 413) return res.status(413).json({ error: e.message });
      next(e);
    }
  },
);

officeRouter.get("/rapports/:id/calendar-events", async (req, res, next) => {
  try {
    const events = await calendarEventService.listForRapport(
      req.params.id,
      req.user,
    );
    res.json({ events });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.put("/rapports/:id/calendar-events", async (req, res, next) => {
  try {
    const events = await calendarEventService.replaceForRapport(
      req.params.id,
      req.body?.events || [],
      req.user,
    );
    res.json({ events });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/rapports/:id/media", async (req, res, next) => {
  try {
    const rapport = await rapportService.getRapportDetail(req.params.id);
    const accessLevel = await resolveAccessLevel(req.user, rapport.service_id);
    if (accessLevel === "none")
      return res.status(403).json({ error: "Forbidden" });
    const dataJson = rapport.currentVersion?.data_json || {};
    const { files } = await enrichDataJsonWithFiles(dataJson);
    res.json({ files });
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/rapports/:id/export.pdf", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "view");
    const showHidden = req.query.showHidden === "1";
    const locale = req.query.locale === "fr" ? "fr" : "ar";
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
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
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/rapports/:id/export.xlsx", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "view");
    const showHidden = req.query.showHidden === "1";
    const locale = req.query.locale === "fr" ? "fr" : "ar";
    const rowFilter = req.query.rowFilter;
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
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
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/rapports/:id/export.docx", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "view");
    const showHidden = req.query.showHidden === "1";
    const locale = req.query.locale === "fr" ? "fr" : "ar";
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
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
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

officeRouter.get("/broadcasts", async (req, res, next) => {
  try {
    const broadcasts = await broadcastService.listForOfficeUser(req.user.id);
    res.json({ broadcasts });
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/broadcasts/:id", async (req, res, next) => {
  try {
    const broadcast = await broadcastService.getBroadcastDetail(
      req.params.id,
      req.user,
    );
    res.json({ broadcast });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.post("/broadcasts/:id/read", async (req, res, next) => {
  try {
    const broadcast = await broadcastService.markBroadcastRead(
      req.params.id,
      req.user,
    );
    res.json({ broadcast });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ error: "Forbidden" });
    next(e);
  }
});

officeRouter.post("/broadcasts/:id/comments", async (req, res, next) => {
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
});

const instructionService = require("../modules/rapports/instructionService");

officeRouter.get("/instructions", async (req, res, next) => {
  try {
    res.json(await instructionService.listForOffice(req.user.id, req.query));
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/instructions/:id", async (req, res, next) => {
  try {
    res.json({
      instruction: await instructionService.getInstruction(req.params.id, {
        userId: req.user.id,
      }),
    });
  } catch (e) {
    next(e);
  }
});

officeRouter.get("/guide-videos", async (req, res, next) => {
  try {
    res.json(await guideVideoService.listGuideVideos(req.query, req.user.role));
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    if (e.status === 403) return res.status(403).json({ error: e.message });
    next(e);
  }
});

module.exports = { officeRouter };
