const {
  fetchClientPdfCountsAndNotifyEmployees
} = require("../helper/cronJobs");

const {pdf_email} = require("../models/index");
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();


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
let methods = {
    worker: async(req,res)=>{
   // Await the completion of the sendNotifications function
   const result = await fetchClientPdfCountsAndNotifyEmployees();
   // Log the worker status
   console.log('Worker is running');
   // Send a JSON response with the result of sendNotifications
   res.json({
       status: 'success',
       data: result
   });

  console.log('Worker is running');
    },
    updatePdf: async(req,res)=>{
      try {
        const pdfs = await pdf_email.findAll();
        for (const pdf of pdfs) {
          const sizeInKB = await getFileSizeInKB('gpdata01', pdf.pdfPath); // Use your actual bucket name
          if (sizeInKB !== null) {
              await pdf.update({ fileSize: sizeInKB });
              console.log(`Updated PDF ${pdf.id} size to ${sizeInKB} KB.`);
          } else {
              console.log(`Failed to get file size for PDF ${pdf.id}.`);
          }
        }
    } catch (error) {
        console.error(`Error updating PDF sizes: ${error.message}`);
    }
    }
}

module.exports = methods