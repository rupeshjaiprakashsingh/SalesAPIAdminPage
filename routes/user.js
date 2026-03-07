const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

const {
    login,
    register,
    dashboard,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
    resetDevice
} = require("../controllers/user");

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/dashboard").get(authMiddleware, dashboard);

// Profile Routes
router.route("/users/profile").get(authMiddleware, getProfile).put(authMiddleware, updateProfile);

// Admin User CRUD Routes
router.route("/users").get(authMiddleware, getAllUsers).post(authMiddleware, createUser);
router.route("/users/:id").get(authMiddleware, getUserById).put(authMiddleware, updateUser).delete(authMiddleware, deleteUser);
router.put("/users/:id/reset-device", authMiddleware, resetDevice);

module.exports = router;