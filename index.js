const path = require('path');
const env = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const { expressjwt: jwt } = require("express-jwt");
const axios = require('axios');
const Router = require("./routes/worker.js");
const fs = require('fs');
// const workerRoutes = require('./routes/worker');
const { sequelize } = require('./models/index');
// const { initializeWorker } = require('./worker'); // Import the initializeWorker function

// Load environment variables
env.config();

const app = express();
app.use("/", Router);

const { users } = require("./models/index.js");
const {
  UplaodFile,
  PdfEmail,
  labReport,
  labReoprtData,
  pdfProcessor,
  findAllLabData,
  insertOrUpdateLabReport,
  logoExtraction,
} = require("./helper/gpData.js");
const cron = require('node-cron');
const { fetchClientPdfCountsAndNotifyEmployees } = require('./helper/cronJobs.js'); // Adjust path accordingly


// Schedule the task to run every minute
// This will run at 8 AM UTC which is 3 AM EST
cron.schedule('0 8 * * *', () => {
  console.log('Cron job running at 3 AM EST');
  fetchClientPdfCountsAndNotifyEmployees();
});
const { Worker } = require('bullmq');
const IORedis = require('ioredis');

  const extractData = (data, logo) => {
    if (!Array.isArray(data)) {
      console.error('Invalid input: data is not an array');
      return;  // or throw an error, or handle this case as needed
    }
  
    const tests = data.filter(item => item.type === "Tests").map(test => {
  
      // Assuming that the properties are nested arrays, flatten them first
      const properties = test.properties.flat(); // Flatten the nested arrays
  
      const labTest = properties.find(prop => prop.type === "Test");
      const result = properties.find(prop => prop.type === "Result");
  
      // Find the first refRange with a length less than or equal to 30 characters
      const refRange = properties.filter(prop => prop.type === "Ref_Range")
        .find(prop => prop.mentionText.length <= 30);
  
      return {
        lab_provider: logo.lab_name || "Medpace",
        lab_name: labTest ? labTest.mentionText : 'Unknown',
        value: result ? result.mentionText : 'Pending',
        refValue: refRange ? refRange.mentionText : 'N/A' // Handle missing reference range gracefully
      };
    });
  
    return {
      protocolId: data.find(item => item.type === "protocolId")?.mentionText || 'Unknown',
      investigator: data.find(item => item.type === "investigator")?.mentionText || 'Unknown',
      subjectId: data.find(item => item.type === "subjectId")?.mentionText || 'Unknown',
      dateOfCollection: data.find(item => item.type === "dateOfCollection")?.mentionText || 'Unknown',
      timePoint: data.find(item => item.type === "timePoint")?.mentionText || 'Unknown',
      timeOfCollection: data.find(item => item.type === "Time_of_Collecton")?.mentionText || 'Unknown',
      tests: tests
    };
  };
  
  function cleanTestData(data) {
    // Iterate through tests using a for loop
    for (let i = 0; i < data.tests.length; i++) {
      let test = data.tests[i];
  
      // Remove alphabetic characters from value if not "Pending"
      if (test.value !== "Pending") {
        test.value = test.value.replace(/[a-zA-Z]/g, '').trim();
      }
  
      // Check refValue length and remove if too long
      if (test.refValue && test.refValue.length > 30) {
        console.log(`Removing long refValue: ${test.refValue}`);
        delete test.refValue; // This will remove the refValue field from the test
      }
    }
  
    return data;
  }


const redisConfig = {
  host: 'redis-18209.c326.us-east-1-3.ec2.redns.redis-cloud.com',
  port: 18209,
  password: 'ZHgNfkQhZSFExZwCp52swgzqe6kQ6cKy',
  maxRetriesPerRequest: null, // Disable automatic retries
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


//   const worker = new Worker('pdfProcessing', async (job) => {
//     const { pdfPath, toAddress, DateReceivedEmail } = job.data;
//     console.log("Processing job:", job.id, "data:", job.data);

//     try {
//       const AccessCheck = await users.findOne({ where: { user_email: toAddress } });
//       if (!AccessCheck) {
//         console.log("User not found:", toAddress);
//         return;
//       }
//       console.log("AccessCheck result:", AccessCheck);

//       if (AccessCheck.dataValues.access === 'Resume') {
//         const apiUrl = 'https://gpdataservices.com/process-pdf/';
//         const logoUrl = 'https://gpdataservices.com/ext-logo/';

//         try {
//           const { logo } = await logoExtraction(pdfPath, logoUrl);
//           const { data } = await pdfProcessor(pdfPath, apiUrl);

//           if (!Array.isArray(data)) {
//             console.error("Failed to extract data for:", pdfPath);
//             throw new Error("Data extraction failed");
//           }

//           let extractedData = extractData(data, logo);
//           extractedData = cleanTestData(extractedData);
//           const { pdfname, destination } = await UplaodFile(pdfPath, extractedData);
//           const pdfURL = `${process.env.STORAGE_URL}${destination}`;
//           console.log("PDF URL:", pdfURL);

//           const { pdfEmailId } = await PdfEmail(DateReceivedEmail, pdfname, destination, toAddress);
//           await findAllLabData(extractedData, toAddress, destination, pdfEmailId);
//           const { message, datamade } = await insertOrUpdateLabReport(extractedData, toAddress);

//           if (message === 'Add') {
//             const { labReportId } = await labReport(datamade, pdfEmailId, toAddress);
//             const labdata = datamade.tests;
//             await labReoprtData(labdata, labReportId, pdfEmailId);
//             console.log("Process completed for job:", job.id);
//           } else {
//             console.log("Data already exists for job:", job.id);
//           }
//         } catch (err) {
//           console.error("Error during PDF processing:", err);
//           throw err; // Fail job explicitly
//         }
//       } else if (AccessCheck.dataValues.access === 'Paused') {
//         console.log("User access is paused for:", toAddress);
//         return; // Exit early
//       } else {
//         console.log("User not found or no access for:", toAddress);
//       }
//     } catch (error) {
//       console.error('Job processing error:', error);
//     }
//   }, {
//     connection: redisClient,
//     concurrency: 1 // Adjust as necessary
//   });

//   // Event listeners for job completion and failure
//   worker.on('completed', (job) => {
//     console.log(`Job ${job.id} has completed!`);
//   });

//   worker.on('failed', (job, err) => {
//     console.error(`Job ${job.id} failed with error:`, err);
//   });

//   console.log('Worker is running');

function downloadPdfFromUrl(downloadUrl) {
    // Generate a filename with a timestamp
    const timestamp = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+/, '');
    const filename = `downloadedFile_${timestamp}.pdf`;
    const filePath = path.resolve(__dirname, 'uploads', filename);

    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        })
        .then(response => {
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => resolve(filePath));  // Resolves the promise with the file path
            writer.on('error', reject);  // Rejects the promise if there's an error
        })
        .catch(reject);  // Rejects the promise if there's an error during download
    });
}



