import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import keywordsRouter from "./keywords";
import articlesRouter from "./articles";
import workflowRouter from "./workflow";
import publishingRouter from "./publishing";
import wordpressRouter from "./wordpress";
import schedulesRouter from "./schedules";
import apiKeysRouter from "./api-keys";
import analyticsRouter from "./analytics";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(keywordsRouter);
router.use(articlesRouter);
router.use(workflowRouter);
router.use(publishingRouter);
router.use(wordpressRouter);
router.use(schedulesRouter);
router.use(apiKeysRouter);
router.use(analyticsRouter);
router.use(settingsRouter);

export default router;
