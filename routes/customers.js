const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { addCustomer, getCustomers, getCustomerById, updateCustomer, deleteCustomer } = require("../controllers/customers");

router.post("/", auth, addCustomer);
router.get("/", auth, getCustomers);
router.get("/:id", auth, getCustomerById);
router.put("/:id", auth, updateCustomer);
router.delete("/:id", auth, deleteCustomer);

module.exports = router;
