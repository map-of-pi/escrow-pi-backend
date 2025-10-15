import { Request, Response } from "express";
import { logInfo, logWarn, logError } from "../config/loggingConfig";
import * as notificationService from '../services/notification.service';

export const createNotification = async (req: Request, res: Response) => {
  const authUser = req.currentUser;

  if (!authUser) {
    logWarn("Unauthorized access to create notification.");
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    logWarn(`Missing or empty reason from user ${authUser.pi_uid}`);
    return res.status(400).json({ message: "Missing notification reason" });
  }

  try {
    const notification = await notificationService.addNotification(authUser?.pi_uid, reason);
    logInfo(`Notification created for user ${authUser.pi_uid} with reason: ${reason.trim()}`);
    return res.status(200).json({ message: "Notification created successfully", notification });
  } catch (err: any) {
    logError(`Error creating notification for user ${authUser.pi_uid}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while creating notification; please try again later' });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  const pi_uid = req.currentUser?.pi_uid as string;
  const skip = req.query.skip ? Number(req.query.skip) : 0;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const status = ['cleared', 'uncleared'].includes(req.query.status as string)
    ? (req.query.status as 'cleared' | 'uncleared') : undefined;

  try {
    const notifications = await notificationService.getNotifications(pi_uid, skip, limit, status);
    return res.status(200).json(notifications);
  } catch (err: any) {
    logError(`Error fetching notifications for user ${pi_uid}: ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while getting notifications; please try again later' });
  }
};

export const updateNotification = async (req: Request, res: Response) => {
  const { notification_id } = req.params;

  if (!notification_id) {
    logWarn("Missing notification_id in request parameters.");
    return res.status(400).json({ message: "Missing notification ID" });
  }

  try {
    const updatedNotification = await notificationService.toggleNotificationStatus(notification_id);
    if (!updatedNotification) {
      logWarn(`Notification not found or update failed for ${notification_id})`);
      return res.status(404).json({ message: "Notification not found or could not be updated" });
    }
    logInfo(`Notification ${notification_id} updated successfully`);
    return res.status(200).json({ message: "Notification updated successfully", updatedNotification: updatedNotification });
  } catch (err: any) {
    logError(`Error updating notification ${notification_id}" ${err.message}`);
    return res.status(500).json({ message: 'An error occurred while updating notification; please try again later' });
  }
};
