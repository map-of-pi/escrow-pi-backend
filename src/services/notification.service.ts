import { logInfo, logWarn, logError } from "../config/loggingConfig";
import Notification from "../models/Notification";
import { INotification } from "../types";

export const addNotification = async (pi_uid: string, reason: string): Promise<INotification> => {
  try {
    const notification = await Notification.create({ pi_uid, reason, is_cleared: false });
    logInfo(`Notification created for user: ${pi_uid} | Reason: ${reason}`);
    return notification as INotification;
  } catch (err: any) {
    logError(`Failed to create notification for user: ${pi_uid}`, err);
    throw err;
  }
};

export const getNotifications = async (
  pi_uid: string,
  skip: number,
  limit: number,
  status?: 'cleared' | 'uncleared'
): Promise<INotification[]> => {
  try {
    const filter: any = { pi_uid };

    if (status === 'cleared') {
      filter.is_cleared = true;
    } else if (status === 'uncleared') {
      filter.is_cleared = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    logInfo(`Fetched ${notifications.length} notification(s) for user: ${pi_uid} | Status: ${status ?? "all"}`);  
    return notifications as INotification[];
  } catch (err: any) {
    logError(`Failed to fetch notifications for user: ${pi_uid}`, err);
    throw err;
  }
};

export const toggleNotificationStatus = async (notification_id: string): Promise<INotification | null> => {
  try {
    const notification = await Notification.findById(notification_id).exec();

    if (!notification) {
      logWarn(`Notification not found for ${notification_id}`);
      return null;
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      { _id: notification_id },
      { is_cleared: !notification.is_cleared },
      { new: true }
    ).exec();

    // logInfo(`Notification ${notification_id} status toggled to: ${!notification.is_cleared}`);
    return updatedNotification as INotification;
  } catch (err: any) {
    logError(`Failed to toggle notification for ${notification_id}`, err);
    throw err;
  }
};
