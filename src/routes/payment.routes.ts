import { Router } from "express";
import { 
  a2uPaymentJobTrigger,
  onIncompletePaymentFound, 
  onPaymentApproval, 
  onPaymentCancellation, 
  onPaymentCompletion,
  onPaymentError
} from "../controllers/paymentController";
import { verifyToken } from "../middlewares/verifyToken";

const paymentsRouter = Router();

paymentsRouter.post("/incomplete", onIncompletePaymentFound);
paymentsRouter.post("/complete", onPaymentCompletion);
paymentsRouter.post("/approve", verifyToken, onPaymentApproval);
paymentsRouter.post("/cancelled-payment", onPaymentCancellation);
paymentsRouter.post("/error", onPaymentError);
paymentsRouter.get("/a2u-job", a2uPaymentJobTrigger);

export default paymentsRouter;