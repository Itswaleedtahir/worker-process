const {sequelize, users, pdf_email, labreport_data, lab_report, labreport_csv, ref_range_data, signedPdfs } = require("../models/index");
const sgMail = require('@sendgrid/mail');

async function sendEmailToEmployeeForSign(employeeEmail, clientEmail, pdfCount) {
    const msg = {
        to: employeeEmail,
        from: 'support@gpdataservices.com',
        subject: 'PDF Count Update for Your Client',
        text: `Your client ${clientEmail} has now ${pdfCount} PDFs.`,
        html: `<p>Hello,</p>
               <p>Your client <strong>${clientEmail}</strong> has now <strong>${pdfCount} PDFs</strong> for signing</p>
               <img src="https://storage.googleapis.com/gpdata01/image/image-3.png" style="padding-top: 20px;" width="300px"/>
               <p>Regards,<br>GP Data Services Team</p>`
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully to:', employeeEmail);
    } catch (err) {
        console.error('Failed to send email to:', employeeEmail, err);
    }
}
async function sendEmailToEmployeeForPrint(employeeEmail, clientEmail, pdfCount) {
    const msg = {
        to: employeeEmail,
        from: 'support@gpdataservices.com',
        subject: 'Update on Signed PDF Count for Your Client',
        text: `Your client ${clientEmail} has ${pdfCount} signed PDF(s).`,
        html: `<p>Hello,</p>
               <p>Your client <strong>${clientEmail}</strong> has now <strong>${pdfCount} signed PDF(s)</strong>.</p>
               <p>Regards,<br>GP Data Services Team</p>`
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully to:', employeeEmail);
    } catch (err) {
        console.error('Failed to send email to:', employeeEmail, err);
    }
}
// Function to handle the notification logic
async function fetchClientPdfCountsAndNotifyEmployees() {
    try {
        // Fetch clients and count their PDFs
        const clientsWithPdfCounts = await users.findAll({
            attributes: [
                'user_email',
                [sequelize.fn('COUNT', sequelize.col('pdf_email.id')), 'pdfCount']
            ],
            include: [{
                model: pdf_email,
                attributes: [],
                as: 'pdf_email'
            }],
            where: {
                isEmployee: false  // Assuming 'false' means the user is a client
            },
            group: ['users.id'],  // Group by user id to aggregate PDF counts
            having: sequelize.where(sequelize.fn('COUNT', sequelize.col('pdf_email.id')), '>', 0)  // Only include clients with PDFs
        });

        // For each client, find their employees and send emails
        for (let client of clientsWithPdfCounts) {
            const employees = await users.findAll({
                where: {
                    isEmployee: true,
                    invitedBy: client.user_email  // Assuming 'invitedBy' is the email of the person who invited them
                }
            });

            // Send email to each employee about their client's PDF count
            for (let employee of employees) {
                await sendEmailToEmployeeForSign(employee.user_email, client.user_email, client.dataValues.pdfCount);
            }
        }

          // Fetch non-employee users
          const clients = await users.findAll({
            where: { isEmployee: false },
            attributes: ['user_email']
        });

        // Iterate through each client to process their PDFs
        for (let client of clients) {
            // Count signed PDFs sent to this client's email
            const signedPdfCount = await signedPdfs.count({
                where: {
                    email_to: client.user_email,
                    isSigned: true
                }
            });

            if (signedPdfCount > 0) {
                // Fetch employees invited by this client
                const employees = await users.findAll({
                    where: {
                        isEmployee: true,
                        invitedBy: client.user_email
                    }
                });

                // Send an email to each employee about their client's signed PDF count
                for (let employee of employees) {
                    await sendEmailToEmployeeForPrint(employee.user_email, client.user_email, signedPdfCount);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching client PDF counts or sending emails:', error);
    }
}


module.exports = { fetchClientPdfCountsAndNotifyEmployees };