async function processJobs() {
    while (true) {
        const jobData = await redisClient.lpop('pdfJobQueue');
        if (jobData) {
            const job = JSON.parse(jobData);
            console.log("Processing job:", job);
            try {
                await processJob(job);
                await redisClient.rpush('successJobQueue', jobData);
                console.log("Job processed successfully and added to success queue:", job);
            } catch (error) {
                console.error("Error processing job:", job, error);
                // Optionally, re-add the job to a 'failedJobQueue' for retry or review
                await redisClient.rpush('failedJobQueue', jobData);
            }
        } else {
            // Wait for a moment before polling again if the queue was empty
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
async function getFileSizeInKB(bucketName, fileName) {
  try {
      const [metadata] = await storage.bucket(bucketName).file(fileName).getMetadata();
      const sizeInKB = metadata.size / 1024;
      return parseFloat(sizeInKB.toFixed(2)); // Converts size to kilobytes and rounds to two decimals
  } catch (error) {
      console.error(`Error retrieving file size for ${fileName}: ${error.message}`);
      return null;
  }
}
async function processJob(job) {
    const { pdfPath, toAddress, DateReceivedEmail } = job;
    // Example usage:
    const filePath = await downloadPdfFromUrl(pdfPath);
    console.log('File downloaded and saved successfully at:', filePath);
    try {
        const AccessCheck = await users.findOne({ where: { user_email: toAddress } });
        if (!AccessCheck) {
            console.log("User not found:", toAddress);
            return;
        }
        console.log("AccessCheck result:", AccessCheck);

        if (AccessCheck.dataValues.access === 'Resume') {
            try {
                const apiUrl = 'https://gpdataservices.com/parse_pdf';
                const logoUrl = 'https://gpdataservices.com/ext-logo/';
                const { logo } = await logoExtraction(filePath, logoUrl);
                const { data } = await pdfProcessor(filePath, apiUrl);

                if (!Array.isArray(data)) {
                    console.error("Failed to extract data for:", filePath);
                    throw new Error("Data extraction failed");
                }

                let extractedData = extractData(data, logo);
                extractedData = cleanTestData(extractedData);
                const { pdfname, destination } = await UplaodFile(filePath, extractedData);
                const pdfURL = `${process.env.STORAGE_URL}${destination}`;
                console.log("PDF URL:", pdfURL);
                const sizeInKB = await getFileSizeInKB('gpdata01', destination); // Use your actual bucket name
                const { pdfEmailId } = await PdfEmail(DateReceivedEmail, pdfname, destination, toAddress,sizeInKB);
                await findAllLabData(extractedData, toAddress, destination, pdfEmailId);
                const { message, datamade } = await insertOrUpdateLabReport(extractedData, toAddress);

                if (message === 'Add') {
                    const { labReportId } = await labReport(datamade, pdfEmailId, toAddress);
                    const labdata = datamade.tests;
                    await labReoprtData(labdata, labReportId, pdfEmailId);
                    console.log("Process completed for job:", job.id);
                    return
                } else {
                    console.log("Data already exists for job:", job.id);
                    return
                }
            } catch (err) {
                console.error("Error during PDF processing:", err);
                throw err; // Re-queue or log failed job depending on your strategy
            }
        } else if (AccessCheck.dataValues.access === 'Paused') {
            console.log("User access is paused for:", toAddress);
            return; // Exit early
        } else {
            console.log("User not found or no access for:", toAddress);
            return
        }
    } catch (error) {
        console.error('Job processing error:', error);
        throw error;  // Re-throw the error to catch block in processJobs
    }
}

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.use(
  jwt({
    secret: process.env.JWT_TOKEN_KEY,
    algorithms: ["HS256"],
  }).unless({
    path: [
      "/api/auth/sign-up",
      "/api/auth/login",
      "/api/auth/reset-password",
      "/api/auth/forget-password",
      "/api/auth/verify",
      "/api/test",
      "/api/ping",
      "/api/googleplay/webhooks",
      "/api/testfunction"
    ]
  })
);

app.use((req, res, next) => {
  req.db = sequelize;
  next();
});

// // Routes setup
// app.use('/api/worker', workerRoutes);

sequelize.sync().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server listening on port ${process.env.PORT}`);
        processJobs(); // Start processing jobs
    });
}).catch(err => {
    console.error("Error starting the server:", err);
});

