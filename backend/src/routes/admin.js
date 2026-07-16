const express = require("express");
const { requireAuth, attachUser, requireRole, checkBlocked } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { validateBody } = require("../middleware/validateBody");
const {
  municipalityCreateSchema,
  municipalityPatchSchema,
  dairaCreateSchema,
  dairaPatchSchema,
  modiriyaCreateSchema,
  modiriyaPatchSchema,
  userCreateSchema,
  userPatchSchema
} = require("../validation/schemas/adminCrud");
const org = require("../modules/organization/organizationService");
const rapportService = require("../modules/rapports/rapportService");
const workspaceService = require("../modules/rapports/workspaceService");
const { assertRapportAccess } = require("../modules/rapports/serviceAccessService");
const schemaConfig = require("../modules/rapports/schemaConfigService");
const serviceAdmin = require("../modules/rapports/serviceAdminService");
const { PERMISSIONS } = require("../modules/access/permissionCatalog");
const { AccessRoleTemplate } = require("../db");
const {
  tableSchemaCreateSchema,
  tableSchemaPatchSchema,
  rapportTypeCreateSchema,
  rapportTypePatchSchema
} = require("../validation/schemas/schemaConfig");
const { serviceCreateSchema, servicePatchSchema, serviceGrantsSchema, departmentCreateSchema, departmentPatchSchema } = require("../validation/schemas/serviceAdmin");

const adminRouter = express.Router();
adminRouter.use(requireAuth, attachUser, checkBlocked, requireRole("ADMIN"));

