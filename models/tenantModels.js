const mongoose = require("mongoose");
const tenants = require("../config/tenants");

// Schema imports — we need the raw schemas (not compiled models) to bind to tenant connections
const UserSchema = require("../models/User").schema;
const AttendanceSchema = require("../models/Attendance").schema;
const CustomerSchema = require("../models/Customer").schema;
const EmployeeLocationLogSchema = require("../models/EmployeeLocationLog").schema;
const EmployeeRouteSummarySchema = require("../models/EmployeeRouteSummary").schema;
const EnquirySchema = require("../models/Enquiry").schema;
const GeoFenceSchema = require("../models/GeoFence").schema;
const GeoFenceLogSchema = require("../models/GeoFenceLog").schema;
const LocationPingSchema = require("../models/LocationPing").schema;

// Cache: stores { [tenantId]: { db, models } }
const tenantCache = {};

/**
 * Returns { db, models } for the given tenantId.
 * Uses mongoose.connection.useDb() which shares the underlying connection pool
 * but targets a different database — zero extra config needed.
 */
const getTenantModels = (tenantId) => {
  if (tenantCache[tenantId]) return tenantCache[tenantId];

  const tenant = tenants[tenantId];
  if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`);

  // useDb() piggybacks on the default connection but targets a different DB
  const db = mongoose.connection.useDb(tenant.dbName, { useCache: true });

  const models = {
    User: db.model("User", UserSchema),
    Attendance: db.model("Attendance", AttendanceSchema),
    Customer: db.model("Customer", CustomerSchema),
    EmployeeLocationLog: db.model("EmployeeLocationLog", EmployeeLocationLogSchema),
    EmployeeRouteSummary: db.model("EmployeeRouteSummary", EmployeeRouteSummarySchema),
    Enquiry: db.model("Enquiry", EnquirySchema),
    GeoFence: db.model("GeoFence", GeoFenceSchema),
    GeoFenceLog: db.model("GeoFenceLog", GeoFenceLogSchema),
    LocationPing: db.model("LocationPing", LocationPingSchema),
  };

  tenantCache[tenantId] = { db, models };
  return tenantCache[tenantId];
};

module.exports = getTenantModels;
