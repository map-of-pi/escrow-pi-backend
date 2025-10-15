import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validateUserFlow } from "../middlewares/resolveUserRole";
import { createOrder, fetchSingleOrder, fetchSingleUserOrders, confirmRequestOrder, updateOrderStatus } from "../controllers/orderController";

const orderRouter = Router();

orderRouter.post("/", verifyToken, validateUserFlow, createOrder); 
orderRouter.put("/update-status/:orderNo", verifyToken, updateOrderStatus); 
orderRouter.put("/confirm-request/:orderNo", verifyToken, confirmRequestOrder);
orderRouter.get("/", verifyToken, fetchSingleUserOrders);
orderRouter.get("/:orderNo", verifyToken, fetchSingleOrder);

export default orderRouter;