adminRouter.get("/dairas", requirePermission("organization.municipalities.view", "view"), async (req, res, next) => {
  try {
    res.json(await org.listDairas(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/dairas",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(dairaCreateSchema),
  async (req, res, next) => {
    try {
      const daira = await org.createDaira(req.validatedBody, req.user, req);
      res.json({ daira });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.patch(
  "/dairas/:id",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(dairaPatchSchema),
  async (req, res, next) => {
    try {
      const daira = await org.updateDaira(req.params.id, req.validatedBody, req.user, req);
      res.json({ daira });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/modiriyat", requirePermission("organization.municipalities.view", "view"), async (req, res, next) => {
  try {
    res.json(await org.listModiriyat(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/modiriyat",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(modiriyaCreateSchema),
  async (req, res, next) => {
    try {
      const modiriya = await org.createModiriya(req.validatedBody, req.user, req);
      res.json({ modiriya });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.patch(
  "/modiriyat/:id",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(modiriyaPatchSchema),
  async (req, res, next) => {
    try {
      const modiriya = await org.updateModiriya(req.params.id, req.validatedBody, req.user, req);
      res.json({ modiriya });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/municipalities", requirePermission("organization.municipalities.view", "view"), async (req, res, next) => {
  try {
    res.json(await org.listMunicipalities(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/municipalities",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(municipalityCreateSchema),
  async (req, res, next) => {
    try {
      const muni = await org.createMunicipality(req.validatedBody, req.user, req);
      res.json({ municipality: muni });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.patch(
  "/municipalities/:id",
  requirePermission("organization.municipalities.manage", "manage"),
  validateBody(municipalityPatchSchema),
  async (req, res, next) => {
    try {
      const muni = await org.updateMunicipality(req.params.id, req.validatedBody, req.user, req);
      res.json({ municipality: muni });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/users", requirePermission("organization.users.view", "view"), async (req, res, next) => {
  try {
    res.json(await org.listUsers(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/users",
  requirePermission("organization.users.manage", "manage"),
  validateBody(userCreateSchema),
  async (req, res, next) => {
    try {
      const { user, initialPassword, credentials } = await org.createUser(req.validatedBody, req.user, req);
      res.json({ user, initialPassword, credentials });
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  }
);

adminRouter.patch(
  "/users/:id",
  requirePermission("organization.users.manage", "manage"),
  validateBody(userPatchSchema),
  async (req, res, next) => {
    try {
      const user = await org.updateUser(req.params.id, req.validatedBody, req.user, req);
      res.json({ user });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.post("/users/:id/block", requirePermission("organization.users.manage", "manage"), async (req, res, next) => {
  try {
    const user = await org.toggleBlockUser(req.params.id, req.user, req);
    res.json({ user });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

adminRouter.post(
  "/users/:id/reset-password",
  requirePermission("organization.users.manage", "manage"),
  async (req, res, next) => {
    try {
      const { user, newPassword, credentials } = await org.resetUserPassword(req.params.id, req.user, req);
      res.json({ user, newPassword, credentials });
    } catch (e) {
      next(e);
    }
  }
);

adminRouter.get("/departments", async (req, res, next) => {
  try {
    const departments = await serviceAdmin.listDepartments();
    res.json({ departments });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/departments", validateBody(departmentCreateSchema), async (req, res, next) => {
  try {
    const department = await serviceAdmin.createDepartment(req.validatedBody, req.user, req);
    res.status(201).json({ department });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

adminRouter.patch("/departments/:id", validateBody(departmentPatchSchema), async (req, res, next) => {
  try {
    const department = await serviceAdmin.updateDepartment(req.params.id, req.validatedBody, req.user, req);
    res.json({ department });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

adminRouter.delete("/departments/:id", async (req, res, next) => {
  try {
    res.json(await serviceAdmin.deleteDepartment(req.params.id, req.user, req));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

adminRouter.get("/services", async (req, res, next) => {
  try {
    const services = await serviceAdmin.listServicesAdmin();
    res.json({ services });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/services", validateBody(serviceCreateSchema), async (req, res, next) => {
  try {
    const service = await serviceAdmin.createService(req.validatedBody, req.user, req);
    res.status(201).json({ service });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

adminRouter.patch("/services/:id", validateBody(servicePatchSchema), async (req, res, next) => {
  try {
    const service = await serviceAdmin.updateService(req.params.id, req.validatedBody, req.user, req);
    res.json({ service });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    next(e);
  }
});

adminRouter.delete("/services/:id", async (req, res, next) => {
  try {
    res.json(await serviceAdmin.deleteService(req.params.id, req.user, req));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

adminRouter.get("/services/:id/grants", async (req, res, next) => {
  try {
    const grants = await serviceAdmin.listGrantsForService(req.params.id);
    res.json({ grants });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/services/:id/grants", validateBody(serviceGrantsSchema), async (req, res, next) => {
  try {
    const grants = await serviceAdmin.replaceServiceGrants(
      req.params.id,
      req.validatedBody.grants,
      req.user,
      req
    );
    res.json({ grants });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/office-users", async (req, res, next) => {
  try {
    const users = await serviceAdmin.listOfficeUsersForGrantPicker();
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/rapports", async (req, res, next) => {
  try {
    res.json(await rapportService.listRapports(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/rapports/:id", async (req, res, next) => {
  try {
    res.json(await rapportService.deleteRapportPermanently(req.params.id, req.user, req));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: e.message });
    next(e);
  }
});

adminRouter.get("/rapports/:id/view", async (req, res, next) => {
  try {
    await assertRapportAccess(req.user, req.params.id, "view");
    const showHidden = req.query.showHidden === "1";
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
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
});

adminRouter.get("/table-schemas", async (req, res, next) => {
  try {
    res.json(await schemaConfig.listTableSchemas(req.query));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/table-schemas", validateBody(tableSchemaCreateSchema), async (req, res, next) => {
  try {
    const schema = await schemaConfig.createTableSchema(req.validatedBody, req.user, req);
    res.status(201).json({ schema });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

adminRouter.patch("/table-schemas/:id", validateBody(tableSchemaPatchSchema), async (req, res, next) => {
  try {
    const schema = await schemaConfig.updateTableSchema(req.params.id, req.validatedBody, req.user, req);
    res.json({ schema });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

adminRouter.delete("/table-schemas/:id", async (req, res, next) => {
  try {
    await schemaConfig.deleteTableSchema(req.params.id, req.user, req);
    res.json({ ok: true });
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: e.message });
    next(e);
  }
});

adminRouter.get("/services/:serviceId/rapport-types", async (req, res, next) => {
  try {
    res.json(await schemaConfig.listRapportTypes(req.params.serviceId));
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/services/:serviceId/rapport-types",
  validateBody(rapportTypeCreateSchema),
  async (req, res, next) => {
    try {
      const rapportType = await schemaConfig.createRapportType(
        req.params.serviceId,
        req.validatedBody,
        req.user,
        req
      );
      res.status(201).json({ rapportType });
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: e.message });
      if (e.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  }
);

adminRouter.patch("/rapport-types/:id", validateBody(rapportTypePatchSchema), async (req, res, next) => {
  try {
    const rapportType = await schemaConfig.updateRapportType(req.params.id, req.validatedBody, req.user, req);
    res.json({ rapportType });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

adminRouter.get("/access/permissions-catalog", async (req, res) => {
  res.json({ permissions: PERMISSIONS });
});

adminRouter.get("/access/role-templates", async (req, res, next) => {
  try {
    const rows = await AccessRoleTemplate.findAll({ where: { is_active: true }, order: [["id", "ASC"]] });
    res.json({ roleTemplates: rows });
  } catch (e) {
    next(e);
  }
});

module.exports = { adminRouter };
