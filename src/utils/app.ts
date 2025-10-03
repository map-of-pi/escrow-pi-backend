import express from "express"
import cookieParser from 'cookie-parser';
import cors from "cors"
import path from "path";
import { env } from "../utils/env";

import docRouter from "../config/swagger";
import homeRoutes from "../routes/home.routes";
import paymentsRouter from "../routes/payment.routes";
import userRoutes from "../routes/user.routes";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Dynamic CORS setup via environment variables
const allowedOrigins = env.CORS_ORIGIN_URL
  ? env.CORS_ORIGIN_URL.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // allow server-to-server requests; may want to revisit for potential security leak if BE is public
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${ origin }`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

console.log("🟢 Allowed CORS origins:", allowedOrigins);

// serve static files for Swagger documentation
app.use('/api/docs', express.static(path.join(__dirname, '../config/docs')));
// Swagger OpenAPI documentation
app.use("/api/docs", docRouter);

// Routes
app.use("/api/v1/users", userRoutes);
app.use('/api/v1/payments', paymentsRouter);
app.use("/", homeRoutes);

export default app;