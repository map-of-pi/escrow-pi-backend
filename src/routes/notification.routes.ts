import { Router } from "express";

import * as notificationController from "../controllers/notificationController";
import { verifyToken } from "../middlewares/verifyToken";

const notificationRoutes = Router();

// Get notifications for a user
notificationRoutes.get("/:pi_uid", notificationController.getNotifications);

// Create a new notification (auth required)
notificationRoutes.post("/", verifyToken, notificationController.createNotification);

// Toggle notification cleared status (auth required)
notificationRoutes.put("/update/:notification_id", verifyToken, notificationController.updateNotification);

export default notificationRoutes;
