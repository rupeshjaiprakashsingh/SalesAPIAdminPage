const Customer = require("../models/Customer");

exports.addCustomer = async (req, res) => {
    try {
        const customerData = {
            ...req.body,
            createdBy: req.user.id
        };
        const customer = await Customer.create(customerData);
        res.status(201).json({ success: true, data: customer });
    } catch (error) {
        console.error("Add customer error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find().populate("createdBy", "name").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: customers });
    } catch (error) {
        console.error("Get customers error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        res.status(200).json({ success: true, data: customer });
    } catch (error) {
        console.error("Get customer by ID error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        res.status(200).json({ success: true, data: customer });
    } catch (error) {
        console.error("Update customer error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found" });
        }
        res.status(200).json({ success: true, message: "Customer deleted successfully" });
    } catch (error) {
        console.error("Delete customer error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
