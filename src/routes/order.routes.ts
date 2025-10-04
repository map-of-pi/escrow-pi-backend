import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validateUserFlow } from "../middlewares/validateUserFlow";
import { createOrder, fetchSingleOrder, fetchSingleUserOrders } from "../controllers/orderController";

const orderRouter = Router();

orderRouter.post("/", verifyToken, validateUserFlow, createOrder); 
orderRouter.get("/", verifyToken, fetchSingleUserOrders);
orderRouter.get("/:orderNo", verifyToken, fetchSingleOrder);

export default orderRouter;