function doPost(e) {
  try {
    // Get the parameters from the POST request
    const filename = e.parameter.filename;
    const filedata = e.parameter.filedata;
    const filetype = e.parameter.filetype;

    // Log what we received for debugging
    console.log('Received filename:', filename);
    console.log('Received filetype:', filetype);
    console.log('Received filedata length:', filedata ? filedata.length : 'undefined');

    // Validate required parameters
    if (!filename || !filedata || !filetype) {
      throw new Error('Missing required parameters: filename, filedata, or filetype');
    }

    // Get or create the testExp1 folder
    const folders = DriveApp.getFoldersByName('testExp1');
    let targetFolder;
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder('testExp1');
    }

    let savedFile;

    if (filetype === 'excel') {
      // Handle Excel file
      console.log('Processing Excel file...');

      // Convert base64 to blob
      const base64Data = filedata;
      const binaryString = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(binaryString, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename);

      // Save to Google Drive
      savedFile = targetFolder.createFile(blob);
      console.log('Excel file saved successfully');

    } else if (filetype === 'csv') {
      // Handle CSV file (backward compatibility)
      console.log('Processing CSV file...');

      // For CSV, the filedata should be the actual CSV content
      const blob = Utilities.newBlob(filedata, 'text/csv', filename);
      savedFile = targetFolder.createFile(blob);
      console.log('CSV file saved successfully');

    } else {
      throw new Error('Unsupported file type: ' + filetype);
    }

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'File saved successfully',
        filename: filename,
        fileId: savedFile.getId(),
        fileUrl: savedFile.getUrl()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doPost:', error.toString());

    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        message: 'Failed to save file'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script works
function testScript() {
  console.log('Google Apps Script is working correctly');

  // Test folder creation
  const folders = DriveApp.getFoldersByName('testExp1');
  if (folders.hasNext()) {
    console.log('testExp1 folder exists');
  } else {
    console.log('testExp1 folder will be created when needed');
  }
}