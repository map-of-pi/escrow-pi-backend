import express from "express"
import dotenv from "dotenv";

import homeRoutes from "../routes/home.routes";
import cookieParser from 'cookie-parser';
import cors from "cors"
import path from "path";

import docRouter from "../config/swagger";
// import requestLogger from "../middlewares/logger";

import userRoutes from "../routes/user.routes";
import paymentsRouter from "../routes/payment.routes";
import ApiServiceRouter from "../routes/adminApiKeys.routes";


dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// app.use(requestLogger);

app.use(cors({
    origin: process.env.CORS_ORIGIN_URL,
    credentials: true
}));
app.use(cookieParser());

// // serve static files for Swagger documentation
app.use('/api/docs', express.static(path.join(__dirname, '../config/docs')));

// Swagger OpenAPI documentation
app.use("/api/docs", docRouter);

app.use("/api/v1/users", userRoutes);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/api-service', ApiServiceRouter);

app.use("/", homeRoutes);

export default app;
