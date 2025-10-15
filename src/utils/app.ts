import express from "express"
import cookieParser from 'cookie-parser';
import cors from "cors"
import path from "path";
import { env } from "../utils/env";

import { setupExpressErrorHandler } from "@sentry/node";
import docRouter from "../config/swagger";
import requestLogger from "../middlewares/logger";
import homeRoutes from "../routes/home.routes";
import paymentsRouter from "../routes/payment.routes";
import orderRouter from "../routes/order.routes";
import commentRouter from "../routes/comments.routes";
import userRoutes from "../routes/user.routes";
import notificationRoutes from "../routes/notification.routes";
import cronRoutes from "../routes/cron.routes";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use(cors({
  origin: env.CORS_ORIGIN_URL,
  credentials: true
}));
app.use(cookieParser());

// serve static files for Swagger documentation
app.use('/api/docs', express.static(path.join(__dirname, '../config/docs')));
// Swagger OpenAPI documentation
app.use("/api/docs", docRouter);

// Routes
app.use("/api/v1/users", userRoutes);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/comments', commentRouter);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/cron', cronRoutes);

app.use("/", homeRoutes);

// Sentry Express error handler
setupExpressErrorHandler(app);

export default app;