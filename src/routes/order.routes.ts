import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validateUserFlow } from "../middlewares/validateUserFlow";
import { createOrder } from "../controllers/orderController";

const orderRouter = Router();

orderRouter.post("/", verifyToken, validateUserFlow, createOrder);

export default orderRouter;