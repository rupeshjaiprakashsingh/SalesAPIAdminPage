const tenants = require("../config/tenants");
const getTenantModels = require("../models/tenantModels");

/**
 * Tenant Middleware
 * Reads "x-tenant-id" header and attaches tenant-specific models to req.models.
 * All downstream controllers use req.models.User, req.models.Attendance, etc.
 */
const tenantMiddleware = (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"];

  if (!tenantId || !tenants[tenantId]) {
    return res.status(400).json({
      msg: "Please select your organization to continue.",
    });
  }

  try {
    const { models } = getTenantModels(tenantId);
    req.tenantId = tenantId;
    req.models = models;
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    return res.status(500).json({ msg: "Database connection failed" });
  }
};

module.exports = tenantMiddleware;
