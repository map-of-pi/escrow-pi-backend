import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { addNewComment, fetchOrderComment } from "../controllers/commentController";

const commentRouter = Router();

commentRouter.post("/", verifyToken, addNewComment); 
commentRouter.get("/:orderNo", verifyToken, fetchOrderComment);

export default commentRouter;