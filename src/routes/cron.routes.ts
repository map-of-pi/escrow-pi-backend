import { Router } from "express";
import { a2uPaymentJobTrigger } from "../controllers/admin/cronController";

const cronRoutes = Router();

/**
 * @swagger
 * /api/v1/cron/a2u-job:
 *   get:
 *     tags:
 *       - Cron
 *     summary: Execute A2U Payment Job *
 *     description: Executes the A2U Payment Job to process pending app-to-user payments.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: A2U payment job successfully completed
 *       500:
 *         description: Internal server error
 */
cronRoutes.get("/a2u-job", a2uPaymentJobTrigger);

export default cronRoutes;