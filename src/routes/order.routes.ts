import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { validateUserFlow } from "../middlewares/resolveUserRole";
import { createOrder, fetchSingleOrder, fetchSingleUserOrders, confirmRequestOrder, updateOrderStatus, proposeDispute, acceptDispute, declineDispute } from "../controllers/orderController";

const orderRouter = Router();

orderRouter.post("/", verifyToken, validateUserFlow, createOrder); 
orderRouter.put("/update-status/:orderNo", verifyToken, updateOrderStatus); 
orderRouter.put("/confirm-request/:orderNo", verifyToken, confirmRequestOrder);
// Disputes
orderRouter.post("/:orderNo/disputes/propose", verifyToken, proposeDispute);
orderRouter.post("/:orderNo/disputes/accept", verifyToken, acceptDispute);
orderRouter.post("/:orderNo/disputes/decline", verifyToken, declineDispute);
orderRouter.get("/", verifyToken, fetchSingleUserOrders);
orderRouter.get("/:orderNo", verifyToken, fetchSingleOrder);

export default orderRouter;