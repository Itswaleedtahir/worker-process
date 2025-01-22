const express = require('express');
const router = express.Router();
const workerController = require("../controllers/worker")
// router.get('/login', AuthController.loginPage);
router.post('/worker', workerController.worker);
router.get('/update', workerController.updatePdf);



module.exports = router;