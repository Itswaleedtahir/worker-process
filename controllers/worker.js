const { users } = require("../models/index.js");
const { UplaodFile, PdfEmail, labReport, labReoprtData, MakeCsv, pdfProcessor, findAllLabData, insertOrUpdateLabReport, logoExtraction, UploadFile,coordinateExtraction } = require("../helper/gpData.js");

const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');

const redisConfig = {
  host: 'redis-18209.c326.us-east-1-3.ec2.redns.redis-cloud.com',
  port: 18209,
  password: 'ZHgNfkQhZSFExZwCp52swgzqe6kQ6cKy',
  maxRetriesPerRequest: null // Disable automatic retries
};
// Create a Redis client
const redisClient = new IORedis(redisConfig);
// Check connection status
redisClient.on('connect', () => {
    console.log('Redis client connected successfully.');
  });
  
  redisClient.on('ready', () => {
    console.log('Redis client is ready for use.');
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

let methods = {
    worker: async(req,res)=>{
        // // Process jobs in the queue
const worker = new Worker('pdfProcessing', async job => {
    const { pdfPath, toAddress, DateReceivedEmail } = job.data;
    console.log("Processing job:", job.id, "data:", job.data);
  
    try {
      const AccessCheck = await users.findOne({ where: { user_email: toAddress } });
      if (!AccessCheck) {
        console.log("User not found:", toAddress);
        return;
      }
      console.log("AccessCheck result:", AccessCheck);
  
      if (AccessCheck.dataValues.access === 'Resume') {
        const apiUrl = 'https://gpdataservices.com/process-pdf/';
        const logoUrl = 'https://gpdataservices.com/ext-logo/';
  
        try {
          const { logo } = await logoExtraction(pdfPath, logoUrl);
          const { data } = await pdfProcessor(pdfPath, apiUrl);
        
          if (!Array.isArray(data)) {
            console.error("Failed to extract data for:", pdfPath);
            throw new Error("Data extraction failed");
          }
  
          let extractedData = extractData(data, logo);
          extractedData = cleanTestData(extractedData);
          const { pdfname, destination } = await UplaodFile(pdfPath, extractedData);
          const pdfURL = `${process.env.STORAGE_URL}${destination}`;
          console.log("PDF URL:", pdfURL);
  
          const { pdfEmailId } = await PdfEmail(DateReceivedEmail, pdfname, destination, toAddress);
          await findAllLabData(extractedData, toAddress, destination, pdfEmailId);
          const { message, datamade } = await insertOrUpdateLabReport(extractedData, toAddress);
  
          if (message === 'Add') {
            const { labReportId } = await labReport(datamade, pdfEmailId, toAddress);
            const labdata = datamade.tests;
            await labReoprtData(labdata, labReportId, pdfEmailId);
            console.log("Process completed for job:", job.id);
            return console.log("Process completed for job:", job.id)
          } else {
            console.log("Data already exists for job:", job.id);
            return console.log("Data already exists for job:", job.id)
          }
        } catch (err) {
          console.error("Error during PDF processing:", err);
          throw err; // Fail job explicitly
        }
      } else if (AccessCheck.dataValues.access === 'Paused') {
        console.log("User access is paused for:", toAddress);
        return; // Exit early
      } else {
        console.log("User not found or no access for:", toAddress);
      }
    } catch (error) {
      console.error('Job processing error:', error);
    }
  }, {
    connection: new IORedis(redisConfig),
    concurrency: 1 // Adjust as necessary
  });
  
  
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error:`, err);
  });
  
  console.log('Worker is running');
    }
}

module.exports = methods