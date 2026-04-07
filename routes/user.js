const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

const {
    login,
    register,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
    updateFcmToken,
    resetDevice
} = require("../controllers/user");

router.route("/login").post(login);
router.route("/register").post(register);

// Profile Routes
router.route("/users/profile").get(authMiddleware, getProfile).put(authMiddleware, updateProfile);
router.put("/users/fcm-token", authMiddleware, updateFcmToken);

// Admin User CRUD Routes
router.route("/users").get(authMiddleware, getAllUsers).post(authMiddleware, createUser);
router.route("/users/:id").get(authMiddleware, getUserById).put(authMiddleware, updateUser).delete(authMiddleware, deleteUser);
router.put("/users/:id/reset-device", authMiddleware, resetDevice);

module.exports = router;